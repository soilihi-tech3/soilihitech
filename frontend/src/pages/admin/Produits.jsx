import { SkeletonTableRows } from "../../components/Skeleton.jsx";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { PlusCircle, List, Pencil, Trash2, AlertTriangle, CheckCircle, Package, X, Wand2, Sparkles, Loader2, Smartphone, Shield, Zap, Eye, EyeOff, CheckCircle2, Printer, Star, ChevronDown, ChevronRight, Plus, Palette, Layers } from "lucide-react";
import api from "../../api";
import ImageUploader from "../../components/ImageUploader.jsx";
import TablePagination from "../../components/TablePagination.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";

import { formatPrice, formatPrice as fcfa } from "../../utils/currency.js";

export default function AdminProduits() {
  const { boutique, user } = useAuth();
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const canAddEdit = isAdmin || perms.includes("ajouter_modifier_produit") || perms.includes("gerer_produits");
  const canDelete = isAdmin || perms.includes("supprimer_produit") || perms.includes("gerer_produits");

  const [activeTab, setActiveTab] = useState("liste"); // "liste" | "ajout"
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [familles, setFamilles] = useState([]);
  const [unites, setUnites] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [marques, setMarques] = useState([]);
  const [phoneBrands, setPhoneBrands] = useState([]);
  const [expandedPhoneBrands, setExpandedPhoneBrands] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  // Modal export PDF personnalisé avec sélection de colonnes
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfColumns, setPdfColumns] = useState({
    nom: true,
    marque: true,
    categorie: true,
    prixKMF: true,
    prixFCFA: true,
    coutAchat: true,
    stock: true,
    statut: true
  });

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
  const [filterVisibilite, setFilterVisibilite] = useState(""); // "" | "visible" | "masque"

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
    masquerSurSite: true, // Coché par défaut à l'ajout pour préparer le stock avant affichage sur le site
    noteEtoiles: "5",
    poids: "",
    unite: "pièce",
    coutAchat: "",
    stock: "20",
    seuilAlerte: 5,
    imageUrl: "",
    imageUrl2: "",
    images: [],
    couleurs: [],
    modelesCompatibles: []
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
    api.get("/admin/phones").then((res) => setPhoneBrands(res.data || [])).catch(() => {});
  }

  function load() {
    setLoading(true);
    api.get("/admin/products").then((res) => setProducts(res.data)).finally(() => setLoading(false));
    api.get("/admin/categories").then((res) => setCategories(res.data));
    api.get("/admin/familles").then((res) => setFamilles(res.data || [])).catch(() => {});
    api.get("/admin/unites").then((res) => setUnites(res.data || [])).catch(() => {});
    api.get("/admin/fournisseurs").then((res) => setFournisseurs(res.data || [])).catch(() => {});
    api.get("/admin/marques").then((res) => setMarques(res.data || [])).catch(() => {});
    api.get("/admin/phones").then((res) => setPhoneBrands(res.data || [])).catch(() => {});
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
      masquerSurSite: Boolean(product.masquerSurSite),
      noteEtoiles: product.noteEtoiles !== undefined && product.noteEtoiles !== null ? String(product.noteEtoiles) : "5",
      poids: product.poids || "",
      unite: product.unite || "pièce",
      coutAchat: product.coutAchat ?? "",
      stock: product.stock ?? "",
      seuilAlerte: product.seuilAlerte ?? 5,
      imageUrl: product.imageUrl || "",
      imageUrl2: product.imageUrl2 || "",
      images: parseJsonField(product.images),
      couleurs: parseJsonField(product.couleurs),
      modelesCompatibles: parseJsonField(product.modelesCompatibles)
    });
    setActiveTab("ajout");
  }

  function parseJsonField(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      try { return JSON.parse(val); } catch (e) { return []; }
    }
    return [];
  }

  // Helpers Galerie Photos
  function addGalleryImage() {
    setForm(f => ({ ...f, images: [...(f.images || []), ""] }));
  }
  function updateGalleryImage(index, url) {
    setForm(f => {
      const arr = [...(f.images || [])];
      arr[index] = url;
      return { ...f, images: arr };
    });
  }
  function removeGalleryImage(index) {
    setForm(f => ({ ...f, images: (f.images || []).filter((_, i) => i !== index) }));
  }

  // Helpers Couleurs
  function addColorVariant() {
    setForm(f => ({
      ...f,
      couleurs: [
        ...(f.couleurs || []),
        { nom: "", codeHex: "#1E40AF", imageUrl: "", prixKMF: "", prixFCFA: "", stock: "" }
      ]
    }));
  }
  function updateColorVariant(index, field, value) {
    setForm(f => {
      const arr = [...(f.couleurs || [])];
      arr[index] = { ...arr[index], [field]: value };
      return { ...f, couleurs: arr };
    });
  }
  function removeColorVariant(index) {
    setForm(f => ({
      ...f,
      couleurs: (f.couleurs || []).filter((_, i) => i !== index)
    }));
  }

  // Helpers Modèles de Téléphones
  function togglePhoneModel(brand, model) {
    setForm(f => {
      const current = f.modelesCompatibles || [];
      const exists = current.some(m => Number(m.modelId) === Number(model.id) || m.nom === model.nom);
      if (exists) {
        return {
          ...f,
          modelesCompatibles: current.filter(m => Number(m.modelId) !== Number(model.id) && m.nom !== model.nom)
        };
      } else {
        return {
          ...f,
          modelesCompatibles: [
            ...current,
            {
              brandId: brand.id,
              brandNom: brand.nom,
              modelId: model.id,
              nom: model.nom,
              nomComplet: model.nomComplet || `${brand.nom} ${model.nom}`,
              prixKMF: "",
              prixFCFA: ""
            }
          ]
        };
      }
    });
  }

  function toggleAllModelsForBrand(brand, shouldSelect) {
    setForm(f => {
      const current = f.modelesCompatibles || [];
      if (!shouldSelect) {
        return {
          ...f,
          modelesCompatibles: current.filter(m => Number(m.brandId) !== Number(brand.id))
        };
      } else {
        const brandModels = brand.modeles || [];
        const newToAdd = brandModels
          .filter(bm => !current.some(c => Number(c.modelId) === Number(bm.id) || c.nom === bm.nom))
          .map(bm => ({
            brandId: brand.id,
            brandNom: brand.nom,
            modelId: bm.id,
            nom: bm.nom,
            nomComplet: bm.nomComplet || `${brand.nom} ${bm.nom}`,
            prixKMF: "",
            prixFCFA: ""
          }));
        return {
          ...f,
          modelesCompatibles: [...current, ...newToAdd]
        };
      }
    });
  }

  function updateModelPrice(modelId, field, value) {
    setForm(f => {
      const current = f.modelesCompatibles || [];
      const updated = current.map(m => {
        if (Number(m.modelId) === Number(modelId) || m.nom === modelId) {
          return { ...m, [field]: value };
        }
        return m;
      });
      return { ...f, modelesCompatibles: updated };
    });
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
      masquerSurSite: Boolean(form.masquerSurSite),
      noteEtoiles: form.noteEtoiles !== "" ? Number(form.noteEtoiles) : 5.0,
      coutAchat: form.coutAchat !== "" ? Number(form.coutAchat) : 0,
      stock: form.stock !== "" ? Number(form.stock) : 0,
      seuilAlerte: form.seuilAlerte !== "" ? Number(form.seuilAlerte) : 5,
      categoryId: Number(form.categoryId),
      marqueId: form.marqueId ? Number(form.marqueId) : null,
      etat: form.etat || "neuf",
      poids: form.poids || "",
      famille: form.famille || "Accessoires",
      images: (form.images || []).filter(img => Boolean(img && img.trim())),
      couleurs: (form.couleurs || []).filter(c => Boolean(c.nom && c.nom.trim())),
      modelesCompatibles: form.modelesCompatibles || []
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

  async function toggleVisibility(product) {
    const newStatus = !product.masquerSurSite;
    try {
      await api.put(`/admin/products/${product.id}`, { masquerSurSite: newStatus });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, masquerSurSite: newStatus } : p))
      );
      showToast(
        newStatus
          ? "Produit masqué sur la boutique (gestion de stock uniquement)."
          : "Produit désormais visible sur la boutique en ligne !"
      );
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur inconnue.";
      showToast("Erreur visibilité : " + msg, "error");
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

  // Filter products by search query, category, low stock, etat, marque, visibilite
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
    const matchVisibilite = !filterVisibilite
      || (filterVisibilite === "masque" && Boolean(p.masquerSurSite))
      || (filterVisibilite === "visible" && !p.masquerSurSite);

    return matchSearch && matchCat && matchStock && matchGenre && matchMarque && matchVisibilite;
  });

  // Reset page to 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [search, filterCat, filterStock, filterGenre, filterMarque, filterVisibilite]);

  const totalItems = filteredProducts.length;

  // Règle stricte : 1 seul prix par article (Prix Promo s'il existe et > 0, sinon Prix Normal. Jamais les 2 additionnés et le prix barré n'est pas compté)
  const getProductPriceKMF = (p) => {
    const promo = Number(p.prixPromo || 0);
    if (promo > 0) return promo; // Uniquement le prix promo
    return Number(p.prix || 0);  // Sinon le seul prix normal
  };

  const getProductPriceFCFA = (p) => {
    const promo = Number(p.prixPromoSenegal || 0);
    if (promo > 0) return promo; // Uniquement le prix promo Sénégal
    return Number(p.prixSenegal || 0); // Sinon le seul prix normal Sénégal
  };

  const totalValeurComores = filteredProducts.reduce((sum, p) => {
    return sum + (getProductPriceKMF(p) * Number(p.stock || 0));
  }, 0);

  const totalValeurSenegal = filteredProducts.reduce((sum, p) => {
    return sum + (getProductPriceFCFA(p) * Number(p.stock || 0));
  }, 0);

  const totalUnitairesComores = filteredProducts.reduce((sum, p) => {
    return sum + getProductPriceKMF(p);
  }, 0);

  const totalUnitairesSenegal = filteredProducts.reduce((sum, p) => {
    return sum + getProductPriceFCFA(p);
  }, 0);

  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Exporter la liste des produits au format PDF imprimable avec colonnes personnalisées
  const handleGeneratePDF = (cols = pdfColumns) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour exporter le PDF.");
      return;
    }

    const totalStock = filteredProducts.reduce((sum, p) => sum + Number(p.stock || 0), 0);
    const valeurStock = filteredProducts.reduce((sum, p) => sum + (Number(p.stock || 0) * Number(p.coutAchat || 0)), 0);

    const thCells = [];
    if (cols.nom) thCells.push("<th>Nom du produit</th>");
    if (cols.marque) thCells.push("<th>Marque</th>");
    if (cols.categorie) thCells.push("<th>Catégorie</th>");
    if (cols.prixKMF) thCells.push("<th>Prix Comores (KMF)</th>");
    if (cols.prixFCFA) thCells.push("<th>Prix Sénégal (FCFA)</th>");
    if (cols.coutAchat) thCells.push("<th>Coût d'achat (FCFA)</th>");
    if (cols.stock) thCells.push("<th style=\"text-align: center;\">Stock</th>");
    if (cols.statut) thCells.push("<th style=\"text-align: center;\">Statut</th>");

    const rowsHtml = filteredProducts.map((p, idx) => {
      const marqueNom = p.marque?.nom || p.Marque?.nom || "Universel";
      const catNom = p.Category?.nom || "Non classé";
      const prixKMF = p.prixPromo ? `${formatPrice(p.prixPromo, "KMF")} (Promo)` : formatPrice(p.prix, "KMF");
      const prixFCFA = p.prixPromoSenegal ? `${formatPrice(p.prixPromoSenegal, "FCFA")} (Promo)` : (p.prixSenegal ? formatPrice(p.prixSenegal, "FCFA") : "—");
      const coutFCFA = formatPrice(p.coutAchat || 0, "FCFA");
      const statutStr = p.stock <= 0 ? "Rupture" : (p.enPromo ? "En Promo" : "En Stock");
      const statutColor = p.stock <= 0 ? "#dc2626" : (p.enPromo ? "#d97706" : "#059669");

      const tdCells = [];
      if (cols.nom) tdCells.push(`<td style="padding: 9px 12px; font-weight: 700; color: #1e293b;">${p.nom}</td>`);
      if (cols.marque) tdCells.push(`<td style="padding: 9px 12px; color: #1d4ed8; font-weight: 600;">${marqueNom}</td>`);
      if (cols.categorie) tdCells.push(`<td style="padding: 9px 12px; color: #475569;">${catNom}</td>`);
      if (cols.prixKMF) tdCells.push(`<td style="padding: 9px 12px; font-weight: 700; color: #059669;">${prixKMF}</td>`);
      if (cols.prixFCFA) tdCells.push(`<td style="padding: 9px 12px; font-weight: 700; color: #d97706;">${prixFCFA}</td>`);
      if (cols.coutAchat) tdCells.push(`<td style="padding: 9px 12px; color: #64748b;">${coutFCFA}</td>`);
      if (cols.stock) tdCells.push(`<td style="padding: 9px 12px; font-weight: 800; text-align: center; color: ${p.stock <= p.seuilAlerte ? "#dc2626" : "#1e293b"};">${p.stock} ${p.unite || "pièce"}</td>`);
      if (cols.statut) tdCells.push(`<td style="padding: 9px 12px; text-align: center; font-weight: 700; color: ${statutColor};">${statutStr}</td>`);

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 0 ? "background: #f8fafc;" : ""}">
          ${tdCells.join("")}
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
          .kpi-box { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
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
          ${cols.stock ? `
          <div class="kpi">
            <div class="kpi-title">Stock Total en Unités</div>
            <div class="kpi-value">${totalStock}</div>
          </div>` : ""}
          ${cols.coutAchat ? `
          <div class="kpi">
            <div class="kpi-title">Valeur Stock (Coût Achat FCFA)</div>
            <div class="kpi-value">${formatPrice(valeurStock, "FCFA")}</div>
          </div>` : ""}
        </div>

        <table>
          <thead>
            <tr>
              ${thCells.join("")}
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
            onClick={() => setShowPdfModal(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 24, fontSize: 13, fontWeight: 700,
              background: "var(--card)", border: "1.5px solid var(--line)",
              color: "var(--forest-dark)", cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "all 0.15s ease"
            }}
            title="Exporter l'inventaire complet des produits au format PDF personnalisé"
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
            {canAddEdit && (
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
            )}
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
              <div style={{ width: 1, background: "var(--line)" }}></div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 12, color: "var(--forest)", textTransform: "uppercase", fontWeight: 700 }}>Total Prix Comores</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "var(--forest-dark)" }}>{formatPrice(totalValeurComores, "KMF")}</span>
                <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Unitaire : {formatPrice(totalUnitairesComores, "KMF")}</span>
              </div>
              <div style={{ width: 1, background: "var(--line)" }}></div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 12, color: "#D97706", textTransform: "uppercase", fontWeight: 700 }}>Total Prix Sénégal</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "#92400E" }}>{formatPrice(totalValeurSenegal, "FCFA")}</span>
                <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Unitaire : {formatPrice(totalUnitairesSenegal, "FCFA")}</span>
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

              <select 
                className="bs-select" 
                style={{ width: 175 }} 
                value={filterVisibilite} 
                onChange={(e) => setFilterVisibilite(e.target.value)}
              >
                <option value="">Toute visibilité</option>
                <option value="visible">Visibles sur le site</option>
                <option value="masque">Masqués (Stock seul)</option>
              </select>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer", background: filterStock ? "#FAD2CD" : "var(--forest-light)", padding: "0 12px", borderRadius: 8, color: filterStock ? "#B4483A" : "var(--forest-dark)", fontWeight: 700, height: 40 }}>
                <input type="checkbox" checked={filterStock} onChange={(e) => setFilterStock(e.target.checked)} style={{ margin: 0 }} />
                Stock faible
              </label>
            </div>
          </div>

          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
            <table className="bs-table" style={{ minWidth: 1140 }}>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Nom du produit</th>
                <th>Marque</th>
                <th>Catégorie / Fournisseur</th>
                <th>Prix Vente Comores</th>
                <th>Prix Vente Sénégal</th>
                <th>Coût d'achat (FCFA)</th>
                <th>Stock</th>
                <th>Visibilité</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <SkeletonTableRows rows={6} cols={10} />
              )}
              {!loading && paginatedProducts.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
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
                        <Star size={11} fill="#F59E0B" color="#F59E0B" style={{ display: "inline-block" }} /> <strong>{(p.avis?.length ? (p.avis.reduce((s, a) => s + a.note, 0) / p.avis.length) : (p.noteEtoiles !== undefined && p.noteEtoiles !== null ? Number(p.noteEtoiles) : 5.0)).toFixed(1)}</strong>
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
                    <td style={{ color: "var(--muted)" }}>{formatPrice(p.coutAchat || 0, "FCFA")}</td>
                    <td className={p.stock <= p.seuilAlerte ? "bs-stock-low" : ""}>
                      <span style={{ fontWeight: 700 }}>{p.stock}</span> {p.unite}
                      {p.stock <= p.seuilAlerte && <AlertTriangle size={14} color="#B4483A" style={{ marginLeft: 6, verticalAlign: "-2px" }} />}
                    </td>

                    <td>
                      <button
                        type="button"
                        onClick={() => toggleVisibility(p)}
                        title={p.masquerSurSite ? "Produit masqué sur le site. Cliquez pour l'afficher sur la boutique." : "Produit visible sur le site. Cliquez pour le masquer."}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "4px 9px",
                          borderRadius: 20,
                          fontSize: 11.5,
                          fontWeight: 700,
                          border: p.masquerSurSite ? "1px solid #F59E0B" : "1px solid #10B981",
                          background: p.masquerSurSite ? "#FEF3C7" : "#ECFDF5",
                          color: p.masquerSurSite ? "#92400E" : "#065F46",
                          cursor: "pointer",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {p.masquerSurSite ? (
                          <>
                            <EyeOff size={13} color="#D97706" />
                            <span>Masqué (Stock)</span>
                          </>
                        ) : (
                          <>
                            <Eye size={13} color="#059669" />
                            <span>Visible</span>
                          </>
                        )}
                      </button>
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
                      {canAddEdit && (
                        <button className="bs-icon-btn" title="Modifier" onClick={() => startEdit(p)}><Pencil size={15} /></button>
                      )}
                      {" "}
                      {canDelete && (
                        <button className="bs-icon-btn" title="Supprimer" style={{ color: "#B4483A" }} onClick={() => deleteProduct(p.id)}><Trash2 size={15} /></button>
                      )}
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
            {/* OPTION DE VISIBILITÉ DU PRODUIT SUR LE SITE (STOCK EN ATTENTE) */}
            <div style={{
              background: form.masquerSurSite ? "#FFFBEB" : "#F8FAFC",
              padding: "16px 18px",
              borderRadius: 12,
              border: form.masquerSurSite ? "1.5px solid #F59E0B" : "1.5px solid #CBD5E1",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              transition: "all 0.2s ease"
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <input
                  type="checkbox"
                  id="masquerSurSite"
                  checked={Boolean(form.masquerSurSite)}
                  onChange={(e) => set("masquerSurSite", e.target.checked)}
                  style={{ width: 20, height: 20, accentColor: "#D97706", cursor: "pointer", marginTop: 2, flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <label htmlFor="masquerSurSite" style={{ fontWeight: 800, fontSize: 14.5, color: form.masquerSurSite ? "#92400E" : "#1E293B", cursor: "pointer", margin: 0 }}>
                      Ne pas afficher sur le site (Gérer le stock en attente)
                    </label>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: form.masquerSurSite ? "#FDE68A" : "#DCFCE7",
                      color: form.masquerSurSite ? "#78350F" : "#166534"
                    }}>
                      {form.masquerSurSite ? "Coché : Masqué sur le site" : "Décoché : Visible sur le site"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: form.masquerSurSite ? "#78350F" : "#64748B", marginTop: 5, lineHeight: 1.45 }}>
                    {form.masquerSurSite
                      ? "Ce produit sera enregistré dans votre application pour gérer le stock et les ventes internes, mais les clients NE LE VERRONT PAS sur la boutique en ligne. Décochez simplement cette case quand vous souhaiterez le mettre en ligne."
                      : "Le produit sera immédiatement visible et disponible à l'achat pour vos clients sur la boutique en ligne."}
                  </div>
                </div>
              </div>
            </div>

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

            {/* MARQUE DU PRODUIT */}
            <div className="bs-input-group" style={{ marginBottom: 4 }}>
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

            {/* SÉLECTEUR DYNAMIQUE DE MODÈLES DE TÉLÉPHONES COMPATIBLES */}
            <div style={{
              background: "var(--paper)",
              border: "1.5px solid var(--line)",
              borderRadius: 14,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <label style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                    <Smartphone size={18} color="var(--forest)" />
                    Modèles de Téléphones Compatibles (Gamme iPhone, Samsung, Tecno...)
                  </label>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    Cochez les téléphones compatibles avec cet article. Les clients pourront choisir leur modèle précis lors de la commande.
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 800,
                    padding: "3px 10px",
                    borderRadius: 12,
                    background: (form.modelesCompatibles || []).length > 0 ? "#DCFCE7" : "#F1F5F9",
                    color: (form.modelesCompatibles || []).length > 0 ? "#166534" : "#64748B"
                  }}>
                    {(form.modelesCompatibles || []).length} modèle(s) sélectionné(s)
                  </span>
                  <a
                    href="/admin/telephones"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: "var(--forest)", fontWeight: 700, textDecoration: "none" }}
                  >
                    + Gérer les téléphones
                  </a>
                </div>
              </div>

              {phoneBrands.length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", color: "var(--muted)", fontSize: 12.5, background: "rgba(0,0,0,0.02)", borderRadius: 10 }}>
                  Aucune marque de téléphone enregistrée. <a href="/admin/telephones" target="_blank" rel="noopener noreferrer" style={{ color: "var(--forest)", fontWeight: 700 }}>Créer des modèles de téléphones</a>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {phoneBrands.map(brand => {
                    const brandModels = brand.modeles || [];
                    const selectedForThisBrand = (form.modelesCompatibles || []).filter(m => Number(m.brandId) === Number(brand.id));
                    const isAllSelected = brandModels.length > 0 && selectedForThisBrand.length === brandModels.length;
                    const isExpanded = Boolean(expandedPhoneBrands[brand.id]);

                    return (
                      <div
                        key={brand.id}
                        style={{
                          border: selectedForThisBrand.length > 0 ? "1.5px solid var(--forest)" : "1px solid var(--line)",
                          borderRadius: 10,
                          overflow: "hidden",
                          background: selectedForThisBrand.length > 0 ? "#F8FCFA" : "#fff"
                        }}
                      >
                        {/* Header de la marque */}
                        <div
                          style={{
                            padding: "10px 14px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            background: selectedForThisBrand.length > 0 ? "var(--forest-light)" : "#F8FAFC",
                            cursor: "pointer"
                          }}
                          onClick={() => setExpandedPhoneBrands(prev => ({ ...prev, [brand.id]: !prev[brand.id] }))}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            <span style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)" }}>
                              {brand.nom}
                            </span>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>
                              ({selectedForThisBrand.length}/{brandModels.length} cochés)
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => toggleAllModelsForBrand(brand, !isAllSelected)}
                              style={{
                                background: isAllSelected ? "#FEE2E2" : "#DCFCE7",
                                color: isAllSelected ? "#991B1B" : "#166534",
                                border: "none",
                                borderRadius: 6,
                                padding: "4px 10px",
                                fontSize: 11.5,
                                fontWeight: 800,
                                cursor: "pointer"
                              }}
                            >
                              {isAllSelected ? "Tout décocher" : `Tout cocher (${brand.nom})`}
                            </button>
                          </div>
                        </div>

                        {/* Modèles de la marque */}
                        {isExpanded && (
                          <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line)" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                              {brandModels.map(model => {
                                const isChecked = (form.modelesCompatibles || []).some(m => Number(m.modelId) === Number(model.id) || m.nom === model.nom);
                                const modelItem = (form.modelesCompatibles || []).find(m => Number(m.modelId) === Number(model.id) || m.nom === model.nom) || {};

                                return (
                                  <div
                                    key={model.id}
                                    style={{
                                      border: isChecked ? "1.5px solid var(--forest)" : "1px solid var(--line)",
                                      borderRadius: 8,
                                      padding: "8px 10px",
                                      background: isChecked ? "#ECFDF5" : "#fff",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 6
                                    }}
                                  >
                                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", margin: 0, fontSize: 12.5, fontWeight: 700, color: isChecked ? "var(--forest-dark)" : "var(--ink)" }}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => togglePhoneModel(brand, model)}
                                        style={{ accentColor: "var(--forest)", width: 16, height: 16, cursor: "pointer" }}
                                      />
                                      <span>{model.nomComplet || model.nom}</span>
                                    </label>

                                    {/* Prix spécifique par modèle (optionnel) */}
                                    {isChecked && (
                                      <div style={{ display: "flex", gap: 6, marginTop: 4, paddingTop: 4, borderTop: "1px dashed #A7F3D0" }}>
                                        <input
                                          type="number"
                                          placeholder="Prix KMF (opt)"
                                          title="Prix spécifique Comores pour ce modèle"
                                          value={modelItem.prixKMF || ""}
                                          onChange={(e) => updateModelPrice(model.id, "prixKMF", e.target.value)}
                                          style={{ width: "50%", height: 26, fontSize: 11, padding: "2px 6px", borderRadius: 4, border: "1px solid #CBD5E1" }}
                                        />
                                        <input
                                          type="number"
                                          placeholder="Prix FCFA (opt)"
                                          title="Prix spécifique Sénégal pour ce modèle"
                                          value={modelItem.prixFCFA || ""}
                                          onChange={(e) => updateModelPrice(model.id, "prixFCFA", e.target.value)}
                                          style={{ width: "50%", height: 26, fontSize: 11, padding: "2px 6px", borderRadius: 4, border: "1px solid #CBD5E1" }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
                    set("categoryId", catId);
                    const availableForCat = familles.filter(f => Number(f.categoryId) === catId);
                    if (availableForCat.length > 0 && !availableForCat.some(f => f.nom === form.famille)) {
                      set("famille", availableForCat[0].nom);
                    }
                  }}
                >
                  <option value="">-- Sélectionner la catégorie --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.nom}</option>
                  ))}
                </select>
              </div>

              <div className="bs-input-group">
                <label>Sous-catégorie *</label>
                <select
                  className="bs-select"
                  required
                  value={form.famille}
                  onChange={(e) => set("famille", e.target.value)}
                >
                  <option value="">-- Sélectionner la sous-catégorie --</option>
                  {familles
                    .filter(f => !form.categoryId || Number(f.categoryId) === Number(form.categoryId) || !f.categoryId)
                    .map((f) => (
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
                  <label htmlFor="noteEtoiles" style={{ fontWeight: 700, fontSize: 13.5, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Star size={15} fill="#F59E0B" color="#F59E0B" /> Note du produit (Qualité par défaut)
                  </label>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    Attribuez une note initiale entre 1 et 5 (ex: 5.0 / 5 pour une note maximale).
                  </div>
                </div>
                <select
                  id="noteEtoiles"
                  className="bs-select"
                  style={{ width: 170, fontWeight: 700 }}
                  value={form.noteEtoiles}
                  onChange={(e) => set("noteEtoiles", e.target.value)}
                >
                  <option value="5">5.0 / 5 (Excellent)</option>
                  <option value="4.5">4.5 / 5 (Très bon)</option>
                  <option value="4">4.0 / 5 (Très bon)</option>
                  <option value="3.5">3.5 / 5 (Bon)</option>
                  <option value="3">3.0 / 5 (Moyen)</option>
                  <option value="2.5">2.5 / 5</option>
                  <option value="2">2.0 / 5</option>
                  <option value="1">1.0 / 5</option>
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
                      Assistant IA Soilihitech (Groq • Gemini • Cohere)
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
                        Génération IA en cours (Groq -&gt; Gemini -&gt; Cohere)...
                      </>
                    ) : (
                      <>
                        <Wand2 size={16} />
                        Générer la photo studio & la description
                      </>
                    )}
                  </button>

                  <span style={{ fontSize: 11.5, color: "#64748B" }}>
                    {form.imageUrl ? "Photo détectée : l'IA va générer une version studio et optimiser la fiche" : "Astuce : Uploadez d'abord une photo ci-dessous pour un rendu studio encore plus précis"}
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

            {/* SECTION VARIANTES DE COULEURS */}
            <div style={{
              background: "var(--paper)",
              border: "1.5px solid var(--line)",
              borderRadius: 14,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <label style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                    <Palette size={18} color="var(--forest)" />
                    Variantes de Couleurs (Photos & Prix spécifiques par couleur)
                  </label>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    Ajoutez les coloris disponibles. Le client pourra cliquer sur chaque couleur sur le site pour voir la photo correspondante et le prix adapté.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addColorVariant}
                  style={{
                    background: "var(--forest)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "7px 14px",
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <Plus size={14} /> + Ajouter une couleur
                </button>
              </div>

              {(form.couleurs || []).length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", color: "var(--muted)", fontSize: 12.5, background: "rgba(0,0,0,0.02)", borderRadius: 10 }}>
                  Aucune variante de couleur définie. Cliquez sur "+ Ajouter une couleur" si ce produit existe en plusieurs coloris (ex: Bleu Royal, Noir Titane, etc.).
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(form.couleurs || []).map((couleur, cIdx) => (
                    <div
                      key={cIdx}
                      style={{
                        background: "#F8FAFC",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        padding: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="color"
                            value={couleur.codeHex || "#1E40AF"}
                            onChange={(e) => updateColorVariant(cIdx, "codeHex", e.target.value)}
                            title="Choisir la teinte de couleur"
                            style={{ width: 34, height: 34, border: "none", borderRadius: 6, cursor: "pointer", padding: 0 }}
                          />
                        </div>

                        <input
                          type="text"
                          className="bs-input"
                          placeholder="Nom de la couleur (ex: Bleu Royal, Noir, Transparent...)"
                          value={couleur.nom || ""}
                          onChange={(e) => updateColorVariant(cIdx, "nom", e.target.value)}
                          style={{ flex: 2, minWidth: 160, height: 36, fontSize: 13 }}
                        />

                        <input
                          type="text"
                          className="bs-input"
                          placeholder="Lien photo pour cette couleur (URL ou upload)"
                          value={couleur.imageUrl || ""}
                          onChange={(e) => updateColorVariant(cIdx, "imageUrl", e.target.value)}
                          style={{ flex: 3, minWidth: 200, height: 36, fontSize: 13 }}
                        />

                        <button
                          type="button"
                          onClick={() => removeColorVariant(cIdx)}
                          className="bs-icon-btn"
                          title="Supprimer cette couleur"
                          style={{ color: "#B4483A" }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
                        <span style={{ color: "var(--muted)", fontWeight: 700 }}>Prix spécifique pour cette couleur (optionnel) :</span>
                        <input
                          type="number"
                          placeholder="Prix Comores KMF"
                          value={couleur.prixKMF || ""}
                          onChange={(e) => updateColorVariant(cIdx, "prixKMF", e.target.value)}
                          style={{ width: 140, height: 30, fontSize: 12, padding: "2px 8px", borderRadius: 6, border: "1px solid var(--line)" }}
                        />
                        <input
                          type="number"
                          placeholder="Prix Sénégal FCFA"
                          value={couleur.prixFCFA || ""}
                          onChange={(e) => updateColorVariant(cIdx, "prixFCFA", e.target.value)}
                          style={{ width: 140, height: 30, fontSize: 12, padding: "2px 8px", borderRadius: 6, border: "1px solid var(--line)" }}
                        />
                        {couleur.imageUrl && (
                          <img
                            src={couleur.imageUrl}
                            alt=""
                            style={{ width: 30, height: 30, borderRadius: 6, objectFit: "cover", border: "1px solid var(--line)" }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION GALERIE MULTI-PHOTOS ADDITIONNELLES */}
            <div style={{
              background: "var(--paper)",
              border: "1.5px solid var(--line)",
              borderRadius: 14,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <label style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                    <Layers size={18} color="var(--forest)" />
                    Galerie Multi-Photos Additionnelles (Bouton + Ajouter une photo)
                  </label>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    Ajoutez autant de photos que vous le souhaitez pour enrichir la fiche produit et permettre aux clients de faire défiler toutes les vues.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addGalleryImage}
                  style={{
                    background: "var(--forest)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "7px 14px",
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <Plus size={14} /> + Ajouter une photo
                </button>
              </div>

              {(form.images || []).length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", color: "var(--muted)", fontSize: 12.5, background: "rgba(0,0,0,0.02)", borderRadius: 10 }}>
                  Aucune photo additionnelle. Les 2 photos principales ci-dessus s'appliqueront par défaut. Cliquez sur "+ Ajouter une photo" pour créer votre carrousel complet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(form.images || []).map((imgUrl, imgIdx) => (
                    <div
                      key={imgIdx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: "#F8FAFC",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        padding: "8px 12px"
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", minWidth: 70 }}>
                        Photo #{imgIdx + 3} :
                      </span>

                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt=""
                          style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", border: "1px solid var(--line)" }}
                        />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 6, background: "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--muted)" }}>
                          Vide
                        </div>
                      )}

                      <input
                        type="text"
                        className="bs-input"
                        placeholder="Collez l'URL de l'image..."
                        value={imgUrl || ""}
                        onChange={(e) => updateGalleryImage(imgIdx, e.target.value)}
                        style={{ flex: 1, height: 36, fontSize: 13 }}
                      />

                      <button
                        type="button"
                        onClick={() => removeGalleryImage(imgIdx)}
                        className="bs-icon-btn"
                        title="Supprimer cette photo"
                        style={{ color: "#B4483A" }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                  <label>Prix d'achat unitaire (FCFA) *</label>
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

      {/* MODAL SÉLECTION DES COLONNES POUR IMPRESSION / PDF */}
      {showPdfModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16
        }}>
          <div style={{
            background: "#ffffff", borderRadius: 20, width: "100%", maxWidth: 520,
            overflow: "hidden", boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
            border: "1px solid var(--line)"
          }}>
            <div style={{
              padding: "20px 24px", borderBottom: "1px solid var(--line)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "var(--paper)"
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: "var(--forest-dark)", fontWeight: 800 }}>
                  Export PDF & Impression
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                  Choisissez les colonnes à inclure dans le document
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 24 }}>
              {/* Presets rapides */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setPdfColumns({
                    nom: true, marque: true, categorie: true, prixKMF: true, prixFCFA: true, coutAchat: true, stock: true, statut: true
                  })}
                  style={{
                    padding: "6px 12px", borderRadius: 8, border: "1px solid var(--line)",
                    background: "#f1f5f9", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "var(--ink)"
                  }}
                >
                  Tout cocher
                </button>
                <button
                  type="button"
                  onClick={() => setPdfColumns({
                    nom: true, marque: true, categorie: true, prixKMF: true, prixFCFA: true, coutAchat: false, stock: true, statut: true
                  })}
                  style={{
                    padding: "6px 12px", borderRadius: 8, border: "1px solid #bfdbfe",
                    background: "#eff6ff", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#1d4ed8"
                  }}
                >
                  Usage Client (Sans coût achat)
                </button>
                <button
                  type="button"
                  onClick={() => setPdfColumns({
                    nom: true, marque: false, categorie: false, prixKMF: true, prixFCFA: true, coutAchat: true, stock: true, statut: false
                  })}
                  style={{
                    padding: "6px 12px", borderRadius: 8, border: "1px solid #fed7aa",
                    background: "#fff7ed", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#c2410c"
                  }}
                >
                  Tarifs & Stocks Seuls
                </button>
              </div>

              {/* Liste des colonnes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                {[
                  { key: "nom", label: "Nom du produit" },
                  { key: "marque", label: "Marque" },
                  { key: "categorie", label: "Catégorie" },
                  { key: "prixKMF", label: "Prix Comores (KMF)" },
                  { key: "prixFCFA", label: "Prix Sénégal (FCFA)" },
                  { key: "coutAchat", label: "Coût d'Achat (FCFA)" },
                  { key: "stock", label: "Stock & Unité" },
                  { key: "statut", label: "Statut (En stock / Promo)" },
                ].map(col => (
                  <label
                    key={col.key}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                      borderRadius: 10, border: "1px solid",
                      borderColor: pdfColumns[col.key] ? "var(--forest)" : "var(--line)",
                      background: pdfColumns[col.key] ? "var(--forest-light)" : "#fff",
                      cursor: "pointer", fontSize: 13, fontWeight: pdfColumns[col.key] ? 700 : 500,
                      color: pdfColumns[col.key] ? "var(--forest-dark)" : "var(--ink)"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!pdfColumns[col.key]}
                      onChange={(e) => setPdfColumns(prev => ({ ...prev, [col.key]: e.target.checked }))}
                      style={{ accentColor: "var(--forest)" }}
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowPdfModal(false)}
                  style={{
                    flex: 1, padding: "12px", borderRadius: 12, border: "1px solid var(--line)",
                    background: "#fff", fontWeight: 600, cursor: "pointer", color: "var(--ink)"
                  }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPdfModal(false);
                    handleGeneratePDF(pdfColumns);
                  }}
                  className="bs-btn-primary"
                  style={{
                    flex: 1.5, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8
                  }}
                >
                  <Printer size={16} />
                  Générer et Imprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

