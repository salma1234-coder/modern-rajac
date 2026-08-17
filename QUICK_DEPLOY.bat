@echo off
echo Nursing Study Platform - Quick Deployment
echo ========================================
echo.
echo This script will help you deploy to GitHub Pages
echo.
echo Step 1: Make sure you have Git installed
echo If not, download from: https://git-scm.com/
echo.
echo Step 2: Create GitHub account at: https://github.com
echo.
echo Step 3: Create new repository named: nursing-study-platform
echo.
echo Step 4: Run these commands one by one:
echo.
echo git init
echo git add .
echo git commit -m "Initial commit - Nursing Study Platform"
echo git branch -M main
echo git remote add origin https://github.com/YOUR_USERNAME/nursing-study-platform.git
echo git push -u origin main
echo.
echo IMPORTANT: Replace YOUR_USERNAME with your actual GitHub username!
echo.
echo Step 5: Go to your repository Settings > Pages
echo Enable GitHub Pages from main branch
echo.
echo Your site will be live at: https://YOUR_USERNAME.github.io/nursing-study-platform/
echo.
pause
