import { Category, ProjectItem } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Utility untuk mengubah instance Sequelize menjadi plain object
 * dan menghapus properti circular seperti `parent`.
 */
const serializeCategory = (category) => {
  const plain = category.toJSON();
  delete plain.parent; // hapus circular reference
  if (plain.children) {
    plain.children = plain.children.map(child => serializeCategory(child));
  }
  return plain;
};

export const getProjectBoq = async (req, res) => {
  const { projectId } = req.params;

  try {
    // Ambil kategori dengan struktur parent-child
    const categories = await Category.findAll({
      where: { project_id: projectId, parent_id: null },
      include: {
        model: Category,
        as: 'children',
        include: {
          model: Category,
          as: 'children',
        }
      },
      order: [['id', 'ASC']],
    });

    // Ambil semua item per kategori
    const projectItems = await ProjectItem.findAll({
      where: { project_id: projectId },
    });

    // Kelompokkan item berdasarkan kategori_id
    const items = {};
    projectItems.forEach((item) => {
      if (!items[item.category_id]) {
        items[item.category_id] = [];
      }
      items[item.category_id].push(item);
    });

    res.json({
      success: true,
      data: {
        categories,
        items,
      },
    });
  } catch (error) {
    console.error('Gagal ambil data BOQ:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal ambil data BOQ',
    });
  }
};

export const addProjectItem = async (req, res) => {
  const { projectId } = req.params;
  const { item_id, volume, unit_price, notes, category_id } = req.body;

  try {
    const newItem = await ProjectItem.create({
      project_id: projectId,
      item_id,
      volume,
      unit_price,
      notes,
      category_id,
    });

    return res.status(201).json({
      success: true,
      message: 'Item berhasil ditambahkan ke proyek',
      data: newItem,
    });
  } catch (error) {
    console.error('❌ Gagal tambah item:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menambahkan item',
      error: error.message,
    });
  }
};
export const updateProjectItem = async (req, res) => {
  const { id } = req.params;
  const { item_id, volume, unit_price, notes, category_id } = req.body;

  try {
    const [updated] = await ProjectItem.update(
      { item_id, volume, unit_price, notes, category_id },
      { where: { id } }
    );

    if (updated === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item tidak ditemukan atau tidak diubah',
      });
    }

    return res.json({
      success: true,
      message: 'Item berhasil diperbarui',
    });
  } catch (error) {
    console.error('❌ Gagal update item:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui item',
      error: error.message,
    });
  }
};

export const deleteProjectItem = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await ProjectItem.destroy({ where: { id } });

    if (deleted === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item tidak ditemukan',
      });
    }

    return res.json({
      success: true,
      message: 'Item berhasil dihapus',
    });
  } catch (error) {
    console.error('❌ Gagal hapus item:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menghapus item',
      error: error.message,
    });
  }
};
