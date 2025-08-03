/**
 * Rate-Limited Translation Queue 核心系統
 * 實作基於 API 速率限制的翻譯請求隊列管理
 */

/**
 * Rate-Limited Translation Queue
 * 管理翻譯請求隊列並嚴格遵守 API 速率限制
 */
class RateLimitedTranslationQueue {
    constructor(options = {}) {
        // API 速率限制配置 (基於 Gemini API 限制)
        this.rpmLimit = options.rpmLimit || 15; // Gemini 2.5 Flash-Lite: 15 RPM
        this.tpmLimit = options.tpmLimit || 250000; // Tokens Per Minute
        this.rpdLimit = options.rpdLimit || 1000; // Requests Per Day
        
        // 隊列管理 - MVP 版本使用簡單陣列
        this.queue = [];
        this.processedSegments = new Set(); // 避免重複翻譯
        
        // 請求歷史追蹤
        this.requestHistory = []; // 記錄最近請求時間
        this.tokenHistory = []; // 記錄最近 token 使用量
        
        // 每日使用量追蹤
        this.dailyUsage = {
            requests: 0,
            tokens: 0,
            date: new Date().toDateString()
        };
        
        // 處理狀態
        this.isProcessing = false;
        this.processingInterval = null;
        this.currentSegment = null;
        
        // 事件回調
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
        
        console.log('RateLimitedTranslationQueue 初始化完成', {
            rpmLimit: this.rpmLimit,
            tpmLimit: this.tpmLimit,
            rpdLimit: this.rpdLimit
        });
    }
    
    /**
     * 將翻譯段落加入隊列
     * @param {Object} segment - 翻譯段落物件
     */
    enqueue(segment) {
        // 檢查是否已經處理過
        const segmentKey = this.generateSegmentKey(segment);
        if (this.processedSegments.has(segmentKey)) {
            console.log('段落已處理，跳過:', segmentKey);
            return false;
        }
        
        // 檢查是否已在隊列中
        const existingIndex = this.queue.findIndex(item => 
            this.generateSegmentKey(item.segment) === segmentKey
        );
        
        if (existingIndex !== -1) {
            console.log('段落已在隊列中，跳過:', segmentKey);
            return false;
        }
        
        // 加入隊列
        const queueItem = {
            segment: segment,
            priority: segment.priority || 0,
            timestamp: Date.now(),
            retryCount: 0
        };
        
        this.queue.push(queueItem);
        
        // 按優先級排序 (高優先級在前)
        this.queue.sort((a, b) => b.priority - a.priority);
        
        console.log(`段落已加入隊列 (${this.queue.length}/${this.queue.length + this.processedSegments.size}):`, 
                   segment.text.substring(0, 50) + '...');
        
        return true;
    }
    
    /**
     * 生成段落的唯一鍵值
     * @param {Object} segment - 翻譯段落
     * @returns {string} 唯一鍵值
     */
    generateSegmentKey(segment) {
        // 使用文本內容的簡單 hash 作為鍵值
        return 'seg_' + this.simpleHash(segment.text.trim());
    }
    
    /**
     * 簡單的字串 hash 函數
     * @param {string} str - 要 hash 的字串
     * @returns {string} hash 值
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 轉換為 32 位整數
        }
        return Math.abs(hash).toString(36);
    }
    
    /**
     * 檢查是否可以發送請求
     * @returns {boolean} 是否可以發送
     */
    canSendRequest() {
        const now = Date.now();
        
        // 檢查每日使用量是否需要重置
        const today = new Date().toDateString();
        if (this.dailyUsage.date !== today) {
            this.dailyUsage = { requests: 0, tokens: 0, date: today };
            console.log('每日使用量已重置');
        }
        
        // 清理一分鐘前的請求記錄
        const oneMinuteAgo = now - 60000;
        this.requestHistory = this.requestHistory.filter(time => time > oneMinuteAgo);
        this.tokenHistory = this.tokenHistory.filter(record => record.time > oneMinuteAgo);
        
        // 檢查各種限制
        const rpmCheck = this.requestHistory.length < this.rpmLimit;
        const tpmCheck = this.getTotalTokensInLastMinute() < this.tpmLimit;
        const rpdCheck = this.dailyUsage.requests < this.rpdLimit;
        
        const canSend = rpmCheck && tpmCheck && rpdCheck;
        
        if (!canSend) {
            console.log('API 限制檢查:', {
                rpm: `${this.requestHistory.length}/${this.rpmLimit}`,
                tpm: `${this.getTotalTokensInLastMinute()}/${this.tpmLimit}`,
                rpd: `${this.dailyUsage.requests}/${this.rpdLimit}`,
                canSend: canSend
            });
        }
        
        return canSend;
    }
    
