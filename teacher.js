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
        const [subjectsResponse, studentsResponse, totalContent] = await Promise.all([
            fetch('/api/teacher/subjects'),
            fetch('/api/teacher/students'),
            calculateTotalContent()
        ]);
        
        const subjects = await subjectsResponse.json();
        const students = await studentsResponse.json();
        
        document.getElementById('totalSubjects').textContent = subjects.subjects.length;
        document.getElementById('totalStudents').textContent = students.students.length;
        document.getElementById('totalContent').textContent = totalContent;
    } catch (error) {
        console.error('Load dashboard stats error:', error);
    }
}

async function calculateTotalContent() {
    try {
        const response = await fetch('/api/teacher/content');
        if (response.ok) {
            const data = await response.json();
            return data.content.length;
        }
    } catch (error) {
        console.error('Calculate content error:', error);
    }
    return 0;
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

async function renderSubjects(subjects) {
    const container = document.getElementById('subjectsList');
    if (!subjects || subjects.length === 0) {
        container.innerHTML = '<p>لا توجد مواد مسندة إليك</p>';
        return;
    }

    const subjectsHtml = await Promise.all(subjects.map(async subject => {
        const contentInfo = await calculateSubjectContent(subject.name);
        return `
            <div class="subject-card" style="background-color: ${subject.color}20; border-right: 4px solid ${subject.color}">
                <h3>${escapeHtml(subject.name)}</h3>
                <p>الصف: ${getGradeName(subject.grade)}</p>
                <p>المحتوى: ${contentInfo}</p>
            </div>
        `;
    }));

    container.innerHTML = subjectsHtml.join('');
}

async function calculateSubjectContent(subjectName) {
    try {
        const response = await fetch(`/api/teacher/content?subject=${encodeURIComponent(subjectName)}`);
        if (response.ok) {
            const data = await response.json();
            const summaries = data.content.filter(c => c.type === 'summary').length;
            const videos = data.content.filter(c => c.type === 'video').length;
            const pdfs = data.content.filter(c => c.type === 'pdf').length;
            const voices = data.content.filter(c => c.type === 'audio').length;
            return `${summaries} ملخصات, ${videos} فيديوهات, ${pdfs} PDFs, ${voices} صوتيات`;
        }
    } catch (error) {
        console.error('Calculate subject content error:', error);
    }
    return '0 ملخصات, 0 فيديوهات, 0 PDFs, 0 صوتيات';
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
        let content = null;
        let fileData = null;
        let fileName = null;
        let mimeType = null;

        if (type === 'summary') {
            const text = document.getElementById('textContent').value;
            if (!text) {
                alert('يرجى إدخال المحتوى');
                return;
            }
            content = text;
        } else {
            const file = document.getElementById('contentFile').files[0];
            if (!file) {
                alert('يرجى اختيار ملف');
                return;
            }
            fileData = await fileToDataUrl(file);
            fileName = file.name;
            mimeType = file.type || "";
        }

        const response = await fetch('/api/teacher/content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject,
                type,
                title,
                content,
                fileData,
                fileName,
                mimeType
            })
        });

        if (response.ok) {
            alert('تم إضافة المحتوى بنجاح!');
            document.getElementById('contentTitle').value = '';
            document.getElementById('textContent').value = '';
            document.getElementById('contentFile').value = '';
            loadDashboardStats();
            loadMySubjects();
        } else {
            const error = await response.json();
            alert(error.error || 'خطأ في إضافة المحتوى');
        }
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
