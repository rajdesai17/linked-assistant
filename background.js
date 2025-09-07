/**
 * LinkedIn Connection Assistant - Background Service Worker
 * Manages API calls to Google Gemini and extension lifecycle events.
 */

// Debug logging
const DEBUG = true;
function debugLog(message, data = null) {
    if (DEBUG) {
        console.log(`[LinkedIn Assistant Background] ${message}`, data || '');
    }
}

let geminiApiKey = null;

/**
 * Loads the Gemini API key from the .env file.
 * This is not a secure practice for production extensions.
 * For development purposes only.
 */
async function loadApiKey() {
    if (geminiApiKey) return geminiApiKey;

    try {
        const response = await fetch(chrome.runtime.getURL('.env'));
        if (!response.ok) {
            console.error('Failed to load .env file. Status:', response.status);
            return null;
        }
        const text = await response.text();
        const match = text.match(/^GEMINI_API_KEY=(.+)$/m);
        if (match && match[1]) {
            geminiApiKey = match[1].trim();
            debugLog('Gemini API Key loaded successfully.');
            return geminiApiKey;
        } else {
            console.error('GEMINI_API_KEY not found in .env file.');
            return null;
        }
    } catch (error) {
        console.error('Error loading API key:', error);
        return null;
    }
}

/**
 * Enhanced message sending with connection validation and fallback injection
 */
async function sendMessageToTab(tabId, message) {
    try {
        // Check if tab exists and is accessible
        const tab = await chrome.tabs.get(tabId);
        if (!tab || !tab.url.includes('linkedin.com')) {
            debugLog('Tab not accessible or not LinkedIn:', tab?.url);
            return { success: false, error: 'Tab not accessible or not on LinkedIn' };
        }

        // Check if content script is ready
        try {
            const pingResponse = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
            if (pingResponse?.ready) {
                debugLog('Content script ready, sending message');
                return await chrome.tabs.sendMessage(tabId, message);
            }
        } catch (pingError) {
            debugLog('Content script not ready, attempting injection:', pingError.message);
        }
        
        // Try to inject content script if not loaded
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });
            
            debugLog('Content script injected, waiting for initialization');
            
            // Wait for initialization
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Try sending message again
            return await chrome.tabs.sendMessage(tabId, message);
        } catch (injectionError) {
            debugLog('Failed to inject content script:', injectionError);
            return { success: false, error: 'Failed to inject content script. Please refresh the page.' };
        }
    } catch (error) {
        debugLog('Error in sendMessageToTab:', error);
        return { success: false, error: error.message };
    }
}

// Load the API key when the extension starts.
chrome.runtime.onStartup.addListener(() => {
    debugLog('Extension startup');
    loadApiKey();
});

// Also load it on installation for the first run.
chrome.runtime.onInstalled.addListener(() => {
    debugLog('Extension installed/updated');
    loadApiKey();
});

/**
 * Listener for messages from other parts of the extension, e.g., the popup.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    debugLog('Message received in background:', request.action);
    debugLog('Sender info:', {
        tab: sender.tab?.id,
        url: sender.tab?.url,
        frameId: sender.frameId
    });

    if (request.action === 'generateGeminiMessage') {
        handleGenerateMessage(request.data)
            .then(sendResponse)
            .catch(error => {
                debugLog('Error in handleGenerateMessage:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Indicates an async response.
    }
    
    return true; // Keep message channel open
});

/**
 * Handles the message generation process by calling the Gemini API.
 * @param {object} data - The data from the popup, including profile and user info.
 * @returns {Promise<object>} A promise that resolves with the generation result.
 */
