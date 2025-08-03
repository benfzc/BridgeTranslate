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
        this.boundaryDetector = null;
        this.viewportManager = null;
        this.scrollTranslationEnabled = true;
        this.translationMode = 'scroll'; // 預設使用智能滾動翻譯

        this.init();
    }

    async init() {
        try {
            // 載入設定
            await this.loadSettings();
            
            // 創建組件
            this.createComponents();
            
            // 綁定事件
            this.attachEvents();
            
            console.log('Web Translation Extension loaded');
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
            console.log('開始創建組件...');
            
            // 檢查依賴是否載入
            const dependencies = {
                ContentAnalyzer: typeof ContentAnalyzer,
                TranslationRenderer: typeof TranslationRenderer,
                TranslationBoundaryDetector: typeof TranslationBoundaryDetector,
                ViewportTranslationManager: typeof ViewportTranslationManager,
                TranslationButtonManager: typeof TranslationButtonManager
            };
            console.log('依賴檢查:', dependencies);
            
            // 檢查是否有未定義的依賴
            const undefinedDeps = Object.entries(dependencies)
                .filter(([name, type]) => type === 'undefined')
                .map(([name]) => name);
            
            if (undefinedDeps.length > 0) {
                console.error('以下依賴未正確載入:', undefinedDeps);
                throw new Error(`依賴載入失敗: ${undefinedDeps.join(', ')}`);
            }

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
            console.log('正在創建按鈕管理器...');
            this.buttonManager = new TranslationButtonManager();
            console.log('按鈕管理器創建完成:', this.buttonManager);
            
            // 檢查按鈕是否正確創建
            if (this.buttonManager && this.buttonManager.button) {
                console.log('翻譯按鈕創建成功');
            } else {
                console.warn('翻譯按鈕創建可能有問題');
            }
            
            console.log('所有組件創建完成');

        } catch (error) {
            console.error('創建組件失敗:', error);
            console.error('錯誤詳情:', error.stack);
            
            // 降級到簡單模式
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
            if (this.isTranslating) {
                return; // 正在翻譯中，忽略點擊
            }

            if (this.translationVisible) {
                this.hideTranslations();
            } else {
                await this.startTranslation();
            }
        } catch (error) {
            console.error('Toggle translation failed:', error);
            this.showError('翻譯功能啟動失敗：' + error.message);
        }
    }

    async startTranslation() {
        console.log('開始翻譯，當前設定:', this.settings);
        
        // 檢查是否已設定 API
        if (!this.settings?.apiConfiguration?.provider || !this.settings?.apiConfiguration?.apiKey) {
            console.log('API 設定檢查失敗:', {
                provider: this.settings?.apiConfiguration?.provider,
                hasApiKey: !!this.settings?.apiConfiguration?.apiKey
            });
            
            this.showError('請先在設定中配置 AI 翻譯服務');
            return;
        }
        
        console.log('API 設定檢查通過，開始智能滾動翻譯');

        this.isTranslating = true;

        try {
            // 使用視窗翻譯管理器
            if (this.viewportManager) {
                console.log('啟動視窗翻譯管理器');
                this.viewportManager.start();
                this.translationVisible = true;
            } else {
                console.error('視窗翻譯管理器未初始化');
                throw new Error('視窗翻譯管理器未初始化');
            }

        } catch (error) {
            console.error('Translation failed:', error);
            this.showError('翻譯失敗：' + error.message);
        } finally {
            this.isTranslating = false;
        }
    }
    
    /**
     * 隱藏翻譯內容
     */
    hideTranslations() {
        try {
            if (this.translationRenderer) {
                this.translationRenderer.toggleTranslationVisibility(false);
            }
            
            if (this.viewportManager) {
                this.viewportManager.stop();
            }
            
            this.translationVisible = false;
            
            console.log('翻譯內容已隱藏');
        } catch (error) {
            console.error('隱藏翻譯時發生錯誤:', error);
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
        if (this.translationRenderer) {
            this.translationRenderer.removeAllTranslations();
        }
        
        if (this.viewportManager) {
            this.viewportManager.stop();
        }
        
        if (this.boundaryDetector) {
            this.boundaryDetector.clearBoundaryCache();
        }
        
        this.translationVisible = false;
        this.isTranslating = false;
        
        console.log('所有翻譯內容已清除');
    }
    
    /**
     * 獲取翻譯統計資訊
     */
    getTranslationStats() {
        const stats = {
            scrollTranslationEnabled: this.scrollTranslationEnabled,
            translationVisible: this.translationVisible,
            isTranslating: this.isTranslating
        };
        
        if (this.viewportManager) {
            const viewportStats = this.viewportManager.getStats();
            stats.viewport = viewportStats;
        }
        
        if (this.translationRenderer) {
            const renderStats = this.translationRenderer.getRenderStats();
            stats.renderer = renderStats;
        }
        
        return stats;
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