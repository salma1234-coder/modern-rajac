/* =========================
   GLOBAL VARIABLES
========================= */

let currentMaterial = null;
let currentTest = { name: "", questions: [] };
let currentStudent = null;
let timer = null, isRunning = false, isBreak = false, totalTime = 0;
let examActive = false;
const beep = new Audio("alarm.mp3");

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
}

function escapeAttr(str) {
    return String(str == null ? "" : str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
}

function urlForHtmlAttr(url) {
    if (typeof url !== "string" || !url) return "";
    return url.replace(/"/g, "&quot;");
}

function isSafeMediaUrl(u) {
    return typeof u === "string" && (u.startsWith("data:") || u.startsWith("blob:"));
}

// Enhanced validation functions
function validateInput(input, type, options = {}) {
    const value = input.value.trim();

    switch (type) {
        case 'name':
            if (!value) return { valid: false, message: 'حقل مطلوب' };
            if (value.length < 3) return { valid: false, message: 'الاسم يجب أن يكون 3 أحرف على الأقل' };
            if (value.length > 50) return { valid: false, message: 'الاسم طويل جداً' };
            if (!/^[\u0600-\u06FF\s]+$/.test(value)) return { valid: false, message: 'الاسم يجب أن يكون بالعربية فقط' };
            break;

        case 'class':
            if (!value) return { valid: false, message: 'حقل مطلوب' };
            if (!/^[A-Za-z]$/.test(value)) return { valid: false, message: 'حرف لاتيني واحد فقط' };
            break;

        case 'password':
            if (!value) return { valid: false, message: 'حقل مطلوب' };
            if (value.length < 4) return { valid: false, message: 'كلمة المرور قصيرة جداً' };
            if (value.length > 20) return { valid: false, message: 'كلمة المرور طويلة جداً' };
            break;

        case 'email':
            if (!value) return { valid: false, message: 'حقل مطلوب' };
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { valid: false, message: 'بريد إلكتروني غير صالح' };
            break;

        case 'text':
            if (!value) return { valid: false, message: 'حقل مطلوب' };
            if (value.length < 2) return { valid: false, message: 'النص قصير جداً' };
            if (value.length > 500) return { valid: false, message: 'النص طويل جداً' };
            break;

        default:
            if (!value) return { valid: false, message: 'حقل مطلوب' };
    }

    return { valid: true, message: '' };
}

function sanitizeInput(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/[<>]/g, '') // Remove HTML tags
        .replace(/javascript:/gi, '') // Remove javascript protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .trim();
}

function showError(input, message) {
    input.classList.add('error');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    input.parentNode.appendChild(errorDiv);
}

function clearError(input) {
    input.classList.remove('error');
    const errorDiv = input.parentNode.querySelector('.error-message');
    if (errorDiv) errorDiv.remove();
}

// Rate limiting for login attempts
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

function isRateLimited(identifier) {
    const attempts = loginAttempts.get(identifier) || { count: 0, lastAttempt: 0 };
    const now = Date.now();

    if (now - attempts.lastAttempt > LOCKOUT_TIME) {
        loginAttempts.set(identifier, { count: 0, lastAttempt: 0 });
        return false;
    }

    if (attempts.count >= MAX_ATTEMPTS) {
        const remainingTime = Math.ceil((LOCKOUT_TIME - (now - attempts.lastAttempt)) / 60000);
        return { locked: true, remainingTime };
    }

    return false;
}

function recordLoginAttempt(identifier) {
    const attempts = loginAttempts.get(identifier) || { count: 0, lastAttempt: 0 };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    loginAttempts.set(identifier, attempts);
}

// CSRF protection simulation
function generateCSRFToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

let csrfToken = generateCSRFToken();

// Content Security Policy headers would be set server-side
// This is a client-side validation helper
function validateCSRF(token) {
    return token === csrfToken;
}

function playBeep() {
    beep.play().catch(() => {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g);
            g.connect(ctx.destination);
            o.frequency.value = 880;
            g.gain.value = 0.06;
            o.start();
            setTimeout(() => { o.stop(); ctx.close(); }, 180);
        } catch (e) { /* ignore */ }
    });
}

function storageKeyForMedia(type) {
    const map = { video: "videos", pdf: "pdfs", voice: "voices" };
    return currentMaterial + "_" + (map[type] || type + "s");
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error("read"));
        r.readAsDataURL(file);
    });
}

function parseTestFromStorage(materialName) {
    try {
        const raw = localStorage.getItem(materialName);
        if (!raw) return { name: "", questions: [] };
        const p = JSON.parse(raw);
        if (Array.isArray(p)) return { name: "", questions: p };
        return {
            name: p.name || "",
            questions: Array.isArray(p.questions) ? p.questions : []
        };
    } catch (e) {
        return { name: "", questions: [] };
    }
}

function timerUnitLabel(u) {
    if (u === "hours") return "ساعة/ساعات";
    if (u === "days") return "يوم/أيام";
    return "دقيقة/دقائق";
}

const THEME_STORAGE_KEY = "nursing-theme";

function showToast(message, variant = "info", duration = 4000) {
    const root = document.getElementById("toastRoot");
    if (!root) {
        if (variant === "error") alert(message);
        return;
    }
    const t = document.createElement("div");
    t.className = `toast toast--${variant}`;
    t.setAttribute("role", variant === "error" ? "alert" : "status");
    t.textContent = message;
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add("toast--show"));
    setTimeout(() => {
        t.classList.remove("toast--show");
        setTimeout(() => t.remove(), 320);
    }, duration);
}

function initTheme() {
    let t = localStorage.getItem(THEME_STORAGE_KEY);
    if (!t) {
        t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", t);
}

function toggleTheme() {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    showToast(next === "dark" ? "تم تفعيل المظهر الداكن" : "تم تفعيل المظهر الفاتح", "info", 2200);
}

function setMaterialBreadcrumb(materialName) {
    const el = document.getElementById("materialBreadcrumb");
    if (!el) return;
    el.hidden = false;
    el.innerHTML = `<button type="button" class="breadcrumb__link" onclick="backToSubjects()">المواد الدراسية</button><span class="breadcrumb__sep" aria-hidden="true">/</span><span class="breadcrumb__current">${escapeHtml(materialName)}</span>`;
}

function hideMaterialBreadcrumb() {
    const el = document.getElementById("materialBreadcrumb");
    if (!el) return;
    el.hidden = true;
    el.innerHTML = "";
}

function updateAdminStats() {
    const wrap = document.getElementById("adminStats");
    if (!wrap || !currentMaterial) return;
    wrap.hidden = false;
    const test = parseTestFromStorage(currentMaterial);
    const nQ = test.questions.length;
    const ns = (JSON.parse(localStorage.getItem(currentMaterial + "_summaries")) || []).length;
    const nv = (JSON.parse(localStorage.getItem(currentMaterial + "_videos")) || []).length;
    const np = (JSON.parse(localStorage.getItem(currentMaterial + "_pdfs")) || []).length;
    const nvo = (JSON.parse(localStorage.getItem(currentMaterial + "_voices")) || []).length;
    const nst = (JSON.parse(localStorage.getItem("students")) || []).filter(x => x.material === currentMaterial).length;
    wrap.innerHTML = `
        <div class="stat-pill"><span class="stat-pill__v">${nQ}</span><span class="stat-pill__l">أسئلة</span></div>
        <div class="stat-pill"><span class="stat-pill__v">${ns}</span><span class="stat-pill__l">ملخصات</span></div>
        <div class="stat-pill"><span class="stat-pill__v">${nv}</span><span class="stat-pill__l">فيديو</span></div>
        <div class="stat-pill"><span class="stat-pill__v">${np}</span><span class="stat-pill__l">PDF</span></div>
        <div class="stat-pill"><span class="stat-pill__v">${nvo}</span><span class="stat-pill__l">صوت</span></div>
        <div class="stat-pill"><span class="stat-pill__v">${nst}</span><span class="stat-pill__l">نتائج</span></div>
    `;
    const tag = document.getElementById("adminTagline");
    if (tag) tag.textContent = `مادة «${currentMaterial}» — الأرقام تتحدّث بعد كل إضافة أو حفظ`;
}



// =====================
// البيانات الأساسية للمواد
// =====================
const subjects = {
    first: [
        { name: "اللغه العربيه", color: "#fdcb8e", admin: "ولاء عصام حلمى", password: "arabic113" },
        { name: "رياضيات", color: "#78faff", admin: "ايمان محمد فتحى", password: "math119" },
        { name: "Anatomy & Physiology", color: "#b0eeb6", admin: "مروه حجاج عبدالحكيم", password: "anatomy112" },
        { name: "Fundamental(نظرى)", color: "#ffb4a2", admin: "ولاء يوسف على", password: "fandat123" },
        { name: "Fundamental(عملى)", color: "#c0dff7", admin: "ولاء يوسف عملى", password: "fandap456" },
        { name: "فيزياء وكيمياء", color: "#aee7d2", admin: "محمد صابر محمد", password: "physic890" },
        { name: "احياء", color: "#fad2b7", admin: "رانيا خالد زكريا", password: "biology345" },
        { name: "دراسات اجتماعية", color: "#cdaedf", admin: "امانى زين العابدين", password: "social678" },
        { name: "English", color: "#f195ea", admin: "مياده صفوت عنتر", password: "english357" },
        { name: "حاسب الى", color: "#ffa672", admin: "الشيماء بدر الدين", password: "computer135" },
    ],
    second: [
        { name: "Medical-Surgical Nursing(نظرى)", color: "#fdcb8e", admin: "حازم محمد سيد", password: "medical267" },
        { name: "Medical-Surgical Nursing(عملى)", color: "#78faff", admin: "عبدالرحمن خالد غالب", password: "medical116" },
        { name: "Community Health Nursing", color: "#b0eeb6", admin: "طارق مجدى ابراهيم", password: "community117" },
        { name: "Surgical Medicine", color: "#ffb4a2", admin: "مروه حجاج عبدالحكيم", password: "surgical115" },
        { name: "Medical Medicine", color: "#c0dff7", admin: "مروه حجاج عبدالحكيم", password: "medical114" },
        { name: "English", color: "#f0fa68", admin: "اسماء حسانين سيد", password: "english987" },
        { name: "اللغة العربية", color: "#cdaedf", admin: "محمود عبدالعظيم", password: "arabic346" },
        { name: "بيولوجي", color: "#ffa672", admin: "وفاء عبدالسميع", password: "biology790" },
        { name: "فيزياء وكيمياء", color: "#f195ea", admin: "شيماء عبدالمنعم", password: "physic360" },
        { name: "إحصاء", color: "#a5faac", admin: "ايمان محمد فتحى", password: "stats695" },
        { name: "حاسب آلي", color: "#8089f5", admin: "ايه مخلوف خلف", password: "computer367" }
    ]
};

// =====================
// متغيرات النظام
// =====================

// =====================
// دوال مساعدة
// =====================
function normalizeArabic(text) {
    return text.trim()
        .replace(/[أإآ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ی/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/\s+/g, " ")
        .toLowerCase();
}

const FIRST_BOY_CLASSES = ["A", "B", "C", "D", "E", "F", "G", "H"];
const FIRST_GIRL_CLASSES = ["A", "B", "C", "D", "E", "F", "H"];
const SECOND_BOY_CLASSES = ["A", "B", "C", "D", "E", "F", "J", "H", "I"];
const SECOND_GIRL_CLASSES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];

function getStudentPool(gradeKey, gender, classLetter) {
    const cls = classLetter.toUpperCase().slice(0, 1);
    if (gradeKey === "first" && gender === "boy") {
        const m = { A: classAFirstBoys, B: classBFirstBoys, C: classCFirstBoys, D: classDFirstBoys, E: classEFirstBoys, F: classFFirstBoys, G: classGFirstBoys, H: classHFirstBoys };
        return m[cls] || [];
    }
    if (gradeKey === "first" && gender === "girl") {
        const m = { A: classAGirlsFirst, B: classBGirlsFirst, C: classCGirlsFirst, D: classDGirlsFirst, E: classEGirlsFirst, F: classFGirlsFirst, H: classHGirlsFirst };
        return m[cls] || [];
    }
    if (gradeKey === "second" && gender === "boy") {
        const m = { A: classAboysStudents, B: classBboysStudents, C: classCboysStudents, D: classDboysStudents, E: classEboysStudents, F: classFboysStudents, G: classGboysStudents, H: classHboysStudents, I: classIboysStudents, };
        return m[cls] || [];
    }
    if (gradeKey === "second" && gender === "girl") {
        const m = { A: classAGirlsStudents, B: classBGirlsStudents, C: classCGirlsStudents, D: classDGirlsStudents, E: classEGirlsStudents, F: classFGirlsStudents, G: classGGirlsStudents, H: classHGirlsStudents, I: classIGirlsStudents, J: classJGirlsStudents, K: classKGirlsStudents };
        return m[cls] || [];
    }
    return [];
}

function findStudentInPool(fullname, password, classLetter, gradeKey, gender) {
    const letter = classLetter.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1);
    if (!letter) return null;
    const pool = getStudentPool(gradeKey, gender, letter);
    const nf = normalizeArabic(fullname);
    return pool.find(s => normalizeArabic(s.fullname) === nf && s.password === password && s.className.toUpperCase() === letter) || null;
}

function togglePassword(id) {
    const passwordInput = document.getElementById(id);
    if (!passwordInput) return;
    passwordInput.type = passwordInput.type === "password" ? "text" : "password";
}

// =====================
// عرض المواد
// =====================
function showSubjectsForStudents(gradeKey, className, gender) {
    console.log("showSubjectsForStudents called with:", { gradeKey, className, gender });
    const container = document.getElementById("subjectsContainer");
    if (!container) {
        console.log("subjectsContainer not found");
        return;
    }
    container.innerHTML = "";
    console.log("Container cleared");

    const upperClass = className.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1);
    if (!upperClass) {
        showToast("أدخل الفصل (Class) بشكل صحيح.", "error");
        return;
    }

    let valid = false;
    if (gradeKey === "first" && gender === "boy" && FIRST_BOY_CLASSES.includes(upperClass)) valid = true;
    else if (gradeKey === "first" && gender === "girl" && FIRST_GIRL_CLASSES.includes(upperClass)) valid = true;
    else if (gradeKey === "second" && gender === "boy" && SECOND_BOY_CLASSES.includes(upperClass)) valid = true;
    else if (gradeKey === "second" && gender === "girl" && SECOND_GIRL_CLASSES.includes(upperClass)) valid = true;
    if (!valid) {
        showToast("الفصل أو النوع أو الصف الدراسي غير متوافقين.", "error");
        return;
    }

    subjects[gradeKey].forEach(sub => {
        const div = document.createElement("div");
        div.className = "card subject-card";
        div.textContent = sub.name;
        div.style.background = sub.color;
        div.onclick = () => openMaterial(sub.name);
        container.appendChild(div);
    });
    document.getElementById("subjects").style.display = "block";
    document.getElementById("materialPage").style.display = "none";
}

function showSubjectsForAdmin() {
    const container = document.getElementById("subjectsContainer");
    if (!container) return;
    container.innerHTML = "";

    Object.values(subjects).flat().forEach(sub => {
        const div = document.createElement("div");
        div.className = "card subject-card";
        div.textContent = sub.name;
        div.style.background = sub.color;
        div.onclick = () => openMaterial(sub.name);
        container.appendChild(div);
    });

    document.getElementById("subjects").style.display = "block";
    document.getElementById("materialPage").style.display = "none";
}

