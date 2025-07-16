import { Category, ProjectItem } from '../models/index.js';
import { Op } from 'sequelize';

export const getProjectBoq = async (req, res) => {
  const projectId = req.params.projectId;

  try {
    // Ambil semua item project (untuk mendapatkan kategori yang terpakai)
    const itemsRaw = await ProjectItem.findAll({
      where: { project_id: projectId },
      attributes: ['id', 'item_id', 'volume', 'unit_price', 'notes', 'category_id'],
    });

    const usedCategoryIds = [...new Set(itemsRaw.map(item => item.category_id))];

    // Ambil kategori root beserta anak-anaknya
    const rootCategories = await Category.findAll({
      where: { parent_id: null },
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

    // Hanya ambil kategori yang terpakai
    const filterCategoriesWithItems = (categories) => {
      return categories
        .filter(cat =>
          usedCategoryIds.includes(cat.id) ||
          (cat.children && cat.children.some(child =>
            usedCategoryIds.includes(child.id) ||
            (child.children && child.children.some(grandchild => usedCategoryIds.includes(grandchild.id)))
          ))
        )
        .map(cat => ({
          ...cat.toJSON(),
          children: cat.children
            ?.filter(child =>
              usedCategoryIds.includes(child.id) ||
              (child.children && child.children.some(grandchild => usedCategoryIds.includes(grandchild.id)))
            )
            .map(child => ({
              ...child,
              children: child.children?.filter(grandchild => usedCategoryIds.includes(grandchild.id)) || []
            })) || []
        }));
    };

    const filteredCategories = filterCategoriesWithItems(rootCategories);

    // Kelompokkan item berdasarkan category_id
    const itemsByCategory = {};
    itemsRaw.forEach(item => {
      const catId = item.category_id;
      if (!itemsByCategory[catId]) {
        itemsByCategory[catId] = [];
      }
      itemsByCategory[catId].push({
        id: item.id,
        item_id: item.item_id,
        volume: item.volume,
        unit_price: parseFloat(item.unit_price),
        notes: item.notes
      });
    });

    return res.json({
      success: true,
      data: {
        categories: filteredCategories,
        items: itemsByCategory
      }
    });
  } catch (error) {
    console.error('Failed to fetch BOQ data:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch BOQ data' });
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
      category_id
    });

    return res.status(201).json({
      success: true,
      message: 'Item berhasil ditambahkan ke proyek',
      data: newItem
    });
  } catch (error) {
    console.error('❌ Gagal tambah item:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menambahkan item',
      error: error.message
    });
  }
};
