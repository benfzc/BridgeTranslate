# 實作計劃

- [x] 1. 添加本地文件權限到 manifest.json


  - 在 host_permissions 陣列中添加 "file://*/*"
  - _需求: 1.1, 2.2_

- [x] 2. 修改設定載入邏輯支援本地文件


  - 修改 content.js 中的 loadSettings 方法
  - 檢測 file:// 協議時直接使用 chrome.storage.sync.get 載入設定
  - 保持網頁環境使用背景服務通訊不變
  - _需求: 1.1, 1.2, 2.1_

- [x] 3. 測試本地文件翻譯功能



  - 使用 test-page.html 測試本地文件翻譯
  - 確認網頁翻譯功能不受影響
  - 驗證按鈕隱藏功能正常工作
  - _需求: 1.3, 3.1, 3.2, 3.3_