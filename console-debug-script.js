// 在 Marcus Folkesson 網頁的控制台中運行此腳本
(function() {
    console.log('🔍 開始分析 Marcus Folkesson 網頁...');
    
    // 檢查是否在正確的網頁
    if (!window.location.href.includes('marcusfolkesson.se')) {
        console.warn('⚠️ 這不是 Marcus Folkesson 的網頁');
    }
    
    // 獲取所有文本節點
    function getAllTextNodes() {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.trim().length > 0) {
                textNodes.push(node);
            }
        }
        
        return textNodes;
    }
    
    // 分析元素信息
    function analyzeElement(element) {
        if (!element) return { tagName: 'unknown', className: '', id: '', path: '' };
        
        const path = [];
        let current = element;
        
        while (current && current !== document.body && path.length < 3) {
            let selector = current.tagName.toLowerCase();
            if (current.id) {
                selector += `#${current.id}`;
            } else if (current.className) {
                const classes = current.className.split(' ').filter(c => c.trim());
                if (classes.length > 0) {
                    selector += `.${classes[0]}`;
                }
            }
            path.unshift(selector);
            current = current.parentElement;
        }
        
        return {
            tagName: element.tagName,
            className: element.className || '',
            id: element.id || '',
            path: path.join(' > '),
            isVisible: isElementVisible(element)
        };
    }
    
    // 檢查元素可見性
    function isElementVisible(element) {
        if (!element) return false;
        const style = getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0';
    }
    
    // 檢查是否為文章內容
    function isArticleContent(element) {
        if (!element) return false;
        
        let current = element;
        while (current && current !== document.body) {
            const tagName = current.tagName.toLowerCase();
            const className = current.className.toLowerCase();
            const id = current.id.toLowerCase();
            
            if (['article', 'main'].includes(tagName)) {
                return true;
            }
            
            if (className.includes('content') || 
                className.includes('article') || 
                className.includes('post') ||
                className.includes('entry') ||
                id.includes('content') ||
                id.includes('article')) {
                return true;
            }
            
            current = current.parentElement;
        }
        
        const articleTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'];
        return articleTags.includes(element.tagName.toLowerCase());
    }
    
    // 檢查過濾條件
    function checkFilters(node, text, element) {
        const checks = {
            textLength: text.length >= 5 && text.length <= 2000,
            isVisible: isElementVisible(element),
            notPureSymbols: !/^[\s\d\W]*$/.test(text),
            isArticleContent: isArticleContent(element)
        };
        
        return checks;
    }
    
    // 主要分析
    const allTextNodes = getAllTextNodes();
    console.log(`📊 檢測到 ${allTextNodes.length} 個文本節點`);
    
    const analysis = allTextNodes.map((node, index) => {
        const text = node.textContent.trim();
        const element = node.parentElement;
        const elementInfo = analyzeElement(element);
        const checks = checkFilters(node, text, element);
        const passed = Object.values(checks).every(check => check);
        
        return {
            index,
            text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            fullText: text,
            element,
            elementInfo,
            checks,
            passed,
            isArticleContent: checks.isArticleContent
        };
    });
    
    const passedNodes = analysis.filter(a => a.passed);
    const articleNodes = analysis.filter(a => a.isArticleContent);
    const filteredNodes = analysis.filter(a => !a.passed);
    
    console.log(`✅ 通過過濾: ${passedNodes.length} 個`);
    console.log(`📄 文章內容: ${articleNodes.length} 個`);
    console.log(`❌ 被過濾: ${filteredNodes.length} 個`);
    console.log(`📈 過濾率: ${((filteredNodes.length / allTextNodes.length) * 100).toFixed(1)}%`);
    
    // 顯示頁面結構
    console.log('\n📋 頁面結構分析:');
    console.log('Articles:', document.querySelectorAll('article').length);
    console.log('Mains:', document.querySelectorAll('main').length);
    console.log('Content divs:', document.querySelectorAll('[class*="content"], [id*="content"]').length);
    console.log('Paragraphs:', document.querySelectorAll('p').length);
    console.log('Headings:', document.querySelectorAll('h1, h2, h3, h4, h5, h6').length);
    
    // 顯示被過濾的文章內容
    console.log('\n❌ 被過濾的文章內容:');
    const filteredArticleContent = analysis.filter(a => a.isArticleContent && !a.passed);
    filteredArticleContent.forEach(item => {
        const failedChecks = Object.entries(item.checks)
            .filter(([key, value]) => !value)
            .map(([key]) => key);
        
        console.log(`📝 "${item.text}" - 原因: ${failedChecks.join(', ')}`);
        console.log(`   路徑: ${item.elementInfo.path}`);
    });
    
    // 顯示通過的內容
    console.log('\n✅ 通過過濾的內容:');
    passedNodes.slice(0, 10).forEach(item => {
        console.log(`📝 "${item.text}"`);
        console.log(`   路徑: ${item.elementInfo.path}`);
    });
    
    // 返回分析結果供進一步檢查
    window.translationAnalysis = analysis;
    console.log('\n💡 分析結果已保存到 window.translationAnalysis');
    
})();