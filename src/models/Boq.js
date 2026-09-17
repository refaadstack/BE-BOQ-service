export default (sequelize, DataTypes) => {
  const Boq = sequelize.define("Boq", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM("draft", "submitted", "approved", "rejected"),
      allowNull: false,
      defaultValue: "draft",
    },
    current_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    grand_total: { type: DataTypes.DECIMAL(20, 2), allowNull: false, defaultValue: 0 },
  }, { tableName: "boqs", underscored: true, timestamps: true });
  return Boq;
};
