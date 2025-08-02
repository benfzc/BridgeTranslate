/**
 * AI翻譯API服務整合
 * AI Translation API Services Integration
 */

/**
 * 基礎API客戶端類別
 */
class BaseAPIClient {
    constructor(apiKey, options = {}) {
        this.apiKey = apiKey;
        this.options = {
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            ...options
        };
        this.requestCount = 0;
        this.tokenUsage = 0;
    }
    
    /**
     * 發送HTTP請求
     * @param {string} url - 請求URL
     * @param {Object} options - 請求選項
     * @returns {Promise<Response>} 回應物件
     */
    async makeRequest(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response;
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('請求超時');
            }
            
            throw error;
        }
    }
    
    /**
     * 帶重試機制的請求
     * @param {Function} requestFn - 請求函數
     * @param {number} attempt - 當前嘗試次數
     * @returns {Promise} 請求結果
     */
    async requestWithRetry(requestFn, attempt = 1) {
        try {
            return await requestFn();
        } catch (error) {
            if (attempt < this.options.retryAttempts && this.shouldRetry(error)) {
                console.warn(`API請求失敗，第${attempt}次重試:`, error.message);
                await this.delay(this.options.retryDelay * attempt);
                return this.requestWithRetry(requestFn, attempt + 1);
            }
            throw error;
        }
    }
    
    /**
     * 判斷是否應該重試
     * @param {Error} error - 錯誤物件
     * @returns {boolean} 是否重試
     */
    shouldRetry(error) {
        // 網路錯誤或5xx錯誤可以重試
        return error.message.includes('網路') || 
               error.message.includes('timeout') ||
               error.message.includes('500') ||
               error.message.includes('502') ||
               error.message.includes('503');
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
     * 估算token使用量
     * @param {string} text - 文本內容
     * @returns {number} 估算的token數量
     */
    estimateTokens(text) {
        // 簡單估算：英文約4字符=1token，中文約2字符=1token
        const englishChars = (text.match(/[a-zA-Z\s]/g) || []).length;
        const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const otherChars = text.length - englishChars - chineseChars;
        
        return Math.ceil(englishChars / 4 + chineseChars / 2 + otherChars / 3);
    }
    
    /**
     * 更新使用統計
     * @param {number} tokens - 使用的token數量
     */
    updateUsageStats(tokens) {
        this.requestCount++;
        this.tokenUsage += tokens;
    }
    
    /**
     * 獲取使用統計
     * @returns {Object} 使用統計
     */
    getUsageStats() {
        return {
            requestCount: this.requestCount,
            tokenUsage: this.tokenUsage
        };
    }
}

/**
 * Google Gemini API客戶端
 */
class GeminiAPIClient extends BaseAPIClient {
    constructor(apiKey, options = {}) {
        super(apiKey, options);
        this.baseURL = 'https://generativelanguage.googleapis.com/v1beta';
        this.model = options.model || 'gemini-pro';
        this.maxTokens = options.maxTokens || 4000;
    }
    
