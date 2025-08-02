/**
 * API管理器 - 管理和協調不同的翻譯API服務
 * API Manager - Manages and coordinates different translation API services
 */

class APIManager {
    constructor() {
        this.clients = new Map();
        this.currentProvider = null;
        this.settings = null;
        this.usageStats = {
            totalRequests: 0,
            totalTokens: 0,
            totalCost: 0,
            dailyUsage: []
        };
        
        // 支援的API提供者配置
        this.providers = {
            'google-gemini': {
                name: 'Google Gemini',
                clientClass: 'GeminiAPIClient',
                requiresApiKey: true,
                hasFreeQuota: true,
                maxTokensPerRequest: 4000,
                supportedLanguages: ['zh-TW', 'zh-CN', 'ja', 'ko', 'en']
            }
        };
    }
    
    /**
     * 初始化API管理器
     * @param {Object} settings - 設定物件
     */
    async initialize(settings) {
        this.settings = settings;
        
        if (settings.apiConfiguration) {
            await this.setupProvider(
                settings.apiConfiguration.provider,
                settings.apiConfiguration
            );
        }
        
        // 載入使用統計
        await this.loadUsageStats();
        
        console.log('API管理器初始化完成');
    }
    
    /**
     * 設定API提供者
     * @param {string} provider - 提供者名稱
     * @param {Object} config - 配置物件
     */
    async setupProvider(provider, config) {
        if (!this.providers[provider]) {
            throw new Error(`不支援的API提供者: ${provider}`);
        }
        
        const providerConfig = this.providers[provider];
        
        if (providerConfig.requiresApiKey && !config.apiKey) {
            throw new Error(`${providerConfig.name} 需要API金鑰`);
        }
        
        try {
            // 創建API客戶端
            let client;
            switch (provider) {
                case 'google-gemini':
                    client = new GeminiAPIClient(config.apiKey, {
                        model: config.model || 'gemini-pro',
                        maxTokens: config.maxTokensPerRequest || 4000
                    });
                    break;
                default:
                    throw new Error(`未實作的API提供者: ${provider}`);
            }
            
            // 驗證API金鑰
            const isValid = await client.validateAPIKey();
            if (!isValid) {
                throw new Error(`${providerConfig.name} API金鑰驗證失敗`);
            }
            
            // 儲存客戶端
            this.clients.set(provider, client);
            this.currentProvider = provider;
            
            console.log(`${providerConfig.name} API設定成功`);
            
        } catch (error) {
            console.error(`設定${providerConfig.name}失敗:`, error);
            throw error;
        }
    }
    
