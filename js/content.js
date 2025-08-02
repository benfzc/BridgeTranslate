// Content Script
// 在網頁中注入翻譯功能

class WebTranslationContent {
    constructor() {
        this.isTranslating = false;
        this.translationVisible = false;
        this.buttonManager = null;
        this.contentAnalyzer = null;
        this.translationRenderer = null;
        this.progressIndicator = null;
        this.settings = null;
        this.currentSegments = [];
        
        this.init();
    }

    async init() {
        // 載入必要的腳本
        await this.loadRequiredScripts();
        
        // 載入設定
        await this.loadSettings();
        
        // 創建翻譯按鈕管理器
        this.createButtonManager();
        
        // 監聽來自 popup 的訊息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });

        console.log('Web Translation Extension loaded');
    }

    async loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
            if (response.success) {
                this.settings = response.data;
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.settings = this.getDefaultSettings();
        }
    }

    getDefaultSettings() {
        return {
            apiProvider: '',
            apiKey: '',
            targetLanguage: 'zh-TW',
            showOriginalText: true,
            autoTranslateVisible: false,
            translationPosition: 'below'
        };
    }

    /**
     * 載入必要的腳本文件
     */
    async loadRequiredScripts() {
        return new Promise((resolve) => {
            // 載入所有必要的腳本
            const scripts = [
                'js/models.js',
                'js/content-analyzer.js',
                'js/translation-renderer.js',
                'js/translation-button.js',
                'js/button-manager.js'
            ];
            
            let loadedCount = 0;
            
            scripts.forEach(scriptPath => {
                const script = document.createElement('script');
                script.src = chrome.runtime.getURL(scriptPath);
                script.onload = () => {
                    loadedCount++;
                    if (loadedCount === scripts.length) {
                        resolve();
                    }
                };
                script.onerror = () => {
                    console.error(`載入腳本失敗: ${scriptPath}`);
                    loadedCount++;
                    if (loadedCount === scripts.length) {
                        resolve();
                    }
                };
                document.head.appendChild(script);
            });
        });
    }

    /**
     * 創建翻譯按鈕管理器
     */
    createButtonManager() {
        try {
            // 檢查是否已存在按鈕管理器
            if (this.buttonManager) {
                this.buttonManager.destroy();
            }
            
            // 創建內容分析器
            this.contentAnalyzer = new ContentAnalyzer();
            
            // 創建翻譯渲染器
            this.translationRenderer = new TranslationRenderer({
                position: this.settings?.translationPreferences?.translationPosition || 'below',
                showOriginal: this.settings?.translationPreferences?.showOriginalText !== false
            });
            
            // 創建新的按鈕管理器
            this.buttonManager = new TranslationButtonManager();
            
            // 監聽翻譯按鈕事件
            this.attachButtonEvents();
            
            // 監聽翻譯渲染器事件
            this.attachRendererEvents();
            
        } catch (error) {
            console.error('創建翻譯按鈕管理器失敗:', error);
            // 降級到簡單按鈕
            this.createSimpleButton();
        }
    }
    
    /**
     * 附加按鈕事件監聽器
     */
    attachButtonEvents() {
        // 監聽翻譯開始事件
        document.addEventListener('translationButton:translationStart', async (event) => {
            await this.startTranslation();
        });
        
        // 監聽翻譯切換事件
        document.addEventListener('translationButton:translationToggle', (event) => {
            this.toggleTranslationVisibility();
        });
        
        // 監聽翻譯重試事件
        document.addEventListener('translationButton:translationRetry', async (event) => {
            await this.startTranslation();
        });
    }
    
    /**
     * 附加渲染器事件監聽器
     */
    attachRendererEvents() {
        // 監聽重試翻譯事件
        document.addEventListener('translationRetry', async (event) => {
            const segment = event.detail.segment;
            await this.retrySegmentTranslation(segment);
        });
    }
    
    /**
     * 創建簡單按鈕（降級方案）
     */
    createSimpleButton() {
        const button = document.createElement('button');
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            border: none;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 24px;
            cursor: pointer;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        button.innerHTML = '🌐';
        button.title = '點擊開始翻譯';
        button.addEventListener('click', () => this.toggleTranslation());
        
        document.body.appendChild(button);
        this.simpleButton = button;
    }

    async toggleTranslation() {
        if (this.isTranslating) {
            return; // 正在翻譯中，忽略點擊
        }

        if (this.translationVisible) {
            this.hideTranslations();
        } else {
            await this.startTranslation();
        }
    }

    async startTranslation() {
        // 檢查是否已設定 API
        if (!this.settings.apiConfiguration?.provider || !this.settings.apiConfiguration?.apiKey) {
            this.showError('請先在設定中配置 AI 翻譯服務');
            if (this.buttonManager) {
                this.buttonManager.onTranslationError('請先配置 AI 翻譯服務');
            }
            return;
        }

        this.isTranslating = true;

        try {
            // 分析頁面內容
            const textSegments = this.analyzePageContent();
            console.log(`Found ${textSegments.length} text segments to translate`);

            if (textSegments.length === 0) {
                throw new Error('未找到可翻譯的英文內容');
            }

            // 開始翻譯
            await this.translateSegments(textSegments);

            this.translationVisible = true;
            if (this.buttonManager) {
                this.buttonManager.onTranslationComplete();
            }

        } catch (error) {
            console.error('Translation failed:', error);
            if (this.buttonManager) {
                this.buttonManager.onTranslationError(error.message);
            }
            this.showError('翻譯失敗：' + error.message);
        } finally {
            this.isTranslating = false;
        }
    }

    /**
     * 分析頁面內容
     * @returns {TextSegment[]} 文本段落陣列
     */
    analyzePageContent() {
        try {
            if (!this.contentAnalyzer) {
                console.warn('內容分析器未初始化，使用降級方案');
                return this.fallbackAnalyzeContent();
            }
            
            // 使用新的內容分析器
            const segments = this.contentAnalyzer.analyzePageContent();
            
            // 儲存當前段落供後續使用
            this.currentSegments = segments;
            
            // 顯示分析統計
            const stats = this.contentAnalyzer.getAnalysisStats(segments);
            console.log('內容分析統計:', stats);
            
            return segments;
            
        } catch (error) {
            console.error('內容分析失敗，使用降級方案:', error);
            return this.fallbackAnalyzeContent();
        }
    }
    
    /**
     * 降級的內容分析方法
     * @returns {TextSegment[]} 文本段落陣列
     */
    fallbackAnalyzeContent() {
        const textSegments = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    if (this.shouldSkipNode(node)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let node;
        let segmentId = 0;
        
        while (node = walker.nextNode()) {
            const text = node.textContent.trim();
            if (text.length > 10 && this.isEnglishText(text)) {
                textSegments.push({
                    id: `segment-${segmentId++}`,
                    text: text,
                    element: node.parentElement,
                    node: node,
                    priority: this.getContentPriority(node.parentElement),
                    type: this.getContentType(node.parentElement),
                    isVisible: this.isElementVisible(node.parentElement)
                });
            }
        }

        // 按優先級排序
        return textSegments.sort((a, b) => {
            const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    shouldSkipNode(node) {
        const element = node.parentElement;
        if (!element) return true;

        // 跳過腳本、樣式、隱藏元素等
        const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK'];
        if (skipTags.includes(element.tagName)) {
            return true;
        }

        // 跳過已經有翻譯的元素
        if (element.querySelector('.translation-content')) {
            return true;
        }

        // 跳過我們自己的 UI 元素
        if (element.closest('.web-translation-button, .translation-content, .translation-progress')) {
            return true;
        }

        return false;
    }

    isEnglishText(text) {
        // 簡單的英文檢測
        const englishPattern = /[a-zA-Z]/;
        const chinesePattern = /[\u4e00-\u9fff]/;
        
        return englishPattern.test(text) && !chinesePattern.test(text);
    }

    getContentPriority(element) {
        const tagName = element.tagName.toLowerCase();
        
        if (['h1', 'h2', 'h3', 'title'].includes(tagName)) {
            return 'high';
        } else if (['h4', 'h5', 'h6', 'p', 'li'].includes(tagName)) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    getContentType(element) {
        const tagName = element.tagName.toLowerCase();
        
        if (tagName.startsWith('h')) {
            return 'title';
        } else if (tagName === 'p') {
            return 'paragraph';
        } else if (tagName === 'li') {
            return 'list';
        } else {
            return 'other';
        }
    }

    isElementVisible(element) {
        const rect = element.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
    }

    async translateSegments(segments) {
        const total = segments.length;
        let completed = 0;

        for (const segment of segments) {
            try {
                // 顯示載入狀態
                if (this.translationRenderer) {
                    this.translationRenderer.showLoadingIndicator(segment);
                }

                // 發送翻譯請求
                const response = await chrome.runtime.sendMessage({
                    type: 'TRANSLATE_TEXT',
                    text: segment.text,
                    provider: this.settings.apiConfiguration?.provider,
                    options: {
                        targetLanguage: this.settings.translationPreferences?.targetLanguage
                    }
                });

                if (response.success) {
                    // 使用翻譯渲染器渲染結果
                    if (this.translationRenderer) {
                        this.translationRenderer.renderTranslation(segment, response.translation);
                    } else {
                        // 降級方案
                        this.renderTranslationFallback(segment, response.translation);
                    }
                } else {
                    // 顯示錯誤
                    if (this.translationRenderer) {
                        this.translationRenderer.renderError(segment, response.error);
                    } else {
                        this.showErrorForSegmentFallback(segment, response.error);
                    }
                }

                completed++;
                const progress = (completed / total) * 100;
                
                // 更新按鈕管理器的進度
                if (this.buttonManager) {
                    this.buttonManager.updateProgress(progress, `翻譯進度 ${completed}/${total}`);
                }

                // 短暫延遲避免 API 限制
                await this.delay(100);

            } catch (error) {
                console.error('Failed to translate segment:', error);
                if (this.translationRenderer) {
                    this.translationRenderer.renderError(segment, error.message);
                } else {
                    this.showErrorForSegmentFallback(segment, error.message);
                }
            }
        }
    }

    showLoadingForSegment(segment) {
        const loadingElement = document.createElement('div');
        loadingElement.className = 'translation-loading';
        loadingElement.textContent = '翻譯中...';
        loadingElement.setAttribute('data-segment-id', segment.id);

        segment.element.appendChild(loadingElement);
    }

    renderTranslation(segment, translation) {
        // 移除載入指示器
        const loadingElement = segment.element.querySelector(`[data-segment-id="${segment.id}"]`);
        if (loadingElement) {
            loadingElement.remove();
        }

        // 創建翻譯內容元素
        const translationElement = document.createElement('div');
        translationElement.className = `web-translation-content priority-${segment.priority}`;
        translationElement.setAttribute('data-segment-id', segment.id);
        translationElement.textContent = translation.translatedText;

        segment.element.appendChild(translationElement);

        // 添加淡入動畫
        setTimeout(() => {
            translationElement.classList.add('web-translation-fade-in');
        }, 10);
    }

    showErrorForSegment(segment, error) {
        // 移除載入指示器
        const loadingElement = segment.element.querySelector(`[data-segment-id="${segment.id}"]`);
        if (loadingElement) {
            loadingElement.remove();
        }

        // 創建錯誤元素
        const errorElement = document.createElement('div');
        errorElement.className = 'web-translation-content web-translation-error';
        errorElement.setAttribute('data-segment-id', segment.id);
        errorElement.innerHTML = `翻譯失敗 <button class="web-translation-retry" onclick="this.parentElement.remove()">重試</button>`;

        segment.element.appendChild(errorElement);
    }

    /**
     * 切換翻譯顯示狀態
     */
    toggleTranslationVisibility() {
        this.translationVisible = !this.translationVisible;
        
        if (this.translationRenderer) {
            this.translationRenderer.toggleTranslationVisibility(this.translationVisible);
        } else {
            // 降級方案
            this.toggleTranslationVisibilityFallback(this.translationVisible);
        }
    }

    /**
     * 降級的翻譯顯示切換
     * @param {boolean} visible - 是否顯示
     */
    toggleTranslationVisibilityFallback(visible) {
        const translations = document.querySelectorAll('.web-translation-content, .translation-content');
        translations.forEach(element => {
            element.classList.toggle('web-translation-hidden', !visible);
        });
    }

    /**
     * 更新簡單按鈕狀態（降級方案）
     */
    updateSimpleButtonState(state) {
        if (!this.simpleButton) return;

        switch (state) {
            case 'idle':
                this.simpleButton.innerHTML = '🌐';
                this.simpleButton.title = '點擊開始翻譯';
                this.simpleButton.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                break;
            case 'translating':
                this.simpleButton.innerHTML = '⏳';
                this.simpleButton.title = '翻譯中...';
                this.simpleButton.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
                break;
            case 'completed':
                this.simpleButton.innerHTML = '✅';
                this.simpleButton.title = '點擊隱藏翻譯';
                this.simpleButton.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
                break;
            case 'error':
                this.simpleButton.innerHTML = '❌';
                this.simpleButton.title = '翻譯失敗，點擊重試';
                this.simpleButton.style.background = 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)';
                break;
        }
    }

    showProgressIndicator() {
        if (this.progressIndicator) return;

        this.progressIndicator = document.createElement('div');
        this.progressIndicator.className = 'translation-progress';
        this.progressIndicator.innerHTML = `
            <div>翻譯進度</div>
            <div class="translation-progress-bar">
                <div class="translation-progress-fill"></div>
            </div>
        `;

        document.body.appendChild(this.progressIndicator);
    }

    updateProgress(percentage) {
        if (!this.progressIndicator) return;

        const progressFill = this.progressIndicator.querySelector('.translation-progress-fill');
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
    }

    hideProgressIndicator() {
        if (this.progressIndicator) {
            this.progressIndicator.remove();
            this.progressIndicator = null;
        }
    }

    showError(message) {
        // 簡單的錯誤提示
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: #f8d7da;
            color: #721c24;
            padding: 12px 16px;
            border-radius: 4px;
            border: 1px solid #f5c6cb;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            max-width: 300px;
        `;
        errorDiv.textContent = message;

        document.body.appendChild(errorDiv);

        // 3秒後自動移除
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }

    handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'TOGGLE_TRANSLATION':
                this.toggleTranslation();
                sendResponse({ success: true });
                break;
            case 'GET_TRANSLATION_STATUS':
                sendResponse({
                    success: true,
                    isTranslating: this.isTranslating,
                    translationVisible: this.translationVisible
                });
                break;
        }
    }

    /**
     * 獲取可見區域的內容
     * @returns {TextSegment[]} 可見區域的文本段落
     */
    getVisibleContent() {
        if (this.contentAnalyzer && this.currentSegments.length > 0) {
            // 更新可見性狀態
            this.contentAnalyzer.updateVisibilityStatus(this.currentSegments);
            return this.contentAnalyzer.getVisibleContent(this.currentSegments);
        }
        return [];
    }
    
    /**
     * 獲取高優先級內容
     * @returns {TextSegment[]} 高優先級文本段落
     */
    getHighPriorityContent() {
        return this.currentSegments.filter(segment => segment.priority === 'high');
    }
    
    /**
     * 重新分析頁面內容（用於動態內容）
     */
    reanalyzeContent() {
        console.log('重新分析頁面內容...');
        this.currentSegments = this.analyzePageContent();
    }
    
    /**
     * 監聽頁面變化（用於動態內容檢測）
     */
    observePageChanges() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        
        this.mutationObserver = new MutationObserver((mutations) => {
            let shouldReanalyze = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // 檢查是否有新的文本內容添加
                    for (let node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE && node.textContent.trim()) {
                            shouldReanalyze = true;
                            break;
                        }
                    }
                }
            });
            
            if (shouldReanalyze) {
                // 延遲重新分析，避免頻繁觸發
                clearTimeout(this.reanalyzeTimeout);
                this.reanalyzeTimeout = setTimeout(() => {
                    this.reanalyzeContent();
                }, 1000);
            }
        });
        
        // 開始觀察
        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    /**
     * 停止觀察頁面變化
     */
    stopObservingPageChanges() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
        
        if (this.reanalyzeTimeout) {
            clearTimeout(this.reanalyzeTimeout);
            this.reanalyzeTimeout = null;
        }
    }

    /**
     * 重試單個段落的翻譯
     * @param {Object} segment - 文本段落
     */
    async retrySegmentTranslation(segment) {
        try {
            // 顯示載入狀態
            if (this.translationRenderer) {
                this.translationRenderer.showLoadingIndicator(segment);
            }

            // 發送翻譯請求
            const response = await chrome.runtime.sendMessage({
                type: 'TRANSLATE_TEXT',
                text: segment.text,
                provider: this.settings.apiConfiguration?.provider,
                options: {
                    targetLanguage: this.settings.translationPreferences?.targetLanguage
                }
            });

            if (response.success) {
                if (this.translationRenderer) {
                    this.translationRenderer.renderTranslation(segment, response.translation);
                }
            } else {
                if (this.translationRenderer) {
                    this.translationRenderer.renderError(segment, response.error);
                }
            }

        } catch (error) {
            console.error('重試翻譯失敗:', error);
            if (this.translationRenderer) {
                this.translationRenderer.renderError(segment, error.message);
            }
        }
    }

    /**
     * 降級的翻譯渲染方案
     * @param {Object} segment - 文本段落
     * @param {Object} translation - 翻譯結果
     */
    renderTranslationFallback(segment, translation) {
        // 移除載入指示器
        const loadingElement = segment.element.querySelector(`[data-segment-id="${segment.id}"]`);
        if (loadingElement) {
            loadingElement.remove();
        }

        // 創建翻譯內容元素
        const translationElement = document.createElement('div');
        translationElement.className = `web-translation-content priority-${segment.priority}`;
        translationElement.setAttribute('data-segment-id', segment.id);
        translationElement.textContent = translation.translatedText;

        segment.element.appendChild(translationElement);

        // 添加淡入動畫
        setTimeout(() => {
            translationElement.classList.add('web-translation-fade-in');
        }, 10);
    }

    /**
     * 降級的錯誤顯示方案
     * @param {Object} segment - 文本段落
     * @param {string} error - 錯誤訊息
     */
    showErrorForSegmentFallback(segment, error) {
        // 移除載入指示器
        const loadingElement = segment.element.querySelector(`[data-segment-id="${segment.id}"]`);
        if (loadingElement) {
            loadingElement.remove();
        }

        // 創建錯誤元素
        const errorElement = document.createElement('div');
        errorElement.className = 'web-translation-content web-translation-error';
        errorElement.setAttribute('data-segment-id', segment.id);
        errorElement.innerHTML = `翻譯失敗: ${error} <button class="web-translation-retry" onclick="this.parentElement.remove()">重試</button>`;

        segment.element.appendChild(errorElement);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 初始化內容腳本
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new WebTranslationContent();
    });
} else {
    new WebTranslationContent();
}