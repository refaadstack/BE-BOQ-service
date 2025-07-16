const calculateJumlahHarga = (volume, hargaSatuan) => {
  return volume * hargaSatuan;
};

const calculateCategorySubtotal = (items) => {
  return items.reduce((sum, item) => sum + item.jumlah_harga, 0);
};

const calculateGrandTotal = (categories) => {
  return categories.reduce((sum, category) => {
    const subtotal = calculateCategorySubtotal(category.BoqItems || []);
    return sum + subtotal;
  }, 0);
};

const applyTax = (amount, taxRate) => {
  return amount + amount * taxRate;
};

const applyDiscount = (amount, discount) => {
  return amount - discount;
};

module.exports = {
  calculateJumlahHarga,
  calculateCategorySubtotal,
  calculateGrandTotal,
  applyTax,
  applyDiscount,
};
