/**
 * Gestionnaire dynamique de devises pour le SaaS Soilihitech.
 * Supporte : KMF (Comores) et FCFA (Sénégal), ainsi que EUR (€) et USD ($).
 */

export const CURRENCIES = [
  { code: "KMF", label: "Comores (KMF)", symbol: "KMF", flag: "🇰🇲", country: "Comores" },
  { code: "FCFA", label: "Sénégal (FCFA)", symbol: "FCFA", flag: "🇸🇳", country: "Sénégal" }
];

export const getActiveCurrency = () => {
  try {
    const saved = localStorage.getItem("soilihi_active_currency");
    if (saved) return saved;
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
  return `${formatted} ${symbol}`;
};

/**
 * Retourne le prix effectif du produit selon la devise active (KMF ou FCFA Sénégal)
 */
export const getProductPrice = (product, activeCurrency = getActiveCurrency()) => {
  if (!product) return 0;
  if (activeCurrency === "FCFA") {
    // Si prix Sénégal défini
    if (product.prixPromoSenegal && Number(product.prixPromoSenegal) > 0) {
      return Number(product.prixPromoSenegal);
    }
    if (product.prixSenegal && Number(product.prixSenegal) > 0) {
      return Number(product.prixSenegal);
    }
  }
  // Par défaut ou Comores (KMF)
  if (product.enPromo && product.prixPromo && Number(product.prixPromo) > 0) {
    return Number(product.prixPromo);
  }
  return Number(product.prix || 0);
};

// Alias de compatibilité
export const fcfa = (amount, devise) => formatPrice(amount, devise);

