/**
 * 內容分析器 - 分析網頁內容並提取可翻譯的文本段落
 * Content Analyzer - Analyzes web page content and extracts translatable text segments
 */

class ContentAnalyzer {
    constructor() {
        // 廣告相關的選擇器
        this.adSelectors = [
            '.ad', '.ads', '.advertisement', '.sponsor', '.sponsored',
            '.banner', '.popup', '.modal', '.overlay',
            '[class*="ad-"]', '[class*="ads-"]', '[class*="advertisement"]',
            '[id*="ad-"]', '[id*="ads-"]', '[id*="advertisement"]',
            '.google-ads', '.adsense', '.adsbygoogle',
            '.promo', '.promotion', '.marketing'
        ];

        // 應該跳過的標籤
        this.skipTags = [
            'SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK', 'HEAD',
            'TITLE', 'BASE', 'OBJECT', 'EMBED', 'IFRAME', 'FRAME',
            'FRAMESET', 'NOFRAMES', 'APPLET', 'AREA', 'MAP'
        ];

        // 應該跳過的屬性
        this.skipAttributes = [
            'alt', 'title', 'placeholder', 'aria-label', 'data-*'
        ];

        // 高優先級標籤
        this.highPriorityTags = ['H1', 'H2', 'H3', 'TITLE'];

        // 中優先級標籤
        this.mediumPriorityTags = ['H4', 'H5', 'H6', 'P', 'LI', 'TD', 'TH'];

        // 內容類型映射
        this.contentTypeMap = {
            'H1': 'title', 'H2': 'title', 'H3': 'title',
            'H4': 'title', 'H5': 'title', 'H6': 'title',
            'P': 'paragraph',
            'LI': 'list',
            'TD': 'table', 'TH': 'table',
            'SPAN': 'other', 'DIV': 'other', 'A': 'other'
        };
    }

    /**
     * 分析網頁內容，提取可翻譯的文本段落
     * @param {HTMLElement} rootElement - 根元素，預設為document.body
     * @returns {TextSegment[]} 文本段落陣列
     */
    analyzePageContent(rootElement = document.body) {
        console.log('開始分析網頁內容...');

        const textSegments = [];
        const processedTexts = new Set(); // 避免重複處理相同文本

        try {
            // 檢測所有文本節點
            const textNodes = this.detectTextNodes(rootElement);
            console.log(`檢測到 ${textNodes.length} 個文本節點`);

            // 過濾廣告內容
            const filteredNodes = this.filterAdvertisements(textNodes);
            console.log(`過濾廣告後剩餘 ${filteredNodes.length} 個文本節點`);

            // 處理每個文本節點
            filteredNodes.forEach((node, index) => {
                const segments = this.processTextNode(node, index, processedTexts);
                textSegments.push(...segments);
            });

            // 按優先級排序
            const prioritizedSegments = this.prioritizeContent(textSegments);

            console.log(`最終提取到 ${prioritizedSegments.length} 個文本段落`);
            return prioritizedSegments;

        } catch (error) {
            console.error('內容分析失敗:', error);
            return [];
        }
    }

    /**
     * 檢測頁面中的段落元素（用於段落級翻譯）
     * @param {HTMLElement} rootElement - 根元素，預設為document.body
     * @returns {HTMLElement[]} 段落元素陣列
     */
    detectParagraphElements(rootElement = document.body) {
        console.log('開始檢測段落元素...');

        const paragraphTags = [
            'p', 'div', 'article', 'section',       // 基本段落
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',    // 標題
            'li', 'dd', 'dt',                       // 列表項
            'blockquote', 'figcaption'              // 引用和說明
        ];

        const paragraphElements = [];
        const processedElements = new Set(); // 避免重複處理

        try {
            // 收集所有段落元素
            for (const tagName of paragraphTags) {
                const elements = rootElement.querySelectorAll(tagName);

                elements.forEach(element => {
                    // 避免重複處理
                    if (processedElements.has(element)) {
                        return;
                    }

                    // 檢查是否應該跳過此元素
                    if (this.shouldSkipParagraphElement(element)) {
                        return;
                    }

                    // 檢查是否有有意義的文本內容
                    const text = element.textContent.trim();
                    if (this.shouldTranslateParagraphText(text)) {
                        paragraphElements.push(element);
                        processedElements.add(element);
                    }
                });
            }

            // 按優先級和位置排序
            const sortedElements = this.sortParagraphElements(paragraphElements);

            console.log(`檢測到 ${sortedElements.length} 個可翻譯的段落元素`);
            return sortedElements;

        } catch (error) {
            console.error('段落元素檢測失敗:', error);
            return [];
        }
    }

