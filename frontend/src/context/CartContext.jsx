import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { getProductPrice } from "../utils/currency.js";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem("easymarket_cart");
      return saved ? JSON.parse(saved) : [];
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
      toast(message, { icon: "ℹ️" });
    }
  }

  function addToCart(product, quantite = 1) {
    if (!product) return false;

    const stockMax = Number(product.stock ?? 0);
    const itemExistant = cart.find((l) => l.product.id === product.id);
    const dejaEnPanier = itemExistant ? itemExistant.quantite : 0;

    // Case 1: Product out of stock completely
    if (stockMax <= 0) {
      showToast(
        `Desolé, le produit "${product.nom}" est actuellement en rupture de stock.`,
        "error"
      );
      return false;
    }

    // Case 2: Cart already has total available stock
    if (dejaEnPanier >= stockMax) {
      showToast(
        `Stock épuisé pour "${product.nom}" ! Il reste ${stockMax} article(s) en stock et vous l'avez déjà dans votre panier. Impossible d'en ajouter plus.`,
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
          l.product.id === product.id ? { ...l, quantite: stockMax } : l
        )
      );
      showToast(
        `Quantité ajustée au stock disponible (${stockMax} restants). ${qteAjoutee} article(s) supplémentaire(s) ajouté(s) à votre panier.`,
        "warning"
      );
      return true;
    }

    // Case 4: Normal addition
    setCart((prev) => {
      if (itemExistant) {
        return prev.map((l) =>
          l.product.id === product.id
            ? { ...l, quantite: nouvelleQuantite }
            : l
        );
      }
      return [...prev, { product, quantite }];
    });

    if (stockMax === nouvelleQuantite) {
      showToast(
        `"${product.nom}" ajouté ! Vous avez atteint la totalité du stock disponible (${stockMax}).`,
        "info"
      );
    } else {
      showToast(`"${product.nom}" ajouté au panier !`, "success");
    }

    return true;
  }

  function updateQuantite(productId, delta) {
    setCart((prev) => {
      const item = prev.find((l) => l.product.id === productId);
      if (!item) return prev;

      const stockMax = Number(item.product.stock ?? 0);
      const nouvelleQte = item.quantite + delta;

      if (delta > 0 && nouvelleQte > stockMax) {
        showToast(
          `Stock limité ! Impossible d'ajouter plus de ${stockMax} article(s) pour "${item.product.nom}".`,
          "warning"
        );
        return prev;
      }

      return prev
        .map((l) =>
          l.product.id === productId ? { ...l, quantite: nouvelleQte } : l
        )
        .filter((l) => l.quantite > 0);
    });
  }

  function setExactQuantite(productId, targetValue) {
    const parsed = parseInt(targetValue, 10);
    if (isNaN(parsed) || parsed < 1) {
      // Remove or reset to 1
      removeFromCart(productId);
      return;
    }

    setCart((prev) => {
      const item = prev.find((l) => l.product.id === productId);
      if (!item) return prev;

      const stockMax = Number(item.product.stock ?? 0);
      let nouvelleQte = parsed;

      if (nouvelleQte > stockMax) {
        showToast(
          `Quantité ajustée à ${stockMax} (maximum en stock pour "${item.product.nom}").`,
          "warning"
        );
        nouvelleQte = stockMax;
      }

      return prev.map((l) =>
        l.product.id === productId ? { ...l, quantite: nouvelleQte } : l
      );
    });
  }

  function removeFromCart(productId) {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
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
        if (!product) return; // Skip if product was deleted
        const quantite = item.quantite || 1;
        const stockMax = Number(product.stock ?? 0);
        const itemExistant = newCart.find((l) => l.product.id === product.id);
        const dejaEnPanier = itemExistant ? itemExistant.quantite : 0;
        if (stockMax > 0 && dejaEnPanier < stockMax) {
          const ajoutPossible = Math.min(quantite, stockMax - dejaEnPanier);
          if (itemExistant) {
            newCart = newCart.map((l) => l.product.id === product.id ? { ...l, quantite: l.quantite + ajoutPossible } : l);
          } else {
            newCart.push({ product, quantite: ajoutPossible });
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

  const subtotal = cart.reduce(
    (s, l) => s + (l.product ? getProductPrice(l.product, activeCurrency) : 0) * l.quantite,
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
      }}
    >
      {children}

    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
