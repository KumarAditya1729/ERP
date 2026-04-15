import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend the jsPDF type to include autoTable which is added via side-effect
interface jsPDFWithPlugin extends jsPDF {
  autoTable: (options: any) => jsPDFWithPlugin;
  lastAutoTable?: { finalY: number };
}

export function generatePayslipPDF(staff: any, tenantName: string) {
  const doc = new jsPDF() as jsPDFWithPlugin;
  
  // Header
  doc.setFontSize(22);
  doc.setTextColor(30, 64, 175); // Violet/blue color
  doc.text(tenantName || 'NexSchool ERP', 105, 20, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Employee Payslip', 105, 30, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 36, { align: 'center' });

  // Employee Details
  doc.setFontSize(12);
  doc.text(`Employee Name: ${staff.first_name} ${staff.last_name}`, 14, 50);
  doc.text(`Employee ID: ${staff.id.slice(0, 8).toUpperCase()}`, 14, 58);
  doc.text(`Role/Dept: ${staff.role?.toUpperCase()} | ${staff.department || 'General'}`, 14, 66);
  doc.text(`Email: ${staff.email}`, 14, 74);

  // Financial Breakdown
  const salary = Number(staff.salary) || 0;
  const pfDeduction = salary * 0.12;
  const tax = salary > 50000 ? (salary - 50000) * 0.1 : 0;
  const netPayable = salary - pfDeduction - tax;

  doc.autoTable({
    startY: 85,
    head: [['Description', 'Amount (INR)']],
    body: [
      ['Basic Salary (Monthly)', `Rs. ${salary.toLocaleString('en-IN')}`],
      ['Provident Fund (12%)', `- Rs. ${pfDeduction.toLocaleString('en-IN')}`],
      ['Income Tax (Est.)', `- Rs. ${tax.toLocaleString('en-IN')}`],
      ['Net Payable Amount', `Rs. ${netPayable.toLocaleString('en-IN')}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [46, 20, 140] },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } }
  });

  // Footer Signature
  const finalY = doc.lastAutoTable?.finalY || 130;
  doc.setFontSize(10);
  doc.text('-----------------------------', 150, finalY + 40);
  doc.text('Authorized Signature', 155, finalY + 45);

  doc.save(`${staff.first_name}_${staff.last_name}_Payslip.pdf`);
}

export function generateReportCardPDF(student: any, examName: string, marksData: any[], tenantName: string) {
  const doc = new jsPDF() as jsPDFWithPlugin;

  // Header
  doc.setFontSize(22);
  doc.setTextColor(30, 64, 175);
  doc.text(tenantName || 'NexSchool ERP', 105, 20, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Official Report Card', 105, 30, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(`Exam: ${examName}`, 105, 38, { align: 'center' });

  // Student details
  doc.setFontSize(11);
  doc.text(`Student Name: ${student.first_name} ${student.last_name}`, 14, 55);
  doc.text(`Class: ${student.class_grade}-${student.section}  |  Roll No: ${student.roll_number || 'N/A'}`, 14, 62);
  doc.text(`Student ID: ${student.id.slice(0, 8).toUpperCase()}`, 14, 69);

  // Table mapping
  const tableData = marksData.map(m => [
    m.subject,
    m.max_marks.toString(),
    m.marks_obtained.toString(),
    ((m.marks_obtained / m.max_marks) * 100).toFixed(1) + '%',
    m.marks_obtained >= (m.max_marks * 0.4) ? 'PASS' : 'FAIL',
    m.remarks || '-'
  ]);

  const totalObtained = marksData.reduce((acc, curr) => acc + curr.marks_obtained, 0);
  const totalMax = marksData.reduce((acc, curr) => acc + curr.max_marks, 0);
  const percentage = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : '0';

  tableData.push([
    'TOTAL',
    totalMax.toString(),
    totalObtained.toString(),
    `${percentage}%`,
    Number(percentage) >= 40 ? 'PASS' : 'FAIL',
    ''
  ]);

  doc.autoTable({
    startY: 80,
    head: [['Subject', 'Max Marks', 'Obtained', 'Percentage', 'Status', 'Remarks']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [46, 20, 140] },
    didParseCell: function (data: any) {
      if (data.row.index === tableData.length - 1) {
         data.cell.styles.fontStyle = 'bold';
         data.cell.styles.fillColor = [240, 240, 240];
      }
    }
  });

  const finalY = doc.lastAutoTable?.finalY || 150;
  doc.setFontSize(10);
  doc.text('-----------------------------', 30, finalY + 40);
  doc.text('Class Teacher', 40, finalY + 45);

  doc.text('-----------------------------', 150, finalY + 40);
  doc.text('Principal', 165, finalY + 45);

  doc.save(`${student.first_name}_Report_Card_${examName}.pdf`);
}
