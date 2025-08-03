# Google Gemini API 速率限制參考

## 📚 **官方文檔**
- **官方連結**: https://ai.google.dev/gemini-api/docs/rate-limits?hl=zh-tw
- **最後更新**: 2025-02-08

## 📊 **免費方案速率限制**

### **文字輸出型模型**

| 模型 | RPM (每分鐘請求數) | TPM (每分鐘 Token 數) | RPD (每日請求數) |
|------|-------------------|---------------------|-----------------|
| **Gemini 2.5 Pro** | 5 | 250,000 | 100 |
| **Gemini 2.5 Flash** | 10 | 250,000 | 250 |
| **Gemini 2.5 Flash-Lite** | 15 | 250,000 | 1,000 |
| **Gemini 2.0 Flash** | 15 | 1,000,000 | 200 |
| **Gemini 2.0 Flash-Lite** | 30 | 1,000,000 | 200 |

### **多模態模型**

| 模型 | RPM | TPM | RPD |
|------|-----|-----|-----|
| **Gemini 2.5 Pro** | 5 | 250,000 | 100 |
| **Gemini 2.5 Flash** | 10 | 250,000 | 250 |

## 🔧 **我們的實作配置**

### **當前使用模型**
- **預設模型**: `gemini-2.5-flash-lite`
- **RPM 限制**: 15 (每 4 秒一個請求)
- **TPM 限制**: 250,000
- **RPD 限制**: 1,000

### **代碼中的配置**
```javascript
// js/rate-limited-queue.js
const API_LIMITS = {
    'gemini-2.5-pro': { rpm: 5, tpm: 250000, rpd: 100 },
    'gemini-2.5-flash': { rpm: 10, tpm: 250000, rpd: 250 },
    'gemini-2.5-flash-lite': { rpm: 15, tpm: 250000, rpd: 1000 },
    'gemini-2.0-flash': { rpm: 15, tpm: 1000000, rpd: 200 },
    'gemini-2.0-flash-lite': { rpm: 30, tpm: 1000000, rpd: 200 }
};
```

### **動態限制獲取**
```javascript
// js/content.js
getRPMLimit() {
    const model = this.settings?.apiConfiguration?.model || 'gemini-2.5-flash-lite';
    const limits = {
        'gemini-2.5-pro': 5,
        'gemini-2.5-flash': 10,
        'gemini-2.5-flash-lite': 15,
        'gemini-2.0-flash': 15,
        'gemini-2.0-flash-lite': 30
    };
    return limits[model] || 15;
}
```

## ⚡ **速率限制處理策略**

### **1. 請求間隔計算**
- **Gemini 2.5 Flash-Lite**: 15 RPM = 每 4 秒一個請求
- **Gemini 2.0 Flash-Lite**: 30 RPM = 每 2 秒一個請求

### **2. 隊列管理**
```javascript
canSendRequest() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // 清理一分鐘前的請求記錄
    this.requestHistory = this.requestHistory.filter(time => time > oneMinuteAgo);
    
    // 檢查各種限制
    const rpmCheck = this.requestHistory.length < this.rpmLimit;
    const tpmCheck = this.getTotalTokensInLastMinute() < this.tpmLimit;
    const rpdCheck = this.dailyUsage.requests < this.rpdLimit;
    
    return rpmCheck && tpmCheck && rpdCheck;
}
```

### **3. 等待時間計算**
```javascript
getWaitTime() {
    if (this.requestHistory.length >= this.rpmLimit) {
        const oldestRequest = Math.min(...this.requestHistory);
        return Math.max(0, 60000 - (Date.now() - oldestRequest));
    }
    return 0;
}
```

## 📈 **付費方案升級選項**

### **Pay-as-you-go 定價**
- **輸入 Token**: $0.075 / 1M tokens
- **輸出 Token**: $0.30 / 1M tokens
- **更高的速率限制** (具體數值需查看最新文檔)

### **升級建議**
- 如果每日翻譯需求超過 1,000 個請求，建議升級到付費方案
- 付費方案通常有更高的 RPM 和 TPM 限制

## 🛠️ **開發注意事項**

### **測試環境**
- 使用較低的 RPM 限制進行測試 (例如 5 RPM)
- 確保隊列系統能正確處理速率限制

### **生產環境**
- 監控每日使用量，避免超出 RPD 限制
- 實作配額警告機制 (80%, 95% 使用量警告)
- 考慮實作用戶級別的使用量限制

### **錯誤處理**
- **429 Too Many Requests**: 等待並重試
- **403 Quota Exceeded**: 通知用戶升級或等待重置
- **400 Bad Request**: 檢查請求格式和內容

## 🔍 **監控和調試**

### **日誌記錄**
```javascript
console.log('API 限制檢查:', {
    rpm: `${this.requestHistory.length}/${this.rpmLimit}`,
    tpm: `${this.getTotalTokensInLastMinute()}/${this.tpmLimit}`,
    rpd: `${this.dailyUsage.requests}/${this.rpdLimit}`,
    canSend: canSend
});
```

### **使用量統計**
- 追蹤每日請求數量
- 追蹤 Token 使用量
- 計算預估成本 (如果升級到付費方案)

---

**⚠️ 重要提醒**: Google 的速率限制可能會更新，請定期檢查官方文檔以獲取最新資訊。