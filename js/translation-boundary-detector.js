/**
 * 翻譯邊界檢測器 - 負責檢測已翻譯內容的邊界和視窗範圍
 * Translation Boundary Detector - Detects translation boundaries and viewport ranges
 */

class TranslationBoundaryDetector {
    constructor(options = {}) {
        this.options = {
            translationSelector: '.translation-content',
            segmentIdAttribute: 'data-segment-id',
            translationIdAttribute: 'data-translation-id',
            viewportMargin: 100, // 視窗邊界的額外邊距 (px)
            ...options
        };
        
        // 快取機制
        this.boundaryCache = {
            lastBoundary: null,
            lastUpdate: 0,
            cacheTimeout: 1000 // 1秒快取
        };
        
        console.log('翻譯邊界檢測器初始化完成');
    }
    
    /**
     * 檢查元素是否已翻譯
     * @param {HTMLElement} element - 要檢查的元素
     * @returns {boolean} 是否已翻譯
     */
    isElementTranslated(element) {
        if (!element || !element.nodeType === Node.ELEMENT_NODE) {
            return false;
        }
        
        try {
            // 方法1: 檢查元素本身是否為翻譯內容
            if (element.classList.contains('translation-content')) {
                return true;
            }
            
            // 方法2: 檢查是否有翻譯子元素
            const translationChild = element.querySelector(this.options.translationSelector);
            if (translationChild) {
                return true;
            }
            
            // 方法3: 檢查下一個兄弟元素是否為翻譯內容
            const nextSibling = element.nextElementSibling;
            if (nextSibling && nextSibling.classList.contains('translation-content')) {
                // 確認這個翻譯內容確實對應到當前元素
                const segmentId = nextSibling.getAttribute(this.options.segmentIdAttribute);
                if (segmentId) {
                    return true;
                }
            }
            
            // 方法4: 檢查父元素是否包含對應的翻譯內容
            const parent = element.parentElement;
            if (parent) {
                const siblingTranslations = parent.querySelectorAll(this.options.translationSelector);
                for (const translation of siblingTranslations) {
                    const rect1 = element.getBoundingClientRect();
                    const rect2 = translation.getBoundingClientRect();
                    
                    // 如果翻譯元素在原元素附近，認為已翻譯
                    if (Math.abs(rect1.bottom - rect2.top) < 50) {
                        return true;
                    }
                }
            }
            
            return false;
            
        } catch (error) {
            console.warn('檢查元素翻譯狀態時發生錯誤:', error);
            return false;
        }
    }
    
    /**
     * 找到翻譯邊界位置
     * @param {boolean} useCache - 是否使用快取
     * @returns {number|null} 翻譯邊界的 Y 座標，如果沒有翻譯內容則返回 null
     */
    findTranslationBoundary(useCache = true) {
        const now = Date.now();
        
        // 檢查快取
        if (useCache && 
            this.boundaryCache.lastBoundary !== null && 
            (now - this.boundaryCache.lastUpdate) < this.boundaryCache.cacheTimeout) {
            return this.boundaryCache.lastBoundary;
        }
        
        try {
            // 找到所有翻譯元素
            const translationElements = document.querySelectorAll(this.options.translationSelector);
            
            if (translationElements.length === 0) {
                this.boundaryCache.lastBoundary = null;
                this.boundaryCache.lastUpdate = now;
                return null;
            }
            
            // 找到最下方的翻譯元素
            let lowestBoundary = 0;
            let lastTranslationElement = null;
            
            translationElements.forEach(element => {
                const rect = element.getBoundingClientRect();
                const elementBottom = rect.bottom + window.scrollY;
                
                if (elementBottom > lowestBoundary) {
                    lowestBoundary = elementBottom;
                    lastTranslationElement = element;
                }
            });
            
            // 更新快取
            this.boundaryCache.lastBoundary = lowestBoundary;
            this.boundaryCache.lastUpdate = now;
            
            console.log(`翻譯邊界檢測: ${lowestBoundary}px, 最後翻譯元素:`, lastTranslationElement);
            
            return lowestBoundary;
            
        } catch (error) {
            console.error('查找翻譯邊界時發生錯誤:', error);
            return null;
        }
    }
    
