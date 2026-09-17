import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(v) || 0);

const lineCost = (it) => {
  const bp = it.buy_price ?? it.buyPrice;
  if (bp === undefined || bp === null || bp === '') return null;
  return Math.round(((Number(it.volume) || 0) * (Number(bp) || 0)) * 100) / 100;
};

const lineProfit = (it) => {
  const c = lineCost(it);
  if (c === null) return null;
  const sell = Number(it.line_total ?? (Number(it.volume) || 0) * (Number(it.unit_price) || 0)) || 0;
  return Math.round((sell - c) * 100) / 100;
};

const fmtCost = (v) => (v === null ? '-' : fmtIDR(v));

const kopLines = (company = {}) => {
  const lines = [];
  if (company.company_name) lines.push(company.company_name);
  if (company.company_tagline) lines.push(company.company_tagline);
  if (company.company_address) lines.push(company.company_address);
  const contact = [company.company_phone, company.company_email].filter(Boolean).join(' • ');
  if (contact) lines.push(contact);
  return lines;
};

export const exportBoqToExcel = async ({ boq, sections, items, totals, company = {} }) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BOQ Service';
  const ws = wb.addWorksheet('BOQ');
  ws.columns = [
    { header: 'Section', key: 'section', width: 28 },
    { header: 'No', key: 'no', width: 6 },
    { header: 'Uraian', key: 'name', width: 42 },
    { header: 'Vol', key: 'volume', width: 12 },
    { header: 'Sat', key: 'unit', width: 10 },
    { header: 'Harga Satuan (Jual)', key: 'unit_price', width: 18 },
    { header: 'Jumlah (Jual)', key: 'line_total', width: 20 },
    { header: 'Harga Beli', key: 'buy_price', width: 18 },
    { header: 'Jumlah (Beli)', key: 'line_cost', width: 20 },
    { header: 'Vendor', key: 'vendor', width: 24 },
    { header: 'Laba', key: 'line_profit', width: 20 },
  ];
  for (const [i, line] of kopLines(company).entries()) {
    const row = ws.addRow({ section: line });
    if (i === 0) row.font = { bold: true, size: 14 };
  }
  if (kopLines(company).length > 0) ws.addRow({});
  ws.addRow({ section: `BOQ: ${boq?.name ?? ''}` });
  ws.addRow({ section: `Project ID: ${boq?.project_id ?? ''} | Status: ${boq?.status ?? ''} | Versi: ${boq?.current_version ?? 0}` });
  ws.addRow({});
  const secName = new Map((sections || []).map((s) => [s.id, s.name]));
  const sorted = [...(items || [])].sort((a, b) => (a.section_id ?? 0) - (b.section_id ?? 0) || (a.order_index ?? 0) - (b.order_index ?? 0));
  let no = 1;
  for (const it of sorted) {
    const cost = lineCost(it);
    ws.addRow({
      section: secName.get(it.section_id) ?? '-',
      no: no++,
      name: it.name,
      volume: Number(it.volume) || 0,
      unit: it.unit,
      unit_price: Number(it.unit_price) || 0,
      line_total: Number(it.line_total ?? (Number(it.volume) || 0) * (Number(it.unit_price) || 0)) || 0,
      buy_price: (it.buy_price ?? it.buyPrice ?? null) === null ? '-' : (Number(it.buy_price ?? it.buyPrice) || 0),
      line_cost: cost === null ? '-' : cost,
      vendor: it.vendor_name ?? '-',
      line_profit: lineProfit(it) === null ? '-' : lineProfit(it),
    });
  }
  ws.addRow({});
  ws.addRow({ name: `GRAND TOTAL JUAL (${totals?.itemCount ?? sorted.length} item)`, line_total: totals?.grandTotal ?? 0 });
  if ((totals?.unknownCostCount ?? 0) === 0) {
    ws.addRow({ name: 'TOTAL BIAYA (BELI)', line_cost: totals?.totalCost ?? 0 });
    ws.addRow({ name: 'LABA KOTOR', line_profit: totals?.profit ?? 0 });
    ws.addRow({ name: 'MARGIN (%)', line_profit: totals?.profitMargin ?? 0 });
  } else {
    ws.addRow({ name: `TOTAL BIAYA BELUM LENGKAP (${totals?.unknownCostCount ?? 0} item tanpa harga beli)` });
  }
  return wb.xlsx.writeBuffer();
};

export const PDF_DEFAULT_OPTIONS = { company: true, project: true, ids: true, sections: true, items: true, total: true, cost: false };

