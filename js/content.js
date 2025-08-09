// Content Script
// 在網頁中注入翻譯功能

class WebTranslationContent {
    constructor() {
        this.isTranslating = false;
        this.translationVisible = false;
        this.buttonManager = null;
        this.contentAnalyzer = null;
        this.translationRenderer = null;
        this.settings = null;
        this.currentSegments = [];

        // 新的智能排程系統
        this.translationQueue = null;
        this.smartScheduler = null;
        this.translationMode = 'smart-scheduling'; // 新的智能排程模式

        // 保留舊系統以備降級使用
        this.boundaryDetector = null;
        this.viewportManager = null;
        this.scrollTranslationEnabled = false; // 停用舊的滾動翻譯

        this.init();
    }

    async init() {
        try {
            // 載入設定
            await this.loadSettings();

            // 創建組件
            this.createComponents();

            // 載入按鈕可見性狀態
            await this.loadButtonVisibilityState();

            // 綁定事件
            this.attachEvents();

            console.log('Bridge Translate loaded');
        } catch (error) {
            console.error('初始化失敗:', error);
        }
    }

    async loadSettings() {
        try {
            console.log('載入設定中...');
            const response = await chrome.storage.sync.get(['apiConfiguration', 'translationPreferences', 'usageStats']);
            console.log('設定載入回應:', response);

            this.settings = {
                apiConfiguration: response.apiConfiguration || {
                    provider: 'google-gemini',
                    apiKey: '',
                    model: 'gemini-2.5-flash-lite',
                    maxTokensPerRequest: 4000
                },
                translationPreferences: response.translationPreferences || {
                    targetLanguage: 'zh-TW',
                    showOriginalText: true,
                    translationPosition: 'below',
                    autoTranslateVisible: false
                },
                usageStats: response.usageStats || {
                    totalTranslations: 0,
                    tokensUsed: 0,
                    estimatedCost: 0
                }
            };

            console.log('設定載入成功:', this.settings);
        } catch (error) {
            console.error('載入設定失敗:', error);
            this.settings = this.getDefaultSettings();
        }
    }

    getDefaultSettings() {
        return {
            apiConfiguration: {
                provider: 'google-gemini',
                apiKey: '',
                model: 'gemini-2.5-flash-lite',
                maxTokensPerRequest: 4000
            },
            translationPreferences: {
                targetLanguage: 'zh-TW',
                showOriginalText: true,
                translationPosition: 'below',
                autoTranslateVisible: false
            },
            usageStats: {
                totalTranslations: 0,
                tokensUsed: 0,
                estimatedCost: 0
            }
        };
    }

