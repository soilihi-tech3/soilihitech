const { CustomOrderRequest, Boutique, Order, User } = require("../models");
const { Op } = require("sequelize");
const { getCache, setCache } = require("../config/cache");
const { broadcast } = require("../utils/broadcaster");

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

    broadcast("custom_order_updated", { requestId: request.id, boutiqueId: boutique.id, action: "create" });

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

      broadcast("custom_order_updated", { requestId: request.id, boutiqueId: request.boutiqueId, action: "update" });
      broadcast("order_created", { orderId: order.id, boutiqueId: request.boutiqueId });

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

      broadcast("custom_order_updated", { requestId: request.id, boutiqueId: request.boutiqueId, action: "update" });

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
    const { search = "", statut = "", statutAchat = "", page = 1, limit = 25 } = req.query;

    const andConditions = [{ boutiqueId }];

    if (statut && statut !== "all") {
      andConditions.push({ statut });
    }

    if (statutAchat && statutAchat !== "all") {
      andConditions.push({ statutAchat });
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      andConditions.push({
        [Op.or]: [
          { code: { [Op.like]: q } },
          { nomClient: { [Op.like]: q } },
          { telephoneClient: { [Op.like]: q } },
          { modeleAppareil: { [Op.like]: q } }
        ]
      });
    }

    // Si c'est un employé, il ne voit QUE les devis qu'il a créés ou qui lui ont été attribués
    const isEmploye = req.user?.role === "employe";
    if (isEmploye) {
      andConditions.push({
        [Op.or]: [
          { employeId: req.user.id },
          { creeParId: req.user.id }
        ]
      });
    }

    const where = { [Op.and]: andConditions };
    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows } = await CustomOrderRequest.findAndCountAll({
      where,
      include: [
        { model: User, as: "employeAssigne", attributes: ["id", "nom", "email"] },
        { model: User, as: "createur", attributes: ["id", "nom", "email"] }
      ],
      order: [["createdAt", "DESC"]],
      limit: Number(limit),
      offset
    });

    // Compteur des demandes en attente pour badge
    const pendingConditions = [{ boutiqueId }, { statut: "en_attente" }];
    if (isEmploye) {
      pendingConditions.push({
        [Op.or]: [
          { employeId: req.user.id },
          { creeParId: req.user.id }
        ]
      });
    }
    const pendingCount = await CustomOrderRequest.count({
      where: { [Op.and]: pendingConditions }
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
    if (!request.employeId && req.user) {
      request.employeId = req.user.id;
    }

    await request.save();

    broadcast("custom_order_updated", { requestId: request.id, boutiqueId: request.boutiqueId, action: "update" });

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

/**
 * Admin / Employé - Créer directement une commande / demande sur-mesure
 */
async function createAdminCustomRequest(req, res) {
  try {
    const boutiqueId = req.boutiqueId;
    if (!boutiqueId) {
      return res.status(400).json({ message: "Boutique non spécifiée" });
    }

    const {
      nomClient,
      telephoneClient,
      emailClient,
      modeleAppareil,
      articles,
      description,
      photoUrl,
      photos,
      statut,
      fraisLivraison,
      devisTotal,
      messageAdmin,
      employeId,
      idempotencyKey
    } = req.body;

    if (idempotencyKey) {
      const existing = await getCache(`idempotency:${idempotencyKey}`);
      if (existing) {
        return res.status(200).json({
          success: true,
          message: "Demande sur-mesure deja traitee.",
          request: existing,
          duplicate: true
        });
      }
    }

    if (!nomClient || !telephoneClient || !modeleAppareil) {
      return res.status(400).json({
        message: "Veuillez renseigner le nom du client, le numéro de téléphone et le modèle d'appareil."
      });
    }

    const parsedArticles = Array.isArray(articles) && articles.length > 0
      ? articles.filter(a => a && a.nom && String(a.nom).trim().length > 0)
      : [{ nom: "Accessoire demandé", quantite: 1, prixUnitaire: 0 }];

    let finalPhotoUrl = null;
    if (Array.isArray(photos) && photos.length > 0) {
      const cleanPhotos = photos.filter(p => typeof p === "string" && p.trim().length > 0);
      finalPhotoUrl = cleanPhotos.length === 1 ? cleanPhotos[0] : JSON.stringify(cleanPhotos);
    } else if (photoUrl) {
      finalPhotoUrl = photoUrl;
    }

    const code = generateRequestCode();
    const targetEmployeId = employeId ? Number(employeId) : (req.user ? req.user.id : null);
    const creeParId = req.user ? req.user.id : null;

    const request = await CustomOrderRequest.create({
      code,
      boutiqueId,
      clientId: null,
      employeId: targetEmployeId,
      creeParId: creeParId,
      nomClient: nomClient.trim(),
      telephoneClient: telephoneClient.trim(),
      emailClient: emailClient ? emailClient.trim() : null,
      modeleAppareil: modeleAppareil.trim(),
      articles: parsedArticles,
      description: description ? description.trim() : null,
      photoUrl: finalPhotoUrl,
      statut: statut || "en_attente",
      fraisLivraison: Number(fraisLivraison) || 0,
      totalPropose: devisTotal !== undefined && devisTotal !== null ? Number(devisTotal) : null,
      messageAdmin: messageAdmin ? messageAdmin.trim() : null
    });

    if (idempotencyKey) {
      await setCache(`idempotency:${idempotencyKey}`, request, 86400).catch(() => {});
    }

    broadcast("custom_order_updated", { requestId: request.id, boutiqueId, action: "create" });

    return res.status(201).json({
      success: true,
      message: "Demande sur-mesure créée avec succès !",
      request
    });
  } catch (err) {
    console.error("Erreur createAdminCustomRequest:", err);
    return res.status(500).json({ message: "Erreur lors de la création de la demande", error: err.message });
  }
}

/**
 * Admin / Employé - Modifier une demande sur-mesure
 */
async function updateAdminCustomRequest(req, res) {
  try {
    const boutiqueId = req.boutiqueId;
    const { id } = req.params;

    const request = await CustomOrderRequest.findOne({ where: { id, boutiqueId } });
    if (!request) {
      return res.status(404).json({ message: "Demande sur-mesure introuvable." });
    }

    const {
      nomClient,
      telephoneClient,
      emailClient,
      modeleAppareil,
      articles,
      description,
      photoUrl,
      photos,
      statut,
      fraisLivraison,
      devisTotal,
      totalPropose,
      messageAdmin
    } = req.body;

    if (nomClient) request.nomClient = nomClient.trim();
    if (telephoneClient) request.telephoneClient = telephoneClient.trim();
    if (emailClient !== undefined) request.emailClient = emailClient ? emailClient.trim() : null;
    if (modeleAppareil) request.modeleAppareil = modeleAppareil.trim();

    if (Array.isArray(articles)) {
      request.articles = articles.filter(a => a && a.nom && String(a.nom).trim().length > 0);
    }
    if (description !== undefined) request.description = description ? description.trim() : null;
    if (statut) request.statut = statut;
    if (fraisLivraison !== undefined) request.fraisLivraison = Number(fraisLivraison) || 0;
    if (totalPropose !== undefined) request.totalPropose = Number(totalPropose) || 0;
    if (devisTotal !== undefined) request.devisTotal = devisTotal !== null ? Number(devisTotal) : null;
    if (messageAdmin !== undefined) request.messageAdmin = messageAdmin ? messageAdmin.trim() : null;
    if (req.body.statutAchat !== undefined) request.statutAchat = req.body.statutAchat;
    if (req.body.employeId !== undefined) {
      request.employeId = req.body.employeId ? Number(req.body.employeId) : null;
    }

    if (Array.isArray(photos)) {
      const cleanPhotos = photos.filter(p => typeof p === "string" && p.trim().length > 0);
      request.photoUrl = cleanPhotos.length === 0 ? null : (cleanPhotos.length === 1 ? cleanPhotos[0] : JSON.stringify(cleanPhotos));
    } else if (photoUrl !== undefined) {
      request.photoUrl = photoUrl;
    }

    await request.save();

    broadcast("custom_order_updated", { requestId: request.id, boutiqueId, action: "update" });

    return res.json({
      success: true,
      message: "Demande sur-mesure modifiée avec succès !",
      request
    });
  } catch (err) {
    console.error("Erreur updateAdminCustomRequest:", err);
    return res.status(500).json({ message: "Erreur lors de la modification de la demande", error: err.message });
  }
}

/**
 * Admin / Employé - Supprimer une demande sur-mesure
 */
async function deleteAdminCustomRequest(req, res) {
  try {
    const boutiqueId = req.boutiqueId;
    const { id } = req.params;

    const request = await CustomOrderRequest.findOne({ where: { id, boutiqueId } });
    if (!request) {
      return res.status(404).json({ message: "Demande sur-mesure introuvable." });
    }

    await request.destroy();

    broadcast("custom_order_updated", { requestId: id, boutiqueId, action: "delete" });

    return res.json({
      success: true,
      message: "Demande sur-mesure supprimée avec succès !"
    });
  } catch (err) {
    console.error("Erreur deleteAdminCustomRequest:", err);
    return res.status(500).json({ message: "Erreur lors de la suppression de la demande", error: err.message });
  }
}

/**
 * Admin / Employé - Basculer le statut d'achat (acheté / non acheté)
 */
async function toggleStatutAchat(req, res) {
  try {
    const boutiqueId = req.boutiqueId || req.user?.boutiqueId || 1;
    const { id } = req.params;

    const request = await CustomOrderRequest.findOne({ where: { id, boutiqueId } });
    if (!request) {
      return res.status(404).json({ message: "Demande sur-mesure introuvable." });
    }

    const currentStatut = request.statutAchat || "non_achete";
    const newStatut = req.body.statutAchat || (currentStatut === "achete" ? "non_achete" : "achete");
    request.statutAchat = newStatut;
    await request.save();

    broadcast("custom_order_updated", { requestId: request.id, boutiqueId, action: "update" });

    return res.json({
      success: true,
      message: `Statut d'achat mis à jour : ${newStatut === "achete" ? "Acheté" : "Pas encore acheté"}`,
      statutAchat: newStatut,
      request
    });
  } catch (err) {
    console.error("Erreur toggleStatutAchat:", err);
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
}

module.exports = {
  createCustomRequest,
  getCustomRequestByCode,
  respondCustomRequest,
  listAdminCustomRequests,
  quoteCustomRequest,
  listClientCustomRequests,
  createAdminCustomRequest,
  updateAdminCustomRequest,
  deleteAdminCustomRequest,
  toggleStatutAchat
};
