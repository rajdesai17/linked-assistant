/**
 * LinkedIn Connection Assistant - Content Script
 * Handles profile analysis for message generation in popup
 */

// Debug logging
const DEBUG = true;
function debugLog(message, data = null) {
    if (DEBUG) {
        console.log(`[LinkedIn Assistant Content] ${message}`, data || '');
    }
}

// Track content script readiness
let isContentScriptReady = false;
let currentUrl = window.location.href;

class LinkedInConnectionAssistant {
    constructor() {
        this.settings = {};
        this.loadSettings();
    }

    /**
     * Get profile data for message generation
     */
    getProfileDataForMessage() {
        if (!this.isProfilePage()) {
            return { success: false, error: 'Not a LinkedIn profile page' };
        }

        try {
            const profileData = this.extractProfileData();
            return { success: true, profileData };
        } catch (error) {
            console.error('Error extracting profile data:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Load user settings from Chrome storage
     */
    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['userContext', 'userRole', 'settings']);
            this.settings = result;
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    /**
     * Detect if current page is a LinkedIn profile
     */
    isProfilePage() {
        const url = window.location.href;
        const profilePattern = /linkedin\.com\/in\/[\w-]+\/?(\?.*)?$/;
        return profilePattern.test(url) && 
               (document.querySelector('h1.text-heading-xlarge') || 
                document.querySelector('.pv-text-details__left-panel h1') ||
                document.querySelector('.ph5 h1'));
    }

    /**
     * Extract profile data using multiple fallback selectors
     */
    extractProfileData() {
        const data = {
            name: this.extractName(),
            headline: this.extractHeadline(),
            company: this.extractCompany(),
            location: this.extractLocation(),
            about: this.extractAbout(),
            experience: this.extractExperience(),
            industry: this.extractIndustry()
        };

        debugLog('Extracted profile data:', data);
        return data;
    }

    extractName() {
        const nameSelectors = [
            'h1.text-heading-xlarge',
            '.pv-text-details__left-panel h1',
            '.pv-top-card--list-bullet h1',
            '.ph5 h1',
            'h1.break-words'
        ];

        for (const selector of nameSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                return element.textContent.trim();
            }
        }
        return 'there';
    }

    extractHeadline() {
        const headlineSelectors = [
            '.text-body-medium.break-words',
            '.pv-text-details__left-panel .text-body-medium',
            '.pv-top-card .pv-top-card__headline',
            '.ph5 .text-body-medium'
        ];

        for (const selector of headlineSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                return element.textContent.trim();
            }
        }
        return '';
    }

    extractCompany() {
        const companySelectors = [
            '.pv-text-details__left-panel .pv-entity__secondary-title',
            '.pv-top-card .pv-entity__secondary-title',
            '.ph5 .pv-entity__secondary-title',
            '.experience-section .pv-entity__summary-info .pv-entity__secondary-title',
            '[data-field="experience"] .pv-entity__summary-info .pv-entity__secondary-title'
        ];

        for (const selector of companySelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                return element.textContent.trim();
            }
        }
        return '';
    }

    extractLocation() {
        const locationSelectors = [
            '.text-body-small.inline.t-black--light',
            '.pv-text-details__left-panel .text-body-small',
            '.pv-top-card .pv-top-card__location',
            '.ph5 .text-body-small'
        ];

        for (const selector of locationSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                return element.textContent.trim();
            }
        }
        return '';
    }

    extractAbout() {
        const aboutSelectors = [
            '.pv-shared-text-with-see-more-text .break-words',
            '.pv-about__summary-text .break-words',
            '[data-field="summary"] .break-words',
            '.about-section .pv-shared-text-with-see-more-text'
        ];

        for (const selector of aboutSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                return element.textContent.trim().substring(0, 200) + '...';
            }
        }
        return '';
    }

    extractExperience() {
        const experienceSelectors = [
            '.experience-section .pv-entity__summary-info',
            '[data-field="experience"] .pv-entity__summary-info',
            '.pvs-list__item--experience .pvs-entity__summary-info'
        ];

        for (const selector of experienceSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                return Array.from(elements).slice(0, 2).map(el => el.textContent.trim()).join('; ');
            }
        }
        return '';
    }

    extractIndustry() {
        const headline = this.extractHeadline();
        const about = this.extractAbout();
        const company = this.extractCompany();
        
        const text = `${headline} ${about} ${company}`.toLowerCase();
        
        // Industry keyword detection
        const industries = {
            'tech': ['software', 'developer', 'engineer', 'tech', 'programming', 'coding', 'javascript', 'python', 'react', 'node'],
            'marketing': ['marketing', 'digital', 'social media', 'seo', 'content', 'brand', 'advertising'],
            'sales': ['sales', 'business development', 'account', 'revenue', 'client', 'customer'],
            'finance': ['finance', 'financial', 'investment', 'banking', 'accounting', 'analyst'],
            'healthcare': ['healthcare', 'medical', 'doctor', 'nurse', 'physician', 'hospital', 'clinic'],
            'education': ['education', 'teacher', 'professor', 'academic', 'university', 'school'],
            'consulting': ['consulting', 'consultant', 'advisory', 'strategy', 'management']
        };

        for (const [industry, keywords] of Object.entries(industries)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return industry;
            }
        }
        
        return 'professional';
    }
}

// Initialize content script
function initializeContentScript() {
    if (isContentScriptReady) return;
    
    debugLog('LinkedIn Connection Assistant content script initializing...');
    
    // Initialize the assistant
    window.linkedinAssistant = new LinkedInConnectionAssistant();
    
    isContentScriptReady = true;
    debugLog('Content script ready on:', window.location.href);
    
    // Set global flag for debugging
    window.linkedInAssistantLoaded = true;
}

// Handle URL changes for LinkedIn SPA navigation
function handleUrlChange() {
    if (currentUrl !== window.location.href) {
        currentUrl = window.location.href;
        debugLog('URL changed to:', currentUrl);
        
        // Reinitialize if on profile page
        if (window.linkedinAssistant && window.linkedinAssistant.isProfilePage()) {
            setTimeout(() => {
                debugLog('Reinitializing after navigation');
            }, 1000);
        }
    }
}

// Monitor URL changes for LinkedIn SPA
const observer = new MutationObserver(handleUrlChange);

// Message listener with ping handling and robust error handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    debugLog('Message received:', request.action);

    // Handle ping messages from background script
    if (request.action === 'ping') {
        sendResponse({ ready: isContentScriptReady });
        return true;
    }

    // Ensure content script is ready
    if (!isContentScriptReady) {
        debugLog('Content script not ready, initializing...');
        initializeContentScript();
    }

    // Handle other messages
    if (!window.linkedinAssistant) {
        debugLog('Assistant not initialized');
        sendResponse({ success: false, error: 'Assistant not initialized' });
        return true;
    }

    if (request.action === 'getProfileData') {
        const result = window.linkedinAssistant.getProfileDataForMessage();
        debugLog('Profile data request result:', result.success);
        sendResponse(result);
    } else if (request.action === 'settingsUpdated') {
        window.linkedinAssistant.settings = request.data;
        sendResponse({ success: true });
    } else {
        debugLog('Unknown action:', request.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }
    
    return true; // Keep message channel open for async response
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        debugLog('DOM content loaded');
        initializeContentScript();
        observer.observe(document.body, { childList: true, subtree: true });
    });
} else {
    debugLog('DOM already ready');
    initializeContentScript();
    observer.observe(document.body, { childList: true, subtree: true });
}

// Also initialize immediately for LinkedIn.com
if (window.location.href.includes('linkedin.com')) {
    initializeContentScript();
} 