import { Category } from '../models/index.js';

export const getAllCategories = async (req, res) => {
  const { project_id } = req.query;

  if (!project_id) {
    return res.status(400).json({
      success: false,
      message: 'project_id wajib disertakan.',
    });
  }

  try {
    const categories = await Category.findAll({
      where: {
        parent_id: null,
        project_id,
      },
      include: {
        model: Category,
        as: 'children',
        include: {
          model: Category,
          as: 'children'
        }
      },
      order: [['id', 'ASC']]
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Gagal ambil kategori:', error);
    res.status(500).json({ success: false, message: 'Gagal ambil data kategori' });
  }
};

export const createCategory = async (req, res) => {
  const { name, parent_id, project_id } = req.body;

  if (!name || !project_id) {
    return res.status(400).json({
      success: false,
      message: 'Nama dan project_id wajib diisi.',
    });
  }

  try {
    const newCategory = await Category.create({ name, parent_id, project_id });
    res.status(201).json({ success: true, data: newCategory });
  } catch (error) {
    console.error('Gagal tambah kategori:', error);
    res.status(500).json({ success: false, message: 'Gagal tambah kategori' });
  }
};

export const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, parent_id } = req.body;

  try {
    await Category.update({ name, parent_id }, { where: { id } });
    res.json({ success: true, message: 'Kategori berhasil diperbarui' });
  } catch (error) {
    console.error('Gagal update kategori:', error);
    res.status(500).json({ success: false, message: 'Gagal update kategori' });
  }
};

export const deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    await Category.destroy({ where: { id } });
    res.json({ success: true, message: 'Kategori berhasil dihapus' });
  } catch (error) {
    console.error('Gagal hapus kategori:', error);
    res.status(500).json({ success: false, message: 'Gagal hapus kategori' });
  }
};
