// 簡化版背景服務
// Simplified Background Service Worker

class SimpleBackgroundService {
    constructor() {
        this.isInitialized = false;
        this.settings = {};
        this.initializeListeners();
        this.initialize();
    }

    async initialize() {
        try {
            // 載入設定
            this.settings = await this.getSettings();
            this.isInitialized = true;
            console.log('簡化背景服務初始化完成');
        } catch (error) {
            console.error('背景服務初始化失敗:', error);
        }
    }

    initializeListeners() {
        // 監聽訊息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // 保持訊息通道開啟
        });

        // 監聽安裝事件
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                this.initializeDefaultSettings();
                chrome.tabs.create({
                    url: chrome.runtime.getURL('settings.html')
                });
            }
        });
    }

    async handleMessage(message, sender, sendResponse) {
        try {
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
                    sendResponse({ success: true });
                    break;

                case 'VALIDATE_API_KEY':
                    const isValid = this.validateAPIKeyBasic(message.provider, message.apiKey);
                    sendResponse({ success: true, isValid });
                    break;

                case 'TRANSLATE_TEXT':
                    const translation = this.createMockTranslation(message.text, message.provider);
                    sendResponse({ success: true, translation });
                    break;

                case 'GET_SUPPORTED_PROVIDERS':
                    const providers = this.getSupportedProviders();
                    sendResponse({ success: true, providers });
                    break;

                case 'GET_USAGE_STATS':
                    const stats = await this.getUsageStats();
                    sendResponse({ success: true, stats });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Background script error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async getSettings() {
        const result = await chrome.storage.sync.get([
            'apiConfiguration',
            'translationPreferences',
            'usageStats'
        ]);

        return {
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
    }

    async saveSettings(settings) {
        await chrome.storage.sync.set(settings);
        this.settings = settings;
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
    }

    validateAPIKeyBasic(provider, apiKey) {
        if (!apiKey || apiKey.trim().length === 0) {
            return false;
        }

        switch (provider) {
            case 'google-gemini':
                return apiKey.length > 20;
            case 'openai':
                return apiKey.startsWith('sk-');
            case 'claude':
                return apiKey.startsWith('sk-ant-');
            case 'bing-translator':
                return apiKey.length === 32;
            case 'google-translate':
                return apiKey.length > 20;
            default:
                return false;
        }
    }

    createMockTranslation(text, provider) {
        return {
            originalText: text,
            translatedText: `[模擬翻譯 - ${provider || 'unknown'}] ${text}`,
            provider: provider || 'mock',
            tokensUsed: Math.ceil(text.length / 4),
            timestamp: Date.now()
        };
    }

    getSupportedProviders() {
        return [
            {
                id: 'google-gemini',
                name: 'Google Gemini',
                requiresApiKey: true,
                hasFreeQuota: true,
                maxTokensPerRequest: 4000,
                supportedLanguages: ['zh-TW', 'zh-CN', 'ja', 'ko', 'en']
            },
            {
                id: 'openai',
                name: 'OpenAI GPT',
                requiresApiKey: true,
                hasFreeQuota: false,
                maxTokensPerRequest: 4000,
                supportedLanguages: ['zh-TW', 'zh-CN', 'ja', 'ko', 'en']
            },
            {
                id: 'claude',
                name: 'Claude (Anthropic)',
                requiresApiKey: true,
                hasFreeQuota: false,
                maxTokensPerRequest: 4000,
                supportedLanguages: ['zh-TW', 'zh-CN', 'ja', 'ko', 'en']
            }
        ];
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
}

// 初始化簡化背景服務
new SimpleBackgroundService();