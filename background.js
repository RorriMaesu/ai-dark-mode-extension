// Cross-browser API compatibility for Edge, Chrome, Firefox
const browserAPI = (function() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        return chrome;
    } else if (typeof browser !== 'undefined' && browser.runtime) {
        return browser;
    } else {
        return chrome; // Fallback for Edge
    }
})();

// This function applies or removes the CSS theme file
function toggleTheme(tabId, isEnabled) {
    console.debug('[Background] toggleTheme called:', { tabId, isEnabled });
    browserAPI.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
            return document.documentElement.classList.contains('universal-dark-mode');
        }
    }, (results) => {
        const hasClass = results && results[0] && results[0].result;
        console.log(`[Universal Dark Mode] <html> has universal-dark-mode class:`, hasClass);
        if (isEnabled && hasClass) {
            browserAPI.scripting.insertCSS({
                target: { tabId: tabId },
                files: ['dark-theme.css'],
            }, () => {
                if (browserAPI.runtime.lastError) {
                    console.error(`[Universal Dark Mode] Failed to insert CSS on tab ${tabId}:`, browserAPI.runtime.lastError);
                } else {
                    console.log(`[Universal Dark Mode] Inserted CSS on tab ${tabId}`);
                }
            });
        } else if (!isEnabled && hasClass) {
            browserAPI.scripting.removeCSS({
                target: { tabId: tabId },
                files: ['dark-theme.css'],
            }, () => {
                if (browserAPI.runtime.lastError) {
                    console.error(`[Universal Dark Mode] Failed to remove CSS on tab ${tabId}:`, browserAPI.runtime.lastError);
                } else {
                    console.log(`[Universal Dark Mode] Removed CSS from tab ${tabId}`);
                }
            });
        } else {
            console.log(`[Universal Dark Mode] universal-dark-mode class not present, skipping CSS injection/removal.`);
        }
    });
}

// This function gets all tabs and applies the theme based on the stored setting.
function applyThemeToAllTabs() {
    console.debug('[Background] applyThemeToAllTabs called');
    browserAPI.storage.sync.get(['darkModeEnabled'], (result) => {
        const isEnabled = !!result.darkModeEnabled;
        browserAPI.tabs.query({}, (tabs) => {
            for (const tab of tabs) {
                // Only apply to http and https tabs
                if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https'))) {
                    toggleTheme(tab.id, isEnabled);
                }
            }
        });
    });
}

// Listener for when the user clicks the toggle in the popup
browserAPI.storage.onChanged.addListener((changes, namespace) => {
    console.debug('[Background] browserAPI.storage.onChanged:', changes, namespace);
    if (namespace === 'sync' && changes.darkModeEnabled) {
        applyThemeToAllTabs();
    }
});

// Listener for when a new page is loaded or updated
browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    console.debug('[Background] browserAPI.tabs.onUpdated:', { tabId, changeInfo, tab });
    // Ensure the page is fully loaded before trying to inject CSS
    if (changeInfo.status === 'complete' && tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https'))) {
        browserAPI.storage.sync.get(['darkModeEnabled'], (result) => {
            if (result.darkModeEnabled) {
                toggleTheme(tabId, true);
            }
        });
    }
});

