const express = require("express");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { sequelize, Product, Category, Order, OrderItem, User, Boutique, Notification, Review, Famille, Fournisseur, UniteVente, Achat, Marque, Testimonial, Expense, Saving } = require("../models");
const { authenticate, requireRole, requireOwnBoutique } = require("../middleware/auth");
const { getCache, setCache, clearCachePattern } = require("../config/cache");
const { broadcast } = require("../utils/broadcaster");
const { sendOrderStatusEmail } = require("../services/email.service");

const router = express.Router();

function purgeCache() {
  clearCachePattern("/api/store").catch(() => {});
  clearCachePattern("store").catch(() => {});
  clearCachePattern("/api/boutique").catch(() => {});
  clearCachePattern("admin:products").catch(() => {});
  clearCachePattern("cache:b").catch(() => {});
}

router.use(authenticate, requireRole("admin", "employe"), requireOwnBoutique);

async function checkExpirationNotification(product, boutiqueId) {
  // Désactivé car les accessoires électriques et matériel n'expirent pas
  return;
}

/* ---------------------- TABLEAU DE BORD ---------------------- */

// DELETE /api/admin/cleanup - Nettoyage de la base de données
router.post("/cleanup", async (req, res, next) => {
  try {
    const { tables } = req.body;
    if (!tables || !Array.isArray(tables)) return res.status(400).json({ message: "Tables non spécifiées." });

    const boutiqueId = req.boutiqueId;

    // We must handle deletions safely and carefully.
    if (tables.includes("commandes")) {
      const orders = await Order.findAll({ where: { boutiqueId }, attributes: ["id"] });
      const orderIds = orders.map(o => o.id);
      if (orderIds.length > 0) {
        await OrderItem.destroy({ where: { orderId: orderIds } });
      }
      await Order.destroy({ where: { boutiqueId } });
    }
    if (tables.includes("achats")) {
      await Achat.destroy({ where: { boutiqueId } });
    }
    if (tables.includes("produits")) {
      const products = await Product.findAll({ where: { boutiqueId }, attributes: ["id"] });
      const productIds = products.map(p => p.id);
      if (productIds.length > 0) {
        await Review.destroy({ where: { productId: productIds } });
        await Achat.destroy({ where: { productId: productIds } });
      }
      await Product.destroy({ where: { boutiqueId } });
    }
    if (tables.includes("categories")) {
      await Category.destroy({ where: { boutiqueId } });
    }
    if (tables.includes("clients")) {
      await User.destroy({ where: { boutiqueId, role: "client" } });
    }
    if (tables.includes("fournisseurs")) {
      await Fournisseur.destroy({ where: { boutiqueId } });
    }

    purgeCache();
    broadcast("boutique_updated", { boutiqueId });

    res.json({ message: "Nettoyage effectué avec succès." });
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard", async (req, res, next) => {
  try {
    const boutiqueId = req.boutiqueId;
    const isEmploye = req.user.role === "employe";

    // Mes commandes assignées à cet employé / utilisateur
    const mesCommandes = await Order.findAll({
      where: { boutiqueId, employeAssigneId: req.user.id },
      include: [
        { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] },
        { model: User, as: "client", attributes: ["nom", "telephone"] }
      ],
      order: [["createdAt", "DESC"]]
    });

    const mesCommandesLivrees = mesCommandes.filter(c => c.statut === "livree");
    const monChiffreAffaires = mesCommandes.filter(c => c.statut !== "annulee").reduce((sum, c) => sum + Number(c.total), 0);
    const mesCommandesEnCours = mesCommandes.filter(c => ["en_attente", "validee", "en_preparation", "en_livraison"].includes(c.statut));

    // Si c'est un employé, on lui retourne son tableau de bord d'activités personnel uniquement !
    if (isEmploye) {
      return res.json({
        isEmploye: true,
        monChiffreAffaires,
        nbMesCommandes: mesCommandes.length,
        nbMesCommandesLivrees: mesCommandesLivrees.length,
        nbMesCommandesEnCours: mesCommandesEnCours.length,
        mesCommandes
      });
    }

    // Pour les Administrateurs : vue d'ensemble globale de la boutique
    const orders = await Order.findAll({
      where: { boutiqueId, statut: { [Op.ne]: "annulee" } },
      include: [{ model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }],
      order: [["createdAt", "ASC"]]
    });

    // Séparation des commandes par pays/devise
    const ordersComores = orders.filter((o) => !o.devise || o.devise === "KMF");
    const ordersSenegal = orders.filter((o) => o.devise === "FCFA" || o.devise === "XOF");

    // Calcul des dépenses totales d'achats enregistrées
    const totalAchatsRows = await Achat.findAll({ where: { boutiqueId } });
    const totalDepensesAchats = totalAchatsRows.reduce((sum, a) => sum + Number(a.totalAchat || 0), 0);

    // Statistiques Comores
    const caComores = ordersComores.reduce((s, o) => s + Number(o.total || 0), 0);
    const coutAchatsComores = ordersComores.reduce((s, o) => {
      return s + o.items.reduce((ss, it) => ss + (Number(it.product?.coutAchat || 0) * it.quantite), 0);
    }, 0);
    const beneficeComores = ordersComores.reduce((s, o) => {
      return s + o.items.reduce((ss, it) => {
        const cout = it.product ? Number(it.product.coutAchat || 0) : 0;
        const prix = Number(it.prixUnitaire || it.product?.prix || 0);
        return ss + ((prix - cout) * it.quantite);
      }, 0);
    }, 0);
    const nbCommandesComores = ordersComores.length;
    const totalVentesCountComores = ordersComores.reduce((s, o) => s + o.items.reduce((ss, it) => ss + it.quantite, 0), 0);
    const panierMoyenComores = nbCommandesComores > 0 ? Math.round(caComores / nbCommandesComores) : 0;

    // Statistiques Sénégal
    const caSenegal = ordersSenegal.reduce((s, o) => s + Number(o.total || 0), 0);
    const coutAchatsSenegal = ordersSenegal.reduce((s, o) => {
      return s + o.items.reduce((ss, it) => ss + (Number(it.product?.coutAchat || 0) * it.quantite), 0);
    }, 0);
    const beneficeSenegal = ordersSenegal.reduce((s, o) => {
      return s + o.items.reduce((ss, it) => {
        const cout = it.product ? Number(it.product.coutAchat || 0) : 0;
        const prix = Number(it.prixUnitaire || it.product?.prixPromoSenegal || it.product?.prixSenegal || 0);
        return ss + ((prix - cout) * it.quantite);
      }, 0);
    }, 0);
    const nbCommandesSenegal = ordersSenegal.length;
    const totalVentesCountSenegal = ordersSenegal.reduce((s, o) => s + o.items.reduce((ss, it) => ss + it.quantite, 0), 0);
    const panierMoyenSenegal = nbCommandesSenegal > 0 ? Math.round(caSenegal / nbCommandesSenegal) : 0;

    // Totaux généraux
    const nbCommandes = orders.length;
    const totalVentesCount = orders.reduce((s, o) => s + o.items.reduce((ss, it) => ss + it.quantite, 0), 0);
    const totalClients = await User.count({ 
      where: { 
        role: "client",
        [Op.or]: [
          { boutiqueId },
          { boutiqueId: null }
        ]
      } 
    });
    
    const produits = await Product.findAll({ 
      where: { boutiqueId }, 
      include: [
        Category,
        { model: Review, as: "avis" }
      ] 
    });
    
    const categories = await Category.findAll({ where: { boutiqueId } });
    const stockFaible = produits.filter((p) => p.stock <= p.seuilAlerte);

    const valeurStockComores = produits.reduce((sum, p) => sum + (Number(p.stock || 0) * Number(p.prixPromo || p.prix || 0)), 0);
    const valeurStockSenegal = produits.reduce((sum, p) => sum + (Number(p.stock || 0) * Number(p.prixPromoSenegal || p.prixSenegal || p.prix || 0)), 0);
    const valeurStockAchat = produits.reduce((sum, p) => sum + (Number(p.stock || 0) * Number(p.coutAchat || 0)), 0);

    // Total avis & Note moyenne
    let totalReviews = 0;
    let sumNotes = 0;

    const prodsWithStats = produits.map((p) => {
      const pAvis = p.avis || [];
      const pNbAvis = pAvis.length;
      const pSumNotes = pAvis.reduce((s, r) => s + r.note, 0);
      const pNoteMoyenne = pNbAvis > 0 ? Number((pSumNotes / pNbAvis).toFixed(1)) : 5.0;

      totalReviews += pNbAvis;
      sumNotes += pSumNotes;

      return {
        id: p.id,
        nom: p.nom,
        prix: p.prix,
        prixPromo: p.prixPromo,
        prixSenegal: p.prixSenegal,
        prixPromoSenegal: p.prixPromoSenegal,
        imageUrl: p.imageUrl,
        ventesCount: p.ventesCount || 0,
        stock: p.stock,
        categoryName: p.Category?.nom || "Non classé",
        noteMoyenne: pNoteMoyenne,
        nbAvis: pNbAvis
      };
    });

    const noteMoyenneGlobale = totalReviews > 0 ? Number((sumNotes / totalReviews).toFixed(1)) : 4.9;

    // Top 7 & Flop 7 Produits
    const sortedProds = [...prodsWithStats].sort((a, b) => b.ventesCount - a.ventesCount);
    const top7Produits = sortedProds.slice(0, 7);
    const flop7Produits = [...prodsWithStats].sort((a, b) => a.ventesCount - b.ventesCount).slice(0, 7);

    // Top & Flop Catégories
    const categoryStats = categories.map(c => {
      const prodsInCat = prodsWithStats.filter(p => p.categoryName === c.nom);
      return {
        id: c.id,
        name: c.nom,
        count: prodsInCat.length,
        ventes: prodsInCat.reduce((s, p) => s + p.ventesCount, 0)
      };
    });

    const topCategories = [...categoryStats].sort((a, b) => b.ventes - a.ventes);
    const flopCategories = [...categoryStats].sort((a, b) => a.ventes - b.ventes);

    // Données des 7 derniers jours réels
    const daysLabels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const now = new Date();
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = daysLabels[d.getDay()];
      last7Days.push({ dateStr, dayName });
    }

    const chartDataComores = last7Days.map(({ dateStr, dayName }) => {
      const dayOrders = ordersComores.filter(o => o.createdAt && new Date(o.createdAt).toISOString().slice(0, 10) === dateStr);
      const ca = dayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      return { jour: dayName, date: dateStr, ca };
    });

    const chartDataSenegal = last7Days.map(({ dateStr, dayName }) => {
      const dayOrders = ordersSenegal.filter(o => o.createdAt && new Date(o.createdAt).toISOString().slice(0, 10) === dateStr);
      const ca = dayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      return { jour: dayName, date: dateStr, ca };
    });

    const chartDataGlobal = last7Days.map(({ dateStr, dayName }) => {
      const dayOrdersComores = ordersComores.filter(o => o.createdAt && new Date(o.createdAt).toISOString().slice(0, 10) === dateStr);
      const dayOrdersSenegal = ordersSenegal.filter(o => o.createdAt && new Date(o.createdAt).toISOString().slice(0, 10) === dateStr);
      const dayCaComores = dayOrdersComores.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const dayCaSenegal = dayOrdersSenegal.reduce((sum, o) => sum + Number(o.total || 0), 0);
      return {
        jour: dayName,
        date: dateStr,
        caComores: dayCaComores,
        caSenegal: dayCaSenegal,
        ca: dayCaComores + dayCaSenegal
      };
    });

    // Modes de paiement réels
    const modesPaiementComores = [
      { name: "Espèces (Cash)", value: ordersComores.filter(o => o.moyenPaiement === "cash" || o.moyenPaiement === "especes").length },
      { name: "MVola", value: ordersComores.filter(o => o.moyenPaiement === "mvola").length },
      { name: "Wero / Holam", value: ordersComores.filter(o => o.moyenPaiement === "wero" || o.moyenPaiement === "holam").length },
      { name: "Carte", value: ordersComores.filter(o => o.moyenPaiement === "carte").length }
    ].filter(m => m.value > 0);

    const modesPaiementSenegal = [
      { name: "Espèces (Cash)", value: ordersSenegal.filter(o => o.moyenPaiement === "cash" || o.moyenPaiement === "especes").length },
      { name: "Wave / OM", value: ordersSenegal.filter(o => o.moyenPaiement === "wave" || o.moyenPaiement === "om" || o.moyenPaiement === "orange_money").length },
      { name: "Carte", value: ordersSenegal.filter(o => o.moyenPaiement === "carte").length }
    ].filter(m => m.value > 0);

    res.json({
      isEmploye: false,
      // Comores
      comores: {
        chiffreAffaires: caComores,
        coutAchats: coutAchatsComores,
        beneficeNet: beneficeComores,
        nbCommandes: nbCommandesComores,
        totalVentesCount: totalVentesCountComores,
        panierMoyen: panierMoyenComores,
        valeurStockVente: valeurStockComores,
        chartData: chartDataComores,
        modesPaiement: modesPaiementComores.length ? modesPaiementComores : [{ name: "Espèces", value: 1 }]
      },
      // Sénégal
      senegal: {
        chiffreAffaires: caSenegal,
        coutAchats: coutAchatsSenegal,
        beneficeNet: beneficeSenegal,
        nbCommandes: nbCommandesSenegal,
        totalVentesCount: totalVentesCountSenegal,
        panierMoyen: panierMoyenSenegal,
        valeurStockVente: valeurStockSenegal,
        chartData: chartDataSenegal,
        modesPaiement: modesPaiementSenegal.length ? modesPaiementSenegal : [{ name: "Espèces / Wave", value: 1 }]
      },
      // Global & Rétrocompatibilité
      chiffreAffaires: caComores + caSenegal,
      beneficeNet: beneficeComores + beneficeSenegal,
      beneficeComores,
      beneficeSenegal,
      totalDepensesAchats,
      valeurStockVente: valeurStockComores + valeurStockSenegal,
      valeurStockAchat,
      totalVentesCount,
      nbCommandes,
      panierMoyen: nbCommandes > 0 ? Math.round((caComores + caSenegal) / nbCommandes) : 0,
      chartData: chartDataGlobal,
      totalClients,
      totalReviews,
      noteMoyenneGlobale,
      stockFaibleCount: stockFaible.length,
      stockFaibleList: stockFaible,
      produitsExpirantCount: 0,
      produitsExpirantList: [],
      topProduits: top7Produits,
      top7Produits,
      flop7Produits,
      categoryStats,
      topCategories,
      flopCategories,
      totalProduits: produits.length,
      totalCategories: categories.length,
      mesCommandes
    });
  } catch (err) { next(err); }
});

