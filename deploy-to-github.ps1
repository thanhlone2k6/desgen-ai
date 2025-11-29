# Script to commit and push v8.1.0 to GitHub

Write-Host "🚀 Deploying v8.1.0 to GitHub..." -ForegroundColor Cyan

# Check if git is available
try {
    git --version | Out-Null
} catch {
    Write-Host "❌ Git is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Git or add it to PATH" -ForegroundColor Yellow
    exit 1
}

# Check if we're in a git repository
if (-not (Test-Path .git)) {
    Write-Host "❌ Not a git repository. Initializing..." -ForegroundColor Yellow
    git init
    git remote add origin https://github.com/thanhlone2k6/desgen-ai.git
}

# Add all changes
Write-Host "📦 Adding files..." -ForegroundColor Cyan
git add .

# Commit
Write-Host "💾 Committing changes..." -ForegroundColor Cyan
git commit -m "Release v8.1.0: API Key Management & Unlimited Mode

- Added API key input field (replaces API Connected status)
- Removed auto-set default API key
- Added Clear API Key button
- Added API key validation (required)
- Temporarily unlimited Banana Pro
- Improved error handling"

# Push to GitHub
Write-Host "⬆️  Pushing to GitHub..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Successfully pushed v8.1.0 to GitHub!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Push may have failed. Trying with force or different branch..." -ForegroundColor Yellow
    Write-Host "If this is the first push, you may need to:" -ForegroundColor Yellow
    Write-Host "  git push -u origin main" -ForegroundColor Yellow
    Write-Host "Or if branch is master:" -ForegroundColor Yellow
    Write-Host "  git push -u origin master" -ForegroundColor Yellow
}

Write-Host "`n📝 Next steps:" -ForegroundColor Cyan
Write-Host "1. Go to https://github.com/thanhlone2k6/desgen-ai" -ForegroundColor White
Write-Host "2. Create a new release tag: v8.1.0" -ForegroundColor White
Write-Host "3. Upload: dist-electron\DesignGen Pro Setup 8.1.0.exe" -ForegroundColor White
Write-Host "4. Upload: dist-electron\DesignGen Pro Setup 8.1.0.exe.blockmap" -ForegroundColor White
Write-Host "5. Add release notes from RELEASE_v8.1.0.md" -ForegroundColor White

