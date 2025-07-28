/*
  AI Learning Engine: Universal Dark Mode Extension
  ------------------------------------------------
  This module enhances the AI's ability to learn from user feedback
  and improve dark mode fixes over time.
*/

class AILearningEngine {
    constructor() {
        this.feedbackDatabase = 'darkmode_feedback';
        this.patternDatabase = 'darkmode_patterns';
        this.successMetrics = 'darkmode_success';
        this.learningThreshold = 0.7; // Confidence threshold for auto-application
    }

    // Advanced feedback analysis with pattern recognition
    async analyzeFeedbackPatterns() {
        try {
            const feedback = JSON.parse(localStorage.getItem(this.feedbackDatabase) || '[]');
            const patterns = this.extractPatterns(feedback);
            
            // Store learned patterns for future use
            localStorage.setItem(this.patternDatabase, JSON.stringify(patterns));
            
            return patterns;
        } catch (error) {
            console.error('[AI Learning] Error analyzing patterns:', error);
            return {};
        }
    }

    // Extract common patterns from user feedback
    extractPatterns(feedbackData) {
        const patterns = {
            commonProblems: {},
            successfulFixes: {},
            elementTypes: {},
            websitePatterns: {},
            confidence: {}
        };

        feedbackData.forEach(feedback => {
            // Categorize by problem type
            const problemKey = this.categorizeProlem(feedback);
            if (!patterns.commonProblems[problemKey]) {
                patterns.commonProblems[problemKey] = { count: 0, examples: [] };
            }
            patterns.commonProblems[problemKey].count++;
            patterns.commonProblems[problemKey].examples.push(feedback);

            // Track successful fixes
            if (feedback.fixed) {
                const elementKey = `${feedback.tag}.${feedback.classes.join('.')}`;
                if (!patterns.successfulFixes[elementKey]) {
                    patterns.successfulFixes[elementKey] = { count: 0, cssFixes: [] };
                }
                patterns.successfulFixes[elementKey].count++;
                if (feedback.appliedCSS) {
                    patterns.successfulFixes[elementKey].cssFixes.push(feedback.appliedCSS);
                }
            }

            // Analyze by website domain
            const domain = this.extractDomain(feedback.url);
            if (!patterns.websitePatterns[domain]) {
                patterns.websitePatterns[domain] = { issues: [], fixes: [] };
            }
            patterns.websitePatterns[domain].issues.push(feedback);
        });

        // Calculate confidence scores
        Object.keys(patterns.successfulFixes).forEach(elementKey => {
            const fix = patterns.successfulFixes[elementKey];
            patterns.confidence[elementKey] = Math.min(fix.count / 10, 1.0); // Max confidence at 10 successful fixes
        });

        return patterns;
    }

    // Categorize problems for pattern matching
    categorizeProlem(feedback) {
        const description = (feedback.description || '').toLowerCase();
        
        if (description.includes('transparent') || description.includes('invisible')) {
            return 'transparent_background';
        }
        if (description.includes('contrast') || description.includes('hard to read')) {
            return 'poor_contrast';
        }
        if (description.includes('menu') || description.includes('dropdown')) {
            return 'menu_issues';
        }
        if (description.includes('text') || description.includes('font')) {
            return 'text_visibility';
        }
        
        return 'general_dark_mode';
    }

