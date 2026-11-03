import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { 
  ShoppingCart, Search, Plus, Minus, Trash2, CheckCircle, Printer, X, CreditCard, 
  DollarSign, Phone, User, Tag, Layers, Eye, Check
} from "lucide-react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";
import { formatPrice as fcfa, getActiveCurrency } from "../../utils/currency.js";
import { SkeletonPOSGrid } from "../../components/Skeleton.jsx";
import ReceiptModal from "../../components/ReceiptModal.jsx";
import { saveCache, getCache, enqueueAction, saveOfflineSale } from "../../utils/offlineStorage.js";
import { useOffline } from "../../context/OfflineContext.jsx";

function parseJsonSafe(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function getProductVariants(p) {
  if (!p) return [];
  const variants = [];
  const modeles = parseJsonSafe(p.modelesCompatibles);
  const couleurs = parseJsonSafe(p.couleurs);
  const senteurs = parseJsonSafe(p.senteurs);

  modeles.forEach((m, idx) => {
    const nom = typeof m === "string" ? m : (m.nomComplet || m.nom || m.modele || `Modèle ${idx + 1}`);
    const stk = typeof m === "object" && (m.quantite !== undefined || m.stock !== undefined)
      ? Number(m.quantite !== undefined ? m.quantite : m.stock)
      : Number(p.stock || 0);
    const photo = typeof m === "object" ? (m.photo || m.photoUrl || m.image || null) : null;
    const prix = typeof m === "object" && m.prix ? Number(m.prix) : null;
    variants.push({
      key: `modele_${idx}_${nom}`,
      type: "modele",
      typeLabel: "Modèle",
      nom,
      stock: stk,
      photo: photo || p.imageUrl,
      prixSpecifique: prix
    });
  });

  couleurs.forEach((c, idx) => {
    const nom = typeof c === "string" ? c : (c.nom || c.couleur || `Couleur ${idx + 1}`);
    const stk = typeof c === "object" && (c.quantite !== undefined || c.stock !== undefined)
      ? Number(c.quantite !== undefined ? c.quantite : c.stock)
      : Number(p.stock || 0);
    const photo = typeof c === "object" ? (c.photo || c.photoUrl || c.image || null) : null;
    variants.push({
      key: `couleur_${idx}_${nom}`,
      type: "couleur",
      typeLabel: "Couleur",
      nom,
      stock: stk,
      photo: photo || p.imageUrl,
      prixSpecifique: null
    });
  });

  senteurs.forEach((s, idx) => {
    const nom = typeof s === "string" ? s : (s.nom || s.senteur || `Senteur ${idx + 1}`);
    const stk = typeof s === "object" && (s.quantite !== undefined || s.stock !== undefined)
      ? Number(s.quantite !== undefined ? s.quantite : s.stock)
      : Number(p.stock || 0);
    const photo = typeof s === "object" ? (s.photo || s.photoUrl || s.image || null) : null;
    variants.push({
      key: `senteur_${idx}_${nom}`,
      type: "senteur",
      typeLabel: "Senteur",
      nom,
      stock: stk,
      photo: photo || p.imageUrl,
      prixSpecifique: null
    });
  });

  return variants;
}

export default function VenteDirecte() {
  const location = useLocation();
  const navigate = useNavigate();
  const { boutique } = useAuth();
  const { isOnline, pendingCount } = useOffline();
  const storeName = boutique?.nom || "Marché Vert";
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [visibleLimit, setVisibleLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [clientNom, setClientNom] = useState("");
  const [clientTelephone, setClientTelephone] = useState("");
  const [moyenPaiement, setMoyenPaiement] = useState("cash");
  const [loading, setLoading] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [mobileTab, setMobileTab] = useState("produits"); // 'produits' | 'panier'
  const [activeCurrency, setActiveCurrency] = useState(() => getActiveCurrency());

  // Mode modification d'une vente existante
  const [editingOrder, setEditingOrder] = useState(null);

  // Modal sélection d'une variante spécifique
  const [selectedProductForVariants, setSelectedProductForVariants] = useState(null);

  // Encaissement & Rendu monnaie
  const [montantRecu, setMontantRecu] = useState("");

  useEffect(() => {
    let orderToEdit = location.state?.editOrder;
    if (!orderToEdit) {
      const saved = sessionStorage.getItem("pos_edit_order");
      if (saved) {
        try {
          orderToEdit = JSON.parse(saved);
        } catch (e) {}
      }
    }

    if (orderToEdit && orderToEdit.id) {
      setEditingOrder(orderToEdit);
      if (orderToEdit.clientNom || orderToEdit.client?.nom) {
        setClientNom(orderToEdit.clientNom || orderToEdit.client?.nom || "");
      }
      if (orderToEdit.clientTelephone || orderToEdit.client?.telephone) {
        setClientTelephone(orderToEdit.clientTelephone || orderToEdit.client?.telephone || "");
      }
      if (orderToEdit.moyenPaiement) {
        setMoyenPaiement(orderToEdit.moyenPaiement);
      }
      if (orderToEdit.devise) {
        setActiveCurrency(orderToEdit.devise);
      }

      const items = orderToEdit.items || [];
      if (items.length > 0) {
        const restoredCart = items.map((it, idx) => {
          const p = it.product || {
            id: it.productId,
            nom: it.nom || "Article",
            prix: it.prixUnitaire
          };
          const variantLabel = [it.modele, it.couleur].filter(Boolean).join(" · ") || null;
          return {
            cartKey: `edit_${it.id || it.productId}_${idx}`,
            product: p,
            quantite: Number(it.quantite) || 1,
            selectedModele: it.modele || null,
            selectedCouleur: it.couleur || null,
            selectedSenteur: null,
            selectedImageUrl: it.imageUrl || p.imageUrl,
            prixVendu: (it.prixUnitaire !== undefined && it.prixUnitaire !== null) ? String(it.prixUnitaire) : "",
            variantLabel,
            stockMax: 9999
          };
        });
        setCart(restoredCart);
        setMobileTab("panier"); // Amener directement sur le panier pour voir/modifier les articles
      }
    }
  }, [location.state]);

  function handleCancelEdit() {
    setEditingOrder(null);
    try { sessionStorage.removeItem("pos_edit_order"); } catch (e) {}
    setCart([]);
    setClientNom("");
    setClientTelephone("");
    setMontantRecu("");
    toast.success("Mode modification annulé.");
  }

  const paymentMethods = activeCurrency === "FCFA" ? [
    { value: "cash", label: "Espèces / Cash" },
    { value: "wave", label: "Wave" },
    { value: "orange_money", label: "Orange Money" }
  ] : [
    { value: "cash", label: "Espèces / Cash" },
    { value: "mvola", label: "Mvola" }
  ];

  useEffect(() => {
    const handleCurr = (e) => setActiveCurrency(e.detail);
    window.addEventListener("currency_changed", handleCurr);
    return () => window.removeEventListener("currency_changed", handleCurr);
  }, []);

  useEffect(() => {
    if (!paymentMethods.some(pm => pm.value === moyenPaiement)) {
      setMoyenPaiement("cash");
    }
  }, [activeCurrency]);

  function getEffectivePrice(p, curr = activeCurrency) {
    if (!p) return 0;
    if (curr === "FCFA") {
      if (p.enPromo && p.prixPromoSenegal) return Number(p.prixPromoSenegal);
      return Number(p.prixSenegal || p.prix || 0);
    }
    if (p.enPromo && p.prixPromo) return Number(p.prixPromo);
    return Number(p.prix || 0);
  }

  async function load() {
    // 1. Lire d'abord le cache local pour affichage instantane (meme hors-ligne)
    const cached = await getCache("admin_products");
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setProducts(cached);
      setProductsLoading(false);
    } else {
      setProductsLoading(true);
    }

    // 2. Si le reseau est disponible, rafraichir depuis le serveur
    if (navigator.onLine) {
      api.get("/admin/products")
        .then(res => {
          const data = res.data;
          const list = Array.isArray(data) ? data : (data?.items || []);
          setProducts(list);
          saveCache("admin_products", list).catch(() => {});
        })
        .catch((err) => {
          console.warn("Chargement distant impossible, maintien du cache local:", err);
        })
        .finally(() => {
          setProductsLoading(false);
        });
    } else {
      setProductsLoading(false);
    }
  }

  useEffect(() => {
    load();

    const unsub = subscribeRealtime((detail) => {
      if (detail.type === "product_updated" || detail.type === "order_created") {
        load();
      }
    });

    const handleSynced = () => {
      load();
    };
    window.addEventListener("offline_synced", handleSynced);

    return () => {
      if (typeof unsub === "function") unsub();
      window.removeEventListener("offline_synced", handleSynced);
    };
  }, []);

  const filteredProducts = products.filter(p => {
    const q = search.trim().toLowerCase();
    return !q || p.nom.toLowerCase().includes(q) || (p.famille && p.famille.toLowerCase().includes(q));
  });

  const displayedProducts = filteredProducts.slice(0, visibleLimit);

  // Ajout direct (sans variante particulière ou avec attribut par défaut)
  function addToCartDirect(p) {
    if (p.stock <= 0) {
      toast.error("Ce produit est en rupture de stock.");
      return;
    }
    const cartKey = `prod_${p.id}`;
    setCart(prev => {
      const exist = prev.find(item => item.cartKey === cartKey);
      if (exist) {
        if (exist.quantite >= p.stock) {
          toast.error(`Stock insuffisant. Seules ${p.stock} unités sont disponibles.`);
          return prev;
        }
        return prev.map(item => item.cartKey === cartKey ? { ...item, quantite: item.quantite + 1 } : item);
      }
      return [...prev, {
        cartKey,
        product: p,
        quantite: 1,
        selectedModele: null,
        selectedCouleur: null,
        selectedSenteur: null,
        selectedImageUrl: p.imageUrl,
        prixVendu: "",
        variantLabel: null,
        stockMax: p.stock
      }];
    });
    toast.success(`${p.nom} ajouté au panier`);
  }

  // Ajout avec variante spécifique (modèle, couleur ou senteur)
  function addVariantToCart(p, variant) {
    if (variant.stock <= 0) {
      toast.error(`La variante "${variant.nom}" est actuellement épuisée.`);
      return;
    }

    const cartKey = `prod_${p.id}_${variant.type}_${variant.nom}`;
    setCart(prev => {
      const exist = prev.find(item => item.cartKey === cartKey);
      if (exist) {
        if (exist.quantite >= variant.stock) {
          toast.error(`Stock insuffisant pour "${variant.nom}". Disponible : ${variant.stock}`);
          return prev;
        }
        return prev.map(item => item.cartKey === cartKey ? { ...item, quantite: item.quantite + 1 } : item);
      }

      return [...prev, {
        cartKey,
        product: p,
        quantite: 1,
        selectedModele: variant.type === "modele" ? variant.nom : null,
        selectedCouleur: variant.type === "couleur" ? variant.nom : null,
        selectedSenteur: variant.type === "senteur" ? variant.nom : null,
        selectedImageUrl: variant.photo || p.imageUrl,
        prixVendu: variant.prixSpecifique || "",
        variantLabel: `${variant.typeLabel}: ${variant.nom}`,
        stockMax: variant.stock
      }];
    });

    toast.success(`${variant.nom} ajouté au panier`);
    setSelectedProductForVariants(null);
  }

  function updateQty(cartKey, delta) {
    setCart(prev => prev.map(item => {
      if (item.cartKey === cartKey) {
        const newQty = item.quantite + delta;
        const maxLimit = item.stockMax !== undefined ? item.stockMax : item.product.stock;
        if (newQty > maxLimit) {
          toast.error(`Stock insuffisant. Maximum : ${maxLimit}`);
          return item;
        }
        return newQty > 0 ? { ...item, quantite: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  }

  function updateCustomPrice(cartKey, newPrice) {
    setCart(prev => prev.map(item => {
      if (item.cartKey === cartKey) {
        return { ...item, prixVendu: newPrice };
      }
      return item;
    }));
  }

  function removeFromCart(cartKey) {
    setCart(prev => prev.filter(item => item.cartKey !== cartKey));
  }

  function getItemUnitPrice(item) {
    if (item.prixVendu !== "" && item.prixVendu !== null && item.prixVendu !== undefined && !isNaN(Number(item.prixVendu)) && Number(item.prixVendu) >= 0) {
      return Number(item.prixVendu);
    }
    return getEffectivePrice(item.product, activeCurrency);
  }

  const sousTotal = cart.reduce((sum, item) => {
    return sum + (getItemUnitPrice(item) * item.quantite);
  }, 0);

  const numMontantRecu = Number(montantRecu) || 0;
  const monnaieARendre = numMontantRecu >= sousTotal ? numMontantRecu - sousTotal : 0;
  const resteAPayer = (numMontantRecu > 0 && numMontantRecu < sousTotal) ? sousTotal - numMontantRecu : 0;

  async function handleValiderVente() {
    if (cart.length === 0) return;
    setLoading(true);

    const itemsPayload = cart.map(item => {
      const customPrice = (item.prixVendu !== "" && item.prixVendu !== null && item.prixVendu !== undefined && !isNaN(Number(item.prixVendu)))
        ? Number(item.prixVendu)
        : undefined;

      return {
        productId: item.product.id,
        quantite: item.quantite,
        prixVendu: customPrice,
        modele: item.selectedModele || undefined,
        couleur: item.selectedCouleur || item.selectedSenteur || undefined,
        imageUrl: item.selectedImageUrl || undefined
      };
    });

    const idempotencyKey = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const saleData = {
      items: itemsPayload,
      clientNom: clientNom.trim() || "Client comptoir",
      clientTelephone: clientTelephone.trim() || "",
      moyenPaiement,
      devise: activeCurrency,
      idempotencyKey
    };

    const processOfflineSale = async () => {
      const localId = `offline_${Date.now()}`;
      const localTicket = `POS-OFFLINE-${Date.now().toString().slice(-6)}`;
      const offlineSale = {
        id: localId,
        numeroTicket: localTicket,
        isOffline: true,
        statut: "recuperee",
        typeVente: "vente_directe",
        devise: activeCurrency,
        moyenPaiement,
        sousTotal,
        total: sousTotal,
        fraisLivraison: 0,
        montantRecu: numMontantRecu > 0 ? numMontantRecu : null,
        monnaieRendue: monnaieARendre,
        client: {
          nom: clientNom.trim() || "Client comptoir",
          telephone: clientTelephone.trim() || ""
        },
        createdAt: new Date().toISOString(),
        items: cart.map(item => ({
          id: `off_item_${Date.now()}_${item.product.id}`,
          quantite: item.quantite,
          prixUnitaire: getItemUnitPrice(item),
          modele: item.selectedModele || null,
          couleur: item.selectedCouleur || item.selectedSenteur || null,
          imageUrl: item.selectedImageUrl || item.product?.imageUrl || null,
          product: {
            id: item.product.id,
            nom: item.product.nom,
            prix: item.product.prix,
            prixSenegal: item.product.prixSenegal,
            imageUrl: item.product.imageUrl
          }
        }))
      };

      // Mettre en file d'attente locale pour synchronisation automatique des retour d'internet
      await enqueueAction({
        type: "VENTE_DIRECTE",
        url: "/admin/ventes/directe",
        method: "POST",
        data: saleData,
        idempotencyKey
      });

      await saveOfflineSale(offlineSale);

      // Mettre a jour les stocks locaux
      setProducts(prevProducts => {
        const updated = prevProducts.map(p => {
          const cartItem = cart.find(ci => ci.product.id === p.id);
          if (cartItem) {
            return { ...p, stock: Math.max(0, p.stock - cartItem.quantite) };
          }
          return p;
        });
        saveCache("admin_products", updated).catch(() => {});
        return updated;
      });

      setCompletedSale(offlineSale);
      setCart([]);
      setClientNom("");
      setClientTelephone("");
      setMontantRecu("");
      toast.success("Vente enregistree hors-ligne. Le ticket PDF est pret et sera synchronise des le retour du reseau.");
    };

    if (!navigator.onLine) {
      await processOfflineSale();
      setLoading(false);
      return;
    }

    try {
      let res;
      if (editingOrder) {
        res = await api.put(`/admin/orders/${editingOrder.id}`, saleData);
        toast.success(`Vente #${editingOrder.id} modifiée avec succès !`);
        setEditingOrder(null);
        try { sessionStorage.removeItem("pos_edit_order"); } catch (e) {}
      } else {
        res = await api.post("/admin/ventes/directe", saleData);
      }

      setCompletedSale({
        ...res.data,
        montantRecu: numMontantRecu > 0 ? numMontantRecu : null,
        monnaieRendue: monnaieARendre
      });

      setCart([]);
      setClientNom("");
      setClientTelephone("");
      setMontantRecu("");
      load(); // Recharge le catalogue et les stocks
    } catch (err) {
      if (!editingOrder && (!err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error"))) {
        await processOfflineSale();
      } else {
        toast.error(err.response?.data?.message || "Erreur lors de la validation de la vente.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handlePrintTicket() {
    window.print();
  }


  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Caisse & Vente Directe</h1>
        <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
          Enregistrez les ventes physiques directes en boutique, sélectionnez les variantes spécifiques et encaissez avec calcul automatique du rendu monnaie.
        </p>
      </div>

      {(!isOnline || pendingCount > 0) && (
        <div style={{
          backgroundColor: !isOnline ? "#FEF3C7" : "#EFF6FF",
          border: `1px solid ${!isOnline ? "#F59E0B" : "#3B82F6"}`,
          borderRadius: 10,
          padding: "10px 16px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          fontSize: 13.5,
          color: !isOnline ? "#92400E" : "#1E40AF"
        }}>
          <div>
            <strong>{!isOnline ? "Mode Hors-Ligne Actif" : "Synchronisation"} :</strong>{" "}
            {!isOnline 
              ? "L'encaissement et l'impression de tickets fonctionnent sans connexion. Vos ventes seront transmises automatiquement des le retour du reseau." 
              : "Connexion retablie. Les operations en attente sont transmises au serveur."}
          </div>
          {pendingCount > 0 && (
            <span style={{
              background: !isOnline ? "#F59E0B" : "#2563EB",
              color: "#FFF",
              padding: "3px 10px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600
            }}>
              {pendingCount} en attente
            </span>
          )}
        </div>
      )}

      {editingOrder && (
        <div style={{
          background: "linear-gradient(135deg, #1E3A8A, #2563EB)",
          color: "#fff",
          padding: "14px 18px",
          borderRadius: 12,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          boxShadow: "0 4px 15px rgba(37,99,235,0.2)"
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>
              Modification de la Vente #{editingOrder.id} ({editingOrder.client?.nom || editingOrder.clientNom || "Client comptoir"})
            </div>
            <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 2 }}>
              Articles recharges dans votre panier direct. Vous pouvez ajouter des articles, ajuster les quantites ou en supprimer, puis enregistrer.
            </div>
          </div>
          <button
            onClick={handleCancelEdit}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "1px solid rgba(255,255,255,0.4)",
              color: "#fff",
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Annuler la modification
          </button>
        </div>
      )}

      {/* MOBILE TABS SWITCHER */}
      <div className="bs-pos-mobile-tabs">
        <button 
          className={`bs-pos-tab ${mobileTab === "produits" ? "active" : ""}`}
          onClick={() => setMobileTab("produits")}
        >
          Sélection Produits ({filteredProducts.length})
        </button>
        <button 
          className={`bs-pos-tab ${mobileTab === "panier" ? "active" : ""}`}
          onClick={() => setMobileTab("panier")}
        >
          Panier de Caisse ({cart.reduce((sum, item) => sum + item.quantite, 0)})
        </button>
      </div>

      <div className="bs-pos-grid">
        {/* LEFT COLUMN: PRODUCT SELECTION & SEARCH */}
        <div className={`bs-pos-products-col ${mobileTab === "produits" ? "mobile-active" : "mobile-hidden"}`}>
          {/* SEARCH BAR */}
          <div className="bs-panel" style={{ padding: 14, marginBottom: 16 }}>
            <div style={{ position: "relative", width: "100%" }}>
              <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input
                className="bs-input"
                placeholder="Rechercher un produit à ajouter au panier..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setVisibleLimit(20);
                }}
                style={{ paddingLeft: 38, borderRadius: 10, fontSize: 13.5, height: 40 }}
              />
            </div>
          </div>

          {/* PRODUCT GRID OR SKELETON */}
          {productsLoading ? (
            <SkeletonPOSGrid count={12} />
          ) : filteredProducts.length === 0 ? (
            <div style={{
              padding: 40, textAlign: "center", color: "var(--muted)",
              background: "#fff", borderRadius: 14, border: "1px dashed var(--line)"
            }}>
              Aucun produit trouvé{search ? ` pour « ${search} »` : ""}.
            </div>
          ) : (
            <>
              <div className="bs-pos-products-grid">
                {displayedProducts.map(p => {
                  const inStock = p.stock > 0;
                  const prixEff = getEffectivePrice(p, activeCurrency);
                  const variants = getProductVariants(p);
                  const hasVariants = variants.length > 0;

                  return (
                    <div
                      key={p.id}
                      style={{
                        background: "#fff", borderRadius: 14, border: "1px solid var(--line)",
                        padding: 12, opacity: inStock ? 1 : 0.6, display: "flex", flexDirection: "column",
                        justifyContent: "space-between", position: "relative", transition: "transform 0.15s",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
                      }}
                    >
                      <div style={{ position: "relative" }}>
                        <img
                          src={p.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=150&q=80"}
                          alt={p.nom}
                          style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 10, marginBottom: 8 }}
                        />
                        {hasVariants && (
                          <span style={{
                            position: "absolute", top: 6, right: 6, background: "rgba(15, 23, 42, 0.8)",
                            color: "#fff", padding: "2px 8px", borderRadius: 8, fontSize: 10.5, fontWeight: 800,
                            backdropFilter: "blur(4px)", display: "flex", alignItems: "center", gap: 4
                          }}>
                            <Layers size={11} /> {variants.length} variante{variants.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      <div>
                        <div style={{ fontSize: 11, color: "var(--forest)", fontWeight: 700, textTransform: "uppercase" }}>
                          {p.famille || "Produit"}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)", height: 36, overflow: "hidden" }} title={p.nom}>
                          {p.nom}
                        </div>
                        
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                          <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--forest-dark)" }}>
                            {fcfa(prixEff, activeCurrency)} {p.unite ? <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted)" }}>/ {p.unite}</span> : ""}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: inStock ? "#1F4D3A" : "#B4483A" }}>
                            {inStock ? `Stock: ${p.stock}` : "Épuisé"}
                          </span>
                        </div>
                      </div>

                      {/* BOUTONS D'AJOUT : DIRECT OU VARIANTES */}
                      {hasVariants ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 6, marginTop: 10 }}>
                          <button
                            type="button"
                            disabled={!inStock}
                            onClick={() => inStock && addToCartDirect(p)}
                            title="Ajouter le produit standard avec la photo principale"
                            style={{
                              background: inStock ? "#F1F5F9" : "#F3F4F6",
                              color: inStock ? "#334155" : "var(--muted)", border: "1px solid #CBD5E1",
                              padding: "7px 4px", borderRadius: 8, fontWeight: 700, fontSize: 11.5,
                              cursor: inStock ? "pointer" : "not-allowed", textAlign: "center"
                            }}
                          >
                            + Direct
                          </button>

                          <button
                            type="button"
                            disabled={!inStock}
                            onClick={() => inStock && setSelectedProductForVariants(p)}
                            style={{
                              background: inStock ? "#2563EB" : "#F3F4F6",
                              color: inStock ? "#fff" : "var(--muted)", border: "none",
                              padding: "7px 6px", borderRadius: 8, fontWeight: 800, fontSize: 11.5,
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                              cursor: inStock ? "pointer" : "not-allowed", boxShadow: inStock ? "0 2px 6px rgba(37,99,235,0.25)" : "none"
                            }}
                          >
                            <Layers size={13} /> Variantes
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!inStock}
                          onClick={() => inStock && addToCartDirect(p)}
                          style={{
                            marginTop: 10, width: "100%", background: inStock ? "var(--forest-light)" : "#F3F4F6",
                            color: inStock ? "var(--forest)" : "var(--muted)", border: "none",
                            padding: "7px", borderRadius: 8, fontWeight: 700, fontSize: 12,
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            cursor: inStock ? "pointer" : "not-allowed"
                          }}
                        >
                          <Plus size={14} /> Ajouter au panier
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {filteredProducts.length > visibleLimit && (
                <div style={{ textAlign: "center", marginTop: 18, marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={() => setVisibleLimit(prev => prev + 20)}
                    style={{
                      background: "#fff",
                      border: "1.5px solid var(--forest)",
                      color: "var(--forest-dark)",
                      padding: "10px 22px",
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "all 0.15s"
                    }}
                  >
                    Afficher la suite (+20 produits) — {displayedProducts.length} sur {filteredProducts.length}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT COLUMN: CASHIER CART & TICKET SUMMARY */}
        <div className={`bs-pos-cart-col bs-pos-cart-sticky ${mobileTab === "panier" ? "mobile-active" : "mobile-hidden"}`}>
          <div className="bs-panel" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShoppingCart size={20} color="var(--forest)" />
                <h3 style={{ margin: 0, fontSize: 17, color: "var(--forest-dark)" }}>Panier de Caisse</h3>
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>
                {cart.length} ligne{cart.length > 1 ? "s" : ""}
              </span>
            </div>

            {/* CART ITEMS LIST */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 310, overflowY: "auto", marginBottom: 16, paddingRight: 4 }}>
              {cart.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>
                  Le panier est actuellement vide.<br />Cliquez sur un produit ou une variante pour l'ajouter.
                </div>
              ) : (
                cart.map(item => {
                  const unitPrice = getItemUnitPrice(item);
                  const catalogPrice = getEffectivePrice(item.product, activeCurrency);
                  const isCustomPrice = item.prixVendu !== "" && item.prixVendu !== null && item.prixVendu !== undefined;

                  return (
                    <div key={item.cartKey} style={{
                      display: "flex", flexDirection: "column", gap: 6, padding: 10,
                      background: "var(--paper)", borderRadius: 10, border: "1px solid var(--line)"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img 
                          src={item.selectedImageUrl || item.product.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=80&q=80"} 
                          alt={item.product.nom}
                          style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {item.product.nom}
                          </div>
                          {item.variantLabel && (
                            <div style={{ fontSize: 11.5, color: "#2563EB", fontWeight: 700 }}>
                              {item.variantLabel}
                            </div>
                          )}
                          <div style={{ fontSize: 12, color: "var(--forest)", fontWeight: 800, marginTop: 2 }}>
                            {fcfa(unitPrice, activeCurrency)} x {item.quantite} = {fcfa(unitPrice * item.quantite, activeCurrency)}
                          </div>
                        </div>

                        {/* QUANTITY CONTROLS */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#fff", padding: "2px 6px", borderRadius: 8, border: "1px solid var(--line)" }}>
                          <button 
                            type="button"
                            onClick={() => updateQty(item.cartKey, -1)}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
                          >
                            <Minus size={14} color="var(--ink)" />
                          </button>
                          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{item.quantite}</span>
                          <button 
                            type="button"
                            onClick={() => updateQty(item.cartKey, 1)}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
                          >
                            <Plus size={14} color="var(--ink)" />
                          </button>
                        </div>

                        <button 
                          type="button"
                          onClick={() => removeFromCart(item.cartKey)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#B4483A", padding: 4 }}
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* CHAMP DE PRIX DE VENTE LIBRE / NÉGOCIÉ */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: "#fff", padding: "4px 8px", borderRadius: 6, border: "1px dashed #CBD5E1", fontSize: 11.5
                      }}>
                        <span style={{ color: "var(--muted)", fontWeight: 600 }}>
                          Prix unitaire vendu :
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="number"
                            min="0"
                            step="50"
                            placeholder={String(catalogPrice)}
                            value={item.prixVendu ?? ""}
                            onChange={(e) => updateCustomPrice(item.cartKey, e.target.value)}
                            style={{
                              width: 85, height: 26, padding: "2px 6px", fontSize: 12,
                              textAlign: "right", fontWeight: 800,
                              color: isCustomPrice ? "#1D4ED8" : "var(--ink)",
                              border: isCustomPrice ? "1.5px solid #3B82F6" : "1px solid #CBD5E1",
                              borderRadius: 4
                            }}
                          />
                          <span style={{ fontWeight: 700, color: "var(--muted)", fontSize: 11 }}>{activeCurrency}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* CUSTOMER INFO (OPTIONAL) */}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: 8 }}>
                Informations Vente & Client (Optionnel)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <input
                  className="bs-input"
                  placeholder="Nom du client"
                  value={clientNom}
                  onChange={(e) => setClientNom(e.target.value)}
                  style={{ fontSize: 12.5, height: 36 }}
                />
                <input
                  className="bs-input"
                  placeholder="Téléphone client"
                  value={clientTelephone}
                  onChange={(e) => setClientTelephone(e.target.value)}
                  style={{ fontSize: 12.5, height: 36 }}
                />
              </div>

              {/* PAYMENT METHOD */}
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>
                Moyen de paiement
              </div>
              <select
                className="bs-select"
                value={moyenPaiement}
                onChange={(e) => setMoyenPaiement(e.target.value)}
                style={{ fontSize: 13, height: 38 }}
              >
                {paymentMethods.map(pm => (
                  <option key={pm.value} value={pm.value}>{pm.label}</option>
                ))}
              </select>
            </div>

            {/* TOTAL & SUBMIT */}
            <div style={{ background: "var(--paper)", padding: 14, borderRadius: 12, border: "1px solid var(--line)", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Total à Payer</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: "var(--forest-dark)" }}>{fcfa(sousTotal, activeCurrency)}</span>
              </div>
            </div>

            {/* ENCAISSEMENT & CALCUL MONNAIE */}
            <div style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: 12,
              padding: 14,
              marginBottom: 16
            }}>
              <label style={{
                display: "block",
                fontSize: 12,
                fontWeight: 700,
                color: "#475569",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                Montant reçu du client
              </label>

              <div style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                width: "100%"
              }}>
                <input
                  type="number"
                  min="0"
                  step="50"
                  placeholder="0"
                  value={montantRecu}
                  onChange={(e) => setMontantRecu(e.target.value)}
                  style={{
                    width: "100%",
                    height: 44,
                    fontSize: 16,
                    fontWeight: 700,
                    padding: "0 68px 0 14px",
                    background: "#FFFFFF",
                    border: "1.5px solid #CBD5E1",
                    borderRadius: 10,
                    color: "#0F172A",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s ease, box-shadow 0.15s ease"
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#2563EB";
                    e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#CBD5E1";
                    e.target.style.boxShadow = "none";
                  }}
                />

                {montantRecu !== "" && (
                  <button
                    type="button"
                    onClick={() => setMontantRecu("")}
                    title="Effacer le montant"
                    style={{
                      position: "absolute",
                      right: 64,
                      background: "#F1F5F9",
                      border: "none",
                      borderRadius: "50%",
                      width: 22,
                      height: 22,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "#64748B",
                      padding: 0
                    }}
                  >
                    <X size={12} />
                  </button>
                )}

                <span style={{
                  position: "absolute",
                  right: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#64748B",
                  background: "#F1F5F9",
                  padding: "4px 8px",
                  borderRadius: 6,
                  pointerEvents: "none"
                }}>
                  {activeCurrency}
                </span>
              </div>

              {/* Résultat Monnaie ou Reste à payer */}
              {numMontantRecu > 0 && (
                <div style={{ marginTop: 10 }}>
                  {numMontantRecu >= sousTotal ? (
                    <div style={{
                      background: "#DCFCE7",
                      border: "1.5px solid #86EFAC",
                      borderRadius: 10,
                      padding: "8px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#166534" }}>
                        Monnaie à rendre :
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 900, color: "#15803D" }}>
                        {fcfa(monnaieARendre, activeCurrency)}
                      </span>
                    </div>
                  ) : (
                    <div style={{
                      background: "#FEF2F2",
                      border: "1.5px solid #FECACA",
                      borderRadius: 10,
                      padding: "8px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#991B1B" }}>
                        Reste à payer :
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 900, color: "#DC2626" }}>
                        {fcfa(resteAPayer, activeCurrency)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              className="bs-btn-primary"
              style={{ width: "100%", height: 46, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              disabled={cart.length === 0 || loading}
              onClick={handleValiderVente}
            >
              {loading ? (
                "Validation en cours..."
              ) : editingOrder ? (
                <><CheckCircle size={18} /> Enregistrer les modifications ({activeCurrency})</>
              ) : (
                <><CheckCircle size={18} /> Valider la Vente Directe ({activeCurrency})</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* FLOATING ACTION BUTTON ON MOBILE */}
      {cart.length > 0 && mobileTab === "produits" && (
        <button className="bs-pos-mobile-float-cart" onClick={() => setMobileTab("panier")}>
          <ShoppingCart size={18} /> Voir / Valider le Panier ({cart.reduce((sum, item) => sum + item.quantite, 0)}) · {fcfa(sousTotal, activeCurrency)}
        </button>
      )}

      {/* MODAL DE SÉLECTION D'UNE VARIANTE SPÉCIFIQUE */}
      {selectedProductForVariants && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div style={{
            background: "#fff", borderRadius: 20, width: "100%", maxWidth: 640,
            maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
            animation: "popIn 0.2s ease-out"
          }}>
            {/* EN-TÊTE MODAL */}
            <div style={{
              padding: "16px 20px", background: "linear-gradient(135deg, #1E293B, #0F172A)",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img
                  src={selectedProductForVariants.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=80&q=80"}
                  alt={selectedProductForVariants.nom}
                  style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }}
                />
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>
                    {selectedProductForVariants.nom}
                  </h3>
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>
                    Sélectionnez la couleur, le modèle ou la senteur spécifique vendue
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProductForVariants(null)}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* CORPS : LISTE DES VARIANTES DISPONIBLES */}
            <div style={{ padding: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {getProductVariants(selectedProductForVariants).map(v => {
                  const isAvailable = v.stock > 0;
                  const priceToShow = v.prixSpecifique || getEffectivePrice(selectedProductForVariants, activeCurrency);

                  return (
                    <div
                      key={v.key}
                      style={{
                        border: isAvailable ? "1.5px solid #E2E8F0" : "1px dashed #CBD5E1",
                        background: isAvailable ? "#fff" : "#F8FAFC",
                        borderRadius: 14, padding: 12, display: "flex", alignItems: "center", gap: 12,
                        opacity: isAvailable ? 1 : 0.6,
                        boxShadow: isAvailable ? "0 2px 8px rgba(0,0,0,0.03)" : "none"
                      }}
                    >
                      <img
                        src={v.photo || selectedProductForVariants.imageUrl}
                        alt={v.nom}
                        style={{
                          width: 54, height: 54, borderRadius: 10, objectFit: "cover",
                          background: "#F1F5F9", border: "1px solid #E2E8F0"
                        }}
                      />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                            background: "#EFF6FF", color: "#2563EB", padding: "1px 6px", borderRadius: 4
                          }}>
                            {v.typeLabel}
                          </span>
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            color: isAvailable ? "#16A34A" : "#DC2626"
                          }}>
                            {isAvailable ? `${v.stock} dispo` : "Épuisé"}
                          </span>
                        </div>

                        <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--ink)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {v.nom}
                        </div>

                        <div style={{ fontSize: 13, fontWeight: 900, color: "var(--forest-dark)", marginTop: 2 }}>
                          {fcfa(priceToShow, activeCurrency)}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => addVariantToCart(selectedProductForVariants, v)}
                        style={{
                          background: isAvailable ? "#2563EB" : "#E2E8F0",
                          color: isAvailable ? "#fff" : "#94A3B8",
                          border: "none", padding: "8px 12px", borderRadius: 8,
                          fontSize: 12, fontWeight: 800, cursor: isAvailable ? "pointer" : "not-allowed",
                          display: "flex", alignItems: "center", gap: 4, flexShrink: 0
                        }}
                      >
                        <Plus size={14} /> Choisir
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: "14px 20px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setSelectedProductForVariants(null)}
                style={{
                  background: "#F1F5F9", border: "none", color: "#475569",
                  padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer"
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TICKET DE CAISSE AVEC ANIMATION RECEIPT PRINTER */}
      {completedSale && (
        <ReceiptModal
          order={completedSale}
          boutique={boutique}
          onClose={() => setCompletedSale(null)}
          onContinue={() => setCompletedSale(null)}
          autoAnimate={true}
        />
      )}
    </>
  );
}