async function handleGenerateMessage(data) {
    const apiKey = await loadApiKey();
    if (!apiKey) {
        return { success: false, error: 'API Key not loaded. Please check your .env file and reload the extension.' };
    }

    const { profileData, userContext, userRole } = data;
    const prompt = createPrompt(profileData);

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    try {
        debugLog('Calling Gemini API...');
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.9,
                    topK: 1,
                    topP: 0.95,
                    maxOutputTokens: 100, // LinkedIn limit is 300 chars, this gives breathing room.
                    stopSequences: [],
                },
                safetySettings: [
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                ]
            }),
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error('Gemini API request failed:', errorBody);
            throw new Error(`Google Gemini API error: ${errorBody.error?.message || response.statusText}`);
        }

        const responseData = await response.json();
        
        if (responseData.candidates && responseData.candidates.length > 0) {
            const message = responseData.candidates[0].content.parts[0].text;
            debugLog('Message generated successfully');
            return { success: true, message: message.trim() };
        } else if (responseData.promptFeedback && responseData.promptFeedback.blockReason) {
            console.error('Prompt was blocked by Gemini API:', responseData.promptFeedback);
            return { success: false, error: `Message generation failed because the prompt was blocked. Reason: ${responseData.promptFeedback.blockReason}` };
        } 
        else {
            console.error('No candidates returned from Gemini API:', responseData);
            return { success: false, error: 'Message generation failed. The API returned an empty response.' };
        }
    } catch (error) {
        debugLog('Error calling Gemini API:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Creates a detailed prompt for the Gemini API.
 * @param {object} profileData - Data scraped from the LinkedIn profile.
 * @returns {string} The constructed prompt.
 */
function createPrompt(profileData) {
    const firstName = (profileData.name || 'there').split(' ')[0];
    return `
Write ONE LinkedIn connection message that follows ALL rules:

• Must be 295-300 characters total (hard cap). Count spaces & punctuation.
• Start with "Hi ${firstName}," using their first name.
• Mention ONE specific fact about their work, company, or field (headline: ${profileData.headline}; company: ${profileData.company}; industry: ${profileData.industry}).
• Introduce yourself briefly: you are a computer-science graduate and full-stack developer (phrase it naturally, no tech buzzword list).
• State you are currently exploring opportunities and open to hearing about relevant roles.
• Offer to share your resume if helpful.
• Use plain, respectful English – no slang, hype, buzzwords, or job-begging phrases (e.g., don't say "open to work").
• Keep the tone clean, casual, raw, and real – avoid flattery or compliments like "impressed by your work".
• End with a brief close like "Let me know.", "Would be glad to connect.", or "Happy to connect if that works for you." Pick any ONE.
• Aim for natural variety; do not repeat exact sentences each time.

Return ONLY the single message text (no extra words).
`;
}

// Service Worker Lifecycle Management
let keepAliveInterval;

function keepServiceWorkerAlive() {
    if (keepAliveInterval) return; // Already running
    
    keepAliveInterval = setInterval(() => {
        chrome.tabs.query({}, () => {
            debugLog('Service worker heartbeat');
        });
    }, 25000); // 25 seconds
    
    debugLog('Service worker keep-alive started');
}

function stopKeepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
        debugLog('Service worker keep-alive stopped');
    }
}

// Handle service worker lifecycle
chrome.runtime.onStartup.addListener(() => {
    debugLog('Extension startup');
});

chrome.runtime.onSuspend.addListener(() => {
    debugLog('Service worker suspending');
    stopKeepAlive();
});

