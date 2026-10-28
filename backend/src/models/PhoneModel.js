const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PhoneModel = sequelize.define("PhoneModel", {
  boutiqueId: { type: DataTypes.INTEGER, allowNull: false },
  brandId: { type: DataTypes.INTEGER, allowNull: false, field: "brand_id" },
  nom: { type: DataTypes.STRING(100), allowNull: false },
  nomComplet: { type: DataTypes.STRING(150), allowNull: true, field: "nom_complet" },
  ordre: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { 
  tableName: "phone_models",
  timestamps: true 
});

module.exports = PhoneModel;
