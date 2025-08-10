/**
 * 智能翻譯排程管理器
 * Smart Translation Scheduler
 *
 * 負責全頁面內容分析、智能優先級排序和翻譯任務排程
 */

/**
 * 智能翻譯排程管理器
 */
class SmartTranslationScheduler {
    constructor(options = {}) {
        // 依賴組件
        this.contentAnalyzer = options.contentAnalyzer || null;
        this.translationRenderer = options.translationRenderer || null;
        this.translationQueue = options.translationQueue || null;
        this.paragraphTranslator = options.paragraphTranslator || null; // 新增段落翻譯器

        // 配置選項
        this.options = {
            // 翻譯模式配置
            translationMode: 'paragraph', // 'paragraph' | 'sentence' | 'hybrid'

            // 優先級權重配置
            priorityWeights: {
                isInViewport: 100,      // 當前視窗內容最高優先級
                isTitle: 80,            // 標題和重要標頭
                isImportant: 60,        // 重要段落
                documentOrder: 1        // 文檔順序基礎權重
            },

            // 內容過濾配置 - 簡化版本
            maxTextLength: 2000,        // 只限制最大長度，防止API限制
            excludeSelectors: [         // 只排除明確不需要翻譯的選擇器
                // 翻譯系統自身的元素
                '.translation-button-container',
                '.translation-content',
                '.web-translation-content',
                '.web-translation-result',  // 段落翻譯結果
                // 明確標記不翻譯的內容
                '.skip-translation',
                '.no-translate',
                '[translate="no"]'
            ],

            // 處理配置
            batchSize: 50,              // 批次處理大小
            enableDeduplication: true,   // 啟用去重

            // 段落翻譯配置
            paragraphTranslation: {
                enabled: true,
                maxParagraphLength: 1500,
                minParagraphLength: 10,
                splitStrategy: 'sentence'
            },

            ...options
        };

        // 狀態管理
        this.isAnalyzing = false;
        this.isScheduling = false;
        this.analysisResults = null;
        this.scheduledSegments = [];
        this.translationMode = this.options.translationMode;

        // 事件回調
        this.onAnalysisStart = null;
        this.onAnalysisComplete = null;
        this.onSchedulingStart = null;
        this.onSchedulingComplete = null;
        this.onError = null;

        console.log('SmartTranslationScheduler 初始化完成', {
            mode: this.translationMode,
            options: this.options
        });
    }

    /**
     * 排程全頁面翻譯
     * 這是主要的入口函數
     */
    async scheduleFullPageTranslation() {
        try {
            console.log(`開始全頁面翻譯排程 (模式: ${this.translationMode})`);

            // 根據翻譯模式選擇不同的處理策略
            if (this.translationMode === 'paragraph' && this.paragraphTranslator) {
                return await this.scheduleParagraphTranslation();
            } else {
                return await this.scheduleTraditionalTranslation();
            }

        } catch (error) {
            console.error('全頁面翻譯排程失敗:', error);
            if (this.onError) {
                this.onError(error);
            }
            throw error;
        }
    }

    /**
     * 段落級翻譯排程
     */
    async scheduleParagraphTranslation() {
        console.log('使用段落級翻譯模式');

        try {
            // 檢查依賴
            if (!this.contentAnalyzer) {
                throw new Error('ContentAnalyzer 未設定');
            }

            if (!this.paragraphTranslator) {
                throw new Error('ParagraphTranslator 未設定');
            }

            // 1. 檢測段落元素
            console.log('步驟 1: 檢測段落元素');
            const paragraphElements = this.contentAnalyzer.detectParagraphElements();

            if (paragraphElements.length === 0) {
                console.log('未找到可翻譯的段落元素');
                return { mode: 'paragraph', processed: 0, results: [] };
            }

            console.log(`找到 ${paragraphElements.length} 個段落元素`);

            // 2. 按優先級排序段落元素
            console.log('步驟 2: 段落優先級排序');
            const prioritizedElements = this.prioritizeParagraphElements(paragraphElements);

            // 3. 使用段落翻譯器進行翻譯（通過速率限制隊列）
            console.log('步驟 3: 開始段落翻譯');
            const results = [];

            // 將段落加入翻譯隊列
            for (const element of prioritizedElements) {
                const plainText = this.paragraphTranslator.extractParagraphText(element);
                if (this.paragraphTranslator.shouldTranslateParagraph(plainText)) {
                    const segment = {
                        id: `para_${this.paragraphTranslator.simpleHash(plainText)}`,
                        element: element,
                        text: plainText,
                        priority: this.calculateParagraphElementPriority(element, 0),
                        type: 'paragraph'
                    };

                    if (this.translationQueue) {
                        this.translationQueue.enqueue(segment);
                    }
                }
            }

            // 開始處理隊列
            if (this.translationQueue) {
                await this.translationQueue.startProcessing();
            }

            console.log(`段落級翻譯已加入隊列，共 ${prioritizedElements.length} 個段落`);

            // 4. 獲取統計信息（隊列處理完成後會更新）
            const stats = this.paragraphTranslator.getStats();
            console.log('段落翻譯統計:', stats);

            return {
                mode: 'paragraph',
                processed: results.length,
                results: results,
                stats: stats
            };

        } catch (error) {
            console.error('段落級翻譯排程失敗:', error);
            throw error;
        }
    }

