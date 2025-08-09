# Bridge Translate 測試套件

這個目錄包含了 Bridge Translate 擴充功能的測試檔案，分為三個類別：

## 📁 目錄結構

### `integration/` - 整合測試
完整系統功能測試，測試多個組件之間的協作：

- **`test-integrated-system.html`** - 完整系統整合測試
  - 測試所有組件的協同工作
  - 包含速率限制隊列 + 智能排程器 + 內容分析
  - 提供即時狀態監控和進度顯示

- **`test-extension-integration.html`** - 擴充功能整合測試
  - 測試瀏覽器擴充功能的段落翻譯功能
  - 驗證 HTML 標籤處理和不同元素類型
  - 包含控制台輸出監控

- **`test-smart-scheduler.html`** - 智能排程器測試
  - 測試內容優先級排序
  - 驗證視窗內容檢測
  - 測試內容過濾邏輯

### `unit/` - 單元測試
測試個別組件的功能：

- **`test-boundary-detection.html`** - 翻譯邊界檢測測試
  - 測試視窗範圍檢測
  - 驗證翻譯邊界計算
  - 包含視覺化指示器

- **`test-queue-system.html`** - 速率限制隊列系統測試
  - 測試 API 速率限制功能
  - 驗證隊列優先級排序
  - 包含進度監控

- **`test-button-visibility.html`** - 按鈕可見性測試
- **`test-paragraph-translation.html`** - 段落翻譯測試
- **`test-translation-fix.html`** - 翻譯修復測試
- **`test-viewport-translation.html`** - 視窗翻譯測試
- **`test-paragraph-integration.html`** - 段落整合測試

### `debug/` - 除錯工具
開發和除錯用的工具：

- **`debug-content-filter.html`** - 內容過濾除錯工具
  - 分析頁面內容過濾結果
  - 顯示過濾統計和原因
  - 幫助調整過濾邏輯

- **`test-popup-functionality.js`** - Popup 功能測試腳本
  - 測試 Chrome Storage API
  - 驗證訊息通訊功能
  - 測試 Popup UI 元素

## 🚀 使用方法

### 整合測試
1. 在瀏覽器中開啟 `integration/` 目錄下的 HTML 檔案
2. 確保已安裝並啟用 Bridge Translate 擴充功能
3. 按照頁面上的指示進行測試

### 單元測試
1. 開啟對應的測試檔案
2. 使用頁面上的控制按鈕進行測試
3. 觀察控制台輸出和頁面反應

### 除錯工具
1. 在需要除錯的頁面上開啟除錯工具
2. 使用工具分析問題
3. 根據結果調整代碼

## 📝 注意事項

- 所有測試檔案都包含模擬的 Chrome API，可以在沒有擴充功能的情況下進行基本測試
- 完整功能測試需要安裝實際的擴充功能
- 測試檔案中的 JavaScript 路徑相對於專案根目錄，確保檔案結構正確

## 🔧 維護

定期檢查測試檔案是否與最新的代碼保持同步，特別是：
- API 介面變更
- 新功能添加
- 組件重構

如需添加新測試，請按照現有的目錄結構和命名規範。