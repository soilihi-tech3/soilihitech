const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Famille = sequelize.define("Famille", {
  boutiqueId: { type: DataTypes.INTEGER, allowNull: false },
  categoryId: { type: DataTypes.INTEGER, allowNull: true, field: "category_id" },
  nom: { type: DataTypes.STRING(100), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  imageUrl: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: "familles" });

module.exports = Famille;
