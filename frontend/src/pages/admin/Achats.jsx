import React, { useEffect, useState } from "react";
import { ShoppingBag, DollarSign, Calendar, Search, Printer, RotateCcw, TrendingUp, Pencil, Trash2, AlertTriangle, X, PlusCircle, PackagePlus } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../api";
import TablePagination from "../../components/TablePagination";
import { formatPrice } from "../../utils/currency.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { SkeletonTableRows } from "../../components/Skeleton.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";

function toLocalYMD(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function Achats() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin" || user?.role === "super_admin";

  const [achats, setAchats] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [products, setProducts] = useState([]);
  const [editingAchat, setEditingAchat] = useState(null);
  const [achatToDelete, setAchatToDelete] = useState(null);
  const [showApproModal, setShowApproModal] = useState(false);
  const [approForm, setApproForm] = useState({
    productId: "",
    quantite: 1,
    prixAchatUnitaire: "",
    fournisseurId: "",
    notes: ""
  });
  const [submitting, setSubmitting] = useState(false);

  const [kpis, setKpis] = useState({
    totalDepenses: 0,
    totalDepensesGlobal: 0,
    achatsAujourdhuiFCFA: 0,
    nbAchatsAujourdhui: 0,
    achatsHierFCFA: 0,
    nbAchatsHier: 0,
    achatsMoisFCFA: 0,
    nbAchatsMois: 0,
    beneficePrevisionnelKMF: 0,
    beneficePrevisionnelFCFA: 0,
    potentielVenteKMF: 0,
    potentielVenteFCFA: 0
  });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("TOUS"); // TOUS | INITIAL | APPRO
  const [quickPeriod, setQuickPeriod] = useState("TOUT"); // TOUT | AUJOURDHUI | HIER | MOIS | CUSTOM
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);

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
              totalDepensesGlobal: Number(res.data.totalDepensesGlobal ?? res.data.totalDepenses ?? 0),
              achatsAujourdhuiFCFA: Number(res.data.achatsAujourdhuiFCFA || 0),
              nbAchatsAujourdhui: Number(res.data.nbAchatsAujourdhui || 0),
              achatsHierFCFA: Number(res.data.achatsHierFCFA || 0),
              nbAchatsHier: Number(res.data.nbAchatsHier || 0),
              achatsMoisFCFA: Number(res.data.achatsMoisFCFA || 0),
              nbAchatsMois: Number(res.data.nbAchatsMois || 0),
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

  function loadProductsAndFournisseurs() {
    api.get("/admin/fournisseurs")
      .then(res => setFournisseurs(res.data || []))
      .catch(() => setFournisseurs([]));
    api.get("/admin/products")
      .then(res => setProducts(Array.isArray(res.data) ? res.data : (res.data?.products || [])))
      .catch(() => setProducts([]));
  }

  useEffect(() => {
    load();
    loadProductsAndFournisseurs();

    const unsub = subscribeRealtime((detail) => {
      const t = detail?.type || detail;
      if (t === "achat_updated" || t === "product_updated" || t === "product_created") {
        load();
        loadProductsAndFournisseurs();
      }
    });
    return () => unsub();
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
    setQuickPeriod("CUSTOM");
    setCurrentPage(1);
    load(startDate, endDate);
  };

  const handleResetFilter = () => {
    setStartDate("");
    setEndDate("");
    setQuickPeriod("TOUT");
    setTypeFilter("TOUS");
    setCurrentPage(1);
    load("", "");
  };

  const applyQuickPeriod = (period) => {
    const now = new Date();
    const todayStr = toLocalYMD(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toLocalYMD(yesterday);
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    setQuickPeriod(period);
    setCurrentPage(1);

    if (period === "AUJOURDHUI") {
      setStartDate(todayStr);
      setEndDate(todayStr);
      load(todayStr, todayStr);
    } else if (period === "HIER") {
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
      load(yesterdayStr, yesterdayStr);
    } else if (period === "MOIS") {
      setStartDate(firstOfMonth);
      setEndDate(todayStr);
      load(firstOfMonth, todayStr);
    } else {
      setStartDate("");
      setEndDate("");
      load("", "");
    }
  };

  async function handleCreateApprovisionnement(e) {
    e.preventDefault();
    if (!approForm.productId) {
      toast.error("Veuillez sélectionner le produit à réapprovisionner.");
      return;
    }
    if (!approForm.quantite || Number(approForm.quantite) <= 0) {
      toast.error("La quantité doit être supérieure à 0.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post("/admin/achats", {
        productId: Number(approForm.productId),
        quantite: Number(approForm.quantite),
        prixAchatUnitaire: Number(approForm.prixAchatUnitaire || 0),
        fournisseurId: approForm.fournisseurId || null,
        notes: approForm.notes || ""
      });
      toast.success(
        res.data?.notes
          ? `${res.data.notes} — Coût : ${formatPrice(res.data.totalAchat || 0, "FCFA")}`
          : "Approvisionnement enregistré en FCFA et stock mis à jour !"
      );
      setShowApproModal(false);
      setApproForm({ productId: "", quantite: 1, prixAchatUnitaire: "", fournisseurId: "", notes: "" });
      load();
      loadProductsAndFournisseurs();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement de l'approvisionnement.");
    } finally {
      setSubmitting(false);
    }
  }

  const filteredAchats = achats.filter(a => {
    const q = search.trim().toLowerCase();
    const prodName = a.product?.nom?.toLowerCase() || "";
    const fournName = a.fournisseur?.nom?.toLowerCase() || "";
    const refStr = (a.achatRef || `#ACH-${String(a.id).padStart(3, "0")}`).toLowerCase();
    const notesStr = (a.notes || "").toLowerCase();
    const matchSearch = !q || prodName.includes(q) || fournName.includes(q) || refStr.includes(q) || notesStr.includes(q);

    const matchType =
      typeFilter === "TOUS" ||
      (typeFilter === "INITIAL" && a.isInitial) ||
      (typeFilter === "APPRO" && a.isApprovisionnement);

    return matchSearch && matchType;
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
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Achats & Approvisionnements (FCFA)</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Tous les coûts d'achats de marchandises sont calculés en <strong>FCFA</strong>. Suivez vos achats d'aujourd'hui, d'hier et vos réapprovisionnements.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setApproForm({ productId: "", quantite: 1, prixAchatUnitaire: "", fournisseurId: "", notes: "" });
              setShowApproModal(true);
            }}
            className="bs-btn-primary"
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
              borderRadius: 12, cursor: "pointer", background: "#059669", color: "#fff", border: "none", fontWeight: 800
            }}
          >
            <PackagePlus size={18} /> + Nouvel Approvisionnement
          </button>

          {/* BOUTON TÉLÉCHARGER LE PDF */}
          <button 
            onClick={handleDownloadPDF} 
            className="bs-btn-secondary" 
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, cursor: "pointer" }}
          >
            <Printer size={17} /> Télécharger PDF / Imprimer
          </button>
        </div>
      </div>

      {/* KPI SUMMARY CARDS (100% EN FCFA) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(225px, 1fr))", gap: 14, marginBottom: 18 }}>
        {/* 1. DÉPENSÉ AUJOURD'HUI */}
        <div
          onClick={() => applyQuickPeriod("AUJOURDHUI")}
          className="bs-panel"
          style={{
            padding: 18, display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
            border: quickPeriod === "AUJOURDHUI" ? "2px solid #059669" : "1px solid var(--line)",
            background: quickPeriod === "AUJOURDHUI" ? "#ECFDF5" : "var(--paper)"
          }}
          title="Cliquer pour filtrer les achats d'aujourd'hui"
        >
          <div style={{ background: "#D1FAE5", color: "#059669", borderRadius: 12, padding: 12 }}>
            <Calendar size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "#047857", fontWeight: 800, textTransform: "uppercase" }}>
              Dépensé Aujourd'hui (FCFA)
            </div>
            <div style={{ fontSize: 21, fontWeight: 900, color: "#065F46", marginTop: 2 }}>
              {formatPrice(kpis.achatsAujourdhuiFCFA, "FCFA")}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, marginTop: 2 }}>
              {kpis.nbAchatsAujourdhui} achat(s) / approv. aujourd'hui
            </div>
          </div>
        </div>

        {/* 2. DÉPENSÉ HIER */}
        <div
          onClick={() => applyQuickPeriod("HIER")}
          className="bs-panel"
          style={{
            padding: 18, display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
            border: quickPeriod === "HIER" ? "2px solid #D97706" : "1px solid var(--line)",
            background: quickPeriod === "HIER" ? "#FFFBEB" : "var(--paper)"
          }}
          title="Cliquer pour filtrer les achats d'hier"
        >
          <div style={{ background: "#FEF3C7", color: "#D97706", borderRadius: 12, padding: 12 }}>
            <Calendar size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "#B45309", fontWeight: 800, textTransform: "uppercase" }}>
              Dépensé Hier (FCFA)
            </div>
            <div style={{ fontSize: 21, fontWeight: 900, color: "#92400E", marginTop: 2 }}>
              {formatPrice(kpis.achatsHierFCFA, "FCFA")}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, marginTop: 2 }}>
              {kpis.nbAchatsHier} achat(s) / approv. hier
            </div>
          </div>
        </div>

        {/* 3. DÉPENSÉ CE MOIS */}
        <div
          onClick={() => applyQuickPeriod("MOIS")}
          className="bs-panel"
          style={{
            padding: 18, display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
            border: quickPeriod === "MOIS" ? "2px solid #2563EB" : "1px solid var(--line)",
            background: quickPeriod === "MOIS" ? "#EFF6FF" : "var(--paper)"
          }}
          title="Cliquer pour filtrer les achats de ce mois"
        >
          <div style={{ background: "#DBEAFE", color: "#2563EB", borderRadius: 12, padding: 12 }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "#1D4ED8", fontWeight: 800, textTransform: "uppercase" }}>
              Dépensé ce Mois (FCFA)
            </div>
            <div style={{ fontSize: 21, fontWeight: 900, color: "#1E3A8A", marginTop: 2 }}>
              {formatPrice(kpis.achatsMoisFCFA, "FCFA")}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, marginTop: 2 }}>
              {kpis.nbAchatsMois} opération(s) ce mois
            </div>
          </div>
        </div>

        {/* 4. DÉPENSES TOTALES D'ACHATS (GLOBAL / PÉRIODE) */}
        <div
          onClick={() => applyQuickPeriod("TOUT")}
          className="bs-panel"
          style={{
            padding: 18, display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
            border: quickPeriod === "TOUT" ? "2px solid #DC2626" : "1px solid var(--line)"
          }}
          title="Cliquer pour afficher tous les achats"
        >
          <div style={{ background: "#FEE2E2", color: "#DC2626", borderRadius: 12, padding: 12 }}>
            <DollarSign size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "#DC2626", fontWeight: 800, textTransform: "uppercase" }}>
              {startDate || endDate ? "Total Période Sélectionnée" : "Total Général des Achats"}
            </div>
            <div style={{ fontSize: 21, fontWeight: 900, color: "#991B1B", marginTop: 2 }}>
              {formatPrice(totalDepensesFiltrees, "FCFA")}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, marginTop: 2 }}>
              {filteredAchats.length} ligne(s) affichée(s)
            </div>
          </div>
        </div>
      </div>

      {/* FILTER BAR: QUICK PERIODS, TYPE, DATES & SEARCH */}
      <div className="bs-panel" style={{ padding: 16, marginBottom: 20 }}>
        {/* Raccourcis rapides Aujourd'hui / Hier / Ce mois / Tout + Filtre Type */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Période rapide :</span>
            {[
              { id: "TOUT", label: "Tout voir" },
              { id: "AUJOURDHUI", label: `Aujourd'hui (${formatPrice(kpis.achatsAujourdhuiFCFA, "FCFA")})` },
              { id: "HIER", label: `Hier (${formatPrice(kpis.achatsHierFCFA, "FCFA")})` },
              { id: "MOIS", label: "Ce mois" }
            ].map(btn => (
              <button
                key={btn.id}
                type="button"
                onClick={() => applyQuickPeriod(btn.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: quickPeriod === btn.id ? "1.5px solid var(--forest-dark)" : "1px solid var(--line)",
                  background: quickPeriod === btn.id ? "var(--forest-dark)" : "var(--paper)",
                  color: quickPeriod === btn.id ? "#fff" : "var(--ink)"
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Type :</span>
            {[
              { id: "TOUS", label: "Tous" },
              { id: "INITIAL", label: "Achats Initiaux" },
              { id: "APPRO", label: "Approvisionnements" }
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTypeFilter(t.id); setCurrentPage(1); }}
                style={{
                  padding: "5px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: typeFilter === t.id ? "1.5px solid #059669" : "1px solid var(--line)",
                  background: typeFilter === t.id ? "#DCFCE7" : "var(--paper)",
                  color: typeFilter === t.id ? "#065F46" : "var(--muted)"
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          
          {/* SEARCH */}
          <div style={{ position: "relative", minWidth: 260, flex: "1 1 260px" }}>
            <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              className="bs-input"
              placeholder="Rechercher par réf #ACH-001, produit, fournisseur, notes..."
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
          <table className="bs-table" style={{ width: "100%", minWidth: 820, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Réf & Date</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Type & Détail</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Produit</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Fournisseur</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Quantité</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Coût Unitaire (FCFA)</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", textAlign: "right" }}>Coût Total Achat (FCFA)</th>
              {isAdmin && (
                <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", textAlign: "center" }}>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTableRows rows={6} cols={isAdmin ? 8 : 7} />
            ) : filteredAchats.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} style={{ padding: 36, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
                  Aucun achat / approvisionnement trouvé pour cette période.
                </td>
              </tr>
            ) : (
              filteredAchats.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(a => {
                const dateFormatted = new Date(a.createdAt || a.dateAchat).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
                const refCode = a.achatRef || `#ACH-${String(a.id).padStart(3, "0")}`;
                const isAppro = Boolean(a.isApprovisionnement);
                const initDateFormatted = a.initialAchatDate
                  ? new Date(a.initialAchatDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
                  : null;

                return (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--forest-dark)" }}>{refCode}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>{dateFormatted}</div>
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "3px 9px",
                        borderRadius: 99,
                        fontSize: 11.5,
                        fontWeight: 800,
                        background: isAppro ? "#DBEAFE" : "#DCFCE7",
                        color: isAppro ? "#1E40AF" : "#166534"
                      }}>
                        {isAppro ? "Approvisionnement" : "Achat Initial"}
                      </span>
                      {isAppro && a.initialAchatRef && (
                        <div style={{ fontSize: 11.5, color: "#1E40AF", fontWeight: 600, marginTop: 4 }}>
                          Lié à l'achat {a.initialAchatRef}{initDateFormatted ? ` du ${initDateFormatted}` : ""}
                        </div>
                      )}
                      {a.notes && (
                        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, maxWidth: 240 }}>
                          {a.notes}
                        </div>
                      )}
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

      {/* MODAL NOUVEL APPROVISIONNEMENT (EN FCFA) */}
      {showApproModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480,
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)", overflow: "hidden"
          }}>
            <div style={{
              padding: "16px 20px", borderBottom: "1px solid var(--line)",
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "var(--forest-dark)" }}>
                  Nouvel Approvisionnement de Stock (FCFA)
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  Crée une nouvelle ligne d'approvisionnement liée à l'achat initial du produit.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApproModal(false)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted)" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateApprovisionnement} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 5 }}>
                  Produit à réapprovisionner *
                </label>
                <select
                  required
                  className="bs-select"
                  value={approForm.productId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    const foundProd = products.find(p => String(p.id) === String(pid));
                    setApproForm({
                      ...approForm,
                      productId: pid,
                      prixAchatUnitaire: foundProd?.prixAchat !== undefined ? foundProd.prixAchat : approForm.prixAchatUnitaire,
                      fournisseurId: foundProd?.fournisseurId || approForm.fournisseurId
                    });
                  }}
                  style={{ width: "100%", height: 40, fontSize: 13 }}
                >
                  <option value="">-- Choisir un produit --</option>
                  {products.map(p => {
                    const initAchat = achats.find(a => a.productId === p.id && a.isInitial);
                    const refLabel = initAchat?.achatRef ? ` • Achat initial ${initAchat.achatRef}` : "";
                    return (
                      <option key={p.id} value={p.id}>
                        {p.nom} (Stock actuel: {p.stock || 0}{refLabel})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 5 }}>
                    Quantité ajoutée (+Stock) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="bs-input"
                    value={approForm.quantite}
                    onChange={(e) => setApproForm({ ...approForm, quantite: e.target.value })}
                    style={{ width: "100%", height: 38, fontSize: 13.5, fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 5 }}>
                    Prix d'achat unitaire (FCFA) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    className="bs-input"
                    placeholder="Ex: 2500"
                    value={approForm.prixAchatUnitaire}
                    onChange={(e) => setApproForm({ ...approForm, prixAchatUnitaire: e.target.value })}
                    style={{ width: "100%", height: 38, fontSize: 13.5, fontWeight: 700 }}
                  />
                </div>
              </div>

              {Number(approForm.quantite) > 0 && Number(approForm.prixAchatUnitaire) > 0 && (
                <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#065F46", fontWeight: 700 }}>
                  Coût total de cet approvisionnement : {formatPrice(Number(approForm.quantite) * Number(approForm.prixAchatUnitaire), "FCFA")}
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 5 }}>
                  Fournisseur :
                </label>
                <select
                  className="bs-select"
                  value={approForm.fournisseurId}
                  onChange={(e) => setApproForm({ ...approForm, fournisseurId: e.target.value })}
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
                  Notes / Précision (optionnel) :
                </label>
                <input
                  type="text"
                  className="bs-input"
                  value={approForm.notes}
                  onChange={(e) => setApproForm({ ...approForm, notes: e.target.value })}
                  placeholder="Laisser vide pour mentionner automatiquement l'achat initial..."
                  style={{ width: "100%", height: 38, fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowApproModal(false)}
                  className="bs-btn-secondary"
                  style={{ padding: "8px 16px", fontSize: 13 }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bs-btn-primary"
                  style={{ padding: "8px 18px", fontSize: 13, background: "#059669" }}
                >
                  {submitting ? "Enregistrement..." : "Valider l'approvisionnement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
