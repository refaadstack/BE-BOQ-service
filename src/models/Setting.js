export default (sequelize, DataTypes) => {
  const Setting = sequelize.define("Setting", {
    key: { type: DataTypes.STRING(64), primaryKey: true },
    value: { type: DataTypes.TEXT, allowNull: true },
  }, { tableName: "settings", underscored: true, timestamps: true });
  return Setting;
};