    createComponents() {
        try {
            console.log('開始創建組件 (智能排程模式)...');

            // 檢查新系統依賴是否載入
            const dependencies = {
                ContentAnalyzer: typeof ContentAnalyzer,
                TranslationRenderer: typeof TranslationRenderer,
                ParagraphTranslator: typeof ParagraphTranslator,
                RateLimitedTranslationQueue: typeof RateLimitedTranslationQueue,
                SmartTranslationScheduler: typeof SmartTranslationScheduler,
                TranslationButtonManager: typeof TranslationButtonManager
            };
            console.log('依賴檢查:', dependencies);

            // 檢查是否有未定義的依賴
            const undefinedDeps = Object.entries(dependencies)
                .filter(([name, type]) => type === 'undefined')
                .map(([name]) => name);

            if (undefinedDeps.length > 0) {
                console.error('以下依賴未正確載入:', undefinedDeps);
                // 嘗試降級到舊系統
                return this.createLegacyComponents();
            }

            // 創建內容分析器
            this.contentAnalyzer = new ContentAnalyzer();
            console.log('✅ ContentAnalyzer 創建完成');

            // 創建翻譯渲染器
            this.translationRenderer = new TranslationRenderer();
            console.log('✅ TranslationRenderer 創建完成');

            // 創建 API 管理器代理
            const apiManagerProxy = this.createAPIManagerProxy();

            // 創建段落翻譯器（傳遞 TranslationRenderer 以統一管理翻譯元素）
            this.paragraphTranslator = new ParagraphTranslator({
                apiManager: apiManagerProxy,
                translationRenderer: this.translationRenderer, // 統一使用 TranslationRenderer
                maxParagraphLength: 1500,
                minParagraphLength: 10,
                splitStrategy: 'sentence'
            });
            console.log('✅ ParagraphTranslator 創建完成');

            // 創建 Rate-Limited 翻譯隊列
            this.translationQueue = new RateLimitedTranslationQueue({
                rpmLimit: this.getRPMLimit(),
                tpmLimit: this.getTPMLimit(),
                rpdLimit: this.getRPDLimit(),
                apiManager: apiManagerProxy
            });
            console.log('✅ RateLimitedTranslationQueue 創建完成');

            // 設定隊列回調
            this.setupQueueCallbacks();

            // 創建智能翻譯排程管理器
            this.smartScheduler = new SmartTranslationScheduler({
                contentAnalyzer: this.contentAnalyzer,
                translationRenderer: this.translationRenderer,
                translationQueue: this.translationQueue,
                paragraphTranslator: this.paragraphTranslator,
                translationMode: 'paragraph' // 預設使用段落翻譯模式
            });
            console.log('✅ SmartTranslationScheduler 創建完成');

            // 設定排程回調
            this.setupSchedulerCallbacks();

            // 創建按鈕管理器
            console.log('正在創建按鈕管理器...');
            this.buttonManager = new TranslationButtonManager();
            console.log('✅ TranslationButtonManager 創建完成');

            // 檢查按鈕是否正確創建
            if (this.buttonManager && this.buttonManager.button) {
                console.log('✅ 翻譯按鈕創建成功');
            } else {
                console.warn('⚠️ 翻譯按鈕創建可能有問題');
            }

            console.log('🎉 所有組件創建完成 (智能排程模式)');

        } catch (error) {
            console.error('創建組件失敗:', error);
            console.error('錯誤詳情:', error.stack);

            // 嘗試降級到舊系統
            this.createLegacyComponents();
        }
    }

    /**
     * 創建 API 管理器代理
     */
    createAPIManagerProxy() {
        return {
            translate: async (text, options = {}) => {
                try {
                    const response = await chrome.runtime.sendMessage({
                        type: 'TRANSLATE_TEXT',
                        text: text,
                        provider: this.settings?.apiConfiguration?.provider || 'google-gemini',
                        options: {
                            targetLanguage: options.targetLanguage || this.settings?.translationPreferences?.targetLanguage || 'zh-TW',
                            ...options
                        }
                    });

                    if (response.success) {
                        return response.translation;
                    } else {
                        throw new Error(response.error || '翻譯請求失敗');
                    }
                } catch (error) {
                    console.error('API 管理器代理錯誤:', error);
                    throw error;
                }
            },

            // 為了兼容性，保留舊的方法名
            translateText: async (text, options = {}) => {
                return this.translate(text, options);
            }
        };
    }

    /**
     * 獲取 RPM 限制 (基於當前 API 配置)
     */
    getRPMLimit() {
        const model = this.settings?.apiConfiguration?.model || 'gemini-2.5-flash-lite';
        const limits = {
            'gemini-2.5-pro': 5,
            'gemini-2.5-flash': 10,
            'gemini-2.5-flash-lite': 15,
            'gemini-2.0-flash': 15,
            'gemini-2.0-flash-lite': 30
        };
        return limits[model] || 15;
    }

    /**
     * 獲取 TPM 限制
     */
    getTPMLimit() {
        const model = this.settings?.apiConfiguration?.model || 'gemini-2.5-flash-lite';
        const limits = {
            'gemini-2.5-pro': 250000,
            'gemini-2.5-flash': 250000,
            'gemini-2.5-flash-lite': 250000,
            'gemini-2.0-flash': 1000000,
            'gemini-2.0-flash-lite': 1000000
        };
        return limits[model] || 250000;
    }

    /**
     * 獲取 RPD 限制
     */
    getRPDLimit() {
        const model = this.settings?.apiConfiguration?.model || 'gemini-2.5-flash-lite';
        const limits = {
            'gemini-2.5-pro': 100,
            'gemini-2.5-flash': 250,
            'gemini-2.5-flash-lite': 1000,
            'gemini-2.0-flash': 200,
            'gemini-2.0-flash-lite': 200
        };
        return limits[model] || 1000;
    }

