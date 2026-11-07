import React from "react";
import { X, Pencil, KeyRound, Building2, Lock, Unlock } from "lucide-react";

export default function EditUserModal({ form, setForm, boutiques = [], onSubmit, onClose }) {
  if (!form) return null;

  const isLocked5Attempts = form.statut === "suspendu" && (form.lockReason === "5_tentatives_mdp" || Number(form.failedLoginAttempts) >= 5);

  let currentManagedIds = [];
  if (Array.isArray(form.boutiquesGerees)) {
    currentManagedIds = form.boutiquesGerees.map(Number).filter(Boolean);
  } else if (typeof form.boutiquesGerees === "string") {
    try {
      const parsed = JSON.parse(form.boutiquesGerees);
      if (Array.isArray(parsed)) currentManagedIds = parsed.map(Number).filter(Boolean);
    } catch (_) {}
  }
  if (form.boutiqueId && !currentManagedIds.includes(Number(form.boutiqueId))) {
    currentManagedIds.push(Number(form.boutiqueId));
  }

  function toggleManagedBoutique(bId) {
    const numId = Number(bId);
    let next = [...currentManagedIds];
    if (next.includes(numId)) {
      if (numId === Number(form.boutiqueId) && next.length <= 1) return;
      next = next.filter((id) => id !== numId);
    } else {
      next.push(numId);
    }
    setForm({
      ...form,
      boutiquesGerees: next,
      peutGererPlusieursBoutiques: next.length > 1 ? true : form.peutGererPlusieursBoutiques,
      boutiqueId: form.boutiqueId || next[0] || null
    });
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 560,
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "92vh", display: "flex", flexDirection: "column"
      }}>
        {/* HEADER */}
        <div style={{
          padding: "20px 24px", background: "var(--forest-dark)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Pencil size={20} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Modifier Utilisateur « {form.nom} »</h3>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
          {isLocked5Attempts && (
            <div style={{
              background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "12px 16px",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#991B1B", fontSize: 12.5, fontWeight: 700 }}>
                <Lock size={18} />
                <div>
                  <div>Compte désactivé automatiquement après 5 tentatives de mot de passe erronées.</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "#B91C1C" }}>
                    En tant que Super Admin, vous pouvez réactiver ce compte ci-dessous.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, statut: "actif", failedLoginAttempts: 0, lockReason: null })}
                style={{
                  padding: "7px 12px", borderRadius: 8, border: "none", background: "#16A34A", color: "#fff",
                  fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap"
                }}
              >
                <Unlock size={14} /> Débloquer
              </button>
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
              Nom Complet *
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
                Adresse Email *
              </label>
              <input
                type="email"
                value={form.email || ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                Téléphone
              </label>
              <input
                type="text"
                value={form.telephone || ""}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                Rôle Système
              </label>
              <select
                value={form.role || "client"}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none", background: "#fff" }}
              >
                <option value="client">Client</option>
                <option value="employe">Employé Boutique</option>
                <option value="admin">Admin Boutique</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                Boutique Principale Rattachée
              </label>
              <select
                value={form.boutiqueId || ""}
                onChange={(e) => {
                  const newBId = e.target.value ? Number(e.target.value) : null;
                  const nextManaged = newBId && !currentManagedIds.includes(newBId) ? [...currentManagedIds, newBId] : currentManagedIds;
                  setForm({ ...form, boutiqueId: newBId, boutiquesGerees: nextManaged });
                }}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none", background: "#fff" }}
              >
                <option value="">Plateforme Globale (Aucune)</option>
                {boutiques.map(b => (
                  <option key={b.id} value={b.id}>{b.nom}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── DROIT MULTI-BOUTIQUES (ACCORDÉ UNIQUEMENT PAR LE SUPER ADMIN) ── */}
          {form.role === "admin" && (
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: "#166534" }}>
                  <Building2 size={16} />
                  <span>Accès Multi-Boutiques (Accordé par le Super Admin)</span>
                </div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#166534", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.peutGererPlusieursBoutiques || currentManagedIds.length > 1)}
                    onChange={(e) => setForm({ ...form, peutGererPlusieursBoutiques: e.target.checked })}
                  />
                  <span>Autoriser plusieurs boutiques</span>
                </label>
              </div>

              <p style={{ fontSize: 11.5, color: "#15803D", margin: "0 0 10px" }}>
                Cochez les boutiques que cet Administrateur a le droit de gérer (2, 3 boutiques ou plus). Il disposera d'une vue globale consolidée et pourra choisir la boutique lors de l'ajout d'un produit.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                {boutiques.map((b) => {
                  const checked = currentManagedIds.includes(Number(b.id));
                  return (
                    <label
                      key={b.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                        borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 700,
                        background: checked ? "#DCFCE7" : "#fff",
                        border: checked ? "1.5px solid #16A34A" : "1px solid #CBD5E1",
                        color: checked ? "#14532D" : "#334155"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleManagedBoutique(b.id)}
                      />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {b.nom}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "4px 0" }} />

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--forest-dark)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <KeyRound size={15} />
              <span>Réinitialiser le Mot de Passe (Optionnel)</span>
            </label>
            <input
              type="password"
              placeholder="Laisser vide si inchangé"
              value={form.motDePasse || ""}
              onChange={(e) => setForm({ ...form, motDePasse: e.target.value })}
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
            Enregistrer les modifications
          </button>
        </div>
      </div>
    </div>
  );
}
