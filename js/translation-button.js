/**
 * 翻譯按鈕UI元件
 * Translation Button UI Component
 */

class TranslationButton {
    constructor() {
        this.container = null;
        this.button = null;
        this.progressRing = null;
        this.statusIndicator = null;
        this.tooltip = null;
        this.currentState = 'idle';
        this.progress = 0;
        this.isVisible = false;
        
        // 綁定事件處理函數
        this.handleClick = this.handleClick.bind(this);
        this.handleMouseEnter = this.handleMouseEnter.bind(this);
        this.handleMouseLeave = this.handleMouseLeave.bind(this);
        
        // 初始化按鈕
        this.init();
    }
    
    /**
     * 初始化翻譯按鈕
     */
    init() {
        console.log('開始初始化 TranslationButton...');
        
        try {
            console.log('創建按鈕 DOM...');
            this.createButton();
            
            console.log('附加事件監聽器...');
            this.attachEventListeners();
            
            console.log('設定初始狀態...');
            this.setState('idle');
            
            console.log('TranslationButton 初始化完成');
        } catch (error) {
            console.error('TranslationButton 初始化失敗:', error);
            console.error('錯誤堆疊:', error.stack);
        }
    }
    
    /**
     * 創建按鈕DOM結構
     */
    createButton() {
        console.log('創建按鈕容器...');
        
        // 創建容器
        this.container = document.createElement('div');
        this.container.className = 'translation-button-container';
        this.container.id = 'web-translation-button-container';
        console.log('容器創建完成:', this.container);
        
        // 創建主按鈕
        this.button = document.createElement('button');
        this.button.className = 'translation-button idle';
        this.button.setAttribute('aria-label', '翻譯網頁');
        this.button.setAttribute('title', '點擊開始翻譯');
        
        // 創建按鈕圖示
        const icon = document.createElement('span');
        icon.className = 'translation-button-icon';
        icon.innerHTML = '🌐';
        this.button.appendChild(icon);
        
        // 創建進度環
        this.createProgressRing();
        
        // 創建狀態指示器
        this.statusIndicator = document.createElement('div');
        this.statusIndicator.className = 'translation-status-indicator idle';
        this.statusIndicator.innerHTML = '●';
        
        // 創建工具提示
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'translation-tooltip';
        this.tooltip.textContent = '點擊開始翻譯';
        
        // 組裝元素
        this.container.appendChild(this.button);
        this.container.appendChild(this.statusIndicator);
        this.container.appendChild(this.tooltip);
        
        // 添加到頁面
        console.log('將按鈕添加到頁面...');
        if (document.body) {
            document.body.appendChild(this.container);
            console.log('按鈕已添加到頁面');
        } else {
            console.error('document.body 不存在，無法添加按鈕');
        }
    }
    