/* ---------------------- FAMILLES DE PRODUITS ---------------------- */

router.get("/familles", async (req, res, next) => {
  try {
    const where = { boutiqueId: req.boutiqueId };
    if (req.query.categoryId) where.categoryId = req.query.categoryId;
    const list = await Famille.findAll({ 
      where,
      include: [{ model: Category, as: "category", attributes: ["id", "nom"] }],
      order: [["nom", "ASC"]]
    });
    if (list.length === 0 && !req.query.categoryId) {
      const defaults = [
        { nom: "Cosmétique", boutiqueId: req.boutiqueId },
        { nom: "Cheveux, Peignes & Brosses", boutiqueId: req.boutiqueId },
        { nom: "Broches & Accessoires Bijoux", boutiqueId: req.boutiqueId },
        { nom: "Parfums & Fragrances", boutiqueId: req.boutiqueId },
        { nom: "Maquillage & Teint", boutiqueId: req.boutiqueId }
      ];
      await Famille.bulkCreate(defaults);
      return res.json(await Famille.findAll({ 
        where: { boutiqueId: req.boutiqueId },
        include: [{ model: Category, as: "category", attributes: ["id", "nom"] }],
        order: [["nom", "ASC"]]
      }));
    }
    res.json(list);
  } catch (err) { next(err); }
});

router.post("/familles", async (req, res, next) => {
  try {
    const fam = await Famille.create({ ...req.body, boutiqueId: req.boutiqueId });
    purgeCache();
    broadcast("category_updated", { boutiqueId: req.boutiqueId });
    res.status(201).json(fam);
  } catch (err) { next(err); }
});

router.put("/familles/:id", async (req, res, next) => {
  try {
    const fam = await Famille.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!fam) return res.status(404).json({ message: "Famille introuvable." });
    await fam.update(req.body);
    purgeCache();
    broadcast("category_updated", { boutiqueId: req.boutiqueId });
    res.json(fam);
  } catch (err) { next(err); }
});

router.delete("/familles/:id", async (req, res, next) => {
  try {
    const fam = await Famille.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!fam) return res.status(404).json({ message: "Famille introuvable." });
    await fam.destroy();
    purgeCache();
    broadcast("category_updated", { boutiqueId: req.boutiqueId });
    res.json({ message: "Famille supprimée." });
  } catch (err) { next(err); }
});

/* ---------------------- CATÉGORIES ---------------------- */

router.get("/categories", async (req, res, next) => {
  try {
    res.json(await Category.findAll({ 
      where: { boutiqueId: req.boutiqueId },
      include: [{ model: Famille, as: "sousCategories" }],
      order: [["nom", "ASC"]]
    }));
  } catch (err) { next(err); }
});

router.post("/categories", async (req, res, next) => {
  try {
    const cat = await Category.create({ ...req.body, boutiqueId: req.boutiqueId });
    purgeCache();
    broadcast("category_updated", { boutiqueId: req.boutiqueId });
    res.status(201).json(cat);
  } catch (err) { next(err); }
});

router.put("/categories/:id", async (req, res, next) => {
  try {
    const cat = await Category.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!cat) return res.status(404).json({ message: "Catégorie introuvable." });
    await cat.update(req.body);
    purgeCache();
    broadcast("category_updated", { categoryId: cat.id, boutiqueId: req.boutiqueId });
    res.json(cat);
  } catch (err) { next(err); }
});

router.delete("/categories/:id", async (req, res, next) => {
  try {
    const cat = await Category.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!cat) return res.status(404).json({ message: "Catégorie introuvable." });
    await cat.destroy();
    purgeCache();
    broadcast("category_updated", { boutiqueId: req.boutiqueId });
    res.json({ message: "Catégorie supprimée." });
  } catch (err) { next(err); }
});

/* ---------------------- PRODUITS (catalogue) ---------------------- */

