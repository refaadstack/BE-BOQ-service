import { Sequelize, DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

import CategoryModel from './Category.js';
import ProjectItemModel from './ProjectItem.js';
import BoqModel from './Boq.js';
import BoqSectionModel from './BoqSection.js';
import BoqItemModel from './BoqItem.js';
import BoqVersionModel from './BoqVersion.js';
import BoqApprovalModel from './BoqApproval.js';
import SettingModel from './Setting.js';

const Category = CategoryModel(sequelize, DataTypes);
const ProjectItem = ProjectItemModel(sequelize, DataTypes);
const Boq = BoqModel(sequelize, DataTypes);
const BoqSection = BoqSectionModel(sequelize, DataTypes);
const BoqItem = BoqItemModel(sequelize, DataTypes);
const BoqVersion = BoqVersionModel(sequelize, DataTypes);
const BoqApproval = BoqApprovalModel(sequelize, DataTypes);
const Setting = SettingModel(sequelize, DataTypes);

// Relasi legacy
Category.hasMany(Category, { foreignKey: 'parent_id', as: 'children' });
Category.belongsTo(Category, { foreignKey: 'parent_id', as: 'parent' });

ProjectItem.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Category.hasMany(ProjectItem, { foreignKey: 'category_id', as: 'projectItems' });

// Relasi BOQ MVP
Boq.hasMany(BoqSection, { foreignKey: 'boq_id', as: 'sections', onDelete: 'CASCADE' });
BoqSection.belongsTo(Boq, { foreignKey: 'boq_id', as: 'boq' });

Boq.hasMany(BoqItem, { foreignKey: 'boq_id', as: 'items', onDelete: 'CASCADE' });
BoqItem.belongsTo(Boq, { foreignKey: 'boq_id', as: 'boq' });

BoqSection.hasMany(BoqItem, { foreignKey: 'section_id', as: 'items', onDelete: 'SET NULL' });
BoqItem.belongsTo(BoqSection, { foreignKey: 'section_id', as: 'section' });

Boq.hasMany(BoqVersion, { foreignKey: 'boq_id', as: 'versions', onDelete: 'CASCADE' });
BoqVersion.belongsTo(Boq, { foreignKey: 'boq_id', as: 'boq' });

Boq.hasMany(BoqApproval, { foreignKey: 'boq_id', as: 'approvals', onDelete: 'CASCADE' });
BoqApproval.belongsTo(Boq, { foreignKey: 'boq_id', as: 'boq' });

BoqVersion.hasMany(BoqApproval, { foreignKey: 'version_id', as: 'approvals', onDelete: 'CASCADE' });
BoqApproval.belongsTo(BoqVersion, { foreignKey: 'version_id', as: 'version' });

export {
  sequelize,
  ProjectItem,
  Category,
  Boq,
  BoqSection,
  BoqItem,
  BoqVersion,
  BoqApproval,
  Setting,
};