export const parsePdfOptions = (query = {}) => {
  const FALSY = new Set(['0', 'false', 'no', 'off', '']);
  const pick = (key, def) => {
    if (query[key] === undefined) return def;
    return !FALSY.has(String(query[key]).trim().toLowerCase());
  };
  return {
    company: pick('show_company', true),
    project: pick('show_project', true),
    ids: pick('show_ids', true),
    sections: pick('show_sections', true),
    items: pick('show_items', true),
    total: pick('show_total', true),
    cost: pick('show_cost', false),
  };
};

export const exportBoqToPdf = async ({ boq, sections, items, totals, company = {}, project = null, options = {} }) => {
  const o = { ...PDF_DEFAULT_OPTIONS, ...options };
  const secName = new Map((sections || []).map((s) => [s.id, s.name]));
  const sorted = [...(items || [])].sort((a, b) => (a.section_id ?? 0) - (b.section_id ?? 0) || (a.order_index ?? 0) - (b.order_index ?? 0));
  const headCells = ['<th>No</th>', ...(o.sections ? ['<th>Section</th>'] : []), '<th>Uraian</th>', '<th>Vol</th>', '<th>Sat</th>', '<th>Harga Satuan</th>', '<th>Jumlah</th>', ...(o.cost ? ['<th>Harga Beli</th>', '<th>Jml. Beli</th>', '<th>Vendor</th>', '<th>Laba</th>'] : [])].join('');
  const rows = o.items
    ? sorted.map((it, i) => `<tr><td>${i + 1}</td>${o.sections ? `<td>${esc(secName.get(it.section_id) ?? '-')}</td>` : ''}<td>${esc(it.name)}</td><td style="text-align:right">${esc(it.volume)}</td><td>${esc(it.unit)}</td><td style="text-align:right">${fmtIDR(it.unit_price)}</td><td style="text-align:right">${fmtIDR(it.line_total)}</td>${o.cost ? `<td style="text-align:right">${fmtCost((it.buy_price ?? it.buyPrice ?? null) === null ? null : it.buy_price ?? it.buyPrice)}</td><td style="text-align:right">${fmtCost(lineCost(it))}</td><td>${esc(it.vendor_name ?? '-')}</td><td style="text-align:right">${fmtCost(lineProfit(it))}</td>` : ''}</tr>`).join('')
    : '';
  const sectionSummary = !o.items && o.sections
    ? `<table><thead><tr><th>Section / Pengerjaan</th><th>Subtotal</th></tr></thead><tbody>${(totals?.sectionTotals || []).map((st) => `<tr><td>${esc(st.name)}</td><td style="text-align:right">${fmtIDR(st.subtotal)}</td></tr>`).join('')}</tbody></table>`
    : '';
  const tableHtml = o.items
    ? `<table><thead><tr>${headCells}</tr></thead><tbody>${rows}</tbody></table>`
    : sectionSummary;
  const idsLine = o.ids ? `<p>ID Proyek: ${esc(boq?.project_id)} | ID BOQ: ${esc(boq?.id)} | Versi: ${esc(boq?.current_version ?? 0)} | Status: ${esc(boq?.status)}</p>` : '';
  const projectHtml = o.project && project?.name
    ? `<h2>${esc(project.name)}</h2>${project.description ? `<p>${esc(project.description)}</p>` : ''}`
    : '';
  const totalHtml = o.total ? `<h3>Grand Total: ${fmtIDR(totals?.grandTotal ?? 0)}</h3>` : '';
  const costHtml = o.cost
    ? ((totals?.unknownCostCount ?? 0) === 0
      ? `<h3>Total Biaya (Beli): ${fmtIDR(totals?.totalCost ?? 0)}</h3><h3>Laba Kotor: ${fmtIDR(totals?.profit ?? 0)} (${totals?.profitMargin ?? 0}%)</h3>`
      : `<p><i>Total biaya belum lengkap: ${totals?.unknownCostCount ?? 0} item tanpa harga beli.</i></p>`)
    : '';
  const kop = o.company ? kopLines(company) : [];
  const kopHtml = kop.length > 0
    ? `<div style="text-align:center;margin-bottom:4px"><div style="font-size:20px;font-weight:bold">${esc(kop[0])}</div>${kop.slice(1).map((l) => `<div>${esc(l)}</div>`).join('')}</div><hr style="border:2px double #000;margin:8px 0 16px">`
    : '';
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:6px}th{background:#eee}</style></head><body>${kopHtml}<h1>${esc(boq?.name ?? 'BOQ')}</h1>${idsLine}${projectHtml}${tableHtml}${totalHtml}${costHtml}</body></html>`;
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return Buffer.from(await page.pdf({ format: 'A4', printBackground: true }));
  } finally {
    await browser.close();
  }
};

export default { exportBoqToExcel, exportBoqToPdf, parsePdfOptions, PDF_DEFAULT_OPTIONS };
