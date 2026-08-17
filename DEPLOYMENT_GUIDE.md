# Deployment Guide - Nursing Study Platform

## Step 1: Create GitHub Account
1. Go to https://github.com
2. Click "Sign up"
3. Enter your email, create password, and username
4. Verify your email

## Step 2: Create New Repository
1. After login, click the "+" icon in top right
2. Select "New repository"
3. Repository name: `nursing-study-platform`
4. Description: `Nursing Study Platform - Student Management System`
5. Make it "Public"
6. Don't initialize with README (we have files already)
7. Click "Create repository"

## Step 3: Upload Files
### Option A: Using GitHub Web Interface (Easier)
1. In your new repository, click "uploading an existing file"
2. Drag and drop ALL these files:
   - SS.html
   - script.js
   - export_functions.js
   - DEPLOYMENT_GUIDE.md (this file)
3. Commit changes: "Initial commit - Nursing Study Platform"

### Option B: Using Git Command Line
1. Install Git from https://git-scm.com/
2. Open Command Prompt in your project folder
3. Run these commands:
```bash
git init
git add .
git commit -m "Initial commit - Nursing Study Platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nursing-study-platform.git
git push -u origin main
```

## Step 4: Enable GitHub Pages
1. In your repository, go to "Settings"
2. Scroll down to "Pages" section
3. Under "Build and deployment", select:
   - Source: "Deploy from a branch"
   - Branch: "main"
   - Folder: "/ (root)"
4. Click "Save"

## Step 5: Get Your Live Link
1. Wait 2-3 minutes for deployment
2. Go back to Settings > Pages
3. Your link will be: `https://YOUR_USERNAME.github.io/nursing-study-platform/`

## Important Notes:
- The platform will be live and accessible to anyone
- All features will work including:
  - Student login
  - Teacher panel
  - Admin panel
  - PDF/Excel export
  - All materials and tests

## Testing Your Live Site:
1. Visit your link
2. Test student login (use any name - open access)

## Teacher Login Credentials:
### First Grade:
- **Arabic Language**: "walaa essam helmy" / "arabic113"
- **Mathematics**: "eman mohamed fathy" / "math119"
- **Science**: "sara said abdullah" / "science111"
- **Social Studies**: "mona mahmoud abdellatif" / "social115"
- **Religious Education**: "hadel mohamed ali" / "religion112"
- **Art Education**: "rana ahmed ali" / "art114"
- **Computer**: "marwa hani shaban" / "computer110"

### Second Grade:
- **Arabic Language**: "marwa hani shaban" / "arabic224"
- **Mathematics**: "eman mohamed fathy" / "math220"
- **Science**: "sara said abdullah" / "science223"
- **Social Studies**: "mona mahmoud abdellatif" / "social221"
- **Religious Education**: "hadel mohamed ali" / "religion222"

## Super Admin Login Credentials:
- **Admin 1**: "kawthar mahmoud" / "kawthar1234"
- **Admin 2**: "ahmed abduljawad" / "ahmed1234"
- **Admin 3**: "nancy aladdin" / "nansy1234"

## Customization:
- You can change the login credentials in script.js
- You can modify student lists in script.js
- You can update colors and styling in SS.html

## Support:
If you need help with any step, let me know!
The platform is fully functional and ready for deployment.
