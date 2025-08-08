// Popup Script
// 處理外掛彈出視窗的互動邏輯

class PopupController {
    constructor() {
        this.currentTab = null;
        this.translationStatus = {
            isTranslating: false,
            translationVisible: false
        };
        this.buttonVisibilityState = {
            visible: true
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
        
        // 載入按鈕可見性狀態
        await this.loadButtonVisibilityState();
        
        // 檢查通訊健康狀態
        this.communicationHealthy = await this.checkCommunicationHealth();
        
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
            settingsButton: document.getElementById('settingsButton'),
            buttonVisibilityToggle: document.getElementById('buttonVisibilityToggle'),
            communicationStatus: document.getElementById('communicationStatus'),
            statusIndicator: document.querySelector('.status-indicator')
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

        // 按鈕可見性開關
        this.elements.buttonVisibilityToggle.addEventListener('change', () => {
            this.handleButtonVisibilityToggle();
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
            console.log('📊 載入翻譯狀態...');
            
            // 向當前標籤頁的 content script 查詢狀態
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                type: 'GET_TRANSLATION_STATUS',
                timestamp: Date.now()
            });

            if (response && response.success) {
                console.log('✅ 翻譯狀態載入成功:', response);
                this.translationStatus = {
                    isTranslating: response.isTranslating,
                    translationVisible: response.translationVisible
                };
                
                // 檢查通訊健康狀態
                this.communicationHealthy = true;
            } else {
                console.log('⚠️ 翻譯狀態回應異常:', response);
                this.communicationHealthy = false;
            }
        } catch (error) {
            console.log('⚠️ Content script 未就緒或頁面不支援:', error.message);
            this.communicationHealthy = false;
            // 這是正常情況，某些頁面可能不支援內容腳本
        }
    }

    /**
     * 檢查與 content script 的通訊健康狀態
     */
    async checkCommunicationHealth() {
        console.log('🔍 檢查通訊健康狀態...');
        
        if (!this.currentTab || !this.isSupportedPage(this.currentTab.url)) {
            console.log('⚠️ 當前頁面不支援通訊');
            return false;
        }
        
        try {
            const startTime = Date.now();
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                type: 'PING',
                timestamp: startTime
            });
            
            const responseTime = Date.now() - startTime;
            
