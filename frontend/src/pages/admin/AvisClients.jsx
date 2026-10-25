import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { PlusCircle, List, Trash2, Pencil, CheckCircle, Eye, EyeOff, MessageSquare, Image, Star, X } from "lucide-react";
import api from "../../api";
import ImageUploader from "../../components/ImageUploader.jsx";

export default function AdminAvisClients() {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("liste"); // "liste" | "ajout"
  const [editingId, setEditingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const initialForm = {
    nom: "",
    photoUrl: "",
    genre: "femme", // 'femme' | 'homme'
    type: "capture_whatsapp", // 'capture_whatsapp' | 'texte'
    message: "",
    captureUrl: "",
    note: 5,
    actif: true,
    ordre: 0,
  };

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  function loadTestimonials() {
    setLoading(true);
    api.get("/admin/testimonials")
      .then((res) => setTestimonials(res.data || []))
      .catch((err) => toast.error("Erreur de chargement des avis : " + (err.response?.data?.message || err.message)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTestimonials();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function startEdit(t) {
    setEditingId(t.id);
    setForm({
      nom: t.nom || "",
      photoUrl: t.photoUrl || "",
      genre: t.genre || "femme",
      type: t.type || "capture_whatsapp",
      message: t.message || "",
      captureUrl: t.captureUrl || "",
      note: t.note || 5,
      actif: t.actif !== undefined ? t.actif : true,
      ordre: t.ordre || 0,
    });
    setActiveTab("ajout");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(initialForm);
    setActiveTab("liste");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nom.trim()) {
      toast.error("Le nom du client est requis.");
      return;
    }
    if (form.type === "capture_whatsapp" && !form.captureUrl) {
      toast.error("Veuillez ajouter la capture d'écran WhatsApp.");
      return;
    }
    if (form.type === "texte" && !form.message?.trim()) {
      toast.error("Veuillez saisir le message du client.");
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        const res = await api.put(`/admin/testimonials/${editingId}`, form);
        toast.success("Avis client mis à jour !");
        setTestimonials((prev) => prev.map((t) => (t.id === editingId ? res.data : t)));
      } else {
        const res = await api.post("/admin/testimonials", form);
        toast.success("Nouvel avis client ajouté avec succès !");
        setTestimonials((prev) => [res.data, ...prev]);
      }
      cancelEdit();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(t) {
    try {
      const updated = { ...t, actif: !t.actif };
      await api.put(`/admin/testimonials/${t.id}`, { actif: !t.actif });
      setTestimonials((prev) => prev.map((item) => (item.id === t.id ? updated : item)));
      toast.success(updated.actif ? "Avis activé et visible sur l'accueil." : "Avis masqué.");
    } catch (err) {
      toast.error("Erreur lors de la modification du statut.");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet avis client ?")) return;
    try {
      await api.delete(`/admin/testimonials/${id}`);
      setTestimonials((prev) => prev.filter((t) => t.id !== id));
      toast.success("Avis supprimé.");
    } catch (err) {
      toast.error("Erreur lors de la suppression.");
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Avis Clients & Captures WhatsApp</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Gérez les retours vérifiés de vos clients affichés en continu sur la page d'accueil.
          </p>
        </div>

        {/* TABS NAVIGATION */}
        <div style={{ display: "flex", gap: 8, background: "var(--paper)", padding: 4, borderRadius: 30, border: "1px solid var(--line)" }}>
          <button
            className={`bs-btn-primary ${activeTab === "liste" ? "" : "inactive"}`}
            style={{ padding: "8px 18px", borderRadius: 24, fontSize: 13, background: activeTab === "liste" ? "var(--forest)" : "none", color: activeTab === "liste" ? "#fff" : "var(--muted)", border: "none", cursor: "pointer", fontWeight: 700 }}
            onClick={() => { setEditingId(null); setForm(initialForm); setActiveTab("liste"); }}
          >
            <List size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} /> Liste ({testimonials.length})
          </button>
          <button
            className={`bs-btn-primary ${activeTab === "ajout" ? "" : "inactive"}`}
            style={{ padding: "8px 18px", borderRadius: 24, fontSize: 13, background: activeTab === "ajout" ? "var(--forest)" : "none", color: activeTab === "ajout" ? "#fff" : "var(--muted)", border: "none", cursor: "pointer", fontWeight: 700 }}
            onClick={() => { if (!editingId) { setForm(initialForm); } setActiveTab("ajout"); }}
          >
            <PlusCircle size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} /> {editingId ? "Modifier l'avis" : "Ajouter un avis WhatsApp"}
          </button>
        </div>
      </div>

      {activeTab === "liste" ? (
        <div className="bs-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Tous les avis & retours clients</h3>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              {testimonials.filter(t => t.actif).length} affichés sur l'accueil
            </span>
          </div>

          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
          <table className="bs-table" style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th>Profil Client</th>
                <th>Cible / Genre</th>
                <th>Type d'avis</th>
                <th>Contenu / Capture</th>
                <th>Note</th>
                <th>Visibilité</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>
                    Chargement des avis...
                  </td>
                </tr>
              )}
              {!loading && testimonials.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                    Aucun avis client enregistré pour le moment. Cliquez sur "Ajouter un avis WhatsApp".
                  </td>
                </tr>
              )}
              {!loading && testimonials.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <img
                        src={t.photoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"}
                        alt={t.nom}
                        style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", border: "2px solid #25D366" }}
                      />
                      <div>
                        <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 14 }}>{t.nom}</div>
                        <div style={{ fontSize: 11, color: "#16A34A", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16A34A" }}></span> Vérifié WhatsApp
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0", padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 800 }}>
                      ✓ Client Vérifié
                    </span>
                  </td>
                  <td>
                    {t.type === "capture_whatsapp" ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#DCFCE7", color: "#15803D", padding: "3px 8px", borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}>
                        <Image size={13} /> Capture WhatsApp
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#F1F5F9", color: "#475569", padding: "3px 8px", borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}>
                        <MessageSquare size={13} /> Message Texte
                      </span>
                    )}
                  </td>
                  <td style={{ maxWidth: 280 }}>
                    {t.captureUrl && (
                      <div 
                        onClick={() => setPreviewImage(t.captureUrl)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", background: "#F8FAFC", padding: "4px 8px", borderRadius: 8, border: "1px solid var(--line)", marginBottom: t.message ? 4 : 0 }}
                      >
                        <img src={t.captureUrl} alt="Capture" style={{ width: 36, height: 36, borderRadius: 4, objectFit: "cover" }} />
                        <span style={{ fontSize: 12, color: "var(--forest)", fontWeight: 700 }}>Agrandir capture</span>
                      </div>
                    )}
                    {t.message && (
                      <div style={{ fontSize: 12.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        "{t.message}"
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ color: "#F59E0B", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", gap: 2 }}>
                      {Array.from({ length: t.note || 5 }).map((_, i) => (
                        <Star key={i} size={14} fill="#F59E0B" color="#F59E0B" />
                      ))}
                    </div>
                  </td>
                  <td>
                    <button
                      onClick={() => toggleStatus(t)}
                      style={{
                        background: t.actif ? "#F0FDF4" : "#FEE2E2",
                        color: t.actif ? "#16A34A" : "#DC2626",
                        border: `1px solid ${t.actif ? "#BBF7D0" : "#FECACA"}`,
                        padding: "4px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 800, cursor: "pointer"
                      }}
                    >
                      {t.actif ? "Visible" : "Masqué"}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button 
                        onClick={() => startEdit(t)} 
                        className="bs-btn-icon" 
                        title="Modifier"
                        style={{ padding: 6, borderRadius: 6, border: "1px solid var(--line)", background: "#fff", cursor: "pointer" }}
                      >
                        <Pencil size={15} color="var(--forest)" />
                      </button>
                      <button 
                        onClick={() => handleDelete(t.id)} 
                        className="bs-btn-icon" 
                        title="Supprimer"
                        style={{ padding: 6, borderRadius: 6, border: "1px solid var(--line)", background: "#fff", cursor: "pointer" }}
                      >
                        <Trash2 size={15} color="#DC2626" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        /* FORMULAIRE D'AJOUT / ÉDITION */
        <div className="bs-card" style={{ maxWidth: 750, margin: "0 auto", padding: 24 }}>
          <h2 style={{ fontSize: 20, margin: "0 0 16px", color: "var(--forest-dark)" }}>
            {editingId ? "Modifier l'avis client" : "Ajouter un retour / Avis client WhatsApp"}
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="bs-form-row-2">
              <div className="bs-input-group">
                <label style={{ fontWeight: 700 }}>Nom du client *</label>
                <input
                  type="text"
                  className="bs-input"
                  placeholder="ex: Fatima Said, Karim Bacar..."
                  value={form.nom}
                  onChange={(e) => set("nom", e.target.value)}
                  required
                />
              </div>

              <div className="bs-input-group">
                <label style={{ fontWeight: 700 }}>Statut de l'avis client *</label>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  borderRadius: 10, background: "#F0FDF4", border: "1.5px solid #BBF7D0",
                  color: "#166534", fontWeight: 800, fontSize: 13
                }}>
                  <CheckCircle size={18} color="#16A34A" /> Avis Vérifié Soilihitech (Reçu par WhatsApp ou Web)
                </div>
              </div>
            </div>

            {/* PHOTO DE PROFIL CLIENT */}
            <div className="bs-input-group" style={{ marginTop: 14 }}>
              <label style={{ fontWeight: 700 }}>Photo de profil / Avatar du client</label>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {form.photoUrl && (
                  <img src={form.photoUrl} alt="Avatar" style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--forest)" }} />
                )}
                <div style={{ flex: 1 }}>
                  <ImageUploader
                    value={form.photoUrl}
                    onChange={(url) => set("photoUrl", url)}
                    label="Télécharger la photo de profil du client"
                  />
                </div>
              </div>
            </div>

            {/* TYPE D'AVIS */}
            <div className="bs-input-group" style={{ marginTop: 18 }}>
              <label style={{ fontWeight: 700 }}>Format du retour client *</label>
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <label style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px", borderRadius: 10, cursor: "pointer",
                  border: form.type === "capture_whatsapp" ? "2px solid #16A34A" : "1.5px solid var(--line)",
                  background: form.type === "capture_whatsapp" ? "#DCFCE7" : "var(--card)",
                  color: form.type === "capture_whatsapp" ? "#15803D" : "var(--ink)",
                  fontWeight: 800, fontSize: 13
                }}>
                  <input type="radio" name="type" value="capture_whatsapp" checked={form.type === "capture_whatsapp"} onChange={() => set("type", "capture_whatsapp")} style={{ display: "none" }} />
                  Capture d'écran WhatsApp
                </label>
                <label style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px", borderRadius: 10, cursor: "pointer",
                  border: form.type === "texte" ? "2px solid var(--forest)" : "1.5px solid var(--line)",
                  background: form.type === "texte" ? "var(--forest-light)" : "var(--card)",
                  color: form.type === "texte" ? "var(--forest-dark)" : "var(--ink)",
                  fontWeight: 800, fontSize: 13
                }}>
                  <input type="radio" name="type" value="texte" checked={form.type === "texte"} onChange={() => set("type", "texte")} style={{ display: "none" }} />
                  Message Textuel Simple
                </label>
              </div>
            </div>

            {/* CAPTURE D'ÉCRAN WHATSAPP */}
            {form.type === "capture_whatsapp" && (
              <div className="bs-input-group" style={{ marginTop: 16 }}>
                <label style={{ fontWeight: 700 }}>Capture d'écran du message WhatsApp envoyé par le client *</label>
                <ImageUploader
                  value={form.captureUrl}
                  onChange={(url) => set("captureUrl", url)}
                  label="Télécharger la capture d'écran WhatsApp"
                />
              </div>
            )}

            {/* MESSAGE OU RETRANSCRIPTION */}
            <div className="bs-input-group" style={{ marginTop: 16 }}>
              <label style={{ fontWeight: 700 }}>
                {form.type === "capture_whatsapp" ? "Texte de l'avis ou retranscription (affiché avec la capture)" : "Message du client *"}
              </label>
              <textarea
                className="bs-input"
                rows={3}
                placeholder="ex: Salam ! Colis bien reçu ce matin. Les broches et le peigne en bois sont magnifiques..."
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
              />
            </div>

            {/* NOTE & STATUT */}
            <div className="bs-form-row-2" style={{ marginTop: 16 }}>
              <div className="bs-input-group">
                <label style={{ fontWeight: 700 }}>Note (Étoiles)</label>
                <select className="bs-select" value={form.note} onChange={(e) => set("note", Number(e.target.value))}>
                  <option value={5}>⭐⭐⭐⭐⭐ (5 / 5 - Excellent)</option>
                  <option value={4}>⭐⭐⭐⭐ (4 / 5 - Très bon)</option>
                  <option value={3}>⭐⭐⭐ (3 / 5 - Moyen)</option>
                </select>
              </div>

              <div className="bs-input-group">
                <label style={{ fontWeight: 700 }}>Visibilité sur l'accueil</label>
                <select className="bs-select" value={form.actif ? "1" : "0"} onChange={(e) => set("actif", e.target.value === "1")}>
                  <option value="1">Afficher sur la page d'accueil (Actif)</option>
                  <option value="0">Masquer temporairement</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button type="submit" className="bs-btn-primary" disabled={submitting} style={{ flex: 1, padding: "12px 20px" }}>
                {submitting ? "Enregistrement..." : editingId ? "Enregistrer les modifications" : "Publier l'avis client"}
              </button>
              <button type="button" onClick={cancelEdit} className="bs-btn-secondary" style={{ padding: "12px 20px" }}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL ZOOM CAPTURE D'ÉCRAN */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20
          }}
        >
          <div style={{ position: "relative", maxWidth: 650, maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImage(null)}
              style={{
                position: "absolute", top: -45, right: 0,
                background: "#fff", border: "none", borderRadius: 20,
                padding: "6px 14px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 6
              }}
            >
              <X size={18} /> Fermer
            </button>
            <img src={previewImage} alt="Capture WhatsApp" style={{ width: "100%", maxHeight: "85vh", objectFit: "contain", borderRadius: 12, boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }} />
          </div>
        </div>
      )}
    </>
  );
}
