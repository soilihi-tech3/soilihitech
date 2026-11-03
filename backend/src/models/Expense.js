const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Expense = sequelize.define("Expense", {
  boutiqueId: { type: DataTypes.INTEGER, allowNull: false },
  creeParId: { type: DataTypes.INTEGER, allowNull: true },
  titre: { type: DataTypes.STRING(255), allowNull: false },
  montant: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  devise: { type: DataTypes.STRING(10), defaultValue: "KMF" },
  categorie: { type: DataTypes.STRING(50), defaultValue: "autre" },
  dateDepense: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  beneficiaire: { type: DataTypes.STRING(255), allowNull: true },
  moyenPaiement: { type: DataTypes.STRING(50), defaultValue: "especes" },
  notes: { type: DataTypes.TEXT, allowNull: true },
  justificatifUrl: { type: DataTypes.TEXT, allowNull: true }
}, { tableName: "expenses" });

module.exports = Expense;