    /**
     * 獲取最近一分鐘的 token 使用量
     * @returns {number} token 數量
     */
    getTotalTokensInLastMinute() {
        return this.tokenHistory.reduce((total, record) => total + record.tokens, 0);
    }
    
    /**
     * 計算最佳等待時間以維持均勻的請求分佈
     * @returns {number} 等待時間（毫秒）
     */
    calculateOptimalWaitTime() {
        const now = Date.now();
        
        // 清理過期的請求記錄
        const oneMinuteAgo = now - 60000;
        this.requestHistory = this.requestHistory.filter(time => time > oneMinuteAgo);
        
        // 如果沒有請求記錄，可以立即發送
        if (this.requestHistory.length === 0) {
            return 0;
        }
        
        // 計算理想的請求間隔（毫秒）
        const idealInterval = 60000 / this.rpmLimit; // 15 RPM = 4000ms 間隔
        
        // 獲取最後一次請求的時間
        const lastRequestTime = Math.max(...this.requestHistory);
        const timeSinceLastRequest = now - lastRequestTime;
        
        // 如果距離上次請求的時間小於理想間隔，需要等待
        if (timeSinceLastRequest < idealInterval) {
            return idealInterval - timeSinceLastRequest;
        }
        
        // 檢查是否達到 RPM 限制
        if (this.requestHistory.length >= this.rpmLimit) {
            const oldestRequest = Math.min(...this.requestHistory);
            const waitTime = Math.max(0, 60000 - (now - oldestRequest));
            return waitTime;
        }
        
        return 0;
    }
    
    /**
     * 計算需要等待的時間 (毫秒) - 舊版本，保留作為備用
     * @returns {number} 等待時間
     */
    getWaitTime() {
        if (this.requestHistory.length >= this.rpmLimit) {
            const oldestRequest = Math.min(...this.requestHistory);
            const waitTime = Math.max(0, 60000 - (Date.now() - oldestRequest));
            return waitTime;
        }
        return 0;
    }
    
    /**
     * 記錄 API 請求
     * @param {number} tokensUsed - 使用的 token 數量
     */
    recordRequest(tokensUsed = 0) {
        const now = Date.now();
        
        // 記錄請求時間
        this.requestHistory.push(now);
        
        // 記錄 token 使用量
        if (tokensUsed > 0) {
            this.tokenHistory.push({ time: now, tokens: tokensUsed });
        }
        
        // 更新每日使用量
        this.dailyUsage.requests++;
        this.dailyUsage.tokens += tokensUsed;
        
        console.log('API 請求已記錄:', {
            tokensUsed: tokensUsed,
            dailyRequests: this.dailyUsage.requests,
            dailyTokens: this.dailyUsage.tokens
        });
    }
    
    /**
     * 開始處理隊列
     */
    async startProcessing() {
        if (this.isProcessing) {
            console.log('隊列已在處理中');
            return;
        }
        
        if (this.queue.length === 0) {
            console.log('隊列為空，無需處理');
            return;
        }
        
        this.isProcessing = true;
        console.log(`開始處理翻譯隊列，共 ${this.queue.length} 個項目`);
        
        // 觸發進度回調
        this.triggerProgress();
        
        // 開始處理循環
        this.processNext();
    }
    
