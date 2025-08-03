/**
 * 核心資料模型和介面定義
 * Core Data Models and Interfaces
 */

// ===== 翻譯相關模型 =====

/**
 * 文本段落介面
 * @typedef {Object} TextSegment
 * @property {string} id - 唯一識別碼
 * @property {string} text - 文本內容
 * @property {HTMLElement} element - DOM元素引用
 * @property {'high'|'medium'|'low'} priority - 優先級
 * @property {'title'|'paragraph'|'list'|'other'} type - 內容類型
 * @property {boolean} isVisible - 是否可見
 */

/**
 * 翻譯結果介面
 * @typedef {Object} Translation
 * @property {string} segmentId - 對應的文本段落ID
 * @property {string} originalText - 原始文本
 * @property {string} translatedText - 翻譯文本
 * @property {number} timestamp - 翻譯時間戳
 * @property {string} apiProvider - API提供者
 * @property {number} tokensUsed - 使用的token數量
 */

// ===== API配置模型 =====

/**
 * API配置介面
 * @typedef {Object} APIConfiguration
 * @property {'openai'|'google-gemini'|'claude'|'bing-translator'|'google-translate'} provider - API提供者
 * @property {string} apiKey - API金鑰
 * @property {string} [endpoint] - 自定義端點
 * @property {string} [model] - 模型名稱
 * @property {number} maxTokensPerRequest - 每次請求最大token數
 */

/**
 * 各服務的具體配置
 * @typedef {Object} ServiceConfigs
 * @property {Object} openai
 * @property {'gpt-3.5-turbo'|'gpt-4'} openai.model
 * @property {Object} google-gemini
 * @property {'gemini-pro'|'gemini-pro-vision'} google-gemini.model
 * @property {Object} claude
 * @property {'claude-3-sonnet'|'claude-3-haiku'} claude.model
 * @property {Object} bing-translator
 * @property {string} bing-translator.region
 * @property {Object} google-translate
 * @property {string} [google-translate.projectId]
 */

/**
 * 翻譯偏好設定
 * @typedef {Object} TranslationPreferences
 * @property {string} targetLanguage - 目標語言

 * @property {'below'|'inline'|'tooltip'} translationPosition - 翻譯位置
 * @property {boolean} autoTranslateVisible - 自動翻譯可見內容
 * @property {string[]} excludeSelectors - 排除的CSS選擇器
 */

// ===== 統計模型 =====

/**
 * 使用統計
 * @typedef {Object} UsageStats
 * @property {number} totalTranslations - 總翻譯數
 * @property {number} tokensUsed - 使用的token數
 * @property {number} estimatedCost - 估算成本
 * @property {Date} lastResetDate - 上次重置日期
 * @property {DailyUsage[]} dailyUsage - 每日使用量
 */

/**
 * 每日使用量
 * @typedef {Object} DailyUsage
 * @property {string} date - 日期
 * @property {number} translations - 翻譯數量
 * @property {number} tokens - token使用量
 * @property {number} cost - 成本
 */

// ===== 資料驗證函數 =====

/**
 * 驗證文本段落資料
 * @param {any} data - 待驗證的資料
 * @returns {boolean} 是否有效
 */
function validateTextSegment(data) {
    if (!data || typeof data !== 'object') return false;
    
    const requiredFields = ['id', 'text', 'element', 'priority', 'type', 'isVisible'];
    const validPriorities = ['high', 'medium', 'low'];
    const validTypes = ['title', 'paragraph', 'list', 'other'];
    
    // 檢查必要欄位
    for (const field of requiredFields) {
        if (!(field in data)) return false;
    }
    
    // 檢查資料類型
    if (typeof data.id !== 'string' || data.id.trim() === '') return false;
    if (typeof data.text !== 'string' || data.text.trim() === '') return false;
    if (!(data.element instanceof HTMLElement)) return false;
    if (!validPriorities.includes(data.priority)) return false;
    if (!validTypes.includes(data.type)) return false;
    if (typeof data.isVisible !== 'boolean') return false;
    
    return true;
}

/**
 * 驗證翻譯結果資料
 * @param {any} data - 待驗證的資料
 * @returns {boolean} 是否有效
 */
function validateTranslation(data) {
    if (!data || typeof data !== 'object') return false;
    
    const requiredFields = ['segmentId', 'originalText', 'translatedText', 'timestamp', 'apiProvider', 'tokensUsed'];
    
    // 檢查必要欄位
    for (const field of requiredFields) {
        if (!(field in data)) return false;
    }
    
    // 檢查資料類型
    if (typeof data.segmentId !== 'string' || data.segmentId.trim() === '') return false;
    if (typeof data.originalText !== 'string' || data.originalText.trim() === '') return false;
    if (typeof data.translatedText !== 'string' || data.translatedText.trim() === '') return false;
    if (typeof data.timestamp !== 'number' || data.timestamp <= 0) return false;
    if (typeof data.apiProvider !== 'string' || data.apiProvider.trim() === '') return false;
    if (typeof data.tokensUsed !== 'number' || data.tokensUsed < 0) return false;
    
    return true;
}/**

 * 驗證API配置資料
 * @param {any} data - 待驗證的資料
 * @returns {boolean} 是否有效
 */
