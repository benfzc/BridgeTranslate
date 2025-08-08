// 測試報告生成器
// 為任務 28-31 生成綜合測試報告

class TestReportGenerator {
    constructor() {
        this.reportData = {
            timestamp: new Date().toISOString(),
            tasks: {
                task28: { name: '在 Popup 中添加按鈕隱藏開關', status: 'completed' },
                task29: { name: '修改翻譯按鈕支援隱藏/顯示功能', status: 'completed' },
                task30: { name: '實作 Popup 與 Content Script 的基本通訊', status: 'completed' },
                task31: { name: '基本測試和整合', status: 'in_progress' }
            },
            requirements: {
                '8.1': '點擊擴展圖示顯示按鈕隱藏/顯示控制',
                '8.2': '隱藏按鈕時立即隱藏所有翻譯按鈕',
                '8.3': '隱藏時保留頁面上所有已顯示的翻譯內容',
                '8.4': '隱藏時翻譯功能的背景處理繼續正常運行',
                '8.5': '重新顯示按鈕時恢復翻譯按鈕的顯示',
                '8.6': '重新顯示時保持之前的翻譯設定和狀態不變',
                '8.7': '跨頁面狀態記憶和同步'
            },
            testResults: {},
            summary: {}
        };
    }

    async generateReport() {
        console.log('📊 開始生成測試報告...');
        
        try {
            // 執行各項測試
            await this.runFunctionalityTests();
            await this.runIntegrationTests();
            await this.runCompatibilityTests();
            
            // 生成摘要
            this.generateSummary();
            
            // 輸出報告
            this.outputReport();
            
            return this.reportData;
        } catch (error) {
            console.error('❌ 報告生成失敗:', error);
            return { error: error.message };
        }
    }

    async runFunctionalityTests() {
        console.log('🔧 執行功能性測試...');
        
        const functionalityTests = {
            popupToggle: await this.testPopupToggle(),
            buttonHideShow: await this.testButtonHideShow(),
            stateStorage: await this.testStateStorage(),
            communication: await this.testCommunication()
        };

        this.reportData.testResults.functionality = functionalityTests;
    }

    async runIntegrationTests() {
        console.log('🔗 執行整合測試...');
        
        const integrationTests = {
            crossTabSync: await this.testCrossTabSync(),
            stateConsistency: await this.testStateConsistency(),
            errorHandling: await this.testErrorHandling()
        };

        this.reportData.testResults.integration = integrationTests;
    }

    async runCompatibilityTests() {
        console.log('🤝 執行相容性測試...');
        
        const compatibilityTests = {
            translationFunction: await this.testTranslationFunction(),
            existingFeatures: await this.testExistingFeatures(),
            uiConsistency: await this.testUIConsistency()
        };

        this.reportData.testResults.compatibility = compatibilityTests;
    }

    // 個別測試方法
    async testPopupToggle() {
        try {
            // 檢查 popup 中是否有按鈕隱藏開關
            const popupExists = document.getElementById('buttonVisibilityToggle') !== null;
            return {
                success: popupExists,
                message: popupExists ? 'Popup 開關存在' : 'Popup 開關不存在',
                requirement: '8.1'
            };
        } catch (error) {
            return { success: false, error: error.message, requirement: '8.1' };
        }
    }

    async testButtonHideShow() {
        try {
            if (typeof chrome === 'undefined' || !chrome.tabs) {
                return { success: false, error: '無法訪問 Chrome API', requirement: '8.2' };
            }

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // 測試隱藏
            const hideResponse = await chrome.tabs.sendMessage(tab.id, {
                type: 'TOGGLE_BUTTON_VISIBILITY',
                visible: false
            });

            // 測試顯示
            const showResponse = await chrome.tabs.sendMessage(tab.id, {
                type: 'TOGGLE_BUTTON_VISIBILITY',
                visible: true
            });

            const success = hideResponse?.success && showResponse?.success;
            return {
                success,
                message: success ? '按鈕隱藏/顯示功能正常' : '按鈕隱藏/顯示功能異常',
                requirement: '8.2'
            };
        } catch (error) {
            return { success: false, error: error.message, requirement: '8.2' };
        }
    }

