/**
 * 視窗翻譯管理器 - 負責管理基於視窗的智能翻譯功能
 * Viewport Translation Manager - Manages intelligent viewport-based translation
 */

class ViewportTranslationManager {
    constructor(options = {}) {
        this.options = {
            scrollThrottle: 200,        // 滾動節流延遲 (ms)
            batchSize: 3,              // 批次翻譯大小
            batchDelay: 500,           // 批次處理延遲 (ms)
            maxConcurrentRequests: 2,   // 最大並發請求數
            preloadMargin: 200,        // 預載入邊距 (px)
            enabled: true,             // 是否啟用滾動翻譯
            ...options
        };
        
        // 核心組件
        this.boundaryDetector = null;
        this.translationRenderer = null;
        this.apiManager = null;
        
        // 狀態管理
        this.isActive = false;
        this.isTranslating = false;
        this.translationQueue = new Set();
        this.processingQueue = new Set();
        this.activeRequests = new Map();
        
        // 事件處理
        this.scrollHandler = null;
        this.scrollTimeout = null;
        this.batchTimeout = null;
        
        // 統計資訊
        this.stats = {
            totalScrollEvents: 0,
            totalTranslations: 0,
            totalAPIRequests: 0,
            averageResponseTime: 0,
            lastScrollTime: 0,
            queueProcessedCount: 0
        };
        
        console.log('視窗翻譯管理器初始化完成');
    }
    
    /**
     * 初始化管理器
     * @param {Object} dependencies - 依賴組件
     */
    async initialize(dependencies = {}) {
        try {
            // 設定依賴組件
            this.boundaryDetector = dependencies.boundaryDetector || 
                new TranslationBoundaryDetector();
            this.translationRenderer = dependencies.translationRenderer || 
                new TranslationRenderer();
            this.apiManager = dependencies.apiManager;
            
            if (!this.apiManager) {
                console.warn('API Manager 未提供，滾動翻譯功能將受限');
            }
            
            // 設定滾動事件監聽器
            this.setupScrollListener();
            
            console.log('視窗翻譯管理器初始化完成');
            return true;
            
        } catch (error) {
            console.error('視窗翻譯管理器初始化失敗:', error);
            return false;
        }
    }
    
    /**
     * 設定滾動事件監聽器
     */
    setupScrollListener() {
        // 移除現有監聽器
        if (this.scrollHandler) {
            window.removeEventListener('scroll', this.scrollHandler);
        }
        
        // 創建節流的滾動處理器
        this.scrollHandler = this.throttle((event) => {
            if (!this.isActive || !this.options.enabled) return;
            
            this.stats.totalScrollEvents++;
            this.stats.lastScrollTime = Date.now();
            
            // 清除之前的超時
            if (this.scrollTimeout) {
                clearTimeout(this.scrollTimeout);
            }
            
            // 延遲處理滾動事件
            this.scrollTimeout = setTimeout(() => {
                this.handleScroll();
            }, this.options.scrollThrottle);
            
        }, this.options.scrollThrottle);
        
        // 添加事件監聽器
        window.addEventListener('scroll', this.scrollHandler, { passive: true });
        console.log('滾動事件監聽器已設定');
    }
    
    /**
     * 處理滾動事件
     */
    async handleScroll() {
        if (!this.isActive || this.isTranslating) return;
        
        try {
            // 獲取需要翻譯的內容
            const elementsToTranslate = await this.getElementsToTranslate();
            
            if (elementsToTranslate.length === 0) {
                return;
            }
            
            console.log(`滾動檢測到 ${elementsToTranslate.length} 個需要翻譯的元素`);
            
            // 添加到翻譯佇列
            elementsToTranslate.forEach(element => {
                this.addToTranslationQueue(element);
            });
            
            // 處理翻譯佇列
            this.processBatchQueue();
            
        } catch (error) {
            console.error('處理滾動事件時發生錯誤:', error);
        }
    }
    
