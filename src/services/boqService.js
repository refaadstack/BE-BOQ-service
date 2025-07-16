const { BoqCategory, BoqItem, BoqTemplate, BoqExport } = require('../models');

const getBoqByProject = async (projectId) => {
  const categories = await BoqCategory.findAll({
    where: { project_id: projectId, is_active: true },
    include: [{ model: BoqItem, where: { is_active: true }, required: false }],
    order: [['order_seq', 'ASC'], ['id', 'ASC']],
  });
  return categories;
};

const createBoqStructure = async (projectId, boqData) => {
  // Implementation to create BOQ structure with categories and items
  // This is a placeholder for actual logic
  // Should handle hierarchical categories and items creation
  return true;
};

const updateBoqStructure = async (projectId, boqData) => {
  // Implementation to update BOQ structure
  return true;
};

const deleteBoqByProject = async (projectId) => {
  // Soft delete categories and items by setting is_active to false
  await BoqCategory.update({ is_active: false }, { where: { project_id: projectId } });
  await BoqItem.update({ is_active: false }, { where: { project_id: projectId } });
  return true;
};

module.exports = {
  getBoqByProject,
  createBoqStructure,
  updateBoqStructure,
  deleteBoqByProject,
};
