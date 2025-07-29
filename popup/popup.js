/*
  Popup Script: Universal Dark Mode Extension
  -------------------------------------------------------------
  Cross-browser compatible (Chrome, Edge, Firefox)
  Three-tier architecture:
    1. Extension (content/popup/background scripts)
    2. Backend Proxy (Node.js server)
    3. Gemini API (LLM)

  Security Rationale:
    - No API keys or sensitive logic in this file.
    - All Gemini/LLM requests are routed through the background script, which communicates with the backend proxy.
    - The backend securely stores the Gemini API key and validates all requests/responses.
    - This protects user privacy and prevents abuse of the Gemini API key.
    - Popup script only sends feedback and requests via extension messaging, never directly to Gemini or the backend.
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

// Global variables
let reportTimeout;
let realTimeAnalysisInterval;

// Wait for DOM to be ready before initializing
document.addEventListener('DOMContentLoaded', function() {
    console.info('[Popup] Universal Dark Mode popup loaded');
    
    // Detect if we're in a side panel or popup window
    detectDisplayMode();
    
    // Initialize popup functionality
    initializePopup();
});

// Detect display mode and adjust UI accordingly
function detectDisplayMode() {
    const body = document.body;
    
    // Check if we're in a side panel (Chrome extension context)
    if (window.location.protocol === 'chrome-extension:' && window.innerWidth < 500) {
        body.classList.add('side-panel-mode');
        console.debug('[Popup] Side panel mode detected');
    } else if (window.outerWidth && window.outerHeight) {
        // We're in a detached popup window
        body.classList.add('detached-mode');
        console.debug('[Popup] Detached window mode detected');
    }
    
    // Initialize detach button
    initializeDetachButton();
}

// Initialize detach button functionality
function initializeDetachButton() {
    const detachBtn = document.getElementById('detach-btn');
    if (!detachBtn) return;
    
    detachBtn.addEventListener('click', handleDetachWindow);
    
    // Hide detach button if already detached
    if (document.body.classList.contains('detached-mode')) {
        detachBtn.style.display = 'none';
    }
}

// Handle detaching to a separate window
function handleDetachWindow() {
    console.debug('[Popup] Detach button clicked');
    
    const popupUrl = window.location.href;
    const newWindow = window.open(
        popupUrl,
        'ai-dark-mode-detached',
        'width=420,height=700,resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no'
    );
    
    if (newWindow) {
        // Mark the new window as detached
        newWindow.addEventListener('load', () => {
            newWindow.document.body.classList.remove('side-panel-mode');
            newWindow.document.body.classList.add('detached-mode');
            
            const detachBtn = newWindow.document.getElementById('detach-btn');
            if (detachBtn) {
                detachBtn.style.display = 'none';
            }
        });
        
        // Focus the new window
        newWindow.focus();
        
        console.debug('[Popup] Detached window opened successfully');
    } else {
        console.error('[Popup] Failed to open detached window');
    }
}

// Initialize popup functionality
async function initializePopup() {
    // Initialize toggle state
    await initializeToggle();
    
    // Initialize button handlers
    initializeButtons();
    
    // Initialize message listeners
    initializeMessageListeners();
    
    // Initialize analytics
    try {
        renderFeedbackAnalytics();
    } catch (error) {
        console.debug('[Popup] Could not initialize feedback analytics:', error);
    }
    
    // Initialize AI learning analytics
    try {
        renderAILearningAnalytics();
    } catch (error) {
        console.debug('[Popup] Could not initialize AI learning analytics:', error);
    }
    
    // Initialize chatbot
    initializeChatbot();
    
    // Initialize real-time status updates
    initializeStatusUpdates();
    
    // Start real-time dark mode analysis
    startRealTimeAnalysis();
    
    // Initialize optimized UI functionality
    initializeOptimizedUI();
    
    // Update page status indicator
    updatePageStatusIndicator();
    
    // Check background script connection
    updateConnectionStatus();
}

// Theme toggle functionality
async function initializeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) {
        console.error('[Popup] Theme toggle element not found');
        return;
    }

    // Restore toggle state from storage
    try {
        const result = await browserAPI.storage.sync.get(['darkModeEnabled']);
        themeToggle.checked = !!result.darkModeEnabled;
        console.debug('[Popup] Toggle state restored:', themeToggle.checked);
    } catch (error) {
        console.error('[Popup] Error restoring toggle state:', error);
        themeToggle.checked = false;
    }

    // Listen for storage changes to keep toggle in sync
    browserAPI.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.darkModeEnabled) {
            themeToggle.checked = !!changes.darkModeEnabled.newValue;
            console.debug('[Popup] Toggle state synced:', themeToggle.checked);
        }
    });

    // Handle toggle changes
    themeToggle.addEventListener('change', async () => {
        console.debug('[Popup] Theme toggle changed:', themeToggle.checked);
        const isEnabled = themeToggle.checked;
        
        try {
            // Update storage
            await browserAPI.storage.sync.set({ darkModeEnabled: isEnabled });
            console.debug('[Popup] Storage updated with darkModeEnabled:', isEnabled);
            
            // Send message to content script
            const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https'))) {
                browserAPI.tabs.sendMessage(tab.id, {
                    type: 'TOGGLE_DARK_MODE',
                    enabled: isEnabled
                }, (response) => {
                    if (browserAPI.runtime.lastError) {
                        console.error('[Popup] Could not connect to content script:', browserAPI.runtime.lastError.message);
                        
                        // Show user-friendly error notification
                        showNotification('Could not connect to page. Try refreshing the page.', 'warning', 4000);
                        addChatMessage('System', '⚠️ Connection failed. Please refresh the page and try again.', 'system');
                        
                        // Revert toggle state on connection failure
                        themeToggle.checked = !isEnabled;
                        browserAPI.storage.sync.set({ darkModeEnabled: !isEnabled }).catch(error => {
                            console.error('[Popup] Error reverting storage state:', error);
                        });
                    } else {
                        console.debug('[Popup] TOGGLE_DARK_MODE response:', response);
                        
                        // Show success message
                        showNotification(`Dark mode ${isEnabled ? 'enabled' : 'disabled'}`, 'success');
                        addChatMessage('System', `🌙 Dark mode ${isEnabled ? 'enabled' : 'disabled'} for this page`, 'system');
                        
                        // Trigger immediate analysis if enabled
                        if (isEnabled) {
                            triggerRealTimeAnalysis();
                        }
                    }
                });
            } else {
                // Provide helpful user feedback for unsupported pages
                const pageType = getPageType(tab?.url);
                const message = getUnsupportedPageMessage(pageType);
                
                console.info('[Popup] Unsupported page type:', pageType, 'URL:', tab?.url);
                showNotification(message, 'info', 5000);
                addChatMessage('System', `ℹ️ ${message}`, 'system');
                
                // Revert toggle state for unsupported pages
                themeToggle.checked = !isEnabled;
                await browserAPI.storage.sync.set({ darkModeEnabled: !isEnabled });
            }
        } catch (error) {
            console.error('[Popup] Error handling toggle change:', error);
            // Revert toggle state on error
            themeToggle.checked = !isEnabled;
        }
        
        // Update page status indicator after toggle operation
        updatePageStatusIndicator();
    });
}

// Initialize button handlers
function initializeButtons() {
    // Export Feedback button
    const exportBtn = document.getElementById('export-feedback');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExportFeedback);
        console.debug('[Popup] Export feedback button handler attached');
    } else {
        console.error('[Popup] Export feedback button not found');
    }

    // Report Issue button
    const reportBtn = document.getElementById('report-issue');
    if (reportBtn) {
        reportBtn.addEventListener('click', handleReportIssue);
        console.debug('[Popup] Report issue button handler attached');
    } else {
        console.error('[Popup] Report issue button not found');
    }
}

// Initialize message listeners
function initializeMessageListeners() {
    browserAPI.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        console.debug('[Popup] Received message:', msg);
        
        if (msg && msg.type === 'ELEMENT_SELECTED_FOR_FEEDBACK') {
            console.debug('[Popup] Handling element selection:', msg);
            handleElementSelected(msg);
        } else if (msg && msg.type === 'AGENT_STATUS_UPDATE') {
            handleAgentStatusUpdate(msg);
        } else if (msg && msg.type === 'DARK_MODE_STATUS_UPDATE') {
            updateStatusDisplay(msg);
        } else {
            console.debug('[Popup] Unhandled message type:', msg?.type);
        }
        
        return true; // Keep message channel open for async response
    });
}

// Export feedback functionality
function handleExportFeedback() {
    console.debug('[Popup] Export feedback button clicked');
    
    let arr = [];
    try {
        arr = JSON.parse(localStorage.getItem('darkmode_feedback') || '[]');
    } catch (error) {
        console.error('[Popup] Error reading feedback data:', error);
    }
    
    if (!arr.length) {
        alert('No feedback data to export.');
        return;
    }

    // Create CSV format
    const header = ['tag', 'classes', 'url', 'feedback', 'timestamp', 'fixed'];
    const rows = arr.map(f => [
        f.tag || '',
        (f.classes || []).join('|'),
        f.url || '',
        f.feedback || '',
        new Date(f.timestamp).toISOString(),
        f.fixed || false
    ]);
    
    const csv = header.join(',') + '\n' + 
                rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n');
    
    // Download CSV file
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'darkmode-feedback-' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 1000);
}

// Report issue functionality
async function handleReportIssue() {
    console.debug('[Popup] Report issue button clicked');
    
    const feedbackModal = document.getElementById('feedback-modal');
    if (!feedbackModal) {
        console.error('[Popup] Feedback modal not found');
        return;
    }

    try {
        // Show modal with instructions
        updateFeedbackModal('<b>Select the problematic element on the page within 10 seconds.</b><br><div style="margin-top: 8px;">Click on any element that has dark mode issues.</div>');
        feedbackModal.style.display = 'block';
        
        // Get active tab and send message to content script
        const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url || !(tab.url.startsWith('http') || tab.url.startsWith('https'))) {
            updateFeedbackModal('<b>Error: This feature only works on web pages.</b>');
            setTimeout(() => hideFeedbackModal(), 3000);
            return;
        }
        
        console.debug('[Popup] Sending START_ELEMENT_SELECTION to tab', tab.id);
        
        browserAPI.tabs.sendMessage(tab.id, { type: 'START_ELEMENT_SELECTION' }, (response) => {
            if (browserAPI.runtime.lastError) {
                console.error('[Popup] Error sending message to content script:', browserAPI.runtime.lastError.message);
                updateFeedbackModal('<b>Error: Could not connect to the page. Please refresh and try again.</b>');
                setTimeout(() => hideFeedbackModal(), 3000);
                return;
            }
            console.debug('[Popup] START_ELEMENT_SELECTION response:', response);
        });
        
        // Set timeout for element selection
        clearTimeout(reportTimeout);
        reportTimeout = setTimeout(() => {
            console.warn('[Popup] Element selection timed out');
            updateFeedbackModal('<b>Selection timed out. Please try again.</b>');
            setTimeout(() => hideFeedbackModal(), 2000);
        }, 10000);
        
    } catch (error) {
        console.error('[Popup] Error in handleReportIssue:', error);
        updateFeedbackModal('<b>Error: ' + error.message + '</b>');
        setTimeout(() => hideFeedbackModal(), 3000);
    }
}

// Enhanced report issue with better user feedback
async function handleReportIssueEnhanced() {
    console.debug('[Popup] Enhanced report issue workflow started');
    
    // Show immediate feedback
    showNotification('🔍 Click any element on the page to auto-fix dark mode issues', 'info', 5000);
    
    const feedbackModal = document.getElementById('feedback-modal');
    if (!feedbackModal) {
        console.error('[Popup] Feedback modal not found');
        showNotification('❌ Interface error - please refresh and try again', 'error');
        return;
    }

    try {
        // Show enhanced modal with visual progress
        updateFeedbackModal(`
            <div style="text-align: center;">
                <div style="font-size: 24px; margin-bottom: 12px;">🎯</div>
                <b>AI Auto-Fix Ready</b><br>
                <div style="margin: 12px 0; padding: 12px; background: rgba(0,114,255,0.1); border-radius: 8px; font-size: 13px; line-height: 1.4;">
                    <div style="margin-bottom: 8px;">
                        <strong>🤖 Automatic Dark Mode Repair</strong>
                    </div>
                    <div style="text-align: left;">
                        ✨ <strong>Step 1:</strong> Click on any problematic element<br>
                        🔍 <strong>Step 2:</strong> AI analyzes styling issues<br>
                        ⚡ <strong>Step 3:</strong> Auto-generates & applies fix<br>
                        💬 <strong>Step 4:</strong> You rate the result
                    </div>
                    <div style="margin-top: 12px; padding: 8px; background: rgba(40,167,69,0.1); border-radius: 4px; font-size: 12px;">
                        <strong>💡 What gets fixed:</strong> Light backgrounds, menu visibility, text contrast, stretched elements, border colors, interactive states
                    </div>
                </div>
                <div style="background: rgba(255,193,7,0.1); padding: 8px; border-radius: 4px; font-size: 12px; margin-bottom: 12px;">
                    ⏱️ <strong>Time limit:</strong> 10 seconds to select an element
                </div>
                <button id="cancel-selection" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Cancel</button>
            </div>
        `);
        feedbackModal.style.display = 'block';
        
        // Enhanced cancel functionality
        const cancelBtn = document.getElementById('cancel-selection');
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                hideFeedbackModal();
                showNotification('🚫 Auto-fix cancelled', 'warning', 2000);
            };
        }
        
        // Get active tab and send message to content script
        const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url || !(tab.url.startsWith('http') || tab.url.startsWith('https'))) {
            updateFeedbackModal('<div style="text-align: center;"><b>⚠️ Page Not Supported</b><br><div style="margin: 8px 0; color: #ffc107;">This feature only works on regular web pages (http/https URLs).</div></div>');
            showNotification('⚠️ Auto-fix only works on web pages', 'warning');
            setTimeout(() => hideFeedbackModal(), 3000);
            return;
        }
        
        console.debug('[Popup] Sending START_ELEMENT_SELECTION to tab', tab.id);
        
        browserAPI.tabs.sendMessage(tab.id, { type: 'START_ELEMENT_SELECTION' }, (response) => {
            if (browserAPI.runtime.lastError) {
                console.error('[Popup] Error sending message to content script:', browserAPI.runtime.lastError.message);
                updateFeedbackModal('<div style="text-align: center;"><b>❌ Connection Error</b><br><div style="margin: 8px 0; color: #dc3545;">Could not connect to the page. Please refresh and try again.</div></div>');
                showNotification('❌ Could not connect to page - please refresh', 'error');
                setTimeout(() => hideFeedbackModal(), 3000);
                return;
            }
            console.debug('[Popup] Element selection started successfully:', response);
            showNotification('👆 Click any element to analyze and fix', 'success', 8000);
        });
        
        // Enhanced timeout with better feedback
        clearTimeout(reportTimeout);
        reportTimeout = setTimeout(() => {
            console.warn('[Popup] Element selection timed out');
            updateFeedbackModal('<div style="text-align: center;"><b>⏱️ Selection Timed Out</b><br><div style="margin: 8px 0; color: #ffc107;">No element was selected within 10 seconds.</div><button onclick="handleReportIssueEnhanced()" style="background: #58a6ff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 8px;">Try Again</button></div>');
            showNotification('⏱️ Selection timed out - click "Report Issue" to try again', 'warning');
            setTimeout(() => hideFeedbackModal(), 4000);
        }, 10000);
        
    } catch (error) {
        console.error('[Popup] Error in enhanced report issue:', error);
        updateFeedbackModal(`<div style="text-align: center;"><b>❌ Unexpected Error</b><br><div style="margin: 8px 0; color: #dc3545;">${error.message}</div></div>`);
        showNotification('❌ Unexpected error occurred', 'error');
        setTimeout(() => hideFeedbackModal(), 3000);
    }
}

// Initialize chatbot functionality
function initializeChatbot() {
    console.debug('[Popup] Initializing chatbot');
    
    // Find chat elements
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('chat-send');
    const chatMessages = document.getElementById('chat-messages');
    
    if (!chatInput || !sendButton || !chatMessages) {
        console.debug('[Popup] Chat elements not found - chatbot not available');
        return;
    }
    
    console.debug('[Popup] Chat elements found, setting up chatbot');
    
    // Initialize chat with welcome message
    addChatMessage('AI Assistant', '👋 Hello! I\'m your AI Dark Mode assistant. I can help you fix dark mode issues automatically. Just click "Report Issue" and select any problematic element!', 'assistant');
    
    // Handle send button click
    sendButton.addEventListener('click', handleChatSend);
    
    // Handle Enter key in chat input
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleChatSend();
        }
    });
    
    // Auto-resize chat input
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 60) + 'px';
    });
}

// Handle chat send functionality
function handleChatSend() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;
    
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addChatMessage('You', message, 'user');
    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    // Send to AI for response
    sendChatToAI(message);
}

// Send chat message to AI
async function sendChatToAI(userMessage) {
    try {
        // Show typing indicator
        addChatMessage('AI Assistant', '🤔 Thinking...', 'assistant', true);
        
        // Get current tab info for context
        const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
        const pageData = tab ? {
            url: tab.url,
            title: tab.title
        } : null;
        
        // Send to background script
        const response = await sendToBackgroundWithTimeout({
            type: 'CHAT_WITH_GEMINI',
            userMessage: userMessage,
            pageData: pageData
        }, 15000);
        
        // Remove typing indicator
        removeTempChatMessage();
        
        if (response && response.success && response.reply) {
            addChatMessage('AI Assistant', response.reply, 'assistant');
        } else {
            addChatMessage('AI Assistant', '❌ Sorry, I couldn\'t process your message right now. Please try again.', 'assistant');
        }
        
    } catch (error) {
        console.error('[Popup] Chat AI error:', error);
        removeTempChatMessage();
        addChatMessage('AI Assistant', '❌ Connection error. Please check your internet connection and try again.', 'assistant');
    }
}

// Add message to chat
function addChatMessage(sender, message, type = 'user', temporary = false) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    if (temporary) messageDiv.classList.add('temp-message');
    
    const senderSpan = document.createElement('span');
    senderSpan.className = 'chat-sender';
    senderSpan.textContent = sender;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'chat-content';
    contentDiv.textContent = message;
    
    messageDiv.appendChild(senderSpan);
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Remove temporary chat message (like typing indicator)
function removeTempChatMessage() {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const tempMessage = chatMessages.querySelector('.temp-message');
    if (tempMessage) {
        tempMessage.remove();
    }
}

// Send message to background with timeout
function sendToBackgroundWithTimeout(message, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('Request timeout'));
        }, timeout);
        
        browserAPI.runtime.sendMessage(message, (response) => {
            clearTimeout(timeoutId);
            
            if (browserAPI.runtime.lastError) {
                reject(new Error(browserAPI.runtime.lastError.message));
            } else {
                resolve(response);
            }
        });
    });
}

// Notification system
function showNotification(message, type = 'info', duration = 3000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">
                ${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'error' ? '❌' : 'ℹ️'}
            </span>
            <span>${message}</span>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Show with animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Auto-hide
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, duration);
}

// Helper function to hide notifications
function hideNotification(notification) {
    if (notification && notification.parentNode) {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }
}

// Update feedback modal content
function updateFeedbackModal(content) {
    const modal = document.getElementById('feedback-modal');
    const modalBody = document.getElementById('feedback-modal-body');
    
    if (!modal || !modalBody) {
        console.error('[Popup] Feedback modal elements not found');
        return;
    }
    
    modalBody.innerHTML = content;
}

// Hide feedback modal
function hideFeedbackModal() {
    const modal = document.getElementById('feedback-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Initialize status updates
function initializeStatusUpdates() {
    console.debug('[Popup] Initializing status updates');
    updatePageStatusIndicator();
}

// Start real-time analysis
function startRealTimeAnalysis() {
    console.debug('[Popup] Starting real-time dark mode analysis');
    
    // Clear any existing interval
    if (realTimeAnalysisInterval) {
        clearInterval(realTimeAnalysisInterval);
    }
    
    // Run analysis every 30 seconds when dark mode is enabled (reduced frequency)
    realTimeAnalysisInterval = setInterval(async () => {
        try {
            const result = await browserAPI.storage.sync.get(['darkModeEnabled']);
            if (result.darkModeEnabled) {
                // Only trigger if not already analyzing
                const statusDisplay = document.querySelector('.status-display');
                if (statusDisplay && !statusDisplay.textContent.includes('Analyzing')) {
                    // Check if background script is available before triggering analysis
                    const isConnected = await checkBackgroundConnection();
                    if (isConnected) {
                        triggerRealTimeAnalysis();
                    } else {
                        console.debug('[Popup] Background script not available, skipping analysis');
                    }
                }
            }
        } catch (error) {
            console.debug('[Popup] Error in real-time analysis interval:', error);
        }
    }, 30000); // Check every 30 seconds instead of 5
}

// Initialize optimized UI functionality
function initializeOptimizedUI() {
    console.debug('[Popup] Initializing optimized UI');
    
    // Initialize collapsible sections
    initializeCollapsibleSections();
    
    // Initialize minimize/expand all functionality
    initializeGlobalControls();
    
    // Initialize toggle status updates
    initializeToggleStatus();
    
    // Initialize enhanced status dashboard
    initializeStatusDashboard();
    
    // Initialize modal controls
    initializeModalControls();
    
    // Apply saved section states
    loadSectionStates();
    
    // Ensure content visibility for side panel
    ensureContentVisibility();
    
    // Add performance monitoring
    monitorPerformance();
}

// Initialize collapsible sections
function initializeCollapsibleSections() {
    const sectionHeaders = document.querySelectorAll('.section-header');
    
    sectionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const sectionCard = header.closest('.section-card');
            const content = sectionCard.querySelector('.section-content');
            const expandIcon = header.querySelector('.expand-icon');
            const isCollapsed = sectionCard.getAttribute('data-collapsed') === 'true';
            
            if (isCollapsed) {
                // Expand
                sectionCard.setAttribute('data-collapsed', 'false');
                if (content) {
                    content.classList.remove('collapsed');
                }
                if (expandIcon) {
                    expandIcon.textContent = '▼';
                }
            } else {
                // Collapse
                sectionCard.setAttribute('data-collapsed', 'true');
                if (content) {
                    content.classList.add('collapsed');
                }
                if (expandIcon) {
                    expandIcon.textContent = '▶';
                }
            }
        });
    });
}

// Initialize global controls for minimize/expand all
function initializeGlobalControls() {
    console.debug('[Popup] Initializing global controls');
    
    const minimizeBtn = document.getElementById('minimize-sections');
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            const sectionCards = document.querySelectorAll('.section-card');
            sectionCards.forEach(card => {
                const content = card.querySelector('.section-content');
                const expandIcon = card.querySelector('.expand-icon');
                
                card.setAttribute('data-collapsed', 'true');
                if (content) {
                    content.classList.add('collapsed');
                }
                if (expandIcon) {
                    expandIcon.textContent = '▶';
                }
            });
            
            console.debug('[Popup] All sections minimized');
        });
    }
}

// Initialize toggle status updates
function initializeToggleStatus() {
    console.debug('[Popup] Initializing toggle status');
    
    const toggleStatus = document.getElementById('toggle-status');
    const themeToggle = document.getElementById('theme-toggle');
    
    if (toggleStatus && themeToggle) {
        const updateStatus = () => {
            toggleStatus.textContent = themeToggle.checked ? 'On' : 'Off';
        };
        
        themeToggle.addEventListener('change', updateStatus);
        updateStatus(); // Initial update
    }
}

// Initialize status dashboard
function initializeStatusDashboard() {
    console.debug('[Popup] Initializing status dashboard');
    
    // Update status items with current data
    const updateStatusItems = () => {
        const issuesFoundElement = document.querySelector('[data-status="issues"]');
        const successRateElement = document.querySelector('[data-status="success"]');
        
        if (issuesFoundElement) {
            issuesFoundElement.textContent = '0'; // Default value
        }
        
        if (successRateElement) {
            successRateElement.textContent = '0%'; // Default value
        }
    };
    
    updateStatusItems();
}

// Initialize modal controls
function initializeModalControls() {
    console.debug('[Popup] Initializing modal controls');
    
    const modal = document.getElementById('feedback-modal');
    const closeBtn = modal?.querySelector('.modal-close');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            hideFeedbackModal();
        });
    }
    
    // Close modal when clicking outside
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideFeedbackModal();
            }
        });
    }
}

// Load saved section states
function loadSectionStates() {
    console.debug('[Popup] Loading saved section states');
    
    try {
        const savedStates = JSON.parse(localStorage.getItem('sectionStates') || '{}');
        
        Object.entries(savedStates).forEach(([sectionId, isCollapsed]) => {
            const section = document.getElementById(sectionId);
            if (section && isCollapsed) {
                section.setAttribute('data-collapsed', 'true');
                const content = section.querySelector('.section-content');
                const expandIcon = section.querySelector('.expand-icon');
                
                if (content) content.classList.add('collapsed');
                if (expandIcon) expandIcon.textContent = '▶';
            }
        });
    } catch (error) {
        console.debug('[Popup] Error loading section states:', error);
    }
}

// Ensure content visibility for side panel
function ensureContentVisibility() {
    console.debug('[Popup] Ensuring content visibility');
    
    // Make sure essential sections are visible in side panel mode
    if (document.body.classList.contains('side-panel-mode')) {
        const mainToggle = document.querySelector('.main-toggle');
        const chatSection = document.getElementById('ai-chat-section');
        
        if (mainToggle) {
            mainToggle.style.display = 'block';
        }
        
        if (chatSection) {
            chatSection.setAttribute('data-collapsed', 'false');
            const content = chatSection.querySelector('.section-content');
            if (content) content.classList.remove('collapsed');
        }
    }
}

// Monitor performance
function monitorPerformance() {
    console.debug('[Popup] Monitoring performance');
    
    // Track memory usage if available
    if (performance.memory) {
        const logMemory = () => {
            const memory = performance.memory;
            if (memory.usedJSHeapSize > 50 * 1024 * 1024) { // 50MB threshold
                console.warn('[Popup] High memory usage detected:', Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB');
            }
        };
        
        setInterval(logMemory, 60000); // Check every minute
    }
}

// Check background connection
async function checkBackgroundConnection() {
    return new Promise((resolve) => {
        try {
            browserAPI.runtime.sendMessage({ type: 'PING' }, (response) => {
                if (browserAPI.runtime.lastError) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        } catch (error) {
            resolve(false);
        }
    });
}

// Handle element selection for feedback - AUTOMATED VERSION
function handleElementSelected(msg) {
    clearTimeout(reportTimeout);
    
    console.debug('[Popup] Auto-analyzing element:', msg);
    
    // Show immediate analysis feedback
    updateFeedbackModal(`
        <b>🤖 AI Auto-Analysis in Progress...</b><br>
        <div style="margin: 8px 0; padding: 8px; background: rgba(0,114,255,0.1); border-radius: 4px; font-size: 12px;">
            <div><strong>Selected Element:</strong> ${msg.tag} ${msg.elementType ? `(${msg.elementType})` : ''}</div>
            <div><strong>Detected Issues:</strong> ${msg.detectedIssues && msg.detectedIssues.length > 0 ? msg.detectedIssues.join(', ') : 'Analyzing...'}</div>
            <div style="margin-top: 8px; color: #58a6ff;">🔍 Gemini is analyzing element code and styling...</div>
            <div style="margin-top: 4px; color: #58a6ff;">⚡ Auto-generating dark mode fixes...</div>
        </div>
        <div style="text-align: center; margin-top: 12px;">
            <button id="cancel-analysis" style="background: #6c757d; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Cancel</button>
        </div>
    `);
    
    const feedbackModal = document.getElementById('feedback-modal');
    feedbackModal.style.display = 'block';
    
    // Add cancel button functionality
    const cancelBtn = document.getElementById('cancel-analysis');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            hideFeedbackModal();
        };
    }
    
    // Automatically analyze and fix the element without user input
    performAutomaticElementAnalysis(msg);
}

// Perform automatic element analysis and apply fixes
async function performAutomaticElementAnalysis(elementData) {
    try {
        const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
        
        console.debug('[Popup] Starting automatic analysis for element:', elementData);
        
        // Store feedback automatically (no user description needed)
        const autoDescription = generateAutoDescription(elementData);
        
        browserAPI.tabs.sendMessage(tab.id, {
            type: 'SUBMIT_DARKMODE_FEEDBACK',
            tag: elementData.tag,
            classes: elementData.classes,
            xpath: elementData.xpath,
            description: autoDescription,
            elementData: elementData,
            automated: true
        }, (response) => {
            if (browserAPI.runtime.lastError) {
                console.error('[Popup] Error submitting automated feedback:', browserAPI.runtime.lastError.message);
            } else {
                console.debug('[Popup] Automated feedback stored:', response);
            }
        });
        
        // Send comprehensive data to Gemini for automatic analysis and fix
        const geminiResponse = await sendToBackgroundWithTimeout({
            type: 'ANALYZE_AND_FIX_ELEMENT',
            elementData: {
                ...elementData,
                description: autoDescription,
                userReport: false,
                automated: true
            }
        }, 20000); // Longer timeout for automatic analysis
        
        console.debug('[Popup] Gemini auto-analysis response:', geminiResponse);
        
        if (geminiResponse && geminiResponse.cssPatch) {
            // Apply the fix automatically
            const cssApplied = await new Promise((resolve) => {
                browserAPI.tabs.sendMessage(tab.id, {
                    type: 'inject-darkmode-css',
                    css: geminiResponse.cssPatch,
                    elementInfo: {
                        tag: elementData.tag,
                        xpath: elementData.xpath,
                        description: autoDescription
                    },
                    automated: true
                }, (response) => {
                    if (browserAPI.runtime.lastError) {
                        console.error('[Popup] Error applying CSS patch:', browserAPI.runtime.lastError.message);
                        resolve(false);
                    } else {
                        console.debug('[Popup] CSS patch applied successfully:', response);
                        resolve(true);
                    }
                });
            });
            
            // Show success feedback and ask for user verification
            const issuesSummary = elementData.detectedIssues && elementData.detectedIssues.length > 0 
                ? elementData.detectedIssues.join(', ') 
                : 'UI styling issues';
                
            updateFeedbackModal(`
                <b>✅ Auto-Fix Applied!</b><br>
                <div style="margin: 8px 0; padding: 8px; background: rgba(40,167,69,0.1); border-radius: 4px; font-size: 12px;">
                    <div><strong>Element:</strong> ${elementData.tag} (${elementData.elementType || 'element'})</div>
                    <div><strong>Issues Fixed:</strong> ${issuesSummary}</div>
                    <div style="margin-top: 8px; color: #28a745;">🎯 Applied ${geminiResponse.cssPatch.split('\n').length} CSS rules</div>
                </div>
                <div style="margin-top: 12px; text-align: center;">
                    <div style="margin-bottom: 12px; font-weight: bold;">How does the fix look?</div>
                    <button id="fix-good" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 0 4px;">👍 Looks Good</button>
                    <button id="fix-bad" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 0 4px;">👎 Still Issues</button>
                    <button id="fix-partial" style="background: #ffc107; color: black; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 0 4px;">🤔 Partially Fixed</button>
                </div>
                <div style="margin-top: 8px; text-align: center;">
                    <button id="view-details" style="background: #58a6ff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">View Details</button>
                </div>
            `);
            
            // Add detailed success message to chat
            addChatMessage('AI Assistant', `🤖 **Automatic Dark Mode Fix Applied**\n\n**Element:** ${elementData.tag} (${elementData.elementType || 'element'})\n**Auto-detected Issues:** ${issuesSummary}\n\n**Applied CSS Fix:**\n\`\`\`css\n${geminiResponse.cssPatch}\n\`\`\`\n\n💬 **Please let me know how the fix looks!** Use the buttons above or tell me in chat.`, 'assistant');
            
            // Setup feedback buttons
            setupFeedbackButtons(elementData, geminiResponse);
            
        } else if (geminiResponse && geminiResponse.message) {
            // Show analysis without fix
            updateFeedbackModal(`
                <b>🔍 Analysis Complete</b><br>
                <div style="margin: 8px 0; padding: 8px; background: rgba(255,193,7,0.1); border-radius: 4px; font-size: 12px;">
                    <div><strong>Element:</strong> ${elementData.tag} (${elementData.elementType || 'element'})</div>
                    <div style="margin-top: 8px; color: #ffc107;">ℹ️ ${geminiResponse.message}</div>
                </div>
                <div style="text-align: center; margin-top: 12px;">
                    <button id="close-analysis" style="background: #58a6ff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">OK</button>
                </div>
            `);
            
            addChatMessage('AI Assistant', `🔍 **Element Analysis**\n\n**Element:** ${elementData.tag} (${elementData.elementType || 'element'})\n\n**Analysis:** ${geminiResponse.message}`, 'assistant');
            
            document.getElementById('close-analysis').onclick = () => hideFeedbackModal();
            
        } else {
            // Handle error case
            updateFeedbackModal(`
                <b>⚠️ Auto-Analysis Failed</b><br>
                <div style="margin: 8px 0; padding: 8px; background: rgba(220,53,69,0.1); border-radius: 4px; font-size: 12px;">
                    <div><strong>Element:</strong> ${elementData.tag}</div>
                    <div style="margin-top: 8px; color: #dc3545;">❌ Could not generate automatic fix</div>
                    <div style="margin-top: 4px; color: #6c757d;">The element may not have obvious dark mode issues or requires manual intervention.</div>
                </div>
                <div style="text-align: center; margin-top: 12px;">
                    <button id="retry-analysis" style="background: #ffc107; color: black; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 0 4px;">🔄 Retry</button>
                    <button id="manual-report" style="background: #58a6ff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 0 4px;">✏️ Manual Report</button>
                </div>
            `);
            
            addChatMessage('System', `❌ Could not automatically fix the ${elementData.tag} element. You can try again or provide manual feedback about the specific issue.`, 'system');
            
            // Setup retry and manual report buttons
            document.getElementById('retry-analysis').onclick = () => performAutomaticElementAnalysis(elementData);
            document.getElementById('manual-report').onclick = () => showManualReportForm(elementData);
        }
        
        // Auto-close modal after 10 seconds unless user interacts
        setTimeout(() => {
            const feedbackModal = document.getElementById('feedback-modal');
            if (feedbackModal && feedbackModal.style.display === 'block') {
                hideFeedbackModal();
                addChatMessage('System', '💭 Analysis complete. Let me know if you need any adjustments to the fix!', 'system');
            }
        }, 10000);
        
    } catch (error) {
        console.error('[Popup] Automatic element analysis error:', error);
        
        updateFeedbackModal(`
            <b>❌ Analysis Error</b><br>
            <div style="margin: 8px 0; padding: 8px; background: rgba(220,53,69,0.1); border-radius: 4px; font-size: 12px;">
                <div style="color: #dc3545;">Error: ${error.message}</div>
                <div style="margin-top: 4px; color: #6c757d;">Please try again or report the issue manually.</div>
            </div>
            <div style="text-align: center; margin-top: 12px;">
                <button id="close-error" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
            </div>
        `);
        
        addChatMessage('System', `❌ Analysis error: ${error.message}. Please try again.`, 'system');
        
        document.getElementById('close-error').onclick = () => hideFeedbackModal();
        
        setTimeout(() => hideFeedbackModal(), 5000);
    }
}

// Generate automatic description based on element analysis
function generateAutoDescription(elementData) {
    const issues = elementData.detectedIssues || [];
    const elementType = elementData.elementType || 'element';
    
    if (issues.length === 0) {
        return `Auto-analysis of ${elementData.tag} ${elementType} for potential dark mode improvements`;
    }
    
    const issueDescriptions = {
        'light_background_dark_text': 'light background with dark text needs dark mode conversion',
        'transparent_background_dark_text': 'transparent background with dark text may be invisible in dark mode',
        'very_light_background': 'very light background needs to be darkened',
        'low_contrast': 'poor contrast between text and background',
        'low_opacity': 'element has low opacity and may be hard to see',
        'light_border': 'light border color needs dark mode adjustment'
    };
    
    const descriptions = issues.map(issue => issueDescriptions[issue] || issue).join(', ');
    return `Auto-detected issues: ${descriptions}`;
}

// Setup feedback buttons for user verification
function setupFeedbackButtons(elementData, geminiResponse) {
    const goodBtn = document.getElementById('fix-good');
    const badBtn = document.getElementById('fix-bad');
    const partialBtn = document.getElementById('fix-partial');
    const detailsBtn = document.getElementById('view-details');
    
    if (goodBtn) {
        goodBtn.onclick = () => {
            addChatMessage('You', '👍 The fix looks good! Thank you for the automatic repair.', 'user');
            addChatMessage('AI Assistant', '🎉 Great! I\'m glad the automatic fix worked well. If you find any other dark mode issues, just click "Report Issue" and select them!', 'assistant');
            hideFeedbackModal();
            
            // Track successful fix
            trackFixSuccess(elementData, geminiResponse, 'positive');
        };
    }
    
    if (badBtn) {
        badBtn.onclick = () => {
            addChatMessage('You', '👎 The fix didn\'t work or created new issues.', 'user');
            addChatMessage('AI Assistant', '😔 I apologize that the automatic fix didn\'t work well. Can you describe what specific issues remain? I\'ll try to generate a better fix.', 'assistant');
            hideFeedbackModal();
            
            // Track failed fix and ask for details
            trackFixSuccess(elementData, geminiResponse, 'negative');
            setTimeout(() => showManualReportForm(elementData), 1000);
        };
    }
    
    if (partialBtn) {
        partialBtn.onclick = () => {
            addChatMessage('You', '🤔 The fix partially worked but there are still some issues.', 'user');
            addChatMessage('AI Assistant', '🔧 Thanks for the feedback! Could you tell me what specific issues remain? I can generate additional fixes to complete the dark mode conversion.', 'assistant');
            hideFeedbackModal();
            
            // Track partial fix
            trackFixSuccess(elementData, geminiResponse, 'partial');
            setTimeout(() => showManualReportForm(elementData), 1000);
        };
    }
    
    if (detailsBtn) {
        detailsBtn.onclick = () => {
            showFixDetails(elementData, geminiResponse);
        };
    }
}

// Show manual report form for additional feedback
function showManualReportForm(elementData) {
    updateFeedbackModal(`
        <b>📝 Manual Feedback</b><br>
        <div style="margin: 8px 0; padding: 8px; background: rgba(88,166,255,0.1); border-radius: 4px; font-size: 12px;">
            <div><strong>Element:</strong> ${elementData.tag} (${elementData.elementType || 'element'})</div>
            <div style="margin-top: 4px; color: #58a6ff;">Please describe the remaining dark mode issues:</div>
        </div>
        <textarea id="manual-feedback" placeholder="Describe what specific dark mode issues you're still seeing..." style="width:100%;height:80px;margin-top:8px;box-sizing:border-box; background: #2a2a2a; color: #fff; border: 1px solid #555;"></textarea>
        <div style="text-align: center; margin-top: 12px;">
            <button id="submit-manual" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 0 4px;">🔧 Generate New Fix</button>
            <button id="cancel-manual" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 0 4px;">Cancel</button>
        </div>
    `);
    
    const feedbackModal = document.getElementById('feedback-modal');
    feedbackModal.style.display = 'block';
    
    document.getElementById('submit-manual').onclick = async () => {
        const feedback = document.getElementById('manual-feedback').value.trim();
        if (!feedback) {
            alert('Please describe the issues you\'re experiencing.');
            return;
        }
        
        addChatMessage('You', `📝 Additional feedback: ${feedback}`, 'user');
        
        // Restart analysis with user feedback
        const enhancedElementData = {
            ...elementData,
            description: feedback,
            userReport: true,
            refinement: true
        };
        
        hideFeedbackModal();
        performAutomaticElementAnalysis(enhancedElementData);
    };
    
    document.getElementById('cancel-manual').onclick = () => hideFeedbackModal();
}

// Show detailed fix information
function showFixDetails(elementData, geminiResponse) {
    const cssLines = geminiResponse.cssPatch.split('\n').filter(line => line.trim()).length;
    const stylesModified = geminiResponse.cssPatch.match(/[\w-]+\s*:/g)?.length || 0;
    
    updateFeedbackModal(`
        <b>🔍 Fix Details</b><br>
        <div style="margin: 8px 0; padding: 8px; background: rgba(40,40,40,0.9); border-radius: 4px; font-size: 11px;">
            <div><strong>Element:</strong> ${elementData.tag} (${elementData.elementType || 'element'})</div>
            <div><strong>XPath:</strong> <code style="background: #222; padding: 2px 4px; border-radius: 2px;">${elementData.xpath}</code></div>
            <div><strong>Classes:</strong> ${elementData.classes.join(', ') || 'none'}</div>
            <div><strong>Issues Fixed:</strong> ${elementData.detectedIssues.join(', ') || 'UI improvements'}</div>
            <div><strong>CSS Rules Applied:</strong> ${cssLines} lines, ${stylesModified} properties modified</div>
        </div>
        <div style="margin: 8px 0;">
            <strong>Applied CSS:</strong>
            <pre style="background: #1a1a1a; color: #e4e6eb; padding: 8px; border-radius: 4px; font-size: 10px; max-height: 150px; overflow-y: auto; white-space: pre-wrap;">${geminiResponse.cssPatch}</pre>
        </div>
        <div style="text-align: center; margin-top: 12px;">
            <button id="copy-css" style="background: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin: 0 4px; font-size: 11px;">📋 Copy CSS</button>
            <button id="close-details" style="background: #58a6ff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin: 0 4px; font-size: 11px;">Close</button>
        </div>
    `);
    
    document.getElementById('copy-css').onclick = () => {
        navigator.clipboard.writeText(geminiResponse.cssPatch).then(() => {
            addChatMessage('System', '📋 CSS copied to clipboard!', 'system');
        });
    };
    
    document.getElementById('close-details').onclick = () => hideFeedbackModal();
}

// Track fix success for analytics
function trackFixSuccess(elementData, geminiResponse, feedback) {
    console.debug('[Popup] Tracking fix feedback:', { elementData, feedback });
    
    // Store detailed feedback for analytics and learning
    const fixRecord = {
        element: elementData.tag,
        elementType: elementData.elementType,
        issues: elementData.detectedIssues,
        css: geminiResponse.cssPatch,
        feedback: feedback,
        timestamp: Date.now(),
        url: elementData.url,
        // Enhanced tracking
        automaticAnalysis: elementData.automated || false,
        userRefinement: elementData.refinement || false,
        cssRulesCount: geminiResponse.cssPatch.split('\n').filter(line => line.includes(':')).length,
        successScore: feedback === 'positive' ? 1 : feedback === 'partial' ? 0.5 : 0
    };
    
    // Store in localStorage for analytics
    const existingRecords = JSON.parse(localStorage.getItem('darkmode_fix_tracking') || '[]');
    existingRecords.push(fixRecord);
    
    // Keep only last 100 records
    if (existingRecords.length > 100) {
        existingRecords.splice(0, existingRecords.length - 100);
    }
    
    localStorage.setItem('darkmode_fix_tracking', JSON.stringify(existingRecords));
    
    // Send analytics to background for learning (if available)
    try {
        browserAPI.runtime.sendMessage({
            type: 'TRACK_FIX_SUCCESS',
            data: fixRecord
        }, (response) => {
            if (browserAPI.runtime.lastError) {
                console.debug('[Popup] Analytics tracking not available:', browserAPI.runtime.lastError.message);
            } else {
                console.debug('[Popup] Fix success tracked for learning:', response);
            }
        });
    } catch (error) {
        console.debug('[Popup] Could not send analytics:', error);
    }
    
    // Auto-refresh analytics display
    try {
        updateAnalyticsDisplay();
    } catch (error) {
        console.debug('[Popup] Could not update analytics display:', error);
    }
}

// Auto-update analytics display after feedback
function updateAnalyticsDisplay() {
    const records = JSON.parse(localStorage.getItem('darkmode_fix_tracking') || '[]');
    
    if (records.length > 0) {
        const successRate = records.filter(r => r.successScore > 0.5).length / records.length;
        const avgScore = records.reduce((sum, r) => sum + r.successScore, 0) / records.length;
        
        // Update any analytics displays in the UI
        const statusText = document.getElementById('status-text');
        if (statusText && records.length > 5) {
            statusText.textContent = `${records.length} fixes applied (${Math.round(successRate * 100)}% success)`;
        }
        
        console.debug('[Popup] Analytics updated:', { 
            totalFixes: records.length, 
            successRate: Math.round(successRate * 100) + '%',
            avgScore: avgScore.toFixed(2)
        });
    }
}

// Handle agent status updates
function handleAgentStatusUpdate(msg) {
    console.debug('[Popup] Agent status update:', msg);
    // Handle status updates from the AI agent
}

// Update status display
function updateStatusDisplay(msg) {
    console.debug('[Popup] Status display update:', msg);
    // Update the UI with new status information
}

// Update page status indicator
function updatePageStatusIndicator() {
    console.debug('[Popup] Updating page status indicator');
    
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    if (!statusIndicator || !statusText) {
        console.debug('[Popup] Status elements not found');
        return;
    }
    
    // Get current tab info
    browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (browserAPI.runtime.lastError) {
            console.debug('[Popup] Error querying tabs:', browserAPI.runtime.lastError.message);
            return;
        }
        
        const tab = tabs[0];
        if (!tab || !tab.url) {
            statusIndicator.style.color = '#6c757d';
            statusText.textContent = 'No active page';
            return;
        }
        
        if (tab.url.startsWith('http') || tab.url.startsWith('https')) {
            // Check if dark mode is enabled
            browserAPI.storage.sync.get(['darkModeEnabled'], (result) => {
                if (result.darkModeEnabled) {
                    statusIndicator.style.color = '#28a745';
                    statusText.textContent = 'Dark mode active';
                } else {
                    statusIndicator.style.color = '#ffc107';
                    statusText.textContent = 'Ready for dark mode';
                }
            });
        } else {
            statusIndicator.style.color = '#dc3545';
            statusText.textContent = 'Unsupported page type';
        }
    });
}

// Trigger real-time analysis
async function triggerRealTimeAnalysis() {
    console.debug('[Popup] Triggering real-time analysis');
    
    try {
        const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url || !(tab.url.startsWith('http') || tab.url.startsWith('https'))) {
            console.debug('[Popup] Skipping analysis - unsupported page');
            return;
        }
        
        // Send analysis request to content script
        browserAPI.tabs.sendMessage(tab.id, {
            type: 'TRIGGER_DARK_MODE_ANALYSIS'
        }, (response) => {
            if (browserAPI.runtime.lastError) {
                console.debug('[Popup] Could not trigger analysis:', browserAPI.runtime.lastError.message);
            } else {
                console.debug('[Popup] Real-time analysis triggered:', response);
            }
        });
        
    } catch (error) {
        console.debug('[Popup] Error triggering real-time analysis:', error);
    }
}

// Get page type for error messages
function getPageType(url) {
    if (!url) {
        return 'unknown';
    }
    
    if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:')) {
        return 'browser';
    } else if (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) {
        return 'extension';
    } else if (url.startsWith('file://')) {
        return 'file';
    } else if (url.startsWith('http://') || url.startsWith('https://')) {
        return 'web';
    } else {
        return 'unknown';
    }
}

// Get user-friendly message for unsupported pages
function getUnsupportedPageMessage(pageType) {
    switch (pageType) {
        case 'browser':
            return 'Dark mode cannot be applied to browser internal pages';
        case 'extension':
            return 'Dark mode cannot be applied to extension pages';
        case 'file':
            return 'Dark mode cannot be applied to local files';
        case 'unknown':
            return 'This page type is not supported';
        default:
            return 'Dark mode is not available for this page';
    }
}

// Update connection status
async function updateConnectionStatus() {
    console.debug('[Popup] Updating connection status');
    
    const isConnected = await checkBackgroundConnection();
    
    // Update UI based on connection status
    const statusText = document.getElementById('status-text');
    if (statusText && !isConnected) {
        statusText.textContent = 'Connection issues detected';
    }
    
    console.debug('[Popup] Background connection status:', isConnected);
}

// Render feedback analytics
function renderFeedbackAnalytics() {
    console.debug('[Popup] Rendering feedback analytics');
    
    try {
        const feedback = JSON.parse(localStorage.getItem('darkmode_feedback') || '[]');
        const fixTracking = JSON.parse(localStorage.getItem('darkmode_fix_tracking') || '[]');
        
        // Update issues count
        const issuesCount = document.getElementById('issues-count');
        if (issuesCount) {
            issuesCount.textContent = feedback.length.toString();
        }
        
        // Update fixes count
        const fixesCount = document.getElementById('fixes-count');
        if (fixesCount) {
            fixesCount.textContent = fixTracking.length.toString();
        }
        
        // Update confidence score
        const confidenceScore = document.getElementById('confidence-score');
        if (confidenceScore && fixTracking.length > 0) {
            const avgScore = fixTracking.reduce((sum, record) => sum + (record.successScore || 0), 0) / fixTracking.length;
            confidenceScore.textContent = Math.round(avgScore * 100) + '%';
        } else if (confidenceScore) {
            confidenceScore.textContent = '-';
        }
        
        // Update last scan
        const lastScan = document.getElementById('last-scan');
        if (lastScan) {
            if (fixTracking.length > 0) {
                const latest = Math.max(...fixTracking.map(r => r.timestamp || 0));
                const date = new Date(latest);
                lastScan.textContent = date.toLocaleTimeString();
            } else {
                lastScan.textContent = 'Never';
            }
        }
        
    } catch (error) {
        console.debug('[Popup] Error rendering feedback analytics:', error);
    }
}

// Render AI learning analytics
function renderAILearningAnalytics() {
    console.debug('[Popup] Rendering AI learning analytics');
    
    try {
        const aiAnalyticsContent = document.getElementById('ai-analytics-content');
        if (!aiAnalyticsContent) {
            console.debug('[Popup] AI analytics content element not found');
            return;
        }
        
        const fixTracking = JSON.parse(localStorage.getItem('darkmode_fix_tracking') || '[]');
        
        if (fixTracking.length === 0) {
            aiAnalyticsContent.innerHTML = '<div style="padding: 16px; text-align: center; color: #6c757d;">No AI learning data available yet. Use the "Report Issue" feature to start building your AI knowledge base!</div>';
            return;
        }
        
        // Calculate success metrics
        const totalFixes = fixTracking.length;
        const successfulFixes = fixTracking.filter(r => r.successScore > 0.5).length;
        const successRate = Math.round((successfulFixes / totalFixes) * 100);
        const avgConfidence = Math.round(fixTracking.reduce((sum, r) => sum + (r.successScore || 0), 0) / totalFixes * 100);
        
        // Most common issues
        const issueTypes = {};
        fixTracking.forEach(record => {
            if (record.issues && Array.isArray(record.issues)) {
                record.issues.forEach(issue => {
                    issueTypes[issue] = (issueTypes[issue] || 0) + 1;
                });
            }
        });
        
        const topIssues = Object.entries(issueTypes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([issue, count]) => `${issue.replace(/_/g, ' ')} (${count})`);
        
        aiAnalyticsContent.innerHTML = `
            <div style="padding: 16px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                    <div style="background: rgba(40,167,69,0.1); padding: 12px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 20px; font-weight: bold; color: #28a745;">${successRate}%</div>
                        <div style="font-size: 12px; color: #6c757d;">Success Rate</div>
                    </div>
                    <div style="background: rgba(0,123,255,0.1); padding: 12px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 20px; font-weight: bold; color: #007bff;">${totalFixes}</div>
                        <div style="font-size: 12px; color: #6c757d;">Total Fixes</div>
                    </div>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <div style="font-weight: bold; margin-bottom: 8px; font-size: 13px;">🎯 Learning Progress</div>
                    <div style="background: #2a2a2a; border-radius: 8px; overflow: hidden;">
                        <div style="background: linear-gradient(90deg, #28a745, #20c997); height: 8px; width: ${avgConfidence}%;"></div>
                    </div>
                    <div style="font-size: 11px; color: #6c757d; margin-top: 4px;">AI Confidence: ${avgConfidence}%</div>
                </div>
                
                ${topIssues.length > 0 ? `
                <div>
                    <div style="font-weight: bold; margin-bottom: 8px; font-size: 13px;">🔍 Top Issues Fixed</div>
                    <div style="font-size: 11px; line-height: 1.4;">
                        ${topIssues.map(issue => `• ${issue}`).join('<br>')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
        
    } catch (error) {
        console.debug('[Popup] Error rendering AI learning analytics:', error);
    }
}