    /**
     * 獲取當前視窗範圍
     * @returns {Object} 視窗範圍資訊
     */
    getViewportRange() {
        try {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const viewportHeight = window.innerHeight;
            const margin = this.options.viewportMargin;
            
            return {
                top: Math.max(0, scrollTop - margin),
                bottom: scrollTop + viewportHeight + margin,
                center: scrollTop + viewportHeight / 2,
                height: viewportHeight,
                scrollTop: scrollTop,
                margin: margin
            };
            
        } catch (error) {
            console.error('獲取視窗範圍時發生錯誤:', error);
            return {
                top: 0,
                bottom: window.innerHeight,
                center: window.innerHeight / 2,
                height: window.innerHeight,
                scrollTop: 0,
                margin: 0
            };
        }
    }
    
    /**
     * 檢查元素是否在視窗範圍內
     * @param {HTMLElement} element - 要檢查的元素
     * @param {Object} viewportRange - 視窗範圍 (可選，不提供則自動計算)
     * @returns {boolean} 是否在視窗內
     */
    isElementInViewport(element, viewportRange = null) {
        if (!element) return false;
        
        try {
            const viewport = viewportRange || this.getViewportRange();
            const rect = element.getBoundingClientRect();
            const elementTop = rect.top + window.scrollY;
            const elementBottom = rect.bottom + window.scrollY;
            
            // 檢查元素是否與視窗範圍有重疊
            return !(elementBottom < viewport.top || elementTop > viewport.bottom);
            
        } catch (error) {
            console.warn('檢查元素視窗位置時發生錯誤:', error);
            return false;
        }
    }
    
    /**
     * 獲取需要翻譯的視窗範圍
     * @returns {Object} 需要翻譯的範圍資訊
     */
    getTranslationRange() {
        try {
            const viewport = this.getViewportRange();
            const translationBoundary = this.findTranslationBoundary();
            
            let startY, endY;
            
            if (translationBoundary === null) {
                // 沒有翻譯內容，從視窗頂部開始
                startY = viewport.top;
            } else {
                // 有翻譯內容，從翻譯邊界和視窗頂部的較大值開始
                startY = Math.max(translationBoundary, viewport.top);
            }
            
            endY = viewport.bottom;
            
            return {
                startY: startY,
                endY: endY,
                height: Math.max(0, endY - startY),
                hasExistingTranslations: translationBoundary !== null,
                translationBoundary: translationBoundary,
                viewport: viewport
            };
            
        } catch (error) {
            console.error('獲取翻譯範圍時發生錯誤:', error);
            const viewport = this.getViewportRange();
            return {
                startY: viewport.top,
                endY: viewport.bottom,
                height: viewport.height,
                hasExistingTranslations: false,
                translationBoundary: null,
                viewport: viewport
            };
        }
    }
    