    /**
     * 傳統翻譯排程（逐句翻譯）
     */
    async scheduleTraditionalTranslation() {
        console.log('使用傳統翻譯模式（逐句翻譯）');

        try {
            // 檢查依賴
            if (!this.contentAnalyzer) {
                throw new Error('ContentAnalyzer 未設定');
            }

            if (!this.translationQueue) {
                throw new Error('TranslationQueue 未設定');
            }

            // 1. 分析整個頁面內容
            console.log('步驟 1: 分析頁面內容');
            const segments = await this.analyzeFullPage();

            if (segments.length === 0) {
                console.log('未找到可翻譯的內容');
                return { mode: 'traditional', processed: 0, segments: [] };
            }

            console.log(`找到 ${segments.length} 個可翻譯段落`);

            // 2. 智能優先級排序
            console.log('步驟 2: 優先級排序');
            const prioritizedSegments = this.prioritizeSegments(segments);

            // 3. 加入翻譯隊列
            console.log('步驟 3: 加入翻譯隊列');
            await this.scheduleSegments(prioritizedSegments);

            // 4. 開始處理隊列
            console.log('步驟 4: 開始翻譯處理');
            await this.translationQueue.startProcessing();

            console.log('傳統翻譯排程完成');

            return {
                mode: 'traditional',
                processed: prioritizedSegments.length,
                segments: prioritizedSegments
            };

        } catch (error) {
            console.error('傳統翻譯排程失敗:', error);
            throw error;
        }
    }

    /**
     * 分析整個頁面內容
     * @returns {Array} 分析後的文本段落陣列
     */
    async analyzeFullPage() {
        if (this.isAnalyzing) {
            console.log('頁面分析已在進行中');
            return this.analysisResults || [];
        }

        this.isAnalyzing = true;

        try {
            if (this.onAnalysisStart) {
                this.onAnalysisStart();
            }

            console.log('開始分析頁面內容...');

            // 使用 ContentAnalyzer 分析頁面
            const textNodes = this.contentAnalyzer.detectTextNodes();
            console.log(`檢測到 ${textNodes.length} 個文本節點`);

            // 過濾和處理文本節點
            const filteredNodes = this.filterTextNodes(textNodes);
            console.log(`過濾後剩餘 ${filteredNodes.length} 個有效節點`);

            // 轉換為翻譯段落
            const segments = this.convertNodesToSegments(filteredNodes);
            console.log(`轉換為 ${segments.length} 個翻譯段落`);

            // 增強段落資訊
            const enhancedSegments = this.enhanceSegments(segments);

            this.analysisResults = enhancedSegments;

            if (this.onAnalysisComplete) {
                this.onAnalysisComplete(enhancedSegments);
            }

            return enhancedSegments;

        } finally {
            this.isAnalyzing = false;
        }
    }

    /**
     * 過濾文本節點 - 平衡版本，盡量包含更多內容
     * @param {Array} textNodes - 原始文本節點
     * @returns {Array} 過濾後的文本節點
     */
    filterTextNodes(textNodes) {
        return textNodes.filter(node => {
            const text = node.textContent.trim();

            // 排除空文本
            if (!text || text.length === 0) {
                return false;
            }

            // 排除過長的文本（防止API限制）
            if (text.length > this.options.maxTextLength) {
                return false;
            }

            // 檢查是否為特殊HTML元素（代碼、按鈕等）
            if (this.isSpecialElement(node)) {
                return false;
            }

            // 檢查是否已經翻譯過
            if (this.isAlreadyTranslated(node)) {
                return false;
            }

            // 檢查是否為翻譯系統自身的元素
            if (this.isTranslationSystemElement(node)) {
                return false;
            }

            return true;
        });
    }