            if (response && response.success) {
                console.log(`✅ 通訊健康檢查通過 (${responseTime}ms)`);
                return true;
            } else {
                console.log('❌ 通訊健康檢查失敗: 無效回應');
                return false;
            }
        } catch (error) {
            console.log('❌ 通訊健康檢查失敗:', error.message);
            return false;
        }
    }

    async loadButtonVisibilityState() {
        try {
            // 從 Chrome Storage 載入按鈕可見性狀態
            const result = await chrome.storage.local.get(['buttonVisibilityState']);
            if (result.buttonVisibilityState !== undefined) {
                this.buttonVisibilityState.visible = result.buttonVisibilityState;
            }
            
            // 更新開關狀態
            this.elements.buttonVisibilityToggle.checked = this.buttonVisibilityState.visible;
        } catch (error) {
            console.error('Failed to load button visibility state:', error);
            // 使用預設值
            this.buttonVisibilityState.visible = true;
            this.elements.buttonVisibilityToggle.checked = true;
        }
    }

    async handleButtonVisibilityToggle() {
        const isVisible = this.elements.buttonVisibilityToggle.checked;
        
        console.log('🔄 開始處理按鈕可見性切換:', isVisible);
        
        try {
            // 步驟 1: 儲存狀態到 Chrome Storage
            console.log('💾 儲存狀態到 Chrome Storage...');
            await chrome.storage.local.set({ 
                buttonVisibilityState: isVisible 
            });
            console.log('✅ 狀態儲存成功');
            
            // 步驟 2: 更新本地狀態
            this.buttonVisibilityState.visible = isVisible;
            
            // 步驟 3: 發送訊息到當前分頁的 content script
            let currentTabSuccess = false;
            if (this.currentTab && this.isSupportedPage(this.currentTab.url)) {
                console.log('📤 發送訊息到當前分頁:', this.currentTab.id);
                try {
                    const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                        type: 'TOGGLE_BUTTON_VISIBILITY',
                        visible: isVisible,
                        timestamp: Date.now()
                    });
                    
                    if (response && response.success) {
                        console.log('✅ 當前分頁訊息發送成功');
                        currentTabSuccess = true;
                    } else {
                        console.log('⚠️ 當前分頁回應異常:', response);
                    }
                } catch (tabError) {
                    console.log('⚠️ 當前分頁訊息發送失敗:', tabError.message);
                }
            } else {
                console.log('⚠️ 當前分頁不支援或未選中');
            }
            
            // 步驟 4: 廣播到所有分頁
            console.log('📡 廣播到所有分頁...');
            const broadcastResults = await this.broadcastButtonVisibilityChange(isVisible);
            console.log('📊 廣播結果:', broadcastResults);
            
            // 步驟 5: 顯示反饋
            const statusMessage = isVisible ? '翻譯按鈕已顯示' : '翻譯按鈕已隱藏';
            const detailMessage = `當前分頁: ${currentTabSuccess ? '成功' : '失敗'}, 廣播: ${broadcastResults.successCount}/${broadcastResults.totalCount}`;
            
            this.showSuccess(`${statusMessage} (${detailMessage})`);
            console.log('✅ 按鈕可見性切換完成');
            
        } catch (error) {
            console.error('❌ 按鈕可見性切換失敗:', error);
            
            // 恢復開關狀態
            this.elements.buttonVisibilityToggle.checked = this.buttonVisibilityState.visible;
            this.showError(`切換按鈕顯示狀態失敗: ${error.message}`);
        }
    }

    async broadcastButtonVisibilityChange(visible) {
        console.log('📡 開始廣播按鈕可見性變更...');
        
        try {
            // 獲取所有分頁
            const tabs = await chrome.tabs.query({});
            console.log(`📋 找到 ${tabs.length} 個分頁`);
            
            let successCount = 0;
            let totalCount = 0;
            const results = [];
            
            // 向所有支援的分頁發送訊息
            const promises = tabs.map(async (tab) => {
                if (this.isSupportedPage(tab.url)) {
                    totalCount++;
                    try {
                        const response = await chrome.tabs.sendMessage(tab.id, {
                            type: 'TOGGLE_BUTTON_VISIBILITY',
                            visible: visible,
                            timestamp: Date.now(),
                            source: 'broadcast'
                        });
                        
                        if (response && response.success) {
                            successCount++;
                            results.push({ tabId: tab.id, url: tab.url, success: true });
                            console.log(`✅ 分頁 ${tab.id} 訊息發送成功`);
                        } else {
                            results.push({ tabId: tab.id, url: tab.url, success: false, error: 'Invalid response' });
                            console.log(`⚠️ 分頁 ${tab.id} 回應異常:`, response);
                        }
                    } catch (error) {
                        results.push({ tabId: tab.id, url: tab.url, success: false, error: error.message });
                        console.log(`❌ 分頁 ${tab.id} 訊息發送失敗:`, error.message);
                    }
                } else {
                    console.log(`⏭️ 跳過不支援的分頁 ${tab.id}: ${tab.url}`);
                }
            });
            
            await Promise.allSettled(promises);
            
            console.log(`📊 廣播完成: ${successCount}/${totalCount} 成功`);
            
            return {
                successCount,
                totalCount,
                results,
                success: successCount > 0 || totalCount === 0
            };
            
        } catch (error) {
            console.error('❌ 廣播失敗:', error);
            return {
                successCount: 0,
                totalCount: 0,
                results: [],
                success: false,
                error: error.message
            };
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
            console.log('Popup 檢查設定:', settings);
            
            if (!settings?.apiConfiguration?.provider || !settings?.apiConfiguration?.apiKey) {
                console.log('設定檢查失敗，打開設定頁面');
                this.showError('請先設定 AI 翻譯服務');
                this.openSettings();
                return;
            }
            
            console.log('設定檢查通過，繼續翻譯');

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

        // 更新通訊狀態
        this.updateCommunicationStatus();
    }

    updateCommunicationStatus() {
        if (!this.elements.communicationStatus || !this.elements.statusIndicator) {
            return;
        }

        if (this.communicationHealthy === undefined) {
            // 尚未檢查
            this.elements.communicationStatus.classList.add('hidden');
            return;
        }

        this.elements.communicationStatus.classList.remove('hidden');
        
        if (this.communicationHealthy) {
            this.elements.statusIndicator.className = 'status-indicator';
            this.elements.communicationStatus.querySelector('.status-text').textContent = '通訊正常';
        } else {
            this.elements.statusIndicator.className = 'status-indicator disconnected';
            this.elements.communicationStatus.querySelector('.status-text').textContent = '通訊異常';
        }
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