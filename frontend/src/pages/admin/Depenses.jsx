import React, { useEffect, useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import { 
  PlusCircle, Edit, Trash2, Search, Calendar, User, 
  Receipt, ArrowUpRight, DollarSign, AlertCircle, X, 
  ExternalLink, RefreshCw
} from "lucide-react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext.jsx";
import TablePagination from "../../components/TablePagination";
import { SkeletonTableRows } from "../../components/Skeleton.jsx";
import { formatPrice as fcfa, getActiveCurrency } from "../../utils/currency.js";
import { subscribeRealtime } from "../../utils/realtime.js";

export default function Depenses() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const userPerms = Array.isArray(user?.permissions) ? user.permissions : [];

  const canCreate = isAdmin || userPerms.includes("creer_depense");
  const canEdit = isAdmin || userPerms.includes("modifier_depense");
  const canDelete = isAdmin || userPerms.includes("supprimer_depense");

  const assignedCurrency = user?.role === "employe" && user?.deviseAutorisee && user.deviseAutorisee !== "TOUTES"
    ? user.deviseAutorisee
    : null;

  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [kpis, setKpis] = useState({ totalCount: 0, totalMontantKMF: 0, totalMontantFCFA: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("TOUS");
  const [filterCurrency, setFilterCurrency] = useState(assignedCurrency || "TOUTES");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  // Modals
  const [modalType, setModalType] = useState(null); // 'create' | 'edit' | null
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const initialFormState = {
    titre: "",
    montant: "",
    devise: assignedCurrency || getActiveCurrency() || "KMF",
    dateDepense: new Date().toISOString().split("T")[0],
    notes: "",
    justificatifUrl: ""
  };

  const [form, setForm] = useState(initialFormState);
  const [erreur, setErreur] = useState("");
  const [saving, setSaving] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  function loadExpenses() {
    setLoading(true);
    const params = {};
    if (filterEmployee !== "TOUS") params.employeId = filterEmployee;
    if (filterCurrency !== "TOUTES") params.devise = filterCurrency;
    if (dateDebut) params.dateDebut = dateDebut;
    if (dateFin) params.dateFin = dateFin;
    if (search.trim()) params.search = search.trim();

    api.get("/admin/expenses", { params })
      .then(res => {
        setExpenses(res.data?.expenses || []);
        setKpis(res.data?.kpis || { totalCount: 0, totalMontantKMF: 0, totalMontantFCFA: 0 });
        if (res.data?.employees) {
          setEmployees(res.data.employees);
        }
      })
      .catch(err => {
        toast.error(err.response?.data?.message || "Impossible de charger les dépenses.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadExpenses();
  }, [filterEmployee, filterCurrency, dateDebut, dateFin]);

  useEffect(() => {
    const handler = setTimeout(() => {
      loadExpenses();
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Synchronisation en temps réel sans actualisation
  useEffect(() => {
    const unsub = subscribeRealtime((detail) => {
      const t = detail?.type || detail;
      if (t === "expense_updated") {
        loadExpenses();
      }
    });
    return () => unsub();
  }, [filterEmployee, filterCurrency, dateDebut, dateFin, search]);

  function openCreateModal() {
    setForm({
      ...initialFormState,
      devise: assignedCurrency || getActiveCurrency() || "KMF"
    });
    setErreur("");
    setModalType("create");
  }

  function openEditModal(exp) {
    setSelectedExpense(exp);
    setForm({
      titre: exp.titre || "",
      montant: exp.montant || "",
      devise: exp.devise || "KMF",
      dateDepense: exp.dateDepense ? new Date(exp.dateDepense).toISOString().split("T")[0] : "",
      notes: exp.notes || "",
      justificatifUrl: exp.justificatifUrl || ""
    });
    setErreur("");
    setModalType("edit");
  }

  async function handleSave(e) {
    e.preventDefault();
    setErreur("");

    if (!form.titre.trim()) {
      setErreur("Le titre ou motif de la dépense est requis.");
      return;
    }
    if (!form.montant || Number(form.montant) <= 0) {
      setErreur("Le montant doit être un nombre positif supérieur à zéro.");
      return;
    }

    setSaving(true);
    try {
      if (modalType === "create") {
        await api.post("/admin/expenses", form);
        toast.success("Dépense enregistrée avec succès !");
      } else {
        await api.put(`/admin/expenses/${selectedExpense.id}`, form);
        toast.success("Dépense modifiée avec succès !");
      }
      setModalType(null);
      loadExpenses();
    } catch (err) {
      setErreur(err.response?.data?.message || "Erreur lors de l'enregistrement de la dépense.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/admin/expenses/${id}`);
      toast.success("Dépense supprimée avec succès.");
      setDeleteConfirmId(null);
      loadExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || "Impossible de supprimer cette dépense.");
    }
  }

  const pagedExpenses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return expenses.slice(start, start + pageSize);
  }, [expenses, currentPage, pageSize]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 40 }}>
      {/* HEADER & TITLE */}
      <div className="bs-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "var(--forest-dark)" }}>
            Gestion des Dépenses
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13.5 }}>
            Suivi des sorties d'argent, dépenses courantes et contrôle par employé.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={loadExpenses}
            className="bs-btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 13 }}
            title="Actualiser la liste"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Actualiser
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={openCreateModal}
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
              <PlusCircle size={17} /> Nouvelle Dépense
            </button>
          )}
        </div>
      </div>

      {/* KPI METRICS CARDS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 14,
        marginBottom: 20
      }}>
        {/* KPI 1 : NOMBRE DE DÉPENSES */}
        <div style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          boxShadow: "0 2px 6px rgba(0,0,0,0.03)"
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "#EFF6FF",
            color: "#1E40AF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}>
            <Receipt size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Nombre de Dépenses
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--ink)", marginTop: 2 }}>
              {kpis.totalCount} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>enregistrées</span>
            </div>
          </div>
        </div>

        {/* KPI 2 : MONTANT DÉPENSES KMF */}
        <div style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          boxShadow: "0 2px 6px rgba(0,0,0,0.03)"
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "#FEF2F2",
            color: "#DC2626",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}>
            <DollarSign size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Total Dépenses (KMF)
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#DC2626", marginTop: 2 }}>
              {fcfa(kpis.totalMontantKMF, "KMF")}
            </div>
          </div>
        </div>

        {/* KPI 3 : MONTANT DÉPENSES FCFA */}
        <div style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          boxShadow: "0 2px 6px rgba(0,0,0,0.03)"
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "#FFFBEB",
            color: "#B45309",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}>
            <ArrowUpRight size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Total Dépenses (FCFA)
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#B45309", marginTop: 2 }}>
              {fcfa(kpis.totalMontantFCFA, "FCFA")}
            </div>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
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
            placeholder="Rechercher titre, motif..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34, fontSize: 13, height: 38 }}
          />
        </div>

        {/* Filter Employee */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <User size={15} color="var(--muted)" />
          <select
            className="bs-input"
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            style={{ fontSize: 13, height: 38, minWidth: 160 }}
          >
            <option value="TOUS">Tous les employés</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.nom || emp.email} ({emp.role === "admin" ? "Admin" : "Employé"})
              </option>
            ))}
          </select>
        </div>

        {/* Filter Currency */}
        {!assignedCurrency && (
          <select
            className="bs-input"
            value={filterCurrency}
            onChange={(e) => setFilterCurrency(e.target.value)}
            style={{ fontSize: 13, height: 38, width: 120 }}
          >
            <option value="TOUTES">Toutes devises</option>
            <option value="KMF">KMF (Comores)</option>
            <option value="FCFA">FCFA (Sénégal)</option>
          </select>
        )}

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

        {(search || filterEmployee !== "TOUS" || dateDebut || dateFin) && (
          <button
            type="button"
            className="bs-btn-secondary"
            onClick={() => {
              setSearch("");
              setFilterEmployee("TOUS");
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

      {/* EXPENSES TABLE */}
      <div className="bs-card" style={{ padding: 0, overflow: "hidden", borderRadius: 16, border: "1px solid var(--line)" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="bs-table" style={{ width: "100%", margin: 0 }}>
            <thead>
              <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 800 }}>Date</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 800 }}>Motif / Titre</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 800 }}>Enregistré par</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, fontWeight: 800 }}>Montant</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 800, width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTableRows rows={6} cols={5} />
              ) : pagedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "48px 20px", color: "var(--muted)" }}>
                    <Receipt size={36} style={{ margin: "0 auto 10px", opacity: 0.3, display: "block" }} />
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>Aucune dépense trouvée</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      {search || filterEmployee !== "TOUS"
                        ? "Essayez d'ajuster ou d'effacer vos filtres de recherche."
                        : "Enregistrez votre première dépense pour suivre vos sorties de caisse."}
                    </div>
                  </td>
                </tr>
              ) : (
                pagedExpenses.map((exp) => {
                  const dateStr = exp.dateDepense
                    ? new Date(exp.dateDepense).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
                    : "-";
                  const isFCFA = exp.devise === "FCFA";

                  return (
                    <tr key={exp.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px 16px", fontSize: 12.5, whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 700, color: "var(--ink)" }}>{dateStr}</div>
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 13.5 }}>
                          {exp.titre}
                        </div>
                        {exp.notes && (
                          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, maxWidth: 350, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {exp.notes}
                          </div>
                        )}
                        {exp.justificatifUrl && (
                          <a
                            href={exp.justificatifUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--forest-dark)", fontWeight: 700, marginTop: 4, textDecoration: "none" }}
                          >
                            <ExternalLink size={11} /> Voir justificatif
                          </a>
                        )}
                      </td>

                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            background: exp.creePar?.role === "admin" ? "#FEF3C7" : "#E0F2FE",
                            color: exp.creePar?.role === "admin" ? "#92400E" : "#0369A1",
                            fontSize: 11,
                            fontWeight: 800,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}>
                            {(exp.creePar?.nom || "U")[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>
                              {exp.creePar?.nom || "Admin / Système"}
                            </div>
                            <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                              {exp.creePar?.role === "admin" ? "Admin" : "Employé"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 900, fontSize: 14.5, color: "#DC2626" }}>
                          - {fcfa(exp.montant, exp.devise || "KMF")}
                        </div>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "1px 6px",
                          borderRadius: 6,
                          background: isFCFA ? "#FEF3C7" : "#EFF6FF",
                          color: isFCFA ? "#B45309" : "#1D4ED8"
                        }}>
                          {exp.devise || "KMF"}
                        </span>
                      </td>

                      <td style={{ padding: "12px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          {canEdit && (
                            <button
                              type="button"
                              className="bs-icon-btn"
                              onClick={() => openEditModal(exp)}
                              title="Modifier cette dépense"
                              style={{ color: "var(--forest-dark)" }}
                            >
                              <Edit size={15} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              className="bs-icon-btn"
                              onClick={() => setDeleteConfirmId(exp.id)}
                              title="Supprimer cette dépense"
                              style={{ color: "#DC2626" }}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {expenses.length > pageSize && (
          <div style={{ padding: "12px 18px", borderTop: "1px solid var(--line)" }}>
            <TablePagination
              currentPage={currentPage}
              totalItems={expenses.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* MODAL CRÉATION / ÉDITION (SIMPLE ET ÉPURÉ : SANS CATÉGORIE, SANS BÉNÉFICIAIRE, SANS MODE DE PAIEMENT) */}
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
              maxWidth: 480,
              padding: "24px 26px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              maxHeight: "90vh",
              overflowY: "auto"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, color: "var(--forest-dark)" }}>
                  {modalType === "create" ? "Enregistrer une Dépense" : "Modifier la Dépense"}
                </h2>
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
                  Saisie rapide du motif et du montant de la sortie d'argent.
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
              {/* Titre / Motif */}
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  Titre / Motif de la dépense *
                </label>
                <input
                  type="text"
                  required
                  className="bs-input"
                  placeholder="Ex : taxi, électricité, transport stock..."
                  value={form.titre}
                  onChange={(e) => setForm({ ...form, titre: e.target.value })}
                  style={{ width: "100%", fontSize: 13.5 }}
                />
              </div>

              {/* Montant & Devise */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                    Montant déboursé *
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
                    disabled={Boolean(assignedCurrency)}
                    value={form.devise}
                    onChange={(e) => setForm({ ...form, devise: e.target.value })}
                    style={{ width: "100%", fontSize: 13 }}
                  >
                    <option value="KMF">KMF</option>
                    <option value="FCFA">FCFA</option>
                  </select>
                </div>
              </div>

              {/* Date de la dépense */}
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  Date de la dépense *
                </label>
                <input
                  type="date"
                  required
                  className="bs-input"
                  value={form.dateDepense}
                  onChange={(e) => setForm({ ...form, dateDepense: e.target.value })}
                  style={{ width: "100%", fontSize: 13 }}
                />
              </div>

              {/* Notes ou description complémentaire */}
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  Notes ou description complémentaire
                </label>
                <textarea
                  className="bs-input"
                  rows={2}
                  placeholder="Précisions sur cette dépense (optionnel)..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={{ width: "100%", fontSize: 13, resize: "vertical" }}
                />
              </div>

              {/* Lien ou photo justificatif */}
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  Lien ou photo justificatif (optionnel)
                </label>
                <input
                  type="url"
                  className="bs-input"
                  placeholder="https://... ou lien d'image"
                  value={form.justificatifUrl}
                  onChange={(e) => setForm({ ...form, justificatifUrl: e.target.value })}
                  style={{ width: "100%", fontSize: 13 }}
                />
              </div>

              {/* Boutons d'action */}
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
                  {saving ? "Enregistrement..." : modalType === "create" ? "Valider la dépense" : "Mettre à jour"}
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
              Supprimer cette dépense ?
            </h3>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "8px 0 20px" }}>
              Cette action est irréversible et retirera cette dépense des totaux.
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
