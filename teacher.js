let currentTeacher = null;
let teacherSubjects = [];

// Check authentication and load teacher data
async function checkAuth() {
    try {
        const response = await fetch('/api/user');
        if (!response.ok) {
            window.location.href = 'SS.html';
            return;
        }
        const user = await response.json();
        if (user.role !== 'teacher') {
            alert('غير مصرح لك بالوصول إلى هذه الصفحة');
            window.location.href = 'SS.html';
            return;
        }
        currentTeacher = user;
        teacherSubjects = user.subjects || [];
        document.getElementById('teacherName').textContent = user.fullName;
        loadDashboardStats();
        loadMySubjects();
        loadSubjectSelects();
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = 'SS.html';
    }
}

// Show section
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from all nav buttons
    document.querySelectorAll('.admin-nav button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).classList.add('active');
    
    // Add active class to clicked button
    event.target.classList.add('active');
    
    // Load data based on section
    if (sectionId === 'dashboard') {
        loadDashboardStats();
    }
    if (sectionId === 'students') {
        loadStudents();
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const [subjectsResponse, studentsResponse] = await Promise.all([
            fetch('/api/teacher/subjects'),
            fetch('/api/teacher/students')
        ]);
        
        const subjects = await subjectsResponse.json();
        const students = await studentsResponse.json();
        
        document.getElementById('totalSubjects').textContent = subjects.subjects.length;
        document.getElementById('totalStudents').textContent = students.students.length;
        document.getElementById('totalContent').textContent = calculateTotalContent();
    } catch (error) {
        console.error('Load dashboard stats error:', error);
    }
}

function calculateTotalContent() {
    let total = 0;
    teacherSubjects.forEach(subject => {
        total += (JSON.parse(localStorage.getItem(subject + '_summaries')) || []).length;
        total += (JSON.parse(localStorage.getItem(subject + '_videos')) || []).length;
        total += (JSON.parse(localStorage.getItem(subject + '_pdfs')) || []).length;
        total += (JSON.parse(localStorage.getItem(subject + '_voices')) || []).length;
    });
    return total;
}

// Load teacher's subjects
async function loadMySubjects() {
    try {
        const response = await fetch('/api/teacher/subjects');
        if (response.ok) {
            const data = await response.json();
            renderSubjects(data.subjects);
        }
    } catch (error) {
        console.error('Load subjects error:', error);
    }
}

function renderSubjects(subjects) {
    const container = document.getElementById('subjectsList');
    if (!subjects || subjects.length === 0) {
        container.innerHTML = '<p>لا توجد مواد مسندة إليك</p>';
        return;
    }

    container.innerHTML = subjects.map(subject => `
        <div class="subject-card" style="background-color: ${subject.color}20; border-right: 4px solid ${subject.color}">
            <h3>${escapeHtml(subject.name)}</h3>
            <p>الصف: ${getGradeName(subject.grade)}</p>
            <p>المحتوى: ${calculateSubjectContent(subject.name)}</p>
        </div>
    `).join('');
}

function calculateSubjectContent(subjectName) {
    const summaries = (JSON.parse(localStorage.getItem(subjectName + '_summaries')) || []).length;
    const videos = (JSON.parse(localStorage.getItem(subjectName + '_videos')) || []).length;
    const pdfs = (JSON.parse(localStorage.getItem(subjectName + '_pdfs')) || []).length;
    const voices = (JSON.parse(localStorage.getItem(subjectName + '_voices')) || []).length;
    return `${summaries} ملخصات, ${videos} فيديوهات, ${pdfs} PDFs, ${voices} صوتيات`;
}

function getGradeName(grade) {
    const grades = {
        'first': 'الصف الأول',
        'second': 'الصف الثاني',
        'third': 'الصف الثالث'
    };
    return grades[grade] || grade;
}

// Load subject selects
function loadSubjectSelects() {
    const selects = ['contentSubject', 'studentSubject'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">اختر المادة</option>';
            teacherSubjects.forEach(subject => {
                select.innerHTML += `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`;
            });
        }
    });
}

// Handle content type change
document.getElementById('contentType').addEventListener('change', function() {
    const type = this.value;
    document.getElementById('textContentGroup').style.display = type === 'summary' ? 'block' : 'none';
    document.getElementById('fileContentGroup').style.display = type !== 'summary' ? 'block' : 'none';
});

// Add content
async function addContent() {
    const subject = document.getElementById('contentSubject').value;
    const type = document.getElementById('contentType').value;
    const title = document.getElementById('contentTitle').value;
    
    if (!subject || !type || !title) {
        alert('يرجى ملء جميع الحقول المطلوبة');
        return;
    }

    try {
        let content;
        if (type === 'summary') {
            const text = document.getElementById('textContent').value;
            if (!text) {
                alert('يرجى إدخال المحتوى');
                return;
            }
            content = {
                title,
                content: text,
                type: 'summary',
                createdAt: new Date().toISOString()
            };
            const key = subject + '_summaries';
            let arr = JSON.parse(localStorage.getItem(key)) || [];
            arr.push(content);
            localStorage.setItem(key, JSON.stringify(arr));
        } else {
            const file = document.getElementById('contentFile').files[0];
            if (!file) {
                alert('يرجى اختيار ملف');
                return;
            }
            const dataUrl = await fileToDataUrl(file);
            const key = subject + '_' + type + 's';
            let list = JSON.parse(localStorage.getItem(key)) || [];
            list.push({ name: file.name, url: dataUrl, title, type, mime: file.type || "" });
            localStorage.setItem(key, JSON.stringify(list));
        }

        alert('تم إضافة المحتوى بنجاح!');
        document.getElementById('contentTitle').value = '';
        document.getElementById('textContent').value = '';
        document.getElementById('contentFile').value = '';
        loadDashboardStats();
        loadMySubjects();
    } catch (error) {
        console.error('Add content error:', error);
        alert('خطأ في إضافة المحتوى');
    }
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Load students
async function loadStudents() {
    const subject = document.getElementById('studentSubject').value;
    const grade = document.getElementById('studentGrade').value;
    
    try {
        let url = '/api/teacher/students';
        const params = new URLSearchParams();
        if (subject) params.append('subject', subject);
        if (grade) params.append('grade', grade);
        if (params.toString()) url += '?' + params.toString();
        
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            renderStudents(data.students);
        }
    } catch (error) {
        console.error('Load students error:', error);
    }
}

function renderStudents(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (!students || students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا يوجد طلاب</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(student => `
        <tr>
            <td>${escapeHtml(student.fullName)}</td>
            <td>${getGradeName(student.grade)}</td>
            <td>${escapeHtml(student.className || '-')}</td>
            <td>${formatTime(student.studyTime || 0)}</td>
            <td>${student.lastActive ? new Date(student.lastActive).toLocaleDateString('ar-EG') : '-'}</td>
        </tr>
    `).join('');
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} ساعة ${minutes} دقيقة`;
}

// Logout
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = 'SS.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = 'SS.html';
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize
checkAuth();
