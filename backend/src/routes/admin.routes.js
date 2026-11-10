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

router.use(authenticate, requireRole("admin", "employe", "super_admin"), requireOwnBoutique);

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

function getLocalDateKey(d) {
  const dt = new Date(d || Date.now());
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeBoutiqueCurrencies(boutique) {
  const slug = String(boutique?.slug || "").trim().toLowerCase();
  let list = boutique?.devisesDisponibles;
  if (typeof list === "string") {
    try { list = JSON.parse(list); } catch (e) { list = null; }
  }
  if (slug === "soilihitech") {
    if (Array.isArray(list) && list.length >= 2) {
      return Array.from(new Set(list.map(c => {
        const s = String(c || "").trim().toUpperCase();
        return s === "XOF" ? "FCFA" : s;
      }).filter(Boolean)));
    }
    return ["KMF", "FCFA"];
  }
  if (!Array.isArray(list) || list.length === 0) {
    // Par défaut pour les boutiques existantes (ex: Soilihitech Comores + Sénégal) : conserver les 2 devises KMF et FCFA
    const primary = boutique?.devise ? String(boutique.devise).trim().toUpperCase() : "KMF";
    list = (primary === "KMF" || primary === "FCFA" || primary === "XOF") ? ["KMF", "FCFA"] : [primary];
  }
  return Array.from(new Set(list.map(c => {
    const s = String(c || "").trim().toUpperCase();
    return s === "XOF" ? "FCFA" : s;
  }).filter(Boolean)));
}

function getProductUnitPriceForCurrency(p, code, primaryDevise = "KMF") {
  if (!p) return 0;
  const cleanCode = String(code || primaryDevise).trim().toUpperCase();
  let map = p.prixParDevise;
  if (typeof map === "string") {
    try { map = JSON.parse(map); } catch (e) { map = null; }
  }
  let promoMap = p.prixPromoParDevise;
  if (typeof promoMap === "string") {
    try { promoMap = JSON.parse(promoMap); } catch (e) { promoMap = null; }
  }

  if (cleanCode === "FCFA" || cleanCode === "XOF") {
    if (p.enPromo && Number(p.prixPromoSenegal) > 0) return Number(p.prixPromoSenegal);
    if (p.enPromo && promoMap && Number(promoMap.FCFA) > 0) return Number(promoMap.FCFA);
    if (Number(p.prixSenegal) > 0) return Number(p.prixSenegal);
    if (map && Number(map.FCFA) > 0) return Number(map.FCFA);
    if (primaryDevise === "FCFA") {
      return (p.enPromo && Number(p.prixPromo) > 0) ? Number(p.prixPromo) : Number(p.prix || 0);
    }
    return 0;
  }

  if (cleanCode === "KMF") {
    if (p.enPromo && Number(p.prixPromo) > 0) return Number(p.prixPromo);
    if (p.enPromo && promoMap && Number(promoMap.KMF) > 0) return Number(promoMap.KMF);
    if (Number(p.prix) > 0) return Number(p.prix);
    if (map && Number(map.KMF) > 0) return Number(map.KMF);
    return 0;
  }

  if (p.enPromo && promoMap && Number(promoMap[cleanCode]) > 0) {
    return Number(promoMap[cleanCode]);
  }
  if (map && Number(map[cleanCode]) > 0) {
    return Number(map[cleanCode]);
  }

  if (cleanCode === primaryDevise) {
    return (p.enPromo && Number(p.prixPromo) > 0) ? Number(p.prixPromo) : Number(p.prix || 0);
  }
  return 0;
}

async function computeBoutiqueFinancials(boutiqueId, { excludeSavingId = null, excludeExpenseId = null } = {}) {
  const boutiqueObj = await Boutique.findByPk(boutiqueId);
  const devisesDisponibles = normalizeBoutiqueCurrencies(boutiqueObj);
  const primaryDevise = boutiqueObj?.devise ? String(boutiqueObj.devise).trim().toUpperCase() : (devisesDisponibles[0] || "KMF");

  // Toutes les commandes non annulées et non en attente de paiement
  const allOrders = await Order.findAll({
    where: {
      boutiqueId,
      statut: { [Op.notIn]: ["annulee", "en_attente_paiement"] }
    },
    include: [{ model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }],
    order: [["createdAt", "ASC"]]
  });

  const normalizeOrderCurrency = (dev) => {
    const d = String(dev || primaryDevise).trim().toUpperCase();
    if (d === "XOF") return "FCFA";
    if (d === "€") return "EUR";
    if (d === "$") return "USD";
    return d;
  };

  // Seules les commandes confirmées (statut !== "en_attente") comptent dans le Chiffre d'Affaires et le Bénéfice
  const confirmedOrders = allOrders.filter(o => o.statut !== "en_attente");
  const pendingOrders = allOrders.filter(o => o.statut === "en_attente");

  const ordersComores = confirmedOrders.filter(o => normalizeOrderCurrency(o.devise) === "KMF");
  const ordersSenegal = confirmedOrders.filter(o => normalizeOrderCurrency(o.devise) === "FCFA");

  const pendingComores = pendingOrders.filter(o => normalizeOrderCurrency(o.devise) === "KMF");
  const pendingSenegal = pendingOrders.filter(o => normalizeOrderCurrency(o.devise) === "FCFA");

  // Achats de marchandises (toujours en FCFA)
  const totalAchatsRows = await Achat.findAll({
    where: { boutiqueId },
    order: [["createdAt", "ASC"]]
  });
  const totalDepensesAchats = totalAchatsRows.reduce((sum, a) => sum + Number(a.totalAchat || 0), 0);

  const now = new Date();
  const todayKey = getLocalDateKey(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = getLocalDateKey(yesterdayDate);
  const currentMonthPrefix = todayKey.slice(0, 7);

  let achatsAujourdhuiFCFA = 0;
  let nbAchatsAujourdhui = 0;
  let achatsHierFCFA = 0;
  let nbAchatsHier = 0;
  let achatsMoisFCFA = 0;
  let nbAchatsMois = 0;

  totalAchatsRows.forEach(a => {
    const k = getLocalDateKey(a.createdAt || a.dateAchat);
    const montant = Number(a.totalAchat || 0);
    if (k === todayKey) {
      achatsAujourdhuiFCFA += montant;
      nbAchatsAujourdhui += 1;
    }
    if (k === yesterdayKey) {
      achatsHierFCFA += montant;
      nbAchatsHier += 1;
    }
    if (k.startsWith(currentMonthPrefix)) {
      achatsMoisFCFA += montant;
      nbAchatsMois += 1;
    }
  });

  // Dépenses courantes (Expense) par devise
  const expenseWhere = { boutiqueId };
  if (excludeExpenseId) {
    expenseWhere.id = { [Op.ne]: excludeExpenseId };
  }
  const allExpenses = await Expense.findAll({ where: expenseWhere });
  const depensesParDevise = {};
  devisesDisponibles.forEach(d => { depensesParDevise[d] = 0; });

  let depensesKMF = 0;
  let depensesFCFA = 0;
  allExpenses.forEach(e => {
    const m = Number(e.montant || 0);
    const c = normalizeOrderCurrency(e.devise);
    depensesParDevise[c] = (depensesParDevise[c] || 0) + m;
    if (c === "FCFA") depensesFCFA += m;
    else if (c === "KMF") depensesKMF += m;
  });

  // Épargne (Saving) par devise
  const savingWhere = { boutiqueId };
  if (excludeSavingId) {
    savingWhere.id = { [Op.ne]: excludeSavingId };
  }
  const allSavings = await Saving.findAll({ where: savingWhere });
  const depotsParDevise = {};
  const retraitsParDevise = {};
  devisesDisponibles.forEach(d => {
    depotsParDevise[d] = 0;
    retraitsParDevise[d] = 0;
  });

  let totalDepotsKMF = 0;
  let totalRetraitsKMF = 0;
  let totalDepotsFCFA = 0;
  let totalRetraitsFCFA = 0;

  allSavings.forEach(s => {
    const m = Number(s.montant || 0);
    const isDepot = s.type === "depot";
    const c = normalizeOrderCurrency(s.devise);
    if (isDepot) depotsParDevise[c] = (depotsParDevise[c] || 0) + m;
    else retraitsParDevise[c] = (retraitsParDevise[c] || 0) + m;

    if (c === "FCFA") {
      if (isDepot) totalDepotsFCFA += m;
      else totalRetraitsFCFA += m;
    } else if (c === "KMF") {
      if (isDepot) totalDepotsKMF += m;
      else totalRetraitsKMF += m;
    }
  });

  const totalEpargneKMF = totalDepotsKMF - totalRetraitsKMF;
  const totalEpargneFCFA = totalDepotsFCFA - totalRetraitsFCFA;

  // Calcul générique par devise pour toutes les devises de la boutique (KMF, FCFA, EUR, USD, etc.)
  const allCurrencyKeys = Array.from(new Set([...devisesDisponibles, "KMF", "FCFA"]));
  const statsByCurrency = {};

  allCurrencyKeys.forEach(code => {
    const curOrders = confirmedOrders.filter(o => normalizeOrderCurrency(o.devise) === code);
    const curPending = pendingOrders.filter(o => normalizeOrderCurrency(o.devise) === code);
    const ca = curOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const coutAchats = curOrders.reduce((s, o) => {
      return s + (o.items || []).reduce((ss, it) => ss + (Number(it.product?.coutAchat || 0) * Number(it.quantite || 0)), 0);
    }, 0);
    const beneficeVentes = curOrders.reduce((s, o) => {
      return s + (o.items || []).reduce((ss, it) => {
        const cout = it.product ? Number(it.product.coutAchat || 0) : 0;
        const fallbackPrice = getProductUnitPriceForCurrency(it.product, code, primaryDevise);
        const prix = Number(it.prixUnitaire || fallbackPrice || 0);
        return ss + ((prix - cout) * Number(it.quantite || 0));
      }, 0);
    }, 0);

    const dep = depensesParDevise[code] || 0;
    const depEpargne = depotsParDevise[code] || 0;
    const retEpargne = retraitsParDevise[code] || 0;
    const epargneNette = depEpargne - retEpargne;
    const beneficeApresDepenses = beneficeVentes - dep;
    const beneficeNet = beneficeApresDepenses - epargneNette;
    const nbCmd = curOrders.length;
    const totalVentesCount = curOrders.reduce((s, o) => s + (o.items || []).reduce((ss, it) => ss + Number(it.quantite || 0), 0), 0);

    statsByCurrency[code] = {
      devise: code,
      orders: curOrders,
      pendingOrders: curPending,
      chiffreAffaires: ca,
      coutAchats,
      beneficeVentes,
      beneficeApresDepenses,
      beneficeNet,
      depenses: dep,
      epargne: epargneNette,
      totalDepotsEpargne: depEpargne,
      totalRetraitsEpargne: retEpargne,
      nbCommandes: nbCmd,
      nbCommandesEnAttente: curPending.length,
      montantEnAttente: curPending.reduce((s, o) => s + Number(o.total || 0), 0),
      totalVentesCount,
      panierMoyen: nbCmd > 0 ? Math.round(ca / nbCmd) : 0
    };
  });

  const kmfStats = statsByCurrency["KMF"];
  const fcfaStats = statsByCurrency["FCFA"];

  return {
    boutiqueObj,
    primaryDevise,
    devisesDisponibles,
    statsByCurrency,
    allOrders,
    confirmedOrders,
    pendingOrders,
    ordersComores,
    ordersSenegal,
    pendingComores,
    pendingSenegal,
    caComores: kmfStats.chiffreAffaires,
    coutAchatsComores: kmfStats.coutAchats,
    beneficeVentesComores: kmfStats.beneficeVentes,
    beneficeApresDepensesComores: kmfStats.beneficeApresDepenses,
    beneficeComores: kmfStats.beneficeNet,
    caSenegal: fcfaStats.chiffreAffaires,
    coutAchatsSenegal: fcfaStats.coutAchats,
    beneficeVentesSenegal: fcfaStats.beneficeVentes,
    beneficeApresDepensesSenegal: fcfaStats.beneficeApresDepenses,
    beneficeSenegal: fcfaStats.beneficeNet,
    depensesKMF: kmfStats.depenses,
    depensesFCFA: fcfaStats.depenses,
    totalDepotsKMF: kmfStats.totalDepotsEpargne,
    totalRetraitsKMF: kmfStats.totalRetraitsEpargne,
    totalEpargneKMF: kmfStats.epargne,
    totalDepotsFCFA: fcfaStats.totalDepotsEpargne,
    totalRetraitsFCFA: fcfaStats.totalRetraitsEpargne,
    totalEpargneFCFA: fcfaStats.epargne,
    totalDepensesAchats,
    achatsAujourdhuiFCFA,
    nbAchatsAujourdhui,
    achatsHierFCFA,
    nbAchatsHier,
    achatsMoisFCFA,
    nbAchatsMois
  };
}

router.get("/dashboard", async (req, res, next) => {
  try {
    const boutiqueId = req.boutiqueId;
    const isEmploye = req.user.role === "employe";

    // Mes commandes assignées à cet employé / utilisateur
    const mesCommandes = await Order.findAll({
      where: { boutiqueId, employeAssigneId: req.user.id, statut: { [Op.ne]: "en_attente_paiement" } },
      include: [
        { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] },
        { model: User, as: "client", attributes: ["nom", "telephone"] }
      ],
      order: [["createdAt", "DESC"]]
    });

    const mesCommandesLivrees = mesCommandes.filter(c => c.statut === "livree" || c.statut === "recuperee");
    const monChiffreAffaires = mesCommandes.filter(c => !["annulee", "en_attente", "en_attente_paiement"].includes(c.statut)).reduce((sum, c) => sum + Number(c.total), 0);
    const mesCommandesEnCours = mesCommandes.filter(c => ["en_attente", "validee", "en_preparation", "pret_retrait", "en_livraison"].includes(c.statut));

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
    const fin = await computeBoutiqueFinancials(boutiqueId);
    const {
      confirmedOrders: orders,
      ordersComores,
      ordersSenegal,
      pendingComores,
      pendingSenegal,
      caComores,
      coutAchatsComores,
      beneficeVentesComores,
      beneficeApresDepensesComores,
      beneficeComores,
      caSenegal,
      coutAchatsSenegal,
      beneficeVentesSenegal,
      beneficeApresDepensesSenegal,
      beneficeSenegal,
      depensesKMF,
      depensesFCFA,
      totalDepotsKMF,
      totalRetraitsKMF,
      totalEpargneKMF,
      totalDepotsFCFA,
      totalRetraitsFCFA,
      totalEpargneFCFA,
      totalDepensesAchats,
      achatsAujourdhuiFCFA,
      nbAchatsAujourdhui,
      achatsHierFCFA,
      nbAchatsHier,
      achatsMoisFCFA,
      nbAchatsMois
    } = fin;

    const nbCommandesComores = ordersComores.length;
    const totalVentesCountComores = ordersComores.reduce((s, o) => s + (o.items || []).reduce((ss, it) => ss + Number(it.quantite || 0), 0), 0);
    const panierMoyenComores = nbCommandesComores > 0 ? Math.round(caComores / nbCommandesComores) : 0;

    const nbCommandesSenegal = ordersSenegal.length;
    const totalVentesCountSenegal = ordersSenegal.reduce((s, o) => s + (o.items || []).reduce((ss, it) => ss + Number(it.quantite || 0), 0), 0);
    const panierMoyenSenegal = nbCommandesSenegal > 0 ? Math.round(caSenegal / nbCommandesSenegal) : 0;

    // Totaux généraux (commandes confirmées)
    const nbCommandes = orders.length;
    const totalVentesCount = orders.reduce((s, o) => s + (o.items || []).reduce((ss, it) => ss + Number(it.quantite || 0), 0), 0);
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

    // Calcul exact et cohérent de la valeur du stock pour chaque devise (KMF, FCFA, EUR, USD, etc.)
    const valeurStockParDevise = {};
    Object.keys(fin.statsByCurrency).forEach(code => {
      const valStock = produits.reduce((sum, p) => {
        const pu = getProductUnitPriceForCurrency(p, code, fin.primaryDevise);
        return sum + (Number(p.stock || 0) * pu);
      }, 0);
      valeurStockParDevise[code] = valStock;
      fin.statsByCurrency[code].valeurStockVente = valStock;
    });

    const valeurStockComores = valeurStockParDevise["KMF"] || 0;
    const valeurStockSenegal = valeurStockParDevise["FCFA"] || 0;
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

    // Enrichir chaque devise de statsByCurrency avec son chartData et ses modesPaiement
    Object.keys(fin.statsByCurrency).forEach(code => {
      const cOrders = fin.statsByCurrency[code].orders || [];
      fin.statsByCurrency[code].chartData = last7Days.map(({ dateStr, dayName }) => {
        const dayOrders = cOrders.filter(o => o.createdAt && new Date(o.createdAt).toISOString().slice(0, 10) === dateStr);
        const ca = dayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
        return { jour: dayName, date: dateStr, ca };
      });
      const mp = [
        { name: "Espèces (Cash)", value: cOrders.filter(o => o.moyenPaiement === "cash" || o.moyenPaiement === "especes").length },
        { name: "MVola", value: cOrders.filter(o => o.moyenPaiement === "mvola").length },
        { name: "Wave / OM", value: cOrders.filter(o => o.moyenPaiement === "wave" || o.moyenPaiement === "om" || o.moyenPaiement === "orange_money").length },
        { name: "Wero / Holam", value: cOrders.filter(o => o.moyenPaiement === "wero" || o.moyenPaiement === "holam").length },
        { name: "Carte", value: cOrders.filter(o => o.moyenPaiement === "carte").length }
      ].filter(m => m.value > 0);
      fin.statsByCurrency[code].modesPaiement = mp.length ? mp : [{ name: "Espèces", value: 1 }];
      delete fin.statsByCurrency[code].orders;
      delete fin.statsByCurrency[code].pendingOrders;
    });

    res.json({
      isEmploye: false,
      boutiqueId,
      primaryDevise: fin.primaryDevise,
      devisesDisponibles: fin.devisesDisponibles,
      statsByCurrency: fin.statsByCurrency,
      valeurStockParDevise,
      // Comores
      comores: {
        chiffreAffaires: caComores,
        coutAchats: coutAchatsComores,
        beneficeVentes: beneficeVentesComores,
        beneficeApresDepenses: beneficeApresDepensesComores,
        beneficeNet: beneficeComores,
        depenses: depensesKMF,
        epargne: totalEpargneKMF,
        totalDepotsEpargne: totalDepotsKMF,
        totalRetraitsEpargne: totalRetraitsKMF,
        nbCommandes: nbCommandesComores,
        nbCommandesEnAttente: pendingComores.length,
        montantEnAttente: pendingComores.reduce((s, o) => s + Number(o.total || 0), 0),
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
        beneficeVentes: beneficeVentesSenegal,
        beneficeApresDepenses: beneficeApresDepensesSenegal,
        beneficeNet: beneficeSenegal,
        depenses: depensesFCFA,
        epargne: totalEpargneFCFA,
        totalDepotsEpargne: totalDepotsFCFA,
        totalRetraitsEpargne: totalRetraitsFCFA,
        nbCommandes: nbCommandesSenegal,
        nbCommandesEnAttente: pendingSenegal.length,
        montantEnAttente: pendingSenegal.reduce((s, o) => s + Number(o.total || 0), 0),
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
      beneficeVentesComores,
      beneficeVentesSenegal,
      depensesKMF,
      depensesFCFA,
      totalEpargneKMF,
      totalEpargneFCFA,
      totalDepensesAchats,
      achatsAujourdhuiFCFA,
      nbAchatsAujourdhui,
      achatsHierFCFA,
      nbAchatsHier,
      achatsMoisFCFA,
      nbAchatsMois,
      valeurStockComores,
      valeurStockSenegal,
      valeurStockVente: valeurStockComores + valeurStockSenegal,
      valeurStockAchat,
      totalVentesCount,
      nbCommandes,
      nbCommandesEnAttente: pendingComores.length + pendingSenegal.length,
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

// GET /api/admin/my-boutiques -> Retourne la liste des boutiques autorisées pour cet Admin (accès accordé par le Super Admin)
router.get("/my-boutiques", async (req, res, next) => {
  try {
    const allowedIds = req.managedBoutiqueIds || (req.boutiqueId ? [req.boutiqueId] : []);
    const boutiques = await Boutique.findAll({
      where: { id: { [Op.in]: allowedIds } },
      order: [["id", "ASC"]]
    });
    const formatted = boutiques.map(b => {
      const json = b.toJSON();
      json.devisesDisponibles = normalizeBoutiqueCurrencies(b);
      return json;
    });
    res.json({
      peutGererPlusieursBoutiques: Boolean(req.user.peutGererPlusieursBoutiques && formatted.length > 1),
      activeBoutiqueId: req.boutiqueId,
      boutiques: formatted
    });
  } catch (err) { next(err); }
});

// GET /api/admin/multi-boutiques-overview -> Vue Globale consolidée de toutes les boutiques d'un Admin multi-boutiques
router.get("/multi-boutiques-overview", requireRole("admin"), async (req, res, next) => {
  try {
    const allowedIds = req.managedBoutiqueIds || (req.boutiqueId ? [req.boutiqueId] : []);
    const boutiques = await Boutique.findAll({
      where: { id: { [Op.in]: allowedIds } },
      order: [["id", "ASC"]]
    });

    const totauxParDevise = {};
    let totalProduitsGlobal = 0;
    let totalUnitsEnStockGlobal = 0;
    let totalStockFaibleGlobal = 0;
    let totalCommandesGlobal = 0;
    let totalVentesArticlesGlobal = 0;
    let totalDepensesAchatsGlobalFCFA = 0;
    let totalValeurStockAchatGlobalFCFA = 0;

    const detailsBoutiques = await Promise.all(boutiques.map(async (b) => {
      const fin = await computeBoutiqueFinancials(b.id);
      const prods = await Product.findAll({ where: { boutiqueId: b.id } });
      const admins = await User.findAll({
        where: { boutiqueId: b.id, role: { [Op.in]: ["admin", "employe"] } },
        attributes: ["id", "nom", "email", "telephone", "role", "statut"]
      });

      const totalStockUnits = prods.reduce((s, p) => s + Number(p.stock || 0), 0);
      const stockFaibleCount = prods.filter(p => Number(p.stock || 0) <= Number(p.seuilAlerte || 5)).length;
      const valeurStockAchatFCFA = prods.reduce((s, p) => s + (Number(p.stock || 0) * Number(p.coutAchat || 0)), 0);

      totalProduitsGlobal += prods.length;
      totalUnitsEnStockGlobal += totalStockUnits;
      totalStockFaibleGlobal += stockFaibleCount;
      totalCommandesGlobal += fin.confirmedOrders.length;
      totalDepensesAchatsGlobalFCFA += fin.totalDepensesAchats;
      totalValeurStockAchatGlobalFCFA += valeurStockAchatFCFA;

      const resumeDevises = {};
      fin.devisesDisponibles.forEach(code => {
        const st = fin.statsByCurrency[code] || {};
        const valStockVente = prods.reduce((s, p) => s + (Number(p.stock || 0) * getProductUnitPriceForCurrency(p, code, fin.primaryDevise)), 0);
        resumeDevises[code] = {
          devise: code,
          chiffreAffaires: st.chiffreAffaires || 0,
          beneficeNet: st.beneficeNet || 0,
          beneficeVentes: st.beneficeVentes || 0,
          depenses: st.depenses || 0,
          epargne: st.epargne || 0,
          nbCommandes: st.nbCommandes || 0,
          nbCommandesEnAttente: st.nbCommandesEnAttente || 0,
          totalVentesCount: st.totalVentesCount || 0,
          valeurStockVente: valStockVente
        };

        totalVentesArticlesGlobal += (st.totalVentesCount || 0);

        if (!totauxParDevise[code]) {
          totauxParDevise[code] = {
            devise: code,
            chiffreAffaires: 0,
            beneficeNet: 0,
            depenses: 0,
            epargne: 0,
            nbCommandes: 0,
            valeurStockVente: 0
          };
        }
        totauxParDevise[code].chiffreAffaires += (st.chiffreAffaires || 0);
        totauxParDevise[code].beneficeNet += (st.beneficeNet || 0);
        totauxParDevise[code].depenses += (st.depenses || 0);
        totauxParDevise[code].epargne += (st.epargne || 0);
        totauxParDevise[code].nbCommandes += (st.nbCommandes || 0);
        totauxParDevise[code].valeurStockVente += valStockVente;
      });

      return {
        id: b.id,
        nom: b.nom,
        slug: b.slug,
        statut: b.statut,
        devise: fin.primaryDevise,
        devisesDisponibles: fin.devisesDisponibles,
        totalProduits: prods.length,
        totalStockUnits,
        stockFaibleCount,
        valeurStockAchatFCFA,
        totalDepensesAchatsFCFA: fin.totalDepensesAchats,
        nbCommandesConfirmees: fin.confirmedOrders.length,
        nbCommandesEnAttente: fin.pendingOrders.length,
        resumeDevises,
        admins
      };
    }));

    res.json({
      nbBoutiques: detailsBoutiques.length,
      totauxParDevise,
      totalProduitsGlobal,
      totalUnitsEnStockGlobal,
      totalStockFaibleGlobal,
      totalCommandesGlobal,
      totalVentesArticlesGlobal,
      totalDepensesAchatsGlobalFCFA,
      totalValeurStockAchatGlobalFCFA,
      boutiques: detailsBoutiques
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

const PRODUCT_INCLUDES = [
  Category,
  { model: Fournisseur, as: "fournisseur" },
  { model: Marque, as: "marque" },
  { model: User, as: "creePar", attributes: ["id", "nom", "role", "email"] },
  { model: Boutique, as: "boutique", attributes: ["id", "nom", "slug", "devise", "devisesDisponibles"] }
];

function syncProductPricesPayload(body, boutique, existingProduct = null) {
  const payload = { ...body };
  const hasPriceFieldsInBody =
    body.prix !== undefined ||
    body.prixSenegal !== undefined ||
    body.prixPromo !== undefined ||
    body.prixPromoSenegal !== undefined ||
    body.prixParDevise !== undefined ||
    body.prixPromoParDevise !== undefined;

  if (!hasPriceFieldsInBody && existingProduct) {
    return payload;
  }

  const currencies = normalizeBoutiqueCurrencies(boutique);
  const primaryDevise = currencies[0] || "KMF";

  let existingMap = existingProduct?.prixParDevise;
  if (typeof existingMap === "string") {
    try { existingMap = JSON.parse(existingMap); } catch (_) { existingMap = {}; }
  }
  let prixParDevise = payload.prixParDevise;
  if (typeof prixParDevise === "string") {
    try { prixParDevise = JSON.parse(prixParDevise); } catch (_) { prixParDevise = {}; }
  }
  if (!prixParDevise || typeof prixParDevise !== "object") {
    prixParDevise = (existingMap && typeof existingMap === "object") ? { ...existingMap } : {};
  } else {
    prixParDevise = { ...(existingMap && typeof existingMap === "object" ? existingMap : {}), ...prixParDevise };
  }

  let existingPromoMap = existingProduct?.prixPromoParDevise;
  if (typeof existingPromoMap === "string") {
    try { existingPromoMap = JSON.parse(existingPromoMap); } catch (_) { existingPromoMap = {}; }
  }
  let prixPromoParDevise = payload.prixPromoParDevise;
  if (typeof prixPromoParDevise === "string") {
    try { prixPromoParDevise = JSON.parse(prixPromoParDevise); } catch (_) { prixPromoParDevise = {}; }
  }
  if (!prixPromoParDevise || typeof prixPromoParDevise !== "object") {
    prixPromoParDevise = (existingPromoMap && typeof existingPromoMap === "object") ? { ...existingPromoMap } : {};
  } else {
    prixPromoParDevise = { ...(existingPromoMap && typeof existingPromoMap === "object" ? existingPromoMap : {}), ...prixPromoParDevise };
  }

  // Synchronisation bidirectionnelle avec les champs prix (KMF / devise principale) et prixSenegal (FCFA)
  const mainKey = currencies.includes("KMF") ? "KMF" : primaryDevise;
  if (payload.prix !== undefined && payload.prix !== "" && prixParDevise[mainKey] === undefined) {
    prixParDevise[mainKey] = Number(payload.prix) || 0;
  }
  if (payload.prixSenegal !== undefined && payload.prixSenegal !== "" && prixParDevise["FCFA"] === undefined) {
    prixParDevise["FCFA"] = Number(payload.prixSenegal) || 0;
  }

  if (prixParDevise[mainKey] !== undefined && Number(prixParDevise[mainKey]) > 0) {
    payload.prix = Number(prixParDevise[mainKey]);
  } else if (payload.prix !== undefined && payload.prix !== "") {
    payload.prix = Number(payload.prix) || 0;
    prixParDevise[mainKey] = payload.prix;
  }

  if (prixParDevise["FCFA"] !== undefined && prixParDevise["FCFA"] !== null && prixParDevise["FCFA"] !== "") {
    payload.prixSenegal = Number(prixParDevise["FCFA"]);
  } else if (payload.prixSenegal !== undefined && payload.prixSenegal !== "" && payload.prixSenegal !== null) {
    payload.prixSenegal = Number(payload.prixSenegal);
    prixParDevise["FCFA"] = payload.prixSenegal;
  }

  if (payload.prixPromo !== undefined && payload.prixPromo !== "" && prixPromoParDevise[mainKey] === undefined) {
    prixPromoParDevise[mainKey] = Number(payload.prixPromo) || 0;
  }
  if (payload.prixPromoSenegal !== undefined && payload.prixPromoSenegal !== "" && prixPromoParDevise["FCFA"] === undefined) {
    prixPromoParDevise["FCFA"] = Number(payload.prixPromoSenegal) || 0;
  }
  if (prixPromoParDevise[mainKey] !== undefined) {
    payload.prixPromo = Number(prixPromoParDevise[mainKey]) || null;
  }
  if (prixPromoParDevise["FCFA"] !== undefined) {
    payload.prixPromoSenegal = Number(prixPromoParDevise["FCFA"]) || null;
  }

  payload.prixParDevise = prixParDevise;
  payload.prixPromoParDevise = prixPromoParDevise;
  return payload;
}

router.get("/products", async (req, res, next) => {
  try {
    const { page, limit, paginated, search, categorieId, allMyBoutiques, filterBoutiqueId } = req.query;
    const allowedIds = req.managedBoutiqueIds || [req.boutiqueId];

    let boutiqueFilter = req.boutiqueId;
    if (req.user.role === "admin" && allowedIds.length > 1) {
      if (allMyBoutiques === "true") {
        boutiqueFilter = { [Op.in]: allowedIds };
      } else if (filterBoutiqueId && allowedIds.includes(Number(filterBoutiqueId))) {
        boutiqueFilter = Number(filterBoutiqueId);
      }
    }

    const cacheKey = `admin:products:${req.boutiqueId}:${req.user.id}:${req.originalUrl || req.url}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cached);
    }

    if (paginated === "true" || page) {
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const offset = (pageNum - 1) * limitNum;

      const where = { boutiqueId: boutiqueFilter };
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
        include: PRODUCT_INCLUDES, 
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
      where: { boutiqueId: boutiqueFilter }, 
      include: PRODUCT_INCLUDES, 
      order: [["createdAt", "DESC"]] 
    });

    await setCache(cacheKey, items, 180);
    res.setHeader("X-Cache", "MISS");
    res.json(items);
  } catch (err) { next(err); }
});

router.post("/products", async (req, res, next) => {
  try {
    const allowedIds = req.managedBoutiqueIds || [req.boutiqueId];
    let targetBoutiqueId = req.boutiqueId;
    if (req.user.role === "admin" && req.body.boutiqueId && allowedIds.includes(Number(req.body.boutiqueId))) {
      targetBoutiqueId = Number(req.body.boutiqueId);
    }

    const targetBoutique = await Boutique.findByPk(targetBoutiqueId);
    const syncedBody = syncProductPricesPayload(req.body, targetBoutique);

    const product = await Product.create({
      ...syncedBody,
      boutiqueId: targetBoutiqueId,
      creeParId: req.user.id
    });

    // Auto-enregistrement dans la table des Achats / Approvisionnements (Achat Initial)
    if (product.stock > 0 || Number(product.coutAchat) > 0 || product.fournisseurId) {
      const qty = product.stock || 1;
      const unitPrice = Number(product.coutAchat) || 0;
      await Achat.create({
        boutiqueId: targetBoutiqueId,
        productId: product.id,
        fournisseurId: product.fournisseurId || null,
        quantite: qty,
        prixAchatUnitaire: unitPrice,
        totalAchat: qty * unitPrice,
        notes: `Achat initial - ${product.nom}`
      }).catch(() => {});
    }

    const fullProduct = await Product.findByPk(product.id, {
      include: PRODUCT_INCLUDES
    });

    purgeCache();
    broadcast("product_updated", { productId: product.id, boutiqueId: targetBoutiqueId });
    broadcast("product_created", { productId: product.id, boutiqueId: targetBoutiqueId });
    broadcast("achat_updated", { productId: product.id, boutiqueId: targetBoutiqueId });
    res.status(201).json(fullProduct);
  } catch (err) { next(err); }
});

router.put("/products/:id", async (req, res, next) => {
  try {
    if (req.user.role === "employe") {
      const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
      const hasHide = perms.includes("cacher_produit");
      const hasFullEdit = perms.includes("ajouter_modifier_produit") || perms.includes("gerer_produits");

      const bodyKeys = Object.keys(req.body);
      const isOnlyVisibility = bodyKeys.length === 1 && bodyKeys[0] === "masquerSurSite";

      if (isOnlyVisibility) {
        if (!hasHide && !hasFullEdit) {
          return res.status(403).json({ message: "Vous n'avez pas l'autorisation de masquer ou rendre visible les produits." });
        }
      } else {
        if (!hasFullEdit) {
          return res.status(403).json({ message: "Vous n'avez pas l'autorisation de modifier ce produit." });
        }
      }
    }

    const allowedIds = req.managedBoutiqueIds || [req.boutiqueId];
    const whereClause = (req.user.role === "admin" && allowedIds.length > 1)
      ? { id: req.params.id, boutiqueId: { [Op.in]: allowedIds } }
      : { id: req.params.id, boutiqueId: req.boutiqueId };

    const product = await Product.findOne({ where: whereClause });
    if (!product) return res.status(404).json({ message: "Produit introuvable." });

    const oldStock = Number(product.stock || 0);
    const oldCoutAchat = Number(product.coutAchat || 0);

    let targetBoutiqueId = product.boutiqueId;
    if (req.user.role === "admin" && req.body.boutiqueId && allowedIds.includes(Number(req.body.boutiqueId))) {
      targetBoutiqueId = Number(req.body.boutiqueId);
    }

    const targetBoutique = await Boutique.findByPk(targetBoutiqueId);
    const syncedBody = syncProductPricesPayload(req.body, targetBoutique);
    syncedBody.boutiqueId = targetBoutiqueId;
    if (!product.creeParId) {
      syncedBody.creeParId = req.user.id;
    }

    await product.update(syncedBody);

    const newStock = Number(product.stock || 0);
    const unitCost = Number(product.coutAchat) || 0;

    // Recherche du premier achat (Achat Initial) de ce produit
    const firstAchat = await Achat.findOne({
      where: { productId: product.id, boutiqueId: targetBoutiqueId },
      order: [["createdAt", "ASC"]]
    });

    if (!firstAchat) {
      if (newStock > 0 || unitCost > 0) {
        const qty = newStock > 0 ? newStock : 1;
        await Achat.create({
          boutiqueId: targetBoutiqueId,
          productId: product.id,
          fournisseurId: product.fournisseurId || null,
          quantite: qty,
          prixAchatUnitaire: unitCost,
          totalAchat: qty * unitCost,
          notes: `Achat initial - ${product.nom}`
        }).catch(() => {});
      }
    } else if (newStock > oldStock) {
      // C'est un réapprovisionnement : on crée une NOUVELLE ligne d'achat datée d'aujourd'hui sans écraser l'achat initial !
      const addedQty = newStock - oldStock;
      const refInitial = `#ACH-${String(firstAchat.id).padStart(3, "0")}`;
      const dateInitStr = new Date(firstAchat.createdAt || firstAchat.dateAchat).toLocaleDateString("fr-FR");
      await Achat.create({
        boutiqueId: targetBoutiqueId,
        productId: product.id,
        fournisseurId: product.fournisseurId || firstAchat.fournisseurId || null,
        quantite: addedQty,
        prixAchatUnitaire: unitCost,
        totalAchat: addedQty * unitCost,
        notes: `Approvisionnement (+${addedQty}) de l'achat ${refInitial} du ${dateInitStr}`
      }).catch(() => {});
    } else if (unitCost !== oldCoutAchat) {
      // Si seul le coût d'achat unitaire a été corrigé sans ajout de stock, on met à jour le dernier achat
      const latestAchat = await Achat.findOne({
        where: { productId: product.id, boutiqueId: targetBoutiqueId },
        order: [["createdAt", "DESC"]]
      });
      if (latestAchat) {
        const q = Number(latestAchat.quantite || 1);
        await latestAchat.update({
          fournisseurId: product.fournisseurId || latestAchat.fournisseurId,
          prixAchatUnitaire: unitCost,
          totalAchat: q * unitCost
        }).catch(() => {});
      }
    }

    const fullProduct = await Product.findByPk(product.id, {
      include: PRODUCT_INCLUDES
    });

    purgeCache();
    broadcast("product_updated", { productId: product.id, boutiqueId: targetBoutiqueId });
    broadcast("achat_updated", { productId: product.id, boutiqueId: targetBoutiqueId });
    res.json(fullProduct);
  } catch (err) { next(err); }
});

router.delete("/products/:id", async (req, res, next) => {
  try {
    const allowedIds = req.managedBoutiqueIds || [req.boutiqueId];
    const whereClause = (req.user.role === "admin" && allowedIds.length > 1)
      ? { id: req.params.id, boutiqueId: { [Op.in]: allowedIds } }
      : { id: req.params.id, boutiqueId: req.boutiqueId };

    const product = await Product.findOne({ where: whereClause });
    if (!product) return res.status(404).json({ message: "Produit introuvable." });
    const targetBoutiqueId = product.boutiqueId;
    await product.destroy();
    purgeCache();
    broadcast("product_updated", { productId: req.params.id, boutiqueId: targetBoutiqueId });
    broadcast("product_deleted", { productId: req.params.id, boutiqueId: targetBoutiqueId });
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

    // Un employé ne doit voir que ses propres ventes ou les commandes en ligne payées non assignées
    if (req.user && req.user.role === "employe") {
      where[Op.or] = [
        { employeAssigneId: req.user.id },
        { employeAssigneId: null }
      ];
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
    if (req.user.role === "employe") {
      const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
      if (!perms.includes("modifier_vente") && !perms.includes("gerer_commandes")) {
        await t.rollback();
        return res.status(403).json({ message: "Vous n'avez pas l'autorisation de modifier les ventes." });
      }
    }

    const order = await Order.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId },
      include: [{ model: OrderItem, as: "items" }],
      transaction: t
    });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ message: "Vente / commande introuvable." });
    }

    const { moyenPaiement, statut, notes, clientNom, clientTelephone, adresseLivraison, items, devise, statutPaiement, montantPaye, montantRestant, dateEcheance } = req.body;

    const updates = {};
    if (moyenPaiement !== undefined) updates.moyenPaiement = moyenPaiement;
    if (notes !== undefined) updates.notes = notes;
    if (clientNom !== undefined) updates.clientNom = clientNom;
    if (clientTelephone !== undefined) updates.clientTelephone = clientTelephone;
    if (adresseLivraison !== undefined) updates.adresseLivraison = adresseLivraison;
    if (statut !== undefined) updates.statut = statut;
    if (devise !== undefined) updates.devise = devise;
    if (statutPaiement !== undefined) updates.statutPaiement = statutPaiement;
    if (montantPaye !== undefined) updates.montantPaye = Number(montantPaye) || 0;
    if (montantRestant !== undefined) updates.montantRestant = Number(montantRestant) || 0;
    if (dateEcheance !== undefined) updates.dateEcheance = dateEcheance || null;

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

      const fraisNum = isNaN(Number(order.fraisLivraison)) ? 0 : Number(order.fraisLivraison);
      updates.sousTotal = Number(newSousTotal);
      updates.total = Number(newSousTotal) + fraisNum;
      if (updates.statutPaiement === "paye") {
        updates.montantPaye = updates.total;
        updates.montantRestant = 0;
      }
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
    if (req.user.role === "employe") {
      const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
      if (!perms.includes("supprimer_vente")) {
        await t.rollback();
        return res.status(403).json({ message: "Vous n'avez pas l'autorisation de supprimer les ventes." });
      }
    }

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
    const allowedIds = req.managedBoutiqueIds || [req.boutiqueId];
    let boutiqueFilter = req.boutiqueId;
    if (allowedIds.length > 1 && req.query.allMyBoutiques === "true") {
      boutiqueFilter = { [Op.in]: allowedIds };
    } else if (req.query.filterBoutiqueId && allowedIds.includes(Number(req.query.filterBoutiqueId))) {
      boutiqueFilter = Number(req.query.filterBoutiqueId);
    }

    const users = await User.findAll({ 
      where: { boutiqueId: boutiqueFilter, role: { [Op.in]: ["admin", "employe"] } }, 
      attributes: { exclude: ["motDePasseHash"] },
      include: [{ model: Boutique, attributes: ["id", "nom", "slug", "devise", "devisesDisponibles"] }],
      order: [["createdAt", "DESC"]]
    });
    res.json(users);
  } catch (err) { next(err); }
});

router.post("/employees", requireRole("admin"), async (req, res, next) => {
  try {
    const { nom, email, telephone, motDePasse, role, permissions, deviseAutorisee, boutiqueId } = req.body;
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanPhone = telephone ? String(telephone).trim() : null;

    if (!nom || (!cleanEmail && !cleanPhone)) {
      return res.status(400).json({ message: "Le nom et au moins un email ou téléphone sont requis." });
    }

    const allowedIds = req.managedBoutiqueIds || [req.boutiqueId];
    let targetBoutiqueId = req.boutiqueId;
    if (boutiqueId && allowedIds.includes(Number(boutiqueId))) {
      targetBoutiqueId = Number(boutiqueId);
    }

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
      boutiqueId: targetBoutiqueId,
      peutGererPlusieursBoutiques: false,
      boutiquesGerees: [targetBoutiqueId],
      statut: "actif",
      mustChangePassword: true,
      isEmailVerified: true,
      failedLoginAttempts: 0,
      lockedAt: null,
      lockReason: null
    });

    const targetBoutique = await Boutique.findByPk(targetBoutiqueId);

    if (cleanEmail) {
      const { envoyerEmailCreationCompte } = require("../services/emailService");
      envoyerEmailCreationCompte(cleanEmail, user.nom, cleanEmail || cleanPhone, cleanPhone, rawPassword, userRole, targetBoutique?.nom || "Marché Vert").catch(() => {});
    }

    res.status(201).json({ 
      id: user.id, nom: user.nom, email: user.email, telephone: user.telephone, 
      role: user.role, permissions: user.permissions, deviseAutorisee: user.deviseAutorisee, statut: user.statut,
      boutiqueId: user.boutiqueId,
      Boutique: targetBoutique ? { id: targetBoutique.id, nom: targetBoutique.nom, slug: targetBoutique.slug } : null,
      generatedPassword: rawPassword,
      mustChangePassword: true
    });
  } catch (err) { next(err); }
});

router.put("/employees/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const allowedIds = req.managedBoutiqueIds || [req.boutiqueId];
    const targetUser = await User.findOne({ 
      where: { id: req.params.id, boutiqueId: { [Op.in]: allowedIds }, role: { [Op.in]: ["admin", "employe"] } } 
    });
    if (!targetUser) return res.status(404).json({ message: "Utilisateur introuvable." });

    const { nom, email, telephone, motDePasse, role, permissions, deviseAutorisee, statut, boutiqueId } = req.body;
    if (targetUser.id === req.user.id && statut === "suspendu") {
      return res.status(400).json({ message: "Vous ne pouvez pas suspendre votre propre compte administrateur." });
    }

    // Règle hiérarchique stricte : un Admin de boutique NE PEUT PAS réactiver un compte Admin désactivé (seul le Super Admin le peut)
    if (targetUser.role === "admin" && targetUser.statut === "suspendu" && statut === "actif") {
      return res.status(403).json({
        message: "Seul le Super Administrateur peut réactiver un compte Administrateur désactivé."
      });
    }

    if (nom) targetUser.nom = nom;
    if (email) targetUser.email = email;
    if (telephone !== undefined) targetUser.telephone = telephone;
    if (statut) {
      targetUser.statut = statut;
      if (statut === "actif") {
        targetUser.failedLoginAttempts = 0;
        targetUser.lockedAt = null;
        targetUser.lockReason = null;
      }
    }
    if (deviseAutorisee !== undefined) targetUser.deviseAutorisee = deviseAutorisee;
    if (boutiqueId && allowedIds.includes(Number(boutiqueId))) {
      targetUser.boutiqueId = Number(boutiqueId);
    }
    
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
      if (targetUser.role === "employe") {
        targetUser.failedLoginAttempts = 0;
        targetUser.lockedAt = null;
        targetUser.lockReason = null;
      }
    }

    await targetUser.save();
    res.json({ 
      id: targetUser.id, nom: targetUser.nom, email: targetUser.email, telephone: targetUser.telephone, 
      role: targetUser.role, permissions: targetUser.permissions, deviseAutorisee: targetUser.deviseAutorisee,
      statut: targetUser.statut, boutiqueId: targetUser.boutiqueId,
      failedLoginAttempts: targetUser.failedLoginAttempts, lockReason: targetUser.lockReason
    });
  } catch (err) { next(err); }
});

router.patch("/employees/:id/status", requireRole("admin"), async (req, res, next) => {
  try {
    const allowedIds = req.managedBoutiqueIds || [req.boutiqueId];
    const targetUser = await User.findOne({ 
      where: { id: req.params.id, boutiqueId: { [Op.in]: allowedIds }, role: { [Op.in]: ["admin", "employe"] } } 
    });
    if (!targetUser) return res.status(404).json({ message: "Utilisateur introuvable." });
    
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ message: "Vous ne pouvez pas suspendre votre propre compte administrateur." });
    }

    const nouveauStatut = targetUser.statut === "actif" ? "suspendu" : "actif";

    // Règle hiérarchique stricte : un Admin de boutique NE PEUT PAS réactiver un compte Admin désactivé (seul le Super Admin le peut)
    if (targetUser.role === "admin" && nouveauStatut === "actif") {
      return res.status(403).json({
        message: "Seul le Super Administrateur peut réactiver un compte Administrateur désactivé."
      });
    }

    const updates = { statut: nouveauStatut };
    if (nouveauStatut === "actif") {
      updates.failedLoginAttempts = 0;
      updates.lockedAt = null;
      updates.lockReason = null;
    }

    await targetUser.update(updates);
    res.json(targetUser);
  } catch (err) { next(err); }
});

