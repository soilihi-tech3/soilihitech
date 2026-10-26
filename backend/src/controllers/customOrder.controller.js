const { CustomOrderRequest, Boutique, Order, User } = require("../models");
const { Op } = require("sequelize");

function generateRequestCode() {
  const rand = Math.floor(1000 + Math.random() * 9000);
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `DEM-${dateStr}-${rand}`;
}

/**
 * Client Store - Créer une demande sur-mesure
 */
async function createCustomRequest(req, res) {
  try {
    const { slug } = req.params;
    const boutique = await Boutique.findOne({ where: { slug } });
    if (!boutique) {
      return res.status(404).json({ message: "Boutique introuvable" });
    }

    const {
      nomClient,
      telephoneClient,
      emailClient,
      modeleAppareil,
      articles,
      description,
      photoUrl,
      photos
    } = req.body;

    if (!nomClient || !telephoneClient || !modeleAppareil) {
      return res.status(400).json({ 
        message: "Veuillez renseigner votre nom, numéro de téléphone et le modèle d'appareil." 
      });
    }

    const parsedArticles = Array.isArray(articles) && articles.length > 0
      ? articles.filter(a => a && a.nom && a.nom.trim().length > 0)
      : [{ nom: "Accessoire demandé", quantite: 1 }];

    let finalPhotoUrl = null;
    if (Array.isArray(photos) && photos.length > 0) {
      const cleanPhotos = photos.filter(p => typeof p === "string" && p.trim().length > 0);
      finalPhotoUrl = cleanPhotos.length === 1 ? cleanPhotos[0] : JSON.stringify(cleanPhotos);
    } else if (photoUrl) {
      finalPhotoUrl = photoUrl;
    }

    const code = generateRequestCode();

    const request = await CustomOrderRequest.create({
      code,
      boutiqueId: boutique.id,
      clientId: req.user ? req.user.id : null,
      nomClient: nomClient.trim(),
      telephoneClient: telephoneClient.trim(),
      emailClient: emailClient ? emailClient.trim() : null,
      modeleAppareil: modeleAppareil.trim(),
      articles: parsedArticles,
      description: description ? description.trim() : null,
      photoUrl: finalPhotoUrl,
      statut: "en_attente"
    });

    return res.status(201).json({
      success: true,
      message: "Demande sur-mesure enregistrée avec succès !",
      code: request.code,
      request
    });
  } catch (err) {
    console.error("Erreur createCustomRequest:", err);
    return res.status(500).json({ message: "Erreur lors de l'enregistrement de la demande", error: err.message });
  }
}

/**
 * Client Store - Consulter une demande par son code
 */
