import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { getProductPrice } from "../utils/currency.js";

const CartContext = createContext(null);

function normalizeCartItem(l, index) {
  if (!l) return null;
  const p = l.product || (l.nom ? l : { id: l.id || `item_${index}`, nom: l.nom || "Article" });
  const pId = p?.id || l.productId || l.id || `item_${index}`;
  const modele = l.selectedModele || null;
  const couleur = typeof l.selectedCouleur === "object" ? l.selectedCouleur?.nom : (l.selectedCouleur || null);
  const cartKey = l.cartKey || `${pId}_${modele || ''}_${couleur || ''}`;

  return {
    ...l,
    cartKey,
    product: p,
    quantite: Math.max(1, Number(l.quantite || 1)),
    selectedModele: modele,
    selectedCouleur: couleur
  };
}

function isItemMatch(l, keyOrId, i) {
  if (!l) return false;
  if (typeof keyOrId === "number" && keyOrId === i) return true;
  if (l.cartKey && String(l.cartKey) === String(keyOrId)) return true;
  
  const lineKey = l.cartKey || (l.product ? `${l.product.id}_${l.selectedModele || ''}_${l.selectedCouleur || ''}` : String(l.id || i));
  if (lineKey && String(lineKey) === String(keyOrId)) return true;
  
  if (l.product?.id && (String(l.product.id) === String(keyOrId) || Number(l.product.id) === Number(keyOrId))) return true;
  if (l.id && (String(l.id) === String(keyOrId) || Number(l.id) === Number(keyOrId))) return true;

  const keyStr = String(keyOrId || "");
  const parts = keyStr.split("_");
  if (parts.length > 1 && l.product?.id && String(l.product.id) === parts[0]) {
    const lModele = String(l.selectedModele || "");
    const lCouleur = String(typeof l.selectedCouleur === "object" ? l.selectedCouleur?.nom : (l.selectedCouleur || ""));
    const targetModele = parts[1] || "";
    const targetCouleur = parts.slice(2).join("_") || "";
    if (lModele === targetModele && lCouleur === targetCouleur) {
      return true;
    }
  }

  return false;
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem("easymarket_cart");
      const parsed = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.map((l, idx) => normalizeCartItem(l, idx)).filter(Boolean);
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("easymarket_cart", JSON.stringify(cart));
    } catch (e) {}
  }, [cart]);

  function showToast(message, type = "warning") {
    if (type === "success") {
      toast.success(message);
    } else if (type === "error") {
      toast.error(message);
    } else {
      toast(message);
    }
  }

  function addToCart(product, quantite = 1, options = {}) {
    if (!product) return false;

    const selectedModele = options.selectedModele || null;
    const selectedCouleur = typeof options.selectedCouleur === "object" ? options.selectedCouleur?.nom : (options.selectedCouleur || null);
    const selectedCouleurHex = typeof options.selectedCouleur === "object" ? options.selectedCouleur?.codeHex : (options.selectedCouleurHex || null);
    const selectedBrand = options.marqueTelephone || options.selectedBrand || null;
    const selectedImageUrl = options.selectedImageUrl || null;
    const selectedPriceKMF = options.selectedPriceKMF || null;
    const selectedPriceFCFA = options.selectedPriceFCFA || null;

    const itemKey = `${product.id}_${selectedModele || ''}_${selectedCouleur || ''}`;

    const variantStockLimit = options.stockVariante !== undefined && options.stockVariante !== null && !isNaN(Number(options.stockVariante))
      ? Number(options.stockVariante)
      : null;
    const stockMax = variantStockLimit !== null ? Math.min(variantStockLimit, Number(product.stock ?? 0)) : Number(product.stock ?? 0);
    const itemExistant = cart.find((l) => (l.cartKey || `${l.product?.id}_${l.selectedModele || ''}_${l.selectedCouleur || ''}`) === itemKey);
    const dejaEnPanier = itemExistant ? itemExistant.quantite : 0;

    const variantLabel = [selectedModele, selectedCouleur].filter(Boolean).join(" · ");
    const nomAffiche = variantLabel ? `"${product.nom} (${variantLabel})"` : `"${product.nom}"`;

    // Case 1: Product or variant out of stock completely
    if (stockMax <= 0) {
      showToast(
        `Désolé, ${nomAffiche} est actuellement en rupture de stock.`,
        "error"
      );
      return false;
    }

    // Case 2: Cart already has total available stock
    if (dejaEnPanier >= stockMax) {
      showToast(
        `Stock épuisé pour ${nomAffiche} ! Il reste ${stockMax} article(s) en stock et vous l'avez déjà dans votre panier. Impossible d'en ajouter plus.`,
        "warning"
      );
      return false;
    }

    const nouvelleQuantite = dejaEnPanier + quantite;

    // Case 3: Requested quantity exceeds stock limit
    if (nouvelleQuantite > stockMax) {
      const qteAjoutee = stockMax - dejaEnPanier;
      setCart((prev) =>
        prev.map((l) =>
          (l.cartKey || `${l.product?.id}_${l.selectedModele || ''}_${l.selectedCouleur || ''}`) === itemKey
            ? { ...l, quantite: stockMax }
            : l
        )
      );
      showToast(
        `Quantité ajustée au stock disponible (${stockMax} restants pour ${nomAffiche}). ${qteAjoutee} article(s) supplémentaire(s) ajouté(s) à votre panier.`,
        "warning"
      );
      return true;
    }

    // Case 4: Normal addition
    setCart((prev) => {
      if (itemExistant) {
        return prev.map((l) =>
          (l.cartKey || `${l.product?.id}_${l.selectedModele || ''}_${l.selectedCouleur || ''}`) === itemKey
            ? { ...l, quantite: nouvelleQuantite }
            : l
        );
      }
      return [
        ...prev,
        {
          cartKey: itemKey,
          product,
          quantite,
          selectedModele,
          selectedCouleur,
          selectedCouleurHex,
          selectedBrand,
          selectedImageUrl,
          selectedPriceKMF,
          selectedPriceFCFA
        }
      ];
    });

    const nomComplet = variantLabel ? `${product.nom} (${variantLabel})` : product.nom;

    if (stockMax === nouvelleQuantite) {
      showToast(
        `"${nomComplet}" ajouté ! Vous avez atteint la totalité du stock disponible (${stockMax}).`,
        "info"
      );
    } else {
      showToast(`"${nomComplet}" ajouté au panier !`, "success");
    }

    return true;
  }

  function updateQuantite(keyOrId, delta, index) {
    setCart((prev) => {
      let targetIndex = -1;
      if (typeof index === "number" && index >= 0 && index < prev.length) {
        targetIndex = index;
      } else {
        targetIndex = prev.findIndex((l, i) => isItemMatch(l, keyOrId, i));
      }

      if (targetIndex === -1) return prev;
      const item = prev[targetIndex];
      const stockMax = Number(item.product?.stock ?? 999);
      const nouvelleQte = item.quantite + delta;

      if (delta > 0 && nouvelleQte > stockMax) {
        showToast(
          `Stock limité ! Impossible d'ajouter plus de ${stockMax} article(s) pour "${item.product?.nom || 'ce produit'}".`,
          "warning"
        );
        return prev;
      }

      if (nouvelleQte <= 0) {
        return prev.filter((_, i) => i !== targetIndex);
      }

      return prev.map((l, i) => i === targetIndex ? { ...l, quantite: nouvelleQte } : l);
    });
  }

  function setExactQuantite(keyOrId, targetValue, index) {
    const parsed = parseInt(targetValue, 10);
    if (isNaN(parsed) || parsed < 1) {
      removeFromCart(keyOrId, index);
      return;
    }

    setCart((prev) => {
      let targetIndex = -1;
      if (typeof index === "number" && index >= 0 && index < prev.length) {
        targetIndex = index;
      } else {
        targetIndex = prev.findIndex((l, i) => isItemMatch(l, keyOrId, i));
      }

      if (targetIndex === -1) return prev;
      const item = prev[targetIndex];
      const stockMax = Number(item.product?.stock ?? 999);
      let nouvelleQte = parsed;

      if (nouvelleQte > stockMax) {
        showToast(
          `Quantité ajustée à ${stockMax} (maximum en stock pour "${item.product?.nom || 'ce produit'}").`,
          "warning"
        );
        nouvelleQte = stockMax;
      }

      return prev.map((l, i) => i === targetIndex ? { ...l, quantite: nouvelleQte } : l);
    });
  }

  function removeFromCart(keyOrId, index) {
    setCart((prev) => {
      if (typeof index === "number" && index >= 0 && index < prev.length) {
        return prev.filter((_, i) => i !== index);
      }
      return prev.filter((l, i) => !isItemMatch(l, keyOrId, i));
    });
  }

  function clearCart() {
    setCart([]);
  }

  function addMultipleToCart(items) {
    let addedCount = 0;
    setCart((prev) => {
      let newCart = [...prev];
      items.forEach(item => {
        const product = item.product;
        if (!product) return;
        const quantite = item.quantite || 1;
        const stockMax = Number(product.stock ?? 0);
        const itemKey = `${product.id}_${item.selectedModele || ''}_${item.selectedCouleur || ''}`;
        const itemExistant = newCart.find((l) => (l.cartKey || `${l.product?.id}_${l.selectedModele || ''}_${l.selectedCouleur || ''}`) === itemKey);
        const dejaEnPanier = itemExistant ? itemExistant.quantite : 0;
        if (stockMax > 0 && dejaEnPanier < stockMax) {
          const ajoutPossible = Math.min(quantite, stockMax - dejaEnPanier);
          if (itemExistant) {
            newCart = newCart.map((l) => (l.cartKey || `${l.product?.id}_${l.selectedModele || ''}_${l.selectedCouleur || ''}`) === itemKey ? { ...l, quantite: l.quantite + ajoutPossible } : l);
          } else {
            newCart.push({
              cartKey: itemKey,
              product,
              quantite: ajoutPossible,
              selectedModele: item.selectedModele || null,
              selectedCouleur: item.selectedCouleur || null,
              selectedBrand: item.marqueTelephone || null,
              selectedImageUrl: item.imageUrl || null
            });
          }
          addedCount++;
        }
      });
      return newCart;
    });
    
    if (addedCount > 0) {
      showToast(`${addedCount} article(s) ajouté(s) à votre panier.`, "success");
    } else {
      showToast("Certains articles sont en rupture de stock.", "warning");
    }
  }

  const [activeCurrency, setActiveCurrency] = useState(() => {
    try { return localStorage.getItem("soilihi_active_currency") || "KMF"; } catch (e) { return "KMF"; }
  });

  useEffect(() => {
    const handleCurr = (e) => setActiveCurrency(e.detail);
    window.addEventListener("currency_changed", handleCurr);
    return () => window.removeEventListener("currency_changed", handleCurr);
  }, []);

  const getLinePrice = (line, currency) => {
    if (currency === "FCFA" && line.selectedPriceFCFA && Number(line.selectedPriceFCFA) > 0) {
      return Number(line.selectedPriceFCFA);
    }
    if (currency !== "FCFA" && line.selectedPriceKMF && Number(line.selectedPriceKMF) > 0) {
      return Number(line.selectedPriceKMF);
    }
    return line.product ? getProductPrice(line.product, currency) : 0;
  };

  const subtotal = cart.reduce(
    (s, l) => s + getLinePrice(l, activeCurrency) * l.quantite,
    0
  );
  const count = cart.reduce((s, l) => s + l.quantite, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        addMultipleToCart,
        updateQuantite,
        setExactQuantite,
        removeFromCart,
        clearCart,
        subtotal,
        count,
        showToast,
        getLinePrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
