require("dotenv").config();
const { Sequelize } = require("sequelize");

const dbHost = (process.env.DB_HOST || "localhost").trim();
const isSSL = process.env.DB_SSL === "true" || dbHost.includes("tidbcloud.com");

const sequelize = new Sequelize(
  (process.env.DB_NAME || "boutique_saas").trim(),
  (process.env.DB_USER || "boutique_user").trim(),
  (process.env.DB_PASSWORD || "boutique_pass").trim(),
  {
    host: dbHost,
    port: parseInt(process.env.DB_PORT || "3306", 10),
    dialect: "mysql",
    logging: false,
    dialectOptions: isSSL
      ? {
          ssl: {
            minVersion: "TLSv1.2",
            rejectUnauthorized: false,
          },
        }
      : {},
    define: {
      underscored: true,
      timestamps: true,
    },
  }
);

module.exports = sequelize;

