const formatCurrency = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
  }).format(amount);
};

const generateNumbering = (categories) => {
  // Generate hierarchical numbering like 1, 1.1, 1.1.1 etc.
  const numberingMap = {};

  const assignNumbering = (category, prefix = '') => {
    const siblings = categories.filter(cat => cat.parent_id === category.parent_id);
    const index = siblings.findIndex(cat => cat.id === category.id) + 1;
    const number = prefix ? prefix + '.' + index : '' + index;
    numberingMap[category.id] = number;

    const children = categories.filter(cat => cat.parent_id === category.id);
    children.forEach(child => assignNumbering(child, number));
  };

  const roots = categories.filter(cat => !cat.parent_id);
  roots.forEach(root => assignNumbering(root));

  return numberingMap;
};

module.exports = {
  formatCurrency,
  generateNumbering,
};
