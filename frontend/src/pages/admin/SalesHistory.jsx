import { SkeletonTableRows } from "../../components/Skeleton.jsx";
import React, { useEffect, useState } from "react";
import { 
  Search, FileText, Download, Printer, Eye, Calendar, DollarSign, 
  CreditCard, Smartphone, CheckCircle, User, ShoppingBag, History, X, Building,
  Pencil, Trash2, AlertTriangle
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../api";
import TablePagination from "../../components/TablePagination.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";
import ReceiptModal from "../../components/ReceiptModal.jsx";

import { formatPrice, formatPrice as fcfa } from "../../utils/currency.js";

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
  const { user, boutique } = useAuth();
  const storeName = boutique?.nom || "Marché Vert";
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState("");
  const [filterPays, setFilterPays] = useState("tous"); // "tous" | "KM" | "SN"
  const [filterType, setFilterType] = useState("tous"); // "tous" | "vente_directe" | "commande_enligne"
  const [filterPaiement, setFilterPaiement] = useState("tous"); // "tous" | "cash" | "mvola" | "wero" | "carte"
  const [filterEmploye, setFilterEmploye] = useState("tous");
  const [filterAnnee, setFilterAnnee] = useState(new Date().getFullYear().toString());
  const [filterMois, setFilterMois] = useState("");
  const [isTodayOnly, setIsTodayOnly] = useState(false);

  // Detail Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  function loadData() {
    setLoading(true);
    api.get("/admin/orders")
      .then((res) => setOrders(res.data || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));

    api.get("/admin/employees")
      .then((res) => setEmployees(res.data || []))
      .catch(() => setEmployees([]));
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

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingOrder) return;
    setSubmitting(true);
    try {
      await api.put(`/admin/orders/${editingOrder.id}`, {
        moyenPaiement: editingOrder.moyenPaiement,
        statut: editingOrder.statut,
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
      if (detail.type === "order_created" || detail.type === "order_updated") {
        loadData();
      }
    });
    return unsub;
  }, []);

  // Filter logic
  const filteredOrders = orders.filter((o) => {
    // Type detection
    const isRecharge = o.typeVente === "recharge_mobile" || o.notes?.includes("recharge_mobile") || o.items?.some(it => it.product?.nom?.toLowerCase().includes("recharge"));
    const isPOS = !isRecharge && (o.typeVente === "vente_directe" || o.adresseLivraison?.includes("Achat direct") || o.modeLivraison === "retrait");
    
    let saleType = "commande_enligne";
    if (isRecharge) saleType = "recharge_mobile";
    else if (isPOS) saleType = "vente_directe";

    if (filterType !== "tous" && saleType !== filterType) return false;

    // Filter Pays / Devise
    const orderDevise = o.devise || "KMF";
    if (filterPays === "KM" && orderDevise === "FCFA") return false;
    if (filterPays === "SN" && orderDevise !== "FCFA") return false;

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

  // Calculate totals for KPI cards
  const totalVentesCount = filteredOrders.length;

  const totalCash = filteredOrders
    .filter(o => o.moyenPaiement === "cash" || o.moyenPaiement === "especes")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  const totalComores = filteredOrders
    .filter(o => !o.devise || o.devise === "KMF")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  const totalSenegal = filteredOrders
    .filter(o => o.devise === "FCFA")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  // Reset page
  useEffect(() => { setCurrentPage(1); }, [search, filterPays, filterType, filterPaiement, filterEmploye, filterAnnee, filterMois, isTodayOnly]);

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

          {/* FILTER: PAYS (COMORES VS SÉNÉGAL) */}
          <select
            className="bs-select"
            style={{ flex: 1, minWidth: 160, height: 40, fontWeight: 700 }}
            value={filterPays}
            onChange={(e) => setFilterPays(e.target.value)}
          >
            <option value="tous">🌍 Tous les pays</option>
            <option value="KM">🇰🇲 Comores (KMF)</option>
            <option value="SN">🇸🇳 Sénégal (FCFA)</option>
          </select>

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
            <option value="tous">Tous les paiements</option>
            <option value="cash">Espèces / Cash</option>
            <option value="mvola">MVola</option>
            <option value="wave">Wave</option>
            <option value="orange_money">Orange Money</option>
            <option value="wero">Wero / Holam</option>
            <option value="carte">Carte Bancaire</option>
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

        {/* VENTES COMORES */}
        <div className="bs-panel" style={{ padding: 16, background: "#EBF7F0", border: "1.5px solid #A7F3D0", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#166534", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase" }}>
            <span style={{ background: "var(--forest)", color: "#fff", padding: "1px 6px", borderRadius: 6, fontSize: 10, fontWeight: 900 }}>KM</span> VENTES COMORES
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--forest-dark)", marginTop: 6 }}>
            {formatPrice(totalComores, "KMF")}
          </div>
        </div>

        {/* VENTES SÉNÉGAL */}
        <div className="bs-panel" style={{ padding: 16, background: "#FEF3C7", border: "1.5px solid #FDE68A", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#92400E", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase" }}>
            <span style={{ background: "#D97706", color: "#fff", padding: "1px 6px", borderRadius: 6, fontSize: 10, fontWeight: 900 }}>SN</span> VENTES SÉNÉGAL
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#92400E", marginTop: 6 }}>
            {formatPrice(totalSenegal, "FCFA")}
          </div>
        </div>

        {/* TOTAL CASH */}
        <div className="bs-panel" style={{ padding: 16, background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#166534", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase" }}>
            <DollarSign size={15} /> TOTAL CASH ENCAISSÉ
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#15803D", marginTop: 6 }}>
            {formatPrice(totalCash, boutique?.devise || "KMF")}
          </div>
        </div>
      </div>

      {/* SALES HISTORY DATA TABLE */}
      <div className="bs-panel" style={{ padding: 0 }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
          <table className="bs-table" style={{ minWidth: 800 }}>
          <thead>
            <tr>
              <th>DATE</th>
              <th>CLIENT</th>
              <th>PRODUIT(S)</th>
              <th>TYPE</th>
              <th>EMPLOYÉ</th>
              <th>PAIEMENT</th>
              <th>MONTANT</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <SkeletonTableRows rows={6} cols={8} />
            )}
            {!loading && paginatedOrders.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
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
                    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6, background: (o.devise === "FCFA" ? "#FEF3C7" : "#EFF6FF"), color: (o.devise === "FCFA" ? "#B45309" : "#1D4ED8") }}>
                      {o.devise === "FCFA" ? "🇸🇳 Sénégal" : "🇰🇲 Comores"}
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
                      {isAdmin && (
                        <>
                          <button
                            className="bs-icon-btn"
                            title="Modifier cette vente (Admin)"
                            onClick={() => setEditingOrder({
                              id: o.id,
                              moyenPaiement: o.moyenPaiement || "cash",
                              statut: o.statut || "recuperee",
                              clientNom: o.client?.nom || o.clientNom || "",
                              clientTelephone: o.client?.telephone || o.clientTelephone || "",
                              notes: o.notes || ""
                            })}
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
                  type="text"
                  className="bs-input"
                  value={editingOrder.clientTelephone}
                  onChange={(e) => setEditingOrder({ ...editingOrder, clientTelephone: e.target.value })}
                  placeholder="ex: +269 ... ou +221 ..."
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
    </>
  );
}