router.get("/products", async (req, res, next) => {
  try {
    const { page, limit, paginated, search, categorieId } = req.query;
    const cacheKey = `admin:products:${req.boutiqueId}:${req.originalUrl || req.url}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cached);
    }

    if (paginated === "true" || page) {
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const offset = (pageNum - 1) * limitNum;

      const where = { boutiqueId: req.boutiqueId };
      if (search && search.trim()) {
        const q = `%${search.trim()}%`;
        where[Op.or] = [
          { nom: { [Op.like]: q } },
          { description: { [Op.like]: q } }
        ];
      }
      if (categorieId) where.categorieId = categorieId;

      const { count, rows } = await Product.findAndCountAll({ 
        where, 
        include: [Category, { model: Fournisseur, as: "fournisseur" }, { model: Marque, as: "marque" }], 
        order: [["createdAt", "DESC"]],
        limit: limitNum,
        offset
      });

      const result = {
        items: rows,
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
        hasMore: offset + rows.length < count
      };

      await setCache(cacheKey, result, 180);
      res.setHeader("X-Cache", "MISS");
      return res.json(result);
    }

    const items = await Product.findAll({ 
      where: { boutiqueId: req.boutiqueId }, 
      include: [Category, { model: Fournisseur, as: "fournisseur" }, { model: Marque, as: "marque" }], 
      order: [["createdAt", "DESC"]] 
    });

    await setCache(cacheKey, items, 180);
    res.setHeader("X-Cache", "MISS");
    res.json(items);
  } catch (err) { next(err); }
});

router.post("/products", async (req, res, next) => {
  try {
    const product = await Product.create({ ...req.body, boutiqueId: req.boutiqueId });

    // Auto-enregistrement dans la table des Achats / Approvisionnements
    if (product.stock > 0 || Number(product.coutAchat) > 0 || product.fournisseurId) {
      const qty = product.stock || 1;
      const unitPrice = Number(product.coutAchat) || 0;
      await Achat.create({
        boutiqueId: req.boutiqueId,
        productId: product.id,
        fournisseurId: product.fournisseurId || null,
        quantite: qty,
        prixAchatUnitaire: unitPrice,
        totalAchat: qty * unitPrice,
        notes: "Création initiale de la fiche produit"
      }).catch(() => {});
    }

    const fullProduct = await Product.findByPk(product.id, {
      include: [Category, { model: Fournisseur, as: "fournisseur" }, { model: Marque, as: "marque" }]
    });

    purgeCache();
    broadcast("product_updated", { productId: product.id, boutiqueId: req.boutiqueId });
    broadcast("product_created", { productId: product.id, boutiqueId: req.boutiqueId });
    res.status(201).json(fullProduct);
  } catch (err) { next(err); }
});

router.put("/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!product) return res.status(404).json({ message: "Produit introuvable." });

    await product.update(req.body);

    // Synchronisation automatique de la ligne d'Achat associée
    const existingAchat = await Achat.findOne({
      where: { productId: product.id, boutiqueId: req.boutiqueId },
      order: [["createdAt", "ASC"]]
    });

    const qty = product.stock > 0 ? product.stock : 1;
    const unitCost = Number(product.coutAchat) || 0;

    if (existingAchat) {
      await existingAchat.update({
        fournisseurId: product.fournisseurId || existingAchat.fournisseurId,
        quantite: qty,
        prixAchatUnitaire: unitCost,
        totalAchat: qty * unitCost
      }).catch(() => {});
    } else if (qty > 0 || unitCost > 0) {
      await Achat.create({
        boutiqueId: req.boutiqueId,
        productId: product.id,
        fournisseurId: product.fournisseurId || null,
        quantite: qty,
        prixAchatUnitaire: unitCost,
        totalAchat: qty * unitCost,
        notes: "Mise à jour fiche produit"
      }).catch(() => {});
    }

    const fullProduct = await Product.findByPk(product.id, {
      include: [Category, { model: Fournisseur, as: "fournisseur" }, { model: Marque, as: "marque" }]
    });

    purgeCache();
    broadcast("product_updated", { productId: product.id, boutiqueId: req.boutiqueId });
    res.json(fullProduct);
  } catch (err) { next(err); }
});

router.delete("/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!product) return res.status(404).json({ message: "Produit introuvable." });
    await product.destroy();
    purgeCache();
    broadcast("product_updated", { productId: req.params.id, boutiqueId: req.boutiqueId });
    broadcast("product_deleted", { productId: req.params.id, boutiqueId: req.boutiqueId });
    res.json({ message: "Produit supprimé." });
  } catch (err) { 
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({ message: "Impossible de supprimer ce produit car il est lié à des commandes, des achats ou des avis existants. Veuillez plutôt le modifier pour le rendre indisponible ou masquer." });
    }
    next(err); 
  }
});

/* ---------------------- COMMANDES ---------------------- */

router.get("/orders", async (req, res, next) => {
  try {
    const where = { 
      boutiqueId: req.boutiqueId,
      statut: { [Op.ne]: "en_attente_paiement" }
    };
    if (req.query.statut) where.statut = req.query.statut;

    // Un employé ne doit voir que ses propres ventes
    if (req.user && req.user.role === "employe") {
      where.employeAssigneId = req.user.id;
    }

    const orders = await Order.findAll({
      where,
      include: [
        { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }, 
        { model: User, as: "client", attributes: ["nom", "telephone"] },
        { model: User, as: "employeAssigne", attributes: ["id", "nom", "role"] }
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(orders);
  } catch (err) { next(err); }
});

router.patch("/orders/:id/status", async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId },
      include: [{ model: OrderItem, as: "items" }],
      transaction: t
    });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ message: "Commande introuvable." });
    }

    if (["annulee", "livree", "recuperee"].includes(order.statut)) {
      await t.rollback();
      return res.status(400).json({ message: "Cette commande est déjà " + (order.statut === "annulee" ? "annulée" : "terminée") + ". Son statut ne peut plus être modifié." });
    }

    const newStatut = req.body.statut;
    await order.update({ statut: newStatut }, { transaction: t });

    if (newStatut === "annulee" && order.items && order.items.length > 0) {
      for (const item of order.items) {
        const prod = await Product.findByPk(item.productId, { transaction: t });
        if (prod) {
          await prod.update({
            stock: (prod.stock || 0) + item.quantite,
            ventesCount: Math.max(0, (prod.ventesCount || 0) - item.quantite)
          }, { transaction: t });
        }
      }
    }

    await t.commit();

    purgeCache();

    // Notifier le client de la mise à jour du statut
    const cmdNum = "COM-B" + String(order.id).padStart(3, "0");
    const labels = {
      en_attente: "En attente",
      validee: "Confirmée",
      en_preparation: "En préparation",
      pret_retrait: "Prête à récupérer en boutique",
      en_livraison: "En cours de livraison",
      recuperee: "Récupérée en boutique",
      livree: "Livrée",
      annulee: "Annulée"
    };
    const statutTxt = labels[newStatut] || newStatut;

    Notification.create({
      userId: order.clientId, boutiqueId: order.boutiqueId, orderId: order.id,
      title: "Mise à jour de votre commande",
      message: `Votre commande #${cmdNum} est maintenant : ${statutTxt}.`,
      type: "status"
    }).catch(() => {});

    broadcast("order_updated", { orderId: order.id, statut: newStatut, clientId: order.clientId, boutiqueId: order.boutiqueId });
    if (newStatut === "annulee") {
      broadcast("product_updated", { boutiqueId: order.boutiqueId });
    }

    User.findByPk(order.clientId).then(clientUser => {
      if (clientUser && clientUser.email) {
        Boutique.findByPk(order.boutiqueId).then(b => {
          sendOrderStatusEmail(clientUser.email, clientUser.nom, order, newStatut, b?.nom || "Marché Vert").catch(() => {});
        }).catch(() => {});
      }
    }).catch(() => {});

    res.json(order);
  } catch (err) {
    if (t && !t.finished) {
      await t.rollback();
    }
    next(err);
  }
});

router.patch("/orders/:id/assign", async (req, res, next) => {
  try {
    const order = await Order.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!order) return res.status(404).json({ message: "Commande introuvable." });
    const empId = req.body.employeId || null;
    await order.update({ employeAssigneId: empId });

    if (empId) {
      const cmdNum = "COM-B" + String(order.id).padStart(3, "0");
      Notification.create({
        userId: empId, boutiqueId: order.boutiqueId, orderId: order.id,
        title: "Nouvelle commande assignée",
        message: `La commande #${cmdNum} vous a été attribuée.`,
        type: "order"
      }).catch(() => {});
    }

    broadcast("order_updated", { orderId: order.id, employeId: empId, boutiqueId: order.boutiqueId });
    res.json(order);
  } catch (err) { next(err); }
});

router.put("/orders/:id", requireRole("admin", "employe"), async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId },
      include: [{ model: OrderItem, as: "items" }],
      transaction: t
    });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ message: "Vente / commande introuvable." });
    }

    const { moyenPaiement, statut, notes, clientNom, clientTelephone, adresseLivraison, items, devise } = req.body;

    const updates = {};
    if (moyenPaiement !== undefined) updates.moyenPaiement = moyenPaiement;
    if (notes !== undefined) updates.notes = notes;
    if (clientNom !== undefined) updates.clientNom = clientNom;
    if (clientTelephone !== undefined) updates.clientTelephone = clientTelephone;
    if (adresseLivraison !== undefined) updates.adresseLivraison = adresseLivraison;
    if (statut !== undefined) updates.statut = statut;
    if (devise !== undefined) updates.devise = devise;

    // Si des items de panier sont fournis pour modification
    if (Array.isArray(items) && items.length > 0) {
      // 1. Re-crediter le stock des anciens items
      if (order.items && order.items.length > 0) {
        for (const oldIt of order.items) {
          if (oldIt.productId) {
            const p = await Product.findByPk(oldIt.productId, { transaction: t });
            if (p) {
              await p.update({
                stock: (p.stock || 0) + oldIt.quantite,
                ventesCount: Math.max(0, (p.ventesCount || 0) - oldIt.quantite)
              }, { transaction: t });
            }
          }
        }
        await OrderItem.destroy({ where: { orderId: order.id }, transaction: t });
      }

      // 2. Creer les nouveaux items et deduire le stock
      const saleCurrency = updates.devise || order.devise || "KMF";
      let newSousTotal = 0;

      for (const it of items) {
        const p = await Product.findOne({ where: { id: it.productId, boutiqueId: req.boutiqueId }, transaction: t });
        if (!p) {
          await t.rollback();
          return res.status(404).json({ message: `Produit ID ${it.productId} introuvable.` });
        }

        let prixEffectif = 0;
        if (it.prixVendu !== undefined && it.prixVendu !== null && !isNaN(Number(it.prixVendu)) && Number(it.prixVendu) > 0) {
          prixEffectif = Number(it.prixVendu);
        } else if (it.prixUnitaire !== undefined && it.prixUnitaire !== null && !isNaN(Number(it.prixUnitaire)) && Number(it.prixUnitaire) > 0) {
          prixEffectif = Number(it.prixUnitaire);
        } else if (saleCurrency === "FCFA") {
          prixEffectif = p.enPromo && p.prixPromoSenegal ? Number(p.prixPromoSenegal) : Number(p.prixSenegal || p.prix);
        } else {
          prixEffectif = p.enPromo && p.prixPromo ? Number(p.prixPromo) : Number(p.prix);
        }

        const chosenModele = it.selectedModele || it.modele || null;
        const chosenCouleur = it.selectedCouleur || it.couleur || null;
        const chosenSenteur = it.selectedSenteur || it.senteur || null;
        const chosenImage = it.selectedImageUrl || it.imageUrl || null;

        await OrderItem.create({
          orderId: order.id,
          productId: it.productId,
          quantite: it.quantite,
          prixUnitaire: prixEffectif,
          modele: chosenModele,
          couleur: chosenCouleur || chosenSenteur,
          imageUrl: chosenImage
        }, { transaction: t });

        p.stock = Math.max(0, (p.stock || 0) - it.quantite);
        p.ventesCount = (p.ventesCount || 0) + it.quantite;
        await p.save({ transaction: t });

        newSousTotal += prixEffectif * it.quantite;
      }

      updates.sousTotal = newSousTotal;
      updates.total = newSousTotal + (order.fraisLivraison || 0);
    }

    await order.update(updates, { transaction: t });
    await t.commit();

    const fullOrder = await Order.findByPk(order.id, {
      include: [
        { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] },
        { model: User, as: "client", attributes: ["nom", "telephone"] },
        { model: User, as: "employeAssigne", attributes: ["nom"] }
      ]
    });

    purgeCache();
    broadcast("order_updated", { orderId: order.id, boutiqueId: req.boutiqueId });
    broadcast("product_updated", { boutiqueId: req.boutiqueId });

    res.json(fullOrder);
  } catch (err) {
    await t.rollback();
    next(err);
  }
});

