// Export functions for teacher panel

// Export student data to PDF
function exportStudentData(studentName) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Get all students data
    const allStudents = JSON.parse(localStorage.getItem("students")) || [];
    const testResults = JSON.parse(localStorage.getItem("testResults")) || [];
    
    // Find the specific student
    const student = allStudents.find(s => s.name === studentName);
    if (!student) {
        showToast("Student not found", "error");
        return;
    }
    
    // Get student's test results for current material
    const studentTestResults = testResults.filter(r => 
        r.studentName === studentName && r.material === currentMaterial.name
    );
    
    // Add Arabic font support
    doc.addFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.setFont('Roboto');
    
    // Title
    doc.setFontSize(16);
    doc.text(`Student Report: ${studentName}`, 20, 20);
    
    // Student info
    doc.setFontSize(12);
    doc.text(`Name: ${studentName}`, 20, 40);
    doc.text(`Class: ${student.className}`, 20, 50);
    doc.text(`Grade: ${student.grade}`, 20, 60);
    
    // Test results
    let yPosition = 80;
    doc.text("Test Results:", 20, yPosition);
    yPosition += 10;
    
    if (studentTestResults.length > 0) {
        studentTestResults.forEach((result, index) => {
            doc.text(`Test ${index + 1}: ${result.score}%`, 30, yPosition);
            doc.text(`Date: ${new Date(result.date || result.timestamp).toLocaleDateString()}`, 30, yPosition + 10);
            yPosition += 20;
        });
    } else {
        doc.text("No test results available", 30, yPosition);
    }
    
    // Save the PDF
    doc.save(`${studentName}_report.pdf`);
    showToast("PDF exported successfully", "success");
}

// Export student data to Excel
function exportStudentExcel(studentName) {
    const allStudents = JSON.parse(localStorage.getItem("students")) || [];
    const testResults = JSON.parse(localStorage.getItem("testResults")) || [];
    
    // Find the specific student
    const student = allStudents.find(s => s.name === studentName);
    if (!student) {
        showToast("Student not found", "error");
        return;
    }
    
    // Get student's test results for current material
    const studentTestResults = testResults.filter(r => 
        r.studentName === studentName && r.material === currentMaterial.name
    );
    
    // Create CSV content
    let csvContent = "Student Report\n";
    csvContent += `Name,${studentName}\n`;
    csvContent += `Class,${student.className}\n`;
    csvContent += `Grade,${student.grade}\n\n`;
    csvContent += "Test Results\n";
    csvContent += "Test Number,Score,Date\n";
    
    if (studentTestResults.length > 0) {
        studentTestResults.forEach((result, index) => {
            csvContent += `${index + 1},${result.score}%,${new Date(result.date || result.timestamp).toLocaleDateString()}\n`;
        });
    } else {
        csvContent += "No test results available\n";
    }
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${studentName}_report.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast("Excel file exported successfully", "success");
}

// Export all students data to PDF
function exportAllStudentsPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Get all students data for current material
    const allStudents = JSON.parse(localStorage.getItem("students")) || [];
    const currentMaterialStudents = allStudents.filter(student => 
        student.material === currentMaterial.name
    );
    const testResults = JSON.parse(localStorage.getItem("testResults")) || [];
    
    // Title
    doc.setFontSize(16);
    doc.text(`All Students Report - ${currentMaterial.name}`, 20, 20);
    
    // Table headers
    doc.setFontSize(12);
    let yPosition = 40;
    doc.text("Name", 20, yPosition);
    doc.text("Class", 60, yPosition);
    doc.text("Score", 100, yPosition);
    doc.text("Grade", 140, yPosition);
    
    yPosition += 10;
    
    // Student data
    currentMaterialStudents.forEach(student => {
        const studentTestResults = testResults.filter(r => 
            r.studentName === student.name && r.material === currentMaterial.name
        );
        const latestTest = studentTestResults[studentTestResults.length - 1];
        const score = latestTest ? latestTest.score : 0;
        
        let grade = "-";
        if (score >= 90) grade = "Excellent";
        else if (score >= 80) grade = "Very Good";
        else if (score >= 70) grade = "Good";
        else if (score >= 60) grade = "Average";
        else if (score >= 50) grade = "Poor";
        else if (score > 0) grade = "Acceptable";
        
        doc.text(student.name, 20, yPosition);
        doc.text(student.className, 60, yPosition);
        doc.text(score > 0 ? score + "%" : "-", 100, yPosition);
        doc.text(grade, 140, yPosition);
        
        yPosition += 10;
        
        // Add new page if needed
        if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
        }
    });
    
    // Save the PDF
    doc.save(`all_students_${currentMaterial.name}_report.pdf`);
    showToast("All students PDF exported successfully", "success");
}

// Export all students data to Excel
function exportAllStudentsExcel() {
    const allStudents = JSON.parse(localStorage.getItem("students")) || [];
    const currentMaterialStudents = allStudents.filter(student => 
        student.material === currentMaterial.name
    );
    const testResults = JSON.parse(localStorage.getItem("testResults")) || [];
    
    // Create CSV content
    let csvContent = `All Students Report - ${currentMaterial.name}\n\n`;
    csvContent += "Name,Class,Score,Grade\n";
    
    currentMaterialStudents.forEach(student => {
        const studentTestResults = testResults.filter(r => 
            r.studentName === student.name && r.material === currentMaterial.name
        );
        const latestTest = studentTestResults[studentTestResults.length - 1];
        const score = latestTest ? latestTest.score : 0;
        
        let grade = "-";
        if (score >= 90) grade = "Excellent";
        else if (score >= 80) grade = "Very Good";
        else if (score >= 70) grade = "Good";
        else if (score >= 60) grade = "Average";
        else if (score >= 50) grade = "Poor";
        else if (score > 0) grade = "Acceptable";
        
        csvContent += `${student.name},${student.className},${score > 0 ? score + "%" : "-"},${grade}\n`;
    });
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `all_students_${currentMaterial.name}_report.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast("All students Excel file exported successfully", "success");
}
