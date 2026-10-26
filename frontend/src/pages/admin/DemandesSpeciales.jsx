import React, { useState, useEffect } from "react";
import { 
  ClipboardList, Search, Clock, CheckCircle2, XCircle, 
  Sparkles, Smartphone, Eye, MessageCircle, Printer, 
  Send, RefreshCw, X, ArrowUpDown, Filter, AlertCircle 
} from "lucide-react";
import api from "../../api";
import { SkeletonTableRows } from "../../components/Skeleton.jsx";
import { formatPrice as fcfa } from "../../utils/currency";
import { toast } from "react-hot-toast";

export default function DemandesSpeciales() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("all");
  const [pendingCount, setPendingCount] = useState(0);

  // État du modal de chiffrage / examen
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [quotedArticles, setQuotedArticles] = useState([]);
  const [fraisLivraison, setFraisLivraison] = useState(0);
  const [messageAdmin, setMessageAdmin] = useState("");
  const [submittingQuote, setSubmittingQuote] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [statutFilter]);

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await api.get("/admin/custom-requests", {
        params: {
          search: search.trim() || undefined,
          statut: statutFilter !== "all" ? statutFilter : undefined
        }
      });
      setRequests(res.data.requests || []);
      setPendingCount(res.data.pendingCount || 0);
    } catch (err) {
      console.error("Erreur chargement demandes:", err);
      toast.error("Impossible de charger les demandes sur-mesure.");
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadRequests();
  }

  function openQuoteModal(req) {
    setSelectedRequest(req);
    // Préparer les articles avec leurs prix s'ils existent déjà
    const items = (req.articles || []).map(a => ({
      ...a,
      prixUnitaire: a.prixUnitaire || 0
    }));
    setQuotedArticles(items);
    setFraisLivraison(Number(req.fraisLivraison || 0));
    setMessageAdmin(req.messageAdmin || "Articles disponibles en boutique chez Soilihitech. Matériel original et garanti.");
  }

  function updateArticlePrice(index, price) {
    setQuotedArticles(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], prixUnitaire: Number(price) || 0 };
      return copy;
    });
  }

  const sousTotalArticles = quotedArticles.reduce(
    (sum, a) => sum + (Number(a.prixUnitaire || 0) * Number(a.quantite || 1)), 0
  );
  const totalDevis = sousTotalArticles + Number(fraisLivraison || 0);

  async function handleSendQuote(e) {
    e.preventDefault();
    if (!selectedRequest) return;

    if (totalDevis <= 0) {
      toast.error("Veuillez renseigner au moins un prix pour les articles demandés.");
      return;
    }

    setSubmittingQuote(true);
    try {
      const res = await api.put(`/admin/custom-requests/${selectedRequest.id}/quote`, {
        articles: quotedArticles,
        totalPropose: sousTotalArticles,
        fraisLivraison: Number(fraisLivraison || 0),
        messageAdmin
      });

      if (res.data && res.data.success) {
        toast.success("Devis chiffré et envoyé au client avec succès !");
        setSelectedRequest(null);
        await loadRequests();
      }
    } catch (err) {
      console.error("Erreur enregistrement devis:", err);
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement du devis.");
    } finally {
      setSubmittingQuote(false);
    }
  }

  function sendWhatsAppQuote(req) {
    const cleanPhone = (req.telephoneClient || "").replace(/[^0-9]/g, "");
    if (!cleanPhone) {
      toast.error("Numéro de téléphone client manquant.");
      return;
    }

    const articlesLines = (req.articles || [])
      .map((a, i) => `• ${a.nom} (x${a.quantite}) : ${Number(a.prixUnitaire) ? fcfa(Number(a.prixUnitaire) * Number(a.quantite || 1)) : "À confirmer"}`)
      .join("\n");

    const totalDevisCalc = Number(req.totalPropose || 0) + Number(req.fraisLivraison || 0);

    const text = `Bonjour ${req.nomClient},\n\nVoici le chiffrage de votre demande sur-mesure *#${req.code}* pour votre *${req.modeleAppareil}* chez *Soilihitech* :\n\n${articlesLines}\n\n*Total :* ${fcfa(totalDevisCalc)}\n${req.messageAdmin ? `\n*Note :* ${req.messageAdmin}\n` : ""}\nVous pouvez consulter et valider directement votre devis ici :\n${window.location.origin}/demande/${req.code}`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, "_blank");
  }

  const statusBadge = {
    en_attente: { label: "En attente", bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
    propose: { label: "Devis envoyé", bg: "#FEF3C7", color: "#B45309", border: "#FDE68A" },
    valide: { label: "Validée par client", bg: "#DCFCE7", color: "#15803D", border: "#86EFAC" },
    refuse: { label: "Refusée", bg: "#FEE2E2", color: "#B91C1C", border: "#FCA5A5" }
  };

  return (
    <div style={{ padding: "clamp(16px, 3vw, 32px)", maxWidth: 1280, margin: "0 auto" }}>
      {/* ── EN-TÊTE ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#2563EB", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ClipboardList size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "var(--ink)" }}>
                Demandes & Devis Sur-Mesure
              </h1>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                Gérez les commandes d'accessoires personnalisées et chiffrez directement les devis
              </span>
            </div>
          </div>
        </div>

        {pendingCount > 0 && (
          <div style={{
            background: "#EFF6FF", border: "1.5px solid #3B82F6", borderRadius: 14,
            padding: "8px 16px", display: "flex", alignItems: "center", gap: 8,
            color: "#1D4ED8", fontWeight: 800, fontSize: 13.5
          }}>
            <Sparkles size={16} />
            {pendingCount} demande{pendingCount > 1 ? "s" : ""} en attente de réponse
          </div>
        )}
      </div>

      {/* ── FILTRES ET RECHERCHE ── */}
      <div style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 16,
        padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center",
        justifyContent: "space-between", flexWrap: "wrap", gap: 14, boxShadow: "0 2px 10px rgba(0,0,0,0.02)"
      }}>
        {/* STATUT TABS */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { key: "all", label: "Toutes les demandes" },
            { key: "en_attente", label: "En attente", count: pendingCount },
            { key: "propose", label: "Devis envoyés" },
            { key: "valide", label: "Validées" },
            { key: "refuse", label: "Refusées" }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setStatutFilter(t.key)}
              style={{
                padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                border: statutFilter === t.key ? "1.5px solid #2563EB" : "1px solid var(--line)",
                background: statutFilter === t.key ? "#EFF6FF" : "#F8FAFC",
                color: statutFilter === t.key ? "#2563EB" : "var(--ink)",
                cursor: "pointer", transition: "all 0.15s"
              }}
            >
              {t.label} {t.count ? `(${t.count})` : ""}
            </button>
          ))}
        </div>

        {/* BARRE DE RECHERCHE RAPIDE */}
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 8, flex: "1 1 280px", maxWidth: 420 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              type="text"
              className="bs-input"
              placeholder="Rechercher par client, téléphone, modèle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36, height: 40, fontSize: 13 }}
            />
            <Search size={16} color="var(--muted)" style={{ position: "absolute", left: 12, top: 12 }} />
          </div>
          <button type="submit" className="bs-btn-primary" style={{ padding: "0 16px", height: 40 }}>
            Filtrer
          </button>
        </form>
      </div>

      {/* ── TABLE DES DEMANDES ── */}
      <div style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 18,
        overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.03)"
      }}>
        {loading ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>RÉFÉRENCE</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>CLIENT & TÉL</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>MODÈLE APPAREIL</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>ARTICLES DEMANDÉS</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>TOTAL DEVIS</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>STATUT</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B", textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                <SkeletonTableRows rows={6} cols={7} />
              </tbody>
            </table>
          </div>
        ) : requests.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}>
            <ClipboardList size={40} style={{ margin: "0 auto 10px", opacity: 0.4 }} />
            <h3 style={{ margin: "0 0 6px", fontSize: 16, color: "var(--ink)" }}>Aucune demande trouvée</h3>
            <p style={{ margin: 0, fontSize: 13 }}>Les nouvelles demandes des clients s'afficheront ici en temps réel.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>RÉFÉRENCE</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>CLIENT & TÉL</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>MODÈLE APPAREIL</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>ARTICLES DEMANDÉS</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>TOTAL DEVIS</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>STATUT</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B", textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => {
                  const s = statusBadge[req.statut] || statusBadge.en_attente;
                  const total = Number(req.totalPropose || 0) + Number(req.fraisLivraison || 0);

                  return (
                    <tr key={req.id} style={{ borderBottom: "1px solid #E2E8F0", transition: "background 0.15s" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, fontFamily: "monospace", color: "#2563EB" }}>
                          {req.code}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                          {new Date(req.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{req.nomClient}</div>
                        <div style={{ fontSize: 12.5, color: "#25D366", fontWeight: 700, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <MessageCircle size={13} /> {req.telephoneClient}
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                          <Smartphone size={15} color="#2563EB" /> {req.modeleAppareil}
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 13, color: "var(--ink)", maxWidth: 220 }}>
                          {(req.articles || []).map((a, i) => (
                            <div key={i} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              • {a.nom} <strong style={{ color: "#2563EB" }}>x{a.quantite}</strong>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        {total > 0 ? (
                          <div style={{ fontSize: 14, fontWeight: 900, color: "#16A34A" }}>
                            {fcfa(total)}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>
                            Non chiffré
                          </span>
                        )}
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <span style={{
                          background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                          padding: "4px 10px", borderRadius: 12, fontSize: 12, fontWeight: 800,
                          display: "inline-block"
                        }}>
                          {s.label}
                        </span>
                      </td>

                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            onClick={() => openQuoteModal(req)}
                            style={{
                              background: "#EFF6FF", border: "1.5px solid #BFDBFE",
                              color: "#2563EB", padding: "6px 12px", borderRadius: 8,
                              fontSize: 12.5, fontWeight: 800, cursor: "pointer",
                              display: "inline-flex", alignItems: "center", gap: 4
                            }}
                          >
                            <Eye size={14} /> Examiner & Chiffrer
                          </button>

                          <button
                            onClick={() => sendWhatsAppQuote(req)}
                            title="Envoyer le devis sur WhatsApp"
                            style={{
                              background: "#25D366", border: "none", color: "#fff",
                              padding: "6px 10px", borderRadius: 8, cursor: "pointer",
                              display: "inline-flex", alignItems: "center"
                            }}
                          >
                            <MessageCircle size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL D'EXAMEN & CHIFFRAGE DU DEVIS ── */}
      {selectedRequest && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div style={{
            background: "#fff", borderRadius: 20, width: "100%", maxWidth: 740,
            maxHeight: "92vh", overflowY: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
            animation: "popIn 0.2s ease-out"
          }}>
            {/* EN-TÊTE MODAL */}
            <div style={{
              padding: "16px 20px", background: "linear-gradient(135deg, #1E293B, #0F172A)",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>
                  Chiffrage Devis — Dossier #{selectedRequest.code}
                </h3>
                <span style={{ fontSize: 12, color: "#94A3B8" }}>
                  Client : {selectedRequest.nomClient} ({selectedRequest.telephoneClient})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* CORPS DU MODAL */}
            <form onSubmit={handleSendQuote} style={{ padding: 24 }}>
              {/* INFOS APPAREIL & NOTE */}
              <div style={{
                background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 14,
                padding: 16, marginBottom: 20, display: "grid", gridTemplateColumns: "1fr auto", gap: 16
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>
                    Modèle de smartphone demandé :
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#2563EB", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                    <Smartphone size={18} /> {selectedRequest.modeleAppareil}
                  </div>
                  {selectedRequest.description && (
                    <div style={{ fontSize: 12.5, color: "var(--ink)", marginTop: 6 }}>
                      <strong>Détails du client :</strong> {selectedRequest.description}
                    </div>
                  )}
                  {selectedRequest.motifRefus && (
                    <div style={{ fontSize: 12.5, color: "#DC2626", marginTop: 6, fontWeight: 700 }}>
                      ⚠️ Motif de refus client : {selectedRequest.motifRefus}
                    </div>
                  )}
                </div>

                {(() => {
                  let adminPhotos = [];
                  if (selectedRequest.photoUrl) {
                    try {
                      const parsed = JSON.parse(selectedRequest.photoUrl);
                      adminPhotos = Array.isArray(parsed) ? parsed.filter(Boolean) : [selectedRequest.photoUrl];
                    } catch (e) {
                      adminPhotos = [selectedRequest.photoUrl];
                    }
                  }
                  if (adminPhotos.length === 0) return null;
                  return (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                        {adminPhotos.map((url, idx) => (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer" title="Cliquer pour agrandir">
                            <img
                              src={url}
                              alt={`Photo ${idx + 1}`}
                              style={{ width: 85, height: 65, objectFit: "cover", borderRadius: 8, background: "#fff", border: "1.5px solid #CBD5E1", cursor: "zoom-in" }}
                            />
                          </a>
                        ))}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748B", marginTop: 4 }}>
                        Photo{adminPhotos.length > 1 ? `s (${adminPhotos.length})` : ""} client
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* TABLEAU CHIFFRAGE ARTICLES */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", display: "block", marginBottom: 8 }}>
                  Saisir le prix unitaire pour chaque accessoire (en KMF) :
                </label>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {quotedArticles.map((art, idx) => (
                    <div key={idx} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "10px 14px", borderRadius: 12
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
                          {art.nom}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                          Quantité : <strong>{art.quantite}</strong>
                        </div>
                      </div>

                      <div style={{ width: 170 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>Prix unit.</span>
                          <input
                            type="number"
                            min="0"
                            step="50"
                            required
                            className="bs-input"
                            style={{ background: "#fff", fontWeight: 800, color: "#2563EB", textAlign: "right" }}
                            value={art.prixUnitaire}
                            onChange={(e) => updateArticlePrice(idx, e.target.value)}
                          />
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#64748B" }}>KMF</span>
                        </div>
                      </div>

                      <div style={{ width: 120, textAlign: "right", fontSize: 13.5, fontWeight: 900, color: "var(--ink)" }}>
                        {fcfa(Number(art.prixUnitaire || 0) * Number(art.quantite || 1))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* FRAIS DE LIVRAISON & TOTAL CALCULÉ */}
              <div style={{
                background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: 14,
                padding: "16px 20px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "#1E40AF" }}>
                    Frais de livraison éventuels :
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    className="bs-input"
                    style={{ width: 120, background: "#fff", fontWeight: 700, textAlign: "right" }}
                    value={fraisLivraison}
                    onChange={(e) => setFraisLivraison(Number(e.target.value) || 0)}
                  />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1E40AF" }}>KMF</span>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: "#1E40AF", fontWeight: 700 }}>TOTAL DU DEVIS :</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#1D4ED8" }}>
                    {fcfa(totalDevis)}
                  </div>
                </div>
              </div>

              {/* MESSAGE DE L'ADMIN AU CLIENT */}
              <div className="bs-input-group" style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                  Message d'accompagnement pour le client :
                </label>
                <textarea
                  className="bs-input"
                  style={{ minHeight: 75, resize: "vertical" }}
                  value={messageAdmin}
                  onChange={(e) => setMessageAdmin(e.target.value)}
                  placeholder="Ex: Tous les accessoires sont 100% neufs, testés et garantis..."
                />
              </div>

              {/* ACTIONS FINALES DU MODAL */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  style={{
                    background: "#F1F5F9", border: "none", color: "#475569",
                    padding: "12px 18px", borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: "pointer"
                  }}
                >
                  Fermer
                </button>

                <button
                  type="submit"
                  disabled={submittingQuote}
                  className="bs-btn-primary"
                  style={{
                    padding: "12px 24px", fontSize: 14, fontWeight: 800,
                    display: "inline-flex", alignItems: "center", gap: 8
                  }}
                >
                  <Send size={16} />
                  {submittingQuote ? "Envoi du devis..." : "Valider & Notifier le Devis au client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
