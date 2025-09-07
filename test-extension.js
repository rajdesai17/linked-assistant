/**
 * LinkedIn Connection Assistant - Test Script
 * Paste this into the browser console on a LinkedIn profile page to test
 */

console.log("🧪 Testing LinkedIn Connection Assistant Extension");
console.log("=================================================");

// Test 1: Check if we're on a LinkedIn profile
const currentUrl = window.location.href;
const isLinkedInProfile = /linkedin\.com\/in\/[\w-]+\/?(\?.*)?$/.test(currentUrl);

console.log("Current URL:", currentUrl);
console.log("Is LinkedIn Profile:", isLinkedInProfile ? "✅ YES" : "❌ NO");

if (!isLinkedInProfile) {
    console.log("⚠️ Please navigate to a LinkedIn profile (linkedin.com/in/username)");
    console.log("Try these public profiles:");
    console.log("- https://www.linkedin.com/in/satyanadella");
    console.log("- https://www.linkedin.com/in/reid-hoffman-official");
}

// Test 2: Check for extension content script
console.log("\nChecking for extension content script:");
if (window.linkedinAssistant) {
    console.log("✅ Content script loaded");
    
    // Manually trigger button creation
    try {
        window.linkedinAssistant.checkProfilePage();
        console.log("✅ Manually triggered button check");
    } catch (error) {
        console.log("❌ Error triggering button:", error);
    }
} else {
    console.log("❌ Content script not found");
    console.log("Possible solutions:");
    console.log("1. Refresh the page");
    console.log("2. Check if extension is enabled in chrome://extensions/");
    console.log("3. Reload the extension");
}

// Test 3: Check for Generate Message button
setTimeout(() => {
    const button = document.querySelector('.linkedin-assistant-button');
    console.log("\nGenerate Message button:", button ? "✅ FOUND" : "❌ NOT FOUND");
    
    if (button) {
        console.log("Button element:", button);
        console.log("Button text:", button.textContent);
        
        // Test button click
        console.log("Testing button click...");
        button.click();
    } else {
        console.log("Button not found. Looking for Connect buttons:");
        const allButtons = document.querySelectorAll('button');
        const connectButtons = Array.from(allButtons).filter(btn => 
            btn.textContent && btn.textContent.toLowerCase().includes('connect')
        );
        console.log("Connect buttons found:", connectButtons.length);
        connectButtons.forEach((btn, i) => {
            console.log(`${i + 1}:`, btn.textContent.trim());
        });
    }
}, 5000);

// Test 4: Manually create button if needed
function manuallyCreateButton() {
    console.log("\n🔧 Manually creating Generate Message button...");
    
    // Find a suitable container
    const h1 = document.querySelector('h1');
    if (!h1) {
        console.log("❌ Could not find profile name (h1 element)");
        return;
    }
    
    // Create button
    const button = document.createElement('button');
    button.className = 'linkedin-assistant-button';
    button.innerHTML = `
        <span style="margin-right: 6px;">✨</span>
        <span>Generate Message</span>
    `;
    button.style.cssText = `
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 12px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
    `;
    
    // Add click handler
    button.addEventListener('click', () => {
        console.log("🎉 Generate Message button clicked!");
        alert("Generate Message button is working!\n\nNext steps:\n1. Configure extension settings\n2. Test message generation");
    });
    
    // Add to page
    const container = document.createElement('div');
    container.appendChild(button);
    h1.parentElement.appendChild(container);
    
    console.log("✅ Manual button created and added to page");
    return button;
}

// Add manual button creation function to window for easy access
window.createTestButton = manuallyCreateButton;

console.log("\n📝 Test complete!");
console.log("If button not found, run: createTestButton()"); 