import React, { useEffect, useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import { 
  PiggyBank, PlusCircle, Edit, Trash2, Search, ArrowDownRight, 
  ArrowUpRight, Landmark, Calendar, RefreshCw, X, AlertCircle, 
  ShieldCheck, Wallet, DollarSign, FileText
} from "lucide-react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext.jsx";
import TablePagination from "../../components/TablePagination";
import { SkeletonTableRows } from "../../components/Skeleton.jsx";
import { formatPrice as fcfa } from "../../utils/currency.js";

const COMPTES_SUGGESTIONS = [
  "Compte Épargne Banque (BDC)",
  "Compte Épargne Banque de France",
  "Coffre-fort Magasin",
  "MVola Pro Épargne",
  "Wave Pro Épargne",
  "Compte Bloqué / Placement",
  "Autre Compte"
];

export default function Epargne() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [savings, setSavings] = useState([]);
  const [kpis, setKpis] = useState({
    totalEpargneKMF: 0,
    totalEpargneFCFA: 0,
    totalDepotsKMF: 0,
    totalRetraitsKMF: 0,
    totalDepotsFCFA: 0,
    totalRetraitsFCFA: 0,
    totalOperations: 0
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("TOUS");
  const [filterCurrency, setFilterCurrency] = useState("TOUTES");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  // Modals
  const [modalType, setModalType] = useState(null); // 'create' | 'edit' | null
  const [selectedSaving, setSelectedSaving] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const initialFormState = {
    type: "depot",
    montant: "",
    devise: "KMF",
    dateOperation: new Date().toISOString().split("T")[0],
    compte: "Compte Épargne Banque (BDC)",
    reference: "",
    notes: ""
  };

  const [form, setForm] = useState(initialFormState);
  const [erreur, setErreur] = useState("");
  const [saving, setSaving] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  function loadSavings() {
    if (!isAdmin) return;
    setLoading(true);
    const params = {};
    if (filterType !== "TOUS") params.type = filterType;
    if (filterCurrency !== "TOUTES") params.devise = filterCurrency;
    if (dateDebut) params.dateDebut = dateDebut;
    if (dateFin) params.dateFin = dateFin;
    if (search.trim()) params.search = search.trim();

    api.get("/admin/savings", { params })
      .then(res => {
        setSavings(res.data?.savings || []);
        setKpis(res.data?.kpis || {
          totalEpargneKMF: 0,
          totalEpargneFCFA: 0,
          totalDepotsKMF: 0,
          totalRetraitsKMF: 0,
          totalDepotsFCFA: 0,
          totalRetraitsFCFA: 0,
          totalOperations: 0
        });
      })
      .catch(err => {
        toast.error(err.response?.data?.message || "Impossible de charger les données d'épargne.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadSavings();
  }, [filterType, filterCurrency, dateDebut, dateFin]);

  useEffect(() => {
    const handler = setTimeout(() => {
      loadSavings();
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 600, margin: "60px auto", textAlign: "center", padding: 30, background: "var(--paper)", borderRadius: 16, border: "1px solid var(--line)" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FEE2E2", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <AlertCircle size={28} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: 0 }}>Accès réservé à l'administrateur</h2>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 8 }}>
          Cette page d'épargne est strictement réservée au propriétaire et aux administrateurs de la boutique.
        </p>
      </div>
    );
  }

  function openCreateModal(defaultType = "depot") {
    setForm({
      ...initialFormState,
      type: defaultType
    });
    setErreur("");
    setModalType("create");
  }

  function openEditModal(sav) {
    setSelectedSaving(sav);
    setForm({
      type: sav.type || "depot",
      montant: sav.montant || "",
      devise: sav.devise || "KMF",
      dateOperation: sav.dateOperation ? new Date(sav.dateOperation).toISOString().split("T")[0] : "",
      compte: sav.compte || "Compte Épargne",
      reference: sav.reference || "",
      notes: sav.notes || ""
    });
    setErreur("");
    setModalType("edit");
  }

  async function handleSave(e) {
    e.preventDefault();
    setErreur("");

    if (!form.montant || Number(form.montant) <= 0) {
      setErreur("Le montant doit être un chiffre positif supérieur à 0.");
      return;
    }

    setSaving(true);
    try {
      if (modalType === "create") {
        await api.post("/admin/savings", form);
        toast.success(form.type === "depot" ? "Versement d'épargne enregistré !" : "Retrait d'épargne enregistré !");
      } else {
        await api.put(`/admin/savings/${selectedSaving.id}`, form);
        toast.success("Opération d'épargne mise à jour !");
      }
      setModalType(null);
      loadSavings();
    } catch (err) {
      setErreur(err.response?.data?.message || "Erreur lors de l'enregistrement de l'opération.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/admin/savings/${id}`);
      toast.success("Opération supprimée avec succès.");
      setDeleteConfirmId(null);
      loadSavings();
    } catch (err) {
      toast.error(err.response?.data?.message || "Impossible de supprimer cette opération.");
    }
  }

  const pagedSavings = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return savings.slice(start, start + pageSize);
  }, [savings, currentPage, pageSize]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 40 }}>
      {/* HEADER & ACTIONS */}
      <div className="bs-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "var(--forest-dark)" }}>
              Épargne & Trésorerie Sécurisée
            </h1>
            <span style={{
              background: "#FEF3C7",
              color: "#92400E",
              fontSize: 11,
              fontWeight: 800,
              padding: "2px 8px",
              borderRadius: 8
            }}>
              Réservé Admin
            </span>
          </div>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13.5 }}>
            Consultez le solde de vos économies, vos versements réguliers et retraits de réserve.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={loadSavings}
            className="bs-btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 13 }}
            title="Actualiser les données"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Actualiser
          </button>

          <button
            type="button"
            onClick={() => openCreateModal("retrait")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 16px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 800,
              background: "#FFFFFF",
              color: "#B45309",
              border: "1px solid #FCD34D",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)"
            }}
          >
            <ArrowDownRight size={16} /> Retrait d'Épargne
          </button>

          <button
            type="button"
            onClick={() => openCreateModal("depot")}
            className="bs-btn-primary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 18px",
              borderRadius: 12,
              fontSize: 13.5,
              fontWeight: 800,
              background: "var(--forest-dark)",
              color: "#ffffff",
              boxShadow: "0 4px 12px rgba(31, 77, 58, 0.25)"
            }}
          >
            <PlusCircle size={17} /> Nouveau Dépôt d'Épargne
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 14,
        marginBottom: 20
      }}>
        {/* KPI 1 : TOTAL ÉPARGNÉ KMF */}
        <div style={{
          background: "linear-gradient(135deg, var(--forest-dark), #173826)",
          color: "#ffffff",
          borderRadius: 18,
          padding: "20px 22px",
          boxShadow: "0 8px 20px rgba(31, 77, 58, 0.25)",
          position: "relative",
          overflow: "hidden"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.8 }}>
                Solde Net Épargne (KMF)
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>
                {fcfa(kpis.totalEpargneKMF, "KMF")}
              </div>
            </div>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(255, 255, 255, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <PiggyBank size={24} />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 14, fontSize: 11.5, opacity: 0.9 }}>
            <span>Dépôts : +{fcfa(kpis.totalDepotsKMF, "KMF")}</span>
            <span>Retraits : -{fcfa(kpis.totalRetraitsKMF, "KMF")}</span>
          </div>
        </div>

        {/* KPI 2 : TOTAL ÉPARGNÉ FCFA */}
        <div style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: 18,
          padding: "20px 22px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                Solde Net Épargne (FCFA)
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#166534", marginTop: 4 }}>
                {fcfa(kpis.totalEpargneFCFA, "FCFA")}
              </div>
            </div>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#DCFCE7",
              color: "#166534",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Landmark size={22} />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 14, fontSize: 11.5, color: "var(--muted)" }}>
            <span>Dépôts : +{fcfa(kpis.totalDepotsFCFA, "FCFA")}</span>
            <span>Retraits : -{fcfa(kpis.totalRetraitsFCFA, "FCFA")}</span>
          </div>
        </div>

        {/* KPI 3 : NOMBRE TOTAL D'OPÉRATIONS */}
        <div style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: 18,
          padding: "20px 22px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                Opérations d'Épargne
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "var(--ink)", marginTop: 4 }}>
                {kpis.totalOperations} <span style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>mouvements</span>
              </div>
            </div>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#EFF6FF",
              color: "#1E40AF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Wallet size={22} />
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--muted)" }}>
            Contrôle sécurisé de votre réserve financière.
          </div>
        </div>
      </div>

      {/* FILTERS TOOLBAR */}
      <div style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "14px 18px",
        marginBottom: 16,
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        {/* Search */}
        <div style={{ position: "relative", minWidth: 220, flex: 1 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            type="text"
            className="bs-input"
            placeholder="Rechercher compte, référence, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34, fontSize: 13, height: 38 }}
          />
        </div>

        {/* Filter Type */}
        <select
          className="bs-input"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ fontSize: 13, height: 38, minWidth: 150 }}
        >
          <option value="TOUS">Tous les types</option>
          <option value="depot">Dépôts (Versements)</option>
          <option value="retrait">Retraits d'épargne</option>
        </select>

        {/* Filter Currency */}
        <select
          className="bs-input"
          value={filterCurrency}
          onChange={(e) => setFilterCurrency(e.target.value)}
          style={{ fontSize: 13, height: 38, width: 125 }}
        >
          <option value="TOUTES">Toutes devises</option>
          <option value="KMF">KMF (Comores)</option>
          <option value="FCFA">FCFA (Sénégal)</option>
        </select>

        {/* Date Debut */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>Du</span>
          <input
            type="date"
            className="bs-input"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            style={{ fontSize: 12.5, height: 38, width: 135 }}
          />
        </div>

        {/* Date Fin */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>Au</span>
          <input
            type="date"
            className="bs-input"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            style={{ fontSize: 12.5, height: 38, width: 135 }}
          />
        </div>

        {(search || filterType !== "TOUS" || filterCurrency !== "TOUTES" || dateDebut || dateFin) && (
          <button
            type="button"
            className="bs-btn-secondary"
            onClick={() => {
              setSearch("");
              setFilterType("TOUS");
              setFilterCurrency("TOUTES");
              setDateDebut("");
              setDateFin("");
            }}
            style={{ height: 38, padding: "0 10px", fontSize: 12, borderRadius: 10 }}
            title="Réinitialiser les filtres"
          >
            <X size={14} /> Effacer filtres
          </button>
        )}
      </div>

      {/* SAVINGS TABLE */}
      <div className="bs-card" style={{ padding: 0, overflow: "hidden", borderRadius: 16, border: "1px solid var(--line)" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="bs-table" style={{ width: "100%", margin: 0 }}>
            <thead>
              <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 800 }}>Date</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 800 }}>Type d'Opération</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 800 }}>Compte / Coffre</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 800 }}>Référence / Notes</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 800 }}>Effectué par</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, fontWeight: 800 }}>Montant</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 800, width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTableRows rows={6} cols={7} />
              ) : pagedSavings.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "48px 20px", color: "var(--muted)" }}>
                    <PiggyBank size={36} style={{ margin: "0 auto 10px", opacity: 0.3, display: "block" }} />
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>Aucune opération d'épargne trouvée</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      Enregistrez vos versements d'épargne réguliers pour constituer et suivre votre réserve financière.
                    </div>
                  </td>
                </tr>
              ) : (
                pagedSavings.map((sav) => {
                  const dateStr = sav.dateOperation
                    ? new Date(sav.dateOperation).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
                    : "-";
                  const isDepot = sav.type === "depot";
                  const isFCFA = sav.devise === "FCFA";

                  return (
                    <tr key={sav.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px 16px", fontSize: 12.5, whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 700, color: "var(--ink)" }}>{dateStr}</div>
                      </td>

                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 12,
                          fontWeight: 800,
                          padding: "4px 10px",
                          borderRadius: 20,
                          background: isDepot ? "#DCFCE7" : "#FEF3C7",
                          color: isDepot ? "#166534" : "#92400E"
                        }}>
                          {isDepot ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                          {isDepot ? "Dépôt / Épargne" : "Retrait d'épargne"}
                        </span>
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 13 }}>
                          {sav.compte || "Compte Épargne"}
                        </div>
                      </td>

                      <td style={{ padding: "12px 16px", fontSize: 12.5 }}>
                        {sav.reference && (
                          <div style={{ fontWeight: 700, color: "var(--ink)" }}>
                            Réf : {sav.reference}
                          </div>
                        )}
                        {sav.notes ? (
                          <div style={{ color: "var(--muted)", marginTop: 2 }}>{sav.notes}</div>
                        ) : (
                          !sav.reference && <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Aucune note</span>
                        )}
                      </td>

                      <td style={{ padding: "12px 16px", fontSize: 12.5, color: "var(--ink)", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 700 }}>{sav.creePar?.nom || "Admin"}</div>
                      </td>

                      <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{
                          fontWeight: 900,
                          fontSize: 14.5,
                          color: isDepot ? "#166534" : "#B45309"
                        }}>
                          {isDepot ? "+" : "-"} {fcfa(sav.montant, sav.devise || "KMF")}
                        </div>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "1px 6px",
                          borderRadius: 6,
                          background: isFCFA ? "#FEF3C7" : "#EFF6FF",
                          color: isFCFA ? "#B45309" : "#1D4ED8"
                        }}>
                          {sav.devise || "KMF"}
                        </span>
                      </td>

                      <td style={{ padding: "12px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <button
                            type="button"
                            className="bs-icon-btn"
                            onClick={() => openEditModal(sav)}
                            title="Modifier cette opération"
                            style={{ color: "var(--forest-dark)" }}
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            type="button"
                            className="bs-icon-btn"
                            onClick={() => setDeleteConfirmId(sav.id)}
                            title="Supprimer cette opération"
                            style={{ color: "#DC2626" }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {savings.length > pageSize && (
          <div style={{ padding: "12px 18px", borderTop: "1px solid var(--line)" }}>
            <TablePagination
              currentPage={currentPage}
              totalItems={savings.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* MODAL CRÉATION / ÉDITION ÉPARGNE */}
      {modalType && (
        <div
          onClick={() => setModalType(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--paper)",
              borderRadius: 20,
              width: "100%",
              maxWidth: 520,
              padding: "24px 26px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              maxHeight: "90vh",
              overflowY: "auto"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, color: "var(--forest-dark)" }}>
                  {modalType === "create" ? "Nouvelle Opération d'Épargne" : "Modifier l'Opération"}
                </h2>
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
                  Gestion des réserves financières de la boutique.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalType(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {erreur && (
              <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={16} /> {erreur}
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Type d'opération : Dépôt ou Retrait */}
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                  Type d'opération *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: "depot" })}
                    style={{
                      border: form.type === "depot" ? "2px solid #166534" : "1px solid var(--line)",
                      background: form.type === "depot" ? "#DCFCE7" : "transparent",
                      color: form.type === "depot" ? "#166534" : "var(--ink)",
                      padding: "10px",
                      borderRadius: 12,
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6
                    }}
                  >
                    <ArrowUpRight size={16} /> Dépôt / Versement
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: "retrait" })}
                    style={{
                      border: form.type === "retrait" ? "2px solid #B45309" : "1px solid var(--line)",
                      background: form.type === "retrait" ? "#FEF3C7" : "transparent",
                      color: form.type === "retrait" ? "#B45309" : "var(--ink)",
                      padding: "10px",
                      borderRadius: 12,
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6
                    }}
                  >
                    <ArrowDownRight size={16} /> Retrait d'Épargne
                  </button>
                </div>
              </div>

              {/* Montant & Devise */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                    Montant *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    className="bs-input"
                    placeholder="0"
                    value={form.montant}
                    onChange={(e) => setForm({ ...form, montant: e.target.value })}
                    style={{ width: "100%", fontSize: 14, fontWeight: 800 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                    Devise
                  </label>
                  <select
                    className="bs-input"
                    value={form.devise}
                    onChange={(e) => setForm({ ...form, devise: e.target.value })}
                    style={{ width: "100%", fontSize: 13 }}
                  >
                    <option value="KMF">KMF</option>
                    <option value="FCFA">FCFA</option>
                  </select>
                </div>
              </div>

              {/* Compte / Coffre & Date */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                    Compte / Coffre *
                  </label>
                  <input
                    type="text"
                    required
                    list="comptes-list"
                    className="bs-input"
                    placeholder="Ex : Compte BDC, Coffre..."
                    value={form.compte}
                    onChange={(e) => setForm({ ...form, compte: e.target.value })}
                    style={{ width: "100%", fontSize: 13 }}
                  />
                  <datalist id="comptes-list">
                    {COMPTES_SUGGESTIONS.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                    Date de l'opération
                  </label>
                  <input
                    type="date"
                    required
                    className="bs-input"
                    value={form.dateOperation}
                    onChange={(e) => setForm({ ...form, dateOperation: e.target.value })}
                    style={{ width: "100%", fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Référence de virement */}
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  Référence du reçu ou virement (optionnel)
                </label>
                <input
                  type="text"
                  className="bs-input"
                  placeholder="Ex : BDC-VIR-2026-004, MV-883719"
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  style={{ width: "100%", fontSize: 13 }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  Notes ou motif
                </label>
                <textarea
                  className="bs-input"
                  rows={2}
                  placeholder="Objectif de l'épargne ou justification du retrait..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={{ width: "100%", fontSize: 13, resize: "vertical" }}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="bs-btn-secondary"
                  onClick={() => setModalType(null)}
                  style={{ padding: "10px 18px", borderRadius: 10, fontSize: 13 }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bs-btn-primary"
                  style={{
                    padding: "10px 22px",
                    borderRadius: 10,
                    fontSize: 13.5,
                    fontWeight: 800,
                    background: "var(--forest-dark)",
                    color: "#ffffff"
                  }}
                >
                  {saving ? "Enregistrement..." : modalType === "create" ? "Enregistrer l'opération" : "Mettre à jour"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION SUPPRESSION MODAL */}
      {deleteConfirmId && (
        <div
          onClick={() => setDeleteConfirmId(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--paper)",
              borderRadius: 18,
              width: "100%",
              maxWidth: 420,
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              textAlign: "center"
            }}
          >
            <div style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "#FEE2E2",
              color: "#DC2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px"
            }}>
              <Trash2 size={24} />
            </div>

            <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "var(--ink)" }}>
              Supprimer cette opération ?
            </h3>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "8px 0 20px" }}>
              Cette action retirera ce mouvement de votre solde d'épargne.
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                type="button"
                className="bs-btn-secondary"
                onClick={() => setDeleteConfirmId(null)}
                style={{ padding: "9px 18px", borderRadius: 10, fontSize: 13 }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                style={{
                  background: "#DC2626",
                  color: "#ffffff",
                  border: "none",
                  padding: "9px 20px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer"
                }}
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