router.delete("/orders/:id", requireRole("admin", "employe"), async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId },
      include: [{ model: OrderItem, as: "items" }],
      transaction: t
    });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ message: "Vente / commande introuvable." });
    }

    // Réintégrer le stock si la commande n'était pas déjà annulée
    if (order.statut !== "annulee" && order.items && order.items.length > 0) {
      for (const item of order.items) {
        if (item.productId) {
          const prod = await Product.findByPk(item.productId, { transaction: t });
          if (prod) {
            await prod.update({
              stock: (prod.stock || 0) + item.quantite,
              ventesCount: Math.max(0, (prod.ventesCount || 0) - item.quantite)
            }, { transaction: t });
          }
        }
      }
    }

    await OrderItem.destroy({ where: { orderId: order.id }, transaction: t });
    await order.destroy({ transaction: t });

    await t.commit();
    purgeCache();
    broadcast("order_deleted", { orderId: req.params.id, boutiqueId: req.boutiqueId });
    broadcast("product_updated", { boutiqueId: req.boutiqueId });

    res.json({ message: "Vente supprimée avec succès et stock réajusté." });
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    next(err);
  }
});

/* ---------------------- GESTION DES UTILISATEURS (ADMINS & EMPLOYÉS) ---------------------- */

router.get("/employees", requireRole("admin"), async (req, res, next) => {
  try {
    const users = await User.findAll({ 
      where: { boutiqueId: req.boutiqueId, role: { [Op.in]: ["admin", "employe"] } }, 
      attributes: { exclude: ["motDePasseHash"] },
      order: [["createdAt", "DESC"]]
    });
    res.json(users);
  } catch (err) { next(err); }
});

router.post("/employees", requireRole("admin"), async (req, res, next) => {
  try {
    const { nom, email, telephone, motDePasse, role, permissions, deviseAutorisee } = req.body;
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanPhone = telephone ? String(telephone).trim() : null;

    if (!nom || (!cleanEmail && !cleanPhone)) {
      return res.status(400).json({ message: "Le nom et au moins un email ou téléphone sont requis." });
    }

    const { Op } = require("sequelize");
    const whereCond = [];
    if (cleanEmail) whereCond.push({ email: cleanEmail });
    if (cleanPhone) whereCond.push({ telephone: cleanPhone });

    const existant = await User.findOne({ where: { [Op.or]: whereCond } });
    if (existant) return res.status(409).json({ message: "Un compte existe déjà avec cet email ou téléphone." });

    const userRole = role === "admin" ? "admin" : "employe";
    const userPermissions = userRole === "admin" 
      ? ["voir_dashboard", "gerer_banners", "gerer_categories", "gerer_produits", "gerer_commandes", "gerer_parametres", "gerer_utilisateurs"]
      : (permissions || []);

    const rawPassword = motDePasse && motDePasse.trim() ? motDePasse.trim() : Math.random().toString(36).slice(-8) + "A1!";
    const motDePasseHash = await bcrypt.hash(rawPassword, 10);

    const user = await User.create({
      nom: nom.trim(),
      email: cleanEmail,
      telephone: cleanPhone,
      motDePasseHash,
      permissions: userPermissions,
      deviseAutorisee: deviseAutorisee || "TOUTES",
      role: userRole,
      boutiqueId: req.boutiqueId,
      statut: "actif",
      mustChangePassword: true,
      isEmailVerified: true
    });

    if (cleanEmail) {
      const { envoyerEmailCreationCompte } = require("../services/emailService");
      Boutique.findByPk(req.boutiqueId).then(b => {
        envoyerEmailCreationCompte(cleanEmail, user.nom, cleanEmail || cleanPhone, cleanPhone, rawPassword, userRole, b?.nom || "Marché Vert").catch(() => {});
      }).catch(() => {});
    }

    res.status(201).json({ 
      id: user.id, nom: user.nom, email: user.email, telephone: user.telephone, 
      role: user.role, permissions: user.permissions, deviseAutorisee: user.deviseAutorisee, statut: user.statut,
      generatedPassword: rawPassword,
      mustChangePassword: true
    });
  } catch (err) { next(err); }
});

router.put("/employees/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const targetUser = await User.findOne({ 
      where: { id: req.params.id, boutiqueId: req.boutiqueId, role: { [Op.in]: ["admin", "employe"] } } 
    });
    if (!targetUser) return res.status(404).json({ message: "Utilisateur introuvable." });

    const { nom, email, telephone, motDePasse, role, permissions, deviseAutorisee, statut } = req.body;
    if (targetUser.id === req.user.id && statut === "suspendu") {
      return res.status(400).json({ message: "Vous ne pouvez pas suspendre votre propre compte administrateur." });
    }

    if (nom) targetUser.nom = nom;
    if (email) targetUser.email = email;
    if (telephone !== undefined) targetUser.telephone = telephone;
    if (statut) targetUser.statut = statut;
    if (deviseAutorisee !== undefined) targetUser.deviseAutorisee = deviseAutorisee;
    
    if (role) {
      targetUser.role = role === "admin" ? "admin" : "employe";
    }

    if (targetUser.role === "admin") {
      targetUser.permissions = ["voir_dashboard", "gerer_banners", "gerer_categories", "gerer_produits", "gerer_commandes", "gerer_parametres", "gerer_utilisateurs"];
    } else if (permissions !== undefined) {
      targetUser.permissions = permissions;
    }

    if (motDePasse && motDePasse.trim()) {
      targetUser.motDePasseHash = await bcrypt.hash(motDePasse.trim(), 10);
    }

    await targetUser.save();
    res.json({ 
      id: targetUser.id, nom: targetUser.nom, email: targetUser.email, telephone: targetUser.telephone, 
      role: targetUser.role, permissions: targetUser.permissions, deviseAutorisee: targetUser.deviseAutorisee, statut: targetUser.statut 
    });
  } catch (err) { next(err); }
});

router.patch("/employees/:id/status", requireRole("admin"), async (req, res, next) => {
  try {
    const targetUser = await User.findOne({ 
      where: { id: req.params.id, boutiqueId: req.boutiqueId, role: { [Op.in]: ["admin", "employe"] } } 
    });
    if (!targetUser) return res.status(404).json({ message: "Utilisateur introuvable." });
    
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ message: "Vous ne pouvez pas suspendre votre propre compte administrateur." });
    }

    const nouveauStatut = targetUser.statut === "actif" ? "suspendu" : "actif";
    await targetUser.update({ statut: nouveauStatut });
    res.json(targetUser);
  } catch (err) { next(err); }
});

router.delete("/employees/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const targetUser = await User.findOne({ 
      where: { id: req.params.id, boutiqueId: req.boutiqueId, role: { [Op.in]: ["admin", "employe"] } } 
    });
    if (!targetUser) return res.status(404).json({ message: "Utilisateur introuvable." });

    if (targetUser.id === req.user.id) {
      return res.status(400).json({ message: "Vous ne pouvez pas supprimer votre propre compte." });
    }

    // Vérifier si l'utilisateur possède des opérations (commandes passées ou assignées)
    const hasClientOrders = await Order.count({ where: { clientId: targetUser.id } });
    const hasAssignedOrders = await Order.count({ where: { employeAssigneId: targetUser.id } });

    if (hasClientOrders > 0 || hasAssignedOrders > 0) {
      return res.status(400).json({ 
        message: "Impossible de supprimer cet utilisateur car il possède déjà des opérations enregistrées (commandes passées ou ventes gérées). Vous devez plutôt le suspendre.",
        canSuspend: true
      });
    }

    await targetUser.destroy();
    res.json({ message: "Utilisateur supprimé avec succès." });
  } catch (err) { next(err); }
});

/* ---------------------- GESTION DES CLIENTS ---------------------- */

router.get("/clients", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const clients = await User.findAll({
      where: { role: "client", isEmailVerified: true },
      attributes: { exclude: ["motDePasseHash"] },
      order: [["createdAt", "DESC"]]
    });
    res.json(clients);
  } catch (err) { next(err); }
});

router.post("/clients", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const { nom, email, telephone, motDePasse } = req.body;
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanPhone = telephone ? String(telephone).trim() : null;

    if (!nom || !cleanPhone || !motDePasse) {
      return res.status(400).json({ message: "Le nom, le numéro de téléphone et le mot de passe sont requis." });
    }

    const existant = await User.findOne({ 
      where: { [Op.or]: [{ telephone: cleanPhone }, ...(cleanEmail ? [{ email: cleanEmail }] : [])] } 
    });
    if (existant) return res.status(409).json({ message: "Un compte client existe déjà avec ce téléphone ou cet e-mail." });

    const motDePasseHash = await bcrypt.hash(motDePasse, 10);
    const client = await User.create({
      nom: nom.trim(),
      email: cleanEmail,
      telephone: cleanPhone,
      motDePasseHash,
      role: "client",
      statut: "actif",
      isEmailVerified: true
    });

    res.status(201).json({
      id: client.id, nom: client.nom, email: client.email, telephone: client.telephone,
      role: client.role, statut: client.statut, isEmailVerified: client.isEmailVerified
    });
  } catch (err) { next(err); }
});

