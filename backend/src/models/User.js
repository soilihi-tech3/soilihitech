const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define("User", {
  boutiqueId: { type: DataTypes.INTEGER, allowNull: true },
  nom: { type: DataTypes.STRING(150), allowNull: false },
  email: { type: DataTypes.STRING(150), allowNull: true },
  telephone: { type: DataTypes.STRING(30), allowNull: true },
  adresse: { type: DataTypes.STRING(255), allowNull: true },
  motDePasseHash: { type: DataTypes.STRING(255), allowNull: false },
  role: {
    type: DataTypes.ENUM("super_admin", "admin", "employe", "client", "livreur"),
    allowNull: false,
    defaultValue: "client",
  },
  permissions: { type: DataTypes.JSON, allowNull: true },
  statut: { type: DataTypes.ENUM("actif", "suspendu"), defaultValue: "actif" },
  otpCode: { type: DataTypes.STRING(10), allowNull: true },
  otpExpiresAt: { type: DataTypes.DATE, allowNull: true },
  isEmailVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  mustChangePassword: { type: DataTypes.BOOLEAN, defaultValue: false },
  deviseAutorisee: { type: DataTypes.STRING(20), allowNull: true, defaultValue: "TOUTES" },
  peutGererPlusieursBoutiques: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: "peut_gerer_plusieurs_boutiques"
  },
  boutiquesGerees: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    field: "boutiques_gerees"
  },
  failedLoginAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: "failed_login_attempts"
  },
  lockedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: "locked_at"
  },
  lockReason: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: "lock_reason"
  }
}, { tableName: "users" });

module.exports = User;
