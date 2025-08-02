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
        this.createButton();
        this.attachEventListeners();
        this.setState('idle');
    }
    
    /**
     * 創建按鈕DOM結構
     */
    createButton() {
        // 創建容器
        this.container = document.createElement('div');
        this.container.className = 'translation-button-container';
        this.container.id = 'web-translation-button-container';
        
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
        document.body.appendChild(this.container);
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
     */
    handleClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // 根據當前狀態執行不同操作
        switch (this.currentState) {
            case 'idle':
                this.startTranslation();
                break;
            case 'completed':
                this.toggleTranslationVisibility();
                break;
            case 'error':
                this.retryTranslation();
                break;
            case 'translating':
                // 翻譯中不允許點擊
                break;
        }
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
        if (this.container && !this.isVisible) {
            this.container.style.display = 'block';
            this.isVisible = true;
            
            // 添加淡入動畫
            setTimeout(() => {
                this.container.style.opacity = '1';
                this.container.style.transform = 'scale(1)';
            }, 10);
        }
    }
    
    /**
     * 隱藏按鈕
     */
    hide() {
        if (this.container && this.isVisible) {
            this.container.style.opacity = '0';
            this.container.style.transform = 'scale(0.8)';
            
            setTimeout(() => {
                this.container.style.display = 'none';
                this.isVisible = false;
            }, 300);
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