// =====================
// فتح المادة وعرض المحتوى
// =====================
function openMaterial(name) {
    currentMaterial = name;
    document.getElementById("materialTitle").textContent = name;
    setMaterialBreadcrumb(name);
    renderMaterialContent();
    document.getElementById("subjects").style.display = "none";
    document.getElementById("materialPage").style.display = "";

    // Track student access to material
    if (currentStudent && currentStudent.fullName) {
        trackStudentMaterialAccess(name);
    }
}

function trackStudentMaterialAccess(materialName) {
    if (!currentStudent || !currentStudent.fullName) return;

    let students = JSON.parse(localStorage.getItem("students")) || [];

    // Find existing student record or create new one
    let studentRecord = students.find(s =>
        s.name === currentStudent.fullName &&
        s.material === materialName
    );

    if (!studentRecord) {
        studentRecord = {
            name: currentStudent.fullName,
            grade: currentStudent.grade,
            className: currentStudent.className,
            gender: currentStudent.gender,
            material: materialName,
            studyTime: 0,
            accessCount: 0,
            firstAccess: new Date().toISOString(),
            lastActive: new Date().toISOString()
        };
        students.push(studentRecord);
    } else {
        studentRecord.accessCount++;
        studentRecord.lastActive = new Date().toISOString();
    }

    localStorage.setItem("students", JSON.stringify(students));
}

// Track study time
let studyTimeTracker = null;
let studyStartTime = null;

function startStudyTimeTracking() {
    if (!currentStudent || !currentMaterial) return;

    studyStartTime = Date.now();
    studyTimeTracker = setInterval(() => {
        updateStudyTime();
    }, 5000); // Update every 5 seconds
}

function updateStudyTime() {
    if (!currentStudent || !currentMaterial || !studyStartTime) return;

    let currentTime = Date.now();
    let sessionTime = Math.floor((currentTime - studyStartTime) / 1000); // in seconds

    let students = JSON.parse(localStorage.getItem("students")) || [];
    let studentRecord = students.find(s =>
        s.name === currentStudent.fullName &&
        s.material === currentMaterial
    );

    if (studentRecord) {
        studentRecord.studyTime = (studentRecord.studyTime || 0) + sessionTime;
        localStorage.setItem("students", JSON.stringify(students));
        studyStartTime = currentTime; // Reset start time
    }
}

function stopStudyTimeTracking() {
    if (studyTimeTracker) {
        clearInterval(studyTimeTracker);
        updateStudyTime(); // Final update
        studyTimeTracker = null;
        studyStartTime = null;
    }
}

function renderMaterialContent() {
    const el = document.getElementById("materialContent");
    const mat = currentMaterial;
    if (!el || !mat) return;

    // Start tracking study time when material opens
    startStudyTimeTracking();

    // Show notifications for new content
    showNotificationsForStudent();

    const summaries = JSON.parse(localStorage.getItem(mat + "_summaries")) || [];
    const videos = JSON.parse(localStorage.getItem(mat + "_videos")) || [];
    const pdfs = JSON.parse(localStorage.getItem(mat + "_pdfs")) || [];
    const voices = JSON.parse(localStorage.getItem(mat + "_voices")) || [];
    const testData = parseTestFromStorage(mat);

    let html = '<div class="material-sections">';

    if (summaries.length) {
        html += '<section class="mat-block"><h3>الملخصات</h3>';
        summaries.forEach((s, index) => {
            const timerNote = s.timerEnabled && s.timerValue
                ? `<p class="timer-note">⏱ وقت مقترح للمراجعة: ${escapeHtml(s.timerValue)} ${timerUnitLabel(s.timerUnit)}</p>`
                : "";
            const deleteBtn = !currentStudent ? `<button type="button" class="btn-delete" onclick="deleteSummary(${index})" title="حذف الملخص">🗑️</button>` : '';
            html += `<div class="summary-card">${deleteBtn}<div class="summary-text">${escapeHtml(s.text).replace(/\n/g, "<br>")}</div>${timerNote}</div>`;
        });
        html += "</section>";
    }

    if (videos.length) {
        html += '<section class="mat-block"><h3>فيديوهات</h3>';
        videos.forEach((v, index) => {
            if (v.url && isSafeMediaUrl(v.url)) {
                const deleteBtn = !currentStudent ? `<button type="button" class="btn-delete" onclick="deleteVideo(${index})" title="حذف الفيديو">🗑️</button>` : '';
                html += `<div class="media-row">${deleteBtn}<p class="media-name">${escapeHtml(v.name)}</p><video controls class="mat-video" src="${urlForHtmlAttr(v.url)}"></video></div>`;
            }
        });
        html += "</section>";
    }

    if (voices.length) {
        html += '<section class="mat-block"><h3>ملفات صوتية</h3>';
        voices.forEach((v, index) => {
            if (v.url && isSafeMediaUrl(v.url)) {
                const deleteBtn = !currentStudent ? `<button type="button" class="btn-delete" onclick="deleteVoice(${index})" title="حذف الملف الصوتي">🗑️</button>` : '';
                html += `<div class="media-row">${deleteBtn}<p class="media-name">${escapeHtml(v.name)}</p><audio controls class="mat-audio" src="${urlForHtmlAttr(v.url)}"></audio></div>`;
            }
        });
        html += "</section>";
    }

    if (pdfs.length) {
        html += '<section class="mat-block"><h3>ملفات PDF</h3>';
        pdfs.forEach((v, index) => {
            if (v.url && isSafeMediaUrl(v.url)) {
                const safeName = escapeAttr(v.name);
                const deleteBtn = !currentStudent ? `<button type="button" class="btn-delete" onclick="deletePDF(${index})" title="حذف ملف PDF">🗑️</button>` : '';
                html += `<div class="media-row">${deleteBtn}<p class="media-name">${escapeHtml(v.name)}</p><iframe class="mat-pdf" title="${safeName}" src="${urlForHtmlAttr(v.url)}"></iframe><a class="pdf-dl" href="${urlForHtmlAttr(v.url)}" download="${escapeAttr(v.name)}">تحميل PDF</a></div>`;
            }
        });
        html += "</section>";
    }

    if (testData.questions.length) {
        const deleteTestBtn = !currentStudent ? `<button type="button" class="btn-delete-test" onclick="deleteTest()" title="حذف الاختبار">🗑️ حذف الاختبار</button>` : '';
        if (currentStudent) {
            // Check if student already took this test
            const hasTakenTest = hasStudentTakenTest();
            if (hasTakenTest) {
                html += `<section class="mat-block exam-cta">${deleteTestBtn}<div class="test-completed">✅ لقد قمت بأداء هذا الاختبار من قبل</div></section>`;
            } else {
                html += `<section class="mat-block exam-cta">${deleteTestBtn}<button type="button" class="btn-start-exam" onclick="startStudentExam()">بدء الاختبار (${testData.questions.length} سؤال)</button></section>`;
            }
        } else {
            html += `<section class="mat-block exam-cta">${deleteTestBtn}<p class="hint-muted">سجّل دخولك كطالب من الأعلى لإجراء الاختبار.</p></section>`;
        }
    }

    if (!summaries.length && !videos.length && !voices.length && !pdfs.length && !testData.questions.length) {
        html += '<p class="empty-mat">لا يوجد محتوى بعد لهذه المادة. تواصل مع معلّم المادة.</p>';
    }

    html += "</div>";
    el.innerHTML = html;
}

function startStudentExam() {
    if (!currentStudent) {
        showToast("سجّل دخولك كطالب من النموذج أولاً.", "error");
        return;
    }

    // Check if student already took this test
    if (hasStudentTakenTest()) {
        showToast("لقد قمت بأداء هذا الاختبار من قبل. لا يسمح بإعادة الاختبار.", "error");
        return;
    }

    const testData = parseTestFromStorage(currentMaterial);
    if (!testData.questions.length) {
        showToast("لا توجد أسئلة في هذا الاختبار بعد.", "error");
        return;
    }
    examActive = true;
    const el = document.getElementById("materialContent");
    let html = '<form id="studentExamForm" class="exam-form">';
    testData.questions.forEach((q, qi) => {
        html += `<div class="exam-q"><p class="q-text"><strong>${qi + 1}.</strong> ${escapeHtml(q.question)}</p>`;
        if (q.type === "mcq" && q.options && q.options.length) {
            q.options.forEach((opt, oi) => {
                html += `<label class="opt-label"><input type="radio" name="q${qi}" value="${escapeAttr(opt)}" ${oi === 0 ? "required" : ""}> ${escapeHtml(opt)}</label>`;
            });
        } else {
            html += `<label class="opt-label"><input type="radio" name="q${qi}" value="صح" required> صح</label>`;
            html += `<label class="opt-label"><input type="radio" name="q${qi}" value="غلط"> غلط</label>`;
        }
        html += "</div>";
    });
    html += '<div class="exam-actions"><button type="submit" class="btn-start-exam">تسليم الإجابات</button>';
    html += '<button type="button" class="btn-cancel-exam" onclick="cancelStudentExam()">إلغاء</button></div></form>';
    el.innerHTML = html;
    const examForm = document.getElementById("studentExamForm");
    if (examForm) examForm.addEventListener("submit", submitStudentExam);
}

function cancelStudentExam() {
    examActive = false;
    renderMaterialContent();
}

function submitStudentExam(e) {
    e.preventDefault();
    const testData = parseTestFromStorage(currentMaterial);
    const qs = testData.questions;
    if (!qs.length) return;

    // Check if student already took this test
    if (hasStudentTakenTest()) {
        showToast("لقد قمت بأداء هذا الاختبار من قبل. لا يسمح بإعادة الاختبار.", "error");
        return;
    }

    let score = 0;
    let results = [];

    // Check each answer
    qs.forEach((q, qi) => {
        const sel = document.querySelector(`#studentExamForm input[name="q${qi}"]:checked`);
        const studentAnswer = sel ? String(sel.value).trim() : "";
        const correctAnswer = String(q.answer).trim();
        const isCorrect = studentAnswer === correctAnswer;

        if (isCorrect) score++;

        results.push({
            question: q.question,
            studentAnswer: studentAnswer || "لم يجب",
            correctAnswer: correctAnswer,
            isCorrect: isCorrect,
            questionType: q.type,
            options: q.options || []
        });
    });

    examActive = false;

    // Record the test result
    if (currentStudent) {
        recordStudentScore(score, qs.length);
        recordTestAttempt(score, qs.length, results);
    }

    // Show detailed results
    showTestResults(results, score, qs.length);
}

function hasStudentTakenTest() {
    let testResults = JSON.parse(localStorage.getItem("testResults")) || [];
    return testResults.some(result =>
        result.studentName === currentStudent.fullname &&
        result.material === currentMaterial.name
    );
}

function recordTestAttempt(score, total, results) {
    let testResults = JSON.parse(localStorage.getItem("testResults")) || [];

    const testResult = {
        studentName: currentStudent.fullname,
        material: currentMaterial.name,
        score: total ? Math.round(100 * score / total) : 0,
        totalQuestions: total,
        correctAnswers: score,
        timestamp: new Date().toISOString(),
        results: results,
        canRetake: false
    };

    testResults.push(testResult);
    localStorage.setItem("testResults", JSON.stringify(testResults));
}

function showTestResults(results, score, total) {
    const el = document.getElementById("materialContent");
    const percentage = total ? Math.round(100 * score / total) : 0;

    // Calculate grade
    let grade = "";
    if (percentage >= 90) grade = "ممتاز";
    else if (percentage >= 80) grade = "جيد جداً";
    else if (percentage >= 70) grade = "جيد";
    else if (percentage >= 60) grade = "متوسط";
    else if (percentage >= 50) grade = "ضعيف";
    else if (percentage > 0) grade = "مقبول";
    else grade = "راسب";

    let html = `
        <div class="test-results">
            <div class="results-header">
                <h2>🎯 نتائج الاختبار</h2>
                <div class="score-summary">
                    <div class="score-circle">
                        <span class="score-number">${percentage}%</span>
                        <span class="score-label">${grade}</span>
                    </div>
                    <div class="score-details">
                        <p>الدرجة: ${score} من ${total}</p>
                        <p>الإجابات الصحيحة: ${score}</p>
                        <p>الإجابات الخاطئة: ${total - score}</p>
                    </div>
                </div>
            </div>

            <div class="results-details">
                <h3>📋 تفاصيل الإجابات</h3>
    `;

    results.forEach((result, index) => {
        html += `
            <div class="question-result ${result.isCorrect ? 'correct' : 'incorrect'}">
                <div class="question-header">
                    <span class="question-number">سؤال ${index + 1}</span>
                    <span class="answer-status">${result.isCorrect ? '✅ صحيح' : '❌ خاطئ'}</span>
                </div>
                <div class="question-text">${escapeHtml(result.question)}</div>

                <div class="answer-comparison">
                    <div class="student-answer">
                        <strong>إجابتك:</strong>
                        <span class="${result.isCorrect ? 'correct-text' : 'incorrect-text'}">
                            ${escapeHtml(result.studentAnswer)}
                        </span>
                    </div>
                    ${!result.isCorrect ? `
                        <div class="correct-answer">
                            <strong>الإجابة الصحيحة:</strong>
                            <span class="correct-text">${escapeHtml(result.correctAnswer)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });

    html += `
            </div>
            <div class="results-footer">
                <button type="button" class="btn btn--primary" onclick="renderMaterialContent()">العودة للمادة</button>
            </div>
        </div>
    `;

    el.innerHTML = html;
}

function recordStudentScore(score, total) {
    let students = JSON.parse(localStorage.getItem("students")) || [];
    const nm = normalizeArabic(currentStudent.fullname);
    const idx = students.findIndex(s => s.material === currentMaterial && normalizeArabic(s.name) === nm);
    const row = {
        name: currentStudent.fullname,
        grade: currentStudent.gradeKey === "first" ? "الأول" : "الثاني",
        className: currentStudent.className,
        material: currentMaterial,
        score: `${score}/${total}`,
        percent: total ? Math.round(100 * score / total) : 0,
        at: new Date().toISOString()
    };
    if (idx >= 0) students[idx] = row;
    else students.push(row);
    try {
        localStorage.setItem("students", JSON.stringify(students));
    } catch (e) {
        showToast("تعذّر حفظ الدرجة. مساحة المتصفح قد تكون ممتلئة.", "error");
    }
}

async function logoutStudent() {
    try {
        // Call logout API
        await fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error("Logout API error:", error);
    }

    try {
        sessionStorage.removeItem("currentStudent");
    } catch (e) { /* ignore */ }

    // Reset UI
    currentStudent = null;
    const userSetupEl = document.getElementById("userSetup");
    if (userSetupEl) userSetupEl.style.display = "block";

    const welcome = document.getElementById("welcomeMsg");
    if (welcome) welcome.style.display = "none";

    const subjectsSection = document.getElementById("subjects");
    if (subjectsSection) subjectsSection.style.display = "none";

    // Reset form
    const setupForm = document.getElementById("setupForm");
    if (setupForm) setupForm.reset();

    // Hide error message
    const errorDiv = document.getElementById("loginError");
    if (errorDiv) errorDiv.style.display = "none";

    showToast("تم تسجيل الخروج بنجاح", "success");

    // Reload page to clear session
    setTimeout(() => {
        location.reload();
    }, 1000);
}

// =====================
// العودة للمواد
// =====================
function backToSubjects() {
    if (examActive) {
        if (!confirm("مغادرة الصفحة أثناء الاختبار؟ سيتم فقدان التقدم إن لم تسلّم.")) return;
        examActive = false;
    }

    // Stop tracking study time when leaving material
    stopStudyTimeTracking();

    document.getElementById("subjects").style.display = "block";
    document.getElementById("materialPage").style.display = "none";
    hideMaterialBreadcrumb();
}

// =====================
// تسجيل دخول الأدمن
// =====================
async function loginAdmin() {
    const name = document.getElementById("adminName").value.trim();
    const pass = document.getElementById("adminPass").value.trim();
    const loginMsg = document.getElementById("loginMsg");

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: name, password: pass })
        });

        if (response.ok) {
            const user = await response.json();
            if (user.role === 'teacher') {
                window.location.href = 'teacher.html';
            } else {
                if (loginMsg) {
                    loginMsg.textContent = "غير مصرح لك بالوصول";
                    loginMsg.classList.add("form-msg--error");
                }
            }
        } else {
            const error = await response.json();
            if (loginMsg) {
                loginMsg.textContent = error.error || "اسم المستخدم أو كلمة المرور غير صحيحة";
                loginMsg.classList.add("form-msg--error");
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        if (loginMsg) {
            loginMsg.textContent = "خطأ في الاتصال بالخادم";
            loginMsg.classList.add("form-msg--error");
        }
    }
}

