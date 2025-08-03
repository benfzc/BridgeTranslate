/**
 * 段落級翻譯處理器
 * 以段落為單位進行翻譯，自動忽略HTML標籤
 */
class ParagraphTranslator {
    constructor(options = {}) {
        // 段落級元素標籤
        this.paragraphTags = [
            'p', 'div', 'article', 'section',       // 基本段落
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',    // 標題
            'li', 'dd', 'dt',                       // 列表項
            'blockquote', 'figcaption'              // 引用和說明
        ];

        this.options = {
            maxParagraphLength: 1500,    // 最大段落長度
            minParagraphLength: 10,      // 最小段落長度
            splitStrategy: 'sentence',   // 分割策略：sentence | length
            translationClass: 'web-translation-result', // 翻譯結果CSS類名
            ...options
        };

        // API管理器引用
        this.apiManager = options.apiManager || null;

        // 統計信息
        this.stats = {
            paragraphsProcessed: 0,
            segmentsCreated: 0,
            apiRequestsSaved: 0 // 相比逐句翻譯節省的請求數
        };
    }

    /**
     * 檢測是否為可翻譯的段落元素
     * @param {HTMLElement} element
     * @returns {boolean}
     */
    isParagraphElement(element) {
        if (!element || !element.tagName) return false;

        const tagName = element.tagName.toLowerCase();
        return this.paragraphTags.includes(tagName);
    }

    /**
     * 提取段落純文本（自動忽略所有HTML標籤）
     * @param {HTMLElement} element
     * @returns {string}
     */
    extractParagraphText(element) {
        if (!element) return '';

        // 使用 textContent 自動去除所有HTML標籤
        const plainText = element.textContent.trim();

        // 清理多餘的空白字符
        return plainText.replace(/\s+/g, ' ');
    }

    /**
     * 檢查段落是否適合翻譯
     * @param {string} text
     * @returns {boolean}
     */
    shouldTranslateParagraph(text) {
        // 長度檢查
        if (text.length < this.options.minParagraphLength) return false;
        if (text.length === 0) return false;

        // 內容類型檢查（排除純數字、符號等）
        const meaningfulText = text.replace(/[^\w\s]/g, '').trim();
        if (meaningfulText.length < 5) return false;

        // 排除純數字內容
        if (/^\d+[\d\s\-\.]*$/.test(text.trim())) return false;

        // 排除純符號內容
        if (/^[^\w\s]+$/.test(text.trim())) return false;

        return true;
    }

    /**
     * 智能分割過長段落
     * @param {string} text
     * @returns {string[]}
     */
    splitLongParagraph(text) {
        if (text.length <= this.options.maxParagraphLength) {
            return [text];
        }

        const segments = [];

        if (this.options.splitStrategy === 'sentence') {
            // 按句子分割
            const sentences = text.split(/[.!?]+\s+/);
            let currentSegment = '';

            for (let i = 0; i < sentences.length; i++) {
                const sentence = sentences[i].trim();
                if (!sentence) continue;

                const potentialSegment = currentSegment
                    ? currentSegment + '. ' + sentence
                    : sentence;

                if (potentialSegment.length > this.options.maxParagraphLength) {
                    if (currentSegment) {
                        segments.push(currentSegment.trim());
                        currentSegment = sentence;
                    } else {
                        // 單個句子過長，按長度強制分割
                        segments.push(...this.splitByLength(sentence));
                    }
                } else {
                    currentSegment = potentialSegment;
                }
            }

            if (currentSegment) {
                segments.push(currentSegment.trim());
            }
        } else {
            // 按長度分割
            segments.push(...this.splitByLength(text));
        }

        return segments.filter(seg => seg.trim().length > 0);
    }

    /**
     * 按長度強制分割
     * @param {string} text
     * @returns {string[]}
     */
    splitByLength(text) {
        const segments = [];
        const maxLength = this.options.maxParagraphLength;

        for (let i = 0; i < text.length; i += maxLength) {
            const segment = text.substring(i, i + maxLength);
            if (segment.trim()) {
                segments.push(segment.trim());
            }
        }

        return segments;
    }

