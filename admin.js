// Admin Dashboard JavaScript

let currentPage = 1;
let usersPerPage = 20;
let loginRecordsPerPage = 20;
let allUsers = [];
let allLoginRecords = [];

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadDashboardStats();
    await loadUsers();
    await loadLoginRecords();
});

// Check if user is authenticated and is admin
async function checkAuth() {
    try {
        const response = await fetch('/api/user');
        if (!response.ok) {
            window.location.href = 'SS.html';
            return;
        }
        const user = await response.json();
        if (user.role !== 'admin') {
            alert('غير مصرح لك بالوصول إلى هذه الصفحة');
            window.location.href = 'SS.html';
            return;
        }
        document.getElementById('adminName').textContent = user.fullName;
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
    if (sectionId === 'teachers') {
        loadTeachers();
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const [usersResponse, loginRecordsResponse] = await Promise.all([
            fetch('/api/admin/users'),
            fetch('/api/admin/login-records')
        ]);
        
        const users = await usersResponse.json();
        const loginRecords = await loginRecordsResponse.json();
        
        allUsers = users;
        allLoginRecords = loginRecords;
        
        const totalUsers = users.length;
        const totalStudents = users.filter(u => u.role === 'student').length;
        const totalLogins = loginRecords.length;
        
        const today = new Date().toDateString();
        const todayLogins = loginRecords.filter(r => 
            new Date(r.loginTime).toDateString() === today
        ).length;
        
        document.getElementById('totalUsers').textContent = totalUsers;
        document.getElementById('totalStudents').textContent = totalStudents;
        document.getElementById('totalLogins').textContent = totalLogins;
        document.getElementById('todayLogins').textContent = todayLogins;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load users
async function loadUsers(page = 1) {
    try {
        if (allUsers.length === 0) {
            const response = await fetch('/api/admin/users');
            allUsers = await response.json();
        }
        
        const start = (page - 1) * usersPerPage;
        const end = start + usersPerPage;
        const paginatedUsers = allUsers.slice(start, end);
        
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = paginatedUsers.map(user => `
            <tr>
                <td>${escapeHtml(user.username)}</td>
                <td>${escapeHtml(user.fullName)}</td>
                <td>${user.grade || '-'}</td>
                <td>${user.gender === 'boy' ? 'ذكر' : user.gender === 'girl' ? 'أنثى' : '-'}</td>
                <td>${user.className || '-'}</td>
                <td>${user.role === 'admin' ? 'مسؤول' : 'طالب'}</td>
                <td>${new Date(user.createdAt).toLocaleDateString('ar-EG')}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-view" onclick="viewUser('${user.id}')">عرض</button>
                        <button class="btn-edit" onclick="editUser('${user.id}')">تعديل</button>
                        <button class="btn-delete" onclick="deleteUser('${user.id}')">حذف</button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        renderPagination('usersPagination', allUsers.length, page, usersPerPage, loadUsers);
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('usersTableBody').innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: red;">خطأ في تحميل البيانات</td>
            </tr>
        `;
    }
}

// Load login records
async function loadLoginRecords(page = 1) {
    try {
        if (allLoginRecords.length === 0) {
            const response = await fetch('/api/admin/login-records');
            allLoginRecords = await response.json();
        }
        
        // Sort by login time descending
        allLoginRecords.sort((a, b) => new Date(b.loginTime) - new Date(a.loginTime));
        
        const start = (page - 1) * loginRecordsPerPage;
        const end = start + loginRecordsPerPage;
        const paginatedRecords = allLoginRecords.slice(start, end);
        
        const tbody = document.getElementById('loginRecordsTableBody');
        tbody.innerHTML = paginatedRecords.map(record => `
            <tr>
                <td>${escapeHtml(record.username)}</td>
                <td>${escapeHtml(record.fullName)}</td>
                <td>${new Date(record.loginTime).toLocaleString('ar-EG')}</td>
                <td>${record.ipAddress || '-'}</td>
            </tr>
        `).join('');
        
        renderPagination('loginRecordsPagination', allLoginRecords.length, page, loginRecordsPerPage, loadLoginRecords);
    } catch (error) {
        console.error('Error loading login records:', error);
        document.getElementById('loginRecordsTableBody').innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: red;">خطأ في تحميل البيانات</td>
            </tr>
        `;
    }
}

// Search users
async function searchUsers() {
    const query = document.getElementById('searchUsers').value.trim();
    if (!query) {
        await loadUsers();
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/users/search?query=${encodeURIComponent(query)}`);
        const users = await response.json();
        
        allUsers = users;
        currentPage = 1;
        await loadUsers(1);
    } catch (error) {
        console.error('Error searching users:', error);
        alert('خطأ في البحث');
    }
}

// Show add user modal
function showAddUserModal() {
    document.getElementById('modalTitle').textContent = 'إضافة مستخدم جديد';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('password').required = true;
    document.getElementById('userModal').classList.add('active');
}

// Edit user
async function editUser(userId) {
    try {
        const user = allUsers.find(u => u.id === userId);
        if (!user) {
            alert('المستخدم غير موجود');
            return;
        }
        
        document.getElementById('modalTitle').textContent = 'تعديل المستخدم';
        document.getElementById('userId').value = user.id;
        document.getElementById('username').value = user.username;
        document.getElementById('fullName').value = user.fullName;
        document.getElementById('password').value = '';
        document.getElementById('password').required = false;
        document.getElementById('grade').value = user.grade || '';
        document.getElementById('gender').value = user.gender || '';
        document.getElementById('className').value = user.className || '';
        document.getElementById('role').value = user.role || 'student';
        
        document.getElementById('userModal').classList.add('active');
    } catch (error) {
        console.error('Error loading user:', error);
        alert('خطأ في تحميل بيانات المستخدم');
    }
}

// View user
function viewUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    alert(`
        معلومات المستخدم:
        اسم المستخدم: ${user.username}
        الاسم الكامل: ${user.fullName}
        الصف: ${user.grade || '-'}
        النوع: ${user.gender === 'boy' ? 'ذكر' : user.gender === 'girl' ? 'أنثى' : '-'}
        الفصل: ${user.className || '-'}
        الدور: ${user.role === 'admin' ? 'مسؤول' : 'طالب'}
        تاريخ الإنشاء: ${new Date(user.createdAt).toLocaleDateString('ar-EG')}
    `);
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('تم حذف المستخدم بنجاح');
            allUsers = allUsers.filter(u => u.id !== userId);
            await loadUsers(currentPage);
            await loadDashboardStats();
        } else {
            const error = await response.json();
            alert(error.error || 'خطأ في حذف المستخدم');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('خطأ في حذف المستخدم');
    }
}

// Close user modal
function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
}

