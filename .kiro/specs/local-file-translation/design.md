# 設計文件

## 概述

經過分析發現，本地 HTML 文件翻譯功能失效的根本原因是：

**問題根源**：在引入按鈕隱藏功能時，為了統一設定管理，content script 的設定載入方式從直接訪問 `chrome.storage.sync.get()` 改為依賴背景服務通訊 `chrome.runtime.sendMessage({ type: 'GET_SETTINGS' })`。

**影響**：在本地文件環境中，背景服務通訊不穩定或失敗，導致：
1. 設定載入失敗或超時
2. 翻譯功能初始化受阻
3. 整個擴展在本地文件中無法正常工作

**解決方案**：實現智能的設定載入策略：
- 本地文件環境：直接使用 `chrome.storage` 訪問
- 網頁環境：優先使用背景服務通訊，失敗時 fallback 到直接訪問
- 添加 `file://*/*` 權限確保擴展能在本地文件中載入

## 架構

### 設定載入策略
- **直接 Storage 訪問**: 在本地文件環境中，優先使用直接的 `chrome.storage` 訪問而不是背景服務通訊
- **通訊超時處理**: 為背景服務通訊設置合理的超時時間，避免長時間等待
- **Fallback 機制**: 當背景服務通訊失敗時，立即切換到直接 storage 訪問或預設設定

### 權限配置
- **Host Permissions**: 添加 `file://*/*` 到 host_permissions 以明確請求本地文件訪問權限
- **用戶指導**: 提供清晰的指導幫助用戶在 Chrome 擴展管理頁面中啟用「允許訪問文件網址」

### 環境檢測與適配
- **協議檢測**: 檢測當前是否為 file:// 協議環境
- **通訊健康檢查**: 快速檢測背景服務通訊是否可用
- **適配性載入**: 根據環境選擇最適合的設定載入方式

## 組件和接口

### 1. Manifest 配置更新
```json
{
  "host_permissions": [
    "https://*/*",
    "http://*/*",
    "file://*/*",
    "https://generativelanguage.googleapis.com/*"
  ]
}
```

### 2. 改進的設定載入器 (ImprovedSettingsLoader)
```javascript
class ImprovedSettingsLoader {
  static async loadSettings(timeout = 3000) {
    // 檢測是否為本地文件環境
    if (window.location.protocol === 'file:') {
      console.log('檢測到本地文件環境，使用直接載入');
      return await this.loadSettingsDirectly();
    }
    
    // 網頁環境：優先使用背景服務通訊（保持現有功能）
    try {
      return await this.loadSettingsFromBackground(timeout);
    } catch (error) {
      console.warn('背景服務通訊失敗，使用直接載入作為 fallback:', error);
      return await this.loadSettingsDirectly();
    }
  }
  
  static async loadSettingsDirectly() {
    // 直接從 chrome.storage 載入設定
    const result = await chrome.storage.sync.get([
      'apiConfiguration',
      'translationPreferences',
      'usageStats'
    ]);
    return this.normalizeSettings(result);
  }
  
  static async loadSettingsFromBackground(timeout) {
    // 帶超時的背景服務通訊
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('背景服務通訊超時'));
      }, timeout);
      
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
        clearTimeout(timer);
        if (response?.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || '載入設定失敗'));
        }
      });
    });
  }
}
```

### 3. 本地文件環境檢測器 (LocalFileEnvironment)
```javascript
class LocalFileEnvironment {
  static isLocalFile() {
    return window.location.protocol === 'file:';
  }
  
  static async checkExtensionPermissions() {
    // 檢查擴展是否有本地文件訪問權限
    try {
      await chrome.runtime.sendMessage({ type: 'PING' });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  static showPermissionGuide() {
    // 顯示權限設定指導
    const guide = document.createElement('div');
    guide.innerHTML = `
      <div style="position: fixed; top: 20px; left: 20px; background: #fff3cd; 
                  border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; 
                  z-index: 10000; max-width: 400px;">
        <h4>需要啟用本地文件訪問權限</h4>
        <p>請按以下步驟啟用：</p>
        <ol>
          <li>右鍵點擊瀏覽器工具列的擴展圖標</li>
          <li>選擇「管理擴展」</li>
          <li>找到 Bridge Translate</li>
          <li>啟用「允許訪問文件網址」選項</li>
          <li>重新載入此頁面</li>
        </ol>
        <button onclick="this.parentElement.remove()">關閉</button>
      </div>
    `;
    document.body.appendChild(guide);
  }
}
```