    // Extract domain from URL for website-specific learning
    extractDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return 'unknown';
        }
    }

    // Predictive CSS generation based on learned patterns
    async generatePredictiveCSS(elementData, pageContext) {
        const patterns = await this.analyzeFeedbackPatterns();
        const elementKey = `${elementData.tag}.${elementData.classes.join('.')}`;
        const domain = this.extractDomain(pageContext.url);

        // Check if we have high-confidence patterns for this element type
        if (patterns.confidence[elementKey] >= this.learningThreshold) {
            const successfulFixes = patterns.successfulFixes[elementKey];
            const mostSuccessfulCSS = this.findMostSuccessfulCSS(successfulFixes.cssFixes);
            
            return {
                css: mostSuccessfulCSS,
                confidence: patterns.confidence[elementKey],
                source: 'learned_pattern',
                basedOn: successfulFixes.count + ' previous fixes'
            };
        }

        // Check for domain-specific patterns
        if (patterns.websitePatterns[domain]) {
            const domainPattern = this.analyzeDomainPattern(patterns.websitePatterns[domain]);
            if (domainPattern.confidence > 0.5) {
                return {
                    css: domainPattern.recommendedCSS,
                    confidence: domainPattern.confidence,
                    source: 'domain_pattern',
                    basedOn: 'Similar issues on ' + domain
                };
            }
        }

        return null; // Fall back to Gemini API
    }

    // Find the most successful CSS pattern from historical data
    findMostSuccessfulCSS(cssFixes) {
        if (!cssFixes.length) return null;

        // Count frequency of similar CSS rules
        const ruleFrequency = {};
        cssFixes.forEach(css => {
            const rules = this.extractCSSRules(css);
            rules.forEach(rule => {
                ruleFrequency[rule] = (ruleFrequency[rule] || 0) + 1;
            });
        });

        // Combine most frequent rules
        const popularRules = Object.entries(ruleFrequency)
            .filter(([rule, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1])
            .map(([rule]) => rule);

        return popularRules.join('\n');
    }

    // Extract individual CSS rules for analysis
    extractCSSRules(css) {
        return css.split('}').map(rule => rule.trim() + '}').filter(rule => rule.length > 1);
    }

    // Analyze domain-specific patterns
    analyzeDomainPattern(domainData) {
        const totalIssues = domainData.issues.length;
        const fixedIssues = domainData.issues.filter(issue => issue.fixed).length;
        
        if (totalIssues < 3) {
            return { confidence: 0, recommendedCSS: null };
        }

        const confidence = fixedIssues / totalIssues;
        
        // Generate domain-specific CSS recommendations
        const commonProblems = this.findCommonProblemsInDomain(domainData.issues);
        const recommendedCSS = this.generateDomainSpecificCSS(commonProblems);

        return { confidence, recommendedCSS };
    }

    // Find common problems within a specific domain
    findCommonProblemsInDomain(issues) {
        const problemCounts = {};
        issues.forEach(issue => {
            const category = this.categorizeProlem(issue);
            problemCounts[category] = (problemCounts[category] || 0) + 1;
        });

        return Object.entries(problemCounts)
            .filter(([problem, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1])
            .map(([problem]) => problem);
    }

    // Generate CSS based on domain-specific common problems
    generateDomainSpecificCSS(commonProblems) {
        const cssRules = [];

        commonProblems.forEach(problem => {
            switch (problem) {
                case 'transparent_background':
                    cssRules.push(`
                        .menu, .dropdown, [class*="menu"], [class*="dropdown"] {
                            background-color: #222 !important;
                            border: 1px solid #444 !important;
                        }
                    `);
                    break;
                case 'poor_contrast':
                    cssRules.push(`
                        * {
                            color: #e0e0e0 !important;
                        }
                        a, .link {
                            color: #58a6ff !important;
                        }
                    `);
                    break;
                case 'menu_issues':
                    cssRules.push(`
                        nav, .navigation, .nav-menu {
                            background-color: #1a1a1a !important;
                            color: #ffffff !important;
                        }
                    `);
                    break;
            }
        });

        return cssRules.join('\n');
    }

    // Advanced success tracking with user behavior analysis
    async trackFixSuccess(elementData, appliedCSS, userRating) {
        try {
            const successData = {
                elementData,
                appliedCSS,
                userRating,
                timestamp: Date.now(),
                domain: this.extractDomain(window.location.href),
                effectivenessScore: this.calculateEffectivenessScore(userRating)
            };

            // Store success metrics
            let successMetrics = JSON.parse(localStorage.getItem(this.successMetrics) || '[]');
            successMetrics.push(successData);
            
            // Keep only last 500 entries to prevent storage bloat
            if (successMetrics.length > 500) {
                successMetrics = successMetrics.slice(-500);
            }
            
            localStorage.setItem(this.successMetrics, JSON.stringify(successMetrics));

            // Update feedback database with success info
            this.updateFeedbackWithSuccess(elementData, appliedCSS, userRating);

            return successData;
        } catch (error) {
            console.error('[AI Learning] Error tracking success:', error);
            return null;
        }
    }

    // Calculate effectiveness score based on user rating and other factors
    calculateEffectivenessScore(userRating) {
        switch (userRating) {
            case 'up': return 1.0;
            case 'down': return 0.0;
            case 'neutral': return 0.5;
            default: return 0.3;
        }
    }

    // Update feedback database with success information
    updateFeedbackWithSuccess(elementData, appliedCSS, userRating) {
        try {
            let feedback = JSON.parse(localStorage.getItem(this.feedbackDatabase) || '[]');
            
            // Find matching feedback entry
            const matchingIndex = feedback.findIndex(item => 
                item.tag === elementData.tag && 
                JSON.stringify(item.classes) === JSON.stringify(elementData.classes)
            );

            if (matchingIndex !== -1) {
                feedback[matchingIndex].fixed = userRating === 'up';
                feedback[matchingIndex].appliedCSS = appliedCSS;
                feedback[matchingIndex].userRating = userRating;
                feedback[matchingIndex].lastUpdated = Date.now();
                
                localStorage.setItem(this.feedbackDatabase, JSON.stringify(feedback));
            }
        } catch (error) {
            console.error('[AI Learning] Error updating feedback:', error);
        }
    }

    // Generate comprehensive learning report
    async generateLearningReport() {
        const patterns = await this.analyzeFeedbackPatterns();
        const successMetrics = JSON.parse(localStorage.getItem(this.successMetrics) || '[]');
        
        const report = {
            totalFeedback: Object.values(patterns.commonProblems).reduce((sum, p) => sum + p.count, 0),
            mostCommonProblems: Object.entries(patterns.commonProblems)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 5),
            topSuccessfulFixes: Object.entries(patterns.confidence)
                .filter(([key, conf]) => conf >= 0.5)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10),
            domainSpecialization: Object.keys(patterns.websitePatterns).length,
            overallSuccessRate: successMetrics.length > 0 ? 
                successMetrics.filter(m => m.effectivenessScore >= 0.7).length / successMetrics.length : 0,
            learningConfidence: this.calculateOverallConfidence(patterns)
        };

        return report;
    }

    // Calculate overall learning confidence
    calculateOverallConfidence(patterns) {
        const confidenceValues = Object.values(patterns.confidence);
        if (confidenceValues.length === 0) return 0;
        
        return confidenceValues.reduce((sum, conf) => sum + conf, 0) / confidenceValues.length;
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AILearningEngine;
} else {
    window.AILearningEngine = AILearningEngine;
}
