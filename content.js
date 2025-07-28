/*
  Content Script: Universal Dark Mode Extension
  -------------------------------------------------------------
  This script runs in the context of the web page and is responsible for:
    - Applying and removing dark mode styles.
    - Handling communication with the popup script (e.g., for toggling dark mode).
    - Managing the element selector for user feedback.
    - Performing real-time analysis of the page for dark mode issues.
    - Integrating AI learning for predictive dark mode fixes.
*/

// Cross-browser API compatibility
const browserAPI = (function() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        return chrome;
    } else if (typeof browser !== 'undefined' && browser.runtime) {
        return browser;
    } else {
        // Fallback for Edge legacy
        return chrome;
    }
})();

// Initialize AI Learning Engine
let aiLearning = null;
try {
    aiLearning = new AILearningEngine();
    console.debug('[Content] AI Learning Engine initialized');
} catch (error) {
    console.warn('[Content] AI Learning Engine not available:', error);
}

// Function to get the XPath of an element
function getXPath(element) {
    if (element.id !== '') {
        return 'id("' + element.id + '")';
    }
    if (element === document.body) {
        return element.tagName.toLowerCase();
    }

    let ix = 0;
    const siblings = element.parentNode.childNodes;
    for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];
        if (sibling === element) {
            return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
        }
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
            ix++;
        }
    }
}

// --- Element Selection Logic ---

let isSelecting = false;
let selectionTimeout;

function startElementSelection() {
    if (isSelecting) return;
    isSelecting = true;
    document.addEventListener('mouseover', highlightElement);
    document.addEventListener('mouseout', removeHighlight);
    document.addEventListener('click', selectElement, true); // Use capture to get click before page handlers

    // Timeout to stop selection after a while
    selectionTimeout = setTimeout(() => {
        stopElementSelection();
    }, 10000); // 10 seconds
}

function stopElementSelection() {
    isSelecting = false;
    document.removeEventListener('mouseover', highlightElement);
    document.removeEventListener('mouseout', removeHighlight);
    document.removeEventListener('click', selectElement, true);
    clearTimeout(selectionTimeout);
    removeHighlight({ target: document.body }); // Clear any lingering highlight
}

function highlightElement(e) {
    if (!isSelecting) return;
    e.target.style.outline = '2px solid #007bff'; // Blue highlight
}

function removeHighlight(e) {
    e.target.style.outline = '';
}

function selectElement(e) {
    if (!isSelecting) return;
    e.preventDefault();
    e.stopPropagation();

    const element = e.target;
    
    console.debug('[Content] Element selected:', element);
    
    try {
        // Collect comprehensive element data for Gemini analysis
        const elementData = getComprehensiveElementData(element);
        
        console.debug('[Content] Element data collected:', elementData);
        
        // Send selected element data back to the popup
        browserAPI.runtime.sendMessage({
            type: 'ELEMENT_SELECTED_FOR_FEEDBACK',
            ...elementData
        }, (response) => {
            if (browserAPI.runtime.lastError) {
                console.error('[Content] Error sending element data:', browserAPI.runtime.lastError.message);
            } else {
                console.debug('[Content] Element data sent successfully:', response);
            }
        });
        
    } catch (error) {
        console.error('[Content] Error collecting element data:', error);
        
        // Fallback to basic element data
        const basicData = {
            tag: element.tagName,
            classes: Array.from(element.classList),
            xpath: getXPath(element),
            error: 'Could not collect comprehensive data: ' + error.message
        };
        
        browserAPI.runtime.sendMessage({
            type: 'ELEMENT_SELECTED_FOR_FEEDBACK',
            ...basicData
        }, (response) => {
            if (browserAPI.runtime.lastError) {
                console.error('[Content] Error sending basic element data:', browserAPI.runtime.lastError.message);
            } else {
                console.debug('[Content] Basic element data sent:', response);
            }
        });
    }

    stopElementSelection();
}

