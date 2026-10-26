import { SkeletonTableRows } from "../../components/Skeleton.jsx";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { PlusCircle, List, Pencil, Trash2, AlertTriangle, CheckCircle, Package, X, Wand2, Sparkles, Loader2, Smartphone, Shield, Zap, Eye, CheckCircle2, Printer } from "lucide-react";
import api from "../../api";
import ImageUploader from "../../components/ImageUploader.jsx";
import TablePagination from "../../components/TablePagination.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";

import { formatPrice, formatPrice as fcfa } from "../../utils/currency.js";

export default function AdminProduits() {
  const { boutique } = useAuth();
  const [activeTab, setActiveTab] = useState("liste"); // "liste" | "ajout"
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [familles, setFamilles] = useState([]);
  const [unites, setUnites] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [marques, setMarques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  // États Assistant IA Multi-fournisseurs (Groq, Gemini, Cohere)
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInstructions, setAiInstructions] = useState("");
  const [lastAiProvider, setLastAiProvider] = useState(null);
  const [aiPhotoModal, setAiPhotoModal] = useState(null);
  
  // États de filtre
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterStock, setFilterStock] = useState(false);
  const [filterGenre, setFilterGenre] = useState("");
  const [filterMarque, setFilterMarque] = useState("");

  // Modal d'approvisionnement
  const [restockProduct, setRestockProduct] = useState(null);
  const [restockForm, setRestockForm] = useState({
    fournisseurId: "",
    quantite: 10,
    prixAchatUnitaire: 0,
    notes: ""
  });
  const [restockSubmitting, setRestockSubmitting] = useState(false);

  const initialForm = {
    nom: "",
    categoryId: "",
    famille: "Chargeurs & Blocs Rapides",
    marqueId: "",
    genre: "mixte",
    etat: "neuf",
    description: "",
    prix: "",
    prixPromo: "",
    prixSenegal: "",
    prixPromoSenegal: "",
    enPromo: false,
    isNouveau: true,
    noteEtoiles: "5",
    poids: "",
    unite: "pièce",
    coutAchat: "",
    stock: "20",
    seuilAlerte: 5,
    imageUrl: "",
    imageUrl2: ""
  };
  const [form, setForm] = useState(initialForm);

  // Fonction de génération automatique IA avec failover
  async function handleAiGenerate() {
    if (!form.nom && !form.imageUrl && !aiInstructions) {
      toast.error("Veuillez renseigner au moins un titre approximatif, une consigne ou uploader une photo pour l'IA.");
      return;
    }
    setAiLoading(true);
    try {
      const selectedMarque = marques.find(m => String(m.id) === String(form.marqueId))?.nom || "";
      const selectedCat = categories.find(c => String(c.id) === String(form.categoryId))?.nom || "";

      const res = await api.post("/admin/ai/enhance-product", {
        nom: form.nom,
        marque: selectedMarque,
        categorie: selectedCat,
        userInstructions: aiInstructions,
        photoUrl: form.imageUrl
      });

      if (res.data && res.data.success) {
        setLastAiProvider(res.data.provider);
        setForm(prev => {
          const next = { ...prev };
          if (res.data.nom) next.nom = res.data.nom;
          if (res.data.description) {
            next.description = `${res.data.description}\n\nSpécifications techniques :\n${res.data.specifications || ""}`;
          }
          if (res.data.marque) {
            const matchedM = marques.find(m => m.nom.toLowerCase().includes(res.data.marque.toLowerCase()));
            if (matchedM) next.marqueId = matchedM.id;
          }
          if (res.data.studioImageUrl) {
            if (prev.imageUrl && prev.imageUrl !== res.data.studioImageUrl) {
              // L'utilisateur avait déjà sa photo : lui ouvrir la boîte de comparaison
              setAiPhotoModal({
                originalUrl: prev.imageUrl,
                aiUrl: res.data.studioImageUrl
              });
            } else {
              next.imageUrl = res.data.studioImageUrl;
            }
          }
          return next;
        });
        toast.success(`Fiche rédigée avec succès via ${res.data.provider}`);
      }
    } catch (err) {
      console.error("Erreur IA:", err);
      toast.error("Erreur lors de la génération IA. Le système de secours va être activé.");
    } finally {
      setAiLoading(false);
    }
  }

  function silentSyncProducts() {
    api.get("/admin/products").then((res) => setProducts(res.data)).catch(() => {});
    api.get("/admin/categories").then((res) => setCategories(res.data)).catch(() => {});
    api.get("/admin/familles").then((res) => setFamilles(res.data || [])).catch(() => {});
    api.get("/admin/unites").then((res) => setUnites(res.data || [])).catch(() => {});
    api.get("/admin/fournisseurs").then((res) => setFournisseurs(res.data || [])).catch(() => {});
    api.get("/admin/marques").then((res) => setMarques(res.data || [])).catch(() => {});
  }

  function load() {
    setLoading(true);
    api.get("/admin/products").then((res) => setProducts(res.data)).finally(() => setLoading(false));
    api.get("/admin/categories").then((res) => setCategories(res.data));
    api.get("/admin/familles").then((res) => setFamilles(res.data || [])).catch(() => {});
    api.get("/admin/unites").then((res) => setUnites(res.data || [])).catch(() => {});
    api.get("/admin/fournisseurs").then((res) => setFournisseurs(res.data || [])).catch(() => {});
    api.get("/admin/marques").then((res) => setMarques(res.data || [])).catch(() => {});
  }

  useEffect(() => {
    load();
    const unsub = subscribeRealtime((detail) => {
      if (detail.type === "product_updated" || detail.type === "category_updated") {
        silentSyncProducts();
      }
    });
    return () => unsub();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function showToast(msg, type = "success") {
    if (type === "success") {
      toast.success(msg);
    } else {
      toast.error(msg);
    }
  }

  function startEdit(product) {
    setEditingId(product.id);
    setForm({
      nom: product.nom || "",
      categoryId: product.categoryId || "",
      famille: product.famille || "Cosmétique",
      marqueId: product.marqueId || "",
      genre: product.genre || "femme",
      etat: product.etat || "neuf",
      description: product.description || "",
      prix: product.prix ?? "",
      prixPromo: product.prixPromo ?? "",
      prixSenegal: product.prixSenegal ?? "",
      prixPromoSenegal: product.prixPromoSenegal ?? "",
      enPromo: Boolean(product.enPromo || product.prixPromo),
      isNouveau: Boolean(product.isNouveau),
      noteEtoiles: product.noteEtoiles !== undefined && product.noteEtoiles !== null ? String(product.noteEtoiles) : "5",
      poids: product.poids || "",
      unite: product.unite || "pièce",
      coutAchat: product.coutAchat ?? "",
      stock: product.stock ?? "",
      seuilAlerte: product.seuilAlerte ?? 5,
      imageUrl: product.imageUrl || "",
      imageUrl2: product.imageUrl2 || ""
    });
    setActiveTab("ajout");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(initialForm);
    setActiveTab("liste");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nom || !form.categoryId) return;

    // Sanitize: empty string → 0 or null
    const payload = {
      ...form,
      prix: form.prix !== "" ? Number(form.prix) : 0,
      prixPromo: form.enPromo && form.prixPromo !== "" && form.prixPromo !== null ? Number(form.prixPromo) : null,
      prixSenegal: form.prixSenegal !== "" && form.prixSenegal !== null ? Number(form.prixSenegal) : null,
      prixPromoSenegal: form.enPromo && form.prixPromoSenegal !== "" && form.prixPromoSenegal !== null ? Number(form.prixPromoSenegal) : null,
      enPromo: Boolean(form.enPromo),
      isNouveau: Boolean(form.isNouveau),
      noteEtoiles: form.noteEtoiles !== "" ? Number(form.noteEtoiles) : 5.0,
      coutAchat: form.coutAchat !== "" ? Number(form.coutAchat) : 0,
      stock: form.stock !== "" ? Number(form.stock) : 0,
      seuilAlerte: form.seuilAlerte !== "" ? Number(form.seuilAlerte) : 5,
      categoryId: Number(form.categoryId),
      marqueId: form.marqueId ? Number(form.marqueId) : null,
      etat: form.etat || "neuf",
      poids: form.poids || "",
      famille: form.famille || "Accessoires"
    };

    try {
      if (editingId) {
        const res = await api.put(`/admin/products/${editingId}`, payload);
        const updated = res.data;
        const matchingCat = categories.find(c => String(c.id) === String(payload.categoryId));
        setProducts((prev) =>
          prev.map((p) =>
            p.id === editingId
              ? { ...p, ...payload, Category: matchingCat || p.Category, id: editingId }
              : p
          )
        );
        showToast("Produit modifié avec succès !");
      } else {
        const res = await api.post("/admin/products", payload);
        const created = res.data;
        const matchingCat = categories.find(c => String(c.id) === String(payload.categoryId));
        const newProductItem = created && created.id ? { ...created, Category: matchingCat } : { ...payload, id: Date.now(), Category: matchingCat };
        setProducts((prev) => [newProductItem, ...prev]);
        showToast("Nouveau produit ajouté et achat initial enregistré !");
      }
      setEditingId(null);
      setForm(initialForm);
      setActiveTab("liste");
      silentSyncProducts();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur inconnue.";
      showToast("Erreur : " + msg);
    }
  }

  async function deleteProduct(id) {
    if (!confirm("Voulez-vous vraiment supprimer ce produit ?")) return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    try {
      await api.delete(`/admin/products/${id}`);
      showToast("Produit supprimé.");
      silentSyncProducts();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur inconnue.";
      showToast("Erreur lors de la suppression : " + msg);
      load(); // Revert on failure
    }
  }

  function openRestockModal(product) {
    setRestockProduct(product);
    setRestockForm({
      fournisseurId: product.fournisseurId || "",
      quantite: 10,
      prixAchatUnitaire: product.coutAchat || 0,
      notes: ""
    });
  }

  async function handleRestockSubmit(e) {
    e.preventDefault();
    if (!restockProduct) return;
    setRestockSubmitting(true);
    try {
      await api.post("/admin/achats", {
        productId: restockProduct.id,
        fournisseurId: restockForm.fournisseurId ? Number(restockForm.fournisseurId) : null,
        quantite: Number(restockForm.quantite),
        prixAchatUnitaire: Number(restockForm.prixAchatUnitaire),
        notes: restockForm.notes || `Approvisionnement direct pour ${restockProduct.nom}`
      });
      showToast(`Approvisionnement réussi ! (+${restockForm.quantite} en stock pour ${restockProduct.nom})`);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === restockProduct.id
            ? { ...p, stock: Number(p.stock) + Number(restockForm.quantite) }
            : p
        )
      );
      setRestockProduct(null);
      silentSyncProducts();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur lors de l'approvisionnement.";
      showToast("Erreur : " + msg);
    } finally {
      setRestockSubmitting(false);
    }
  }

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter products by search query, category, low stock, etat, marque
  const filteredProducts = products.filter((p) => {
    const matchSearch = !search || (
      p.nom?.toLowerCase().includes(search.toLowerCase()) ||
      p.Category?.nom?.toLowerCase().includes(search.toLowerCase()) ||
      p.marque?.nom?.toLowerCase().includes(search.toLowerCase())
    );
    const matchCat = !filterCat || String(p.categoryId) === String(filterCat);
    const matchStock = !filterStock || p.stock <= p.seuilAlerte;
    const matchGenre = !filterGenre || (p.genre || "femme") === filterGenre;
    const matchMarque = !filterMarque || String(p.marqueId) === String(filterMarque);

    return matchSearch && matchCat && matchStock && matchGenre && matchMarque;
  });

  // Reset page to 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [search, filterCat, filterStock, filterGenre, filterMarque]);

  const totalItems = filteredProducts.length;
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Exporter la liste des produits au format PDF imprimable
  const handleDownloadPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour exporter le PDF.");
      return;
    }

    const totalStock = filteredProducts.reduce((sum, p) => sum + Number(p.stock || 0), 0);
    const valeurStock = filteredProducts.reduce((sum, p) => sum + (Number(p.stock || 0) * Number(p.coutAchat || 0)), 0);

    const rowsHtml = filteredProducts.map((p, idx) => {
      const marqueNom = p.marque?.nom || p.Marque?.nom || "Universel";
      const catNom = p.Category?.nom || "Non classé";
      const prixKMF = p.prixPromo ? `${formatPrice(p.prixPromo, "KMF")} (Promo)` : formatPrice(p.prix, "KMF");
      const prixFCFA = p.prixPromoSenegal ? `${formatPrice(p.prixPromoSenegal, "FCFA")} (Promo)` : (p.prixSenegal ? formatPrice(p.prixSenegal, "FCFA") : "—");
      const coutKMF = formatPrice(p.coutAchat || 0, "KMF");

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 0 ? "background: #f8fafc;" : ""}">
          <td style="padding: 9px 12px; font-weight: 700; color: #1e293b;">${p.nom}</td>
          <td style="padding: 9px 12px; color: #1d4ed8; font-weight: 600;">${marqueNom}</td>
          <td style="padding: 9px 12px; color: #475569;">${catNom}</td>
          <td style="padding: 9px 12px; font-weight: 700; color: #059669;">${prixKMF}</td>
          <td style="padding: 9px 12px; font-weight: 700; color: #d97706;">${prixFCFA}</td>
          <td style="padding: 9px 12px; color: #64748b;">${coutKMF}</td>
          <td style="padding: 9px 12px; font-weight: 800; text-align: center; color: ${p.stock <= p.seuilAlerte ? "#dc2626" : "#1e293b"};">
            ${p.stock} ${p.unite || "pièce"}
          </td>
        </tr>
      `;
    }).join("");

    const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Inventaire des Produits - ${boutique?.nom || "Soilihitech"}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #224B35; padding-bottom: 16px; }
          .title { font-size: 22px; font-weight: 800; color: #224B35; margin: 0; }
          .kpi-box { display: flex; gap: 16px; margin-bottom: 20px; }
          .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; }
          .kpi-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
          .kpi-value { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; }
          th { background: #224B35; color: #ffffff; padding: 10px 12px; text-transform: uppercase; font-size: 11px; }
          @media print {
            body { padding: 0; }
            @page { margin: 1.2cm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">${boutique?.nom || "Soilihitech"} - Inventaire & Tarifs</h1>
            <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Édité le ${dateStr}</div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #64748b;">
            <div>${boutique?.emailContact || "contact@soilihitech.com"}</div>
            <div>${boutique?.telephone || ""}</div>
          </div>
        </div>

        <div class="kpi-box">
          <div class="kpi">
            <div class="kpi-title">Total Références</div>
            <div class="kpi-value">${filteredProducts.length} articles</div>
          </div>
          <div class="kpi">
            <div class="kpi-title">Stock Total en Unités</div>
            <div class="kpi-value">${totalStock}</div>
          </div>
          <div class="kpi">
            <div class="kpi-title">Valeur Stock (Coût Achat)</div>
            <div class="kpi-value">${formatPrice(valeurStock, "KMF")}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Nom du produit</th>
              <th>Marque</th>
              <th>Catégorie</th>
              <th>Prix Comores (KMF)</th>
              <th>Prix Sénégal (FCFA)</th>
              <th>Coût d'achat</th>
              <th style="text-align: center;">Stock</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px;">
          Document généré automatiquement par le logiciel de gestion ${boutique?.nom || "Soilihitech"}.
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Gestion des Produits</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Consultez votre inventaire ou ajoutez de nouveaux articles à la boutique.
          </p>
        </div>

        {/* TABS & PDF BUTTON */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={handleDownloadPDF}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 24, fontSize: 13, fontWeight: 700,
              background: "var(--card)", border: "1.5px solid var(--line)",
              color: "var(--forest-dark)", cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "all 0.15s ease"
            }}
            title="Exporter l'inventaire complet des produits au format PDF"
          >
            <Printer size={15} color="var(--forest)" />
            <span>Imprimer / PDF</span>
          </button>

          <div style={{ display: "flex", gap: 8, background: "var(--paper)", padding: 4, borderRadius: 30, border: "1px solid var(--line)" }}>
            <button
              className={`bs-btn-primary ${activeTab === "liste" ? "" : "inactive"}`}
              style={{
                padding: "8px 18px",
                borderRadius: 24,
                fontSize: 13,
                background: activeTab === "liste" ? "var(--forest)" : "transparent",
                color: activeTab === "liste" ? "#fff" : "var(--muted)",
                boxShadow: "none"
              }}
              onClick={() => { setEditingId(null); setForm(initialForm); setActiveTab("liste"); }}
            >
              <List size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} /> Liste des produits ({products.length})
            </button>
            <button
              className={`bs-btn-primary ${activeTab === "ajout" ? "" : "inactive"}`}
              style={{
                padding: "8px 18px",
                borderRadius: 24,
                fontSize: 13,
                background: activeTab === "ajout" ? "var(--forest)" : "transparent",
                color: activeTab === "ajout" ? "#fff" : "var(--muted)",
                boxShadow: "none"
              }}
              onClick={() => {
                if (!editingId) { setForm(initialForm); }
                setActiveTab("ajout");
              }}
            >
              <PlusCircle size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} /> {editingId ? "Modifier le produit" : "Ajouter un produit"}
            </button>
          </div>
        </div>
      </div>



      {/* CONTENUS DES ONGLETS */}
      {activeTab === "liste" && (
        <div className="bs-panel" style={{ padding: 0 }}>
          <div style={{ background: "var(--paper)", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Total Produits</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)" }}>{products.length}</span>
              </div>
              <div style={{ width: 1, background: "var(--line)" }}></div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Résultats</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)" }}>{filteredProducts.length}</span>
              </div>
              <div style={{ width: 1, background: "var(--line)" }}></div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Alertes Stock</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "#B4483A" }}>{products.filter(p => p.stock <= p.seuilAlerte).length}</span>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input 
                className="bs-input" 
                style={{ flex: 1, minWidth: 200 }} 
                placeholder="Rechercher un produit, catégorie ou marque..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
              <select 
                className="bs-select" 
                style={{ width: 170 }} 
                value={filterCat} 
                onChange={(e) => setFilterCat(e.target.value)}
              >
                <option value="">Toutes les catégories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>

              <select 
                className="bs-select" 
                style={{ width: 190 }} 
                value={filterMarque} 
                onChange={(e) => setFilterMarque(e.target.value)}
              >
                <option value="">Toutes les marques</option>
                {marques.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer", background: filterStock ? "#FAD2CD" : "var(--forest-light)", padding: "0 12px", borderRadius: 8, color: filterStock ? "#B4483A" : "var(--forest-dark)", fontWeight: 700, height: 40 }}>
                <input type="checkbox" checked={filterStock} onChange={(e) => setFilterStock(e.target.checked)} style={{ margin: 0 }} />
                Stock faible
              </label>
            </div>
          </div>

          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
            <table className="bs-table" style={{ minWidth: 1040 }}>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Nom du produit</th>
                <th>Marque</th>
                <th>Catégorie / Fournisseur</th>
                <th>Prix Vente Comores</th>
                <th>Prix Vente Sénégal</th>
                <th>Coût d'achat</th>
                <th>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <SkeletonTableRows rows={6} cols={9} />
              )}
              {!loading && paginatedProducts.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                    Aucun produit ne correspond à votre recherche.
                  </td>
                </tr>
              )}
              {!loading && paginatedProducts.map((p) => {
                const supplierName = p.fournisseur ? (p.fournisseur.nom || p.fournisseur.nomCompany || p.fournisseur.nomContact) : null;
                const marqueNom = p.marque?.nom || p.Marque?.nom;
                return (
                  <tr key={p.id}>
                    <td style={{ width: 60 }}>
                      <img
                        src={p.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=100&q=80"}
                        alt={p.nom}
                        style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover", border: "1px solid var(--line)" }}
                      />
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--ink)" }}>
                      <div>{p.nom}</div>
                      <div style={{ fontSize: 11.5, color: "#F59E0B", marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}>
                        ⭐ <strong>{(p.avis?.length ? (p.avis.reduce((s, a) => s + a.note, 0) / p.avis.length) : (p.noteEtoiles !== undefined && p.noteEtoiles !== null ? Number(p.noteEtoiles) : 5.0)).toFixed(1)}</strong>
                        <span style={{ color: "var(--muted)", fontWeight: 400 }}>({p.avis?.length || 0} avis)</span>
                      </div>
                    </td>
                    <td>
                      {marqueNom ? (
                        <span style={{ 
                          display: "inline-flex", alignItems: "center", gap: 4,
                          background: "#EFF6FF", color: "#1D4ED8", border: "1.5px solid #BFDBFE",
                          padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 800 
                        }}>
                          {marqueNom}
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: 12 }}>Universel</span>
                      )}
                    </td>
                    <td>
                      <span style={{ background: "var(--forest-light)", color: "var(--forest-dark)", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, border: "1px solid var(--line)" }}>
                        {p.Category?.nom || "Non classé"}
                      </span>
                      {supplierName && (
                        <div style={{ fontSize: 11, color: "var(--forest-dark)", fontWeight: 600, marginTop: 4 }}>
                          Fournisseur: {supplierName}
                        </div>
                      )}
                    </td>
                    <td>
                      {p.prixPromo ? (
                        <>
                          <span style={{ textDecoration: "line-through", color: "var(--muted)", marginRight: 6, fontSize: 13 }}>{formatPrice(p.prix, "KMF")}</span>
                          <span style={{ color: "var(--accent)", fontWeight: 700 }}>{formatPrice(p.prixPromo, "KMF")}</span>
                        </>
                      ) : (
                        <span style={{ fontWeight: 700 }}>{formatPrice(p.prix, "KMF")}</span>
                      )}
                      {p.unite ? <span style={{ color: "var(--muted)", fontSize: 11.5 }}> / {p.unite}</span> : null}
                    </td>
                    <td>
                      {p.prixPromoSenegal ? (
                        <>
                          <span style={{ textDecoration: "line-through", color: "var(--muted)", marginRight: 6, fontSize: 13 }}>{formatPrice(p.prixSenegal, "FCFA")}</span>
                          <span style={{ color: "#D97706", fontWeight: 800 }}>{formatPrice(p.prixPromoSenegal, "FCFA")}</span>
                        </>
                      ) : p.prixSenegal ? (
                        <span style={{ fontWeight: 800, color: "#92400E" }}>{formatPrice(p.prixSenegal, "FCFA")}</span>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ color: "var(--muted)" }}>{formatPrice(p.coutAchat || 0, "KMF")}</td>
                    <td className={p.stock <= p.seuilAlerte ? "bs-stock-low" : ""}>
                      <span style={{ fontWeight: 700 }}>{p.stock}</span> {p.unite}
                      {p.stock <= p.seuilAlerte && <AlertTriangle size={14} color="#B4483A" style={{ marginLeft: 6, verticalAlign: "-2px" }} />}
                    </td>

                    <td>
                      <button
                        className="bs-icon-btn"
                        title="Approvisionner (Réappro stock)"
                        style={{ color: "var(--forest)", marginRight: 4 }}
                        onClick={() => openRestockModal(p)}
                      >
                        <Package size={15} />
                      </button>
                      <button className="bs-icon-btn" title="Modifier" onClick={() => startEdit(p)}><Pencil size={15} /></button>{" "}
                      <button className="bs-icon-btn" title="Supprimer" style={{ color: "#B4483A" }} onClick={() => deleteProduct(p.id)}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          {/* TABLE PAGINATION */}
          <TablePagination
            totalItems={totalItems}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {activeTab === "ajout" && (
        <div className="bs-panel" style={{ maxWidth: 780, margin: "0 auto" }}>
          <h3 style={{ marginTop: 0, fontSize: 20, color: "var(--forest-dark)", borderBottom: "1px solid var(--line)", paddingBottom: 12, marginBottom: 20 }}>
            {editingId ? "Modifier le produit" : "Formulaire d'ajout de produit"}
          </h3>

          <form onSubmit={handleSubmit} className="bs-auth-form" style={{ gap: 16 }}>
            <div className="bs-input-group">
              <label>Nom du produit *</label>
              <input
                className="bs-input"
                required
                placeholder="ex: Sérum Hydratant Acide Hyaluronique, Huile Capillaire Éixir, Broche Bijou Dorée..."
                value={form.nom}
                onChange={(e) => set("nom", e.target.value)}
              />
            </div>

            <div className="bs-form-row-2" style={{ marginBottom: 4 }}>
              {/* COMPATIBILITÉ SMARTPHONE */}
              <div className="bs-input-group">
                <label style={{ fontWeight: 800, color: "var(--forest-dark)" }}>
                  Modèles de téléphones compatibles
                </label>
                <input
                  type="text"
                  placeholder="Ex: iPhone 11 à 15 Pro, Samsung S21-S24, Tecno Camon..."
                  value={form.compatibilite || ""}
                  onChange={(e) => set("compatibilite", e.target.value)}
                  style={{ height: 42 }}
                />
              </div>

              {/* MARQUE DU PRODUIT */}
              <div className="bs-input-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ fontWeight: 700 }}>Marque du produit</label>
                  <a href="/admin/marques" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--forest)", fontWeight: 700, textDecoration: "none" }}>
                    + Gérer les marques
                  </a>
                </div>
                <select
                  className="bs-select"
                  value={form.marqueId}
                  onChange={(e) => set("marqueId", e.target.value)}
                  style={{ height: 42 }}
                >
                  <option value="">-- Sans marque spécifique / Générique --</option>
                  {marques.map((m) => (
                    <option key={m.id} value={m.id}>{m.nom}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bs-form-row-3">
              <div className="bs-input-group">
                <label>Catégorie *</label>
                <select
                  className="bs-select"
                  required
                  value={form.categoryId}
                  onChange={(e) => {
                    const catId = Number(e.target.value);
                    const selectedCat = categories.find(c => c.id === catId);
                    set("categoryId", catId);
                    if (selectedCat && selectedCat.famille) {
                      set("famille", selectedCat.famille);
                    }
                  }}
                >
                  <option value="">-- Sélectionner --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.nom} ({c.famille || "Général"})</option>
                  ))}
                </select>
              </div>

              <div className="bs-input-group">
                <label>Famille *</label>
                <select
                  className="bs-select"
                  required
                  value={form.famille}
                  onChange={(e) => set("famille", e.target.value)}
                >
                  {familles.map((f) => (
                    <option key={f.id} value={f.nom}>{f.nom}</option>
                  ))}
                  {!familles.some(f => f.nom === form.famille) && form.famille && (
                    <option value={form.famille}>{form.famille}</option>
                  )}
                </select>
              </div>

              <div className="bs-input-group">
                <label>Unité de vente *</label>
                <select
                  className="bs-select"
                  value={form.unite}
                  onChange={(e) => set("unite", e.target.value)}
                >
                  <option value="">-- Sélectionner --</option>
                  {unites.map((u) => (
                    <option key={u.id} value={u.abbreviation || u.nom}>
                      {u.nom} ({u.abbreviation || u.nom})
                    </option>
                  ))}
                  {form.unite && !unites.some(u => (u.abbreviation || u.nom) === form.unite) && (
                    <option value={form.unite}>{form.unite}</option>
                  )}
                </select>
              </div>
            </div>

            {/* SECTION CLASSEMENT NOUVEAUTÉ ET ÉTOILES */}
            <div style={{ background: "var(--paper)", padding: 16, borderRadius: 12, border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  id="isNouveau"
                  checked={form.isNouveau}
                  onChange={(e) => set("isNouveau", e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--forest)", cursor: "pointer" }}
                />
                <div>
                  <label htmlFor="isNouveau" style={{ fontWeight: 700, fontSize: 13.5, color: "var(--forest-dark)", cursor: "pointer", margin: 0 }}>
                    Marquer comme NOUVEAU produit (Nouveauté) ?
                  </label>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    Si cette option est activée, le produit apparaîtra dans la section "Nouveaux Produits" sur la page d'accueil avec un badge NOUVEAU.
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <label htmlFor="noteEtoiles" style={{ fontWeight: 700, fontSize: 13.5, color: "var(--forest-dark)", display: "block" }}>
                    ⭐ Étoiles du produit (Note par défaut)
                  </label>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    Attribuez une note initiale entre 1 et 5 étoiles (ex: 5 étoiles pour une qualité maximale).
                  </div>
                </div>
                <select
                  id="noteEtoiles"
                  className="bs-select"
                  style={{ width: 150, fontWeight: 700 }}
                  value={form.noteEtoiles}
                  onChange={(e) => set("noteEtoiles", e.target.value)}
                >
                  <option value="5">⭐⭐⭐⭐⭐ (5.0 / 5)</option>
                  <option value="4.5">⭐⭐⭐⭐½ (4.5 / 5)</option>
                  <option value="4">⭐⭐⭐⭐ (4.0 / 5)</option>
                  <option value="3.5">⭐⭐⭐½ (3.5 / 5)</option>
                  <option value="3">⭐⭐⭐ (3.0 / 5)</option>
                  <option value="2.5">⭐⭐½ (2.5 / 5)</option>
                  <option value="2">⭐⭐ (2.0 / 5)</option>
                  <option value="1">⭐ (1.0 / 5)</option>
                </select>
              </div>
            </div>

            {/* PROMO & TARIFS PAYS SECTION (COMORES KMF & SÉNÉGAL FCFA) */}
            <div style={{ background: "var(--paper)", padding: 16, borderRadius: 12, border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <input
                  type="checkbox"
                  id="enPromo"
                  checked={form.enPromo}
                  onChange={(e) => set("enPromo", e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--forest)", cursor: "pointer" }}
                />
                <label htmlFor="enPromo" style={{ fontWeight: 700, fontSize: 13.5, color: "var(--forest-dark)", cursor: "pointer", margin: 0 }}>
                  Activer une Promotion sur ce produit ?
                </label>
              </div>

              {/* LIGNE 1 : TARIFS COMORES (KMF) */}
              <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px dashed var(--line)" }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: "#2563EB", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>Tarifs Comores (KMF) *</span>
                </div>
                <div className="bs-form-row-3">
                  <div className="bs-input-group">
                    <label>Prix Normal Comores (KMF) *</label>
                    <input
                      className="bs-input"
                      type="number"
                      step="1"
                      required
                      placeholder="ex: 6500"
                      value={form.prix}
                      onChange={(e) => set("prix", e.target.value)}
                    />
                  </div>

                  <div className="bs-input-group">
                    <label>Prix Promo Comores (KMF)</label>
                    <input
                      className="bs-input"
                      type="number"
                      step="1"
                      disabled={!form.enPromo}
                      placeholder="ex: 5500"
                      value={form.prixPromo}
                      onChange={(e) => set("prixPromo", e.target.value)}
                    />
                  </div>

                  <div className="bs-input-group">
                    <label>Réduction Comores</label>
                    <div style={{
                      height: 44, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "0 14px", background: "#E0F2FE", borderRadius: 8, border: "1.5px solid #BAE6FD",
                      fontWeight: 800, color: "#0369A1", fontSize: 13, textAlign: "center"
                    }}>
                      {form.enPromo && form.prixPromo && Number(form.prix) > 0 ? (
                        `-${Math.round(((Number(form.prix) - Number(form.prixPromo)) / Number(form.prix)) * 100)} % de remise`
                      ) : (
                        "Aucune promo active"
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* LIGNE 2 : TARIFS SÉNÉGAL (FCFA) */}
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: "#15803D", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>Tarifs Sénégal (FCFA)</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>(S'affiche si le client choisit Sénégal)</span>
                </div>
                <div className="bs-form-row-3">
                  <div className="bs-input-group">
                    <label>Prix Vente Sénégal (FCFA)</label>
                    <input
                      className="bs-input"
                      type="number"
                      step="1"
                      placeholder="ex: 8000"
                      value={form.prixSenegal}
                      onChange={(e) => set("prixSenegal", e.target.value)}
                    />
                  </div>

                  <div className="bs-input-group">
                    <label>Prix Promo Sénégal (FCFA)</label>
                    <input
                      className="bs-input"
                      type="number"
                      step="1"
                      disabled={!form.enPromo}
                      placeholder="ex: 7000"
                      value={form.prixPromoSenegal}
                      onChange={(e) => set("prixPromoSenegal", e.target.value)}
                    />
                  </div>

                  <div className="bs-input-group">
                    <label>Réduction Sénégal</label>
                    <div style={{
                      height: 44, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "0 14px", background: "#DCFCE7", borderRadius: 8, border: "1.5px solid #86EFAC",
                      fontWeight: 800, color: "#166534", fontSize: 13, textAlign: "center"
                    }}>
                      {form.enPromo && form.prixPromoSenegal && Number(form.prixSenegal) > 0 ? (
                        `-${Math.round(((Number(form.prixSenegal) - Number(form.prixPromoSenegal)) / Number(form.prixSenegal)) * 100)} % de remise`
                      ) : (
                        "Aucune promo active"
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bs-form-row-2">
              <div className="bs-input-group">
                <label>Stock disponible</label>
                <input
                  className="bs-input"
                  type="number"
                  placeholder="ex: 50"
                  value={form.stock}
                  onChange={(e) => set("stock", e.target.value)}
                />
              </div>

              <div className="bs-input-group">
                <label>Coût d'achat unitaire</label>
                <input
                  className="bs-input"
                  type="number"
                  step="0.01"
                  placeholder="ex: 8500"
                  value={form.coutAchat}
                  onChange={(e) => set("coutAchat", e.target.value)}
                />
              </div>
            </div>

            {/* ── ASSISTANT IA MULTI-FOURNISSEUR (GROQ + GEMINI + COHERE) ── */}
            <div style={{
              background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
              border: "1px solid #334155",
              borderRadius: 16,
              padding: "18px 20px",
              color: "#fff",
              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ background: "#2563EB", padding: 6, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Sparkles size={18} color="#fff" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff" }}>
                      Assistant IA Soilihitech (Groq ⚡ • Gemini 💎 • Cohere 🌐)
                    </h4>
                    <span style={{ fontSize: 11.5, color: "#94A3B8" }}>
                      Génération automatique de photo studio & description vendeuse avec basculement automatique en cas de panne
                    </span>
                  </div>
                </div>
                {lastAiProvider && (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: "rgba(16, 185, 129, 0.2)",
                    color: "#34D399",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                    padding: "3px 10px",
                    borderRadius: 12
                  }}>
                    Moteur actif : {lastAiProvider}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="text"
                  className="bs-input"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#fff",
                    fontSize: 13
                  }}
                  placeholder="Consignes facultatives pour l'IA (ex: Coque antichoc mate avec bords renforcés pour Tecno Spark 20)"
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                />

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={aiLoading}
                    style={{
                      background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                      color: "#fff",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: aiLoading ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
                      opacity: aiLoading ? 0.8 : 1
                    }}
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Génération IA en cours (Groq ➔ Gemini ➔ Cohere)...
                      </>
                    ) : (
                      <>
                        <Wand2 size={16} />
                        Générer la photo studio & la description
                      </>
                    )}
                  </button>

                  <span style={{ fontSize: 11.5, color: "#64748B" }}>
                    {form.imageUrl ? "✓ Photo détectée : l'IA va générer une version studio et optimiser la fiche" : "💡 Uploadez d'abord une photo ci-dessous pour un rendu studio encore plus précis"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bs-input-group">
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Description du produit (Courte & Vendeuse)</span>
                <span style={{ fontSize: 11.5, color: "#2563EB", fontWeight: 700 }}>1 phrase + tirets percutants</span>
              </label>
              <textarea
                className="bs-input"
                style={{ minHeight: 110, resize: "vertical", lineHeight: 1.6 }}
                placeholder="Une phrase d'accroche sobre puis 3 ou 4 tirets simples sans émojis..."
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>

            <ImageUploader
              label="Photo Principale (Packshot Officiel)"
              value={form.imageUrl}
              onChange={(url) => set("imageUrl", url)}
              slot="principale"
              productContext={{
                nom: form.nom,
                marque: marques.find(m => String(m.id) === String(form.marqueId))?.nom || "",
                categorie: categories.find(c => String(c.id) === String(form.categoryId))?.nom || ""
              }}
            />

            <ImageUploader
              label="Photo Secondaire (Angle 45° & Détails)"
              value={form.imageUrl2}
              onChange={(url) => set("imageUrl2", url)}
              slot="secondaire"
              productContext={{
                nom: form.nom,
                marque: marques.find(m => String(m.id) === String(form.marqueId))?.nom || "",
                categorie: categories.find(c => String(c.id) === String(form.categoryId))?.nom || ""
              }}
            />

            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <button
                type="button"
                className="bs-btn-primary"
                style={{ background: "#E2E8E3", color: "var(--ink)", flex: 1 }}
                onClick={cancelEdit}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="bs-btn-primary"
                style={{ flex: 2 }}
                disabled={!form.nom || !form.categoryId}
              >
                {editingId ? "Enregistrer les modifications" : "Créer le produit"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL APPROVISIONNEMENT */}
      {restockProduct && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex",
          alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div className="bs-panel" style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "var(--forest-light)", padding: 8, borderRadius: 10, color: "var(--forest-dark)" }}>
                  <Package size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: "var(--forest-dark)" }}>Approvisionnement Produit</h3>
                  <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>{restockProduct.nom}</span>
                </div>
              </div>
              <button 
                onClick={() => setRestockProduct(null)} 
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10, border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>Stock Actuel: <strong>{restockProduct.stock} {restockProduct.unite}</strong></span>
                <span>Coût d'achat: <strong>{fcfa(restockProduct.coutAchat || 0)}</strong></span>
              </div>

              <div className="bs-input-group">
                <label>Fournisseur</label>
                <select
                  className="bs-select"
                  value={restockForm.fournisseurId}
                  onChange={(e) => setRestockForm(f => ({ ...f, fournisseurId: e.target.value }))}
                >
                  <option value="">-- Sélectionner un fournisseur (Optionnel) --</option>
                  {fournisseurs.map(f => (
                    <option key={f.id} value={f.id}>{f.nom || f.nomCompany || f.nomContact}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="bs-input-group">
                  <label>Quantité à ajouter *</label>
                  <input
                    className="bs-input"
                    type="number"
                    min="1"
                    required
                    value={restockForm.quantite}
                    onChange={(e) => setRestockForm(f => ({ ...f, quantite: e.target.value }))}
                  />
                </div>

                <div className="bs-input-group">
                  <label>Prix d'achat unitaire (€) *</label>
                  <input
                    className="bs-input"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={restockForm.prixAchatUnitaire}
                    onChange={(e) => setRestockForm(f => ({ ...f, prixAchatUnitaire: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ background: "var(--forest-light)", padding: "10px 14px", borderRadius: 8, fontSize: 13, color: "var(--forest-dark)", fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
                <span>Total de l'achat:</span>
                <span>{fcfa(Number(restockForm.quantite || 0) * Number(restockForm.prixAchatUnitaire || 0))}</span>
              </div>

              <div className="bs-input-group">
                <label>Notes / Référence facture (Optionnel)</label>
                <input
                  className="bs-input"
                  placeholder="ex: BL-2026-0917 ou Réapprovisionnement régulier"
                  value={restockForm.notes}
                  onChange={(e) => setRestockForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  className="bs-btn-primary"
                  style={{ background: "#E2E8E3", color: "var(--ink)", flex: 1 }}
                  onClick={() => setRestockProduct(null)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="bs-btn-primary"
                  style={{ flex: 2 }}
                  disabled={restockSubmitting}
                >
                  {restockSubmitting ? "Enregistrement..." : "Valider l'Approvisionnement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL COMPARATEUR PHOTO ORIGINALE vs STUDIO IA */}
      {aiPhotoModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16
        }}>
          <div style={{
            background: "#ffffff", borderRadius: 20, width: "100%", maxWidth: 720,
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
                    L'IA a généré une photo studio publicitaire
                  </h4>
                  <span style={{ fontSize: 11.5, color: "#94A3B8" }}>
                    Comparez avec votre photo actuelle et décidez quelle photo afficher sur la boutique
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiPhotoModal(null)}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* COMPARATEUR DEUX COLONNES */}
            <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Colonne 1 : Votre photo originale */}
              <div style={{
                border: "2px solid #CBD5E1", borderRadius: 14, padding: 14,
                background: "#F8FAFC", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center"
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, textTransform: "uppercase",
                  color: "#64748B", letterSpacing: "0.5px", marginBottom: 10
                }}>
                  1. Votre photo originale
                </span>
                <div style={{
                  width: "100%", height: 180, borderRadius: 10, background: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid #CBD5E1", overflow: "hidden", marginBottom: 14
                }}>
                  <img
                    src={aiPhotoModal.originalUrl}
                    alt="Photo originale"
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAiPhotoModal(null);
                    toast.success("Votre photo d'origine est conservée.");
                  }}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10,
                    background: "#F1F5F9", border: "1.5px solid #CBD5E1",
                    color: "#334155", fontWeight: 700, fontSize: 13,
                    cursor: "pointer"
                  }}
                >
                  Garder ma photo originale
                </button>
              </div>

              {/* Colonne 2 : Proposition Studio IA */}
              <div style={{
                border: "2px solid #3B82F6", borderRadius: 14, padding: 14,
                background: "#EFF6FF", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
                boxShadow: "0 8px 24px rgba(37,99,235,0.12)"
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, textTransform: "uppercase",
                  color: "#1D4ED8", letterSpacing: "0.5px", marginBottom: 10,
                  display: "flex", alignItems: "center", gap: 4
                }}>
                  <Sparkles size={13} color="#2563EB" /> 2. Photo Studio IA (Fond Blanc)
                </span>
                <div style={{
                  width: "100%", height: 180, borderRadius: 10, background: "#ffffff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid #93C5FD", overflow: "hidden", marginBottom: 14
                }}>
                  <img
                    src={aiPhotoModal.aiUrl}
                    alt="Photo Studio IA"
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(f => ({ ...f, imageUrl: aiPhotoModal.aiUrl, imageUrl2: f.imageUrl || f.imageUrl2 }));
                      setAiPhotoModal(null);
                      toast.success("Photo studio IA adoptée en photo principale !");
                    }}
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
                    onClick={() => {
                      setForm(f => ({ ...f, imageUrl2: aiPhotoModal.aiUrl }));
                      setAiPhotoModal(null);
                      toast.success("Photo IA conservée en photo secondaire !");
                    }}
                    style={{
                      width: "100%", padding: "7px 10px", borderRadius: 8,
                      background: "transparent", border: "1px solid #BFDBFE",
                      color: "#1E40AF", fontWeight: 700, fontSize: 11.5,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4
                    }}
                  >
                    Garder ma photo + mettre l'IA en 2ème photo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

