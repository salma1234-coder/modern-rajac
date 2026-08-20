const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');
const bcrypt = require('bcryptjs');

const adapter = new JSONFile(path.join(__dirname, 'database.json'));
const db = new Low(adapter, { users: [], loginRecords: [], failedAttempts: {}, subjects: [] });

// بيانات المواد والمعلمين
const subjectsData = {
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

async function importSubjectsAndTeachers() {
    try {
        await db.read();
        
        if (!db.data.users) db.data.users = [];
        if (!db.data.subjects) db.data.subjects = [];
        
        let addedTeachers = 0;
        let addedSubjects = 0;
        let skippedTeachers = 0;
        let skippedSubjects = 0;
        
        // إضافة المواد والمعلمين للصف الأول
        for (const subject of subjectsData.first) {
            // التحقق من وجود المعلم
            let teacher = db.data.users.find(u => u.fullName === subject.admin && u.role === 'teacher');
            
            if (!teacher) {
                // إنشاء حساب للمعلم
                const hashedPassword = await bcrypt.hash(subject.password, 10);
                teacher = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    username: subject.admin.replace(/\s+/g, ''),
                    password: hashedPassword,
                    fullName: subject.admin,
                    role: 'teacher',
                    subjects: [subject.name],
                    createdAt: new Date().toISOString()
                };
                db.data.users.push(teacher);
                addedTeachers++;
                console.log(`✅ تم إضافة المعلم: ${subject.admin}`);
            } else {
                // إضافة المادة للمواد الموجودة للمعلم
                if (!teacher.subjects) teacher.subjects = [];
                if (!teacher.subjects.includes(subject.name)) {
                    teacher.subjects.push(subject.name);
                    skippedTeachers++;
                    console.log(`⏭️ المعلم موجود بالفعل: ${subject.admin} (تم إضافة المادة)`);
                } else {
                    skippedTeachers++;
                    console.log(`⏭️ المعلم موجود بالفعل: ${subject.admin}`);
                }
            }
            
            // التحقق من وجود المادة
            const existingSubject = db.data.subjects.find(
                s => s.name === subject.name && s.grade === 'first'
            );
            
            if (!existingSubject) {
                // إضافة المادة
                const newSubject = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    name: subject.name,
                    color: subject.color,
                    grade: 'first',
                    teacherId: teacher.id,
                    teacherName: teacher.fullName,
                    createdAt: new Date().toISOString()
                };
                db.data.subjects.push(newSubject);
                addedSubjects++;
                console.log(`✅ تم إضافة المادة: ${subject.name} (الصف الأول)`);
            } else {
                skippedSubjects++;
                console.log(`⏭️ المادة موجودة بالفعل: ${subject.name} (الصف الأول)`);
            }
        }
        
        // إضافة المواد والمعلمين للصف الثاني
        for (const subject of subjectsData.second) {
            // التحقق من وجود المعلم
            let teacher = db.data.users.find(u => u.fullName === subject.admin && u.role === 'teacher');
            
            if (!teacher) {
                // إنشاء حساب للمعلم
                const hashedPassword = await bcrypt.hash(subject.password, 10);
                teacher = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    username: subject.admin.replace(/\s+/g, ''),
                    password: hashedPassword,
                    fullName: subject.admin,
                    role: 'teacher',
                    subjects: [subject.name],
                    createdAt: new Date().toISOString()
                };
                db.data.users.push(teacher);
                addedTeachers++;
                console.log(`✅ تم إضافة المعلم: ${subject.admin}`);
            } else {
                // إضافة المادة للمواد الموجودة للمعلم
                if (!teacher.subjects) teacher.subjects = [];
                if (!teacher.subjects.includes(subject.name)) {
                    teacher.subjects.push(subject.name);
                    skippedTeachers++;
                    console.log(`⏭️ المعلم موجود بالفعل: ${subject.admin} (تم إضافة المادة)`);
                } else {
                    skippedTeachers++;
                    console.log(`⏭️ المعلم موجود بالفعل: ${subject.admin}`);
                }
            }
            
            // التحقق من وجود المادة
            const existingSubject = db.data.subjects.find(
                s => s.name === subject.name && s.grade === 'second'
            );
            
            if (!existingSubject) {
                // إضافة المادة
                const newSubject = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    name: subject.name,
                    color: subject.color,
                    grade: 'second',
                    teacherId: teacher.id,
                    teacherName: teacher.fullName,
                    createdAt: new Date().toISOString()
                };
                db.data.subjects.push(newSubject);
                addedSubjects++;
                console.log(`✅ تم إضافة المادة: ${subject.name} (الصف الثاني)`);
            } else {
                skippedSubjects++;
                console.log(`⏭️ المادة موجودة بالفعل: ${subject.name} (الصف الثاني)`);
            }
        }
        
        await db.write();
        
        console.log('\n=== ملخص الاستيراد ===');
        console.log(`المعلمون الجدد: ${addedTeachers}`);
        console.log(`المعلمون الموجودون: ${skippedTeachers}`);
        console.log(`المواد الجديدة: ${addedSubjects}`);
        console.log(`المواد الموجودة: ${skippedSubjects}`);
        console.log('\n✅ تم الاستيراد بنجاح!');
        
    } catch (error) {
        console.error('❌ خطأ في الاستيراد:', error);
    }
}

importSubjectsAndTeachers();