// Collect comprehensive element data for AI analysis
function getComprehensiveElementData(element) {
    const computedStyle = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    // Get element's HTML content (limited to avoid huge payloads)
    let innerHTML = element.innerHTML;
    if (innerHTML.length > 500) {
        innerHTML = innerHTML.substring(0, 500) + '... [truncated]';
    }
    
    // Get parent context for better understanding
    const parent = element.parentElement;
    const parentData = parent ? {
        tag: parent.tagName,
        classes: Array.from(parent.classList),
        styles: {
            backgroundColor: window.getComputedStyle(parent).backgroundColor,
            color: window.getComputedStyle(parent).color,
            display: window.getComputedStyle(parent).display
        }
    } : null;
    
    // Collect relevant CSS properties for dark mode analysis
    const relevantStyles = {
        backgroundColor: computedStyle.backgroundColor,
        color: computedStyle.color,
        borderColor: computedStyle.borderColor,
        borderStyle: computedStyle.borderStyle,
        borderWidth: computedStyle.borderWidth,
        opacity: computedStyle.opacity,
        visibility: computedStyle.visibility,
        display: computedStyle.display,
        position: computedStyle.position,
        zIndex: computedStyle.zIndex,
        fontSize: computedStyle.fontSize,
        fontWeight: computedStyle.fontWeight,
        textAlign: computedStyle.textAlign,
        padding: computedStyle.padding,
        margin: computedStyle.margin,
        boxShadow: computedStyle.boxShadow,
        textShadow: computedStyle.textShadow,
        backgroundImage: computedStyle.backgroundImage,
        backgroundSize: computedStyle.backgroundSize,
        backgroundRepeat: computedStyle.backgroundRepeat
    };
    
    // Check if element or its children contain text
    const hasText = element.textContent && element.textContent.trim().length > 0;
    const textContent = hasText ? element.textContent.trim().substring(0, 200) : '';
    
    // Detect element type and purpose
    const elementType = detectElementType(element);
    
    // Check for common dark mode issues
    const issues = detectDarkModeIssues(element, computedStyle);
    
    return {
        // Basic info
        tag: element.tagName,
        classes: Array.from(element.classList),
        id: element.id || '',
        xpath: getXPath(element),
        
        // Visual context
        innerHTML: innerHTML,
        textContent: textContent,
        hasText: hasText,
        elementType: elementType,
        
        // Styling info
        computedStyles: relevantStyles,
        dimensions: {
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left
        },
        
        // Context
        parentContext: parentData,
        url: window.location.href,
        title: document.title,
        
        // Issues detected
        detectedIssues: issues,
        
        // Meta info
        timestamp: Date.now()
    };
}

// Detect element type and purpose for better AI understanding
function detectElementType(element) {
    const tag = element.tagName.toLowerCase();
    const classes = Array.from(element.classList).join(' ').toLowerCase();
    const text = element.textContent.trim();
    
    // Button detection
    if (tag === 'button' || classes.includes('btn') || classes.includes('button')) {
        return 'button';
    }
    
    // Navigation detection
    if (tag === 'nav' || classes.includes('nav') || classes.includes('menu')) {
        return 'navigation';
    }
    
    // Header detection
    if (tag.match(/^h[1-6]$/) || classes.includes('header') || classes.includes('title')) {
        return 'header';
    }
    
    // Form elements
    if (['input', 'textarea', 'select', 'form'].includes(tag)) {
        return 'form';
    }
    
    // Links
    if (tag === 'a') {
        return 'link';
    }
    
    // Content areas
    if (classes.includes('content') || classes.includes('article') || tag === 'article') {
        return 'content';
    }
    
    // Sidebars
    if (classes.includes('sidebar') || classes.includes('aside') || tag === 'aside') {
        return 'sidebar';
    }
    
    // Cards/containers
    if (classes.includes('card') || classes.includes('container') || classes.includes('box')) {
        return 'container';
    }
    
    return 'generic';
}

