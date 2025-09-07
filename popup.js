/**
 * LinkedIn Connection Assistant - Popup Manager
 * Handles popup interface, settings management, and message generation
 */

// Debug logging
const DEBUG = true;
function debugLog(message, data = null) {
    if (DEBUG) {
        console.log(`[LinkedIn Assistant Popup] ${message}`, data || '');
    }
}

class PopupManager {
    constructor() {
        this.initializeElements();
        this.attachEventListeners();
        this.loadSettings();
    }

    initializeElements() {
        this.settingsForm = document.getElementById('settingsForm');
        this.userContextTextarea = document.getElementById('userContext');
        this.userRoleTextarea = document.getElementById('userRole');
        this.messagePreviewTextarea = document.getElementById('messagePreview');
        this.saveButton = document.getElementById('saveButton');
        this.generateButton = document.getElementById('generateButton');
        this.copyButton = document.getElementById('copyButton');
        this.regenerateButton = document.getElementById('regenerateButton');
        this.messageActions = document.getElementById('messageActions');
        this.statusMessage = document.getElementById('statusMessage');
        this.buttonText = this.saveButton.querySelector('.button-text');
        this.buttonLoader = this.saveButton.querySelector('.button-loader');
        this.generateText = this.generateButton.querySelector('.generate-text');
        this.generateLoader = this.generateButton.querySelector('.generate-loader');
        this.copyText = this.copyButton.querySelector('.copy-text');
        
        // Validate critical elements
        if (!this.messagePreviewTextarea) {
            debugLog('ERROR: messagePreview textarea not found!');
        } else {
            debugLog('messagePreview textarea found successfully');
        }
    }

    attachEventListeners() {
        this.settingsForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        this.generateButton.addEventListener('click', () => this.handleGenerateMessage());
        this.copyButton.addEventListener('click', () => this.handleCopyMessage());
        this.regenerateButton.addEventListener('click', () => this.handleRegenerateMessage());
        
        // Auto-update UI when user types
        this.userContextTextarea.addEventListener('input', () => this.debounce(this.updateUI.bind(this), 500)());
        this.userRoleTextarea.addEventListener('input', () => this.debounce(this.updateUI.bind(this), 500)());
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['userContext', 'userRole', 'settings']);
            
            if (result.userContext) {
                this.userContextTextarea.value = result.userContext;
            }
            
            if (result.userRole) {
                this.userRoleTextarea.value = result.userRole;
            }
            
