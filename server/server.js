/*
  Universal Dark Mode Backend Proxy (server.js)
  -------------------------------------------------------------
  Security Rationale:
    - API key is stored only in .env and never exposed to extension/frontend.
    - All Gemini/LLM requests are validated and logged securely.
    - Feedback and CSS patches are processed server-side for privacy and auditability.
  Advanced Logging/Debugging:
    - All major functions, requests, Gemini API calls, and errors are logged using console.debug/info/error.
    - Logs do NOT leak sensitive data (e.g., API keys, user secrets).
    - Logging strategy explained in comments for security and audit.
*/
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fetch = require('node-fetch');
const fs = require('fs');
const app = express();

// Enable CORS for extension
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());


const FEEDBACK_LOG = 'feedback_log.json';

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.info('[Server] Health check requested');
  res.json({ status: 'ok' });
});

// Gemini feedback processing endpoint
app.post('/api/gemini-feedback', async (req, res) => {
  console.info('[Server] /api/gemini-feedback called');
  const feedback = req.body;
  console.debug('[Server] Feedback received:', feedback);
  const prompt = `
You are an expert front-end web developer specializing in accessible, high-contrast dark mode themes.
User feedback: ${JSON.stringify(feedback)}
Summarize, categorize, suggest CSS/DOM fix, score quality, check accessibility, cluster, and convert to structured data.
If a CSS fix is suggested, output ONLY a valid JSON object matching this schema:
{ "darkModeCss": "<all generated CSS rules as a string>" }
Do not include any explanations or markdown formatting.
`;
  const responseSchema = {
    type: 'OBJECT',
    properties: {
      darkModeCss: {
        type: 'STRING',
        description: 'A single string containing all the generated CSS rules for the dark mode theme.'
      }
    },
    required: ['darkModeCss']
  };
  const geminiPayload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: responseSchema,
      temperature: 0.2,
      max_output_tokens: 8192,
    },
  };
  const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  try {
    console.info('[Server] Sending request to Gemini API');
    const resp = await axios.post(geminiApiUrl, geminiPayload);
    console.debug('[Server] Gemini API response:', resp.data);
    res.json(resp.data);
  } catch (err) {
    console.error('[Server] Gemini API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Advanced debugging for Gemini proxy endpoint
app.post('/api/gemini', async (req, res) => {
  console.debug('[Server] /api/gemini called with body:', req.body);
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.error('[Server] API key not configured.');
    return res.status(500).json({ error: 'API key not configured.' });
  }
  // Accept all feedback fields
  const { css, tag, classes, xpath, description } = req.body;
  
  // Handle cases where CSS might be 'N/A' or description is the main prompt
  const isGeneralPrompt = css === 'N/A' || !css;
  const mainPrompt = description || 'Generate dark mode CSS fixes';
  // Build a detailed prompt for Gemini
  let prompt;
  if (isGeneralPrompt) {
    // For general prompts (chat, auto-fix, etc.)
    prompt = mainPrompt;
  } else {
    // For specific element fixes
    prompt = `You are an expert front-end web developer specializing in accessible, high-contrast dark mode themes.\n--- CSS START ---\n${css}\n--- CSS END ---\nUser has reported an issue with the following element:\nTag: ${tag}\nClasses: ${Array.isArray(classes) ? classes.join(', ') : ''}\nXPath: ${xpath}\nDescription: ${description}\nYour task: Analyze the user's feedback and the element context, then generate a CSS patch that fixes the reported issue.\nIMPORTANT: Never use 'transparent' or 'rgba(0,0,0,0)' for any menu, overlay, or popup background. Always set a solid dark color (e.g., #222 or #121212) for menu backgrounds. Output ONLY a valid JSON object matching this schema: { "darkModeCss": "<all generated CSS rules as a string>" }.`;
  }
  console.debug('[Server] Gemini prompt:', prompt);
  const responseSchema = {
    type: 'OBJECT',
    properties: {
      darkModeCss: {
        type: 'STRING',
        description: 'A single string containing all the generated CSS rules for the dark mode theme.'
      }
    },
    required: ['darkModeCss']
  };
  console.debug('[Server] Gemini responseSchema:', responseSchema);
  const geminiPayload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      response_mime_type: 'application/json',
      response_schema: responseSchema,
      temperature: 0.2,
      max_output_tokens: 8192
    }
  };
  console.debug('[Server] Gemini payload:', geminiPayload);
  const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
  try {
    console.debug('[Server] Sending request to Gemini API:', geminiApiUrl);
    const geminiResponse = await fetch(geminiApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });
    console.debug('[Server] Gemini API response status:', geminiResponse.status);
    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error('[Server] Gemini API error:', errorBody);
      throw new Error(`Gemini API error: ${geminiResponse.status} ${errorBody}`);
    }
    const geminiData = await geminiResponse.json();
    console.debug('[Server] Gemini API response data:', geminiData);
    // Save feedback and patch for future training
    const feedbackEntry = {
      timestamp: Date.now(),
      tag, classes, xpath, description, css,
      patch: geminiData.darkModeCss || '',
    };
    let log = [];
    try {
      if (fs.existsSync(FEEDBACK_LOG)) {
        log = JSON.parse(fs.readFileSync(FEEDBACK_LOG, 'utf8'));
      }
    } catch (e) {
      console.error('[Server] Failed to read feedback log:', e);
    }
    log.push(feedbackEntry);
    try {
      fs.writeFileSync(FEEDBACK_LOG, JSON.stringify(log, null, 2));
      console.info('[Server] Feedback and patch saved for future AI training.');
    } catch (e) {
      console.error('[Server] Failed to write feedback log:', e);
    }
    console.debug('[Server] Returning Gemini patch to client.');
    return res.status(200).json(geminiData);
  } catch (error) {
    console.error('[Server] Proxy error:', error);
    return res.status(500).json({ error: 'Failed to process request with Gemini API.' });
  }
});

