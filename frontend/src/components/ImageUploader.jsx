import React, { useRef, useState } from "react";
import { Upload, Link2, X, Loader, Sparkles, Wand2, CheckCircle2, ArrowRight, Eye, RefreshCw } from "lucide-react";
import api from "../api";

/**
 * ImageUploader — Permet de choisir une photo sur l'appareil, coller une URL,
 * OU générer une photo publicitaire studio IA avec comparateur avant/après pour choisir
 * de garder sa photo ou d'adopter celle de l'IA.
 */
export default function ImageUploader({
  value,
  onChange,
  label = "Image",
  productContext = {},
  slot = "principale"
}) {
  const inputRef = useRef(null);
  const [mode, setMode] = useState("file"); // "file" | "url"
  const [uploading, setUploading] = useState(false);
  const [generatingStudio, setGeneratingStudio] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");

  // État de la prévisualisation / comparateur avant validation
  const [previewAiImage, setPreviewAiImage] = useState(null);
  const [showCompareModal, setShowCompareModal] = useState(false);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setSuccessMsg("");
    setUploading(true);

    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.70);
          onChange(compressedDataUrl);
        } catch (err) {
          onChange(event.target.result);
        } finally {
          setUploading(false);
          if (inputRef.current) inputRef.current.value = "";
        }
      };

      img.onerror = () => {
        onChange(event.target.result);
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      };

      img.src = event.target.result;
    };

    reader.onerror = () => {
      setError("Impossible de lire la photo sélectionnée.");
      setUploading(false);
    };

    reader.readAsDataURL(file);
  }

  async function handleGenerateStudio() {
    setError("");
    setSuccessMsg("");
    setGeneratingStudio(true);

    try {
      const res = await api.post("/admin/ai/generate-studio-photo", {
        nom: productContext?.nom || "",
        marque: productContext?.marque || "",
        categorie: productContext?.categorie || "",
        slot
      });

      if (res.data?.studioImageUrl) {
        // Au lieu d'écraser immédiatement la photo, ouvrir la fenêtre de choix / prévisualisation
        setPreviewAiImage(res.data.studioImageUrl);
        setShowCompareModal(true);
      } else {
        setError("Impossible de générer la photo publicitaire.");
      }
    } catch (err) {
      setError("Erreur lors de la génération de la photo studio.");
    } finally {
      setGeneratingStudio(false);
    }
  }

  // L'utilisateur choisit d'adopter la photo de l'IA
  function handleAcceptAiPhoto() {
    if (previewAiImage) {
      onChange(previewAiImage);
      setSuccessMsg("Photo publicitaire studio IA adoptée avec succès !");
      setTimeout(() => setSuccessMsg(""), 6000);
    }
    setShowCompareModal(false);
    setPreviewAiImage(null);
  }

  // L'utilisateur choisit de garder sa propre photo
  function handleKeepOriginal() {
    setShowCompareModal(false);
    setPreviewAiImage(null);
    setSuccessMsg("Votre photo d'origine a été conservée.");
    setTimeout(() => setSuccessMsg(""), 4000);
  }

  return (
    <div className="bs-input-group">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
        <label style={{ margin: 0, fontWeight: 700 }}>{label}</label>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {/* BOUTON STUDIO PHOTO IA FOND BLANC PRO AVEC CHOIX AVANT VALIDATION */}
          <button
            type="button"
            onClick={handleGenerateStudio}
            disabled={generatingStudio}
            title="Générer une photo publicitaire propre sur fond blanc studio pro et la prévisualiser avant d'accepter"
            style={{
              padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 800,
              border: "1.5px solid #2563EB",
              background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
              color: "#1D4ED8", cursor: generatingStudio ? "not-allowed" : "pointer",
              display: "inline-flex", alignItems: "center", gap: 5,
              boxShadow: "0 2px 8px rgba(37,99,235,0.18)",
              transition: "all 0.15s"
            }}
          >
            {generatingStudio ? (
              <>
                <Loader size={13} style={{ animation: "spin 0.8s linear infinite" }} />
                <span>Génération studio en cours...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} color="#2563EB" />
                <span>Studio Photo IA (Fond Blanc Pro)</span>
              </>
            )}
          </button>

          <button type="button" onClick={() => setMode("file")} style={{
            padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1.5px solid",
            borderColor: mode === "file" ? "var(--forest)" : "var(--line)",
            background: mode === "file" ? "var(--forest-light)" : "transparent",
            color: mode === "file" ? "var(--forest-dark)" : "var(--muted)", cursor: "pointer"
          }}>
            <Upload size={12} style={{ verticalAlign: "-1px", marginRight: 4 }} />Depuis l'appareil
          </button>

          <button type="button" onClick={() => setMode("url")} style={{
            padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1.5px solid",
            borderColor: mode === "url" ? "var(--forest)" : "var(--line)",
            background: mode === "url" ? "var(--forest-light)" : "transparent",
            color: mode === "url" ? "var(--forest-dark)" : "var(--muted)", cursor: "pointer"
          }}>
            <Link2 size={12} style={{ verticalAlign: "-1px", marginRight: 4 }} />Par URL
          </button>
        </div>
      </div>

      {mode === "url" ? (
        <input
          className="bs-input"
          placeholder="https://images.unsplash.com/..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            border: "2px dashed var(--line)", borderRadius: 12, padding: "20px 16px",
            textAlign: "center", cursor: "pointer", background: "var(--paper)",
            transition: "all 0.2s"
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "#2563EB"; e.currentTarget.style.background = "#EFF6FF"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.background = "var(--paper)"; }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          {uploading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#2563EB" }}>
              <Loader size={18} style={{ animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Optimisation & Traitement de votre photo...</span>
            </div>
          ) : (
            <>
              <Upload size={24} color="#2563EB" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 700 }}>
                Cliquez pour importer votre photo d'origine
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                Ou utilisez le bouton « Studio Photo IA » pour générer une proposition et la comparer avant de valider
              </div>
            </>
          )}
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: "#DC2626", marginTop: 6, fontWeight: 600 }}>{error}</div>}
      {successMsg && (
        <div style={{ fontSize: 12, color: "#16A34A", marginTop: 6, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={14} color="#16A34A" /> {successMsg}
        </div>
      )}

      {/* Preview normale */}
      {value && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10, background: "#fff", padding: "10px 14px", borderRadius: 12, border: "1px solid var(--line)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <img
              src={value}
              alt="Aperçu photo"
              style={{ width: 110, height: 80, objectFit: "contain", background: "#ffffff", borderRadius: 8, border: "1px solid var(--line)" }}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80";
              }}
            />
            <button
              type="button"
              onClick={() => onChange("")}
              title="Supprimer cette photo"
              style={{
                position: "absolute", top: -6, right: -6, width: 22, height: 22,
                borderRadius: "50%", border: "none", background: "#DC2626", color: "#fff",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
              }}
            >
              <X size={12} />
            </button>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981" }}></span>
              Photo active sur la boutique
            </div>
            <button
              type="button"
              onClick={handleGenerateStudio}
              disabled={generatingStudio}
              style={{
                marginTop: 6, background: "none", border: "none", color: "#2563EB",
                fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0,
                display: "inline-flex", alignItems: "center", gap: 4
              }}
            >
              <Wand2 size={13} /> Prévisualiser une nouvelle variante IA
            </button>
          </div>
        </div>
      )}

      {/* ── MODALE COMPARATEUR / CHOIX AVANT D'ACCEPTER LA PHOTO IA ── */}
      {showCompareModal && previewAiImage && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16
        }}>
          <div style={{
            background: "#ffffff", borderRadius: 20, width: "100%", maxWidth: 680,
            overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
            animation: "popIn 0.25s ease-out", border: "1px solid var(--line)"
          }}>
            {/* EN-TÊTE MODALE */}
            <div style={{
              padding: "16px 20px", background: "linear-gradient(135deg, #1E293B, #0F172A)",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "#2563EB", padding: 6, borderRadius: 8 }}>
                  <Eye size={18} color="#fff" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff" }}>
                    Choisir votre photo pour la boutique
                  </h4>
                  <span style={{ fontSize: 11.5, color: "#94A3B8" }}>
                    Prévisualisez la proposition de l'IA et décidez de l'adopter ou de conserver la vôtre
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleKeepOriginal}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* COMPARATEUR VISUEL CÔTE À CÔTE */}
            <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* COLONNE 1 : VOTRE PHOTO ACTUELLE */}
              <div style={{
                border: "2px solid #E2E8F0", borderRadius: 14, padding: "14px",
                background: "#F8FAFC", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center"
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, textTransform: "uppercase",
                  color: "#64748B", letterSpacing: "0.5px", marginBottom: 10
                }}>
                  1. Votre photo actuelle
                </span>

                <div style={{
                  width: "100%", height: 180, borderRadius: 10, background: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid #CBD5E1", overflow: "hidden", marginBottom: 14
                }}>
                  {value ? (
                    <img
                      src={value}
                      alt="Photo actuelle"
                      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <div style={{ color: "#94A3B8", fontSize: 12, padding: 20 }}>
                      Aucune photo actuellement
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleKeepOriginal}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10,
                    background: "#F1F5F9", border: "1.5px solid #CBD5E1",
                    color: "#334155", fontWeight: 700, fontSize: 13,
                    cursor: "pointer", transition: "all 0.15s"
                  }}
                >
                  Garder ma photo actuelle
                </button>
              </div>

              {/* COLONNE 2 : PROPOSITION DE L'IA */}
              <div style={{
                border: "2px solid #3B82F6", borderRadius: 14, padding: "14px",
                background: "#EFF6FF", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
                boxShadow: "0 8px 24px rgba(37,99,235,0.12)"
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, textTransform: "uppercase",
                  color: "#1D4ED8", letterSpacing: "0.5px", marginBottom: 10,
                  display: "flex", alignItems: "center", gap: 4
                }}>
                  <Sparkles size={13} color="#2563EB" /> 2. Proposition Studio IA (Fond Blanc)
                </span>

                <div style={{
                  width: "100%", height: 180, borderRadius: 10, background: "#ffffff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid #93C5FD", overflow: "hidden", marginBottom: 14,
                  boxShadow: "inset 0 0 12px rgba(0,0,0,0.03)"
                }}>
                  <img
                    src={previewAiImage}
                    alt="Proposition IA"
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                  <button
                    type="button"
                    onClick={handleAcceptAiPhoto}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 10,
                      background: "linear-gradient(135deg, #2563EB, #1D4ED8)", border: "none",
                      color: "#fff", fontWeight: 800, fontSize: 13,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      boxShadow: "0 4px 14px rgba(37,99,235,0.3)"
                    }}
                  >
                    <CheckCircle2 size={16} /> Adopter la photo de l'IA
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateStudio}
                    disabled={generatingStudio}
                    style={{
                      width: "100%", padding: "7px 10px", borderRadius: 8,
                      background: "transparent", border: "1px solid #BFDBFE",
                      color: "#1E40AF", fontWeight: 700, fontSize: 11.5,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4
                    }}
                  >
                    <RefreshCw size={12} className={generatingStudio ? "animate-spin" : ""} />
                    {generatingStudio ? "Génération..." : "Proposer une autre variante"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
