import { Boq, BoqSection, BoqItem } from '../models/index.js';
import * as models from '../models/index.js';
import { parseId, isEditable, refreshGrandTotal } from '../utils/boqUtil.js';

const loadBoqOr404 = async (boqId) => {
  const boq = await Boq.findByPk(boqId);
  return boq;
};

export const listSections = async (req, res) => {
  const boqId = parseId(req.params.boqId);
  if (!boqId) return res.status(400).json({ success: false, message: 'ID BOQ tidak valid.' });
  try {
    if (!(await loadBoqOr404(boqId))) {
      return res.status(404).json({ success: false, message: 'BOQ tidak ditemukan.' });
    }
    const sections = await BoqSection.findAll({
      where: { boq_id: boqId },
      order: [['order_index', 'ASC'], ['id', 'ASC']],
    });
    return res.json({ success: true, data: sections });
  } catch (error) {
    console.error('Gagal ambil sections:', error);
    return res.status(500).json({ success: false, message: 'Gagal ambil sections' });
  }
};

export const createSection = async (req, res) => {
  const boqId = parseId(req.params.boqId);
  const name = req.body?.name?.trim?.() ?? '';
  if (!boqId) return res.status(400).json({ success: false, message: 'ID BOQ tidak valid.' });
  if (!name) return res.status(400).json({ success: false, message: 'Nama section wajib diisi.' });
  try {
    const boq = await loadBoqOr404(boqId);
    if (!boq) return res.status(404).json({ success: false, message: 'BOQ tidak ditemukan.' });
    if (!isEditable(boq)) {
      return res.status(409).json({ success: false, message: 'BOQ terkunci (sudah diajukan/disetujui).' });
    }
    const existing = await BoqSection.findAll({ where: { boq_id: boqId } });
    const orderIndex = req.body.order_index ?? (existing.reduce((m, s) => Math.max(m, s.order_index ?? 0), -1) + 1);
    const section = await BoqSection.create({ boq_id: boqId, name, order_index: orderIndex });
    return res.status(201).json({ success: true, message: 'Section berhasil dibuat', data: section });
  } catch (error) {
    console.error('Gagal buat section:', error);
    return res.status(500).json({ success: false, message: 'Gagal membuat section' });
  }
};

export const updateSection = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'ID section tidak valid.' });
  try {
    const section = await BoqSection.findByPk(id);
    if (!section) return res.status(404).json({ success: false, message: 'Section tidak ditemukan.' });
    const boq = await loadBoqOr404(section.boq_id);
    if (!isEditable(boq)) {
      return res.status(409).json({ success: false, message: 'BOQ terkunci (sudah diajukan/disetujui).' });
    }
    const patch = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ success: false, message: 'Nama section tidak boleh kosong.' });
      patch.name = name;
    }
    if (req.body.order_index !== undefined) patch.order_index = Number(req.body.order_index) || 0;
    await section.update(patch);
    return res.json({ success: true, message: 'Section berhasil diperbarui', data: section });
  } catch (error) {
    console.error('Gagal update section:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui section' });
  }
};

export const deleteSection = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'ID section tidak valid.' });
  try {
    const section = await BoqSection.findByPk(id);
    if (!section) return res.status(404).json({ success: false, message: 'Section tidak ditemukan.' });
    const boq = await loadBoqOr404(section.boq_id);
    if (!isEditable(boq)) {
      return res.status(409).json({ success: false, message: 'BOQ terkunci (sudah diajukan/disetujui).' });
    }
    await BoqItem.update({ section_id: null }, { where: { section_id: id } });
    await section.destroy();
    await refreshGrandTotal(models, section.boq_id);
    return res.json({ success: true, message: 'Section berhasil dihapus' });
  } catch (error) {
    console.error('Gagal hapus section:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus section' });
  }
};
