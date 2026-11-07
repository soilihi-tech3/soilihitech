const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Order = sequelize.define("Order", {
  boutiqueId: { type: DataTypes.INTEGER, allowNull: false },
  clientId: { type: DataTypes.INTEGER, allowNull: true },
  statut: {
    type: DataTypes.STRING(50),
    defaultValue: "en_attente",
  },
  modeLivraison: { type: DataTypes.ENUM("domicile", "retrait"), defaultValue: "domicile" },
  adresseLivraison: { type: DataTypes.STRING(255), allowNull: true },
  moyenPaiement: { type: DataTypes.STRING(50), defaultValue: "cash" },
  typeVente: { type: DataTypes.STRING(30), defaultValue: "commande_enligne" },
  employeAssigneId: { type: DataTypes.INTEGER, allowNull: true },
  stripeSessionId: { type: DataTypes.STRING(255), allowNull: true, field: "stripe_session_id" },
  statutPaiement: { type: DataTypes.STRING(50), defaultValue: "paye", field: "statut_paiement" },
  montantPaye: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: "montant_paye" },
  montantRestant: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: "montant_restant" },
  dateEcheance: { type: DataTypes.DATEONLY, allowNull: true, field: "date_echeance" },
  receiptUrl: { type: DataTypes.STRING(500), allowNull: true, field: "receipt_url" },
  sousTotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  fraisLivraison: { type: DataTypes.STRING(255), defaultValue: "0" },
  total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  devise: { type: DataTypes.STRING(10), defaultValue: "KMF" },
  captureUrl: { type: DataTypes.TEXT("long"), allowNull: true, field: "capture_url" },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: "orders" });

module.exports = Order;
