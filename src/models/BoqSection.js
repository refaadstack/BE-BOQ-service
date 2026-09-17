export default (sequelize, DataTypes) => {
  const BoqSection = sequelize.define("BoqSection", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    boq_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    order_index: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { tableName: "boq_sections", underscored: true, timestamps: true });
  return BoqSection;
};
