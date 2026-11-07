const { verifyToken } = require("../utils/jwt");
const { User, Boutique } = require("../models");

/** Vérifie le token JWT et attache req.user */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Authentification requise." });

    const payload = verifyToken(token);
    const user = await User.findByPk(payload.id);
    if (!user || user.statut === "suspendu") {
      return res.status(401).json({ message: "Compte invalide ou suspendu." });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Session invalide ou expirée." });
  }
}

/** Authentification optionnelle (attache req.user si le token JWT est valide, sinon passe à la suite sans bloquer) */
async function optionalAuthenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (token) {
      const payload = verifyToken(token);
      if (payload && payload.id) {
        const user = await User.findByPk(payload.id);
        if (user && user.statut !== "suspendu") {
          req.user = user;
        }
      }
    }
  } catch (err) {
    // Si token invalide ou expiré, on continue sans utilisateur connecté
  }
  next();
}

/** Autorise uniquement certains rôles */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Accès refusé pour ce rôle." });
    }
    next();
  };
}

/** Vérifie que la boutique existe via le slug de l'URL et l'attache à req.boutique */
async function loadBoutique(req, res, next) {
  try {
    let boutique = req.boutique;

    // Si la boutique N'A PAS été résolue par un domaine personnalisé explicite,
    // et qu'un slug explicite d'URL est fourni (différent de "current")
    if (!req.isCustomDomainResolved && req.params.slug && req.params.slug !== "current") {
      const foundBySlug = await Boutique.findOne({ where: { slug: req.params.slug } });
      if (foundBySlug) {
        boutique = foundBySlug;
      }
    }

    if (!boutique && req.params.slug && req.params.slug !== "current") {
      boutique = await Boutique.findOne({ where: { slug: req.params.slug } });
    }

    if (!boutique) {
      // Fallback sur la première boutique active
      boutique = await Boutique.findOne({ where: { statut: "active" }, order: [["id", "ASC"]] });
    }
    if (!boutique) {
      boutique = await Boutique.findOne({ order: [["id", "ASC"]] });
    }
    if (!boutique) return res.status(404).json({ message: "Aucune boutique disponible." });
    if (boutique.statut === "suspendue") {
      return res.status(403).json({ message: "Cette boutique est actuellement suspendue." });
    }
    req.boutique = boutique;
    next();
  } catch (err) {
    next(err);
  }
}

/** Helper : retourne la liste des IDs de boutiques qu'un utilisateur est autorisé à gérer */
function getAuthorizedBoutiqueIds(user) {
  const ids = new Set();
  if (user.boutiqueId) ids.add(Number(user.boutiqueId));
  if (user.role === "admin" && user.peutGererPlusieursBoutiques) {
    let list = user.boutiquesGerees;
    if (typeof list === "string") {
      try { list = JSON.parse(list); } catch (e) { list = []; }
    }
    if (Array.isArray(list)) {
      list.forEach(id => {
        const n = Number(id);
        if (!isNaN(n) && n > 0) ids.add(n);
      });
    }
  }
  return Array.from(ids);
}

/** Pour les routes admin : s'assure que l'admin/employé agit uniquement sur SA boutique (ou l'une de ses boutiques autorisées par le Super Admin) */
function requireOwnBoutique(req, res, next) {
  const requestedId = Number(req.headers["x-boutique-id"] || req.query.boutiqueId || 0);

  if (req.user.role === "super_admin") {
    req.boutiqueId = requestedId || req.boutique?.id || req.user.boutiqueId || 1;
    req.managedBoutiqueIds = [req.boutiqueId];
    return next();
  }

  const allowedIds = getAuthorizedBoutiqueIds(req.user);
  if (allowedIds.length === 0) {
    return res.status(403).json({ message: "Ce compte n'est rattaché à aucune boutique." });
  }

  req.managedBoutiqueIds = allowedIds;

  // Si l'admin a l'accès multi-boutiques accordé par le Super Admin et cible une boutique autorisée
  if (req.user.role === "admin" && requestedId && allowedIds.includes(requestedId)) {
    req.boutiqueId = requestedId;
  } else {
    req.boutiqueId = req.user.boutiqueId || allowedIds[0];
  }

  next();
}

module.exports = { authenticate, optionalAuthenticate, requireRole, loadBoutique, requireOwnBoutique, getAuthorizedBoutiqueIds };