    /**
     * 檢查是否為特殊HTML元素（基於標籤和結構，而非內容）
     * @param {Node} node - 文本節點
     * @returns {boolean} 是否為特殊元素
     */
    isSpecialElement(node) {
        const element = node.parentElement;
        if (!element) return false;

        let currentElement = element;

        while (currentElement && currentElement !== document.body) {
            const tagName = currentElement.tagName.toLowerCase();

            // 明確不需要翻譯的HTML標籤
            const skipTags = [
                'code', 'pre', 'kbd', 'samp', 'var',  // 代碼相關
                'script', 'style', 'noscript',        // 腳本和樣式
                'button', 'input', 'select', 'textarea', // 表單元素
                'img', 'svg', 'canvas',               // 圖像元素
                'audio', 'video',                     // 媒體元素
                'iframe', 'embed', 'object'           // 嵌入元素
            ];

            if (skipTags.includes(tagName)) {
                return true;
            }

            // 檢查代碼相關的CSS類
            if (currentElement.className) {
                const className = currentElement.className.toLowerCase();
                const codeKeywords = [
                    'code', 'highlight', 'syntax', 'language-',
                    'hljs', 'prettyprint', 'codehilite'
                ];
                if (codeKeywords.some(keyword => className.includes(keyword))) {
                    return true;
                }
            }

            currentElement = currentElement.parentElement;
        }

        return false;
    }

    /**
     * 檢查是否為翻譯系統自身的元素
     * @param {Node} node - 文本節點
     * @returns {boolean} 是否為翻譯系統元素
     */
    isTranslationSystemElement(node) {
        const element = node.parentElement;
        if (!element) return false;

        let currentElement = element;

        while (currentElement && currentElement !== document.body) {
            // 檢查是否為翻譯系統的元素
            if (currentElement.className) {
                const className = currentElement.className.toLowerCase();
                const translationClasses = [
                    'translation-button-container',
                    'translation-content',
                    'web-translation-content',
                    'translation-loading',
                    'translation-error'
                ];

                if (translationClasses.some(cls => className.includes(cls))) {
                    return true;
                }
            }

            // 檢查 translate 屬性
            if (currentElement.getAttribute && currentElement.getAttribute('translate') === 'no') {
                return true;
            }

            currentElement = currentElement.parentElement;
        }

        return false;
    }

    /**
     * 檢查元素是否在排除列表中 - 簡化版本
     * @param {Element} element - DOM 元素
     * @returns {boolean} 是否應該排除
     */
    isExcludedElement(element) {
        if (!element) return false;

        // 只檢查明確的腳本和樣式標籤
        const tagName = element.tagName.toLowerCase();
        if (['script', 'style', 'noscript'].includes(tagName)) {
            return true;
        }

        return false;
    }

    /**
     * 檢查是否已經翻譯過
     * @param {Node} node - DOM 節點 (可能是文本節點或元素節點)
     * @returns {boolean} 是否已翻譯
     */
    isAlreadyTranslated(node) {
        // 如果是文本節點，檢查父元素的下一個兄弟元素
        const elementToCheck = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;

        if (!elementToCheck) return false;

        // 檢查是否有翻譯標記
        const nextSibling = elementToCheck.nextElementSibling;
        return nextSibling && nextSibling.classList && nextSibling.classList.contains('translation-content');
    }

    /**
     * 將文本節點轉換為翻譯段落
     * @param {Array} textNodes - 文本節點陣列
     * @returns {Array} 翻譯段落陣列
     */
    convertNodesToSegments(textNodes) {
        const segments = [];



        textNodes.forEach((node, index) => {
            try {
                // 詳細檢查每個節點 (調試代碼已移除)

                const text = node.textContent.trim();

                // 對於文本節點，我們需要使用父元素來判斷類型
                const elementForType = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;

                if (!elementForType) {
                    console.warn(`節點 ${index} 沒有父元素，跳過`, node);

                    return;
                }

                // 創建翻譯段落物件
                const segment = {
                    id: this.generateSegmentId(text, index),
                    text: text,
                    element: node,
                    type: this.determineSegmentType(elementForType),
                    priority: 0, // 將在 enhanceSegments 中計算
                    isVisible: this.isElementInViewport(elementForType),
                    position: index,
                    length: text.length,
                    wordCount: text.split(/\s+/).length
                };

                segments.push(segment);



            } catch (error) {
                console.error(`轉換節點 ${index} 時發生錯誤:`, error, node);

            }
        });



        return segments;
    }

