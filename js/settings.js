// Settings Script
// 處理設定頁面的邏輯

class SettingsController {
    constructor() {
        this.settings = {
            apiConfiguration: {},
            translationPreferences: {},
            usageStats: {}
        };
        this.supportedProviders = [];
        this.isKeyVisible = false;
        
        this.init();
    }

    async init() {
        // 初始化 UI 元素
        this.initializeElements();
        
        // 綁定事件監聽器
        this.bindEventListeners();
        
        // 載入資料
        await this.loadSupportedProviders();
        await this.loadSettings();
        await this.loadUsageStats();
        
        // 更新 UI
        this.updateUI();
    }

    initializeElements() {
        this.elements = {
            // API 設定
            apiProvider: document.getElementById('apiProvider'),
            apiKey: document.getElementById('apiKey'),
            apiModel: document.getElementById('apiModel'),
            maxTokens: document.getElementById('maxTokens'),
            validateKey: document.getElementById('validateKey'),
            toggleKeyVisibility: document.getElementById('toggleKeyVisibility'),
            getApiKey: document.getElementById('getApiKey'),
            validationResult: document.getElementById('validationResult'),
            advancedSettings: document.getElementById('advancedSettings'),
            
            // 翻譯偏好
            targetLanguage: document.getElementById('targetLanguage'),
            translationPosition: document.getElementById('translationPosition'),

            autoTranslateVisible: document.getElementById('autoTranslateVisible'),
            excludeSelectors: document.getElementById('excludeSelectors'),
            
            // 使用統計
            totalTranslations: document.getElementById('totalTranslations'),
            tokensUsed: document.getElementById('tokensUsed'),
            estimatedCost: document.getElementById('estimatedCost'),
            lastResetDate: document.getElementById('lastResetDate'),
            refreshStats: document.getElementById('refreshStats'),
            resetStats: document.getElementById('resetStats'),
            checkQuota: document.getElementById('checkQuota'),
            
            // 控制按鈕
            saveSettings: document.getElementById('saveSettings'),
            resetSettings: document.getElementById('resetSettings'),
            exportSettings: document.getElementById('exportSettings')
        };
    }

    bindEventListeners() {
        // API 提供商變更
        this.elements.apiProvider.addEventListener('change', () => {
            this.handleProviderChange();
        });

        // API 金鑰相關
        this.elements.apiKey.addEventListener('input', () => {
            this.clearValidationResult();
        });
        
        this.elements.validateKey.addEventListener('click', () => {
            this.validateAPIKey();
        });
        
        this.elements.toggleKeyVisibility.addEventListener('click', () => {
            this.toggleKeyVisibility();
        });
        
        this.elements.getApiKey.addEventListener('click', () => {
            this.showApiKeyHelp();
        });

        // 統計相關
        this.elements.refreshStats.addEventListener('click', () => {
            this.loadUsageStats();
        });
        
        this.elements.resetStats.addEventListener('click', () => {
            this.resetUsageStats();
        });
        
        this.elements.checkQuota.addEventListener('click', () => {
            this.checkAPIQuota();
        });

        // 設定控制
        this.elements.saveSettings.addEventListener('click', () => {
            this.saveSettings();
        });

        this.elements.resetSettings.addEventListener('click', () => {
            this.resetSettings();
        });
        
        this.elements.exportSettings.addEventListener('click', () => {
            this.exportSettings();
        });

        // 排除選擇器輸入提示
        this.elements.excludeSelectors.addEventListener('focus', () => {
            this.showExcludeSelectorHelp();
        });
    }