// Enhanced BackgroundManager with improved error handling
class BackgroundManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Handle extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstallation(details);
        });

        // Handle extension startup
        chrome.runtime.onStartup.addListener(() => {
            this.handleStartup();
        });

        // Handle messages from content scripts and popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            // Start keep-alive when extension is actively used
            keepServiceWorkerAlive();
            
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });

        // Handle extension icon click (fallback if popup doesn't open)
        chrome.action.onClicked.addListener((tab) => {
            this.handleIconClick(tab);
        });

        // Handle tab updates to manage extension state
        if (chrome.tabs && chrome.tabs.onUpdated) {
            chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
                this.handleTabUpdate(tabId, changeInfo, tab);
            });
        }
    }

    /**
     * Handle extension installation and updates
     */
    async handleInstallation(details) {
        try {
            if (details.reason === 'install') {
                debugLog('LinkedIn Connection Assistant installed');
                
                // Set default settings
                await this.setDefaultSettings();
                
                // Open welcome/setup page
                chrome.tabs.create({
                    url: chrome.runtime.getURL('popup.html')
                });
                
            } else if (details.reason === 'update') {
                debugLog('LinkedIn Connection Assistant updated');
                
                // Handle any necessary migration or updates
                await this.handleUpdate(details.previousVersion);
            }
        } catch (error) {
            debugLog('Error during installation:', error);
        }
    }

    /**
     * Handle extension startup
     */
    async handleStartup() {
        try {
            debugLog('LinkedIn Connection Assistant started');
            
            // Verify settings integrity
            await this.verifySettings();
            
        } catch (error) {
            debugLog('Error during startup:', error);
        }
    }

    /**
     * Handle messages from content scripts and popup
     */
    async handleMessage(request, sender, sendResponse) {
        try {
            debugLog('BackgroundManager handling message:', request.action);
            
            switch (request.action) {
                case 'getSettings':
                    const settings = await this.getSettings();
                    sendResponse({ success: true, data: settings });
                    break;

                case 'saveSettings':
                    await this.saveSettings(request.data);
                    sendResponse({ success: true });
                    break;

                case 'generateMessage':
                    const message = await this.generateMessage(request.profileData, request.userContext);
                    sendResponse({ success: true, message });
                    break;

                case 'logActivity':
                    await this.logActivity(request.data);
                    sendResponse({ success: true });
                    break;

                case 'generateGeminiMessage':
                    // handled by top-level listener; ignore here
                    break;

                default:
                    debugLog('Unknown action in BackgroundManager:', request.action);
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            debugLog('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle extension icon click
     */
    async handleIconClick(tab) {
        try {
            if (tab.url && tab.url.includes('linkedin.com')) {
                // If on LinkedIn, try to communicate with content script
                const result = await sendMessageToTab(tab.id, { action: 'showGenerateButton' });
                if (!result.success) {
                    debugLog('Content script communication failed, reloading tab');
                    chrome.tabs.reload(tab.id);
                }
            } else {
                // If not on LinkedIn, redirect to LinkedIn
                chrome.tabs.update(tab.id, { 
                    url: 'https://www.linkedin.com' 
                });
            }
        } catch (error) {
            debugLog('Error handling icon click:', error);
        }
    }

    /**
     * Handle tab updates
     */
    async handleTabUpdate(tabId, changeInfo, tab) {
        try {
            // Update extension title based on current tab
            if (changeInfo.status === 'complete' && tab.url) {
                if (tab.url.includes('linkedin.com')) {
                    // Enable extension title on LinkedIn
                    chrome.action.setTitle({
                        tabId: tabId,
                        title: "LinkedIn Connection Assistant - Generate personalized messages"
                    });
                } else {
                    chrome.action.setTitle({
                        tabId: tabId,
                        title: "LinkedIn Connection Assistant - Works on LinkedIn.com"
                    });
                }
            }
        } catch (error) {
            debugLog('Error handling tab update:', error);
        }
    }

    /**
     * Set default settings for new installations
     */
    async setDefaultSettings() {
        const defaultSettings = {
            userContext: '',
            userRole: '',
            settings: {
                messageLength: 'medium',
                tone: 'professional',
                autoGenerate: false
            },
            statistics: {
                messagesGenerated: 0,
                extensionInstalled: new Date().toISOString()
            }
        };

        await chrome.storage.sync.set(defaultSettings);
        debugLog('Default settings initialized');
    }

    /**
     * Handle extension updates
     */
    async handleUpdate(previousVersion) {
        // Handle any necessary migrations between versions
        debugLog(`Updated from version ${previousVersion}`);
        
        // Example migration logic
        const currentSettings = await chrome.storage.sync.get();
        
        // Add any new settings fields that might be missing
        if (!currentSettings.statistics) {
            currentSettings.statistics = {
                messagesGenerated: 0,
                extensionUpdated: new Date().toISOString()
            };
            await chrome.storage.sync.set(currentSettings);
        }
    }

    /**
     * Verify settings integrity
     */
    async verifySettings() {
        try {
            const settings = await chrome.storage.sync.get();
            
            // Check if required settings exist
            if (!settings.settings) {
                await this.setDefaultSettings();
            }
            
            debugLog('Settings verified');
        } catch (error) {
            debugLog('Error verifying settings:', error);
            await this.setDefaultSettings();
        }
    }

    /**
     * Get all settings
     */
    async getSettings() {
        return await chrome.storage.sync.get();
    }

    /**
     * Save settings
     */
    async saveSettings(newSettings) {
        const currentSettings = await chrome.storage.sync.get();
        const updatedSettings = { ...currentSettings, ...newSettings };
        await chrome.storage.sync.set(updatedSettings);
    }

    /**
     * Generate message (could be enhanced with AI API in the future)
     */
    async generateMessage(profileData, userContext) {
        // This is a placeholder for potential AI integration
        // For now, the message generation is handled in content script
        return "Message generation handled by content script";
    }

    /**
     * Log activity for analytics (optional)
     */
    async logActivity(activityData) {
        try {
            const currentStats = await chrome.storage.sync.get(['statistics']);
            const stats = currentStats.statistics || {};
            
            // Update statistics
            if (activityData.type === 'messageGenerated') {
                stats.messagesGenerated = (stats.messagesGenerated || 0) + 1;
                stats.lastMessageGenerated = new Date().toISOString();
            }
            
            await chrome.storage.sync.set({ statistics: stats });
        } catch (error) {
            debugLog('Error logging activity:', error);
        }
    }
}

// Initialize background manager
const backgroundManager = new BackgroundManager();

// Handle service worker lifecycle events
self.addEventListener('activate', event => {
    debugLog('Service worker activated');
});

self.addEventListener('install', event => {
    debugLog('Service worker installed');
    self.skipWaiting();
}); 