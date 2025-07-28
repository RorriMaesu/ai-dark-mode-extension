/*
  Content Script: Universal Dark Mode
  -------------------------------------------------------------
  Three-tier architecture:
    1. Extension (content/popup/background scripts)
    2. Backend Proxy (Node.js server)
    3. Gemini API (LLM)

  Security Rationale:
    - No API keys or sensitive logic in this file.
    - All Gemini/LLM requests are routed through the background script, which communicates with the backend proxy.
    - The backend securely stores the Gemini API key and validates all requests/responses.
    - This protects user privacy and prevents abuse of the Gemini API key.
    - Content script only receives/injects CSS patches and sends feedback/element selection via extension messaging.
*/
// Content script to add the universal-dark-mode class to <html> and fix transparent menus/overlays
(function() {
    console.info('[ContentScript] Universal Dark Mode script loaded');

    // Listen for CSS patch injection from popup
    window.addEventListener('message', function(e) {
        console.debug('[ContentScript] window message received:', e.data);
        if (e.data && e.data.type === 'inject-darkmode-css' && e.data.css) {
            injectGeminiCssPatch(e.data.css);
        }
    });

    // Listen for extension message (from chrome.tabs.sendMessage)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            console.debug('[ContentScript] chrome.runtime.onMessage:', request);
            
            // Handle CSS injection
            if (request && request.type === 'inject-darkmode-css' && request.css) {
                injectGeminiCssPatch(request.css);
                sendResponse({ status: 'css_injected' });
                return true;
            }
            
            // Handle dark mode toggle
            if (request && request.type === 'TOGGLE_DARK_MODE') {
                console.debug('[ContentScript] Received TOGGLE_DARK_MODE:', request.enabled);
                if (request.enabled) {
                    if (!document.documentElement.classList.contains('universal-dark-mode')) {
                        document.documentElement.classList.add('universal-dark-mode');
                    }
                    // Start real-time dark mode analysis and fixing
                    initializeRealTimeDarkMode();
                } else {
                    document.documentElement.classList.remove('universal-dark-mode');
                    removeGeminiCssPatch();
                    stopRealTimeDarkMode();
                }
                sendResponse({ status: 'success' });
                return true;
            }
            
            // Handle element selection start
            if (request && request.type === 'START_ELEMENT_SELECTION') {
                console.debug('[ContentScript] Received START_ELEMENT_SELECTION');
                enhancedStartElementSelection();
                sendResponse({ status: 'selection_started' });
                return true;
            }
            
            // Handle feedback submission
            if (request && request.type === 'SUBMIT_DARKMODE_FEEDBACK') {
                console.debug('[ContentScript] Received SUBMIT_DARKMODE_FEEDBACK:', request);
                submitFeedback(request);
                sendResponse({ status: 'feedback_submitted' });
                return true;
            }
            
            // Handle page analysis for chat
            if (request && request.type === 'ANALYZE_PAGE_FOR_CHAT') {
                console.debug('[ContentScript] Received ANALYZE_PAGE_FOR_CHAT:', request);
                const analysis = analyzePageForChat();
                sendResponse(analysis);
                return true;
            }
            
            // Handle status request
            if (request && request.type === 'GET_DARK_MODE_STATUS') {
                console.debug('[ContentScript] Received GET_DARK_MODE_STATUS');
                const status = getCurrentDarkModeStatus();
                sendResponse(status);
                return true;
            }
            
            return false; // Not handled
        });
    }
    // For Firefox
    if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
        browser.runtime.onMessage.addListener(function(request, sender) {
            console.debug('[ContentScript] browser.runtime.onMessage:', request);
            if (request && request.type === 'inject-darkmode-css' && request.css) {
                injectGeminiCssPatch(request.css);
            }
        });
    }

    function injectGeminiCssPatch(css) {
        console.info('[ContentScript] injectGeminiCssPatch called with CSS:', css);
        if (!css || typeof css !== 'string') return;
        let styleTag = document.getElementById('gemini-auto-dark-mode-styles');
        if (styleTag) styleTag.remove();
        styleTag = document.createElement('style');
        styleTag.id = 'gemini-auto-dark-mode-styles';
        styleTag.textContent = css;
        document.head.appendChild(styleTag);
        console.debug('[ContentScript] Gemini CSS patch injected:', css);
    }
    if (!document.documentElement.classList.contains('universal-dark-mode')) {
        document.documentElement.classList.add('universal-dark-mode');
        console.log('[Universal Dark Mode] Added universal-dark-mode class to <html>');
    } else {
        console.log('[Universal Dark Mode] universal-dark-mode class already present on <html>');
    }

    // Improved fix for transparent menus/overlays with reduced flicker
    function isTransparent(bg) {
        console.debug('[ContentScript] isTransparent called with:', bg);
        return bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent';
    }

    function isLikelyMenu(el, style, rect, vw, vh) {
        console.debug('[ContentScript] isLikelyMenu called for element:', el, style, rect, vw, vh);
        return (
            (style.position === 'fixed' || style.position === 'absolute') &&
            parseFloat(style.zIndex) > 100 &&
            isTransparent(style.backgroundColor) &&
            el.offsetParent !== null &&
            el.offsetHeight > 40 && el.offsetWidth > 40 &&
            // Relaxed size filter: allow up to 90% of viewport
            rect.width < vw * 0.9 && rect.height < vh * 0.9 &&
            (
                el.getAttribute('role') === 'menu' ||
                el.getAttribute('role') === 'navigation' ||
                el.getAttribute('role') === 'dialog' ||
                el.getAttribute('aria-modal') === 'true' ||
                el.classList.contains('menu') ||
                el.classList.contains('nav') ||
                el.classList.contains('sidebar') ||
                el.classList.contains('drawer')
            ) &&
            !el.classList.contains('backdrop') &&
            !el.classList.contains('overlay') &&
            !el.classList.contains('main')
        );
    }

    // Use AI model for classification
    function fixTransparentMenus() {
        console.info('[ContentScript] fixTransparentMenus called');
        const vw = window.innerWidth, vh = window.innerHeight;
        document.querySelectorAll('*').forEach(el => {
            if (el.getAttribute('data-darkmode-fixed')) return;
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            // Prepare features for AI model
            const features = {
                position: style.position,
                zIndex: style.zIndex,
                backgroundColor: style.backgroundColor,
                width: el.offsetWidth,
                height: el.offsetHeight,
                classes: Array.from(el.classList),
                role: el.getAttribute('role')
            };
            // Use AI model if available
            let isMenu = false;
            if (window.classifyElement) {
                isMenu = window.classifyElement(features);
            } else {
                // fallback to heuristic
                isMenu = isLikelyMenu(el, style, rect, vw, vh);
            }
            if (isMenu) {
                el.style.setProperty('background-color', '#222', 'important');
                el.style.setProperty('color', '#e4e6eb', 'important');
                el.style.setProperty('border-color', '#444', 'important');
                el.setAttribute('data-darkmode-fixed', 'true');
                console.log('[Universal Dark Mode] Fixed universal menu:', el);
                // Show feedback prompt for accuracy reporting
                if (!el.getAttribute('data-darkmode-accuracy')) {
                    const promptDiv = document.createElement('div');
                    promptDiv.style.position = 'fixed';
                    promptDiv.style.left = (el.getBoundingClientRect().left + 10) + 'px';
                    promptDiv.style.top = (el.getBoundingClientRect().top + 10) + 'px';
                    promptDiv.style.background = '#222';
                    promptDiv.style.color = '#fff';
                    promptDiv.style.padding = '6px 12px';
                    promptDiv.style.borderRadius = '6px';
                    promptDiv.style.zIndex = '99999';
                    promptDiv.style.boxShadow = '0 2px 8px #000';
                    promptDiv.style.opacity = '0';
                    promptDiv.style.transition = 'opacity 0.5s';
                    promptDiv.innerHTML = 'Was this fix correct? <button id="fix-yes">Yes</button> <button id="fix-no">No</button>';
                    document.body.appendChild(promptDiv);
                    setTimeout(() => { promptDiv.style.opacity = '1'; }, 10);
                    el.setAttribute('data-darkmode-accuracy', 'prompted');
                    promptDiv.querySelector('#fix-yes').onclick = function() {
                        saveAccuracyFeedback(el, true);
                        promptDiv.style.opacity = '0';
                        setTimeout(() => promptDiv.remove(), 500);
                    };
                    promptDiv.querySelector('#fix-no').onclick = function() {
                        saveAccuracyFeedback(el, false);
                        promptDiv.style.opacity = '0';
                        setTimeout(() => promptDiv.remove(), 500);
                    };
                    setTimeout(() => {
                        promptDiv.style.opacity = '0';
                        setTimeout(() => { if (promptDiv.parentNode) promptDiv.remove(); }, 500);
                    }, 10000);
                }
            }
    // Save accuracy feedback to localStorage
    function saveAccuracyFeedback(el, isFixed) {
        console.info('[ContentScript] saveAccuracyFeedback called for:', el, 'isFixed:', isFixed);
        let arr = [];
        try {
            arr = JSON.parse(localStorage.getItem('darkmode_feedback') || '[]');
        } catch {}
        // Find feedback for this element (by outerHTML and url)
        const url = window.location.href;
        const outerHTML = el.outerHTML;
        let found = arr.find(f => f.outerHTML === outerHTML && f.url === url);
        if (found) {
            found.fixed = isFixed;
        } else {
            // If not found, add a new entry
            arr.push({
                outerHTML,
                tag: el.tagName,
                classes: Array.from(el.classList),
                url,
                feedback: '',
                timestamp: Date.now(),
                fixed: isFixed
            });
        }
        localStorage.setItem('darkmode_feedback', JSON.stringify(arr));
        localStorage.setItem('darkmode_last_train', Date.now().toString());
        if (window.updateModelStatus) window.updateModelStatus();
    }
        });
    }

    let debounceTimer;
    const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fixTransparentMenus, 100);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Load AI model script if not present
    if (!window.classifyElement) {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('ai-model.js');
        script.onload = () => {
            fixTransparentMenus();
        };
        document.head.appendChild(script);
    } else {
        fixTransparentMenus();
    }

    // Add: Remove Gemini CSS patch and universal-dark-mode class
    function removeGeminiCssPatch() {
        console.info('[ContentScript] removeGeminiCssPatch called');
        let styleTag = document.getElementById('gemini-auto-dark-mode-styles');
        if (styleTag) styleTag.remove();
        document.documentElement.classList.remove('universal-dark-mode');
        console.debug('[ContentScript] Gemini CSS patch removed and universal-dark-mode class removed');
    }

    // Add: Extract all accessible CSS from the page
    function extractCssFromPage() {
        console.info('[ContentScript] extractCssFromPage called');
        let allCssText = '';
        const styleSheets = Array.from(document.styleSheets);
        styleSheets.forEach(styleSheet => {
            try {
                if (styleSheet.cssRules) {
                    const cssRules = Array.from(styleSheet.cssRules);
                    cssRules.forEach(rule => {
                        allCssText += rule.cssText + '\n';
                    });
                }
            } catch (e) {
                console.warn(`[ContentScript] Could not access rules from stylesheet: ${styleSheet.href}`, e.message);
            }
        });
        console.debug('[ContentScript] Extracted CSS:', allCssText);
        return allCssText;
    }

    // Show Gemini status modal
    function showGeminiStatus(message, cssPatch) {
        console.info('[ContentScript] showGeminiStatus called:', message, cssPatch);
        let modal = document.getElementById('gemini-status-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'gemini-status-modal';
            modal.style.position = 'fixed';
            modal.style.top = '20px';
            modal.style.right = '20px';
            modal.style.background = '#222';
            modal.style.color = '#fff';
            modal.style.padding = '16px';
            modal.style.borderRadius = '8px';
            modal.style.zIndex = '99999';
            modal.style.boxShadow = '0 2px 8px #000';
            modal.style.maxWidth = '400px';
            modal.style.fontSize = '13px';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `<b>Gemini AI</b><br>${message}` + (cssPatch ? `<pre style='margin-top:8px;max-height:120px;overflow:auto;background:#111;color:#0f0;padding:8px;border-radius:4px;'>${cssPatch}</pre>` : '');
        modal.style.display = 'block';
        setTimeout(() => { modal.style.display = 'none'; }, 8000);
    }

    // Add: Entry point for dark mode conversion with feedback
    async function convertPageToDarkMode() {
        console.info('[ContentScript] convertPageToDarkMode called');
        const css = extractCssFromPage();
        if (!css || css.trim() === '') {
            showGeminiStatus('No CSS found to convert.', '');
            console.warn('[ContentScript] No CSS found to convert.');
            return;
        }
        showGeminiStatus('Gemini is analyzing the page and generating a dark mode patch...', '');
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'CONVERT_CSS_TO_DARK_MODE',
                payload: { cssData: css }
            });
            console.debug('[ContentScript] CONVERT_CSS_TO_DARK_MODE response:', response);
            if (response && response.status === 'success') {
                showGeminiStatus('Gemini generated the following CSS patch:', response.payload.newCss);
                injectGeminiCssPatch(response.payload.newCss);
            } else {
                showGeminiStatus('Gemini failed to generate a patch.', response ? response.payload.error : 'No response');
                console.error('[ContentScript] Conversion failed.', response ? response.payload.error : 'No response');
            }
        } catch (error) {
            showGeminiStatus('Error communicating with Gemini.', error.message);
            console.error('[ContentScript] Error sending message to service worker.', error);
        }
    }

    // Real-time dark mode analysis and fixing
    let realTimeDarkModeInterval;
    let lastKnownIssues = [];
    
    function initializeRealTimeDarkMode() {
        console.info('[ContentScript] Initializing real-time dark mode');
        
        // Clear any existing interval
        if (realTimeDarkModeInterval) {
            clearInterval(realTimeDarkModeInterval);
        }
        
        // Start continuous analysis
        let analysisCycle = 0;
        realTimeDarkModeInterval = setInterval(() => {
            analyzeDarkModeIssues();
            
            // Optional: Retrain AI model every 10 cycles (20 seconds) if new feedback exists
            analysisCycle++;
            if (analysisCycle % 10 === 0 && window.trainModelFromFeedback) {
                const lastTrain = localStorage.getItem('darkmode_last_train');
                const feedbackData = localStorage.getItem('darkmode_feedback');
                if (feedbackData) {
                    try {
                        const feedback = JSON.parse(feedbackData);
                        const lastFeedbackTime = Math.max(...feedback.map(f => f.timestamp || 0));
                        if (!lastTrain || lastFeedbackTime > parseInt(lastTrain)) {
                            console.debug('[ContentScript] Retraining AI model with new feedback');
                            window.trainModelFromFeedback();
                        }
                    } catch (e) {
                        console.debug('[ContentScript] Error checking feedback for retraining:', e);
                    }
                }
            }
        }, 2000); // Check every 2 seconds
        
        // Run immediate analysis
        analyzeDarkModeIssues();
    }
    
    function stopRealTimeDarkMode() {
        console.info('[ContentScript] Stopping real-time dark mode');
        if (realTimeDarkModeInterval) {
            clearInterval(realTimeDarkModeInterval);
            realTimeDarkModeInterval = null;
        }
        lastKnownIssues = [];
    }
    
    function analyzeDarkModeIssues() {
        console.debug('[ContentScript] Analyzing dark mode issues');
        
        const issues = [];
        const elements = document.querySelectorAll('*');
        
        elements.forEach(el => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            
            // Skip invisible elements
            if (rect.width === 0 || rect.height === 0) return;
            
            // Check for problematic elements
            const problems = [];
            
            // 1. Transparent backgrounds on menus/dropdowns
            if (isLikelyMenu(el, style, rect, window.innerWidth, window.innerHeight)) {
                if (isTransparent(style.backgroundColor)) {
                    problems.push('transparent_menu_background');
                }
            }
            
            // 2. Light text on light background
            const bgColor = style.backgroundColor;
            const textColor = style.color;
            if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && textColor) {
                const bgLightness = colorToLightness(bgColor);
                const textLightness = colorToLightness(textColor);
                const contrast = Math.abs(bgLightness - textLightness);
                
                if (contrast < 0.3) { // Poor contrast
                    problems.push('poor_contrast');
                }
            }
            
            // 3. White backgrounds that should be dark
            if (bgColor && (bgColor.includes('255, 255, 255') || bgColor === 'white' || bgColor === '#ffffff')) {
                problems.push('white_background');
            }
            
            // 4. Elements with visibility issues
            if (style.visibility === 'hidden' && el.textContent && el.textContent.trim()) {
                problems.push('hidden_content');
            }
            
            if (problems.length > 0) {
                issues.push({
                    element: el,
                    tag: el.tagName.toLowerCase(),
                    classes: Array.from(el.classList),
                    xpath: getXPath(el),
                    problems: problems,
                    styles: {
                        backgroundColor: style.backgroundColor,
                        color: style.color,
                        position: style.position,
                        zIndex: style.zIndex,
                        visibility: style.visibility
                    }
                });
            }
        });
        
        // Only process if issues have changed
        if (JSON.stringify(issues) !== JSON.stringify(lastKnownIssues)) {
            lastKnownIssues = [...issues];
            
            if (issues.length > 0) {
                console.debug(`[ContentScript] Found ${issues.length} dark mode issues`);
                
                // Send to popup for status update
                sendStatusUpdate({
                    problemsFound: issues.length,
                    analyzing: false,
                    lastAnalysis: Date.now()
                });
                
                // Auto-fix transparent menu issues immediately
                const transparentMenus = issues.filter(issue => issue.problems.includes('transparent_menu_background'));
                autoFixTransparentMenus(transparentMenus);
            } else {
                sendStatusUpdate({
                    problemsFound: 0,
                    analyzing: false,
                    lastAnalysis: Date.now()
                });
            }
        }
    }
    
    function autoFixTransparentMenus(menuIssues) {
        console.debug('[ContentScript] Auto-fixing transparent menus:', menuIssues);
        
        let cssPatches = [];
        
        menuIssues.forEach(issue => {
            const selector = generateCssSelector(issue.element);
            const patch = `
                ${selector} {
                    background-color: #222 !important;
                    color: #e4e6ea !important;
                    border: 1px solid #444 !important;
                }
                ${selector} a, ${selector} span, ${selector} div {
                    color: #e4e6ea !important;
                }
                ${selector}:hover {
                    background-color: #333 !important;
                }
            `;
            cssPatches.push(patch);
        });
        
        if (cssPatches.length > 0) {
            const combinedPatch = cssPatches.join('\n');
            injectGeminiCssPatch(combinedPatch);
            
            sendStatusUpdate({
                fixesApplied: menuIssues.length,
                lastAnalysis: Date.now()
            });
        }
    }
    
    function generateCssSelector(element) {
        // Generate a specific CSS selector for the element
        let selector = element.tagName.toLowerCase();
        
        if (element.id) {
            selector += `#${element.id}`;
        }
        
        if (element.classList.length > 0) {
            selector += '.' + Array.from(element.classList).join('.');
        }
        
        return selector;
    }
    
    function sendStatusUpdate(status) {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    type: 'DARK_MODE_STATUS_UPDATE',
                    ...status
                });
            }
        } catch (error) {
            console.debug('[ContentScript] Could not send status update:', error);
        }
    }
    
    function colorToLightness(color) {
        // Parse rgb/rgba/hex and return lightness (0=dark, 1=light)
        if (!color) return 0;
        let r = 0, g = 0, b = 0;
        
        if (color.startsWith('rgb')) {
            const vals = color.match(/\d+/g);
            if (vals && vals.length >= 3) {
                r = parseInt(vals[0]);
                g = parseInt(vals[1]);
                b = parseInt(vals[2]);
            }
        } else if (color.startsWith('#')) {
            const hex = color.substring(1);
            if (hex.length === 6) {
                r = parseInt(hex.substring(0, 2), 16);
                g = parseInt(hex.substring(2, 4), 16);
                b = parseInt(hex.substring(4, 6), 16);
            }
        }
        
        // Perceived lightness formula
        return Math.max(0, Math.min(1, (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255));
    }
    
    // Enhanced element selection with Edge-style highlighting
    function enhancedStartElementSelection() {
        console.info('[ContentScript] Starting enhanced element selection');
        
        if (selectionActive) return;
        selectionActive = true;
        
        // Create enhanced overlay with Edge-style highlighting
        createEnhancedOverlay();
        
        // Add event listeners
        document.addEventListener('mousemove', enhancedMouseMove, true);
        document.addEventListener('click', enhancedClickHandler, true);
        
        // Auto-cancel after 30 seconds
        selectionTimeout = setTimeout(() => {
            endElementSelection();
        }, 30000);
    }
    
    function createEnhancedOverlay() {
        // Remove existing overlay
        const existingOverlay = document.getElementById('darkmode-enhanced-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        // Create main overlay
        selectorOverlay = document.createElement('div');
        selectorOverlay.id = 'darkmode-enhanced-overlay';
        selectorOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.1);
            z-index: 99998;
            pointer-events: none;
            backdrop-filter: blur(1px);
        `;
        document.body.appendChild(selectorOverlay);
        
        // Create tooltip
        selectorTooltip = document.createElement('div');
        selectorTooltip.style.cssText = `
            position: fixed;
            background: #2d2d30;
            color: #cccccc;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            z-index: 99999;
            pointer-events: none;
            border: 1px solid #464647;
            max-width: 300px;
        `;
        selectorTooltip.innerHTML = `
            <strong>🔍 Element Inspector</strong><br>
            <small>Hover to highlight • Click to select • ESC to cancel</small>
        `;
        document.body.appendChild(selectorTooltip);
        
        // Add escape key listener
        document.addEventListener('keydown', handleEscapeKey, true);
    }
    
    function enhancedMouseMove(e) {
        if (!selectorTooltip) return;
        
        // Update tooltip position
        selectorTooltip.style.left = (e.clientX + 15) + 'px';
        selectorTooltip.style.top = (e.clientY + 15) + 'px';
        
        // Get element under cursor
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el && el !== lastHighlighted && !el.closest('#darkmode-enhanced-overlay') && el !== selectorTooltip) {
            enhancedHighlight(el);
            updateTooltipInfo(el);
        }
    }
    
    function enhancedHighlight(el) {
        // Remove previous highlighting
        if (lastHighlighted) {
            lastHighlighted.style.outline = lastHighlighted._darkModeOriginalOutline || '';
            lastHighlighted.style.boxShadow = lastHighlighted._darkModeOriginalBoxShadow || '';
        }
        
        // Apply Edge-style highlighting
        lastHighlighted = el;
        el._darkModeOriginalOutline = el.style.outline;
        el._darkModeOriginalBoxShadow = el.style.boxShadow;
        
        el.style.outline = '2px solid #007acc';
        el.style.boxShadow = '0 0 0 1px rgba(0, 122, 204, 0.2), inset 0 0 0 2px rgba(0, 122, 204, 0.1)';
    }
    
    function updateTooltipInfo(el) {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        
        // Analyze element for dark mode issues
        const issues = [];
        if (isTransparent(style.backgroundColor) && isLikelyMenu(el, style, rect, window.innerWidth, window.innerHeight)) {
            issues.push('Transparent background');
        }
        if (style.color && colorToLightness(style.color) > 0.7) {
            issues.push('Light text color');
        }
        
        selectorTooltip.innerHTML = `
            <strong>🔍 Element Inspector</strong><br>
            <strong>${el.tagName.toLowerCase()}</strong>
            ${el.id ? ` #${el.id}` : ''}
            ${el.classList.length ? ` .${Array.from(el.classList).join('.')}` : ''}<br>
            <small>Size: ${Math.round(rect.width)}×${Math.round(rect.height)}px</small><br>
            ${issues.length ? `<small style="color: #ff6b6b;">⚠️ ${issues.join(', ')}</small><br>` : ''}
            <small>Click to report issue • ESC to cancel</small>
        `;
    }
    
    function enhancedClickHandler(e) {
        if (!selectionActive) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const el = e.target;
        endElementSelection();
        
        // Send element data with enhanced info
        const elementData = {
            tag: el.tagName.toLowerCase(),
            classes: Array.from(el.classList),
            xpath: getXPath(el),
            styles: {
                backgroundColor: window.getComputedStyle(el).backgroundColor,
                color: window.getComputedStyle(el).color,
                position: window.getComputedStyle(el).position,
                zIndex: window.getComputedStyle(el).zIndex
            },
            rect: el.getBoundingClientRect(),
            issues: analyzeElementIssues(el)
        };
        
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    type: 'ELEMENT_SELECTED_FOR_FEEDBACK',
                    ...elementData
                });
            }
        } catch (error) {
            console.error('[ContentScript] Error sending element selection:', error);
        }
    }
    
    function analyzeElementIssues(el) {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const issues = [];
        
        // Check for common dark mode issues
        if (isTransparent(style.backgroundColor) && isLikelyMenu(el, style, rect, window.innerWidth, window.innerHeight)) {
            issues.push('Transparent menu background makes text hard to read');
        }
        
        if (style.backgroundColor && style.backgroundColor.includes('255, 255, 255')) {
            issues.push('White background should be dark in dark mode');
        }
        
        if (style.color && colorToLightness(style.color) > 0.7 && style.backgroundColor && colorToLightness(style.backgroundColor) > 0.7) {
            issues.push('Poor contrast between text and background');
        }
        
        return issues;
    }
    
    function handleEscapeKey(e) {
        if (e.key === 'Escape' && selectionActive) {
            endElementSelection();
        }
    }
    
    function analyzePageForChat() {
        console.debug('[ContentScript] Analyzing page for chat');
        
        const analysis = {
            url: window.location.href,
            title: document.title,
            cssRules: extractRelevantCSS(),
            darkModeIssues: lastKnownIssues,
            elementCount: document.querySelectorAll('*').length,
            hasTransparentMenus: document.querySelectorAll('[style*="transparent"], [style*="rgba(0, 0, 0, 0)"]').length,
            timestamp: Date.now()
        };
        
        return analysis;
    }
    
    function extractRelevantCSS() {
        // Extract CSS rules that might be relevant for dark mode
        const relevantRules = [];
        
        try {
            for (let i = 0; i < document.styleSheets.length; i++) {
                const sheet = document.styleSheets[i];
                try {
                    const rules = sheet.cssRules || sheet.rules;
                    for (let j = 0; j < Math.min(rules.length, 50); j++) { // Limit to first 50 rules
                        const rule = rules[j];
                        if (rule.style && (
                            rule.selectorText.includes('.menu') ||
                            rule.selectorText.includes('.dropdown') ||
                            rule.selectorText.includes('.nav') ||
                            rule.style.backgroundColor ||
                            rule.style.color
                        )) {
                            relevantRules.push({
                                selector: rule.selectorText,
                                styles: {
                                    backgroundColor: rule.style.backgroundColor,
                                    color: rule.style.color,
                                    position: rule.style.position,
                                    zIndex: rule.style.zIndex
                                }
                            });
                        }
                    }
                } catch (e) {
                    // Cross-origin or other CSS access issues
                    console.debug('[ContentScript] Could not access stylesheet:', e);
                }
            }
        } catch (error) {
            console.debug('[ContentScript] Error extracting CSS:', error);
        }
        
        return relevantRules;
    }
    
    function getCurrentDarkModeStatus() {
        return {
            enabled: document.documentElement.classList.contains('universal-dark-mode'),
            problemsFound: lastKnownIssues.length,
            analyzing: !!realTimeDarkModeInterval,
            lastAnalysis: Date.now(),
            url: window.location.href
        };
    }
})();