// Detect common dark mode issues with an element
function detectDarkModeIssues(element, computedStyle) {
    const issues = [];
    
    // Parse colors for analysis
    const bgColor = parseColor(computedStyle.backgroundColor);
    const textColor = parseColor(computedStyle.color);
    
    // Issue 1: Light background with dark text (common issue)
    if (isLightColor(bgColor) && isDarkColor(textColor)) {
        issues.push('light_background_dark_text');
    }
    
    // Issue 2: Transparent/no background with dark text on potentially dark page
    if (bgColor.alpha === 0 && isDarkColor(textColor)) {
        issues.push('transparent_background_dark_text');
    }
    
    // Issue 3: White or very light backgrounds
    if (bgColor.r > 240 && bgColor.g > 240 && bgColor.b > 240) {
        issues.push('very_light_background');
    }
    
    // Issue 4: Very low contrast
    if (textColor.r !== 0 || textColor.g !== 0 || textColor.b !== 0) {
        const contrast = calculateContrast(bgColor, textColor);
        if (contrast < 3) {
            issues.push('low_contrast');
        }
    }
    
    // Issue 5: Invisible or hard to see elements
    if (computedStyle.opacity !== '1' && parseFloat(computedStyle.opacity) < 0.5) {
        issues.push('low_opacity');
    }
    
    // Issue 6: Bright border colors
    const borderColor = parseColor(computedStyle.borderColor);
    if (isLightColor(borderColor) && computedStyle.borderStyle !== 'none') {
        issues.push('light_border');
    }
    
    return issues;
}

// Helper function to parse CSS color values
function parseColor(colorStr) {
    if (!colorStr || colorStr === 'transparent') {
        return { r: 0, g: 0, b: 0, alpha: 0 };
    }
    
    // Handle rgba/rgb
    const rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbaMatch) {
        return {
            r: parseInt(rgbaMatch[1]),
            g: parseInt(rgbaMatch[2]),
            b: parseInt(rgbaMatch[3]),
            alpha: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
        };
    }
    
    // Handle hex colors
    const hexMatch = colorStr.match(/^#([a-f\d]{3}|[a-f\d]{6})$/i);
    if (hexMatch) {
        const hex = hexMatch[1];
        if (hex.length === 3) {
            return {
                r: parseInt(hex[0] + hex[0], 16),
                g: parseInt(hex[1] + hex[1], 16),
                b: parseInt(hex[2] + hex[2], 16),
                alpha: 1
            };
        } else {
            return {
                r: parseInt(hex.slice(0, 2), 16),
                g: parseInt(hex.slice(2, 4), 16),
                b: parseInt(hex.slice(4, 6), 16),
                alpha: 1
            };
        }
    }
    
    return { r: 0, g: 0, b: 0, alpha: 1 };
}