router.delete("/employees/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const allowedIds = req.managedBoutiqueIds || [req.boutiqueId];
    const targetUser = await User.findOne({ 
      where: { id: req.params.id, boutiqueId: { [Op.in]: allowedIds }, role: { [Op.in]: ["admin", "employe"] } } 
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
    if (statut) {
      client.statut = statut;
      if (statut === "actif") {
        client.failedLoginAttempts = 0;
        client.lockedAt = null;
        client.lockReason = null;
      }
    }

    if (motDePasse && motDePasse.trim()) {
      client.motDePasseHash = await bcrypt.hash(motDePasse.trim(), 10);
      client.failedLoginAttempts = 0;
      client.lockedAt = null;
      client.lockReason = null;
    }

    await client.save();
    res.json({
      id: client.id, nom: client.nom, email: client.email, telephone: client.telephone,
      role: client.role, statut: client.statut, isEmailVerified: client.isEmailVerified,
      failedLoginAttempts: client.failedLoginAttempts, lockReason: client.lockReason
    });
  } catch (err) { next(err); }
});

router.patch("/clients/:id/status", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const client = await User.findOne({ where: { id: req.params.id, role: "client" } });
    if (!client) return res.status(404).json({ message: "Client introuvable." });

    const nouveauStatut = client.statut === "actif" ? "suspendu" : "actif";
    const updates = { statut: nouveauStatut };
    if (nouveauStatut === "actif") {
      updates.failedLoginAttempts = 0;
      updates.lockedAt = null;
      updates.lockReason = null;
    }
    await client.update(updates);
    res.json({
      id: client.id, nom: client.nom, statut: client.statut,
      failedLoginAttempts: client.failedLoginAttempts, lockReason: client.lockReason
    });
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
    let boutique = await Boutique.findByPk(req.boutiqueId);
    if (!boutique) {
      boutique = await Boutique.findOne({ order: [["id", "ASC"]] });
    }
    res.json(boutique);
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
      unitechApiKey, fraisUnitechPourcentage, reloadlyClientId, reloadlyClientSecret, reloadlySandbox, dingApiKey
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
      ...(fraisUnitechPourcentage !== undefined && { fraisUnitechPourcentage: Number(fraisUnitechPourcentage) || 2.0 }),
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
    const { items, clientNom, clientTelephone, moyenPaiement, devise, montantRecu, montantPaye, montantRestant, dateEcheance, statutPaiement, idempotencyKey } = req.body;
    if (idempotencyKey) {
      const existing = await getCache(`idempotency:${idempotencyKey}`);
      if (existing) {
        return res.status(200).json(existing);
      }
    }
    if (!items || !items.length) {
      return res.status(400).json({ message: "Le panier de vente est vide." });
    }

    const boutique = await Boutique.findByPk(req.boutiqueId);
    const devisesDisponibles = normalizeBoutiqueCurrencies(boutique);
    const primaryDevise = devisesDisponibles[0] || "KMF";
    const requestedDevise = devise ? String(devise).trim().toUpperCase() : primaryDevise;
    const saleCurrency = requestedDevise === "XOF" ? "FCFA" : (devisesDisponibles.includes(requestedDevise) ? requestedDevise : (requestedDevise || primaryDevise));

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
      } else {
        prixEffectif = getProductUnitPriceForCurrency(p, saleCurrency, primaryDevise);
      }

      it.prixUnitaire = prixEffectif;
      sousTotal += prixEffectif * it.quantite;
    }

    // Calcul automatique du statut de paiement et des dettes (acompte / reste à payer)
    let finalStatutPaiement = "paye";
    let finalMontantPaye = sousTotal;
    let finalMontantRestant = 0;
    let finalDateEcheance = null;

    if (montantRestant !== undefined && Number(montantRestant) > 0) {
      finalMontantRestant = Number(montantRestant);
      finalMontantPaye = montantPaye !== undefined ? Number(montantPaye) : Math.max(0, sousTotal - finalMontantRestant);
      finalStatutPaiement = finalMontantPaye > 0 ? "partiel" : "non_paye";
      finalDateEcheance = dateEcheance || null;
    } else if (montantRecu !== undefined && Number(montantRecu) < sousTotal) {
      const recu = Math.max(0, Number(montantRecu) || 0);
      finalMontantPaye = recu;
      finalMontantRestant = Math.max(0, sousTotal - recu);
      finalStatutPaiement = recu > 0 ? "partiel" : "non_paye";
      finalDateEcheance = dateEcheance || null;
    } else if (statutPaiement) {
      finalStatutPaiement = statutPaiement;
      if (finalStatutPaiement === "non_paye") {
        finalMontantPaye = 0;
        finalMontantRestant = sousTotal;
        finalDateEcheance = dateEcheance || null;
      }
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
      devise: saleCurrency,
      statutPaiement: finalStatutPaiement,
      montantPaye: finalMontantPaye,
      montantRestant: finalMontantRestant,
      dateEcheance: finalDateEcheance
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
        where.createdAt[Op.gte] = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999Z`);
        where.createdAt[Op.lte] = end;
      }
    }

    // Récupérer tous les achats de la boutique pour identifier l'achat initial de chaque produit et les totaux Hier / Aujourd'hui
    const allBoutiqueAchats = await Achat.findAll({
      where: { boutiqueId: req.boutiqueId },
      order: [["createdAt", "ASC"], ["id", "ASC"]]
    });

    const firstAchatByProduct = new Map();
    allBoutiqueAchats.forEach(a => {
      if (a.productId && !firstAchatByProduct.has(a.productId)) {
        firstAchatByProduct.set(a.productId, a);
      }
    });

    const now = new Date();
    const todayKey = getLocalDateKey(now);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayKey = getLocalDateKey(yesterdayDate);
    const currentMonthPrefix = todayKey.slice(0, 7);

    let totalDepensesGlobal = 0;
    let achatsAujourdhuiFCFA = 0;
    let nbAchatsAujourdhui = 0;
    let achatsHierFCFA = 0;
    let nbAchatsHier = 0;
    let achatsMoisFCFA = 0;
    let nbAchatsMois = 0;

    allBoutiqueAchats.forEach(a => {
      const m = Number(a.totalAchat || 0);
      totalDepensesGlobal += m;
      const k = getLocalDateKey(a.createdAt || a.dateAchat);
      if (k === todayKey) {
        achatsAujourdhuiFCFA += m;
        nbAchatsAujourdhui += 1;
      }
      if (k === yesterdayKey) {
        achatsHierFCFA += m;
        nbAchatsHier += 1;
      }
      if (k.startsWith(currentMonthPrefix)) {
        achatsMoisFCFA += m;
        nbAchatsMois += 1;
      }
    });

    const list = await Achat.findAll({
      where,
      include: [
        { model: Product, as: "product" },
        { model: Fournisseur, as: "fournisseur" }
      ],
      order: [["createdAt", "DESC"], ["id", "DESC"]]
    });

    const enrichedList = list.map(item => {
      const plain = item.toJSON ? item.toJSON() : item;
      const firstForProd = firstAchatByProduct.get(plain.productId);
      const isInitial = !firstForProd || firstForProd.id === plain.id;
      const achatRef = `#ACH-${String(plain.id).padStart(3, "0")}`;
      const initialAchatRef = firstForProd ? `#ACH-${String(firstForProd.id).padStart(3, "0")}` : achatRef;
      const initialAchatDate = firstForProd ? (firstForProd.createdAt || firstForProd.dateAchat) : (plain.createdAt || plain.dateAchat);
      return {
        ...plain,
        achatRef,
        isInitial,
        isApprovisionnement: !isInitial || Boolean(plain.notes && plain.notes.toLowerCase().includes("approvisionnement")),
        initialAchatId: firstForProd ? firstForProd.id : plain.id,
        initialAchatRef,
        initialAchatDate
      };
    });

    // Calculs de rentabilité et bénéfices
    const totalDepenses = enrichedList.reduce((sum, a) => sum + Number(a.totalAchat || 0), 0);

    // Calcul potentiel / prévisionnel sur le stock et sur les ventes
    let potentielVenteKMF = 0;
    let potentielVenteFCFA = 0;

    for (const item of enrichedList) {
      if (item.product) {
        const pKmf = Number((item.product.enPromo && item.product.prixPromo) ? item.product.prixPromo : (item.product.prix || 0));
        const pFcfa = Number((item.product.enPromo && item.product.prixPromoSenegal) ? item.product.prixPromoSenegal : (item.product.prixSenegal || 0));
        const q = Number(item.quantite || 0);
        potentielVenteKMF += (pKmf * q);
        potentielVenteFCFA += (pFcfa * q);
      }
    }

    const beneficePrevisionnelKMF = Math.max(0, potentielVenteKMF - totalDepenses);
    const beneficePrevisionnelFCFA = Math.max(0, potentielVenteFCFA - totalDepenses);

    res.json({
      achats: enrichedList,
      totalDepenses,
      totalDepensesGlobal,
      achatsAujourdhuiFCFA,
      nbAchatsAujourdhui,
      achatsHierFCFA,
      nbAchatsHier,
      achatsMoisFCFA,
      nbAchatsMois,
      beneficePrevisionnelKMF,
      beneficePrevisionnelFCFA,
      potentielVenteKMF,
      potentielVenteFCFA
    });
  } catch (err) { next(err); }
});

