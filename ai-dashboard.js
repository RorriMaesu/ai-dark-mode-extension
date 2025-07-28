/*
  AI Learning Dashboard: Advanced Analytics and Insights
  -----------------------------------------------------
  Provides detailed insights into the AI learning system
  and recommendations for improvement.
*/

class AILearningDashboard {
    constructor() {
        this.initializeDashboard();
    }

    async initializeDashboard() {
        await this.renderLearningMetrics();
        await this.renderPatternInsights();
        await this.renderRecommendations();
        this.setupRealTimeUpdates();
    }

    async renderLearningMetrics() {
        const metricsContainer = document.getElementById('learning-metrics');
        if (!metricsContainer) return;

        try {
            // Get comprehensive learning data
            const learningData = await this.fetchLearningData();
            
            metricsContainer.innerHTML = `
                <div class="metrics-grid">
                    <div class="metric-card">
                        <h4>🎯 Accuracy</h4>
                        <div class="metric-value">${Math.round(learningData.accuracy * 100)}%</div>
                        <div class="metric-trend ${learningData.accuracyTrend > 0 ? 'positive' : 'negative'}">
                            ${learningData.accuracyTrend > 0 ? '↗' : '↘'} ${Math.abs(learningData.accuracyTrend)}%
                        </div>
                    </div>
                    
                    <div class="metric-card">
                        <h4>🧠 Learning Speed</h4>
                        <div class="metric-value">${learningData.learningSpeed}</div>
                        <div class="metric-detail">fixes/day</div>
                    </div>
                    
                    <div class="metric-card">
                        <h4>🌐 Coverage</h4>
                        <div class="metric-value">${learningData.siteCoverage}</div>
                        <div class="metric-detail">unique domains</div>
                    </div>
                    
                    <div class="metric-card">
                        <h4>⚡ Auto-Fix Rate</h4>
                        <div class="metric-value">${Math.round(learningData.autoFixRate * 100)}%</div>
                        <div class="metric-detail">without Gemini API</div>
                    </div>
                </div>
                
                <div class="learning-progress">
                    <h4>Learning Progress</h4>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${learningData.overallProgress}%"></div>
                    </div>
                    <div class="progress-details">
                        <span>Beginner</span>
                        <span>Intermediate</span>
                        <span>Expert</span>
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.error('[Dashboard] Error rendering learning metrics:', error);
            metricsContainer.innerHTML = '<div class="error">Unable to load learning metrics</div>';
        }
    }

    async renderPatternInsights() {
        const insightsContainer = document.getElementById('pattern-insights');
        if (!insightsContainer) return;

        try {
            const patterns = await this.fetchPatternData();
            
            insightsContainer.innerHTML = `
                <div class="insights-section">
                    <h4>🔍 Discovered Patterns</h4>
                    
                    <div class="pattern-category">
                        <h5>Most Effective CSS Rules</h5>
                        <ul class="pattern-list">
                            ${patterns.topCSSRules.map(rule => `
                                <li>
                                    <code>${rule.selector}</code>
                                    <span class="effectiveness">${Math.round(rule.effectiveness * 100)}% effective</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                    
                    <div class="pattern-category">
                        <h5>Problematic Element Types</h5>
                        <ul class="pattern-list">
                            ${patterns.problematicElements.map(element => `
                                <li>
                                    <span class="element-tag">&lt;${element.tag}&gt;</span>
                                    <span class="frequency">${element.frequency} issues</span>
                                    <span class="fix-rate">${Math.round(element.fixRate * 100)}% fix rate</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                    
                    <div class="pattern-category">
                        <h5>Domain Specialization</h5>
                        <ul class="pattern-list">
                            ${patterns.topDomains.map(domain => `
                                <li>
                                    <span class="domain">${domain.name}</span>
                                    <span class="specialization">${Math.round(domain.specialization * 100)}% specialized</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.error('[Dashboard] Error rendering pattern insights:', error);
            insightsContainer.innerHTML = '<div class="error">Unable to load pattern insights</div>';
        }
    }

    async renderRecommendations() {
        const recommendationsContainer = document.getElementById('ai-recommendations');
        if (!recommendationsContainer) return;

        try {
            const recommendations = await this.generateRecommendations();
            
            recommendationsContainer.innerHTML = `
                <div class="recommendations-section">
                    <h4>💡 AI Recommendations</h4>
                    
                    ${recommendations.map(rec => `
                        <div class="recommendation-card ${rec.priority}">
                            <div class="rec-header">
                                <span class="rec-icon">${rec.icon}</span>
                                <span class="rec-title">${rec.title}</span>
                                <span class="rec-priority">${rec.priority}</span>
                            </div>
                            <div class="rec-description">${rec.description}</div>
                            ${rec.action ? `
                                <button class="rec-action" onclick="${rec.action}">
                                    ${rec.actionText}
                                </button>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
            
        } catch (error) {
            console.error('[Dashboard] Error rendering recommendations:', error);
            recommendationsContainer.innerHTML = '<div class="error">Unable to load recommendations</div>';
        }
    }

    async fetchLearningData() {
        // Simulate fetching comprehensive learning data
        return {
            accuracy: 0.87,
            accuracyTrend: 5.2,
            learningSpeed: 12,
            siteCoverage: 47,
            autoFixRate: 0.73,
            overallProgress: 68
        };
    }

    async fetchPatternData() {
        // Simulate fetching pattern analysis data
        return {
            topCSSRules: [
                { selector: '.menu, .dropdown', effectiveness: 0.92 },
                { selector: 'nav', effectiveness: 0.89 },
                { selector: '[class*="modal"]', effectiveness: 0.85 }
            ],
            problematicElements: [
                { tag: 'div', frequency: 156, fixRate: 0.82 },
                { tag: 'nav', frequency: 89, fixRate: 0.94 },
                { tag: 'button', frequency: 67, fixRate: 0.78 }
            ],
            topDomains: [
                { name: 'console.cloud.google.com', specialization: 0.89 },
                { name: 'github.com', specialization: 0.76 },
                { name: 'stackoverflow.com', specialization: 0.71 }
            ]
        };
    }

    async generateRecommendations() {
        const learningData = await this.fetchLearningData();
        const patterns = await this.fetchPatternData();
        const recommendations = [];

        // High priority recommendations
        if (learningData.accuracy < 0.8) {
            recommendations.push({
                icon: '⚠️',
                title: 'Improve Learning Accuracy',
                description: 'Current accuracy is below optimal. Consider collecting more user feedback for problematic elements.',
                priority: 'high',
                action: 'focusOnAccuracy()',
                actionText: 'Start Accuracy Focus Mode'
            });
        }

        if (learningData.autoFixRate < 0.5) {
            recommendations.push({
                icon: '🚀',
                title: 'Boost Auto-Fix Capability',
                description: 'Low auto-fix rate detected. The AI needs more training data to work independently.',
                priority: 'high',
                action: 'enableLearningMode()',
                actionText: 'Enable Enhanced Learning'
            });
        }

        // Medium priority recommendations
        if (learningData.siteCoverage < 50) {
            recommendations.push({
                icon: '🌐',
                title: 'Expand Site Coverage',
                description: 'Visit more diverse websites to improve the AI\'s adaptability across different domains.',
                priority: 'medium',
                action: 'suggestSites()',
                actionText: 'Get Site Suggestions'
            });
        }

        // Low priority recommendations
        recommendations.push({
            icon: '📊',
            title: 'Export Learning Data',
            description: 'Your AI has learned valuable patterns. Consider exporting data for backup or analysis.',
            priority: 'low',
            action: 'exportLearningData()',
            actionText: 'Export Data'
        });

        return recommendations;
    }

    setupRealTimeUpdates() {
        // Update metrics every 30 seconds
        setInterval(() => {
            this.renderLearningMetrics();
        }, 30000);

        // Update patterns every 5 minutes
        setInterval(() => {
            this.renderPatternInsights();
        }, 300000);

        // Update recommendations every 10 minutes
        setInterval(() => {
            this.renderRecommendations();
        }, 600000);
    }
}

// Dashboard action functions
window.focusOnAccuracy = function() {
    // Enable accuracy focus mode
    browserAPI.runtime.sendMessage({
        type: 'ENABLE_ACCURACY_FOCUS',
        mode: 'high_priority'
    });
    console.log('[Dashboard] Accuracy focus mode enabled');
};

window.enableLearningMode = function() {
    // Enable enhanced learning mode
    browserAPI.runtime.sendMessage({
        type: 'ENABLE_ENHANCED_LEARNING',
        aggressiveness: 'high'
    });
    console.log('[Dashboard] Enhanced learning mode enabled');
};

window.suggestSites = function() {
    // Suggest diverse websites for training
    const suggestions = [
        'https://news.ycombinator.com',
        'https://reddit.com',
        'https://medium.com',
        'https://docs.github.com',
        'https://developer.mozilla.org'
    ];
    
    alert('Suggested sites for training:\n' + suggestions.join('\n'));
};

window.exportLearningData = function() {
    // Export all learning data
    browserAPI.runtime.sendMessage({
        type: 'EXPORT_LEARNING_DATA'
    }, (response) => {
        if (response && response.data) {
            const blob = new Blob([JSON.stringify(response.data, null, 2)], 
                { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai-learning-data-${Date.now()}.json`;
            a.click();
        }
    });
};

// Initialize dashboard when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new AILearningDashboard();
    });
} else {
    new AILearningDashboard();
}
