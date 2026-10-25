import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ClipboardList, Plus, Trash2, Smartphone, Send, MessageCircle, 
  CheckCircle2, ArrowRight, ShieldCheck, Sparkles, FileText, HelpCircle 
} from "lucide-react";
import api, { SLUG } from "../../api";
import { useAuth } from "../../context/AuthContext";
import ImageUploader from "../../components/ImageUploader";
import { toast } from "react-hot-toast";

export default function DemandeSurMesure() {
  const { user, boutique } = useAuth();
  const navigate = useNavigate();

  const [nomClient, setNomClient] = useState(user?.nom || "");
  const [telephoneClient, setTelephoneClient] = useState(user?.telephone || "");
  const [emailClient, setEmailClient] = useState(user?.email || "");
  const [modeleAppareil, setModeleAppareil] = useState("");
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [articles, setArticles] = useState([
    { id: 1, nom: "", quantite: 1 }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [createdRequest, setCreatedRequest] = useState(null);

  function addArticleRow() {
    setArticles(prev => [
      ...prev,
      { id: Date.now(), nom: "", quantite: 1 }
    ]);
  }

  function removeArticleRow(id) {
    if (articles.length <= 1) return;
    setArticles(prev => prev.filter(a => a.id !== id));
  }

  function updateArticle(id, field, val) {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, [field]: val } : a));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!nomClient.trim()) {
      toast.error("Veuillez renseigner votre nom complet.");
      return;
    }
    if (!telephoneClient.trim()) {
      toast.error("Veuillez renseigner votre numéro de téléphone (WhatsApp).");
      return;
    }
    if (!modeleAppareil.trim()) {
      toast.error("Veuillez indiquer le modèle de votre téléphone ou appareil.");
      return;
    }

    const validArticles = articles.filter(a => a.nom.trim().length > 0);
    if (validArticles.length === 0) {
      toast.error("Veuillez préciser au moins un article ou accessoire souhaité.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/store/${SLUG}/custom-requests`, {
        nomClient,
        telephoneClient,
        emailClient,
        modeleAppareil,
        articles: validArticles,
        description,
        photoUrl
      });

      if (res.data && res.data.success) {
        setCreatedRequest(res.data.request);
        toast.success("Votre demande a été enregistrée avec succès !");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      console.error("Erreur soumission demande:", err);
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement de votre demande.");
    } finally {
      setSubmitting(false);
    }
  }

  const phoneBoutique = boutique?.telephone || "2693420808";
  const cleanPhone = phoneBoutique.replace(/[^0-9]/g, "");

  function openWhatsApp(code, reqArticles, reqModele) {
    const articlesText = (reqArticles || [])
      .map((a, i) => `${i + 1}. ${a.nom} (Quantité: ${a.quantite})`)
      .join("\n");

    const message = `Bonjour Soilihitech,\n\nJe viens de créer une demande de commande sur-mesure sur le site.\n\n*Réf Dossier :* ${code}\n*Client :* ${nomClient} (${telephoneClient})\n*Appareil :* ${reqModele}\n\n*Articles demandés :*\n${articlesText}\n\n${description ? `*Détails :* ${description}\n` : ""}\nMerci de me communiquer votre chiffrage et disponibilité.`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  return (
    <div style={{ maxWidth: 880, margin: "32px auto 80px", padding: "0 16px" }}>
      {/* ── EN-TÊTE DE LA PAGE ── */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <span style={{
          background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE",
          fontSize: 12.5, fontWeight: 800, padding: "6px 14px", borderRadius: 20,
          display: "inline-flex", alignItems: "center", gap: 6, textTransform: "uppercase", letterSpacing: "0.5px"
        }}>
          <Sparkles size={14} /> Service Commande Sur-Mesure & Spéciale
        </span>
        <h1 style={{
          fontSize: "clamp(24px, 4vw, 34px)", fontWeight: 900,
          color: "var(--ink)", margin: "14px 0 8px", letterSpacing: "-0.5px"
        }}>
          Trouvez l'accessoire idéal pour votre smartphone
        </h1>
        <p style={{
          fontSize: "clamp(14px, 2vw, 16px)", color: "var(--muted)",
          maxWidth: 640, margin: "0 auto", lineHeight: 1.6
        }}>
          Un chargeur rare, une glace incassable spécifique, une coque ou un câble introuvable ? Listez vos besoins, notre équipe vous chiffre la commande directement.
        </p>
      </div>

      {/* ── SI LA DEMANDE VIENT D'ÊTRE ENREGISTRÉE (ÉCRAN DE SUCCÈS) ── */}
      {createdRequest ? (
        <div style={{
          background: "#fff", border: "2px solid #22C55E", borderRadius: 24,
          padding: "36px 24px", textAlign: "center", boxShadow: "0 10px 40px rgba(34,197,94,0.12)",
          animation: "fadeIn 0.3s ease"
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%", background: "#DCFCE7",
            color: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px", boxShadow: "0 4px 12px rgba(22,163,74,0.2)"
          }}>
            <CheckCircle2 size={40} />
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 900, color: "var(--ink)", margin: "0 0 8px" }}>
            Demande envoyée avec succès !
          </h2>
          <p style={{ fontSize: 15, color: "var(--muted)", margin: "0 0 20px" }}>
            Votre demande a été enregistrée dans notre système avec le numéro de référence :
          </p>

          <div style={{
            display: "inline-block", background: "#F1F5F9", border: "2px dashed #94A3B8",
            padding: "10px 24px", borderRadius: 14, fontSize: 20, fontWeight: 900,
            fontFamily: "monospace", color: "#1E293B", letterSpacing: "1px", marginBottom: 28
          }}>
            {createdRequest.code}
          </div>

          {/* ACTIONS RAPIDES */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 500, margin: "0 auto" }}>
            <button
              onClick={() => openWhatsApp(createdRequest.code, createdRequest.articles, createdRequest.modeleAppareil)}
              style={{
                width: "100%", padding: "14px 20px", borderRadius: 14,
                background: "#25D366", color: "#fff", border: "none",
                fontWeight: 800, fontSize: 15, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                boxShadow: "0 4px 14px rgba(37,211,102,0.35)", transition: "transform 0.15s"
              }}
            >
              <MessageCircle size={20} />
              Transmettre directement sur WhatsApp
            </button>

            <Link
              to={`/demande/${createdRequest.code}`}
              style={{
                width: "100%", padding: "14px 20px", borderRadius: 14,
                background: "var(--forest)", color: "#fff", textDecoration: "none",
                fontWeight: 800, fontSize: 15, display: "flex",
                alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 14px rgba(37,99,235,0.25)"
              }}
            >
              <FileText size={18} />
              Suivre l'avancement & Voir la Facture / Devis
            </Link>

            <button
              onClick={() => {
                setCreatedRequest(null);
                setModeleAppareil("");
                setDescription("");
                setPhotoUrl("");
                setArticles([{ id: Date.now(), nom: "", quantite: 1 }]);
              }}
              style={{
                background: "transparent", border: "none", color: "var(--muted)",
                fontSize: 13, fontWeight: 600, marginTop: 8, cursor: "pointer"
              }}
            >
              Faire une autre demande sur-mesure
            </button>
          </div>
        </div>
      ) : (
        /* ── FORMULAIRE PRINCIPAL ── */
        <form onSubmit={handleSubmit} style={{
          background: "#fff", border: "1px solid var(--line)", borderRadius: 24,
          padding: "clamp(20px, 4vw, 36px)", boxShadow: "0 4px 24px rgba(0,0,0,0.04)"
        }}>
          {/* SECTION 1 : VOS COORDONNÉES */}
          <div style={{ marginBottom: 30 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
              <span style={{
                width: 28, height: 28, borderRadius: "50%", background: "#2563EB",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 14
              }}>1</span>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>
                Vos coordonnées de contact
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              <div className="bs-input-group">
                <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                  Nom complet *
                </label>
                <input
                  type="text"
                  className="bs-input"
                  required
                  placeholder="Ex: Soilihi Abdou"
                  value={nomClient}
                  onChange={(e) => setNomClient(e.target.value)}
                />
              </div>

              <div className="bs-input-group">
                <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                  Téléphone WhatsApp (pour recevoir le devis) *
                </label>
                <input
                  type="tel"
                  className="bs-input"
                  required
                  placeholder="Ex: 342 08 08 ou +269 ..."
                  value={telephoneClient}
                  onChange={(e) => setTelephoneClient(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* SECTION 2 : VOTRE APPAREIL */}
          <div style={{ marginBottom: 30 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
              <span style={{
                width: 28, height: 28, borderRadius: "50%", background: "#2563EB",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 14
              }}>2</span>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>
                Votre Smartphone ou Appareil
              </h3>
            </div>

            <div className="bs-input-group">
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                Marque et Modèle précis *
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  className="bs-input"
                  required
                  style={{ paddingLeft: 40 }}
                  placeholder="Ex: iPhone 15 Pro Max, Tecno Camon 30, Samsung S24 Ultra, Infinix Hot 40..."
                  value={modeleAppareil}
                  onChange={(e) => setModeleAppareil(e.target.value)}
                />
                <Smartphone size={18} color="var(--muted)" style={{ position: "absolute", left: 14, top: 13 }} />
              </div>
            </div>
          </div>

          {/* SECTION 3 : ARTICLES & ACCESSOIRES SOUHAITÉS */}
          <div style={{ marginBottom: 30 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%", background: "#2563EB",
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 14
                }}>3</span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>
                  Articles demandés
                </h3>
              </div>
              <button
                type="button"
                onClick={addArticleRow}
                style={{
                  background: "#EFF6FF", border: "1.5px solid #BFDBFE",
                  color: "#2563EB", fontWeight: 800, fontSize: 12.5,
                  padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6
                }}
              >
                <Plus size={15} /> Ajouter un article
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {articles.map((art, index) => (
                <div key={art.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: "#F8FAFC", padding: "12px 14px", borderRadius: 14,
                  border: "1px solid #E2E8F0"
                }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#64748B", width: 20 }}>
                    #{index + 1}
                  </span>

                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      className="bs-input"
                      placeholder="Ex: Chargeur 25W Type-C, Glace incassable, Coque silicone..."
                      required
                      value={art.nom}
                      onChange={(e) => updateArticle(art.id, "nom", e.target.value)}
                      style={{ background: "#fff" }}
                    />
                  </div>

                  <div style={{ width: 110 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Qté:</span>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        className="bs-input"
                        required
                        value={art.quantite}
                        onChange={(e) => updateArticle(art.id, "quantite", Number(e.target.value) || 1)}
                        style={{ textAlign: "center", background: "#fff", padding: "8px 4px" }}
                      />
                    </div>
                  </div>

                  {articles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArticleRow(art.id)}
                      title="Supprimer cette ligne"
                      style={{
                        background: "#FEE2E2", border: "none", color: "#DC2626",
                        width: 34, height: 34, borderRadius: 10, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 4 : DESCRIPTION LIBRE & PHOTO */}
          <div style={{ marginBottom: 30 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
              <span style={{
                width: 28, height: 28, borderRadius: "50%", background: "#2563EB",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 14
              }}>4</span>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>
                Précisions & Photo (Facultatif)
              </h3>
            </div>

            <div className="bs-input-group" style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                Détails spécifiques (Couleur souhaitée, port de charge, urgence...)
              </label>
              <textarea
                className="bs-input"
                style={{ minHeight: 90, resize: "vertical", lineHeight: 1.5 }}
                placeholder="Ex: Je souhaite une coque de couleur noire mate avec protection d'appareil photo, et un câble de 2 mètres..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <ImageUploader
              label="Photo de l'accessoire ou de votre appareil (Fichier, Caméra ou Lien URL)"
              value={photoUrl}
              onChange={(url) => setPhotoUrl(url)}
              slot="principale"
              productContext={{
                nom: modeleAppareil || "Accessoire smartphone",
                marque: "",
                categorie: "Accessoire"
              }}
            />
          </div>

          {/* BOUTON D'ENVOI */}
          <div style={{ marginTop: 32, borderTop: "1px solid var(--line)", paddingTop: 20 }}>
            <button
              type="submit"
              disabled={submitting}
              className="bs-btn-primary"
              style={{
                width: "100%", padding: "16px 24px", borderRadius: 16,
                fontSize: 16, fontWeight: 900, display: "flex",
                alignItems: "center", justifyContent: "center", gap: 10,
                boxShadow: "0 6px 20px rgba(37,99,235,0.25)"
              }}
            >
              <Send size={18} />
              {submitting ? "Enregistrement en cours..." : "Transmettre ma demande à Soilihitech"}
            </button>
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 12.5, color: "var(--muted)" }}>
              Vous recevrez une proposition chiffrée avec possibilité d'accepter ou refuser le devis.
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
