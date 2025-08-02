// Popup Script
// 處理外掛彈出視窗的互動邏輯

class PopupController {
    constructor() {
        this.currentTab = null;
        this.translationStatus = {
            isTranslating: false,
            translationVisible: false
        };

        this.init();
    }

    async init() {
        // 獲取當前標籤頁
        await this.getCurrentTab();
        
        // 初始化 UI 元素
        this.initializeElements();
        
        // 綁定事件監聽器
        this.bindEventListeners();
        
        // 載入翻譯狀態
        await this.loadTranslationStatus();
        
        // 更新 UI
        this.updateUI();
    }

    async getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        this.currentTab = tab;
    }

    initializeElements() {
        this.elements = {
            toggleButton: document.getElementById('toggleTranslation'),
            buttonText: document.getElementById('buttonText'),
            loadingSpinner: document.getElementById('loadingSpinner'),
            translationStatus: document.getElementById('translationStatus'),
            progressBar: document.getElementById('progressBar'),
            progressFill: document.getElementById('progressFill'),
            settingsButton: document.getElementById('settingsButton')
        };
    }

    bindEventListeners() {
        // 翻譯切換按鈕
        this.elements.toggleButton.addEventListener('click', () => {
            this.handleToggleTranslation();
        });

        // 設定按鈕
        this.elements.settingsButton.addEventListener('click', () => {
            this.openSettings();
        });

        // 監聽來自 content script 的狀態更新
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'TRANSLATION_STATUS_UPDATE') {
                this.translationStatus = message.status;
                this.updateUI();
            }
        });
    }

    async loadTranslationStatus() {
        try {
            // 向當前標籤頁的 content script 查詢狀態
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                type: 'GET_TRANSLATION_STATUS'
            });

            if (response && response.success) {
                this.translationStatus = {
                    isTranslating: response.isTranslating,
                    translationVisible: response.translationVisible
                };
            }
        } catch (error) {
            console.log('Content script not ready or page not supported');
            // 這是正常情況，某些頁面可能不支援內容腳本
        }
    }

    async handleToggleTranslation() {
        if (!this.currentTab) {
            this.showError('無法獲取當前標籤頁');
            return;
        }

        // 檢查是否為支援的頁面
        if (!this.isSupportedPage(this.currentTab.url)) {
            this.showError('此頁面不支援翻譯功能');
            return;
        }

        try {
            // 檢查設定
            const settings = await this.getSettings();
            if (!settings.apiProvider || !settings.apiKey) {
                this.showError('請先設定 AI 翻譯服務');
                this.openSettings();
                return;
            }

            // 發送切換翻譯訊息到 content script
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                type: 'TOGGLE_TRANSLATION'
            });

            if (response && response.success) {
                // 更新本地狀態
                this.translationStatus.isTranslating = true;
                this.updateUI();
                
                // 開始監控翻譯進度
                this.startProgressMonitoring();
            } else {
                this.showError('翻譯請求失敗');
            }

        } catch (error) {
            console.error('Toggle translation failed:', error);
            this.showError('翻譯功能啟動失敗');
        }
    }

    async getSettings() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
            return response.success ? response.data : {};
        } catch (error) {
            console.error('Failed to get settings:', error);
            return {};
        }
    }

    isSupportedPage(url) {
        if (!url) return false;
        
        // 支援 http 和 https 頁面
        return url.startsWith('http://') || url.startsWith('https://');
    }

    startProgressMonitoring() {
        // 模擬進度監控
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 20;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                this.translationStatus.isTranslating = false;
                this.translationStatus.translationVisible = true;
            }
            
            this.updateProgress(progress);
            this.updateUI();
        }, 500);

        // 10秒後強制結束
        setTimeout(() => {
            clearInterval(interval);
            this.translationStatus.isTranslating = false;
            this.updateUI();
        }, 10000);
    }

    updateProgress(percentage) {
        if (this.elements.progressFill) {
            this.elements.progressFill.style.width = `${Math.min(percentage, 100)}%`;
        }
    }

    updateUI() {
        const { isTranslating, translationVisible } = this.translationStatus;

        // 更新按鈕狀態
        if (isTranslating) {
            this.elements.buttonText.textContent = '翻譯中...';
            this.elements.loadingSpinner.classList.remove('hidden');
            this.elements.toggleButton.disabled = true;
            this.elements.progressBar.classList.remove('hidden');
            this.elements.translationStatus.textContent = '正在分析和翻譯頁面內容...';
        } else if (translationVisible) {
            this.elements.buttonText.textContent = '隱藏翻譯';
            this.elements.loadingSpinner.classList.add('hidden');
            this.elements.toggleButton.disabled = false;
            this.elements.progressBar.classList.add('hidden');
            this.elements.translationStatus.textContent = '翻譯已完成';
        } else {
            this.elements.buttonText.textContent = '開始翻譯';
            this.elements.loadingSpinner.classList.add('hidden');
            this.elements.toggleButton.disabled = false;
            this.elements.progressBar.classList.add('hidden');
            this.elements.translationStatus.textContent = '準備就緒';
        }

        // 更新按鈕樣式
        this.elements.toggleButton.className = isTranslating ? 
            'primary-button translating' : 'primary-button';
    }

    openSettings() {
        chrome.runtime.openOptionsPage();
        window.close(); // 關閉 popup
    }

    showError(message) {
        this.elements.translationStatus.textContent = message;
        this.elements.translationStatus.style.color = '#dc3545';
        
        // 3秒後恢復正常狀態
        setTimeout(() => {
            this.elements.translationStatus.style.color = '';
            this.updateUI();
        }, 3000);
    }

    showSuccess(message) {
        this.elements.translationStatus.textContent = message;
        this.elements.translationStatus.style.color = '#28a745';
        
        // 2秒後恢復正常狀態
        setTimeout(() => {
            this.elements.translationStatus.style.color = '';
            this.updateUI();
        }, 2000);
    }
}

// 當 DOM 載入完成時初始化 popup
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});