// Enhanced message handler for real-time dark mode features
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.debug('[Background] Enhanced message received:', message);
    
    if (message.type === 'PING') {
        sendResponse({ success: true, message: 'Background script is alive' });
        return true;
    }
    
    if (message.type === 'ANALYZE_PAGE_DARK_MODE') {
        handlePageAnalysis(message, sendResponse);
        return true;
    }
    
    if (message.type === 'GET_FEEDBACK_ANALYTICS') {
        handleGetFeedbackAnalytics(message, sendResponse);
        return true;
    }
    
    if (message.type === 'GET_AI_LEARNING_ANALYTICS') {
        handleGetAILearningAnalytics(message, sendResponse);
        return true;
    }
    
    if (message.type === 'AUTO_FIX_DARK_MODE') {
        handleAutoFixDarkMode(message, sendResponse);
        return true;
    }
    
    if (message.type === 'ANALYZE_AND_FIX_ELEMENT') {
        handleAnalyzeAndFixElement(message, sendResponse);
        return true;
    }
    
    if (message.type === 'CHAT_WITH_GEMINI') {
        handleGeminiChat(message, sendResponse);
        return true;
    }
    
    if (message.type === 'AGENT_RATING') {
        handleAgentRating(message, sendResponse);
        return true;
    }
    
    if (message.type === 'ANALYZE_PAGE_FOR_CHAT') {
        handlePageAnalysisForChat(message, sendResponse);
        return true;
    }
    
    console.debug('[Background] Unhandled message type:', message.type);
    return false; // Let other handlers process the message
});