// Check if a color is considered "light"
function isLightColor(color) {
    if (color.alpha === 0) return false;
    const brightness = (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
    return brightness > 128;
}

// Check if a color is considered "dark"  
function isDarkColor(color) {
    if (color.alpha === 0) return false;
    const brightness = (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
    return brightness < 128;
}

// Calculate contrast ratio between two colors
function calculateContrast(color1, color2) {
    const l1 = getLuminance(color1);
    const l2 = getLuminance(color2);
    const brightest = Math.max(l1, l2);
    const darkest = Math.min(l1, l2);
    return (brightest + 0.05) / (darkest + 0.05);
}

// Calculate relative luminance of a color
function getLuminance(color) {
    const rsRGB = color.r / 255;
    const gsRGB = color.g / 255;
    const bsRGB = color.b / 255;
    
    const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Listen for messages from the popup or background script
browserAPI.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.debug('[Content] Received message:', msg);

    switch (msg.type) {
        case 'TOGGLE_DARK_MODE':
            // Implement dark mode toggling logic here
            if (msg.enabled) {
                document.documentElement.classList.add('universal-dark-mode');
            } else {
                document.documentElement.classList.remove('universal-dark-mode');
            }
            sendResponse({ status: 'ok' });
            break;

        case 'START_ELEMENT_SELECTION':
            startElementSelection();
            sendResponse({ status: 'ok' });
            break;

        case 'SUBMIT_DARKMODE_FEEDBACK':
            // Enhanced feedback submission with local storage
            try {
                const feedbackData = {
                    tag: msg.tag,
                    classes: msg.classes,
                    xpath: msg.xpath,
                    description: msg.description,
                    url: window.location.href,
                    timestamp: Date.now(),
                    fixed: false // Will be updated when fixes are applied
                };
                
                // Store feedback in localStorage for analytics
                let feedbackList = [];
                try {
                    feedbackList = JSON.parse(localStorage.getItem('darkmode_feedback') || '[]');
                } catch (e) {
                    console.warn('[Content] Could not parse existing feedback data');
                }
                
                feedbackList.push(feedbackData);
                localStorage.setItem('darkmode_feedback', JSON.stringify(feedbackList));
                
                console.debug('[Content] Feedback stored:', feedbackData);
                sendResponse({ status: 'ok', stored: true });
            } catch (error) {
                console.error('[Content] Error storing feedback:', error);
                sendResponse({ status: 'error', error: error.message });
            }
            break;

        case 'ANALYZE_PAGE_FOR_CHAT':
            // Enhanced page analysis for chat functionality with AI learning
            const pageAnalysis = analyzePageForDarkMode();
            
            // Use AI learning to predict potential fixes
            if (aiLearning) {
                aiLearning.generatePredictiveCSS(
                    { tag: 'page', classes: [], description: 'page analysis' },
                    { url: window.location.href, analysis: pageAnalysis }
                ).then(predictiveFix => {
                    if (predictiveFix && predictiveFix.confidence > 0.7) {
                        pageAnalysis.predictedFix = predictiveFix;
                        console.debug('[Content] High-confidence predictive fix available:', predictiveFix);
                    }
                    
                    sendResponse({ 
                        status: 'ok', 
                        url: window.location.href,
                        title: document.title,
                        ...pageAnalysis
                    });
                }).catch(error => {
                    console.debug('[Content] Predictive fix generation failed:', error);
                    sendResponse({ 
                        status: 'ok', 
                        url: window.location.href,
                        title: document.title,
                        ...pageAnalysis
                    });
                });
            } else {
                sendResponse({ 
                    status: 'ok', 
                    url: window.location.href,
                    title: document.title,
                    ...pageAnalysis
                });
            }
            break;

        case 'GET_DARK_MODE_STATUS':
            // Enhanced status retrieval with real-time analysis
            const currentStatus = getCurrentDarkModeStatus();
            sendResponse({ 
                status: 'ok', 
                ...currentStatus
            });
            break;

        case 'ANALYZE_DARK_MODE_ISSUES':
            // Real-time issue analysis
            const issues = findDarkModeIssues();
            sendResponse({ 
                status: 'ok', 
                issues: issues,
                timestamp: Date.now()
            });
            break;
        
        case 'VERIFY_DARK_MODE_FIXES':
            // Post-patch verification
            const verification = verifyDarkModeFixes();
            sendResponse({
                status: 'ok',
                ...verification
            });
            break;
        
        case 'inject-darkmode-css':
            // Enhanced CSS injection with AI learning tracking and user feedback
            try {
                const style = document.createElement('style');
                style.textContent = msg.css;
                style.setAttribute('data-darkmode-patch', Date.now());
                style.setAttribute('data-source', msg.source || 'gemini');
                style.setAttribute('data-element-info', JSON.stringify(msg.elementInfo || {}));
                document.head.appendChild(style);
                
                // Track successful CSS application for AI learning
                if (aiLearning && msg.elementData) {
                    aiLearning.trackFixSuccess(
                        msg.elementData, 
                        msg.css, 
                        'applied' // Initial state
                    ).then(result => {
                        console.debug('[Content] CSS application tracked for learning:', result);
                    }).catch(error => {
                        console.debug('[Content] Learning tracking failed:', error);
                    });
                }
                
                // Provide user feedback on the fix
                if (msg.elementInfo) {
                    console.info(`[Content] Applied dark mode fix for ${msg.elementInfo.tag} element:`, {
                        description: msg.elementInfo.description,
                        xpath: msg.elementInfo.xpath,
                        css: msg.css
                    });
                    
                    // Try to verify the fix was applied by checking the element
                    setTimeout(() => {
                        try {
                            const element = document.evaluate(
                                msg.elementInfo.xpath, 
                                document, 
                                null, 
                                XPathResult.FIRST_ORDERED_NODE_TYPE, 
                                null
                            ).singleNodeValue;
                            
                            if (element) {
                                const newStyles = window.getComputedStyle(element);
                                console.debug('[Content] Element styles after fix:', {
                                    backgroundColor: newStyles.backgroundColor,
                                    color: newStyles.color,
                                    borderColor: newStyles.borderColor
                                });
                            }
                        } catch (verifyError) {
                            console.debug('[Content] Could not verify fix application:', verifyError);
                        }
                    }, 100);
                }
                
                console.debug('[Content] CSS patch applied:', msg.css);
                sendResponse({ 
                    status: 'ok', 
                    applied: true,
                    patchId: Date.now(),
                    elementInfo: msg.elementInfo 
                });
            } catch (error) {
                console.error('[Content] CSS injection failed:', error);
                sendResponse({ status: 'error', error: error.message });
            }
            break;

        case 'RATE_AI_FIX':
            // Handle user rating of AI-generated fixes for learning
            if (aiLearning && msg.elementData && msg.appliedCSS) {
                aiLearning.trackFixSuccess(
                    msg.elementData,
                    msg.appliedCSS,
                    msg.rating // 'up', 'down', or 'neutral'
                ).then(result => {
                    console.debug('[Content] User rating tracked for learning:', result);
                    sendResponse({ status: 'ok', tracked: true });
                }).catch(error => {
                    console.error('[Content] Rating tracking failed:', error);
                    sendResponse({ status: 'error', error: error.message });
                });
            } else {
                sendResponse({ status: 'error', reason: 'AI learning not available' });
            }
            break;

        case 'GET_LEARNING_REPORT':
            // Generate and return learning analytics report
            if (aiLearning) {
                aiLearning.generateLearningReport().then(report => {
                    sendResponse({ status: 'ok', report });
                }).catch(error => {
                    console.error('[Content] Learning report generation failed:', error);
                    sendResponse({ status: 'error', error: error.message });
                });
            } else {
                sendResponse({ status: 'error', reason: 'AI learning not available' });
            }
            break;

        default:
            // It's good practice to handle unknown message types.
            console.warn('[Content] Received unknown message type:', msg.type);
            // To prevent the "port closed" error, we should still send a response.
            // We can indicate that the message was not handled.
            sendResponse({ status: 'error', reason: 'unknown message type' });
            break;
    }

    // Return true to indicate that we will send a response asynchronously.
    // This is crucial for preventing the "message port closed" error.
    return true;
});

// Enhanced page analysis functions for dark mode
function analyzePageForDarkMode() {
    console.debug('[Content] Analyzing page for dark mode issues');
    
    try {
        const analysis = {
            hasTransparentMenus: 0,
            darkModeIssues: [],
            totalElements: 0,
            problemElements: 0,
            timestamp: Date.now()
        };
        
        // Check for transparent/problematic elements
        const problematicSelectors = [
            '[style*="background:transparent"]',
            '[style*="background: transparent"]',
            '[style*="background-color:transparent"]',
            '[style*="background-color: transparent"]',
            '.menu', '.dropdown', '.popup', '.modal', '.overlay',
            '[class*="menu"]', '[class*="dropdown"]', '[class*="popup"]',
            '[class*="modal"]', '[class*="overlay"]'
        ];
        
        problematicSelectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    const computedStyle = window.getComputedStyle(element);
                    const bgColor = computedStyle.backgroundColor;
                    const color = computedStyle.color;
                    
                    // Check for transparency or poor contrast
                    if (bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)' || 
                        (bgColor.includes('rgba') && bgColor.includes('0)'))) {
                        analysis.hasTransparentMenus++;
                        analysis.darkModeIssues.push({
                            selector: getElementSelector(element),
                            issue: 'transparent_background',
                            tag: element.tagName.toLowerCase(),
                            classes: Array.from(element.classList),
                            currentBg: bgColor,
                            currentColor: color
                        });
                    }
                    
                    // Check for poor contrast (light text on light background or vice versa)
                    if (haspoorContrast(bgColor, color)) {
                        analysis.darkModeIssues.push({
                            selector: getElementSelector(element),
                            issue: 'poor_contrast',
                            tag: element.tagName.toLowerCase(),
                            classes: Array.from(element.classList),
                            currentBg: bgColor,
                            currentColor: color
                        });
                    }
                });
                analysis.totalElements += elements.length;
            } catch (e) {
                console.warn('[Content] Error analyzing selector:', selector, e);
            }
        });
        
        analysis.problemElements = analysis.darkModeIssues.length;
        
        console.debug('[Content] Page analysis complete:', analysis);
        return analysis;
        
    } catch (error) {
        console.error('[Content] Error in page analysis:', error);
        return {
            hasTransparentMenus: 0,
            darkModeIssues: [],
            totalElements: 0,
            problemElements: 0,
            error: error.message,
            timestamp: Date.now()
        };
    }
}