    /**
     * 獲取需要翻譯的元素
     * @returns {Array} 需要翻譯的元素陣列
     */
    async getElementsToTranslate() {
        try {
            // 獲取翻譯範圍
            const translationRange = this.boundaryDetector.getTranslationRange();
            
            // 擴展範圍以包含預載入邊距
            const expandedRange = {
                startY: translationRange.startY,
                endY: translationRange.endY + this.options.preloadMargin
            };
            
            // 找到範圍內的文本元素
            const textElements = this.boundaryDetector.findTextElementsInRange(
                expandedRange.startY,
                expandedRange.endY,
                {
                    excludeTranslated: true,
                    minTextLength: 15,
                    excludeSelectors: [
                        '.translation-content',
                        '.ad', '.advertisement',
                        'script', 'style', 'noscript',
                        '[data-ad]', '.sidebar'
                    ]
                }
            );
            
            // 過濾掉已在佇列中的元素
            const filteredElements = textElements.filter(item => {
                const elementId = this.getElementId(item.element);
                return !this.translationQueue.has(elementId) && 
                       !this.processingQueue.has(elementId);
            });
            
            // 按優先級排序 (距離視窗中心越近優先級越高)
            const viewport = this.boundaryDetector.getViewportRange();
            const viewportCenter = viewport.center;
            
            filteredElements.sort((a, b) => {
                const distanceA = Math.abs(a.y - viewportCenter);
                const distanceB = Math.abs(b.y - viewportCenter);
                return distanceA - distanceB;
            });
            
            return filteredElements;
            
        } catch (error) {
            console.error('獲取需要翻譯的元素時發生錯誤:', error);
            return [];
        }
    }
    
    /**
     * 添加元素到翻譯佇列
     * @param {Object} elementData - 元素資料
     */
    addToTranslationQueue(elementData) {
        const elementId = this.getElementId(elementData.element);
        
        if (this.translationQueue.has(elementId) || 
            this.processingQueue.has(elementId)) {
            return;
        }
        
        // 創建翻譯任務
        const translationTask = {
            id: elementId,
            element: elementData.element,
            text: elementData.text,
            textNode: elementData.textNode,
            rect: elementData.rect,
            y: elementData.y,
            priority: this.calculatePriority(elementData),
            addedAt: Date.now()
        };
        
        this.translationQueue.add(translationTask);
        console.log(`添加翻譯任務到佇列: ${elementId}`);
    }
    
    /**
     * 計算元素翻譯優先級
     * @param {Object} elementData - 元素資料
     * @returns {string} 優先級 ('high', 'medium', 'low')
     */
    calculatePriority(elementData) {
        const element = elementData.element;
        const tagName = element.tagName.toLowerCase();
        
        // 高優先級：標題、重要段落
        if (['h1', 'h2', 'h3'].includes(tagName)) {
            return 'high';
        }
        
        // 中優先級：一般段落、列表項
        if (['p', 'li', 'blockquote'].includes(tagName)) {
            return 'medium';
        }
        
        // 低優先級：其他文本
        return 'low';
    }
    
    /**
     * 處理批次翻譯佇列
     */
    processBatchQueue() {
        // 清除之前的批次超時
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }
        
