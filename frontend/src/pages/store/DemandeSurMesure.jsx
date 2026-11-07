import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ClipboardList, Plus, Trash2, Smartphone, Send, MessageCircle, 
  CheckCircle2, ArrowRight, ShieldCheck, Sparkles, FileText, HelpCircle,
  Camera, Upload, Clock, Image as ImageIcon, X, AlertCircle
} from "lucide-react";
import api, { SLUG } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-hot-toast";

export default function DemandeSurMesure() {
  const { user, boutique } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [nomClient, setNomClient] = useState(user?.nom || "");
  const [telephoneClient, setTelephoneClient] = useState(user?.telephone || "");
  const [emailClient, setEmailClient] = useState(user?.email || "");
  const [modeleAppareil, setModeleAppareil] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [articles, setArticles] = useState([
    { id: 1, nom: "", quantite: 1 }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [createdRequest, setCreatedRequest] = useState(null);

  // Ajouter un article (jusqu'à l'infini)
  function addArticleRow() {
    setArticles(prev => [
      ...prev,
      { id: Date.now() + Math.random(), nom: "", quantite: 1 }
    ]);
  }

  // Supprimer un article et ajuster le nombre de photos si nécessaire
  function removeArticleRow(id) {
    if (articles.length <= 1) return;
    const updated = articles.filter(a => a.id !== id);
    setArticles(updated);
    // Le nombre de photos ne peut pas dépasser le nombre d'articles
    if (photos.length > updated.length) {
      setPhotos(prev => prev.slice(0, updated.length));
    }
  }

  function updateArticle(id, field, val) {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, [field]: val } : a));
  }

  // Compression canvas instantanée côté client
  function compressImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const MAX_DIM = 900;
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > MAX_DIM) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              }
            } else {
              if (height > MAX_DIM) {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.75));
          } catch (err) {
            resolve(e.target.result);
          }
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Sélection de photos jusqu'au nombre d'articles
  async function handlePhotoSelect(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const maxAllowed = articles.length;
    const remainingSlots = maxAllowed - photos.length;

    if (remainingSlots <= 0) {
      toast.error(`Vous avez déjà atteint la limite de ${maxAllowed} photo${maxAllowed > 1 ? "s" : ""} pour vos ${maxAllowed} article${maxAllowed > 1 ? "s" : ""}.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast(`Seules ${remainingSlots} photo(s) ont été ajoutées pour respecter le nombre d'articles.`);
    }

    const compressed = await Promise.all(filesToProcess.map(f => compressImage(f)));
    setPhotos(prev => [...prev, ...compressed]);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(index) {
    setPhotos(prev => prev.filter((_, i) => i !== index));
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
        photos,
        photoUrl: photos[0] || ""
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

    const storeName = boutique?.nom || "la boutique";
    const message = `Bonjour ${storeName},\n\nJe viens de créer une demande de commande sur-mesure sur le site.\n\n*Réf Dossier :* ${code}\n*Client :* ${nomClient} (${telephoneClient})\n*Appareil :* ${reqModele}\n\n*Articles demandés :*\n${articlesText}\n\n${description ? `*Détails :* ${description}\n` : ""}\nMerci de me communiquer votre chiffrage et disponibilité.`;

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
          Un chargeur spécifique, une glace incassable rare, une coque ou un câble introuvable ? Listez vos articles, notre équipe recherche et chiffre votre commande directement.
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
                setPhotos([]);
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
                  inputMode="tel"
                  className="bs-input"
                  required
                  placeholder="Ex: 342 08 08 ou +269 ..."
                  value={telephoneClient}
                  onChange={(e) => setTelephoneClient(e.target.value.replace(/[^0-9+ ]/g, ""))}
                  onKeyDown={(e) => {
                    if (!/[0-9+ ]/.test(e.key) && !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                      e.preventDefault();
                    }
                  }}
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

          {/* SECTION 3 : ARTICLES & ACCESSOIRES SOUHAITÉS (AJOUT À L'INFINI) */}
          <div style={{ marginBottom: 30 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%", background: "#2563EB",
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 14
                }}>3</span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>
                  Articles demandés ({articles.length})
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

            <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)" }}>
              Vous pouvez ajouter autant d'articles que vous le souhaitez.
            </p>

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

          {/* SECTION 4 : PRÉCISIONS & PHOTOS (FACULTATIF, MAX = NOMBRE D'ARTICLES) */}
          <div style={{ marginBottom: 30 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, borderBottom: "1px solid var(--line)", paddingBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%", background: "#2563EB",
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 14
                }}>4</span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>
                  Précisions & Photos (Facultatif)
                </h3>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 12,
                background: photos.length >= articles.length ? "#FEF3C7" : "#EFF6FF",
                color: photos.length >= articles.length ? "#B45309" : "#1D4ED8"
              }}>
                {photos.length} / {articles.length} photo{articles.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="bs-input-group" style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                Détails spécifiques (Couleur souhaitée, port de charge, référence...)
              </label>
              <textarea
                className="bs-input"
                style={{ minHeight: 85, resize: "vertical", lineHeight: 1.5 }}
                placeholder="Ex: Je souhaite une coque de couleur noire mate avec protection d'appareil photo, et un câble tressé de 2 mètres..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* SYSTÈME D'UPLOAD MULTI-PHOTOS FACULTATIF SANS IA */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                  Photos de vos accessoires ou appareil
                </label>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  Facultatif · Jusqu'à {articles.length} photo{articles.length > 1 ? "s" : ""} (1 par article)
                </span>
              </div>

              {/* GRILLE DES PHOTOS EXISTANTES */}
              {photos.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12, marginBottom: 14 }}>
                  {photos.map((src, index) => (
                    <div key={index} style={{
                      position: "relative", borderRadius: 12, overflow: "hidden",
                      border: "1.5px solid var(--line)", background: "#F8FAFC",
                      aspectRatio: "1 / 1"
                    }}>
                      <img 
                        src={src} 
                        alt={`Photo ${index + 1}`} 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                      />
                      <div style={{
                        position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.6)",
                        color: "#fff", fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 8
                      }}>
                        #{index + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        title="Supprimer cette photo"
                        style={{
                          position: "absolute", top: 6, right: 6, background: "#EF4444",
                          color: "#fff", border: "none", width: 26, height: 26, borderRadius: "50%",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ZONE D'AJOUT RAPIDE SI LIMITE NON ATTEINTE */}
              {photos.length < articles.length ? (
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    multiple
                    onChange={handlePhotoSelect}
                    style={{ display: "none" }}
                    id="photo-upload-input"
                  />
                  <label
                    htmlFor="photo-upload-input"
                    style={{
                      border: "2px dashed #CBD5E1", borderRadius: 14, padding: "20px 16px",
                      background: "#F8FAFC", display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: 8,
                      cursor: "pointer", transition: "all 0.15s", textAlign: "center"
                    }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%", background: "#EFF6FF",
                      color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      <Camera size={22} />
                    </div>
                    <div>
                      <span style={{ fontSize: 13.5, fontWeight: 800, color: "#1E293B" }}>
                        + Ajouter une photo ({photos.length}/{articles.length})
                      </span>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
                        Cliquez pour importer depuis votre appareil ou prendre une photo directe (Caméra)
                      </p>
                    </div>
                  </label>
                </div>
              ) : (
                <div style={{
                  padding: "12px 16px", borderRadius: 12, background: "#EFF6FF",
                  border: "1px solid #BFDBFE", fontSize: 12.5, color: "#1D4ED8",
                  display: "flex", alignItems: "center", gap: 8
                }}>
                  <CheckCircle2 size={16} color="#2563EB" />
                  <span>
                    Vous avez ajouté {photos.length} photo{photos.length > 1 ? "s" : ""} pour vos {articles.length} article{articles.length > 1 ? "s" : ""}. Pour en joindre d'autres, ajoutez un article supplémentaire dans la section 3.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── DÉLAIS DE LIVRAISON : SÉNÉGAL (2J) & COMORES (6J) ── */}
          <div style={{
            background: "#F8FAFC", border: "1.5px solid #E2E8F0",
            borderRadius: 18, padding: "18px 20px", marginBottom: 22,
            boxShadow: "0 2px 10px rgba(0,0,0,0.02)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Clock size={18} color="#2563EB" />
              <span style={{ fontSize: 14.5, fontWeight: 800, color: "#1E293B" }}>
                Délais de livraison après validation de votre devis
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 10 }}>
              <div style={{
                background: "#EFF6FF", border: "1px solid #BFDBFE",
                borderRadius: 14, padding: "12px 16px"
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Dakar (Sénégal)
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#1D4ED8", marginTop: 2 }}>
                  2 jours maximum
                </div>
              </div>

              <div style={{
                background: "#F0FDF4", border: "1px solid #BBF7D0",
                borderRadius: 14, padding: "12px 16px"
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#16A34A", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Comores
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#15803D", marginTop: 2 }}>
                  6 jours maximum
                </div>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: 12.5, color: "#64748B", lineHeight: 1.45 }}>
              Une commande sur-mesure demande une recherche ciblée. Notre équipe vous chiffre les articles rapidement pour vous livrer sans attendre.
            </p>
          </div>

          {/* BOUTON D'ENVOI */}
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 20 }}>
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
