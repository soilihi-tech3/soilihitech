import React from "react";
import { useNavigate } from "react-router-dom";
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight, PackageOpen, MessageCircle } from "lucide-react";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { processWhatsAppOrder } from "../utils/whatsappOrder.js";

import { formatPrice as fcfa, getActiveCurrency, getProductPrice } from "../utils/currency.js";

export default function CartDrawer({ onClose }) {
  const { cart, updateQuantite, setExactQuantite, removeFromCart, subtotal, clearCart, showToast } = useCart();
  const { user, boutique } = useAuth();
  const navigate = useNavigate();

  const [activeCurrency, setActiveCurrencyState] = React.useState(() => getActiveCurrency());
  React.useEffect(() => {
    const handleCurr = (e) => setActiveCurrencyState(e.detail);
    window.addEventListener("currency_changed", handleCurr);
    return () => window.removeEventListener("currency_changed", handleCurr);
  }, []);

  const isWhatsAppEnabled = boutique?.modulesActifs?.commanderWhatsapp !== false;

  function handleWhatsAppClick() {
    onClose();
    if (!user) {
      navigate("/connexion?redirect=/commander?whatsapp=true");
      return;
    }
    navigate("/commander?whatsapp=true");
  }

  function goToCheckout() {
    onClose();
    navigate(user ? "/commander" : "/connexion?redirect=/commander");
  }

  const totalItems = cart.reduce((s, l) => s + l.quantite, 0);

  return (
    <div 
      className="bs-cart-overlay" 
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(22, 52, 36, 0.45)",
        backdropFilter: "blur(4px)",
        animation: "fadeIn 0.25s ease"
      }}
    >
      <div 
        className="bs-cart-panel" 
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", top: 0, right: 0, bottom: 0,
          width: 370, maxWidth: "95vw",
          background: "#fff",
          display: "flex", flexDirection: "column",
          boxShadow: "-8px 0 40px rgba(22,52,36,0.16)",
          animation: "slideInRight 0.3s ease"
        }}
      >
        {/* ─── HEADER ─── */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--line)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--paper)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              background: "var(--forest)", color: "#fff", borderRadius: 10, 
              width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <ShoppingBag size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--forest-dark)" }}>Votre panier</div>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>
                {totalItems > 0 ? `${totalItems} article${totalItems > 1 ? "s" : ""} sélectionné${totalItems > 1 ? "s" : ""}` : "Panier vide"}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: "var(--line)", border: "none", borderRadius: "50%",
              width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--ink)", transition: "all 0.2s"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--forest-light)"}
            onMouseLeave={e => e.currentTarget.style.background = "var(--line)"}
          >
            <X size={16} />
          </button>
        </div>

        {/* ─── ITEMS ─── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {cart.length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: "100%", gap: 16, color: "var(--muted)"
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <PackageOpen size={36} color="var(--sage)" />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)", marginBottom: 6 }}>Votre panier est vide</div>
                <div style={{ fontSize: 13 }}>Parcourez nos produits et ajoutez-en au panier.</div>
              </div>
              <button 
                onClick={() => { onClose(); navigate("/catalogue"); }}
                className="bs-btn-primary"
                style={{ marginTop: 8, padding: "10px 22px" }}
              >
                Découvrir les produits
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {cart.map((l) => {
                const itemKey = l.cartKey || (l.product ? `${l.product.id}_${l.selectedModele || ''}_${l.selectedCouleur || ''}` : String(l.id));
                const isSenegal = activeCurrency === "FCFA";
                
                let prix = getProductPrice(l.product, activeCurrency);
                if (isSenegal && l.selectedPriceFCFA && Number(l.selectedPriceFCFA) > 0) {
                  prix = Number(l.selectedPriceFCFA);
                } else if (!isSenegal && l.selectedPriceKMF && Number(l.selectedPriceKMF) > 0) {
                  prix = Number(l.selectedPriceKMF);
                }

                const lineTotal = prix * l.quantite;
                const regularPrice = isSenegal && l.product?.prixSenegal && Number(l.product.prixSenegal) > 0
                  ? Number(l.product.prixSenegal)
                  : Number(l.product?.prix || 0);
                const hasPromo = !l.selectedPriceFCFA && !l.selectedPriceKMF && (isSenegal 
                  ? (l.product?.prixPromoSenegal && Number(l.product.prixPromoSenegal) > 0)
                  : (l.product?.prixPromo && Number(l.product.prixPromo) > 0));

                return (
                  <div key={itemKey} style={{
                    display: "flex", gap: 14, padding: "14px",
                    background: "var(--paper)", borderRadius: 14,
                    border: "1px solid var(--line)",
                    transition: "box-shadow 0.2s"
                  }}>
                    {/* Image */}
                    <div style={{
                      width: 72, height: 72, borderRadius: 10, overflow: "hidden",
                      flexShrink: 0, border: "1px solid var(--line)", background: "#fff"
                    }}>
                      <img 
                        src={l.selectedImageUrl || l.product?.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=100&q=80"} 
                        alt={l.product?.nom} 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 700, fontSize: 13.5, color: "var(--ink)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                      }}>
                        {l.product?.nom}
                      </div>

                      {/* Variant badges */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4, marginBottom: 4 }}>
                        {l.selectedModele && (
                          <span style={{
                            fontSize: 11, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8",
                            padding: "2px 7px", borderRadius: 6, border: "1px solid #BFDBFE"
                          }}>
                            {l.selectedModele}
                          </span>
                        )}
                        {l.selectedCouleur && (
                          <span style={{
                            fontSize: 11, fontWeight: 600, background: "#F3F4F6", color: "#374151",
                            padding: "2px 7px", borderRadius: 6, border: "1px solid #E5E7EB",
                            display: "inline-flex", alignItems: "center", gap: 4
                          }}>
                            {l.selectedCouleurHex && (
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.selectedCouleurHex, border: "1px solid rgba(0,0,0,0.2)" }} />
                            )}
                            {l.selectedCouleur}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {fcfa(prix, activeCurrency)} {l.product?.unite ? `/ ${l.product.unite}` : ""}
                      </div>
                      {hasPromo && (
                        <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, marginTop: 2 }}>
                          PROMO · <span style={{ textDecoration: "line-through", color: "var(--muted)" }}>{fcfa(regularPrice, activeCurrency)}</span>
                        </div>
                      )}

                      {/* Qty controls */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 0,
                          border: "1px solid var(--line)", borderRadius: 20, overflow: "hidden",
                          background: "#fff"
                        }}>
                          <button 
                            onClick={() => updateQuantite(itemKey, -1, index)}
                            style={{
                              width: 28, height: 28, background: "none", border: "none",
                              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                              color: "var(--ink)", transition: "background 0.15s"
                            }}
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={l.product?.stock || 999}
                            value={l.quantite}
                            onChange={(e) => setExactQuantite(itemKey, e.target.value, index)}
                            style={{
                              width: 34, textAlign: "center", fontWeight: 700, fontSize: 13,
                              border: "none", background: "transparent", color: "var(--ink)", outline: "none",
                              MozAppearance: "textfield"
                            }}
                          />
                          <button 
                            onClick={() => updateQuantite(itemKey, 1, index)}
                            style={{
                              width: 28, height: 28, background: "none", border: "none",
                              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                              color: "var(--ink)", transition: "background 0.15s"
                            }}
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)" }}>
                            {fcfa(lineTotal, activeCurrency)}
                          </span>
                          <button 
                            onClick={() => removeFromCart(itemKey, index)}
                            title="Retirer du panier"
                            style={{
                              width: 28, height: 28, borderRadius: "50%", border: "none",
                              background: "#FDF2F0", color: "#B4483A", cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 0.2s"
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── FOOTER ─── */}
        {cart.length > 0 && (
          <div style={{
            padding: "20px 24px",
            borderTop: "1px solid var(--line)",
            background: "var(--paper)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Sous-total</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{fcfa(subtotal, activeCurrency)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Livraison</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--forest)" }}>Calculée à l'étape suivante</span>
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              paddingTop: 14, borderTop: "1.5px solid var(--line)", marginBottom: 18
            }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Total estimé</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: "var(--forest-dark)" }}>{fcfa(subtotal, activeCurrency)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button 
                className="bs-btn-primary" 
                style={{
                  width: "100%", padding: "14px 20px", fontSize: 15,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  borderRadius: 14
                }} 
                onClick={goToCheckout}
              >
                Passer la commande <ArrowRight size={18} />
              </button>

              {isWhatsAppEnabled && (
                <button
                  type="button"
                  onClick={handleWhatsAppClick}
                  style={{
                    width: "100%", padding: "12px 20px", fontSize: 14, fontWeight: 700,
                    background: "#25D366", color: "#ffffff", border: "none",
                    borderRadius: 14, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: "0 4px 12px rgba(37, 211, 102, 0.3)"
                  }}
                >
                  <MessageCircle size={18} fill="#ffffff" color="#25D366" />
                  Commander via WhatsApp
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              style={{
                width: "100%", marginTop: 10, background: "none", border: "none",
                fontSize: 13, color: "var(--muted)", cursor: "pointer", padding: "6px 0",
                textDecoration: "underline"
              }}
            >
              Continuer mes achats
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