function validateAPIConfiguration(data) {
    if (!data || typeof data !== 'object') return false;
    
    const validProviders = ['openai', 'google-gemini', 'claude', 'bing-translator', 'google-translate'];
    const requiredFields = ['provider', 'apiKey', 'maxTokensPerRequest'];
    
    // 檢查必要欄位
    for (const field of requiredFields) {
        if (!(field in data)) return false;
    }
    
    // 檢查資料類型和值
    if (!validProviders.includes(data.provider)) return false;
    if (typeof data.apiKey !== 'string' || data.apiKey.trim() === '') return false;
    if (typeof data.maxTokensPerRequest !== 'number' || data.maxTokensPerRequest <= 0) return false;
    
    // 檢查可選欄位
    if (data.endpoint && typeof data.endpoint !== 'string') return false;
    if (data.model && typeof data.model !== 'string') return false;
    
    return true;
}

/**
 * 驗證翻譯偏好設定
 * @param {any} data - 待驗證的資料
 * @returns {boolean} 是否有效
 */
function validateTranslationPreferences(data) {
    if (!data || typeof data !== 'object') return false;
    
    const validPositions = ['below', 'inline', 'tooltip'];
    const requiredFields = ['targetLanguage', 'translationPosition', 'autoTranslateVisible', 'excludeSelectors'];
    
    // 檢查必要欄位
    for (const field of requiredFields) {
        if (!(field in data)) return false;
    }
    
    // 檢查資料類型和值
    if (typeof data.targetLanguage !== 'string' || data.targetLanguage.trim() === '') return false;

    if (!validPositions.includes(data.translationPosition)) return false;
    if (typeof data.autoTranslateVisible !== 'boolean') return false;
    if (!Array.isArray(data.excludeSelectors)) return false;
    
    // 檢查excludeSelectors陣列中的每個元素
    for (const selector of data.excludeSelectors) {
        if (typeof selector !== 'string') return false;
    }
    
    return true;
}

/**
 * 驗證使用統計資料
 * @param {any} data - 待驗證的資料
 * @returns {boolean} 是否有效
 */
function validateUsageStats(data) {
    if (!data || typeof data !== 'object') return false;
    
    const requiredFields = ['totalTranslations', 'tokensUsed', 'estimatedCost', 'lastResetDate', 'dailyUsage'];
    
    // 檢查必要欄位
    for (const field of requiredFields) {
        if (!(field in data)) return false;
    }
    
    // 檢查資料類型
    if (typeof data.totalTranslations !== 'number' || data.totalTranslations < 0) return false;
    if (typeof data.tokensUsed !== 'number' || data.tokensUsed < 0) return false;
    if (typeof data.estimatedCost !== 'number' || data.estimatedCost < 0) return false;
    if (!(data.lastResetDate instanceof Date)) return false;
    if (!Array.isArray(data.dailyUsage)) return false;
    
    // 檢查dailyUsage陣列中的每個元素
    for (const usage of data.dailyUsage) {
        if (!validateDailyUsage(usage)) return false;
    }
    
    return true;
}

/**
 * 驗證每日使用量資料
 * @param {any} data - 待驗證的資料
 * @returns {boolean} 是否有效
 */
function validateDailyUsage(data) {
    if (!data || typeof data !== 'object') return false;
    
    const requiredFields = ['date', 'translations', 'tokens', 'cost'];
    
    // 檢查必要欄位
    for (const field of requiredFields) {
        if (!(field in data)) return false;
    }
    
    // 檢查資料類型
    if (typeof data.date !== 'string' || data.date.trim() === '') return false;
    if (typeof data.translations !== 'number' || data.translations < 0) return false;
    if (typeof data.tokens !== 'number' || data.tokens < 0) return false;
    if (typeof data.cost !== 'number' || data.cost < 0) return false;
    
    // 檢查日期格式 (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.date)) return false;
    
    return true;
}

// ===== 設定資料序列化和反序列化 =====

/**
 * 設定資料管理器
 */
class SettingsManager {
    /**
     * 序列化設定資料為JSON字串
     * @param {Object} settings - 設定物件
     * @returns {string} JSON字串
     */
    static serialize(settings) {
        try {
            // 處理Date物件的序列化
            const serializable = JSON.parse(JSON.stringify(settings, (key, value) => {
                if (value instanceof Date) {
                    return { __type: 'Date', value: value.toISOString() };
                }
                return value;
            }));
            
            return JSON.stringify(serializable);
        } catch (error) {
            console.error('設定序列化失敗:', error);
            throw new Error('設定序列化失敗');
        }
    }
    