// Handle user form submission
document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userId = document.getElementById('userId').value;
    const userData = {
        username: document.getElementById('username').value,
        fullName: document.getElementById('fullName').value,
        password: document.getElementById('password').value,
        grade: document.getElementById('grade').value,
        gender: document.getElementById('gender').value,
        className: document.getElementById('className').value,
        role: document.getElementById('role').value
    };
    
    try {
        let response;
        if (userId) {
            // Update existing user
            response = await fetch(`/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
        } else {
            // Add new user
            response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
        }
        
        if (response.ok) {
            alert(userId ? 'تم تحديث المستخدم بنجاح' : 'تم إضافة المستخدم بنجاح');
            closeUserModal();
            allUsers = [];
            await loadUsers();
            await loadDashboardStats();
        } else {
            const error = await response.json();
            alert(error.error || 'خطأ في حفظ المستخدم');
        }
    } catch (error) {
        console.error('Error saving user:', error);
        alert('خطأ في حفظ المستخدم');
    }
});

// Export users to CSV
async function exportUsers() {
    try {
        window.location.href = '/api/admin/export/users';
    } catch (error) {
        console.error('Error exporting users:', error);
        alert('خطأ في تصدير المستخدمين');
    }
}

// Export login records to CSV
async function exportLoginRecords() {
    try {
        window.location.href = '/api/admin/export/login-records';
    } catch (error) {
        console.error('Error exporting login records:', error);
        alert('خطأ في تصدير سجلات الدخول');
    }
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

// Render pagination
function renderPagination(containerId, totalItems, currentPage, itemsPerPage, callback) {
    const container = document.getElementById(containerId);
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Previous button
    html += `<button ${currentPage === 1 ? 'disabled' : ''} onclick="${callback.name}(${currentPage - 1})">السابق</button>`;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<button class="${i === currentPage ? 'active' : ''}" onclick="${callback.name}(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += '<button disabled>...</button>';
        }
    }
    
    // Next button
    html += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="${callback.name}(${currentPage + 1})">التالي</button>`;
    
    container.innerHTML = html;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Bulk import students
let bulkImportResults = [];

function toggleNameInput() {
    const mode = document.getElementById('bulkNameMode').value;
    document.getElementById('manualNamesGroup').style.display = mode === 'manual' ? 'block' : 'none';
}

function togglePasswordInput() {
    const mode = document.getElementById('bulkPasswordMode').value;
    document.getElementById('manualPasswordGroup').style.display = mode === 'manual' ? 'block' : 'none';
    document.getElementById('customPasswordsGroup').style.display = mode === 'custom' ? 'block' : 'none';
}

async function previewBulkImport() {
    const grade = document.getElementById('bulkGrade').value;
    const className = document.getElementById('bulkClass').value;
    const gender = document.getElementById('bulkGender').value;
    const count = parseInt(document.getElementById('bulkCount').value);
    const prefix = document.getElementById('bulkPrefix').value || 'student';
    const nameMode = document.getElementById('bulkNameMode').value;
    const passwordMode = document.getElementById('bulkPasswordMode').value;
    
    if (!grade || !className || !gender || !count) {
        alert('يرجى ملء جميع الحقول المطلوبة');
        return;
    }
    
    if (count < 1 || count > 100) {
        alert('عدد الطلاب يجب أن يكون بين 1 و 100');
        return;
    }
    
    // Validate manual names
    let names = [];
    if (nameMode === 'manual') {
        const namesText = document.getElementById('bulkNames').value.trim();
        names = namesText.split('\n').map(n => n.trim()).filter(n => n);
        if (names.length !== count) {
            alert(`عدد الأسماء (${names.length}) لا يساوي عدد الطلاب (${count})`);
            return;
        }
    }
    
    // Validate manual passwords
    let passwords = [];
    if (passwordMode === 'custom') {
        const passwordsText = document.getElementById('bulkPasswords').value.trim();
        passwords = passwordsText.split('\n').map(p => p.trim()).filter(p => p);
        if (passwords.length !== count) {
            alert(`عدد كلمات المرور (${passwords.length}) لا يساوي عدد الطلاب (${count})`);
            return;
        }
    }
    
    const preview = [];
    for (let i = 1; i <= count; i++) {
        const fullName = nameMode === 'manual' ? names[i - 1] : `طالب ${i}`;
        const password = passwordMode === 'auto' ? '(عشوائية)' : 
                         passwordMode === 'manual' ? document.getElementById('bulkPassword').value :
                         passwords[i - 1];
        
        preview.push({
            username: `${prefix}${i}`,
            fullName: fullName,
            password: password,
            grade: grade,
            className: className,
            gender: gender
        });
    }
    
    const previewDiv = document.getElementById('bulkPreviewContent');
    previewDiv.innerHTML = `
        <table class="admin-table">
            <thead>
                <tr>
                    <th>اسم المستخدم</th>
                    <th>الاسم الكامل</th>
                    <th>كلمة المرور</th>
                    <th>الصف</th>
                    <th>الفصل</th>
                    <th>النوع</th>
                </tr>
            </thead>
            <tbody>
                ${preview.map(p => `
                    <tr>
                        <td>${escapeHtml(p.username)}</td>
                        <td>${escapeHtml(p.fullName)}</td>
                        <td><strong>${escapeHtml(p.password)}</strong></td>
                        <td>${p.grade === 'first' ? 'الصف الأول' : p.grade === 'second' ? 'الصف الثاني' : 'الصف الثالث'}</td>
                        <td>${escapeHtml(p.className)}</td>
                        <td>${p.gender === 'boy' ? 'ذكر' : 'أنثى'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    document.getElementById('bulkPreview').style.display = 'block';
}

async function bulkImportStudents() {
    const grade = document.getElementById('bulkGrade').value;
    const className = document.getElementById('bulkClass').value;
    const gender = document.getElementById('bulkGender').value;
    const count = parseInt(document.getElementById('bulkCount').value);
    const prefix = document.getElementById('bulkPrefix').value || 'student';
    const nameMode = document.getElementById('bulkNameMode').value;
    const passwordMode = document.getElementById('bulkPasswordMode').value;
    
    if (!grade || !className || !gender || !count) {
        alert('يرجى ملء جميع الحقول المطلوبة');
        return;
    }
    
    // Prepare names
    let names = [];
    if (nameMode === 'manual') {
        const namesText = document.getElementById('bulkNames').value.trim();
        names = namesText.split('\n').map(n => n.trim()).filter(n => n);
        if (names.length !== count) {
            alert(`عدد الأسماء (${names.length}) لا يساوي عدد الطلاب (${count})`);
            return;
        }
    }
    
    // Prepare passwords
    let passwords = [];
    if (passwordMode === 'manual') {
        const singlePassword = document.getElementById('bulkPassword').value.trim();
        if (!singlePassword) {
            alert('يرجى إدخال كلمة المرور');
            return;
        }
        passwords = Array(count).fill(singlePassword);
    } else if (passwordMode === 'custom') {
        const passwordsText = document.getElementById('bulkPasswords').value.trim();
        passwords = passwordsText.split('\n').map(p => p.trim()).filter(p => p);
        if (passwords.length !== count) {
            alert(`عدد كلمات المرور (${passwords.length}) لا يساوي عدد الطلاب (${count})`);
            return;
        }
    }
    
    if (!confirm(`هل أنت متأكد من إضافة ${count} طالب؟`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/admin/bulk-import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grade,
                className,
                gender,
                count,
                prefix,
                nameMode,
                names,
                passwordMode,
                passwords
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            bulkImportResults = data.students;
            
            const resultsDiv = document.getElementById('bulkResultsContent');
            resultsDiv.innerHTML = `
                <p style="color: green;">✅ تم إضافة ${data.added} طالب بنجاح</p>
                ${data.errors > 0 ? `<p style="color: red;">⚠️ فشل إضافة ${data.errors} طالب بسبب تكرار أسماء المستخدمين</p>` : ''}
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>اسم المستخدم</th>
                            <th>كلمة المرور</th>
                            <th>الاسم الكامل</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.students.map(s => `
                            <tr>
                                <td>${escapeHtml(s.username)}</td>
                                <td><strong>${escapeHtml(s.password)}</strong></td>
                                <td>${escapeHtml(s.fullName)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            
            document.getElementById('bulkResults').style.display = 'block';
            document.getElementById('bulkPreview').style.display = 'none';
            
            // Refresh users list
            allUsers = [];
            await loadUsers();
            await loadDashboardStats();
            
            alert(`تم إضافة ${data.added} طالب بنجاح!`);
        } else {
            alert(data.error || 'خطأ في إضافة الطلاب');
        }
    } catch (error) {
        console.error('Bulk import error:', error);
        alert('خطأ في الاتصال بالخادم');
    }
}

function downloadBulkPasswords() {
    if (bulkImportResults.length === 0) {
        alert('لا توجد بيانات للتحميل');
        return;
    }
    
    let csvContent = 'اسم المستخدم,كلمة المرور,الاسم الكامل\n';
    bulkImportResults.forEach(s => {
        csvContent += `${s.username},${s.password},${s.fullName}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `passwords_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Teacher Management Functions
async function loadTeachers() {
    try {
        const response = await fetch('/api/admin/teachers');
        if (response.ok) {
            const data = await response.json();
            renderTeachersTable(data.teachers);
        }
    } catch (error) {
        console.error('Load teachers error:', error);
    }
}

function renderTeachersTable(teachers) {
    const tbody = document.getElementById('teachersTableBody');
    if (teachers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا يوجد معلمين</td></tr>';
        return;
    }

    tbody.innerHTML = teachers.map(teacher => `
        <tr>
            <td>${teacher.username}</td>
            <td>${teacher.fullName}</td>
            <td>${teacher.subjects.join(', ')}</td>
            <td>${new Date(teacher.createdAt).toLocaleDateString('ar-EG')}</td>
            <td>
                <button onclick="deleteTeacher('${teacher.id}')" class="btn btn--danger">حذف</button>
            </td>
        </tr>
    `).join('');
}

function showAddTeacherModal() {
    document.getElementById('teacherModal').style.display = 'block';
}

function closeTeacherModal() {
    document.getElementById('teacherModal').style.display = 'none';
    document.getElementById('teacherForm').reset();
}

document.getElementById('teacherForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('teacherUsername').value;
    const fullName = document.getElementById('teacherFullName').value;
    const password = document.getElementById('teacherPassword').value;
    const subjects = document.getElementById('teacherSubjects').value.split(',').map(s => s.trim());

    try {
        const response = await fetch('/api/admin/add-teacher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, fullName, subjects })
        });

        const data = await response.json();
        if (data.success) {
            alert('تم إضافة المعلم بنجاح!');
            closeTeacherModal();
            await loadTeachers();
        } else {
            alert(data.error || 'خطأ في إضافة المعلم');
        }
    } catch (error) {
        console.error('Add teacher error:', error);
        alert('خطأ في الاتصال بالخادم');
    }
});

async function deleteTeacher(teacherId) {
    if (!confirm('هل أنت متأكد من حذف هذا المعلم؟')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/teachers/${teacherId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('تم حذف المعلم بنجاح!');
            await loadTeachers();
        } else {
            alert('خطأ في حذف المعلم');
        }
    } catch (error) {
        console.error('Delete teacher error:', error);
        alert('خطأ في الاتصال بالخادم');
    }
}
