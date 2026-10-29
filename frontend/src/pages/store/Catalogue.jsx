import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Heart, Trash2, Search, X, Sparkles, Smartphone, Zap, Shield, Headphones, BatteryCharging } from "lucide-react";
import api, { SLUG } from "../../api";
import ProductCard from "../../components/ProductCard.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useCart } from "../../context/CartContext.jsx";
import { useData } from "../../context/DataContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";
import { Skel } from "../../components/Skeleton.jsx";

export default function Catalogue() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useCart();
  const { invalidate, getData, setData, isStale } = useData();

  const categoryId = params.get("categoryId") || "";
  const famille = params.get("famille") || "";
  const search = params.get("search") || "";
  const marqueId = params.get("marqueId") || "";
  const onlyFavoris = params.get("favoris") === "1";

  // Local state for instant live search input
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const cacheKey = `products:${SLUG}:${categoryId}:${famille}:${search}::${marqueId}`;

  const [marques, setMarques] = useState([]);
  const [categories, setCategories] = useState(() => {
    const cached = getData(`categories:${SLUG}`);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    try {
      const ls = localStorage.getItem(`cached_categories_${SLUG}`);
      return ls ? JSON.parse(ls) : [];
    } catch (e) { return []; }
  });

  const [products, setProducts] = useState(() => {
    const cached = getData(cacheKey) || getData(`products:${SLUG}:::::`);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    try {
      const ls = localStorage.getItem(`cached_products_${SLUG}`);
      return ls ? JSON.parse(ls) : [];
    } catch (e) { return []; }
  });

  // Popular / fallback products to display when a search returns 0 results
  const [allFallbackProducts, setAllFallbackProducts] = useState([]);

  const [loading, setLoading] = useState(() => {
    const hasCat = categories && categories.length > 0;
    const hasProd = products && products.length > 0;
    return !hasCat && !hasProd;
  });

  const [favIds, setFavIds] = useState([]);

  // Scroll to top on filter change & remember catalogue query state
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const activeUrl = window.location.pathname + window.location.search;
      sessionStorage.setItem("last_catalogue_url", activeUrl);
    } catch (e) {}
  }, [categoryId, famille, search, marqueId, onlyFavoris]);

  useEffect(() => {
    api.get(`/store/${SLUG}/marques`).then((res) => setMarques(res.data || [])).catch(() => {});
    // Load general products for intelligent fallback recommendations
    api.get(`/store/${SLUG}/products`).then((res) => setAllFallbackProducts(res.data || [])).catch(() => {});
  }, []);

  // User-scoped favorites sync
  useEffect(() => {
    function updateFavs() {
      const key = user && user.id ? `favorites_user_${user.id}` : "favorites_guest";
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      setFavIds(list);
    }
    updateFavs();
    window.addEventListener("favorites_updated", updateFavs);
    return () => window.removeEventListener("favorites_updated", updateFavs);
  }, [user?.id]);

  function loadCategories(force = false) {
    const key = `categories:${SLUG}`;
    if (!force && !isStale(key)) {
      const cached = getData(key);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setCategories(cached);
        return;
      }
    }
    api.get(`/store/${SLUG}/categories`).then((res) => {
      setData(key, res.data, 300000);
      setCategories(res.data);
      try { localStorage.setItem(`cached_categories_${SLUG}`, JSON.stringify(res.data)); } catch(e) {}
    }).catch(() => {});
  }

  function loadProducts(force = false) {
    const ck = `products:${SLUG}:${categoryId}:${famille}:${search}::${marqueId}`;
    if (!force && !isStale(ck)) {
      const cached = getData(ck);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setProducts(cached);
        setLoading(false);
        return;
      }
    }
    if (products.length === 0) {
      setLoading(true);
    }
    const query = {};
    if (categoryId) query.categoryId = categoryId;
    if (famille) query.famille = famille;
    if (search) query.search = search;
    if (marqueId) query.marqueId = marqueId;
    
    api.get(`/store/${SLUG}/products`, { params: query })
      .then((res) => {
        setData(ck, res.data, 120000);
        setProducts(res.data);
        if (!categoryId && !famille && !search && !marqueId) {
          try { localStorage.setItem(`cached_products_${SLUG}`, JSON.stringify(res.data)); } catch(e) {}
          setAllFallbackProducts(res.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadCategories();
    loadProducts();
  }, [categoryId, famille, search, marqueId]);

  // Real-time synchronization
  useEffect(() => {
    const unsub = subscribeRealtime((event, data) => {
      if (["product_created", "product_updated", "product_deleted", "stock_updated", "boutique_updated"].includes(event)) {
        invalidate(`products:${SLUG}`);
        invalidate(`categories:${SLUG}`);
        loadProducts(true);
        loadCategories(true);
      }
    });
    return unsub;
  }, [categoryId, famille, search, marqueId, invalidate]);

  const stripAccents = (str) =>
    (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  // Filter products locally for instant response
  let displayedProducts = products;
  if (onlyFavoris) {
    displayedProducts = displayedProducts.filter((p) => favIds.includes(p.id));
  }
  if (marqueId) {
    displayedProducts = displayedProducts.filter((p) => String(p.marqueId) === String(marqueId));
  }
  if (famille) {
    const fClean = stripAccents(famille);
    displayedProducts = displayedProducts.filter((p) => {
      const pFam = stripAccents(p.famille);
      const pNom = stripAccents(p.nom);
      return (
        pFam.includes(fClean) ||
        fClean.includes(pFam) ||
        pNom.includes(fClean)
      );
    });
  }

  // ── DÉTECTION INTELLIGENTE ET RECOMMANDATIONS EN CAS D'ÉCHEC DE RECHERCHE ──
  const smartAnalysis = useMemo(() => {
    if (!search) return null;
    const q = stripAccents(search);

    // Détection de marque même avec faute de frappe
    let detectedMarque = null;
    if (q.includes("iph") || q.includes("app") || q.includes("pom") || q.includes("ios") || q.includes("aifon")) {
      detectedMarque = marques.find(m => stripAccents(m.nom).includes("apple")) || { nom: "Apple (iPhone)", id: null };
    } else if (q.includes("sam") || q.includes("sams") || q.includes("galax") || q.includes("sung")) {
      detectedMarque = marques.find(m => stripAccents(m.nom).includes("samsung")) || { nom: "Samsung", id: null };
    } else if (q.includes("tec") || q.includes("tek") || q.includes("camon") || q.includes("spark") || q.includes("pova")) {
      detectedMarque = marques.find(m => stripAccents(m.nom).includes("tecno")) || { nom: "Tecno", id: null };
    } else if (q.includes("inf") || q.includes("hot") || q.includes("smart") || q.includes("zero")) {
      detectedMarque = marques.find(m => stripAccents(m.nom).includes("infinix")) || { nom: "Infinix", id: null };
    } else if (q.includes("xiao") || q.includes("red") || q.includes("poc") || q.includes("chao")) {
      detectedMarque = marques.find(m => stripAccents(m.nom).includes("xiaomi")) || { nom: "Xiaomi / Redmi", id: null };
    } else if (q.includes("orai") || q.includes("freepod")) {
      detectedMarque = marques.find(m => stripAccents(m.nom).includes("oraimo")) || { nom: "Oraimo", id: null };
    } else if (q.includes("ank")) {
      detectedMarque = marques.find(m => stripAccents(m.nom).includes("anker")) || { nom: "Anker", id: null };
    } else if (q.includes("base")) {
      detectedMarque = marques.find(m => stripAccents(m.nom).includes("baseus")) || { nom: "Baseus", id: null };
    }

    // Détection de catégorie
    let detectedType = null;
    if (q.includes("charg") || q.includes("bloc") || q.includes("prise") || q.includes("adapt")) {
      detectedType = { label: "Chargeurs Rapides & Blocs", famille: "Chargeurs & Blocs Rapides" };
    } else if (q.includes("glac") || q.includes("verr") || q.includes("film") || q.includes("protect") || q.includes("espion") || q.includes("ecran")) {
      detectedType = { label: "Glaces Trempées & Protections 9D", famille: "Glaces & Protections Écran" };
    } else if (q.includes("coq") || q.includes("poch") || q.includes("hous") || q.includes("etui") || q.includes("silicon")) {
      detectedType = { label: "Pochettes & Coques Antichoc", famille: "Pochettes & Coques Antichoc" };
    } else if (q.includes("ecout") || q.includes("airpod") || q.includes("casq") || q.includes("earbud") || q.includes("audio")) {
      detectedType = { label: "Écouteurs Sans Fil & AirPods", famille: "Écouteurs, Casques & Audio" };
    } else if (q.includes("cabl") || q.includes("fil") || q.includes("cord") || q.includes("type-c") || q.includes("lightning")) {
      detectedType = { label: "Câbles Renforcés & Connectique", famille: "Câbles & Connectique" };
    } else if (q.includes("power") || q.includes("batt") || q.includes("externe")) {
      detectedType = { label: "Powerbanks & Batteries Externes", famille: "Powerbanks & Batteries Externes" };
    }

    return { detectedMarque, detectedType };
  }, [search, marques]);

  // Suggestions intelligentes de produits quand la recherche est vide
  const recommendedProducts = useMemo(() => {
    if (displayedProducts.length > 0) return [];
    if (!allFallbackProducts || allFallbackProducts.length === 0) return products.slice(0, 4);

    // Si une marque a été détectée dans la recherche introuvable, prioriser les articles de cette marque
    if (smartAnalysis?.detectedMarque?.id) {
      const sameBrand = allFallbackProducts.filter(p => String(p.marqueId) === String(smartAnalysis.detectedMarque.id));
      if (sameBrand.length > 0) return sameBrand.slice(0, 6);
    }
    // Sinon, retourner les articles les plus populaires / bien notés
    return allFallbackProducts.slice(0, 6);
  }, [displayedProducts.length, allFallbackProducts, smartAnalysis, products]);

  // Déterminer les marques pertinentes pour la catégorie ou sélection actuelle
  const relevantMarques = useMemo(() => {
    const sourceProducts = (allFallbackProducts && allFallbackProducts.length > 0) ? allFallbackProducts : products;
    if (categoryId) {
      const prodsInCat = sourceProducts.filter(p => String(p.categoryId) === String(categoryId));
      const marqueIds = new Set(prodsInCat.map(p => p.marqueId).filter(Boolean).map(id => String(id)));
      if (marqueIds.size === 0) return [];
      return marques.filter(m => marqueIds.has(String(m.id)));
    }
    const allMarqueIds = new Set(sourceProducts.map(p => p.marqueId).filter(Boolean).map(id => String(id)));
    if (allMarqueIds.size === 0) return [];
    return marques.filter(m => allMarqueIds.has(String(m.id)));
  }, [categoryId, products, allFallbackProducts, marques]);

  // Sous-catégories dynamiques pour la catégorie active ou catalogue général
  const availableSubcategories = useMemo(() => {
    const map = new Map();

    // 1. Si une catégorie est sélectionnée, inclure ses sous-catégories déclarées
    if (categoryId) {
      const activeCat = categories.find(c => String(c.id) === String(categoryId));
      if (activeCat?.sousCategories && Array.isArray(activeCat.sousCategories)) {
        activeCat.sousCategories.forEach(s => {
          if (s.nom) {
            const clean = s.nom.trim();
            map.set(clean.toLowerCase(), {
              nom: clean,
              count: 0,
              imageUrl: s.imageUrl || activeCat.imageUrl || null
            });
          }
        });
      }
    }

    // 2. Découvrir et compter depuis les produits de la catégorie active
    const pool = categoryId
      ? allFallbackProducts.filter(p => String(p.categoryId) === String(categoryId))
      : allFallbackProducts;

    pool.forEach(p => {
      const fam = p.famille;
      if (fam && typeof fam === "string") {
        const clean = fam.trim();
        if (clean && !clean.toLowerCase().startsWith("section")) {
          const key = clean.toLowerCase();
          const existing = map.get(key);
          map.set(key, {
            nom: existing?.nom || clean,
            count: (existing?.count || 0) + 1,
            imageUrl: existing?.imageUrl || p.imageUrl || null
          });
        }
      }
    });

    return Array.from(map.values());
  }, [categoryId, allFallbackProducts, categories]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    const next = new URLSearchParams(params);
    if (searchInput.trim()) {
      next.set("search", searchInput.trim());
    } else {
      next.delete("search");
    }
    setParams(next);
  }

  function clearSearch() {
    setSearchInput("");
    const next = new URLSearchParams(params);
    next.delete("search");
    setParams(next);
  }

  function clearAllFavorites() {
    if (!window.confirm("Voulez-vous vraiment vider tous vos favoris ?")) return;
    const key = user && user.id ? `favorites_user_${user.id}` : "favorites_guest";
    localStorage.setItem(key, JSON.stringify([]));
    window.dispatchEvent(new Event("favorites_updated"));
    showToast("Tous vos favoris ont été supprimés.", "info", "Favoris");
  }

  // Skeleton Card
  const SkeletonCard = ({ delay = 0 }) => (
    <div className="bs-skeleton-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="bs-skeleton-img" />
      <div className="bs-skeleton-body">
        <div className="bs-skeleton-line bs-skeleton-title" />
        <div className="bs-skeleton-line bs-skeleton-sub" />
        <div className="bs-skeleton-line bs-skeleton-price" />
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "65vh" }}>
      {/* ── BADGE DE RECHERCHE ACTIVE (SI RECHERCHE DEPUIS LA BARRE DU HAUT) ── */}
      {search && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 14,
          padding: "10px 18px", marginBottom: 20
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#1D4ED8" }}>
            <Search size={16} />
            <span>Recherche active : <strong>« {search} »</strong></span>
          </div>
          <button
            onClick={clearSearch}
            style={{
              background: "#DBEAFE", border: "none", color: "#1E40AF",
              borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4
            }}
          >
            <X size={14} /> Réinitialiser
          </button>
        </div>
      )}

      {/* ── BANDEAU CATÉGORIES ── */}
      <div className="bs-cats">
        <div
          className={"bs-cat-card" + (!categoryId && !famille && !onlyFavoris ? " on" : "")}
          onClick={() => setParams({})}
        >
          <div className="bs-cat-name" style={{ padding: "20px 0" }}>Tout le catalogue</div>
        </div>

        <div
          className={"bs-cat-card" + (onlyFavoris ? " on" : "")}
          onClick={() => setParams({ favoris: "1" })}
          style={{
            borderColor: onlyFavoris ? "#B4483A" : undefined,
            background: onlyFavoris ? "#FAD2CD" : undefined,
          }}
        >
          <div
            className="bs-cat-name"
            style={{
              padding: "16px 0",
              color: onlyFavoris ? "#B4483A" : "var(--ink)",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Heart
              size={16}
              fill={onlyFavoris ? "#B4483A" : "none"}
              color={onlyFavoris ? "#B4483A" : "var(--ink)"}
            />
            Favoris ({favIds.length})
          </div>
        </div>

        {categories.map((c) => (
          <div
            key={c.id}
            className={"bs-cat-card" + (categoryId == c.id && !onlyFavoris ? " on" : "")}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("categoryId", c.id);
              next.delete("famille");
              setParams(next);
            }}
          >
            <img
              src={c.imageUrl || "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=300&q=80"}
              alt={c.nom}
              loading="lazy"
              decoding="async"
              className="bs-cat-img"
            />
            <div className="bs-cat-name">{c.nom}</div>
          </div>
        ))}
      </div>

      {/* ── SOUS-CATÉGORIES / FAMILLES STYLE SHEIN (BULLES RONDES) ── */}
      {availableSubcategories.length > 0 && (
        <div style={{
          margin: "18px 0 20px",
          background: "var(--card)",
          padding: "16px 20px",
          borderRadius: 18,
          border: "1px solid var(--line)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--forest-dark)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {categoryId ? "Sous-catégories disponibles :" : "Familles d'accessoires :"}
            </span>
            {famille && (
              <button
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.delete("famille");
                  setParams(next);
                }}
                style={{ background: "none", border: "none", color: "#B4483A", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Effacer le filtre
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
            {/* "Tout" bubble */}
            <button
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete("famille");
                setParams(next);
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                background: "none",
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
                minWidth: 70
              }}
            >
              <div style={{
                width: 58,
                height: 58,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: !famille ? "var(--forest-dark)" : "var(--paper)",
                color: !famille ? "#fff" : "var(--forest-dark)",
                border: !famille ? "2.5px solid var(--forest)" : "1.5px solid var(--line)",
                fontWeight: 800,
                fontSize: 13,
                boxShadow: !famille ? "0 4px 12px rgba(22, 52, 36, 0.2)" : "none",
                transition: "all 0.15s"
              }}>
                Tout
              </div>
              <span style={{
                fontSize: 12,
                fontWeight: !famille ? 800 : 600,
                color: !famille ? "var(--forest-dark)" : "var(--muted)",
                textAlign: "center"
              }}>
                Tous
              </span>
            </button>

            {/* Dynamic subcategory bubbles */}
            {availableSubcategories.map((sub, sIdx) => {
              const isSelected = stripAccents(famille) === stripAccents(sub.nom);
              return (
                <button
                  key={sIdx}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    if (isSelected) next.delete("famille");
                    else next.set("famille", sub.nom);
                    setParams(next);
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    flexShrink: 0,
                    minWidth: 76,
                    maxWidth: 96
                  }}
                >
                  <div style={{
                    width: 58,
                    height: 58,
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: isSelected ? "2.5px solid var(--forest)" : "1.5px solid var(--line)",
                    padding: 2,
                    background: "#fff",
                    boxShadow: isSelected ? "0 4px 12px rgba(22, 52, 36, 0.2)" : "none",
                    transition: "all 0.15s"
                  }}>
                    {sub.imageUrl ? (
                      <img src={sub.imageUrl} alt={sub.nom} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: isSelected ? "var(--forest-light)" : "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Smartphone size={22} color={isSelected ? "var(--forest)" : "var(--muted)"} />
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11.5,
                    fontWeight: isSelected ? 800 : 600,
                    color: isSelected ? "var(--forest-dark)" : "var(--ink)",
                    textAlign: "center",
                    lineHeight: 1.2,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical"
                  }}>
                    {sub.nom}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FILTRES PAR MARQUE (VISIBLES UNIQUEMENT SI DES MARQUES SONT ASSOCIÉES) ── */}
      {relevantMarques.length > 0 && (
        <div style={{
          margin: "18px 0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "var(--card)",
          padding: "16px 20px",
          borderRadius: 18,
          border: "1px solid var(--line)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.03)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#1E3A8A", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
              <Smartphone size={15} color="#2563EB" /> Marques & Téléphones :
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.delete("marqueId");
                  setParams(next);
                }}
                style={{
                  padding: "6px 14px",
                  borderRadius: 16,
                  fontSize: 12.5,
                  fontWeight: 700,
                  border: !marqueId ? "2px solid #2563EB" : "1px solid var(--line)",
                  background: !marqueId ? "#EFF6FF" : "var(--paper)",
                  color: !marqueId ? "#1D4ED8" : "var(--muted)",
                  cursor: "pointer",
                  transition: "all 0.15s"
                }}
              >
                Toutes les marques
              </button>

              {relevantMarques.map((m) => {
                const isSelected = String(marqueId) === String(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      if (isSelected) next.delete("marqueId");
                      else next.set("marqueId", m.id);
                      setParams(next);
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 16,
                      fontSize: 12.5,
                      fontWeight: 700,
                      border: isSelected ? "2px solid #2563EB" : "1px solid var(--line)",
                      background: isSelected ? "#EFF6FF" : "var(--paper)",
                      color: isSelected ? "#1D4ED8" : "var(--ink)",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.15s"
                    }}
                  >
                    {m.nom}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TITRE DE SECTION ET COMPTEUR ── */}
      <div
        className="bs-section-title"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}
      >
        {loading ? (
          <Skel w={240} h={22} />
        ) : (
          <h2>
            {onlyFavoris
              ? `Mes accessoires favoris (${displayedProducts.length})`
              : search
              ? `Résultats pour « ${search} » (${displayedProducts.length})`
              : famille
              ? `${famille} (${displayedProducts.length})`
              : `${displayedProducts.length} accessoire(s) disponible(s)`}
          </h2>
        )}

        {onlyFavoris && displayedProducts.length > 0 && (
          <button
            onClick={clearAllFavorites}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#FDF2F0",
              color: "#B4483A",
              border: "1px solid #F8D7D2",
              padding: "8px 16px",
              borderRadius: 20,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <Trash2 size={15} /> Supprimer tous les favoris
          </button>
        )}
      </div>

      {loading ? (
        <div className="bs-grid-catalogue" style={{ padding: "4px 0 20px" }}>
          {[0, 80, 160, 240, 320, 400, 480, 560].map((delay, i) => (
            <SkeletonCard key={i} delay={delay} />
          ))}
        </div>
      ) : (
        <div style={{ animation: "catalogueReveal 0.4s ease" }}>
          {/* ÉTAT VIDE POUR LES FAVORIS */}
          {onlyFavoris && displayedProducts.length === 0 && (
            <div style={{ padding: 60, textAlign: "center", color: "var(--muted)", background: "#fff", borderRadius: 16 }}>
              <Heart size={44} color="#B4483A" style={{ marginBottom: 12, opacity: 0.8 }} />
              <h3 style={{ margin: "0 0 8px", color: "#1E293B" }}>Aucun accessoire dans vos favoris</h3>
              <p style={{ margin: 0, fontSize: 14 }}>
                Parcourez le catalogue Soilihitech et cliquez sur le cœur d'un produit pour le conserver !
              </p>
            </div>
          )}

          {/* ── RECHERCHE INTELLIGENTE : QUAND AUCUN RÉSULTAT N'EST TROUVÉ ── */}
          {!onlyFavoris && displayedProducts.length === 0 && (
            <div style={{
              background: "#fff",
              borderRadius: 20,
              padding: "40px 28px",
              border: "1.5px dashed #CBD5E1",
              textAlign: "center",
              marginBottom: 30
            }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "#FEF2F2",
                color: "#EF4444",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16
              }}>
                <Search size={30} />
              </div>

              <h3 style={{ fontSize: 19, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>
                {search ? `Désolé, aucun résultat exact pour « ${search} »` : "Aucun accessoire trouvé"}
              </h3>
              <p style={{ fontSize: 14.5, color: "#64748B", maxWidth: 520, margin: "0 auto 20px", lineHeight: 1.5 }}>
                {search
                  ? "Cet article précis n'est pas encore en stock ou le nom comporte une petite variation. Mais ne repartez pas les mains vides !"
                  : "Modifiez vos filtres ou sélectionnez une autre catégorie d'accessoires."}
              </p>

              {/* Suggestions intelligentes basées sur la requête */}
              {smartAnalysis && (smartAnalysis.detectedMarque || smartAnalysis.detectedType) && (
                <div style={{
                  background: "#F0F9FF",
                  border: "1px solid #BAE6FD",
                  padding: "16px 20px",
                  borderRadius: 16,
                  maxWidth: 580,
                  margin: "0 auto 24px",
                  textAlign: "left"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#0369A1", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                    <Sparkles size={16} /> Recommandations automatiques Soilihitech :
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {smartAnalysis.detectedMarque && (
                      <button
                        onClick={() => {
                          const next = new URLSearchParams();
                          if (smartAnalysis.detectedMarque.id) next.set("marqueId", smartAnalysis.detectedMarque.id);
                          setParams(next);
                        }}
                        style={{
                          background: "#0284C7",
                          color: "#fff",
                          border: "none",
                          padding: "8px 14px",
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <Smartphone size={14} /> Voir tous les accessoires {smartAnalysis.detectedMarque.nom}
                      </button>
                    )}
                    {smartAnalysis.detectedType && (
                      <button
                        onClick={() => {
                          const next = new URLSearchParams();
                          next.set("famille", smartAnalysis.detectedType.famille);
                          setParams(next);
                        }}
                        style={{
                          background: "#059669",
                          color: "#fff",
                          border: "none",
                          padding: "8px 14px",
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <Zap size={14} /> {smartAnalysis.detectedType.label}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Bouton de réinitialisation rapide */}
              <button
                onClick={() => {
                  setSearchInput("");
                  setParams({});
                }}
                style={{
                  background: "#1E293B",
                  color: "#fff",
                  border: "none",
                  padding: "10px 22px",
                  borderRadius: 12,
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Afficher tout le catalogue Soilihitech
              </button>
            </div>
          )}

          {/* Grille principale des produits correspondants */}
          {displayedProducts.length > 0 && (
            <div className="bs-grid-catalogue">
              {displayedProducts.map((p) => (
                <ProductCard key={p.id} product={p} isFavorisPage={onlyFavoris} />
              ))}
            </div>
          )}

          {/* ── SECTION RECOMMANDATIONS SI RECHERCHE SANS RÉSULTAT ── */}
          {displayedProducts.length === 0 && recommendedProducts.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
                paddingBottom: 8,
                borderBottom: "2px solid #E2E8F0"
              }}>
                <Sparkles size={18} color="#2563EB" />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1E293B" }}>
                  Nos Accessoires les Plus Demandés pour vous :
                </h3>
              </div>
              <div className="bs-grid-catalogue">
                {recommendedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
