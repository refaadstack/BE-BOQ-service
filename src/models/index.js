import { Sequelize, DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

import CategoryModel from './Category.js';
import ProjectItemModel from './ProjectItem.js';

const Category = CategoryModel(sequelize, DataTypes);
const ProjectItem = ProjectItemModel(sequelize, DataTypes);

// Relasi
Category.hasMany(Category, { foreignKey: 'parent_id', as: 'children' });
Category.belongsTo(Category, { foreignKey: 'parent_id', as: 'parent' });

ProjectItem.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Category.hasMany(ProjectItem, { foreignKey: 'category_id', as: 'projectItems' });

export {
  sequelize,
  ProjectItem,
  Category,
};
