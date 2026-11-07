import React, { createContext, useContext, useEffect, useState } from "react";
import api, { SLUG } from "../api";
import { clearSwrCache } from "../utils/swrCache.js";
import { getBoutiqueCurrencyCodes, setActiveCurrency } from "../utils/currency.js";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [boutique, setBoutique] = useState(() => {
    try {
      const cached = localStorage.getItem("cached_boutique");
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });
  const [myBoutiques, setMyBoutiques] = useState([]);
  const [activeBoutiqueId, setActiveBoutiqueId] = useState(() => {
    const saved = localStorage.getItem("active_admin_boutique_id");
    return saved ? Number(saved) : null;
  });
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("app_theme") || "light";
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("app_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "dark" ? "light" : "dark"));
  };

  const sanitizeBoutique = (data) => {
    if (!data || typeof data !== "object") return null;
    // devisesDisponibles
    data.devisesDisponibles = getBoutiqueCurrencyCodes(data);
    if (!data.devise && data.devisesDisponibles.length > 0) {
      data.devise = data.devisesDisponibles[0];
    }

    // modesPaiement
    if (typeof data.modesPaiement === "string") {
      try { data.modesPaiement = JSON.parse(data.modesPaiement); } catch (e) { data.modesPaiement = null; }
    }
    const sanitizedModes = { especes: true, mvola: true, holam: true, carte: false, wave: true, orange: true };
    if (data.modesPaiement && typeof data.modesPaiement === "object" && !data.modesPaiement["0"]) {
      if (typeof data.modesPaiement.especes === "boolean") sanitizedModes.especes = data.modesPaiement.especes;
      if (typeof data.modesPaiement.mvola === "boolean") sanitizedModes.mvola = data.modesPaiement.mvola;
      if (typeof data.modesPaiement.holam === "boolean") sanitizedModes.holam = data.modesPaiement.holam;
      if (typeof data.modesPaiement.carte === "boolean") sanitizedModes.carte = data.modesPaiement.carte;
      if (typeof data.modesPaiement.wave === "boolean") sanitizedModes.wave = data.modesPaiement.wave;
      if (typeof data.modesPaiement.orange === "boolean") sanitizedModes.orange = data.modesPaiement.orange;
    }
    data.modesPaiement = sanitizedModes;

    // modulesActifs
    if (typeof data.modulesActifs === "string") {
      try { data.modulesActifs = JSON.parse(data.modulesActifs); } catch (e) { data.modulesActifs = null; }
    }
    if (!data.modulesActifs || typeof data.modulesActifs !== "object" || data.modulesActifs["0"]) {
      data.modulesActifs = { vente: true, ventesHistorique: true, achats: true, fournisseurs: true, unites: true, homeBanners: true, sideBanners: true, commandes: true, categories: true, produits: true, employes: true, parametres: true, commanderWhatsapp: true };
    }

    // bannerSlides
    if (typeof data.bannerSlides === "string") {
      try { data.bannerSlides = JSON.parse(data.bannerSlides); } catch (e) { data.bannerSlides = []; }
    }
    if (!Array.isArray(data.bannerSlides)) data.bannerSlides = [];

    // sideBanners
    if (typeof data.sideBanners === "string") {
      try { data.sideBanners = JSON.parse(data.sideBanners); } catch (e) { data.sideBanners = []; }
    }
    if (!Array.isArray(data.sideBanners)) data.sideBanners = [];

    return data;
  };

  const syncBoutiqueCurrency = (b) => {
    if (!b) return;
    const allowed = getBoutiqueCurrencyCodes(b);
    const saved = localStorage.getItem("soilihi_active_currency");
    if (!saved || !allowed.includes(saved)) {
      setActiveCurrency(allowed[0] || b.devise || "KMF");
    } else {
      window.dispatchEvent(new CustomEvent("currency_changed", { detail: saved }));
    }
  };

  const fetchMyBoutiques = async () => {
    try {
      const res = await api.get("/admin/my-boutiques");
      if (res.data && Array.isArray(res.data.boutiques)) {
        const sanitizedList = res.data.boutiques.map(sanitizeBoutique);
        setMyBoutiques(sanitizedList);
        if (res.data.activeBoutiqueId) {
          setActiveBoutiqueId(Number(res.data.activeBoutiqueId));
          localStorage.setItem("active_admin_boutique_id", String(res.data.activeBoutiqueId));
        }
      }
    } catch (_) {}
  };

  const refreshBoutique = (overrideUser = null) => {
    const timestamp = Date.now();
    const token = localStorage.getItem("token");
    let currentUser = overrideUser || user;
    if (!currentUser && token) {
      try {
        currentUser = JSON.parse(localStorage.getItem("cached_user") || "null");
      } catch (_) {}
    }

    const canFetchAdminBoutique = Boolean(
      token && currentUser && (currentUser.role === "admin" || currentUser.role === "employe")
    );

    const fetchPublicStore = () => {
      api.get(`/store/${SLUG}?t=${timestamp}`).then((res) => {
        if (res.data && typeof res.data === "object") {
          const b = sanitizeBoutique(res.data);
          if (b) {
            setBoutique(b);
            try {
              localStorage.setItem("cached_boutique", JSON.stringify(b));
              syncBoutiqueCurrency(b);
            } catch (e) {}
          }
        }
      }).catch(() => {});
    };

    if (!canFetchAdminBoutique) {
      fetchPublicStore();
      return;
    }

    api.get(`/admin/boutique?t=${timestamp}`)
      .then((res) => {
        if (res.data && typeof res.data === "object") {
          const b = sanitizeBoutique(res.data);
          if (b) {
            setBoutique(b);
            if (b.id) {
              setActiveBoutiqueId(b.id);
            }
            try {
              localStorage.setItem("cached_boutique", JSON.stringify(b));
              syncBoutiqueCurrency(b);
            } catch (e) {}
          }
        } else {
          fetchPublicStore();
        }
      })
      .catch(() => {
        fetchPublicStore();
      });
  };

  const switchAdminBoutique = (newBoutiqueId) => {
    if (!newBoutiqueId) return;
    const numId = Number(newBoutiqueId);
    localStorage.setItem("active_admin_boutique_id", String(numId));
    setActiveBoutiqueId(numId);
    clearSwrCache();
    const found = myBoutiques.find(b => Number(b.id) === numId);
    if (found) {
      setBoutique(found);
      try {
        localStorage.setItem("cached_boutique", JSON.stringify(found));
        syncBoutiqueCurrency(found);
      } catch (_) {}
    }
    refreshBoutique();
    window.dispatchEvent(new CustomEvent("boutique_switched", { detail: numId }));
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    refreshBoutique();
    if (!token) { 
      setLoading(false); 
      return; 
    }
    try {
      const cachedUser = JSON.parse(localStorage.getItem("cached_user") || "null");
      if (cachedUser) {
        setUser(cachedUser);
        setLoading(false);
      }
    } catch (e) {}
    api.get("/auth/me").then((res) => {
      const u = res.data.user;
      setUser(u);
      try { localStorage.setItem("cached_user", JSON.stringify(u)); } catch (e) {}
      if (u && (u.role === "admin" || u.role === "employe")) {
        fetchMyBoutiques();
      }
    })
      .catch((err) => {
        if (err?.response && [401, 403].includes(err.response.status)) {
          localStorage.removeItem("token");
          localStorage.removeItem("cached_user");
          localStorage.removeItem("active_admin_boutique_id");
          clearSwrCache();
          setUser(null);
          setMyBoutiques([]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(identifiant, motDePasse) {
    const res = await api.post("/auth/login", { identifiant, email: identifiant, telephone: identifiant, motDePasse });
    clearSwrCache();
    localStorage.setItem("token", res.data.token);
    const u = res.data.user;
    if (u?.boutiqueId) {
      localStorage.setItem("active_admin_boutique_id", String(u.boutiqueId));
      setActiveBoutiqueId(Number(u.boutiqueId));
    } else {
      localStorage.removeItem("active_admin_boutique_id");
      setActiveBoutiqueId(null);
    }
    try { localStorage.setItem("cached_user", JSON.stringify(u)); } catch (e) {}
    setUser(u);
    refreshBoutique(u);
    if (u && (u.role === "admin" || u.role === "employe")) {
      fetchMyBoutiques();
    } else {
      setMyBoutiques([]);
    }
    return u;
  }

  async function register(nom, email, telephone, motDePasse) {
    const res = await api.post("/auth/register", { nom, email, telephone, motDePasse });
    if (res.data.token) {
      localStorage.setItem("token", res.data.token);
      setUser(res.data.user);
      refreshBoutique();
    }
    return res.data;
  }

  async function verifyOtp(email, telephone, otpCode) {
    const res = await api.post("/auth/verify-otp", { email, telephone, otpCode });
    if (res.data.token) {
      localStorage.setItem("token", res.data.token);
      setUser(res.data.user);
      refreshBoutique();
    }
    return res.data;
  }

  async function resendOtp(email, telephone) {
    const res = await api.post("/auth/resend-otp", { email, telephone });
    return res.data;
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("cached_user");
    localStorage.removeItem("active_admin_boutique_id");
    clearSwrCache();
    setUser(null);
    setMyBoutiques([]);
  }

  function updateUser(updatedUserData) {
    setUser((prev) => (prev ? { ...prev, ...updatedUserData } : null));
  }

  return (
    <AuthContext.Provider value={{
      user,
      boutique,
      myBoutiques,
      activeBoutiqueId,
      switchAdminBoutique,
      fetchMyBoutiques,
      refreshBoutique,
      loading,
      login,
      register,
      verifyOtp,
      resendOtp,
      logout,
      updateUser,
      theme,
      toggleTheme
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
