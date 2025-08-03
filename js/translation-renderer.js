/**
 * 翻譯渲染器 - 負責將翻譯結果渲染到網頁上
 * Translation Renderer - Responsible for rendering translation results on web pages
 */

class TranslationRenderer {
    constructor(options = {}) {
        this.options = {
            position: 'below', // 'below', 'inline', 'tooltip'
            showOriginal: true,
            animationDuration: 300,
            maxWidth: '100%',
            ...options
        };
        
        // 渲染的翻譯元素追蹤
        this.renderedTranslations = new Map();
        this.loadingElements = new Map();
        this.errorElements = new Map();
        
        // 樣式注入狀態
        this.stylesInjected = false;
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化渲染器
     */
    init() {
        this.injectStyles();
        this.setupEventListeners();
        console.log('翻譯渲染器初始化完成');
    }
    
    /**
     * 注入必要的CSS樣式
     */
    injectStyles() {
        if (this.stylesInjected) return;
        
        // 檢查是否已經有翻譯樣式
        if (document.querySelector('#translation-renderer-styles')) return;
        
        const styleElement = document.createElement('style');
        styleElement.id = 'translation-renderer-styles';
        styleElement.textContent = `
            /* 翻譯渲染器樣式 */
            .translation-container {
                position: relative !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            
            .translation-content {
                display: block !important;
                margin: 8px 0 !important;
                padding: 12px 16px !important;
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%) !important;
                border-left: 4px solid #007bff !important;
                border-radius: 0 8px 8px 0 !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif !important;
                font-size: 14px !important;
                line-height: 1.6 !important;
                color: #495057 !important;
                box-shadow: 0 2px 8px rgba(0, 123, 255, 0.1) !important;
                transition: all 0.3s ease !important;
                opacity: 0 !important;
                transform: translateY(-10px) !important;
                max-width: 100% !important;
                box-sizing: border-box !important;
                word-wrap: break-word !important;
                overflow-wrap: break-word !important;
            }
            
            .translation-content.show {
                opacity: 1 !important;
                transform: translateY(0) !important;
            }
            
            .translation-content:hover {
                box-shadow: 0 4px 12px rgba(0, 123, 255, 0.2) !important;
                transform: translateX(2px) !important;
            }
            
            .translation-content::before {
                content: '🌐' !important;
                position: absolute !important;
                top: 8px !important;
                right: 12px !important;
                font-size: 12px !important;
                opacity: 0.6 !important;
            }
            
            /* 優先級樣式 */
            .translation-content.priority-high {
                border-left-color: #28a745 !important;
                background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%) !important;
            }
            
            .translation-content.priority-medium {
                border-left-color: #ffc107 !important;
                background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%) !important;
            }
            
            .translation-content.priority-low {
                border-left-color: #6c757d !important;
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%) !important;
            }
            
            /* 載入狀態 */
            .translation-loading {
                display: inline-flex !important;
                align-items: center !important;
                gap: 8px !important;
                color: #6c757d !important;
                font-style: italic !important;
                padding: 8px 12px !important;
                background: linear-gradient(90deg, #e9ecef 0%, #f8f9fa 50%, #e9ecef 100%) !important;
                background-size: 200% 100% !important;
                animation: shimmer 2s infinite !important;
                border-radius: 4px !important;
                font-size: 12px !important;
                margin: 4px 0 !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
            }
            
            .translation-loading::after {
                content: '' !important;
                width: 12px !important;
                height: 12px !important;
                border: 2px solid #dee2e6 !important;
                border-top: 2px solid #007bff !important;
                border-radius: 50% !important;
                animation: spin 1s linear infinite !important;
            }
            
            /* 錯誤狀態 */
            .translation-error {
                background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%) !important;
                border-left-color: #dc3545 !important;
                color: #721c24 !important;
                position: relative !important;
            }
            
            .translation-error::before {
                content: '⚠️' !important;
            }
            
            .translation-retry {
                background-color: #dc3545 !important;
                color: white !important;
                border: none !important;
                border-radius: 4px !important;
                padding: 4px 8px !important;
                font-size: 11px !important;
                cursor: pointer !important;
                margin-left: 8px !important;
                transition: all 0.2s !important;
            }
            
            .translation-retry:hover {
                background-color: #c82333 !important;
                transform: scale(1.05) !important;
            }
            
            /* 隱藏狀態 */
            .translation-hidden {
                display: none !important;
            }
            
            /* 內聯模式 */
            .translation-content.inline {
                display: inline !important;
                margin: 0 4px !important;
                padding: 2px 6px !important;
                font-size: 13px !important;
                border-radius: 3px !important;
                background: rgba(0, 123, 255, 0.1) !important;
                border: 1px solid rgba(0, 123, 255, 0.2) !important;
                border-left: none !important;
            }
            
            /* 工具提示模式 */
            .translation-tooltip {
                position: absolute !important;
                z-index: 10000 !important;
                background: rgba(0, 0, 0, 0.9) !important;
                color: white !important;
                padding: 8px 12px !important;
                border-radius: 6px !important;
                font-size: 13px !important;
                max-width: 300px !important;
                word-wrap: break-word !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
                opacity: 0 !important;
                visibility: hidden !important;
                transition: all 0.3s ease !important;
                pointer-events: none !important;
            }
            
            .translation-tooltip.show {
                opacity: 1 !important;
                visibility: visible !important;
            }
            
            .translation-tooltip::after {
                content: '' !important;
                position: absolute !important;
                top: 100% !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                border: 6px solid transparent !important;
                border-top-color: rgba(0, 0, 0, 0.9) !important;
            }
            
            /* 動畫 */
            @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }
            
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            @keyframes fadeIn {
                from { 
                    opacity: 0 !important;
                    transform: translateY(-10px) !important;
                }
                to { 
                    opacity: 1 !important;
                    transform: translateY(0) !important;
                }
            }
            
            /* 響應式設計 */
            @media (max-width: 768px) {
                .translation-content {
                    font-size: 13px !important;
                    padding: 10px 12px !important;
                    margin: 6px 0 !important;
                }
                
                .translation-tooltip {
                    max-width: 250px !important;
                    font-size: 12px !important;
                }
            }
            
            /* 深色模式支援 */
            @media (prefers-color-scheme: dark) {
                .translation-content {
                    background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%) !important;
                    color: #e2e8f0 !important;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
                }
                
                .translation-loading {
                    background: linear-gradient(90deg, #4a5568 0%, #2d3748 50%, #4a5568 100%) !important;
                    color: #a0aec0 !important;
                }
            }
        `;
        
        document.head.appendChild(styleElement);
        this.stylesInjected = true;
    }
    
    /**
     * 設定事件監聽器
     */
    setupEventListeners() {
        // 監聽頁面滾動，更新工具提示位置
        document.addEventListener('scroll', this.updateTooltipPositions.bind(this), { passive: true });
        
        // 監聽視窗大小變化
        window.addEventListener('resize', this.updateTooltipPositions.bind(this), { passive: true });
    }
    
    /**
     * 渲染翻譯內容
     * @param {Object} segment - 文本段落
     * @param {Object} translation - 翻譯結果
     * @param {Object} options - 渲染選項
     */
    renderTranslation(segment, translation, options = {}) {
        try {
            // 移除載入指示器
            this.removeLoadingIndicator(segment.id);
            
            // 檢查是否已經渲染過
            if (this.renderedTranslations.has(segment.id)) {
                this.updateTranslation(segment.id, translation);
                return;
            }
            
            const renderOptions = { ...this.options, ...options };
            
            // 根據位置模式渲染
            switch (renderOptions.position) {
                case 'inline':
                    this.renderInlineTranslation(segment, translation, renderOptions);
                    break;
                case 'tooltip':
                    this.renderTooltipTranslation(segment, translation, renderOptions);
                    break;
                case 'below':
                default:
                    this.renderBelowTranslation(segment, translation, renderOptions);
                    break;
            }
            
            console.log(`翻譯渲染完成: ${segment.id}`);
            
        } catch (error) {
            console.error('渲染翻譯失敗:', error);
            this.renderError(segment, error.message);
        }
    }
    
    /**
     * 在下方渲染翻譯（預設模式）
     * @param {Object} segment - 文本段落
     * @param {Object} translation - 翻譯結果
     * @param {Object} options - 渲染選項
     */
    renderBelowTranslation(segment, translation, options) {
        const translationElement = document.createElement('div');
        translationElement.className = `translation-content priority-${segment.priority}`;
        translationElement.setAttribute('data-segment-id', segment.id);
        translationElement.setAttribute('data-translation-id', `trans_${segment.id}`);
        
        // 設定翻譯內容 - 只顯示翻譯文本，原文已在網頁上
        translationElement.innerHTML = `
            <div class="translation-text">${translation.translatedText}</div>
        `;
        
        // 添加元數據
        translationElement.title = `翻譯提供者: ${translation.provider} | Token使用: ${translation.tokensUsed}`;
        
        // 插入到DOM中
        this.insertTranslationElement(segment.element, translationElement);
        
        // 添加動畫
        setTimeout(() => {
            translationElement.classList.add('show');
        }, 10);
        
        // 記錄渲染的翻譯
        this.renderedTranslations.set(segment.id, {
            element: translationElement,
            segment: segment,
            translation: translation,
            type: 'below'
        });
    }
    
    /**
     * 內聯渲染翻譯
     * @param {Object} segment - 文本段落
     * @param {Object} translation - 翻譯結果
     * @param {Object} options - 渲染選項
     */
    renderInlineTranslation(segment, translation, options) {
        const translationElement = document.createElement('span');
        translationElement.className = `translation-content inline priority-${segment.priority}`;
        translationElement.setAttribute('data-segment-id', segment.id);
        translationElement.textContent = ` [${translation.translatedText}]`;
        translationElement.title = `翻譯: ${translation.translatedText}`;
        
        // 插入到文本節點後
        const textNode = this.findTextNode(segment.element, segment.text);
        if (textNode && textNode.parentNode) {
            textNode.parentNode.insertBefore(translationElement, textNode.nextSibling);
        } else {
            segment.element.appendChild(translationElement);
        }
        
        // 記錄渲染的翻譯
        this.renderedTranslations.set(segment.id, {
            element: translationElement,
            segment: segment,
            translation: translation,
            type: 'inline'
        });
    }
    
    /**
     * 工具提示渲染翻譯
     * @param {Object} segment - 文本段落
     * @param {Object} translation - 翻譯結果
     * @param {Object} options - 渲染選項
     */
    renderTooltipTranslation(segment, translation, options) {
        // 為原始元素添加懸停事件
        const originalElement = segment.element;
        originalElement.style.cursor = 'help';
        originalElement.style.borderBottom = '1px dotted #007bff';
        
        // 創建工具提示元素
        const tooltipElement = document.createElement('div');
        tooltipElement.className = 'translation-tooltip';
        tooltipElement.setAttribute('data-segment-id', segment.id);
        tooltipElement.textContent = translation.translatedText;
        
        // 添加到body
        document.body.appendChild(tooltipElement);
        
        // 設定懸停事件
        let showTimeout, hideTimeout;
        
        const showTooltip = (event) => {
            clearTimeout(hideTimeout);
            showTimeout = setTimeout(() => {
                this.positionTooltip(tooltipElement, event.target);
                tooltipElement.classList.add('show');
            }, 300);
        };
        
        const hideTooltip = () => {
            clearTimeout(showTimeout);
            hideTimeout = setTimeout(() => {
                tooltipElement.classList.remove('show');
            }, 100);
        };
        
        originalElement.addEventListener('mouseenter', showTooltip);
        originalElement.addEventListener('mouseleave', hideTooltip);
        
        // 記錄渲染的翻譯
        this.renderedTranslations.set(segment.id, {
            element: tooltipElement,
            segment: segment,
            translation: translation,
            type: 'tooltip',
            originalElement: originalElement,
            showTooltip: showTooltip,
            hideTooltip: hideTooltip
        });
    }
    
    /**
     * 顯示載入指示器
     * @param {Object} segment - 文本段落
     */
    showLoadingIndicator(segment) {
        // 移除現有的載入指示器
        this.removeLoadingIndicator(segment.id);
        
        const loadingElement = document.createElement('div');
        loadingElement.className = 'translation-loading';
        loadingElement.setAttribute('data-segment-id', segment.id);
        loadingElement.textContent = '翻譯中...';
        
        this.insertTranslationElement(segment.element, loadingElement);
        
        // 記錄載入元素
        this.loadingElements.set(segment.id, loadingElement);
    }
    
    /**
     * 移除載入指示器
     * @param {string} segmentId - 段落ID
     */
    removeLoadingIndicator(segmentId) {
        const loadingElement = this.loadingElements.get(segmentId);
        if (loadingElement && loadingElement.parentNode) {
            loadingElement.parentNode.removeChild(loadingElement);
            this.loadingElements.delete(segmentId);
        }
    }
    
    /**
     * 渲染錯誤狀態
     * @param {Object} segment - 文本段落
     * @param {string} errorMessage - 錯誤訊息
     */
    renderError(segment, errorMessage) {
        // 移除載入指示器
        this.removeLoadingIndicator(segment.id);
        
        const errorElement = document.createElement('div');
        errorElement.className = 'translation-content translation-error';
        errorElement.setAttribute('data-segment-id', segment.id);
        
        const retryButton = document.createElement('button');
        retryButton.className = 'translation-retry';
        retryButton.textContent = '重試';
        retryButton.onclick = () => {
            this.retryTranslation(segment);
        };
        
        errorElement.innerHTML = `翻譯失敗: ${errorMessage}`;
        errorElement.appendChild(retryButton);
        
        this.insertTranslationElement(segment.element, errorElement);
        
        // 記錄錯誤元素
        this.errorElements.set(segment.id, errorElement);
    }
    
    /**
     * 插入翻譯元素到適當位置
     * @param {HTMLElement} parentElement - 父元素
     * @param {HTMLElement} translationElement - 翻譯元素
     */
    insertTranslationElement(parentElement, translationElement) {
        // 嘗試在父元素後插入
        if (parentElement.nextSibling) {
            parentElement.parentNode.insertBefore(translationElement, parentElement.nextSibling);
        } else {
            parentElement.parentNode.appendChild(translationElement);
        }
    }
    
    /**
     * 尋找包含特定文本的文本節點
     * @param {HTMLElement} element - 搜尋的元素
     * @param {string} text - 要尋找的文本
     * @returns {Node|null} 文本節點
     */
    findTextNode(element, text) {
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.includes(text)) {
                return node;
            }
        }
        