    async loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
            if (response.success) {
                this.settings = response.data;
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.showError('載入設定失敗');
        }
    }

    async loadUsageStats() {
        try {
            this.elements.refreshStats.disabled = true;
            this.elements.refreshStats.textContent = '載入中...';
            
            const response = await chrome.runtime.sendMessage({ type: 'GET_USAGE_STATS' });
            if (response.success) {
                this.settings.usageStats = response.stats;
                this.updateUsageStatsUI();
                this.showSuccess('統計資料已更新');
            }
        } catch (error) {
            console.error('Failed to load usage stats:', error);
            this.showError('載入統計失敗');
        } finally {
            this.elements.refreshStats.disabled = false;
            this.elements.refreshStats.textContent = '刷新統計';
        }
    }
    
    async loadSupportedProviders() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_SUPPORTED_PROVIDERS' });
            if (response.success) {
                this.supportedProviders = response.providers;
                this.updateProviderOptions();
            }
        } catch (error) {
            console.error('Failed to load supported providers:', error);
        }
    }

    updateUI() {
        // 更新 API 設定
        const apiConfig = this.settings.apiConfiguration || {};
        this.elements.apiProvider.value = apiConfig.provider || '';
        this.elements.apiKey.value = apiConfig.apiKey || '';
        this.elements.apiModel.value = apiConfig.model || 'gemini-2.5-flash-lite';
        this.elements.maxTokens.value = apiConfig.maxTokensPerRequest || 4000;
        
        // 更新翻譯偏好
        const prefs = this.settings.translationPreferences || {};
        this.elements.targetLanguage.value = prefs.targetLanguage || 'zh-TW';
        this.elements.translationPosition.value = prefs.translationPosition || 'below';

        this.elements.autoTranslateVisible.checked = prefs.autoTranslateVisible || false;
        this.elements.excludeSelectors.value = (prefs.excludeSelectors || []).join(', ');
        
        // 更新使用統計
        this.updateUsageStatsUI();
        
        // 更新 API 相關 UI
        this.updateAPIKeyPlaceholder();
        this.updateAdvancedSettings();
    }
    
    updateUsageStatsUI() {
        const stats = this.settings.usageStats || {};
        
        this.elements.totalTranslations.textContent = this.formatNumber(stats.totalTranslations || 0);
        this.elements.tokensUsed.textContent = this.formatNumber(stats.tokensUsed || 0);
        this.elements.estimatedCost.textContent = `$${(stats.estimatedCost || 0).toFixed(4)}`;
        
        // 格式化重置日期
        if (stats.lastResetDate) {
            const date = new Date(stats.lastResetDate);
            this.elements.lastResetDate.textContent = date.toLocaleDateString('zh-TW');
        } else {
            this.elements.lastResetDate.textContent = '-';
        }
    }
    
    updateProviderOptions() {
        // 清空現有選項（保留第一個預設選項）
        const firstOption = this.elements.apiProvider.firstElementChild;
        this.elements.apiProvider.innerHTML = '';
        this.elements.apiProvider.appendChild(firstOption);
        
        // 添加支援的提供者
        this.supportedProviders.forEach(provider => {
            const option = document.createElement('option');
            option.value = provider.id;
            option.textContent = `${provider.name}${provider.hasFreeQuota ? ' (有免費額度)' : ''}`;
            this.elements.apiProvider.appendChild(option);
        });
    }

    handleProviderChange() {
        const provider = this.elements.apiProvider.value;
        this.updateAPIKeyPlaceholder();
        this.updateAdvancedSettings();
        this.clearValidationResult();
        
        // 如果選擇了新的提供商，清空 API 金鑰
        if (provider !== this.settings.apiConfiguration?.provider) {
            this.elements.apiKey.value = '';
        }
    }

    updateAPIKeyPlaceholder() {
        const provider = this.elements.apiProvider.value;
        const placeholders = {
            'google-gemini': '輸入 Google AI Studio API 金鑰',
            'openai': '輸入 OpenAI API 金鑰 (sk-...)',
            'claude': '輸入 Claude API 金鑰 (sk-ant-...)',
            'bing-translator': '輸入 Microsoft Translator API 金鑰',
            'google-translate': '輸入 Google Translate API 金鑰'
        };
        
        this.elements.apiKey.placeholder = placeholders[provider] || '輸入 API 金鑰';
    }
    
    updateAdvancedSettings() {
        const provider = this.elements.apiProvider.value;
        
        if (provider) {
            this.elements.advancedSettings.style.display = 'block';
            
            // 更新模型選項
            this.updateModelOptions(provider);
        } else {
            this.elements.advancedSettings.style.display = 'none';
        }
    }
    
    updateModelOptions(provider) {
        const modelOptions = {
            'google-gemini': [
                { value: 'gemini-2.5-flash-lite', text: 'Gemini 2.5 Flash-Lite (推薦，最多配額)' },
                { value: 'gemini-2.0-flash-lite', text: 'Gemini 2.0 Flash-Lite (高頻率)' },
                { value: 'gemini-2.5-flash', text: 'Gemini 2.5 Flash (平衡)' },
                { value: 'gemini-2.5-pro', text: 'Gemini 2.5 Pro (最高品質)' }
            ],
            'openai': [
                { value: 'gpt-3.5-turbo', text: 'GPT-3.5 Turbo' },
                { value: 'gpt-4', text: 'GPT-4' }
            ],
            'claude': [
                { value: 'claude-3-sonnet', text: 'Claude 3 Sonnet' },
                { value: 'claude-3-haiku', text: 'Claude 3 Haiku' }
            ]
        };
        
        const options = modelOptions[provider] || [{ value: 'default', text: '預設模型' }];
        
        this.elements.apiModel.innerHTML = '';
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            this.elements.apiModel.appendChild(optionElement);
        });
    }

    toggleKeyVisibility() {
        this.isKeyVisible = !this.isKeyVisible;
        this.elements.apiKey.type = this.isKeyVisible ? 'text' : 'password';
        this.elements.toggleKeyVisibility.textContent = this.isKeyVisible ? '🙈' : '👁️';
    }
    
    showApiKeyHelp() {
        const provider = this.elements.apiProvider.value;
        const helpUrls = {
            'google-gemini': 'https://makersuite.google.com/app/apikey',
            'openai': 'https://platform.openai.com/api-keys',
            'claude': 'https://console.anthropic.com/',
            'bing-translator': 'https://azure.microsoft.com/services/cognitive-services/translator/',
            'google-translate': 'https://cloud.google.com/translate/docs/setup'
        };
        
        const url = helpUrls[provider];
        if (url) {
            window.open(url, '_blank');
        } else {
            this.showInfo('請選擇翻譯服務後再查看說明');
        }
    }
    
    showExcludeSelectorHelp() {
        this.showInfo('輸入CSS選擇器，用逗號分隔。例如：.ad, .advertisement, #sidebar');
    }

    async validateAPIKey() {
        const provider = this.elements.apiProvider.value;
        const apiKey = this.elements.apiKey.value.trim();

        if (!provider) {
            this.showValidationResult('請先選擇翻譯服務', 'error');
            return;
        }

        if (!apiKey) {
            this.showValidationResult('請輸入 API 金鑰', 'error');
            return;
        }

        // 基本格式檢查
        if (provider === 'google-gemini') {
            if (apiKey.length < 20) {
                this.showValidationResult('❌ Google Gemini API 金鑰格式不正確（長度不足，通常應該 > 30 字符）', 'error');
                return;
            }
            
            if (!apiKey.startsWith('AI')) {
                this.showValidationResult('⚠️ 警告：Google Gemini API 金鑰通常以 "AI" 開頭，請確認金鑰正確', 'error');
                return;
            }
            
            if (apiKey.includes(' ')) {
                this.showValidationResult('❌ API 金鑰包含空格，請檢查是否完整複製', 'error');
                return;
            }
        }

        // 顯示驗證中狀態
        this.elements.validateKey.disabled = true;
        this.elements.validateKey.textContent = '驗證中...';
        this.showValidationResult('🔄 正在驗證 API 金鑰，請稍候...', 'info');

        try {
            console.log('🚀 開始驗證 API 金鑰:', provider, apiKey ? `${apiKey.substring(0, 10)}...` : 'empty');
            
            // 設定 10 秒超時
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('驗證超時')), 10000);
            });
            
            const validationPromise = chrome.runtime.sendMessage({
                type: 'VALIDATE_API_KEY',
                provider: provider,
                apiKey: apiKey
            });
            
            const response = await Promise.race([validationPromise, timeoutPromise]);

            console.log('📡 驗證回應:', response);

            if (response.success && response.isValid) {
                this.showValidationResult('✅ API 金鑰驗證成功！可以開始使用翻譯功能', 'success');
            } else {
                let errorMsg = '❌ API 金鑰驗證失敗';
                
                if (provider === 'google-gemini') {
                    errorMsg += `

🔍 請檢查以下項目：
1. 金鑰是從 Google AI Studio 正確獲取
2. 金鑰沒有過期或被撤銷
3. 已在 Google Cloud Console 啟用 Generative Language API
4. 沒有超過 API 配額限制
5. 網路連接正常

💡 建議：
- 訪問 https://makersuite.google.com/app/apikey 重新檢查金鑰
- 確保金鑰完整複製，沒有多餘空格
- 檢查瀏覽器控制台是否有更多錯誤信息`;
                }
                
                this.showValidationResult(errorMsg, 'error');
            }

        } catch (error) {
            console.error('❌ API key validation failed:', error);
            
            let errorMsg = '❌ 驗證過程發生錯誤：' + error.message;
            
            if (error.message === '驗證超時') {
                errorMsg = '⚠️ 驗證超時，但你可以嘗試直接儲存設定。如果翻譯功能正常工作，說明 API 金鑰是有效的。';
                this.showValidationResult(errorMsg, 'warning');
            } else if (error.message.includes('Extension context invalidated')) {
                errorMsg += '\n\n💡 請重新載入擴展後再試';
                this.showValidationResult(errorMsg, 'error');
            } else if (error.message.includes('network')) {
                errorMsg += '\n\n💡 請檢查網路連接';
                this.showValidationResult(errorMsg, 'error');
            } else {
                this.showValidationResult(errorMsg, 'error');
            }
        } finally {
            this.elements.validateKey.disabled = false;
            this.elements.validateKey.textContent = '驗證金鑰';
        }
    }

    showValidationResult(message, type) {
        this.elements.validationResult.textContent = message;
        this.elements.validationResult.className = `validation-result ${type}`;
        this.elements.validationResult.classList.remove('hidden');
    }

    clearValidationResult() {
        this.elements.validationResult.classList.add('hidden');
    }

    async saveSettings() {
        // 收集設定資料
        const excludeSelectors = this.elements.excludeSelectors.value
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        const newSettings = {
            apiConfiguration: {
                provider: this.elements.apiProvider.value,
                apiKey: this.elements.apiKey.value.trim(),
                model: this.elements.apiModel.value,
                maxTokensPerRequest: parseInt(this.elements.maxTokens.value) || 4000
            },
            translationPreferences: {
                targetLanguage: this.elements.targetLanguage.value,
                translationPosition: this.elements.translationPosition.value,

                autoTranslateVisible: this.elements.autoTranslateVisible.checked,
                excludeSelectors: excludeSelectors
            },
            usageStats: this.settings.usageStats || {}
        };

        // 基本驗證
        if (newSettings.apiConfiguration.provider && !newSettings.apiConfiguration.apiKey) {
            this.showError('請輸入 API 金鑰');
            return;
        }

        try {
            // 儲存設定
            const response = await chrome.runtime.sendMessage({
                type: 'SAVE_SETTINGS',
                data: newSettings
            });

            if (response.success) {
                this.settings = newSettings;
                this.showSuccess('✅ 設定已儲存');
            } else {
                this.showError('❌ 儲存設定失敗');
            }

        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showError('❌ 儲存設定時發生錯誤');
        }
    }

    async resetSettings() {
        if (!confirm('確定要重設所有設定嗎？此操作無法復原。')) {
            return;
        }

        try {
            // 重設為預設值
            const defaultSettings = {
                apiConfiguration: {
                    provider: '',
                    apiKey: '',
                    model: 'gemini-2.5-flash-lite',
                    maxTokensPerRequest: 4000
                },
                translationPreferences: {
                    targetLanguage: 'zh-TW',
                    translationPosition: 'below',

                    autoTranslateVisible: false,
                    excludeSelectors: ['.ad', '.advertisement', '.sponsor']
                },
                usageStats: this.settings.usageStats || {}
            };

            const response = await chrome.runtime.sendMessage({
                type: 'SAVE_SETTINGS',
                data: defaultSettings
            });

            if (response.success) {
                this.settings = defaultSettings;
                this.updateUI();
                this.clearValidationResult();
                this.showSuccess('✅ 設定已重設為預設值');
            } else {
                this.showError('❌ 重設設定失敗');
            }

        } catch (error) {
            console.error('Failed to reset settings:', error);
            this.showError('❌ 重設設定時發生錯誤');
        }
    }
    
    async resetUsageStats() {
        if (!confirm('確定要重置使用統計嗎？此操作無法復原。')) {
            return;
        }

        try {
            // 這裡需要實作重置統計的API
            this.showInfo('重置統計功能將在後續版本中實作');
        } catch (error) {
            console.error('Failed to reset usage stats:', error);
            this.showError('❌ 重置統計失敗');
        }
    }
    
    async checkAPIQuota() {
        try {
            this.elements.checkQuota.disabled = true;
            this.elements.checkQuota.textContent = '檢查中...';
            
            const response = await chrome.runtime.sendMessage({ type: 'CHECK_API_QUOTA' });
            if (response.success && response.quota) {
                const quota = response.quota;
                this.showInfo(`配額資訊：已使用 ${quota.tokenUsage} tokens，剩餘 ${quota.remainingQuota} tokens`);
            } else {
                this.showInfo('無法獲取配額資訊，請確認API設定正確');
            }
        } catch (error) {
            console.error('Failed to check quota:', error);
            this.showError('❌ 檢查配額失敗');
        } finally {
            this.elements.checkQuota.disabled = false;
            this.elements.checkQuota.textContent = '檢查配額';
        }
    }
    
    exportSettings() {
        const exportData = {
            ...this.settings,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        // 移除敏感資訊
        if (exportData.apiConfiguration) {
            exportData.apiConfiguration.apiKey = '***已隱藏***';
        }
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `translation-extension-settings-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        this.showSuccess('✅ 設定已匯出');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    showInfo(message) {
        this.showNotification(message, 'info');
    }

    showNotification(message, type) {
        // 創建通知元素
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 6px;
            color: white;
            font-size: 14px;
            z-index: 1000;
            transition: all 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
            ${type === 'success' ? 'background-color: #28a745;' : 
              type === 'info' ? 'background-color: #17a2b8;' : 
              'background-color: #dc3545;'}
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // 3秒後移除
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // 格式化數字顯示
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        } else {
            return num.toString();
        }
    }
}

// 當 DOM 載入完成時初始化設定頁面
document.addEventListener('DOMContentLoaded', () => {
    new SettingsController();
});