router.post("/achats", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    if (req.user.role === "employe") {
      const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
      if (!perms.includes("approvisionner_produit") && !perms.includes("achats_stocks")) {
        return res.status(403).json({ message: "Vous n'avez pas l'autorisation d'approvisionner les stocks." });
      }
    }

    const { productId, fournisseurId, quantite, prixAchatUnitaire, notes } = req.body;
    const prod = await Product.findOne({ where: { id: productId, boutiqueId: req.boutiqueId } });
    if (!prod) return res.status(404).json({ message: "Produit introuvable." });

    const qty = Number(quantite) || 1;
    const unitPrice = prixAchatUnitaire !== undefined && prixAchatUnitaire !== "" ? Number(prixAchatUnitaire) : Number(prod.coutAchat || 0);
    const totalAchat = qty * unitPrice;

    // Vérifier s'il existe déjà un achat initial pour ce produit afin d'identifier l'approvisionnement
    const firstAchat = await Achat.findOne({
      where: { productId: prod.id, boutiqueId: req.boutiqueId },
      order: [["createdAt", "ASC"], ["id", "ASC"]]
    });

    let finalNotes = notes ? String(notes).trim() : "";
    if (!finalNotes) {
      if (firstAchat) {
        const refInit = `#ACH-${String(firstAchat.id).padStart(3, "0")}`;
        const dateInit = new Date(firstAchat.createdAt || firstAchat.dateAchat).toLocaleDateString("fr-FR");
        finalNotes = `Approvisionnement (+${qty}) lié à l'achat ${refInit} du ${dateInit}`;
      } else {
        finalNotes = `Achat initial - ${prod.nom}`;
      }
    }

    const achat = await Achat.create({
      boutiqueId: req.boutiqueId,
      productId: prod.id,
      fournisseurId: fournisseurId || prod.fournisseurId || null,
      quantite: qty,
      prixAchatUnitaire: unitPrice,
      totalAchat,
      notes: finalNotes
    });

    // Mise à jour automatique du stock et du prix/coût d'achat du produit
    prod.stock = (prod.stock || 0) + qty;
    if (unitPrice > 0) {
      prod.coutAchat = unitPrice;
    }
    await prod.save();
    purgeCache();
    broadcast("product_updated", { productId: prod.id, boutiqueId: req.boutiqueId });
    broadcast("achat_updated", { achatId: achat.id, productId: prod.id, boutiqueId: req.boutiqueId });

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
    broadcast("achat_updated", { achatId: achat.id, productId: achat.productId, boutiqueId: req.boutiqueId });

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
    broadcast("achat_updated", { achatId: req.params.id, productId: achat.productId, boutiqueId: req.boutiqueId });

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
  deleteAdminCustomRequest,
  toggleStatutAchat
} = require("../controllers/customOrder.controller");