    /**
     * 反序列化JSON字串為設定物件
     * @param {string} jsonString - JSON字串
     * @returns {Object} 設定物件
     */
    static deserialize(jsonString) {
        try {
            const parsed = JSON.parse(jsonString, (key, value) => {
                // 處理Date物件的反序列化
                if (value && typeof value === 'object' && value.__type === 'Date') {
                    return new Date(value.value);
                }
                return value;
            });
            
            return parsed;
        } catch (error) {
            console.error('設定反序列化失敗:', error);
            throw new Error('設定反序列化失敗');
        }
    }
    
    /**
     * 創建預設的API配置
     * @returns {APIConfiguration} 預設API配置
     */
    static createDefaultAPIConfiguration() {
        return {
            provider: 'google-gemini',
            apiKey: '',
            endpoint: '',
            model: 'gemini-pro',
            maxTokensPerRequest: 4000
        };
    }
    
    /**
     * 創建預設的翻譯偏好設定
     * @returns {TranslationPreferences} 預設翻譯偏好設定
     */
    static createDefaultTranslationPreferences() {
        return {
            targetLanguage: 'zh-TW',
            showOriginalText: true,
            translationPosition: 'below',
            autoTranslateVisible: false,
            excludeSelectors: ['.ad', '.advertisement', '.sponsor', '.popup']
        };
    }
    
    /**
     * 創建預設的使用統計
     * @returns {UsageStats} 預設使用統計
     */
    static createDefaultUsageStats() {
        return {
            totalTranslations: 0,
            tokensUsed: 0,
            estimatedCost: 0,
            lastResetDate: new Date(),
            dailyUsage: []
        };
    }
    
    /**
     * 驗證並清理設定資料
     * @param {Object} settings - 設定資料
     * @returns {Object} 清理後的設定資料
     */
    static validateAndCleanSettings(settings) {
        const cleaned = {};
        
        // 驗證API配置
        if (settings.apiConfiguration) {
            if (validateAPIConfiguration(settings.apiConfiguration)) {
                cleaned.apiConfiguration = settings.apiConfiguration;
            } else {
                console.warn('API配置無效，使用預設值');
                cleaned.apiConfiguration = this.createDefaultAPIConfiguration();
            }
        } else {
            cleaned.apiConfiguration = this.createDefaultAPIConfiguration();
        }
        
        // 驗證翻譯偏好設定
        if (settings.translationPreferences) {
            if (validateTranslationPreferences(settings.translationPreferences)) {
                cleaned.translationPreferences = settings.translationPreferences;
            } else {
                console.warn('翻譯偏好設定無效，使用預設值');
                cleaned.translationPreferences = this.createDefaultTranslationPreferences();
            }
        } else {
            cleaned.translationPreferences = this.createDefaultTranslationPreferences();
        }
        
        // 驗證使用統計
        if (settings.usageStats) {
            if (validateUsageStats(settings.usageStats)) {
                cleaned.usageStats = settings.usageStats;
            } else {
                console.warn('使用統計無效，使用預設值');
                cleaned.usageStats = this.createDefaultUsageStats();
            }
        } else {
            cleaned.usageStats = this.createDefaultUsageStats();
        }
        
        return cleaned;
    }
}

// ===== 匯出函數和類別 =====

// 驗證函數
window.validateTextSegment = validateTextSegment;
window.validateTranslation = validateTranslation;
window.validateAPIConfiguration = validateAPIConfiguration;
window.validateTranslationPreferences = validateTranslationPreferences;
window.validateUsageStats = validateUsageStats;
window.validateDailyUsage = validateDailyUsage;

// 設定管理器
window.SettingsManager = SettingsManager;

// 工具函數
/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
window.generateUniqueId = function() {
    return 'segment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

/**
 * 創建文本段落物件
 * @param {string} text - 文本內容
 * @param {HTMLElement} element - DOM元素
 * @param {string} type - 內容類型
 * @param {string} priority - 優先級
 * @returns {TextSegment} 文本段落物件
 */
window.createTextSegment = function(text, element, type = 'paragraph', priority = 'medium') {
    return {
        id: window.generateUniqueId(),
        text: text.trim(),
        element: element,
        priority: priority,
        type: type,
        isVisible: isElementVisible(element)
    };
};

/**
 * 檢查元素是否可見
 * @param {HTMLElement} element - DOM元素
 * @returns {boolean} 是否可見
 */
function isElementVisible(element) {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0'
    );
}

window.isElementVisible = isElementVisible;