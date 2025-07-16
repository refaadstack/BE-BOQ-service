const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const ExcelJS = require('exceljs');
const { BoqCategory, BoqItem } = require('../models');

const EXPORT_DIR = process.env.EXPORT_DIR || './exports';

const exportToPDF = async (projectId) => {
  // Placeholder for PDF export logic using puppeteer and handlebars templates
  // Generate PDF file path
  const filePath = path.join(EXPORT_DIR, `boq_project_${projectId}_${Date.now()}.pdf`);
  // Implement PDF generation here
  return filePath;
};

const exportToExcel = async (projectId) => {
  // Placeholder for Excel export logic using exceljs
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('BOQ');

  // Fetch categories and items
  const categories = await BoqCategory.findAll({
    where: { project_id: projectId, is_active: true },
    include: [{ model: BoqItem, where: { is_active: true }, required: false }],
    order: [['order_seq', 'ASC'], ['id', 'ASC']],
  });

  // Add headers
  worksheet.columns = [
    { header: 'Category', key: 'category', width: 30 },
    { header: 'Item Code', key: 'item_code', width: 20 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Volume', key: 'volume', width: 10 },
    { header: 'Satuan', key: 'satuan', width: 10 },
    { header: 'Harga Satuan', key: 'harga_satuan', width: 15 },
    { header: 'Jumlah Harga', key: 'jumlah_harga', width: 15 },
  ];

  // Add data rows
  categories.forEach(category => {
    worksheet.addRow({ category: category.name });
    category.BoqItems.forEach(item => {
      worksheet.addRow({
        category: '',
        item_code: item.item_code,
        description: item.description,
        volume: item.volume,
        satuan: item.satuan,
        harga_satuan: item.harga_satuan,
        jumlah_harga: item.jumlah_harga,
      });
    });
  });

  // Save file
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
  const filePath = path.join(EXPORT_DIR, `boq_project_${projectId}_${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
};

module.exports = {
  exportToPDF,
  exportToExcel,
};
