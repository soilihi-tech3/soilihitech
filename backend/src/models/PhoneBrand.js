const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PhoneBrand = sequelize.define("PhoneBrand", {
  boutiqueId: { type: DataTypes.INTEGER, allowNull: false },
  nom: { type: DataTypes.STRING(100), allowNull: false },
  iconeUrl: { type: DataTypes.TEXT("long"), allowNull: true, field: "icone_url" },
  ordre: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { 
  tableName: "phone_brands",
  timestamps: true 
});

module.exports = PhoneBrand;
