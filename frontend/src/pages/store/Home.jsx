import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowRight, Star, CheckCircle, MessageCircle, X, ZoomIn, Truck, ShieldCheck, Sparkles, Leaf, Zap } from "lucide-react";
import api, { SLUG } from "../../api";
import ProductCard from "../../components/ProductCard.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";
import { useData } from "../../context/DataContext.jsx";

const DEFAULT_SLIDES = [
  {
    id: 1,
    tag: "CHARGE ULTRA RAPIDE GaN",
    title: "Chargeurs 20W à 65W & Câbles Renforcés",
    subtitle: "Rechargez votre iPhone, Samsung, Tecno ou Xiaomi en un temps record avec notre sélection haute performance certifiée anti-surchauffe.",
    imageUrl: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1200&q=80",
    buttonText: "Voir les chargeurs",
    linkUrl: "/catalogue?famille=Chargeurs",
    editorial: "Soilihitech Power",
    objectPosition: "center center"
  },
  {
    id: 2,
    tag: "PROTECTION TOTALE 9D",
    title: "Glaces Trempées & Coques Antichocs",
    subtitle: "Verres antiespion et pochettes antichocs en silicone renforcé pour préserver l'écran et les caméras de votre smartphone.",
    imageUrl: "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&w=1200&q=80",
    buttonText: "Protéger mon téléphone",
    linkUrl: "/catalogue?famille=Protections",
    editorial: "Blindage Soilihitech",
    objectPosition: "center center"
  },
  {
    id: 3,
    tag: "EXPERIENCE AUDIO & POWERBANKS",
    title: "AirPods, Écouteurs & Batteries 20 000mAh",
    subtitle: "Ne tombez plus jamais à court de batterie et profitez d'une qualité sonore cristalline avec notre sélection Oraimo, Apple et JBL.",
    imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=1200&q=80",
    buttonText: "Découvrir l'audio",
    linkUrl: "/catalogue?famille=Audio",
    editorial: "Audio & Énergie",
    objectPosition: "center center"
  }
];


const parseSlides = (bannerSlides) => {
  if (!bannerSlides) return DEFAULT_SLIDES;
  let parsed = bannerSlides;
  if (typeof bannerSlides === "string") {
    try {
      parsed = JSON.parse(bannerSlides);
    } catch (e) {
      return DEFAULT_SLIDES;
    }
  }
  if (Array.isArray(parsed) && parsed.length > 0) {
    return parsed.map((s, idx) => {
      const fallback = DEFAULT_SLIDES[idx % DEFAULT_SLIDES.length];
      const img = s.imageUrl || fallback.imageUrl;
      return {
        ...fallback,
        ...s,
        imageUrl: img
      };
    });
  }
  return DEFAULT_SLIDES;
};

const parseBanners = (banners) => {
  if (!banners) return [];
  let parsed = banners;
  if (typeof banners === "string") {
    try {
      parsed = JSON.parse(banners);
    } catch (e) {
      return [];
    }
  }
  return Array.isArray(parsed) ? parsed : [];
};

