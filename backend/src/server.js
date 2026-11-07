require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const sequelize = require("./config/database");
require("./models"); // charge les modèles + associations

const authRoutes = require("./routes/auth.routes");
const storeRoutes = require("./routes/store.routes");
const adminRoutes = require("./routes/admin.routes");
const superadminRoutes = require("./routes/superadmin.routes");
const notificationRoutes = require("./routes/notification.routes");
const uploadRoutes = require("./routes/upload.routes");
const iconsRoutes = require("./routes/icons.routes");
const phoneRoutes = require("./routes/phone.routes");
const resolveBoutique = require("./middleware/resolveBoutique");
const path = require("path");
const runSeed = require("./seed");

const compression = require("compression");
const rateLimit = require("express-rate-limit");

const app = express();

// Trust reverse proxy headers on Render/Vercel for express-rate-limit
app.set("trust proxy", 1);

// Webhook Stripe (doit être configuré avant express.json car Stripe nécessite le corps brut)
const stripeWebhookRoutes = require("./routes/stripe.webhook");
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookRoutes);

// Webhook UnitechPay — Wave & Orange Money (https://pay.unitech.sn/documentation/)
const unitechpayWebhookRoutes = require("./routes/unitechpay.webhook");
app.use("/api/webhooks/unitechpay", express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }), unitechpayWebhookRoutes);
// Alias pour transition
app.use("/api/webhooks/paytech", express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }), unitechpayWebhookRoutes);

// High Performance Compression (GZIP/Brotli)
app.use(compression());

// Security Headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Universal CORS Configuration supporting custom domains (comoresbiachara.site, vercel.app, custom domains)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, x-boutique-slug, x-slug, x-boutique-domain, x-boutique-id, Cache-Control, Pragma"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(morgan("dev"));
app.use(resolveBoutique);
app.use(iconsRoutes);

// Rate limiter for high traffic protection (1000 requests per 15 minutes per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Trop de requêtes. Veuillez réessayer plus tard." }
});
app.use("/api/", apiLimiter);

// Serve uploaded images with ultra-fast static caching headers (1 year max-age)
const uploadsPath = path.join(__dirname, "../uploads");
app.use("/uploads", express.static(uploadsPath, {
  maxAge: "1y",
  etag: true,
  setHeaders: (res, path) => {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }
}));

// Root Endpoint Health Check
app.get("/", (req, res) => res.json({ message: "API Boutique SaaS Comores Biachara en ligne.", status: "ok" }));
app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
app.get("/api/health", (req, res) => res.json({ status: "ok", version: "2.3.0-devis-employe", timestamp: new Date().toISOString() }));

// Diagnostic UnitechPay & Outbound IP
app.get("/api/test-unitech", async (req, res) => {
  try {
    const { getBalance } = require("./services/unitechPayService");
    const ipRes = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(4000) })
      .then(r => r.json())
      .catch(e => ({ ip: "inconnu (" + e.message + ")" }));
    const balance = await getBalance();
    res.json({ success: true, outboundIp: ipRes.ip, balance });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      status: err.status,
      details: err.details
    });
  }
});

// Public current boutique resolver endpoint (subdomain / header multi-tenant)
app.get("/api/boutique/current", (req, res) => {
  if (!req.boutique) {
    return res.status(404).json({ message: "Boutique introuvable pour ce sous-domaine." });
  }
  const b = req.boutique.toJSON ? req.boutique.toJSON() : req.boutique;
  let devisesDisponibles = b.devisesDisponibles;
  if (typeof devisesDisponibles === "string") {
    try { devisesDisponibles = JSON.parse(devisesDisponibles); } catch (e) { devisesDisponibles = null; }
  }
  if (!Array.isArray(devisesDisponibles) || devisesDisponibles.length === 0) {
    devisesDisponibles = [b.devise || "KMF", "FCFA"];
  }
  return res.json({
    id: b.id,
    nom: b.nom,
    slug: b.slug,
    devise: b.devise || devisesDisponibles[0] || "KMF",
    devisesDisponibles,
    logoUrl: b.logoUrl,
    couleurPrincipale: b.couleurPrincipale,
    formuleAbonnement: b.formuleAbonnement,
    statut: b.statut,
    fraisLivraison: b.fraisLivraison,
    zonesLivraison: b.zonesLivraison,
    telephone: b.telephone,
    telephone2: b.telephone2,
    adresse: b.adresse,
    adresse2: b.adresse2,
    adresseRetrait: b.adresseRetrait,
    emailContact: b.emailContact,
    aProposText: b.aProposText,
    aProposImageUrl: b.aProposImageUrl,
    aProposBannerUrl: b.aProposBannerUrl,
    horairesOuverture: b.horairesOuverture,
    facebookUrl: b.facebookUrl,
    instagramUrl: b.instagramUrl,
    tiktokUrl: b.tiktokUrl,
    whatsappNumber: b.whatsappNumber,
    bannerSlides: b.bannerSlides,
    sideBanners: b.sideBanners,
    modulesActifs: b.modulesActifs,
    modesPaiement: b.modesPaiement,
    stripeAccountId: b.stripeAccountId || null,
    stripeOnboardingComplete: b.stripeOnboardingComplete || false,
  });
});