router.put("/clients/:id", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const client = await User.findOne({ where: { id: req.params.id, role: "client" } });
    if (!client) return res.status(404).json({ message: "Client introuvable." });

    const { nom, email, telephone, motDePasse, statut } = req.body;
    if (nom) client.nom = nom.trim();
    if (email !== undefined) client.email = email ? String(email).trim().toLowerCase() : null;
    if (telephone !== undefined) client.telephone = telephone ? String(telephone).trim() : null;
    if (statut) client.statut = statut;

    if (motDePasse && motDePasse.trim()) {
      client.motDePasseHash = await bcrypt.hash(motDePasse.trim(), 10);
    }

    await client.save();
    res.json({
      id: client.id, nom: client.nom, email: client.email, telephone: client.telephone,
      role: client.role, statut: client.statut, isEmailVerified: client.isEmailVerified
    });
  } catch (err) { next(err); }
});

router.patch("/clients/:id/status", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const client = await User.findOne({ where: { id: req.params.id, role: "client" } });
    if (!client) return res.status(404).json({ message: "Client introuvable." });

    const nouveauStatut = client.statut === "actif" ? "suspendu" : "actif";
    await client.update({ statut: nouveauStatut });
    res.json({ id: client.id, nom: client.nom, statut: client.statut });
  } catch (err) { next(err); }
});

router.delete("/clients/:id", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const client = await User.findOne({ where: { id: req.params.id, role: "client" } });
    if (!client) return res.status(404).json({ message: "Client introuvable." });

    // Vérifier si le client possède des commandes enregistrées
    const hasOrders = await Order.count({ where: { clientId: client.id } });
    if (hasOrders > 0) {
      return res.status(400).json({ 
        message: "Impossible de supprimer ce client car il possède déjà des commandes enregistrées. Vous devez plutôt le suspendre.",
        canSuspend: true
      });
    }

    await client.destroy();
    res.json({ message: "Compte client supprimé avec succès." });
  } catch (err) { next(err); }
});


/* ---------------------- PARAMÈTRES BOUTIQUE ---------------------- */

router.get("/boutique", async (req, res, next) => {
  try {
    res.json(await Boutique.findByPk(req.boutiqueId));
  } catch (err) { next(err); }
});

router.put("/boutique", requireRole("admin"), async (req, res, next) => {
  try {
    const boutique = await Boutique.findByPk(req.boutiqueId);
    const { 
      nom, logoUrl, couleurPrincipale, devise, fraisLivraison, zonesLivraison, 
      bannerSlides, sideBanners, telephone, telephone2, adresse, adresse2, adresseRetrait, 
      emailContact, aProposText, aProposImageUrl, aProposBannerUrl, horairesOuverture, facebookUrl, instagramUrl, 
      tiktokUrl, whatsappNumber, modesPaiement, modulesActifs,
      customDomain, stripePublishableKey, stripeSecretKey, stripeAccountId,
      paydunyaMasterKey, paydunyaPrivateKey, paydunyaToken,
      unitechApiKey, reloadlyClientId, reloadlyClientSecret, reloadlySandbox, dingApiKey
    } = req.body;

    let targetCustomDomain = boutique.customDomain;
    if (customDomain !== undefined) {
      const formattedDomain = customDomain ? customDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '') : null;
      if (formattedDomain && formattedDomain !== boutique.customDomain) {
        const existant = await Boutique.findOne({ where: { customDomain: formattedDomain, id: { [Op.ne]: boutique.id } } });
        if (existant) {
          return res.status(409).json({ message: "Ce nom de domaine personnalisé est déjà utilisé par une autre boutique." });
        }
      }
      targetCustomDomain = formattedDomain || null;
    }

    let cleanModesPaiement = boutique.modesPaiement;
    if (modesPaiement !== undefined) {
      let parsedModes = modesPaiement;
      if (typeof parsedModes === "string") {
        try { parsedModes = JSON.parse(parsedModes); } catch (e) { parsedModes = {}; }
      }
      if (parsedModes && typeof parsedModes === "object") {
        cleanModesPaiement = {
          especes: parsedModes.especes !== undefined ? !!parsedModes.especes : true,
          mvola: parsedModes.mvola !== undefined ? !!parsedModes.mvola : true,
          holam: parsedModes.holam !== undefined ? !!parsedModes.holam : true,
          carte: parsedModes.carte !== undefined ? !!parsedModes.carte : false,
          wave: parsedModes.wave !== undefined ? !!parsedModes.wave : false,
          orange: parsedModes.orange !== undefined ? !!parsedModes.orange : false
        };
      }
    }

    if (cleanModesPaiement) {
      boutique.set("modesPaiement", cleanModesPaiement);
      boutique.changed("modesPaiement", true);
    }

    await boutique.update({ 
      nom, logoUrl, couleurPrincipale, devise: devise || boutique.devise || "KMF", fraisLivraison, zonesLivraison, 
      bannerSlides, sideBanners, telephone, telephone2, adresse, adresse2, adresseRetrait, 
      emailContact, aProposText, aProposImageUrl, aProposBannerUrl, horairesOuverture, facebookUrl, instagramUrl, 
      tiktokUrl, whatsappNumber, modesPaiement: cleanModesPaiement, modulesActifs,
      customDomain: targetCustomDomain,
      ...(stripePublishableKey !== undefined && { stripePublishableKey }),
      ...(stripeSecretKey !== undefined && { stripeSecretKey }),
      ...(stripeAccountId !== undefined && { stripeAccountId }),
      ...(paydunyaMasterKey !== undefined && { paydunyaMasterKey }),
      ...(paydunyaPrivateKey !== undefined && { paydunyaPrivateKey }),
      ...(paydunyaToken !== undefined && { paydunyaToken }),
      ...(unitechApiKey !== undefined && { unitechApiKey }),
      ...(reloadlyClientId !== undefined && { reloadlyClientId }),
      ...(reloadlyClientSecret !== undefined && { reloadlyClientSecret }),
      ...(reloadlySandbox !== undefined && { reloadlySandbox }),
      ...(dingApiKey !== undefined && { dingApiKey })
    });
    purgeCache();
    broadcast("boutique_updated", { boutiqueId: req.boutiqueId });
    res.json(boutique);
  } catch (err) { next(err); }
});

/* ---------------------- VENTE DIRECTE (POS CAISSE) ---------------------- */

router.post("/ventes/directe", async (req, res, next) => {
  try {
    const { items, clientNom, clientTelephone, moyenPaiement, devise, idempotencyKey } = req.body;
    if (idempotencyKey) {
      const existing = await getCache(`idempotency:${idempotencyKey}`);
      if (existing) {
        return res.status(200).json(existing);
      }
    }
    if (!items || !items.length) {
      return res.status(400).json({ message: "Le panier de vente est vide." });
    }

    const saleCurrency = (devise && String(devise).toUpperCase() === "FCFA") ? "FCFA" : "KMF";

    // Client par défaut ou client renseigné
    let client = null;
    if (clientTelephone || clientNom) {
      const emailGuest = `client_${Date.now()}@marche-vert.local`;
      [client] = await User.findOrCreate({
        where: { telephone: clientTelephone || "non_renseigne", boutiqueId: req.boutiqueId },
        defaults: {
          nom: clientNom || "Client comptoir",
          email: emailGuest,
          motDePasseHash: "guest_cashier",
          role: "client"
        }
      });
    } else {
      [client] = await User.findOrCreate({
        where: { email: `comptoir_${req.boutiqueId}@marche-vert.local` },
        defaults: {
          nom: "Client comptoir",
          telephone: "00000000",
          motDePasseHash: "guest_cashier",
          role: "client",
          boutiqueId: req.boutiqueId
        }
      });
    }

    // Calcul sous-total et vérification des stocks selon la devise
    let sousTotal = 0;
    for (const it of items) {
      const p = await Product.findOne({ where: { id: it.productId, boutiqueId: req.boutiqueId } });
      if (!p) return res.status(404).json({ message: `Produit ID ${it.productId} introuvable.` });
      
      let prixEffectif = 0;
      if (it.prixVendu !== undefined && it.prixVendu !== null && !isNaN(Number(it.prixVendu)) && Number(it.prixVendu) > 0) {
        prixEffectif = Number(it.prixVendu);
      } else if (it.prixUnitaire !== undefined && it.prixUnitaire !== null && !isNaN(Number(it.prixUnitaire)) && Number(it.prixUnitaire) > 0) {
        prixEffectif = Number(it.prixUnitaire);
      } else if (saleCurrency === "FCFA") {
        prixEffectif = p.enPromo && p.prixPromoSenegal ? Number(p.prixPromoSenegal) : Number(p.prixSenegal || p.prix);
      } else {
        prixEffectif = p.enPromo && p.prixPromo ? Number(p.prixPromo) : Number(p.prix);
      }

      it.prixUnitaire = prixEffectif;
      sousTotal += prixEffectif * it.quantite;
    }

    // Création de la commande directe (statut "recuperee" / effectuée)
    const order = await Order.create({
      boutiqueId: req.boutiqueId,
      clientId: client.id,
      statut: "recuperee",
      modeLivraison: "retrait",
      adresseLivraison: "Achat direct en boutique / comptoir",
      moyenPaiement: moyenPaiement || "cash",
      typeVente: "vente_directe",
      employeAssigneId: req.user.id,
      sousTotal,
      fraisLivraison: 0,
      total: sousTotal,
      devise: saleCurrency
    });

    // Enregistrement des items et décrémentation directe des stocks
    for (const it of items) {
      const chosenModele = it.selectedModele || it.modele || null;
      const chosenCouleur = it.selectedCouleur || it.couleur || null;
      const chosenSenteur = it.selectedSenteur || it.senteur || null;
      const chosenImage = it.selectedImageUrl || it.imageUrl || null;

      await OrderItem.create({
        orderId: order.id,
        productId: it.productId,
        quantite: it.quantite,
        prixUnitaire: it.prixUnitaire,
        modele: chosenModele,
        couleur: chosenCouleur || chosenSenteur,
        imageUrl: chosenImage
      });

      const p = await Product.findByPk(it.productId);
      if (p) {
        p.stock = Math.max(0, p.stock - it.quantite);
        p.ventesCount = (p.ventesCount || 0) + it.quantite;

        // Décrémenter la couleur spécifique si vendue
        if (chosenCouleur && p.couleurs) {
          let list = typeof p.couleurs === "string" ? JSON.parse(p.couleurs) : p.couleurs;
          if (Array.isArray(list)) {
            list = list.map(c => {
              if (c.nom && String(c.nom).trim().toLowerCase() === String(chosenCouleur).trim().toLowerCase()) {
                const cur = c.quantite !== undefined && c.quantite !== null ? Number(c.quantite) : (c.stock !== undefined && c.stock !== null ? Number(c.stock) : null);
                if (cur !== null) {
                  const updated = Math.max(0, cur - it.quantite);
                  return { ...c, quantite: updated, stock: updated };
                }
              }
              return c;
            });
            p.couleurs = list;
          }
        }

        // Décrémenter le modèle spécifique si vendu
        if (chosenModele && p.modelesCompatibles) {
          let list = typeof p.modelesCompatibles === "string" ? JSON.parse(p.modelesCompatibles) : p.modelesCompatibles;
          if (Array.isArray(list)) {
            list = list.map(m => {
              const mNom = m.nomComplet || m.nom;
              if (mNom && String(mNom).trim().toLowerCase() === String(chosenModele).trim().toLowerCase()) {
                const cur = m.quantite !== undefined && m.quantite !== null ? Number(m.quantite) : (m.stock !== undefined && m.stock !== null ? Number(m.stock) : null);
                if (cur !== null) {
                  const updated = Math.max(0, cur - it.quantite);
                  return { ...m, quantite: updated, stock: updated };
                }
              }
              return m;
            });
            p.modelesCompatibles = list;
          }
        }

        // Décrémenter la senteur spécifique si vendue
        if (chosenSenteur && p.senteurs) {
          let list = typeof p.senteurs === "string" ? JSON.parse(p.senteurs) : p.senteurs;
          if (Array.isArray(list)) {
            list = list.map(s => {
              if (s.nom && String(s.nom).trim().toLowerCase() === String(chosenSenteur).trim().toLowerCase()) {
                const cur = s.quantite !== undefined && s.quantite !== null ? Number(s.quantite) : (s.stock !== undefined && s.stock !== null ? Number(s.stock) : null);
                if (cur !== null) {
                  const updated = Math.max(0, cur - it.quantite);
                  return { ...s, quantite: updated, stock: updated };
                }
              }
              return s;
            });
            p.senteurs = list;
          }
        }

        await p.save();
      }
    }

    const fullOrder = await Order.findByPk(order.id, {
      include: [
        { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] },
        { model: User, as: "client", attributes: ["nom", "telephone"] },
        { model: User, as: "employeAssigne", attributes: ["nom"] }
      ]
    });

    purgeCache();
    broadcast("order_created", { orderId: order.id, clientId: client.id, boutiqueId: req.boutiqueId });
    broadcast("product_updated", { boutiqueId: req.boutiqueId });

    if (idempotencyKey) {
      await setCache(`idempotency:${idempotencyKey}`, fullOrder, 86400).catch(() => {});
    }

    res.status(201).json(fullOrder);
  } catch (err) { next(err); }
});

