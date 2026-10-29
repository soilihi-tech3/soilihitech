import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { SkeletonOrdersPage } from "../../components/Skeleton.jsx";
import { readCache, writeCache } from "../../utils/swrCache.js";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Package, Truck, CheckCircle, XCircle, Clock, ShoppingBag, Search, ChevronRight, MapPin, CreditCard, ArrowLeft, PackageOpen, TrendingUp, RefreshCw, Receipt, Star, Smartphone, MessageCircle, ClipboardList, ExternalLink, Sparkles, Upload, Eye, Image as ImageIcon, X } from "lucide-react";
import api, { SLUG } from "../../api";
import { useAuth } from "../../context/AuthContext.jsx";
import { useCart } from "../../context/CartContext.jsx";
import { formatWhatsAppOrderMessage } from "../../utils/whatsappOrder.js";

import { formatPrice as fcfa } from "../../utils/currency.js";

const STATUT_CONFIG = {
  en_attente_paiement: { label: "Paiement en attente", color: "#B45309", bg: "#FEF3C7", Icon: Clock, step: 0 },
  en_attente:   { label: "En attente",        color: "#B7791F", bg: "#FFFBEA", Icon: Clock,       step: 0 },
  validee:      { label: "Confirmée",         color: "#2B6CB0", bg: "#EBF4FF", Icon: CheckCircle, step: 1 },
  pret_retrait: { label: "Prête à récupérer", color: "#2D8653", bg: "#EBF7F0", Icon: Package,     step: 2 },
  en_livraison: { label: "En livraison",      color: "#2F6B4F", bg: "#EBF2ED", Icon: Truck,       step: 2 },
  recuperee:    { label: "Récupérée",         color: "#163424", bg: "#EBF7F0", Icon: CheckCircle, step: 3 },
  livree:       { label: "Livrée",            color: "#163424", bg: "#EBF7F0", Icon: CheckCircle, step: 3 },
  annulee:      { label: "Annulée",           color: "#B4483A", bg: "#FDF2F0", Icon: XCircle,     step: -1 },
};

const DELIVERY_STEPS = [
  { key: "en_attente",   label: "Reçue",        icon: ShoppingBag },
  { key: "validee",      label: "Confirmée",    icon: CheckCircle },
  { key: "en_livraison", label: "En livraison", icon: Truck },
  { key: "livree",       label: "Livrée",       icon: CheckCircle },
];
const PICKUP_STEPS = [
  { key: "en_attente",   label: "Reçue",             icon: ShoppingBag },
  { key: "validee",      label: "Confirmée",          icon: CheckCircle },
  { key: "pret_retrait", label: "Prête à récupérer", icon: Package },
  { key: "recuperee",    label: "Récupérée",         icon: CheckCircle },
];

const MOYEN_LABEL = {
  cash: "Paiement à la livraison",
  mvola: "Mvola",
  holam: "Wero",
  carte: "Carte bancaire",
  whatsapp: "Commande via WhatsApp",
};

const FILTERS = [
  { key: "all",               label: "Toutes les commandes", icon: ShoppingBag },
  { key: "demande_sur_mesure", label: "Demandes sur-mesure",   icon: ClipboardList },
  { key: "en_attente",        label: "En attente",            icon: Clock },
  { key: "validee",           label: "Confirmées",            icon: CheckCircle },
  { key: "pret_retrait",      label: "Prêtes à récupérer",   icon: Package },
  { key: "en_livraison",      label: "En livraison",          icon: Truck },
  { key: "recuperee",         label: "Récupérées",            icon: CheckCircle },
  { key: "livree",            label: "Livrées",               icon: CheckCircle },
  { key: "annulee",           label: "Annulées",              icon: XCircle },
];


import { subscribeRealtime } from "../../utils/realtime.js";
import ReceiptModal from "../../components/ReceiptModal.jsx";

