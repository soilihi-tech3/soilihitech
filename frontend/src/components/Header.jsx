import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShoppingCart, Search, User, LogOut, Store, X, Home, Grid, Package, Shield, Menu, ChevronDown, Info, Heart, Sun, Moon, Smartphone, MoreHorizontal, Zap, ClipboardList } from "lucide-react";

import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import api, { SLUG } from "../api";
import CartDrawer from "./CartDrawer.jsx";
import NotificationMenu from "./NotificationMenu.jsx";
import ProfileModal from "./ProfileModal.jsx";

import { formatPrice as fcfa, CURRENCIES, getActiveCurrency, setActiveCurrency } from "../utils/currency.js";

export default function Header({ setCartOpen: setCartOpenProp }) {
  const { user, boutique: boutiqueContext, logout, theme, toggleTheme } = useAuth();
  const { count, showToast } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [currentCurrency, setCurrentCurrency] = useState(() => getActiveCurrency());

  useEffect(() => {
    const handleCurr = (e) => setCurrentCurrency(e.detail);
    window.addEventListener("currency_changed", handleCurr);
    return () => window.removeEventListener("currency_changed", handleCurr);
  }, []);

  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [boutiqueLocal, setBoutiqueLocal] = useState(null);
  const [categories, setCategories] = useState(() => {
    try {
      const ls = localStorage.getItem(`cached_categories_${SLUG}`);
      return ls ? JSON.parse(ls) : [];
    } catch (e) { return []; }
  });
  const [results, setResults] = useState([]);
  const [smartFallback, setSmartFallback] = useState(null);
  const [allProducts, setAllProducts] = useState(() => {
    try {
      const ls = localStorage.getItem(`cached_products_${SLUG}`);
      return ls ? JSON.parse(ls) : [];
    } catch (e) { return []; }
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);
  const userMenuRef = useRef(null);
  const categoriesRef = useRef(null);
  const mobileSearchInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const boutique = boutiqueContext || boutiqueLocal;

  function openMobileSearch() {
    setMobileSearchOpen(true);
    setTimeout(() => {
      mobileSearchInputRef.current?.focus();
    }, 120);
  }

  function closeMobileSearch() {
    setMobileSearchOpen(false);
    setQuery("");
    setResults([]);
    setShowDropdown(false);
  }

  useEffect(() => {
    if (!boutiqueContext) {
      api.get(`/store/${SLUG}`).then((res) => setBoutiqueLocal(res.data)).catch(() => { });
    }
    api.get(`/store/${SLUG}/products`).then((res) => {
      if (Array.isArray(res.data)) {
        setAllProducts(res.data);
        try { localStorage.setItem(`cached_products_${SLUG}`, JSON.stringify(res.data)); } catch (e) {}
      }
    }).catch(() => { });

    api.get(`/store/${SLUG}/categories`).then((res) => {
      if (Array.isArray(res.data)) {
        setCategories(res.data);
        try { localStorage.setItem(`cached_categories_${SLUG}`, JSON.stringify(res.data)); } catch (e) {}
      }
    }).catch(() => { });
  }, [boutiqueContext]);

  // Live intelligent search filtering for Soilihitech
  const stripAccents = (str) =>
    (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  useEffect(() => {
    const qRaw = query.trim();
    if (!qRaw) {
      setResults([]);
      setSmartFallback(null);
      setShowDropdown(false);
      return;
    }

    const q = stripAccents(qRaw);

    const filtered = allProducts.filter(p => {
      const nom = stripAccents(p.nom);
      const marque = stripAccents(p.marque?.nom || p.Marque?.nom);
      const cat = stripAccents(p.Category?.nom);
      const fam = stripAccents(p.Category?.famille || p.famille);
      return nom.includes(q) || marque.includes(q) || cat.includes(q) || fam.includes(q);
    }).slice(0, 6);

    setResults(filtered);

    if (filtered.length === 0) {
      // Analyse intelligente des mots-clés
      let suggestedTag = null;
      if (q.includes("charg") || q.includes("bloc") || q.includes("prise")) {
        suggestedTag = { label: "⚡ Voir nos Chargeurs Rapides (20W à 65W)", url: "/catalogue?famille=Chargeurs" };
      } else if (q.includes("glac") || q.includes("verr") || q.includes("film") || q.includes("protect")) {
        suggestedTag = { label: "🛡️ Découvrir nos Glaces Trempées 9D & Antiespion", url: "/catalogue?famille=Protections" };
      } else if (q.includes("coq") || q.includes("poch") || q.includes("hous") || q.includes("etui")) {
        suggestedTag = { label: "📱 Voir nos Pochettes & Coques Antichoc", url: "/catalogue?famille=Pochettes" };
      } else if (q.includes("ecout") || q.includes("airpod") || q.includes("casq") || q.includes("son")) {
        suggestedTag = { label: "🎵 Explorer les Écouteurs Sans Fil & AirPods", url: "/catalogue?famille=Audio" };
      } else if (q.includes("cabl") || q.includes("fil")) {
        suggestedTag = { label: "🔌 Découvrir nos Câbles USB-C & Lightning", url: "/catalogue?famille=Câbles" };
      } else if (q.includes("power") || q.includes("batt")) {
        suggestedTag = { label: "🔋 Voir nos Batteries Externes 20 000mAh", url: "/catalogue?famille=Powerbanks" };
      } else if (q.includes("iph") || q.includes("app")) {
        suggestedTag = { label: "🍎 Tous les accessoires iPhone / Apple", url: "/catalogue?search=Apple" };
      } else if (q.includes("sam")) {
        suggestedTag = { label: "⚡ Tous les accessoires Samsung Galaxy", url: "/catalogue?search=Samsung" };
      } else if (q.includes("tec")) {
        suggestedTag = { label: "📱 Tous les accessoires Tecno", url: "/catalogue?search=Tecno" };
      } else if (q.includes("inf")) {
        suggestedTag = { label: "📱 Tous les accessoires Infinix", url: "/catalogue?search=Infinix" };
      } else if (q.includes("xiao") || q.includes("red")) {
        suggestedTag = { label: "⚡ Tous les accessoires Xiaomi & Redmi", url: "/catalogue?search=Xiaomi" };
      }

      setSmartFallback({
        query: qRaw,
        suggestedTag,
        recommendations: allProducts.slice(0, 3)
      });
    } else {
      setSmartFallback(null);
    }

    setShowDropdown(true);
  }, [query, allProducts]);

  // Click outside listener
  useEffect(() => {
    function handleClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
      if (categoriesRef.current && !categoriesRef.current.contains(e.target)) {
        setCategoriesOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function onSearch(e) {
    e.preventDefault();
    if (query.trim()) {
      setShowDropdown(false);
      navigate(`/catalogue?search=${encodeURIComponent(query.trim())}`);
    }
  }

  function goToProduct(id) {
    setShowDropdown(false);
    setQuery("");
    navigate(`/produit/${id}`);
  }

  function clearSearch() {
    setQuery("");
    setResults([]);
    setShowDropdown(false);
    setIsSearchFocused(false);
  }

  return (
    <>
      <header style={{ background: "var(--card)", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 1000, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        {/* ROW 1: MAIN HEADER ROW (Z-INDEX ÉLEVÉ POUR FLOTTER AU-DESSUS DE TOUT) */}
        <div style={{ position: "relative", zIndex: 2000, maxWidth: 1520, margin: "0 auto", padding: "14px clamp(16px, 2.5vw, 36px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>

          {/* LOGO & NOM D'ENTREPRISE : MAQUETTE LUXE & ÉLÉGANTE */}
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", flexShrink: 0 }}>
            {boutique?.logoUrl ? (
              <div style={{
                height: 56, width: 56, borderRadius: 16, overflow: "hidden",
                background: "#fff", border: "2px solid rgba(190, 24, 93, 0.22)",
                boxShadow: "0 4px 16px rgba(190, 24, 93, 0.12)", display: "flex",
                alignItems: "center", justifyContent: "center", padding: 4, flexShrink: 0,
                transition: "transform 0.2s ease, box-shadow 0.2s ease"
              }}>
                <img src={boutique.logoUrl} alt={boutique.nom} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              </div>
            ) : (
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: "linear-gradient(135deg, var(--forest-dark, #831843), var(--forest, #BE185D))",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                boxShadow: "0 6px 18px rgba(190, 24, 93, 0.25)", flexShrink: 0
              }}>
                <Store size={26} color="#fff" />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{
                fontSize: 22, fontWeight: 900, color: "var(--forest-dark)", letterSpacing: "0.6px",
                textTransform: "uppercase", lineHeight: 1.15
              }}>
                {boutique?.nom || "Soilihitech"}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 800, color: "var(--forest, #2563EB)", textTransform: "uppercase",
                letterSpacing: "1.8px", marginTop: 3, display: "flex", alignItems: "center", gap: 6
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", display: "inline-block", boxShadow: "0 0 8px #10B981" }}></span>
                Boutique Officielle
              </span>
            </div>
          </Link>

          {/* RECHERCHE INTELLIGENTE UNIQUE ET DYNAMIQUE (DESKTOP) */}
          <div ref={searchRef} className="bs-header-search" style={{ 
              flex: 1, maxWidth: 860, margin: "0 24px", height: 48, position: "relative", zIndex: 2100,
              transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.2)"
          }}>
            {/* Overlay background when search is focused */}
            <div style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)",
              opacity: isSearchFocused ? 1 : 0, pointerEvents: isSearchFocused ? "auto" : "none",
              transition: "opacity 0.25s ease", zIndex: -1
            }} onClick={() => setIsSearchFocused(false)}></div>

            <form onSubmit={onSearch} style={{
              display: "flex", alignItems: "center", background: isSearchFocused ? "#ffffff" : "var(--paper)",
              border: isSearchFocused ? "2px solid #2563EB" : "1.5px solid var(--line)", 
              borderRadius: 30, padding: "0 18px",
              position: "absolute", left: 0, top: 0, bottom: 0, right: 0,
              boxShadow: isSearchFocused ? "0 10px 36px rgba(37, 99, 235, 0.2)" : "0 2px 8px rgba(0,0,0,0.03)",
              transition: "all 0.25s ease",
              zIndex: 20
            }}>
              <Search size={18} color={isSearchFocused ? "#2563EB" : "var(--muted)"} style={{ marginRight: 10, flexShrink: 0, transition: "color 0.2s" }} />
              <input
                placeholder={isSearchFocused ? "Ex: char, 20w, iphone, tecno spark, airpods, glace, pochette..." : "Rechercher un accessoire, chargeur, glace, pochette, marque (iPhone, Samsung, Tecno...)"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => { 
                  setIsSearchFocused(true);
                  if (query.trim()) setShowDropdown(true); 
                }}
                onBlur={() => {
                  setTimeout(() => setIsSearchFocused(false), 400);
                }}
                autoComplete="off"
                style={{
                  border: "none", background: "transparent", outline: "none",
                  width: "100%", fontSize: 14.5, color: "var(--ink)", fontWeight: 500
                }}
              />
              {query && (
                <button type="button" onClick={clearSearch} style={{
                  background: "var(--line)", border: "none", borderRadius: "50%", width: 22, height: 22,
                  cursor: "pointer", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center",
                  padding: 0, marginLeft: 6
                }}>
                  <X size={14} />
                </button>
              )}
            </form>

            {/* LIVE SEARCH DROPDOWN PLEINE LARGEUR & INTELLIGENT */}
            {showDropdown && isSearchFocused && query.trim() && (
              <div style={{
                position: "absolute", top: "calc(100% + 10px)", left: 0, width: "100%",
                background: "#ffffff", borderRadius: 18, border: "1.5px solid var(--line)",
                boxShadow: "0 18px 50px rgba(0,0,0,0.18)", zIndex: 3000, overflow: "hidden",
                animation: "popIn 0.2s ease-out", maxHeight: "80vh", overflowY: "auto"
              }}>
                {results.length === 0 ? (
                  <div style={{ padding: "20px 24px" }}>
                    <div style={{
                      background: "#FEF2F2", border: "1px solid #FEE2E2", borderRadius: 12,
                      padding: "12px 16px", color: "#991B1B", fontSize: 13.5, fontWeight: 600,
                      marginBottom: 14, display: "flex", alignItems: "center", gap: 10
                    }}>
                      <Search size={18} color="#DC2626" />
                      <span>Aucun accessoire exact trouvé pour « <strong>{query}</strong> ».</span>
                    </div>

                    {smartFallback?.suggestedTag && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", color: "#1E40AF", letterSpacing: "0.8px", marginBottom: 6 }}>
                          Suggestion intelligente :
                        </div>
                        <button
                          onMouseDown={() => {
                            setShowDropdown(false);
                            navigate(smartFallback.suggestedTag.url);
                          }}
                          style={{
                            width: "100%", padding: "10px 16px", borderRadius: 12,
                            background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                            color: "#fff", border: "none", fontWeight: 700, fontSize: 13.5,
                            cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
                            boxShadow: "0 4px 14px rgba(37,99,235,0.25)"
                          }}
                        >
                          <span>{smartFallback.suggestedTag.label}</span>
                          <span style={{ fontSize: 15 }}>→</span>
                        </button>
                      </div>
                    )}

                    <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.8px", marginBottom: 10 }}>
                      Accessoires recommandés pour vous :
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(smartFallback?.recommendations || allProducts.slice(0, 3)).map((p) => {
                        const marqueNom = p.marque?.nom || p.Marque?.nom;
                        return (
                          <div
                            key={p.id}
                            onMouseDown={() => goToProduct(p.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
                              borderRadius: 10, background: "var(--paper)", cursor: "pointer",
                              border: "1px solid var(--line)", transition: "all 0.15s"
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = "#2563EB"}
                            onMouseLeave={e => e.currentTarget.style.borderColor = "var(--line)"}
                          >
                            <img
                              src={p.imageUrl || "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=80&q=80"}
                              alt={p.nom}
                              style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {p.nom}
                              </div>
                              <div style={{ fontSize: 11.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                                {marqueNom && <span style={{ fontWeight: 700, color: "#2563EB" }}>{marqueNom}</span>}
                                <span>• {p.Category?.nom || "Accessoire"}</span>
                              </div>
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 13, color: "#2563EB" }}>
                              {fcfa(p.prixPromo || p.prix)}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--line)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>Recherches fréquentes :</span>
                      {["Chargeurs 20W", "Glaces 9D", "Pochettes Silicone", "AirPods", "Câbles Type-C", "Powerbank"].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onMouseDown={() => {
                            setQuery(tag);
                            setShowDropdown(false);
                            navigate(`/catalogue?search=${encodeURIComponent(tag)}`);
                          }}
                          style={{
                            background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 12,
                            padding: "3px 10px", fontSize: 11.5, fontWeight: 600, color: "var(--ink)", cursor: "pointer"
                          }}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ padding: "10px 18px 6px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between" }}>
                      <span>Suggestions instantanées ({results.length})</span>
                      <span style={{ color: "#2563EB", fontWeight: 700 }}>Soilihitech</span>
                    </div>
                    {results.map(p => {
                      const marqueNom = p.marque?.nom || p.Marque?.nom;
                      return (
                        <div key={p.id} onMouseDown={() => goToProduct(p.id)} style={{
                          display: "flex", alignItems: "center", gap: 14, padding: "12px 18px",
                          cursor: "pointer", borderBottom: "1px solid var(--line)", transition: "background 0.15s"
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = "var(--paper)"}
                          onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                        >
                          <img
                            src={p.imageUrl || "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=80&q=80"}
                            alt={p.nom}
                            style={{ width: 46, height: 46, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "1px solid var(--line)" }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {p.nom}
                            </div>
                            <div style={{ fontSize: 12.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                              {marqueNom && (
                                <span style={{
                                  fontSize: 10.5, fontWeight: 800, padding: "1px 7px", borderRadius: 6,
                                  background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE"
                                }}>
                                  {marqueNom}
                                </span>
                              )}
                              <span>{p.Category?.nom || "Accessoire"}</span>
                            </div>
                          </div>
                          <div style={{ fontWeight: 800, fontSize: 14.5, color: "#1E3A8A", flexShrink: 0 }}>
                            {fcfa(p.prixPromo || p.prix)}
                          </div>
                        </div>
                      );
                    })}
                    <div
                      onMouseDown={() => { setShowDropdown(false); navigate(`/catalogue?search=${encodeURIComponent(query.trim())}`); }}
                      style={{ padding: "12px 18px", textAlign: "center", fontSize: 13.5, color: "#2563EB", fontWeight: 800, cursor: "pointer", background: "#EFF6FF", transition: "background 0.15s" }}
                    >
                      Voir tous les résultats pour « {query} » →
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

            {/* ACTIONS (CONNEXION & PANIER PINNED FAR RIGHT) */}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {user ? (
              <>
                <NotificationMenu />

                <div ref={userMenuRef} className="bs-desktop-user-menu" style={{ position: "relative" }}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "4px 8px", borderRadius: "30px", transition: "background 0.2s"
                    }}
                    title="Menu profil"
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: "var(--forest)", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: 14, boxShadow: "0 2px 8px rgba(34,75,53,0.2)"
                    }}>
                      {user.nom ? user.nom.charAt(0).toUpperCase() : "U"}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--ink)", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user.nom?.split(" ")[0]}
                    </span>
                  </button>

                  {userMenuOpen && (
                    <div style={{
                      position: "absolute", right: 0, top: "calc(100% + 8px)",
                      width: 220, background: "#fff", borderRadius: 14,
                      border: "1px solid var(--line)", boxShadow: "0 8px 32px rgba(22,52,36,0.15)",
                      zIndex: 3000, overflow: "hidden"
                    }}>
                      <div style={{ padding: "14px 16px", background: "var(--paper)", borderBottom: "1px solid var(--line)" }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--forest-dark)" }}>{user.nom}</div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)", textTransform: "capitalize" }}>
                          {user.role === "client" ? "Client" : user.role === "employe" ? "Employé" : "Administrateur"}
                        </div>
                      </div>

                      <div style={{ padding: "6px 0" }}>
                        <button
                          onClick={() => { setUserMenuOpen(false); navigate("/profil"); }}
                          style={{
                            width: "100%", padding: "10px 16px", background: "none", border: "none",
                            textAlign: "left", cursor: "pointer", fontSize: 13, fontWeight: 600,
                            color: "var(--ink)", display: "flex", alignItems: "center", gap: 10
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--paper)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        >
                          <User size={16} color="var(--forest)" /> Mon Profil
                        </button>

                        {user.role === "client" && (
                          <button
                            onClick={() => { setUserMenuOpen(false); navigate("/mes-commandes"); }}
                            style={{
                              width: "100%", padding: "10px 16px", background: "none", border: "none",
                              textAlign: "left", cursor: "pointer", fontSize: 13, fontWeight: 600,
                              color: "var(--ink)", display: "flex", alignItems: "center", gap: 10
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--paper)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                          >
                            <Package size={16} color="var(--forest)" /> Mes Commandes
                          </button>
                        )}

                        {(user.role === "admin" || user.role === "employe" || user.role === "super_admin") && (
                          <button
                            onClick={() => { setUserMenuOpen(false); navigate("/admin"); }}
                            style={{
                              width: "100%", padding: "10px 16px", background: "none", border: "none",
                              textAlign: "left", cursor: "pointer", fontSize: 13, fontWeight: 600,
                              color: "var(--ink)", display: "flex", alignItems: "center", gap: 10
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--paper)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                          >
                            <Shield size={16} color="var(--forest)" /> Tableau de bord
                          </button>
                        )}

                        <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "4px 0" }} />

                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            logout();
                            showToast("Déconnexion réussie. À bientôt !", "info", "Déconnexion");
                          }}
                          style={{
                            width: "100%", padding: "10px 16px", background: "none", border: "none",
                            textAlign: "left", cursor: "pointer", fontSize: 13, fontWeight: 600,
                            color: "#B4483A", display: "flex", alignItems: "center", gap: 10
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#FDF2F0")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        >
                          <LogOut size={16} /> Déconnexion
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bs-desktop-auth-btn">
                <Link to="/connexion" style={{ textDecoration: "none" }}>
                  <button style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: 13.5, color: "var(--muted)" }}>
                    <User size={16} /> <span>Connexion</span>
                  </button>
                </Link>
              </div>
            )}

            {/* SÉLECTEUR DE DEVISE & PAYS : COMORES (KMF) OU SÉNÉGAL (FCFA) */}
            <div style={{ display: "flex", alignItems: "center", background: "var(--paper)", border: "1.5px solid var(--line)", borderRadius: 24, padding: "3px 4px", gap: 3 }}>
              {CURRENCIES.map(c => {
                const isActive = currentCurrency === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setActiveCurrency(c.code)}
                    style={{
                      border: "none",
                      background: isActive ? "var(--forest-dark)" : "transparent",
                      color: isActive ? "#ffffff" : "var(--ink)",
                      borderRadius: 18,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      transition: "all 0.15s ease",
                      boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.15)" : "none"
                    }}
                    title={`Afficher les prix en ${c.label}`}
                  >
                    <span style={{ letterSpacing: "0.03em" }}>{c.code}</span>
                  </button>
                );
              })}
            </div>

            {/* BOUTON CHANGER LE THÈME */}
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
              style={{
                background: "var(--paper)",
                border: "1.5px solid var(--line)",
                borderRadius: "50%",
                width: 42,
                height: 42,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--forest-dark)",
                transition: "all 0.2s ease",
                flexShrink: 0
              }}
            >
              {theme === "dark" ? <Sun size={19} color="#F59E0B" /> : <Moon size={19} color="var(--forest-dark)" />}
            </button>

            <button className="bs-cart-btn" onClick={() => setCartOpen(true)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 22px", borderRadius: 28,
              fontSize: 14.5, fontWeight: 800, flexShrink: 0
            }}>
              <ShoppingCart size={18} />
              <span>Panier</span>
              {count > 0 && <span className="bs-badge">{count}</span>}
            </button>
          </div>
        </div>

        {/* ROW 1.5: MOBILE SEARCH BAR (VISIBLE ONLY ON MOBILE/TABLET) */}
        <div className="bs-mobile-search-bar">
          <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 20px 12px 20px", position: "relative" }}>
            {/* Overlay background when search is focused */}
            <div style={{
              position: "fixed", inset: 0, background: "rgba(255,255,255,0.7)", backdropFilter: "blur(4px)",
              opacity: isSearchFocused ? 1 : 0, pointerEvents: isSearchFocused ? "auto" : "none",
              transition: "opacity 0.3s ease", zIndex: -1
            }} onClick={() => setIsSearchFocused(false)}></div>

            <form onSubmit={onSearch} style={{
              display: "flex", alignItems: "center", background: "var(--paper)",
              border: isSearchFocused ? "2px solid var(--forest)" : "1.5px solid var(--line)", 
              borderRadius: 24, padding: isSearchFocused ? "8px 16px" : "8px 12px",
              boxShadow: isSearchFocused ? "0 12px 40px rgba(0,0,0,0.12)" : "none",
              transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.2)",
              position: "relative", zIndex: 20
            }}>
              <Search size={16} color={isSearchFocused ? "var(--forest)" : "var(--muted)"} style={{ marginRight: isSearchFocused ? 6 : 4, flexShrink: 0, transition: "color 0.2s" }} />
              <input
                placeholder={isSearchFocused ? "Rechercher un produit..." : "Recherche"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => { 
                  setIsSearchFocused(true);
                  if (results.length > 0) setShowDropdown(true); 
                }}
                onBlur={() => {
                  setTimeout(() => setIsSearchFocused(false), 400);
                }}
                autoComplete="off"
                style={{
                  border: "none", background: "transparent", outline: "none",
                  width: "100%", fontSize: isSearchFocused ? 14 : 12.5, color: "var(--ink)", fontWeight: 500
                }}
              />
              {query && (
                <button type="button" onClick={clearSearch} style={{
                  background: "none", border: "none", cursor: "pointer", color: "var(--muted)",
                  display: "flex", alignItems: "center", padding: 0, marginLeft: 4
                }}>
                  <X size={15} />
                </button>
              )}
            </form>

            {/* LIVE SEARCH DROPDOWN */}
            {showDropdown && isSearchFocused && (
              <div style={{
                position: "absolute", top: "calc(100% - 4px)", left: 20, right: 20,
                background: "#fff", borderRadius: 16, border: "1px solid var(--line)",
                boxShadow: "0 16px 50px rgba(0,0,0,0.15)", zIndex: 3000, overflow: "hidden",
                animation: "popIn 0.2s ease-out"
              }}>
                {results.length === 0 ? (
                  <div style={{ padding: "16px 18px", fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
                    Aucun produit trouvé pour « {query} »
                  </div>
                ) : (
                  <>
                    {results.map(p => (
                      <div key={p.id} onMouseDown={() => goToProduct(p.id)} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                        cursor: "pointer", borderBottom: "1px solid var(--line)", transition: "background 0.15s"
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--paper)"}
                        onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                      >
                        <img
                          src={p.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=60&q=80"}
                          alt={p.nom}
                          style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid var(--line)" }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.nom}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.Category?.nom}</div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--forest-dark)", flexShrink: 0 }}>
                          {fcfa(p.prixPromo || p.prix)}
                        </div>
                      </div>
                    ))}
                    <div
                      onMouseDown={() => { setShowDropdown(false); navigate(`/catalogue?search=${encodeURIComponent(query.trim())}`); }}
                      style={{ padding: "10px 14px", textAlign: "center", fontSize: 13, color: "var(--forest)", fontWeight: 700, cursor: "pointer", background: "var(--forest-light)" }}
                    >
                      Voir tous les résultats pour « {query} »
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ROW 2: DESKTOP NAVIGATION BAR (BOUTONS MAQUETTE HAUT DE GAMME) */}
        <div className="bs-desktop-nav" style={{ position: "relative", zIndex: 100, background: "var(--card)", borderBottom: "1px solid var(--line)", padding: "10px clamp(16px, 2.5vw, 36px)" }}>
          <div style={{ maxWidth: 1520, margin: "0 auto", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            
            {/* ACCUEIL */}
            <Link
              to="/"
              style={{
                fontSize: 15, fontWeight: 700, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
                padding: "9px 20px", borderRadius: 30, transition: "all 0.2s ease",
                background: location.pathname === "/" ? "var(--forest-light)" : "transparent",
                color: location.pathname === "/" ? "var(--forest)" : "var(--ink)",
                border: location.pathname === "/" ? "1.5px solid var(--forest)" : "1.5px solid transparent",
                boxShadow: location.pathname === "/" ? "0 2px 10px rgba(190, 24, 93, 0.12)" : "none"
              }}
              onMouseEnter={(e) => {
                if (location.pathname !== "/") {
                  e.currentTarget.style.background = "var(--paper)";
                  e.currentTarget.style.borderColor = "var(--line)";
                }
              }}
              onMouseLeave={(e) => {
                if (location.pathname !== "/") {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "transparent";
                }
              }}
            >
              <Home size={18} /> <span>Accueil</span>
            </Link>

            {/* DEMANDE SUR-MESURE */}
            <Link
              to="/demande-sur-mesure"
              style={{
                fontSize: 15, fontWeight: 700, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
                padding: "9px 20px", borderRadius: 30, transition: "all 0.2s ease",
                background: location.pathname === "/demande-sur-mesure" ? "var(--forest-light)" : "transparent",
                color: location.pathname === "/demande-sur-mesure" ? "var(--forest)" : "var(--ink)",
                border: location.pathname === "/demande-sur-mesure" ? "1.5px solid var(--forest)" : "1.5px solid transparent",
                boxShadow: location.pathname === "/demande-sur-mesure" ? "0 2px 10px rgba(37, 99, 235, 0.12)" : "none"
              }}
              onMouseEnter={(e) => {
                if (location.pathname !== "/demande-sur-mesure") {
                  e.currentTarget.style.background = "var(--paper)";
                  e.currentTarget.style.borderColor = "var(--line)";
                }
              }}
              onMouseLeave={(e) => {
                if (location.pathname !== "/demande-sur-mesure") {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "transparent";
                }
              }}
            >
              <ClipboardList size={18} /> <span>Faire une demande</span>
            </Link>

            {/* CATALOGUE */}
            <Link
              to="/catalogue"
              style={{
                fontSize: 15, fontWeight: 700, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
                padding: "9px 20px", borderRadius: 30, transition: "all 0.2s ease",
                background: location.pathname === "/catalogue" && !location.search.includes("favoris=1") ? "var(--forest-light)" : "transparent",
                color: location.pathname === "/catalogue" && !location.search.includes("favoris=1") ? "var(--forest)" : "var(--ink)",
                border: location.pathname === "/catalogue" && !location.search.includes("favoris=1") ? "1.5px solid var(--forest)" : "1.5px solid transparent",
                boxShadow: location.pathname === "/catalogue" && !location.search.includes("favoris=1") ? "0 2px 10px rgba(190, 24, 93, 0.12)" : "none"
              }}
              onMouseEnter={(e) => {
                if (location.pathname !== "/catalogue" || location.search.includes("favoris=1")) {
                  e.currentTarget.style.background = "var(--paper)";
                  e.currentTarget.style.borderColor = "var(--line)";
                }
              }}
              onMouseLeave={(e) => {
                if (location.pathname !== "/catalogue" || location.search.includes("favoris=1")) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "transparent";
                }
              }}
            >
              <Grid size={18} /> <span>Catalogue</span>
            </Link>

            {/* FAVORIS */}
            <Link
              to="/catalogue?favoris=1"
              style={{
                fontSize: 15, fontWeight: 700, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
                padding: "9px 20px", borderRadius: 30, transition: "all 0.2s ease",
                background: location.search.includes("favoris=1") ? "#FDF2F0" : "transparent",
                color: location.search.includes("favoris=1") ? "#B4483A" : "var(--ink)",
                border: location.search.includes("favoris=1") ? "1.5px solid #B4483A" : "1.5px solid transparent",
                boxShadow: location.search.includes("favoris=1") ? "0 2px 10px rgba(180, 72, 58, 0.12)" : "none"
              }}
              onMouseEnter={(e) => {
                if (!location.search.includes("favoris=1")) {
                  e.currentTarget.style.background = "#FDF2F0";
                  e.currentTarget.style.borderColor = "rgba(180, 72, 58, 0.2)";
                }
              }}
              onMouseLeave={(e) => {
                if (!location.search.includes("favoris=1")) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "transparent";
                }
              }}
            >
              <span>Favoris</span>
            </Link>

            {/* MES COMMANDES */}
            {user?.role === "client" && (
              <Link
                to="/mes-commandes"
                style={{
                  fontSize: 15, fontWeight: 700, textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
                  padding: "9px 20px", borderRadius: 30, transition: "all 0.2s ease",
                  background: location.pathname === "/mes-commandes" ? "var(--forest-light)" : "transparent",
                  color: location.pathname === "/mes-commandes" ? "var(--forest)" : "var(--ink)",
                  border: location.pathname === "/mes-commandes" ? "1.5px solid var(--forest)" : "1.5px solid transparent"
                }}
              >
                <Package size={18} /> <span>Mes commandes</span>
              </Link>
            )}
          </div>
        </div>

        {/* ROW 3: SECONDARY CATEGORIES BAR & GALLERY (DROPDOWN PLEINEMENT VISIBLE ET FLOTTANT) */}
        <div style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)", padding: "10px clamp(16px, 2.5vw, 36px)", width: "100%", boxSizing: "border-box", position: "relative", zIndex: 50 }}>
          <div style={{ maxWidth: 1520, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, width: "100%", boxSizing: "border-box", position: "relative" }}>

            {/* DROPDOWN BUTTON FOR ALL CATEGORIES */}
            <div ref={categoriesRef} style={{ position: "relative", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setCategoriesOpen(!categoriesOpen)}
                style={{
                  background: "linear-gradient(135deg, var(--forest-dark, #831843), var(--forest, #BE185D))",
                  color: "#fff", border: "none", borderRadius: 26, padding: "10px 22px",
                  fontWeight: 800, fontSize: 14, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 10,
                  boxShadow: "0 4px 14px rgba(190, 24, 93, 0.25)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease"
                }}
              >
                <Menu size={18} /> <span>Toutes les catégories</span> <ChevronDown size={15} style={{ transform: categoriesOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </button>

              {categoriesOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 10px)", left: 0,
                  width: 290, background: "var(--card)", borderRadius: 16,
                  border: "1.5px solid var(--line)", boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
                  zIndex: 9999, overflow: "hidden", padding: "8px 0"
                }}>
                  {categories.length === 0 ? (
                    <div style={{ padding: "14px 18px", fontSize: 13, color: "var(--muted)" }}>Aucune catégorie</div>
                  ) : (
                    categories.map(cat => (
                      <div
                        key={cat.id}
                        onClick={() => {
                          setCategoriesOpen(false);
                          navigate(`/catalogue?categoryId=${cat.id}`);
                        }}
                        style={{
                          padding: "11px 18px", fontSize: 13.5, fontWeight: 700,
                          color: "var(--ink)", cursor: "pointer", display: "flex",
                          alignItems: "center", gap: 12, transition: "background 0.15s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--paper)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        {cat.imageUrl ? (
                          <img src={cat.imageUrl} alt={cat.nom} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)" }} />
                        ) : (
                          <Grid size={18} color="var(--forest)" />
                        )}
                        <span>{cat.nom}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* HORIZONTAL GALLERY / PILL LIST OF CATEGORIES */}
            <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none", padding: "4px 0", flex: 1, minWidth: 0 }}>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => navigate(`/catalogue?categoryId=${cat.id}`)}
                  style={{
                    background: "var(--card)", border: "1px solid var(--line)",
                    borderRadius: 22, padding: "7px 18px", fontSize: 13,
                    fontWeight: 700, color: "var(--ink)", cursor: "pointer",
                    whiteSpace: "nowrap", display: "inline-flex", alignItems: "center",
                    gap: 8, transition: "all 0.15s ease", boxShadow: "0 1px 4px rgba(0,0,0,0.03)"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--forest-light)"; e.currentTarget.style.borderColor = "var(--forest)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--card)"; e.currentTarget.style.borderColor = "var(--line)"; }}
                >
                  {cat.imageUrl && (
                    <img src={cat.imageUrl} alt={cat.nom} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
                  )}
                  <span>{cat.nom}</span>
                </button>
              ))}
            </div>

          </div>
        </div>

      </header>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="bs-mobile-bottom-bar">
        <Link to="/" className={`bs-mobile-nav-item ${location.pathname === "/" ? "active" : ""}`}>
          <Home size={20} />
          <span>Accueil</span>
        </Link>

        <Link to="/catalogue" className={`bs-mobile-nav-item ${location.pathname === "/catalogue" && !location.search.includes("favoris=1") ? "active" : ""}`}>
          <Grid size={20} />
          <span>Catalogue</span>
        </Link>



        <button className="bs-mobile-nav-item" onClick={() => setCartOpen(true)}>
          <div style={{ position: "relative", display: "flex" }}>
            <ShoppingCart size={20} />
            {count > 0 && <span className="bs-mobile-badge">{count}</span>}
          </div>
          <span>Panier</span>
        </button>

        {user ? (
          <Link to="/mes-commandes" className={`bs-mobile-nav-item ${location.pathname === "/mes-commandes" ? "active" : ""}`}>
            <Package size={20} />
            <span>Commandes</span>
          </Link>
        ) : (
          <Link to="/connexion" className={`bs-mobile-nav-item ${location.pathname === "/connexion" ? "active" : ""}`}>
            <User size={20} />
            <span>Connexion</span>
          </Link>
        )}

        <button className={`bs-mobile-nav-item ${mobileMoreOpen ? "active" : ""}`} onClick={() => setMobileMoreOpen(!mobileMoreOpen)}>
          <MoreHorizontal size={22} />
          <span>Plus</span>
        </button>
      </div>

      {/* MOBILE MORE POPUP CARD (ANCHORED ABOVE THE PLUS BUTTON) */}
      {mobileMoreOpen && (
        <>
          {/* Transparent Backdrop to close when clicking outside */}
          <div 
            onClick={() => setMobileMoreOpen(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 9998,
              background: "rgba(15, 23, 42, 0.25)"
            }}
          />

          {/* FLOATING POPUP CARD STYLED LIKE IOS MENUS */}
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              bottom: 72,
              right: 12,
              zIndex: 9999,
              width: 200,
              background: "#ffffff",
              borderRadius: 20,
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08)",
              border: "1px solid var(--line)",
              overflow: "hidden",
              animation: "popIn 0.2s cubic-bezier(0.165, 0.84, 0.44, 1)"
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <Link 
                to="/catalogue?favoris=1" 
                onClick={() => setMobileMoreOpen(false)} 
                style={{ 
                  display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", 
                  textDecoration: "none", color: "var(--ink)", fontWeight: 700, fontSize: 14,
                  borderBottom: user ? "1px solid var(--line)" : "none", background: "#fff",
                  transition: "background 0.15s"
                }}
              >
                <Heart size={18} color="#B4483A" fill="#B4483A" />
                <span style={{ flex: 1 }}>Favoris</span>
              </Link>

              <Link 
                to="/demande-sur-mesure" 
                onClick={() => setMobileMoreOpen(false)} 
                style={{ 
                  display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", 
                  textDecoration: "none", color: "var(--ink)", fontWeight: 700, fontSize: 14,
                  borderBottom: user ? "1px solid var(--line)" : "none", background: "#fff",
                  transition: "background 0.15s"
                }}
              >
                <ClipboardList size={18} color="#2563EB" />
                <span style={{ flex: 1 }}>Faire une demande sur-mesure</span>
              </Link>

              {user && (
                <>
                  <Link 
                    to="/profil" 
                    onClick={() => setMobileMoreOpen(false)} 
                    style={{ 
                      display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", 
                      textDecoration: "none", color: "var(--ink)", fontWeight: 700, fontSize: 14,
                      borderBottom: "1px solid var(--line)", background: "#fff",
                      transition: "background 0.15s"
                    }}
                  >
                    <User size={18} color="var(--forest-dark)" />
                    <span style={{ flex: 1 }}>Mon Profil</span>
                  </Link>

                  <button 
                    onClick={() => { setMobileMoreOpen(false); logout(); }} 
                    style={{ 
                      display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", 
                      background: "#fff", border: "none", cursor: "pointer", 
                      color: "#B4483A", fontWeight: 700, fontSize: 14, width: "100%", textAlign: "left"
                    }}
                  >
                    <LogOut size={18} color="#B4483A" />
                    <span style={{ flex: 1 }}>Déconnexion</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* MOBILE SEARCH OVERLAY WITH SEMI-TRANSPARENT BACKDROP */}
      {mobileSearchOpen && (
        <div
          className="bs-mobile-search-overlay"
          onClick={(e) => {
            if (e.target.classList.contains("bs-mobile-search-overlay")) {
              closeMobileSearch();
            }
          }}
        >
          <form onSubmit={onSearch} className="bs-mobile-search-form" onClick={(e) => e.stopPropagation()}>
            <div className="bs-mobile-search-pill">
              <Search size={18} color="#2563EB" style={{ flexShrink: 0 }} />
              <input
                ref={mobileSearchInputRef}
                placeholder="Ex: char, glace, pochette, airpods..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                className="bs-mobile-search-input"
              />
              {query ? (
                <button type="button" onClick={clearSearch} className="bs-mobile-search-clear">
                  <X size={18} />
                </button>
              ) : null}
            </div>
            <button type="button" onClick={closeMobileSearch} className="bs-mobile-search-close">
              Annuler
            </button>
          </form>

          {/* LIVE RESULTS IN MOBILE SEARCH OVERLAY */}
          {query.trim() && (
            <div className="bs-mobile-search-results" onClick={(e) => e.stopPropagation()}>
              {results.length === 0 ? (
                <div style={{ padding: "16px" }}>
                  <div style={{ color: "#DC2626", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                    Aucun accessoire trouvé pour « {query} »
                  </div>
                  {smartFallback?.suggestedTag && (
                    <button
                      onClick={() => {
                        closeMobileSearch();
                        navigate(smartFallback.suggestedTag.url);
                      }}
                      style={{
                        width: "100%", padding: "10px 14px", borderRadius: 10,
                        background: "#2563EB", color: "#fff", border: "none",
                        fontWeight: 700, fontSize: 13, marginBottom: 14, textAlign: "left"
                      }}
                    >
                      {smartFallback.suggestedTag.label} →
                    </button>
                  )}
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
                    Suggestions pour vous :
                  </div>
                  {(smartFallback?.recommendations || allProducts.slice(0, 3)).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => { closeMobileSearch(); goToProduct(p.id); }}
                      className="bs-mobile-search-item"
                    >
                      <img src={p.imageUrl || "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=60&q=80"} alt={p.nom} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="nom">{p.nom}</div>
                        <div className="cat">{p.marque?.nom || p.Category?.nom || "Accessoire"}</div>
                      </div>
                      <div className="prix">{fcfa(p.prixPromo || p.prix)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {results.map(p => (
                    <div
                      key={p.id}
                      onClick={() => { closeMobileSearch(); goToProduct(p.id); }}
                      className="bs-mobile-search-item"
                    >
                      <img src={p.imageUrl || "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=60&q=80"} alt={p.nom} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="nom">{p.nom}</div>
                        <div className="cat">
                          {(p.marque?.nom || p.Marque?.nom) ? `${p.marque?.nom || p.Marque?.nom} • ` : ""}
                          {p.Category?.nom || "Accessoire"}
                        </div>
                      </div>
                      <div className="prix">{fcfa(p.prixPromo || p.prix)}</div>
                    </div>
                  ))}
                  <div
                    onClick={() => {
                      closeMobileSearch();
                      navigate(`/catalogue?search=${encodeURIComponent(query.trim())}`);
                    }}
                    className="bs-mobile-search-see-all"
                  >
                    Voir tous les résultats pour « {query} »
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </>
  );
}