    /**
     * 檢查元素是否已經被翻譯
     * @param {HTMLElement} element
     * @returns {boolean}
     */
    isAlreadyTranslated(element) {
        // 檢查下一個兄弟元素是否為翻譯結果
        const nextSibling = element.nextElementSibling;
        return nextSibling && nextSibling.classList.contains(this.options.translationClass);
    }

    /**
     * 在段落下方插入翻譯結果
     * @param {HTMLElement} originalElement
     * @param {string} translatedText
     * @returns {HTMLElement}
     */
    insertTranslationBelow(originalElement, translatedText) {
        // 如果已經存在翻譯，先移除
        if (this.isAlreadyTranslated(originalElement)) {
            const existingTranslation = originalElement.nextElementSibling;
            existingTranslation.remove();
        }

        const translationElement = document.createElement('div');
        translationElement.className = this.options.translationClass;
        translationElement.textContent = translatedText;

        // 添加一些基本樣式
        translationElement.style.cssText = `
            color: #666;
            font-style: italic;
            margin-top: 5px;
            margin-bottom: 10px;
            padding: 8px;
            background-color: #f8f9fa;
            border-left: 3px solid #007bff;
            border-radius: 3px;
        `;

        // 插入到原段落後面
        originalElement.parentNode.insertBefore(
            translationElement,
            originalElement.nextSibling
        );

        return translationElement;
    }

    /**
     * 翻譯單個段落
     * @param {HTMLElement} element
     * @returns {Promise<Object|null>}
     */
    async translateParagraph(element) {
        if (!this.isParagraphElement(element)) {
            return null;
        }

        // 檢查是否已經翻譯過
        if (this.isAlreadyTranslated(element)) {
            return null;
        }

        const plainText = this.extractParagraphText(element);

        if (!this.shouldTranslateParagraph(plainText)) {
            return null; // 跳過翻譯
        }

        try {
            // 處理過長段落
            const textSegments = this.splitLongParagraph(plainText);
            const translatedSegments = [];

            // 翻譯每個片段
            for (const segment of textSegments) {
                if (!this.apiManager) {
                    throw new Error('API Manager not initialized');
                }

                const translation = await this.apiManager.translate(segment);
                // 提取翻譯文字，支援不同的回應格式
                const translatedText = translation.translatedText || translation.text || translation;
                translatedSegments.push(translatedText);
            }

            // 合併翻譯結果
            const fullTranslation = translatedSegments.join(' ');

            // 在原段落下方插入翻譯
            this.insertTranslationBelow(element, fullTranslation);

            // 更新統計
            this.stats.paragraphsProcessed++;
            this.stats.segmentsCreated += textSegments.length;

            // 估算節省的API請求數（假設原本會按句子分割）
            const estimatedOriginalRequests = plainText.split(/[.!?]+/).length;
            this.stats.apiRequestsSaved += Math.max(0, estimatedOriginalRequests - textSegments.length);

            return {
                originalText: plainText,
                translatedText: fullTranslation,
                segmentCount: textSegments.length,
                element: element,
                translationElement: element.nextElementSibling
            };

        } catch (error) {
            console.error('段落翻譯失敗:', error);

            // 插入錯誤提示
            this.insertTranslationBelow(element, `翻譯失敗: ${error.message}`);

            throw error;
        }
    }

    /**
     * 批量翻譯頁面中的所有段落
     * @param {HTMLElement} container 容器元素，默認為document.body
     * @returns {Promise<Object[]>}
     */
    async translateAllParagraphs(container = document.body) {
        const results = [];
        const paragraphElements = [];

        // 收集所有段落元素
        for (const tagName of this.paragraphTags) {
            const elements = container.querySelectorAll(tagName);
            paragraphElements.push(...Array.from(elements));
        }

        console.log(`找到 ${paragraphElements.length} 個段落元素`);

        // 逐個翻譯
        for (const element of paragraphElements) {
            try {
                const result = await this.translateParagraph(element);
                if (result) {
                    results.push(result);
                    console.log(`翻譯完成: ${result.originalText.substring(0, 50)}...`);
                }
            } catch (error) {
                console.error('段落翻譯錯誤:', error);
                // 繼續處理下一個段落
            }
        }

        return results;
    }

