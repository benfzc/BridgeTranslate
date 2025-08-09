// 測試 Popup 按鈕隱藏功能的腳本
// 在瀏覽器控制台中運行此腳本來測試功能

console.log('🧪 開始測試 Popup 按鈕隱藏功能');

// 測試 Chrome Storage API
async function testStorageAPI() {
    console.log('📦 測試 Chrome Storage API...');
    
    try {
        // 測試寫入
        await chrome.storage.local.set({ buttonVisibilityState: false });
        console.log('✅ 寫入測試成功');
        
        // 測試讀取
        const result = await chrome.storage.local.get(['buttonVisibilityState']);
        console.log('✅ 讀取測試成功:', result);
        
        // 恢復預設值
        await chrome.storage.local.set({ buttonVisibilityState: true });
        console.log('✅ 恢復預設值成功');
        
    } catch (error) {
        console.error('❌ Storage API 測試失敗:', error);
    }
}

// 測試訊息通訊
async function testMessageCommunication() {
    console.log('📡 測試訊息通訊...');
    
    try {
        // 獲取當前標籤頁
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('📋 當前標籤頁:', tab.url);
        
        // 測試獲取翻譯狀態
        const statusResponse = await chrome.tabs.sendMessage(tab.id, {
            type: 'GET_TRANSLATION_STATUS'
        });
        console.log('✅ 獲取翻譯狀態成功:', statusResponse);
        
        // 測試切換按鈕可見性
        const toggleResponse = await chrome.tabs.sendMessage(tab.id, {
            type: 'TOGGLE_BUTTON_VISIBILITY',
            visible: false
        });
        console.log('✅ 切換按鈕可見性成功:', toggleResponse);
        
        // 等待 2 秒後恢復
        setTimeout(async () => {
            const restoreResponse = await chrome.tabs.sendMessage(tab.id, {
                type: 'TOGGLE_BUTTON_VISIBILITY',
                visible: true
            });
            console.log('✅ 恢復按鈕可見性成功:', restoreResponse);
        }, 2000);
        
    } catch (error) {
        console.error('❌ 訊息通訊測試失敗:', error);
    }
}

// 測試 Popup UI 元素
function testPopupUI() {
    console.log('🎨 測試 Popup UI 元素...');
    
    const toggle = document.getElementById('buttonVisibilityToggle');
    if (toggle) {
        console.log('✅ 找到按鈕可見性開關');
        console.log('🔘 當前狀態:', toggle.checked);
        
        // 測試切換
        toggle.checked = !toggle.checked;
        toggle.dispatchEvent(new Event('change'));
        console.log('✅ 觸發切換事件');
        
    } else {
        console.error('❌ 未找到按鈕可見性開關');
    }
}

// 運行所有測試
async function runAllTests() {
    console.log('🚀 開始運行所有測試...');
    
    await testStorageAPI();
    await testMessageCommunication();
    testPopupUI();
    
    console.log('✅ 所有測試完成');
}

// 如果在 popup 環境中運行
if (typeof chrome !== 'undefined' && chrome.storage) {
    runAllTests();
} else {
    console.log('⚠️ 請在擴展的 popup 或背景頁面中運行此腳本');
}