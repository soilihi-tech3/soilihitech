import React, { useState } from "react";
import { X, Pencil, KeyRound, Coins, Plus } from "lucide-react";
import { ALL_CURRENCIES, getBoutiqueCurrencyCodes } from "../../../utils/currency";

export default function EditBoutiqueModal({ form, setForm, onSubmit, onClose }) {
  const [customCurrency, setCustomCurrency] = useState("");
  if (!form) return null;

  const selectedCurrencies = getBoutiqueCurrencyCodes(form);

  function toggleCurrency(code) {
    const clean = String(code).trim().toUpperCase();
    let next = [...selectedCurrencies];
    if (next.includes(clean)) {
      if (next.length <= 1) return; // Au moins 1 devise obligatoire
      next = next.filter((c) => c !== clean);
    } else {
      next.push(clean);
    }
    setForm({ ...form, devisesDisponibles: next, devise: next[0] });
  }

  function addCustomCurrency() {
    const clean = String(customCurrency || "").trim().toUpperCase();
    if (!clean) return;
    if (!selectedCurrencies.includes(clean)) {
      const next = [...selectedCurrencies, clean];
      setForm({ ...form, devisesDisponibles: next, devise: next[0] });
    }
    setCustomCurrency("");
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 560,
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column"
      }}>
        {/* HEADER */}
        <div style={{
          padding: "20px 24px", background: "var(--forest-dark)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Pencil size={20} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Modifier « {form.nom} »</h3>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
              Nom de la Boutique
            </label>
            <input
              type="text"
              value={form.nom || ""}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                Slug (Identifiant URL)
              </label>
              <input
                type="text"
                value={form.slug || ""}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                Formule d'Abonnement
              </label>
              <select
                value={form.formuleAbonnement || "standard"}
                onChange={(e) => setForm({ ...form, formuleAbonnement: e.target.value })}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none", background: "#fff" }}
              >
                <option value="gratuit">Gratuit / Essai</option>
                <option value="standard">Standard (Commission 5%)</option>
                <option value="premium">Premium (Accès Illimité)</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
              Domaine Personnalisé (ex: abdou.com)
            </label>
            <input
              type="text"
              placeholder="ex: abdou.com"
              value={form.customDomain || ""}
              onChange={(e) => setForm({ ...form, customDomain: e.target.value.toLowerCase() })}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none", fontFamily: "monospace" }}
            />
          </div>

          {/* ── DEVISES & PRIX PRODUITS ── */}
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 800, color: "var(--forest-dark)" }}>
                <Coins size={15} color="var(--accent)" />
                <span>Devises autorisées & Prix Produits</span>
              </div>
              <span style={{
                background: selectedCurrencies.length === 1 ? "#EFF6FF" : "#EBF7F0",
                color: selectedCurrencies.length === 1 ? "#1D4ED8" : "#1F4D3A",
                padding: "3px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 800
              }}>
                {selectedCurrencies.length === 1
                  ? `1 devise (${selectedCurrencies[0]}) → 1 prix`
                  : `${selectedCurrencies.length} devises (${selectedCurrencies.join(" + ")}) → ${selectedCurrencies.length} prix`}
              </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {ALL_CURRENCIES.map((cur) => {
                const active = selectedCurrencies.includes(cur.code);
                return (
                  <button
                    key={cur.code}
                    type="button"
                    onClick={() => toggleCurrency(cur.code)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                      border: active ? "2px solid var(--forest-dark)" : "1px solid #CBD5E1",
                      background: active ? "#EBF7F0" : "#fff",
                      color: active ? "var(--forest-dark)" : "#475569"
                    }}
                  >
                    <span>{cur.flag}</span>
                    <span>{cur.code}</span>
                    {active && <span style={{ fontSize: 10 }}>✓</span>}
                  </button>
                );
              })}
              {selectedCurrencies
                .filter((code) => !ALL_CURRENCIES.some((c) => c.code === code))
                .map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleCurrency(code)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                      border: "2px solid var(--forest-dark)", background: "#EBF7F0", color: "var(--forest-dark)"
                    }}
                  >
                    <span>💱 {code} ✓</span>
                  </button>
                ))}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="Autre devise (ex: XAF, GNF...)"
                value={customCurrency}
                onChange={(e) => setCustomCurrency(e.target.value.toUpperCase())}
                style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12 }}
              />
              <button
                type="button"
                onClick={addCustomCurrency}
                style={{
                  padding: "6px 10px", borderRadius: 8, border: "1px solid var(--forest-dark)",
                  background: "#fff", color: "var(--forest-dark)", fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4
                }}
              >
                <Plus size={13} /> Ajouter
              </button>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "4px 0" }} />

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--forest-dark)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <KeyRound size={15} />
              <span>Changer le mot de passe Admin (optionnel)</span>
            </label>
            <input
              type="password"
              placeholder="Laisser vide pour ne pas modifier"
              value={form.motDePasseAdmin || ""}
              onChange={(e) => setForm({ ...form, motDePasseAdmin: e.target.value })}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none" }}
            />
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ padding: "16px 24px", background: "#F8FAFC", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border)", background: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Annuler
          </button>
          <button onClick={onSubmit} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "var(--forest-dark)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