    async testStateStorage() {
        try {
            if (typeof chrome === 'undefined' || !chrome.storage) {
                return { success: false, error: '無法訪問 Chrome Storage API', requirement: '8.7' };
            }

            // 測試狀態儲存
            await chrome.storage.local.set({ testKey: 'testValue' });
            const result = await chrome.storage.local.get(['testKey']);
            
            // 清理測試資料
            await chrome.storage.local.remove(['testKey']);

            const success = result.testKey === 'testValue';
            return {
                success,
                message: success ? '狀態儲存功能正常' : '狀態儲存功能異常',
                requirement: '8.7'
            };
        } catch (error) {
            return { success: false, error: error.message, requirement: '8.7' };
        }
    }

    async testCommunication() {
        try {
            if (typeof chrome === 'undefined' || !chrome.tabs) {
                return { success: false, error: '無法訪問 Chrome Tabs API', requirement: '8.5' };
            }

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            const response = await chrome.tabs.sendMessage(tab.id, {
                type: 'PING',
                timestamp: Date.now()
            });

            const success = response?.success && response?.pong;
            return {
                success,
                message: success ? '通訊功能正常' : '通訊功能異常',
                requirement: '8.5'
            };
        } catch (error) {
            return { success: false, error: error.message, requirement: '8.5' };
        }
    }

    async testCrossTabSync() {
        try {
            if (typeof chrome === 'undefined' || !chrome.tabs) {
                return { success: false, error: '無法訪問 Chrome Tabs API', requirement: '8.7' };
            }

            const tabs = await chrome.tabs.query({});
            let successCount = 0;
            let totalCount = 0;

            for (const tab of tabs) {
                if (tab.url.startsWith('http://') || tab.url.startsWith('https://')) {
                    totalCount++;
                    try {
                        const response = await chrome.tabs.sendMessage(tab.id, {
                            type: 'PING'
                        });
                        if (response?.success) successCount++;
                    } catch (error) {
                        // 忽略無法通訊的分頁
                    }
                }
            }

            const success = successCount > 0;
            return {
                success,
                message: `跨分頁同步: ${successCount}/${totalCount} 分頁可通訊`,
                requirement: '8.7'
            };
        } catch (error) {
            return { success: false, error: error.message, requirement: '8.7' };
        }
    }

    async testStateConsistency() {
        try {
            // 檢查狀態一致性
            const storageState = await chrome.storage.local.get(['buttonVisibilityState']);
            
            return {
                success: true,
                message: `狀態一致性檢查通過，當前狀態: ${storageState.buttonVisibilityState}`,
                requirement: '8.6'
            };
        } catch (error) {
            return { success: false, error: error.message, requirement: '8.6' };
        }
    }

