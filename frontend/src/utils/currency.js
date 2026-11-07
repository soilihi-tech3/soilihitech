/**
 * Gestionnaire dynamique de devises pour le SaaS Soilihitech.
 * Conserve intégralement les 2 devises KMF (Comores) et FCFA (Sénégal) pour la boutique existante,
 * tout en permettant au Super Admin de configurer 1, 2 ou plusieurs devises (EUR, FCFA, KMF, USD...)
 * pour les nouvelles boutiques.
 */

export const ALL_CURRENCIES = [
  {
    code: "KMF",
    label: "Comores (KMF)",
    symbol: "KMF",
    flag: "🇰🇲",
    country: "Comores",
    color: "#2563EB",
    bg: "#E0F2FE",
    border: "#BAE6FD"
  },
  {
    code: "FCFA",
    label: "Sénégal (FCFA)",
    symbol: "FCFA",
    flag: "🇸🇳",
    country: "Sénégal",
    color: "#15803D",
    bg: "#DCFCE7",
    border: "#BBF7D0"
  },
  {
    code: "EUR",
    label: "Euro (€)",
    symbol: "€",
    flag: "🇪🇺",
    country: "Europe (EUR)",
    color: "#7C3AED",
    bg: "#F3E8FF",
    border: "#DDD6FE"
  },
  {
    code: "USD",
    label: "Dollar US ($)",
    symbol: "$",
    flag: "🇺🇸",
    country: "International (USD)",
    color: "#0F766E",
    bg: "#CCFBF1",
    border: "#99F6E4"
  },
  {
    code: "GBP",
    label: "Livre Sterling (£)",
    symbol: "£",
    flag: "🇬🇧",
    country: "Royaume-Uni (GBP)",
    color: "#B45309",
    bg: "#FEF3C7",
    border: "#FDE68A"
  },
  {
    code: "MAD",
    label: "Dirham Marocain (MAD)",
    symbol: "MAD",
    flag: "🇲🇦",
    country: "Maroc (MAD)",
    color: "#BE123C",
    bg: "#FFE4E6",
    border: "#FECDD3"
  },
  {
    code: "CAD",
    label: "Dollar Canadien (CAD)",
    symbol: "CAD",
    flag: "🇨🇦",
    country: "Canada (CAD)",
    color: "#1D4ED8",
    bg: "#DBEAFE",
    border: "#BFDBFE"
  }
];

// Liste par défaut (Comores KMF + Sénégal FCFA)
export const CURRENCIES = ALL_CURRENCIES.slice(0, 2);

/**
 * Retourne les métadonnées d'une devise (code, label, symbol, flag, country, color, bg, border)
 */
export const getCurrencyMeta = (code) => {
  const clean = String(code || "KMF").trim().toUpperCase();
  const normalized = clean === "XOF" ? "FCFA" : clean;
  const found = ALL_CURRENCIES.find((c) => c.code === normalized);
  if (found) return found;
  return {
    code: normalized,
    label: `${normalized}`,
    symbol: normalized,
    flag: "💱",
    country: normalized,
    color: "#2563EB",
    bg: "#EFF6FF",
    border: "#BFDBFE"
  };
};

/**
 * Extrait la liste normalisée des codes de devises configurés pour une boutique.
 * - La boutique existante (Soilihitech) ou toute boutique sans restriction explicite conserve ["KMF", "FCFA"].
 * - Une nouvelle boutique configurée par le Super Admin avec 1, 2 ou N devises retourne exactement ses devises.
 */
export const getBoutiqueCurrencyCodes = (boutique = null) => {
  let target = boutique;
  if (!target) {
    try {
      const cached = localStorage.getItem("cached_boutique");
      if (cached) target = JSON.parse(cached);
    } catch (e) {}
  }

  if (target) {
    // La boutique historique Soilihitech conserve toujours ses 2 devises KMF et FCFA
    const slug = String(target.slug || "").trim().toLowerCase();
    if (slug === "soilihitech") {
      let list = target.devisesDisponibles;
      if (typeof list === "string") {
        try { list = JSON.parse(list); } catch (e) { list = null; }
      }
      if (Array.isArray(list) && list.length >= 2) {
        const cleaned = Array.from(
          new Set(
            list.map((c) => {
              const s = String(c || "").trim().toUpperCase();
              return s === "XOF" ? "FCFA" : s;
            }).filter(Boolean)
          )
        );
        if (cleaned.length >= 2) return cleaned;
      }
      return ["KMF", "FCFA"];
    }

    let list = target.devisesDisponibles;
    if (typeof list === "string") {
      try {
        list = JSON.parse(list);
      } catch (e) {
        list = null;
      }
    }
    if (Array.isArray(list) && list.length > 0) {
      const cleaned = Array.from(
        new Set(
          list
            .map((c) => {
              const s = String(c || "").trim().toUpperCase();
              return s === "XOF" ? "FCFA" : s;
            })
            .filter(Boolean)
        )
      );
      if (cleaned.length > 0) return cleaned;
    }

    if (target.devise) {
      const primary = String(target.devise).trim().toUpperCase();
      const normPrimary = primary === "XOF" ? "FCFA" : primary;
      if (normPrimary === "KMF" || normPrimary === "FCFA") {
        return ["KMF", "FCFA"];
      }
      return [normPrimary];
    }
  }

  return ["KMF", "FCFA"];
};

