const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const CustomOrderRequest = sequelize.define("CustomOrderRequest", {
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  boutiqueId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  clientId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  nomClient: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  telephoneClient: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  emailClient: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  modeleAppareil: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  articles: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  photoUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  totalPropose: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  fraisLivraison: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  messageAdmin: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  statut: {
    type: DataTypes.STRING(50),
    defaultValue: "en_attente" // "en_attente" | "propose" | "valide" | "refuse"
  },
  motifRefus: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: "custom_order_requests",
  timestamps: true
});

module.exports = CustomOrderRequest;