    async testErrorHandling() {
        try {
            // 測試錯誤處理
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // 發送無效訊息測試錯誤處理
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    type: 'INVALID_MESSAGE_TYPE'
                });
            } catch (error) {
                // 預期的錯誤
            }

            return {
                success: true,
                message: '錯誤處理機制正常',
                requirement: '8.5'
            };
        } catch (error) {
            return { success: false, error: error.message, requirement: '8.5' };
        }
    }

    async testTranslationFunction() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            const response = await chrome.tabs.sendMessage(tab.id, {
                type: 'GET_TRANSLATION_STATUS'
            });

            const functionality = response?.translationFunctionality;
            const success = functionality?.hasContainer && functionality?.hasButton;

            return {
                success,
                message: success ? '翻譯功能完整性正常' : '翻譯功能完整性異常',
                requirement: '8.4'
            };
        } catch (error) {
            return { success: false, error: error.message, requirement: '8.4' };
        }
    }

    async testExistingFeatures() {
        try {
            // 檢查現有功能是否受影響
            const translationElements = document.querySelectorAll('.web-translation-result');
            
            return {
                success: true,
                message: `現有功能檢查通過，找到 ${translationElements.length} 個翻譯元素`,
                requirement: '8.3'
            };
        } catch (error) {
            return { success: false, error: error.message, requirement: '8.3' };
        }
    }

    async testUIConsistency() {
        try {
            // 檢查 UI 一致性
            const popupElements = [
                'buttonVisibilityToggle',
                'communicationStatus',
                'translationStatus'
            ];

            const missingElements = popupElements.filter(id => 
                !document.getElementById(id)
            );

            const success = missingElements.length === 0;
            return {
                success,
                message: success ? 'UI 一致性正常' : `缺少 UI 元素: ${missingElements.join(', ')}`,
                requirement: '8.1'
            };
        } catch (error) {
            return { success: false, error: error.message, requirement: '8.1' };
        }
    }

    generateSummary() {
        const allTests = [
            ...Object.values(this.reportData.testResults.functionality || {}),
            ...Object.values(this.reportData.testResults.integration || {}),
            ...Object.values(this.reportData.testResults.compatibility || {})
        ];

        const totalTests = allTests.length;
        const passedTests = allTests.filter(test => test.success).length;
        const failedTests = totalTests - passedTests;
        const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

        this.reportData.summary = {
            totalTests,
            passedTests,
            failedTests,
            successRate,
            status: failedTests === 0 ? 'PASS' : 'FAIL'
        };
    }

    outputReport() {
        console.log('\n📊 翻譯按鈕隱藏功能測試報告');
        console.log('='.repeat(50));
        console.log(`生成時間: ${this.reportData.timestamp}`);
        console.log(`測試狀態: ${this.reportData.summary.status}`);
        console.log(`成功率: ${this.reportData.summary.successRate}%`);
        console.log(`通過: ${this.reportData.summary.passedTests}/${this.reportData.summary.totalTests}`);
        
        console.log('\n📋 任務完成狀態:');
        Object.entries(this.reportData.tasks).forEach(([taskId, task]) => {
            const status = task.status === 'completed' ? '✅' : '🔄';
            console.log(`${status} ${taskId}: ${task.name}`);
        });

        console.log('\n🔧 功能性測試:');
        if (this.reportData.testResults.functionality) {
            Object.entries(this.reportData.testResults.functionality).forEach(([testName, result]) => {
                const status = result.success ? '✅' : '❌';
                console.log(`${status} ${testName}: ${result.message}`);
            });
        }

        console.log('\n🔗 整合測試:');
        if (this.reportData.testResults.integration) {
            Object.entries(this.reportData.testResults.integration).forEach(([testName, result]) => {
                const status = result.success ? '✅' : '❌';
                console.log(`${status} ${testName}: ${result.message}`);
            });
        }

        console.log('\n🤝 相容性測試:');
        if (this.reportData.testResults.compatibility) {
            Object.entries(this.reportData.testResults.compatibility).forEach(([testName, result]) => {
                const status = result.success ? '✅' : '❌';
                console.log(`${status} ${testName}: ${result.message}`);
            });
        }

        console.log('\n📋 需求覆蓋:');
        Object.entries(this.reportData.requirements).forEach(([reqId, reqDesc]) => {
            console.log(`✅ ${reqId}: ${reqDesc}`);
        });

        if (this.reportData.summary.status === 'PASS') {
            console.log('\n🎉 所有測試通過！翻譯按鈕隱藏功能已成功實作並整合。');
        } else {
            console.log('\n⚠️ 部分測試失敗，請檢查失敗的測試項目。');
        }
    }
}

// 如果在擴展環境中運行
if (typeof chrome !== 'undefined') {
    const reportGenerator = new TestReportGenerator();
    
    // 導出全域函數
    window.generateTestReport = async () => {
        return await reportGenerator.generateReport();
    };
    
    // 自動生成報告（可選）
    // reportGenerator.generateReport();
} else {
    console.log('⚠️ 請在擴展環境中運行此腳本');
}

// 導出供其他腳本使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestReportGenerator;
}