import { Boq, BoqSection, BoqItem } from '../models/index.js';
import * as models from '../models/index.js';
import { parseId, isEditable, refreshGrandTotal } from '../utils/boqUtil.js';
import { calcLineTotal } from '../services/calculationService.js';

const nonNeg = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

// Harga beli boleh kosong (NULL = belum diketahui), selain itu angka >= 0.
const optNonNeg = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

const optVendorId = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : NaN;
};

export const listItems = async (req, res) => {
  const boqId = parseId(req.params.boqId);
  if (!boqId) return res.status(400).json({ success: false, message: 'ID BOQ tidak valid.' });
  try {
    if (!(await Boq.findByPk(boqId))) {
      return res.status(404).json({ success: false, message: 'BOQ tidak ditemukan.' });
    }
    const where = { boq_id: boqId };
    if (req.query.section_id !== undefined) {
      const sid = parseId(req.query.section_id);
      if (!sid) return res.status(400).json({ success: false, message: 'section_id tidak valid.' });
      where.section_id = sid;
    }
    const items = await BoqItem.findAll({ where, order: [['order_index', 'ASC'], ['id', 'ASC']] });
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('Gagal ambil items:', error);
    return res.status(500).json({ success: false, message: 'Gagal ambil items' });
  }
};

export const createItem = async (req, res) => {
  const boqId = parseId(req.params.boqId);
  if (!boqId) return res.status(400).json({ success: false, message: 'ID BOQ tidak valid.' });
  const name = req.body?.name?.trim?.() ?? '';
  if (!name) return res.status(400).json({ success: false, message: 'Nama item wajib diisi.' });
  const volume = nonNeg(req.body?.volume ?? 0);
  const unitPrice = nonNeg(req.body?.unit_price ?? 0);
  const buyPrice = optNonNeg(req.body?.buy_price);
  const vendorId = optVendorId(req.body?.vendor_id);
  if (Number.isNaN(volume) || Number.isNaN(unitPrice)) {
    return res.status(400).json({ success: false, message: 'Volume dan harga satuan harus angka >= 0.' });
  }
  if (Number.isNaN(buyPrice)) {
    return res.status(400).json({ success: false, message: 'Harga beli harus angka >= 0 atau dikosongkan.' });
  }
  if (Number.isNaN(vendorId)) {
    return res.status(400).json({ success: false, message: 'vendor_id tidak valid.' });
  }
  try {
    const boq = await Boq.findByPk(boqId);
    if (!boq) return res.status(404).json({ success: false, message: 'BOQ tidak ditemukan.' });
    if (!isEditable(boq)) {
      return res.status(409).json({ success: false, message: 'BOQ terkunci (sudah diajukan/disetujui).' });
    }
    let sectionId = null;
    if (req.body?.section_id !== undefined && req.body.section_id !== null && req.body.section_id !== '') {
      sectionId = parseId(req.body.section_id);
      if (!sectionId) return res.status(400).json({ success: false, message: 'section_id tidak valid.' });
      const section = await BoqSection.findByPk(sectionId);
      if (!section || section.boq_id !== boqId) {
        return res.status(400).json({ success: false, message: 'Section tidak termasuk BOQ ini.' });
      }
    }
    const siblings = await BoqItem.findAll({ where: { boq_id: boqId } });
    const orderIndex = req.body?.order_index ?? (siblings.length);
    const item = await BoqItem.create({
      boq_id: boqId,
      section_id: sectionId,
      item_id: req.body?.item_id ?? null,
      name,
      description: req.body?.description ?? null,
      unit: req.body?.unit || 'unit',
      volume,
      unit_price: unitPrice,
      line_total: calcLineTotal(volume, unitPrice),
      buy_price: buyPrice,
      vendor_id: vendorId,
      vendor_name: req.body?.vendor_name ? String(req.body.vendor_name).slice(0, 255) : null,
      order_index: Number(orderIndex) || 0,
      parent_id: req.body?.parent_id ?? null,
    });
    await refreshGrandTotal(models, boqId);
    return res.status(201).json({ success: true, message: 'Item berhasil ditambahkan', data: item });
  } catch (error) {
    console.error('Gagal tambah item:', error);
    return res.status(500).json({ success: false, message: 'Gagal menambahkan item' });
  }
};