    /**
     * 翻譯文本
     * @param {string} text - 要翻譯的文本
     * @param {Object} options - 翻譯選項
     * @returns {Promise<Object>} 翻譯結果
     */
    async translateText(text, options = {}) {
        if (!this.currentProvider) {
            throw new Error('未設定翻譯API提供者');
        }
        
        const client = this.clients.get(this.currentProvider);
        if (!client) {
            throw new Error('API客戶端未初始化');
        }
        
        const targetLanguage = options.targetLanguage || 
                              this.settings?.translationPreferences?.targetLanguage || 
                              'zh-TW';
        
        try {
            const result = await client.translateText(text, targetLanguage, options);
            
            // 更新使用統計
            this.updateUsageStats(result);
            
            return result;
            
        } catch (error) {
            console.error('翻譯請求失敗:', error);
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
        if (!this.currentProvider) {
            throw new Error('未設定翻譯API提供者');
        }
        
        const client = this.clients.get(this.currentProvider);
        if (!client) {
            throw new Error('API客戶端未初始化');
        }
        
        const results = [];
        const batchSize = options.batchSize || 3;
        const delay = options.delay || 500;
        
        // 按優先級排序
        const sortedSegments = [...segments].sort((a, b) => {
            const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
        
        for (let i = 0; i < sortedSegments.length; i += batchSize) {
            const batch = sortedSegments.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (segment) => {
                try {
                    const result = await this.translateText(segment.text, options);
                    return {
                        segmentId: segment.id,
                        success: true,
                        translation: result,
                        segment: segment
                    };
                } catch (error) {
                    return {
                        segmentId: segment.id,
                        success: false,
                        error: error.message,
                        segment: segment
                    };
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // 通知進度
            if (options.onProgress) {
                const progress = Math.min(100, ((i + batchSize) / sortedSegments.length) * 100);
                options.onProgress(progress, results.length, sortedSegments.length);
            }
            
            // 批次間延遲
            if (i + batchSize < sortedSegments.length) {
                await this.delay(delay);
            }
        }
        
        return results;
    }
    
    /**
     * 驗證API配置
     * @param {string} provider - 提供者名稱
     * @param {Object} config - 配置物件
     * @returns {Promise<boolean>} 是否有效
     */
    async validateAPIConfig(provider, config) {
        if (!this.providers[provider]) {
            return false;
        }
        
        try {
            let client;
            switch (provider) {
                case 'google-gemini':
                    client = new GeminiAPIClient(config.apiKey, config);
                    break;
                default:
                    return false;
            }
            
            return await client.validateAPIKey();
            
        } catch (error) {
            console.error('API配置驗證失敗:', error);
            return false;
        }
    }
    
    /**
     * 獲取支援的提供者列表
     * @returns {Array} 提供者列表
     */
    getSupportedProviders() {
        return Object.entries(this.providers).map(([key, config]) => ({
            id: key,
            name: config.name,
            requiresApiKey: config.requiresApiKey,
            hasFreeQuota: config.hasFreeQuota,
            maxTokensPerRequest: config.maxTokensPerRequest,
            supportedLanguages: config.supportedLanguages
        }));
    }
    
    /**
     * 獲取當前提供者資訊
     * @returns {Object|null} 提供者資訊
     */
    getCurrentProvider() {
        if (!this.currentProvider) {
            return null;
        }
        
        return {
            id: this.currentProvider,
            ...this.providers[this.currentProvider],
            client: this.clients.get(this.currentProvider)
        };
    }
    
    /**
     * 檢查API配額
     * @returns {Promise<Object>} 配額資訊
     */
    async checkQuota() {
        if (!this.currentProvider) {
            throw new Error('未設定API提供者');
        }
        
        const client = this.clients.get(this.currentProvider);
        if (!client || !client.checkQuota) {
            return null;
        }
        
        return await client.checkQuota();
    }
    
    /**
     * 更新使用統計
     * @param {Object} result - 翻譯結果
     */
    updateUsageStats(result) {
        this.usageStats.totalRequests++;
        this.usageStats.totalTokens += result.tokensUsed || 0;
        
        // 計算成本（如果有的話）
        if (result.cost) {
            this.usageStats.totalCost += result.cost;
        }
        
        // 更新每日使用量
        const today = new Date().toISOString().split('T')[0];
        let dailyRecord = this.usageStats.dailyUsage.find(d => d.date === today);
        
        if (!dailyRecord) {
            dailyRecord = {
                date: today,
                requests: 0,
                tokens: 0,
                cost: 0
            };
            this.usageStats.dailyUsage.push(dailyRecord);
        }
        
        dailyRecord.requests++;
        dailyRecord.tokens += result.tokensUsed || 0;
        dailyRecord.cost += result.cost || 0;
        
        // 保留最近30天的記錄
        if (this.usageStats.dailyUsage.length > 30) {
            this.usageStats.dailyUsage = this.usageStats.dailyUsage.slice(-30);
        }
        
        // 儲存統計資料
        this.saveUsageStats();
    }
    
    /**
     * 載入使用統計
     */
    async loadUsageStats() {
        try {
            const result = await chrome.storage.local.get(['usageStats']);
            if (result.usageStats) {
                this.usageStats = { ...this.usageStats, ...result.usageStats };
            }
        } catch (error) {
            console.warn('載入使用統計失敗:', error);
        }
    }
    
    /**
     * 儲存使用統計
     */
    async saveUsageStats() {
        try {
            await chrome.storage.local.set({ usageStats: this.usageStats });
        } catch (error) {
            console.warn('儲存使用統計失敗:', error);
        }
    }
    
    /**
     * 獲取使用統計
     * @returns {Object} 使用統計
     */
    getUsageStats() {
        return { ...this.usageStats };
    }
    
    /**
     * 重置使用統計
     */
    async resetUsageStats() {
        this.usageStats = {
            totalRequests: 0,
            totalTokens: 0,
            totalCost: 0,
            dailyUsage: []
        };
        
        await this.saveUsageStats();
    }
    
    /**
     * 延遲函數
     * @param {number} ms - 延遲毫秒數
     * @returns {Promise} Promise物件
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 銷毀API管理器
     */
    destroy() {
        this.clients.clear();
        this.currentProvider = null;
        this.settings = null;
    }
}

// 匯出類別
window.APIManager = APIManager;