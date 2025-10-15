// content.js - Content script for screenshot extension

console.log('📸 Screenshot to ChatGPT extension content script loaded');

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Content script received message:', request);
    
    if (request.action === 'screenshot') {
        // Handle screenshot request
        handleScreenshotRequest(request, sendResponse);
        return true; // Keep message channel open for async response
    }
    
    if (request.action === 'hello') {
        // Example response to popup
        sendResponse({
            message: 'Hello from screenshot extension!',
            url: window.location.href,
            title: document.title,
            timestamp: new Date().toISOString()
        });
    }
    
    return true;
});

// Handle screenshot request
function handleScreenshotRequest(request, sendResponse) {
    try {
        // Get page information
        const pageInfo = {
            url: window.location.href,
            title: document.title,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        };
        
        sendResponse({
            success: true,
            pageInfo: pageInfo,
            message: 'Page ready for screenshot'
        });
        
    } catch (error) {
        console.error('Error in screenshot handler:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Inject a subtle indicator that the extension is active
function injectExtensionIndicator() {
    // Remove existing indicator if present
    const existingIndicator = document.getElementById('screenshot-extension-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    const indicator = document.createElement('div');
    indicator.id = 'screenshot-extension-indicator';
    indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: 24px;
        height: 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        z-index: 10000;
        opacity: 0.8;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: white;
        font-weight: bold;
    `;
    indicator.innerHTML = '📸';
    indicator.title = 'Screenshot to ChatGPT extension is active';
    document.body.appendChild(indicator);
    
    // Add pulse animation
    indicator.style.animation = 'pulse 2s infinite';
    
    // Remove indicator after 4 seconds
    setTimeout(() => {
        if (indicator.parentNode) {
            indicator.style.animation = 'fadeOut 0.5s ease-out forwards';
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            }, 500);
        }
    }, 4000);
}

// Add CSS animations
function addExtensionStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1); opacity: 0.8; }
        }
        
        @keyframes fadeOut {
            0% { opacity: 0.8; transform: scale(1); }
            100% { opacity: 0; transform: scale(0.8); }
        }
    `;
    document.head.appendChild(style);
}

// Initialize extension on page load
function initializeExtension() {
    addExtensionStyles();
    injectExtensionIndicator();
    
    // Log page information
    console.log('📸 Screenshot extension active on:', {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString()
    });
}

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    initializeExtension();
}

// Monitor page changes (for SPAs)
let lastUrl = location.href;
const urlObserver = new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log('📸 Page changed to:', url);
        // Re-initialize extension on page change
        setTimeout(initializeExtension, 1000);
    }
});

// Start observing
urlObserver.observe(document, {subtree: true, childList: true});

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
    urlObserver.disconnect();
});
