/**
 * 翻譯按鈕管理器
 * Translation Button Manager
 */

class TranslationButtonManager {
    constructor() {
        this.button = null;
        this.isInitialized = false;
        this.translationActive = false;
        this.translationVisible = true;
        
        // 綁定事件處理函數
        this.handleTranslationStart = this.handleTranslationStart.bind(this);
        this.handleTranslationToggle = this.handleTranslationToggle.bind(this);
        this.handleTranslationRetry = this.handleTranslationRetry.bind(this);
        
        this.init();
    }
    
    /**
     * 初始化按鈕管理器
     */
    init() {
        if (this.isInitialized) {
            console.log('按鈕管理器已經初始化，跳過');
            return;
        }
        
        try {
            console.log('開始初始化翻譯按鈕管理器...');
            
            // 檢查是否已存在翻譯按鈕
            const existingButton = document.getElementById('web-translation-button-container');
            if (existingButton) {
                console.log('移除現有的翻譯按鈕');
                existingButton.remove();
            }
            
            // 檢查 TranslationButton 類是否可用
            if (typeof TranslationButton === 'undefined') {
                throw new Error('TranslationButton 類未定義');
            }
            
            // 創建新的翻譯按鈕
            console.log('正在創建 TranslationButton...');
            this.button = new TranslationButton();
            console.log('TranslationButton 創建成功:', this.button);
            
            // 附加事件監聽器
            console.log('附加事件監聽器...');
            this.attachEventListeners();
            
            // 顯示按鈕
            console.log('顯示翻譯按鈕...');
            this.button.show();
            
            this.isInitialized = true;
            console.log('翻譯按鈕管理器初始化完成');
            
        } catch (error) {
            console.error('翻譯按鈕初始化失敗:', error);
            console.error('錯誤堆疊:', error.stack);
        }
    }
    
    /**
     * 附加事件監聽器
     */
    attachEventListeners() {
        if (!this.button) return;
        
        // 監聽翻譯按鈕事件
        document.addEventListener('translationButton:translationStart', this.handleTranslationStart);
        document.addEventListener('translationButton:translationToggle', this.handleTranslationToggle);
        document.addEventListener('translationButton:translationRetry', this.handleTranslationRetry);
    }
    
    /**
     * 處理翻譯開始事件
     */
    async handleTranslationStart(event) {
        console.log('開始翻譯網頁內容');
        
        try {
            // 設定翻譯狀態
            this.translationActive = true;
            
            // 這裡將來會調用翻譯管理器
            // 目前先模擬翻譯過程
            await this.simulateTranslation();
            
        } catch (error) {
            console.error('翻譯過程發生錯誤:', error);
            this.button.onTranslationError(error.message);
        }
    }
    
    /**
     * 處理翻譯顯示切換事件
     */
    handleTranslationToggle(event) {
        console.log('切換翻譯顯示狀態');
        
        // 切換翻譯內容的顯示狀態
        this.translationVisible = !this.translationVisible;
        this.toggleTranslationVisibility(this.translationVisible);
        
        // 更新按鈕狀態提示
        const tooltip = this.translationVisible ? '點擊隱藏翻譯' : '點擊顯示翻譯';
        this.button.tooltip.textContent = tooltip;
    }
    
    /**
     * 處理翻譯重試事件
     */
    async handleTranslationRetry(event) {
        console.log('重試翻譯');
        
        try {
            // 重新開始翻譯
            await this.simulateTranslation();
            
        } catch (error) {
            console.error('重試翻譯失敗:', error);
            this.button.onTranslationError(error.message);
        }
    }
    
    /**
     * 模擬翻譯過程（臨時用於測試）
     */
    async simulateTranslation() {
        return new Promise((resolve, reject) => {
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 10 + 5;
                
                if (progress >= 100) {
                    progress = 100;
                    this.button.showProgress(progress);
                    this.button.onTranslationComplete();
                    clearInterval(interval);
                    resolve();
                } else {
                    this.button.showProgress(progress);
                }
            }, 300);
            
            // 移除模擬錯誤邏輯 - 這會干擾實際翻譯功能
        });
    }
    
    /**
     * 切換翻譯內容的顯示狀態
     * @param {boolean} visible - 是否顯示
     */
    toggleTranslationVisibility(visible) {
        const translationElements = document.querySelectorAll('.web-translation-content');
        
        translationElements.forEach(element => {
            if (visible) {
                element.classList.remove('web-translation-hidden');
                element.classList.add('web-translation-fade-in');
            } else {
                element.classList.add('web-translation-hidden');
                element.classList.remove('web-translation-fade-in');
            }
        });
        
        console.log(`翻譯內容${visible ? '顯示' : '隱藏'}: ${translationElements.length}個元素`);
    }
    
    /**
     * 更新翻譯進度
     * @param {number} progress - 進度百分比
     * @param {string} message - 進度訊息
     */
    updateProgress(progress, message = '') {
        if (this.button) {
            this.button.showProgress(progress);
            
            if (message) {
                this.button.tooltip.textContent = message;
            }
        }
    }
    
    /**
     * 設定按鈕狀態
     * @param {string} state - 狀態
     */
    setState(state) {
        if (this.button) {
            this.button.setState(state);
        }
    }
    
    /**
     * 翻譯完成回調
     */
    onTranslationComplete() {
        if (this.button) {
            this.button.onTranslationComplete();
        }
        this.translationActive = false;
    }
    
    /**
     * 翻譯錯誤回調
     * @param {string} error - 錯誤訊息
     */
    onTranslationError(error) {
        if (this.button) {
            this.button.onTranslationError(error);
        }
        this.translationActive = false;
    }
    
    /**
     * 檢查翻譯是否活躍
     * @returns {boolean} 是否正在翻譯
     */
    isTranslationActive() {
        return this.translationActive;
    }
    
    /**
     * 檢查翻譯是否可見
     * @returns {boolean} 翻譯內容是否可見
     */
    isTranslationVisible() {
        return this.translationVisible;
    }
    
    /**
     * 顯示按鈕
     */
    show() {
        if (this.button) {
            this.button.show();
        }
    }
    
    /**
     * 隱藏按鈕
     */
    hide() {
        if (this.button) {
            this.button.hide();
        }
    }
    
    /**
     * 銷毀按鈕管理器
     */
    destroy() {
        // 移除事件監聽器
        document.removeEventListener('translationButton:translationStart', this.handleTranslationStart);
        document.removeEventListener('translationButton:translationToggle', this.handleTranslationToggle);
        document.removeEventListener('translationButton:translationRetry', this.handleTranslationRetry);
        
        // 銷毀按鈕
        if (this.button) {
            this.button.destroy();
            this.button = null;
        }
        
        this.isInitialized = false;
        this.translationActive = false;
        
        console.log('翻譯按鈕管理器已銷毀');
    }
    
    /**
     * 重新初始化
     */
    reinitialize() {
        this.destroy();
        setTimeout(() => {
            this.init();
        }, 100);
    }
}

// 匯出類別
window.TranslationButtonManager = TranslationButtonManager;