    /**
     * 找到指定範圍內的文本元素
     * @param {number} startY - 開始 Y 座標
     * @param {number} endY - 結束 Y 座標
     * @param {Object} options - 選項
     * @returns {Array} 文本元素陣列
     */
    findTextElementsInRange(startY, endY, options = {}) {
        const config = {
            excludeTranslated: true,
            minTextLength: 10,
            excludeSelectors: [
                '.translation-content',
                'script',
                'style',
                'noscript',
                '.ad',
                '.advertisement',
                '[data-ad]'
            ],
            ...options
        };
        
        try {
            const elements = [];
            const textNodes = this.findTextNodes(document.body);
            
            textNodes.forEach(node => {
                const element = node.parentElement;
                if (!element) return;
                
                // 檢查是否在指定範圍內
                const rect = element.getBoundingClientRect();
                const elementTop = rect.top + window.scrollY;
                const elementBottom = rect.bottom + window.scrollY;
                
                // 元素必須與指定範圍有重疊
                if (elementBottom < startY || elementTop > endY) {
                    return;
                }
                
                // 檢查文本長度
                const text = node.textContent.trim();
                if (text.length < config.minTextLength) {
                    return;
                }
                
                // 檢查是否為排除的選擇器
                if (config.excludeSelectors.some(selector => {
                    try {
                        return element.matches(selector) || element.closest(selector);
                    } catch (e) {
                        return false;
                    }
                })) {
                    return;
                }
                
                // 檢查是否已翻譯
                if (config.excludeTranslated && this.isElementTranslated(element)) {
                    return;
                }
                
                // 避免重複添加同一個元素
                if (!elements.find(item => item.element === element)) {
                    elements.push({
                        element: element,
                        textNode: node,
                        text: text,
                        rect: rect,
                        y: elementTop
                    });
                }
            });
            
            // 按 Y 座標排序
            elements.sort((a, b) => a.y - b.y);
            
            console.log(`在範圍 ${startY}-${endY} 找到 ${elements.length} 個文本元素`);
            
            return elements;
            
        } catch (error) {
            console.error('查找範圍內文本元素時發生錯誤:', error);
            return [];
        }
    }
    
    /**
     * 找到所有文本節點
     * @param {HTMLElement} root - 根元素
     * @returns {Array} 文本節點陣列
     */
    findTextNodes(root) {
        const textNodes = [];
        
        try {
            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => {
                        // 過濾掉空白和很短的文本
                        const text = node.textContent.trim();
                        if (text.length < 5) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        
                        // 過濾掉腳本和樣式內的文本
                        const parent = node.parentElement;
                        if (parent) {
                            const tagName = parent.tagName.toLowerCase();
                            if (['script', 'style', 'noscript'].includes(tagName)) {
                                return NodeFilter.FILTER_REJECT;
                            }
                        }
                        
                        return NodeFilter.FILTER_ACCEPT;
                    }
                },
                false
            );
            
            let node;
            while (node = walker.nextNode()) {
                textNodes.push(node);
            }
            
        } catch (error) {
            console.error('查找文本節點時發生錯誤:', error);
        }
        
        return textNodes;
    }
    
    /**
     * 清除邊界快取
     */
    clearBoundaryCache() {
        this.boundaryCache.lastBoundary = null;
        this.boundaryCache.lastUpdate = 0;
        console.log('翻譯邊界快取已清除');
    }
    
    /**
     * 獲取檢測統計資訊
     * @returns {Object} 統計資訊
     */
    getDetectionStats() {
        try {
            const translationElements = document.querySelectorAll(this.options.translationSelector);
            const viewport = this.getViewportRange();
            const translationRange = this.getTranslationRange();
            
            return {
                totalTranslations: translationElements.length,
                translationBoundary: this.findTranslationBoundary(),
                viewport: {
                    top: viewport.top,
                    bottom: viewport.bottom,
                    height: viewport.height
                },
                translationRange: {
                    startY: translationRange.startY,
                    endY: translationRange.endY,
                    height: translationRange.height
                },
                cacheStatus: {
                    hasCachedBoundary: this.boundaryCache.lastBoundary !== null,
                    cacheAge: Date.now() - this.boundaryCache.lastUpdate
                }
            };
            
        } catch (error) {
            console.error('獲取檢測統計時發生錯誤:', error);
            return {
                totalTranslations: 0,
                translationBoundary: null,
                viewport: null,
                translationRange: null,
                cacheStatus: null
            };
        }
    }
    
    /**
     * 銷毀檢測器
     */
    destroy() {
        this.clearBoundaryCache();
        console.log('翻譯邊界檢測器已銷毀');
    }
}

// 匯出類別
window.TranslationBoundaryDetector = TranslationBoundaryDetector;