// =====================
// رفع الملفات والملخصات
// =====================
function addSummary() {
    if (!currentMaterial) {
        showToast("اختر المادة من تسجيل الدخول أولاً.", "error");
        return;
    }
    const txt = document.getElementById("summaryContent").value.trim();
    if (!txt) {
        showToast("اكتب نص الملخص أولاً.", "error");
        return;
    }
    const timerCheck = document.getElementById("summaryTimerCheck");
    const timerValue = document.getElementById("summaryTimerValue").value;
    const timerUnit = document.getElementById("summaryTimerUnit").value;
    const summary = {
        text: txt,
        timerEnabled: timerCheck.checked,
        timerValue: timerValue,
        timerUnit: timerUnit,
        createdAt: new Date().toISOString()
    };
    const key = currentMaterial + "_summaries";
    let arr = JSON.parse(localStorage.getItem(key)) || [];
    arr.push(summary);
    localStorage.setItem(key, JSON.stringify(arr));
    document.getElementById("summaryContent").value = "";

    // Add notification for students
    addNotificationForStudents(currentMaterial, 'summary', 'ملخص جديد');

    updateAdminStats();
}

async function addFile(type) {
    if (!currentMaterial) {
        showToast("اختر المادة من تسجيل الدخول أولاً.", "error");
        return;
    }
    const fileInput = document.getElementById(type + "Upload");
    const file = fileInput && fileInput.files[0];
    if (!file) {
        showToast("اختر ملفاً أولاً.", "error");
        return;
    }

    // No size limits for any file type - completely open storage
    try {
        showToast("جاري رفع الملف...", "info");
        const dataUrl = await fileToDataUrl(file);
        const key = storageKeyForMedia(type);
        let list = JSON.parse(localStorage.getItem(key)) || [];
        list.push({ name: file.name, url: dataUrl, mime: file.type || "" });

        try {
            localStorage.setItem(key, JSON.stringify(list));
            showToast("تم رفع الملف بنجاح!", "success");
        } catch (setErr) {
            if (setErr && (setErr.name === "QuotaExceededError" || setErr.code === 22)) {
                showToast("مساحة التخزين ممتلئة. يرجى مسح بعض الملفات القديمة.", "error");
            } else {
                showToast("تعذّر حفظ الملف محلياً.", "error");
            }
            return;
        }
    } catch (err) {
        showToast("تعذّر قراءة الملف.", "error");
        return;
    }

    fileInput.value = "";

    // Add notification for students
    const contentType = type === 'video' ? 'video' : type === 'pdf' ? 'pdf' : 'voice';
    const contentTitle = file.name;
    addNotificationForStudents(currentMaterial, contentType, contentTitle);

    updateAdminStats();
}

function addVideo() { addFile("video"); }
function addPDF() { addFile("pdf"); }
function addVoice() { addFile("voice"); }

function saveTest() {
    if (!currentMaterial) {
        showToast("سجّل دخول المعلّم واختر مادة أولاً.", "error");
        return;
    }
    if (!Array.isArray(currentTest.questions) || currentTest.questions.length === 0) {
        showToast("أضف سؤالاً على الأقل قبل الحفظ.", "error");
        return;
    }

    // Get test settings
    const testDuration = document.getElementById("testDuration")?.value;
    const testTitle = document.getElementById("testTitle")?.value || "اختبار";

    // Add test metadata
    currentTest.duration = testDuration ? parseInt(testDuration) : null;
    currentTest.title = testTitle;
    currentTest.createdAt = new Date().toISOString();

    try {
        localStorage.setItem(currentMaterial, JSON.stringify(currentTest));
    } catch (e) {
        if (e && (e.name === "QuotaExceededError" || e.code === 22)) {
            showToast("مساحة التخزين ممتلئة.", "error");
            return;
        }
        showToast("تعذّر حفظ الاختبار.", "error");
        return;
    }

    // Add notification for students
    addNotificationForStudents(currentMaterial, 'test', currentTest.title || 'اختبار جديد');

    showToast(`تم حفظ الاختبار (${currentTest.questions.length} سؤال).`, "success");
    updateAdminStats();
}

// =====================
// إضافة سؤال
// =====================
// Handle question type change
function setupOptions() {
    const qt = document.getElementById("questionType");
    const div = document.getElementById("optionsDiv");
    const imageUploadWrap = document.getElementById("imageUploadWrap");
    const correctAnswerField = document.getElementById("correctAnswer");

    if (!qt || !div) return;

    const type = qt.value;
    div.innerHTML = "";

    // Show/hide image upload based on question type
    if (imageUploadWrap) {
        imageUploadWrap.style.display = type === "image" ? "block" : "none";
    }

    // Update correct answer placeholder
    if (correctAnswerField) {
        if (type === "mcq" || type === "image") {
            correctAnswerField.placeholder = "الإجابة الصحيحة (نص مطابق لأحد الخيارات)";
        } else if (type === "tf") {
            correctAnswerField.placeholder = "الإجابة الصحيحة (صح أو خطأ)";
        }
    }

    if (type === "mcq" || type === "image") {
        for (let i = 0; i < 4; i++) {
            let inp = document.createElement("input");
            inp.placeholder = `خيار ${i + 1}`;
            inp.className = "field-input";
            inp.style.marginBottom = "0.5rem";
            div.appendChild(inp);
        }
    } else if (type === "tf") {
        let select = document.createElement("select");
        select.id = "tfOptions";
        select.className = "field-input";
        ["صح", "خطأ"].forEach(v => {
            let o = document.createElement("option");
            o.value = v;
            o.innerText = v;
            select.appendChild(o);
        });
        div.appendChild(select);
    }
}

// Handle image upload
function handleImageUpload() {
    const imageInput = document.getElementById("questionImage");
    const imagePreview = document.getElementById("imagePreview");
    const previewImg = document.getElementById("previewImg");

    if (!imageInput || !imagePreview || !previewImg) return;

    const file = imageInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            previewImg.src = e.target.result;
            imagePreview.style.display = "block";
        };
        reader.readAsDataURL(file);
    }
}

// Remove uploaded image
function removeImage() {
    const imageInput = document.getElementById("questionImage");
    const imagePreview = document.getElementById("imagePreview");
    const previewImg = document.getElementById("previewImg");

    if (imageInput) imageInput.value = "";
    if (previewImg) previewImg.src = "";
    if (imagePreview) imagePreview.style.display = "none";
}

function addQuestion() {
    const type = document.getElementById("questionType").value;
    const question = document.getElementById("questionText").value.trim();
    let correct = document.getElementById("correctAnswer").value.trim();

    if (!question) {
        showToast("اكتب نص السؤال.", "error");
        return;
    }

    let options = [];
    let questionData = { type, question, answer: correct };

    // Handle image upload for image questions
    if (type === "image") {
        const previewImg = document.getElementById("previewImg");
        if (previewImg && previewImg.src) {
            questionData.image = previewImg.src;
        }
    }

    if (type === "mcq" || type === "image") {
        if (!correct) {
            showToast("اكتب الإجابة الصحيحة.", "error");
            return;
        }
        document.querySelectorAll("#optionsDiv input").forEach(i => options.push(i.value.trim()));
        if (options.some(o => !o)) {
            showToast("املأ جميع خيارات الاختيار من متعدد.", "error");
            return;
        }
        if (!options.includes(correct)) {
            showToast("الإجابة الصحيحة يجب أن تطابق أحد الخيارات حرفياً.", "error");
            return;
        }
        questionData.options = options;
    } else if (type === "tf") {
        options = ["صح", "خطأ"];
        const sel = document.getElementById("tfOptions");
        correct = sel ? sel.value.trim() : "";
        if (!options.includes(correct)) {
            showToast("اختر صح أو خطأ من القائمة.", "error");
            return;
        }
        questionData.options = options;
    }

    if (!Array.isArray(currentTest.questions)) currentTest.questions = [];
    currentTest.questions.push(questionData);

    // Clear form
    document.getElementById("questionText").value = "";
    document.getElementById("correctAnswer").value = "";
    removeImage();
    setupOptions();

    showToast("تم إضافة السؤال إلى بنك الأسئلة.", "success");
    updateAdminStats();
}

// =====================
// Delete Content Functions
// =====================

function deleteContent(type, index) {
    if (!currentMaterial) {
        showToast("اختر المادة أولاً.", "error");
        return;
    }

    if (!confirm("هل أنت متأكد من حذف هذا المحتوى؟")) return;

    let key = currentMaterial + "_" + type + "s";
    let items = JSON.parse(localStorage.getItem(key)) || [];

    if (index >= 0 && index < items.length) {
        const deletedItem = items[index];
        items.splice(index, 1);
        localStorage.setItem(key, JSON.stringify(items));

        showToast("تم حذف المحتوى بنجاح", "success");
        renderMaterialContent();
        updateAdminStats();
    }
}

// Material deletion is disabled - only content can be deleted
// Teachers can only delete individual content items (summaries, videos, PDFs, etc.)

// ===== SUPER ADMIN SYSTEM =====
// Super admin credentials (can be changed as needed)
const SUPER_ADMIN_CREDENTIALS = [
    { username: "كوثر محمود", password: "kawthar1234", name: "كوثر محمود" },
    { username: "احمد عبدالجواد", password: "ahmed1234", name: "احمد عبدالجواد" },
    { username: "نانسى علاء الدين", password: "nansy1234", name: "نانسى علاء الدين" }
];

// Function to normalize Arabic names (remove diacritics, handle spaces)
function normalizeArabicName(name) {
    return name
        .replace(/[أإآ]/g, 'ا')  // Normalize alif variants
        .replace(/[ى]/g, 'ي')      // Replace ya with alif maqsura
        .replace(/[ؤ]/g, 'و')      // Replace waw with hamza
        .replace(/[ئ]/g, 'ي')      // Replace ya with hamza
        .replace(/[ة]/g, 'ه')      // Replace ta marbuta
        .replace(/\s+/g, ' ')     // Normalize multiple spaces
        .trim();
}

// Super admin login function
function loginSuperAdmin() {
    const username = document.getElementById('superAdminName').value.trim();
    const password = document.getElementById('superAdminPass').value.trim();
    const loginMsg = document.getElementById('superAdminLoginMsg');

    if (!username || !password) {
        loginMsg.textContent = "الرجاء إدخال اسم المستخدم وكلمة المرور";
        loginMsg.className = "form-msg form-msg--error";
        return;
    }

    const normalizedUsername = normalizeArabicName(username);

    const validAdmin = SUPER_ADMIN_CREDENTIALS.find(admin =>
        normalizeArabicName(admin.username) === normalizedUsername && admin.password === password
    );

    if (validAdmin) {
        // Store super admin session
        localStorage.setItem('superAdminSession', 'true');
        localStorage.setItem('superAdminName', validAdmin.name);

        // Hide login section and show super admin panel
        document.getElementById('superAdminLoginSection').style.display = 'none';
        document.getElementById('superAdminPanel').style.display = 'block';

        // Load super admin data
        loadSuperAdminPanel();

        loginMsg.textContent = "";
        showToast("👑 تم تسجيل الدخول بنجاح كـمدير عام", "success");
    } else {
        loginMsg.textContent = "اسم المستخدم أو كلمة المرور غير صحيحة";
        loginMsg.className = "form-msg form-msg--error";
        showToast("بيانات الدخول غير صحيحة", "error");
    }
}

// Load super admin panel
function loadSuperAdminPanel() {
    updateSuperAdminStats();
    loadAllMaterials();
    loadGlobalStudentsStats();
    loadAllStudentsProgress();
    loadAllTestResults();
}

// Update super admin statistics
function updateSuperAdminStats() {
    const materials = JSON.parse(localStorage.getItem("materials")) || [];
    const students = JSON.parse(localStorage.getItem("students")) || [];
    const testResults = JSON.parse(localStorage.getItem("testResults")) || [];

    // Count unique teachers (assuming each material has a teacher)
    const uniqueTeachers = [...new Set(materials.map(m => m.teacher || 'غير محدد'))];

    document.getElementById('totalMaterialsCount').textContent = materials.length;
    document.getElementById('totalTeachersCount').textContent = uniqueTeachers.length;
    document.getElementById('totalStudentsCount').textContent = students.length;
    document.getElementById('totalTestsCount').textContent = testResults.length;
}

// Load all materials for super admin
function loadAllMaterials() {
    const materials = JSON.parse(localStorage.getItem("materials")) || [];
    const materialsList = document.getElementById('materialsList');

    if (materials.length === 0) {
        materialsList.innerHTML = '<p class="no-data">لا توجد مواد حالياً</p>';
        return;
    }

    materialsList.innerHTML = materials.map(material => `
        <div class="material-card super-admin-material-card">
            <h4 class="material-card__title">${escapeHtml(material.name)}</h4>
            <p class="material-card__teacher">المعلم: ${escapeHtml(material.teacher || 'غير محدد')}</p>
            <div class="material-stats">
                <span class="stat-badge">📝 ${JSON.parse(localStorage.getItem(material.name + "_summaries") || "[]").length} ملخصات</span>
                <span class="stat-badge">📹 ${JSON.parse(localStorage.getItem(material.name + "_videos") || "[]").length} فيديوهات</span>
                <span class="stat-badge">📄 ${JSON.parse(localStorage.getItem(material.name + "_pdfs") || "[]").length} PDF</span>
                <span class="stat-badge">🎤 ${JSON.parse(localStorage.getItem(material.name + "_voices") || "[]").length} صوتيات</span>
                <span class="stat-badge">📝 ${JSON.parse(localStorage.getItem(material.name + "_test") || "{}").questions?.length || 0} أسئلة</span>
            </div>
            <div class="material-actions">
                <button type="button" class="btn btn--primary btn--sm" onclick="accessTeacherPanel('${escapeHtml(material.name)}')">
                    🔐 دخول لوحة المعلم
                </button>
                <button type="button" class="btn btn--secondary btn--sm" onclick="viewMaterialDetails('${escapeHtml(material.name)}')">
                    📊 تفاصيل المادة
                </button>
            </div>
        </div>
    `).join('');
}

