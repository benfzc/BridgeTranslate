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

        // 檢查通訊健康狀態（延遲一點以確保content script完全載入）
        setTimeout(async () => {
            this.communicationHealthy = await this.checkCommunicationHealth();
            this.updateUI();

            // 添加調試功能
            this.addDebugFeatures();
        }, 500);

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
            console.log('當前分頁:', this.currentTab);

            if (!this.currentTab) {
                console.log('❌ 無當前分頁');
                this.communicationHealthy = false;
                return;
            }

            if (!this.isSupportedPage(this.currentTab.url)) {
                console.log('⚠️ 當前頁面不支援翻譯:', this.currentTab.url);
                this.communicationHealthy = false;
                return;
            }

            // 向當前標籤頁的 content script 查詢狀態
            console.log('📤 發送 GET_TRANSLATION_STATUS 到分頁:', this.currentTab.id);
            const response = await Promise.race([
                chrome.tabs.sendMessage(this.currentTab.id, {
                    type: 'GET_TRANSLATION_STATUS',
                    timestamp: Date.now()
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('查詢狀態超時')), 2000)
                )
            ]);

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
            console.log('⚠️ Content script 通訊失敗:', error.message);
            console.log('錯誤詳情:', error);
            this.communicationHealthy = false;

            // 提供更詳細的錯誤分析
            if (error.message.includes('Could not establish connection')) {
                console.log('ℹ️ 可能原因: Content script 未載入或頁面不支援');
            } else if (error.message.includes('Extension context invalidated')) {
                console.log('ℹ️ 可能原因: 擴展需要重新載入');
            } else if (error.message.includes('超時')) {
                console.log('ℹ️ 可能原因: Content script 響應緩慢');
            }
        }
    }

    /**
     * 檢查與 content script 的通訊健康狀態
     */
    async checkCommunicationHealth(retryCount = 0) {
        console.log(`🔍 檢查通訊健康狀態... (嘗試 ${retryCount + 1}/3)`);

        if (!this.currentTab || !this.isSupportedPage(this.currentTab.url)) {
            console.log('⚠️ 當前頁面不支援通訊');
            return false;
        }

        try {
            const startTime = Date.now();
            const response = await Promise.race([
                chrome.tabs.sendMessage(this.currentTab.id, {
                    type: 'PING',
                    timestamp: startTime
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('通訊超時')), 2000)
                )
            ]);

            const responseTime = Date.now() - startTime;

            if (response && response.success) {
                console.log(`✅ 通訊健康檢查通過 (${responseTime}ms)`);
                return true;
            } else {
                console.log('❌ 通訊健康檢查失敗: 無效回應', response);

                // 如果是第一次失敗且重試次數少於2次，則重試
                if (retryCount < 2) {
                    console.log('🔄 1秒後重試通訊檢查...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return this.checkCommunicationHealth(retryCount + 1);
                }

                return false;
            }
        } catch (error) {
            console.log('❌ 通訊健康檢查失敗:', error.message);

            // 特定錯誤的處理
            if (error.message.includes('Could not establish connection')) {
                console.log('ℹ️ Content script 可能尚未載入或頁面不支援');
            } else if (error.message.includes('Extension context invalidated')) {
                console.log('ℹ️ 擴展上下文已失效，需要重新載入');
            }

            // 如果是第一次失敗且重試次數少於2次，則重試
            if (retryCount < 2 && !error.message.includes('Extension context invalidated')) {
                console.log('🔄 1秒後重試通訊檢查...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.checkCommunicationHealth(retryCount + 1);
            }

            return false;
        }
    }

    async loadButtonVisibilityState() {
        try {
            // 使用統一的配置管理器
            const isVisible = await configManager.loadButtonVisibilityState();
            this.buttonVisibilityState.visible = isVisible;

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
        console.log('📊 當前狀態:', {
            currentTab: this.currentTab,
            tabId: this.currentTab?.id,
            tabUrl: this.currentTab?.url,
            isSupported: this.currentTab ? this.isSupportedPage(this.currentTab.url) : false,
            communicationHealthy: this.communicationHealthy
        });

        try {
            // 步驟 1: 儲存狀態到 Chrome Storage
            console.log('💾 儲存狀態到 Chrome Storage...');
            await configManager.saveButtonVisibilityState(isVisible);
            console.log('✅ 狀態儲存成功');

            // 步驟 2: 更新本地狀態
            this.buttonVisibilityState.visible = isVisible;

            // 步驟 3: 發送訊息到當前分頁的 content script
            let currentTabSuccess = false;
            let currentTabMessage = '';

            if (this.currentTab && this.isSupportedPage(this.currentTab.url)) {
                console.log('📤 準備發送訊息到當前分頁:', {
                    tabId: this.currentTab.id,
                    tabUrl: this.currentTab.url,
                    tabTitle: this.currentTab.title,
                    visible: isVisible
                });

                try {
                    console.log('🚀 正在發送 TOGGLE_BUTTON_VISIBILITY 訊息...');
                    const messagePayload = {
                        type: 'TOGGLE_BUTTON_VISIBILITY',
                        visible: isVisible,
                        timestamp: Date.now()
                    };
                    console.log('📦 訊息內容:', messagePayload);

                    const response = await Promise.race([
                        chrome.tabs.sendMessage(this.currentTab.id, messagePayload),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('訊息發送超時')), 2000)
                        )
                    ]);

                    console.log('📨 收到回應:', response);

                    if (response && response.success) {
                        console.log('✅ 當前分頁訊息發送成功:', response);
                        currentTabSuccess = response.operationSuccess !== false;
                        currentTabMessage = response.statusMessage || '成功';
                    } else {
                        console.log('⚠️ 當前分頁回應異常:', response);
                        currentTabMessage = response?.error || '回應異常';
                    }
                } catch (tabError) {
                    console.log('⚠️ 當前分頁訊息發送失敗:', tabError.message);
                    currentTabMessage = tabError.message;

                    // 如果是content script未載入的錯誤，這是正常情況
                    if (tabError.message.includes('Could not establish connection') ||
                        tabError.message.includes('Extension context invalidated')) {
                        currentTabMessage = 'Content script未載入（正常）';
                    } else if (tabError.message.includes('超時')) {
                        currentTabMessage = 'Content script響應超時';
                    }
                }
            } else {
                console.log('⚠️ 當前分頁不支援或未選中');
                currentTabMessage = '分頁不支援';
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
        console.log('📡 開始廣播按鈕可見性變更...', { visible });

        try {
            // 獲取所有分頁
            const tabs = await chrome.tabs.query({});
            console.log(`📋 找到 ${tabs.length} 個分頁`);

            // 統計支援的分頁數量
            const supportedTabs = tabs.filter(tab => this.isSupportedPage(tab.url));
            console.log(`📊 支援翻譯的分頁: ${supportedTabs.length}/${tabs.length}`);

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

            const provider = settings?.apiConfiguration?.provider;
            const apiKey = settings?.apiConfiguration?.apiKeys?.[provider];
            
            console.log('🔍 配置檢查詳情:', {
                provider: provider,
                hasApiKeys: !!settings?.apiConfiguration?.apiKeys,
                apiKeys: settings?.apiConfiguration?.apiKeys,
                apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : '(空)',
                fullConfig: settings?.apiConfiguration
            });
            
            if (!provider || !apiKey) {
                console.log('❌ 設定檢查失敗，打開設定頁面');
                console.log('失敗原因:', !provider ? '沒有提供者' : '沒有API key');
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

        // 支援 http、https 和 file 頁面
        return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://');
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
            const statusText = this.elements.communicationStatus.querySelector('.status-text');
            if (statusText) {
                statusText.textContent = '通訊正常';
            }
        } else {
            this.elements.statusIndicator.className = 'status-indicator disconnected';
            const statusText = this.elements.communicationStatus.querySelector('.status-text');
            if (statusText) {
                statusText.textContent = '通訊異常';
            }

            // 提供更詳細的狀態信息
            console.log('ℹ️ 通訊異常可能原因:');
            console.log('  - Content script 尚未載入');
            console.log('  - 當前頁面不支援翻譯功能');
            console.log('  - 擴展需要重新載入');
            console.log('  - 頁面正在載入中');
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

    /**
     * 添加調試功能
     */
    addDebugFeatures() {
        // 添加全域調試函數
        window.testPopupCommunication = async () => {
            console.log('🧪 測試 Popup 通訊:');
            console.log('- 當前分頁:', this.currentTab);

            if (this.currentTab && this.isSupportedPage(this.currentTab.url)) {
                try {
                    console.log('🧪 發送測試 PING...');
                    const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                        type: 'PING',
                        timestamp: Date.now()
                    });
                    console.log('🧪 測試回應:', response);
                } catch (error) {
                    console.log('🧪 測試失敗:', error);
                }
            } else {
                console.log('🧪 當前分頁不支援測試');
            }
        };

        // 添加手動切換測試
        window.testButtonToggle = () => {
            console.log('🧪 手動測試按鈕切換...');
            this.handleButtonVisibilityToggle();
        };

        console.log('🧪 調試功能已添加: testPopupCommunication(), testButtonToggle()');
    }
}

// 當 DOM 載入完成時初始化 popup
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});