    /**
     * 檢查是否應該跳過段落元素
     * @param {HTMLElement} element - 段落元素
     * @returns {boolean} 是否跳過
     */
    shouldSkipParagraphElement(element) {
        // 跳過隱藏元素
        if (this.isElementHidden(element)) {
            return true;
        }

        // 跳過我們自己的UI元素
        if (this.isOurUIElement(element)) {
            return true;
        }

        // 跳過廣告元素
        if (this.isAdvertisementElement(element) || this.hasAdvertisementParent(element)) {
            return true;
        }

        // 跳過已經有翻譯的元素
        if (element.nextElementSibling &&
            element.nextElementSibling.classList.contains('web-translation-result')) {
            return true;
        }

        // 跳過包含我們翻譯系統元素的段落
        if (element.querySelector('.web-translation-result, .web-translation-content')) {
            return true;
        }

        // 跳過程式碼區塊元素
        if (this.isCodeBlockParagraph(element)) {
            return true;
        }

        // 跳過超連結段落
        if (element.tagName.toLowerCase() === 'a') {
            const href = element.getAttribute('href') || '';
            console.log(`🚫 段落級檢測: 超連結段落被跳過 href="${href}"`);
            return true;
        }

        // 跳過主要內容為超連結的段落
        if (this.isParagraphMainlyHyperlink(element)) {
            return true;
        }

        // 跳過包含其他段落元素的元素（只處理葉節點段落）
        if (element.querySelector('p, div, article, section, h1, h2, h3, h4, h5, h6, li, dd, dt, blockquote, figcaption')) {
            return true;
        }

        return false;
    }