function getElementSelector(element) {
    // Generate a CSS selector for the element
    if (element.id) {
        return `#${element.id}`;
    }
    
    if (element.className) {
        const classes = Array.from(element.classList).slice(0, 3); // Limit to first 3 classes
        if (classes.length > 0) {
            return `${element.tagName.toLowerCase()}.${classes.join('.')}`;
        }
    }
    
    return element.tagName.toLowerCase();
}

function haspoorContrast(bgColor, textColor) {
    // Simple contrast check - could be enhanced with proper WCAG calculations
    try {
        const bgLuminance = getColorLuminance(bgColor);
        const textLuminance = getColorLuminance(textColor);
        
        const contrast = (Math.max(bgLuminance, textLuminance) + 0.05) / 
                        (Math.min(bgLuminance, textLuminance) + 0.05);
        
        return contrast < 3; // WCAG AA minimum for large text
    } catch (e) {
        return false;
    }
}

function getColorLuminance(color) {
    // Convert color to RGB and calculate relative luminance
    if (!color || color === 'transparent') return 0;
    
    let rgb;
    if (color.startsWith('rgb')) {
        const match = color.match(/\d+/g);
        if (match && match.length >= 3) {
            rgb = [parseInt(match[0]), parseInt(match[1]), parseInt(match[2])];
        } else {
            return 0.5; // Default middle value
        }
    } else if (color.startsWith('#')) {
        const hex = color.slice(1);
        rgb = [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16)
        ];
    } else {
        return 0.5; // Default for named colors
    }
    
    // Calculate relative luminance
    const [r, g, b] = rgb.map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getCurrentDarkModeStatus() {
    console.debug('[Content] Getting current dark mode status');
    
    try {
        const isDarkModeEnabled = document.documentElement.classList.contains('universal-dark-mode');
        const analysis = analyzePageForDarkMode();
        
        return {
            darkModeEnabled: isDarkModeEnabled,
            problemsFound: analysis.problemElements,
            fixesApplied: document.querySelectorAll('style[data-darkmode-patch]').length,
            lastAnalysis: Date.now(),
            confidence: analysis.problemElements === 0 ? 100 : Math.max(20, 100 - (analysis.problemElements * 10))
        };
    } catch (error) {
        console.error('[Content] Error getting status:', error);
        return {
            darkModeEnabled: false,
            problemsFound: 0,
            fixesApplied: 0,
            error: error.message
        };
    }
}

function findDarkModeIssues() {
    console.debug('[Content] Finding dark mode issues');
    
    try {
        const analysis = analyzePageForDarkMode();
        return analysis.darkModeIssues.map(issue => ({
            ...issue,
            problems: [issue.issue],
            styles: {
                backgroundColor: issue.currentBg,
                color: issue.currentColor
            }
        }));
    } catch (error) {
        console.error('[Content] Error finding issues:', error);
        return [];
    }
}

function verifyDarkModeFixes() {
    console.debug('[Content] Verifying dark mode fixes');
    
    try {
        const analysis = analyzePageForDarkMode();
        const appliedPatches = document.querySelectorAll('style[data-darkmode-patch]').length;
        
        return {
            remainingIssues: analysis.problemElements,
            appliedPatches: appliedPatches,
            lastVerification: Date.now(),
            isWorkingWell: analysis.problemElements < 3, // Threshold for "working well"
            confidence: analysis.problemElements === 0 ? 100 : Math.max(30, 100 - (analysis.problemElements * 15))
        };
    } catch (error) {
        console.error('[Content] Error verifying fixes:', error);
        return {
            remainingIssues: 0,
            appliedPatches: 0,
            error: error.message
        };
    }
}