function CategoryScrollSection({ category, products, onNavigate, badgeColor = "var(--forest-dark)" }) {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -320 : 320;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div style={{ marginTop: 40, marginBottom: 40 }}>
      {/* SECTION HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: badgeColor, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {category.nom}
          </h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
            Découvrez notre sélection spéciale : {category.nom}.
          </p>
        </div>

        <button
          onClick={() => onNavigate()}
          style={{
            background: "none", border: "1px solid var(--line)", borderRadius: 20,
            padding: "8px 18px", fontSize: 13, fontWeight: 700, color: badgeColor,
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
            transition: "all 0.15s", whiteSpace: "nowrap"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--forest-light)"; e.currentTarget.style.borderColor = "var(--forest)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "var(--line)"; }}
        >
          Voir tout <ArrowRight size={15} />
        </button>
      </div>

      {/* SCROLL CONTAINER WITH ARROW CONTROLS */}
      <div style={{ position: "relative" }}>
        <button
          className="bs-scroll-arrow left"
          onClick={() => scroll("left")}
          style={{
            position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", zIndex: 10,
            width: 36, height: 36, borderRadius: "50%", background: "#fff", border: "1px solid var(--line)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
          }}
        >
          <ChevronLeft size={20} color={badgeColor} />
        </button>

        <div
          ref={scrollRef}
          style={{
            display: "flex", gap: 16, overflowX: "auto", scrollbarWidth: "none",
            msOverflowStyle: "none", padding: "8px 4px 16px 4px", scrollBehavior: "smooth"
          }}
        >
          {products.map((p) => (
            <div key={p.id} className="bs-scroll-item">
              <ProductCard product={p} />
            </div>
          ))}
        </div>

        <button
          className="bs-scroll-arrow right"
          onClick={() => scroll("right")}
          style={{
            position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", zIndex: 10,
            width: 36, height: 36, borderRadius: "50%", background: "#fff", border: "1px solid var(--line)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
          }}
        >
          <ChevronRight size={20} color={badgeColor} />
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const { getData, setData, isStale, invalidate } = useData();

  const [categories, setCategories] = useState(() => {
    const cached = getData(`categories:${SLUG}`);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    try {
      const ls = localStorage.getItem(`cached_categories_${SLUG}`);
      return ls ? JSON.parse(ls) : [];
    } catch (e) { return []; }
  });

  const [familles, setFamilles] = useState(() => {
    const cached = getData(`familles:${SLUG}`);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    try {
      const ls = localStorage.getItem(`cached_familles_${SLUG}`);
      return ls ? JSON.parse(ls) : [];
    } catch (e) { return []; }
  });

  const [products, setProducts] = useState(() => {
    const cached = getData(`products:${SLUG}:::`);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    try {
      const ls = localStorage.getItem(`cached_products_${SLUG}`);
      return ls ? JSON.parse(ls) : [];
    } catch (e) { return []; }
  });

  const [testimonials, setTestimonials] = useState([]);
  const [avisGenre, setAvisGenre] = useState("tous"); // 'tous' | 'femme' | 'homme'
  const [activeModalTestimonial, setActiveModalTestimonial] = useState(null);

  const [boutique, setBoutique] = useState(() => {
    try {
      const cached = localStorage.getItem(`cached_boutique_${SLUG}`);
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });

  const [activeSlide, setActiveSlide] = useState(0);
  const navigate = useNavigate();

  function loadData(force = false) {
    api.get(`/store/${SLUG}`).then((res) => {
      if (res.data) {
        setBoutique(res.data);
        try {
          localStorage.setItem(`cached_boutique_${SLUG}`, JSON.stringify(res.data));
        } catch (e) {}
      }
    }).catch(() => {});

    api.get(`/store/${SLUG}/testimonials`).then((res) => {
      if (Array.isArray(res.data)) {
        setTestimonials(res.data);
      }
    }).catch(() => {});

    if (!force && !isStale(`categories:${SLUG}`) && categories.length > 0 && products.length > 0) {
      return;
    }

    api.get(`/store/${SLUG}/categories`).then((res) => {
      if (Array.isArray(res.data)) {
        setData(`categories:${SLUG}`, res.data, 300000);
        setCategories(res.data);
        try { localStorage.setItem(`cached_categories_${SLUG}`, JSON.stringify(res.data)); } catch (e) {}
      }
    }).catch(() => {});

    api.get(`/store/${SLUG}/familles`).then((res) => {
      if (Array.isArray(res.data)) {
        setData(`familles:${SLUG}`, res.data, 600000);
        setFamilles(res.data);
        try { localStorage.setItem(`cached_familles_${SLUG}`, JSON.stringify(res.data)); } catch (e) {}
      }
    }).catch(() => {});

    api.get(`/store/${SLUG}/products`).then((res) => {
      if (Array.isArray(res.data)) {
        setData(`products:${SLUG}:::`, res.data, 120000);
        setProducts(res.data);
        try { localStorage.setItem(`cached_products_${SLUG}`, JSON.stringify(res.data)); } catch (e) {}
      }
    }).catch(() => {});
  }

  useEffect(() => {
    loadData(false);
    const unsub = subscribeRealtime((detail) => {
      if (
        detail.type === "product_updated" ||
        detail.type === "category_updated" ||
        detail.type === "boutique_updated"
      ) {
        invalidate("products");
        invalidate("categories");
        loadData(true);
      }
    });
    return unsub;
  }, []);

  const slides = parseSlides(boutique?.bannerSlides);
  const sideBanners = parseBanners(boutique?.sideBanners);

  useEffect(() => {
    const total = slides.length;
    if (total <= 1) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % total);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const safeProducts = Array.isArray(products) ? products : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeFamilles = Array.isArray(familles) && familles.length > 0
    ? familles
    : [
        { id: 1, nom: "Chargeurs & Blocs Rapides" },
        { id: 2, nom: "Glaces & Protections Écran" },
        { id: 3, nom: "Pochettes & Coques Antichoc" },
        { id: 4, nom: "Écouteurs, Casques & Audio" }
      ];

  function getNormalizedFamilleName(str) {
    if (!str) return "";
    let s = String(str).trim();
    if (s.toLowerCase().startsWith("section ")) {
      s = s.slice(8).trim();
    } else if (s.toLowerCase() === "section") {
      s = "";
    }
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const familleMap = new Map();
  safeFamilles.forEach(f => {
    const norm = getNormalizedFamilleName(f.nom);
    if (norm && !familleMap.has(norm.toLowerCase())) {
      familleMap.set(norm.toLowerCase(), norm);
    }
  });

  safeProducts.forEach(p => {
    const raw = p.Category?.famille || p.famille;
    const norm = getNormalizedFamilleName(raw);
    if (norm && !familleMap.has(norm.toLowerCase())) {
      familleMap.set(norm.toLowerCase(), norm);
    }
  });

  const uniqueFamilles = Array.from(familleMap.values());
  const promos = safeProducts.filter((p) => p && (p.enPromo || p.prixPromo));

  // Témoignages clients vérifiés
  const filteredTestimonials = testimonials || [];

  // Pour défilement continu infini sans accroc, dupliquer la liste si >= 2 éléments
  const displayTestimonials = filteredTestimonials.length > 0 
    ? [...filteredTestimonials, ...filteredTestimonials, ...filteredTestimonials] 
    : [];

  function handleBannerClick(banner) {
    if (banner.categoryId) {
      navigate(`/catalogue?categoryId=${banner.categoryId}`);
    } else if (banner.linkUrl) {
      navigate(banner.linkUrl);
    } else {
      navigate("/catalogue");
    }
  }

  // Système de texte dynamique Soilihitech Accessoires High-Tech
  const currentSlideDisplay = (() => {
    const slide = slides[activeSlide] || slides[0] || {};
    const defaultTitles = [
      "Chargeurs 20W à 65W & Câbles Renforcés",
      "Glaces Trempées & Coques Antichocs",
      "AirPods, Écouteurs & Batteries 20 000mAh"
    ];
    const defaultSubs = [
      "Rechargez votre iPhone, Samsung, Tecno ou Xiaomi en un temps record avec notre sélection haute performance certifiée anti-surchauffe.",
      "Verres antiespion et pochettes antichocs en silicone renforcé pour préserver l'écran et les caméras de votre smartphone.",
      "Ne tombez plus jamais à court de batterie et profitez d'une qualité sonore cristalline avec notre sélection Oraimo, Apple et JBL."
    ];
    const defaultTags = [
      "CHARGE ULTRA RAPIDE GaN",
      "PROTECTION TOTALE 9D",
      "EXPERIENCE AUDIO & POWERBANKS"
    ];
    const defaultCtas = [
      "Voir les chargeurs",
      "Protéger mon téléphone",
      "Découvrir l'audio"
    ];
    const defaultEditorials = [
      "Soilihitech Power",
      "Blindage Soilihitech",
      "Audio & Énergie"
    ];

    const idx = activeSlide % defaultTitles.length;
    return {
      tag: slide.tag || defaultTags[idx],
      title: slide.title || slide.shortTitle || defaultTitles[idx],
      subtitle: slide.subtitle || slide.shortSubtitle || defaultSubs[idx],
      buttonText: slide.buttonText || defaultCtas[idx],
      imageUrl: slide.imageUrl,
      linkUrl: slide.linkUrl,
      editorial: slide.editorial || defaultEditorials[idx]
    };
  })();

  return (
    <>
      {/* 1. HERO BANNER - SOILIHITECH MODERNE */}
      <div className="bs-hero-banner">
        {/* Colonne Gauche (37%) : Texte épuré, bouton & badges */}
        <div className="bs-hero-text-col">
          <div key={activeSlide} className="bs-hero-text-animated">
            <div className="bs-hero-collection-tag">
              <span className="bs-hero-tag-dot"></span>
              {currentSlideDisplay.tag}
            </div>
            <h1 className="bs-hero-title">
              {currentSlideDisplay.title}
            </h1>
            <p className="bs-hero-subtitle">
              {currentSlideDisplay.subtitle}
            </p>
            <div className="bs-hero-cta-wrap">
              <button 
                className="bs-hero-cta-btn" 
                onClick={() => handleBannerClick(slides[activeSlide] || {})}
              >
                <span>{currentSlideDisplay.buttonText}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>

          {/* Badges de Confiance compacts en ligne */}
          <div className="bs-hero-trust-row">
            <div className="bs-hero-trust-item" title="100% Compatible iPhone, Samsung, Tecno">
              <ShieldCheck size={14} className="bs-hero-trust-icon-inline" />
              <span>100% Compatible</span>
            </div>
            <span className="bs-hero-trust-sep">•</span>
            <div className="bs-hero-trust-item" title="Norme CE & Charge Sécurisée">
              <Zap size={14} className="bs-hero-trust-icon-inline" />
              <span>Normes Anti-surchauffe</span>
            </div>
            <span className="bs-hero-trust-sep">•</span>
            <div className="bs-hero-trust-item" title="Expédition rapide Comores & Régions">
              <Truck size={14} className="bs-hero-trust-icon-inline" />
              <span>Livraison Express</span>
            </div>
          </div>
        </div>

        {/* Colonne Droite (63%) : Fenêtre Photo Large qui Défile */}
        <div className="bs-hero-slider-window">
          <div 
            className="bs-hero-slider-track"
            style={{
              display: "flex",
              width: `${slides.length * 100}%`,
              height: "100%",
              transform: `translateX(-${(activeSlide * 100) / slides.length}%)`,
              transition: "transform 0.65s cubic-bezier(0.25, 1, 0.5, 1)"
            }}
          >
            {slides.map((slide, idx) => {
              const defaultObjPos = idx === 0 ? "center 82%" : idx === 1 ? "center 26%" : "center center";
              return (
                <div 
                  key={slide.id || idx} 
                  className="bs-hero-slide-img-wrap"
                  style={{
                    width: `${100 / slides.length}%`,
                    height: "100%"
                  }}
                  onClick={() => handleBannerClick(slide)}
                >
                  <img 
                    src={slide.imageUrl} 
                    alt={slide.title} 
                    className="bs-hero-slide-img"
                    style={{
                      objectPosition: slide.objectPosition || defaultObjPos
                    }}
                    onError={(e) => {
                      e.currentTarget.src = "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=80";
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Badge Élégant Flottant sur la photo */}
          <div className="bs-hero-floating-badge">
            <span>{currentSlideDisplay.editorial}</span>
          </div>

          {/* Boutons flèches de navigation circulaires (style Velloria) */}
          {slides.length > 1 && (
            <>
              <button 
                className="bs-hero-nav-btn prev" 
                onClick={(e) => { e.stopPropagation(); setActiveSlide((prev) => (prev - 1 + slides.length) % slides.length); }}
                aria-label="Diapositive précédente"
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                className="bs-hero-nav-btn next" 
                onClick={(e) => { e.stopPropagation(); setActiveSlide((prev) => (prev + 1) % slides.length); }}
                aria-label="Diapositive suivante"
              >
                <ChevronRight size={18} />
              </button>

              {/* Points indicateurs de défilement en bas à droite */}
              <div className="bs-hero-dots">
                {slides.map((_, idx) => (
                  <button 
                    key={idx} 
                    className={`bs-hero-dot ${idx === activeSlide ? "active" : ""}`}
                    onClick={(e) => { e.stopPropagation(); setActiveSlide(idx); }}
                    aria-label={`Aller au slide ${idx + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. CATÉGORIES EN HAUT (TOUJOURS IMMÉDIATEMENT APRÈS LE BANNER) */}
      <div className="bs-section-title">
        <h2>Catégories Accessoires Téléphonie</h2>
      </div>
      <div className="bs-cats">
        {safeCategories.map((c) => (
          <div 
            key={c.id} 
            className="bs-cat-card" 
            onClick={() => navigate(`/catalogue?categoryId=${c.id}`)}
          >
            <img 
              src={c.imageUrl || "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=300&q=80"} 
              alt={c.nom} 
              loading="lazy"
              decoding="async"
              className="bs-cat-img" 
            />
            <div className="bs-cat-name">{c.nom}</div>
          </div>
        ))}
      </div>

      {/* 3. OFFRES & PROMOTIONS (EN SUITE) */}
      {promos.length > 0 && (
        <>
          <div className="bs-section-title" style={{ marginTop: 36 }}>
            <h2>Offres & Promotions</h2>
          </div>
          <div className="bs-grid-home">
            {promos.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </>
      )}

      {/* 4. NOUVEAUX ARRIVAGES (PUIS) */}
      {safeProducts.length > 0 && (() => {
        const customNouveaux = safeProducts.filter(p => p.isNouveau || p.isNouveau === true || p.isNouveau === 1);
        const displayNouveaux = customNouveaux.length > 0 
          ? customNouveaux 
          : [...safeProducts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);

        return (
          <CategoryScrollSection
            category={{ id: "new", nom: "Nouveaux Arrivages" }}
            products={displayNouveaux}
            onNavigate={() => navigate("/catalogue")}
          />
        );
      })()}

      {/* BANNIÈRES PROMOTIONNELLES / SLIDE BANNERS (JUSTE EN BAS DE NOUVEAUX ARRIVAGES) */}
      {sideBanners.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: sideBanners.length === 1 ? "1fr" : "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
          marginTop: 16,
          marginBottom: 40,
          width: "100%"
        }}>
          {sideBanners.map((sb, idx) => (
            <div
              key={idx}
              onClick={() => handleBannerClick(sb)}
              style={{
                borderRadius: 20,
                overflow: "hidden",
                position: "relative",
                height: 220,
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                border: "1px solid var(--line)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 14px 32px rgba(0,0,0,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)";
              }}
            >
              <img
                src={sb.imageUrl}
                alt={sb.title || "Banner"}
                loading="lazy"
                decoding="async"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  imageRendering: "-webkit-optimize-contrast"
                }}
              />
              <div style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to top, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.35) 50%, transparent 100%)",
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end"
              }}>
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(255,255,255,0.2)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  padding: "4px 12px",
                  borderRadius: 20,
                  width: "fit-content",
                  marginBottom: 8
                }}>
                  Édition Spéciale
                </div>
                {sb.title && <div style={{ color: "#fff", fontWeight: 800, fontSize: "clamp(17px, 2vw, 21px)", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>{sb.title}</div>}
                {sb.subtitle && <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, marginTop: 4, textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>{sb.subtitle}</div>}
              </div>
            </div>
          ))}
        </div>
      )}


      {/* 6. SECTIONS PAR FAMILLE / CATÉGORIE (LIMITÉES À 3 SECTIONS MAXIMUM SUR L'ACCUEIL) */}
      {(() => {
        const sectionsWithProducts = uniqueFamilles
          .map((famName) => {
            const normTarget = famName.toLowerCase();
            const famProds = safeProducts.filter(p => {
              const pFam = getNormalizedFamilleName(p.Category?.famille || p.famille);
              return pFam.toLowerCase() === normTarget;
            });
            return { famName, normTarget, famProds };
          })
          .filter(s => s.famProds.length > 0);

        const displayedSections = sectionsWithProducts.slice(0, 3);

        return (
          <>
            {displayedSections.map(({ famName, normTarget, famProds }) => (
              <CategoryScrollSection
                key={normTarget}
                category={{ id: `fam-${normTarget}`, nom: `Section ${famName}` }}
                products={famProds}
                onNavigate={() => navigate(`/catalogue?famille=${encodeURIComponent(famName)}`)}
              />
            ))}

            {/* BOUTON POUR VOIR TOUTES LES SECTIONS ET TOUT LE CATALOGUE */}
            <div style={{ textAlign: "center", marginTop: 36, marginBottom: 28 }}>
              <button
                type="button"
                onClick={() => navigate("/catalogue")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 34px",
                  borderRadius: 30,
                  fontSize: 15,
                  fontWeight: 800,
                  background: "linear-gradient(135deg, var(--forest-dark, #831843), var(--forest, #BE185D))",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 6px 20px rgba(190, 24, 93, 0.28)",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 26px rgba(190, 24, 93, 0.38)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(190, 24, 93, 0.28)";
                }}
              >
                <span>Voir toutes les sections & tout le catalogue</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </>
        );
      })()}



      {/* 8. SECTION CE QUE DISENT NOS CLIENTS (TÉMOIGNAGES WHATSAPP EN FIN JUSTE AVANT LE FOOTER) */}
      {filteredTestimonials.length > 0 && (
        <div style={{ marginTop: 48, marginBottom: 32, background: "var(--card)", padding: "28px 20px", borderRadius: 24, border: "1px solid var(--line)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#DCFCE7", color: "#15803D", padding: "4px 10px", borderRadius: 16, fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <MessageCircle size={14} /> Retours Vérifiés WhatsApp
                </span>
                <span style={{ fontSize: 13, color: "#F59E0B", fontWeight: 800 }}>⭐⭐⭐⭐⭐ 4.9/5</span>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 0", color: "var(--ink)", letterSpacing: "0.3px" }}>
                Ce que nos clients disent
              </h2>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
                Messages et captures réelles envoyées par nos clients après réception de leurs commandes.
              </p>
            </div>
          </div>

          {/* DÉFILEMENT CONTINU INFINI EN BOUCLE (PAUSE AU SURVOL) */}
          <div className="bs-testimonials-container">
            <div className="bs-testimonials-track">
              {displayTestimonials.map((t, index) => (
                <div 
                  key={`${t.id}-${index}`} 
                  className="bs-testimonial-card"
                  onClick={() => setActiveModalTestimonial(t)}
                  title="Cliquez pour agrandir et lire l'avis"
                >
                  {/* EN-TÊTE DU CLIENT */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <img 
                      src={t.photoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"} 
                      alt={t.nom} 
                      style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid #25D366" }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.nom}
                        </span>
                        <CheckCircle size={14} color="#16A34A" />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                        {Array.from({ length: t.note || 5 }).map((_, i) => (
                          <Star key={i} size={13} fill="#F59E0B" color="#F59E0B" />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* CONTENU DE L'AVIS */}
                  {t.type === "capture_whatsapp" && t.captureUrl ? (
                    <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)", background: "var(--paper)", marginBottom: 10 }}>
                      <img 
                        src={t.captureUrl} 
                        alt="Capture WhatsApp" 
                        style={{ width: "100%", height: 170, objectFit: "cover" }} 
                      />
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 80%)",
                        padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff", fontSize: 11.5, fontWeight: 700
                      }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MessageCircle size={13} color="#25D366" /> Capture vérifiée</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(255,255,255,0.25)", padding: "2px 8px", borderRadius: 12 }}><ZoomIn size={12} /> Voir</span>
                      </div>
                    </div>
                  ) : null}

                  {t.message && (
                    <div className="bs-testimonial-message">
                      "{t.message}"
                    </div>
                  )}

                  <div style={{ marginTop: "auto", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      Avis Client Vérifié
                    </span>
                    <span style={{ fontSize: 11.5, color: "#16A34A", fontWeight: 800 }}>
                      ✓ Reçu sur WhatsApp
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- MODAL LIGHTBOX PLEIN ÉCRAN POUR VOIR LA CAPTURE ET LE TEXTE EN GRAND AVEC BOUTON FERMER ---- */}
      {activeModalTestimonial && (
        <div 
          onClick={() => setActiveModalTestimonial(null)}
          className="bs-testimonial-modal-backdrop"
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(15, 23, 42, 0.85)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bs-testimonial-modal-dialog"
            style={{
              borderRadius: 24, maxWidth: 650, width: "100%", maxHeight: "90vh",
              overflowY: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.35)", position: "relative",
              display: "flex", flexDirection: "column"
            }}
          >
            {/* EN-TÊTE MODALE AVEC BOUTON FERMER (X) BIEN VISIBLE */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img 
                  src={activeModalTestimonial.photoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"} 
                  alt={activeModalTestimonial.nom} 
                  style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: "2.5px solid #25D366" }}
                />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>{activeModalTestimonial.nom}</h3>
                    <CheckCircle size={16} color="#16A34A" />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                    {Array.from({ length: activeModalTestimonial.note || 5 }).map((_, i) => (
                      <Star key={i} size={14} fill="#F59E0B" color="#F59E0B" />
                    ))}
                    <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 700, marginLeft: 6 }}>• Avis vérifié WhatsApp</span>
                  </div>
                </div>
              </div>

              {/* BOUTON FERMER TRÈS CLAIR */}
              <button
                onClick={() => setActiveModalTestimonial(null)}
                className="bs-testimonial-close-btn"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  borderRadius: 20,
                  padding: "8px 16px", fontSize: 13, fontWeight: 800,
                  cursor: "pointer", transition: "all 0.2s"
                }}
              >
                <X size={18} /> Fermer
              </button>
            </div>

            {/* CORPS DE LA MODALE */}
            <div style={{ padding: 24 }}>
              {activeModalTestimonial.captureUrl ? (
                <div style={{ marginBottom: 18, borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)", background: "#0F172A", textAlign: "center" }}>
                  <img 
                    src={activeModalTestimonial.captureUrl} 
                    alt="Capture d'écran du message WhatsApp" 
                    style={{ width: "100%", maxHeight: "55vh", objectFit: "contain", display: "block" }} 
                  />
                </div>
              ) : null}

              {activeModalTestimonial.message && (
                <div className="bs-testimonial-modal-msg">
                  <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <MessageCircle size={15} /> Message envoyé par {activeModalTestimonial.nom} :
                  </div>
                  "{activeModalTestimonial.message}"
                </div>
              )}
            </div>

            {/* PIED DE MODALE AVEC BOUTON FERMER */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--line)", background: "var(--paper)", borderBottomLeftRadius: 24, borderBottomRightRadius: 24, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setActiveModalTestimonial(null)}
                className="bs-btn-primary"
                style={{ padding: "8px 24px", borderRadius: 20 }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