// Dynamic PWA Manifest Route fetching custom Boutique Name & Logo directly from DB
app.get(["/manifest.json", "/api/manifest.json"], async (req, res) => {
  try {
    const { Boutique } = require("./models");
    const boutique = await Boutique.findOne({ order: [["createdAt", "ASC"]] });
    const name = boutique?.nom || "Boutique SaaS";
    const logo = boutique?.logoUrl || "https://images.unsplash.com/photo-1543083477-4f785aeafaa9?auto=format&fit=crop&w=512&h=512&q=80";

    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.json({
      short_name: name,
      name: name,
      icons: [
        { src: logo, sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: logo, sizes: "512x512", type: "image/png", purpose: "any maskable" }
      ],
      start_url: "/",
      background_color: "#163424",
      theme_color: "#163424",
      display: "standalone",
      orientation: "portrait-primary",
      description: `Application officielle de ${name}.`
    });
  } catch (err) {
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.json({
      short_name: "Boutique",
      name: "Boutique",
      start_url: "/",
      display: "standalone"
    });
  }
});

// Fallback Middleware: If frontend requests /store, /auth, /admin without /api prefix, auto-rewrite to /api
app.use((req, res, next) => {
  if (req.url === "/manifest.json" || req.url === "/api/manifest.json") return next();
  if (!req.url.startsWith("/api") && !req.url.startsWith("/uploads") && req.url !== "/") {
    req.url = "/api" + (req.url.startsWith("/") ? "" : "/") + req.url;
  }
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/store", storeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/phones", phoneRoutes);
app.use("/api/superadmin", superadminRoutes);
app.use("/api/admin", uploadRoutes);
app.use("/api/notifications", notificationRoutes);

// Gestion d'erreurs centralisée sécurisée
app.use((err, req, res, next) => {
  console.error("[SERVER ERROR DETAILS]:", {
    name: err.name,
    message: err.message,
    type: err.type,
    code: err.code,
    statusCode: err.statusCode || err.status,
    param: err.param,
    rawMessage: err.raw?.message,
    stack: err.stack
  });
  const status = err.status || err.statusCode || 500;
  // Transmettre le message d'erreur clair si Stripe ou erreur client / métier
  const message = err.raw?.message || err.message || "Erreur serveur interne.";
  res.status(status).json({ message, type: err.type || err.name });
});

const PORT = process.env.PORT || 4000;

async function ensureColumns() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tableBoutiques = await queryInterface.describeTable("boutiques");

    const columnsToAddBoutique = [
      { name: "adresse_retrait", type: "TEXT" },
      { name: "horaires_ouverture", type: 'VARCHAR(255) DEFAULT "Tous les jours de 08h30 à 23h00"' },
      { name: "facebook_url", type: 'VARCHAR(255) DEFAULT ""' },
      { name: "instagram_url", type: 'VARCHAR(255) DEFAULT ""' },
      { name: "tiktok_url", type: 'VARCHAR(255) DEFAULT ""' },
      { name: "whatsapp_number", type: 'VARCHAR(50) DEFAULT ""' },
      { name: "modules_actifs", type: "JSON" },
      { name: "modes_paiement", type: "JSON" },
      { name: "custom_domain", type: "VARCHAR(255) NULL" },
      { name: "stripe_publishable_key", type: "VARCHAR(255) NULL" },
      { name: "stripe_secret_key", type: "VARCHAR(255) NULL" },
      { name: "stripe_account_id", type: "VARCHAR(255) NULL" },
      { name: "stripe_onboarding_complete", type: "TINYINT(1) DEFAULT 0" },
      { name: "paydunya_master_key", type: "VARCHAR(255) NULL" },
      { name: "paydunya_private_key", type: "VARCHAR(255) NULL" },
      { name: "paydunya_token", type: "VARCHAR(255) NULL" },
      { name: "a_propos_image_url", type: "LONGTEXT NULL" },
      { name: "a_propos_banner_url", type: "LONGTEXT NULL" },
      // PayTech & UnitechPay
      { name: "paytech_api_key",        type: "VARCHAR(255) NULL" },
      { name: "paytech_api_secret",     type: "VARCHAR(255) NULL" },
      { name: "unitech_api_key",        type: "VARCHAR(255) NULL" },
      // Reloadly (Airtime direct Comores)
      { name: "reloadly_client_id",     type: "VARCHAR(255) NULL" },
      { name: "reloadly_client_secret", type: "VARCHAR(255) NULL" },
      { name: "reloadly_sandbox",       type: "TINYINT(1) DEFAULT 0" },
      // DingConnect (Alternative Airtime direct Ding API)
      { name: "ding_api_key",           type: "VARCHAR(255) NULL" }
    ];

    for (const col of columnsToAddBoutique) {
      if (!tableBoutiques[col.name]) {
        console.log("[MIGRATION] Ajout colonne manquante sur boutiques:", col.name);
        await sequelize.query(`ALTER TABLE boutiques ADD COLUMN ${col.name} ${col.type};`);
      }
    }

    const tableProducts = await queryInterface.describeTable("products");
    if (!tableProducts["genre"]) {
      console.log("[MIGRATION] Ajout colonne genre sur products");
      await sequelize.query(`ALTER TABLE products ADD COLUMN genre VARCHAR(20) DEFAULT 'femme';`);
    }
    if (!tableProducts["is_nouveau"]) {
      console.log("[MIGRATION] Ajout colonne is_nouveau sur products");
      await sequelize.query(`ALTER TABLE products ADD COLUMN is_nouveau TINYINT(1) DEFAULT 0;`);
    }
    if (!tableProducts["note_etoiles"]) {
      console.log("[MIGRATION] Ajout colonne note_etoiles sur products");
      await sequelize.query(`ALTER TABLE products ADD COLUMN note_etoiles DECIMAL(2, 1) DEFAULT 5.0;`);
    }
    if (!tableProducts["etat"]) {
      console.log("[MIGRATION] Ajout colonne etat sur products");
      await sequelize.query(`ALTER TABLE products ADD COLUMN etat VARCHAR(20) DEFAULT 'neuf';`);
    }
    if (tableProducts["marqueId"] && !tableProducts["marque_id"]) {
      console.log("[MIGRATION] Renommage marqueId en marque_id sur products");
      await sequelize.query(`ALTER TABLE products CHANGE COLUMN marqueId marque_id INT NULL;`);
    } else if (!tableProducts["marque_id"]) {
      console.log("[MIGRATION] Ajout colonne marque_id sur products");
      await sequelize.query(`ALTER TABLE products ADD COLUMN marque_id INT NULL;`);
    }
    if (!tableProducts["masquer_sur_site"]) {
      console.log("[MIGRATION] Ajout colonne masquer_sur_site sur products");
      await sequelize.query(`ALTER TABLE products ADD COLUMN masquer_sur_site TINYINT(1) NOT NULL DEFAULT 0;`);
    }
    if (!tableProducts["senteurs"]) {
      console.log("[MIGRATION] Ajout colonne senteurs sur products");
      await sequelize.query(`ALTER TABLE products ADD COLUMN senteurs JSON NULL;`);
    }
    if (!tableProducts["type_variante_nom"]) {
      console.log("[MIGRATION] Ajout colonne type_variante_nom sur products");
      await sequelize.query(`ALTER TABLE products ADD COLUMN type_variante_nom VARCHAR(50) DEFAULT 'Senteur';`);
    }

    const tableOrders = await queryInterface.describeTable("orders");
    if (!tableOrders["stripe_session_id"]) {
      console.log("[MIGRATION] Ajout colonne stripe_session_id sur orders");
      await sequelize.query(`ALTER TABLE orders ADD COLUMN stripe_session_id VARCHAR(255) NULL;`);
    }
    if (tableOrders["statutPaiement"] && !tableOrders["statut_paiement"]) {
      console.log("[MIGRATION] Renommage statutPaiement en statut_paiement");
      await sequelize.query(`ALTER TABLE orders CHANGE COLUMN statutPaiement statut_paiement VARCHAR(50) DEFAULT 'non_paye';`);
    } else if (!tableOrders["statut_paiement"]) {
      console.log("[MIGRATION] Ajout colonne statut_paiement");
      await sequelize.query(`ALTER TABLE orders ADD COLUMN statut_paiement VARCHAR(50) DEFAULT 'non_paye';`);
    }

    if (!tableOrders["notes"]) {
      console.log("[MIGRATION] Ajout colonne notes sur orders");
      await sequelize.query(`ALTER TABLE orders ADD COLUMN notes TEXT NULL;`);
    }

    if (tableOrders["receiptUrl"] && !tableOrders["receipt_url"]) {
      console.log("[MIGRATION] Renommage receiptUrl en receipt_url");
      await sequelize.query(`ALTER TABLE orders CHANGE COLUMN receiptUrl receipt_url VARCHAR(500) NULL;`);
    } else if (!tableOrders["receipt_url"]) {
      console.log("[MIGRATION] Ajout colonne receipt_url");
      await sequelize.query(`ALTER TABLE orders ADD COLUMN receipt_url VARCHAR(500) NULL;`);
    }

    const tableUsers = await queryInterface.describeTable("users");
    const columnsToAddUser = [
      { name: "otp_code", type: "VARCHAR(255) NULL" },
      { name: "otp_expires_at", type: "DATETIME NULL" },
      { name: "is_email_verified", type: "TINYINT(1) DEFAULT 0" },
      { name: "must_change_password", type: "TINYINT(1) DEFAULT 0" }
    ];

    for (const col of columnsToAddUser) {
      if (!tableUsers[col.name]) {
        console.log("[MIGRATION] Ajout colonne manquante sur users:", col.name);
        await sequelize.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type};`);
      }
    }

    // Upgrade image columns and enum columns to flexible types to avoid "Data Truncated" errors
    const alterQueries = [
      "ALTER TABLE products MODIFY COLUMN image_url LONGTEXT NULL;",
      "ALTER TABLE products MODIFY COLUMN image_url2 LONGTEXT NULL;",
      "ALTER TABLE categories MODIFY COLUMN image_url LONGTEXT NULL;",
      "ALTER TABLE boutiques MODIFY COLUMN logo_url LONGTEXT NULL;",
      "ALTER TABLE boutiques MODIFY COLUMN banner_slides LONGTEXT NULL;",
      "ALTER TABLE boutiques MODIFY COLUMN side_banners LONGTEXT NULL;",
      "ALTER TABLE boutiques MODIFY COLUMN formule_abonnement VARCHAR(50) DEFAULT 'standard';",
      "ALTER TABLE orders MODIFY COLUMN moyen_paiement VARCHAR(50) DEFAULT 'cash';",
      "ALTER TABLE orders MODIFY COLUMN mode_livraison VARCHAR(50) DEFAULT 'domicile';",
      "ALTER TABLE orders MODIFY COLUMN client_id INT NULL;",
      "ALTER TABLE custom_order_requests MODIFY COLUMN photo_url LONGTEXT NULL;",
      "ALTER TABLE custom_order_requests ADD COLUMN employe_id INT NULL;",
      "ALTER TABLE custom_order_requests ADD COLUMN cree_par_id INT NULL;",
      "ALTER TABLE products ADD COLUMN prix_senegal DECIMAL(10, 2) NULL;",
      "ALTER TABLE products ADD COLUMN prix_promo_senegal DECIMAL(10, 2) NULL;",
      "ALTER TABLE products ADD COLUMN masquer_sur_site TINYINT(1) NOT NULL DEFAULT 0;",
      "ALTER TABLE products ADD COLUMN images LONGTEXT NULL;",
      "ALTER TABLE products ADD COLUMN couleurs LONGTEXT NULL;",
      "ALTER TABLE products ADD COLUMN modeles_compatibles LONGTEXT NULL;",
      "ALTER TABLE order_items ADD COLUMN marque_telephone VARCHAR(100) NULL;",
      "ALTER TABLE order_items ADD COLUMN modele VARCHAR(150) NULL;",
      "ALTER TABLE order_items ADD COLUMN couleur VARCHAR(100) NULL;",
      "ALTER TABLE order_items ADD COLUMN image_url LONGTEXT NULL;",
      "ALTER TABLE orders ADD COLUMN devise VARCHAR(10) DEFAULT 'KMF';",
      "ALTER TABLE orders ADD COLUMN capture_url LONGTEXT NULL;",
      "ALTER TABLE users ADD COLUMN devise_autorisee VARCHAR(20) DEFAULT 'TOUTES';",
      "ALTER TABLE users ADD COLUMN peut_gerer_plusieurs_boutiques TINYINT(1) DEFAULT 0;",
      "ALTER TABLE users ADD COLUMN boutiques_gerees JSON NULL;",
      "ALTER TABLE users ADD COLUMN failed_login_attempts INT DEFAULT 0;",
      "ALTER TABLE users ADD COLUMN locked_at DATETIME NULL;",
      "ALTER TABLE users ADD COLUMN lock_reason VARCHAR(255) NULL;",
      "ALTER TABLE boutiques ADD COLUMN devises_disponibles JSON NULL;",
      "ALTER TABLE boutiques ADD COLUMN proprietaire_id INT NULL;",
      "ALTER TABLE products ADD COLUMN prix_par_devise JSON NULL;",
      "ALTER TABLE products ADD COLUMN prix_promo_par_devise JSON NULL;",
      "ALTER TABLE products ADD COLUMN cree_par_id INT NULL;",
      "ALTER TABLE orders ADD COLUMN montant_paye DECIMAL(10, 2) DEFAULT 0;",
      "ALTER TABLE orders ADD COLUMN montant_restant DECIMAL(10, 2) DEFAULT 0;",
      "ALTER TABLE orders ADD COLUMN date_echeance DATE NULL;",
      "ALTER TABLE custom_order_requests ADD COLUMN statut_achat VARCHAR(50) DEFAULT 'non_achete';",
      "CREATE TABLE IF NOT EXISTS expenses (id INT AUTO_INCREMENT PRIMARY KEY, boutiqueId INT NOT NULL, creeParId INT NULL, titre VARCHAR(255) NOT NULL, montant DECIMAL(12, 2) NOT NULL DEFAULT 0, devise VARCHAR(10) DEFAULT 'KMF', categorie VARCHAR(50) DEFAULT 'autre', dateDepense DATETIME DEFAULT CURRENT_TIMESTAMP, beneficiaire VARCHAR(255) NULL, moyenPaiement VARCHAR(50) DEFAULT 'especes', notes TEXT NULL, justificatifUrl TEXT NULL, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);",
      "CREATE TABLE IF NOT EXISTS savings (id INT AUTO_INCREMENT PRIMARY KEY, boutiqueId INT NOT NULL, creeParId INT NULL, type VARCHAR(20) DEFAULT 'depot', montant DECIMAL(12, 2) NOT NULL DEFAULT 0, devise VARCHAR(10) DEFAULT 'KMF', dateOperation DATETIME DEFAULT CURRENT_TIMESTAMP, compte VARCHAR(100) NULL, reference VARCHAR(100) NULL, notes TEXT NULL, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);"
    ];

    for (const q of alterQueries) {
      await sequelize.query(q).catch(() => {});
    }
  } catch (err) {
    console.warn("[MIGRATION WARNING]:", err.message);
  }
}

async function start() {
  let connected = false;
  for (let i = 0; i < 15 && !connected; i++) {
    try {
      await sequelize.authenticate();
      connected = true;
    } catch (err) {
      console.log("En attente de la base de données MySQL...", err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  if (!connected) {
    console.error("Impossible de se connecter à MySQL après plusieurs tentatives.");
    process.exit(1);
  }

  await ensureColumns();
  await sequelize.sync(); // crée les tables si elles n'existent pas (compatibilité TiDB Cloud)

  // Insérer les données initiales UNIQUEMENT si la base de données est vierge (aucune boutique ou aucun produit)
  const { Boutique, Product } = require("./models");
  const existingCount = await Product.count().catch(() => 0);
  const existingBoutique = await Boutique.count().catch(() => 0);

  if (existingCount === 0 || existingBoutique === 0) {
    console.log("Base de données vierge détectée : initialisation des données de démarrage...");
    await runSeed();
  } else {
    console.log(`Base de données active : ${existingCount} produits et ${existingBoutique} boutique(s) conservés sans écrasement.`);
  }

  app.listen(PORT, () => console.log(`API Boutique SaaS démarrée sur le port ${PORT}`));
}

start();
