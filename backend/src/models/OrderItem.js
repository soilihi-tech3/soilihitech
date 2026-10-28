const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const OrderItem = sequelize.define("OrderItem", {
  orderId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  quantite: { type: DataTypes.INTEGER, allowNull: false },
  prixUnitaire: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  marqueTelephone: { type: DataTypes.STRING(100), allowNull: true, field: "marque_telephone" },
  modele: { type: DataTypes.STRING(150), allowNull: true },
  couleur: { type: DataTypes.STRING(100), allowNull: true },
  imageUrl: { type: DataTypes.TEXT("long"), allowNull: true, field: "image_url" },
}, { tableName: "order_items", timestamps: false });

module.exports = OrderItem;