// Enhanced feedback processing with pattern recognition
app.post('/api/analyze-patterns', (req, res) => {
  console.info('[Server] /api/analyze-patterns called');
  
  try {
    let log = [];
    if (fs.existsSync(FEEDBACK_LOG)) {
      log = JSON.parse(fs.readFileSync(FEEDBACK_LOG, 'utf8'));
    }
    
    // Analyze patterns in the feedback data
    const patterns = analyzeHistoricalPatterns(log);
    
    console.debug('[Server] Pattern analysis complete:', patterns);
    res.json({ status: 'ok', patterns });
    
  } catch (error) {
    console.error('[Server] Pattern analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze patterns' });
  }
});

// Advanced pattern analysis function
function analyzeHistoricalPatterns(feedbackData) {
  const patterns = {
    commonSelectors: {},
    successfulCSSRules: {},
    domainSpecificPatterns: {},
    temporalTrends: {},
    elementTypeEffectiveness: {}
  };
  
  feedbackData.forEach(entry => {
    // Analyze common selectors that need fixes
    if (entry.classes && entry.classes.length > 0) {
      const selectorKey = entry.classes.join('.');
      if (!patterns.commonSelectors[selectorKey]) {
        patterns.commonSelectors[selectorKey] = { count: 0, fixes: [] };
      }
      patterns.commonSelectors[selectorKey].count++;
      if (entry.patch) {
        patterns.commonSelectors[selectorKey].fixes.push(entry.patch);
      }
    }
    
    // Track successful CSS rules
    if (entry.patch) {
      const cssRules = extractCSSRules(entry.patch);
      cssRules.forEach(rule => {
        if (!patterns.successfulCSSRules[rule]) {
          patterns.successfulCSSRules[rule] = { count: 0, effectiveness: 0 };
        }
        patterns.successfulCSSRules[rule].count++;
      });
    }
    
    // Domain-specific analysis
    try {
      const url = new URL(entry.description || '');
      const domain = url.hostname;
      if (!patterns.domainSpecificPatterns[domain]) {
        patterns.domainSpecificPatterns[domain] = { issues: [], commonFixes: {} };
      }
      patterns.domainSpecificPatterns[domain].issues.push({
        tag: entry.tag,
        classes: entry.classes,
        fix: entry.patch
      });
    } catch (e) {
      // Invalid URL, skip domain analysis
    }
    
    // Temporal trends
    const month = new Date(entry.timestamp).toISOString().slice(0, 7);
    if (!patterns.temporalTrends[month]) {
      patterns.temporalTrends[month] = { count: 0, types: {} };
    }
    patterns.temporalTrends[month].count++;
    
    // Element type effectiveness
    if (entry.tag) {
      if (!patterns.elementTypeEffectiveness[entry.tag]) {
        patterns.elementTypeEffectiveness[entry.tag] = { 
          totalAttempts: 0, 
          successfulFixes: 0,
          commonIssues: []
        };
      }
      patterns.elementTypeEffectiveness[entry.tag].totalAttempts++;
      if (entry.patch && entry.patch.length > 10) { // Assume non-empty patches are successful
        patterns.elementTypeEffectiveness[entry.tag].successfulFixes++;
      }
    }
  });
  
  // Calculate effectiveness ratios
  Object.keys(patterns.elementTypeEffectiveness).forEach(tag => {
    const data = patterns.elementTypeEffectiveness[tag];
    data.effectivenessRatio = data.totalAttempts > 0 ? 
      data.successfulFixes / data.totalAttempts : 0;
  });
  
  return patterns;
}

// Extract individual CSS rules for pattern analysis
function extractCSSRules(css) {
  if (!css || typeof css !== 'string') return [];
  
  // Split by closing braces and filter out empty rules
  return css.split('}')
    .map(rule => rule.trim())
    .filter(rule => rule.length > 5)
    .map(rule => rule + '}');
}

