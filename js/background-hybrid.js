// 混合版背景服務 - 支援真實API和降級功能
// Hybrid Background Service - Supports real API with fallback

// 內嵌的基本API客戶端
class BasicGeminiClient {
    constructor(apiKey, model = 'gemini-2.5-flash-lite') {
        this.apiKey = apiKey;
        this.baseURL = 'https://generativelanguage.googleapis.com/v1beta';
        this.model = model;
    }
    
    async translateText(text, targetLanguage = 'zh-TW') {
        if (!this.apiKey) {
            throw new Error('API金鑰未設定');
        }
        
        const prompt = this.buildTranslationPrompt(text, targetLanguage);
        
        try {
            const response = await fetch(
                `${this.baseURL}/models/${this.model}:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: prompt
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            topK: 1,
                            topP: 1,
                            maxOutputTokens: 1000
                        }
                    })
                }
            );
            
            if (!response.ok) {
                throw new Error(`API請求失敗: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.candidates || data.candidates.length === 0) {
                throw new Error('API回應格式錯誤');
            }
            
            const translatedText = data.candidates[0].content.parts[0].text.trim();
            
            return {
                originalText: text,
                translatedText: translatedText,
                provider: 'google-gemini',
                model: this.model,
                tokensUsed: Math.ceil((text.length + translatedText.length) / 4),
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('Gemini API翻譯失敗:', error);
            throw error;
        }
    }
    
    buildTranslationPrompt(text, targetLanguage) {
        const languageMap = {
            'zh-TW': '繁體中文',
            'zh-CN': '簡體中文',
            'ja': '日文',
            'ko': '韓文',
            'en': '英文'
        };
        
        const targetLangName = languageMap[targetLanguage] || targetLanguage;
        
        return `請將以下英文文本翻譯成${targetLangName}，要求：
1. 保持原文的語氣和風格
2. 確保翻譯自然流暢
3. 保留專業術語為英文
4. 原文有可能是與embedded system software有關文章段落
5. 只返回翻譯結果，不要包含其他說明

原文：
${text}

翻譯：`;
    }
    
    async validateAPIKey() {
        try {
            console.log('🔍 開始驗證API金鑰...', this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'empty');
            
            // 基本格式檢查
            if (!this.apiKey || this.apiKey.trim().length === 0) {
                console.error('❌ API金鑰為空');
                return false;
            }
            
            if (this.apiKey.length < 20) {
                console.error('❌ API金鑰長度不足:', this.apiKey.length);
                return false;
            }
            
            // 先嘗試一個簡單的模型列表請求
            console.log('📋 測試 1: 嘗試獲取模型列表...');
            const listResponse = await fetch(
                `${this.baseURL}/models?key=${this.apiKey}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                }
            );
            
            console.log('📡 模型列表請求狀態:', listResponse.status, listResponse.statusText);
            
            if (listResponse.ok) {
                const listData = await listResponse.json();
                console.log('✅ API金鑰驗證成功（模型列表）', listData.models ? `找到 ${listData.models.length} 個模型` : '');
                return true;
            } else {
                const listError = await listResponse.text();
                console.warn('⚠️ 模型列表請求失敗:', listResponse.status, listError);
            }
            
            // 如果模型列表失敗，嘗試生成內容請求
            console.log('💬 測試 2: 嘗試生成內容...');
            const response = await fetch(
                `${this.baseURL}/models/${this.model}:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: 'Test'
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 5
                        }
                    })
                }
            );
            
            console.log('📡 生成內容請求狀態:', response.status, response.statusText);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ API金鑰驗證成功（生成內容）');
                
                if (data.candidates && data.candidates.length > 0) {
                    console.log('🎉 API 回應正常，包含候選結果');
                    return true;
                } else {
                    console.warn('⚠️ API 回應異常，沒有候選結果:', JSON.stringify(data));
                    return false;
                }
            } else {
                const errorText = await response.text();
                console.error('❌ API驗證失敗:', response.status, response.statusText);
                console.error('📄 錯誤詳情:', errorText);
                
                // 解析錯誤訊息
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.error) {
                        console.error('🔍 具體錯誤:', errorData.error.message);
                        
                        if (errorData.error.message.includes('API_KEY_INVALID')) {
                            console.error('💡 問題: API 金鑰無效');
                        } else if (errorData.error.message.includes('PERMISSION_DENIED')) {
                            console.error('💡 問題: 權限被拒絕，請確認 API 已啟用');
                        } else if (errorData.error.message.includes('QUOTA_EXCEEDED')) {
                            console.error('💡 問題: 配額已用完');
                        }
                    }
                } catch (parseError) {
                    console.error('無法解析錯誤訊息:', parseError);
                }
                
                return false;
            }
        } catch (error) {
            console.error('❌ API驗證網路錯誤:', error);
            console.error('💡 可能的問題: 網路連接、防火牆或 CORS 設定');
            return false;
        }
    }
}