        // 延遲處理以允許更多元素加入佇列
        this.batchTimeout = setTimeout(() => {
            this.executeBatchTranslation();
        }, this.options.batchDelay);
    }
    
    /**
     * 執行批次翻譯
     */
    async executeBatchTranslation() {
        if (this.isTranslating || this.translationQueue.size === 0) {
            return;
        }
        
        // 檢查並發請求限制
        if (this.activeRequests.size >= this.options.maxConcurrentRequests) {
            console.log('達到最大並發請求數，延遲處理');
            setTimeout(() => this.executeBatchTranslation(), 1000);
            return;
        }
        
        this.isTranslating = true;
        
        try {
            // 從佇列中取出批次任務
            const batch = this.getBatchFromQueue();
            
            if (batch.length === 0) {
                this.isTranslating = false;
                return;
            }
            
            console.log(`開始批次翻譯 ${batch.length} 個元素`);
            
            // 移動任務到處理佇列
            batch.forEach(task => {
                this.translationQueue.delete(task);
                this.processingQueue.add(task.id);
            });
            
            // 顯示載入指示器
            batch.forEach(task => {
                this.showLoadingIndicator(task);
            });
            
            // 執行翻譯
            await this.translateBatch(batch);
            
            // 清理處理佇列
            batch.forEach(task => {
                this.processingQueue.delete(task.id);
            });
            
            this.stats.queueProcessedCount++;
            
        } catch (error) {
            console.error('批次翻譯執行失敗:', error);
        } finally {
            this.isTranslating = false;
            
            // 如果還有待處理的任務，繼續處理
            if (this.translationQueue.size > 0) {
                setTimeout(() => this.executeBatchTranslation(), 500);
            }
        }
    }
    
    /**
     * 從佇列中獲取批次任務
     * @returns {Array} 批次任務陣列
     */
    getBatchFromQueue() {
        const batch = [];
        const queueArray = Array.from(this.translationQueue);
        
        // 按優先級排序
        queueArray.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
        
        // 取出指定數量的任務
        for (let i = 0; i < Math.min(this.options.batchSize, queueArray.length); i++) {
            batch.push(queueArray[i]);
        }
        
        return batch;
    }
    
    /**
     * 翻譯批次任務
     * @param {Array} batch - 批次任務
     */
    async translateBatch(batch) {
        const requestId = `batch_${Date.now()}`;
        const startTime = Date.now();
        
        try {
            // 記錄活動請求
            this.activeRequests.set(requestId, {
                batch: batch,
                startTime: startTime
            });
            
            // 準備翻譯請求
            const translationPromises = batch.map(async (task) => {
                try {
                    // 創建段落物件
                    const segment = {
                        id: task.id,
                        element: task.element,
                        text: task.text,
                        priority: task.priority
                    };
                    
                    // 調用翻譯 API
                    if (this.apiManager) {
                        const translation = await this.apiManager.translateText(task.text, {
                            targetLanguage: 'zh-TW',
                            priority: task.priority
                        });
                        
                        // 渲染翻譯結果
                        this.translationRenderer.renderTranslation(segment, translation);
                        
                        this.stats.totalTranslations++;
                        return { success: true, task: task, translation: translation };
                    } else {
                        // 模擬翻譯 (用於測試)
                        const mockTranslation = {
                            translatedText: `[模擬翻譯] ${task.text.substring(0, 50)}...`,
                            originalText: task.text,
                            provider: 'mock',
                            tokensUsed: Math.floor(task.text.length / 4)
                        };
                        
                        this.translationRenderer.renderTranslation(segment, mockTranslation);
                        
                        this.stats.totalTranslations++;
                        return { success: true, task: task, translation: mockTranslation };
                    }
                    
                } catch (error) {
                    console.error(`翻譯任務失敗 ${task.id}:`, error);
                    this.handleTranslationError(task, error);
                    return { success: false, task: task, error: error };
                }
            });
            
            // 等待所有翻譯完成
            const results = await Promise.allSettled(translationPromises);
            
            // 統計結果
            const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            const failed = results.length - successful;
            
            console.log(`批次翻譯完成: ${successful} 成功, ${failed} 失敗`);
            
            // 更新統計
            this.stats.totalAPIRequests++;
            const responseTime = Date.now() - startTime;
            this.stats.averageResponseTime = 
                (this.stats.averageResponseTime * (this.stats.totalAPIRequests - 1) + responseTime) / 
                this.stats.totalAPIRequests;
            
        } catch (error) {
            console.error('批次翻譯過程發生錯誤:', error);
            
            // 處理批次錯誤
            batch.forEach(task => {
                this.handleTranslationError(task, error);
            });
            
        } finally {
            // 清理活動請求
            this.activeRequests.delete(requestId);
            
            // 移除載入指示器
            batch.forEach(task => {
                this.hideLoadingIndicator(task);
            });
        }
    }
    
    /**
     * 顯示載入指示器
     * @param {Object} task - 翻譯任務
     */
    showLoadingIndicator(task) {
        try {
            const segment = {
                id: task.id,
                element: task.element,
                text: task.text,
                priority: task.priority
            };
            
            this.translationRenderer.showLoadingIndicator(segment);
            
        } catch (error) {
            console.warn('顯示載入指示器失敗:', error);
        }
    }
    
    /**
     * 隱藏載入指示器
     * @param {Object} task - 翻譯任務
     */
    hideLoadingIndicator(task) {
        try {
            this.translationRenderer.removeLoadingIndicator(task.id);
        } catch (error) {
            console.warn('隱藏載入指示器失敗:', error);
        }
    }
    
    /**
     * 處理翻譯錯誤
     * @param {Object} task - 翻譯任務
     * @param {Error} error - 錯誤物件
     */
    handleTranslationError(task, error) {
        try {
            const segment = {
                id: task.id,
                element: task.element,
                text: task.text,
                priority: task.priority
            };
            
            this.translationRenderer.renderError(segment, error.message);
            
        } catch (renderError) {
            console.error('渲染錯誤狀態失敗:', renderError);
        }
    }
    
    /**
     * 獲取元素唯一 ID
     * @param {HTMLElement} element - HTML 元素
     * @returns {string} 唯一 ID
     */
    getElementId(element) {
        // 嘗試使用現有 ID
        if (element.id) {
            return `element_${element.id}`;
        }
        
        // 使用元素在 DOM 中的位置生成 ID
        const rect = element.getBoundingClientRect();
        const text = element.textContent.trim().substring(0, 20);
        const hash = this.simpleHash(text + rect.top + rect.left);
        
        return `element_${hash}`;
    }
    
    /**
     * 簡單雜湊函數
     * @param {string} str - 輸入字串
     * @returns {string} 雜湊值
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
     * 節流函數
     * @param {Function} func - 要節流的函數
     * @param {number} delay - 延遲時間
     * @returns {Function} 節流後的函數
     */
    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        
        return function (...args) {
            const currentTime = Date.now();
            
            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    }
    
    /**
     * 啟動滾動翻譯
     */
    start() {
        if (this.isActive) {
            console.log('滾動翻譯已經啟動');
            return;
        }
        
        this.isActive = true;
        console.log('滾動翻譯已啟動');
        
        // 立即檢查當前視窗
        setTimeout(() => {
            this.handleScroll();
        }, 100);
    }
    
    /**
     * 停止滾動翻譯
     */
    stop() {
        if (!this.isActive) {
            console.log('滾動翻譯已經停止');
            return;
        }
        
        this.isActive = false;
        
        // 清除所有超時
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = null;
        }
        
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }
        
        // 清空佇列
        this.translationQueue.clear();
        this.processingQueue.clear();
        
        console.log('滾動翻譯已停止');
    }
    
    /**
     * 切換滾動翻譯狀態
     */
    toggle() {
        if (this.isActive) {
            this.stop();
        } else {
            this.start();
        }
    }
    
    /**
     * 獲取管理器統計資訊
     * @returns {Object} 統計資訊
     */
    getStats() {
        return {
            ...this.stats,
            isActive: this.isActive,
            isTranslating: this.isTranslating,
            queueSize: this.translationQueue.size,
            processingSize: this.processingQueue.size,
            activeRequests: this.activeRequests.size,
            options: { ...this.options }
        };
    }
    
    /**
     * 更新配置選項
     * @param {Object} newOptions - 新的配置選項
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        
        // 重新設定滾動監聽器（如果節流時間改變）
        if (newOptions.scrollThrottle !== undefined) {
            this.setupScrollListener();
        }
        
        console.log('滾動翻譯配置已更新:', newOptions);
    }
    
    /**
     * 銷毀管理器
     */
    destroy() {
        // 停止翻譯
        this.stop();
        
        // 移除事件監聽器
        if (this.scrollHandler) {
            window.removeEventListener('scroll', this.scrollHandler);
            this.scrollHandler = null;
        }
        
        // 清理組件引用
        this.boundaryDetector = null;
        this.translationRenderer = null;
        this.apiManager = null;
        
        console.log('視窗翻譯管理器已銷毀');
    }
}

// 匯出類別
window.ViewportTranslationManager = ViewportTranslationManager;