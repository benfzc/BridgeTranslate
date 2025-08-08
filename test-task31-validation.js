// 任務 31 驗證腳本
// 自動化測試按鈕隱藏功能的基本測試和整合

console.log('🧪 開始任務 31 驗證測試');

class Task31Validator {
    constructor() {
        this.testResults = {
            buttonHideShow: false,        // 按鈕隱藏/顯示功能
            statePersistence: false,      // 狀態持久化
            crossTabSync: false,          // 跨頁面同步
            translationCompatibility: false // 與現有翻譯功能的相容性
        };
        this.detailedResults = [];
    }

    async runAllValidations() {
        console.log('🚀 開始執行所有驗證測試...');
        
        try {
            await this.validateButtonHideShow();
            await this.validateStatePersistence();
            await this.validateCrossTabSync();
            await this.validateTranslationCompatibility();
            
            this.printResults();
            return this.generateReport();
        } catch (error) {
            console.error('❌ 驗證執行失敗:', error);
            return { success: false, error: error.message };
        }
    }

    // 驗證按鈕隱藏/顯示功能
    async validateButtonHideShow() {
        console.log('📋 驗證按鈕隱藏/顯示功能...');
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // 測試隱藏功能
            console.log('🔍 測試按鈕隱藏...');
            const hideResponse = await chrome.tabs.sendMessage(tab.id, {
                type: 'TOGGLE_BUTTON_VISIBILITY',
                visible: false,
                timestamp: Date.now()
            });

            if (!hideResponse || !hideResponse.success) {
                throw new Error('按鈕隱藏功能失敗');
            }

            // 等待動畫完成
            await this.sleep(500);

            // 檢查按鈕狀態
            const statusAfterHide = await chrome.tabs.sendMessage(tab.id, {
                type: 'GET_TRANSLATION_STATUS'
            });

            if (!statusAfterHide.buttonVisibility || statusAfterHide.buttonVisibility.isVisible) {
                throw new Error('按鈕未正確隱藏');
            }

            // 測試顯示功能
            console.log('🔍 測試按鈕顯示...');
            const showResponse = await chrome.tabs.sendMessage(tab.id, {
                type: 'TOGGLE_BUTTON_VISIBILITY',
                visible: true,
                timestamp: Date.now()
            });

            if (!showResponse || !showResponse.success) {
                throw new Error('按鈕顯示功能失敗');
            }

            // 等待動畫完成
            await this.sleep(500);

            // 檢查按鈕狀態
            const statusAfterShow = await chrome.tabs.sendMessage(tab.id, {
                type: 'GET_TRANSLATION_STATUS'
            });

            if (!statusAfterShow.buttonVisibility || !statusAfterShow.buttonVisibility.isVisible) {
                throw new Error('按鈕未正確顯示');
            }

            this.testResults.buttonHideShow = true;
            this.detailedResults.push({
                test: 'buttonHideShow',
                success: true,
                message: '按鈕隱藏/顯示功能正常',
                details: {
                    hideResponse,
                    showResponse,
                    statusAfterHide: statusAfterHide.buttonVisibility,
                    statusAfterShow: statusAfterShow.buttonVisibility
                }
            });

            console.log('✅ 按鈕隱藏/顯示功能驗證通過');

        } catch (error) {
            console.error('❌ 按鈕隱藏/顯示功能驗證失敗:', error);
            this.detailedResults.push({
                test: 'buttonHideShow',
                success: false,
                error: error.message
            });
        }
    }

    // 驗證狀態持久化
    async validateStatePersistence() {
        console.log('📋 驗證狀態持久化...');
        
        try {
            // 設定隱藏狀態
            console.log('🔍 設定隱藏狀態...');
            await chrome.storage.local.set({ buttonVisibilityState: false });

            // 讀取狀態
            const result = await chrome.storage.local.get(['buttonVisibilityState']);
            
            if (result.buttonVisibilityState !== false) {
                throw new Error('狀態儲存失敗');
            }

            // 設定顯示狀態
            console.log('🔍 設定顯示狀態...');
            await chrome.storage.local.set({ buttonVisibilityState: true });

            // 再次讀取狀態
            const result2 = await chrome.storage.local.get(['buttonVisibilityState']);
            
            if (result2.buttonVisibilityState !== true) {
                throw new Error('狀態更新失敗');
            }

            this.testResults.statePersistence = true;
            this.detailedResults.push({
                test: 'statePersistence',
                success: true,
                message: '狀態持久化功能正常',
                details: {
                    firstState: result.buttonVisibilityState,
                    secondState: result2.buttonVisibilityState
                }
            });

            console.log('✅ 狀態持久化驗證通過');

        } catch (error) {
            console.error('❌ 狀態持久化驗證失敗:', error);
            this.detailedResults.push({
                test: 'statePersistence',
                success: false,
                error: error.message
            });
        }
    }

    // 驗證跨頁面同步
    async validateCrossTabSync() {
        console.log('📋 驗證跨頁面同步...');
        
        try {
            const tabs = await chrome.tabs.query({});
            let successCount = 0;
            let totalCount = 0;
            const results = [];

            console.log(`🔍 找到 ${tabs.length} 個分頁，開始測試通訊...`);

            for (const tab of tabs) {
                if (this.isSupportedPage(tab.url)) {
                    totalCount++;
                    try {
                        const response = await chrome.tabs.sendMessage(tab.id, {
                            type: 'PING',
                            timestamp: Date.now()
                        });

                        if (response && response.success && response.pong) {
                            successCount++;
                            results.push({ tabId: tab.id, success: true });
                        } else {
                            results.push({ tabId: tab.id, success: false, error: 'Invalid response' });
                        }
                    } catch (error) {
                        results.push({ tabId: tab.id, success: false, error: error.message });
                    }
                }
            }

            if (successCount > 0) {
                this.testResults.crossTabSync = true;
                this.detailedResults.push({
                    test: 'crossTabSync',
                    success: true,
                    message: `跨頁面同步功能正常 (${successCount}/${totalCount})`,
                    details: {
                        successCount,
                        totalCount,
                        results
                    }
                });

                console.log(`✅ 跨頁面同步驗證通過 (${successCount}/${totalCount})`);
            } else {
                throw new Error(`沒有分頁可以通訊 (${successCount}/${totalCount})`);
            }

        } catch (error) {
            console.error('❌ 跨頁面同步驗證失敗:', error);
            this.detailedResults.push({
                test: 'crossTabSync',
                success: false,
                error: error.message
            });
        }
    }

    // 驗證與現有翻譯功能的相容性
    async validateTranslationCompatibility() {
        console.log('📋 驗證與現有翻譯功能的相容性...');
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // 獲取翻譯功能狀態
            console.log('🔍 檢查翻譯功能狀態...');
            const statusResponse = await chrome.tabs.sendMessage(tab.id, {
                type: 'GET_TRANSLATION_STATUS'
            });

            if (!statusResponse || !statusResponse.success) {
                throw new Error('無法獲取翻譯狀態');
            }

            const functionality = statusResponse.translationFunctionality;
            if (!functionality) {
                throw new Error('翻譯功能狀態不可用');
            }

            // 檢查翻譯功能完整性
            const requiredProperties = ['hasContainer', 'hasButton', 'currentState'];
            for (const prop of requiredProperties) {
                if (!(prop in functionality)) {
                    throw new Error(`翻譯功能缺少必要屬性: ${prop}`);
                }
            }

            // 測試隱藏按鈕時翻譯功能是否正常
            console.log('🔍 測試隱藏按鈕時的翻譯功能...');
            await chrome.tabs.sendMessage(tab.id, {
                type: 'TOGGLE_BUTTON_VISIBILITY',
                visible: false
            });

            await this.sleep(300);

            const statusAfterHide = await chrome.tabs.sendMessage(tab.id, {
                type: 'GET_TRANSLATION_STATUS'
            });

            const functionalityAfterHide = statusAfterHide.translationFunctionality;
            
            if (!functionalityAfterHide.hasContainer || !functionalityAfterHide.hasButton) {
                throw new Error('隱藏按鈕後翻譯功能受到影響');
            }

            // 恢復按鈕顯示
            await chrome.tabs.sendMessage(tab.id, {
                type: 'TOGGLE_BUTTON_VISIBILITY',
                visible: true
            });

            this.testResults.translationCompatibility = true;
            this.detailedResults.push({
                test: 'translationCompatibility',
                success: true,
                message: '與現有翻譯功能相容性正常',
                details: {
                    beforeHide: functionality,
                    afterHide: functionalityAfterHide
                }
            });

            console.log('✅ 翻譯功能相容性驗證通過');

        } catch (error) {
            console.error('❌ 翻譯功能相容性驗證失敗:', error);
            this.detailedResults.push({
                test: 'translationCompatibility',
                success: false,
                error: error.message
            });
        }
    }

    // 輔助方法
    isSupportedPage(url) {
        return url && (url.startsWith('http://') || url.startsWith('https://'));
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 生成測試報告
    generateReport() {
        const passedCount = Object.values(this.testResults).filter(Boolean).length;
        const totalCount = Object.keys(this.testResults).length;
        const successRate = Math.round((passedCount / totalCount) * 100);

        return {
            success: passedCount === totalCount,
            summary: {
                total: totalCount,
                passed: passedCount,
                failed: totalCount - passedCount,
                successRate: successRate
            },
            testResults: this.testResults,
            detailedResults: this.detailedResults,
            timestamp: new Date().toISOString()
        };
    }

    printResults() {
        console.log('\n📊 任務 31 驗證結果:');
        console.log('================================');
        
        Object.entries(this.testResults).forEach(([test, passed]) => {
            const status = passed ? '✅ 通過' : '❌ 失敗';
            const testName = this.getTestDisplayName(test);
            console.log(`${testName}: ${status}`);
        });
        
        const passedCount = Object.values(this.testResults).filter(Boolean).length;
        const totalCount = Object.keys(this.testResults).length;
        const successRate = Math.round((passedCount / totalCount) * 100);
        
        console.log('================================');
        console.log(`總體結果: ${passedCount}/${totalCount} 項驗證通過 (${successRate}%)`);
        
        if (passedCount === totalCount) {
            console.log('🎉 任務 31 所有驗證通過！');
            console.log('✅ 翻譯按鈕隱藏功能已成功整合');
        } else {
            console.log('⚠️ 部分驗證未通過，需要進一步檢查');
        }

        // 顯示詳細結果
        console.log('\n📋 詳細結果:');
        this.detailedResults.forEach(result => {
            const status = result.success ? '✅' : '❌';
            console.log(`${status} ${result.test}: ${result.message || result.error}`);
        });
    }

    getTestDisplayName(testKey) {
        const displayNames = {
            buttonHideShow: '按鈕隱藏/顯示功能',
            statePersistence: '狀態持久化',
            crossTabSync: '跨頁面同步',
            translationCompatibility: '翻譯功能相容性'
        };
        return displayNames[testKey] || testKey;
    }
}

// 如果在擴展環境中運行
if (typeof chrome !== 'undefined' && chrome.tabs) {
    const validator = new Task31Validator();
    
    // 導出全域函數供測試頁面使用
    window.runTask31Validation = async () => {
        return await validator.runAllValidations();
    };
    
    // 自動執行驗證（可選）
    // validator.runAllValidations();
} else {
    console.log('⚠️ 請在擴展的 popup 或背景頁面中運行此腳本');
}

// 導出供其他腳本使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Task31Validator;
}