## 數據模型

### 權限狀態
```javascript
const PermissionStatus = {
  GRANTED: 'granted',
  DENIED: 'denied',
  UNKNOWN: 'unknown'
};
```

### 本地文件信息
```javascript
const LocalFileInfo = {
  protocol: 'file:',
  path: string,
  hasPermission: boolean,
  canTranslate: boolean
};
```

## 錯誤處理

### 權限錯誤
- **檢測**: 當擴展無法訪問本地文件時
- **處理**: 顯示友好的錯誤消息和設定指導
- **恢復**: 提供重試機制和手動權限檢查

### 本地文件特有錯誤
- **文件不存在**: 處理文件路徑錯誤
- **編碼問題**: 處理不同編碼的本地文件
- **安全限制**: 處理瀏覽器的額外安全限制

### 用戶指導系統
```javascript
const PermissionGuide = {
  chrome: {
    steps: [
      '右鍵點擊擴展圖標',
      '選擇「管理擴展」',
      '找到 Bridge Translate',
      '啟用「允許訪問文件網址」選項'
    ],
    images: ['guide-step1.png', 'guide-step2.png', ...]
  }
};
```

## 測試策略

### 單元測試
- **LocalFileDetector**: 測試協議檢測邏輯
- **PermissionManager**: 測試權限請求和驗證
- **LocalFileTranslationAdapter**: 測試本地文件翻譯適配

### 集成測試
- **權限流程**: 測試完整的權限請求和授權流程
- **翻譯功能**: 測試本地文件中的翻譯功能
- **錯誤處理**: 測試各種錯誤情況的處理

### 手動測試場景
1. **無權限狀態**: 測試擴展在沒有本地文件權限時的行為
2. **權限授權**: 測試用戶授權本地文件訪問後的功能
3. **不同文件類型**: 測試各種 HTML 文件的翻譯效果
4. **瀏覽器兼容性**: 測試在不同 Chrome 版本中的表現

### 性能考慮
- **權限檢查**: 避免頻繁的權限檢查調用
- **緩存機制**: 緩存權限狀態以提升性能
- **錯誤恢復**: 快速的錯誤檢測和恢復機制

## 實現優先級

1. **高優先級**: 
   - 修改 content.js 中的 loadSettings 方法，添加直接 storage 訪問的 fallback
   - 添加本地文件環境檢測和快速失敗機制
   - 更新 manifest.json 添加 file:// 權限

2. **中優先級**: 
   - 實現用戶友好的權限指導系統
   - 添加通訊超時和錯誤處理優化

3. **低優先級**: 
   - 性能優化和高級錯誤恢復機制

## 向後兼容性

- **網頁環境**: 現有的網頁翻譯功能完全不受影響，仍然優先使用背景服務通訊
- **按鈕隱藏功能**: 會改變設定載入的實現方式，但保持功能完整：
  - 在本地文件環境中，會使用直接 storage 訪問而不是背景服務通訊
  - popup 與 content script 的通訊（`chrome.tabs.sendMessage`）不受影響
  - 按鈕可見性狀態的載入和保存機制保持不變
  - 網頁環境中仍然優先使用背景服務通訊，保持現有的統一管理優勢
- **設定同步**: 保持現有的設定同步機制，只是添加了本地文件環境的 fallback
- **API 兼容性**: 不改變現有的 API 接口，只是改善載入策略