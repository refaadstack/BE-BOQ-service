export default (sequelize, DataTypes) => {
  const BoqItem = sequelize.define("BoqItem", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    boq_id: { type: DataTypes.INTEGER, allowNull: false },
    section_id: { type: DataTypes.INTEGER, allowNull: true },
    item_id: { type: DataTypes.INTEGER, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    unit: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "unit" },
    volume: { type: DataTypes.DECIMAL(20, 4), allowNull: false, defaultValue: 0 },
    unit_price: { type: DataTypes.DECIMAL(20, 2), allowNull: false, defaultValue: 0 },
    line_total: { type: DataTypes.DECIMAL(20, 2), allowNull: false, defaultValue: 0 },
    buy_price: { type: DataTypes.DECIMAL(20, 2), allowNull: true, defaultValue: null, comment: 'Harga beli satuan; NULL = belum diketahui' },
    vendor_id: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null, comment: 'Referensi vendor (Vendor Service), tanpa FK lintas DB' },
    vendor_name: { type: DataTypes.STRING, allowNull: true, defaultValue: null, comment: 'Snapshot nama vendor' },
    order_index: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    parent_id: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    tableName: "boq_items",
    underscored: true,
    timestamps: true,
    hooks: {
      beforeValidate: (row) => {
        const v = Number(row.volume ?? 0);
        const p = Number(row.unit_price ?? 0);
        const total = Math.round(((Number.isFinite(v) ? v : 0) * (Number.isFinite(p) ? p : 0)) * 100) / 100;
        row.line_total = total;
      },
    },
  });
  return BoqItem;
};
