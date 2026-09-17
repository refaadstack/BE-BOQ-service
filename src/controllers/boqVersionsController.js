import { Boq, BoqSection, BoqItem, BoqVersion, BoqApproval } from '../models/index.js';
import { parseId, plain } from '../utils/boqUtil.js';
import { summarizeBoq } from '../services/calculationService.js';

export const listVersions = async (req, res) => {
  const boqId = parseId(req.params.boqId);
  if (!boqId) return res.status(400).json({ success: false, message: 'ID BOQ tidak valid.' });
  try {
    if (!(await Boq.findByPk(boqId))) {
      return res.status(404).json({ success: false, message: 'BOQ tidak ditemukan.' });
    }
    const versions = await BoqVersion.findAll({
      where: { boq_id: boqId },
      order: [['version_no', 'DESC']],
    });
    return res.json({ success: true, data: versions });
  } catch (error) {
    console.error('Gagal ambil versi:', error);
    return res.status(500).json({ success: false, message: 'Gagal ambil versi BOQ' });
  }
};

export const getVersion = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'ID versi tidak valid.' });
  try {
    const version = await BoqVersion.findByPk(id);
    if (!version) return res.status(404).json({ success: false, message: 'Versi tidak ditemukan.' });
    return res.json({ success: true, data: version });
  } catch (error) {
    console.error('Gagal ambil versi:', error);
    return res.status(500).json({ success: false, message: 'Gagal ambil versi BOQ' });
  }
};

export const submitForApproval = async (req, res) => {
  const boqId = parseId(req.params.boqId);
  if (!boqId) return res.status(400).json({ success: false, message: 'ID BOQ tidak valid.' });
  try {
    const boq = await Boq.findByPk(boqId);
    if (!boq) return res.status(404).json({ success: false, message: 'BOQ tidak ditemukan.' });
    if (!['draft', 'rejected'].includes(boq.status)) {
      return res.status(409).json({ success: false, message: 'Hanya BOQ draft/ditolak yang dapat diajukan.' });
    }
    const sections = await BoqSection.findAll({
      where: { boq_id: boqId },
      order: [['order_index', 'ASC'], ['id', 'ASC']],
    });
    const items = await BoqItem.findAll({
      where: { boq_id: boqId },
      order: [['section_id', 'ASC'], ['order_index', 'ASC'], ['id', 'ASC']],
    });
    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'BOQ kosong, tambah item terlebih dahulu.' });
    }
    const totals = summarizeBoq(sections.map(plain), items.map(plain));
    const versionNo = (boq.current_version ?? 0) + 1;
    const note = req.body?.note ?? null;
    const snapshot = {
      boq: { id: boq.id, project_id: boq.project_id, name: plain(boq).name ?? boq.name },
      sections: sections.map(plain),
      items: items.map(plain),
      totals,
      submittedAt: new Date().toISOString(),
    };
    const version = await BoqVersion.create({
      boq_id: boqId,
      version_no: versionNo,
      status: 'submitted',
      snapshot,
      created_by: req.user?.userId ?? null,
      note,
    });
    await BoqApproval.create({
      boq_id: boqId,
      version_id: version.id,
      action: 'submit',
      actor_id: req.user?.userId ?? null,
      actor_role: req.user?.roles ?? null,
      note,
    });
    await boq.update({ status: 'submitted', current_version: versionNo, grand_total: totals.grandTotal });
    return res.status(201).json({ success: true, message: `BOQ diajukan sebagai versi ${versionNo}`, data: version });
  } catch (error) {
    console.error('Gagal submit BOQ:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengajukan BOQ' });
  }
};

export const decideVersion = (action) => async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'ID versi tidak valid.' });
  try {
    const version = await BoqVersion.findByPk(id);
    if (!version) return res.status(404).json({ success: false, message: 'Versi tidak ditemukan.' });
    if (version.status !== 'submitted') {
      return res.status(409).json({ success: false, message: 'Hanya versi berstatus submitted yang dapat diputuskan.' });
    }
    const boq = await Boq.findByPk(version.boq_id);
    if (!boq) return res.status(404).json({ success: false, message: 'BOQ tidak ditemukan.' });
    if ((boq.current_version ?? 0) !== version.version_no) {
      return res.status(409).json({ success: false, message: 'Hanya versi terbaru yang dapat diputuskan.' });
    }
    const note = req.body?.note ?? null;
    const next = action === 'approve' ? 'approved' : 'rejected';
    await version.update({ status: next });
    await boq.update({ status: next });
    await BoqApproval.create({
      boq_id: boq.id,
      version_id: version.id,
      action,
      actor_id: req.user?.userId ?? null,
      actor_role: req.user?.roles ?? null,
      note,
    });
    return res.json({ success: true, message: `Versi ${version.version_no} ${next === 'approved' ? 'disetujui' : 'ditolak'}`, data: version });
  } catch (error) {
    console.error('Gagal memutuskan versi:', error);
    return res.status(500).json({ success: false, message: 'Gagal memproses approval' });
  }
};

export const listApprovals = async (req, res) => {
  const boqId = parseId(req.params.boqId);
  if (!boqId) return res.status(400).json({ success: false, message: 'ID BOQ tidak valid.' });
  try {
    if (!(await Boq.findByPk(boqId))) {
      return res.status(404).json({ success: false, message: 'BOQ tidak ditemukan.' });
    }
    const rows = await BoqApproval.findAll({
      where: { boq_id: boqId },
      order: [['id', 'ASC']],
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Gagal ambil riwayat approval:', error);
    return res.status(500).json({ success: false, message: 'Gagal ambil riwayat approval' });
  }
};
