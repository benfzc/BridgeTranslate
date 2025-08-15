/**
 * 統一配置管理器
 * 負責處理所有配置相關的操作，包括載入、儲存、驗證和預設值管理
 */
class ConfigManager {
    constructor() {
        this.cache = null;
        this.cacheTimestamp = 0;
        this.CACHE_DURATION = 5000; // 5秒快取
    }

    /**
     * 獲取預設配置
     * @returns {Object} 預設配置物件
     */
    getDefaultSettings() {
        return {
            apiConfiguration: {
                provider: 'google-gemini',
                apiKey: '',
                model: 'gemini-2.5-flash-lite',
                maxTokensPerRequest: 4000
            },
            translationPreferences: {
                targetLanguage: 'zh-TW',
                translationPosition: 'below',
                excludeSelectors: ['.ad', '.advertisement', '.sponsor']
            },
            usageStats: {
                totalTranslations: 0,
                tokensUsed: 0,
                estimatedCost: 0,
                lastResetDate: new Date().toISOString(),
                dailyUsage: []
            }
        };
    }

    /**
     * 驗證 API 配置
     * @param {Object} config API 配置物件
     * @returns {boolean} 是否有效
     */
    validateAPIConfiguration(config) {
        if (!config || typeof config !== 'object') return false;
        
        const validProviders = ['openai', 'google-gemini', 'claude', 'bing-translator', 'google-translate'];
        
        return (
            typeof config.provider === 'string' &&
            validProviders.includes(config.provider) &&
            typeof config.apiKey === 'string' &&
            typeof config.model === 'string' &&
            typeof config.maxTokensPerRequest === 'number' &&
            config.maxTokensPerRequest > 0
        );
    }

    /**
     * 驗證翻譯偏好設定
     * @param {Object} prefs 翻譯偏好設定物件
     * @returns {boolean} 是否有效
     */
    validateTranslationPreferences(prefs) {
        if (!prefs || typeof prefs !== 'object') return false;
        
        const validLanguages = ['zh-TW', 'zh-CN', 'ja', 'ko', 'en', 'es', 'fr', 'de'];
        const validPositions = ['above', 'below', 'replace'];
        
        return (
            typeof prefs.targetLanguage === 'string' &&
            validLanguages.includes(prefs.targetLanguage) &&
            typeof prefs.translationPosition === 'string' &&
            validPositions.includes(prefs.translationPosition) &&
            Array.isArray(prefs.excludeSelectors)
        );
    }

    /**
     * 清理和驗證設定資料
     * @param {Object} settings 原始設定資料
     * @returns {Object} 清理後的設定資料
     */
    cleanAndValidateSettings(settings) {
        const defaultSettings = this.getDefaultSettings();
        const cleaned = {};

        // 驗證並清理 API 配置
        if (settings.apiConfiguration && this.validateAPIConfiguration(settings.apiConfiguration)) {
            cleaned.apiConfiguration = { ...defaultSettings.apiConfiguration, ...settings.apiConfiguration };
        } else {
            console.warn('API配置無效，使用預設值');
            cleaned.apiConfiguration = defaultSettings.apiConfiguration;
        }

        // 驗證並清理翻譯偏好設定
        if (settings.translationPreferences && this.validateTranslationPreferences(settings.translationPreferences)) {
            cleaned.translationPreferences = { ...defaultSettings.translationPreferences, ...settings.translationPreferences };
        } else {
            console.warn('翻譯偏好設定無效，使用預設值');
            cleaned.translationPreferences = defaultSettings.translationPreferences;
        }

        // 使用量統計（較寬鬆的驗證）
        if (settings.usageStats && typeof settings.usageStats === 'object') {
            cleaned.usageStats = { ...defaultSettings.usageStats, ...settings.usageStats };
        } else {
            cleaned.usageStats = defaultSettings.usageStats;
        }

        return cleaned;
    }