/* ---------------------- GESTION DES FOURNISSEURS ---------------------- */

router.get("/fournisseurs", async (req, res, next) => {
  try {
    const list = await Fournisseur.findAll({ 
      where: { boutiqueId: req.boutiqueId },
      order: [["createdAt", "DESC"]]
    });
    res.json(list);
  } catch (err) { next(err); }
});

router.post("/fournisseurs", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const fourn = await Fournisseur.create({ ...req.body, boutiqueId: req.boutiqueId });
    res.status(201).json(fourn);
  } catch (err) { next(err); }
});

router.put("/fournisseurs/:id", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const fourn = await Fournisseur.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!fourn) return res.status(404).json({ message: "Fournisseur introuvable." });
    await fourn.update(req.body);
    res.json(fourn);
  } catch (err) { next(err); }
});

router.delete("/fournisseurs/:id", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const fourn = await Fournisseur.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!fourn) return res.status(404).json({ message: "Fournisseur introuvable." });
    await fourn.destroy();
    res.json({ message: "Fournisseur supprimé." });
  } catch (err) { next(err); }
});

/* ---------------------- GESTION DES UNITÉS DE VENTE ---------------------- */

router.get("/unites", async (req, res, next) => {
  try {
    let list = await UniteVente.findAll({ where: { boutiqueId: req.boutiqueId } });
    if (list.length === 0) {
      const defaults = [
        { nom: "Kilogramme", abbreviation: "Kg", boutiqueId: req.boutiqueId },
        { nom: "Litre", abbreviation: "Litre", boutiqueId: req.boutiqueId },
        { nom: "Pièce / Unité", abbreviation: "Pièce", boutiqueId: req.boutiqueId },
        { nom: "Carton", abbreviation: "Carton", boutiqueId: req.boutiqueId },
        { nom: "Sac", abbreviation: "Sac", boutiqueId: req.boutiqueId },
        { nom: "Bouteille", abbreviation: "Bouteille", boutiqueId: req.boutiqueId },
        { nom: "Paquet / Pack", abbreviation: "Paquet", boutiqueId: req.boutiqueId }
      ];
      await UniteVente.bulkCreate(defaults);
      list = await UniteVente.findAll({ where: { boutiqueId: req.boutiqueId } });
    }
    res.json(list);
  } catch (err) { next(err); }
});

router.post("/unites", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const unite = await UniteVente.create({ ...req.body, boutiqueId: req.boutiqueId });
    res.status(201).json(unite);
  } catch (err) { next(err); }
});

router.put("/unites/:id", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const unite = await UniteVente.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!unite) return res.status(404).json({ message: "Unité introuvable." });
    await unite.update(req.body);
    res.json(unite);
  } catch (err) { next(err); }
});

router.delete("/unites/:id", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const unite = await UniteVente.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!unite) return res.status(404).json({ message: "Unité introuvable." });
    await unite.destroy();
    res.json({ message: "Unité supprimée." });
  } catch (err) { next(err); }
});

/* ---------------------- GESTION DES ACHATS & APPROVISIONNEMENTS ---------------------- */

router.get("/achats", async (req, res, next) => {
  try {
    const where = { boutiqueId: req.boutiqueId };
    const { startDate, endDate } = req.query;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = end;
      }
    }

    const list = await Achat.findAll({
      where,
      include: [
        { model: Product, as: "product" },
        { model: Fournisseur, as: "fournisseur" }
      ],
      order: [["createdAt", "DESC"]]
    });

    // Calculs de rentabilité et bénéfices
    const totalDepenses = list.reduce((sum, a) => sum + Number(a.totalAchat || 0), 0);

    // Calcul potentiel / prévisionnel sur le stock et sur les ventes
    let potentielVenteKMF = 0;
    let potentielVenteFCFA = 0;

    for (const item of list) {
      if (item.product) {
        const pKmf = Number(item.product.prixPromo || item.product.prix || 0);
        const pFcfa = Number(item.product.prixPromoSenegal || item.product.prixSenegal || 0);
        const q = Number(item.quantite || 0);
        potentielVenteKMF += (pKmf * q);
        potentielVenteFCFA += (pFcfa * q);
      }
    }

    const beneficePrevisionnelKMF = Math.max(0, potentielVenteKMF - totalDepenses);
    const beneficePrevisionnelFCFA = Math.max(0, potentielVenteFCFA - totalDepenses);

    res.json({
      achats: list,
      totalDepenses,
      beneficePrevisionnelKMF,
      beneficePrevisionnelFCFA,
      potentielVenteKMF,
      potentielVenteFCFA
    });
  } catch (err) { next(err); }
});

router.post("/achats", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const { productId, fournisseurId, quantite, prixAchatUnitaire, notes } = req.body;
    const prod = await Product.findOne({ where: { id: productId, boutiqueId: req.boutiqueId } });
    if (!prod) return res.status(404).json({ message: "Produit introuvable." });

    const qty = Number(quantite) || 1;
    const unitPrice = Number(prixAchatUnitaire) || 0;
    const totalAchat = qty * unitPrice;

    const achat = await Achat.create({
      boutiqueId: req.boutiqueId,
      productId: prod.id,
      fournisseurId: fournisseurId || null,
      quantite: qty,
      prixAchatUnitaire: unitPrice,
      totalAchat,
      notes: notes || ""
    });

    // Mise à jour automatique du stock et du prix/coût d'achat du produit
    prod.stock = (prod.stock || 0) + qty;
    if (unitPrice > 0) {
      prod.coutAchat = unitPrice;
    }
    await prod.save();
    purgeCache();
    broadcast("product_updated", { productId: prod.id, boutiqueId: req.boutiqueId });

    const fullAchat = await Achat.findByPk(achat.id, {
      include: [
        { model: Product, as: "product" },
        { model: Fournisseur, as: "fournisseur" }
      ]
    });

    res.status(201).json(fullAchat);
  } catch (err) { next(err); }
});

router.put("/achats/:id", requireRole("admin", "employe"), async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const achat = await Achat.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId },
      transaction: t
    });
    if (!achat) {
      await t.rollback();
      return res.status(404).json({ message: "Achat introuvable." });
    }

    const { quantite, prixAchatUnitaire, fournisseurId, notes } = req.body;
    const oldQty = Number(achat.quantite || 0);
    const newQty = quantite !== undefined ? (Number(quantite) || 0) : oldQty;
    const newUnitPrice = prixAchatUnitaire !== undefined ? (Number(prixAchatUnitaire) || 0) : Number(achat.prixAchatUnitaire || 0);

    const diffQty = newQty - oldQty;

    // Réajuster le stock du produit associé
    if (achat.productId) {
      const prod = await Product.findByPk(achat.productId, { transaction: t });
      if (prod) {
        prod.stock = Math.max(0, (prod.stock || 0) + diffQty);
        if (newUnitPrice > 0) prod.coutAchat = newUnitPrice;
        await prod.save({ transaction: t });
      }
    }

    await achat.update({
      quantite: newQty,
      prixAchatUnitaire: newUnitPrice,
      totalAchat: newQty * newUnitPrice,
      fournisseurId: fournisseurId !== undefined ? (fournisseurId || null) : achat.fournisseurId,
      notes: notes !== undefined ? notes : achat.notes
    }, { transaction: t });

    await t.commit();
    purgeCache();
    broadcast("product_updated", { productId: achat.productId, boutiqueId: req.boutiqueId });

    const updatedAchat = await Achat.findByPk(achat.id, {
      include: [
        { model: Product, as: "product" },
        { model: Fournisseur, as: "fournisseur" }
      ]
    });

    res.json(updatedAchat);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    next(err);
  }
});