    /**
     * 設定翻譯隊列回調
     */
    setupQueueCallbacks() {
        if (!this.translationQueue) return;

        this.translationQueue.onProgress = (progress) => {
            console.log(`翻譯進度: ${progress.current}/${progress.total} (${progress.percentage}%)`);

            // 更新按鈕狀態
            if (this.buttonManager && this.buttonManager.button) {
                this.buttonManager.button.showProgress(progress.percentage);

                if (progress.currentSegment) {
                    const previewText = progress.currentSegment.text.substring(0, 30) + '...';
                    this.buttonManager.button.tooltip.textContent = `翻譯中: ${previewText}`;
                }
            }
        };

        this.translationQueue.onComplete = () => {
            console.log('🎉 翻譯隊列處理完成！');
            this.isTranslating = false;
            this.translationVisible = true;

            // 更新按鈕狀態
            if (this.buttonManager && this.buttonManager.button) {
                this.buttonManager.button.onTranslationComplete();
            }
        };

        this.translationQueue.onError = (error, segment) => {
            console.error('翻譯錯誤:', error, segment);

            // 更新按鈕狀態
            if (this.buttonManager && this.buttonManager.button) {
                this.buttonManager.button.onTranslationError(error.message);
            }
        };
    }

    /**
     * 設定智能排程管理器回調
     */
    setupSchedulerCallbacks() {
        if (!this.smartScheduler) return;

        this.smartScheduler.onAnalysisStart = () => {
            console.log('📊 開始分析頁面內容...');
        };

        this.smartScheduler.onAnalysisComplete = (segments) => {
            console.log(`📊 頁面分析完成: 找到 ${segments.length} 個可翻譯段落`);

            const stats = {
                total: segments.length,
                visible: segments.filter(s => s.isVisible).length,
                titles: segments.filter(s => s.type === 'title').length,
                important: segments.filter(s => s.isImportant).length
            };

            console.log('📊 內容統計:', stats);
        };

        this.smartScheduler.onSchedulingStart = (segments) => {
            console.log(`🚀 開始排程 ${segments.length} 個翻譯任務`);
        };

        this.smartScheduler.onSchedulingComplete = (result) => {
            console.log('🚀 排程完成:', result);
        };

        this.smartScheduler.onError = (error) => {
            console.error('❌ 排程錯誤:', error);
            this.showError('智能排程失敗：' + error.message);
        };
    }

    /**
     * 創建舊系統組件 (降級模式)
     */
    createLegacyComponents() {
        console.log('⚠️ 降級到舊系統模式...');

        try {
            // 檢查舊系統依賴
            if (typeof TranslationBoundaryDetector !== 'undefined' &&
                typeof ViewportTranslationManager !== 'undefined') {

                // 創建內容分析器
                this.contentAnalyzer = new ContentAnalyzer();

                // 創建翻譯渲染器
                this.translationRenderer = new TranslationRenderer();

                // 創建邊界檢測器
                this.boundaryDetector = new TranslationBoundaryDetector();

                // 創建視窗翻譯管理器
                this.viewportManager = new ViewportTranslationManager({
                    scrollThrottle: 200,
                    batchSize: 3,
                    batchDelay: 500,
                    maxConcurrentRequests: 2,
                    preloadMargin: 200,
                    enabled: true
                });

                // 初始化視窗翻譯管理器
                this.initializeViewportManager();

                // 創建按鈕管理器
                this.buttonManager = new TranslationButtonManager();

                this.translationMode = 'legacy-viewport';
                console.log('✅ 舊系統組件創建完成');

            } else {
                // 最後的降級選項
                this.createFallbackButton();
            }

        } catch (error) {
            console.error('舊系統創建失敗:', error);
            this.createFallbackButton();
        }
    }

