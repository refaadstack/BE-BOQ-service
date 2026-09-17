import { Boq, BoqSection, BoqItem } from '../models/index.js';
import * as models from '../models/index.js';
import { getBoqDetail } from '../utils/boqUtil.js';
import axios from 'axios';
import { exportBoqToExcel, exportBoqToPdf, parsePdfOptions } from '../services/exportService.js';
import { loadCompany } from './settingsController.js';
import { parseId } from '../utils/boqUtil.js';

export const listBoqs = async (req, res) => {
  const projectId = parseId(req.query.project_id);
  if (!projectId) {
    return res.status(400).json({ success: false, message: 'project_id wajib diisi.' });
  }
  try {
    const boqs = await Boq.findAll({
      where: { project_id: projectId },
      order: [['id', 'ASC']],
    });
    return res.json({ success: true, data: boqs });
  } catch (error) {
    console.error('Gagal ambil daftar BOQ:', error);
    return res.status(500).json({ success: false, message: 'Gagal ambil daftar BOQ' });
  }
};

export const createBoq = async (req, res) => {
  const projectId = parseId(req.body?.project_id);
  const name = req.body?.name?.trim?.() ?? '';
  if (!projectId || !name) {
    return res.status(400).json({ success: false, message: 'project_id dan name wajib diisi.' });
  }
  try {
    const boq = await Boq.create({
      project_id: projectId,
      name,
      description: req.body.description ?? null,
    });
    return res.status(201).json({ success: true, message: 'BOQ berhasil dibuat', data: boq });
  } catch (error) {
    console.error('Gagal buat BOQ:', error);
    return res.status(500).json({ success: false, message: 'Gagal membuat BOQ' });
  }
};

export const getBoq = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'ID BOQ tidak valid.' });
  try {
    const detail = await getBoqDetail(models, id);
    if (!detail) return res.status(404).json({ success: false, message: 'BOQ tidak ditemukan.' });
    return res.json({ success: true, data: detail });
  } catch (error) {
    console.error('Gagal ambil BOQ:', error);
    return res.status(500).json({ success: false, message: 'Gagal ambil BOQ' });
  }
};

export const updateBoq = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'ID BOQ tidak valid.' });
  try {
    const boq = await Boq.findByPk(id);
    if (!boq) return res.status(404).json({ success: false, message: 'BOQ tidak ditemukan.' });
    if (!['draft', 'rejected'].includes(boq.status)) {
      return res.status(409).json({ success: false, message: 'BOQ yang sudah diajukan/disetujui tidak dapat diubah.' });
    }
    const patch = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ success: false, message: 'Nama BOQ tidak boleh kosong.' });
      patch.name = name;
    }
    if (req.body.description !== undefined) patch.description = req.body.description || null;
    await boq.update(patch);
    return res.json({ success: true, message: 'BOQ berhasil diperbarui', data: boq });
  } catch (error) {
    console.error('Gagal update BOQ:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui BOQ' });
  }
};

// Kolom internal (harga beli/laba) hanya untuk pemegang izin.
// Token lama tanpa klaim permissions diizinkan (kompatibel mundur).
const canSeeInternal = (user) => {
  if (!user) return false;
  if (user.roles === 'admin') return true;
  const granted = user.permissions;
  if (!Array.isArray(granted)) return true;
  return granted.includes('*') || granted.includes('boq.export.internal');
};

const loadProject = async (req, projectId) => {
  if (!projectId) return null;
  try {
    const base = process.env.PROJECT_SERVICE_URL || 'http://project:3004';
    const res = await axios.get(`${base}/api/projects/${projectId}`, {
      headers: { Authorization: req.headers?.authorization || '' },
      timeout: 5000,
    });
    const d = res.data?.data ?? res.data;
    if (!d || typeof d !== 'object') return null;
    return { id: d.id, name: d.name, description: d.description };
  } catch {
    return null;
  }
};

export const deleteBoq = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'ID BOQ tidak valid.' });
  try {
    const boq = await Boq.findByPk(id);
    if (!boq) return res.status(404).json({ success: false, message: 'BOQ tidak ditemukan.' });
    const { BoqVersion, BoqApproval } = models;
    const versions = await BoqVersion.findAll({ where: { boq_id: id } });
    const versionIds = versions.map((v) => v.id);
    if (versionIds.length > 0) {
      await BoqApproval.destroy({ where: { boq_id: id } });
      await BoqVersion.destroy({ where: { boq_id: id } });
    }
    await BoqItem.destroy({ where: { boq_id: id } });
    await BoqSection.destroy({ where: { boq_id: id } });
    await boq.destroy();
    return res.json({ success: true, message: 'BOQ berhasil dihapus' });
  } catch (error) {
    console.error('Gagal hapus BOQ:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus BOQ' });
  }
};

export const exportBoq = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'ID BOQ tidak valid.' });
  const format = String(req.query.format ?? 'xlsx').toLowerCase();
  if (!['xlsx', 'pdf'].includes(format)) {
    return res.status(400).json({ success: false, message: 'Format harus xlsx atau pdf.' });
  }
  try {
    const detail = await getBoqDetail(models, id);
    if (!detail) return res.status(404).json({ success: false, message: 'BOQ tidak ditemukan.' });
    detail.company = await loadCompany(models);
    detail.options = parsePdfOptions(req.query) || {};
    const wantsInternal = format === 'xlsx' || detail.options.cost === true;
    if (wantsInternal && !canSeeInternal(req.user)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Butuh izin: boq.export.internal.' });
    }
    if (format === 'pdf') {
      detail.project = await loadProject(req, detail.boq?.project_id);
      const rawPdf = await exportBoqToPdf(detail);
      const buf = Buffer.isBuffer(rawPdf) ? rawPdf : Buffer.from(rawPdf);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="boq-${id}-v${detail.boq.current_version ?? 0}.pdf"`);
      return res.send(buf);
    }
    const rawXlsx = await exportBoqToExcel(detail);
    const buf = Buffer.isBuffer(rawXlsx) ? rawXlsx : Buffer.from(rawXlsx);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="boq-${id}-v${detail.boq.current_version ?? 0}.xlsx"`);
    return res.send(buf);
  } catch (error) {
    console.error('Gagal export BOQ:', error);
    return res.status(500).json({ success: false, message: 'Gagal export BOQ' });
  }
};
