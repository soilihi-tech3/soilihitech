import { useNavigate } from "react-router-dom";
import { SkeletonTableRows } from "../../components/Skeleton.jsx";
import React, { useEffect, useState } from "react";
import { 
  Search, FileText, Download, Printer, Eye, Calendar, DollarSign, 
  CreditCard, Smartphone, CheckCircle, User, ShoppingBag, History, X, Building,
  Pencil, Trash2, AlertTriangle, MessageCircle, Clock, AlertCircle
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../api";
import TablePagination from "../../components/TablePagination.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";
import ReceiptModal from "../../components/ReceiptModal.jsx";
import { formatPrice, formatPrice as fcfa, getBoutiqueCurrencies } from "../../utils/currency.js";
import { getOfflineSales, saveCache, getCache } from "../../utils/offlineStorage.js";

const MONTHS = [
  { value: "01", label: "Janvier" },
  { value: "02", label: "Février" },
  { value: "03", label: "Mars" },
  { value: "04", label: "Avril" },
  { value: "05", label: "Mai" },
  { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" },
  { value: "08", label: "Août" },
  { value: "09", label: "Septembre" },
  { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Décembre" }
];

export default function SalesHistory() {
  const navigate = useNavigate();
  const { user, boutique, activeBoutiqueId } = useAuth();
  const storeName = boutique?.nom || "Marché Vert";
  const boutiqueCurrencies = getBoutiqueCurrencies(boutique);
  const isSingleCurrency = boutiqueCurrencies.length === 1;
  const primaryCurrencyCode = boutiqueCurrencies[0]?.code || boutique?.devise || "KMF";
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  function handleEditOrderCart(order) {
    try {
      sessionStorage.setItem("pos_edit_order", JSON.stringify(order));
    } catch (e) {}
    navigate("/admin/vente", { state: { editOrder: order, tab: "panier" } });
  }

  // Filter state
  const [search, setSearch] = useState("");
  const [filterPays, setFilterPays] = useState("tous"); // "tous" | "KM" | "SN"
  const [filterType, setFilterType] = useState("tous"); // "tous" | "vente_directe" | "commande_enligne"
  const [filterPaiement, setFilterPaiement] = useState("tous"); // "tous" | "cash" | "mvola" | "wero" | "carte"
  const [filterStatutPaiement, setFilterStatutPaiement] = useState("tous"); // "tous" | "dettes" | "paye" | "partiel" | "non_paye"
  const [filterEmploye, setFilterEmploye] = useState("tous");
  const [filterAnnee, setFilterAnnee] = useState(new Date().getFullYear().toString());
  const [filterMois, setFilterMois] = useState("");
  const [isTodayOnly, setIsTodayOnly] = useState(false);

  // Detail Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [whatsappModalData, setWhatsappModalData] = useState(null);
  const [reglerModalOrder, setReglerModalOrder] = useState(null);
  const [reglerMontant, setReglerMontant] = useState("");
  const [reglerMoyen, setReglerMoyen] = useState("cash");
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  async function loadData() {
    // 1. Lire d'abord les ventes hors-ligne et le cache local pour disponibilite immediate
    const offlineSales = await getOfflineSales();
    const cached = await getCache("admin_orders");
    if (cached && Array.isArray(cached)) {
      const combined = [...(offlineSales || []), ...cached];
      const unique = Array.from(new Map(combined.map(o => [o.id, o])).values());
      setOrders(unique);
      setLoading(false);
    } else if (offlineSales && offlineSales.length > 0) {
      setOrders(offlineSales);
      setLoading(false);
    } else {
      setLoading(true);
    }

    if (navigator.onLine) {
      api.get("/admin/orders")
        .then((res) => {
          const serverList = res.data || [];
          saveCache("admin_orders", serverList).catch(() => {});
          const combined = [...(offlineSales || []), ...serverList];
          const unique = Array.from(new Map(combined.map(o => [o.id, o])).values());
          setOrders(unique);
        })
        .catch(() => {})
        .finally(() => setLoading(false));

      api.get("/admin/employees")
        .then((res) => setEmployees(res.data || []))
        .catch(() => setEmployees([]));
    } else {
      setLoading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!orderToDelete) return;
    setSubmitting(true);
    try {
      await api.delete(`/admin/orders/${orderToDelete.id}`);
      toast.success("Vente supprimée avec succès. Le stock a été réajusté.");
      setOrderToDelete(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la suppression de la vente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmReglement() {
    if (!reglerModalOrder) return;
    const total = Number(reglerModalOrder.total || 0);
    const dejaPaye = Number(reglerModalOrder.montantPaye !== undefined && reglerModalOrder.montantPaye !== null ? reglerModalOrder.montantPaye : 0);
    const montantPercu = Number(reglerMontant) || 0;
    if (montantPercu <= 0) {
      toast.error("Veuillez saisir un montant valide à encaisser.");
      return;
    }
    const nouveauPaye = dejaPaye + montantPercu;
    const nouveauRestant = Math.max(0, total - nouveauPaye);
    const nouveauStatutPaiement = nouveauRestant <= 0 ? "paye" : "partiel";

    setSubmitting(true);
    try {
      await api.put(`/admin/orders/${reglerModalOrder.id}`, {
        montantPaye: nouveauPaye,
        montantRestant: nouveauRestant,
        statutPaiement: nouveauStatutPaiement,
        moyenPaiement: reglerMoyen
      });
      toast.success(nouveauRestant <= 0 ? "Paiement soldé avec succès !" : `Acompte enregistré. Reste à payer : ${fcfa(nouveauRestant, reglerModalOrder.devise)}`);
      setReglerModalOrder(null);
      setReglerMontant("");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement du paiement.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingOrder) return;
    setSubmitting(true);
    try {
      await api.put(`/admin/orders/${editingOrder.id}`, {
        moyenPaiement: editingOrder.moyenPaiement,
        statut: editingOrder.statut,
        statutPaiement: editingOrder.statutPaiement,
        montantPaye: editingOrder.montantPaye !== undefined && editingOrder.montantPaye !== "" ? Number(editingOrder.montantPaye) : null,
        montantRestant: editingOrder.montantRestant !== undefined && editingOrder.montantRestant !== "" ? Number(editingOrder.montantRestant) : null,
        dateEcheance: editingOrder.dateEcheance || null,
        clientNom: editingOrder.clientNom,
        clientTelephone: editingOrder.clientTelephone,
        notes: editingOrder.notes
      });
      toast.success("Vente mise à jour avec succès.");
      setEditingOrder(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la modification de la vente.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    loadData();
    const unsub = subscribeRealtime((detail) => {
      const t = detail?.type || detail;
      if (t === "order_created" || t === "order_updated" || t === "order_deleted") {
        loadData();
      }
    });

    const handleSynced = () => {
      loadData();
    };
    const onBoutiqueSwitch = () => {
      loadData();
    };
    window.addEventListener("offline_synced", handleSynced);
    window.addEventListener("boutique_switched", onBoutiqueSwitch);

    return () => {
      if (typeof unsub === "function") unsub();
      window.removeEventListener("offline_synced", handleSynced);
      window.removeEventListener("boutique_switched", onBoutiqueSwitch);
    };
  }, [activeBoutiqueId]);

  const normalizeSaleCurrency = (o) => {
    const raw = o.devise === "XOF" ? "FCFA" : String(o.devise || primaryCurrencyCode).toUpperCase();
    if (boutiqueCurrencies.some(c => c.code === raw)) return raw;
    return primaryCurrencyCode;
  };

  // Filter logic (Seules les ventes confirmées/effectuées comptent dans l'historique des ventes et le CA)
  const filteredOrders = orders.filter((o) => {
    if (["annulee", "en_attente", "en_attente_paiement"].includes(o.statut)) return false;

    // Type detection
    const isRecharge = o.typeVente === "recharge_mobile" || o.notes?.includes("recharge_mobile") || o.items?.some(it => it.product?.nom?.toLowerCase().includes("recharge"));
    const isPOS = !isRecharge && (o.typeVente === "vente_directe" || o.adresseLivraison?.includes("Achat direct") || o.modeLivraison === "retrait");
    
    let saleType = "commande_enligne";
    if (isRecharge) saleType = "recharge_mobile";
    else if (isPOS) saleType = "vente_directe";

    if (filterType !== "tous" && saleType !== filterType) return false;

    // Filter Pays / Devise
    const orderDevise = normalizeSaleCurrency(o);
    if (!isSingleCurrency && filterPays !== "tous") {
      const normalizedFilter = filterPays === "KM" ? "KMF" : filterPays === "SN" ? "FCFA" : filterPays;
      if (orderDevise !== normalizedFilter) return false;
    }

    // Paiement filter
    if (filterPaiement !== "tous") {
      const p = (o.moyenPaiement || "").toLowerCase();
      if (filterPaiement === "cash" && p !== "cash" && p !== "especes") return false;
      if (filterPaiement === "mvola" && p !== "mvola") return false;
      if (filterPaiement === "wave" && p !== "wave") return false;
      if (filterPaiement === "orange_money" && p !== "orange_money" && p !== "orange" && p !== "om") return false;
      if (filterPaiement === "wero" && p !== "wero" && p !== "holam") return false;
      if (filterPaiement === "carte" && p !== "carte") return false;
    }

    // Statut Paiement (Dettes / Impayés / Partiel / Payé)
    const restant = Number(o.montantRestant || 0);
    const paye = Number(o.montantPaye !== undefined && o.montantPaye !== null ? o.montantPaye : (restant === 0 ? Number(o.total || 0) : 0));
    const hasDebt = restant > 0 && o.statutPaiement !== "paye";
    const orderStatutPaiement = hasDebt ? (paye > 0 ? "partiel" : "non_paye") : "paye";

    if (filterStatutPaiement !== "tous") {
      if (filterStatutPaiement === "dettes") {
        if (!hasDebt) return false;
      } else if (orderStatutPaiement !== filterStatutPaiement) {
        return false;
      }
    }

    // Employe filter
    if (!isAdmin) {
      const isMySale = o.employeAssigneId === user?.id || o.employeAssigne?.id === user?.id;
      if (!isMySale) return false;
    } else if (filterEmploye !== "tous") {
      if (filterEmploye === "non_assigne") {
        if (o.employeAssigneId) return false;
      } else if (String(o.employeAssigneId) !== String(filterEmploye)) {
        return false;
      }
    }

    // Date filters
    const orderDate = new Date(o.createdAt);
    const orderYear = orderDate.getFullYear().toString();
    const orderMonth = String(orderDate.getMonth() + 1).padStart(2, "0");

    if (isTodayOnly) {
      const today = new Date();
      const isSameDay = orderDate.getDate() === today.getDate() &&
        orderDate.getMonth() === today.getMonth() &&
        orderDate.getFullYear() === today.getFullYear();
      if (!isSameDay) return false;
    } else {
      if (filterAnnee && orderYear !== filterAnnee) return false;
      if (filterMois && orderMonth !== filterMois) return false;
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchClient = o.client?.nom?.toLowerCase().includes(q) || o.client?.telephone?.includes(q);
      const matchId = `com-b${String(o.id).padStart(3, "0")}`.includes(q) || String(o.id).includes(q);
      const matchItems = o.items?.some(it => it.product?.nom?.toLowerCase().includes(q));
      if (!matchClient && !matchId && !matchItems) return false;
    }

    return true;
  });

  // Calculate totals for KPI cards dynamically per configured currency
  const totalVentesCount = filteredOrders.length;
  const salesTotalsByCurrency = {};
  const cashTotalsByCurrency = {};
  boutiqueCurrencies.forEach((cur) => {
    const code = cur.code;
    salesTotalsByCurrency[code] = filteredOrders
      .filter(o => normalizeSaleCurrency(o) === code)
      .reduce((sum, o) => sum + Number(o.total || 0), 0);
    cashTotalsByCurrency[code] = filteredOrders
      .filter(o => normalizeSaleCurrency(o) === code && (o.moyenPaiement === "cash" || o.moyenPaiement === "especes"))
      .reduce((sum, o) => sum + Number(o.total || 0), 0);
  });

  // Reset page
  useEffect(() => { setCurrentPage(1); }, [search, filterPays, filterType, filterPaiement, filterStatutPaiement, filterEmploye, filterAnnee, filterMois, isTodayOnly]);

  const totalItems = filteredOrders.length;
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Export CSV
  function handleExportExcel() {
    const headers = ["ID Vente", "Date", "Client", "Téléphone", "Type", "Employé", "Mode Paiement", "Total (€)"];
    const rows = filteredOrders.map(o => {
      const isRecharge = o.typeVente === "recharge_mobile" || o.notes?.includes("recharge_mobile") || o.items?.some(it => it.product?.nom?.toLowerCase().includes("recharge"));
      const isPOS = !isRecharge && (o.typeVente === "vente_directe" || o.adresseLivraison?.includes("Achat direct"));
      const dateStr = new Date(o.createdAt).toLocaleString("fr-FR");
      const typeStr = isRecharge ? "Recharge Crédit Mobile" : isPOS ? "Vente Directe (POS)" : "Commande en Ligne";
      const empStr = o.employeAssigne?.nom || "Admin / Système";
      const payStr = (o.moyenPaiement === "cash" || o.moyenPaiement === "especes") ? "Cash / Espèces"
        : o.moyenPaiement === "mvola" ? "MVola"
        : (o.moyenPaiement === "wero" || o.moyenPaiement === "holam") ? "Wero"
        : "Carte Bancaire";
      return [
        `#COM-B${String(o.id).padStart(3, "0")}`,
        `"${dateStr}"`,
        `"${o.client?.nom || "Client comptoir"}"`,
        `"${o.client?.telephone || "-"}"`,
        `"${typeStr}"`,
        `"${empStr}"`,
        `"${payStr}"`,
        Number(o.total || 0).toFixed(2)
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `historique_ventes_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleExportPDF() {
    window.print();
  }

  return (
    <>
      {/* HEADER PAGE */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Historique des Ventes</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Consultez, filtrez et analysez toutes les ventes directes, recharges mobile et commandes en ligne.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleExportPDF}
            className="bs-btn-primary"
            style={{ background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1", fontSize: 13, padding: "8px 16px", boxShadow: "none" }}
          >
            <Printer size={15} style={{ marginRight: 6 }} /> Imprimer / PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="bs-btn-primary"
            style={{ background: "var(--forest-light)", color: "var(--forest-dark)", fontSize: 13, padding: "8px 16px", boxShadow: "none" }}
          >
            <Download size={15} style={{ marginRight: 6 }} /> Export Excel
          </button>
        </div>
      </div>

      {/* FILTER BAR ROW */}
      <div className="bs-panel" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* SEARCH INPUT */}
          <div style={{ position: "relative", flex: 2, minWidth: 220 }}>
            <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              className="bs-input"
              placeholder="Rechercher par client, produit, N° vente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 38, height: 40, fontSize: 13.5 }}
            />
          </div>

          {/* FILTER: DEVISE (AFFICHÉ UNIQUEMENT SI 2+ DEVISES) */}
          {!isSingleCurrency && (
            <select
              className="bs-select"
              style={{ flex: 1, minWidth: 160, height: 40, fontWeight: 700 }}
              value={filterPays}
              onChange={(e) => setFilterPays(e.target.value)}
            >
              <option value="tous">Toutes les devises</option>
              {boutiqueCurrencies.map(cur => (
                <option key={cur.code} value={cur.code}>{cur.label}</option>
              ))}
            </select>
          )}

          {/* FILTER: TYPE VENTE */}
          <select
            className="bs-select"
            style={{ flex: 1, minWidth: 160, height: 40 }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="tous">Tout type de vente</option>
            <option value="vente_directe">Vente Directe (POS)</option>
            <option value="commande_enligne">Commande en Ligne</option>
            <option value="recharge_mobile">Recharge Crédit Mobile</option>
          </select>

          {/* FILTER: PAIEMENT */}
          <select
            className="bs-select"
            style={{ flex: 1, minWidth: 150, height: 40 }}
            value={filterPaiement}
            onChange={(e) => setFilterPaiement(e.target.value)}
          >
            <option value="tous">Tous les modes</option>
            <option value="cash">Espèces / Cash</option>
            <option value="mvola">MVola</option>
            <option value="wave">Wave</option>
            <option value="orange_money">Orange Money</option>
            <option value="wero">Wero / Holam</option>
            <option value="carte">Carte Bancaire</option>
          </select>

          {/* FILTER: STATUT PAIEMENT (DETTES & PARTIEL) */}
          <select
            className="bs-select"
            style={{
              flex: 1, minWidth: 165, height: 40,
              fontWeight: filterStatutPaiement === "dettes" ? 800 : 500,
              borderColor: filterStatutPaiement === "dettes" ? "#DC2626" : undefined,
              color: filterStatutPaiement === "dettes" ? "#991B1B" : undefined,
              background: filterStatutPaiement === "dettes" ? "#FEF2F2" : undefined
            }}
            value={filterStatutPaiement}
            onChange={(e) => setFilterStatutPaiement(e.target.value)}
          >
            <option value="tous">Tous les règlements</option>
            <option value="dettes">Dettes (Non payé & Partiel)</option>
            <option value="paye">Payé intégralement</option>
            <option value="partiel">Partiel (Acompte restant)</option>
            <option value="non_paye">Non payé (Dette totale)</option>
          </select>

          {/* FILTER: EMPLOYÉ */}
          {isAdmin ? (
            <select
              className="bs-select"
              style={{ flex: 1, minWidth: 160, height: 40 }}
              value={filterEmploye}
              onChange={(e) => setFilterEmploye(e.target.value)}
            >
              <option value="tous">Tous les employés</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nom} ({emp.role === "admin" ? "Admin" : "Employé"})</option>
              ))}
              <option value="non_assigne">Admin / Système</option>
            </select>
          ) : (
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "0 14px",
              height: 40,
              background: "#EFF6FF",
              border: "1px solid #BFDBFE",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              color: "#1D4ED8",
              whiteSpace: "nowrap"
            }}>
              <User size={15} />
              <span>Mes ventes ({user?.nom || "Employé"})</span>
            </div>
          )}

          {/* FILTER: ANNÉE */}
          <select
            className="bs-select"
            style={{ width: 130, height: 40 }}
            value={filterAnnee}
            onChange={(e) => { setFilterAnnee(e.target.value); setIsTodayOnly(false); }}
          >
            <option value="">Toutes années</option>
            <option value={new Date().getFullYear().toString()}>{new Date().getFullYear()}</option>
          </select>

          {/* FILTER: MOIS */}
          <select
            className="bs-select"
            style={{ width: 130, height: 40 }}
            value={filterMois}
            onChange={(e) => { setFilterMois(e.target.value); setIsTodayOnly(false); }}
          >
            <option value="">Tous les mois</option>
            {MONTHS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          {/* QUICK TODAY BUTTON */}
          <button
            onClick={() => setIsTodayOnly(!isTodayOnly)}
            style={{
              height: 40, padding: "0 16px", borderRadius: 8, border: "1px solid var(--line)",
              background: isTodayOnly ? "var(--forest)" : "var(--paper)",
              color: isTodayOnly ? "#fff" : "var(--forest-dark)",
              fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6
            }}
          >
            <Calendar size={15} /> Aujourd'hui
          </button>
        </div>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginBottom: 20 }}>
        {/* NOMBRE TOTAL DE VENTES */}
        <div className="bs-panel" style={{ padding: 16, background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--forest)", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase" }}>
            <ShoppingBag size={15} /> NOMBRE TOTAL DE VENTES
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--forest-dark)", marginTop: 6 }}>
            {totalVentesCount} <span style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)" }}>vente{totalVentesCount > 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* VENTES PAR DEVISE CONFIGURÉE */}
        {boutiqueCurrencies.map((cur) => (
          <div
            key={cur.code}
            className="bs-panel"
            style={{ padding: 16, background: cur.bg || "#EBF7F0", border: `1.5px solid ${cur.border || "#A7F3D0"}`, borderRadius: 14 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: cur.color || "#166534", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase" }}>
              <span style={{ background: cur.color || "var(--forest)", color: "#fff", padding: "1px 6px", borderRadius: 6, fontSize: 10, fontWeight: 900 }}>
                {cur.badge || cur.code}
              </span>
              VENTES {cur.shortLabel || cur.code}
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: cur.color || "var(--forest-dark)", marginTop: 6 }}>
              {formatPrice(salesTotalsByCurrency[cur.code] || 0, cur.code)}
            </div>
          </div>
        ))}

        {/* TOTAL CASH PAR DEVISE */}
        <div className="bs-panel" style={{ padding: 16, background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#166534", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase" }}>
            <DollarSign size={15} /> TOTAL CASH ENCAISSÉ
          </div>
          {isSingleCurrency ? (
            <div style={{ fontSize: 24, fontWeight: 900, color: "#15803D", marginTop: 6 }}>
              {formatPrice(cashTotalsByCurrency[primaryCurrencyCode] || 0, primaryCurrencyCode)}
            </div>
          ) : filterPays !== "tous" && cashTotalsByCurrency[filterPays] !== undefined ? (
            <div style={{ fontSize: 24, fontWeight: 900, color: "#15803D", marginTop: 6 }}>
              {formatPrice(cashTotalsByCurrency[filterPays] || 0, filterPays)}
            </div>
          ) : (
            <div style={{ fontSize: 18, fontWeight: 900, color: "#15803D", marginTop: 6 }}>
              {boutiqueCurrencies.map((cur, idx) => (
                <React.Fragment key={cur.code}>
                  {idx > 0 && <span style={{ color: "var(--muted)", fontWeight: 600 }}> / </span>}
                  {formatPrice(cashTotalsByCurrency[cur.code] || 0, cur.code)}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SALES HISTORY DATA TABLE */}
      <div className="bs-panel" style={{ padding: 0 }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
          <table className="bs-table" style={{ minWidth: 1000 }}>
          <thead>
            <tr>
              <th>DATE</th>
              <th>CLIENT</th>
              <th>PRODUIT(S)</th>
              <th>TYPE</th>
              <th>EMPLOYÉ</th>
              <th>STATUT PAIEMENT</th>
              <th>ÉCHÉANCE</th>
              <th>PAIEMENT</th>
              <th>MONTANT</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <SkeletonTableRows rows={6} cols={10} />
            )}
            {!loading && paginatedOrders.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                  Aucune vente enregistrée pour les filtres sélectionnés.
                </td>
              </tr>
            )}
            {!loading && paginatedOrders.map((o) => {
              const isRecharge = o.typeVente === "recharge_mobile" || o.notes?.includes("recharge_mobile") || o.items?.some(it => it.product?.nom?.toLowerCase().includes("recharge"));
              const isPOS = !isRecharge && (o.typeVente === "vente_directe" || o.adresseLivraison?.includes("Achat direct") || o.modeLivraison === "retrait");
              const dateFormatted = new Date(o.createdAt).toLocaleDateString("fr-FR", {
                day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
              });

              // Format items: Max 2 displayed cleanly without bullet point, then "+ X autres"
              const itemsList = o.items || [];
              const displayItems = itemsList.slice(0, 2);
              const extraCount = itemsList.length - 2;

              const isCash = o.moyenPaiement === "cash" || o.moyenPaiement === "especes";
              const isMvola = o.moyenPaiement === "mvola";
              const isWave = o.moyenPaiement === "wave";
              const isOrange = o.moyenPaiement === "orange_money" || o.moyenPaiement === "orange" || o.moyenPaiement === "om";
              const isWero = o.moyenPaiement === "wero" || o.moyenPaiement === "holam";

              const totalNum = Number(o.total || 0);
              const restant = Number(o.montantRestant !== undefined && o.montantRestant !== null ? o.montantRestant : 0);
              const paye = Number(o.montantPaye !== undefined && o.montantPaye !== null ? o.montantPaye : (restant === 0 ? totalNum : 0));
              const hasDebt = restant > 0 && o.statutPaiement !== "paye";
              const orderStatutP = hasDebt ? (paye > 0 ? "partiel" : "non_paye") : "paye";

              return (
                <tr key={o.id}>
                  <td style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                    <div style={{ fontWeight: 700, color: "var(--ink)" }}>{dateFormatted}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>#COM-B{String(o.id).padStart(3, "0")}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: "var(--ink)" }}>{o.client?.nom || "Client comptoir"}</div>
                    {o.client?.telephone && o.client.telephone !== "non_renseigne" && (
                      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Tél: {o.client.telephone}</div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12.5 }}>
                      {displayItems.map((it, i) => (
                        <div key={i} style={{ color: "var(--ink)", fontWeight: 500 }}>
                          <span style={{ fontWeight: 700 }}>{it.product?.nom || "Produit"}</span>
                          <span style={{ color: "var(--muted)", marginLeft: 4, fontSize: 11.5 }}>x{it.quantite}</span>
                        </div>
                      ))}
                      {extraCount > 0 && (
                        <div style={{ fontSize: 11.5, color: "var(--forest-dark)", fontWeight: 700, marginTop: 2 }}>
                          + {extraCount} autre{extraCount > 1 ? "s" : ""}...
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    {isRecharge ? (
                      <span style={{ background: "#E0F2FE", color: "#0284C7", padding: "4px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>
                        Recharge Mobile
                      </span>
                    ) : isPOS ? (
                      <span style={{ background: "#DCFCE7", color: "#166534", padding: "4px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>
                        Vente Directe (POS)
                      </span>
                    ) : (
                      <span style={{ background: "#DBEAFE", color: "#1E40AF", padding: "4px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>
                        Commande en ligne
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    <span style={{ fontWeight: 600, color: "var(--forest-dark)" }}>
                      {o.employeAssigne?.nom || "Admin / Système"}
                    </span>
                  </td>
                  <td>
                    {orderStatutP === "paye" ? (
                      <span style={{
                        padding: "4px 10px", borderRadius: 12, fontSize: 11.5, fontWeight: 800,
                        background: "#DCFCE7", color: "#166534", border: "1px solid #86EFAC",
                        display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap"
                      }}>
                        <CheckCircle size={12} /> Payé
                      </span>
                    ) : orderStatutP === "partiel" ? (
                      <div style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: 10, fontSize: 11, fontWeight: 800,
                          background: "#FEF3C7", color: "#B45309", border: "1px solid #FDE68A",
                          display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap"
                        }}>
                          <Clock size={11} /> Partiel
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", whiteSpace: "nowrap" }}>
                          Reste: {fcfa(restant, o.devise || "KMF")}
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: 10, fontSize: 11, fontWeight: 800,
                          background: "#FEE2E2", color: "#B91C1C", border: "1px solid #FECACA",
                          display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap"
                        }}>
                          <AlertCircle size={11} /> Non payé
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", whiteSpace: "nowrap" }}>
                          Dû: {fcfa(restant || o.total, o.devise || "KMF")}
                        </span>
                      </div>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {o.dateEcheance ? (
                      (() => {
                        const echDate = new Date(o.dateEcheance);
                        const isOverdue = hasDebt && echDate < new Date().setHours(0,0,0,0);
                        return (
                          <div style={{ display: "inline-flex", flexDirection: "column" }}>
                            <span style={{
                              fontSize: 12, fontWeight: 700,
                              color: isOverdue ? "#DC2626" : "var(--ink)",
                              display: "inline-flex", alignItems: "center", gap: 4
                            }}>
                              <Calendar size={12} color={isOverdue ? "#DC2626" : "var(--muted)"} />
                              {echDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                            {isOverdue && (
                              <span style={{ fontSize: 10, fontWeight: 800, color: "#DC2626", display: "inline-flex", alignItems: "center", gap: 3 }}>
                                <AlertTriangle size={10} /> En retard
                              </span>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 13 }}>—</span>
                    )}
                  </td>
                  <td>
                    <span style={{
                      padding: "4px 10px", borderRadius: 12, fontSize: 11.5, fontWeight: 800,
                      background: isCash ? "#FEF3C7" : isMvola ? "#DCFCE7" : isWave ? "#E0F2FE" : isOrange ? "#FFEDD5" : isWero ? "#FEF9C3" : "#F3E8FF",
                      color: isCash ? "#92400E" : isMvola ? "#15803D" : isWave ? "#0284C7" : isOrange ? "#C2410C" : isWero ? "#854D0E" : "#6B21A8"
                    }}>
                      {isCash ? "Cash / Espèces" : isMvola ? "MVola" : isWave ? "Wave" : isOrange ? "Orange Money" : isWero ? "Wero" : "Carte"}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--forest-dark)" }}>
                      {fcfa(o.total, o.devise || "KMF")}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: hasDebt ? "#B45309" : "#166534", marginTop: 2 }}>
                      Reçu : {fcfa(paye, o.devise || "KMF")}
                    </div>
                    {hasDebt && (
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#DC2626" }}>
                        Reste dû : {fcfa(restant, o.devise || "KMF")}
                      </div>
                    )}
                    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6, background: (o.devise === "FCFA" ? "#FEF3C7" : "#EFF6FF"), color: (o.devise === "FCFA" ? "#B45309" : "#1D4ED8"), display: "inline-block", marginTop: 3 }}>
                      {o.devise === "FCFA" ? "Sénégal" : "Comores"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        className="bs-icon-btn"
                        title="Voir le reçu / ticket de caisse"
                        onClick={() => setSelectedOrder(o)}
                      >
                        <Eye size={16} />
                      </button>
                      {hasDebt && (
                        <>
                          <button
                            className="bs-icon-btn"
                            title="Régler / Encaisser le solde restant"
                            style={{ color: "#166534", background: "#DCFCE7", border: "1px solid #86EFAC" }}
                            onClick={() => {
                              setReglerModalOrder(o);
                              setReglerMontant(String(restant));
                              setReglerMoyen(o.moyenPaiement || "cash");
                            }}
                          >
                            <CreditCard size={15} />
                          </button>
                          <button
                            className="bs-icon-btn"
                            title="Envoyer un rappel de paiement par WhatsApp"
                            style={{ color: "#16A34A", background: "#DCFCE7" }}
                            onClick={() => {
                              const clientNom = o.client?.nom || "Client";
                              const restantStr = fcfa(restant, o.devise || "KMF");
                              const echeanceStr = o.dateEcheance ? new Date(o.dateEcheance).toLocaleDateString("fr-FR") : "convenue";
                              const defaultMsg = `Bonjour ${clientNom},\n\nNous vous contactons de la part de ${storeName}. Il reste un solde de ${restantStr} à régler pour votre achat (#COM-B${String(o.id).padStart(3, "0")}), avec une date d'échéance au ${echeanceStr}.\n\nMerci de bien vouloir passer en boutique ou nous contacter pour finaliser votre règlement. Cordialement.`;
                              setWhatsappModalData({
                                order: o,
                                phone: o.client?.telephone || "",
                                message: defaultMsg
                              });
                            }}
                          >
                            <MessageCircle size={15} />
                          </button>
                        </>
                      )}
                      {isAdmin && (
                        <>
                          <button
                            className="bs-icon-btn"
                            title="Modifier le panier de cette vente"
                            onClick={() => handleEditOrderCart(o)}
                            style={{ color: "var(--forest-dark)" }}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="bs-icon-btn"
                            title="Supprimer cette vente (Admin)"
                            onClick={() => setOrderToDelete(o)}
                            style={{ color: "#B4483A" }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        {/* PAGINATION */}
        <TablePagination
          totalItems={totalItems}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* MODAL REÇU / TICKET DE CAISSE AUTHENTIQUE */}
      {selectedOrder && (
        <ReceiptModal
          order={selectedOrder}
          boutique={boutique}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {/* MODAL MODIFIER UNE VENTE (ADMIN ONLY) */}
      {editingOrder && (
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
                Modifier la vente #COM-B{String(editingOrder.id).padStart(3, "0")}
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted)" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 5 }}>
                  Nom du client :
                </label>
                <input
                  type="text"
                  className="bs-input"
                  value={editingOrder.clientNom}
                  onChange={(e) => setEditingOrder({ ...editingOrder, clientNom: e.target.value })}
                  placeholder="ex: Client comptoir, Amine..."
                  style={{ width: "100%", height: 38, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 5 }}>
                  Téléphone du client :
                </label>
                <input
                  type="tel"
                  className="bs-input"
                  value={editingOrder.clientTelephone || ""}
                  onChange={(e) => setEditingOrder({ ...editingOrder, clientTelephone: e.target.value.replace(/[^0-9+ ]/g, "") })}
                  onKeyDown={(e) => {
                    if (!/[0-9+ ]/.test(e.key) && !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                      e.preventDefault();
                    }
                  }}
                  placeholder="ex: 2693222445 ou 221..."
                  style={{ width: "100%", height: 38, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 5 }}>
                  Moyen de paiement :
                </label>
                <select
                  className="bs-select"
                  value={editingOrder.moyenPaiement}
                  onChange={(e) => setEditingOrder({ ...editingOrder, moyenPaiement: e.target.value })}
                  style={{ width: "100%", height: 38, fontSize: 13 }}
                >
                  <option value="cash">Espèces / Cash</option>
                  <option value="mvola">MVola</option>
                  <option value="wave">Wave</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="wero">Wero / Holam</option>
                  <option value="carte">Carte Bancaire</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 5 }}>
                  Statut du règlement / Paiement :
                </label>
                <select
                  className="bs-select"
                  value={editingOrder.statutPaiement || (Number(editingOrder.montantRestant || 0) > 0 ? "partiel" : "paye")}
                  onChange={(e) => setEditingOrder({ ...editingOrder, statutPaiement: e.target.value })}
                  style={{ width: "100%", height: 38, fontSize: 13 }}
                >
                  <option value="paye">Payé intégralement</option>
                  <option value="partiel">Paiement partiel (Acompte)</option>
                  <option value="non_paye">Non payé (Dette totale)</option>
                </select>
              </div>

              {(editingOrder.statutPaiement === "partiel" || editingOrder.statutPaiement === "non_paye" || Number(editingOrder.montantRestant || 0) > 0) && (
                <div style={{ background: "#FEF2F2", padding: 12, borderRadius: 10, border: "1px solid #FECACA", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#991B1B", marginBottom: 4 }}>
                      Reste à payer (Dette) :
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="bs-input"
                      value={editingOrder.montantRestant ?? ""}
                      onChange={(e) => setEditingOrder({ ...editingOrder, montantRestant: e.target.value })}
                      placeholder="Montant restant à régler"
                      style={{ width: "100%", height: 36, fontSize: 13, borderColor: "#F87171" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#991B1B", marginBottom: 4 }}>
                      Date d'échéance :
                    </label>
                    <input
                      type="date"
                      className="bs-input"
                      value={editingOrder.dateEcheance ? editingOrder.dateEcheance.substring(0, 10) : ""}
                      onChange={(e) => setEditingOrder({ ...editingOrder, dateEcheance: e.target.value })}
                      style={{ width: "100%", height: 36, fontSize: 13, borderColor: "#F87171" }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 5 }}>
                  Statut de la commande :
                </label>
                <select
                  className="bs-select"
                  value={editingOrder.statut}
                  onChange={(e) => setEditingOrder({ ...editingOrder, statut: e.target.value })}
                  style={{ width: "100%", height: 38, fontSize: 13 }}
                >
                  <option value="recuperee">Récupérée en boutique (POS / Direct)</option>
                  <option value="livree">Livrée</option>
                  <option value="en_livraison">En cours de livraison</option>
                  <option value="en_attente">En attente de paiement</option>
                  <option value="annulee">Annulée</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 5 }}>
                  Notes / Observations :
                </label>
                <input
                  type="text"
                  className="bs-input"
                  value={editingOrder.notes}
                  onChange={(e) => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                  placeholder="Notes facultatives..."
                  style={{ width: "100%", height: 38, fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
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

      {/* MODAL SUPPRESSION D'UNE VENTE (ADMIN ONLY) */}
      {orderToDelete && (
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
                  Supprimer la vente #COM-B{String(orderToDelete.id).padStart(3, "0")} ?
                </div>
                <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  Action irréversible (Réservée aux Administrateurs)
                </div>
              </div>
            </div>

            <p style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5, margin: "0 0 20px" }}>
              Êtes-vous sûr de vouloir supprimer définitivement cette vente ? Les articles vendus seront <strong>automatiquement réintégrés en stock</strong>.
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="bs-btn-secondary"
                disabled={submitting}
                style={{ padding: "9px 16px", fontSize: 13 }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
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
      {/* MODAL RELANCE WHATSAPP DETTE CLIENT */}
      {whatsappModalData && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 10000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, width: "100%", maxWidth: 500,
            boxShadow: "0 20px 50px rgba(0,0,0,0.25)", overflow: "hidden"
          }}>
            <div style={{
              padding: "16px 20px", borderBottom: "1px solid var(--line)", background: "#F0FDF4",
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ background: "#22C55E", color: "#fff", padding: 6, borderRadius: 8, display: "flex" }}>
                  <MessageCircle size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#166534" }}>
                    Rappel de paiement WhatsApp
                  </div>
                  <div style={{ fontSize: 12, color: "#15803D" }}>
                    Vente #COM-B{String(whatsappModalData.order?.id).padStart(3, "0")} · Reste dû : {fcfa(whatsappModalData.order?.montantRestant || whatsappModalData.order?.total, whatsappModalData.order?.devise || "KMF")}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWhatsappModalData(null)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted)" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 5 }}>
                  Numéro de téléphone WhatsApp du client :
                </label>
                <input
                  type="tel"
                  className="bs-input"
                  value={whatsappModalData.phone}
                  onChange={(e) => setWhatsappModalData({ ...whatsappModalData, phone: e.target.value.replace(/[^0-9+ ]/g, "") })}
                  onKeyDown={(e) => {
                    if (!/[0-9+ ]/.test(e.key) && !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                      e.preventDefault();
                    }
                  }}
                  placeholder="ex: 2693222445 ou 221..."
                  style={{ width: "100%", height: 38, fontSize: 13, fontWeight: 700 }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>
                    Message de relance (Personnalisable) :
                  </label>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>Vous pouvez modifier le texte avant d'envoyer</span>
                </div>
                <textarea
                  className="bs-input"
                  rows={6}
                  value={whatsappModalData.message}
                  onChange={(e) => setWhatsappModalData({ ...whatsappModalData, message: e.target.value })}
                  style={{ width: "100%", padding: 10, fontSize: 13, lineHeight: "1.5", resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setWhatsappModalData(null)}
                  className="bs-btn-secondary"
                  style={{ padding: "8px 16px", fontSize: 13 }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const clean = whatsappModalData.phone.replace(/[^0-9]/g, "");
                    if (!clean) {
                      toast.error("Veuillez renseigner un numéro de téléphone valide.");
                      return;
                    }
                    const url = `https://wa.me/${clean}?text=${encodeURIComponent(whatsappModalData.message)}`;
                    window.open(url, "_blank");
                    setWhatsappModalData(null);
                    toast.success("Redirection vers WhatsApp...");
                  }}
                  style={{
                    background: "#22C55E", color: "#fff", border: "none", borderRadius: 8,
                    padding: "8px 18px", fontSize: 13, fontWeight: 800, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6
                  }}
                >
                  <MessageCircle size={16} /> Envoyer via WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGLER / ENCAISSER LE PAIEMENT D'UNE DETTE */}
      {reglerModalOrder && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 10001,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, width: "100%", maxWidth: 460,
            boxShadow: "0 20px 50px rgba(0,0,0,0.25)", overflow: "hidden"
          }}>
            <div style={{
              padding: "16px 20px", borderBottom: "1px solid var(--line)", background: "#F0FDF4",
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ background: "#16A34A", color: "#fff", padding: 6, borderRadius: 8, display: "flex" }}>
                  <CreditCard size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#166534" }}>
                    Régler le paiement de la vente
                  </div>
                  <div style={{ fontSize: 12, color: "#15803D" }}>
                    #COM-B{String(reglerModalOrder.id).padStart(3, "0")} · Client : {reglerModalOrder.client?.nom || "Client comptoir"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReglerModalOrder(null)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted)" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10, border: "1px solid #E2E8F0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Total Vente</span>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "var(--ink)" }}>{fcfa(reglerModalOrder.total, reglerModalOrder.devise)}</div>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "#DC2626", textTransform: "uppercase", fontWeight: 700 }}>Reste dû actuel</span>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#DC2626" }}>{fcfa(reglerModalOrder.montantRestant || reglerModalOrder.total, reglerModalOrder.devise)}</div>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>
                    Montant perçu maintenant ({reglerModalOrder.devise || "KMF"}) :
                  </label>
                  <button
                    type="button"
                    onClick={() => setReglerMontant(String(Number(reglerModalOrder.montantRestant || reglerModalOrder.total)))}
                    style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: "#DCFCE7", color: "#166534", border: "1px solid #86EFAC", cursor: "pointer" }}
                  >
                    Tout solder
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  max={Number(reglerModalOrder.montantRestant || reglerModalOrder.total)}
                  className="bs-input"
                  value={reglerMontant}
                  onChange={(e) => setReglerMontant(e.target.value)}
                  placeholder="0"
                  style={{ width: "100%", height: 42, fontSize: 16, fontWeight: 800 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                  Moyen de paiement utilisé :
                </label>
                <select
                  className="bs-select"
                  value={reglerMoyen}
                  onChange={(e) => setReglerMoyen(e.target.value)}
                  style={{ width: "100%", height: 40, fontSize: 13 }}
                >
                  <option value="cash">Espèces / Cash</option>
                  <option value="wave">Wave</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="mvola">MVola</option>
                  <option value="wero">Wero / Holam</option>
                  <option value="carte">Carte Bancaire</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setReglerModalOrder(null)}
                  className="bs-btn-secondary"
                  disabled={submitting}
                  style={{ padding: "9px 16px", fontSize: 13 }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReglement}
                  disabled={submitting || Number(reglerMontant) <= 0}
                  className="bs-btn-primary"
                  style={{ padding: "9px 20px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                >
                  <CheckCircle size={16} /> {submitting ? "Enregistrement..." : "Valider l'encaissement"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