router.delete("/achats/:id", requireRole("admin", "employe"), async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const achat = await Achat.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId },
      transaction: t
    });
    if (!achat) {
      await t.rollback();
      return res.status(404).json({ message: "Achat introuvable." });
    }

    // Déduire la quantité du stock produit
    if (achat.productId) {
      const prod = await Product.findByPk(achat.productId, { transaction: t });
      if (prod) {
        prod.stock = Math.max(0, (prod.stock || 0) - (Number(achat.quantite) || 0));
        await prod.save({ transaction: t });
      }
    }

    await achat.destroy({ transaction: t });
    await t.commit();

    purgeCache();
    broadcast("product_updated", { productId: achat.productId, boutiqueId: req.boutiqueId });

    res.json({ message: "Approvisionnement supprimé avec succès et stock réajusté." });
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    next(err);
  }
});

/* ---------------------- GESTION DES MARQUES ---------------------- */

router.get("/marques", async (req, res, next) => {
  try {
    const list = await Marque.findAll({
      where: { boutiqueId: req.boutiqueId },
      include: [{ model: Product, as: "produits", attributes: ["id"] }],
      order: [["nom", "ASC"]]
    });
    res.json(list);
  } catch (err) { next(err); }
});

router.post("/marques", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const { nom, logoUrl, description } = req.body;
    if (!nom || !nom.trim()) return res.status(400).json({ message: "Le nom de la marque est requis." });
    const marque = await Marque.create({
      nom: nom.trim(),
      logoUrl: logoUrl || null,
      description: description || null,
      boutiqueId: req.boutiqueId
    });
    purgeCache();
    broadcast("boutique_updated", { boutiqueId: req.boutiqueId });
    res.status(201).json(marque);
  } catch (err) { next(err); }
});

router.put("/marques/:id", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const marque = await Marque.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!marque) return res.status(404).json({ message: "Marque introuvable." });
    await marque.update(req.body);
    purgeCache();
    broadcast("boutique_updated", { boutiqueId: req.boutiqueId });
    res.json(marque);
  } catch (err) { next(err); }
});

router.delete("/marques/:id", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const marque = await Marque.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!marque) return res.status(404).json({ message: "Marque introuvable." });
    await Product.update({ marqueId: null }, { where: { marqueId: marque.id, boutiqueId: req.boutiqueId } });
    await marque.destroy();
    purgeCache();
    broadcast("boutique_updated", { boutiqueId: req.boutiqueId });
    res.json({ message: "Marque supprimée avec succès." });
  } catch (err) { next(err); }
});

/* ---------------------- AVIS CLIENTS & RETOURS WHATSAPP ---------------------- */

router.get("/testimonials", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const list = await Testimonial.findAll({
      where: { boutiqueId: req.boutiqueId },
      order: [["ordre", "ASC"], ["createdAt", "DESC"]]
    });
    res.json(list);
  } catch (err) { next(err); }
});

router.post("/testimonials", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const { nom, photoUrl, genre, type, message, captureUrl, note, actif, ordre } = req.body;
    if (!nom || !nom.trim()) {
      return res.status(400).json({ message: "Le nom du client est requis." });
    }
    const testimonial = await Testimonial.create({
      boutiqueId: req.boutiqueId,
      nom: nom.trim(),
      photoUrl: photoUrl || null,
      genre: genre || "femme",
      type: type || "capture_whatsapp",
      message: message || null,
      captureUrl: captureUrl || null,
      note: Number(note) || 5,
      actif: actif !== undefined ? actif : true,
      ordre: Number(ordre) || 0
    });
    purgeCache();
    broadcast("boutique_updated", { boutiqueId: req.boutiqueId });
    res.status(201).json(testimonial);
  } catch (err) { next(err); }
});

router.put("/testimonials/:id", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const testimonial = await Testimonial.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId }
    });
    if (!testimonial) return res.status(404).json({ message: "Avis introuvable." });
    await testimonial.update(req.body);
    purgeCache();
    broadcast("boutique_updated", { boutiqueId: req.boutiqueId });
    res.json(testimonial);
  } catch (err) { next(err); }
});

router.delete("/testimonials/:id", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const testimonial = await Testimonial.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId }
    });
    if (!testimonial) return res.status(404).json({ message: "Avis introuvable." });
    await testimonial.destroy();
    purgeCache();
    broadcast("boutique_updated", { boutiqueId: req.boutiqueId });
  } catch (err) { next(err); }
});

/* ── ASSISTANT IA MULTI-FOURNISSEURS (GROQ + GEMINI + COHERE AVEC FAILOVER) ── */
const { generateProductDetails, generateStudioPhotoUrl } = require("../services/aiService");

router.post("/ai/enhance-product", async (req, res, next) => {
  try {
    const { nom, marque, categorie, userInstructions, photoKeywords, photoUrl } = req.body;
    
    // 1. Génération intelligente du contenu et de la description (Groq -> Gemini -> Cohere)
    const aiDetails = await generateProductDetails({
      nom,
      marque,
      categorie,
      userInstructions,
      photoKeywords,
      photoUrl
    });

    // 2. Génération du visuel studio épuré haute résolution
    const studioImageUrl = generateStudioPhotoUrl({
      nom: aiDetails.nom || nom,
      marque: aiDetails.marque || marque,
      categorie: aiDetails.famille || categorie,
      studioImagePrompt: aiDetails.studioImagePrompt
    });

    res.json({
      success: true,
      provider: aiDetails.provider,
      nom: aiDetails.nom,
      marque: aiDetails.marque,
      famille: aiDetails.famille,
      description: aiDetails.description,
      specifications: aiDetails.specifications,
      pointsForts: aiDetails.pointsForts || [],
      studioImageUrl,
      originalPhotoUrl: photoUrl || null
    });
  } catch (err) {
    next(err);
  }
});

// Génération ciblée de photo publicitaire studio pro sur fond blanc pour un champ photo précis
router.post("/ai/generate-studio-photo", async (req, res, next) => {
  try {
    const { nom, marque, categorie, slot, customPrompt } = req.body;
    const studioImageUrl = generateStudioPhotoUrl({
      nom: nom || "Accessoire smartphone",
      marque: marque || "",
      categorie: categorie || "Accessoire",
      studioImagePrompt: customPrompt || "",
      slot: slot || "principale"
    });
    res.json({
      success: true,
      studioImageUrl
    });
  } catch (err) {
    next(err);
  }
});

// --- ROUTES DEMANDES SUR-MESURE & DEVIS ---
const {
  listAdminCustomRequests,
  quoteCustomRequest,
  createAdminCustomRequest,
  updateAdminCustomRequest,
  deleteAdminCustomRequest
} = require("../controllers/customOrder.controller");

router.get("/custom-requests", requireRole("admin", "employe"), listAdminCustomRequests);
router.post("/custom-requests", requireRole("admin", "employe"), createAdminCustomRequest);
router.put("/custom-requests/:id", requireRole("admin", "employe"), updateAdminCustomRequest);
router.delete("/custom-requests/:id", requireRole("admin", "employe"), deleteAdminCustomRequest);
router.put("/custom-requests/:id/quote", requireRole("admin", "employe"), quoteCustomRequest);

// --- ROUTES DÉPENSES (EXPENSES) ---
function checkExpensePerm(req, perm) {
  if (req.user.role === "admin" || req.user.role === "super_admin") return true;
  const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
  return perms.includes(perm) || perms.includes("gerer_depenses");
}

router.get("/expenses", async (req, res, next) => {
  try {
    const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    const canAccess = req.user.role === "admin" || req.user.role === "super_admin" ||
      ["voir_depenses", "creer_depense", "modifier_depense", "supprimer_depense", "gerer_depenses"].some(p => perms.includes(p));

    if (!canAccess) {
      return res.status(403).json({ message: "Accès refusé. Vous n'avez pas la permission de consulter les dépenses." });
    }

    const { employeId, devise, categorie, dateDebut, dateFin, search } = req.query;
    const where = { boutiqueId: req.boutiqueId };

    if (req.user.role === "employe" && req.user.deviseAutorisee && req.user.deviseAutorisee !== "TOUTES") {
      where.devise = req.user.deviseAutorisee;
    } else if (devise && devise !== "TOUTES") {
      where.devise = devise;
    }

    if (employeId && employeId !== "TOUS") {
      where.creeParId = employeId;
    }

    if (categorie && categorie !== "TOUTES") {
      where.categorie = categorie;
    }

    if (dateDebut && dateFin) {
      where.dateDepense = {
        [Op.between]: [new Date(`${dateDebut}T00:00:00.000Z`), new Date(`${dateFin}T23:59:59.999Z`)]
      };
    } else if (dateDebut) {
      where.dateDepense = { [Op.gte]: new Date(`${dateDebut}T00:00:00.000Z`) };
    } else if (dateFin) {
      where.dateDepense = { [Op.lte]: new Date(`${dateFin}T23:59:59.999Z`) };
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      where[Op.or] = [
        { titre: { [Op.like]: q } },
        { beneficiaire: { [Op.like]: q } },
        { notes: { [Op.like]: q } }
      ];
    }

    const expenses = await Expense.findAll({
      where,
      include: [
        { model: User, as: "creePar", attributes: ["id", "nom", "email", "role"] }
      ],
      order: [["dateDepense", "DESC"], ["id", "DESC"]]
    });

    let totalMontantKMF = 0;
    let totalMontantFCFA = 0;

    expenses.forEach(e => {
      const m = Number(e.montant || 0);
      if (e.devise === "FCFA") {
        totalMontantFCFA += m;
      } else {
        totalMontantKMF += m;
      }
    });

    const employees = await User.findAll({
      where: { boutiqueId: req.boutiqueId, role: ["admin", "employe"] },
      attributes: ["id", "nom", "email", "role"]
    });

    res.json({
      expenses,
      kpis: {
        totalCount: expenses.length,
        totalMontantKMF,
        totalMontantFCFA
      },
      employees
    });
  } catch (err) {
    next(err);
  }
});