    /**
     * 檢查段落元素是否為程式碼區塊
     * @param {HTMLElement} element - 段落元素
     * @returns {boolean} 是否為程式碼區塊
     */
    isCodeBlockParagraph(element) {
        // 檢查元素本身是否為程式碼相關標籤
        const tagName = element.tagName.toLowerCase();
        if (['pre', 'code', 'kbd', 'samp', 'var', 'tt'].includes(tagName)) {
            console.log(`🚫 段落級檢測: ${tagName} 標籤被識別為程式碼區塊`);
            return true;
        }

        // 檢查是否包含程式碼相關的CSS類
        if (element.className) {
            const className = element.className.toLowerCase();
            const codeKeywords = [
                'highlight', 'syntax', 'language-', 'hljs', 'prettyprint', 
                'codehilite', 'prism', 'lang-', 'brush-', 'sh_', 'dp-',
                'codeblock', 'code-block', 'sourceCode', 'source-code'
            ];
            
            if (codeKeywords.some(keyword => className.includes(keyword))) {
                console.log(`🚫 段落級檢測: CSS 類別 "${className}" 被識別為程式碼區塊`);
                return true;
            }
        }

        // 檢查是否包含程式碼子元素
        const codeElements = element.querySelectorAll('pre, code, kbd, samp, var, tt');
        if (codeElements.length > 0) {
            // 檢查程式碼元素是否有語言標識
            for (const codeEl of codeElements) {
                const hasLanguageClass = codeEl.className.toLowerCase().includes('language-') || 
                                       codeEl.className.toLowerCase().includes('lang-');
                const hasLanguageData = codeEl.dataset.lang || codeEl.dataset.language;
                
                if (hasLanguageClass || hasLanguageData) {
                    console.log(`🚫 段落級檢測: 包含帶語言標識的程式碼元素 <${codeEl.tagName.toLowerCase()}>`);
                    return true;
                }
                
                // 檢查是否在 pre 標籤內的 code
                if (codeEl.tagName.toLowerCase() === 'code' && codeEl.closest('pre')) {
                    console.log(`🚫 段落級檢測: 包含 pre > code 結構`);
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 檢查段落是否主要內容為超連結
     * @param {HTMLElement} element - 段落元素
     * @returns {boolean} 是否主要為超連結內容
     */
    isParagraphMainlyHyperlink(element) {
        // 檢查段落是否包含超連結
        const links = element.querySelectorAll('a');
        if (links.length === 0) {
            return false;
        }

        // 獲取段落的總文字內容
        const totalText = element.textContent.trim();
        if (totalText.length === 0) {
            return false;
        }

        // 計算超連結文字的總長度
        let linkTextLength = 0;
        links.forEach(link => {
            linkTextLength += link.textContent.trim().length;
        });

        // 計算超連結比例
        const linkRatio = linkTextLength / totalText.length;
        
        console.log(`🔍 段落超連結分析: <${element.tagName.toLowerCase()}> class="${element.className}"`);
        console.log(`   - 超連結數量: ${links.length}`);
        console.log(`   - 總文字長度: ${totalText.length}`);
        console.log(`   - 超連結文字長度: ${linkTextLength}`);
        console.log(`   - 超連結比例: ${Math.round(linkRatio * 100)}%`);
        console.log(`   - 文字內容: "${totalText.substring(0, 100)}..."`);
        
        // 更智能的超連結檢測邏輯
        const shouldSkip = (
            linkRatio > 0.6 ||                                    // 超連結文字佔 60% 以上
            (links.length >= 5 && linkRatio > 0.4) ||            // 5個以上連結且佔 40% 以上
            (links.length >= 3 && linkRatio > 0.3 && element.classList.contains('tags')) || // tags 類別特殊處理
            (links.length >= 10) ||                              // 10個以上連結直接跳過
            (element.classList.contains('tags') && links.length >= 2) // tags 類別且有2個以上連結
        );
        
        if (shouldSkip) {
            console.log(`🚫 段落級檢測: 段落主要內容為超連結 (${Math.round(linkRatio * 100)}% 是連結文字, ${links.length} 個連結, class="${element.className}")`);
            return true;
        }

        console.log(`✅ 段落級檢測: 段落不是主要超連結內容`);
        return false;
    }

    /**
     * 檢查段落文本是否適合翻譯
     * @param {string} text - 段落文本
     * @returns {boolean} 是否適合翻譯
     */
    shouldTranslateParagraphText(text) {
        // 長度檢查
        if (text.length < 10) return false;
        if (text.length === 0) return false;

        // 內容類型檢查（排除純數字、符號等）
        const meaningfulText = text.replace(/[^\w\s]/g, '').trim();
        if (meaningfulText.length < 5) return false;

        // 排除純數字內容
        if (/^\d+[\d\s\-\.]*$/.test(text.trim())) return false;

        // 排除純符號內容
        if (/^[^\w\s]+$/.test(text.trim())) return false;

        // 檢查是否包含英文字母
        const hasEnglish = /[a-zA-Z]/.test(text);

        // 檢查是否包含中文字符
        const hasChinese = /[\u4e00-\u9fff]/.test(text);

        // 檢查英文字符比例
        const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
        const totalChars = text.replace(/\s/g, '').length;
        const englishRatio = totalChars > 0 ? englishChars / totalChars : 0;

        // 必須包含英文且英文比例大於30%，且不包含中文
        return hasEnglish && englishRatio > 0.3 && !hasChinese;
    }

    /**
     * 對段落元素進行排序
     * @param {HTMLElement[]} elements - 段落元素陣列
     * @returns {HTMLElement[]} 排序後的段落元素陣列
     */
    sortParagraphElements(elements) {
        return elements.sort((a, b) => {
            // 首先按優先級排序
            const priorityA = this.getParagraphPriority(a);
            const priorityB = this.getParagraphPriority(b);
            const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };

            const priorityDiff = priorityOrder[priorityB] - priorityOrder[priorityA];
            if (priorityDiff !== 0) {
                return priorityDiff;
            }

            // 其次按可見性排序（可見的優先）
            const visibleA = this.isElementVisible(a);
            const visibleB = this.isElementVisible(b);
            if (visibleA !== visibleB) {
                return visibleB ? 1 : -1;
            }

            // 最後按文檔順序排序
            return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });
    }

    /**
     * 獲取段落元素的優先級
     * @param {HTMLElement} element - 段落元素
     * @returns {string} 優先級 ('high', 'medium', 'low')
     */
    getParagraphPriority(element) {
        const tagName = element.tagName.toUpperCase();

        if (this.highPriorityTags.includes(tagName)) {
            return 'high';
        } else if (this.mediumPriorityTags.includes(tagName)) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * 檢測網頁中的所有文本節點
     * @param {HTMLElement} rootElement - 根元素
     * @returns {Node[]} 文本節點陣列
     */
    detectTextNodes(rootElement = document.body) {
        const textNodes = [];

        // 確保 rootElement 是有效的 DOM 節點
        if (!rootElement || !rootElement.nodeType) {
            console.error('Invalid rootElement provided to detectTextNodes:', rootElement);
            rootElement = document.body;
        }

        // 使用TreeWalker遍歷所有文本節點
        const walker = document.createTreeWalker(
            rootElement,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // 檢查是否應該跳過此節點
                    if (this.shouldSkipTextNode(node)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }

        return textNodes;
    }

    /**
     * 檢查是否應該跳過文本節點
     * @param {Node} node - 文本節點
     * @returns {boolean} 是否跳過
     */
    shouldSkipTextNode(node) {
        if (!node || !node.parentElement) {
            return true;
        }

        const element = node.parentElement;
        const text = node.textContent.trim();

        // 跳過空文本或過短文本
        if (!text || text.length < 3) {
            return true;
        }

        // 跳過特定標籤
        if (this.skipTags.includes(element.tagName)) {
            return true;
        }

        // 跳過程式碼區塊（使用增強的檢測邏輯）
        if (this.isCodeBlockElement(node)) {
            return true;
        }

        // 跳過超連結文字
        if (this.isHyperlinkElement(node)) {
            return true;
        }

        // 跳過隱藏元素
        if (this.isElementHidden(element)) {
            return true;
        }

        // 跳過我們自己的UI元素
        if (this.isOurUIElement(element)) {
            return true;
        }

        // 跳過已經有翻譯的元素
        if (element.querySelector('.web-translation-content')) {
            return true;
        }

        // 跳過純數字或符號
        if (this.isPureNumberOrSymbol(text)) {
            return true;
        }

        return false;
    }

    /**
     * 檢查元素是否隱藏
     * @param {HTMLElement} element - DOM元素
     * @returns {boolean} 是否隱藏
     */
    isElementHidden(element) {
        const style = window.getComputedStyle(element);
        return (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0' ||
            element.hidden ||
            element.offsetParent === null
        );
    }

    /**
     * 檢查是否為我們的UI元素
     * @param {HTMLElement} element - DOM元素
     * @returns {boolean} 是否為我們的UI元素
     */
    isOurUIElement(element) {
        const ourClasses = [
            'translation-button-container',
            'translation-button',
            'web-translation-content',
            'web-translation-loading',
            'web-translation-error'
        ];

        return ourClasses.some(className =>
            element.classList.contains(className) ||
            element.closest(`.${className}`)
        );
    }

    /**
     * 檢查是否為程式碼區塊元素（增強版本）
     * @param {Node} node - 文本節點
     * @returns {boolean} 是否為程式碼區塊
     */
    isCodeBlockElement(node) {
        try {
            const element = node.parentElement;
            if (!element) return false;

            // 遞迴檢查所有父元素，確保程式碼區塊內的所有子元素都被正確過濾
            let currentElement = element;
            let depth = 0;
            const maxDepth = 15; // 增加檢查深度

            console.log(`🔍 開始檢測程式碼區塊，文本內容: "${node.textContent.trim().substring(0, 50)}..."`);

            while (currentElement && currentElement !== document.body && depth < maxDepth) {
                const tagName = currentElement.tagName.toLowerCase();
                const dataLang = currentElement.dataset && currentElement.dataset.lang ? currentElement.dataset.lang : 'undefined';
                console.log(`🔍 檢查元素 ${depth}: <${tagName}> class="${currentElement.className}" data-lang="${dataLang}"`);

                // 優先檢查程式碼相關標籤
                if (tagName === 'code') {
                    // 檢查是否有程式語言標識
                    const className = currentElement.className.toLowerCase();
                    const hasLanguageClass = className.includes('language-') || className.includes('lang-');
                    const hasLanguageData = currentElement.dataset.lang || currentElement.dataset.language;
                    
                    if (hasLanguageClass || hasLanguageData) {
                        console.log(`🚫 ContentAnalyzer 檢測到程式碼區塊 (code + 語言標識): class="${className}", data-lang="${currentElement.dataset.lang}"`);
                        return true;
                    }
                    
                    // 檢查是否在 pre 標籤內
                    if (currentElement.closest('pre')) {
                        console.log(`🚫 ContentAnalyzer 檢測到程式碼區塊 (code 在 pre 內)`);
                        return true;
                    }
                }

                // 檢查其他程式碼相關標籤
                const codeTagPatterns = ['pre', 'kbd', 'samp', 'var', 'tt'];
                if (codeTagPatterns.includes(tagName)) {
                    console.log(`🚫 ContentAnalyzer 檢測到程式碼區塊 (${tagName} 標籤)`);
                    return true;
                }

                // 檢查程式碼相關的CSS類
                if (currentElement.className) {
                    const className = currentElement.className.toLowerCase();
                    const codeKeywords = [
                        'highlight', 'syntax', 'language-',
                        'hljs', 'prettyprint', 'codehilite', 'prism',
                        'lang-', 'brush-', 'sh_', 'dp-',
                        'codeblock', 'code-block', 'sourceCode', 'source-code',
                        'fenced-code', 'code-fence',
                        'terminal', 'console', 'shell', 'bash', 'cmd',
                        'monaco', 'ace-editor', 'codemirror'
                    ];
                    
                    if (codeKeywords.some(keyword => className.includes(keyword))) {
                        console.log(`🚫 ContentAnalyzer 檢測到程式碼區塊 (CSS 類別): ${className}`);
                        return true;
                    }
                }

                // 檢查程式碼相關的 data 屬性
                if (currentElement.dataset) {
                    const dataKeys = Object.keys(currentElement.dataset);
                    const codeDataKeys = [
                        'language', 'lang', 'syntax', 'highlight',
                        'code', 'brush', 'theme'
                    ];
                    
                    if (dataKeys.some(key => codeDataKeys.includes(key.toLowerCase()))) {
                        console.log(`🚫 ContentAnalyzer 檢測到程式碼區塊 (data 屬性): ${dataKeys.join(', ')}`);
                        return true;
                    }
                }

                // 檢查其他需要跳過的標籤
                const skipTags = [
                    'script', 'style', 'noscript', 'template',
                    'button', 'input', 'select', 'textarea', 'option', 'optgroup',
                    'img', 'svg', 'canvas', 'picture', 'source',
                    'audio', 'video', 'track',
                    'iframe', 'embed', 'object', 'param', 'applet',
                    'meta', 'link', 'base', 'title', 'head',
                    'map', 'area', 'colgroup', 'col'
                ];

                if (skipTags.includes(tagName)) {
                    console.log(`🚫 ContentAnalyzer 檢測到需跳過的標籤: ${tagName}`);
                    return true;
                }

                currentElement = currentElement.parentElement;
                depth++;
            }

            console.log(`✅ 未檢測到程式碼區塊，允許翻譯`);
            return false;

        } catch (error) {
            console.warn('程式碼區塊檢測失敗:', error);
            return false; // 安全降級
        }
    }

    /**
     * 檢查是否為純數字或符號
     * @param {string} text - 文本內容
     * @returns {boolean} 是否為純數字或符號
     */
    isPureNumberOrSymbol(text) {
        // 只包含數字、標點符號、空格的文本
        const numberSymbolPattern = /^[\d\s\.,;:!?\-()[\]{}'"]+$/;
        return numberSymbolPattern.test(text);
    }

    /**
     * 過濾廣告內容
     * @param {Node[]} textNodes - 文本節點陣列
     * @returns {Node[]} 過濾後的文本節點陣列
     */
    filterAdvertisements(textNodes) {
        return textNodes.filter(node => {
            const element = node.parentElement;

            // 檢查元素本身是否為廣告
            if (this.isAdvertisementElement(element)) {
                return false;
            }

            // 檢查父元素是否為廣告
            if (this.hasAdvertisementParent(element)) {
                return false;
            }

            // 檢查文本內容是否像廣告
            if (this.isAdvertisementText(node.textContent)) {
                return false;
            }

            return true;
        });
    }

    /**
     * 檢查元素是否為廣告元素
     * @param {HTMLElement} element - DOM元素
     * @returns {boolean} 是否為廣告元素
     */
    isAdvertisementElement(element) {
        // 檢查類名和ID
        const className = element.className.toLowerCase();
        const id = element.id.toLowerCase();

        return this.adSelectors.some(selector => {
            // 移除CSS選擇器符號進行比較
            const cleanSelector = selector.replace(/[.#[\]]/g, '');
            return className.includes(cleanSelector) || id.includes(cleanSelector);
        });
    }

    /**
     * 檢查是否有廣告父元素
     * @param {HTMLElement} element - DOM元素
     * @returns {boolean} 是否有廣告父元素
     */
    hasAdvertisementParent(element) {
        let parent = element.parentElement;
        let depth = 0;

        while (parent && depth < 5) { // 限制檢查深度
            if (this.isAdvertisementElement(parent)) {
                return true;
            }
            parent = parent.parentElement;
            depth++;
        }

        return false;
    }

    /**
     * 檢查文本是否像廣告內容
     * @param {string} text - 文本內容
     * @returns {boolean} 是否像廣告內容
     */
    isAdvertisementText(text) {
        const adKeywords = [
            'advertisement', 'sponsored', 'promotion', 'discount',
            'sale', 'offer', 'deal', 'coupon', 'promo',
            '廣告', '贊助', '促銷', '優惠', '折扣'
        ];

        const lowerText = text.toLowerCase();
        return adKeywords.some(keyword => lowerText.includes(keyword));
    }

    /**
     * 處理單個文本節點
     * @param {Node} node - 文本節點
     * @param {number} index - 節點索引
     * @param {Set} processedTexts - 已處理的文本集合
     * @returns {TextSegment[]} 文本段落陣列
     */
    processTextNode(node, index, processedTexts) {
        const text = node.textContent.trim();
        const element = node.parentElement;

        // 避免重複處理相同文本
        if (processedTexts.has(text)) {
            return [];
        }

        // 檢查是否為英文文本
        if (!this.isEnglishText(text)) {
            return [];
        }

        // 分割文本為段落
        const segments = this.segmentText(text, element, index);

        // 記錄已處理的文本
        processedTexts.add(text);

        return segments;
    }

    /**
     * 檢查是否為英文文本
     * @param {string} text - 文本內容
     * @returns {boolean} 是否為英文文本
     */
    isEnglishText(text) {
        // 檢查是否包含英文字母
        const hasEnglish = /[a-zA-Z]/.test(text);

        // 檢查是否包含中文字符
        const hasChinese = /[\u4e00-\u9fff]/.test(text);

        // 檢查英文字符比例
        const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
        const totalChars = text.replace(/\s/g, '').length;
        const englishRatio = totalChars > 0 ? englishChars / totalChars : 0;

        // 必須包含英文且英文比例大於30%，且不包含中文
        return hasEnglish && englishRatio > 0.3 && !hasChinese && text.length >= 5;
    }

    /**
     * 將文本分割為段落
     * @param {string} text - 原始文本
     * @param {HTMLElement} element - 父元素
     * @param {number} baseIndex - 基礎索引
     * @returns {TextSegment[]} 文本段落陣列
     */
    segmentText(text, element, baseIndex) {
        const segments = [];

        // 根據句號、問號、驚嘆號分割句子
        const sentences = text.split(/[.!?]+/).filter(sentence => {
            const trimmed = sentence.trim();
            return trimmed.length > 10; // 過濾過短的句子
        });

        if (sentences.length <= 1) {
            // 如果只有一個句子或無法分割，直接創建一個段落
            const segment = this.createTextSegment(text, element, baseIndex);
            if (segment) {
                segments.push(segment);
            }
        } else {
            // 為每個句子創建段落
            sentences.forEach((sentence, index) => {
                const trimmed = sentence.trim();
                if (trimmed) {
                    const segment = this.createTextSegment(
                        trimmed + '.', // 重新添加句號
                        element,
                        baseIndex * 1000 + index
                    );
                    if (segment) {
                        segments.push(segment);
                    }
                }
            });
        }

        return segments;
    }

    /**
     * 創建文本段落物件
     * @param {string} text - 文本內容
     * @param {HTMLElement} element - 父元素
     * @param {number} index - 索引
     * @returns {TextSegment|null} 文本段落物件
     */
    createTextSegment(text, element, index) {
        try {
            const segment = {
                id: `segment_${Date.now()}_${index}`,
                text: text,
                element: element,
                priority: this.getContentPriority(element),
                type: this.getContentType(element),
                isVisible: this.isElementVisible(element),
                wordCount: this.getWordCount(text),
                estimatedTokens: this.estimateTokens(text),
                createdAt: Date.now()
            };

            // 驗證段落
            if (window.validateTextSegment && !window.validateTextSegment(segment)) {
                console.warn('創建的文本段落驗證失敗:', segment);
                return null;
            }

            return segment;

        } catch (error) {
            console.error('創建文本段落失敗:', error);
            return null;
        }
    }

    /**
     * 獲取內容優先級
     * @param {HTMLElement} element - DOM元素
     * @returns {string} 優先級 ('high', 'medium', 'low')
     */
    getContentPriority(element) {
        const tagName = element.tagName.toUpperCase();

        if (this.highPriorityTags.includes(tagName)) {
            return 'high';
        } else if (this.mediumPriorityTags.includes(tagName)) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * 獲取內容類型
     * @param {HTMLElement} element - DOM元素
     * @returns {string} 內容類型
     */
    getContentType(element) {
        const tagName = element.tagName.toUpperCase();
        return this.contentTypeMap[tagName] || 'other';
    }

    /**
     * 檢查元素是否在可見區域
     * @param {HTMLElement} element - DOM元素
     * @returns {boolean} 是否可見
     */
    isElementVisible(element) {
        try {
            const rect = element.getBoundingClientRect();
            const windowHeight = window.innerHeight || document.documentElement.clientHeight;
            const windowWidth = window.innerWidth || document.documentElement.clientWidth;

            return (
                rect.top < windowHeight &&
                rect.bottom > 0 &&
                rect.left < windowWidth &&
                rect.right > 0 &&
                rect.width > 0 &&
                rect.height > 0
            );
        } catch (error) {
            console.warn('檢查元素可見性失敗:', error);
            return false;
        }
    }

    /**
     * 計算文本字數
     * @param {string} text - 文本內容
     * @returns {number} 字數
     */
    getWordCount(text) {
        return text.trim().split(/\s+/).length;
    }

    /**
     * 估算token數量
     * @param {string} text - 文本內容
     * @returns {number} 估算的token數量
     */
    estimateTokens(text) {
        // 簡單的token估算：大約4個字符等於1個token
        return Math.ceil(text.length / 4);
    }

    /**
     * 按優先級排序內容
     * @param {TextSegment[]} segments - 文本段落陣列
     * @returns {TextSegment[]} 排序後的文本段落陣列
     */
    prioritizeContent(segments) {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };

        return segments.sort((a, b) => {
            // 首先按優先級排序
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
            if (priorityDiff !== 0) {
                return priorityDiff;
            }

            // 其次按可見性排序（可見的優先）
            if (a.isVisible !== b.isVisible) {
                return b.isVisible ? 1 : -1;
            }

            // 最後按字數排序（較長的優先）
            return b.wordCount - a.wordCount;
        });
    }

    /**
     * 獲取可見區域的內容
     * @param {TextSegment[]} segments - 文本段落陣列
     * @returns {TextSegment[]} 可見區域的文本段落
     */
    getVisibleContent(segments) {
        return segments.filter(segment => segment.isVisible);
    }

    /**
     * 更新段落的可見性狀態
     * @param {TextSegment[]} segments - 文本段落陣列
     */
    updateVisibilityStatus(segments) {
        segments.forEach(segment => {
            segment.isVisible = this.isElementVisible(segment.element);
        });
    }

    /**
     * 獲取統計資訊
     * @param {TextSegment[]} segments - 文本段落陣列
     * @returns {Object} 統計資訊
     */
    getAnalysisStats(segments) {
        const stats = {
            totalSegments: segments.length,
            visibleSegments: segments.filter(s => s.isVisible).length,
            priorityBreakdown: {
                high: segments.filter(s => s.priority === 'high').length,
                medium: segments.filter(s => s.priority === 'medium').length,
                low: segments.filter(s => s.priority === 'low').length
            },
            typeBreakdown: {},
            totalWords: segments.reduce((sum, s) => sum + s.wordCount, 0),
            estimatedTokens: segments.reduce((sum, s) => sum + s.estimatedTokens, 0)
        };

        // 計算類型分佈
        segments.forEach(segment => {
            stats.typeBreakdown[segment.type] = (stats.typeBreakdown[segment.type] || 0) + 1;
        });

        return stats;
    }

    /**
     * 檢查文字節點是否位於超連結內
     * @param {Node} node - 文字節點
     * @returns {boolean} 是否為超連結文字
     */
    isHyperlinkElement(node) {
        try {
            let currentElement = node.parentElement;
            let depth = 0;
            const maxDepth = 10; // 限制檢查深度，避免效能問題

            console.log(`🔍 開始檢測超連結，文本內容: "${node.textContent.trim().substring(0, 30)}..."`);

            while (currentElement && currentElement !== document.body && depth < maxDepth) {
                const tagName = currentElement.tagName.toLowerCase();
                console.log(`🔍 檢查元素 ${depth}: <${tagName}> class="${currentElement.className}"`);

                // 檢查是否為超連結標籤
                if (tagName === 'a') {
                    const href = currentElement.getAttribute('href') || '';
                    console.log(`🚫 ContentAnalyzer 檢測到超連結文字: href="${href}", 文本="${node.textContent.trim().substring(0, 30)}..."`);
                    return true;
                }

                currentElement = currentElement.parentElement;
                depth++;
            }

            console.log(`✅ 未檢測到超連結，允許翻譯`);
            return false;

        } catch (error) {
            console.warn('超連結檢測失敗:', error);
            return false; // 安全降級：允許翻譯
        }
    }
}

// 匯出類別
window.ContentAnalyzer = ContentAnalyzer;