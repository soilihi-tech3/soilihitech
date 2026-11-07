import React, { useState } from "react";
import { X, Store, UserCheck, Eye, EyeOff, RefreshCw, Copy, CheckCircle, Key, Coins, Building2, Plus } from "lucide-react";
import { ALL_CURRENCIES } from "../../../utils/currency";

export default function CreateBoutiqueModal({ form, setForm, existingAdmins = [], onSubmit, onClose }) {
  const [showPassword, setShowPassword] = useState(true);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copied, setCopied] = useState(false);
  const [adminMode, setAdminMode] = useState(form?.existingAdminId ? "existing" : "new"); // "new" | "existing"
  const [customCurrency, setCustomCurrency] = useState("");

  if (!form) return null;

  const selectedCurrencies = Array.isArray(form.devisesDisponibles) && form.devisesDisponibles.length > 0
    ? form.devisesDisponibles
    : ["KMF", "FCFA"];

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

  function generateRandomPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm({ ...form, motDePasseAdmin: pwd });
    setShowPassword(true);
  }

  async function handleInternalSubmit() {
    const res = await onSubmit();
    if (res && res.admin) {
      if (res.attachedExistingAdmin) {
        onClose();
        return;
      }
      setCreatedCredentials({
        nomBoutique: res.boutique?.nom || form.nomBoutique,
        devises: res.boutique?.devisesDisponibles || selectedCurrencies,
        nom: res.admin.nom || form.nomAdmin,
        email: res.admin.email || form.emailAdmin,
        telephone: res.admin.telephone || form.telephoneAdmin,
        identifiant: res.admin.email || res.admin.telephone || form.emailAdmin || form.telephoneAdmin,
        motDePasse: res.admin.generatedPassword || form.motDePasseAdmin || "changeme123"
      });
    }
  }

  function copyCredentialsToClipboard() {
    if (!createdCredentials) return;
    const textToCopy = `Compte Admin créé pour la boutique ${createdCredentials.nomBoutique} !\nDevises configurées : ${(createdCredentials.devises || []).join(", ")}\nNom: ${createdCredentials.nom}\nEmail: ${createdCredentials.email || "N/A"}\nTéléphone: ${createdCredentials.telephone || "N/A"}\nMot de passe temporaire: ${createdCredentials.motDePasse}\n\nNote: Le mot de passe devra être changé lors de la première connexion.`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  if (createdCredentials) {
    return (
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20
      }}>
        <div style={{
          background: "#fff", borderRadius: 20, width: "100%", maxWidth: 520,
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)", padding: 32, textAlign: "center"
        }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#EBF7F0", color: "#1F4D3A", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <CheckCircle size={32} />
          </div>

          <h2 style={{ margin: "0 0 8px", fontSize: 20, color: "var(--forest-dark)" }}>Boutique & Admin créés avec succès !</h2>
          <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 20px" }}>
            Un e-mail d'accueil avec ces identifiants a été envoyé à l'administrateur.
          </p>

          <div style={{ background: "var(--paper)", padding: 20, borderRadius: 14, border: "1px solid var(--line)", textAlign: "left", marginBottom: 20 }}>
            <div style={{ fontSize: 13, marginBottom: 8, color: "var(--ink)" }}>
              <strong>Nom de la boutique :</strong> {createdCredentials.nomBoutique}
            </div>
            <div style={{ fontSize: 13, marginBottom: 8, color: "var(--ink)" }}>
              <strong>Devises & Prix Produits :</strong> {(createdCredentials.devises || []).join(" + ")} ({(createdCredentials.devises || []).length} prix par produit)
            </div>
            <div style={{ fontSize: 13, marginBottom: 8, color: "var(--ink)" }}>
              <strong>Admin :</strong> {createdCredentials.nom}
            </div>
            <div style={{ fontSize: 13, marginBottom: 8, color: "var(--ink)" }}>
              <strong>Email :</strong> <span style={{ fontFamily: "monospace", color: "var(--forest-dark)", fontWeight: 700 }}>{createdCredentials.email || "Non renseigné"}</span>
            </div>
            <div style={{ fontSize: 13, marginBottom: 8, color: "var(--ink)" }}>
              <strong>Téléphone :</strong> <span style={{ fontFamily: "monospace", color: "var(--forest-dark)", fontWeight: 700 }}>{createdCredentials.telephone || "Non renseigné"}</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink)" }}>
              <strong>Mot de passe générique :</strong> <span style={{ fontFamily: "monospace", color: "#163424", fontWeight: 800, background: "#E2E8F0", padding: "2px 8px", borderRadius: 6 }}>{createdCredentials.motDePasse}</span>
            </div>
          </div>

          <div style={{ fontSize: 12.5, color: "#D97706", background: "#FEF3C7", padding: "10px 14px", borderRadius: 10, marginBottom: 20, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, textAlign: "left" }}>
            <Key size={16} /> À la 1ère connexion, cet admin devra obligatoirement modifier son mot de passe.
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={copyCredentialsToClipboard}
              style={{
                flex: 1, padding: "12px", borderRadius: 12, border: "1px solid var(--forest)",
                background: copied ? "var(--forest)" : "#fff", color: copied ? "#fff" : "var(--forest)",
                fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8
              }}
            >
              {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
              {copied ? "Copié !" : "Copier les identifiants"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bs-btn-primary"
              style={{ flex: 1, borderRadius: 12 }}
            >
              Terminer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 600,
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "92vh", display: "flex", flexDirection: "column"
      }}>
        {/* HEADER */}
        <div style={{
          padding: "20px 24px", background: "var(--forest-dark)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Store size={20} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Créer une Nouvelle Boutique</h3>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
              Nom de la Boutique *
            </label>
            <input
              type="text"
              placeholder="Ex: Épicerie Thiès Express"
              value={form.nomBoutique || ""}
              onChange={(e) => setForm({ ...form, nomBoutique: e.target.value })}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                Slug URL (identifiant unique) *
              </label>
              <input
                type="text"
                placeholder="Ex: thies-express"
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
              Domaine Personnalisé (Optionnel - Ex: comoresbiachara.site)
            </label>
            <input
              type="text"
              placeholder="Ex: comoresbiachara.site"
              value={form.customDomain || ""}
              onChange={(e) => setForm({ ...form, customDomain: e.target.value.toLowerCase() })}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none", fontFamily: "monospace" }}
            />
          </div>

          {/* ── DEVISES & NOMBRE DE PRIX PRODUITS ── */}
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: "var(--forest-dark)" }}>
                <Coins size={16} color="var(--accent)" />
                <span>Devises de la Boutique & Prix Produits *</span>
              </div>
              <span style={{
                background: selectedCurrencies.length === 1 ? "#EFF6FF" : "#EBF7F0",
                color: selectedCurrencies.length === 1 ? "#1D4ED8" : "#1F4D3A",
                padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800
              }}>
                {selectedCurrencies.length === 1
                  ? `1 seule devise (${selectedCurrencies[0]}) → 1 prix / produit`
                  : `${selectedCurrencies.length} devises (${selectedCurrencies.join(" + ")}) → ${selectedCurrencies.length} prix / produit`}
              </span>
            </div>

            <p style={{ fontSize: 11.5, color: "#64748B", margin: "0 0 12px" }}>
              Choisissez 1, 2 ou plusieurs devises (ex: <strong>FCFA</strong> seul, <strong>EUR</strong> seul, ou <strong>FCFA + EUR</strong>, <strong>KMF + FCFA</strong>).
              Si 1 seule devise est cochée, les KPIs d'autres devises seront masqués et l'ajout de produit n'affichera qu'un seul prix.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {ALL_CURRENCIES.map((cur) => {
                const active = selectedCurrencies.includes(cur.code);
                return (
                  <button
                    key={cur.code}
                    type="button"
                    onClick={() => toggleCurrency(cur.code)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "7px 12px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                      border: active ? "2px solid var(--forest-dark)" : "1px solid #CBD5E1",
                      background: active ? "#EBF7F0" : "#fff",
                      color: active ? "var(--forest-dark)" : "#475569"
                    }}
                  >
                    <span>{cur.flag}</span>
                    <span>{cur.code}</span>
                    {active && <span style={{ fontSize: 10, background: "var(--forest-dark)", color: "#fff", borderRadius: 99, padding: "1px 5px" }}>✓</span>}
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
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "7px 12px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
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
                placeholder="Autre devise (ex: XAF, GNF, TND...)"
                value={customCurrency}
                onChange={(e) => setCustomCurrency(e.target.value.toUpperCase())}
                style={{ flex: 1, padding: "7px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12 }}
              />
              <button
                type="button"
                onClick={addCustomCurrency}
                style={{
                  padding: "7px 12px", borderRadius: 8, border: "1px solid var(--forest-dark)",
                  background: "#fff", color: "var(--forest-dark)", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4
                }}
              >
                <Plus size={14} /> Ajouter devise
              </button>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "4px 0" }} />

          {/* ── CHOIX DE L'ADMINISTRATEUR (NOUVEAU OU MULTI-BOUTIQUES) ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 6 }}>
              <UserCheck size={16} />
              <span>Propriétaire / Administrateur de la Boutique</span>
            </div>

            <div style={{ display: "flex", background: "#F1F5F9", padding: 3, borderRadius: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setAdminMode("new");
                  setForm({ ...form, existingAdminId: null });
                }}
                style={{
                  padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: adminMode === "new" ? "#fff" : "transparent",
                  color: adminMode === "new" ? "var(--forest-dark)" : "#64748B",
                  boxShadow: adminMode === "new" ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                }}
              >
                Créer un nouvel Admin
              </button>
              <button
                type="button"
                onClick={() => setAdminMode("existing")}
                style={{
                  padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: adminMode === "existing" ? "#fff" : "transparent",
                  color: adminMode === "existing" ? "var(--forest-dark)" : "#64748B",
                  boxShadow: adminMode === "existing" ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                }}
              >
                Rattacher à un Admin existant (Multi-Boutiques)
              </button>
            </div>
          </div>

          {adminMode === "existing" ? (
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 800, color: "#166534", marginBottom: 8 }}>
                <Building2 size={15} />
                <span>Sélectionner l'Admin existant à qui donner l'accès Multi-Boutiques *</span>
              </label>
              <select
                value={form.existingAdminId || ""}
                onChange={(e) => setForm({ ...form, existingAdminId: e.target.value ? Number(e.target.value) : null })}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #86EFAC", fontSize: 14, outline: "none", background: "#fff", fontWeight: 600 }}
              >
                <option value="">-- Choisir un Administrateur existant --</option>
                {existingAdmins.map((adm) => (
                  <option key={adm.id} value={adm.id}>
                    {adm.nom} ({adm.email || adm.telephone}) — Boutique actuelle : {adm.boutique?.nom || `#${adm.boutiqueId}`}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 11.5, color: "#15803D", margin: "8px 0 0" }}>
                En rattachant cette nouvelle boutique à cet Admin, le Super Admin lui accorde automatiquement le droit de gérer plusieurs boutiques et de voir la vue globale consolidée.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                  Nom Complet de l'Admin *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Mamadou Diallo"
                  value={form.nomAdmin || ""}
                  onChange={(e) => setForm({ ...form, nomAdmin: e.target.value })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                    Email de Connexion *
                  </label>
                  <input
                    type="email"
                    placeholder="admin@boutique.com"
                    value={form.emailAdmin || ""}
                    onChange={(e) => setForm({ ...form, emailAdmin: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                    Téléphone de l'Admin
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: +269 332 00 00"
                    value={form.telephoneAdmin || ""}
                    onChange={(e) => setForm({ ...form, telephoneAdmin: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none" }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>
                    Mot de Passe Généré *
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    style={{ background: "none", border: "none", color: "var(--forest)", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <RefreshCw size={12} /> Régénérer
                  </button>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Mot de passe"
                    value={form.motDePasseAdmin || ""}
                    onChange={(e) => setForm({ ...form, motDePasseAdmin: e.target.value })}
                    style={{ width: "100%", padding: "10px 40px 10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", color: "var(--muted)"
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div style={{ padding: "16px 24px", background: "#F8FAFC", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border)", background: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Annuler
          </button>
          <button onClick={handleInternalSubmit} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "var(--forest-dark)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            {adminMode === "existing" ? "Créer & Rattacher à l'Admin" : "Créer la Boutique & Envoyer Identifiants"}
          </button>
        </div>
      </div>
    </div>
  );
}