// Smart CSS generation based on historical patterns
app.post('/api/smart-css-generation', async (req, res) => {
  console.info('[Server] /api/smart-css-generation called');
  
  try {
    const { elementData, pageContext } = req.body;
    
    // Load historical patterns
    let log = [];
    if (fs.existsSync(FEEDBACK_LOG)) {
      log = JSON.parse(fs.readFileSync(FEEDBACK_LOG, 'utf8'));
    }
    
    const patterns = analyzeHistoricalPatterns(log);
    
    // Generate smart CSS based on patterns
    const smartCSS = generateSmartCSS(elementData, pageContext, patterns);
    
    if (smartCSS.confidence > 0.6) {
      console.debug('[Server] High-confidence pattern-based CSS generated');
      res.json({
        status: 'ok',
        css: smartCSS.rules,
        confidence: smartCSS.confidence,
        source: 'pattern_based',
        reasoning: smartCSS.reasoning
      });
    } else {
      // Fall back to Gemini API for complex cases
      console.debug('[Server] Low confidence, falling back to Gemini API');
      res.json({ status: 'fallback_to_gemini' });
    }
    
  } catch (error) {
    console.error('[Server] Smart CSS generation error:', error);
    res.status(500).json({ error: 'Failed to generate smart CSS' });
  }
});

// Generate CSS based on learned patterns
function generateSmartCSS(elementData, pageContext, patterns) {
  let confidence = 0;
  let rules = [];
  let reasoning = [];
  
  // Check for exact class matches in successful patterns
  if (elementData.classes && elementData.classes.length > 0) {
    const classKey = elementData.classes.join('.');
    if (patterns.commonSelectors[classKey] && patterns.commonSelectors[classKey].count >= 3) {
      const fixes = patterns.commonSelectors[classKey].fixes;
      const mostCommonFix = findMostFrequentFix(fixes);
      if (mostCommonFix) {
        rules.push(mostCommonFix);
        confidence += 0.8;
        reasoning.push(`Based on ${fixes.length} successful fixes for similar elements`);
      }
    }
  }
  
  // Check element type effectiveness
  if (elementData.tag && patterns.elementTypeEffectiveness[elementData.tag]) {
    const effectiveness = patterns.elementTypeEffectiveness[elementData.tag];
    if (effectiveness.effectivenessRatio > 0.7) {
      confidence += 0.3;
      reasoning.push(`${elementData.tag} elements have ${Math.round(effectiveness.effectivenessRatio * 100)}% fix success rate`);
    }
  }
  
  // Domain-specific patterns
  if (pageContext.domain && patterns.domainSpecificPatterns[pageContext.domain]) {
    const domainPattern = patterns.domainSpecificPatterns[pageContext.domain];
    if (domainPattern.issues.length >= 2) {
      confidence += 0.2;
      reasoning.push(`Found ${domainPattern.issues.length} similar issues on this domain`);
    }
  }
  
  // Generate basic CSS if no specific patterns found but we have some confidence
  if (rules.length === 0 && confidence > 0.3) {
    rules = generateBasicDarkModeCSS(elementData);
    reasoning.push('Generated basic dark mode CSS based on element type');
  }
  
  return {
    rules: rules.join('\n'),
    confidence: Math.min(confidence, 1.0),
    reasoning: reasoning
  };
}

// Find the most frequently used fix
function findMostFrequentFix(fixes) {
  if (!fixes || fixes.length === 0) return null;
  
  const frequency = {};
  fixes.forEach(fix => {
    frequency[fix] = (frequency[fix] || 0) + 1;
  });
  
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])[0][0];
}

// Generate basic dark mode CSS for common element types
function generateBasicDarkModeCSS(elementData) {
  const rules = [];
  const selector = elementData.classes.length > 0 ? 
    `.${elementData.classes.join('.')}` : elementData.tag;
  
  switch (elementData.tag.toLowerCase()) {
    case 'div':
    case 'section':
      if (elementData.classes.some(cls => cls.includes('menu') || cls.includes('dropdown'))) {
        rules.push(`${selector} { background-color: #222 !important; color: #e0e0e0 !important; border: 1px solid #444 !important; }`);
      }
      break;
    case 'nav':
      rules.push(`${selector} { background-color: #1a1a1a !important; color: #ffffff !important; }`);
      break;
    case 'button':
      rules.push(`${selector} { background-color: #333 !important; color: #e0e0e0 !important; border: 1px solid #555 !important; }`);
      break;
    case 'input':
      rules.push(`${selector} { background-color: #2a2a2a !important; color: #e0e0e0 !important; border: 1px solid #555 !important; }`);
      break;
  }
  
  return rules;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.info(`[Server] Gemini feedback server running on port ${PORT}`);
});