    /**
     * 移除所有翻譯結果
     * @param {HTMLElement} container
     */
    removeAllTranslations(container = document.body) {
        const translationElements = container.querySelectorAll(`.${this.options.translationClass}`);
        translationElements.forEach(element => element.remove());

        // 重置統計
        this.stats = {
            paragraphsProcessed: 0,
            segmentsCreated: 0,
            apiRequestsSaved: 0
        };
    }

    /**
     * 獲取翻譯統計信息
     * @returns {Object}
     */
    getStats() {
        const efficiencyPercentage = this.stats.apiRequestsSaved > 0
            ? Math.round((this.stats.apiRequestsSaved / (this.stats.segmentsCreated + this.stats.apiRequestsSaved)) * 100)
            : 0;

        return {
            ...this.stats,
            efficiency: this.stats.apiRequestsSaved > 0
                ? `節省了 ${this.stats.apiRequestsSaved} 個API請求 (${efficiencyPercentage}% 效率提升)`
                : '暫無效率統計',
            efficiencyPercentage: efficiencyPercentage,
            averageSegmentsPerParagraph: this.stats.paragraphsProcessed > 0
                ? (this.stats.segmentsCreated / this.stats.paragraphsProcessed).toFixed(2)
                : 0
        };
    }

    /**
     * 獲取詳細的效率報告
     * @returns {Object}
     */
    getEfficiencyReport() {
        const stats = this.getStats();
        const totalOriginalRequests = this.stats.segmentsCreated + this.stats.apiRequestsSaved;

        return {
            summary: {
                paragraphsProcessed: this.stats.paragraphsProcessed,
                actualRequests: this.stats.segmentsCreated,
                estimatedOriginalRequests: totalOriginalRequests,
                requestsSaved: this.stats.apiRequestsSaved,
                efficiencyGain: stats.efficiencyPercentage
            },
            details: {
                averageSegmentsPerParagraph: stats.averageSegmentsPerParagraph,
                requestReduction: totalOriginalRequests > 0
                    ? `從 ${totalOriginalRequests} 減少到 ${this.stats.segmentsCreated}`
                    : '暫無數據',
                costSavings: this.stats.apiRequestsSaved > 0
                    ? `假設每個請求成本 $0.001，節省約 $${(this.stats.apiRequestsSaved * 0.001).toFixed(4)}`
                    : '暫無成本節省'
            },
            recommendations: this.generateRecommendations()
        };
    }

    /**
     * 生成優化建議
     * @returns {string[]}
     */
    generateRecommendations() {
        const recommendations = [];

        if (this.stats.paragraphsProcessed === 0) {
            recommendations.push('尚未處理任何段落，建議開始翻譯測試');
            return recommendations;
        }

        const avgSegments = this.stats.segmentsCreated / this.stats.paragraphsProcessed;

        if (avgSegments > 2) {
            recommendations.push('段落分割較多，建議增加 maxParagraphLength 參數以減少分割');
        }

        if (this.stats.apiRequestsSaved < this.stats.segmentsCreated * 0.3) {
            recommendations.push('效率提升有限，建議檢查段落檢測邏輯或內容過濾規則');
        }

        if (this.stats.efficiencyPercentage > 50) {
            recommendations.push('效率提升顯著！段落級翻譯策略運作良好');
        }

        if (this.stats.paragraphsProcessed > 20) {
            recommendations.push('處理了大量段落，建議考慮實施快取機制以避免重複翻譯');
        }

        return recommendations;
    }

    /**
     * 重置統計信息
     */
    resetStats() {
        this.stats = {
            paragraphsProcessed: 0,
            segmentsCreated: 0,
            apiRequestsSaved: 0
        };
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
     * 導出統計數據為JSON
     * @returns {string}
     */
    exportStats() {
        const report = this.getEfficiencyReport();
        return JSON.stringify(report, null, 2);
    }
}

// 導出類別
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ParagraphTranslator;
} else if (typeof window !== 'undefined') {
    window.ParagraphTranslator = ParagraphTranslator;
}