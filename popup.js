// popup.js - Handles popup functionality for mode selection

document.addEventListener('DOMContentLoaded', function() {
    const openSidePanelButton = document.getElementById('openSidePanelButton');
    const copyToClipboardButton = document.getElementById('copyToClipboardButton');
    const downloadButton = document.getElementById('downloadButton');
    const status = document.getElementById('status');
    const preview = document.getElementById('preview');
    const previewImage = document.getElementById('previewImage');
    const apiTokenInput = document.getElementById('apiToken');
    const tokenIndicator = document.getElementById('tokenIndicator');
    const tokenText = document.getElementById('tokenText');
    
    let currentScreenshotData = null;

    // Initialize popup
    initializePopup();

    // Функция для обновления статуса
    function updateStatus(message, type = 'info') {
        status.textContent = message;
        status.className = `status ${type}`;
    }

    // Initialize popup
    async function initializePopup() {
        try {
            // Load saved token
            const result = await chrome.storage.local.get(['openaiApiToken']);
            if (result.openaiApiToken) {
                apiTokenInput.value = result.openaiApiToken;
                updateTokenStatus(true);
            } else {
                updateTokenStatus(false);
            }
        } catch (error) {
            console.error('Error initializing popup:', error);
        }
    }

    // Update token status display
    function updateTokenStatus(isValid) {
        if (isValid && apiTokenInput.value.trim()) {
            tokenIndicator.textContent = '✅';
            tokenText.textContent = 'Токен установлен';
            tokenIndicator.style.color = '#4CAF50';
            tokenText.style.color = '#4CAF50';
        } else {
            tokenIndicator.textContent = '❌';
            tokenText.textContent = 'Токен не установлен';
            tokenIndicator.style.color = '#f44336';
            tokenText.style.color = '#f44336';
        }
    }

    // Save token when input changes
    apiTokenInput.addEventListener('input', async function() {
        const token = apiTokenInput.value.trim();
        
        if (token && token.startsWith('sk-')) {
            try {
                await chrome.storage.local.set({openaiApiToken: token});
                updateTokenStatus(true);
                updateStatus('✅ Токен сохранен', 'success');
            } catch (error) {
                console.error('Error saving token:', error);
                updateStatus('❌ Ошибка сохранения токена', 'error');
            }
        } else {
            updateTokenStatus(false);
            if (token && !token.startsWith('sk-')) {
                updateStatus('⚠️ Токен должен начинаться с "sk-"', 'error');
            }
        }
    });

    // Открыть Side Panel
    openSidePanelButton.addEventListener('click', async function() {
        try {
            updateStatus('📱 Открываю Side Panel...', 'loading');
            
            const tabs = await chrome.tabs.query({active: true, currentWindow: true});
            if (tabs[0]) {
                await chrome.sidePanel.open({tabId: tabs[0].id});
                updateStatus('✅ Side Panel открыт!', 'success');
                
                // Close popup after opening side panel
                setTimeout(() => {
                    window.close();
                }, 1000);
            }
        } catch (error) {
            console.error('Ошибка при открытии Side Panel:', error);
            updateStatus(`❌ Ошибка: ${error.message}`, 'error');
        }
    });

    // Копировать в буфер обмена
    copyToClipboardButton.addEventListener('click', async function() {
        if (currentScreenshotData) {
            await copyToClipboard(currentScreenshotData);
            updateStatus('📋 Скриншот скопирован в буфер обмена!', 'success');
        }
    });

    // Скачать скриншот
    downloadButton.addEventListener('click', function() {
        if (currentScreenshotData) {
            downloadScreenshot(currentScreenshotData);
            updateStatus('💾 Скриншот скачан!', 'success');
        }
    });

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
            
            updateStatus('📋 Скриншот скопирован в буфер обмена!', 'success');
        } catch (error) {
            console.error('Ошибка при копировании:', error);
            updateStatus('❌ Не удалось скопировать в буфер обмена', 'error');
        }
    }

    // Функция скачивания скриншота
    function downloadScreenshot(dataUrl) {
        try {
            const link = document.createElement('a');
            link.download = `screenshot-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Ошибка при скачивании:', error);
            updateStatus('❌ Ошибка при скачивании', 'error');
        }
    }

    // Загрузить сохраненные настройки
    chrome.storage.local.get(['screenshotSettings'], function(result) {
        if (result.screenshotSettings) {
            console.log('Настройки скриншота загружены');
        }
    });
});