    /**
     * 驗證API金鑰
     * @returns {Promise<boolean>} 是否有效
     */
    async validateAPIKey() {
        try {
            const response = await this.requestWithRetry(async () => {
                return await this.makeRequest(
                    `${this.baseURL}/models/${this.model}:generateContent?key=${this.apiKey}`,
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: 'Hello'
                                }]
                            }]
                        })
                    }
                );
            });
            
            const data = await response.json();
            return !!(data.candidates && data.candidates.length > 0);
            
        } catch (error) {
            console.error('Gemini API金鑰驗證失敗:', error);
            return false;
        }
    }
    
    /**
     * 翻譯文本
     * @param {string} text - 要翻譯的文本
     * @param {string} targetLanguage - 目標語言
     * @param {Object} options - 翻譯選項
     * @returns {Promise<Object>} 翻譯結果
     */
    async translateText(text, targetLanguage = 'zh-TW', options = {}) {
        if (!text || text.trim().length === 0) {
            throw new Error('翻譯文本不能為空');
        }
        
        if (!this.apiKey) {
            throw new Error('API金鑰未設定');
        }
        
        const startTime = Date.now();
        const estimatedTokens = this.estimateTokens(text);
        
        try {
            // 構建翻譯提示
            const prompt = this.buildTranslationPrompt(text, targetLanguage, options);
            
            const response = await this.requestWithRetry(async () => {
                return await this.makeRequest(
                    `${this.baseURL}/models/${this.model}:generateContent?key=${this.apiKey}`,
                    {
                        method: 'POST',
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
                                maxOutputTokens: Math.min(this.maxTokens, estimatedTokens * 2),
                                stopSequences: []
                            },
                            safetySettings: [
                                {
                                    category: "HARM_CATEGORY_HARASSMENT",
                                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                                },
                                {
                                    category: "HARM_CATEGORY_HATE_SPEECH",
                                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                                },
                                {
                                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                                },
                                {
                                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                                }
                            ]
                        })
                    }
                );
            });
            
            const data = await response.json();
            
            if (!data.candidates || data.candidates.length === 0) {
                throw new Error('API回應格式錯誤或內容被過濾');
            }
            
            const translatedText = data.candidates[0].content.parts[0].text.trim();
            const actualTokens = this.estimateTokens(text + translatedText);
            
            // 更新使用統計
            this.updateUsageStats(actualTokens);
            
            const result = {
                originalText: text,
                translatedText: translatedText,
                targetLanguage: targetLanguage,
                provider: 'google-gemini',
                model: this.model,
                tokensUsed: actualTokens,
                responseTime: Date.now() - startTime,
                timestamp: Date.now()
            };
            
            // 驗證翻譯結果
            if (window.validateTranslation && !window.validateTranslation(result)) {
                console.warn('翻譯結果驗證失敗:', result);
            }
            
            return result;
            
        } catch (error) {
            console.error('Gemini翻譯失敗:', error);
            throw new Error(`翻譯失敗: ${error.message}`);
        }
    }
    
    /**
     * 構建翻譯提示
     * @param {string} text - 原始文本
     * @param {string} targetLanguage - 目標語言
     * @param {Object} options - 選項
     * @returns {string} 翻譯提示
     */
    buildTranslationPrompt(text, targetLanguage, options = {}) {
        const languageMap = {
            'zh-TW': '繁體中文',
            'zh-CN': '簡體中文',
            'ja': '日文',
            'ko': '韓文',
            'en': '英文'
        };
        
        const targetLangName = languageMap[targetLanguage] || targetLanguage;
        
        let prompt = `請將以下英文文本翻譯成${targetLangName}，要求：
1. 保持原文的語氣和風格
2. 確保翻譯自然流暢
3. 保留專業術語的準確性
4. 只返回翻譯結果，不要包含其他說明

原文：
${text}

翻譯：`;
        
        return prompt;
    }
    
    /**
     * 批量翻譯
     * @param {string[]} texts - 文本陣列
     * @param {string} targetLanguage - 目標語言
     * @param {Object} options - 選項
     * @returns {Promise<Object[]>} 翻譯結果陣列
     */
    async batchTranslate(texts, targetLanguage = 'zh-TW', options = {}) {
        const results = [];
        const batchSize = options.batchSize || 5;
        
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const batchPromises = batch.map(text => 
                this.translateText(text, targetLanguage, options)
                    .catch(error => ({
                        error: error.message,
                        originalText: text
                    }))
            );
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // 批次間延遲，避免API限制
            if (i + batchSize < texts.length) {
                await this.delay(500);
            }
        }
        
        return results;
    }
    
    /**
     * 檢查API配額
     * @returns {Promise<Object>} 配額資訊
     */
    async checkQuota() {
        // Gemini API目前沒有直接的配額查詢端點
        // 這裡返回基於使用統計的估算
        const stats = this.getUsageStats();
        
        return {
            provider: 'google-gemini',
            requestCount: stats.requestCount,
            tokenUsage: stats.tokenUsage,
            estimatedCost: this.calculateCost(stats.tokenUsage),
            dailyLimit: 1000000, // Gemini免費版每日限制
            remainingQuota: Math.max(0, 1000000 - stats.tokenUsage)
        };
    }
    
    /**
     * 計算使用成本
     * @param {number} tokens - token數量
     * @returns {number} 估算成本（美元）
     */
    calculateCost(tokens) {
        // Gemini Pro免費版：每分鐘60次請求，每日1M token
        // 付費版：$0.0005 per 1K tokens (input), $0.0015 per 1K tokens (output)
        const inputTokens = tokens * 0.6; // 假設60%為輸入
        const outputTokens = tokens * 0.4; // 假設40%為輸出
        
        return (inputTokens / 1000 * 0.0005) + (outputTokens / 1000 * 0.0015);
    }
}

// 匯出類別
window.BaseAPIClient = BaseAPIClient;
window.GeminiAPIClient = GeminiAPIClient;