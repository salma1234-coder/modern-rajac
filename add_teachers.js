const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");
const bcrypt = require("bcryptjs");

// بيانات المواد والمعلمين
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

// إعداد قاعدة البيانات
const adapter = new JSONFile("database.json");
const db = new Low(adapter);

async function addTeachers() {
    try {
        await db.read();
        
        // Initialize default data structure if needed
        if (!db.data) {
            db.data = { users: [], loginRecords: [], failedAttempts: {} };
            await db.write();
        }
        
        if (!db.data.users) {
            db.data.users = [];
        }

        let addedCount = 0;
        let skippedCount = 0;
        const teachersToAdd = [];

        // إضافة معلمي الصف الأول
        for (const subject of subjects.first) {
            const teacher = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                username: subject.admin,
                password: await bcrypt.hash(subject.password, 10),
                fullName: subject.admin,
                subjects: [subject.name],
                grade: 'first',
                subjectColor: subject.color,
                role: 'teacher',
                createdAt: new Date().toISOString()
            };

            // التحقق من عدم وجود المعلم مسبقاً
            const existingTeacher = db.data.users.find(u => u.username === teacher.username && u.role === 'teacher');
            if (!existingTeacher) {
                db.data.users.push(teacher);
                teachersToAdd.push({
                    username: teacher.username,
                    password: subject.password,
                    fullName: teacher.fullName,
                    subjects: teacher.subjects,
                    grade: teacher.grade
                });
                addedCount++;
                console.log(`✅ تم إضافة: ${teacher.username} - ${subject.name}`);
            } else {
                skippedCount++;
                console.log(`⏭️  موجود بالفعل: ${teacher.username}`);
            }
        }

        // إضافة معلمي الصف الثاني
        for (const subject of subjects.second) {
            const teacher = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                username: subject.admin,
                password: await bcrypt.hash(subject.password, 10),
                fullName: subject.admin,
                subjects: [subject.name],
                grade: 'second',
                subjectColor: subject.color,
                role: 'teacher',
                createdAt: new Date().toISOString()
            };

            // التحقق من عدم وجود المعلم مسبقاً
            const existingTeacher = db.data.users.find(u => u.username === teacher.username && u.role === 'teacher');
            if (!existingTeacher) {
                db.data.users.push(teacher);
                teachersToAdd.push({
                    username: teacher.username,
                    password: subject.password,
                    fullName: teacher.fullName,
                    subjects: teacher.subjects,
                    grade: teacher.grade
                });
                addedCount++;
                console.log(`✅ تم إضافة: ${teacher.username} - ${subject.name}`);
            } else {
                skippedCount++;
                console.log(`⏭️  موجود بالفعل: ${teacher.username}`);
            }
        }

        await db.write();

        // إنشاء ملف CSV بكلمات المرور
        let csvContent = 'اسم المستخدم,كلمة المرور,الاسم الكامل,المواد,الصف\n';
        teachersToAdd.forEach(t => {
            csvContent += `${t.username},${t.password},${t.fullName},${t.subjects.join(', ')},${t.grade}\n`;
        });

        const fs = require('fs');
        fs.writeFileSync('teachers_passwords.csv', csvContent, 'utf8');

        console.log('\n' + '='.repeat(50));
        console.log(`📊 الإحصائيات:`);
        console.log(`   ✅ تم الإضافة: ${addedCount}`);
        console.log(`   ⏭️  تم التخطي: ${skippedCount}`);
        console.log(`📥 تم حفظ كلمات المرور في: teachers_passwords.csv`);
        console.log('✅ تم الانتهاء!');
        console.log('='.repeat(50));

    } catch (error) {
        console.error('❌ خطأ:', error);
    }
}

addTeachers();