            // Update UI state
            await this.updateUI();
            
        } catch (error) {
            debugLog('Error loading settings:', error);
            this.showStatus('Error loading settings', 'error');
        }
    }

    async updateUI() {
        const userContext = this.userContextTextarea.value.trim();
        const userRole = this.userRoleTextarea.value.trim();
        
        // Check if we're on a LinkedIn profile page
        const isLinkedInProfile = await this.checkCurrentTab();
        
        // Enable generate button if settings are filled and we're on LinkedIn
        const canGenerate = userContext && userRole && isLinkedInProfile;
        this.generateButton.disabled = !canGenerate;
        
        if (!userContext || !userRole) {
            this.messagePreviewTextarea.value = 'Please fill in your professional context and role above...';
            this.messageActions.style.display = 'none';
        } else if (!isLinkedInProfile) {
            this.messagePreviewTextarea.value = 'Navigate to a LinkedIn profile page to generate personalized messages...';
            this.messageActions.style.display = 'none';
        } else {
            this.messagePreviewTextarea.value = 'Click "Generate Message" to create a personalized LinkedIn connection message...';
        }
    }

    async checkCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url) {
                return /linkedin\.com\/in\/[\w-]+\/?(\?.*)?$/.test(tab.url);
            }
        } catch (error) {
            debugLog('Error checking current tab:', error);
        }
        return false;
    }

    /**
     * Enhanced message sending with error handling
     */
    async sendMessageToBackground(message) {
        try {
            const response = await chrome.runtime.sendMessage(message);
            return response;
        } catch (error) {
            debugLog('Background script communication error:', error);
            
            if (error.message.includes('Receiving end does not exist')) {
                this.showStatus('Extension needs to be reloaded. Please refresh this popup.', 'error');
            } else {
                this.showStatus('Communication error with extension background.', 'error');
            }
            return null;
        }
    }

    async handleGenerateMessage() {
        try {
            this.setGenerateLoading(true);
            this.messageActions.style.display = 'none';
            this.messagePreviewTextarea.value = '';

            // 1. Get user input from the popup
            const userContext = this.userContextTextarea.value.trim();
            const userRole = this.userRoleTextarea.value.trim();
            if (!userContext || !userRole) {
                this.showStatus('Please fill in your context and role.', 'error');
                return;
            }

            // 2. Get profile data from the active tab's content script
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.id) {
                this.showStatus('Could not access the current tab.', 'error');
                return;
            }

            let profileResponse;
            try {
                profileResponse = await chrome.tabs.sendMessage(tab.id, { action: 'getProfileData' });
            } catch (msgError) {
                debugLog('Content script communication error:', msgError);
                
                // Fallback: try injecting content script if it doesn't exist on the page
                if (msgError?.message?.includes('Receiving end does not exist')) {
                    try {
                        debugLog('Attempting content script injection...');
                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['content.js']
                        });
                        
                        // Wait for initialization
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        // Retry after injection
                        profileResponse = await chrome.tabs.sendMessage(tab.id, { action: 'getProfileData' });
                        debugLog('Profile data retrieved after injection');
                    } catch (injectErr) {
                        debugLog('Injection failed:', injectErr);
                        throw new Error('Connection failed even after injecting content script. Please refresh the LinkedIn page.');
                    }
                } else {
                    throw msgError;
                }
            }
            
            if (!profileResponse || !profileResponse.success) {
                this.showStatus(profileResponse?.error || 'Could not get profile data. Please ensure you are on a LinkedIn profile page and refresh.', 'error');
                return;
            }

            // 3. Send all data to the background script to call Gemini API
            const geminiResponse = await this.sendMessageToBackground({
                action: 'generateGeminiMessage',
                data: {
                    profileData: profileResponse.profileData,
                    userContext,
                    userRole
                }
            });

            // 4. Handle the response from the Gemini API
            if (geminiResponse && geminiResponse.success) {
                debugLog('Gemini response received:', geminiResponse);
                debugLog('Message content:', geminiResponse.message);
                debugLog('Message length:', geminiResponse.message?.length);
                
                // Ensure textarea exists and set the message
                if (this.messagePreviewTextarea) {
                    this.messagePreviewTextarea.value = geminiResponse.message;
                    debugLog('Textarea value set to:', this.messagePreviewTextarea.value);
                    
                    // Force DOM update
                    this.messagePreviewTextarea.dispatchEvent(new Event('input'));
                    
                    // Double-check it stuck
                    setTimeout(() => {
                        debugLog('Textarea value after 100ms:', this.messagePreviewTextarea.value);
                        if (!this.messagePreviewTextarea.value || this.messagePreviewTextarea.value === '') {
                            debugLog('Textarea was cleared! Re-setting...');
                            this.messagePreviewTextarea.value = geminiResponse.message;
                        }
                    }, 100);
                } else {
                    debugLog('ERROR: messagePreviewTextarea is null!');
                }
                
                this.messageActions.style.display = 'flex';
                this.showStatus('Message generated successfully!', 'success');
                debugLog('Message generated and displayed');
            } else {
                debugLog('Gemini response failed:', geminiResponse);
                const errorMsg = geminiResponse?.error || 'Failed to generate message from API.';
                this.showStatus(errorMsg, 'error');
                this.messagePreviewTextarea.value = 'Sorry, an error occurred. Please try again or check the extension logs.';
            }

        } catch (error) {
            debugLog('Error in handleGenerateMessage:', error);
            
            if (error.message.includes('Receiving end does not exist')) {
                this.showStatus('Connection failed. Please refresh the LinkedIn page.', 'error');
                this.messagePreviewTextarea.value = 'Could not connect to the LinkedIn page. This can happen if the page was open before the extension was installed or updated. Please refresh the page and try again.';
            } else {
                this.showStatus(`An unexpected error occurred: ${error.message}`, 'error');
            }
        } finally {
            this.setGenerateLoading(false);
        }
    }

    async handleCopyMessage() {
        try {
            const message = this.messagePreviewTextarea.value;
            await navigator.clipboard.writeText(message);
            
            // Show success feedback
            const originalText = this.copyText.textContent;
            this.copyText.textContent = 'Copied!';
            this.copyButton.style.backgroundColor = '#28a745';
            
            setTimeout(() => {
                this.copyText.textContent = originalText;
                this.copyButton.style.backgroundColor = '';
            }, 2000);
            
            debugLog('Message copied to clipboard');
            
        } catch (error) {
            debugLog('Error copying message:', error);
            this.showStatus('Failed to copy message', 'error');
        }
    }

    async handleRegenerateMessage() {
        debugLog('Regenerating message...');
        await this.handleGenerateMessage();
    }

    setGenerateLoading(loading) {
        if (loading) {
            this.generateText.style.display = 'none';
            this.generateLoader.style.display = 'inline';
            this.generateButton.disabled = true;
        } else {
            this.generateText.style.display = 'inline';
            this.generateLoader.style.display = 'none';
            // Only update UI if no message is currently displayed
            if (!this.messagePreviewTextarea.value || 
                this.messagePreviewTextarea.value.includes('Click "Generate Message"') ||
                this.messagePreviewTextarea.value.includes('Please fill in') ||
                this.messagePreviewTextarea.value.includes('Navigate to a LinkedIn')) {
                this.updateUI();
            } else {
                // Just re-enable the button without changing the message
                this.generateButton.disabled = false;
                debugLog('Preserving existing message, not calling updateUI');
            }
        }
    }

    async handleFormSubmit(event) {
        event.preventDefault();
        
        try {
            this.setLoading(true);
            
            const userContext = this.userContextTextarea.value.trim();
            const userRole = this.userRoleTextarea.value.trim();
            
            if (!userContext || !userRole) {
                this.showStatus('Please fill in all required fields', 'error');
                return;
            }
            
            const settings = {
                userContext,
                userRole,
                timestamp: new Date().toISOString()
            };

            await chrome.storage.sync.set(settings);
            
            this.showStatus('Settings saved successfully! 🎉', 'success');
            await this.updateUI();
            
            // Send message to content script if active tab is LinkedIn
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab && tab.url && tab.url.includes('linkedin.com')) {
                    // Try to notify content script of settings update
                    try {
                        await chrome.tabs.sendMessage(tab.id, {
                            action: 'settingsUpdated',
                            data: settings
                        });
                        debugLog('Settings update sent to content script');
                    } catch (contentError) {
                        debugLog('Could not notify content script of settings update:', contentError);
                        // This is not critical, settings are stored and will be loaded when needed
                    }
                }
            } catch (tabError) {
                debugLog('Error checking active tab:', tabError);
            }
            
        } catch (error) {
            debugLog('Error saving settings:', error);
            this.showStatus('Error saving settings. Please try again.', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(loading) {
        if (loading) {
            this.buttonText.style.display = 'none';
            this.buttonLoader.style.display = 'inline';
            this.saveButton.disabled = true;
        } else {
            this.buttonText.style.display = 'inline';
            this.buttonLoader.style.display = 'none';
            this.saveButton.disabled = false;
        }
    }

    showStatus(message, type = 'info') {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message status-${type}`;
        this.statusMessage.style.display = 'block';
        
        debugLog(`Status (${type}):`, message);
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                this.statusMessage.style.display = 'none';
            }, 3000);
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    debugLog('Popup DOM loaded, initializing...');
    
    try {
        window.popupManager = new PopupManager();
        debugLog('Popup manager initialized successfully');
    } catch (error) {
        debugLog('Error initializing popup manager:', error);
        
        // Show basic error message if initialization fails
        const statusEl = document.getElementById('statusMessage');
        if (statusEl) {
            statusEl.textContent = 'Error initializing popup. Please reload the extension.';
            statusEl.className = 'status-message status-error';
            statusEl.style.display = 'block';
        }
    }
});

// Handle extension icon click
chrome.action?.onClicked?.addListener(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab.url && activeTab.url.includes('linkedin.com')) {
            chrome.tabs.sendMessage(activeTab.id, { action: 'showGenerateButton' });
        }
    });
}); 