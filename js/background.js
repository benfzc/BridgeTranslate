// Background Service Worker
// 處理跨頁面通訊、設定管理和API請求

// 載入必要的腳本
try {
    importScripts('js/models.js', 'js/api-services.js', 'js/api-manager.js');
} catch (error) {
    console.error('載入腳本失敗:', error);
    // 如果載入失敗，我們仍然可以提供基本功能
}

class BackgroundService {
    constructor() {
        // 檢查是否成功載入了API管理器
        this.apiManager = typeof APIManager !== 'undefined' ? new APIManager() : null;
        this.isInitialized = false;
        this.activeTranslations = new Map(); // 追蹤活躍的翻譯請求
        this.tabStates = new Map(); // 追蹤各標籤頁的狀態
        this.requestQueue = []; // 請求佇列
        this.isProcessingQueue = false;
        this.startTime = Date.now(); // 記錄啟動時間
        
        this.initializeListeners();
        this.initialize();
    }
    
    async initialize() {
        try {
            // 載入設定
            const settings = await this.getSettings();
            
            // 如果API管理器可用，則初始化它
            if (this.apiManager) {
                await this.apiManager.initialize(settings);
            } else {
                console.warn('API管理器不可用，使用基本功能模式');
            }
            
            // 初始化請求佇列處理
            this.startQueueProcessor();
            
            // 設定定期清理
            this.setupPeriodicCleanup();
            
            this.isInitialized = true;
            console.log('背景服務初始化完成');
            
            // 通知所有標籤頁服務已就緒
            this.notifyTabsServiceReady();
            
        } catch (error) {
            console.error('背景服務初始化失敗:', error);
            // 即使初始化失敗，也要設定基本的錯誤處理
            this.setupErrorHandling();
        }
    }
    
    /**
     * 設定錯誤處理
     */
    setupErrorHandling() {
        // 監聽未處理的錯誤
        self.addEventListener('error', (event) => {
            console.error('背景服務錯誤:', event.error);
            this.logError('UnhandledError', event.error.message, event.error.stack);
        });
        
        // 監聽未處理的Promise拒絕
        self.addEventListener('unhandledrejection', (event) => {
            console.error('未處理的Promise拒絕:', event.reason);
            this.logError('UnhandledPromiseRejection', event.reason);
        });
    }
    
    /**
     * 設定定期清理
     */
    setupPeriodicCleanup() {
        // 每5分鐘清理一次過期的資料
        setInterval(() => {
            this.cleanupExpiredData();
        }, 5 * 60 * 1000);
        
        // 每小時清理一次日誌
        setInterval(() => {
            this.cleanupLogs();
        }, 60 * 60 * 1000);
    }
    