        return null;
    }
    
    /**
     * 定位工具提示
     * @param {HTMLElement} tooltip - 工具提示元素
     * @param {HTMLElement} target - 目標元素
     */
    positionTooltip(tooltip, target) {
        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let top = rect.bottom + window.scrollY + 10;
        let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipRect.width / 2);
        
        // 確保工具提示不會超出視窗邊界
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }
        
        if (top + tooltipRect.height > window.innerHeight + window.scrollY - 10) {
            top = rect.top + window.scrollY - tooltipRect.height - 10;
        }
        
        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
    }
    
    /**
     * 更新工具提示位置
     */
    updateTooltipPositions() {
        this.renderedTranslations.forEach((data, segmentId) => {
            if (data.type === 'tooltip' && data.element.classList.contains('show')) {
                this.positionTooltip(data.element, data.originalElement);
            }
        });
    }
    
    /**
     * 更新翻譯內容
     * @param {string} segmentId - 段落ID
     * @param {Object} translation - 新的翻譯結果
     */
    updateTranslation(segmentId, translation) {
        const data = this.renderedTranslations.get(segmentId);
        if (!data) return;
        
        if (data.type === 'tooltip') {
            data.element.textContent = translation.translatedText;
        } else if (data.type === 'inline') {
            data.element.textContent = ` [${translation.translatedText}]`;
        } else {
            // below mode
            const textDiv = data.element.querySelector('.translation-text');
            if (textDiv) {
                textDiv.textContent = translation.translatedText;
            } else {
                data.element.textContent = translation.translatedText;
            }
        }
        
        data.translation = translation;
    }
    
    /**
     * 切換翻譯顯示狀態
     * @param {boolean} visible - 是否顯示
     */
    toggleTranslationVisibility(visible) {
        this.renderedTranslations.forEach((data, segmentId) => {
            if (data.type === 'tooltip') {
                data.originalElement.style.display = visible ? '' : 'none';
            } else {
                data.element.classList.toggle('translation-hidden', !visible);
            }
        });
        
        console.log(`翻譯${visible ? '顯示' : '隱藏'}: ${this.renderedTranslations.size}個元素`);
    }
    
    /**
     * 移除所有翻譯
     */
    removeAllTranslations() {
        // 移除渲染的翻譯
        this.renderedTranslations.forEach((data, segmentId) => {
            if (data.element && data.element.parentNode) {
                data.element.parentNode.removeChild(data.element);
            }
            
            // 清理工具提示的事件監聽器
            if (data.type === 'tooltip' && data.originalElement) {
                data.originalElement.removeEventListener('mouseenter', data.showTooltip);
                data.originalElement.removeEventListener('mouseleave', data.hideTooltip);
                data.originalElement.style.cursor = '';
                data.originalElement.style.borderBottom = '';
            }
        });
        
        // 移除載入指示器
        this.loadingElements.forEach((element, segmentId) => {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        
        // 移除錯誤元素
        this.errorElements.forEach((element, segmentId) => {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        
        // 清空記錄
        this.renderedTranslations.clear();
        this.loadingElements.clear();
        this.errorElements.clear();
        
        console.log('所有翻譯已移除');
    }
    
    /**
     * 重試翻譯
     * @param {Object} segment - 文本段落
     */
    retryTranslation(segment) {
        // 移除錯誤元素
        const errorElement = this.errorElements.get(segment.id);
        if (errorElement && errorElement.parentNode) {
            errorElement.parentNode.removeChild(errorElement);
            this.errorElements.delete(segment.id);
        }
        
        // 顯示載入指示器
        this.showLoadingIndicator(segment);
        
        // 觸發重試事件
        const event = new CustomEvent('translationRetry', {
            detail: { segment: segment }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 獲取渲染統計
     * @returns {Object} 統計資訊
     */
    getRenderStats() {
        return {
            totalRendered: this.renderedTranslations.size,
            loading: this.loadingElements.size,
            errors: this.errorElements.size,
            byType: {
                below: Array.from(this.renderedTranslations.values()).filter(d => d.type === 'below').length,
                inline: Array.from(this.renderedTranslations.values()).filter(d => d.type === 'inline').length,
                tooltip: Array.from(this.renderedTranslations.values()).filter(d => d.type === 'tooltip').length
            }
        };
    }
    
    /**
     * 銷毀渲染器
     */
    destroy() {
        this.removeAllTranslations();
        
        // 移除事件監聽器
        document.removeEventListener('scroll', this.updateTooltipPositions.bind(this));
        window.removeEventListener('resize', this.updateTooltipPositions.bind(this));
        
        // 移除樣式
        const styleElement = document.querySelector('#translation-renderer-styles');
        if (styleElement) {
            styleElement.remove();
        }
        
        this.stylesInjected = false;
        console.log('翻譯渲染器已銷毀');
    }
}

// 匯出類別
window.TranslationRenderer = TranslationRenderer;