/**
 * Retourne les objets devises complets [{ code, label, symbol, flag, country, ... }] pour une boutique
 */
export const getBoutiqueCurrencies = (boutique = null) => {
  const codes = getBoutiqueCurrencyCodes(boutique);
  return codes.map((code) => getCurrencyMeta(code));
};

export const getActiveCurrency = () => {
  try {
    const allowed = getBoutiqueCurrencyCodes();
    const saved = localStorage.getItem("soilihi_active_currency");
    if (saved) {
      const cleanSaved = String(saved).trim().toUpperCase();
      if (allowed.includes(cleanSaved)) return cleanSaved;
    }
    if (allowed.length > 0) return allowed[0];

    const cached = localStorage.getItem("cached_boutique");
    if (cached) {
      const b = JSON.parse(cached);
      if (b && b.devise) return b.devise;
    }
  } catch (e) {}
  return "KMF";
};

export const setActiveCurrency = (cur) => {
  try {
    const clean = String(cur || "KMF").trim().toUpperCase();
    localStorage.setItem("soilihi_active_currency", clean);
    window.dispatchEvent(new CustomEvent("currency_changed", { detail: clean }));
    return clean;
  } catch (e) {
    return "KMF";
  }
};

export const getCurrencySymbol = (devise) => {
  let d = devise || getActiveCurrency();
  const clean = String(d).trim().toUpperCase();
  if (clean === "EUR" || clean === "€") return "€";
  if (clean === "USD" || clean === "$") return "$";
  if (clean === "GBP" || clean === "£") return "£";
  if (clean === "FCFA" || clean === "XOF") return "FCFA";
  if (clean === "KMF" || clean === "FC") return "KMF";
  return d;
};

export const formatPrice = (amount, devise) => {
  const symbol = getCurrencySymbol(devise);
  const num = Number(amount || 0);

  // Pour KMF et FCFA, les montants n'ont généralement pas de centimes
  const maxDecimals = (symbol === "KMF" || symbol === "FCFA") ? 0 : 2;
  const formatted = num.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });

  if (symbol === "$") return `$${formatted}`;
  if (symbol === "£") return `£${formatted}`;
  return `${formatted} ${symbol}`;
};

/**
 * Retourne le prix effectif du produit selon la devise active
 * Conserve la priorité sur prix / prixPromo (KMF) et prixSenegal / prixPromoSenegal (FCFA)
 * tout en supportant prixParDevise / prixPromoParDevise pour les autres devises (EUR, USD...).
 */
export const getProductPrice = (product, activeCurrency = getActiveCurrency()) => {
  if (!product) return 0;
  const cleanCur = String(activeCurrency || "KMF").trim().toUpperCase();
  const normCur = cleanCur === "XOF" ? "FCFA" : cleanCur;

  let prixMap = product.prixParDevise;
  if (typeof prixMap === "string") {
    try { prixMap = JSON.parse(prixMap); } catch (e) { prixMap = null; }
  }
  let promoMap = product.prixPromoParDevise;
  if (typeof promoMap === "string") {
    try { promoMap = JSON.parse(promoMap); } catch (e) { promoMap = null; }
  }

  // Cas FCFA (Sénégal)
  if (normCur === "FCFA") {
    if (product.enPromo && product.prixPromoSenegal && Number(product.prixPromoSenegal) > 0) {
      return Number(product.prixPromoSenegal);
    }
    if (product.enPromo && promoMap && typeof promoMap === "object" && Number(promoMap.FCFA) > 0) {
      return Number(promoMap.FCFA);
    }
    if (product.prixSenegal && Number(product.prixSenegal) > 0) {
      return Number(product.prixSenegal);
    }
    if (prixMap && typeof prixMap === "object" && Number(prixMap.FCFA) > 0) {
      return Number(prixMap.FCFA);
    }
  }

  // Cas KMF (Comores)
  if (normCur === "KMF") {
    if (product.enPromo && product.prixPromo && Number(product.prixPromo) > 0) {
      return Number(product.prixPromo);
    }
    if (product.enPromo && promoMap && typeof promoMap === "object" && Number(promoMap.KMF) > 0) {
      return Number(promoMap.KMF);
    }
    if (product.prix && Number(product.prix) > 0) {
      return Number(product.prix);
    }
    if (prixMap && typeof prixMap === "object" && Number(prixMap.KMF) > 0) {
      return Number(prixMap.KMF);
    }
  }

  // Autres devises (EUR, USD, GBP, etc.) via prixPromoParDevise / prixParDevise
  if (product.enPromo && promoMap && typeof promoMap === "object" && Number(promoMap[normCur]) > 0) {
    return Number(promoMap[normCur]);
  }
  if (prixMap && typeof prixMap === "object" && Number(prixMap[normCur]) > 0) {
    return Number(prixMap[normCur]);
  }

  // Fallback sur le prix principal
  if (product.enPromo && product.prixPromo && Number(product.prixPromo) > 0) {
    return Number(product.prixPromo);
  }
  return Number(product.prix || 0);
};

// Alias de compatibilité
export const fcfa = (amount, devise) => formatPrice(amount, devise);