    /**
     * 創建進度環SVG
     */
    createProgressRing() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'translation-progress-ring');
        svg.setAttribute('width', '60');
        svg.setAttribute('height', '60');
        
        // 背景圓環
        const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bgCircle.setAttribute('class', 'translation-progress-circle');
        bgCircle.setAttribute('cx', '30');
        bgCircle.setAttribute('cy', '30');
        bgCircle.setAttribute('r', '26');
        
        // 進度圓環
        const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        progressCircle.setAttribute('class', 'translation-progress-circle progress');
        progressCircle.setAttribute('cx', '30');
        progressCircle.setAttribute('cy', '30');
        progressCircle.setAttribute('r', '26');
        
        const circumference = 2 * Math.PI * 26;
        progressCircle.style.strokeDasharray = circumference;
        progressCircle.style.strokeDashoffset = circumference;
        
        svg.appendChild(bgCircle);
        svg.appendChild(progressCircle);
        
        this.progressRing = progressCircle;
        this.button.appendChild(svg);
    }
    
    /**
     * 附加事件監聽器
     */
    attachEventListeners() {
        this.button.addEventListener('click', this.handleClick);
        this.container.addEventListener('mouseenter', this.handleMouseEnter);
        this.container.addEventListener('mouseleave', this.handleMouseLeave);
    }
    
    /**
     * 處理按鈕點擊事件
     * 注意：實際的點擊邏輯由 WebTranslationContent 處理，這裡只做基本的事件處理
     */
    handleClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // 不在這裡處理具體的翻譯邏輯，讓主系統 (WebTranslationContent) 處理
        // 這樣可以避免雙重事件處理和邏輯衝突
        console.log('🔘 翻譯按鈕被點擊，狀態:', this.currentState);
    }
    
    /**
     * 處理滑鼠進入事件
     */
    handleMouseEnter() {
        // 可以在這裡添加額外的懸停效果
    }
    
    /**
     * 處理滑鼠離開事件
     */
    handleMouseLeave() {
        // 可以在這裡添加額外的懸停效果
    }
    
    /**
     * 設定按鈕狀態
     * @param {string} state - 狀態：'idle', 'translating', 'completed', 'error'
     */
    setState(state) {
        if (!['idle', 'translating', 'completed', 'error'].includes(state)) {
            console.warn('無效的按鈕狀態:', state);
            return;
        }
        
        // 移除舊狀態類別
        this.button.classList.remove('idle', 'translating', 'completed', 'error');
        this.statusIndicator.classList.remove('idle', 'translating', 'completed', 'error');
        
        // 添加新狀態類別
        this.button.classList.add(state);
        this.statusIndicator.classList.add(state);
        
        // 更新狀態
        this.currentState = state;
        
        // 更新按鈕內容和提示
        this.updateButtonContent(state);
        this.updateTooltip(state);
        
        // 觸發狀態變更事件
        this.dispatchStateChangeEvent(state);
    }
    
    /**
     * 更新按鈕內容
     * @param {string} state - 當前狀態
     */
    updateButtonContent(state) {
        const icon = this.button.querySelector('.translation-button-icon');
        const statusIndicator = this.statusIndicator;
        
        switch (state) {
            case 'idle':
                icon.innerHTML = '🌐';
                statusIndicator.innerHTML = '●';
                this.button.setAttribute('aria-label', '翻譯網頁');
                break;
            case 'translating':
                icon.innerHTML = '⚡';
                statusIndicator.innerHTML = '⏳';
                this.button.setAttribute('aria-label', '翻譯中...');
                break;
            case 'completed':
                icon.innerHTML = '✓';
                statusIndicator.innerHTML = '✓';
                this.button.setAttribute('aria-label', '翻譯完成，點擊切換顯示');
                break;
            case 'error':
                icon.innerHTML = '⚠';
                statusIndicator.innerHTML = '!';
                this.button.setAttribute('aria-label', '翻譯失敗，點擊重試');
                break;
        }
    }
    
    /**
     * 更新工具提示
     * @param {string} state - 當前狀態
     */
    updateTooltip(state) {
        const messages = {
            idle: '點擊開始翻譯',
            translating: '翻譯進行中...',
            completed: '翻譯完成，點擊切換顯示',
            error: '翻譯失敗，點擊重試'
        };
        
        this.tooltip.textContent = messages[state] || '翻譯按鈕';
    }
    
    /**
     * 顯示進度
     * @param {number} percentage - 進度百分比 (0-100)
     */
    showProgress(percentage) {
        if (percentage < 0 || percentage > 100) {
            console.warn('進度百分比必須在0-100之間:', percentage);
            return;
        }
        
        this.progress = percentage;
        
        if (this.progressRing) {
            const circumference = 2 * Math.PI * 26;
            const offset = circumference - (percentage / 100) * circumference;
            this.progressRing.style.strokeDashoffset = offset;
        }
        
        // 更新工具提示顯示進度
        if (this.currentState === 'translating') {
            this.tooltip.textContent = `翻譯進行中... ${Math.round(percentage)}%`;
        }
    }
    
    /**
     * 顯示按鈕
     */
    show() {
        console.log('顯示翻譯按鈕...');
        
        if (this.container && !this.isVisible) {
            console.log('設定按鈕顯示樣式...');
            this.container.style.display = 'block';
            this.container.style.opacity = '0';
            this.container.style.transform = 'scale(0.8)';
            this.isVisible = true;
            
            // 添加淡入動畫
            setTimeout(() => {
                this.container.style.opacity = '1';
                this.container.style.transform = 'scale(1)';
                console.log('按鈕淡入動畫完成');
            }, 10);
            
            console.log('翻譯按鈕已顯示');
        } else if (!this.container) {
            console.error('按鈕容器不存在，無法顯示');
        } else if (this.isVisible) {
            console.log('按鈕已經可見，跳過顯示');
        }
    }
    
    /**
     * 隱藏按鈕
     * 注意：隱藏按鈕不會影響翻譯功能的背景處理
     */
    hide() {
        console.log('隱藏翻譯按鈕...');
        
        if (this.container && this.isVisible) {
            console.log('設定按鈕隱藏樣式...');
            this.container.style.opacity = '0';
            this.container.style.transform = 'scale(0.8)';
            
            // 立即更新狀態，避免狀態檢查的時間差問題
            this.isVisible = false;
            
            setTimeout(() => {
                if (this.container) { // 確保容器仍然存在
                    this.container.style.display = 'none';
                    console.log('翻譯按鈕已隱藏');
                }
            }, 300);
        } else if (!this.container) {
            console.error('按鈕容器不存在，無法隱藏');
        } else if (!this.isVisible) {
            console.log('按鈕已經隱藏，跳過隱藏');
        }
    }
    
    /**
     * 切換按鈕顯示狀態
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * 獲取按鈕可見性狀態
     */
    getVisibility() {
        return {
            isVisible: this.isVisible,
            containerExists: !!this.container,
            displayStyle: this.container ? this.container.style.display : null,
            opacity: this.container ? this.container.style.opacity : null
        };
    }

    /**
     * 強制設定按鈕可見性（用於狀態恢復）
     */
    setVisibility(visible, skipAnimation = false) {
        console.log('強制設定按鈕可見性:', visible);
        
        if (!this.container) {
            console.error('按鈕容器不存在，無法設定可見性');
            return;
        }

        if (visible) {
            if (skipAnimation) {
                this.container.style.display = 'block';
                this.container.style.opacity = '1';
                this.container.style.transform = 'scale(1)';
                this.isVisible = true;
                console.log('按鈕可見性已設定為顯示（無動畫）');
            } else {
                this.show();
            }
        } else {
            if (skipAnimation) {
                this.container.style.display = 'none';
                this.container.style.opacity = '0';
                this.container.style.transform = 'scale(0.8)';
                this.isVisible = false;
                console.log('按鈕可見性已設定為隱藏（無動畫）');
            } else {
                this.hide();
            }
        }
    }

    /**
     * 檢查翻譯功能是否正常運行（不依賴按鈕可見性）
     */
    isTranslationFunctional() {
        return {
            hasContainer: !!this.container,
            hasButton: !!this.button,
            currentState: this.currentState,
            canStartTranslation: this.currentState === 'idle',
            canToggleVisibility: this.currentState === 'completed',
            canRetry: this.currentState === 'error',
            isVisible: this.isVisible,
            functionalityNote: '翻譯功能不依賴按鈕可見性，隱藏按鈕不會影響翻譯處理'
        };
    }
    
    /**
     * 開始翻譯
     */
    startTranslation() {
        this.setState('translating');
        this.showProgress(0);
        
        // 觸發翻譯開始事件
        this.dispatchEvent('translationStart');
    }
    
    /**
     * 切換翻譯顯示狀態
     */
    toggleTranslationVisibility() {
        // 觸發切換顯示事件
        this.dispatchEvent('translationToggle');
    }
    
    /**
     * 重試翻譯
     */
    retryTranslation() {
        this.setState('translating');
        this.showProgress(0);
        
        // 觸發重試事件
        this.dispatchEvent('translationRetry');
    }
    
    /**
     * 翻譯完成
     */
    onTranslationComplete() {
        this.setState('completed');
        this.showProgress(100);
    }
    
    /**
     * 翻譯失敗
     * @param {string} error - 錯誤訊息
     */
    onTranslationError(error) {
        this.setState('error');
        this.showProgress(0);
        
        // 更新工具提示顯示錯誤訊息
        this.tooltip.textContent = `翻譯失敗: ${error}`;
    }
    
    /**
     * 觸發自定義事件
     * @param {string} eventType - 事件類型
     * @param {Object} detail - 事件詳情
     */
    dispatchEvent(eventType, detail = {}) {
        const event = new CustomEvent(`translationButton:${eventType}`, {
            detail: {
                state: this.currentState,
                progress: this.progress,
                ...detail
            }
        });
        
        document.dispatchEvent(event);
    }
    
    /**
     * 觸發狀態變更事件
     * @param {string} newState - 新狀態
     */
    dispatchStateChangeEvent(newState) {
        this.dispatchEvent('stateChange', {
            previousState: this.currentState,
            newState: newState
        });
    }
    
    /**
     * 銷毀按鈕
     */
    destroy() {
        if (this.container) {
            // 移除事件監聽器
            this.button.removeEventListener('click', this.handleClick);
            this.container.removeEventListener('mouseenter', this.handleMouseEnter);
            this.container.removeEventListener('mouseleave', this.handleMouseLeave);
            
            // 移除DOM元素
            this.container.remove();
            
            // 清理引用
            this.container = null;
            this.button = null;
            this.progressRing = null;
            this.statusIndicator = null;
            this.tooltip = null;
            this.isVisible = false;
        }
    }
    
    /**
     * 獲取當前狀態
     * @returns {string} 當前狀態
     */
    getState() {
        return this.currentState;
    }
    
    /**
     * 獲取當前進度
     * @returns {number} 當前進度百分比
     */
    getProgress() {
        return this.progress;
    }
    
    /**
     * 檢查按鈕是否可見
     * @returns {boolean} 是否可見
     */
    isButtonVisible() {
        return this.isVisible;
    }
}

// 匯出類別
window.TranslationButton = TranslationButton;