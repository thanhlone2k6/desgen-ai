@echo off
echo ========================================
echo   Deploy v8.1.0 to GitHub
echo ========================================
echo.

REM Check if git exists
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git is not installed or not in PATH
    echo Please install Git for Windows: https://git-scm.com/download/win
    echo Or use GitHub Desktop: https://desktop.github.com/
    pause
    exit /b 1
)

echo [1/5] Checking git repository...
if not exist .git (
    echo Initializing git repository...
    git init
    git remote add origin https://github.com/thanhlone2k6/desgen-ai.git
)

echo [2/5] Adding files...
git add .

echo [3/5] Committing changes...
git commit -m "Release v8.1.0: API Key Management & Unlimited Mode" -m "- Added API key input field" -m "- Removed auto-set default API key" -m "- Added Clear API Key button" -m "- Added API key validation" -m "- Temporarily unlimited Banana Pro"

echo [4/5] Pushing to GitHub...
git push -u origin main
if %ERRORLEVEL% NEQ 0 (
    echo Trying with master branch...
    git push -u origin master
)

echo [5/5] Creating tag...
git tag -a v8.1.0 -m "Release v8.1.0: API Key Management & Unlimited Mode"
git push origin v8.1.0

echo.
echo ========================================
echo   SUCCESS!
echo ========================================
echo.
echo Next steps:
echo 1. Go to: https://github.com/thanhlone2k6/desgen-ai/releases
echo 2. Create new release with tag v8.1.0
echo 3. Upload files from dist-electron folder
echo.
pause

