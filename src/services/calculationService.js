const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export const calcLineTotal = (volume, unitPrice) => round2(toNum(volume) * toNum(unitPrice));

export const calcLineCost = (volume, buyPrice) => {
  if (buyPrice === undefined || buyPrice === null || buyPrice === '') return null;
  return round2(toNum(volume) * toNum(buyPrice));
};

export const summarizeBoq = (sections = [], items = []) => {
  const bySection = new Map();
  for (const s of sections) {
    bySection.set(s.id, { section_id: s.id, name: s.name, order_index: s.order_index ?? 0, subtotal: 0, itemCount: 0 });
  }
  let grandTotal = 0;
  let totalCost = 0;
  let unknownCostCount = 0;
  for (const it of items) {
    const line = calcLineTotal(it.volume, it.unit_price ?? it.unitPrice);
    grandTotal = round2(grandTotal + line);
    const cost = calcLineCost(it.volume, it.buy_price ?? it.buyPrice);
    if (cost === null) {
      unknownCostCount += 1;
    } else {
      totalCost = round2(totalCost + cost);
    }
    const key = it.section_id ?? it.sectionId ?? null;
    if (key !== null && bySection.has(key)) {
      const entry = bySection.get(key);
      entry.subtotal = round2(entry.subtotal + line);
      entry.itemCount += 1;
    }
  }
  const sectionTotals = [...bySection.values()].sort((a, b) => a.order_index - b.order_index);
  // Laba hanya valid bila seluruh harga beli diketahui.
  const profit = unknownCostCount === 0 ? round2(grandTotal - totalCost) : null;
  const profitMargin = profit !== null && grandTotal !== 0 ? round2((profit / grandTotal) * 100) : null;
  return { grandTotal, itemCount: items.length, sectionTotals, totalCost, unknownCostCount, profit, profitMargin };
};

export default { calcLineTotal, calcLineCost, summarizeBoq };
