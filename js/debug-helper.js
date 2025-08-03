/**
 * 調試輔助工具
 * Debug Helper for Bridge Translate
 */

class DebugHelper {
    constructor() {
        this.logs = [];
        this.errors = [];
        this.maxLogs = 1000;
        this.isEnabled = true;

        // 捕獲所有未處理的錯誤
        this.setupGlobalErrorHandling();

        console.log('🔍 DebugHelper 初始化完成');
    }

    /**
     * 設置全局錯誤處理
     */
    setupGlobalErrorHandling() {
        // 捕獲未處理的 Promise 錯誤
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('Unhandled Promise Rejection', event.reason, {
                promise: event.promise,
                stack: event.reason?.stack
            });
        });

        // 捕獲全局錯誤
        window.addEventListener('error', (event) => {
            this.logError('Global Error', event.error, {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });

        // 重寫 console.error 來捕獲所有錯誤 (但避免無限循環)
        const originalError = console.error;
        let isLoggingError = false;
        console.error = (...args) => {
            if (!isLoggingError) {
                isLoggingError = true;
                try {
                    this.logError('Console Error', args[0], { args: args });
                } catch (e) {
                    // 避免錯誤循環
                }
                isLoggingError = false;
            }
            originalError.apply(console, args);
        };
    }

    /**
     * 記錄調試信息
     */
    log(category, message, data = null) {
        if (!this.isEnabled) return;

        const logEntry = {
            timestamp: new Date().toISOString(),
            category: category,
            message: message,
            data: data,
            stack: new Error().stack
        };

        this.logs.push(logEntry);

        // 限制日誌數量
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        console.log(`🔍 [${category}] ${message}`, data);
    }

    /**
     * 記錄錯誤
     */
    logError(category, error, additionalData = null) {
        const errorMessage = error?.message || String(error);

        // 避免記錄重複的錯誤
        const recentErrors = this.errors.slice(-10);
        const isDuplicate = recentErrors.some(err =>
            err.category === category && err.message === errorMessage
        );

        if (isDuplicate) {
            return; // 跳過重複錯誤
        }

        const errorEntry = {
            timestamp: new Date().toISOString(),
            category: category,
            error: error,
            message: errorMessage,
            stack: error?.stack,
            additionalData: additionalData
        };

        this.errors.push(errorEntry);

        // 限制錯誤數量
        if (this.errors.length > this.maxLogs) {
            this.errors.shift();
        }

        // 只在控制台顯示前幾個錯誤，避免刷屏
        if (this.errors.length <= 20) {
            console.error(`❌ [${category}] ${errorEntry.message}`, {
                error: error,
                stack: errorEntry.stack,
                additionalData: additionalData
            });
        }
    }

    /**
     * 安全地檢查對象屬性
     */
    safeCheck(obj, path, defaultValue = null) {
        try {
            const keys = path.split('.');
            let current = obj;

            for (const key of keys) {
                if (current === null || current === undefined) {
                    this.log('SafeCheck', `Path ${path} failed at key: ${key}`, { obj, path });
                    return defaultValue;
                }
                current = current[key];
            }

            return current;
        } catch (error) {
            this.logError('SafeCheck', error, { obj, path, defaultValue });
            return defaultValue;
        }
    }

    /**
     * 檢查 DOM 節點的詳細信息
     */
    inspectNode(node, label = 'Node') {
        if (!node) {
            this.log('NodeInspect', `${label} is null/undefined`);
            return null;
        }

        const nodeInfo = {
            nodeType: node.nodeType,
            nodeName: node.nodeName,
            tagName: node.tagName,
            className: node.className,
            id: node.id,
            textContent: node.textContent ? node.textContent.substring(0, 100) + '...' : null,
            parentElement: node.parentElement ? {
                tagName: node.parentElement.tagName,
                className: node.parentElement.className,
                id: node.parentElement.id
            } : null,
            hasTagName: !!node.tagName,
            hasClassName: !!node.className,
            hasParentElement: !!node.parentElement
        };

        this.log('NodeInspect', `${label} details:`, nodeInfo);
        return nodeInfo;
    }

    /**
     * 檢查函數調用堆疊
     */
    inspectCallStack(label = 'CallStack') {
        const stack = new Error().stack;
        const stackLines = stack.split('\n').slice(2, 10); // 跳過前兩行，取前8行

        this.log('CallStack', `${label}:`, stackLines);
        return stackLines;
    }

    /**
     * 安全地執行函數
     */
    safeExecute(fn, context = null, args = [], errorLabel = 'SafeExecute') {
        try {
            return fn.apply(context, args);
        } catch (error) {
            this.logError(errorLabel, error, {
                functionName: fn.name,
                context: context,
                args: args
            });
            return null;
        }
    }

    /**
     * 獲取所有日誌
     */
    getAllLogs() {
        return {
            logs: this.logs,
            errors: this.errors,
            summary: {
                totalLogs: this.logs.length,
                totalErrors: this.errors.length,
                recentErrors: this.errors.slice(-5)
            }
        };
    }

    /**
     * 清空日誌
     */
    clearLogs() {
        this.logs = [];
        this.errors = [];
        console.log('🔍 Debug logs cleared');
    }

    /**
     * 導出日誌到控制台
     */
    exportLogs() {
        console.group('🔍 Debug Helper - All Logs');
        console.log('Recent Logs:', this.logs.slice(-20));
        console.log('All Errors:', this.errors);
        console.groupEnd();
    }

    /**
     * 創建調試面板
     */
    createDebugPanel() {
        // 檢查是否已存在
        if (document.getElementById('debug-helper-panel')) {
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'debug-helper-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            width: 300px;
            max-height: 400px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            font-family: monospace;
            font-size: 12px;
            padding: 10px;
            border-radius: 5px;
            z-index: 999999;
            overflow-y: auto;
            border: 2px solid #007bff;
        `;

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong>🔍 Debug Panel</strong>
                <button onclick="window.debugHelper.togglePanel()" style="background: #007bff; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">Hide</button>
            </div>
            <div id="debug-content">
                <div>Logs: <span id="log-count">0</span></div>
                <div>Errors: <span id="error-count">0</span></div>
                <div style="margin-top: 10px;">
                    <button onclick="window.debugHelper.exportLogs()" style="background: #28a745; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; margin-right: 5px;">Export</button>
                    <button onclick="window.debugHelper.clearLogs()" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer;">Clear</button>
                </div>
                <div id="recent-errors" style="margin-top: 10px; max-height: 200px; overflow-y: auto;"></div>
            </div>
        `;

        document.body.appendChild(panel);
        this.panel = panel;

        // 定期更新面板
        setInterval(() => this.updateDebugPanel(), 2000);
    }

    /**
     * 更新調試面板
     */
    updateDebugPanel() {
        if (!this.panel) return;

        const logCount = document.getElementById('log-count');
        const errorCount = document.getElementById('error-count');
        const recentErrors = document.getElementById('recent-errors');

        if (logCount) logCount.textContent = this.logs.length;
        if (errorCount) errorCount.textContent = this.errors.length;

        if (recentErrors) {
            const recent = this.errors.slice(-3);
            recentErrors.innerHTML = recent.map(err =>
                `<div style="background: rgba(255,0,0,0.2); padding: 5px; margin: 2px 0; border-radius: 3px;">
                    <div style="font-weight: bold;">${err.category}</div>
                    <div style="font-size: 10px;">${err.message}</div>
                    <div style="font-size: 9px; color: #ccc;">${err.timestamp}</div>
                </div>`
            ).join('');
        }
    }

    /**
     * 切換調試面板顯示
     */
    togglePanel() {
        if (this.panel) {
            this.panel.style.display = this.panel.style.display === 'none' ? 'block' : 'none';
        }
    }
}

// 創建全局調試實例
window.debugHelper = new DebugHelper();

// 匯出類別
window.DebugHelper = DebugHelper;