router.get("/custom-requests", requireRole("admin", "employe"), listAdminCustomRequests);
router.post("/custom-requests", requireRole("admin", "employe"), createAdminCustomRequest);
router.put("/custom-requests/:id", requireRole("admin", "employe"), updateAdminCustomRequest);
router.delete("/custom-requests/:id", requireRole("admin", "employe"), deleteAdminCustomRequest);
router.put("/custom-requests/:id/quote", requireRole("admin", "employe"), quoteCustomRequest);
router.patch("/custom-requests/:id/achat-status", requireRole("admin", "employe"), toggleStatutAchat);

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
    const totalParDevise = {};

    expenses.forEach(e => {
      const m = Number(e.montant || 0);
      const dev = (e.devise === "XOF") ? "FCFA" : String(e.devise || "KMF").toUpperCase();
      totalParDevise[dev] = (totalParDevise[dev] || 0) + m;
      if (dev === "FCFA") {
        totalMontantFCFA += m;
      } else if (dev === "KMF") {
        totalMontantKMF += m;
      }
    });

    const employees = await User.findAll({
      where: { boutiqueId: req.boutiqueId, role: ["admin", "employe"] },
      attributes: ["id", "nom", "email", "role"]
    });

    const fin = await computeBoutiqueFinancials(req.boutiqueId);

    res.json({
      expenses,
      devisesDisponibles: fin.devisesDisponibles,
      statsByCurrency: fin.statsByCurrency,
      kpis: {
        totalCount: expenses.length,
        totalParDevise,
        totalMontantKMF,
        totalMontantFCFA,
        beneficeDisponibleKMF: fin.beneficeComores,
        beneficeDisponibleFCFA: fin.beneficeSenegal,
        beneficeVentesKMF: fin.beneficeVentesComores,
        beneficeVentesFCFA: fin.beneficeVentesSenegal
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

    const finBefore = await computeBoutiqueFinancials(req.boutiqueId);
    const reqDev = devise ? String(devise).trim().toUpperCase() : finBefore.primaryDevise;
    let finalDevise = reqDev === "XOF" ? "FCFA" : (reqDev || finBefore.primaryDevise);
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

    const fin = await computeBoutiqueFinancials(req.boutiqueId);
    const stDev = fin.statsByCurrency[finalDevise] || {};
    const newBenefice = stDev.beneficeNet !== undefined ? stDev.beneficeNet : (finalDevise === "FCFA" ? fin.beneficeSenegal : fin.beneficeComores);
    const paysLabel = finalDevise === "FCFA" ? "Sénégal (FCFA)" : (finalDevise === "KMF" ? "Comores (KMF)" : finalDevise);

    purgeCache();
    broadcast("expense_updated", { action: "create", expenseId: expense.id, boutiqueId: req.boutiqueId });
    res.status(201).json({
      ...fullExpense.toJSON(),
      actionMessage: `Dépense de ${Math.round(Number(montant)).toLocaleString("fr-FR")} ${finalDevise} enregistrée et déduite du bénéfice ${paysLabel} (Nouveau bénéfice net : ${Math.round(newBenefice).toLocaleString("fr-FR")} ${finalDevise}).`
    });
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
        const cleanDev = String(devise).trim().toUpperCase();
        expense.devise = cleanDev === "XOF" ? "FCFA" : cleanDev;
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

    purgeCache();
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
    purgeCache();
    broadcast("expense_updated", { action: "delete", expenseId: req.params.id, boutiqueId: req.boutiqueId });
    res.json({ success: true, message: "Dépense supprimée avec succès. Le bénéfice net a été réajusté." });
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

    const fin = await computeBoutiqueFinancials(req.boutiqueId);

    res.json({
      savings,
      devisesDisponibles: fin.devisesDisponibles,
      statsByCurrency: fin.statsByCurrency,
      kpis: {
        totalEpargneKMF: fin.totalEpargneKMF,
        totalEpargneFCFA: fin.totalEpargneFCFA,
        totalDepotsKMF: fin.totalDepotsKMF,
        totalRetraitsKMF: fin.totalRetraitsKMF,
        totalDepotsFCFA: fin.totalDepotsFCFA,
        totalRetraitsFCFA: fin.totalRetraitsFCFA,
        beneficeDisponibleKMF: fin.beneficeComores,
        beneficeDisponibleFCFA: fin.beneficeSenegal,
        beneficeAvantEpargneKMF: fin.beneficeApresDepensesComores,
        beneficeAvantEpargneFCFA: fin.beneficeApresDepensesSenegal,
        depensesKMF: fin.depensesKMF,
        depensesFCFA: fin.depensesFCFA,
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
    const opMontant = Number(montant);
    if (!opMontant || opMontant <= 0) {
      return res.status(400).json({ message: "Le montant doit être supérieur à 0." });
    }

    const fin = await computeBoutiqueFinancials(req.boutiqueId);
    const opType = type === "retrait" ? "retrait" : "depot";
    const reqDev = devise ? String(devise).trim().toUpperCase() : fin.primaryDevise;
    const opDevise = (reqDev === "FCFA" || reqDev === "XOF") ? "FCFA" : (reqDev || fin.primaryDevise);
    const paysLabel = opDevise === "FCFA" ? "Sénégal (FCFA)" : (opDevise === "KMF" ? "Comores (KMF)" : opDevise);

    const stDev = fin.statsByCurrency[opDevise] || {};
    const beneficeDispo = stDev.beneficeNet !== undefined ? stDev.beneficeNet : (opDevise === "FCFA" ? fin.beneficeSenegal : fin.beneficeComores);
    const soldeEpargneDispo = stDev.epargne !== undefined ? stDev.epargne : (opDevise === "FCFA" ? fin.totalEpargneFCFA : fin.totalEpargneKMF);

    if (opType === "depot") {
      if (beneficeDispo <= 0) {
        return res.status(400).json({
          message: `Opération refusée : votre bénéfice disponible pour ${paysLabel} est actuellement de ${Math.round(beneficeDispo).toLocaleString("fr-FR")} ${opDevise}. Vous ne pouvez pas épargner tant que votre bénéfice n'est pas positif.`
        });
      }
      if (opMontant > beneficeDispo) {
        return res.status(400).json({
          message: `Opération refusée : vous ne pouvez pas épargner ${Math.round(opMontant).toLocaleString("fr-FR")} ${opDevise} car votre bénéfice disponible (${paysLabel}) est de ${Math.round(beneficeDispo).toLocaleString("fr-FR")} ${opDevise}. Le montant épargné doit être inférieur ou égal à votre bénéfice.`
        });
      }
    } else {
      // Retrait d'épargne
      if (soldeEpargneDispo <= 0) {
        return res.status(400).json({
          message: `Retrait refusé : vous n'avez aucune épargne disponible en ${opDevise} (Solde actuel : 0 ${opDevise}).`
        });
      }
      if (opMontant > soldeEpargneDispo) {
        return res.status(400).json({
          message: `Retrait refusé : vous ne pouvez pas retirer ${Math.round(opMontant).toLocaleString("fr-FR")} ${opDevise} car votre solde d'épargne disponible en ${opDevise} n'est que de ${Math.round(soldeEpargneDispo).toLocaleString("fr-FR")} ${opDevise}.`
        });
      }
    }

    const saving = await Saving.create({
      boutiqueId: req.boutiqueId,
      creeParId: req.user.id,
      type: opType,
      montant: opMontant,
      devise: opDevise,
      dateOperation: dateOperation ? new Date(dateOperation) : new Date(),
      compte: compte ? compte.trim() : "Compte Épargne",
      reference: reference ? reference.trim() : null,
      notes: notes ? notes.trim() : null
    });

    const fullSaving = await Saving.findByPk(saving.id, {
      include: [{ model: User, as: "creePar", attributes: ["id", "nom", "email"] }]
    });

    const newEpargne = opType === "depot" ? (soldeEpargneDispo + opMontant) : (soldeEpargneDispo - opMontant);
    const newBenefice = opType === "depot" ? (beneficeDispo - opMontant) : (beneficeDispo + opMontant);

    const actionMessage = opType === "depot"
      ? `Épargne de ${Math.round(opMontant).toLocaleString("fr-FR")} ${opDevise} enregistrée ! Votre bénéfice (${paysLabel}) a diminué à ${Math.round(newBenefice).toLocaleString("fr-FR")} ${opDevise} et votre solde d'épargne est maintenant de ${Math.round(newEpargne).toLocaleString("fr-FR")} ${opDevise}.`
      : `Retrait de ${Math.round(opMontant).toLocaleString("fr-FR")} ${opDevise} effectué ! Votre solde d'épargne (${opDevise}) a diminué à ${Math.round(newEpargne).toLocaleString("fr-FR")} ${opDevise} (Bénéfice disponible : ${Math.round(newBenefice).toLocaleString("fr-FR")} ${opDevise}).`;

    purgeCache();
    broadcast("saving_updated", { action: "create", savingId: saving.id, boutiqueId: req.boutiqueId });
    res.status(201).json({
      ...fullSaving.toJSON(),
      actionMessage,
      newEpargne,
      newBenefice
    });
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
    const opType = type !== undefined ? (type === "retrait" ? "retrait" : "depot") : saving.type;
    const opMontant = montant !== undefined ? Number(montant) : Number(saving.montant);
    const reqDev = devise !== undefined ? String(devise).trim().toUpperCase() : saving.devise;
    const opDevise = (reqDev === "FCFA" || reqDev === "XOF") ? "FCFA" : reqDev;
    const paysLabel = opDevise === "FCFA" ? "Sénégal (FCFA)" : (opDevise === "KMF" ? "Comores (KMF)" : opDevise);

    if (!opMontant || opMontant <= 0) {
      return res.status(400).json({ message: "Le montant doit être supérieur à 0." });
    }

    const fin = await computeBoutiqueFinancials(req.boutiqueId, { excludeSavingId: saving.id });
    const stDev = fin.statsByCurrency[opDevise] || {};
    const beneficeDispo = stDev.beneficeNet !== undefined ? stDev.beneficeNet : (opDevise === "FCFA" ? fin.beneficeSenegal : fin.beneficeComores);
    const soldeEpargneDispo = stDev.epargne !== undefined ? stDev.epargne : (opDevise === "FCFA" ? fin.totalEpargneFCFA : fin.totalEpargneKMF);

    if (opType === "depot") {
      if (opMontant > beneficeDispo) {
        return res.status(400).json({
          message: `Modification refusée : le montant (${Math.round(opMontant).toLocaleString("fr-FR")} ${opDevise}) dépasse votre bénéfice disponible pour ${paysLabel} (${Math.round(beneficeDispo).toLocaleString("fr-FR")} ${opDevise}).`
        });
      }
    } else {
      if (opMontant > soldeEpargneDispo) {
        return res.status(400).json({
          message: `Modification refusée : le retrait (${Math.round(opMontant).toLocaleString("fr-FR")} ${opDevise}) dépasse votre solde d'épargne disponible en ${opDevise} (${Math.round(soldeEpargneDispo).toLocaleString("fr-FR")} ${opDevise}).`
        });
      }
    }

    saving.type = opType;
    saving.montant = opMontant;
    saving.devise = opDevise;
    if (dateOperation !== undefined) saving.dateOperation = new Date(dateOperation);
    if (compte !== undefined) saving.compte = compte ? compte.trim() : "Compte Épargne";
    if (reference !== undefined) saving.reference = reference ? reference.trim() : null;
    if (notes !== undefined) saving.notes = notes ? notes.trim() : null;

    await saving.save();

    const fullSaving = await Saving.findByPk(saving.id, {
      include: [{ model: User, as: "creePar", attributes: ["id", "nom", "email"] }]
    });

    const newEpargne = opType === "depot" ? (soldeEpargneDispo + opMontant) : (soldeEpargneDispo - opMontant);
    const newBenefice = opType === "depot" ? (beneficeDispo - opMontant) : (beneficeDispo + opMontant);

    const actionMessage = `Opération mise à jour ! Solde d'épargne (${opDevise}) : ${Math.round(newEpargne).toLocaleString("fr-FR")} ${opDevise} • Bénéfice disponible : ${Math.round(newBenefice).toLocaleString("fr-FR")} ${opDevise}.`;

    purgeCache();
    broadcast("saving_updated", { action: "update", savingId: saving.id, boutiqueId: req.boutiqueId });
    res.json({
      ...fullSaving.toJSON(),
      actionMessage,
      newEpargne,
      newBenefice
    });
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
    purgeCache();
    broadcast("saving_updated", { action: "delete", savingId: req.params.id, boutiqueId: req.boutiqueId });
    res.json({ success: true, message: "Opération d'épargne supprimée avec succès. Le solde d'épargne et votre bénéfice ont été réajustés." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

