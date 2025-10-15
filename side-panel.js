// side-panel.js - Simplified side panel functionality

document.addEventListener('DOMContentLoaded', async function() {
    const screenshotButton = document.getElementById('screenshotButton');
    const status = document.getElementById('status');
    const chatResponse = document.getElementById('chatResponse');
    
    let currentScreenshotData = null;

    // Initialize side panel
    await initializeSidePanel();

    // Функция для обновления статуса
    function updateStatus(message, type = 'info') {
        status.textContent = message;
        status.className = `status ${type}`;
        
        // Auto-hide success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                status.textContent = '';
                status.className = 'status';
            }, 3000);
        }
    }

    // Initialize side panel
    async function initializeSidePanel() {
        try {
            updateStatus('✅ Side panel готов к работе', 'success');
        } catch (error) {
            console.error('Error initializing side panel:', error);
            updateStatus('❌ Ошибка инициализации', 'error');
        }
    }

    // Update chat response display
    function updateChatResponse(response) {
        chatResponse.textContent = response || 'Сделайте скриншот и отправьте его в ChatGPT для получения ответа...';
    }


    // Функция копирования в буфер обмена
    async function copyToClipboard(dataUrl) {
        try {
            // Конвертировать data URL в blob
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            
            // Копировать в буфер обмена
            await navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob
                })
            ]);
            
        } catch (error) {
            console.error('Ошибка при копировании:', error);
            throw error;
        }
    }

    // Listen for messages from background script (for ChatGPT responses)
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'chatGPTResponse') {
            updateChatResponse(request.response);
            updateStatus('✅ Получен ответ от ChatGPT', 'success');
        }
    });

    // Listen for screenshot button click in side panel
    screenshotButton.addEventListener('click', async function() {
        updateStatus('📷 Делаю скриншот...', 'loading');
        screenshotButton.disabled = true;

        try {
            // Получить текущую вкладку
            const tabs = await chrome.tabs.query({active: true, currentWindow: true});
            const currentTab = tabs[0];

            if (!currentTab) {
                throw new Error('Не удалось получить текущую вкладку');
            }

            // Сделать скриншот видимой области
            const dataUrl = await chrome.tabs.captureVisibleTab(currentTab.windowId, {
                format: 'png',
                quality: 90
            });

            currentScreenshotData = dataUrl;
            
            updateStatus('✅ Скриншот готов! Скопирован в буфер обмена.', 'success');
            
            // Автоматически копировать в буфер обмена
            await copyToClipboard(dataUrl);
            
            updateStatus('📤 Отправляю в ChatGPT...', 'loading');
            
            // Отправить скриншот в ChatGPT через background script
            const response = await chrome.runtime.sendMessage({
                action: 'sendToChatGPT',
                dataUrl: dataUrl,
                prompt: 'найди на изображении все вопросы и ответь на них'
            });

            if (response.success) {
                updateStatus('✅ Скриншот отправлен в ChatGPT!', 'success');
            } else {
                throw new Error(response.error || 'Ошибка отправки в ChatGPT');
            }
            
        } catch (error) {
            console.error('Ошибка при создании скриншота:', error);
            updateStatus(`❌ Ошибка: ${error.message}`, 'error');
        } finally {
            screenshotButton.disabled = false;
        }
    });
});