    /**
     * 生成段落 ID
     * @param {string} text - 文本內容
     * @param {number} index - 索引
     * @returns {string} 段落 ID
     */
    generateSegmentId(text, index) {
        // 使用文本 hash 和索引生成唯一 ID
        const hash = this.simpleHash(text);
        return `segment_${index}_${hash}`;
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
     * 判斷段落類型
     * @param {Element} element - DOM 元素
     * @returns {string} 段落類型
     */
    determineSegmentType(element) {
        // 檢查元素類型

        // 安全檢查 tagName
        if (!element || !element.tagName) {
            console.error('determineSegmentType: element 或 tagName 為空', element);

            return 'other';
        }

        const tagName = element.tagName.toLowerCase();

        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            return 'title';
        }

        if (['p', 'div', 'span'].includes(tagName)) {
            return 'paragraph';
        }

        if (['li', 'ul', 'ol'].includes(tagName)) {
            return 'list';
        }

        if (['td', 'th', 'table'].includes(tagName)) {
            return 'table';
        }

        return 'other';
    }

    /**
     * 檢查元素是否在視窗內
     * @param {Element} element - DOM 元素
     * @returns {boolean} 是否在視窗內
     */
    isElementInViewport(element) {
        try {
            const rect = element.getBoundingClientRect();
            const windowHeight = window.innerHeight || document.documentElement.clientHeight;
            const windowWidth = window.innerWidth || document.documentElement.clientWidth;

            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= windowHeight &&
                rect.right <= windowWidth
            );
        } catch (error) {
            // 如果無法獲取位置資訊，假設不在視窗內
            return false;
        }
    }

    /**
     * 增強段落資訊
     * @param {Array} segments - 原始段落陣列
     * @returns {Array} 增強後的段落陣列
     */
    enhanceSegments(segments) {
        return segments.map(segment => {
            // 計算優先級
            segment.priority = this.calculatePriority(segment);

            // 判斷重要性
            segment.isImportant = this.isImportantSegment(segment);

            // 添加額外資訊
            segment.estimatedTokens = Math.ceil(segment.text.length / 4);

            return segment;
        });
    }

    /**
     * 計算段落優先級
     * @param {Object} segment - 翻譯段落
     * @returns {number} 優先級分數
     */
    calculatePriority(segment) {
        let priority = 0;
        const weights = this.options.priorityWeights;

        // 視窗內容優先
        if (segment.isVisible) {
            priority += weights.isInViewport;
        }

        // 標題優先
        if (segment.type === 'title') {
            priority += weights.isTitle;
        }

        // 重要段落優先
        if (this.isImportantSegment(segment)) {
            priority += weights.isImportant;
        }

        // 文檔順序權重 (越靠前優先級越高)
        const maxPosition = 1000;
        const positionWeight = Math.max(0, maxPosition - segment.position);
        priority += weights.documentOrder * positionWeight;

        return Math.round(priority);
    }

    /**
     * 判斷是否為重要段落
     * @param {Object} segment - 翻譯段落
     * @returns {boolean} 是否重要
     */
    isImportantSegment(segment) {
        // 標題總是重要的
        if (segment.type === 'title') {
            return true;
        }

        // 長段落通常比較重要
        if (segment.wordCount > 20) {
            return true;
        }

        // 在視窗內的段落比較重要
        if (segment.isVisible) {
            return true;
        }

        return false;
    }

    /**
     * 段落元素優先級排序
     * @param {HTMLElement[]} elements - 段落元素陣列
     * @returns {HTMLElement[]} 排序後的段落元素陣列
     */
    prioritizeParagraphElements(elements) {
        console.log('開始段落元素優先級排序...');

        // 為每個元素計算優先級分數
        const elementsWithPriority = elements.map((element, index) => {
            const priority = this.calculateParagraphElementPriority(element, index);
            const isVisible = this.isElementInViewport(element);
            const type = this.determineParagraphElementType(element);

            return {
                element,
                priority,
                isVisible,
                type,
                index,
                text: element.textContent.trim().substring(0, 100) // 用於調試
            };
        });

        // 按優先級排序
        const sortedElements = elementsWithPriority.sort((a, b) => {
            // 首先按優先級排序
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }

            // 優先級相同時，按文檔順序排序
            return a.index - b.index;
        });

        // 記錄排序結果
        console.log('段落元素優先級排序完成:', {
            總段落數: sortedElements.length,
            視窗內段落: sortedElements.filter(e => e.isVisible).length,
            標題段落: sortedElements.filter(e => e.type === 'title').length,
            段落元素: sortedElements.filter(e => e.type === 'paragraph').length
        });

        // 顯示前 5 個最高優先級的段落
        console.log('前 5 個最高優先級段落:');
        sortedElements.slice(0, 5).forEach((item, index) => {
            console.log(`${index + 1}. [${item.priority}] ${item.type} - ${item.text}...`);
        });

        return sortedElements.map(item => item.element);
    }

    /**
     * 計算段落元素的優先級
     * @param {HTMLElement} element - 段落元素
     * @param {number} index - 元素索引
     * @returns {number} 優先級分數
     */
    calculateParagraphElementPriority(element, index) {
        let priority = 0;
        const weights = this.options.priorityWeights;

        // 視窗內容優先
        if (this.isElementInViewport(element)) {
            priority += weights.isInViewport;
        }

        // 標題優先
        const type = this.determineParagraphElementType(element);
        if (type === 'title') {
            priority += weights.isTitle;
        }

        // 重要段落優先（基於長度和可見性）
        const text = element.textContent.trim();
        if (text.length > 50 && this.isElementInViewport(element)) {
            priority += weights.isImportant;
        }

        // 文檔順序權重（越靠前優先級越高）
        const maxPosition = 1000;
        const positionWeight = Math.max(0, maxPosition - index);
        priority += weights.documentOrder * positionWeight;

        return Math.round(priority);
    }

    /**
     * 判斷段落元素類型
     * @param {HTMLElement} element - 段落元素
     * @returns {string} 元素類型
     */
    determineParagraphElementType(element) {
        const tagName = element.tagName.toLowerCase();

        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            return 'title';
        }

        if (['p', 'div', 'article', 'section'].includes(tagName)) {
            return 'paragraph';
        }

        if (['li', 'dd', 'dt'].includes(tagName)) {
            return 'list';
        }

        if (['blockquote', 'figcaption'].includes(tagName)) {
            return 'quote';
        }

        return 'other';
    }

    /**
     * 智能優先級排序（傳統模式）
     * @param {Array} segments - 原始段落陣列
     * @returns {Array} 排序後的段落陣列
     */
    prioritizeSegments(segments) {
        console.log('開始優先級排序...');

        // 按優先級排序 (高優先級在前)
        const sortedSegments = [...segments].sort((a, b) => {
            // 首先按優先級排序
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }

            // 優先級相同時，按位置排序
            return a.position - b.position;
        });

        // 記錄排序結果
        console.log('優先級排序完成:', {
            總段落數: sortedSegments.length,
            視窗內段落: sortedSegments.filter(s => s.isVisible).length,
            標題段落: sortedSegments.filter(s => s.type === 'title').length,
            重要段落: sortedSegments.filter(s => s.isImportant).length
        });

        // 顯示前 5 個最高優先級的段落
        console.log('前 5 個最高優先級段落:');
        sortedSegments.slice(0, 5).forEach((segment, index) => {
            console.log(`${index + 1}. [${segment.priority}] ${segment.type} - ${segment.text.substring(0, 50)}...`);
        });

        return sortedSegments;
    }

    /**
     * 將段落加入翻譯隊列
     * @param {Array} segments - 排序後的段落陣列
     * @returns {Promise} 完成 Promise
     */
    async scheduleSegments(segments) {
        if (this.onSchedulingStart) {
            this.onSchedulingStart(segments);
        }

        console.log(`開始將 ${segments.length} 個段落加入翻譯隊列`);

        return new Promise((resolve) => {
            let enqueuedCount = 0;
            let skippedCount = 0;
            let completedBatches = 0;

            // 批次處理以避免阻塞 UI
            const batchSize = this.options.batchSize;
            const totalBatches = Math.ceil(segments.length / batchSize);

            for (let i = 0; i < segments.length; i += batchSize) {
                const batch = segments.slice(i, i + batchSize);

                // 使用 setTimeout 避免阻塞
                setTimeout(() => {
                    batch.forEach(segment => {
                        const success = this.translationQueue.enqueue(segment);
                        if (success) {
                            enqueuedCount++;
                        } else {
                            skippedCount++;
                        }
                    });

                    completedBatches++;

                    // 如果是最後一批，觸發完成回調
                    if (completedBatches >= totalBatches) {
                        console.log(`段落排程完成: ${enqueuedCount} 個已加入隊列, ${skippedCount} 個已跳過`);

                        this.scheduledSegments = segments;

                        if (this.onSchedulingComplete) {
                            this.onSchedulingComplete({
                                total: segments.length,
                                enqueued: enqueuedCount,
                                skipped: skippedCount
                            });
                        }

                        resolve({
                            total: segments.length,
                            enqueued: enqueuedCount,
                            skipped: skippedCount
                        });
                    }
                }, i / batchSize * 10); // 每批間隔 10ms
            }
        });
    }

    /**
     * 切換翻譯模式
     * @param {string} mode - 翻譯模式 ('paragraph' | 'sentence' | 'hybrid')
     */
    setTranslationMode(mode) {
        const validModes = ['paragraph', 'sentence', 'hybrid'];
        if (!validModes.includes(mode)) {
            throw new Error(`無效的翻譯模式: ${mode}. 有效模式: ${validModes.join(', ')}`);
        }

        this.translationMode = mode;
        this.options.translationMode = mode;

        console.log(`翻譯模式已切換為: ${mode}`);
    }

    /**
     * 獲取當前翻譯模式
     * @returns {string} 當前翻譯模式
     */
    getTranslationMode() {
        return this.translationMode;
    }

    /**
     * 清除所有翻譯結果
     */
    clearAllTranslations() {
        console.log('清除所有翻譯結果...');

        // 清除段落翻譯結果
        if (this.paragraphTranslator) {
            this.paragraphTranslator.removeAllTranslations();
        }

        // 清除傳統翻譯結果
        const translationElements = document.querySelectorAll('.web-translation-content, .translation-content');
        translationElements.forEach(element => element.remove());

        // 重置狀態
        this.cleanup();

        console.log('所有翻譯結果已清除');
    }

    /**
     * 獲取翻譯效率統計
     * @returns {Object} 效率統計
     */
    getEfficiencyStats() {
        const stats = {
            mode: this.translationMode,
            timestamp: new Date().toISOString()
        };

        if (this.translationMode === 'paragraph' && this.paragraphTranslator) {
            const paragraphStats = this.paragraphTranslator.getStats();
            stats.paragraph = {
                processed: paragraphStats.paragraphsProcessed,
                segments: paragraphStats.segmentsCreated,
                saved: paragraphStats.apiRequestsSaved,
                efficiency: paragraphStats.efficiencyPercentage,
                description: paragraphStats.efficiency
            };
        }

        if (this.analysisResults) {
            stats.analysis = {
                totalSegments: this.analysisResults.length,
                visibleSegments: this.analysisResults.filter(s => s.isVisible).length,
                titleSegments: this.analysisResults.filter(s => s.type === 'title').length,
                importantSegments: this.analysisResults.filter(s => s.isImportant).length
            };
        }

        return stats;
    }

    /**
     * 獲取排程狀態
     * @returns {Object} 排程狀態
     */
    getSchedulingStatus() {
        return {
            mode: this.translationMode,
            isAnalyzing: this.isAnalyzing,
            isScheduling: this.isScheduling,
            analysisResults: this.analysisResults ? {
                totalSegments: this.analysisResults.length,
                visibleSegments: this.analysisResults.filter(s => s.isVisible).length,
                titleSegments: this.analysisResults.filter(s => s.type === 'title').length,
                importantSegments: this.analysisResults.filter(s => s.isImportant).length
            } : null,
            scheduledSegments: this.scheduledSegments.length,
            paragraphTranslatorAvailable: !!this.paragraphTranslator
        };
    }

    /**
     * 清理資源
     */
    cleanup() {
        this.isAnalyzing = false;
        this.isScheduling = false;
        this.analysisResults = null;
        this.scheduledSegments = [];

        console.log('SmartTranslationScheduler 資源已清理');
    }
}

// 匯出類別
window.SmartTranslationScheduler = SmartTranslationScheduler;