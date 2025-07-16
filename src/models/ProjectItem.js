export default (sequelize, DataTypes) => {
  const ProjectItem = sequelize.define("ProjectItem", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    project_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    volume: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    unit_price: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    notes: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    tableName: "project_items",
    underscored: true,
    timestamps: true,
  });

  return ProjectItem;
};
