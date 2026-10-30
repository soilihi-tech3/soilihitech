import React, { useEffect, useState } from "react";
import { ShoppingBag, DollarSign, Calendar, Search, Printer, RotateCcw, TrendingUp, Pencil, Trash2, AlertTriangle, X } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../api";
import TablePagination from "../../components/TablePagination";
import { formatPrice } from "../../utils/currency.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function Achats() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [achats, setAchats] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [editingAchat, setEditingAchat] = useState(null);
  const [achatToDelete, setAchatToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [kpis, setKpis] = useState({
    totalDepenses: 0,
    beneficePrevisionnelKMF: 0,
    beneficePrevisionnelFCFA: 0,
    potentielVenteKMF: 0,
    potentielVenteFCFA: 0
  });
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  function load(start = startDate, end = endDate) {
    setLoading(true);
    const params = {};
    if (start) params.startDate = start;
    if (end) params.endDate = end;

    api.get("/admin/achats", { params })
      .then(res => {
        if (res.data) {
          const list = Array.isArray(res.data) ? res.data : (res.data.achats || []);
          setAchats(list);
          if (res.data.totalDepenses !== undefined) {
            setKpis({
              totalDepenses: Number(res.data.totalDepenses || 0),
              beneficePrevisionnelKMF: Number(res.data.beneficePrevisionnelKMF || 0),
              beneficePrevisionnelFCFA: Number(res.data.beneficePrevisionnelFCFA || 0),
              potentielVenteKMF: Number(res.data.potentielVenteKMF || 0),
              potentielVenteFCFA: Number(res.data.potentielVenteFCFA || 0)
            });
          }
        }
      })
      .catch(err => {
        console.error("Erreur lors du chargement des achats:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
    api.get("/admin/fournisseurs")
      .then(res => setFournisseurs(res.data || []))
      .catch(() => setFournisseurs([]));
  }, []);

  async function handleDeleteAchat() {
    if (!achatToDelete) return;
    setSubmitting(true);
    try {
      await api.delete(`/admin/achats/${achatToDelete.id}`);
      toast.success("Achat supprimé avec succès. Le stock a été réajusté.");
      setAchatToDelete(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la suppression de l'achat.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEditAchat(e) {
    e.preventDefault();
    if (!editingAchat) return;
    setSubmitting(true);
    try {
      await api.put(`/admin/achats/${editingAchat.id}`, {
        quantite: Number(editingAchat.quantite),
        prixAchatUnitaire: Number(editingAchat.prixAchatUnitaire),
        fournisseurId: editingAchat.fournisseurId || null,
        notes: editingAchat.notes || ""
      });
      toast.success("Achat modifié avec succès et stock réajusté.");
      setEditingAchat(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la modification de l'achat.");
    } finally {
      setSubmitting(false);
    }
  }

  const handleFilterDate = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    load(startDate, endDate);
  };

  const handleResetFilter = () => {
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
    load("", "");
  };

  const filteredAchats = achats.filter(a => {
    const q = search.trim().toLowerCase();
    const prodName = a.product?.nom?.toLowerCase() || "";
    const fournName = a.fournisseur?.nom?.toLowerCase() || "";
    return !q || prodName.includes(q) || fournName.includes(q);
  });

  const totalDepensesFiltrees = filteredAchats.reduce((sum, a) => sum + Number(a.totalAchat || 0), 0);

  // Fonction pour générer et télécharger le PDF des achats
  const handleDownloadPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour télécharger le PDF.");
      return;
    }

    const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const periodeStr = (startDate || endDate) 
      ? `Période du ${startDate || "Début"} au ${endDate || "Aujourd'hui"}`
      : "Toutes les dates";

    const rowsHtml = filteredAchats.map(a => {
      const dateFormatted = new Date(a.createdAt || a.dateAchat).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const prodNom = a.product?.nom || "Produit";
      const fournNom = a.fournisseur?.nom || "Achat Direct";
      const qte = a.quantite || 1;
      const pu = formatPrice(a.prixAchatUnitaire || 0, "FCFA");
      const tot = formatPrice(a.totalAchat || 0, "FCFA");

      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${dateFormatted}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: bold;">${prodNom}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${fournNom}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: center;">${qte}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right;">${pu}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; font-weight: bold; color: #163424;">${tot}</td>
        </tr>
      `;
    }).join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Rapport des Achats & Approvisionnements</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 30px; color: #1e293b; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #163424; padding-bottom: 20px; margin-bottom: 24px; }
          .header h1 { margin: 0; color: #163424; font-size: 24px; }
          .header p { margin: 4px 0 0; color: #64748b; font-size: 13px; }
          .kpi-container { display: flex; gap: 16px; margin-bottom: 24px; }
          .kpi-box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
          .kpi-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .kpi-value { font-size: 20px; font-weight: bold; color: #163424; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f1f5f9; padding: 10px; font-size: 11px; text-transform: uppercase; color: #475569; text-align: left; border-bottom: 2px solid #cbd5e1; }
          th.right { text-align: right; }
          th.center { text-align: center; }
          .footer { margin-top: 40px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; }
          @media print {
            body { margin: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Rapport des Achats & Dépenses</h1>
            <p>Boutique E-commerce &bull; ${periodeStr}</p>
          </div>
          <div style="text-align: right;">
            <p style="font-weight: bold; color: #163424;">Généré le ${dateStr}</p>
            <p>${filteredAchats.length} achat(s) enregistré(s)</p>
          </div>
        </div>

        <div class="kpi-container">
          <div class="kpi-box">
            <div class="kpi-title">Total Dépenses d'Achats</div>
            <div class="kpi-value" style="color: #dc2626;">${formatPrice(kpis.totalDepenses || totalDepensesFiltrees, "FCFA")}</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-title">Total Lignes d'Achats</div>
            <div class="kpi-value" style="color: #163424;">${filteredAchats.length}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Produit</th>
              <th>Fournisseur</th>
              <th class="center">Quantité</th>
              <th class="right">Prix Achat Unitaire</th>
              <th class="right">Coût Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="6" style="text-align: center; padding: 20px;">Aucun achat trouvé pour cette période.</td></tr>`}
          </tbody>
        </table>

        <div class="footer">
          Document généré automatiquement par la plateforme e-commerce &bull; Tous droits réservés
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <>
      {/* TOOLBAR */}
      <div className="bs-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Achats & Approvisionnements</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Synchronisation automatique avec les produits. Suivez vos dépenses réelles et vos prévisions de bénéfices Comores et Sénégal.
          </p>
        </div>

        {/* BOUTON TÉLÉCHARGER LE PDF */}
        <button 
          onClick={handleDownloadPDF} 
          className="bs-btn-primary" 
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, cursor: "pointer" }}
        >
          <Printer size={18} /> Télécharger PDF / Imprimer
        </button>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        {/* DÉPENSES TOTALES */}
        <div className="bs-panel" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "#FEE2E2", color: "#DC2626", borderRadius: 12, padding: 12 }}>
            <DollarSign size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#DC2626", fontWeight: 700, textTransform: "uppercase" }}>Dépenses Totales d'Achats</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#991B1B" }}>
              {formatPrice(kpis.totalDepenses || totalDepensesFiltrees, "FCFA")}
            </div>
          </div>
        </div>

        {/* TOTAL ACHATS */}
        <div className="bs-panel" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "var(--paper)", color: "var(--ink)", borderRadius: 12, padding: 12 }}>
            <ShoppingBag size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>Total Lignes d'Achats</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>{filteredAchats.length}</div>
          </div>
        </div>
      </div>

      {/* FILTER BAR: DATES & SEARCH */}
      <div className="bs-panel" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          
          {/* SEARCH */}
          <div style={{ position: "relative", minWidth: 260, flex: "1 1 260px" }}>
            <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              className="bs-input"
              placeholder="Rechercher par produit ou fournisseur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 38, borderRadius: 10, fontSize: 13.5, height: 38 }}
            />
          </div>

          {/* DATE RANGE FILTER */}
          <form onSubmit={handleFilterDate} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>Du:</span>
              <input
                type="date"
                className="bs-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ height: 38, borderRadius: 8, fontSize: 13, padding: "4px 8px" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>Au:</span>
              <input
                type="date"
                className="bs-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ height: 38, borderRadius: 8, fontSize: 13, padding: "4px 8px" }}
              />
            </div>

            <button type="submit" className="bs-btn-primary" style={{ padding: "8px 14px", height: 38, borderRadius: 8, fontSize: 13 }}>
              Filtrer
            </button>

            {(startDate || endDate) && (
              <button 
                type="button" 
                onClick={handleResetFilter} 
                style={{ display: "flex", alignItems: "center", gap: 4, height: 38, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 13 }}
                title="Réinitialiser le filtre"
              >
                <RotateCcw size={14} /> Effacer
              </button>
            )}
          </form>

        </div>
      </div>

      {/* ACHATS TABLE */}
      <div className="bs-panel" style={{ padding: 0 }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
          <table className="bs-table" style={{ width: "100%", minWidth: 700, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Date</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Produit</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Fournisseur</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Quantité</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Prix Achat (FCFA)</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", textAlign: "right" }}>Coût Total (FCFA)</th>
              {isAdmin && (
                <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", textAlign: "center" }}>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredAchats.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} style={{ padding: 36, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
                  {loading ? "Chargement des achats..." : "Aucun achat / approvisionnement trouvé pour cette période."}
                </td>
              </tr>
            ) : (
              filteredAchats.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(a => {
                const dateFormatted = new Date(a.createdAt || a.dateAchat).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

                return (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{dateFormatted}</div>
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img 
                          src={a.product?.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=60&q=80"} 
                          alt={a.product?.nom} 
                          style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover" }} 
                        />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{a.product?.nom || "Produit sans nom"}</div>
                          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Stock actuel: {a.product?.stock ?? "-"}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: a.fournisseur ? "var(--forest-dark)" : "var(--muted)" }}>
                        {a.fournisseur?.nom || "Achat direct"}
                      </div>
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <span style={{ background: "var(--forest-light)", color: "var(--forest-dark)", padding: "4px 10px", borderRadius: 12, fontSize: 12.5, fontWeight: 800 }}>
                        +{a.quantite}
                      </span>
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
                        {formatPrice(a.prixAchatUnitaire, "FCFA")}
                      </div>
                    </td>

                    <td style={{ padding: "14px 18px", textAlign: "right" }}>
                      <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--forest-dark)" }}>
                        {formatPrice(a.totalAchat, "FCFA")}
                      </div>
                    </td>

                    {isAdmin && (
                      <td style={{ padding: "14px 18px", textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <button
                            type="button"
                            className="bs-icon-btn"
                            title="Modifier cet achat (Admin)"
                            onClick={() => setEditingAchat({
                              id: a.id,
                              productId: a.productId,
                              productNom: a.product?.nom || "Produit",
                              quantite: a.quantite,
                              prixAchatUnitaire: a.prixAchatUnitaire,
                              fournisseurId: a.fournisseurId || "",
                              notes: a.notes || ""
                            })}
                            style={{ color: "var(--forest-dark)" }}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="bs-icon-btn"
                            title="Supprimer cet achat (Admin)"
                            onClick={() => setAchatToDelete(a)}
                            style={{ color: "#B4483A" }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
        <TablePagination
          totalItems={filteredAchats.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(1); }}
        />
      </div>

      {/* MODAL MODIFIER UN ACHAT (ADMIN ONLY) */}
      {editingAchat && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, width: "100%", maxWidth: 460,
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)", overflow: "hidden"
          }}>
            <div style={{
              padding: "16px 20px", borderBottom: "1px solid var(--line)",
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "var(--forest-dark)" }}>
                Modifier l'achat - {editingAchat.productNom}
              </div>
              <button
                type="button"
                onClick={() => setEditingAchat(null)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted)" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditAchat} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 5 }}>
                  Quantité achetée :
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  className="bs-input"
                  value={editingAchat.quantite}
                  onChange={(e) => setEditingAchat({ ...editingAchat, quantite: e.target.value })}
                  style={{ width: "100%", height: 38, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 5 }}>
                  Prix d'achat unitaire (FCFA) :
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  className="bs-input"
                  value={editingAchat.prixAchatUnitaire}
                  onChange={(e) => setEditingAchat({ ...editingAchat, prixAchatUnitaire: e.target.value })}
                  style={{ width: "100%", height: 38, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 5 }}>
                  Fournisseur :
                </label>
                <select
                  className="bs-select"
                  value={editingAchat.fournisseurId}
                  onChange={(e) => setEditingAchat({ ...editingAchat, fournisseurId: e.target.value })}
                  style={{ width: "100%", height: 38, fontSize: 13 }}
                >
                  <option value="">Achat direct (Aucun fournisseur)</option>
                  {fournisseurs.map(f => (
                    <option key={f.id} value={f.id}>{f.nom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 5 }}>
                  Notes / Observations :
                </label>
                <input
                  type="text"
                  className="bs-input"
                  value={editingAchat.notes}
                  onChange={(e) => setEditingAchat({ ...editingAchat, notes: e.target.value })}
                  placeholder="Notes facultatives..."
                  style={{ width: "100%", height: 38, fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditingAchat(null)}
                  className="bs-btn-secondary"
                  style={{ padding: "8px 16px", fontSize: 13 }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bs-btn-primary"
                  style={{ padding: "8px 18px", fontSize: 13 }}
                >
                  {submitting ? "Enregistrement..." : "Enregistrer les modifications"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SUPPRESSION D'UN ACHAT (ADMIN ONLY) */}
      {achatToDelete && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420,
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)", overflow: "hidden", padding: 24
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%", background: "#FEE2E2",
                color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "var(--ink)" }}>
                  Supprimer cet approvisionnement ?
                </div>
                <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  Action réservée aux Administrateurs
                </div>
              </div>
            </div>

            <p style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5, margin: "0 0 20px" }}>
              Êtes-vous sûr de vouloir supprimer cet achat de <strong>+{achatToDelete.quantite} unité(s)</strong> de {achatToDelete.product?.nom} ? Le stock du produit sera <strong>automatiquement diminué</strong> en conséquence.
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setAchatToDelete(null)}
                className="bs-btn-secondary"
                disabled={submitting}
                style={{ padding: "9px 16px", fontSize: 13 }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteAchat}
                disabled={submitting}
                style={{
                  background: "#DC2626", color: "#fff", border: "none", borderRadius: 10,
                  padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer"
                }}
              >
                {submitting ? "Suppression..." : "Confirmer la suppression"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