// Access teacher panel as super admin
function accessTeacherPanel(materialName) {
    // Set current material and show teacher panel
    const materials = JSON.parse(localStorage.getItem("materials")) || [];
    currentMaterial = materials.find(m => m.name === materialName);

    if (currentMaterial) {
        // Hide super admin panel and show admin panel
        document.getElementById('superAdminPanel').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';

        // Update admin panel title to show super admin mode
        document.getElementById('panelTitle').textContent = `👑 ${currentMaterial.name} (وضع المدير العام)`;
        document.getElementById('adminTagline').textContent = `للوصول الكامل - المعلم: ${currentMaterial.teacher || 'غير محدد'}`;

        // Load material content
        renderMaterialContent();
        updateAdminStats();
        loadStudentsTable();

        showToast(`🔓 تم الدخول إلى لوحة ${currentMaterial.name} بصلاحيات المدير العام`, "success");
    }
}

// Load all students progress
function loadAllStudentsProgress() {
    const students = JSON.parse(localStorage.getItem("students")) || [];
    const materials = JSON.parse(localStorage.getItem("materials")) || [];

    const progressContainer = document.getElementById('allStudentsProgress');
    if (!progressContainer) return;

    if (students.length === 0) {
        progressContainer.innerHTML = '<p class="no-data">Không có sinh viên nào</p>';
        return;
    }

    let html = '<div class="students-progress-grid">';

    students.forEach(student => {
        const studentProgress = {};
        let totalActivities = 0;
        let completedActivities = 0;

        materials.forEach(material => {
            const summaries = JSON.parse(localStorage.getItem(material.name + "_summaries") || "[]");
            const videos = JSON.parse(localStorage.getItem(material.name + "_videos") || "[]");
            const pdfs = JSON.parse(localStorage.getItem(material.name + "_pdfs") || "[]");
            const voices = JSON.parse(localStorage.getItem(material.name + "_voices") || "[]");

            const materialActivities = summaries.length + videos.length + pdfs.length + voices.length;
            totalActivities += materialActivities;

            // Check student progress for this material
            const studentData = JSON.parse(localStorage.getItem("student_" + student.name + "_" + material.name) || "{}");
            completedActivities += (studentData.completedSummaries || 0) + (studentData.completedVideos || 0) +
                (studentData.completedPDFs || 0) + (studentData.completedVoices || 0);

            studentProgress[material.name] = {
                total: materialActivities,
                completed: (studentData.completedSummaries || 0) + (studentData.completedVideos || 0) +
                    (studentData.completedPDFs || 0) + (studentData.completedVoices || 0),
                percentage: materialActivities > 0 ? Math.round(((studentData.completedSummaries || 0) + (studentData.completedVideos || 0) +
                    (studentData.completedPDFs || 0) + (studentData.completedVoices || 0)) / materialActivities * 100) : 0
            };
        });

        const overallPercentage = totalActivities > 0 ? Math.round(completedActivities / totalActivities * 100) : 0;

        html += `
            <div class="student-progress-card">
                <h4>${escapeHtml(student.name)}</h4>
                <p class="student-info">Grade: ${student.grade} | Class: ${student.className}</p>
                <div class="overall-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${overallPercentage}%"></div>
                    </div>
                    <span class="progress-text">${overallPercentage}%</span>
                </div>
                <div class="material-progress">
                    ${Object.entries(studentProgress).map(([materialName, progress]) => `
                        <div class="material-progress-item">
                            <span class="material-name">${escapeHtml(materialName)}</span>
                            <div class="mini-progress">
                                <div class="mini-progress-fill" style="width: ${progress.percentage}%"></div>
                            </div>
                            <span class="mini-progress-text">${progress.completed}/${progress.total}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    html += '</div>';
    progressContainer.innerHTML = html;
}

// Load all test results
function loadAllTestResults() {
    const testResults = JSON.parse(localStorage.getItem("testResults")) || [];
    const students = JSON.parse(localStorage.getItem("students")) || [];

    const resultsContainer = document.getElementById('allTestResults');
    if (!resultsContainer) return;

    if (testResults.length === 0) {
        resultsContainer.innerHTML = '<p class="no-data">Không có bài thi nào</p>';
        return;
    }

    let html = '<div class="test-results-table-wrapper"><table class="test-results-table"><thead><tr>';
    html += '<th>Tên sinh viên</th><th>Môn</th><th>Ngày</th><th>Thang</th><th>Thành tích</th><th>Thao tác</th>';
    html += '</tr></thead><tbody>';

    testResults.forEach(result => {
        const student = students.find(s => s.name === result.studentName);
        const grade = student ? student.grade : 'Không xác';
        const className = student ? student.className : 'Không xác';

        html += `
            <tr>
                <td>${escapeHtml(result.studentName)}</td>
                <td>${escapeHtml(result.material)}</td>
                <td>${new Date(result.date || result.timestamp).toLocaleDateString('vi-VN')}</td>
                <td>${result.totalQuestions || 0}</td>
                <td class="score ${result.score >= 70 ? 'score-high' : result.score >= 50 ? 'score-medium' : 'score-low'}">
                    ${result.score || 0}%
                </td>
                <td>
                    <button class="btn btn--sm btn--primary" onclick="viewTestDetails('${escapeHtml(result.studentName)}', '${escapeHtml(result.material)}')">
                        Xem chi ti
                    </button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    resultsContainer.innerHTML = html;
}

// Load global students statistics
function loadGlobalStudentsStats() {
    const students = JSON.parse(localStorage.getItem("students")) || [];
    const testResults = JSON.parse(localStorage.getItem("testResults")) || [];

    // Calculate statistics
    const totalStudents = students.length;
    const studentsWithTests = testResults.length;
    const averageScore = studentsWithTests > 0
        ? Math.round(testResults.reduce((sum, r) => sum + (r.score || 0), 0) / studentsWithTests)
        : 0;

    const today = new Date().toDateString();
    const activeToday = testResults.filter(r =>
        new Date(r.date || r.timestamp).toDateString() === today
    ).length;

    const globalStats = document.getElementById('globalStudentsStats');
    globalStats.innerHTML = `
        <div class="summary-card">
            <div class="summary-value">${totalStudents}</div>
            <div class="summary-label">إجمالي الطلاب</div>
        </div>
        <div class="summary-card">
            <div class="summary-value">${studentsWithTests}</div>
            <div class="summary-label">أدوا الاختبارات</div>
        </div>
        <div class="summary-card">
            <div class="summary-value">${averageScore}%</div>
            <div class="summary-label">متوسط الدرجات</div>
        </div>
        <div class="summary-card">
            <div class="summary-value">${activeToday}</div>
            <div class="summary-label">نشطون اليوم</div>
        </div>
    `;
}

// Generate global report
function generateGlobalReport() {
    const materials = JSON.parse(localStorage.getItem("materials")) || [];
    const students = JSON.parse(localStorage.getItem("students")) || [];
    const testResults = JSON.parse(localStorage.getItem("testResults")) || [];

    let report = "📊 تقرير شامل للنظام\n";
    report += `===================\n\n`;
    report += `📅 التاريخ: ${new Date().toLocaleDateString('ar-EG')}\n\n`;

    report += `📚 المواد: ${materials.length}\n`;
    report += `👥 الطلاب: ${students.length}\n`;
    report += `📝 الاختبارات: ${testResults.length}\n\n`;

    report += `📈 الإحصائيات:\n`;
    report += `- متوسط الدرجات: ${testResults.length > 0 ? Math.round(testResults.reduce((sum, r) => sum + (r.score || 0), 0) / testResults.length) : 0}%\n`;
    report += `- الناجحون: ${testResults.filter(r => (r.score || 0) >= 60).length}/${testResults.length}\n\n`;

    report += `📚 تفاصيل المواد:\n`;
    materials.forEach(material => {
        const summaries = JSON.parse(localStorage.getItem(material.name + "_summaries") || "[]").length;
        const videos = JSON.parse(localStorage.getItem(material.name + "_videos") || "[]").length;
        const pdfs = JSON.parse(localStorage.getItem(material.name + "_pdfs") || "[]").length;
        const voices = JSON.parse(localStorage.getItem(material.name + "_voices") || "[]").length;
        const test = JSON.parse(localStorage.getItem(material.name + "_test") || "{}");

        report += `- ${material.name} (${material.teacher || 'غير محدد'}):\n`;
        report += `  📝 ${summaries} ملخصات, 📹 ${videos} فيديوهات, 📄 ${pdfs} PDF, 🎤 ${voices} صوتيات, 📝 ${test.questions?.length || 0} أسئلة\n`;
    });

    // Download report
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_شامل_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);

    showToast("📊 تم إنشاء التقرير الشامل", "success");
}

// Export all data
function exportAllData() {
    const allData = {
        materials: JSON.parse(localStorage.getItem("materials") || "[]"),
        students: JSON.parse(localStorage.getItem("students") || "[]"),
        testResults: JSON.parse(localStorage.getItem("testResults") || "[]"),
        exportDate: new Date().toISOString(),
        version: "1.0"
    };

    // Add material-specific data
    const materials = allData.materials;
    materials.forEach(material => {
        allData[material.name + "_summaries"] = JSON.parse(localStorage.getItem(material.name + "_summaries") || "[]");
        allData[material.name + "_videos"] = JSON.parse(localStorage.getItem(material.name + "_videos") || "[]");
        allData[material.name + "_pdfs"] = JSON.parse(localStorage.getItem(material.name + "_pdfs") || "[]");
        allData[material.name + "_voices"] = JSON.parse(localStorage.getItem(material.name + "_voices") || "[]");
        allData[material.name + "_test"] = JSON.parse(localStorage.getItem(material.name + "_test") || "{}");
        allData[material.name + "_testSettings"] = JSON.parse(localStorage.getItem(material.name + "_testSettings") || "{}");
    });

    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `كل_البيانات_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);

    showToast("💾 تم تصدير كل البيانات بنجاح", "success");
}

// Show system logs
function showSystemLogs() {
    const logs = [
        `📅 ${new Date().toLocaleDateString('ar-EG')} ${new Date().toLocaleTimeString('ar-EG')}: نظام المدير العام جاهز`,
        `📊 المواد: ${JSON.parse(localStorage.getItem("materials") || "[]").length}`,
        `👥 الطلاب: ${JSON.parse(localStorage.getItem("students") || "[]").length}`,
        `📝 الاختبارات: ${JSON.parse(localStorage.getItem("testResults") || "[]").length}`,
    ];

    const logsContent = logs.join('\n');
    alert(`📋 سجلات النظام:\n\n${logsContent}`);
}

// Check for super admin session on page load
function checkSuperAdminSession() {
    const superAdminSession = localStorage.getItem('superAdminSession');
    if (superAdminSession === 'true') {
        document.getElementById('superAdminLoginSection').style.display = 'none';
        document.getElementById('superAdminPanel').style.display = 'block';
        loadSuperAdminPanel();
    }
}

function deleteSummary(index) {
    deleteContent("summary", index);
}

function deleteVideo(index) {
    deleteContent("video", index);
}

function deletePDF(index) {
    deleteContent("pdf", index);
}

function deleteVoice(index) {
    deleteContent("voice", index);
}

function deleteTest() {
    if (!currentMaterial) {
        showToast("اختر المادة أولاً.", "error");
        return;
    }

    if (!confirm("هل أنت متأكد من حذف الاختبار بالكامل؟")) return;

    try {
        localStorage.removeItem(currentMaterial);
        currentTest = { questions: [] };
        showToast("تم حذف الاختبار بنجاح", "success");
        renderMaterialContent();
        updateAdminStats();
    } catch (e) {
        showToast("تعذر حذف الاختبار", "error");
    }
}

// =====================
// Notification System for Students
// =====================

function addNotificationForStudents(materialName, contentType, contentTitle) {
    let notifications = JSON.parse(localStorage.getItem("studentNotifications")) || [];

    const notification = {
        id: Date.now().toString(),
        material: materialName,
        type: contentType, // 'summary', 'video', 'pdf', 'voice', 'test'
        title: contentTitle,
        timestamp: new Date().toISOString(),
        read: false
    };

    notifications.push(notification);
    localStorage.setItem("studentNotifications", JSON.stringify(notifications));

    // Show toast notification for admin
    showToast(`تمت إضافة ${contentType} بنجاح وسيظهر للطلاب`, "success", 3000);
}

function showNotificationsForStudent() {
    if (!currentStudent || !currentMaterial) return;

    let notifications = JSON.parse(localStorage.getItem("studentNotifications")) || [];
    let materialNotifications = notifications.filter(n =>
        n.material === currentMaterial && !n.read
    );

    if (materialNotifications.length > 0) {
        // Mark notifications as read
        notifications.forEach(n => {
            if (n.material === currentMaterial) {
                n.read = true;
            }
        });
        localStorage.setItem("studentNotifications", JSON.stringify(notifications));

        // Show notifications to student
        let notificationHTML = `
            <div class="notification-banner" style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 1rem;
                border-radius: 8px;
                margin-bottom: 1rem;
                animation: slideDown 0.5s ease-out;
            ">
                <h4 style="margin: 0 0 0.5rem 0;">📢 محتوى جديد!</h4>
                <div style="font-size: 0.9rem;">
        `;

        materialNotifications.forEach(n => {
            let typeIcon = getTypeIcon(n.type);
            let typeText = getTypeText(n.type);
            notificationHTML += `<div style="margin-bottom: 0.3rem;">${typeIcon} ${typeText}: ${escapeHtml(n.title)}</div>`;
        });

        notificationHTML += `
                </div>
                <button onclick="this.parentElement.style.display='none'" style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    padding: 0.3rem 0.8rem;
                    border-radius: 4px;
                    margin-top: 0.5rem;
                    cursor: pointer;
                ">إغلاق</button>
            </div>
        `;

        // Insert notification at the top of material content
        const materialContent = document.getElementById("materialContent");
        if (materialContent) {
            materialContent.insertAdjacentHTML('afterbegin', notificationHTML);
        }
    }
}

function getTypeIcon(type) {
    const icons = {
        'summary': '📝',
        'video': '📹',
        'pdf': '📄',
        'voice': '🎤',
        'test': '🧪'
    };
    return icons[type] || '📚';
}

function getTypeText(type) {
    const texts = {
        'summary': 'ملخص جديد',
        'video': 'فيديو جديد',
        'pdf': 'ملف PDF جديد',
        'voice': 'ملف صوتي جديد',
        'test': 'اختبار جديد'
    };
    return texts[type] || 'محتوى جديد';
}
function loadStudentsTable() {
    const tbody = document.getElementById("studentsBody");
    if (!tbody || !currentMaterial) return;
    tbody.innerHTML = "";

    // Get ALL students who have logged into the platform
    let allStudents = JSON.parse(localStorage.getItem("students")) || [];

    // Get test results for current material
    let testResults = JSON.parse(localStorage.getItem("testResults")) || [];

    // Filter students who have entered the current material
    let currentMaterialStudents = allStudents.filter(student =>
        student.material === currentMaterial.name
    );

    // Display only students who entered the current material
    currentMaterialStudents.forEach(student => {
        let tr = document.createElement("tr");

        // Find test results for this student in current material
        let studentTestResults = testResults.filter(r =>
            r.studentName === student.name && r.material === currentMaterial.name
        );

        // Get the latest test result from current material's test
        let latestTest = studentTestResults[studentTestResults.length - 1];
        let score = latestTest ? latestTest.score : 0;
        let hasTest = latestTest ? "نعم" : "لا";

        // Make sure the score is from the current material's test
        let currentMaterialTest = JSON.parse(localStorage.getItem(currentMaterial.name + "_test")) || {};
        if (currentMaterialTest.questions && currentMaterialTest.questions.length > 0) {
            // This material has a test, so the score is valid
            score = latestTest ? latestTest.score : 0;
        } else {
            // This material has no test, so no score should be shown
            score = 0;
            hasTest = "لا";
        }

        // Calculate actual grade based on score
        let grade = "";
        if (score >= 90) grade = "ممتاز";
        else if (score >= 80) grade = "جيد جداً";
        else if (score >= 70) grade = "جيد";
        else if (score >= 60) grade = "متوسط";
        else if (score >= 50) grade = "ضعيف";
        else if (score > 0) grade = "مقبول";
        else grade = "-";

        // Calculate improvement status
        let improvementStatus = "-";
        let improvementIcon = "";
        if (studentTestResults.length > 1) {
            let previousScore = studentTestResults[studentTestResults.length - 2].score;
            let currentScore = score;
            if (currentScore > previousScore) {
                improvementStatus = "تحسن";
                improvementIcon = "📈";
            } else if (currentScore < previousScore) {
                improvementStatus = "تراجع";
                improvementIcon = "📉";
            } else {
                improvementStatus = "ثابت";
                improvementIcon = "➡️";
            }
        }

        // Format study time
        let studyTime = student.studyTime || 0;
        let hours = Math.floor(studyTime / 3600);
        let minutes = Math.floor((studyTime % 3600) / 60);
        let timeText = hours > 0 ? `${hours}س ${minutes}د` : `${minutes}د`;

        // Add test details action button
        let testDetailsBtn = latestTest ?
            `<button type="button" class="btn btn--sm btn--ghost" onclick="showTestDetails('${escapeHtml(student.name)}')" title="عرض تفاصيل الاختبار">📋</button>` :
            '-';

        tr.innerHTML = `
            <td>${escapeHtml(student.name)}</td>
            <td>${escapeHtml(student.grade)}</td>
            <td>${escapeHtml(student.className)}</td>
            <td>${escapeHtml(student.gender || '-')}</td>
            <td>${timeText}</td>
            <td>${hasTest}</td>
            <td>${score > 0 ? score : '-'}</td>
            <td>${grade}</td>
            <td>${improvementIcon} ${improvementStatus}</td>
            <td>${testDetailsBtn}</td>
            <td>${escapeHtml(student.lastActive || new Date().toLocaleDateString('ar-EG'))}</td>
        `;
        tbody.appendChild(tr);
    });
    updateAdminStats();
}

function showTestDetails(studentName) {
    let testResults = JSON.parse(localStorage.getItem("testResults")) || [];

    // Find test results for this student in current material
    let studentTestResults = testResults.filter(r =>
        r.studentName === studentName && r.material === currentMaterial.name
    );

    if (studentTestResults.length === 0) {
        showToast("لا توجد نتائج اختبار لهذا الطالب", "error");
        return;
    }

    // Get the latest test result
    let latestTest = studentTestResults[studentTestResults.length - 1];

    const el = document.getElementById("materialContent");

    let html = `
        <div class="test-results">
            <div class="results-header">
                <h2>📋 تفاصيل اختبار الطالب</h2>
                <div class="student-info">
                    <h3>${escapeHtml(studentName)}</h3>
                    <p>المادة: ${escapeHtml(currentMaterial.name)}</p>
                    <p>التاريخ: ${new Date(latestTest.timestamp).toLocaleDateString('ar-EG')}</p>
                </div>
                <div class="score-summary">
                    <div class="score-circle">
                        <span class="score-number">${latestTest.score}%</span>
                        <span class="score-label">${latestTest.score >= 60 ? 'ناجح' : 'راسب'}</span>
                    </div>
                    <div class="score-details">
                        <p>الدرجة: ${latestTest.correctAnswers} من ${latestTest.totalQuestions}</p>
                        <p>الإجابات الصحيحة: ${latestTest.correctAnswers}</p>
                        <p>الإجابات الخاطئة: ${latestTest.totalQuestions - latestTest.correctAnswers}</p>
                        <p>النسبة المئوية: ${latestTest.score}%</p>
                    </div>
                </div>
            </div>

            <div class="results-details">
                <h3>📋 تفاصيل الإجابات</h3>
    `;

    if (latestTest.results && latestTest.results.length > 0) {
        latestTest.results.forEach((result, index) => {
            html += `
                <div class="question-result ${result.isCorrect ? 'correct' : 'incorrect'}">
                    <div class="question-header">
                        <span class="question-number">سؤال ${index + 1}</span>
                        <span class="answer-status">${result.isCorrect ? '✅ صحيح' : '❌ خاطئ'}</span>
                    </div>
                    <div class="question-text">${escapeHtml(result.question)}</div>

                    <div class="answer-comparison">
                        <div class="student-answer">
                            <strong>إجابة الطالب:</strong>
                            <span class="${result.isCorrect ? 'correct-text' : 'incorrect-text'}">
                                ${escapeHtml(result.studentAnswer)}
                            </span>
                        </div>
                        <div class="correct-answer">
                            <strong>الإجابة الصحيحة:</strong>
                            <span class="correct-text">${escapeHtml(result.correctAnswer)}</span>
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        html += '<p>لا توجد تفاصيل الإجابات متاحة</p>';
    }

    html += `
            </div>
            <div class="results-footer">
                <button type="button" class="btn btn--primary" onclick="renderMaterialContent()">العودة للمادة</button>
            </div>
        </div>
    `;

    el.innerHTML = html;
}
function searchAllStudents() {
    const searchInput = document.getElementById("studentSearch").value.toLowerCase();
    const tbody = document.getElementById("studentsBody");
    if (!tbody) return;

    const allStudents = JSON.parse(localStorage.getItem("students")) || [];
    const testResults = JSON.parse(localStorage.getItem("testResults")) || [];

    // Filter ONLY students who entered the current material
    let currentMaterialStudents = allStudents.filter(student =>
        student.material === currentMaterial.name
    );

    // Filter students based on search
    const filteredStudents = currentMaterialStudents.filter(student => {
        const searchTerm = searchInput;
        return (
            student.name.toLowerCase().includes(searchTerm) ||
            student.grade.toLowerCase().includes(searchTerm) ||
            student.className.toLowerCase().includes(searchTerm) ||
            student.gender.toLowerCase().includes(searchTerm)
        );
    });

    tbody.innerHTML = "";

    filteredStudents.forEach(student => {
        let tr = document.createElement("tr");

        // Find all test results for this student in current material
        let studentTestResults = testResults.filter(r =>
            r.studentName === student.name && r.material === currentMaterial.name
        );

        // Get the latest test result
        let latestTest = studentTestResults[studentTestResults.length - 1];
        let score = latestTest ? latestTest.score : 0;
        let hasTest = latestTest ? "نعم" : "لا";

        // Calculate actual grade based on score
        let grade = "";
        if (score >= 90) grade = "ممتاز";
        else if (score >= 80) grade = "جيد جداً";
        else if (score >= 70) grade = "جيد";
        else if (score >= 60) grade = "متوسط";
        else if (score >= 50) grade = "ضعيف";
        else if (score > 0) grade = "مقبول";
        else grade = "-";

        // Calculate improvement status
        let improvementStatus = "-";
        let improvementIcon = "";
        if (studentTestResults.length > 1) {
            let previousScore = studentTestResults[studentTestResults.length - 2].score;
            let currentScore = score;
            if (currentScore > previousScore) {
                improvementStatus = "تحسن";
                improvementIcon = "📈";
            } else if (currentScore < previousScore) {
                improvementStatus = "تراجع";
                improvementIcon = "📉";
            } else {
                improvementStatus = "ثابت";
                improvementIcon = "➡️";
            }
        }

        let studyTime = student.studyTime || 0;
        let hours = Math.floor(studyTime / 3600);
        let minutes = Math.floor((studyTime % 3600) / 60);
        let timeText = hours > 0 ? `${hours}س ${minutes}د` : `${minutes}د`;

        // Add test details action button
        let testDetailsBtn = latestTest ?
            `<button type="button" class="btn btn--sm btn--ghost" onclick="showTestDetails('${escapeHtml(student.name)}')" title="عرض تفاصيل الاختبار">📋</button>` :
            '-';

        tr.innerHTML = `
            <td>${escapeHtml(student.name)}</td>
            <td>${escapeHtml(student.grade)}</td>
            <td>${escapeHtml(student.className)}</td>
            <td>${escapeHtml(student.gender || '-')}</td>
            <td>${timeText}</td>
            <td>${hasTest}</td>
            <td>${score > 0 ? score : '-'}</td>
            <td>${grade}</td>
            <td>${improvementIcon} ${improvementStatus}</td>
            <td>${testDetailsBtn}</td>
            <td>${escapeHtml(student.lastActive || new Date().toLocaleDateString('ar-EG'))}</td>
        `;
        tbody.appendChild(tr);
    });
}

// =====================
// Pomodoro Timer
// =====================
const periodEl = document.getElementById("period");
const timeEl = document.getElementById("time");
const userTimeInput = document.getElementById("userTime");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const breakType = document.getElementById("breakType");

function initTimer() {
    if (!userTimeInput || !timeEl || !periodEl) return;
    const mins = parseInt(userTimeInput.value, 10) || 25;
    totalTime = mins * 60;
    updateDisplay();
    isBreak = false;
    periodEl.textContent = "وقت الدراسة";
}

function updateDisplay() {
    if (!timeEl || !userTimeInput) return;
    timeEl.textContent = formatTime(totalTime);
    const mins = parseInt(userTimeInput.value, 10) || 25;
    const half = mins * 30;
    const quarter = mins * 15;
    timeEl.classList.remove("timer__clock--safe", "timer__clock--mid", "timer__clock--urgent");
    if (totalTime > half) timeEl.classList.add("timer__clock--safe");
    else if (totalTime > quarter) timeEl.classList.add("timer__clock--mid");
    else timeEl.classList.add("timer__clock--urgent");
}

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function startTimer() {
    if (isRunning) clearInterval(timer);
    isRunning = true;
    timer = setInterval(updateTimer, 1000);
}

function pauseTimer() {
    clearInterval(timer);
    isRunning = false;
}

function resetTimer() {
    if (!userTimeInput || !periodEl) return;
    clearInterval(timer);
    isRunning = false;
    isBreak = false;
    totalTime = (parseInt(userTimeInput.value, 10) || 25) * 60;
    periodEl.textContent = "وقت الدراسة";
    updateDisplay();
}

function updateTimer() {
    if (!breakType || !periodEl || !userTimeInput || !timeEl) return;
    if (totalTime <= 0) {
        clearInterval(timer);
        isRunning = false;
        playBeep();
        if (!isBreak) {
            totalTime = breakType.value === "short" ? 5 * 60 : 15 * 60;
            isBreak = true;
            periodEl.textContent = breakType.value === "short" ? "استراحة قصيرة" : "استراحة طويلة";
            updateDisplay();
            startTimer();
        } else {
            showToast("انتهت الاستراحة. يمكنك بدء جلسة دراسة جديدة.", "success", 4500);
            isBreak = false;
            totalTime = (parseInt(userTimeInput.value, 10) || 25) * 60;
            periodEl.textContent = "وقت الدراسة";
            updateDisplay();
        }
        return;
    }
    totalTime--;
    updateDisplay();
}

if (startBtn) startBtn.addEventListener("click", startTimer);
if (pauseBtn) pauseBtn.addEventListener("click", pauseTimer);
if (resetBtn) resetBtn.addEventListener("click", resetTimer);
if (userTimeInput) {
    userTimeInput.addEventListener("change", () => {
        totalTime = (parseInt(userTimeInput.value, 10) || 25) * 60;
        updateDisplay();
    });
}

function tryRestoreStudentSession() {
    try {
        const raw = sessionStorage.getItem("currentStudent");
        if (!raw) return;
        const s = JSON.parse(raw);
        if (!s || !s.fullName || !s.grade || !s.className || !s.gender) return;
        currentStudent = s;
        const userSetup = document.getElementById("userSetup");
        if (userSetup) userSetup.style.display = "none";
        const welcome = document.getElementById("welcomeMsg");
        if (welcome) {
            welcome.style.display = "block";
            welcome.innerHTML = `<h2>مرحباً، ${escapeHtml(s.fullName)}</h2><p>يمكنك اختيار المادة من الأسفل.</p><p><button type="button" class="btn-logout" onclick="logoutStudent()">تسجيل خروج</button></p>`;
        }
        showSubjectsForStudents(s.grade, s.className, s.gender);
    } catch (e) { /* ignore */ }
}

// Function to capitalize first letter (fixed for Arabic)
function capitalizeFirstLetter(str) {
    // For Arabic names, return as-is to avoid corruption
    // Arabic letters should not be capitalized/lowercased
    return str.trim();
}

// ===== PREDEFINED STUDENTS WITH CLASS AND PASSWORD =====
// Only these students can access the platform with their specific class and password

// Function to get all predefined students
function getAllPredefinedStudents() {
    return [
        ...classAStudents,
        ...classBStudents,
        ...classCStudents,
        ...classDStudents,
        ...classEStudents,
        ...classFStudents,
        ...classGStudents,
        ...classHStudents,
        ...classIStudents,
        ...classAGirlsStudents,
        ...classBGirlsStudents,
        ...classCGirlsStudents,
        ...classDGirlsStudents,
        ...classEGirlsStudents,
        ...classFGirlsStudents,
        ...classGGirlsStudents,
        ...classHGirlsStudents,
        ...classIGirlsStudents,
        ...classJGirlsStudents,
        ...classKGirlsStudents,
        ...classAFirstBoys,
        ...classBFirstBoys,
        ...classCFirstBoys,
        ...classDFirstBoys,
        ...classEFirstBoys,
        ...classFFirstBoys,
        ...classGFirstBoys,
        ...classHFirstBoys,
        ...classAGirlsFirst,
        ...classBGirlsFirst,
        ...classCGirlsFirst,
        ...classDGirlsFirst,
        ...classEGirlsFirst,
        ...classFGirlsFirst,
        ...classHGirlsFirst
    ];
}

// Function to check if student is allowed and get their data
function getPredefinedStudent(studentName) {
    const allStudents = getAllPredefinedStudents();
    return allStudents.find(student => student.fullname === studentName);
}

// Open login for everyone
function validateStudentForm(fullName, grade, gender, className, password) {
    // Use name as-is for Arabic names
    const capitalizedName = fullName;
    console.log("Debug: Student login attempt:", capitalizedName);

    // Allow anyone to login without restrictions
    console.log("Debug: Login allowed for all!");
    return { valid: true, name: capitalizedName };
}

function initApp() {
    initTheme();
    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) themeToggle.addEventListener("click", toggleTheme);

    tryRestoreStudentSession();
    initTimer();
    setupOptions();
    const qt = document.getElementById("questionType");
    if (qt) qt.addEventListener("change", setupOptions);

    // Add image upload listener
    const imageInput = document.getElementById("questionImage");
    if (imageInput) imageInput.addEventListener("change", handleImageUpload);

    const setupForm = document.getElementById("setupForm");
    if (setupForm) {
        setupForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const fd = new FormData(setupForm);
            const username = (fd.get("username") || "").toString().trim();
            const password = (fd.get("password") || "").toString().trim();

            if (!username || !password) {
                showToast("يرجى ملء جميع الحقول المطلوبة", "error");
                return;
            }

            // Show loading state
            const submitBtn = setupForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span>جاري تسجيل الدخول...</span>';
            submitBtn.disabled = true;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    // Store user data
                    currentStudent = {
                        fullName: data.user.fullName,
                        username: data.user.username,
                        userId: data.user.id,
                        role: data.user.role,
                        loginTime: new Date().toISOString()
                    };

                    try {
                        sessionStorage.setItem("currentStudent", JSON.stringify(currentStudent));
                    } catch (e) {
                        console.log("Session storage error:", e);
                    }

                    // Hide user setup section
                    const userSetupEl = document.getElementById("userSetup");
                    if (userSetupEl) userSetupEl.style.display = "none";

                    // Show welcome message with logout button
                    const welcome = document.getElementById("welcomeMsg");
                    if (welcome) {
                        welcome.style.display = "block";
                        welcome.innerHTML = `
                            <h2 class="card__title" style="margin-bottom:0.5rem;">مرحباً بك ${data.user.fullName}!</h2>
                            <p class="card__subtitle">اختر المادة من الأسفل للبدء.</p>
                            <p><button type="button" class="btn btn--secondary" onclick="logoutStudent()">تسجيل خروج</button></p>
                            ${data.user.role === 'admin' ? '<p><a href="admin.html" class="btn btn--primary">لوحة التحكم</a></p>' : ''}
                        `;
                    }

                    showToast("تم تسجيل الدخول بنجاح", "success", 3500);

                    // Show subjects section
                    const subjectsSection = document.getElementById("subjects");
                    if (subjectsSection) subjectsSection.style.display = "block";

                } else {
                    // Show error message
                    const errorDiv = document.getElementById("loginError");
                    if (errorDiv) {
                        errorDiv.style.display = "block";
                        errorDiv.textContent = data.error || "فشل تسجيل الدخول";
                    }
                    showToast(data.error || "فشل تسجيل الدخول", "error");
                }
            } catch (error) {
                console.error("Login error:", error);
                showToast("حدث خطأ في الاتصال بالخادم", "error");
            } finally {
                // Reset button state
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }

    try {
        if (location.protocol === "file:" && !sessionStorage.getItem("fileProtocolWarned")) {
            sessionStorage.setItem("fileProtocolWarned", "1");
            showToast("لأفضل أداء (PDF وفيديو): من مجلد المشروع نفّذ npm start وافتح http://localhost:3000", "info", 9000);
        }
    } catch (e) { /* ignore */ }
}

window.addEventListener("load", initApp);

// =====================
// Advanced Analytics System
// =====================
class AnalyticsEngine {
    constructor() {
        this.charts = new Map();
        this.notifications = [];
        this.realtimeData = new Map();
    }

    // Initialize charts
    initCharts() {
        this.createStudyTimeChart();
        this.createProgressChart();
        this.createPerformanceChart();
    }

    // Create study time chart
    createStudyTimeChart() {
        const container = document.getElementById('studyTimeChart');
        if (!container) return;

        const data = this.getStudyTimeData();
        const chartHTML = this.generateBarChart(data, 'ساعات الدراسة الأسبوعية');
        container.innerHTML = chartHTML;
    }

    // Create progress chart
    createProgressChart() {
        const container = document.getElementById('progressChart');
        if (!container) return;

        const data = this.getProgressData();
        const chartHTML = this.generatePieChart(data, 'تقدم المواد');
        container.innerHTML = chartHTML;
    }

    // Create performance chart
    createPerformanceChart() {
        const container = document.getElementById('performanceChart');
        if (!container) return;

        const data = this.getPerformanceData();
        const chartHTML = this.generateLineChart(data, 'الأداء عبر الوقت');
        container.innerHTML = chartHTML;
    }

    // Generate bar chart
    generateBarChart(data, title) {
        const maxValue = Math.max(...data.map(item => item.value));
        const bars = data.map(item => `
            <div class="chart-bar" style="height: ${(item.value / maxValue) * 100}%; width: ${100 / data.length}%;">
                <div class="chart-bar__tooltip">${item.label}: ${item.value}</div>
            </div>
        `).join('');

        return `
            <div class="analytics-container">
                <h3>${title}</h3>
                <div class="chart-container">
                    <div class="chart-canvas" style="display: flex; align-items: flex-end; justify-content: space-around; padding: 1rem;">
                        ${bars}
                    </div>
                </div>
                <div class="chart-legend">
                    ${data.map(item => `
                        <div class="chart-legend__item">
                            <div class="chart-legend__color" style="background: ${item.color || 'var(--color-primary)'};"></div>
                            <span>${item.label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Generate pie chart
    generatePieChart(data, title) {
        const total = data.reduce((sum, item) => sum + item.value, 0);
        let currentAngle = 0;

        const segments = data.map(item => {
            const percentage = (item.value / total) * 100;
            const angle = (item.value / total) * 360;
            const segment = `
                <div class="pie-segment" style="
                    transform: rotate(${currentAngle}deg);
                    background: ${item.color || 'var(--color-primary)'};
                    width: ${percentage}%;
                    height: 100%;
                    position: absolute;
                    transform-origin: left center;
                ">
                    <div class="chart-bar__tooltip">${item.label}: ${item.value} (${percentage.toFixed(1)}%)</div>
                </div>
            `;
            currentAngle += angle;
            return segment;
        }).join('');

        return `
            <div class="analytics-container">
                <h3>${title}</h3>
                <div class="chart-container">
                    <div class="chart-canvas" style="position: relative; border-radius: 50%; overflow: hidden;">
                        ${segments}
                    </div>
                </div>
                <div class="chart-legend">
                    ${data.map(item => `
                        <div class="chart-legend__item">
                            <div class="chart-legend__color" style="background: ${item.color || 'var(--color-primary)'};"></div>
                            <span>${item.label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Generate line chart
    generateLineChart(data, title) {
        const maxValue = Math.max(...data.map(item => item.value));
        const points = data.map((item, index) => {
            const x = (index / (data.length - 1)) * 100;
            const y = 100 - ((item.value / maxValue) * 100);
            return `${x},${y}`;
        }).join(' ');

        return `
            <div class="analytics-container">
                <h3>${title}</h3>
                <div class="chart-container">
                    <div class="chart-canvas">
                        <svg width="100%" height="100%" viewBox="0 0 100 100">
                            <polyline
                                points="${points}"
                                fill="none"
                                stroke="var(--color-primary)"
                                stroke-width="2"
                            />
                            ${data.map((item, index) => {
            const x = (index / (data.length - 1)) * 100;
            const y = 100 - ((item.value / maxValue) * 100);
            return `
                                    <circle
                                        cx="${x}"
                                        cy="${y}"
                                        r="3"
                                        fill="var(--color-primary)"
                                        class="chart-point"
                                    >
                                        <title>${item.label}: ${item.value}</title>
                                    </circle>
                                `;
        }).join('')}
                        </svg>
                    </div>
                </div>
            </div>
        `;
    }

    // Get study time data
    getStudyTimeData() {
        const progress = getStudentProgress();
        const weekDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

        return weekDays.map((day, index) => ({
            label: day,
            value: Math.floor(Math.random() * 8) + 1, // Mock data
            color: `hsl(${index * 51}, 70%, 50%)`
        }));
    }

    // Get progress data
    getProgressData() {
        const subjects = ['تشريح', 'فيزيولوجيا', 'كيمياء حيوية', 'تمريض أساسي', 'صيدلة'];
        const colors = ['#0f4c75', '#d4a017', '#0d9488', '#dc2626', '#64748b'];

        return subjects.map((subject, index) => ({
            label: subject,
            value: Math.floor(Math.random() * 100) + 1, // Mock data
            color: colors[index % colors.length]
        }));
    }

    // Get performance data
    getPerformanceData() {
        const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'];

        return months.map((month, index) => ({
            label: month,
            value: Math.floor(Math.random() * 30) + 70, // Mock data between 70-100
            color: 'var(--color-primary)'
        }));
    }

    // Update charts with new data
    updateCharts() {
        this.initCharts();
    }

    // Export analytics data
    exportAnalytics() {
        const data = {
            studyTime: this.getStudyTimeData(),
            progress: this.getProgressData(),
            performance: this.getPerformanceData(),
            timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// =====================
// Real-time Notification System
// =====================
class NotificationManager {
    constructor() {
        this.container = null;
        this.notifications = [];
        this.init();
    }

    init() {
        // Create notification container
        this.container = document.createElement('div');
        this.container.className = 'notification-container';
        document.body.appendChild(this.container);

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    // Show notification
    show(title, message, type = 'info', duration = 5000) {
        const id = Date.now();
        const notification = {
            id,
            title,
            message,
            type,
            timestamp: Date.now()
        };

        // Add to DOM
        const notificationEl = this.createNotificationElement(notification);
        this.container.appendChild(notificationEl);

        // Add to array
        this.notifications.push(notification);

        // Auto remove
        setTimeout(() => {
            this.remove(id);
        }, duration);

        // Show browser notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: '/manifest.json',
                badge: '/manifest.json',
                tag: `nursing-platform-${type}`
            });
        }

        return id;
    }

    // Create notification element
    createNotificationElement(notification) {
        const el = document.createElement('div');
        el.className = `notification notification--${notification.type}`;
        el.innerHTML = `
            <button class="notification__close" onclick="notificationManager.remove(${notification.id})">×</button>
            <div class="notification__title">${notification.title}</div>
            <div class="notification__message">${notification.message}</div>
        `;
        return el;
    }

    // Remove notification
    remove(id) {
        const index = this.notifications.findIndex(n => n.id === id);
        if (index > -1) {
            this.notifications.splice(index, 1);
        }

        const el = this.container.querySelector(`.notification:nth-child(${index + 1})`);
        if (el) {
            el.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => {
                el.remove();
            }, 300);
        }
    }

    // Clear all notifications
    clear() {
        this.container.innerHTML = '';
        this.notifications = [];
    }

    // Show success notification
    success(title, message) {
        return this.show(title, message, 'success');
    }

    // Show warning notification
    warning(title, message) {
        return this.show(title, message, 'warning');
    }

    // Show error notification
    error(title, message) {
        return this.show(title, message, 'error');
    }
}

// =====================
// Advanced Admin Dashboard
// =====================
class AdminDashboard {
    constructor() {
        this.analytics = new AnalyticsEngine();
        this.notifications = new NotificationManager();
        this.init();
    }

    init() {
        this.setupRealTimeUpdates();
        this.createInsightsCards();
        this.setupActivityLog();
    }

    // Create insights cards
    createInsightsCards() {
        const container = document.getElementById('adminInsights');
        if (!container) return;

        const insights = [
            { label: 'إجمالي الطلاب', value: this.getTotalStudents(), icon: '👥' },
            { label: 'معدل الحضور', value: '87%', icon: '📊' },
            { label: 'اختبارات اليوم', value: this.getTodayTests(), icon: '📝' },
            { label: 'معدل الأداء', value: '82%', icon: '📈' }
        ];

        const insightsHTML = `
            <div class="admin-insights">
                ${insights.map(insight => `
                    <div class="insight-card">
                        <div class="insight-card__value">${insight.value}</div>
                        <div class="insight-card__label">${insight.icon} ${insight.label}</div>
                    </div>
                `).join('')}
            </div>
        `;

        container.innerHTML = insightsHTML;
        container.hidden = false;
    }

    // Setup activity log
    setupActivityLog() {
        const container = document.getElementById('adminActivityLog');
        if (!container) return;

        const activities = this.getRecentActivities();
        const logHTML = `
            <div class="admin-activity-log">
                <h4>النشاط الحديث</h4>
                ${activities.map(activity => `
                    <div class="activity-item">
                        <div class="activity-item__icon">${activity.icon}</div>
                        <div class="activity-item__content">${activity.description}</div>
                        <div class="activity-item__time">${activity.time}</div>
                    </div>
                `).join('')}
            </div>
        `;

        container.innerHTML = logHTML;
    }

    // Setup real-time updates
    setupRealTimeUpdates() {
        // Update every 30 seconds
        setInterval(() => {
            this.updateInsights();
            this.updateActivityLog();
        }, 30000);

        // Listen for real-time events
        this.setupEventListeners();
    }

    // Setup event listeners
    setupEventListeners() {
        // Listen for student login
        document.addEventListener('studentLogin', (event) => {
            this.notifications.success('طالب جديد', `لقد دخل ${event.detail.name} إلى المنصة`);
            this.addActivity('login', `${event.detail.name} دخل إلى المنصة`);
        });

        // Listen for test completion
        document.addEventListener('testCompleted', (event) => {
            this.notifications.success('اختبار مكتمل', `أكمل ${event.detail.name} اختبار ${event.detail.subject}`);
            this.addActivity('test', `${event.detail.name} أكمل اختبار ${event.detail.subject}`);
        });
    }

    // Add activity to log
    addActivity(type, description) {
        const activities = JSON.parse(localStorage.getItem('adminActivities') || '[]');
        activities.unshift({
            type,
            description,
            timestamp: Date.now(),
            icon: this.getActivityIcon(type)
        });

        // Keep only last 50 activities
        if (activities.length > 50) {
            activities.splice(50);
        }

        localStorage.setItem('adminActivities', JSON.stringify(activities));
        this.updateActivityLog();
    }

    // Get activity icon
    getActivityIcon(type) {
        const icons = {
            login: '🔑',
            test: '📝',
            upload: '📁',
            delete: '🗑️',
            edit: '✏️',
            view: '👁️'
        };
        return icons[type] || '📌';
    }

    // Get recent activities
    getRecentActivities() {
        const activities = JSON.parse(localStorage.getItem('adminActivities') || '[]');
        return activities.slice(0, 10).map(activity => ({
            ...activity,
            time: this.formatTime(activity.timestamp)
        }));
    }

    // Format time
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'الآن';
        if (diff < 3600000) return `منذ ${Math.floor(diff / 60000)} دقيقة`;
        if (diff < 86400000) return `منذ ${Math.floor(diff / 3600000)} ساعة`;
        return date.toLocaleDateString('ar-SA');
    }

    // Update insights
    updateInsights() {
        this.createInsightsCards();
    }

    // Update activity log
    updateActivityLog() {
        this.setupActivityLog();
    }

    // Get total students (mock data)
    getTotalStudents() {
        return Math.floor(Math.random() * 50) + 100;
    }

    // Get today tests (mock data)
    getTodayTests() {
        return Math.floor(Math.random() * 20) + 5;
    }
}

// Initialize advanced features
let analyticsEngine, adminDashboard;

// =====================
// Enhanced Progress Functions with Analytics
// =====================
function showAdvancedProgress() {
    if (!currentStudent) {
        showToast("يرجى تسجيل الدخول أولاً", "error");
        return;
    }

    hideAllSections();
    const progressSection = document.getElementById("progressSection");
    if (progressSection) {
        progressSection.style.display = "block";
        updateProgressData();

        // Initialize analytics
        if (!analyticsEngine) {
            analyticsEngine = new AnalyticsEngine();
        }
        analyticsEngine.initCharts();
    }
}

// =====================
// Performance Optimizations
// =====================
class PerformanceOptimizer {
    constructor() {
        this.init();
    }

    init() {
        this.setupLazyLoading();
        this.setupImageOptimization();
        this.setupCodeSplitting();
        this.setupCaching();
    }

    // Setup lazy loading
    setupLazyLoading() {
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    }

    // Setup image optimization
    setupImageOptimization() {
        // Add responsive images
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            if (!img.srcset && img.naturalWidth > 0) {
                const sizes = [320, 640, 960, 1280];
                const srcset = sizes.map(size => {
                    return `${img.src}?w=${size} ${size}w`;
                }).join(', ');
                img.srcset = srcset;
            }
        });
    }

    // Setup code splitting
    setupCodeSplitting() {
        // Dynamic imports for heavy features
        const loadAnalytics = () => import('./analytics.js').then(module => {
            return module.default;
        });

        const loadCharts = () => import('./charts.js').then(module => {
            return module.default;
        });

        // Load on demand
        window.loadAnalytics = loadAnalytics;
        window.loadCharts = loadCharts;
    }

    // Setup caching
    setupCaching() {
        // Cache API responses
        const cache = new Map();
        const originalFetch = window.fetch;

        window.fetch = async (url, options) => {
            const cacheKey = `${url}_${JSON.stringify(options)}`;

            if (cache.has(cacheKey)) {
                return cache.get(cacheKey);
            }

            const response = await originalFetch(url, options);

            // Cache successful responses
            if (response.ok) {
                cache.set(cacheKey, response.clone());

                // Limit cache size
                if (cache.size > 100) {
                    const firstKey = cache.keys().next().value;
                    cache.delete(firstKey);
                }
            }

            return response;
        };
    }
}

// Initialize performance optimizer
const performanceOptimizer = new PerformanceOptimizer();

// =====================
// Analytics Tab Functions
// =====================
function showAnalyticsTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.analytics-content').forEach(content => {
        content.classList.remove('active');
    });

    // Remove active class from all tabs
    document.querySelectorAll('.analytics-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab
    const selectedContent = document.getElementById(tabName + 'Chart');
    if (selectedContent) {
        selectedContent.classList.add('active');
    }

    // Add active class to clicked tab
    event.target.classList.add('active');

    // Initialize analytics if not already done
    if (!analyticsEngine) {
        analyticsEngine = new AnalyticsEngine();
    }

    // Update charts
    analyticsEngine.initCharts();
}

// Export analytics function
function exportAnalytics() {
    if (!analyticsEngine) {
        analyticsEngine = new AnalyticsEngine();
    }
    analyticsEngine.exportAnalytics();
}

// Enhanced progress function with analytics
function showProgress() {
    if (!currentStudent) {
        showToast("يرجى تسجيل الدخول أولاً", "error");
        return;
    }

    hideAllSections();
    const progressSection = document.getElementById("progressSection");
    if (progressSection) {
        progressSection.style.display = "block";
        updateProgressData();

        // Initialize analytics
        if (!analyticsEngine) {
            analyticsEngine = new AnalyticsEngine();
        }
        analyticsEngine.initCharts();

        // Show first tab by default
        showAnalyticsTab('studyTime');
    }
}

// Initialize notification manager
const notificationManager = new NotificationManager();

// =====================
// Accessibility Enhancements
// =====================
class AccessibilityManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupKeyboardNavigation();
        this.setupScreenReaderSupport();
        this.setupFocusManagement();
        this.setupAriaLiveRegions();
        this.setupHighContrastMode();
        this.setupReducedMotion();
    }

    // Setup keyboard navigation
    setupKeyboardNavigation() {
        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Alt + S: Skip to main content
            if (e.altKey && e.key === 's') {
                e.preventDefault();
                const mainContent = document.getElementById('main-content');
                if (mainContent) {
                    mainContent.focus();
                    mainContent.scrollIntoView();
                }
            }

            // Alt + T: Go to timer
            if (e.altKey && e.key === 't') {
                e.preventDefault();
                const timerSection = document.getElementById('timerSection');
                if (timerSection) {
                    timerSection.focus();
                    timerSection.scrollIntoView();
                }
            }

            // Alt + P: Go to progress
            if (e.altKey && e.key === 'p') {
                e.preventDefault();
                showProgress();
            }

            // Escape: Close modals and overlays
            if (e.key === 'Escape') {
                this.closeAllOverlays();
            }
        });

        // Add focus indicators for interactive elements
        const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
        interactiveElements.forEach(element => {
            element.addEventListener('focus', () => {
                element.classList.add('focus-visible');
            });

            element.addEventListener('blur', () => {
                element.classList.remove('focus-visible');
            });
        });
    }

    // Setup screen reader support
    setupScreenReaderSupport() {
        // Add aria-labels to icons
        const icons = document.querySelectorAll('[aria-hidden="true"]');
        icons.forEach(icon => {
            if (!icon.getAttribute('aria-label') && !icon.getAttribute('aria-labelledby')) {
                const text = icon.textContent || icon.alt || '';
                if (text) {
                    icon.setAttribute('aria-label', text.trim());
                    icon.removeAttribute('aria-hidden');
                }
            }
        });

        // Add role to main landmarks
        const main = document.querySelector('main');
        if (main && !main.getAttribute('role')) {
            main.setAttribute('role', 'main');
        }

        const header = document.querySelector('header');
        if (header && !header.getAttribute('role')) {
            header.setAttribute('role', 'banner');
        }

        const footer = document.querySelector('footer');
        if (footer && !footer.getAttribute('role')) {
            footer.setAttribute('role', 'contentinfo');
        }

        const nav = document.querySelector('nav');
        if (nav && !nav.getAttribute('role')) {
            nav.setAttribute('role', 'navigation');
            nav.setAttribute('aria-label', 'التنقل الرئيسي');
        }
    }

    // Setup focus management
    setupFocusManagement() {
        // Trap focus in modals
        const modals = document.querySelectorAll('[role="dialog"]');
        modals.forEach(modal => {
            modal.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    const focusableElements = modal.querySelectorAll(
                        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                    );
                    const firstElement = focusableElements[0];
                    const lastElement = focusableElements[focusableElements.length - 1];

                    if (e.shiftKey) {
                        if (document.activeElement === firstElement) {
                            e.preventDefault();
                            lastElement.focus();
                        }
                    } else {
                        if (document.activeElement === lastElement) {
                            e.preventDefault();
                            firstElement.focus();
                        }
                    }
                }
            });
        });
    }

    // Setup aria-live regions
    setupAriaLiveRegions() {
        // Create live regions for dynamic content
        const liveRegions = [
            { id: 'status-live', politeness: 'polite' },
            { id: 'alert-live', politeness: 'assertive' },
            { id: 'timer-live', politeness: 'polite' }
        ];

        liveRegions.forEach(region => {
            if (!document.getElementById(region.id)) {
                const div = document.createElement('div');
                div.id = region.id;
                div.setAttribute('aria-live', region.politeness);
                div.setAttribute('aria-atomic', 'true');
                div.className = 'sr-only';
                document.body.appendChild(div);
            }
        });
    }

    // Setup high contrast mode detection
    setupHighContrastMode() {
        const mediaQuery = window.matchMedia('(prefers-contrast: high)');

        const handleHighContrast = (e) => {
            if (e.matches) {
                document.body.classList.add('high-contrast');
                this.announce('تم تفعيل وضع التباين العالي');
            } else {
                document.body.classList.remove('high-contrast');
                this.announce('تم إلغاء وضع التباين العالي');
            }
        };

        mediaQuery.addEventListener('change', handleHighContrast);
        handleHighContrast(mediaQuery);
    }

    // Setup reduced motion detection
    setupReducedMotion() {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

        const handleReducedMotion = (e) => {
            if (e.matches) {
                document.body.classList.add('reduced-motion');
                // Disable animations
                const style = document.createElement('style');
                style.textContent = `
                    *, *::before, *::after {
                        animation-duration: 0.01ms !important;
                        animation-iteration-count: 1 !important;
                        transition-duration: 0.01ms !important;
                        scroll-behavior: auto !important;
                    }
                `;
                document.head.appendChild(style);
            }
        };

        mediaQuery.addEventListener('change', handleReducedMotion);
        handleReducedMotion(mediaQuery);
    }

    // Close all overlays
    closeAllOverlays() {
        const overlays = document.querySelectorAll('.modal, .dialog, .install-prompt');
        overlays.forEach(overlay => {
            overlay.style.display = 'none';
        });

        // Restore focus to previous element
        const previousFocus = document.querySelector('[data-previous-focus]');
        if (previousFocus) {
            previousFocus.focus();
            previousFocus.removeAttribute('data-previous-focus');
        }
    }

    // Announce to screen readers
    announce(message, priority = 'polite') {
        const liveRegion = document.getElementById(`${priority}-live`);
        if (liveRegion) {
            liveRegion.textContent = message;
            setTimeout(() => {
                liveRegion.textContent = '';
            }, 1000);
        }
    }

    // Update progress for screen readers
    announceProgress(current, total, item) {
        const percentage = Math.round((current / total) * 100);
        this.announce(`${item}: ${current} من ${total} (${percentage}%)`);
    }

    // Setup form validation announcements
    setupFormValidation() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.addEventListener('submit', (e) => {
                const invalidFields = form.querySelectorAll(':invalid');
                if (invalidFields.length > 0) {
                    e.preventDefault();
                    const firstInvalid = invalidFields[0];
                    firstInvalid.focus();
                    this.announce(`خطأ في النموذج: ${firstInvalid.validationMessage}`, 'assertive');
                }
            });
        });
    }

    // Add skip links for better navigation
    addSkipLinks() {
        const skipLinks = [
            { href: '#main-content', text: 'تخطي إلى المحتوى الرئيسي' },
            { href: '#timerSection', text: 'اذهب إلى المؤقت' },
            { href: '#subjects', text: 'اذهب إلى المواد' }
        ];

        skipLinks.forEach(link => {
            if (!document.querySelector(`a[href="${link.href}"]`)) {
                const a = document.createElement('a');
                a.href = link.href;
                a.textContent = link.text;
                a.className = 'skip-link';
                document.body.insertBefore(a, document.body.firstChild);
            }
        });
    }
}

// Initialize accessibility manager
const accessibilityManager = new AccessibilityManager();

// =====================
// Advanced Student Management System
// =====================
class StudentManager {
    constructor() {
        this.students = [];
        this.filteredStudents = [];
        this.currentPage = 1;
        this.studentsPerPage = 10;
        this.sortColumn = 'name';
        this.sortDirection = 'asc';
        this.filters = {
            search: '',
            grade: '',
            class: '',
            performance: ''
        };
        this.init();
    }

    init() {
        this.generateMockStudents();
        this.loadStudentsTable();
        this.updateSummary();
    }

    // Generate mock student data
    generateMockStudents() {
        const firstNames = ['أحمد', 'محمد', 'عبدالله', 'عمر', 'علي', 'حسن', 'سعيد', 'خالد', 'ياسر', 'مؤنس'];
        const lastNames = ['السعيد', 'محمد', 'أحمد', 'عبدالله', 'عمر', 'حسن', 'علي', 'خالد', 'ياسر', 'مؤنس'];
        const grades = ['first', 'second'];
        const classes = ['A', 'B', 'C'];

        for (let i = 0; i < 45; i++) {
            const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
            const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
            const grade = grades[Math.floor(Math.random() * grades.length)];
            const className = classes[Math.floor(Math.random() * classes.length)];
            const score = Math.floor(Math.random() * 40) + 60; // 60-100
            const studyTime = Math.floor(Math.random() * 120) + 30; // 30-150 minutes
            const lastActive = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
            const progress = Math.floor(Math.random() * 100);

            this.students.push({
                id: i + 1,
                name: `${firstName} ${lastName}`,
                grade: grade,
                gradeText: grade === 'first' ? 'الأول' : 'الثاني',
                className: className,
                score: score,
                studyTime: studyTime,
                lastActive: lastActive,
                progress: progress,
                status: Math.random() > 0.3 ? 'active' : 'inactive',
                phone: `05${Math.floor(Math.random() * 90000000) + 10000000}`,
                attendance: Math.floor(Math.random() * 20) + 10, // 10-30 days
                completedSubjects: Math.floor(Math.random() * 5) + 1
            });
        }

        this.filteredStudents = [...this.students];
    }

    // Load students table
    loadStudentsTable() {
        this.applyFilters();
        this.sortStudents();
        this.renderTable();
        this.updatePagination();
    }

    // Apply filters
    applyFilters() {
        this.filteredStudents = this.students.filter(student => {
            // Search filter
            if (this.filters.search && !student.name.toLowerCase().includes(this.filters.search.toLowerCase())) {
                return false;
            }

            // Grade filter
            if (this.filters.grade && student.grade !== this.filters.grade) {
                return false;
            }

            // Class filter
            if (this.filters.class && student.className !== this.filters.class) {
                return false;
            }

            // Performance filter
            if (this.filters.performance) {
                const score = student.score;
                switch (this.filters.performance) {
                    case 'excellent':
                        if (score < 90) return false;
                        break;
                    case 'good':
                        if (score < 75 || score >= 90) return false;
                        break;
                    case 'average':
                        if (score < 60 || score >= 75) return false;
                        break;
                    case 'poor':
                        if (score >= 60) return false;
                        break;
                }
            }

            return true;
        });
    }

    // Sort students
    sortStudents() {
        this.filteredStudents.sort((a, b) => {
            let aVal = a[this.sortColumn];
            let bVal = b[this.sortColumn];

            if (this.sortColumn === 'lastActive') {
                aVal = aVal.getTime();
                bVal = bVal.getTime();
            }

            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (this.sortDirection === 'asc') {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            } else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
            }
        });
    }

    // Render table
    renderTable() {
        const tbody = document.getElementById('studentsBody');
        if (!tbody) return;

        const startIndex = (this.currentPage - 1) * this.studentsPerPage;
        const endIndex = startIndex + this.studentsPerPage;
        const pageStudents = this.filteredStudents.slice(startIndex, endIndex);

        tbody.innerHTML = pageStudents.map(student => this.createStudentRow(student)).join('');
    }

    // Create student row
    createStudentRow(student) {
        const performanceClass = this.getPerformanceClass(student.score);
        const statusClass = student.status === 'active' ? 'student-status--active' : 'student-status--inactive';
        const lastActiveText = this.formatLastActive(student.lastActive);

        return `
            <tr>
                <td>
                    <div class="student-name-cell">
                        <div class="student-avatar-small">${student.name.charAt(0)}</div>
                        <div>
                            <div class="student-name">${student.name}</div>
                        </div>
                    </div>
                </td>
                <td>${student.gradeText}</td>
                <td>فصل ${student.className}</td>
                <td>
                    <div class="score-cell">
                        <span class="performance-badge ${performanceClass}">${student.score}%</span>
                    </div>
                </td>
                <td>
                    <div class="study-time-cell">
                        <div>${Math.floor(student.studyTime / 60)}h ${student.studyTime % 60}m</div>
                        <div class="table-progress-bar">
                            <div class="table-progress-fill" style="width: ${Math.min((student.studyTime / 150) * 100, 100)}%"></div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="last-active-cell">
                        <div class="student-status ${statusClass}">${lastActiveText}</div>
                    </div>
                </td>
                <td>
                    <div class="progress-cell">
                        <div class="table-progress-bar">
                            <div class="table-progress-fill" style="width: ${student.progress}%"></div>
                        </div>
                        <div class="progress-text">${student.progress}%</div>
                    </div>
                </td>
                <td>
                    <div class="table-actions">
                        <button class="table-action-btn table-action-btn--primary" onclick="viewStudentDetails(${student.id})">
                            عرض
                        </button>
                        <button class="table-action-btn" onclick="editStudent(${student.id})">
                            تعديل
                        </button>
                        <button class="table-action-btn" onclick="messageStudent(${student.id})">
                            رسالة
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    // Get performance class
    getPerformanceClass(score) {
        if (score >= 90) return 'performance-badge--excellent';
        if (score >= 75) return 'performance-badge--good';
        if (score >= 60) return 'performance-badge--average';
        return 'performance-badge--poor';
    }

    // Format last active
    formatLastActive(date) {
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'اليوم';
        if (days === 1) return 'أمس';
        if (days < 7) return `منذ ${days} أيام`;
        if (days < 30) return `منذ ${Math.floor(days / 7)} أسابيع`;
        return date.toLocaleDateString('ar-SA');
    }

    // Update pagination
    updatePagination() {
        const totalPages = Math.ceil(this.filteredStudents.length / this.studentsPerPage);
        const startIndex = (this.currentPage - 1) * this.studentsPerPage + 1;
        const endIndex = Math.min(this.currentPage * this.studentsPerPage, this.filteredStudents.length);

        document.getElementById('showingFrom').textContent = this.filteredStudents.length > 0 ? startIndex : 0;
        document.getElementById('showingTo').textContent = endIndex;
        document.getElementById('totalRecords').textContent = this.filteredStudents.length;

        // Update pagination buttons
        document.getElementById('prevBtn').disabled = this.currentPage === 1;
        document.getElementById('nextBtn').disabled = this.currentPage === totalPages;

        // Update page numbers
        const pageNumbers = document.getElementById('pageNumbers');
        pageNumbers.innerHTML = '';

        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `page-number ${i === this.currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.onclick = () => this.goToPage(i);
            pageNumbers.appendChild(pageBtn);
        }
    }

    // Go to page
    goToPage(page) {
        this.currentPage = page;
        this.renderTable();
        this.updatePagination();
    }

    // Update summary
    updateSummary() {
        const totalStudents = this.students.length;
        const activeToday = this.students.filter(s => {
            const today = new Date();
            const studentDate = new Date(s.lastActive);
            return studentDate.toDateString() === today.toDateString();
        }).length;
        const averageScore = Math.round(this.students.reduce((sum, s) => sum + s.score, 0) / totalStudents);
        const completionRate = Math.round(this.students.reduce((sum, s) => sum + s.progress, 0) / totalStudents);

        document.getElementById('totalStudentsCount').textContent = totalStudents;
        document.getElementById('activeStudentsCount').textContent = activeToday;
        document.getElementById('averageScore').textContent = averageScore + '%';
        document.getElementById('completionRate').textContent = completionRate + '%';
    }

    // View student details
    viewStudentDetails(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (!student) return;

        const modal = document.getElementById('studentModal');
        const modalBody = document.getElementById('studentModalBody');

        modalBody.innerHTML = `
            <div class="student-profile">
                <div class="student-profile-header">
                    <div class="student-avatar">${student.name.charAt(0)}</div>
                    <div class="student-info">
                        <h4>${student.name}</h4>
                        <p>الصف ${student.gradeText} - فصل ${student.className}</p>
                    </div>
                </div>

                <div class="student-stats-grid">
                    <div class="student-stat-card">
                        <div class="student-stat-value">${student.score}%</div>
                        <div class="student-stat-label">الدرجة</div>
                    </div>
                    <div class="student-stat-card">
                        <div class="student-stat-value">${student.completedSubjects}</div>
                        <div class="student-stat-label">مواد مكتملة</div>
                    </div>
                    <div class="student-stat-card">
                        <div class="student-stat-value">${student.attendance}</div>
                        <div class="student-stat-label">أيام الحضور</div>
                    </div>
                    <div class="student-stat-card">
                        <div class="student-stat-value">${Math.floor(student.studyTime / 60)}h</div>
                        <div class="student-stat-label">وقت الدراسة</div>
                    </div>
                </div>

                <div class="student-details-section">
                    <h5>معلومات الاتصال</h5>
                    <p><strong>رقم الهاتف:</strong> ${student.phone}</p>
                </div>

                <div class="student-details-section">
                    <h5>الأداء الأكاديمي</h5>
                    <div class="performance-details">
                        <div class="performance-item">
                            <span>متوسط الدرجات:</span>
                            <span class="performance-badge ${this.getPerformanceClass(student.score)}">${student.score}%</span>
                        </div>
                        <div class="performance-item">
                            <span>معدل التقدم:</span>
                            <div class="table-progress-bar" style="width: 100px;">
                                <div class="table-progress-fill" style="width: ${student.progress}%"></div>
                            </div>
                            <span>${student.progress}%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }

    // Edit student (placeholder)
    editStudent(studentId) {
        showToast(`تعديل بيانات الطالب رقم ${studentId}`, 'info');
    }

    // Message student (placeholder)
    messageStudent(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (student) {
            showToast(`إرسال رسالة إلى ${student.name}`, 'info');
        }
    }
}

// Initialize student manager
let studentManager;

// =====================
// Table Functions
// =====================
function loadStudentsTable() {
    if (!studentManager) {
        studentManager = new StudentManager();
    } else {
        studentManager.loadStudentsTable();
    }
}

function filterStudents() {
    if (!studentManager) {
        studentManager = new StudentManager();
    }

    studentManager.filters.search = document.getElementById('studentSearch').value;
    studentManager.filters.grade = document.getElementById('gradeFilter').value;
    studentManager.filters.class = document.getElementById('classFilter').value;
    studentManager.filters.performance = document.getElementById('performanceFilter').value;

    studentManager.currentPage = 1;
    studentManager.loadStudentsTable();
}

function sortTable(column) {
    if (!studentManager) return;

    if (studentManager.sortColumn === column) {
        studentManager.sortDirection = studentManager.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        studentManager.sortColumn = column;
        studentManager.sortDirection = 'asc';
    }

    studentManager.loadStudentsTable();

    // Update sort icons
    document.querySelectorAll('.sort-icon').forEach(icon => {
        icon.className = 'sort-icon';
    });

    const currentIcon = event.target.querySelector('.sort-icon');
    if (currentIcon) {
        currentIcon.className = `sort-icon ${studentManager.sortDirection}`;
    }
}

function previousPage() {
    if (!studentManager) return;
    if (studentManager.currentPage > 1) {
        studentManager.goToPage(studentManager.currentPage - 1);
    }
}

function nextPage() {
    if (!studentManager) return;
    const totalPages = Math.ceil(studentManager.filteredStudents.length / studentManager.studentsPerPage);
    if (studentManager.currentPage < totalPages) {
        studentManager.goToPage(studentManager.currentPage + 1);
    }
}

function closeStudentModal() {
    document.getElementById('studentModal').style.display = 'none';
}

function viewStudentDetails(studentId) {
    if (!studentManager) {
        studentManager = new StudentManager();
    }
    studentManager.viewStudentDetails(studentId);
}

function editStudent(studentId) {
    if (!studentManager) {
        studentManager = new StudentManager();
    }
    studentManager.editStudent(studentId);
}

function messageStudent(studentId) {
    if (!studentManager) {
        studentManager = new StudentManager();
    }
    studentManager.messageStudent(studentId);
}

function exportStudentsData() {
    if (!currentMaterial) {
        showToast('يرجى اختيار مادة أولاً', 'error');
        return;
    }

    // Get students who entered current material only
    let allStudents = JSON.parse(localStorage.getItem("students")) || [];
    let testResults = JSON.parse(localStorage.getItem("testResults")) || [];

    // Filter ONLY students who entered current material
    let currentMaterialStudents = allStudents.filter(student =>
        student.material === currentMaterial.name
    );

    const data = currentMaterialStudents.map(student => {
        // Find all test results for this student in current material
        let studentTestResults = testResults.filter(r =>
            r.studentName === student.name && r.material === currentMaterial.name
        );

        // Get latest test result
        let latestTest = studentTestResults[studentTestResults.length - 1];
        let score = latestTest ? latestTest.score : 0;

        // Calculate actual grade based on score
        let grade = "";
        if (score >= 90) grade = "ممتاز";
        else if (score >= 80) grade = "جيد جداً";
        else if (score >= 70) grade = "جيد";
        else if (score >= 60) grade = "متوسط";
        else if (score >= 50) grade = "ضعيف";
        else if (score > 0) grade = "مقبول";
        else grade = "-";

        // Calculate improvement status
        let improvementStatus = "-";
        if (studentTestResults.length > 1) {
            let previousScore = studentTestResults[studentTestResults.length - 2].score;
            let currentScore = score;
            if (currentScore > previousScore) {
                improvementStatus = "تحسن 📈";
            } else if (currentScore < previousScore) {
                improvementStatus = "تراجع 📉";
            } else {
                improvementStatus = "ثابت ➡️";
            }
        }

        // Format study time
        let studyTime = student.studyTime || 0;
        let hours = Math.floor(studyTime / 3600);
        let minutes = Math.floor((studyTime % 3600) / 60);
        let timeText = hours > 0 ? `${hours}س ${minutes}د` : `${minutes}د`;

        return {
            'اسم الطالب': student.name,
            'الصف': student.grade === 'first' ? 'الأول' : 'الثاني',
            'Class': student.className,
            'النوع': student.gender || '-',
            'وقت الدراسة': timeText,
            'أدى الاختبار': latestTest ? 'نعم' : 'لا',
            'الدرجة': score > 0 ? score : '-',
            'التقدير': grade,
            'تحسن المستوى': improvementStatus,
            'آخر نشاط': student.lastActive || new Date().toLocaleDateString('ar-EG')
        };
    });

    if (data.length === 0) {
        showToast('لا يوجد طلاب في هذه المادة للتصدير', 'error');
        return;
    }

    const csv = [
        Object.keys(data[0]).join(','),
        ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `طلاب_${currentMaterial.name}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast(`تم تصدير ${data.length} طالب بنجاح`, 'success');
}

// Add CSS for student table
const studentTableStyles = `
    <style>
    .student-name-cell {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .student-avatar-small {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: 0.8rem;
    }

    .student-name {
        font-weight: 600;
        color: var(--color-text);
    }

    .score-cell, .study-time-cell, .last-active-cell, .progress-cell {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .progress-text {
        font-size: 0.8rem;
        color: var(--color-text-muted);
        text-align: center;
    }

    .performance-details {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .performance-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .student-details-section {
        margin-top: 1.5rem;
        padding-top: 1rem;
        border-top: 1px solid var(--color-border);
    }

    .student-details-section h5 {
        margin: 0 0 0.75rem 0;
        color: var(--color-text);
        font-weight: 600;
    }

    .student-details-section p {
        margin: 0.25rem 0;
        color: var(--color-text-muted);
    }
    </style>
`;

document.head.insertAdjacentHTML('beforeend', studentTableStyles);

function updateProgressData() {
    const progress = getStudentProgress();

    // Update study time
    const studyHours = Math.floor(progress.totalStudyTime / 3600);
    const studyMinutes = Math.floor((progress.totalStudyTime % 3600) / 60);
    document.getElementById("totalStudyTime").textContent = `${studyHours} ساعة ${studyMinutes} دقيقة`;
    document.getElementById("studyTimeBar").style.width = `${Math.min((progress.totalStudyTime / 36000) * 100, 100)}%`;

    // Update completed subjects
    const totalSubjects = getTotalSubjects();
    document.getElementById("completedSubjects").textContent = `${progress.completedSubjects} / ${totalSubjects}`;
    document.getElementById("subjectsBar").style.width = `${totalSubjects > 0 ? (progress.completedSubjects / totalSubjects) * 100 : 0}%`;

    // Update average score
    document.getElementById("averageScore").textContent = `${progress.averageScore}%`;
    document.getElementById("scoreBar").style.width = `${progress.averageScore}%`;

    // Update streak days
    document.getElementById("streakDays").textContent = `${progress.streakDays} يوم`;
    document.getElementById("streakBar").style.width = `${Math.min((progress.streakDays / 30) * 100, 100)}%`;
}

function getStudentProgress() {
    const key = `progress_${currentStudent.fullname}_${currentStudent.gradeKey}_${currentStudent.className}`;
    const saved = localStorage.getItem(key);

    if (saved) {
        return JSON.parse(saved);
    }

    return {
        totalStudyTime: 0,
        completedSubjects: 0,
        averageScore: 0,
        streakDays: 0,
        lastStudyDate: null,
        testScores: []
    };
}

function saveProgress(data) {
    const key = `progress_${currentStudent.fullname}_${currentStudent.gradeKey}_${currentStudent.className}`;
    localStorage.setItem(key, JSON.stringify(data));
}

function recordStudySession(seconds) {
    if (!currentStudent) return;

    const progress = getStudentProgress();
    progress.totalStudyTime += seconds;

    // Update streak
    const today = new Date().toDateString();
    if (progress.lastStudyDate !== today) {
        const lastDate = progress.lastStudyDate ? new Date(progress.lastStudyDate) : null;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (!lastDate || lastDate.toDateString() === yesterday.toDateString()) {
            progress.streakDays++;
        } else if (lastDate.toDateString() !== today) {
            progress.streakDays = 1;
        }

        progress.lastStudyDate = today;
    }

    saveProgress(progress);
}

function recordTestScore(score, totalQuestions) {
    if (!currentStudent) return;

    const progress = getStudentProgress();
    const percentage = Math.round((score / totalQuestions) * 100);
    progress.testScores.push({
        score: percentage,
        date: new Date().toISOString(),
        subject: currentMaterial
    });

    // Update average
    if (progress.testScores.length > 0) {
        const sum = progress.testScores.reduce((acc, test) => acc + test.score, 0);
        progress.averageScore = Math.round(sum / progress.testScores.length);
    }

    saveProgress(progress);
}

function markSubjectCompleted(subjectName) {
    if (!currentStudent) return;

    const progress = getStudentProgress();
    const completedKey = `completed_${subjectName}`;

    if (!progress[completedKey]) {
        progress[completedKey] = true;
        progress.completedSubjects++;
        saveProgress(progress);
    }
}

function getTotalSubjects() {
    const subjects = getSubjectsForGrade(currentStudent.gradeKey, currentStudent.className, currentStudent.gender);
    return subjects.length;
}

function exportProgress() {
    if (!currentStudent) {
        showToast("يرجى تسجيل الدخول أولاً", "error");
        return;
    }

    const progress = getStudentProgress();
    const report = `
تقرير تقدم الطالب: ${currentStudent.fullname}
الصف: ${currentStudent.gradeKey === 'first' ? 'الأول' : 'الثاني'}
الفصل: ${currentStudent.className}

إجمالي وقت الدراسة: ${Math.floor(progress.totalStudyTime / 3600)} ساعة ${Math.floor((progress.totalStudyTime % 3600) / 60)} دقيقة
المواد المكتملة: ${progress.completedSubjects} / ${getTotalSubjects()}
متوسط الدرجات: ${progress.averageScore}%
أيام المتابعة: ${progress.streakDays} يوم

آخر دراسة: ${progress.lastStudyDate || 'لم يسجل بعد'}
عدد الاختبارات: ${progress.testScores.length}
`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_${currentStudent.fullname}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    showToast("تم تصدير التقرير بنجاح", "success");
}

function resetProgress() {
    if (!currentStudent) {
        showToast("يرجى تسجيل الدخول أولاً", "error");
        return;
    }

    if (confirm("هل أنت متأكد من إعادة تعيين جميع بيانات التقدم؟ لا يمكن التراجع عن هذا الإجراء.")) {
        const key = `progress_${currentStudent.fullname}_${currentStudent.gradeKey}_${currentStudent.className}`;
        localStorage.removeItem(key);
        updateProgressData();
        showToast("تم إعادة تعيين بيانات التقدم", "success");
    }
}

function hideAllSections() {
    const sections = ["userSetup", "welcomeMsg", "subjects", "materialPage", "progressSection", "adminLoginSection", "adminPanel"];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });
}

// =====================
// منع الخروج أثناء الامتحان
// =====================
window.onbeforeunload = function () { if (examActive) return "لا يمكنك الخروج أثناء الامتحان!"; }