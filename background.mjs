// background.js - Service worker for screenshot extension

console.log('📸 Screenshot to ChatGPT extension background script loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener(function(details) {
    console.log('📸 Extension installed/updated:', details.reason);
    
    if (details.reason === 'install') {
        // First time installation
        chrome.storage.local.set({
            screenshotExtensionState: {
                installed: new Date().toISOString(),
                version: chrome.runtime.getManifest().version,
                screenshotsTaken: 0,
                lastScreenshot: null
            },
            screenshotHistory: []
        });
        
        console.log('📸 Screenshot extension installed for the first time');
        
        // Show welcome notification
        chrome.notifications.create({
            type: 'basic',
            title: 'Screenshot to ChatGPT',
            message: 'Расширение установлено! Нажмите на иконку для создания скриншота или откройте side panel.'
        });
        
        // Enable side panel for all tabs
        enableSidePanelForAllTabs();
        
    } else if (details.reason === 'update') {
        // Extension updated
        console.log('📸 Extension updated from version', details.previousVersion);
        
        // Enable side panel for all tabs after update
        enableSidePanelForAllTabs();
    }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(function() {
    console.log('📸 Screenshot extension started');
});

// Handle browser action click - open side panel
chrome.action.onClicked.addListener(async function(tab) {
    console.log('📸 Extension icon clicked on tab:', tab.id);
    
    try {
        // Open side panel
        await chrome.sidePanel.open({tabId: tab.id});
        console.log('📸 Side panel opened for tab:', tab.id);
    } catch (error) {
        console.error('📸 Error opening side panel:', error);
    }
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('📸 Background received message:', request, 'from:', sender);
    
    if (request.action === 'takeScreenshot') {
        // Handle screenshot request
        handleScreenshotRequest(request, sender, sendResponse);
        return true; // Keep message channel open for async response
    }
    
    if (request.action === 'getTabInfo') {
        // Get current tab information
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                sendResponse({
                    url: tabs[0].url,
                    title: tabs[0].title,
                    id: tabs[0].id,
                    timestamp: new Date().toISOString()
                });
            }
        });
        return true;
    }
    
    if (request.action === 'saveScreenshotData') {
        // Save screenshot data to storage
        const screenshotData = {
            dataUrl: request.dataUrl,
            url: request.url,
            title: request.title,
            timestamp: new Date().toISOString()
        };
        
        chrome.storage.local.set({lastScreenshot: screenshotData}, function() {
            // Update screenshot counter
            chrome.storage.local.get(['screenshotExtensionState'], function(result) {
                const state = result.screenshotExtensionState || {screenshotsTaken: 0};
                state.screenshotsTaken++;
                state.lastScreenshot = screenshotData;
                chrome.storage.local.set({screenshotExtensionState: state});
            });
            
            sendResponse({success: true});
        });
        return true;
    }
    
    if (request.action === 'loadScreenshotData') {
        // Load screenshot data from storage
        chrome.storage.local.get(['lastScreenshot', 'screenshotExtensionState'], function(result) {
            sendResponse({
                lastScreenshot: result.lastScreenshot || null,
                stats: result.screenshotExtensionState || null
            });
        });
        return true;
    }
    
    if (request.action === 'openChatGPT') {
        // Open ChatGPT in new tab
        chrome.tabs.create({
            url: 'https://chat.openai.com/',
            active: true
        });
        sendResponse({success: true});
        return true;
    }

    if (request.action === 'sendToChatGPT') {
        // Send screenshot to ChatGPT API
        console.log('📸 Sending screenshot to ChatGPT API');
        handleChatGPTRequest(request, sendResponse);
        return true;
    }
});

// Handle screenshot request
function handleScreenshotRequest(request, sender, sendResponse) {
    try {
        // Get current tab
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                const tab = tabs[0];
                
                // Take screenshot of visible area
                chrome.tabs.captureVisibleTab(tab.windowId, {
                    format: 'png',
                    quality: 90
                }, function(dataUrl) {
                    if (chrome.runtime.lastError) {
                        console.error('📸 Screenshot error:', chrome.runtime.lastError);
                        sendResponse({
                            success: false,
                            error: chrome.runtime.lastError.message
                        });
                    } else {
                        console.log('📸 Screenshot taken successfully');
                        sendResponse({
                            success: true,
                            dataUrl: dataUrl,
                            url: tab.url,
                            title: tab.title,
                            timestamp: new Date().toISOString()
                        });
                    }
                });
            } else {
                sendResponse({
                    success: false,
                    error: 'No active tab found'
                });
            }
        });
        
    } catch (error) {
        console.error('📸 Error in screenshot handler:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Handle tab updates
chrome.tabs.onUpdated.addListener(async function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
        console.log('📸 Tab updated:', tab.url);
        
        // Check if it's ChatGPT and inject helper script
        if (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com')) {
            console.log('📸 ChatGPT tab detected, ready for screenshot insertion');
        }
        
        // Enable side panel for new tabs
        if (changeInfo.status === 'complete') {
            try {
                await chrome.sidePanel.setOptions({
                    tabId: tabId,
                    enabled: true
                });
            } catch (error) {
                console.log('📸 Could not enable side panel for tab:', tabId);
            }
        }
    }
});

// Handle tab activation
chrome.tabs.onActivated.addListener(function(activeInfo) {
    console.log('📸 Tab activated:', activeInfo.tabId);
});

// Handle storage changes
chrome.storage.onChanged.addListener(function(changes, namespace) {
    console.log('📸 Storage changed:', changes, 'in namespace:', namespace);
});


// Handle ChatGPT API request
async function handleChatGPTRequest(request, sendResponse) {
    try {
        // Get API token from storage
        const result = await chrome.storage.local.get(['openaiApiToken']);
        const apiToken = result.openaiApiToken;
        
        if (!apiToken) {
            sendResponse({
                success: false,
                error: 'OpenAI API токен не установлен'
            });
            return;
        }

        // Convert data URL to base64
        const base64Data = request.dataUrl.split(',')[1];
        
        const prompt = "Ты — эксперт, решающий учебные и тестовые задания.\n" +
            "На приложенном изображении показана страница с одним или несколькими вопросами или заданиями.\n" +
            "Твоя задача:\n" +
            "1. Внимательно прочитать и понять каждое задание.\n" +
            "2. Дать чёткий, правильный и полный ответ на каждое из них.\n" +
            "3. Если задание требует расчётов — покажи краткое решение.\n" +
            "4. Если вопрос с выбором варианта — укажи правильный вариант и поясни, почему.\n" +
            "5. Ответ оформи в структурированном виде: пронумеруй задания, как они идут на изображении.\n\n" +
            "Не добавляй лишних комментариев вроде «Вот ответ:» — сразу начинай с решения.";

        // Prepare request to OpenAI API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: request.dataUrl
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenAI API Error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const chatResponse = data.choices[0]?.message?.content || 'Ответ не получен';

        // Send response to side panel
        chrome.runtime.sendMessage({
            action: 'chatGPTResponse',
            response: chatResponse
        });

        sendResponse({
            success: true,
            response: chatResponse
        });

    } catch (error) {
        console.error('📸 Error sending to ChatGPT:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Enable side panel for all tabs
async function enableSidePanelForAllTabs() {
    try {
        await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true});
        console.log('📸 Side panel enabled for all tabs');
    } catch (error) {
        console.error('📸 Error enabling side panel:', error);
    }
}
