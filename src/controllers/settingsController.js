import { Setting } from '../models/index.js';

export const SETTING_KEYS = [
  'company_name',
  'company_tagline',
  'company_address',
  'company_phone',
  'company_email',
];

const MAX_LEN = 500;

export const getSettings = async (req, res) => {
  try {
    const rows = await Setting.findAll();
    const data = Object.fromEntries(SETTING_KEYS.map((k) => [k, '']));
    for (const r of rows) {
      if (SETTING_KEYS.includes(r.key)) data[r.key] = r.value ?? '';
    }
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Gagal ambil pengaturan:', error);
    return res.status(500).json({ success: false, message: 'Gagal ambil pengaturan' });
  }
};

export const updateSettings = async (req, res) => {
  const body = req.body ?? {};
  const unknown = Object.keys(body).filter((k) => !SETTING_KEYS.includes(k));
  if (unknown.length > 0) {
    return res.status(400).json({ success: false, message: `Kunci tidak dikenal: ${unknown.join(', ')}` });
  }
  for (const [k, v] of Object.entries(body)) {
    if (v !== null && v !== undefined && String(v).length > MAX_LEN) {
      return res.status(400).json({ success: false, message: `Nilai ${k} maksimal ${MAX_LEN} karakter.` });
    }
  }
  try {
    for (const [k, v] of Object.entries(body)) {
      const value = v ?? null;
      const row = await Setting.findOne({ where: { key: k } });
      if (row) await row.update({ value });
      else await Setting.create({ key: k, value });
    }
    const rows = await Setting.findAll();
    const data = Object.fromEntries(SETTING_KEYS.map((k) => [k, '']));
    for (const r of rows) {
      if (SETTING_KEYS.includes(r.key)) data[r.key] = r.value ?? '';
    }
    return res.json({ success: true, message: 'Pengaturan disimpan', data });
  } catch (error) {
    console.error('Gagal simpan pengaturan:', error);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan pengaturan' });
  }
};

export const loadCompany = async (models) => {
  try {
    const rows = await models.Setting.findAll();
    const company = {};
    for (const r of rows) {
      if (SETTING_KEYS.includes(r.key)) company[r.key] = r.value ?? '';
    }
    return company;
  } catch {
    return {};
  }
};
