const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Saving = sequelize.define("Saving", {
  boutiqueId: { type: DataTypes.INTEGER, allowNull: false },
  creeParId: { type: DataTypes.INTEGER, allowNull: true },
  type: { type: DataTypes.STRING(20), defaultValue: "depot" }, // 'depot' ou 'retrait'
  montant: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  devise: { type: DataTypes.STRING(10), defaultValue: "KMF" },
  dateOperation: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  compte: { type: DataTypes.STRING(100), allowNull: true },
  reference: { type: DataTypes.STRING(100), allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true }
}, { tableName: "savings" });

module.exports = Saving;
