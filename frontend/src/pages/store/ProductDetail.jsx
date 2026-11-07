import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { ArrowLeft, Tag, Star, ShoppingBag, CheckCircle, Heart, Minus, Plus, Search, AlertTriangle, ChevronLeft, ChevronRight, Smartphone, Check } from "lucide-react";
import api, { SLUG } from "../../api";
import Stars from "../../components/Stars.jsx";
import ProductCard from "../../components/ProductCard.jsx";
import { useCart } from "../../context/CartContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";
import { Skel } from "../../components/Skeleton.jsx";
import { readCache, writeCache } from "../../utils/swrCache.js";

import { formatPrice as fcfa, getActiveCurrency } from "../../utils/currency.js";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, addToCart, showToast } = useCart();
  const { user } = useAuth();
  
  // Currency state
  const [activeCurrency, setActiveCurrencyState] = useState(() => getActiveCurrency());
  useEffect(() => {
    const handleCurr = (e) => setActiveCurrencyState(e.detail);
    window.addEventListener("currency_changed", handleCurr);
    return () => window.removeEventListener("currency_changed", handleCurr);
  }, []);

  // Instant render using passed state from ProductCard, fallback to null
  const [product, setProduct] = useState(() => location.state?.product || readCache(`product:${id}`) || null);
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);
  const [reviewDraft, setReviewDraft] = useState({ note: 5, commentaire: "" });
  const [erreur, setErreur] = useState("");
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [related, setRelated] = useState([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [hasPurchasedProduct, setHasPurchasedProduct] = useState(false);

  // Parse JSON helper
  const parseJsonSafe = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      try { return JSON.parse(val); } catch (e) { return []; }
    }
    return [];
  };

  const couleursList = useMemo(() => parseJsonSafe(product?.couleurs), [product?.couleurs]);
  const senteursList = useMemo(() => parseJsonSafe(product?.senteurs), [product?.senteurs]);
  const modelesList = useMemo(() => parseJsonSafe(product?.modelesCompatibles), [product?.modelesCompatibles]);
  const extraImages = useMemo(() => parseJsonSafe(product?.images), [product?.images]);

  // Variant states
  const [selectedCouleur, setSelectedCouleur] = useState(null);
  const [selectedSenteur, setSelectedSenteur] = useState(null);
  const [selectedModele, setSelectedModele] = useState(null);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState("all");
  const [missingSelectionAlert, setMissingSelectionAlert] = useState(false);

  // Sync default color & senteur on product load
  useEffect(() => {
    if (couleursList && couleursList.length > 0) {
      setSelectedCouleur(couleursList[0]);
    } else {
      setSelectedCouleur(null);
    }
    if (senteursList && senteursList.length > 0) {
      setSelectedSenteur(senteursList[0]);
    } else {
      setSelectedSenteur(null);
    }
    setSelectedModele(null);
    setMissingSelectionAlert(false);
    setSelectedImgIndex(0);
  }, [product?.id]);

  useEffect(() => {
    if (user) {
      api.get(`/store/${SLUG}/orders/mine`)
        .then((res) => {
          const orders = res.data || [];
          const bought = orders.some((order) => {
            const isCompleted = order.statut === "recuperee" || order.statut === "livree";
            if (!isCompleted) return false;
            return order.items?.some((it) => {
              const pid = it.product?.id || it.productId || it.product_id;
              return Number(pid) === Number(id);
            });
          });
          setHasPurchasedProduct(bought);
        })
        .catch(() => setHasPurchasedProduct(false));
    } else {
      setHasPurchasedProduct(false);
    }
  }, [user, id]);

  // Scroll to top immediately on navigate
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // Hover zoom state
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [isZoomed, setIsZoomed] = useState(false);

  const getFavKey = () => (user && user.id ? `favorites_user_${user.id}` : "favorites_guest");

  useEffect(() => {
    const key = getFavKey();
    const favs = JSON.parse(localStorage.getItem(key) || "[]");
    if (favs.includes(Number(id))) setIsFavorite(true);
    else setIsFavorite(false);
  }, [id, user?.id]);

  function toggleFavorite() {
    const key = getFavKey();
    let favs = JSON.parse(localStorage.getItem(key) || "[]");
    if (isFavorite) {
      favs = favs.filter(fid => fid !== Number(id));
      setIsFavorite(false);
      showToast(`"${product?.nom || 'Produit'}" retiré de vos favoris.`, "info", "Favoris");
    } else {
      favs.push(Number(id));
      setIsFavorite(true);
      showToast(`"${product?.nom || 'Produit'}" ajouté à vos favoris !`, "success");
    }
    localStorage.setItem(key, JSON.stringify(favs));
    window.dispatchEvent(new Event("favorites_updated"));
  }

  const sliderRef = useRef(null);

  function load() {
    api.get(`/store/${SLUG}/products/${id}`).then((res) => {
      setProduct(res.data);
      writeCache(`product:${id}`, res.data);
      if (res.data.categoryId) {
        api.get(`/store/${SLUG}/products?categoryId=${res.data.categoryId}`).then(r => {
          setRelated(r.data.filter(p => p.id !== res.data.id).slice(0, 10));
        }).catch(() => {});
      }
    }).catch(() => {});
  }

  const scrollSlider = (direction) => {
    if (sliderRef.current) {
      const scrollAmount = direction === "left" ? -300 : 300;
      sliderRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  useEffect(() => {
    load();
    const unsub = subscribeRealtime((detail) => {
      if (detail.type === "product_updated") {
        load();
      }
    });
    return unsub;
  }, [id]);

  async function submitReview() {
    setErreur("");
    try {
      await api.post(`/store/${SLUG}/products/${id}/reviews`, reviewDraft);
      setReviewDraft({ note: 5, commentaire: "" });
      load();
    } catch (err) {
      setErreur(err.response?.data?.message || "Impossible d'envoyer l'avis.");
    }
  }

  function handleMouseMove(e) {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - left) / width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - top) / height) * 100));
    setZoomPos({ x, y });
  }

  if (!product) return (
    <div className="container" role="status" aria-label="Chargement" style={{ minHeight: "75vh", padding: "32px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
      <Skel h={420} r={18} />
      <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
        <Skel w="70%" h={28} />
        <Skel w="30%" h={14} />
        <Skel w="40%" h={30} />
        <Skel h={12} /><Skel h={12} /><Skel w="80%" h={12} />
        <Skel w="60%" h={48} r={14} style={{ marginTop: 12 }} />
      </div>
    </div>
  );

  // Build full gallery of images
  const images = [];
  if (product.imageUrl) images.push(product.imageUrl);
  if (product.imageUrl2 && !images.includes(product.imageUrl2)) images.push(product.imageUrl2);
  extraImages.forEach(img => {
    if (img && typeof img === "string" && !images.includes(img)) images.push(img);
  });
  couleursList.forEach(c => {
    if (c.imageUrl && !images.includes(c.imageUrl)) images.push(c.imageUrl);
  });
  senteursList.forEach(s => {
    if (s.imageUrl && !images.includes(s.imageUrl)) images.push(s.imageUrl);
  });
  if (images.length === 0) {
    images.push("https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=800&q=80");
  }

  function handleSelectSenteur(senteur) {
    setSelectedSenteur(senteur);
    if (!senteur) return;
    if (senteur.imageUrl) {
      let targetIdx = images.findIndex(img => String(img).trim() === String(senteur.imageUrl).trim());
      if (targetIdx !== -1) {
        setSelectedImgIndex(targetIdx);
      } else {
        images.push(senteur.imageUrl);
        setSelectedImgIndex(images.length - 1);
      }
    }
  }

  function handleSelectColor(color) {
    setSelectedCouleur(color);
    if (!color) return;

    const colorNom = (color.nom || "").trim().toLowerCase();
    const colorImg = (color.imageUrl || "").trim();

    // 1. Chercher par URL d'image exacte
    let targetIdx = -1;
    if (colorImg) {
      targetIdx = images.findIndex(img => String(img).trim() === colorImg);
    }

    // 2. Chercher si le nom de couleur ou ses synonymes apparaissent dans l'URL de l'image
    if (targetIdx === -1 && colorNom) {
      const colorSynonyms = {
        noir: ["noir", "black", "dark"],
        bleu: ["bleu", "blue", "navy", "cyan"],
        rose: ["rose", "pink"],
        blanc: ["blanc", "white"],
        rouge: ["rouge", "red"],
        vert: ["vert", "green"],
        gris: ["gris", "grey", "gray", "silver"],
        jaune: ["jaune", "yellow"],
        violet: ["violet", "purple"],
        or: ["or", "gold"]
      };

      let searchTerms = [colorNom];
      for (const [k, syns] of Object.entries(colorSynonyms)) {
        if (syns.some(s => colorNom.includes(s))) {
          searchTerms = syns;
          break;
        }
      }

      targetIdx = images.findIndex(img => {
        const lower = String(img).toLowerCase();
        return searchTerms.some(term => lower.includes(term));
      });
    }

    if (targetIdx !== -1) {
      setSelectedImgIndex(targetIdx);
    } else if (colorImg) {
      images.push(colorImg);
      setSelectedImgIndex(images.length - 1);
    }
  }

  function handleSelectThumbnail(idx, imgUrl) {
    setSelectedImgIndex(idx);
    if (!imgUrl || couleursList.length === 0) return;

    const cleanImg = String(imgUrl).trim().toLowerCase();

    // 1. Correspondance exacte sur l'URL d'image de la couleur
    let matched = couleursList.find(c => c.imageUrl && String(c.imageUrl).trim() === String(imgUrl).trim());

    // 2. Correspondance si le nom de la couleur est dans l'URL de l'image
    if (!matched) {
      matched = couleursList.find(c => {
        if (!c.nom) return false;
        const cNom = c.nom.trim().toLowerCase();
        return cNom.length >= 3 && cleanImg.includes(cNom);
      });
    }

    // 3. Correspondance par synonymes de couleur (ex: black -> noir)
    if (!matched) {
      const colorKeywords = [
        { key: "noir", syns: ["noir", "black", "dark"] },
        { key: "bleu", syns: ["bleu", "blue", "cyan", "navy"] },
        { key: "rose", syns: ["rose", "pink"] },
        { key: "blanc", syns: ["blanc", "white"] },
        { key: "rouge", syns: ["rouge", "red"] },
        { key: "vert", syns: ["vert", "green"] },
        { key: "gris", syns: ["gris", "grey", "gray", "silver"] },
        { key: "or", syns: ["or", "gold"] },
        { key: "violet", syns: ["violet", "purple"] }
      ];
      for (const ck of colorKeywords) {
        if (ck.syns.some(s => cleanImg.includes(s))) {
          matched = couleursList.find(c => {
            const nom = (c.nom || "").trim().toLowerCase();
            return ck.syns.some(s => nom.includes(s));
          });
          if (matched) break;
        }
      }
    }

    if (matched) {
      setSelectedCouleur(matched);
    } else if (senteursList.length > 0) {
      const matchedSenteur = senteursList.find(s => s.imageUrl && String(s.imageUrl).trim() === String(imgUrl).trim());
      if (matchedSenteur) {
        setSelectedSenteur(matchedSenteur);
      }
    }
  }

  // Brands extracted from compatible models
  const availableBrands = Array.from(new Set(modelesList.map(m => m.brandNom).filter(Boolean)));
  const filteredModeles = selectedBrandFilter === "all" || availableBrands.length <= 1
    ? modelesList
    : modelesList.filter(m => m.brandNom === selectedBrandFilter);

  // Dynamic pricing calculation
  const isSenegal = activeCurrency === "FCFA";
  const regularBase = isSenegal && product.prixSenegal && Number(product.prixSenegal) > 0
    ? Number(product.prixSenegal)
    : Number(product.prix);

  const promoBase = isSenegal && product.prixPromoSenegal && Number(product.prixPromoSenegal) > 0
    ? Number(product.prixPromoSenegal)
    : (!isSenegal && product.prixPromo ? Number(product.prixPromo) : null);

  const basePrice = promoBase || regularBase;
  let currentPrice = basePrice;
  let isCustomVariantPrice = false;

  const modelePrice = selectedModele ? (isSenegal ? selectedModele.prixFCFA : selectedModele.prixKMF) : null;
  const couleurPrice = selectedCouleur ? (isSenegal ? selectedCouleur.prixFCFA : selectedCouleur.prixKMF) : null;
  const senteurPrice = selectedSenteur ? (isSenegal ? selectedSenteur.prixFCFA : selectedSenteur.prixKMF) : null;

  if (modelePrice && Number(modelePrice) > 0) {
    currentPrice = Number(modelePrice);
    isCustomVariantPrice = Number(modelePrice) !== Number(basePrice);
  } else if (couleurPrice && Number(couleurPrice) > 0) {
    currentPrice = Number(couleurPrice);
    isCustomVariantPrice = Number(couleurPrice) !== Number(basePrice);
  } else if (senteurPrice && Number(senteurPrice) > 0) {
    currentPrice = Number(senteurPrice);
    isCustomVariantPrice = Number(senteurPrice) !== Number(basePrice);
  }

  // Helper pour lire le stock spécifique d'une variante
  function getVariantStock(v) {
    if (!v) return null;
    if (v.quantite !== undefined && v.quantite !== null && v.quantite !== "") return Number(v.quantite);
    if (v.stock !== undefined && v.stock !== null && v.stock !== "") return Number(v.stock);
    return null;
  }

  const selectedColorStock = getVariantStock(selectedCouleur);
  const isSelectedColorOutOfStock = selectedColorStock !== null && selectedColorStock <= 0;

  const selectedSenteurStock = getVariantStock(selectedSenteur);
  const isSelectedSenteurOutOfStock = selectedSenteurStock !== null && selectedSenteurStock <= 0;

  const selectedModeleStock = getVariantStock(selectedModele);
  const isSelectedModeleOutOfStock = selectedModeleStock !== null && selectedModeleStock <= 0;

  const isAnySelectedVariantOutOfStock = isSelectedColorOutOfStock || isSelectedSenteurOutOfStock || isSelectedModeleOutOfStock;

  // Détail du stock spécifique pour la combinaison sélectionnée
  const activeVariantParts = [];
  let minVariantStock = null;

  if (selectedModele) {
    const mName = selectedModele.nomComplet || `${selectedModele.brandNom ? `${selectedModele.brandNom} ` : ''}${selectedModele.nom}`.trim();
    if (selectedModeleStock !== null) {
      activeVariantParts.push(mName);
      minVariantStock = minVariantStock === null ? selectedModeleStock : Math.min(minVariantStock, selectedModeleStock);
    } else {
      activeVariantParts.push(mName);
    }
  }

  if (selectedCouleur) {
    if (selectedColorStock !== null) {
      activeVariantParts.push(selectedCouleur.nom);
      minVariantStock = minVariantStock === null ? selectedColorStock : Math.min(minVariantStock, selectedColorStock);
    } else {
      activeVariantParts.push(selectedCouleur.nom);
    }
  }

  if (selectedSenteur) {
    if (selectedSenteurStock !== null) {
      activeVariantParts.push(selectedSenteur.nom);
      minVariantStock = minVariantStock === null ? selectedSenteurStock : Math.min(minVariantStock, selectedSenteurStock);
    } else {
      activeVariantParts.push(selectedSenteur.nom);
    }
  }

  const isVariantSpecific = minVariantStock !== null;
  const displayStock = isVariantSpecific
    ? Math.min(minVariantStock, Number(product.stock ?? 0))
    : Number(product.stock ?? 0);

  const activeVariantLabel = activeVariantParts.join(" · ");

  // Clé pour vérifier la quantité déjà dans le panier
  const activeModelLabel = selectedModele ? (selectedModele.nomComplet || `${selectedModele.brandNom || ''} ${selectedModele.nom}`.trim()) : null;
  const activeColorLabel = selectedCouleur?.nom || null;
  const activeSenteurLabel = selectedSenteur?.nom || null;
  const itemKey = `${product.id}_${activeModelLabel || ''}_${activeColorLabel || (activeSenteurLabel ? `${product.typeVarianteNom || 'Senteur'}: ${activeSenteurLabel}` : '')}`;

  const variantInCart = cart
    .filter(l => (l.cartKey || `${l.product?.id}_${l.selectedModele || ''}_${l.selectedCouleur || ''}`) === itemKey)
    .reduce((s, l) => s + l.quantite, 0);

  const totalInCart = cart
    .filter(l => l.product?.id === product.id)
    .reduce((s, l) => s + l.quantite, 0);

  let stockDisponible = Math.max(0, displayStock - variantInCart);
  stockDisponible = Math.min(stockDisponible, Math.max(0, (product.stock ?? 0) - totalInCart));

  const isMaxStockReached = displayStock > 0 && stockDisponible <= 0;

  function handleAddToCart() {
    if (!product) return;
    if (product.stock <= 0) {
      showToast(`Désolé, le produit "${product.nom}" est actuellement en rupture de stock.`, "warning");
      return;
    }

    if (isAnySelectedVariantOutOfStock) {
      let msg = "Cette variante est actuellement en rupture de stock. Veuillez choisir une autre variante.";
      if (isSelectedColorOutOfStock) msg = `Le coloris "${selectedCouleur?.nom}" est actuellement épuisé. Veuillez choisir une autre couleur disponible.`;
      else if (isSelectedSenteurOutOfStock) msg = `${product.typeVarianteNom || 'La senteur'} "${selectedSenteur?.nom}" est actuellement épuisée. Veuillez choisir une autre variante disponible.`;
      else if (isSelectedModeleOutOfStock) msg = `Le modèle "${selectedModele?.nomComplet || selectedModele?.nom}" est actuellement épuisé. Veuillez choisir un autre modèle disponible.`;
      showToast(msg, "warning");
      return;
    }

    if (modelesList.length > 0 && !selectedModele) {
      setMissingSelectionAlert(true);
      showToast("Veuillez sélectionner votre modèle de téléphone avant d'ajouter au panier.", "warning");
      const el = document.getElementById("phone-models-selector");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setMissingSelectionAlert(false);

    const modelLabel = selectedModele ? (selectedModele.nomComplet || `${selectedModele.brandNom || ''} ${selectedModele.nom}`.trim()) : null;
    const colorLabel = selectedCouleur?.nom || null;
    const colorHex = selectedCouleur?.codeHex || null;
    const senteurLabel = selectedSenteur?.nom || null;
    const brandLabel = selectedModele?.brandNom || null;
    const activeImage = images[selectedImgIndex] || product.imageUrl;

    const ok = addToCart(product, quantity, {
      selectedModele: modelLabel,
      selectedCouleur: colorLabel || (senteurLabel ? `${product.typeVarianteNom || 'Senteur'}: ${senteurLabel}` : null),
      selectedCouleurHex: colorHex,
      selectedSenteur: senteurLabel,
      typeVarianteNom: product.typeVarianteNom || 'Senteur',
      marqueTelephone: brandLabel,
      selectedImageUrl: selectedSenteur?.imageUrl || selectedCouleur?.imageUrl || activeImage,
      selectedPriceKMF: (!isSenegal && isCustomVariantPrice) ? currentPrice : null,
      selectedPriceFCFA: (isSenegal && isCustomVariantPrice) ? currentPrice : null,
      stockVariante: isVariantSpecific ? displayStock : null
    });

    if (ok) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
      setQuantity(1);
    }
  }

  function incrementQty() {
    if (quantity < stockDisponible) setQuantity(q => q + 1);
  }
  function decrementQty() {
    if (quantity > 1) setQuantity(q => q - 1);
  }

  const noteMoyenne = product.avis?.length
    ? product.avis.reduce((s, a) => s + a.note, 0) / product.avis.length 
    : (product.noteEtoiles !== undefined && product.noteEtoiles !== null ? Number(product.noteEtoiles) : 5.0);

  const handleBack = () => {
    // 1. URL passée dans le state (ex: /catalogue?categoryId=1&famille=Chargeurs)
    if (location.state?.from && location.state.from !== location.pathname) {
      navigate(location.state.from);
      return;
    }
    // 2. Dernier filtre de catalogue enregistré en session
    const savedUrl = sessionStorage.getItem("last_catalogue_url");
    if (savedUrl && savedUrl !== location.pathname) {
      navigate(savedUrl);
      return;
    }
    // 3. Repli dynamique sur la catégorie et sous-catégorie de l'article
    if (product?.categoryId) {
      const q = new URLSearchParams();
      q.set("categoryId", product.categoryId);
      if (product.famille) q.set("famille", product.famille);
      navigate(`/catalogue?${q.toString()}`);
      return;
    }
    // 4. Repli catalogue général
    navigate("/catalogue");
  };

  return (
    <div style={{ minHeight: "75vh" }}>
      <button className="bs-back" onClick={handleBack}>
        <ArrowLeft size={16} /> Retour
      </button>

      <div className="bs-detail">
        {/* GALERIE D'IMAGES AVEC HOVER ZOOM */}
        <div className="bs-gallery">
          <div 
            className="bs-zoom-wrapper"
            onMouseEnter={() => setIsZoomed(true)}
            onMouseLeave={() => setIsZoomed(false)}
            onMouseMove={handleMouseMove}
          >
            <img 
              src={images[selectedImgIndex] || images[0]} 
              alt={product.nom} 
              className="bs-main-image"
              style={{
                transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                transform: isZoomed ? "scale(2.2)" : "scale(1)"
              }} 
            />
            <div className="bs-zoom-badge">
              <Search size={13} /> Survolez pour zoomer
            </div>
          </div>

          {images.length > 1 && (
            <div className="bs-thumbs">
              {images.map((img, idx) => (
                <img 
                  key={idx}
                  src={img} 
                  alt={`Vignette ${idx + 1}`} 
                  className={`bs-gallery-thumb ${idx === selectedImgIndex ? "active" : ""}`}
                  onClick={() => handleSelectThumbnail(idx, img)} 
                />
              ))}
            </div>
          )}

          {/* ── SELECTEUR DE COULEURS (SOUS LES PHOTOS) ── */}
          {couleursList.length > 0 && (
            <div style={{ marginTop: 14, padding: "14px 16px", background: "var(--card)", borderRadius: 16, border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Couleur : <strong style={{ color: isSelectedColorOutOfStock ? "#DC2626" : "var(--forest)", textTransform: "none", fontSize: 14 }}>{selectedCouleur?.nom || "Choisir une couleur"}</strong>
                </span>
                {selectedCouleur && selectedColorStock !== null && (
                  <span style={{
                    fontSize: 11.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10,
                    background: isSelectedColorOutOfStock ? "#FEE2E2" : "#ECFDF5",
                    color: isSelectedColorOutOfStock ? "#DC2626" : "#047857",
                    border: isSelectedColorOutOfStock ? "1px solid #FCA5A5" : "1px solid #A7F3D0"
                  }}>
                    {isSelectedColorOutOfStock ? "Rupture de stock" : `${selectedColorStock} disponible(s)`}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {couleursList.map((c, idx) => {
                  const isSelected = selectedCouleur?.nom === c.nom;
                  const cStock = getVariantStock(c);
                  const isOutOfStock = cStock !== null && cStock <= 0;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        handleSelectColor(c);
                        if (isOutOfStock) {
                          showToast(`Le coloris "${c.nom}" est actuellement en rupture de stock. Veuillez choisir un autre coloris disponible.`, "warning");
                        }
                      }}
                      title={isOutOfStock ? `${c.nom} (Épuisé)` : (cStock !== null ? `${c.nom} (${cStock} en stock)` : c.nom)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: c.imageUrl ? "4px 10px 4px 4px" : "6px 12px",
                        borderRadius: 24,
                        border: isSelected
                          ? (isOutOfStock ? "2px solid #EF4444" : "2px solid var(--forest)")
                          : (isOutOfStock ? "1.5px dashed #CBD5E1" : "1.5px solid var(--line)"),
                        background: isSelected
                          ? (isOutOfStock ? "#FEF2F2" : "var(--forest-light)")
                          : (isOutOfStock ? "#F1F5F9" : "#fff"),
                        opacity: isOutOfStock ? 0.65 : 1,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        boxShadow: isSelected ? (isOutOfStock ? "0 2px 8px rgba(239, 68, 68, 0.2)" : "0 2px 8px rgba(31, 77, 58, 0.15)") : "none"
                      }}
                    >
                      {c.imageUrl ? (
                        <img 
                          src={c.imageUrl} 
                          alt={c.nom} 
                          style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1px solid #E5E7EB", filter: isOutOfStock ? "grayscale(80%)" : "none" }} 
                        />
                      ) : (
                        <span 
                          style={{ 
                            width: 20, height: 20, borderRadius: "50%", 
                            backgroundColor: c.codeHex || "#9CA3AF", 
                            border: "1.5px solid rgba(0,0,0,0.15)",
                            display: "inline-flex", alignItems: "center", justifyContent: "center"
                          }} 
                        >
                          {isSelected && <Check size={12} color={c.codeHex && c.codeHex.toLowerCase() === "#ffffff" ? "#000" : "#fff"} strokeWidth={3} />}
                        </span>
                      )}
                      <span style={{ fontSize: 13, fontWeight: isSelected ? 800 : 600, color: isSelected ? (isOutOfStock ? "#B91C1C" : "var(--forest-dark)") : (isOutOfStock ? "#94A3B8" : "var(--ink)"), textDecoration: isOutOfStock ? "line-through" : "none" }}>
                        {c.nom}
                      </span>
                      {isOutOfStock ? (
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#DC2626", background: "#FEE2E2", padding: "1px 6px", borderRadius: 10 }}>
                          Épuisé
                        </span>
                      ) : cStock !== null ? (
                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: isSelected ? "var(--forest-dark)" : "#059669",
                          background: isSelected ? "rgba(255,255,255,0.85)" : "#ECFDF5",
                          padding: "1px 6px",
                          borderRadius: 8,
                          border: isSelected ? "1px solid rgba(0,0,0,0.1)" : "1px solid #A7F3D0"
                        }}>
                          {cStock} dispo
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── SELECTEUR DE SENTEURS / FRAGRANCES (SOUS LES PHOTOS) ── */}
          {senteursList.length > 0 && (
            <div style={{ marginTop: 14, padding: "14px 16px", background: "var(--card)", borderRadius: 16, border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {product.typeVarianteNom || "Senteur"} : <strong style={{ color: isSelectedSenteurOutOfStock ? "#DC2626" : "var(--forest)", textTransform: "none", fontSize: 14 }}>{selectedSenteur?.nom || `Choisir un(e) ${product.typeVarianteNom || "senteur"}`}</strong>
                </span>
                {selectedSenteur && selectedSenteurStock !== null && (
                  <span style={{
                    fontSize: 11.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10,
                    background: isSelectedSenteurOutOfStock ? "#FEE2E2" : "#ECFDF5",
                    color: isSelectedSenteurOutOfStock ? "#DC2626" : "#047857",
                    border: isSelectedSenteurOutOfStock ? "1px solid #FCA5A5" : "1px solid #A7F3D0"
                  }}>
                    {isSelectedSenteurOutOfStock ? "Rupture de stock" : `${selectedSenteurStock} disponible(s)`}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {senteursList.map((s, idx) => {
                  const isSelected = selectedSenteur?.nom === s.nom;
                  const sStock = getVariantStock(s);
                  const isOutOfStock = sStock !== null && sStock <= 0;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        handleSelectSenteur(s);
                        if (isOutOfStock) {
                          showToast(`La variante "${s.nom}" est actuellement en rupture de stock. Veuillez choisir une autre variante disponible.`, "warning");
                        }
                      }}
                      title={isOutOfStock ? `${s.nom} (Épuisé)` : (sStock !== null ? `${s.nom} (${sStock} en stock)` : s.nom)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: s.imageUrl ? "4px 12px 4px 5px" : "8px 14px",
                        borderRadius: 24,
                        border: isSelected
                          ? (isOutOfStock ? "2px solid #EF4444" : "2px solid var(--forest)")
                          : (isOutOfStock ? "1.5px dashed #CBD5E1" : "1.5px solid var(--line)"),
                        background: isSelected
                          ? (isOutOfStock ? "#FEF2F2" : "var(--forest-light)")
                          : (isOutOfStock ? "#F1F5F9" : "#fff"),
                        opacity: isOutOfStock ? 0.65 : 1,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        boxShadow: isSelected ? (isOutOfStock ? "0 2px 8px rgba(239, 68, 68, 0.2)" : "0 2px 8px rgba(31, 77, 58, 0.15)") : "none"
                      }}
                    >
                      {s.imageUrl && (
                        <img 
                          src={s.imageUrl} 
                          alt={s.nom} 
                          style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", border: "1px solid #E5E7EB", filter: isOutOfStock ? "grayscale(80%)" : "none" }} 
                        />
                      )}
                      <span style={{ fontSize: 13, fontWeight: isSelected ? 800 : 600, color: isSelected ? (isOutOfStock ? "#B91C1C" : "var(--forest-dark)") : (isOutOfStock ? "#94A3B8" : "var(--ink)"), textDecoration: isOutOfStock ? "line-through" : "none" }}>
                        {s.nom}
                      </span>
                      {isOutOfStock ? (
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#DC2626", background: "#FEE2E2", padding: "1px 6px", borderRadius: 10 }}>
                          Épuisé
                        </span>
                      ) : sStock !== null ? (
                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: isSelected ? "var(--forest-dark)" : "#059669",
                          background: isSelected ? "rgba(255,255,255,0.85)" : "#ECFDF5",
                          padding: "1px 6px",
                          borderRadius: 8,
                          border: isSelected ? "1px solid rgba(0,0,0,0.1)" : "1px solid #A7F3D0"
                        }}>
                          {sStock} dispo
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* INFOS PRODUIT */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ color: "var(--sage)", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {product.Category?.nom || "Accessoires Téléphonie"}
            </span>

            {(product.marque?.nom || product.Marque?.nom) && (
              <span style={{ 
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#EFF6FF", color: "#1D4ED8", 
                padding: "3px 12px", borderRadius: 12, fontSize: 12.5, fontWeight: 800,
                border: "1px solid #BFDBFE"
              }}>
                {(product.marque?.logoUrl || product.Marque?.logoUrl) && (
                  <img src={product.marque?.logoUrl || product.Marque?.logoUrl} alt="" style={{ width: 16, height: 16, objectFit: "contain" }} />
                )}
                Marque officielle : {product.marque?.nom || product.Marque?.nom}
              </span>
            )}

            <span style={{ 
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "#F0FDF4", color: "#166534", border: "1.5px solid #BBF7D0",
              padding: "3px 12px", borderRadius: 12, fontSize: 12, fontWeight: 800 
            }}>
              Garantie 100% Neuf & Testé
            </span>
          </div>

          <h1 style={{ fontSize: 30, margin: "0 0 12px", color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 12, lineHeight: 1.25 }}>
            {product.nom}
            <button onClick={toggleFavorite} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}>
              <Heart size={26} color={isFavorite ? "#B4483A" : "var(--muted)"} fill={isFavorite ? "#B4483A" : "none"} />
            </button>
          </h1>

          <div className="bs-rating" style={{ marginBottom: 16 }}>
            <Stars note={noteMoyenne} size={18} /> 
            <span style={{ fontWeight: 600, color: "var(--ink)", fontSize: 16 }}>{noteMoyenne.toFixed(1)}</span>
            <span style={{ fontSize: 14 }}>· {product.avis?.length || 0} avis client(s)</span>
          </div>

          {/* STOCK BADGES DYNAMIQUES PAR VARIANTE */}
          {(product.stock <= 0 || (isVariantSpecific && displayStock <= 0) || isAnySelectedVariantOutOfStock) ? (
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 16px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 16,
              background: "#FEE2E2",
              color: "#DC2626",
              border: "1.5px solid #FCA5A5"
            }}>
              <AlertTriangle size={16} />
              <span>
                Rupture de stock
                {activeVariantLabel ? ` · ${activeVariantLabel} épuisé(e)` : ""}
              </span>
            </div>
          ) : isMaxStockReached ? (
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 16px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 16,
              background: "#FEF3C7",
              color: "#B45309",
              border: "1px solid #F59E0B"
            }}>
              <AlertTriangle size={15} />
              <span>
                Stock maximal dans votre panier ({variantInCart}/{displayStock} restants
                {activeVariantLabel ? ` pour ${activeVariantLabel}` : ""})
              </span>
            </div>
          ) : (
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 16px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 16,
              background: "rgba(31, 77, 58, 0.08)",
              color: "var(--forest)",
              border: "1px solid rgba(31, 77, 58, 0.2)"
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#059669",
                display: "inline-block",
                boxShadow: "0 0 0 3px rgba(5, 150, 105, 0.2)"
              }} />
              <span>
                En stock : <strong style={{ color: "var(--forest-dark)", fontSize: 14 }}>{displayStock} {product.unite || "pièce(s)"} restante(s)</strong>
                {activeVariantLabel ? (
                  <span style={{ marginLeft: 6, color: "var(--forest-dark)", fontWeight: 700 }}>
                    ({activeVariantLabel})
                  </span>
                ) : null}
                {isVariantSpecific && Number(product.stock) > displayStock ? (
                  <span style={{ marginLeft: 6, opacity: 0.65, fontWeight: 500, fontSize: 12 }}>
                    · Stock total boutique : {product.stock}
                  </span>
                ) : null}
                {variantInCart > 0 ? (
                  <span style={{ marginLeft: 6, color: "var(--ink)", fontWeight: 600 }}>
                    · {variantInCart} déjà au panier
                  </span>
                ) : null}
              </span>
            </div>
          )}

          {/* PRIX DYNAMIQUE */}
          <div className="bs-price-row" style={{ fontSize: 24, marginBottom: 18 }}>
            {promoBase && !isCustomVariantPrice ? (
              <>
                <span className="bs-price barre" style={{ fontSize: 20, color: "var(--muted)", textDecoration: "line-through" }}>
                  {fcfa(regularBase, activeCurrency)}
                </span>
                <span className="bs-price" style={{ fontSize: 32, color: "#B4483A", fontWeight: 900 }}>
                  {fcfa(currentPrice, activeCurrency)}
                </span>
              </>
            ) : (
              <span className="bs-price" style={{ fontSize: 32, fontWeight: 900, color: "var(--forest-dark)" }}>
                {fcfa(currentPrice, activeCurrency)}
              </span>
            )}
            {product.unite && (
              <span style={{ color: "var(--muted)", fontSize: 15, fontWeight: 600 }}>
                / {product.unite}
              </span>
            )}
          </div>

          {/* ── SELECTEUR DE MODÈLES DE TÉLÉPHONES (STYLE SHEIN / ALIEXPRESS) ── */}
          {modelesList.length > 0 && (
            <div 
              id="phone-models-selector"
              style={{ 
                marginBottom: 24, 
                padding: "16px", 
                background: missingSelectionAlert ? "#FEF2F2" : "var(--card)", 
                borderRadius: 16, 
                border: missingSelectionAlert ? "2px solid #EF4444" : "1px solid var(--line)",
                transition: "all 0.25s"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: missingSelectionAlert ? "#B91C1C" : "var(--ink)", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
                  <Smartphone size={16} color={missingSelectionAlert ? "#DC2626" : "var(--forest)"} />
                  Modèle de smartphone :
                  <strong style={{ color: missingSelectionAlert ? "#DC2626" : "var(--forest)", textTransform: "none", fontSize: 14 }}>
                    {selectedModele ? (selectedModele.nomComplet || `${selectedModele.brandNom || ''} ${selectedModele.nom}`.trim()) : "Obligatoire"}
                  </strong>
                </span>
                {selectedModele && selectedModeleStock !== null && (
                  <span style={{
                    fontSize: 11.5,
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: selectedModeleStock <= 0 ? "#FEE2E2" : "#ECFDF5",
                    color: selectedModeleStock <= 0 ? "#DC2626" : "#047857",
                    border: selectedModeleStock <= 0 ? "1px solid #FCA5A5" : "1px solid #A7F3D0"
                  }}>
                    {selectedModeleStock <= 0 ? "Rupture de stock" : `${selectedModeleStock} disponible(s)`}
                  </span>
                )}
                {missingSelectionAlert && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#DC2626" }}>
                    Veuillez choisir un modèle
                  </span>
                )}
              </div>

              {/* Brand filter tabs if multiple brands */}
              {availableBrands.length > 1 && (
                <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                  <button
                    type="button"
                    onClick={() => setSelectedBrandFilter("all")}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 14,
                      fontSize: 12,
                      fontWeight: 700,
                      border: selectedBrandFilter === "all" ? "1.5px solid var(--forest)" : "1px solid var(--line)",
                      background: selectedBrandFilter === "all" ? "var(--forest-dark)" : "#fff",
                      color: selectedBrandFilter === "all" ? "#fff" : "var(--muted)",
                      cursor: "pointer",
                      whiteSpace: "nowrap"
                    }}
                  >
                    Tous ({modelesList.length})
                  </button>
                  {availableBrands.map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setSelectedBrandFilter(b)}
                      style={{
                        padding: "4px 12px",
                        borderRadius: 14,
                        fontSize: 12,
                        fontWeight: 700,
                        border: selectedBrandFilter === b ? "1.5px solid var(--forest)" : "1px solid var(--line)",
                        background: selectedBrandFilter === b ? "var(--forest-dark)" : "#fff",
                        color: selectedBrandFilter === b ? "#fff" : "var(--muted)",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}

              {/* Model Chips (SHEIN / AliExpress buttons) */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                {filteredModeles.map((m, idx) => {
                  const isSelected = selectedModele?.nom === m.nom && (!m.brandNom || selectedModele?.brandNom === m.brandNom);
                  const mStock = getVariantStock(m);
                  const isOutOfStock = mStock !== null && mStock <= 0;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedModele(m);
                        setMissingSelectionAlert(false);
                        if (isOutOfStock) {
                          showToast(`Le modèle "${m.nomComplet || m.nom}" est actuellement en rupture de stock. Veuillez choisir un autre modèle compatible.`, "warning");
                        }
                      }}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 12,
                        fontSize: 13,
                        fontWeight: isSelected ? 800 : 600,
                        border: isSelected 
                          ? (isOutOfStock ? "2px solid #EF4444" : "2px solid var(--forest-dark)") 
                          : (isOutOfStock ? "1.5px dashed #CBD5E1" : "1.5px solid var(--line)"),
                        background: isSelected 
                          ? (isOutOfStock ? "#FEF2F2" : "var(--forest-dark)") 
                          : (isOutOfStock ? "#F1F5F9" : "#fff"),
                        color: isSelected 
                          ? (isOutOfStock ? "#DC2626" : "#fff") 
                          : (isOutOfStock ? "#94A3B8" : "var(--ink)"),
                        opacity: isOutOfStock && !isSelected ? 0.65 : 1,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all 0.15s",
                        boxShadow: isSelected ? "0 4px 12px rgba(22, 52, 36, 0.2)" : "none"
                      }}
                    >
                      <span style={{ textDecoration: isOutOfStock ? "line-through" : "none" }}>
                        {m.nomComplet || `${m.brandNom ? `${m.brandNom} ` : ''}${m.nom}`}
                      </span>
                      {isOutOfStock ? (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          background: "#EF4444",
                          color: "#fff",
                          padding: "1px 5px",
                          borderRadius: 8,
                          textDecoration: "none"
                        }}>
                          Épuisé
                        </span>
                      ) : mStock !== null ? (
                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: isSelected ? "#fff" : "#059669",
                          background: isSelected ? "rgba(255,255,255,0.25)" : "#ECFDF5",
                          padding: "1px 6px",
                          borderRadius: 8,
                          border: isSelected ? "1px solid rgba(255,255,255,0.3)" : "1px solid #A7F3D0"
                        }}>
                          {mStock} dispo
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p style={{ color: "var(--muted)", fontSize: 15, maxWidth: 520, lineHeight: 1.6, marginBottom: 24 }}>
            {product.description || (displayStock > 0 ? `Produit de qualité supérieure disponible en stock (${displayStock} ${product.unite}).` : "Rupture de stock temporaire.")}
          </p>

          {/* ALERTE RUPTURE DE STOCK SUR VARIANTE SÉLECTIONNÉE */}
          {isAnySelectedVariantOutOfStock && (
            <div style={{
              background: "#FEF2F2",
              border: "1.5px solid #F87171",
              borderRadius: 14,
              padding: "12px 16px",
              marginBottom: 20,
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              color: "#991B1B"
            }}>
              <AlertTriangle size={22} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>
                <strong style={{ display: "block", marginBottom: 3, fontSize: 14 }}>Variante en rupture de stock</strong>
                {selectedColorStock !== null && selectedColorStock <= 0 && (
                  <div>Le coloris <strong>{selectedCouleur?.nom}</strong> est actuellement épuisé. Veuillez choisir un autre coloris disponible.</div>
                )}
                {selectedSenteurStock !== null && selectedSenteurStock <= 0 && (
                  <div>La senteur <strong>{selectedSenteur?.nom}</strong> est actuellement épuisée. Veuillez choisir une autre senteur disponible.</div>
                )}
                {selectedModeleStock !== null && selectedModeleStock <= 0 && (
                  <div>Le modèle <strong>{selectedModele?.nomComplet || selectedModele?.nom}</strong> est actuellement épuisé. Veuillez choisir un autre modèle compatible.</div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 30, overflow: "hidden", height: 48, opacity: isMaxStockReached || product.stock === 0 || isAnySelectedVariantOutOfStock ? 0.6 : 1 }}>
              <button onClick={decrementQty} disabled={quantity <= 1 || isAnySelectedVariantOutOfStock} style={{ width: 44, height: "100%", background: "var(--paper)", border: "none", cursor: quantity <= 1 || isAnySelectedVariantOutOfStock ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Minus size={18} color="var(--ink)" />
              </button>
              <input
                type="number"
                min="1"
                max={stockDisponible}
                value={quantity}
                disabled={isAnySelectedVariantOutOfStock}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (isNaN(val) || val < 1) {
                    setQuantity(1);
                  } else if (val > stockDisponible) {
                    setQuantity(stockDisponible);
                    showToast(`Quantité ajustée au stock disponible (${stockDisponible}).`, "warning");
                  } else {
                    setQuantity(val);
                  }
                }}
                style={{
                  width: 54, textAlign: "center", fontWeight: 700, fontSize: 16,
                  border: "none", background: "transparent", color: "var(--ink)", outline: "none",
                  MozAppearance: "textfield"
                }}
              />
              <button onClick={incrementQty} disabled={quantity >= stockDisponible || isAnySelectedVariantOutOfStock} style={{ width: 44, height: "100%", background: "var(--paper)", border: "none", cursor: quantity >= stockDisponible || isAnySelectedVariantOutOfStock ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus size={18} color="var(--ink)" />
              </button>
            </div>

            <button 
              className="bs-btn-primary" 
              disabled={product.stock <= 0 || isAnySelectedVariantOutOfStock}
              style={{ 
                flex: 1, 
                height: 48, 
                padding: "0 20px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                gap: 8, 
                fontSize: 16,
                background: (product.stock <= 0 || isAnySelectedVariantOutOfStock) ? "var(--line)" : isMaxStockReached ? "#D97706" : undefined,
                color: (product.stock <= 0 || isAnySelectedVariantOutOfStock) ? "var(--muted)" : undefined,
                cursor: (product.stock <= 0 || isAnySelectedVariantOutOfStock) ? "not-allowed" : "pointer"
              }} 
              onClick={handleAddToCart}
            >
              {added ? (
                <><CheckCircle size={20} /> Ajouté au panier !</>
              ) : isAnySelectedVariantOutOfStock ? (
                <><AlertTriangle size={20} /> Variante épuisée (Choisir une autre)</>
              ) : isMaxStockReached ? (
                <><AlertTriangle size={20} /> Stock max en panier ({totalInCart}/{product.stock})</>
              ) : (
                <><ShoppingBag size={20} /> Ajouter au panier</>
              )}
            </button>
          </div>

          {/* AVIS CLIENTS */}
          <div className="bs-reviews">
            <h3 style={{ fontSize: 18, color: "var(--forest-dark)" }}>Avis et commentaires clients</h3>
            {(!product.avis || product.avis.length === 0) && (
              <p style={{ color: "var(--muted)", fontSize: 14 }}>Aucun avis pour l'instant. Soyez le premier client à donner votre avis !</p>
            )}
            {product.avis?.map((a) => (
              <div className="bs-review" key={a.id}>
                <div className="who">{a.auteur?.nom || "Client vérifié"}</div>
                <Stars note={a.note} size={13} />
                <div style={{ fontSize: 14, marginTop: 4, color: "var(--ink)" }}>{a.commentaire}</div>
              </div>
            ))}

          </div>
        </div>
      </div>
      
      {/* RELATED PRODUCTS */}
      {related.length > 0 && (
        <div style={{ marginTop: 60, paddingTop: 40, borderTop: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: 24, color: "var(--forest-dark)", margin: 0 }}>Produits similaires</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => scrollSlider("left")}
                aria-label="Défiler à gauche"
                style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: "#fff", border: "1px solid var(--line)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                  transition: "all 0.2s"
                }}
              >
                <ChevronLeft size={20} color="var(--forest-dark)" />
              </button>
              <button
                onClick={() => scrollSlider("right")}
                aria-label="Défiler à droite"
                style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: "#fff", border: "1px solid var(--line)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                  transition: "all 0.2s"
                }}
              >
                <ChevronRight size={20} color="var(--forest-dark)" />
              </button>
            </div>
          </div>

          <div
            ref={sliderRef}
            style={{
              display: "flex",
              gap: 16,
              overflowX: "auto",
              scrollSnapType: "x mandatory",
              scrollBehavior: "smooth",
              paddingBottom: 16,
              scrollbarWidth: "none",
              msOverflowStyle: "none"
            }}
          >
            {related.map(p => (
              <div key={p.id} style={{ flex: "0 0 260px", minWidth: 260, scrollSnapAlign: "start" }}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

