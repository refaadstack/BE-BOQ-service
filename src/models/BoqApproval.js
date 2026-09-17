export default (sequelize, DataTypes) => {
  const BoqApproval = sequelize.define("BoqApproval", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    boq_id: { type: DataTypes.INTEGER, allowNull: false },
    version_id: { type: DataTypes.INTEGER, allowNull: false },
    action: {
      type: DataTypes.ENUM("submit", "approve", "reject"),
      allowNull: false,
    },
    actor_id: { type: DataTypes.INTEGER, allowNull: true },
    actor_role: { type: DataTypes.STRING(32), allowNull: true },
    note: { type: DataTypes.TEXT, allowNull: true },
  }, { tableName: "boq_approvals", underscored: true, timestamps: true });
  return BoqApproval;
};