async function getCustomRequestByCode(req, res) {
  try {
    const { code } = req.params;
    const request = await CustomOrderRequest.findOne({
      where: { code },
      include: [
        { model: Boutique, as: "boutique", attributes: ["id", "nom", "telephone", "adresse", "slug"] }
      ]
    });

    if (!request) {
      return res.status(404).json({ message: "Demande introuvable pour ce code de référence." });
    }

    return res.json(request);
  } catch (err) {
    console.error("Erreur getCustomRequestByCode:", err);
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
}

/**
 * Client Store - Décision sur devis (Valider ou Refuser)
 */
async function respondCustomRequest(req, res) {
  try {
    const { code } = req.params;
    const { decision, motifRefus } = req.body;

    const request = await CustomOrderRequest.findOne({ where: { code } });
    if (!request) {
      return res.status(404).json({ message: "Demande introuvable." });
    }

    if (request.statut !== "propose") {
      return res.status(400).json({ 
        message: `Cette demande a déjà le statut "${request.statut}".` 
      });
    }

    if (decision === "valide") {
      // Calcul du montant total
      const totalAmount = Number(request.totalPropose || 0) + Number(request.fraisLivraison || 0);

      // Résolution du client (récupérer ou créer un compte client invité)
      let clientId = request.clientId;
      if (!clientId) {
        let clientUser = null;
        if (request.telephoneClient) {
          clientUser = await User.findOne({ where: { telephone: request.telephoneClient } }).catch(() => null);
        }
        if (!clientUser && request.emailClient) {
          clientUser = await User.findOne({ where: { email: request.emailClient } }).catch(() => null);
        }
        if (!clientUser) {
          const bcrypt = require("bcryptjs");
          const safePhone = (request.telephoneClient || "").replace(/[^0-9]/g, "");
          const tempEmail = request.emailClient || `client_${safePhone || Date.now()}@soilihitech.com`;
          try {
            clientUser = await User.create({
              nom: request.nomClient || "Client Devis",
              telephone: request.telephoneClient || null,
              email: tempEmail,
              motDePasseHash: bcrypt.hashSync("Client123!", 10),
              role: "client",
              boutiqueId: request.boutiqueId
            });
          } catch (e) {
            clientUser = await User.findOne({ where: { boutiqueId: request.boutiqueId } }).catch(() => null);
          }
        }
        if (clientUser) {
          clientId = clientUser.id;
          request.clientId = clientId;
        }
      }

      // Récupérer la boutique pour la devise
      const boutiqueObj = await Boutique.findByPk(request.boutiqueId).catch(() => null);
      const devise = boutiqueObj?.devise || "KMF";

      // Formater la liste des articles chiffrés pour la note
      let articlesText = "";
      if (Array.isArray(request.articles) && request.articles.length > 0) {
        articlesText = request.articles
          .map((a, i) => `${i + 1}. ${a.designation} (Qté: ${a.quantite}, PU: ${a.prixUnitaire} ${devise})`)
          .join(" | ");
      }

      // Créer une commande officielle dans le système
      const order = await Order.create({
        boutiqueId: request.boutiqueId,
        clientId: clientId || null,
        statut: "en_attente",
        modeLivraison: "domicile",
        moyenPaiement: "cash",
        typeVente: "commande_speciale",
        sousTotal: Number(request.totalPropose || 0),
        fraisLivraison: String(request.fraisLivraison || 0),
        total: totalAmount,
        devise: devise,
        notes: `Devis sur-mesure #${request.code}. Appareil: ${request.modeleAppareil}. Articles: ${articlesText || "Voir devis"}. Contact: ${request.nomClient} (${request.telephoneClient})`
      });

      request.statut = "valide";
      request.orderId = order.id;
      await request.save();

      return res.json({
        success: true,
        message: "Commande confirmée et transmise à l'équipe avec succès !",
        statut: "valide",
        orderId: order.id
      });
    } else if (decision === "refuse") {
      request.statut = "refuse";
      request.motifRefus = motifRefus ? motifRefus.trim() : "Refusé par le client";
      await request.save();

      return res.json({
        success: true,
        message: "Proposition refusée.",
        statut: "refuse",
        motifRefus: request.motifRefus
      });
    } else {
      return res.status(400).json({ message: "Décision invalide (valide ou refuse attendu)." });
    }
  } catch (err) {
    console.error("Erreur respondCustomRequest:", err);
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
}

/**
 * Admin - Lister les demandes sur-mesure
 */
async function listAdminCustomRequests(req, res) {
  try {
    const boutiqueId = req.boutiqueId || req.user?.boutiqueId || 1;
    const { search = "", statut = "", page = 1, limit = 25 } = req.query;

    const where = { boutiqueId };

    if (statut && statut !== "all") {
      where.statut = statut;
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      where[Op.or] = [
        { code: { [Op.like]: q } },
        { nomClient: { [Op.like]: q } },
        { telephoneClient: { [Op.like]: q } },
        { modeleAppareil: { [Op.like]: q } }
      ];
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows } = await CustomOrderRequest.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: Number(limit),
      offset
    });

    // Compteur des demandes en attente pour badge
    const pendingCount = await CustomOrderRequest.count({
      where: { boutiqueId, statut: "en_attente" }
    });

    return res.json({
      requests: rows,
      total: count,
      page: Number(page),
      limit: Number(limit),
      pendingCount
    });
  } catch (err) {
    console.error("Erreur listAdminCustomRequests:", err);
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
}

/**
 * Admin - Chiffrer et envoyer devis au client
 */
async function quoteCustomRequest(req, res) {
  try {
    const boutiqueId = req.boutiqueId || req.user?.boutiqueId || 1;
    const { id } = req.params;
    const { articles, totalPropose, fraisLivraison = 0, messageAdmin = "" } = req.body;

    const request = await CustomOrderRequest.findOne({
      where: { id, boutiqueId }
    });

    if (!request) {
      return res.status(404).json({ message: "Demande introuvable." });
    }

    if (articles && Array.isArray(articles)) {
      request.articles = articles;
    }

    request.totalPropose = Number(totalPropose || 0);
    request.fraisLivraison = Number(fraisLivraison || 0);
    request.messageAdmin = messageAdmin ? messageAdmin.trim() : null;
    request.statut = "propose";

    await request.save();

    return res.json({
      success: true,
      message: "Devis chiffré et envoyé avec succès !",
      request
    });
  } catch (err) {
    console.error("Erreur quoteCustomRequest:", err);
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
}

/**
 * Client Store - Lister les demandes sur-mesure de l'utilisateur connecté ou selon son téléphone
 */
async function listClientCustomRequests(req, res) {
  try {
    const { slug } = req.params;
    const boutique = await Boutique.findOne({ where: { slug } });
    if (!boutique) {
      return res.status(404).json({ message: "Boutique introuvable" });
    }

    const where = { boutiqueId: boutique.id };
    const orConditions = [];

    if (req.user && req.user.id) {
      orConditions.push({ clientId: req.user.id });
      if (req.user.telephone) {
        const clean = req.user.telephone.replace(/[^0-9]/g, "");
        if (clean) {
          orConditions.push({ telephoneClient: { [Op.like]: `%${clean.slice(-7)}%` } });
        }
      }
      if (req.user.email) {
        orConditions.push({ emailClient: req.user.email });
      }
    }

    if (req.query.telephone) {
      const cleanPhone = String(req.query.telephone).replace(/[^0-9]/g, "");
      if (cleanPhone) {
        orConditions.push({ telephoneClient: { [Op.like]: `%${cleanPhone.slice(-7)}%` } });
      }
    }

    if (orConditions.length > 0) {
      where[Op.or] = orConditions;
    } else {
      return res.json([]);
    }

    const requests = await CustomOrderRequest.findAll({
      where,
      order: [["createdAt", "DESC"]]
    });

    return res.json(requests);
  } catch (err) {
    console.error("Erreur listClientCustomRequests:", err);
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
}

module.exports = {
  createCustomRequest,
  getCustomRequestByCode,
  respondCustomRequest,
  listAdminCustomRequests,
  quoteCustomRequest,
  listClientCustomRequests
};
