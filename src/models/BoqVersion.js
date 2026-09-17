export default (sequelize, DataTypes) => {
  const BoqVersion = sequelize.define("BoqVersion", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    boq_id: { type: DataTypes.INTEGER, allowNull: false },
    version_no: { type: DataTypes.INTEGER, allowNull: false },
    status: {
      type: DataTypes.ENUM("draft", "submitted", "approved", "rejected"),
      allowNull: false,
      defaultValue: "submitted",
    },
    snapshot: { type: DataTypes.JSON, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    note: { type: DataTypes.TEXT, allowNull: true },
  }, {
    tableName: "boq_versions",
    underscored: true,
    timestamps: true,
    indexes: [{ unique: true, fields: ["boq_id", "version_no"] }],
  });
  return BoqVersion;
};
