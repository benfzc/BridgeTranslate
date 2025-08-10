---
inclusion: always
---

# Development Guidelines

## Specification Writing Standards

### Bilingual Documentation Requirements

1. **All specifications must be written in bilingual format (English-Chinese)**
   - Complete English version first
   - Complete Traditional Chinese version second
   - Separated by a horizontal line (`---`)

2. **Chinese Translation Guidelines**
   - Use Traditional Chinese (繁體中文) with Taiwan conventions
   - Keep technical terms and proper nouns in English
   - **Add spaces between Chinese and English text** (e.g., "自動提取所有可能的 amixer 命令")
   - Examples of terms to keep in English:
     - audio codec
     - driver
     - register
     - ALSA
     - DAPM
     - amixer
     - API names and technical acronyms

3. **Format Structure**
   ```markdown
   # English Title
   
   [Complete English content]
   
   ---
   
   # 中文標題
   
   [Complete Traditional Chinese content with English technical terms]
   ```

## Code Documentation Standards

- All code comments should be in English
- User-facing documentation should follow the bilingual format above
- API documentation should be in English with Chinese examples where helpful

## File Naming Conventions

- Use kebab-case for directory and file names
- Specification files should be named descriptively in English
- Include language indicators only when necessary (e.g., `readme-zh.md` for Chinese-only files)

## Test Organization Standards

### Test File Structure

1. **Separate Test Directory**
   - All test files and test data should be organized in dedicated directories
   - Keep test files separate from production code to maintain clean project structure
   - Use consistent naming patterns for test directories

2. **Recommended Directory Structure**
   ```
   project/
   ├── src/                    # Production code
   ├── tests/                  # Test files
   │   ├── unit/              # Unit tests
   │   ├── integration/       # Integration tests
   │   └── data/              # Test data files
   └── examples/              # Example files and sample data
   ```

3. **Test File Naming**
   - Prefix test files with `test_` (e.g., `test_parser.py`)
   - Use descriptive names that indicate what is being tested
   - Group related tests in subdirectories when appropriate

## Design Simplicity Standards

### Avoid Over-Design and Redundancy

1. **Continuous Design Review**
   - Regularly review specifications and designs to identify over-engineering
   - Question whether each component, feature, or requirement is truly necessary
   - Remove duplicate or similar functionality that serves the same purpose

2. **Content Duplication Prevention**
   - Avoid repeating similar requirements or design elements
   - Consolidate overlapping functionality into single, well-defined components
   - Reference existing solutions rather than creating new ones for similar problems

3. **Simplicity First Approach**
   - Start with the minimal viable solution
   - Add complexity only when clearly justified by requirements
   - Prefer simple, straightforward implementations over complex architectures

## 測試組織標準

### 測試檔案結構

1. **獨立測試目錄**
   - 所有測試檔案和測試資料應組織在專用目錄中
   - 將測試檔案與產品程式碼分開，以維持乾淨的專案結構
   - 對測試目錄使用一致的命名模式

2. **建議的目錄結構**
   ```
   project/
   ├── src/                    # 產品程式碼
   ├── tests/                  # 測試檔案
   │   ├── unit/              # 單元測試
   │   ├── integration/       # 整合測試
   │   └── data/              # 測試資料檔案
   └── examples/              # 範例檔案和樣本資料
   ```

3. **測試檔案命名**
   - 測試檔案以 `test_` 為前綴（例如 `test_parser.py`）
   - 使用描述性名稱指示正在測試的內容
   - 適當時將相關測試分組到子目錄中

---

## 設計簡潔性標準

### 避免過度設計和重複內容

1. **持續設計審查**
   - 定期審查規格和設計，識別過度工程化的問題
   - 質疑每個組件、功能或需求是否真正必要
   - 移除重複或類似的功能，避免服務相同目的的冗餘

2. **內容重複預防**
   - 避免重複類似的需求或設計元素
   - 將重疊的功能整合到單一、明確定義的組件中
   - 引用現有解決方案，而非為類似問題創建新的解決方案

3. **簡潔優先方法**
   - 從最小可行解決方案開始
   - 只有在需求明確證明必要時才增加複雜性
   - 偏好簡單、直接的實現，而非複雜的架構