router.post("/expenses", async (req, res, next) => {
  try {
    if (!checkExpensePerm(req, "creer_depense")) {
      return res.status(403).json({ message: "Vous n'avez pas l'autorisation d'ajouter une dépense." });
    }

    const { titre, montant, devise, categorie, dateDepense, beneficiaire, moyenPaiement, notes, justificatifUrl } = req.body;
    if (!titre || !titre.trim()) {
      return res.status(400).json({ message: "Le titre de la dépense est requis." });
    }
    if (!montant || Number(montant) <= 0) {
      return res.status(400).json({ message: "Le montant doit être supérieur à 0." });
    }

    let finalDevise = devise || "KMF";
    if (req.user.role === "employe" && req.user.deviseAutorisee && req.user.deviseAutorisee !== "TOUTES") {
      finalDevise = req.user.deviseAutorisee;
    }

    const expense = await Expense.create({
      boutiqueId: req.boutiqueId,
      creeParId: req.user.id,
      titre: titre.trim(),
      montant: Number(montant),
      devise: finalDevise,
      categorie: categorie || "autre",
      dateDepense: dateDepense ? new Date(dateDepense) : new Date(),
      beneficiaire: beneficiaire ? beneficiaire.trim() : null,
      moyenPaiement: moyenPaiement || "especes",
      notes: notes ? notes.trim() : null,
      justificatifUrl: justificatifUrl || null
    });

    const fullExpense = await Expense.findByPk(expense.id, {
      include: [{ model: User, as: "creePar", attributes: ["id", "nom", "email", "role"] }]
    });

    broadcast("expense_updated", { action: "create", expenseId: expense.id, boutiqueId: req.boutiqueId });
    res.status(201).json(fullExpense);
  } catch (err) {
    next(err);
  }
});

router.put("/expenses/:id", async (req, res, next) => {
  try {
    if (!checkExpensePerm(req, "modifier_depense")) {
      return res.status(403).json({ message: "Vous n'avez pas l'autorisation de modifier une dépense." });
    }

    const expense = await Expense.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId }
    });

    if (!expense) {
      return res.status(404).json({ message: "Dépense introuvable." });
    }

    const { titre, montant, devise, categorie, dateDepense, beneficiaire, moyenPaiement, notes, justificatifUrl } = req.body;
    if (titre !== undefined) expense.titre = titre.trim();
    if (montant !== undefined) expense.montant = Number(montant);
    if (devise !== undefined) {
      if (req.user.role === "employe" && req.user.deviseAutorisee && req.user.deviseAutorisee !== "TOUTES") {
        expense.devise = req.user.deviseAutorisee;
      } else {
        expense.devise = devise;
      }
    }
    if (categorie !== undefined) expense.categorie = categorie;
    if (dateDepense !== undefined) expense.dateDepense = new Date(dateDepense);
    if (beneficiaire !== undefined) expense.beneficiaire = beneficiaire ? beneficiaire.trim() : null;
    if (moyenPaiement !== undefined) expense.moyenPaiement = moyenPaiement;
    if (notes !== undefined) expense.notes = notes ? notes.trim() : null;
    if (justificatifUrl !== undefined) expense.justificatifUrl = justificatifUrl;

    await expense.save();

    const fullExpense = await Expense.findByPk(expense.id, {
      include: [{ model: User, as: "creePar", attributes: ["id", "nom", "email", "role"] }]
    });

    broadcast("expense_updated", { action: "update", expenseId: expense.id, boutiqueId: req.boutiqueId });
    res.json(fullExpense);
  } catch (err) {
    next(err);
  }
});

router.delete("/expenses/:id", async (req, res, next) => {
  try {
    if (!checkExpensePerm(req, "supprimer_depense")) {
      return res.status(403).json({ message: "Vous n'avez pas l'autorisation de supprimer une dépense." });
    }

    const expense = await Expense.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId }
    });

    if (!expense) {
      return res.status(404).json({ message: "Dépense introuvable." });
    }

    await expense.destroy();
    broadcast("expense_updated", { action: "delete", expenseId: req.params.id, boutiqueId: req.boutiqueId });
    res.json({ success: true, message: "Dépense supprimée avec succès." });
  } catch (err) {
    next(err);
  }
});

// --- ROUTES ÉPARGNE (SAVINGS - STRICTEMENT ADMIN) ---
router.get("/savings", async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Accès strictement réservé à l'administrateur." });
    }

    const { devise, type, dateDebut, dateFin, search } = req.query;
    const where = { boutiqueId: req.boutiqueId };

    if (devise && devise !== "TOUTES") {
      where.devise = devise;
    }
    if (type && type !== "TOUS") {
      where.type = type;
    }

    if (dateDebut && dateFin) {
      where.dateOperation = {
        [Op.between]: [new Date(`${dateDebut}T00:00:00.000Z`), new Date(`${dateFin}T23:59:59.999Z`)]
      };
    } else if (dateDebut) {
      where.dateOperation = { [Op.gte]: new Date(`${dateDebut}T00:00:00.000Z`) };
    } else if (dateFin) {
      where.dateOperation = { [Op.lte]: new Date(`${dateFin}T23:59:59.999Z`) };
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      where[Op.or] = [
        { compte: { [Op.like]: q } },
        { reference: { [Op.like]: q } },
        { notes: { [Op.like]: q } }
      ];
    }

    const savings = await Saving.findAll({
      where,
      include: [
        { model: User, as: "creePar", attributes: ["id", "nom", "email"] }
      ],
      order: [["dateOperation", "DESC"], ["id", "DESC"]]
    });

    const allSavings = await Saving.findAll({
      where: { boutiqueId: req.boutiqueId },
      attributes: ["type", "montant", "devise"]
    });

    let totalDepotsKMF = 0;
    let totalRetraitsKMF = 0;
    let totalDepotsFCFA = 0;
    let totalRetraitsFCFA = 0;

    allSavings.forEach(s => {
      const m = Number(s.montant || 0);
      const isDepot = s.type === "depot";
      if (s.devise === "FCFA") {
        if (isDepot) totalDepotsFCFA += m;
        else totalRetraitsFCFA += m;
      } else {
        if (isDepot) totalDepotsKMF += m;
        else totalRetraitsKMF += m;
      }
    });

    const totalEpargneKMF = totalDepotsKMF - totalRetraitsKMF;
    const totalEpargneFCFA = totalDepotsFCFA - totalRetraitsFCFA;

    res.json({
      savings,
      kpis: {
        totalEpargneKMF,
        totalEpargneFCFA,
        totalDepotsKMF,
        totalRetraitsKMF,
        totalDepotsFCFA,
        totalRetraitsFCFA,
        totalOperations: savings.length
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post("/savings", async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Accès strictement réservé à l'administrateur." });
    }

    const { type, montant, devise, dateOperation, compte, reference, notes } = req.body;
    if (!montant || Number(montant) <= 0) {
      return res.status(400).json({ message: "Le montant doit être supérieur à 0." });
    }

    const saving = await Saving.create({
      boutiqueId: req.boutiqueId,
      creeParId: req.user.id,
      type: type === "retrait" ? "retrait" : "depot",
      montant: Number(montant),
      devise: devise || "KMF",
      dateOperation: dateOperation ? new Date(dateOperation) : new Date(),
      compte: compte ? compte.trim() : "Compte Épargne",
      reference: reference ? reference.trim() : null,
      notes: notes ? notes.trim() : null
    });

    const fullSaving = await Saving.findByPk(saving.id, {
      include: [{ model: User, as: "creePar", attributes: ["id", "nom", "email"] }]
    });

    broadcast("saving_updated", { action: "create", savingId: saving.id, boutiqueId: req.boutiqueId });
    res.status(201).json(fullSaving);
  } catch (err) {
    next(err);
  }
});

router.put("/savings/:id", async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Accès strictement réservé à l'administrateur." });
    }

    const saving = await Saving.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId }
    });

    if (!saving) {
      return res.status(404).json({ message: "Opération d'épargne introuvable." });
    }

    const { type, montant, devise, dateOperation, compte, reference, notes } = req.body;
    if (type !== undefined) saving.type = type === "retrait" ? "retrait" : "depot";
    if (montant !== undefined) saving.montant = Number(montant);
    if (devise !== undefined) saving.devise = devise;
    if (dateOperation !== undefined) saving.dateOperation = new Date(dateOperation);
    if (compte !== undefined) saving.compte = compte ? compte.trim() : "Compte Épargne";
    if (reference !== undefined) saving.reference = reference ? reference.trim() : null;
    if (notes !== undefined) saving.notes = notes ? notes.trim() : null;

    await saving.save();

    const fullSaving = await Saving.findByPk(saving.id, {
      include: [{ model: User, as: "creePar", attributes: ["id", "nom", "email"] }]
    });

    broadcast("saving_updated", { action: "update", savingId: saving.id, boutiqueId: req.boutiqueId });
    res.json(fullSaving);
  } catch (err) {
    next(err);
  }
});

router.delete("/savings/:id", async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Accès strictement réservé à l'administrateur." });
    }

    const saving = await Saving.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId }
    });

    if (!saving) {
      return res.status(404).json({ message: "Opération d'épargne introuvable." });
    }

    await saving.destroy();
    broadcast("saving_updated", { action: "delete", savingId: req.params.id, boutiqueId: req.boutiqueId });
    res.json({ success: true, message: "Opération d'épargne supprimée avec succès." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