    /**
     * 處理隊列中的下一個項目
     */
    async processNext() {
        if (!this.isProcessing || this.queue.length === 0) {
            // 隊列處理完成
            this.isProcessing = false;
            this.currentSegment = null;
            console.log('隊列處理完成');
            
            if (this.onComplete) {
                this.onComplete();
            }
            return;
        }
        
        // 計算需要等待的時間以維持均勻的請求間隔
        const waitTime = this.calculateOptimalWaitTime();
        
        if (waitTime > 0) {
            console.log(`等待 ${Math.ceil(waitTime / 1000)} 秒以維持 API 速率限制`);
            setTimeout(() => {
                this.processNext();
            }, waitTime);
            return;
        }
        
        // 取出下一個項目
        const queueItem = this.queue.shift();
        this.currentSegment = queueItem.segment;
        
        console.log(`處理翻譯項目 (剩餘 ${this.queue.length}):`, 
                   queueItem.segment.text.substring(0, 50) + '...');
        
        try {
            // 發送翻譯請求
            await this.translateSegment(queueItem);
            
            // 標記為已處理
            const segmentKey = this.generateSegmentKey(queueItem.segment);
            this.processedSegments.add(segmentKey);
            
            // 觸發進度回調
            this.triggerProgress();
            
        } catch (error) {
            console.error('翻譯失敗:', error);
            
            // 重試邏輯 (MVP 版本簡化)
            if (queueItem.retryCount < 2) {
                queueItem.retryCount++;
                this.queue.unshift(queueItem); // 重新加入隊列前端
                console.log(`翻譯失敗，重試 ${queueItem.retryCount}/2`);
            } else {
                console.error('翻譯最終失敗，跳過此項目');
                if (this.onError) {
                    this.onError(error, queueItem.segment);
                }
            }
        }
        
        // 立即處理下一個項目（等待時間由 calculateOptimalWaitTime 控制）
        this.processNext();
    }
    
    /**
     * 翻譯單個段落
     * @param {Object} queueItem - 隊列項目
     */
    async translateSegment(queueItem) {
        const segment = queueItem.segment;
        
        // 發送翻譯請求到背景腳本
        const response = await chrome.runtime.sendMessage({
            type: 'TRANSLATE_TEXT',
            text: segment.text,
            provider: 'google-gemini',
            options: {
                targetLanguage: 'zh-TW'
            }
        });
        
        if (!response.success) {
            throw new Error(response.error || '翻譯請求失敗');
        }
        
        // 記錄 API 使用量
        const tokensUsed = this.estimateTokens(segment.text);
        this.recordRequest(tokensUsed);
        
        // 立即渲染翻譯結果
        if (window.webTranslationContent && window.webTranslationContent.translationRenderer) {
            // response.translation 是一個包含 translatedText 的對象
            const translationResult = response.translation;
            const translation = {
                segmentId: segment.id,
                originalText: segment.text,
                translatedText: translationResult.translatedText || translationResult,
                provider: translationResult.provider || 'google-gemini',
                tokensUsed: translationResult.tokensUsed || tokensUsed,
                timestamp: Date.now()
            };
            
            window.webTranslationContent.translationRenderer.renderTranslation(
                segment, 
                translation, 
                { position: 'below' }
            );
        }
        
        console.log('翻譯完成:', segment.text.substring(0, 30) + '...');
    }
    
    /**
     * 估算文本的 token 數量 (簡化版本)
     * @param {string} text - 文本
     * @returns {number} 估算的 token 數量
     */
    estimateTokens(text) {
        // 簡化的 token 估算：大約每 4 個字符 = 1 token
        return Math.ceil(text.length / 4);
    }
    
    /**
     * 觸發進度回調
     */
    triggerProgress() {
        if (this.onProgress) {
            const total = this.queue.length + this.processedSegments.size;
            const current = this.processedSegments.size;
            
            this.onProgress({
                current: current,
                total: total,
                percentage: total > 0 ? Math.round((current / total) * 100) : 0,
                queueLength: this.queue.length,
                currentSegment: this.currentSegment,
                isProcessing: this.isProcessing
            });
        }
    }
    
    /**
     * 暫停處理
     */
    pause() {
        this.isProcessing = false;
        console.log('隊列處理已暫停');
    }
    
    /**
     * 恢復處理
     */
    resume() {
        if (!this.isProcessing && this.queue.length > 0) {
            console.log('恢復隊列處理');
            this.startProcessing();
        }
    }
    
    /**
     * 清空隊列
     */
    clear() {
        this.queue = [];
        this.processedSegments.clear();
        this.isProcessing = false;
        this.currentSegment = null;
        console.log('隊列已清空');
    }
    
    /**
     * 獲取隊列狀態
     * @returns {Object} 隊列狀態
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            processedCount: this.processedSegments.size,
            isProcessing: this.isProcessing,
            currentSegment: this.currentSegment,
            dailyUsage: { ...this.dailyUsage },
            canSendRequest: this.canSendRequest(),
            waitTime: this.getWaitTime()
        };
    }
}

// 匯出類別
window.RateLimitedTranslationQueue = RateLimitedTranslationQueue;