// 內嵌的基本 OpenAI API 客戶端
class BasicOpenAIClient {
    constructor(apiKey, model = 'gpt-3.5-turbo') {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.openai.com/v1';
        this.model = model;
    }
    
    async translateText(text, targetLanguage = 'zh-TW') {
        if (!this.apiKey) {
            throw new Error('API金鑰未設定');
        }
        
        const prompt = this.buildTranslationPrompt(text, targetLanguage);
        
        try {
            const response = await fetch(
                `${this.baseURL}/chat/completions`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({
                        model: this.model,
                        messages: [
                            {
                                role: 'user',
                                content: prompt
                            }
                        ],
                        temperature: 0.1,
                        max_tokens: 1000
                    })
                }
            );
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('OpenAI API 錯誤回應:', errorText);
                throw new Error(`API請求失敗: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.choices || data.choices.length === 0) {
                throw new Error('API回應格式錯誤');
            }
            
            const translatedText = data.choices[0].message.content.trim();
            
            return {
                originalText: text,
                translatedText: translatedText,
                provider: 'openai',
                model: this.model,
                tokensUsed: data.usage?.total_tokens || Math.ceil((text.length + translatedText.length) / 4),
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('OpenAI API翻譯失敗:', error);
            throw error;
        }
    }
    
    buildTranslationPrompt(text, targetLanguage) {
        const languageMap = {
            'zh-TW': '台灣慣用繁體中文',
            'zh-CN': '簡體中文',
            'ja': '日文',
            'ko': '韓文',
            'en': '英文'
        };
        
        const targetLangName = languageMap[targetLanguage] || targetLanguage;
        
        return `請將以下文本翻譯成${targetLangName}，要求：
1. 保持原文的語氣和風格
2. 確保翻譯自然流暢
3. 保留專業術語為英文
4. 原文有可能是與embedded system software有關文章段落
5. 只返回翻譯結果，不要包含其他說明

原文：
${text}

翻譯：`;
    }
    
    async validateAPIKey() {
        try {
            console.log('🔍 開始驗證 OpenAI API 金鑰...', this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'empty');
            
            // 基本格式檢查
            if (!this.apiKey || this.apiKey.trim().length === 0) {
                console.error('❌ API金鑰為空');
                return false;
            }
            
            if (!this.apiKey.startsWith('sk-')) {
                console.error('❌ OpenAI API金鑰格式不正確（應以 sk- 開頭）');
                return false;
            }
            
            if (this.apiKey.length < 40) {
                console.error('❌ OpenAI API金鑰長度不足');
                return false;
            }
            
            // 測試 API 連接
            console.log('💬 測試 OpenAI API 連接...');
            const response = await fetch(
                `${this.baseURL}/chat/completions`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({
                        model: this.model,
                        messages: [
                            {
                                role: 'user',
                                content: 'Hello'
                            }
                        ],
                        max_tokens: 5
                    })
                }
            );
            
            if (response.ok) {
                console.log('✅ OpenAI API 驗證成功');
                return true;
            } else {
                const errorText = await response.text();
                console.error('❌ OpenAI API 驗證失敗');
                console.error('📄 錯誤詳情:', errorText);
                
                // 解析錯誤訊息
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.error) {
                        console.error('🔍 具體錯誤:', errorData.error.message);
                        
                        if (errorData.error.code === 'invalid_api_key') {
                            console.error('💡 問題: API 金鑰無效');
                        } else if (errorData.error.code === 'insufficient_quota') {
                            console.error('💡 問題: 配額不足');
                        } else if (errorData.error.code === 'model_not_found') {
                            console.error('💡 問題: 模型不存在或無權限');
                        }
                    }
                } catch (parseError) {
                    console.error('無法解析錯誤訊息:', parseError);
                }
                
                return false;
            }
        } catch (error) {
            console.error('❌ OpenAI API 驗證網路錯誤:', error);
            console.error('💡 可能的問題: 網路連接、防火牆或 CORS 設定');
            return false;
        }
    }
}

class HybridBackgroundService {
    constructor() {
        this.isInitialized = false;
        this.settings = {};
        this.apiClient = null;
        this.initializeListeners();
        this.initialize();
    }

    async initialize() {
        try {
            console.log('🚀 開始初始化混合背景服務...');
            
            // 載入設定
            this.settings = await this.getSettings();
            const provider = this.settings.apiConfiguration?.provider;
            const apiKey = this.settings.apiConfiguration?.apiKeys?.[provider];
            console.log('📋 設定載入完成:', {
                provider: provider,
                hasApiKey: !!apiKey,
                apiKeyLength: apiKey?.length || 0
            });
            
            // 如果有API配置，創建API客戶端
            
            if (provider === 'google-gemini' && apiKey) {
                console.log('🔧 創建API客戶端...');
                const model = this.settings.apiConfiguration?.models?.[provider] || 'gemini-2.5-flash-lite';
                this.apiClient = new BasicGeminiClient(apiKey, model);
                console.log('✅ API客戶端創建完成，模型:', model);
            } else {
                console.log('⚠️ 未創建API客戶端，原因:', {
                    hasProvider: !!provider,
                    provider: provider,
                    hasApiKey: !!apiKey,
                    apiKeyLength: apiKey?.length || 0
                });
            }
            
            this.isInitialized = true;
            console.log('✅ 混合背景服務初始化完成');
        } catch (error) {
            console.error('❌ 背景服務初始化失敗:', error);
            // 即使初始化失敗，也標記為已初始化，避免無限等待
            this.isInitialized = true;
        }
    }

    initializeListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true;
        });

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
                        initialized: this.isInitialized,
                        hasRealAPI: !!this.apiClient
                    });
                    break;

                case 'GET_SETTINGS':
                    const settings = await this.getSettings();
                    sendResponse({ success: true, data: settings });
                    break;

                case 'SAVE_SETTINGS':
                    const provider = message.data.apiConfiguration?.provider;
                    const apiKey = message.data.apiConfiguration?.apiKeys?.[provider];
                    console.log('💾 保存設定:', {
                        provider: provider,
                        hasApiKey: !!apiKey
                    });
                    
                    await this.saveSettings(message.data);
                    
                    // 重新初始化API客戶端
                    
                    if (provider === 'google-gemini' && apiKey) {
                        console.log('🔧 重新創建API客戶端...');
                        const model = message.data.apiConfiguration?.models?.[provider] || 'gemini-2.5-flash-lite';
                        this.apiClient = new BasicGeminiClient(apiKey, model);
                        console.log('✅ API客戶端重新創建完成，模型:', model);
                    } else {
                        console.log('🗑️ 清除API客戶端');
                        this.apiClient = null;
                    }
                    
                    sendResponse({ success: true });
                    break;

                case 'VALIDATE_API_KEY':
                    const isValid = await this.validateAPIKey(message.provider, message.apiKey);
                    sendResponse({ success: true, isValid });
                    break;

                case 'TRANSLATE_TEXT':
                    const translation = await this.translateText(message.text, message.provider, message.options);
                    sendResponse({ success: true, translation });
                    break;

                case 'BATCH_TRANSLATE':
                    const results = await this.batchTranslate(message.segments, message.options);
                    sendResponse({ success: true, results });
                    break;

                case 'GET_SUPPORTED_PROVIDERS':
                    const providers = this.getSupportedProviders();
                    sendResponse({ success: true, providers });
                    break;

                case 'GET_USAGE_STATS':
                    const stats = await this.getUsageStats();
                    sendResponse({ success: true, stats });
                    break;

                case 'CHECK_API_QUOTA':
                    sendResponse({ 
                        success: true, 
                        quota: {
                            provider: 'google-gemini',
                            hasQuota: !!this.apiClient,
                            message: this.apiClient ? 'API已配置' : '請先配置API金鑰'
                        }
                    });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Background script error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async translateText(text, provider, options = {}) {
        try {
            console.log('🔄 開始翻譯請求:', {
                provider,
                textLength: text.length,
                hasApiClient: !!this.apiClient,
                isInitialized: this.isInitialized
            });

            // 確保服務已初始化
            if (!this.isInitialized) {
                console.log('⏳ 服務未初始化，等待初始化完成...');
                await this.initialize();
            }

            // 重新載入設定以確保最新的API配置
            console.log('🔄 重新載入設定以確保API配置最新...');
            this.settings = await this.getSettings();
            
            // 使用傳入的 provider 參數，或者從設定中獲取
            const currentProvider = provider || this.settings.apiConfiguration?.provider;
            const apiKey = this.settings.apiConfiguration?.apiKeys?.[currentProvider];
            
            console.log('📋 當前設定:', {
                provider: currentProvider,
                hasApiKey: !!apiKey,
                apiKeyLength: apiKey?.length || 0
            });

            // 檢查是否需要創建或重新創建 Gemini API 客戶端
            if (currentProvider === 'google-gemini' && apiKey) {
                const model = this.settings.apiConfiguration?.models?.[currentProvider] || 'gemini-2.5-flash-lite';
                
                // 如果沒有客戶端，或者API key/模型已改變，則重新創建
                if (!this.apiClient || 
                    this.apiClient.apiKey !== apiKey || 
                    this.apiClient.model !== model) {
                    
                    console.log('🔧 創建/重新創建 Gemini API 客戶端...');
                    this.apiClient = new BasicGeminiClient(apiKey, model);
                    console.log('✅ Gemini API 客戶端創建完成，模型:', model);
                }
            }

            // 使用 Gemini API
            if (this.apiClient && currentProvider === 'google-gemini') {
                console.log('🚀 使用 Gemini API 進行翻譯');
                
                const targetLanguage = options.targetLanguage || 
                                     this.settings.translationPreferences?.targetLanguage || 
                                     'zh-TW';
                
                const result = await this.apiClient.translateText(text, targetLanguage);
                
                console.log('✅ Gemini 翻譯成功:', {
                    originalLength: result.originalText.length,
                    translatedLength: result.translatedText.length,
                    tokensUsed: result.tokensUsed
                });
                
                // 更新使用統計
                await this.updateUsageStats({
                    translations: 1,
                    tokens: result.tokensUsed,
                    cost: result.tokensUsed * 0.001 / 1000 // 簡單的成本估算
                });
                
                return result;
            }
            
            // 使用 OpenAI API
            if (currentProvider === 'openai' && apiKey) {
                console.log('🚀 使用 OpenAI API 進行翻譯');
                
                const model = this.settings.apiConfiguration?.models?.[currentProvider] || 'gpt-3.5-turbo';
                const openaiClient = new BasicOpenAIClient(apiKey, model);
                
                const targetLanguage = options.targetLanguage || 
                                     this.settings.translationPreferences?.targetLanguage || 
                                     'zh-TW';
                
                const result = await openaiClient.translateText(text, targetLanguage);
                
                console.log('✅ OpenAI 翻譯成功:', {
                    originalLength: result.originalText.length,
                    translatedLength: result.translatedText.length,
                    tokensUsed: result.tokensUsed
                });
                
                // 更新使用統計
                await this.updateUsageStats({
                    translations: 1,
                    tokens: result.tokensUsed,
                    cost: result.tokensUsed * 0.015 / 1000 // OpenAI 成本估算
                });
                
                return result;
            } else {
                // 檢查為什麼沒有API客戶端
                const reason = !currentProvider ? 
                    '未選擇翻譯服務' : 
                    !apiKey ? 
                    '未設定API金鑰' : 
                    currentProvider !== 'google-gemini' ? 
                    `不支援的提供者: ${currentProvider}` : 
                    '未知原因';
                
                console.warn('⚠️ 無法使用真實API，原因:', reason);
                
                // 降級到模擬翻譯
                return {
                    originalText: text,
                    translatedText: `[請先在設定中配置 ${currentProvider || 'API'} 金鑰] ${text}`,
                    provider: currentProvider || 'mock',
                    tokensUsed: Math.ceil(text.length / 4),
                    timestamp: Date.now()
                };
            }
        } catch (error) {
            console.error('❌ 翻譯失敗:', error);
            // 如果真實API失敗，返回錯誤信息
            return {
                originalText: text,
                translatedText: `[翻譯失敗: ${error.message}] ${text}`,
                provider: provider || 'error',
                tokensUsed: 0,
                timestamp: Date.now()
            };
        }
    }

    async batchTranslate(segments, options = {}) {
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
                
                // 短暫延遲避免API限制
                await new Promise(resolve => setTimeout(resolve, 200));
                
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

    async validateAPIKey(provider, apiKey) {
        console.log('驗證API金鑰:', provider, apiKey ? '***已提供***' : '未提供');
        
        if (!apiKey || apiKey.trim().length === 0) {
            console.log('API金鑰為空');
            return false;
        }
        
        if (provider === 'google-gemini') {
            try {
                // 基本格式檢查
                if (apiKey.length < 20) {
                    console.log('Gemini API金鑰長度不足');
                    return false;
                }
                
                const client = new BasicGeminiClient(apiKey, 'gemini-2.5-flash-lite');
                const isValid = await client.validateAPIKey();
                console.log('Gemini API驗證結果:', isValid);
                return isValid;
            } catch (error) {
                console.error('Gemini API驗證異常:', error);
                return false;
            }
        }
        
        if (provider === 'openai') {
            try {
                // 基本格式檢查
                if (!apiKey.startsWith('sk-')) {
                    console.log('OpenAI API金鑰格式不正確');
                    return false;
                }
                
                if (apiKey.length < 40) {
                    console.log('OpenAI API金鑰長度不足');
                    return false;
                }
                
                const client = new BasicOpenAIClient(apiKey, 'gpt-3.5-turbo');
                const isValid = await client.validateAPIKey();
                console.log('OpenAI API驗證結果:', isValid);
                return isValid;
            } catch (error) {
                console.error('OpenAI API驗證異常:', error);
                return false;
            }
        }
        
        // 其他提供者的基本驗證
        switch (provider) {
            case 'claude':
                return apiKey.startsWith('sk-ant-');
            default:
                return apiKey.length > 10;
        }
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
            }
        ];
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
                apiKeys: {
                    'google-gemini': '',
                    'openai': ''
                },
                models: {
                    'google-gemini': 'gemini-2.5-flash-lite',
                    'openai': 'gpt-3.5-turbo'
                },
                maxTokensPerRequest: 4000
            },
            translationPreferences: result.translationPreferences || {
                targetLanguage: 'zh-TW',
                translationPosition: 'below',
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
                apiKeys: {
                    'google-gemini': '',
                    'openai': ''
                },
                models: {
                    'google-gemini': 'gemini-2.5-flash-lite',
                    'openai': 'gpt-3.5-turbo'
                },
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
                lastResetDate: new Date(),
                dailyUsage: []
            }
        };

        await chrome.storage.sync.set(defaultSettings);
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

        return dailyUsage.slice(-30);
    }
}

// 初始化混合背景服務
new HybridBackgroundService();