    /**
     * 初始化視窗翻譯管理器
     */
    async initializeViewportManager() {
        try {
            if (!this.viewportManager) return;

            // 創建 API 管理器代理
            const apiManagerProxy = {
                translateText: async (text, options = {}) => {
                    try {
                        const response = await chrome.runtime.sendMessage({
                            type: 'TRANSLATE_TEXT',
                            text: text,
                            provider: this.settings?.apiConfiguration?.provider || 'google-gemini',
                            options: {
                                targetLanguage: options.targetLanguage || this.settings?.translationPreferences?.targetLanguage || 'zh-TW',
                                ...options
                            }
                        });

                        if (response.success) {
                            return response.translation;
                        } else {
                            throw new Error(response.error || '翻譯請求失敗');
                        }
                    } catch (error) {
                        console.error('API 管理器代理錯誤:', error);
                        throw error;
                    }
                }
            };

            // 初始化視窗管理器
            await this.viewportManager.initialize({
                boundaryDetector: this.boundaryDetector,
                translationRenderer: this.translationRenderer,
                apiManager: apiManagerProxy
            });

            console.log('視窗翻譯管理器初始化完成');

        } catch (error) {
            console.error('初始化視窗翻譯管理器失敗:', error);
        }
    }

    /**
     * 創建降級按鈕
     */
    createFallbackButton() {
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
            transition: all 0.3s ease;
        `;
        button.innerHTML = '🌐';
        button.title = '點擊開始翻譯';
        button.addEventListener('click', () => this.toggleTranslation());

        document.body.appendChild(button);
        this.fallbackButton = button;

        console.log('降級按鈕創建完成');
    }

    attachEvents() {
        if (this.buttonManager && this.buttonManager.button) {
            this.buttonManager.button.button.addEventListener('click', () => {
                this.toggleTranslation();
            });
        }

        // 監聽來自擴展的訊息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // 保持訊息通道開放
        });
    }

    async toggleTranslation() {
        try {
            console.log('🔄 toggleTranslation 被調用');
            console.log('當前狀態:', {
                isTranslating: this.isTranslating,
                translationVisible: this.translationVisible,
                buttonState: this.buttonManager?.button?.currentState
            });

            if (this.isTranslating) {
                console.log('⏸️ 正在翻譯中，忽略點擊');
                return; // 正在翻譯中，忽略點擊
            }

            // 檢查是否有已存在的翻譯內容
            const hasExistingTranslations = this.translationRenderer && 
                this.translationRenderer.renderedTranslations && 
                this.translationRenderer.renderedTranslations.size > 0;

            console.log('翻譯內容檢查:', {
                hasRenderer: !!this.translationRenderer,
                hasRenderedTranslations: !!this.translationRenderer?.renderedTranslations,
                translationCount: this.translationRenderer?.renderedTranslations?.size || 0,
                hasExistingTranslations
            });

            // 檢查實際的翻譯元素可見性（現在統一使用 translation-content）
            const translationElements = document.querySelectorAll('.translation-content');
            const visibleElements = Array.from(translationElements).filter(el => 
                !el.classList.contains('translation-hidden') && 
                el.style.display !== 'none'
            );

            // 為了向後兼容，也檢查舊的類名（但應該逐步移除）
            const legacyElements = document.querySelectorAll('.web-translation-result');
            const legacyVisible = Array.from(legacyElements).filter(el => 
                el.style.display !== 'none'
            );

            const allTranslationElements = [...translationElements, ...legacyElements];
            const allVisibleElements = [...visibleElements, ...legacyVisible];

            console.log('DOM 元素檢查:', {
                totalElements: allTranslationElements.length,
                visibleElements: allVisibleElements.length,
                hiddenElements: allTranslationElements.length - allVisibleElements.length,
                unified: { total: translationElements.length, visible: visibleElements.length },
                legacy: { total: legacyElements.length, visible: legacyVisible.length }
            });

            // 決定執行的操作（使用實際的DOM元素數量而不是依賴 renderedTranslations）
            const hasActualTranslations = allTranslationElements.length > 0;
            
            if (this.translationVisible && (hasActualTranslations || allVisibleElements.length > 0)) {
                // 翻譯內容當前可見，隱藏它們
                console.log('➡️ 執行操作: 隱藏翻譯內容');
                this.hideTranslations();
            } else if (hasActualTranslations && !this.translationVisible) {
                // 翻譯內容存在但被隱藏，重新顯示它們
                console.log('➡️ 執行操作: 重新顯示已存在的翻譯內容');
                this.showTranslations();
            } else if (!hasActualTranslations) {
                // 沒有翻譯內容，開始新的翻譯
                console.log('➡️ 執行操作: 開始新的翻譯');
                await this.startTranslation();
            } else {
                // 邊緣情況：狀態不一致，嘗試修復
                console.warn('⚠️ 狀態不一致，嘗試修復...');
                if (allVisibleElements.length > 0) {
                    console.log('🔧 修復: 有可見元素但 translationVisible=false，設定為 true');
                    this.translationVisible = true;
                    this.hideTranslations();
                } else {
                    console.log('🔧 修復: 沒有可見元素，顯示翻譯');
                    this.showTranslations();
                }
            }

            console.log('操作完成後狀態:', {
                isTranslating: this.isTranslating,
                translationVisible: this.translationVisible,
                buttonState: this.buttonManager?.button?.currentState
            });

        } catch (error) {
            console.error('Toggle translation failed:', error);
            this.showError('翻譯功能啟動失敗：' + error.message);
        }
    }

    async startTranslation() {
        console.log('🚀 開始翻譯，當前設定:', this.settings);

        // 檢查是否已設定 API
        if (!this.settings?.apiConfiguration?.provider || !this.settings?.apiConfiguration?.apiKey) {
            console.log('❌ API 設定檢查失敗:', {
                provider: this.settings?.apiConfiguration?.provider,
                hasApiKey: !!this.settings?.apiConfiguration?.apiKey
            });

            this.showError('請先在設定中配置 AI 翻譯服務');
            return;
        }

        console.log('✅ API 設定檢查通過');
        this.isTranslating = true;

        try {
            // 根據翻譯模式選擇處理方式
            if (this.translationMode === 'smart-scheduling' && this.smartScheduler) {
                console.log('🧠 使用智能排程翻譯系統');

                // 更新按鈕狀態
                if (this.buttonManager && this.buttonManager.button) {
                    this.buttonManager.button.setState('translating');
                }

                // 開始智能排程翻譯
                await this.smartScheduler.scheduleFullPageTranslation();

                console.log('✅ 智能排程翻譯啟動成功');

            } else if (this.translationMode === 'legacy-viewport' && this.viewportManager) {
                console.log('📜 使用舊版視窗翻譯系統');

                // 更新按鈕狀態
                if (this.buttonManager && this.buttonManager.button) {
                    this.buttonManager.button.setState('translating');
                }

                this.viewportManager.start();
                this.translationVisible = true;

                console.log('✅ 視窗翻譯系統啟動成功');

            } else {
                throw new Error('沒有可用的翻譯系統');
            }

        } catch (error) {
            console.error('❌ 翻譯啟動失敗:', error);
            this.showError('翻譯失敗：' + error.message);

            // 重置按鈕狀態
            if (this.buttonManager && this.buttonManager.button) {
                this.buttonManager.button.onTranslationError(error.message);
            }

            this.isTranslating = false;
        }
    }

    /**
     * 隱藏翻譯內容
     */
    hideTranslations() {
        try {
            console.log('🙈 開始隱藏翻譯內容');
            console.log('隱藏前狀態:', {
                translationVisible: this.translationVisible,
                renderedCount: this.translationRenderer?.renderedTranslations?.size || 0
            });

            // 隱藏已渲染的翻譯內容（統一使用 TranslationRenderer）
            if (this.translationRenderer) {
                console.log('📱 調用 TranslationRenderer.toggleTranslationVisibility(false)');
                this.translationRenderer.toggleTranslationVisibility(false);
            }
            
            // 為了向後兼容，也隱藏舊的段落翻譯元素（應該逐步移除）
            const legacyElements = document.querySelectorAll('.web-translation-result');
            if (legacyElements.length > 0) {
                legacyElements.forEach(element => {
                    element.style.display = 'none';
                });
                console.log(`📱 隱藏了 ${legacyElements.length} 個舊版段落翻譯元素`);
            }

            // 停止智能排程系統（但不清除已翻譯的內容）
            if (this.translationMode === 'smart-scheduling' && this.translationQueue) {
                this.translationQueue.pause();
                console.log('⏸️ 智能翻譯隊列已暫停');
            }

            // 停止舊版視窗翻譯系統
            if (this.translationMode === 'legacy-viewport' && this.viewportManager) {
                this.viewportManager.stop();
                console.log('⏸️ 視窗翻譯管理器已停止');
            }

            // 更新狀態
            this.translationVisible = false;
            this.isTranslating = false;

            // 保持按鈕狀態為 completed，因為翻譯內容仍然存在，只是被隱藏了
            console.log('🔘 保持按鈕狀態為 completed，翻譯內容已隱藏但仍可恢復');

            // 驗證隱藏效果
            const hiddenElements = document.querySelectorAll('.translation-content.translation-hidden');
            const visibleElements = document.querySelectorAll('.translation-content:not(.translation-hidden)');
            const legacyHidden = Array.from(document.querySelectorAll('.web-translation-result')).filter(el => el.style.display === 'none');
            const legacyVisible = Array.from(document.querySelectorAll('.web-translation-result')).filter(el => el.style.display !== 'none');
            
            console.log('隱藏後驗證:', {
                unified: { hidden: hiddenElements.length, visible: visibleElements.length },
                legacy: { hidden: legacyHidden.length, visible: legacyVisible.length },
                translationVisible: this.translationVisible
            });

            console.log('✅ 翻譯內容隱藏完成');

        } catch (error) {
            console.error('❌ 隱藏翻譯時發生錯誤:', error);
        }
    }

    /**
     * 顯示已存在的翻譯內容
     */
    showTranslations() {
        try {
            console.log('👁️ 開始顯示已存在的翻譯內容');
            console.log('顯示前狀態:', {
                translationVisible: this.translationVisible,
                renderedCount: this.translationRenderer?.renderedTranslations?.size || 0
            });

            // 顯示已渲染的翻譯內容（統一使用 TranslationRenderer）
            if (this.translationRenderer) {
                console.log('📱 調用 TranslationRenderer.toggleTranslationVisibility(true)');
                this.translationRenderer.toggleTranslationVisibility(true);
            }
            
            // 為了向後兼容，也顯示舊的段落翻譯元素（應該逐步移除）
            const legacyElements = document.querySelectorAll('.web-translation-result');
            if (legacyElements.length > 0) {
                legacyElements.forEach(element => {
                    element.style.display = '';
                });
                console.log(`📱 顯示了 ${legacyElements.length} 個舊版段落翻譯元素`);
            }

            // 更新狀態
            this.translationVisible = true;

            // 驗證顯示效果
            const hiddenElements = document.querySelectorAll('.translation-content.translation-hidden');
            const visibleElements = document.querySelectorAll('.translation-content:not(.translation-hidden)');
            const legacyHidden = Array.from(document.querySelectorAll('.web-translation-result')).filter(el => el.style.display === 'none');
            const legacyVisible = Array.from(document.querySelectorAll('.web-translation-result')).filter(el => el.style.display !== 'none');
            
            console.log('顯示後驗證:', {
                unified: { hidden: hiddenElements.length, visible: visibleElements.length },
                legacy: { hidden: legacyHidden.length, visible: legacyVisible.length },
                translationVisible: this.translationVisible
            });

            console.log('✅ 翻譯內容顯示完成');

        } catch (error) {
            console.error('❌ 顯示翻譯時發生錯誤:', error);
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

    /**
     * 處理來自擴展的訊息
     */
    handleMessage(message, sender, sendResponse) {
        try {
            console.log('收到訊息:', message);

            switch (message.type) {
                case 'TOGGLE_TRANSLATION':
                    this.toggleTranslation().then(() => {
                        sendResponse({ success: true });
                    }).catch(error => {
                        console.error('Toggle translation error:', error);
                        sendResponse({ success: false, error: error.message });
                    });
                    return true; // 保持訊息通道開放以支援異步回應

                case 'CLEAR_TRANSLATIONS':
                    this.clearAllTranslations();
                    sendResponse({ success: true });
                    break;

                case 'GET_TRANSLATION_STATS':
                    const stats = this.getTranslationStats();
                    sendResponse({ success: true, stats: stats });
                    break;

                case 'UPDATE_SETTINGS':
                    this.settings = message.settings;
                    sendResponse({ success: true });
                    break;

                case 'TOGGLE_BUTTON_VISIBILITY':
                    try {
                        console.log('📨 收到按鈕可見性切換訊息:', message);
                        this.handleButtonVisibilityToggle(message.visible);
                        sendResponse({ 
                            success: true, 
                            timestamp: Date.now(),
                            visible: message.visible,
                            source: message.source || 'unknown'
                        });
                    } catch (error) {
                        console.error('❌ 處理按鈕可見性切換失敗:', error);
                        sendResponse({ 
                            success: false, 
                            error: error.message,
                            timestamp: Date.now()
                        });
                    }
                    break;

                case 'GET_TRANSLATION_STATUS':
                    const status = {
                        isTranslating: this.isTranslating,
                        translationVisible: this.translationVisible,
                        buttonVisibility: this.buttonManager?.button?.getVisibility(),
                        translationFunctionality: this.buttonManager?.button?.isTranslationFunctional(),
                        timestamp: Date.now()
                    };
                    sendResponse({ success: true, ...status });
                    break;

                case 'PING':
                    console.log('🏓 收到 PING 訊息:', message);
                    sendResponse({ 
                        success: true, 
                        pong: true,
                        timestamp: Date.now(),
                        requestTimestamp: message.timestamp,
                        contentScriptReady: true
                    });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Handle message error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * 清除所有翻譯內容
     */
    clearAllTranslations() {
        console.log('🧹 清除所有翻譯內容');

        // 清除渲染的翻譯內容
        if (this.translationRenderer) {
            this.translationRenderer.removeAllTranslations();
        }

        // 清除智能排程系統
        if (this.translationMode === 'smart-scheduling') {
            if (this.translationQueue) {
                this.translationQueue.clear();
                console.log('🧹 翻譯隊列已清空');
            }

            if (this.smartScheduler) {
                this.smartScheduler.cleanup();
                console.log('🧹 智能排程管理器已清理');
            }
        }

        // 清除舊版系統
        if (this.translationMode === 'legacy-viewport') {
            if (this.viewportManager) {
                this.viewportManager.stop();
            }

            if (this.boundaryDetector) {
                this.boundaryDetector.clearBoundaryCache();
            }
        }

        this.translationVisible = false;
        this.isTranslating = false;

        // 重置按鈕狀態
        if (this.buttonManager && this.buttonManager.button) {
            this.buttonManager.button.setState('idle');
        }

        console.log('✅ 所有翻譯內容已清除');
    }

    /**
     * 處理翻譯按鈕可見性切換
     */
    handleButtonVisibilityToggle(visible) {
        console.log('🔘 切換翻譯按鈕可見性:', visible);

        if (this.buttonManager && this.buttonManager.button) {
            // 獲取切換前的狀態
            const beforeState = this.buttonManager.button.getVisibility();
            console.log('切換前狀態:', beforeState);

            // 執行切換
            if (visible) {
                this.buttonManager.button.show();
                console.log('✅ 翻譯按鈕已顯示');
            } else {
                this.buttonManager.button.hide();
                console.log('✅ 翻譯按鈕已隱藏');
                console.log('ℹ️ 注意：隱藏按鈕不會影響翻譯功能的背景處理');
            }

            // 獲取切換後的狀態
            setTimeout(() => {
                const afterState = this.buttonManager.button.getVisibility();
                console.log('切換後狀態:', afterState);
            }, 350); // 等待動畫完成

        } else {
            console.log('⚠️ 翻譯按鈕管理器未初始化');
        }
    }

    /**
     * 載入按鈕可見性狀態
     */
    async loadButtonVisibilityState() {
        try {
            const result = await chrome.storage.local.get(['buttonVisibilityState']);
            const isVisible = result.buttonVisibilityState !== undefined ? result.buttonVisibilityState : true;
            
            console.log('🔘 載入按鈕可見性狀態:', isVisible);
            
            // 設定按鈕可見性（跳過動畫以避免頁面載入時的閃爍）
            if (this.buttonManager && this.buttonManager.button) {
                this.buttonManager.button.setVisibility(isVisible, true);
                console.log('✅ 按鈕可見性狀態已設定');
            } else {
                console.log('⚠️ 按鈕管理器尚未初始化，稍後重試');
                // 延遲重試
                setTimeout(() => {
                    if (this.buttonManager && this.buttonManager.button) {
                        this.buttonManager.button.setVisibility(isVisible, true);
                        console.log('✅ 延遲設定按鈕可見性狀態成功');
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('載入按鈕可見性狀態失敗:', error);
            // 預設顯示按鈕
            if (this.buttonManager && this.buttonManager.button) {
                this.buttonManager.button.setVisibility(true, true);
            }
        }
    }

    /**
     * 獲取翻譯統計資訊
     */
    getTranslationStats() {
        const stats = {
            translationMode: this.translationMode,
            translationVisible: this.translationVisible,
            isTranslating: this.isTranslating,
            timestamp: new Date().toISOString()
        };

        // 智能排程系統統計
        if (this.translationMode === 'smart-scheduling') {
            if (this.translationQueue) {
                const queueStatus = this.translationQueue.getStatus();
                stats.queue = queueStatus;
            }

            if (this.smartScheduler) {
                const schedulingStatus = this.smartScheduler.getSchedulingStatus();
                stats.scheduler = schedulingStatus;
            }
        }

        // 舊版系統統計
        if (this.translationMode === 'legacy-viewport') {
            stats.scrollTranslationEnabled = this.scrollTranslationEnabled;

            if (this.viewportManager) {
                const viewportStats = this.viewportManager.getStats();
                stats.viewport = viewportStats;
            }
        }

        // 渲染器統計
        if (this.translationRenderer) {
            const renderStats = this.translationRenderer.getRenderStats();
            stats.renderer = renderStats;
        }

        return stats;
    }

    /**
     * 銷毀翻譯系統，清理所有資源
     */
    destroy() {
        try {
            console.log('🧹 開始銷毀翻譯系統...');

            // 清除所有翻譯內容
            this.clearAllTranslations();

            // 銷毀各個組件（每個組件單獨處理錯誤）
            if (this.translationRenderer) {
                try {
                    this.translationRenderer.destroy();
                } catch (error) {
                    console.error('銷毀翻譯渲染器失敗:', error);
                }
                this.translationRenderer = null;
            }

            if (this.translationQueue) {
                // 清理隊列引用
                this.translationQueue = null;
            }

            if (this.smartScheduler) {
                // 清理排程器引用
                this.smartScheduler = null;
            }

            if (this.buttonManager) {
                try {
                    this.buttonManager.destroy();
                } catch (error) {
                    console.error('銷毀按鈕管理器失敗:', error);
                }
                this.buttonManager = null;
            }

            if (this.viewportManager) {
                this.viewportManager.stop();
                this.viewportManager = null;
            }

            if (this.boundaryDetector) {
                this.boundaryDetector.clearBoundaryCache();
                this.boundaryDetector = null;
            }

            if (this.contentAnalyzer) {
                this.contentAnalyzer = null;
            }

            // 清理事件監聽器
            this.removeEventListeners();

            // 重置狀態
            this.isTranslating = false;
            this.translationVisible = false;
            this.settings = null;

            console.log('✅ 翻譯系統銷毀完成');

        } catch (error) {
            console.error('❌ 銷毀翻譯系統時發生錯誤:', error);
        }
    }

    /**
     * 移除事件監聽器
     */
    removeEventListeners() {
        // 移除可能的事件監聽器
        // 這裡可以根據需要添加具體的事件監聽器清理邏輯
    }
}

// 頁面卸載時清理
window.addEventListener('beforeunload', () => {
    if (window.webTranslationContent) {
        window.webTranslationContent.destroy();
    }
});

// 初始化
window.webTranslationContent = new WebTranslationContent();