export default function MyOrders() {
  const { boutique, user } = useAuth();
  const { addMultipleToCart } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetOrderId = searchParams.get("orderId") || searchParams.get("id");

  const [orders, setOrders] = useState(() => readCache("my_orders") || []);
  const [customRequests, setCustomRequests] = useState([]);
  const [loading, setLoading] = useState(() => readCache("my_orders") === undefined);
  const [selected, setSelected] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  // State pour le modal d'avis sur un produit
  const [reviewModalProduct, setReviewModalProduct] = useState(null);
  const [reviewModalOrderId, setReviewModalOrderId] = useState(null);
  const [reviewDraft, setReviewDraft] = useState({ note: 5, commentaire: "" });
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [uploadingCapture, setUploadingCapture] = useState(false);
  const [previewCaptureModal, setPreviewCaptureModal] = useState(null);

  const openReviewModal = (product, orderId) => {
    const validId = product?.id || product?.productId || product?.product_id;
    if (!product || !validId) {
      toast.error("Impossible de trouver le produit sélectionné.");
      return;
    }
    const cleanProduct = {
      id: validId,
      nom: product.nom || "Produit",
      imageUrl: product.imageUrl || ""
    };
    setReviewModalProduct(cleanProduct);
    setReviewModalOrderId(orderId);
    setReviewDraft({ note: 5, commentaire: "" });
    setReviewError("");
    setReviewSuccess(false);
  };

  const submitProductReview = async () => {
    if (!reviewModalProduct) return;
    setReviewError("");
    setSubmittingReview(true);
    try {
      await api.post(`/store/${SLUG}/products/${reviewModalProduct.id}/reviews`, {
        ...reviewDraft,
        orderId: reviewModalOrderId
      });
      setReviewSuccess(true);
      setTimeout(() => {
        setReviewModalProduct(null);
        setReviewSuccess(false);
      }, 1500);
    } catch (err) {
      setReviewError(err.response?.data?.message || "Impossible d'envoyer l'avis.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const reorder = (order) => {
    if (!order || !order.items || order.items.length === 0) return;
    addMultipleToCart(order.items);
    navigate("/commander");
  };

  const payNow = async (orderId) => {
    try {
      const res = await api.post(`/store/${SLUG}/create-checkout-session`, { orderId });
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'initialisation du paiement.");
    }
  };

  const switchToCash = async (order) => {
    if (!window.confirm("Cela va changer le moyen de paiement de cette commande en 'Paiement à la livraison'. Continuer ?")) return;
    try {
      await api.patch(`/store/${SLUG}/orders/${order.id}/switch-to-cash`);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, statut: "en_attente", moyenPaiement: "cash" } : o)));
      if (selected && selected.id === order.id) {
        setSelected((prev) => ({ ...prev, statut: "en_attente", moyenPaiement: "cash" }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Impossible de changer le moyen de paiement.");
    }
  };

  const handleCaptureFile = async (e, orderId) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image valide (PNG, JPG, etc.).");
      return;
    }

    setUploadingCapture(true);
    try {
      const reader = new FileReader();
      const base64Data = await new Promise((resolve, reject) => {
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;
            const maxDim = 1200;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.8));
          };
          img.onerror = reject;
          img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await api.patch(`/store/${SLUG}/orders/${orderId}/capture`, { captureUrl: base64Data });

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, captureUrl: base64Data } : o));
      if (selected && selected.id === orderId) {
        setSelected(prev => ({ ...prev, captureUrl: base64Data }));
      }
      toast.success("Capture de paiement enregistrée avec succès !");
    } catch (err) {
      console.error("Erreur enregistrement capture:", err);
      toast.error(err.response?.data?.message || "Impossible d'enregistrer la capture.");
    } finally {
      setUploadingCapture(false);
      e.target.value = "";
    }
  };

  const sendWhatsAppCapture = (order) => {
    const waNum = boutique?.whatsappNumber || boutique?.telephone;
    const cleanWaNum = waNum ? waNum.replace(/[^0-9]/g, "") : "";
    if (!cleanWaNum) {
      toast.error("Numéro WhatsApp de la boutique non configuré.");
      return;
    }
    const orderNumber = "COM-B" + String(order.id).padStart(3, "0");
    const cartItems = (order.items || []).map((it) => ({
      product: it.product || { 
        nom: it.nomProduit || `Article #${it.productId}`, 
        prix: it.prixUnitaire, 
        unite: "article(s)" 
      },
      quantite: it.quantite,
      prixUnitaire: it.prixUnitaire,
      selectedModele: it.modele || it.selectedModele || null,
      selectedCouleur: it.couleur || it.selectedCouleur || null
    }));
    const message = formatWhatsAppOrderMessage({
      boutique,
      user: user || { nom: order.clientNom, telephone: order.clientTelephone, email: order.clientEmail, adresse: order.adresseLivraison },
      cart: cartItems,
      subtotal: order.sousTotal || (order.total - (order.fraisLivraison || 0)),
      fraisLivraison: order.fraisLivraison || 0,
      total: order.total,
      orderNumber,
      form: {
        modeLivraison: order.modeLivraison,
        adresseLivraison: order.adresseLivraison,
        moyenPaiement: order.moyenPaiement
      }
    });
    window.open(`https://wa.me/${cleanWaNum}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const fetchOrders = () => {
    // 1. Commandes classiques
    api.get(`/store/${SLUG}/orders/mine`)
      .then(res => {
        const freshOrders = res.data || [];
        setOrders(freshOrders);
        writeCache("my_orders", freshOrders);

        // Auto-sélection si une commande est spécifiée dans l'URL (?orderId=18)
        if (targetOrderId && !selected) {
          const target = freshOrders.find(o => String(o.id) === String(targetOrderId));
          if (target) setSelected(target);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // 2. Demandes sur-mesure du client
    api.get(`/store/${SLUG}/custom-requests/mine`, {
      params: { telephone: user?.telephone || undefined }
    })
      .then(res => {
        setCustomRequests(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {});
  };


  useEffect(() => {
    fetchOrders();

    // 1. Realtime SSE push listener
    const unsubscribe = subscribeRealtime((detail) => {
      if (detail.type === "order_updated" || detail.type === "order_created") {
        fetchOrders();
      }
    });

    // 2. Smart 60s polling interval (reduced to save resources, SSE handles real-time updates)
    const interval = setInterval(fetchOrders, 60000);

    // 3. Window focus / tab active refresh
    const onFocus = () => fetchOrders();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const filteredCustomRequests = customRequests.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.code && r.code.toLowerCase().includes(q)) ||
      (r.modeleAppareil && r.modeleAppareil.toLowerCase().includes(q)) ||
      (r.articles && r.articles.some(a => a.nom && a.nom.toLowerCase().includes(q)))
    );
  });

  const filtered = orders.filter(o => {
    const matchSearch = search === "" ||
      `${o.id}`.includes(search) ||
      o.items?.some(it => it.product?.nom?.toLowerCase().includes(search.toLowerCase()));
      
    if (filter === "all") return matchSearch;
    if (filter === "demande_sur_mesure") return false;
    return matchSearch && o.statut === filter;
  });

  const stats = {
    total: orders.length + customRequests.length,
    enCours: orders.filter(o => !["livree", "annulee"].includes(o.statut)).length + customRequests.filter(r => ["en_attente", "propose"].includes(r.statut)).length,
    livrees: orders.filter(o => o.statut === "livree").length + customRequests.filter(r => r.statut === "valide").length,
    annulees: orders.filter(o => o.statut === "annulee").length + customRequests.filter(r => r.statut === "refuse").length,
    montant: orders.filter(o => o.statut !== "annulee").reduce((s, o) => s + (o.total || 0), 0),
  };

  async function cancelOrder(id) {
    if (!window.confirm(`Voulez-vous vraiment annuler votre commande #${id} ?`)) return;
    try {
      await api.patch(`/store/${SLUG}/orders/${id}/cancel`);
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, statut: "annulee" } : o))
      );
      if (selected && selected.id === id) {
        setSelected((prev) => ({ ...prev, statut: "annulee" }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Impossible d'annuler cette commande.");
    }
  }

  // ─── RENDERING ─────────────────────────────────────────────────────────────

  // ─── LIST VIEW ─────────────────────────────────────────────────────────────
  if (loading) return <SkeletonOrdersPage />;

  return (
    <>
      {/* MODAL LAISSER UN AVIS */}
      {reviewModalProduct && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div style={{
            background: "var(--card)", borderRadius: 20, maxWidth: 460, width: "100%",
            padding: 24, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: "var(--forest-dark)", fontFamily: "var(--font-heading)" }}>
                Donner mon avis
              </h3>
              <button
                onClick={() => setReviewModalProduct(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 20, padding: 0 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, background: "var(--paper)", padding: 12, borderRadius: 12 }}>
              <img
                src={reviewModalProduct.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=80&q=80"}
                alt=""
                style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }}
              />
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{reviewModalProduct.nom}</div>
            </div>

            {reviewSuccess ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#2D8653", fontWeight: 700 }}>
                <CheckCircle size={40} style={{ margin: "0 auto 10px" }} />
                Merci ! Votre avis a bien été enregistré.
              </div>
            ) : (
              <>
                {reviewError && (
                  <div style={{ background: "#FDF2F0", border: "1px solid #F8D7D2", color: "#B4483A", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
                    {reviewError}
                  </div>
                )}

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>
                    Note globale (étoiles)
                  </label>
                  <div style={{ display: "flex", gap: 8 }} onMouseLeave={() => setHoverRating(0)}>
                    {[1, 2, 3, 4, 5].map((n) => {
                      const activeNote = hoverRating || reviewDraft.note;
                      return (
                        <Star
                          key={n}
                          size={32}
                          color="#F59E0B"
                          fill={n <= activeNote ? "#F59E0B" : "none"}
                          style={{ cursor: "pointer", transition: "transform 0.15s, fill 0.15s" }}
                          onMouseEnter={() => setHoverRating(n)}
                          onClick={() => setReviewDraft((r) => ({ ...r, note: n }))}
                        />
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>
                    Votre commentaire (optionnel)
                  </label>
                  <textarea
                    className="bs-input"
                    rows={3}
                    placeholder="Qu'avez-vous pensé de cet article ?"
                    value={reviewDraft.commentaire}
                    onChange={(e) => setReviewDraft((r) => ({ ...r, commentaire: e.target.value }))}
                    style={{ width: "100%", borderRadius: 12 }}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setReviewModalProduct(null)}
                    style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={submitProductReview}
                    disabled={submittingReview}
                    style={{ background: "var(--forest)", color: "#fff", border: "none", borderRadius: 12, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >
                    {submittingReview ? "Envoi..." : "Publier mon avis"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {selected ? (
        <div className="bs-my-orders-detail-layout">
          {/* ... Detail view content ... */}
          {/* ── MAIN DETAIL ── */}
          <div className="bs-my-orders-detail-main">
            <button onClick={() => setSelected(null)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13, fontWeight: 600, padding: "0 0 20px", marginBottom: 8 }}>
              <ArrowLeft size={15} /> Retour à mes commandes
            </button>

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 26, color: "var(--forest-dark)", margin: "0 0 6px" }}>Commande #{selected.id}</h1>
                <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>Passée le {new Date(selected.createdAt).toLocaleDateString("fr-FR", { dateStyle: "long" })}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {["en_attente", "en_attente_paiement"].includes(selected.statut) && (
                  <button
                    onClick={() => reorder(selected)}
                    style={{
                      background: "var(--forest-light)", color: "var(--forest-dark)", border: "1px solid var(--forest)",
                      padding: "8px 16px", borderRadius: 20, fontWeight: 700, fontSize: 13,
                      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6
                    }}
                    title="Remettre les articles au panier pour modifier la commande"
                  >
                    <RefreshCw size={15} /> Modifier ma commande
                  </button>
                )}
                {!["livree", "recuperee", "en_livraison", "annulee"].includes(selected.statut) && (
                  <button
                    onClick={() => cancelOrder(selected.id)}
                    style={{
                      background: "#FDF2F0", color: "#B4483A", border: "1px solid #F8D7D2",
                      padding: "8px 16px", borderRadius: 20, fontWeight: 700, fontSize: 13,
                      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6
                    }}
                  >
                    <XCircle size={15} /> Annuler ma commande
                  </button>
                )}
                <span style={{ background: (STATUT_CONFIG[selected.statut] || STATUT_CONFIG["en_attente"]).bg, color: (STATUT_CONFIG[selected.statut] || STATUT_CONFIG["en_attente"]).color, padding: "8px 18px", borderRadius: 20, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {(STATUT_CONFIG[selected.statut] || STATUT_CONFIG["en_attente"]).label}
                </span>
              </div>
            </div>

            {/* TIMELINE TRACKER */}
            {selected.statut !== "annulee" && (
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 20, padding: "24px 20px", marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 20 }}>
                  Suivi — {selected.modeLivraison === "domicile" ? "Livraison à domicile" : "Retrait en boutique"}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
                  <div style={{ position: "absolute", top: 18, left: "10%", right: "10%", height: 3, background: "var(--line)", zIndex: 0 }} />
                  <div style={{
                    position: "absolute", top: 18, left: "10%",
                    width: `${(Math.max(0, (STATUT_CONFIG[selected.statut] || STATUT_CONFIG["en_attente"]).step) / ((selected.modeLivraison === "domicile" ? DELIVERY_STEPS : PICKUP_STEPS).length - 1)) * 80}%`,
                    height: 3, background: "var(--forest)", zIndex: 1, transition: "width 0.4s ease"
                  }} />

                  {(selected.modeLivraison === "domicile" ? DELIVERY_STEPS : PICKUP_STEPS).map((step, idx) => {
                    const done = idx <= (STATUT_CONFIG[selected.statut] || STATUT_CONFIG["en_attente"]).step;
                    const current = idx === (STATUT_CONFIG[selected.statut] || STATUT_CONFIG["en_attente"]).step;
                    return (
                      <div key={step.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2, position: "relative" }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: current ? "var(--forest-dark)" : done ? "var(--forest)" : "#fff",
                          border: `2px solid ${done ? "var(--forest)" : "var(--line)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: done ? "#fff" : "var(--muted)", transition: "all 0.3s"
                        }}>
                          <step.icon size={16} />
                        </div>
                        <div style={{ textAlign: "center", marginTop: 8, padding: "0 2px" }}>
                          <div style={{ fontSize: 11, fontWeight: done ? 700 : 500, color: done ? "var(--forest-dark)" : "var(--muted)", whiteSpace: "nowrap" }}>{step.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 20, background: "var(--forest-light)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                  {React.createElement((STATUT_CONFIG[selected.statut] || STATUT_CONFIG["en_attente"]).Icon, { size: 18, color: "var(--forest)", style: { flexShrink: 0 } })}
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--forest-dark)" }}>
                    {selected.statut === "livree" && "Votre commande a été livrée avec succès !"}
                    {selected.statut === "en_livraison" && "Votre livreur est en route ! Préparez-vous à le recevoir."}
                    {selected.statut === "en_preparation" && "Votre commande est en cours de préparation."}
                    {selected.statut === "validee" && "Votre commande a été confirmée. Préparation en cours."}
                    {selected.statut === "en_attente" && "Commande reçue, en attente de confirmation."}
                    {selected.statut === "pret_retrait" && "Votre commande est prête ! Venez la récupérer en boutique."}
                  </span>
                </div>
              </div>
            )}

            {selected.statut === "annulee" && (
              <div style={{ background: "#FDF2F0", border: "1px solid #F8D7D2", borderRadius: 16, padding: "16px 20px", marginBottom: 24, display: "flex", gap: 14 }}>
                <XCircle size={24} color="#B4483A" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, color: "#B4483A", fontSize: 14, marginBottom: 4 }}>Commande annulée</div>
                  <div style={{ fontSize: 12.5, color: "#B4483A", opacity: 0.8 }}>Cette commande a été annulée et ne sera pas traitée.</div>
                </div>
              </div>
            )}

            {/* INFOS LIVRAISON + PAIEMENT */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
              {[
                {
                  label: "Mode de livraison",
                  content: selected.modeLivraison === "domicile" ? "Livraison à domicile" : "Retrait en boutique",
                  sub: selected.modeLivraison === "domicile" ? selected.adresseLivraison : (boutique?.adresse ? `Point de retrait : ${boutique.adresse}` : null),
                  Icon: selected.modeLivraison === "domicile" ? Truck : Package,
                },
                {
                  label: "Moyen de paiement",
                  content: MOYEN_LABEL[selected.moyenPaiement] || selected.moyenPaiement,
                  sub: null,
                  Icon: CreditCard,
                },
              ].map((info, i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{info.label}</div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--forest-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <info.Icon size={16} color="var(--forest)" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{info.content}</div>
                      {info.sub && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, display: "flex", gap: 4 }}><MapPin size={12} style={{ flexShrink: 0, marginTop: 1 }} />{info.sub}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* JUSTIFICATIF / CAPTURE DE PAIEMENT MVOLA / WERO */}
            {(selected.moyenPaiement === "mvola" || selected.moyenPaiement === "wero" || selected.moyenPaiement === "holam") && (
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: "16px 18px", marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6 }}>
                    <ImageIcon size={14} color="var(--forest)" /> Capture de transaction ({selected.moyenPaiement === "mvola" ? "MVola" : "Wero"})
                  </div>
                  {selected.captureUrl && (
                    <span style={{ fontSize: 11, fontWeight: 700, background: "#EBF7F0", color: "#2D8653", padding: "3px 8px", borderRadius: 12 }}>
                      Enregistrée
                    </span>
                  )}
                </div>

                {selected.captureUrl ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <div 
                      onClick={() => setPreviewCaptureModal(selected.captureUrl)}
                      style={{ cursor: "pointer", position: "relative", width: 68, height: 68, borderRadius: 10, overflow: "hidden", border: "1.5px solid var(--line)", flexShrink: 0 }}
                      title="Cliquer pour agrandir"
                    >
                      <img src={selected.captureUrl} alt="Capture de paiement" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                        <Eye size={18} />
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Capture de paiement transmise</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>La boutique dispose de votre justificatif pour valider la commande.</div>
                    </div>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "var(--forest-dark)", cursor: uploadingCapture ? "wait" : "pointer" }}>
                      <Upload size={14} />
                      {uploadingCapture ? "Envoi..." : "Remplacer"}
                      <input 
                        type="file" 
                        accept="image/*" 
                        disabled={uploadingCapture} 
                        onChange={(e) => handleCaptureFile(e, selected.id)} 
                        style={{ display: "none" }} 
                      />
                    </label>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", background: "#F8FAFC", border: "1.5px dashed #CBD5E1", borderRadius: 12, padding: "14px 16px" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>Vous n'avez pas encore joint la capture d'écran ?</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Vous pouvez l'ajouter ici directement ou l'envoyer sur WhatsApp ci-contre.</div>
                    </div>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--forest)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: uploadingCapture ? "wait" : "pointer", flexShrink: 0 }}>
                      <Upload size={14} />
                      {uploadingCapture ? "Téléchargement..." : "Ajouter la capture"}
                      <input 
                        type="file" 
                        accept="image/*" 
                        disabled={uploadingCapture} 
                        onChange={(e) => handleCaptureFile(e, selected.id)} 
                        style={{ display: "none" }} 
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* ARTICLES */}
            <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 20, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", background: "var(--paper)" }}>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--forest-dark)" }}>Articles commandés</span>
              </div>
              {selected.items?.map((it, idx) => {
                const canReview = ["recuperee", "livree"].includes(selected.statut);
                const pid = it.product?.id || it.productId || it.product_id;
                const targetProduct = {
                  id: pid,
                  nom: it.product?.nom || it.nom || it.productNom || "Produit",
                  imageUrl: it.product?.imageUrl || it.imageUrl
                };
                return (
                  <div key={it.id || idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: idx < selected.items.length - 1 ? "1px solid var(--line)" : "none", flexWrap: "wrap" }}>
                    <img src={it.imageUrl || targetProduct.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=80&q=80"} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", border: "1px solid var(--line)", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{targetProduct.nom}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "3px 0" }}>
                        {it.modele && (
                          <span style={{ fontSize: 11, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8", padding: "1px 6px", borderRadius: 4, border: "1px solid #BFDBFE" }}>
                            Modèle : {it.modele}
                          </span>
                        )}
                        {it.couleur && (
                          <span style={{ fontSize: 11, fontWeight: 600, background: "#F3F4F6", color: "#374151", padding: "1px 6px", borderRadius: 4, border: "1px solid #E5E7EB" }}>
                            Couleur : {it.couleur}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{fcfa(it.prixUnitaire, selected.devise)} · ×{it.quantite}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)" }}>{fcfa(it.prixUnitaire * it.quantite, selected.devise)}</div>
                      {canReview && targetProduct.id && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            openReviewModal(targetProduct, selected.id);
                          }}
                          style={{
                            background: "#FEF3C7",
                            color: "#B45309",
                            border: "1px solid #F59E0B",
                            borderRadius: 20,
                            padding: "6px 14px",
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            position: "relative",
                            zIndex: 10
                          }}
                        >
                          <Star size={13} fill="#B45309" /> Laisser un avis
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── RIGHT: FINANCIAL SUMMARY ── */}
          <div className="bs-my-orders-detail-summary">
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 18, color: "var(--forest-dark)", margin: "0 0 20px" }}>Résumé financier</h2>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13.5 }}>
              <span style={{ color: "var(--muted)" }}>Sous-total</span><span style={{ fontWeight: 600 }}>{fcfa(selected.sousTotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18, fontSize: 13.5 }}>
              <span style={{ color: "var(--muted)" }}>Frais de livraison</span>
              <span style={{ fontWeight: 600, color: selected.fraisLivraison === 0 ? "#2D8653" : "var(--ink)" }}>{selected.fraisLivraison === 0 ? "Gratuits" : fcfa(selected.fraisLivraison)}</span>
            </div>
            <div style={{ background: "var(--forest-dark)", borderRadius: 16, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#DDE8DF", fontWeight: 600, fontSize: 14 }}>Total payé</span>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 20 }}>{fcfa(selected.total)}</span>
            </div>

            {/* REÇU / FACTURE BOUTON CLIENT */}
            {selected.statut !== "annulee" && (
              <button
                type="button"
                onClick={() => setReceiptOrder(selected)}
                style={{
                  display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
                  marginTop: 16, width: "100%", background: "#F1F5F9", border: "1.5px solid #CBD5E1",
                  borderRadius: 12, padding: "12px", color: "#0F172A", fontWeight: 800, fontSize: 13.5,
                  cursor: "pointer"
                }}
              >
                <Receipt size={18} color="#0284C7" /> Voir / Imprimer mon reçu officiel
              </button>
            )}

            {/* DIRECTEMENT EN BAS DE 'VOIR MON REÇU' : BOUTON ENVOYER LA CAPTURE SUR WHATSAPP */}
            {(selected.moyenPaiement === "mvola" || selected.moyenPaiement === "wero" || selected.moyenPaiement === "holam" || selected.moyenPaiement === "whatsapp") && selected.statut !== "annulee" && (
              <button
                type="button"
                onClick={() => sendWhatsAppCapture(selected)}
                style={{
                  display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
                  marginTop: 10, width: "100%", background: "#25D366", border: "none",
                  borderRadius: 12, padding: "12px", color: "#fff", fontWeight: 800, fontSize: 13.5,
                  cursor: "pointer", boxShadow: "0 4px 14px rgba(37,211,102,0.25)"
                }}
              >
                <MessageCircle size={18} /> Envoyer la capture sur WhatsApp
              </button>
            )}

            {selected.receiptUrl && (
              <a href={selected.receiptUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 10, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 12, padding: "12px", textDecoration: "none", color: "var(--forest-dark)", fontWeight: 700, fontSize: 13.5 }}>
                <Receipt size={18} /> Reçu Stripe sécurisé
              </a>
            )}

            {selected.statut === "en_attente_paiement" && (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => payNow(selected.id)} style={{ width: "100%", background: "var(--forest)", border: "none", borderRadius: 12, padding: "12px", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                  <CreditCard size={18} /> Reprendre le paiement
                </button>
                
                <button onClick={() => switchToCash(selected)} style={{ width: "100%", background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "12px", color: "var(--ink)", fontWeight: 700, fontSize: 13.5, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                  <Package size={18} /> Passer en Paiement à la livraison
                </button>
              </div>
            )}

            {["livree", "recuperee"].includes(selected.statut) && (
              <button onClick={() => reorder(selected)} style={{ width: "100%", marginTop: selected.receiptUrl ? 10 : 16, background: "var(--forest)", border: "none", borderRadius: 12, padding: "12px", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                <RefreshCw size={18} /> Refaire la commande
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bs-my-orders-layout">
          {/* ── SIDEBAR ── */}
          <div className="bs-my-orders-sidebar">
            <div className="filter-title" style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 10px", marginBottom: 12 }}>
              Filtrer par statut
            </div>
            {FILTERS.map(f => {
              const count = f.key === "all" ? orders.length : 
                            (f.key === "demande_sur_mesure" ? customRequests.length : 
                            orders.filter(o => o.statut === f.key).length);
              const active = filter === f.key;
              return (
                <button key={f.key} onClick={() => setFilter(f.key)} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 20,
                  background: active ? "var(--forest-dark)" : "#fff",
                  border: active ? "1px solid var(--forest-dark)" : "1px solid var(--line)",
                  color: active ? "#fff" : "var(--ink)",
                  fontWeight: active ? 800 : 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
                  transition: "all 0.15s", flexShrink: 0
                }}>
                  <f.icon size={15} color={active ? "#fff" : "var(--forest)"} />
                  <span>{f.label}</span>
                  <span style={{ background: active ? "rgba(255,255,255,0.2)" : "var(--line)", color: active ? "#fff" : "var(--muted)", borderRadius: 12, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* ── MAIN CONTENT ── */}
          <div className="bs-my-orders-main">
            {/* HEADER */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 24, color: "var(--forest-dark)", margin: "0 0 4px" }}>Mes commandes</h1>
                <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>Suivez l'état de toutes vos commandes en temps réel.</p>
              </div>
            </div>

            {/* KPIs */}
            <div className="bs-my-orders-kpis">
              {[
                { label: "Total",      value: stats.total,    color: "var(--forest)", bg: "var(--forest-light)", Icon: ShoppingBag },
                { label: "En cours",   value: stats.enCours,  color: "#D97724",       bg: "#FDF4EB",             Icon: Clock },
                { label: "Livrées",    value: stats.livrees,  color: "#2B6CB0",       bg: "#EBF4FF",             Icon: CheckCircle },
                { label: "Annulées",   value: stats.annulees, color: "#B4483A",       bg: "#FDF2F0",             Icon: XCircle },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: kpi.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <kpi.Icon size={18} color={kpi.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>{kpi.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: kpi.color, lineHeight: 1.1 }}>{kpi.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* SEARCH */}
            <div style={{ position: "relative", marginBottom: 16 }}>
              <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input className="bs-input" style={{ paddingLeft: 42, borderRadius: 12, fontSize: 13.5, background: "#fff" }}
                placeholder="Rechercher une commande..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* LIST */}
            {filter === "demande_sur_mesure" ? (
              filteredCustomRequests.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", color: "var(--muted)", textAlign: "center", background: "#fff", borderRadius: 16, border: "1px solid var(--line)" }}>
                  <ClipboardList size={48} strokeWidth={1.2} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "var(--ink)" }}>Aucune demande sur-mesure trouvée</div>
                  <div style={{ fontSize: 12.5, marginBottom: 16 }}>Vous n'avez pas encore formulé de demande sur-mesure pour votre smartphone.</div>
                  <button onClick={() => navigate("/demande-sur-mesure")} className="bs-btn-primary" style={{ padding: "10px 20px", fontSize: 13 }}>
                    Faire une demande sur-mesure
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filteredCustomRequests.map(r => {
                    const badgeStyles = {
                      en_attente: { bg: "#EFF6FF", color: "#1D4ED8", label: "En cours d'examen" },
                      propose: { bg: "#FEF3C7", color: "#B45309", label: "Devis reçu - À valider" },
                      valide: { bg: "#DCFCE7", color: "#15803D", label: "Devis validé" },
                      refuse: { bg: "#FEE2E2", color: "#B91C1C", label: "Demande refusée" }
                    };
                    const b = badgeStyles[r.statut] || badgeStyles.en_attente;
                    const totalDevis = Number(r.totalPropose || 0) + Number(r.fraisLivraison || 0);

                    return (
                      <div
                        key={r.id}
                        onClick={() => navigate(`/demande/${r.code}`)}
                        className="bs-my-orders-card"
                        style={{ cursor: "pointer", borderLeft: `4px solid ${b.color}` }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB", flexShrink: 0 }}>
                              <ClipboardList size={22} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                                <span>Demande #{r.code}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", padding: "2px 8px", borderRadius: 8 }}>
                                  {r.modeleAppareil}
                                </span>
                              </div>
                              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                                Demandée le {new Date(r.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>

                          <span style={{ background: b.bg, color: b.color, padding: "4px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 800, flexShrink: 0 }}>
                            {b.label}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                          <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, paddingRight: 10 }}>
                            Articles : {r.articles?.map(a => `${a.nom} (x${a.quantite || 1})`).join(", ") || "Accessoires"}
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                            <div style={{ fontWeight: 900, fontSize: 15, color: "var(--forest-dark)" }}>
                              {totalDevis > 0 ? fcfa(totalDevis) : "Chiffrage en cours"}
                            </div>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "#2563EB" }}>
                              Consulter <ExternalLink size={14} />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : filtered.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", color: "var(--muted)", textAlign: "center", background: "#fff", borderRadius: 16, border: "1px solid var(--line)" }}>
                <PackageOpen size={48} strokeWidth={1.2} style={{ marginBottom: 12, opacity: 0.4 }} />
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "var(--ink)" }}>Aucune commande trouvée</div>
                <div style={{ fontSize: 12.5 }}>Essayez d'autres critères de recherche ou un autre filtre.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filtered.map(o => {
                  const cfg = STATUT_CONFIG[o.statut] || STATUT_CONFIG["en_attente"];
                  const isDelivery = o.modeLivraison === "domicile";
                  const isRecharge = o.typeVente === "recharge_mobile" || o.notes?.includes("recharge_mobile") || o.items?.some(it => it.product?.nom?.toLowerCase().includes("recharge"));
                  return (
                    <div key={o.id} onClick={() => { setSelected(o); window.scrollTo(0, 0); }} className="bs-my-orders-card">
                      {/* Product thumbnails + info row */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ display: "flex", flexShrink: 0 }}>
                            {isRecharge && (!o.items || o.items.length === 0) ? (
                              <div style={{ width: 44, height: 44, borderRadius: 10, background: "#E0F2FE", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                                <Smartphone size={20} color="#0284C7" />
                              </div>
                            ) : o.items?.slice(0, 3).map((it, idx) => (
                              <img key={it.id} src={it.product?.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=60&q=80"} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", marginLeft: idx > 0 ? -12 : 0, zIndex: 3 - idx }} />
                            ))}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--ink)" }}>{isRecharge ? "Recharge Mobile" : `Commande #${o.id}`}</div>
                            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                              {new Date(o.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                            </div>
                          </div>
                        </div>

                        <span style={{ background: cfg.bg, color: cfg.color, padding: "4px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>
                          {cfg.label}
                        </span>
                      </div>

                      {/* Articles summary + price row */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, paddingRight: 10 }}>
                          {isRecharge ? "Recharge de crédit direct" : `${isDelivery ? "Livraison domicile" : "Retrait boutique"} · ${o.items?.length} article${o.items?.length > 1 ? "s" : ""}`}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                          {(() => {
                            const firstItem = o.items?.[0];
                            const targetP = firstItem?.product || (firstItem?.productId ? { id: firstItem.productId, nom: firstItem.nom || "Produit", imageUrl: firstItem.imageUrl } : null);
                            const canRev = ["recuperee", "livree"].includes(o.statut);
                            if (!canRev || !targetP) return null;
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  openReviewModal(targetP, o.id);
                                }}
                                style={{
                                  background: "#FEF3C7",
                                  color: "#B45309",
                                  border: "1px solid #F59E0B",
                                  borderRadius: 20,
                                  padding: "4px 12px",
                                  fontWeight: 700,
                                  fontSize: 12,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  position: "relative",
                                  zIndex: 10
                                }}
                              >
                                <Star size={13} fill="#B45309" /> Laisser un avis
                              </button>
                            );
                          })()}
                          <div style={{ fontWeight: 900, fontSize: 16, color: "var(--forest-dark)" }}>{fcfa(o.total)}</div>
                          <ChevronRight size={18} color="var(--muted)" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* REÇU FACTURE MODAL */}
      {receiptOrder && (
        <ReceiptModal
          order={receiptOrder}
          boutique={boutique}
          onClose={() => setReceiptOrder(null)}
        />
      )}

      {/* APERÇU DE LA CAPTURE DE TRANSACTION */}
      {previewCaptureModal && (
        <div 
          onClick={() => setPreviewCaptureModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh", background: "#fff", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)" }}>Capture de paiement transmise</span>
              <button onClick={() => setPreviewCaptureModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: 12, overflow: "auto", display: "flex", justifyContent: "center" }}>
              <img src={previewCaptureModal} alt="Capture de paiement" style={{ maxWidth: "100%", maxHeight: "75vh", objectFit: "contain", borderRadius: 8 }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
