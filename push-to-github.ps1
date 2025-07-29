# AI Dark Mode Extension - GitHub Push Script
# This script prepares and pushes the extension to GitHub for public release

Write-Host "🚀 AI Dark Mode Extension - GitHub Release Script" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# Check if we're in a git repository
if (-not (Test-Path ".git")) {
    Write-Host "❌ Not a git repository. Initializing..." -ForegroundColor Yellow
    git init
    git remote add origin https://github.com/RorriMaesu/ai-dark-mode-extension.git
} else {
    Write-Host "✅ Git repository detected" -ForegroundColor Green
}

# Add all files
Write-Host "📁 Adding all files to staging..." -ForegroundColor Blue
git add .

# Check git status
Write-Host "📋 Current git status:" -ForegroundColor Blue
git status

# Create commit with comprehensive message
$commitMessage = @"
🎉 AI Dark Mode Extension v1.0.0 - Public Release Ready

✨ Features:
- AI-powered dark mode generation using Gemini 2.5
- Real-time analysis and auto-fixing
- Professional element inspector with F12-style highlighting
- Integrated AI chatbot for natural language troubleshooting
- Advanced analytics and learning system
- Comprehensive error handling and user feedback

🔧 Technical Improvements:
- Fixed all runtime errors in popup.js and content.js
- Added missing message handlers between popup and content scripts
- Enhanced notification and feedback systems
- Optimized UI/UX with modern design patterns
- Added comprehensive documentation and marketing materials

📚 Documentation:
- SEO-optimized README with marketing copy
- Edward Bernays-style Buy Me A Coffee section
- Complete API documentation
- User guides and troubleshooting
- Contributing guidelines and roadmap

🌟 Ready for:
- Chrome Web Store submission
- Microsoft Edge Add-ons
- Firefox AMO
- Community contributions
- Public marketing and SEO
"@

Write-Host "💬 Committing changes..." -ForegroundColor Blue
git commit -m $commitMessage

# Push to GitHub
Write-Host "🌐 Pushing to GitHub repository..." -ForegroundColor Blue
Write-Host "Repository: https://github.com/RorriMaesu/ai-dark-mode-extension" -ForegroundColor Cyan

try {
    git push -u origin main
    Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎯 Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Visit: https://github.com/RorriMaesu/ai-dark-mode-extension" -ForegroundColor White
    Write-Host "  2. Create release tags for version 1.0.0" -ForegroundColor White
    Write-Host "  3. Submit to Chrome Web Store" -ForegroundColor White
    Write-Host "  4. Submit to Microsoft Edge Add-ons" -ForegroundColor White
    Write-Host "  5. Submit to Firefox AMO" -ForegroundColor White
    Write-Host "  6. Share on social media and developer communities" -ForegroundColor White
} catch {
    Write-Host "❌ Push failed. Trying to set upstream..." -ForegroundColor Red
    git branch -M main
    git push -u origin main
}

Write-Host ""
Write-Host "🌟 AI Dark Mode Extension is now live on GitHub!" -ForegroundColor Green
Write-Host "🚀 Ready for public release and community collaboration!" -ForegroundColor Green
