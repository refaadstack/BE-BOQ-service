import { summarizeBoq } from '../services/calculationService.js';

export const parseId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const isEditable = (boq) => ['draft', 'rejected'].includes(boq?.status);

export const plain = (o) => (o && typeof o.toJSON === 'function' ? o.toJSON() : o);

export const getBoqDetail = async (models, boqId) => {
  const { Boq, BoqSection, BoqItem } = models;
  const boq = await Boq.findByPk(boqId);
  if (!boq) return null;
  const sections = await BoqSection.findAll({
    where: { boq_id: boqId },
    order: [['order_index', 'ASC'], ['id', 'ASC']],
  });
  const items = await BoqItem.findAll({
    where: { boq_id: boqId },
    order: [['section_id', 'ASC'], ['order_index', 'ASC'], ['id', 'ASC']],
  });
  const totals = summarizeBoq(sections.map(plain), items.map(plain));
  if (Number(boq.grand_total) !== totals.grandTotal && typeof boq.update === 'function') {
    await boq.update({ grand_total: totals.grandTotal });
    boq.grand_total = totals.grandTotal;
  }
  return { boq: plain(boq), sections: sections.map(plain), items: items.map(plain), totals };
};

export const refreshGrandTotal = async (models, boqId) => {
  const { Boq, BoqSection, BoqItem } = models;
  const boq = await Boq.findByPk(boqId);
  if (!boq) return;
  const sections = await BoqSection.findAll({ where: { boq_id: boqId } });
  const items = await BoqItem.findAll({ where: { boq_id: boqId } });
  const totals = summarizeBoq(sections.map(plain), items.map(plain));
  if (Number(boq.grand_total) !== totals.grandTotal) {
    await boq.update({ grand_total: totals.grandTotal });
  }
  return totals;
};
