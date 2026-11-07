import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area, Legend } from "recharts";
import { TrendingUp, ShoppingBag, AlertTriangle, Layers, DollarSign, Package, Users, Star, UserCheck, CheckCircle2, Clock, CheckCircle, PiggyBank, Receipt, Store, Globe } from "lucide-react";
import api from "../../api";
import Stars from "../../components/Stars.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";
import { Skel, SkeletonStatCards } from "../../components/Skeleton.jsx";
import { readCache, writeCache } from "../../utils/swrCache.js";

import { formatPrice, getActiveCurrency, setActiveCurrency, getBoutiqueCurrencies, getCurrencyMeta } from "../../utils/currency.js";

export default function Dashboard() {
  const { user, boutique, theme, myBoutiques = [], activeBoutiqueId, switchAdminBoutique } = useAuth();
  const [data, setData] = useState(() => readCache("admin_dashboard") || null);
  const [multiOverview, setMultiOverview] = useState(null);
  const [showMultiBoutiquesView, setShowMultiBoutiquesView] = useState(false);

  const isEmploye = user?.role === "employe";
  const isMultiBoutiqueAdmin = user?.role === "admin" && myBoutiques.length > 1;
  const assignedCurrency = isEmploye && user?.deviseAutorisee && user.deviseAutorisee !== "TOUTES"
    ? user.deviseAutorisee
    : null;

  const boutiqueCurrencies = getBoutiqueCurrencies({
    devisesDisponibles: data?.devisesDisponibles || boutique?.devisesDisponibles,
    devise: boutique?.devise
  });
  const isSingleCurrencyBoutique = boutiqueCurrencies.length === 1;
  const singleCurrencyCode = boutiqueCurrencies[0]?.code || boutique?.devise || "KMF";

  const [activeCurrency, setActiveCurrencyState] = useState(() => assignedCurrency || getActiveCurrency() || singleCurrencyCode);
  const [countryFilter, setCountryFilter] = useState(() => assignedCurrency || getActiveCurrency() || singleCurrencyCode);
  const [prodChartTab, setProdChartTab] = useState("top");

  useEffect(() => {
    const allowedCodes = boutiqueCurrencies.map(c => c.code);
    if (isSingleCurrencyBoutique) {
      setActiveCurrencyState(singleCurrencyCode);
      setCountryFilter(singleCurrencyCode);
      return;
    }
    const cur = assignedCurrency || getActiveCurrency() || singleCurrencyCode;
    const validCur = allowedCodes.includes(cur) ? cur : singleCurrencyCode;
    setActiveCurrencyState(validCur);
    setCountryFilter((prev) => (prev === "ALL" && !assignedCurrency ? "ALL" : validCur));

    const handleCurChange = (e) => {
      if (isSingleCurrencyBoutique) {
        setActiveCurrencyState(singleCurrencyCode);
        setCountryFilter(singleCurrencyCode);
      } else if (assignedCurrency) {
        setActiveCurrencyState(assignedCurrency);
        setCountryFilter(assignedCurrency);
      } else {
        const newCur = e.detail || getActiveCurrency() || singleCurrencyCode;
        if (allowedCodes.includes(newCur)) {
          setActiveCurrencyState(newCur);
          setCountryFilter(newCur);
        }
      }
    };
    window.addEventListener("currency_changed", handleCurChange);
    return () => window.removeEventListener("currency_changed", handleCurChange);
  }, [boutique?.devise, JSON.stringify(boutique?.devisesDisponibles), JSON.stringify(data?.devisesDisponibles), assignedCurrency, isSingleCurrencyBoutique, singleCurrencyCode]);

  const handleFilterCountry = (filter) => {
    if (assignedCurrency || isSingleCurrencyBoutique) return;
    setCountryFilter(filter);
    if (filter !== "ALL") {
      setActiveCurrency(filter);
      setActiveCurrencyState(filter);
    }
  };

  const storeDevise = isSingleCurrencyBoutique ? singleCurrencyCode : (activeCurrency || boutique?.devise || "KMF");
  const isDark = theme === "dark";

  const chartColors = {
    stroke: isDark ? "#10B981" : "#163424",
    grid: isDark ? "rgba(255, 255, 255, 0.12)" : "#E5E9DE",
    axisText: isDark ? "#94A3B8" : "#64748B",
    yAxisCategoryText: isDark ? "#F1F5F9" : "var(--ink)",
    tooltipBg: isDark ? "#1E293B" : "#FFFFFF",
    tooltipText: isDark ? "#F8FAFC" : "#1E293B",
    tooltipBorder: isDark ? "#334155" : "#E2E8F0",
    badgeBg: isDark ? "rgba(16, 185, 129, 0.15)" : "#EBF7F0",
    badgeText: isDark ? "#34D399" : "#163424",
    barFill: isDark ? "#6366F1" : "#4F46E5",
  };

  function loadDashboard() {
    api.get("/admin/dashboard").then((res) => {
      setData(res.data);
      writeCache("admin_dashboard", res.data);
    }).catch(() => {});
    if (user?.role === "admin") {
      api.get("/admin/multi-boutiques-overview").then((res) => {
        setMultiOverview(res.data);
      }).catch(() => {});
    }
  }

  useEffect(() => {
    loadDashboard();
    const unsub = subscribeRealtime((detail) => {
      const t = detail?.type || detail;
      if (
        t === "order_created" ||
        t === "order_updated" ||
        t === "order_deleted" ||
        t === "product_updated" ||
        t === "product_created" ||
        t === "product_deleted" ||
        t === "achat_updated" ||
        t === "category_updated" ||
        t === "expense_updated" ||
        t === "saving_updated" ||
        t === "boutique_updated" ||
        t === "user_registered"
      ) {
        loadDashboard();
      }
    });
    const onFocus = () => { if (!document.hidden) loadDashboard(); };
    const onBoutiqueSwitch = () => loadDashboard();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("boutique_switched", onBoutiqueSwitch);
    return () => {
      if (typeof unsub === "function") unsub();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("boutique_switched", onBoutiqueSwitch);
    };
  }, [activeBoutiqueId]);

  if (!data) return (
    <div role="status" aria-label="Chargement">
      <Skel w={280} h={26} style={{ marginBottom: 10 }} />
      <Skel w={360} h={12} style={{ marginBottom: 24 }} />
      <SkeletonStatCards count={8} />
      <div className="bs-dashboard-charts-grid">
        <div className="bs-panel bs-dashboard-chart-card" style={{ padding: 20 }}><Skel h={250} r={12} /></div>
        <div className="bs-panel bs-dashboard-chart-card" style={{ padding: 20 }}><Skel h={250} r={12} /></div>
      </div>
    </div>
  );

  // ── 1. DASHBOARD SPÉCIFIQUE À L'EMPLOYÉ ──
  if (data.isEmploye || user?.role === "employe") {
    const listCmds = data.mesCommandes || [];

    return (
      <>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "inline-block", background: "var(--forest-light)", color: "var(--forest)", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            Espace Opérationnel Employé
          </div>
          <h1 style={{ fontSize: "clamp(20px, 4vw, 26px)", margin: 0, color: "var(--forest-dark)" }}>Mon Tableau de bord & Activités</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Bonjour {user?.nom}, voici un récapitulatif de votre chiffre d'affaires et de vos commandes chez {boutique?.nom || "la boutique"}.
          </p>
        </div>

        <div className="bs-dashboard-kpi-grid">
          <div className="bs-panel bs-dashboard-kpi-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase" }}>Chiffre d'affaires</span>
              <div style={{ background: "var(--forest-light)", padding: 6, borderRadius: 8, color: "var(--forest)" }}>
                <TrendingUp size={18} />
              </div>
            </div>
            <div style={{ fontSize: "clamp(17px, 3.8vw, 22px)", fontWeight: 800, color: "var(--ink)", wordBreak: "break-word" }}>{formatPrice(data.monChiffreAffaires || 0, storeDevise)}</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Commandes traitées</div>
          </div>

          <div className="bs-panel bs-dashboard-kpi-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase" }}>Commandes Livrées</span>
              <div style={{ background: "#EBF7F0", padding: 6, borderRadius: 8, color: "#1F4D3A" }}>
                <CheckCircle size={18} />
              </div>
            </div>
            <div style={{ fontSize: "clamp(17px, 3.8vw, 22px)", fontWeight: 800, color: "var(--ink)" }}>{data.nbMesCommandesLivrees || 0}</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Livrées au client</div>
          </div>

          <div className="bs-panel bs-dashboard-kpi-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase" }}>Commandes En cours</span>
              <div style={{ background: "#FEF3C7", padding: 6, borderRadius: 8, color: "#D97706" }}>
                <Clock size={18} />
              </div>
            </div>
            <div style={{ fontSize: "clamp(17px, 3.8vw, 22px)", fontWeight: 800, color: "var(--ink)" }}>{data.nbMesCommandesEnCours || 0}</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>En cours de traitement</div>
          </div>

          <div className="bs-panel bs-dashboard-kpi-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase" }}>Total Assignations</span>
              <div style={{ background: "var(--forest-light)", padding: 6, borderRadius: 8, color: "var(--forest)" }}>
                <ShoppingBag size={18} />
              </div>
            </div>
            <div style={{ fontSize: "clamp(17px, 3.8vw, 22px)", fontWeight: 800, color: "var(--ink)" }}>{data.nbMesCommandes || 0}</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Total des commandes</div>
          </div>
        </div>

        <div className="bs-panel" style={{ padding: "20px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--forest-dark)" }}>Mes Commandes Assignées</h3>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                Gérez l'avancement et la livraison des commandes sous votre responsabilité.
              </div>
            </div>
            <Link to="/admin/commandes" style={{ fontSize: 13, fontWeight: 700, color: "var(--forest)", textDecoration: "none" }}>
              Gérer les commandes →
            </Link>
          </div>

          {listCmds.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
              Vous n'avez actuellement aucune commande assignée.
            </div>
          ) : (
            <div className="bs-dashboard-orders-grid">
              {listCmds.map((c) => {
                const cmdNum = "COM-B" + String(c.id).padStart(3, "0");
                const statusBadges = {
                  en_attente: { label: "En attente", bg: "#FEF3C7", color: "#92400E" },
                  validee: { label: "Validée", bg: "#E0E7FF", color: "#3730A3" },
                  en_preparation: { label: "En préparation", bg: "#DBEAFE", color: "#1E40AF" },
                  en_livraison: { label: "En livraison", bg: "#E0F2FE", color: "#075985" },
                  livree: { label: "Livrée", bg: "#D1FAE5", color: "#065F46" },
                  annulee: { label: "Annulée", bg: "#FEE2E2", color: "#991B1B" },
                };
                const st = statusBadges[c.statut] || { label: c.statut, bg: "#E5E7EB", color: "#374151" };

                return (
                  <div key={c.id} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14, background: "var(--paper)", minWidth: 0, boxSizing: "border-box" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontWeight: 800, fontSize: 14.5, color: "var(--forest-dark)" }}>#{cmdNum}</span>
                      <span style={{ background: st.bg, color: st.color, padding: "3px 9px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                        {st.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      Client: {c.client?.nom || "Client non inscrit"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Tél: {c.client?.telephone || c.telephoneClient || "Non renseigné"}</div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px dashed var(--line)" }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: "var(--forest)", whiteSpace: "nowrap" }}>{formatPrice(c.total, c.devise || storeDevise)}</span>
                      <Link to="/admin/commandes" style={{ fontSize: 12, fontWeight: 700, color: "var(--forest-dark)", textDecoration: "underline" }}>
                        Modifier statut
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  }

  // ── Helper pour récupérer les stats d'une devise spécifique ──
  const getCurrencyStats = (code) => {
    const upper = String(code || "KMF").toUpperCase();
    if (data.statsByCurrency && data.statsByCurrency[upper]) {
      return data.statsByCurrency[upper];
    }
    if (upper === "KMF" && data.comores) return data.comores;
    if (upper === "FCFA" && data.senegal) return data.senegal;
    return {
      chiffreAffaires: 0,
      coutAchats: 0,
      beneficeVentes: 0,
      depenses: 0,
      epargne: 0,
      beneficeNet: 0,
      nbCommandes: 0,
      totalVentesCount: 0,
      panierMoyen: 0,
      valeurStockVente: 0,
      chartData: [],
      modesPaiement: []
    };
  };

  const effectiveFilter = isSingleCurrencyBoutique ? singleCurrencyCode : countryFilter;
  const isAll = !isSingleCurrencyBoutique && effectiveFilter === "ALL";
  const currenciesToRender = isAll
    ? boutiqueCurrencies
    : boutiqueCurrencies.filter(c => c.code === effectiveFilter);
  const activeCurrenciesList = currenciesToRender.length > 0 ? currenciesToRender : [boutiqueCurrencies[0]];

  const primarySelectedCurrency = isAll ? singleCurrencyCode : activeCurrenciesList[0]?.code || singleCurrencyCode;
  const primaryStats = getCurrencyStats(primarySelectedCurrency);

  const currentChartData = isAll
    ? (data.chartData || [])
    : (primaryStats.chartData?.length ? primaryStats.chartData : (data.chartData || []));

  const currentCurrencySymbol = isAll ? singleCurrencyCode : primarySelectedCurrency;

  const currentModesPaiement = !isAll && primaryStats.modesPaiement?.length
    ? primaryStats.modesPaiement
    : [
        { name: "Espèces (Cash)", value: Math.max(1, data.nbCommandes || 1) },
        { name: "Paiement Mobile", value: Math.max(1, Math.round(((data.nbCommandes || 1) * 0.4))) }
      ];

  const activeProductsChart = prodChartTab === "top" ? (data.top7Produits || []) : (data.flop7Produits || []);

  return (
    <>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--forest-light)", color: "var(--forest)", padding: "3px 10px", borderRadius: 16, fontSize: 11.5, fontWeight: 700, marginBottom: 6 }}>
            <span>
              {showMultiBoutiquesView
                ? `🌐 Vue Globale Multi-Boutiques (${myBoutiques.length} boutiques)`
                : isSingleCurrencyBoutique
                ? `${boutique?.nom || "Boutique"} • Devise unique (${singleCurrencyCode})`
                : isAll
                ? `${boutique?.nom || "Boutique"} • Vue Globale (${boutiqueCurrencies.map(c => c.code).join(" + ")})`
                : `${boutique?.nom || "Boutique"} • ${getCurrencyMeta(effectiveFilter).label}`}
            </span>
          </div>
          <h1 style={{ fontSize: "clamp(20px, 4vw, 26px)", margin: 0, color: "var(--forest-dark)" }}>
            {showMultiBoutiquesView ? "Vue Globale de toutes mes Boutiques" : `Tableau de bord — ${boutique?.nom || "Admin"}`}
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13.5 }}>
            {showMultiBoutiquesView
              ? "Supervision consolidée du chiffre d'affaires, des bénéfices, des stocks et des équipes de toutes vos boutiques."
              : isSingleCurrencyBoutique
              ? `Suivi financier 100% dynamique en ${getCurrencyMeta(singleCurrencyCode).label}.`
              : "Aperçu dynamique des ventes, des bénéfices réels et des stocks selon les devises configurées."}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* BOUTON VUE GLOBALE MULTI-BOUTIQUES (SI L'ADMIN GÈRE PLUSIEURS BOUTIQUES) */}
          {isMultiBoutiqueAdmin && (
            <button
              type="button"
              onClick={() => setShowMultiBoutiquesView(v => !v)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "8px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 800,
                border: showMultiBoutiquesView ? "1.5px solid #1E40AF" : "1.5px solid #93C5FD",
                background: showMultiBoutiquesView ? "#1D4ED8" : "#EFF6FF",
                color: showMultiBoutiquesView ? "#fff" : "#1E3A8A",
                cursor: "pointer", transition: "all 0.15s ease"
              }}
            >
              <Globe size={15} />
              <span>
                {showMultiBoutiquesView
                  ? `Retour à ${boutique?.nom || "la boutique active"}`
                  : `Vue Globale de mes ${myBoutiques.length} Boutiques`}
              </span>
            </button>
          )}

          {/* SÉLECTEUR DE DEVISES DYNAMIQUE (MASQUÉ SI 1 SEULE DEVISE OU EN VUE MULTI-BOUTIQUES) */}
          {!showMultiBoutiquesView && !isSingleCurrencyBoutique && (
            <div className="bs-country-switcher">
              {boutiqueCurrencies.map((cur) => {
                if (assignedCurrency && assignedCurrency !== cur.code) return null;
                return (
                  <button
                    key={cur.code}
                    type="button"
                    onClick={() => handleFilterCountry(cur.code)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: effectiveFilter === cur.code ? "var(--forest)" : "transparent",
                      color: effectiveFilter === cur.code ? "#fff" : "var(--muted)",
                      border: "none", padding: "6px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                      cursor: assignedCurrency ? "default" : "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <span className="bs-country-label-full">{cur.label}</span>
                    <span className="bs-country-label-short">{cur.code}</span>
                  </button>
                );
              })}

              {!assignedCurrency && (
                <button
                  type="button"
                  onClick={() => handleFilterCountry("ALL")}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: effectiveFilter === "ALL" ? "var(--forest)" : "transparent",
                    color: effectiveFilter === "ALL" ? "#fff" : "var(--muted)",
                    border: "none", padding: "6px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <span className="bs-country-label-full">Vue Globale (Tous)</span>
                  <span className="bs-country-label-short">Global</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── VUE GLOBALE MULTI-BOUTIQUES (POUR UN ADMIN QUI GÈRE 2, 3+ BOUTIQUES) ── */}
      {showMultiBoutiquesView && multiOverview && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 28 }}>
          {/* KPI CONSOLIDÉS DE TOUTES LES BOUTIQUES */}
          <div className="bs-dashboard-kpi-grid">
            {Object.entries(multiOverview.totauxParDevise || {}).map(([code, tot]) => {
              const meta = getCurrencyMeta(code);
              return (
                <React.Fragment key={code}>
                  <div style={{
                    background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 16, padding: "14px 16px",
                    display: "flex", flexDirection: "column", justifyContent: "space-between"
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: meta.color, textTransform: "uppercase" }}>
                      CA Consolidé ({code})
                    </div>
                    <div style={{ fontSize: 21, fontWeight: 900, color: "var(--ink)", marginTop: 6 }}>
                      {formatPrice(tot.chiffreAffaires || 0, code)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                      {tot.nbCommandes || 0} ventes confirmées • Stock vente : {formatPrice(tot.valeurStockVente || 0, code)}
                    </div>
                  </div>

                  <div style={{
                    background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 16, padding: "14px 16px",
                    display: "flex", flexDirection: "column", justifyContent: "space-between"
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#059669", textTransform: "uppercase" }}>
                      Bénéfice Net Consolidé ({code})
                    </div>
                    <div style={{ fontSize: 21, fontWeight: 900, color: (tot.beneficeNet || 0) < 0 ? "#DC2626" : "#059669", marginTop: 6 }}>
                      {formatPrice(tot.beneficeNet || 0, code)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                      Dép: -{formatPrice(tot.depenses || 0, code)} • Épargne: -{formatPrice(tot.epargne || 0, code)}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            <div style={{
              background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 16, padding: "14px 16px",
              display: "flex", flexDirection: "column", justifyContent: "space-between"
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#4F46E5", textTransform: "uppercase" }}>
                Stock Global ({multiOverview.nbBoutiques} Boutiques)
              </div>
              <div style={{ fontSize: 21, fontWeight: 900, color: "var(--ink)", marginTop: 6 }}>
                {multiOverview.totalUnitsEnStockGlobal || 0} unités
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                {multiOverview.totalProduitsGlobal || 0} références • Valeur achat : {formatPrice(multiOverview.totalValeurStockAchatGlobalFCFA || 0, "FCFA")}
              </div>
            </div>

            <div style={{
              background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 16, padding: "14px 16px",
              display: "flex", flexDirection: "column", justifyContent: "space-between"
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#DC2626", textTransform: "uppercase" }}>
                Total Achats Stock Global (FCFA)
              </div>
              <div style={{ fontSize: 21, fontWeight: 900, color: "#DC2626", marginTop: 6 }}>
                {formatPrice(multiOverview.totalDepensesAchatsGlobalFCFA || 0, "FCFA")}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                Cumul de toutes vos boutiques
              </div>
            </div>
          </div>

          {/* CARTES DÉTAILLÉES PAR BOUTIQUE */}
          <div className="bs-panel" style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 800, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 8 }}>
              <Store size={19} color="var(--forest)" />
              <span>Détail en temps réel par Boutique ({multiOverview.detailsBoutiques?.length || 0})</span>
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 16 }}>
              {(multiOverview.detailsBoutiques || []).map((b) => {
                const isCurrent = Number(b.id) === Number(activeBoutiqueId || boutique?.id);
                const bCurrencies = Array.isArray(b.devisesDisponibles) && b.devisesDisponibles.length > 0 ? b.devisesDisponibles : [b.devise || "KMF"];
                return (
                  <div
                    key={b.id}
                    style={{
                      border: isCurrent ? "2px solid var(--forest)" : "1px solid var(--line)",
                      borderRadius: 14,
                      padding: 16,
                      background: isCurrent ? "var(--forest-light)" : "var(--paper)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 16, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 6 }}>
                          <span>🏪 {b.nom}</span>
                          {isCurrent && (
                            <span style={{ fontSize: 10.5, background: "var(--forest)", color: "#fff", padding: "2px 8px", borderRadius: 10 }}>
                              Active
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                          Devises : <strong>{bCurrencies.join(" + ")}</strong> • {b.totalProduits} produits ({b.totalUnitsEnStock} en stock)
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          switchAdminBoutique(b.id);
                          setShowMultiBoutiquesView(false);
                        }}
                        style={{
                          padding: "6px 12px", borderRadius: 8, fontSize: 11.5, fontWeight: 800,
                          border: "1px solid var(--forest)", background: isCurrent ? "#fff" : "var(--forest)",
                          color: isCurrent ? "var(--forest-dark)" : "#fff", cursor: "pointer"
                        }}
                      >
                        {isCurrent ? "Voir détails" : "Gérer cette boutique"}
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 8 }}>
                      {bCurrencies.map((code) => {
                        const st = b.statsByCurrency?.[code] || {};
                        return (
                          <div key={code} style={{ background: "var(--card)", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)" }}>
                            <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
                              Ventes ({code})
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 900, color: "var(--ink)", marginTop: 2 }}>
                              {formatPrice(st.chiffreAffaires || 0, code)}
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: (st.beneficeNet || 0) < 0 ? "#DC2626" : "#059669", marginTop: 2 }}>
                              Bénéfice : {formatPrice(st.beneficeNet || 0, code)}
                            </div>
                            <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                              Stock : {formatPrice(st.valeurStockVente || 0, code)}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, color: "var(--muted)", borderTop: "1px dashed var(--line)", paddingTop: 8, flexWrap: "wrap", gap: 6 }}>
                      <span>Équipe : <strong>{(b.equipe || []).length}</strong> membre(s)</span>
                      <span style={{ color: b.stockFaibleCount > 0 ? "#DC2626" : "var(--muted)", fontWeight: 700 }}>
                        Alertes stock : {b.stockFaibleCount || 0}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CARTES KPI DYNAMIQUES SELON LE NOMBRE DE DEVISES DE LA BOUTIQUE ── */}
      {!showMultiBoutiquesView && (
        <div className="bs-dashboard-kpi-grid">
          {/* 1. CHIFFRE D'AFFAIRES PAR DEVISE ACTIVE */}
          {activeCurrenciesList.map((cur) => {
            const st = getCurrencyStats(cur.code);
            return (
              <div
                key={`ca-${cur.code}`}
                style={{
                  background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
                  position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
                }}
              >
                <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(34,75,53,0.08)", pointerEvents: "none" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: cur.bg || "rgba(34,75,53,0.12)", color: cur.color || "var(--forest-dark)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <TrendingUp size={17} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: cur.color || "var(--ink)", letterSpacing: "-0.02em" }}>
                    {formatPrice(st.chiffreAffaires || 0, cur.code)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
                    Chiffre d'affaires ({cur.label})
                  </div>
                </div>
              </div>
            );
          })}

          {/* 2. COÛT D'ACHAT DES VENTES (SI VUE D'UNE SEULE DEVISE) */}
          {!isAll && activeCurrenciesList.map((cur) => {
            const st = getCurrencyStats(cur.code);
            return (
              <div
                key={`cout-${cur.code}`}
                style={{
                  background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
                  position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
                }}
              >
                <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(239,68,68,0.08)", pointerEvents: "none" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#FEE2E2", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ShoppingBag size={17} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#DC2626", letterSpacing: "-0.02em" }}>
                    {formatPrice(st.coutAchats || 0, "FCFA")}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
                    Coût d'achat ventes {cur.shortLabel} (FCFA)
                  </div>
                </div>
              </div>
            );
          })}

          {/* 3. BÉNÉFICE NET DISPONIBLE PAR DEVISE ACTIVE */}
          {activeCurrenciesList.map((cur) => {
            const st = getCurrencyStats(cur.code);
            return (
              <div
                key={`ben-${cur.code}`}
                style={{
                  background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
                  position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
                }}
              >
                <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(5,150,105,0.08)", pointerEvents: "none" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <DollarSign size={17} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: (st.beneficeNet || 0) < 0 ? "#DC2626" : "#059669", letterSpacing: "-0.02em" }}>
                    {formatPrice(st.beneficeNet || 0, cur.code)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
                    Bénéfice net disponible ({cur.code})
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>
                    Ventes: {formatPrice(st.beneficeVentes ?? st.beneficeNet ?? 0, cur.code)} • Dép: -{formatPrice(st.depenses || 0, cur.code)} • Épargne: -{formatPrice(st.epargne || 0, cur.code)}
                  </div>
                </div>
              </div>
            );
          })}

          {/* 3b. DÉPENSES COURANTES */}
          <Link to="/admin/depenses" style={{
            background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
            position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)", textDecoration: "none"
          }}>
            <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(220,38,38,0.08)", pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#FEF2F2", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Receipt size={17} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: activeCurrenciesList.length > 1 ? 15 : 20, fontWeight: 900, color: "#DC2626", letterSpacing: "-0.02em" }}>
                {activeCurrenciesList.map((cur, idx) => (
                  <React.Fragment key={cur.code}>
                    {idx > 0 && <span style={{ color: "var(--muted)", fontWeight: 600 }}> / </span>}
                    {formatPrice(getCurrencyStats(cur.code).depenses || 0, cur.code)}
                  </React.Fragment>
                ))}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
                Dépenses ({activeCurrenciesList.map(c => c.code).join(" & ")})
              </div>
            </div>
          </Link>

          {/* 3c. ÉPARGNE NETTE */}
          <Link to="/admin/epargne" style={{
            background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
            position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)", textDecoration: "none"
          }}>
            <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(22,101,52,0.08)", pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#DCFCE7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PiggyBank size={17} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: activeCurrenciesList.length > 1 ? 15 : 20, fontWeight: 900, color: "#166534", letterSpacing: "-0.02em" }}>
                {activeCurrenciesList.map((cur, idx) => (
                  <React.Fragment key={cur.code}>
                    {idx > 0 && <span style={{ color: "var(--muted)", fontWeight: 600 }}> / </span>}
                    {formatPrice(getCurrencyStats(cur.code).epargne || 0, cur.code)}
                  </React.Fragment>
                ))}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
                Solde Épargne ({activeCurrenciesList.map(c => c.code).join(" & ")})
              </div>
            </div>
          </Link>

          {/* 4. DÉPENSES TOTALES D'ACHATS DE MARCHANDISES (FCFA) */}
          <Link to="/admin/achats" style={{
            background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
            position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)", textDecoration: "none"
          }}>
            <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(239,68,68,0.08)", pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#FEE2E2", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShoppingBag size={17} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#DC2626", letterSpacing: "-0.02em" }}>
                {formatPrice(data.totalDepensesAchats || 0, "FCFA")}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
                Dépenses Totales d'Achats Stock (FCFA)
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>
                Auj: {formatPrice(data.achatsAujourdhuiFCFA || 0, "FCFA")} • Hier: {formatPrice(data.achatsHierFCFA || 0, "FCFA")}
              </div>
            </div>
          </Link>

          {/* 5. VALEUR DU STOCK EN VENTE PAR DEVISE ACTIVE */}
          {activeCurrenciesList.map((cur) => {
            const st = getCurrencyStats(cur.code);
            return (
              <div
                key={`stk-${cur.code}`}
                style={{
                  background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
                  position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
                }}
              >
                <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(79,70,229,0.08)", pointerEvents: "none" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: cur.bg || "#EEF2FF", color: cur.color || "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Package size={17} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: cur.color || "var(--ink)", letterSpacing: "-0.02em" }}>
                    {formatPrice(st.valeurStockVente || 0, cur.code)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
                    Valeur stock vente ({cur.code})
                  </div>
                </div>
              </div>
            );
          })}

          {/* VALEUR STOCK COÛT D'ACHAT (FCFA) */}
          <div style={{
            background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
            position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
          }}>
            <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(79,70,229,0.08)", pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Package size={17} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.02em" }}>
                {formatPrice(data.valeurStockAchat || 0, "FCFA")}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
                Valeur stock coût d'achat (FCFA)
              </div>
            </div>
          </div>

          {/* 6. COMMANDES CONFIRMÉES */}
          <div style={{
            background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
            position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
          }}>
            <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(13,148,136,0.08)", pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#CCFBF1", color: "#0D9488", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 size={17} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.02em" }}>
                {isAll ? (data.nbCommandes || 0) : (primaryStats.nbCommandes || 0)}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
                {isAll ? "Total commandes confirmées" : `Commandes confirmées (${primarySelectedCurrency})`}
              </div>
            </div>
          </div>

          {/* 7. ARTICLES VENDUS */}
          <div style={{
            background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
            position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
          }}>
            <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(16,185,129,0.08)", pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#D1FAE5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShoppingBag size={17} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.02em" }}>
                {isAll ? (data.totalVentesCount || 0) : (primaryStats.totalVentesCount || 0)}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
                {isAll ? "Nombre total d'articles vendus" : `Articles vendus (${primarySelectedCurrency})`}
              </div>
            </div>
          </div>

          {/* 8. TOTAL PRODUITS */}
          <div style={{
            background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
            position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
          }}>
            <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(139,92,246,0.08)", pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#F3E8FF", color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Layers size={17} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.02em" }}>
                {data.totalProduits || 0}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
                Total produits
              </div>
            </div>
          </div>

          {/* 9. CATÉGORIES ACTIVES */}
          <div style={{
            background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
            position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
          }}>
            <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(168,85,247,0.08)", pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#FAF5FF", color: "#A855F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Layers size={17} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.02em" }}>
                {data.totalCategories || 0}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
                Catégories actives
              </div>
            </div>
          </div>

          {/* 10. CLIENTS ACTIFS */}
          <div style={{
            background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
            position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
          }}>
            <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(2,132,199,0.08)", pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#E0F2FE", color: "#0284C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <UserCheck size={17} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.02em" }}>
                {data.totalClients || 0}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
                Clients actifs
              </div>
            </div>
          </div>

          {/* 11. AVIS CLIENTS */}
          <div style={{
            background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
            position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
          }}>
            <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(245,158,11,0.08)", pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#FEF3C7", color: "#D97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Star size={17} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.02em" }}>
                {data.noteMoyenneGlobale || "4.9"} / 5
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
                Avis clients ({data.totalReviews || 0})
              </div>
            </div>
          </div>

          {/* 12. ALERTES STOCK */}
          <div style={{
            background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
            position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
          }}>
            <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: data.stockFaibleCount > 0 ? "rgba(239,68,68,0.1)" : "rgba(100,116,139,0.06)", pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: data.stockFaibleCount > 0 ? "#FEE2E2" : "var(--paper)", color: data.stockFaibleCount > 0 ? "#EF4444" : "var(--sage)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={17} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: data.stockFaibleCount > 0 ? "#EF4444" : "var(--ink)", letterSpacing: "-0.02em" }}>
                {data.stockFaibleCount || 0}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: data.stockFaibleCount > 0 ? "#EF4444" : "var(--muted)", marginTop: 2 }}>
                Stock faible
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION GRAPHIQUES VARIÉS & STYLÉS ── */}
      <div className="bs-dashboard-charts-grid">
        <div className="bs-panel bs-dashboard-chart-card" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--forest-dark)", fontWeight: 700 }}>
                Evolution du Chiffre d'Affaires ({isAll ? "Global" : primarySelectedCurrency})
              </h3>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Tendance des 7 derniers jours</div>
            </div>
            <span style={{ background: chartColors.badgeBg, color: chartColors.badgeText, padding: "4px 10px", borderRadius: 12, fontSize: 11.5, fontWeight: 700 }}>
              7 derniers jours
            </span>
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={currentChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.stroke} stopOpacity={isDark ? 0.5 : 0.35}/>
                  <stop offset="95%" stopColor={chartColors.stroke} stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="jour" tick={{ fontSize: 11, fill: chartColors.axisText }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: chartColors.axisText }} axisLine={false} tickLine={false} tickFormatter={(v) => v === 0 ? "0" : (v / 1000) + "k"} />
              <Tooltip
                contentStyle={{
                  background: chartColors.tooltipBg,
                  borderRadius: 12,
                  border: `1px solid ${chartColors.tooltipBorder}`,
                  color: chartColors.tooltipText,
                  boxShadow: isDark ? "0 10px 25px rgba(0,0,0,0.5)" : "0 8px 20px rgba(0,0,0,0.08)",
                  fontWeight: 600,
                  fontSize: 13
                }}
                itemStyle={{ color: chartColors.tooltipText }}
                labelStyle={{ color: chartColors.axisText }}
                formatter={(v) => [formatPrice(v, currentCurrencySymbol), "Revenu"]}
              />
              <Area type="monotone" dataKey="ca" stroke={chartColors.stroke} strokeWidth={3} fillOpacity={1} fill="url(#colorCa)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bs-panel bs-dashboard-chart-card" style={{ padding: "20px 24px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--forest-dark)", fontWeight: 700 }}>Modes de paiement</h3>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
            Répartition des transactions ({isAll ? "Global" : primarySelectedCurrency})
          </div>

          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie
                data={currentModesPaiement}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                <Cell key="cell-0" fill="#10B981" />
                <Cell key="cell-1" fill="#F59E0B" />
                <Cell key="cell-2" fill="#06B6D4" />
                <Cell key="cell-3" fill="#8B5CF6" />
              </Pie>
              <Tooltip
                contentStyle={{
                  background: chartColors.tooltipBg,
                  borderRadius: 12,
                  border: `1px solid ${chartColors.tooltipBorder}`,
                  color: chartColors.tooltipText,
                  boxShadow: isDark ? "0 10px 25px rgba(0,0,0,0.5)" : "0 8px 20px rgba(0,0,0,0.08)",
                  fontWeight: 600,
                  fontSize: 13
                }}
                itemStyle={{ color: chartColors.tooltipText }}
                labelStyle={{ color: chartColors.axisText }}
                formatter={(v, name) => [`${v} commande(s)`, name]}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 11.5, fontWeight: 600, color: chartColors.axisText }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── SECTION GRAPHIQUES 2 : TOP PRODUITS & TOP CATÉGORIES ── */}
      <div className="bs-dashboard-prods-grid">
        <div className="bs-panel bs-dashboard-chart-card" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--forest-dark)", fontWeight: 700 }}>
                {prodChartTab === "top" ? "Top Produits (Ventes)" : "Produits Moins Vendus"}
              </h3>
            </div>
            <div style={{ display: "flex", gap: 4, background: "var(--paper)", padding: 3, borderRadius: 8 }}>
              <button
                onClick={() => setProdChartTab("top")}
                style={{
                  background: prodChartTab === "top" ? "var(--forest)" : "none",
                  color: prodChartTab === "top" ? "#fff" : "var(--muted)",
                  border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer"
                }}
              >
                Plus vendus
              </button>
              <button
                onClick={() => setProdChartTab("flop")}
                style={{
                  background: prodChartTab === "flop" ? "#B4483A" : "none",
                  color: prodChartTab === "flop" ? "#fff" : "var(--muted)",
                  border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer"
                }}
              >
                Moins vendus
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 250, overflowY: "auto" }}>
            {activeProductsChart.length > 0 ? (
              activeProductsChart.map((p, idx) => (
                <div key={p.id || idx} style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 8, borderBottom: "1px solid var(--line)" }}>
                  <img src={p.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=100&q=80"} alt={p.nom} style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      #{idx + 1} {p.nom}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
                      <span>{p.ventesCount} vente{p.ventesCount > 1 ? "s" : ""}</span>
                      <span>•</span>
                      <Stars rating={Math.round(p.noteMoyenne || 5)} size={11} />
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--forest-dark)", whiteSpace: "nowrap" }}>
                    {formatPrice(p.prixPromo || p.prix, storeDevise)}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 20 }}>
                Aucune donnée de vente disponible.
              </div>
            )}
          </div>
        </div>

        <div className="bs-panel bs-dashboard-chart-card" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: "var(--forest-dark)", fontWeight: 700 }}>Performance des Catégories</h3>
            <span style={{ fontSize: 12, color: "var(--forest)", fontWeight: 700 }}>Volume de ventes</span>
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              layout="vertical"
              data={data.topCategories || []}
              margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10.5, fill: chartColors.axisText }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10.5, fill: chartColors.yAxisCategoryText, fontWeight: 600 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip
                contentStyle={{
                  background: chartColors.tooltipBg,
                  borderRadius: 12,
                  border: `1px solid ${chartColors.tooltipBorder}`,
                  color: chartColors.tooltipText,
                  boxShadow: isDark ? "0 10px 25px rgba(0,0,0,0.5)" : "0 8px 20px rgba(0,0,0,0.08)",
                  fontWeight: 600,
                  fontSize: 13
                }}
                itemStyle={{ color: chartColors.tooltipText }}
                labelStyle={{ color: chartColors.axisText }}
                formatter={(v) => [`${v} ventes`, "Nombre de ventes"]}
              />
              <Bar dataKey="ventes" fill={chartColors.barFill} radius={[0, 8, 8, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