// Handle page analysis requests
async function handlePageAnalysis(message, sendResponse) {
    console.debug('[Background] Analyzing page for dark mode issues:', message);
    
    try {
        // For now, return a mock response since we don't have Gemini integration set up
        // In a full implementation, this would analyze the page and return real issues
        const mockAnalysis = {
            success: true,
            issues: [],
            confidence: 85,
            autoFixes: [],
            timestamp: Date.now()
        };
        
        console.debug('[Background] Page analysis complete:', mockAnalysis);
        sendResponse(mockAnalysis);
    } catch (error) {
        console.error('[Background] Page analysis error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Handle feedback analytics requests
async function handleGetFeedbackAnalytics(message, sendResponse) {
    console.debug('[Background] Getting feedback analytics');
    
    try {
        // Mock analytics data - in a real implementation, this would fetch from storage
        const mockAnalytics = {
            success: true,
            analytics: {
                totalFeedback: 0,
                successRate: 0,
                averageRating: 0,
                topIssues: [],
                lastUpdate: Date.now()
            }
        };
        
        sendResponse(mockAnalytics);
    } catch (error) {
        console.error('[Background] Analytics error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Handle AI learning analytics requests
async function handleGetAILearningAnalytics(message, sendResponse) {
    console.debug('[Background] Getting AI learning analytics');
    
    try {
        // Mock learning data - in a real implementation, this would fetch from storage
        const mockLearningData = {
            success: true,
            learningData: {
                totalFeedback: 0,
                positiveRatings: 0,
                learningConfidence: 0,
                specializedDomains: 0,
                recentPatches: [],
                lastUpdate: Date.now()
            }
        };
        
        sendResponse(mockLearningData);
    } catch (error) {
        console.error('[Background] Learning analytics error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Auto-fix dark mode issues using Gemini
async function handleAutoFixDarkMode(message, sendResponse) {
    console.debug('[Background] Auto-fixing dark mode issues:', message.issues);
    
    try {
        // Prepare context for Gemini
        const issueDescriptions = message.issues.map(issue => {
            return `Element: ${issue.tag} with classes [${issue.classes.join(', ')}] has problems: ${issue.problems.join(', ')}. Current styles: ${JSON.stringify(issue.styles)}`;
        }).join('\n');
        
        const prompt = `You are an expert at fixing dark mode CSS issues in real-time. 
        
Here are the specific issues found on this webpage:
${issueDescriptions}

Please generate CSS that will fix these issues. Focus on:
1. Making transparent menu backgrounds solid dark colors (#222 or similar)
2. Ensuring good contrast between text and backgrounds  
3. Converting white backgrounds to dark equivalents
4. Making hidden content visible in dark mode

Return ONLY valid CSS rules that can be injected directly. Use !important when necessary to override existing styles.`;

        const cssPatch = await callGeminiAPI(prompt);
        
        if (cssPatch) {
            sendResponse({ 
                success: true, 
                cssPatch: cssPatch,
                issuesFixed: message.issues.length 
            });
        } else {
            sendResponse({ success: false, error: 'No CSS generated' });
        }
        
    } catch (error) {
        console.error('[Background] Auto-fix error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Analyze and fix specific element
async function handleAnalyzeAndFixElement(message, sendResponse) {
    console.debug('[Background] Analyzing and fixing element:', message.elementData);
    
    try {
        const element = message.elementData;
        
        // Create a comprehensive prompt with all the element data
        const detectedIssuesText = element.detectedIssues && element.detectedIssues.length > 0 
            ? `Detected issues: ${element.detectedIssues.join(', ')}`
            : 'No automatic issues detected';
            
        const stylesText = Object.entries(element.computedStyles || {})
            .filter(([key, value]) => value && value !== 'rgba(0, 0, 0, 0)' && value !== 'none')
            .map(([key, value]) => `  ${key}: ${value}`)
            .join('\n');
            
        const parentContext = element.parentContext 
            ? `Parent element: ${element.parentContext.tag} with classes [${element.parentContext.classes.join(', ')}]`
            : 'No parent context available';
            
        const prompt = `You are an expert CSS developer specializing in automatic dark mode fixes. A user has selected an element that needs dark mode conversion. You must analyze the element and automatically generate CSS fixes.

**ELEMENT DETAILS:**
- Tag: ${element.tag}
- Element Type: ${element.elementType || 'generic'}
- Classes: [${element.classes.join(', ') || 'none'}]
- ID: ${element.id || 'none'}
- XPath: ${element.xpath}
- ${parentContext}
- Has Text Content: ${element.hasText ? 'Yes' : 'No'}
${element.textContent ? `- Text Preview: "${element.textContent.substring(0, 100)}"` : ''}

**CURRENT STYLING:**
${stylesText || 'No significant styles detected'}

**AUTO-DETECTED ISSUES:**
- ${detectedIssuesText}
${element.automated ? '- Automated analysis requested - apply fixes immediately' : ''}
- User Description: ${element.description}
- Page URL: ${element.url}

**COMMON DARK MODE ISSUES TO FIX:**
1. **Light Backgrounds**: Convert white/light backgrounds to dark (#222, #333, #2a2a2a)
2. **Text Contrast**: Ensure text is visible on dark backgrounds (white, #e4e6eb, #f5f6fa)  
3. **Transparent Menus**: Add solid dark backgrounds to transparent navigation/menus
4. **Stretched Canvas**: Fix canvas elements that expand beyond containers
5. **Border Colors**: Convert light borders to darker equivalents (#444, #555)
6. **Box Shadows**: Adjust shadows for dark themes (lighter shadows, different colors)
7. **Interactive States**: Fix hover/focus states for dark mode

**YOUR TASK:**
Generate comprehensive CSS that automatically fixes ALL dark mode issues for this element. Include:

1. **Background fixes** for light/transparent backgrounds
2. **Text color fixes** for proper contrast  
3. **Border and shadow adjustments**
4. **Interactive state improvements** (hover, focus, active)
5. **Layout fixes** for any positioning/sizing issues
6. **Container constraints** for oversized elements

**SPECIFIC FIXES NEEDED:**
${element.elementType === 'navigation' ? '- Convert transparent nav backgrounds to solid dark\n- Fix menu item visibility\n- Ensure dropdown menus work in dark mode' : ''}
${element.elementType === 'button' ? '- Dark button background with light text\n- Proper hover/focus states\n- Border adjustments for dark theme' : ''}
${element.elementType === 'form' ? '- Dark input backgrounds\n- Light text in form fields\n- Focus state improvements' : ''}
${element.elementType === 'container' ? '- Dark container background\n- Constrain any oversized content\n- Fix child element positioning' : ''}

**REQUIREMENTS:**
- Return ONLY valid CSS rules (no explanations)
- Use specific selectors targeting this element: ${element.tag}${element.classes.map(c => `.${c}`).join('')}${element.id ? `, #${element.id}` : ''}
- Include !important declarations when needed to override existing styles
- Apply fixes for ALL detected issues, not just one
- Ensure text contrast ratios meet accessibility standards (4.5:1+)
- Handle both the element and its common child elements
- Fix any layout issues (max-width, overflow, positioning)

**EXAMPLE CSS STRUCTURE:**
/* Main element fix */
${element.tag}${element.classes.map(c => `.${c}`).join('')} {
    background-color: #222 !important;
    color: #e4e6eb !important;
    border-color: #444 !important;
}

/* Child elements */
${element.tag}${element.classes.map(c => `.${c}`).join('')} * {
    color: inherit !important;
}

/* Interactive states */
${element.tag}${element.classes.map(c => `.${c}`).join('')}:hover {
    background-color: #333 !important;
}

Generate the complete CSS now:`;

        console.debug('[Background] Sending enhanced automatic prompt to Gemini:', prompt.substring(0, 500) + '...');

        console.debug('[Background] Sending comprehensive prompt to Gemini:', prompt.substring(0, 500) + '...');
        
        const cssPatch = await callGeminiAPI(prompt);
        
        if (cssPatch && cssPatch.trim()) {
            const response = {
                success: true,
                cssPatch: cssPatch.trim(),
                elementInfo: {
                    tag: element.tag,
                    type: element.elementType,
                    issues: element.detectedIssues,
                    xpath: element.xpath
                },
                analysis: {
                    detectedIssues: element.detectedIssues,
                    hasText: element.hasText,
                    dimensions: element.dimensions
                }
            };
            
            console.debug('[Background] Generated CSS fix:', response);
            sendResponse(response);
        } else {
            const fallbackMessage = `I analyzed the ${element.tag} element but couldn't generate a specific CSS fix. This might be because:

1. The element doesn't have obvious dark mode issues
2. The element already has appropriate styling  
3. The issue requires more context about the surrounding page

**Element Summary:**
- Type: ${element.elementType} 
- Detected Issues: ${element.detectedIssues.join(', ') || 'none'}
- Current Background: ${element.computedStyles?.backgroundColor || 'unknown'}
- Current Text Color: ${element.computedStyles?.color || 'unknown'}

Try providing more specific details about what looks wrong, or select a different element that clearly needs dark mode adjustments.`;

            sendResponse({ 
                success: true, 
                message: fallbackMessage,
                analysis: {
                    detectedIssues: element.detectedIssues,
                    hasText: element.hasText,
                    couldNotFix: true
                }
            });
        }
        
    } catch (error) {
        console.error('[Background] Element analysis error:', error);
        sendResponse({ 
            success: false, 
            error: error.message,
            message: `Failed to analyze element: ${error.message}. Please try again.`
        });
    }
}

// Enhanced Gemini chat handler
async function handleGeminiChat(message, sendResponse) {
    console.debug('[Background] Handling Gemini chat:', message);
    
    try {
        const userMessage = message.userMessage;
        const pageData = message.pageData;
        
        let contextInfo = '';
        if (pageData) {
            contextInfo = `
Current page context:
- URL: ${pageData.url}
- Title: ${pageData.title}
- Dark mode issues found: ${pageData.darkModeIssues ? pageData.darkModeIssues.length : 0}
- Has transparent menus: ${pageData.hasTransparentMenus > 0 ? 'Yes' : 'No'}
`;
        }
        
        const prompt = `You are an expert dark mode CSS assistant. Help the user fix dark mode issues on their webpage.

${contextInfo}

User message: ${userMessage}

Please provide helpful advice and generate CSS fixes if needed. Be conversational and helpful.

If you provide CSS, make sure it:
1. Fixes the specific issues mentioned
2. Uses appropriate dark colors (#222, #333, etc.)
3. Ensures good text contrast
4. Uses !important when necessary to override existing styles

Respond in a friendly, helpful tone as if you're chatting with the user.`;

        const response = await callGeminiAPI(prompt, true); // Request both message and CSS
        
        if (response) {
            sendResponse({ 
                success: true, 
                message: response.message || response,
                cssPatch: response.cssPatch
            });
        } else {
            sendResponse({ 
                success: false, 
                message: "I'm having trouble connecting to the AI service right now. Please try again in a moment."
            });
        }
        
    } catch (error) {
        console.error('[Background] Chat error:', error);
        sendResponse({ 
            success: false, 
            message: "Sorry, I encountered an error. Please try again."
        });
    }
}

// Handle agent rating feedback
function handleAgentRating(message, sendResponse) {
    console.debug('[Background] Agent rating received:', message);
    // Store rating for analytics (could be saved to storage or sent to backend)
    sendResponse({ status: 'rating_received' });
}

// Call Gemini API through your backend proxy
async function callGeminiAPI(prompt, expectStructuredResponse = false) {
    try {
        const proxyUrl = 'http://localhost:3000/api/gemini'; // Your backend proxy
        
        const requestBody = {
            css: 'N/A', // For compatibility with existing backend
            tag: 'auto-generated',
            classes: [],
            xpath: 'N/A',
            description: prompt
        };
        
        console.debug('[Background] Calling Gemini API:', requestBody);
        
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.debug('[Background] Gemini API response:', data);
        
        // Handle the response format from Gemini API
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const content = data.candidates[0].content.parts[0].text;
            
            // Try to parse the content as JSON first (structured response)
            try {
                const parsed = JSON.parse(content);
                if (parsed.darkModeCss) {
                    return parsed.darkModeCss;
                }
                if (expectStructuredResponse) {
                    return parsed;
                }
                return parsed.message || content;
            } catch (e) {
                // Not JSON, treat as plain text
                if (expectStructuredResponse) {
                    return { message: content };
                } else {
                    // Extract CSS from the response
                    const cssMatch = content.match(/```css\n([\s\S]*?)\n```/) || 
                                    content.match(/```\n([\s\S]*?)\n```/) ||
                                    [null, content];
                    return cssMatch[1] || content;
                }
            }
        }
        
        // Handle direct darkModeCss response from server (legacy support)
        if (data.darkModeCss) {
            return data.darkModeCss;
        }
        
        return null;
        
    } catch (error) {
        console.error('[Background] Gemini API error:', error);
        throw error;
    }
}

// Handle extension icon click to open side panel
browserAPI.action.onClicked.addListener((tab) => {
    console.debug('[Background] Extension icon clicked, opening side panel');
    
    // Open the side panel
    if (browserAPI.sidePanel) {
        browserAPI.sidePanel.open({ windowId: tab.windowId }).catch((error) => {
            console.error('[Background] Failed to open side panel:', error);
            // Fallback: try to open as a popup window
            openFallbackPopup();
        });
    } else {
        // Fallback for browsers that don't support side panel
        openFallbackPopup();
    }
});

// Fallback function to open popup window
function openFallbackPopup() {
    const popupUrl = browserAPI.runtime.getURL('popup/popup.html');
    browserAPI.windows.create({
        url: popupUrl,
        type: 'popup',
        width: 400,
        height: 600,
        focused: true
    }, (window) => {
        if (browserAPI.runtime.lastError) {
            console.error('[Background] Failed to create popup window:', browserAPI.runtime.lastError);
        } else {
            console.debug('[Background] Popup window created:', window);
        }
    });
}

// Handle page analysis for chat context
async function handlePageAnalysisForChat(message, sendResponse) {
    console.debug('[Background] Analyzing page for chat context:', message);
    
    try {
        // Send message to content script to get page analysis
        if (message.tabId) {
            chrome.tabs.sendMessage(message.tabId, {
                type: 'ANALYZE_PAGE_FOR_CHAT'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.debug('[Background] Could not get page analysis:', chrome.runtime.lastError.message);
                    sendResponse({
                        success: false,
                        error: 'Could not analyze page'
                    });
                } else {
                    sendResponse({
                        success: true,
                        ...response
                    });
                }
            });
        } else {
            sendResponse({
                success: false,
                error: 'No tab ID provided'
            });
        }
    } catch (error) {
        console.error('[Background] Page analysis for chat error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}
