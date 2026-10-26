import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ClipboardList, CheckCircle2, XCircle, Clock, Printer, 
  MessageCircle, Smartphone, AlertCircle, ArrowLeft, Send, Sparkles, Check, X 
} from "lucide-react";
import api, { SLUG } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { formatPrice as fcfa } from "../../utils/currency";
import { toast } from "react-hot-toast";

export default function SuiviDemande() {
  const { code } = useParams();
  const { boutique } = useAuth();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // État pour modal de refus
  const [showRefusalModal, setShowRefusalModal] = useState(false);
  const [motifRefus, setMotifRefus] = useState("");
  const [customMotif, setCustomMotif] = useState("");
  const [decisionLoading, setDecisionLoading] = useState(false);

  useEffect(() => {
    if (!code) return;
    loadRequest();
  }, [code]);

  async function loadRequest() {
    setLoading(true);
    try {
      const res = await api.get(`/store/${SLUG}/custom-requests/${code}`);
      setRequest(res.data);
    } catch (err) {
      console.error("Erreur chargement demande:", err);
      setError("Impossible de trouver cette demande sur-mesure. Vérifiez le numéro de référence.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(decision) {
    if (decision === "refuse" && !motifRefus && !customMotif) {
      toast.error("Veuillez indiquer le motif de votre refus.");
      return;
    }

    setDecisionLoading(true);
    try {
      const finalMotif = motifRefus === "autre" ? customMotif : motifRefus;
      const res = await api.patch(`/store/${SLUG}/custom-requests/${code}/decision`, {
        decision,
        motifRefus: finalMotif
      });

      if (res.data && res.data.success) {
        toast.success(decision === "valide" 
          ? "Commande validée avec succès !" 
          : "Votre refus a été pris en compte."
        );
        setShowRefusalModal(false);
        await loadRequest();
      }
    } catch (err) {
      console.error("Erreur décision:", err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || "Erreur lors de l'enregistrement de votre décision.";
      toast.error(errMsg);
    } finally {
      setDecisionLoading(false);
    }
  }

  const phoneBoutique = boutique?.telephone || "2693420808";
  const cleanPhone = phoneBoutique.replace(/[^0-9]/g, "");

  function handleOpenWhatsApp() {
    if (!request) return;
    const msg = `Bonjour Soilihitech,\n\nJe vous contacte concernant ma demande sur-mesure *#${request.code}* pour mon *${request.modeleAppareil}*.\n\nStatut actuel : *${request.statut}*\nMontant chiffré : *${fcfa(request.totalPropose || 0)}*`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  function handlePrintInvoice() {
    window.print();
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 700, margin: "60px auto", textAlign: "center", padding: 20 }}>
        <Clock size={36} className="animate-spin" color="var(--forest)" style={{ margin: "0 auto 14px" }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>Recherche du dossier #{code}...</h3>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div style={{ maxWidth: 640, margin: "60px auto", textAlign: "center", padding: 24, background: "#fff", borderRadius: 20, border: "1px solid var(--line)" }}>
        <AlertCircle size={44} color="#DC2626" style={{ margin: "0 auto 14px" }} />
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>Dossier introuvable</h2>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>{error}</p>
        <Link to="/demande-sur-mesure" className="bs-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <ArrowLeft size={16} /> Créer une nouvelle demande
        </Link>
      </div>
    );
  }

  const statusConfig = {
    en_attente: {
      label: "En attente de chiffrage",
      sub: "Votre demande est en cours d'examen par notre équipe. Vous recevrez une notification chiffrée dès que le devis sera prêt.",
      bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE", icon: Clock
    },
    propose: {
      label: "Devis chiffré disponible",
      sub: "L'équipe a vérifié les disponibilités et calculé le montant total. Veuillez valider pour confirmer la commande ou refuser avec motif.",
      bg: "#FEF3C7", color: "#B45309", border: "#FDE68A", icon: Sparkles
    },
    valide: {
      label: "Commande Validée",
      sub: "Vous avez accepté le devis. La commande est enregistrée dans notre système et est actuellement en cours de préparation.",
      bg: "#DCFCE7", color: "#15803D", border: "#86EFAC", icon: CheckCircle2
    },
    refuse: {
      label: "Proposition déclinée",
      sub: `Cette proposition a été refusée par le client. Motif : ${request.motifRefus || "Non précisé"}.`,
      bg: "#FEE2E2", color: "#B91C1C", border: "#FCA5A5", icon: XCircle
    }
  };

  const currentStatus = statusConfig[request.statut] || statusConfig.en_attente;
  const StatusIcon = currentStatus.icon;

  const totalCalculated = Number(request.totalPropose || 0) + Number(request.fraisLivraison || 0);

  return (
    <div style={{ maxWidth: 840, margin: "32px auto 80px", padding: "0 16px" }}>
      {/* ── BARRE D'ACTIONS SUPÉRIEURE ── */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <Link to="/demande-sur-mesure" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted)", textDecoration: "none", fontSize: 13.5, fontWeight: 700 }}>
          <ArrowLeft size={16} /> Nouvelle demande
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={handlePrintInvoice}
            style={{
              background: "#F1F5F9", border: "1.5px solid #CBD5E1", color: "#334155",
              padding: "8px 14px", borderRadius: 10, fontWeight: 700, fontSize: 13,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6
            }}
          >
            <Printer size={16} /> Imprimer la Facture / Devis
          </button>

          <button
            onClick={handleOpenWhatsApp}
            style={{
              background: "#25D366", border: "none", color: "#fff",
              padding: "8px 14px", borderRadius: 10, fontWeight: 800, fontSize: 13,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              boxShadow: "0 2px 8px rgba(37,211,102,0.3)"
            }}
          >
            <MessageCircle size={16} /> Échanger sur WhatsApp
          </button>
        </div>
      </div>

      {/* ── BANNIÈRE DE STATUT ── */}
      <div style={{
        background: currentStatus.bg, border: `1.5px solid ${currentStatus.border}`,
        borderRadius: 18, padding: "20px 24px", marginBottom: 24, display: "flex",
        alignItems: "flex-start", gap: 16
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: currentStatus.color, flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
        }}>
          <StatusIcon size={24} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: currentStatus.color }}>
              {currentStatus.label}
            </h2>
            <span style={{ fontSize: 12.5, fontWeight: 800, background: "#fff", padding: "3px 10px", borderRadius: 12, color: "var(--ink)", border: "1px solid var(--line)" }}>
              Dossier #{request.code}
            </span>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5 }}>
            {currentStatus.sub}
          </p>
        </div>
      </div>

      {/* ── FEUILLE DE COMMANDE / DEVIS OFFICIEL (IMPRIMABLE) ── */}
      <div id="printable-invoice" style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 20,
        padding: "clamp(20px, 4vw, 36px)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
        marginBottom: 24
      }}>
        {/* EN-TÊTE FACTURE */}
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #E2E8F0", paddingBottom: 20, marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--forest-dark)", letterSpacing: "-0.5px" }}>
              SOILIHITECH
            </div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
              Accessoires Électroniques & Smartphones
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              Tél: {boutique?.telephone || "342 08 08"} • Moroni, Comores
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>
              {request.statut === "valide" ? "FACTURE COMMANDE" : "DEVIS / DEMANDE"}
            </div>
            <div style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#2563EB" }}>
              Réf : {request.code}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              Date : {new Date(request.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* BLOC CLIENT & APPAREIL */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24, background: "#F8FAFC", padding: 16, borderRadius: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#64748B", marginBottom: 4 }}>
              Client destinataire :
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>
              {request.nomClient}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Tél: {request.telephoneClient}
            </div>
            {request.emailClient && (
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{request.emailClient}</div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#64748B", marginBottom: 4 }}>
              Appareil concerné :
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#2563EB", display: "flex", alignItems: "center", gap: 6 }}>
              <Smartphone size={16} /> {request.modeleAppareil}
            </div>
            {request.description && (
              <div style={{ fontSize: 12.5, color: "var(--ink)", marginTop: 4 }}>
                <strong>Note :</strong> {request.description}
              </div>
            )}
          </div>
        </div>

        {/* PHOTO(S) JOINTES PAR LE CLIENT SI EXISTANTE(S) */}
        {(() => {
          let clientPhotos = [];
          if (request.photoUrl) {
            try {
              const parsed = JSON.parse(request.photoUrl);
              clientPhotos = Array.isArray(parsed) ? parsed.filter(Boolean) : [request.photoUrl];
            } catch (e) {
              clientPhotos = [request.photoUrl];
            }
          }
          if (clientPhotos.length === 0) return null;
          return (
            <div style={{ marginBottom: 24, padding: "14px 18px", background: "#F8FAFC", borderRadius: 14, border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "#334155", marginBottom: 10 }}>
                Photo{clientPhotos.length > 1 ? "s" : ""} de référence fournie{clientPhotos.length > 1 ? "s" : ""} par le client ({clientPhotos.length}) :
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {clientPhotos.map((url, idx) => (
                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer" title="Cliquer pour agrandir" style={{ display: "block" }}>
                    <img
                      src={url}
                      alt={`Photo ${idx + 1}`}
                      style={{ maxWidth: 160, maxHeight: 120, objectFit: "contain", borderRadius: 10, background: "#fff", border: "1.5px solid var(--line)", cursor: "zoom-in" }}
                    />
                  </a>
                ))}
              </div>
            </div>
          );
        })()}

        {/* TABLEAU DES ARTICLES */}
        <div style={{ marginBottom: 20, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#F1F5F9", borderBottom: "2px solid #CBD5E1" }}>
                <th style={{ padding: "10px 12px", fontSize: 12, fontWeight: 800, color: "#475569" }}>#</th>
                <th style={{ padding: "10px 12px", fontSize: 12, fontWeight: 800, color: "#475569" }}>Article / Spécification</th>
                <th style={{ padding: "10px 12px", fontSize: 12, fontWeight: 800, color: "#475569", textAlign: "center" }}>Quantité</th>
                <th style={{ padding: "10px 12px", fontSize: 12, fontWeight: 800, color: "#475569", textAlign: "right" }}>Prix Unit. (KMF)</th>
                <th style={{ padding: "10px 12px", fontSize: 12, fontWeight: 800, color: "#475569", textAlign: "right" }}>Total (KMF)</th>
              </tr>
            </thead>
            <tbody>
              {(request.articles || []).map((art, idx) => {
                const pu = Number(art.prixUnitaire || 0);
                const qte = Number(art.quantite || 1);
                const lineTotal = pu * qte;
                return (
                  <tr key={idx} style={{ borderBottom: "1px solid #E2E8F0" }}>
                    <td style={{ padding: "12px", fontSize: 13, color: "#64748B" }}>{idx + 1}</td>
                    <td style={{ padding: "12px", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{art.nom}</td>
                    <td style={{ padding: "12px", fontSize: 13.5, fontWeight: 700, color: "var(--ink)", textAlign: "center" }}>{qte}</td>
                    <td style={{ padding: "12px", fontSize: 13.5, color: "var(--ink)", textAlign: "right" }}>
                      {pu > 0 ? fcfa(pu) : <span style={{ color: "var(--muted)", fontStyle: "italic" }}>En chiffrage</span>}
                    </td>
                    <td style={{ padding: "12px", fontSize: 14, fontWeight: 800, color: "var(--ink)", textAlign: "right" }}>
                      {lineTotal > 0 ? fcfa(lineTotal) : <span style={{ color: "var(--muted)", fontStyle: "italic" }}>-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* TOTAUX */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
          <div style={{ width: 280, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)" }}>
              <span>Sous-total articles :</span>
              <span style={{ fontWeight: 700, color: "var(--ink)" }}>{fcfa(request.totalPropose || 0)}</span>
            </div>

            {Number(request.fraisLivraison || 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)" }}>
                <span>Frais de livraison :</span>
                <span style={{ fontWeight: 700, color: "var(--ink)" }}>{fcfa(request.fraisLivraison)}</span>
              </div>
            )}

            <div style={{
              display: "flex", justifyContent: "space-between", fontSize: 16,
              fontWeight: 900, color: "#2563EB", borderTop: "2px solid #E2E8F0",
              paddingTop: 10, marginTop: 4
            }}>
              <span>Total à régler :</span>
              <span>{fcfa(totalCalculated)}</span>
            </div>
          </div>
        </div>

        {/* MESSAGE DE L'ÉQUIPE SOILIHITECH */}
        {request.messageAdmin && (
          <div style={{ background: "#EFF6FF", borderLeft: "4px solid #2563EB", padding: "12px 16px", borderRadius: 8, fontSize: 13, color: "var(--ink)" }}>
            <strong>Note de notre équipe :</strong> {request.messageAdmin}
          </div>
        )}
      </div>

      {/* ── BLOC DÉCISION CLIENT (SI LE DEVIS EST PROPOSÉ) ── */}
      {request.statut === "propose" && (
        <div className="no-print" style={{
          background: "#fff", border: "2px solid #3B82F6", borderRadius: 20,
          padding: "24px", boxShadow: "0 10px 30px rgba(37,99,235,0.15)",
          textAlign: "center"
        }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 19, fontWeight: 900, color: "var(--ink)" }}>
            Le chiffrage de votre commande s'élève à {fcfa(totalCalculated)}
          </h3>
          <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--muted)" }}>
            Validez dès maintenant pour lancer la préparation ou refusez si l'offre ne vous convient pas.
          </p>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => handleDecision("valide")}
              disabled={decisionLoading}
              style={{
                background: "linear-gradient(135deg, #16A34A, #15803D)", color: "#fff",
                border: "none", padding: "14px 28px", borderRadius: 14,
                fontSize: 15, fontWeight: 800, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 8,
                boxShadow: "0 4px 14px rgba(22,163,74,0.3)"
              }}
            >
              <Check size={18} />
              {decisionLoading ? "Validation en cours..." : "Valider et Commander ce devis"}
            </button>

            <button
              onClick={() => setShowRefusalModal(true)}
              disabled={decisionLoading}
              style={{
                background: "#FEE2E2", color: "#DC2626", border: "1.5px solid #FCA5A5",
                padding: "14px 24px", borderRadius: 14, fontSize: 14, fontWeight: 800,
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8
              }}
            >
              <X size={18} />
              Refuser la proposition
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL MOTIF DE REFUS ── */}
      {showRefusalModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div style={{
            background: "#fff", borderRadius: 20, width: "100%", maxWidth: 520,
            padding: 24, boxShadow: "0 25px 60px rgba(0,0,0,0.3)"
          }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>
              Pourquoi refusez-vous cette proposition ?
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)" }}>
              Votre retour nous aide à améliorer nos disponibilités et nos tarifs.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {[
                "Prix total trop élevé",
                "Délai d'attente trop long",
                "J'ai déjà trouvé l'accessoire ailleurs",
                "Erreur dans le modèle ou les articles demandés",
                "autre"
              ].map((m) => (
                <label key={m} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 10, border: "1px solid #E2E8F0",
                  background: motifRefus === m ? "#EFF6FF" : "#F8FAFC",
                  cursor: "pointer", fontSize: 13.5, fontWeight: motifRefus === m ? 700 : 500,
                  color: motifRefus === m ? "#2563EB" : "var(--ink)"
                }}>
                  <input
                    type="radio"
                    name="motifRefusRadio"
                    value={m}
                    checked={motifRefus === m}
                    onChange={(e) => setMotifRefus(e.target.value)}
                  />
                  <span>{m === "autre" ? "Autre motif personnalisé" : m}</span>
                </label>
              ))}
            </div>

            {motifRefus === "autre" && (
              <textarea
                className="bs-input"
                style={{ minHeight: 80, marginBottom: 16 }}
                placeholder="Précisez votre motif..."
                value={customMotif}
                onChange={(e) => setCustomMotif(e.target.value)}
              />
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowRefusalModal(false)}
                style={{
                  background: "#F1F5F9", border: "none", padding: "10px 18px",
                  borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer"
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleDecision("refuse")}
                disabled={decisionLoading}
                style={{
                  background: "#DC2626", color: "#fff", border: "none",
                  padding: "10px 18px", borderRadius: 10, fontWeight: 800, fontSize: 13,
                  cursor: "pointer"
                }}
              >
                {decisionLoading ? "Enregistrement..." : "Confirmer le refus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