    /**
     * 載入設定（帶快取）
     * @param {boolean} forceReload 是否強制重新載入
     * @returns {Promise<Object>} 設定物件
     */
    async loadSettings(forceReload = false) {
        const now = Date.now();
        
        // 檢查快取是否有效
        if (!forceReload && this.cache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
            return this.cache;
        }

        try {
            const result = await chrome.storage.sync.get([
                'apiConfiguration',
                'translationPreferences',
                'usageStats'
            ]);

            const settings = this.cleanAndValidateSettings(result);
            
            // 更新快取
            this.cache = settings;
            this.cacheTimestamp = now;
            
            return settings;
        } catch (error) {
            console.error('載入設定失敗:', error);
            return this.getDefaultSettings();
        }
    }

    /**
     * 儲存設定
     * @param {Object} settings 要儲存的設定
     * @returns {Promise<void>}
     */
    async saveSettings(settings) {
        try {
            const cleanedSettings = this.cleanAndValidateSettings(settings);
            await chrome.storage.sync.set(cleanedSettings);
            
            // 更新快取
            this.cache = cleanedSettings;
            this.cacheTimestamp = Date.now();
            
            console.log('設定儲存成功');
        } catch (error) {
            console.error('儲存設定失敗:', error);
            throw error;
        }
    }

    /**
     * 載入按鈕可見性狀態
     * @returns {Promise<boolean>} 按鈕是否可見
     */
    async loadButtonVisibilityState() {
        try {
            const result = await chrome.storage.local.get(['buttonVisibilityState']);
            return result.buttonVisibilityState !== undefined ? result.buttonVisibilityState : true;
        } catch (error) {
            console.error('載入按鈕可見性狀態失敗:', error);
            return true; // 預設為可見
        }
    }

    /**
     * 儲存按鈕可見性狀態
     * @param {boolean} isVisible 按鈕是否可見
     * @returns {Promise<void>}
     */
    async saveButtonVisibilityState(isVisible) {
        try {
            await chrome.storage.local.set({ buttonVisibilityState: isVisible });
        } catch (error) {
            console.error('儲存按鈕可見性狀態失敗:', error);
            throw error;
        }
    }

    /**
     * 載入使用量統計
     * @returns {Promise<Object>} 使用量統計物件
     */
    async loadUsageStats() {
        try {
            const result = await chrome.storage.local.get([
                'totalTranslations',
                'tokensUsed',
                'estimatedCost',
                'lastResetDate',
                'dailyUsage'
            ]);

            const defaultStats = this.getDefaultSettings().usageStats;
            return {
                totalTranslations: result.totalTranslations || defaultStats.totalTranslations,
                tokensUsed: result.tokensUsed || defaultStats.tokensUsed,
                estimatedCost: result.estimatedCost || defaultStats.estimatedCost,
                lastResetDate: result.lastResetDate || defaultStats.lastResetDate,
                dailyUsage: result.dailyUsage || defaultStats.dailyUsage
            };
        } catch (error) {
            console.error('載入使用量統計失敗:', error);
            return this.getDefaultSettings().usageStats;
        }
    }

    /**
     * 儲存使用量統計
     * @param {Object} stats 使用量統計物件
     * @returns {Promise<void>}
     */
    async saveUsageStats(stats) {
        try {
            await chrome.storage.local.set(stats);
        } catch (error) {
            console.error('儲存使用量統計失敗:', error);
            throw error;
        }
    }

    /**
     * 重設為預設設定
     * @returns {Promise<void>}
     */
    async resetToDefaults() {
        const defaultSettings = this.getDefaultSettings();
        await this.saveSettings(defaultSettings);
        
        // 清除快取
        this.cache = null;
        this.cacheTimestamp = 0;
    }

    /**
     * 清除快取
     */
    clearCache() {
        this.cache = null;
        this.cacheTimestamp = 0;
    }
}

// 創建全域實例
const configManager = new ConfigManager();

// 如果在瀏覽器環境中，將其添加到全域範圍
if (typeof window !== 'undefined') {
    window.configManager = configManager;
}