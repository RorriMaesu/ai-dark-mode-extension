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
            
        } catch (error) {
            console.error('[Popup] Error in automatic analysis:', error);
            updateFeedbackModal('<b>❌ Analysis Error</b><br>Could not analyze the element. Please try again.');
        } finally {
            setTimeout(() => hideFeedbackModal(), 8000);
        }
    }, 2000);
}

// Render feedback analytics
function renderFeedbackAnalytics() {
    try {
        const feedbackData = JSON.parse(localStorage.getItem('darkmode_feedback') || '[]');
        const feedbackCountElement = document.querySelector('[data-analytics="feedback-count"]');
        if (feedbackCountElement) {
            feedbackCountElement.textContent = feedbackData.length;
        }
    } catch (error) {
        console.debug('[Popup] Error rendering feedback analytics:', error);
    }
}

// Render AI learning analytics  
function renderAILearningAnalytics() {
    try {
        const learningData = JSON.parse(localStorage.getItem('ai_learning_data') || '{}');
        const patternCountElement = document.querySelector('[data-analytics="pattern-count"]');
        if (patternCountElement) {
            const patternCount = Object.keys(learningData.patterns || {}).length;
            patternCountElement.textContent = patternCount;
        }
    } catch (error) {
        console.debug('[Popup] Error rendering AI learning analytics:', error);
    }
}

