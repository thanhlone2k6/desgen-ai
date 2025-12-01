@echo off
echo ========================================
echo   Deploy v8.2.0 to GitHub
echo ========================================
echo.

REM Check if git exists
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git is not installed or not in PATH
    echo Please install Git for Windows: https://git-scm.com/download/win
    pause
    exit /b 1
)

REM Fix dubious ownership error
git config --global --add safe.directory "E:/Coding/DESGEN AI"

echo [1/5] Checking git repository...
if not exist .git (
    echo Initializing git repository...
    git init
    git remote add origin https://github.com/thanhlone2k6/desgen-ai.git
) else (
    REM Check if remote exists
    git remote get-url origin >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        git remote add origin https://github.com/thanhlone2k6/desgen-ai.git
    )
)

echo [2/5] Adding files...
git add .

echo [3/5] Committing changes...
git commit -m "Release v8.2.0" -m "- Bug fixes and improvements"

echo [4/5] Pushing to GitHub...
git push -u origin master
if %ERRORLEVEL% NEQ 0 (
    echo Trying with main branch...
    git push -u origin main
)

echo [5/5] Creating tag...
git tag -a v8.2.0 -m "Release v8.2.0"
git push origin v8.2.0

echo.
echo ========================================
echo   SUCCESS!
echo ========================================
echo.
echo Next steps:
echo 1. Go to: https://github.com/thanhlone2k6/desgen-ai/releases/new
echo 2. Choose tag: v8.2.0
echo 3. Title: v8.2.0 - [Mô tả]
echo 4. Upload 3 files from dist-electron:
echo    - DesignGen Pro Setup 8.2.0.exe
echo    - DesignGen Pro Setup 8.2.0.exe.blockmap
echo    - latest.yml
echo 5. IMPORTANT: Check file name on GitHub and fix latest.yml if needed
echo 6. Click "Publish release"
echo.
pause