export const updateItem = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'ID item tidak valid.' });
  try {
    const item = await BoqItem.findByPk(id);
    if (!item) return res.status(404).json({ success: false, message: 'Item tidak ditemukan.' });
    const boq = await Boq.findByPk(item.boq_id);
    if (!isEditable(boq)) {
      return res.status(409).json({ success: false, message: 'BOQ terkunci (sudah diajukan/disetujui).' });
    }
    const patch = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ success: false, message: 'Nama item tidak boleh kosong.' });
      patch.name = name;
    }
    if (req.body.description !== undefined) patch.description = req.body.description || null;
    if (req.body.unit !== undefined) patch.unit = String(req.body.unit) || 'unit';
    let volume = Number(item.volume);
    let unitPrice = Number(item.unit_price);
    if (req.body.volume !== undefined) {
      volume = nonNeg(req.body.volume);
      if (Number.isNaN(volume)) return res.status(400).json({ success: false, message: 'Volume harus angka >= 0.' });
      patch.volume = volume;
    }
    if (req.body.unit_price !== undefined) {
      unitPrice = nonNeg(req.body.unit_price);
      if (Number.isNaN(unitPrice)) return res.status(400).json({ success: false, message: 'Harga satuan harus angka >= 0.' });
      patch.unit_price = unitPrice;
    }
    if (req.body.buy_price !== undefined) {
      const buyPrice = optNonNeg(req.body.buy_price);
      if (Number.isNaN(buyPrice)) return res.status(400).json({ success: false, message: 'Harga beli harus angka >= 0 atau dikosongkan.' });
      patch.buy_price = buyPrice;
    }
    if (req.body.vendor_id !== undefined) {
      const vendorId = optVendorId(req.body.vendor_id);
      if (Number.isNaN(vendorId)) return res.status(400).json({ success: false, message: 'vendor_id tidak valid.' });
      patch.vendor_id = vendorId;
      if (vendorId === null && req.body.vendor_name === undefined) patch.vendor_name = null;
    }
    if (req.body.vendor_name !== undefined) {
      patch.vendor_name = req.body.vendor_name ? String(req.body.vendor_name).slice(0, 255) : null;
    }
    if (patch.volume !== undefined || patch.unit_price !== undefined) {
      patch.line_total = calcLineTotal(volume, unitPrice);
    }
    if (req.body.section_id !== undefined) {
      if (req.body.section_id === null || req.body.section_id === '') {
        patch.section_id = null;
      } else {
        const sid = parseId(req.body.section_id);
        if (!sid) return res.status(400).json({ success: false, message: 'section_id tidak valid.' });
        const section = await BoqSection.findByPk(sid);
        if (!section || section.boq_id !== item.boq_id) {
          return res.status(400).json({ success: false, message: 'Section tidak termasuk BOQ ini.' });
        }
        patch.section_id = sid;
      }
    }
    if (req.body.order_index !== undefined) patch.order_index = Number(req.body.order_index) || 0;
    if (req.body.item_id !== undefined) patch.item_id = req.body.item_id ?? null;
    await item.update(patch);
    await refreshGrandTotal(models, item.boq_id);
    return res.json({ success: true, message: 'Item berhasil diperbarui', data: item });
  } catch (error) {
    console.error('Gagal update item:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui item' });
  }
};

export const deleteItem = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'ID item tidak valid.' });
  try {
    const item = await BoqItem.findByPk(id);
    if (!item) return res.status(404).json({ success: false, message: 'Item tidak ditemukan.' });
    const boq = await Boq.findByPk(item.boq_id);
    if (!isEditable(boq)) {
      return res.status(409).json({ success: false, message: 'BOQ terkunci (sudah diajukan/disetujui).' });
    }
    const boqId = item.boq_id;
    await item.destroy();
    await refreshGrandTotal(models, boqId);
    return res.json({ success: true, message: 'Item berhasil dihapus' });
  } catch (error) {
    console.error('Gagal hapus item:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus item' });
  }
};
