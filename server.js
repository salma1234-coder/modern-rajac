/**
 * تشغيل المنصة على http://localhost:3000
 * يُفضّل فتح الموقع عبر الخادم وليس ملف file://
 * لضمان عمل PDF والوسائط والتخزين المحلي بشكل موثوق.
 */
const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const root = __dirname;

// Generate secure session secret if not provided
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
    console.log('⚠️  WARNING: Using auto-generated SESSION_SECRET. Set SESSION_SECRET environment variable in production.');
    console.log('   Generated secret:', SESSION_SECRET);
}

// Security headers with Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            mediaSrc: ["'self'", "data:"],
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Rate limiting for login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: { error: "Too many login attempts. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: { error: "Too many requests. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Database setup
const adapter = new JSONFile(path.join(root, "database.json"));
const db = new Low(adapter, { users: [], loginRecords: [], failedAttempts: {}, subjects: [] });

// Initialize database
db.read().then(() => {
    if (!db.data.users) db.data.users = [];
    if (!db.data.loginRecords) db.data.loginRecords = [];
    if (!db.data.failedAttempts) db.data.failedAttempts = {};
    if (!db.data.subjects) db.data.subjects = [];
    db.write();
}).catch(err => {
    console.error("Database initialization error:", err);
});

// Session configuration
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict'
    },
    name: 'sessionId' // Custom session name for security
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(root, { index: "index.html" }));

// Protect teacher page - redirect to login if not authenticated
app.get("/teacher.html", (req, res) => {
    if (req.session.userId && req.session.role === 'teacher') {
        res.sendFile(path.join(root, "teacher.html"));
    } else {
        res.redirect("/SS.html");
    }
});

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: "Unauthorized" });
    }
};

// Middleware to check if user is teacher
const isTeacher = (req, res, next) => {
    if (req.session.userId && req.session.role === 'teacher') {
        next();
    } else {
        res.status(403).json({ error: "Forbidden - Teacher access required" });
    }
};

// Helper function to record failed attempts by IP
async function recordFailedAttempt(ip) {
    await db.read();
    if (!db.data.failedAttempts) db.data.failedAttempts = {};

    const key = `ip_${ip}`;
    db.data.failedAttempts[key] = (db.data.failedAttempts[key] || 0) + 1;

    // Clear old attempts (older than 1 hour)
    if (db.data.failedAttempts[key] > 20) {
        db.data.failedAttempts[key] = 20;
    }

    await db.write();
}

// Helper function to increment user failed attempts
async function incrementUserFailedAttempts(userId) {
    await db.read();
    if (!db.data.failedAttempts) db.data.failedAttempts = {};

    db.data.failedAttempts[userId] = (db.data.failedAttempts[userId] || 0) + 1;
    await db.write();
}

// Helper function to validate username format
function isValidUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    return usernameRegex.test(username);
}

// Helper function to validate password strength
function isValidPassword(password) {
    // Minimum 4 characters, max 100
    if (password.length < 4 || password.length > 100) return false;
    return true;
}

// Health check
app.get("/api/health", (_req, res) => {
    res.json({ ok: true, name: "nursing-study-platform" });
});

// Login endpoint with rate limiting and account lockout
app.post("/api/login", loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        // Input validation
        if (!username || !password) {
            return res.status(400).json({ error: "Username and password required" });
        }

        // Sanitize inputs
        const sanitizedUsername = username.trim().slice(0, 50);
        const sanitizedPassword = password.trim().slice(0, 100);

        if (sanitizedUsername !== username || sanitizedPassword !== password) {
            return res.status(400).json({ error: "Invalid input format" });
        }

        await db.read();
        const user = db.data.users.find(u => u.username === sanitizedUsername);

        if (!user) {
            // Record failed attempt for IP
            await recordFailedAttempt(req.ip);
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Check if account is locked
        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
            const remainingTime = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
            return res.status(403).json({
                error: `Account locked. Try again in ${remainingTime} minutes.`
            });
        }

        const isPasswordValid = await bcrypt.compare(sanitizedPassword, user.password);
        if (!isPasswordValid) {
            // Increment failed attempts
            await recordFailedAttempt(req.ip);
            await incrementUserFailedAttempts(user.id);

            // Check if should lock account
            const failedAttempts = db.data.failedAttempts[user.id] || 0;
            if (failedAttempts >= 5) {
                // Lock account for 30 minutes
                user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
                await db.write();
                return res.status(403).json({
                    error: "Too many failed attempts. Account locked for 30 minutes."
                });
            }

            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Clear failed attempts on successful login
        delete db.data.failedAttempts[user.id];
        if (user.lockedUntil) delete user.lockedUntil;
        await db.write();

        // Record login
        const loginRecord = {
            userId: user.id,
            username: user.username,
            fullName: user.fullName,
            loginTime: new Date().toISOString(),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        };

        await db.read();
        db.data.loginRecords.push(loginRecord);
        await db.write();

        // Set session
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.fullName = user.fullName;
        req.session.role = user.role || 'student';
        req.session.loginTime = new Date().toISOString();

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                role: user.role || 'student'
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Logout endpoint
app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: "Logout failed" });
        }
        res.json({ success: true });
    });
});

// Get current user
app.get("/api/user", isAuthenticated, (req, res) => {
    res.json({
        id: req.session.userId,
        username: req.session.username,
        fullName: req.session.fullName,
        role: req.session.role
    });
});

// Teacher: Get students by grade and subject
app.get("/api/teacher/students", apiLimiter, isTeacher, async (req, res) => {
    try {
        const { grade, subject } = req.query;

        await db.read();
        let students = db.data.users.filter(u => u.role === 'student');

        if (grade) {
            students = students.filter(s => s.grade === grade);
        }

        res.json({ students });
    } catch (error) {
        console.error("Get students error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Teacher: Get their subjects
app.get("/api/teacher/subjects", apiLimiter, isTeacher, async (req, res) => {
    try {
        await db.read();
        const teacher = db.data.users.find(u => u.id === req.session.userId);
        
        if (!teacher || teacher.role !== 'teacher') {
            return res.status(403).json({ error: "Unauthorized" });
        }

        const teacherSubjects = teacher.subjects || [];
        const subjects = db.data.subjects.filter(s => teacherSubjects.includes(s.name));

        res.json({ subjects });
    } catch (error) {
        console.error("Get teacher subjects error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n  منصة التمريض تعمل على:  http://localhost:${PORT}\n`);
});