    /**
     * 通知所有標籤頁服務已就緒
     */
    async notifyTabsServiceReady() {
        try {
            const tabs = await chrome.tabs.query({});
            tabs.forEach(tab => {
                if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'SERVICE_READY',
                        timestamp: Date.now()
                    }).catch(() => {
                        // 忽略無法發送訊息的標籤頁（可能沒有content script）
                    });
                }
            });
        } catch (error) {
            console.warn('通知標籤頁失敗:', error);
        }
    }
    
    /**
     * 開始佇列處理器
     */
    startQueueProcessor() {
        if (this.isProcessingQueue) return;
        
        this.isProcessingQueue = true;
        this.processRequestQueue();
    }
    
    /**
     * 處理請求佇列
     */
    async processRequestQueue() {
        while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift();
            
            try {
                await this.processQueuedRequest(request);
            } catch (error) {
                console.error('處理佇列請求失敗:', error);
                if (request.sendResponse) {
                    request.sendResponse({ 
                        success: false, 
                        error: error.message 
                    });
                }
            }
            
            // 短暫延遲避免過度負載
            await this.delay(100);
        }
        
        this.isProcessingQueue = false;
        
        // 如果有新請求加入，重新開始處理
        if (this.requestQueue.length > 0) {
            setTimeout(() => this.startQueueProcessor(), 1000);
        }
    }
    
    /**
     * 處理佇列中的請求
     */
    async processQueuedRequest(request) {
        const { message, sender, sendResponse } = request;
        
        switch (message.type) {
            case 'TRANSLATE_TEXT':
                const result = await this.translateText(
                    message.text, 
                    message.provider, 
                    message.options
                );
                sendResponse({ success: true, translation: result });
                break;
                
            case 'BATCH_TRANSLATE':
                const batchResults = await this.batchTranslate(
                    message.segments, 
                    message.options
                );
                sendResponse({ success: true, results: batchResults });
                break;
                
            default:
                throw new Error(`未知的佇列請求類型: ${message.type}`);
        }
    }

    initializeListeners() {
        // 監聽來自 content script 和 popup 的訊息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // 保持訊息通道開啟以支援異步回應
        });

        // 監聽外掛安裝事件
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstall(details);
        });

        // 監聽標籤頁更新事件
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });

        // 監聽標籤頁關閉事件
        chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
            this.handleTabRemoved(tabId, removeInfo);
        });
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            // 記錄請求
            this.logRequest(message.type, sender.tab?.id);
            
            // 檢查服務是否已初始化
            if (!this.isInitialized && !['GET_SETTINGS', 'PING'].includes(message.type)) {
                sendResponse({ 
                    success: false, 
                    error: '服務尚未初始化完成，請稍後再試' 
                });
                return;
            }
            
            switch (message.type) {
                case 'PING':
                    sendResponse({ 
                        success: true, 
                        pong: true, 
                        timestamp: Date.now(),
                        initialized: this.isInitialized 
                    });
                    break;

                case 'GET_SETTINGS':
                    const settings = await this.getSettings();
                    sendResponse({ success: true, data: settings });
                    break;

                case 'SAVE_SETTINGS':
                    await this.saveSettings(message.data);
                    // 通知所有標籤頁設定已更新
                    this.broadcastToTabs('SETTINGS_UPDATED', message.data);
                    sendResponse({ success: true });
                    break;

                case 'VALIDATE_API_KEY':
                    const isValid = await this.validateAPIKey(message.provider, message.apiKey);
                    sendResponse({ success: true, isValid });
                    break;

                case 'TRANSLATE_TEXT':
                    // 對於翻譯請求，加入佇列處理
                    if (this.shouldQueueRequest(message)) {
                        this.requestQueue.push({ message, sender, sendResponse });
                        this.startQueueProcessor();
                    } else {
                        const translation = await this.translateText(
                            message.text, 
                            message.provider, 
                            message.options
                        );
                        sendResponse({ success: true, translation });
                    }
                    break;

                case 'BATCH_TRANSLATE':
                    // 批量翻譯總是加入佇列
                    this.requestQueue.push({ message, sender, sendResponse });
                    this.startQueueProcessor();
                    break;

                case 'GET_USAGE_STATS':
                    const stats = await this.getUsageStats();
                    sendResponse({ success: true, stats });
                    break;

                case 'UPDATE_USAGE_STATS':
                    await this.updateUsageStats(message.stats);
                    sendResponse({ success: true });
                    break;

                case 'GET_SUPPORTED_PROVIDERS':
                    if (this.apiManager) {
                        const providers = this.apiManager.getSupportedProviders();
                        sendResponse({ success: true, providers });
                    } else {
                        // 降級方案：返回基本的提供者列表
                        const basicProviders = [
                            {
                                id: 'google-gemini',
                                name: 'Google Gemini',
                                requiresApiKey: true,
                                hasFreeQuota: true
                            }
                        ];
                        sendResponse({ success: true, providers: basicProviders });
                    }
                    break;

                case 'CHECK_API_QUOTA':
                    if (this.apiManager) {
                        const quota = await this.apiManager.checkQuota();
                        sendResponse({ success: true, quota });
                    } else {
                        sendResponse({ 
                            success: false, 
                            error: 'API管理器不可用' 
                        });
                    }
                    break;

                case 'SETUP_API_PROVIDER':
                    await this.setupAPIProvider(message.provider, message.config);
                    sendResponse({ success: true });
                    break;

                case 'GET_TAB_STATE':
                    const tabState = this.getTabState(sender.tab?.id);
                    sendResponse({ success: true, state: tabState });
                    break;

                case 'UPDATE_TAB_STATE':
                    this.updateTabState(sender.tab?.id, message.state);
                    sendResponse({ success: true });
                    break;

                case 'CLEAR_TAB_DATA':
                    this.clearTabData(sender.tab?.id);
                    sendResponse({ success: true });
                    break;

                case 'GET_ACTIVE_TRANSLATIONS':
                    const activeTranslations = this.getActiveTranslations(sender.tab?.id);
                    sendResponse({ success: true, translations: activeTranslations });
                    break;

                case 'CANCEL_TRANSLATION':
                    this.cancelTranslation(message.translationId);
                    sendResponse({ success: true });
                    break;

                case 'GET_SERVICE_STATUS':
                    const serviceStatus = this.getServiceStatus();
                    sendResponse({ success: true, status: serviceStatus });
                    break;

                case 'REINITIALIZE_SERVICE':
                    await this.reinitialize();
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Background script error:', error);
            this.logError('MessageHandling', error.message, error.stack);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    /**
     * 判斷是否應該將請求加入佇列
     */
    shouldQueueRequest(message) {
        // 如果當前有太多活躍的翻譯請求，則加入佇列
        return this.activeTranslations.size > 5 || this.requestQueue.length > 0;
    }
    
    /**
     * 廣播訊息到所有標籤頁
     */
    async broadcastToTabs(type, data) {
        try {
            const tabs = await chrome.tabs.query({});
            const message = { type, data, timestamp: Date.now() };
            
            tabs.forEach(tab => {
                if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
                    chrome.tabs.sendMessage(tab.id, message).catch(() => {
                        // 忽略無法發送訊息的標籤頁
                    });
                }
            });
        } catch (error) {
            console.warn('廣播訊息失敗:', error);
        }
    }

    async handleInstall(details) {
        if (details.reason === 'install') {
            // 首次安裝時初始化預設設定
            await this.initializeDefaultSettings();
            
            // 開啟設定頁面
            chrome.tabs.create({
                url: chrome.runtime.getURL('settings.html')
            });
        }
    }

    handleTabUpdate(tabId, changeInfo, tab) {
        // 當頁面完全載入時，進行初始化工作
        if (changeInfo.status === 'complete' && tab.url) {
            console.log('Page loaded:', tab.url);
            
            // 初始化標籤頁狀態
            this.initializeTabState(tabId, tab);
            
            // 如果是支援的頁面，發送初始化訊息
            if (this.isSupportedPage(tab.url)) {
                this.sendTabMessage(tabId, {
                    type: 'PAGE_LOADED',
                    url: tab.url,
                    timestamp: Date.now()
                });
            }
        }
        
        // 當標籤頁URL變更時，清理舊資料
        if (changeInfo.url) {
            this.clearTabData(tabId);
        }
    }
    
    /**
     * 監聽標籤頁關閉事件
     */
    handleTabRemoved(tabId, removeInfo) {
        // 清理標籤頁相關資料
        this.clearTabData(tabId);
        console.log(`Tab ${tabId} removed, data cleaned`);
    }
    
    /**
     * 初始化標籤頁狀態
     */
    initializeTabState(tabId, tab) {
        if (!tabId) return;
        
        this.tabStates.set(tabId, {
            id: tabId,
            url: tab.url,
            title: tab.title,
            isTranslating: false,
            translationVisible: false,
            lastActivity: Date.now(),
            segmentCount: 0,
            completedCount: 0,
            errorCount: 0
        });
    }
    
    /**
     * 獲取標籤頁狀態
     */
    getTabState(tabId) {
        if (!tabId) return null;
        return this.tabStates.get(tabId) || null;
    }
    
    /**
     * 更新標籤頁狀態
     */
    updateTabState(tabId, updates) {
        if (!tabId) return;
        
        const currentState = this.tabStates.get(tabId) || {};
        const newState = {
            ...currentState,
            ...updates,
            lastActivity: Date.now()
        };
        
        this.tabStates.set(tabId, newState);
    }
    
    /**
     * 清理標籤頁資料
     */
    clearTabData(tabId) {
        if (!tabId) return;
        
        // 清理標籤頁狀態
        this.tabStates.delete(tabId);
        
        // 取消該標籤頁的活躍翻譯
        this.activeTranslations.forEach((translation, id) => {
            if (translation.tabId === tabId) {
                this.cancelTranslation(id);
            }
        });
        
        // 清理佇列中該標籤頁的請求
        this.requestQueue = this.requestQueue.filter(request => 
            request.sender.tab?.id !== tabId
        );
    }
    
    /**
     * 檢查是否為支援的頁面
     */
    isSupportedPage(url) {
        if (!url) return false;
        
        // 排除特殊頁面
        const unsupportedProtocols = ['chrome://', 'chrome-extension://', 'moz-extension://', 'about:'];
        return !unsupportedProtocols.some(protocol => url.startsWith(protocol));
    }
    
    /**
     * 發送訊息到標籤頁
     */
    async sendTabMessage(tabId, message) {
        try {
            await chrome.tabs.sendMessage(tabId, message);
        } catch (error) {
            // 忽略無法發送訊息的情況
            console.debug(`無法發送訊息到標籤頁 ${tabId}:`, error.message);
        }
    }
    
    /**
     * 獲取活躍的翻譯
     */
    getActiveTranslations(tabId) {
        if (!tabId) {
            return Array.from(this.activeTranslations.values());
        }
        
        return Array.from(this.activeTranslations.values())
            .filter(translation => translation.tabId === tabId);
    }
    
    /**
     * 取消翻譯
     */
    cancelTranslation(translationId) {
        const translation = this.activeTranslations.get(translationId);
        if (translation) {
            // 如果有取消方法，調用它
            if (translation.cancel) {
                translation.cancel();
            }
            
            this.activeTranslations.delete(translationId);
            console.log(`Translation ${translationId} cancelled`);
        }
    }
    
    /**
     * 記錄請求
     */
    logRequest(type, tabId) {
        const timestamp = new Date().toISOString();
        console.debug(`[${timestamp}] Request: ${type} from tab ${tabId}`);
        
        // 可以在這裡添加更詳細的日誌記錄
        // 例如儲存到chrome.storage.local用於調試
    }
    
    /**
     * 記錄錯誤
     */
    async logError(category, message, stack = null) {
        const errorLog = {
            category,
            message,
            stack,
            timestamp: Date.now(),
            url: 'background'
        };
        
        console.error(`[${category}] ${message}`, stack);
        
        try {
            // 儲存錯誤日誌
            const { errorLogs = [] } = await chrome.storage.local.get(['errorLogs']);
            errorLogs.push(errorLog);
            
            // 只保留最近100條錯誤日誌
            if (errorLogs.length > 100) {
                errorLogs.splice(0, errorLogs.length - 100);
            }
            
            await chrome.storage.local.set({ errorLogs });
        } catch (error) {
            console.warn('無法儲存錯誤日誌:', error);
        }
    }
    
    /**
     * 清理過期資料
     */
    cleanupExpiredData() {
        const now = Date.now();
        const expireTime = 30 * 60 * 1000; // 30分鐘
        
        // 清理過期的標籤頁狀態
        this.tabStates.forEach((state, tabId) => {
            if (now - state.lastActivity > expireTime) {
                this.tabStates.delete(tabId);
            }
        });
        
        // 清理過期的活躍翻譯
        this.activeTranslations.forEach((translation, id) => {
            if (now - translation.startTime > expireTime) {
                this.cancelTranslation(id);
            }
        });
        
        console.debug('過期資料清理完成');
    }
    
    /**
     * 清理日誌
     */
    async cleanupLogs() {
        try {
            const { errorLogs = [] } = await chrome.storage.local.get(['errorLogs']);
            const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            
            const filteredLogs = errorLogs.filter(log => log.timestamp > oneWeekAgo);
            
            if (filteredLogs.length !== errorLogs.length) {
                await chrome.storage.local.set({ errorLogs: filteredLogs });
                console.debug(`清理了 ${errorLogs.length - filteredLogs.length} 條過期日誌`);
            }
        } catch (error) {
            console.warn('清理日誌失敗:', error);
        }
    }

    async getSettings() {
        const result = await chrome.storage.sync.get([
            'apiConfiguration',
            'translationPreferences',
            'usageStats'
        ]);

        // 使用新的設定結構
        const settings = {
            apiConfiguration: result.apiConfiguration || {
                provider: '',
                apiKey: '',
                model: 'gemini-pro',
                maxTokensPerRequest: 4000
            },
            translationPreferences: result.translationPreferences || {
                targetLanguage: 'zh-TW',
                showOriginalText: true,
                translationPosition: 'below',
                autoTranslateVisible: false,
                excludeSelectors: ['.ad', '.advertisement', '.sponsor']
            },
            usageStats: result.usageStats || {
                totalTranslations: 0,
                tokensUsed: 0,
                estimatedCost: 0,
                lastResetDate: new Date(),
                dailyUsage: []
            }
        };

        return settings;
    }

    async saveSettings(settings) {
        await chrome.storage.sync.set(settings);
        
        // 重新初始化API管理器
        if (this.apiManager && settings.apiConfiguration) {
            try {
                await this.apiManager.initialize(settings);
            } catch (error) {
                console.error('重新初始化API管理器失敗:', error);
            }
        }
    }
    
    /**
     * 設定API提供者
     * @param {string} provider - 提供者名稱
     * @param {Object} config - 配置物件
     */
    async setupAPIProvider(provider, config) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        if (this.apiManager) {
            await this.apiManager.setupProvider(provider, config);
        }
        
        // 儲存設定
        const currentSettings = await this.getSettings();
        currentSettings.apiConfiguration = {
            provider: provider,
            ...config
        };
        
        await this.saveSettings(currentSettings);
    }

    async initializeDefaultSettings() {
        const defaultSettings = {
            apiConfiguration: {
                provider: '',
                apiKey: '',
                model: 'gemini-pro',
                maxTokensPerRequest: 4000
            },
            translationPreferences: {
                targetLanguage: 'zh-TW',
                showOriginalText: true,
                translationPosition: 'below',
                autoTranslateVisible: false,
                excludeSelectors: ['.ad', '.advertisement', '.sponsor']
            },
            usageStats: {
                totalTranslations: 0,
                tokensUsed: 0,
                estimatedCost: 0,
                lastResetDate: new Date(),
                dailyUsage: []
            }
        };

        await chrome.storage.sync.set(defaultSettings);
        console.log('預設設定已初始化');
    }
    
    /**
     * 延遲函數
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 獲取背景服務狀態
     */
    getServiceStatus() {
        return {
            initialized: this.isInitialized,
            activeTranslations: this.activeTranslations.size,
            queueLength: this.requestQueue.length,
            activeTabs: this.tabStates.size,
            uptime: Date.now() - (this.startTime || Date.now())
        };
    }
    
    /**
     * 重新初始化服務
     */
    async reinitialize() {
        console.log('重新初始化背景服務...');
        
        // 清理現有狀態
        this.activeTranslations.clear();
        this.requestQueue.length = 0;
        this.tabStates.clear();
        this.isInitialized = false;
        
        // 重新初始化
        await this.initialize();
    }

    async validateAPIKey(provider, apiKey) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            if (this.apiManager) {
                const config = { apiKey, provider };
                return await this.apiManager.validateAPIConfig(provider, config);
            } else {
                // 降級方案：基本的格式驗證
                if (!apiKey || apiKey.trim().length === 0) {
                    return false;
                }
                
                // 簡單的格式驗證
                switch (provider) {
                    case 'google-gemini':
                        return apiKey.length > 20;
                    case 'openai':
                        return apiKey.startsWith('sk-');
                    case 'claude':
                        return apiKey.startsWith('sk-ant-');
                    default:
                        return apiKey.length > 10;
                }
            }
            
        } catch (error) {
            console.error('API金鑰驗證失敗:', error);
            return false;
        }
    }

    async translateText(text, provider, options = {}) {
        const translationId = `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            // 記錄活躍翻譯
            this.activeTranslations.set(translationId, {
                id: translationId,
                text: text,
                provider: provider,
                startTime: Date.now(),
                tabId: options.tabId,
                status: 'processing'
            });
            
            let result;
            
            // 如果API管理器可用，使用它進行翻譯
            if (this.apiManager) {
                result = await this.apiManager.translateText(text, options);
            } else {
                // 降級方案：返回模擬翻譯結果
                result = {
                    originalText: text,
                    translatedText: `[翻譯服務暫不可用] ${text}`,
                    provider: provider || 'fallback',
                    tokensUsed: Math.ceil(text.length / 4),
                    timestamp: Date.now()
                };
            }
            
            // 更新翻譯狀態
            const translation = this.activeTranslations.get(translationId);
            if (translation) {
                translation.status = 'completed';
                translation.result = result;
                translation.endTime = Date.now();
            }
            
            // 更新使用統計
            await this.updateUsageStatsFromTranslation(result);
            
            // 清理完成的翻譯記錄
            setTimeout(() => {
                this.activeTranslations.delete(translationId);
            }, 5000);
            
            return result;
            
        } catch (error) {
            console.error('翻譯請求失敗:', error);
            
            // 更新翻譯狀態為錯誤
            const translation = this.activeTranslations.get(translationId);
            if (translation) {
                translation.status = 'error';
                translation.error = error.message;
                translation.endTime = Date.now();
            }
            
            // 記錄錯誤
            this.logError('Translation', error.message, error.stack);
            
            throw error;
        }
    }
    
    /**
     * 批量翻譯
     * @param {Array} segments - 文本段落陣列
     * @param {Object} options - 翻譯選項
     * @returns {Promise<Array>} 翻譯結果陣列
     */
    async batchTranslate(segments, options = {}) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            if (this.apiManager) {
                return await this.apiManager.batchTranslate(segments, options);
            } else {
                // 降級方案：逐個翻譯
                const results = [];
                for (const segment of segments) {
                    try {
                        const translation = await this.translateText(segment.text, options.provider, options);
                        results.push({
                            segmentId: segment.id,
                            success: true,
                            translation: translation,
                            segment: segment
                        });
                    } catch (error) {
                        results.push({
                            segmentId: segment.id,
                            success: false,
                            error: error.message,
                            segment: segment
                        });
                    }
                }
                return results;
            }
            
        } catch (error) {
            console.error('批量翻譯失敗:', error);
            throw error;
        }
    }
    
    /**
     * 從翻譯結果更新使用統計
     * @param {Object} result - 翻譯結果
     */
    async updateUsageStatsFromTranslation(result) {
        const newStats = {
            translations: 1,
            tokens: result.tokensUsed || 0,
            cost: result.cost || 0
        };
        
        await this.updateUsageStats(newStats);
    }

    async getUsageStats() {
        const result = await chrome.storage.local.get([
            'totalTranslations',
            'tokensUsed',
            'estimatedCost',
            'lastResetDate',
            'dailyUsage'
        ]);

        return {
            totalTranslations: result.totalTranslations || 0,
            tokensUsed: result.tokensUsed || 0,
            estimatedCost: result.estimatedCost || 0,
            lastResetDate: result.lastResetDate || new Date().toISOString(),
            dailyUsage: result.dailyUsage || []
        };
    }

    async updateUsageStats(newStats) {
        const currentStats = await this.getUsageStats();
        
        const updatedStats = {
            totalTranslations: currentStats.totalTranslations + (newStats.translations || 0),
            tokensUsed: currentStats.tokensUsed + (newStats.tokens || 0),
            estimatedCost: currentStats.estimatedCost + (newStats.cost || 0),
            lastResetDate: currentStats.lastResetDate,
            dailyUsage: this.updateDailyUsage(currentStats.dailyUsage, newStats)
        };

        await chrome.storage.local.set(updatedStats);
    }

    updateDailyUsage(dailyUsage, newStats) {
        const today = new Date().toISOString().split('T')[0];
        const existingIndex = dailyUsage.findIndex(day => day.date === today);

        if (existingIndex >= 0) {
            dailyUsage[existingIndex].translations += newStats.translations || 0;
            dailyUsage[existingIndex].tokens += newStats.tokens || 0;
            dailyUsage[existingIndex].cost += newStats.cost || 0;
        } else {
            dailyUsage.push({
                date: today,
                translations: newStats.translations || 0,
                tokens: newStats.tokens || 0,
                cost: newStats.cost || 0
            });
        }

        // 只保留最近 30 天的資料
        return dailyUsage.slice(-30);
    }
}

// 初始化背景服務
new BackgroundService();