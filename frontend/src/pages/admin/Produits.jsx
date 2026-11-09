import { SkeletonTableRows } from "../../components/Skeleton.jsx";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { PlusCircle, List, Pencil, Trash2, AlertTriangle, CheckCircle, Package, X, Wand2, Sparkles, Loader2, Smartphone, Shield, Zap, Eye, EyeOff, CheckCircle2, Printer, Star, ChevronDown, ChevronRight, Plus, Palette, Layers, Upload, Link as LinkIcon, Building, User } from "lucide-react";
import api from "../../api";
import ImageUploader from "../../components/ImageUploader.jsx";
import TablePagination from "../../components/TablePagination.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";

import { formatPrice, formatPrice as fcfa, getBoutiqueCurrencies, getBoutiqueCurrencyCodes, getCurrencyMeta } from "../../utils/currency.js";

export default function AdminProduits() {
  const { boutique, user, myBoutiques = [], activeBoutiqueId } = useAuth();
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  const isAdmin = user?.role === "admin" || user?.role === "super_admin" || user?.role === "superadmin";
  const isMultiBoutiqueAdmin = user?.role === "admin" && myBoutiques.length > 1;
  const canAddEdit = isAdmin || perms.includes("ajouter_modifier_produit") || perms.includes("gerer_produits");
  const canDelete = isAdmin || perms.includes("supprimer_produit") || perms.includes("gerer_produits");
  const canRestock = isAdmin || perms.includes("approvisionner_produit") || perms.includes("achats_stocks");
  const canHideProduct = isAdmin || perms.includes("cacher_produit") || perms.includes("ajouter_modifier_produit") || perms.includes("gerer_produits");
  const [filterBoutiqueId, setFilterBoutiqueId] = useState("");
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    api.get("/admin/employees")
      .then(res => setEmployees(res.data || []))
      .catch(() => {});
  }, []);

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
  const [filterCreePar, setFilterCreePar] = useState("");
  const [filterBoutiqueDirect, setFilterBoutiqueDirect] = useState("");

  // Modal d'approvisionnement
  const [restockProduct, setRestockProduct] = useState(null);
  const [restockForm, setRestockForm] = useState({
    fournisseurId: "",
    quantite: 10,
    prixAchatUnitaire: 0,
    notes: ""
  });
  const [restockSubmitting, setRestockSubmitting] = useState(false);

  // Modal d'inspection du stock des variantes (coin d'œil)
  const [selectedProductForVariantView, setSelectedProductForVariantView] = useState(null);

  const initialForm = {
    nom: "",
    boutiqueId: activeBoutiqueId || boutique?.id || "",
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
    prixParDevise: {},
    prixPromoParDevise: {},
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
    hasMarque: false,
    images: [],
    couleurs: [],
    senteurs: [],
    typeVarianteNom: "Senteur",
    modelesCompatibles: []
  };
  const [form, setForm] = useState(initialForm);

  const currentBoutiqueObj = myBoutiques.find(b => Number(b.id) === Number(form.boutiqueId || activeBoutiqueId || boutique?.id)) || boutique;
  const boutiqueCurrencies = getBoutiqueCurrencies(boutique);
  const formBoutiqueCurrencies = getBoutiqueCurrencies(currentBoutiqueObj);

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

  function buildProductsUrl(overrideBoutiqueFilter = filterBoutiqueId) {
    const params = new URLSearchParams();
    params.set("_t", String(Date.now()));
    if (isMultiBoutiqueAdmin) {
      if (overrideBoutiqueFilter === "all") {
        params.set("allMyBoutiques", "true");
      } else if (overrideBoutiqueFilter) {
        params.set("filterBoutiqueId", String(overrideBoutiqueFilter));
      }
    }
    return `/admin/products?${params.toString()}`;
  }

  function silentSyncProducts(overrideFilter = filterBoutiqueId) {
    api.get(buildProductsUrl(overrideFilter)).then((res) => {
      const list = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      setProducts(list);
    }).catch(() => {});
    api.get("/admin/categories").then((res) => setCategories(res.data)).catch(() => {});
    api.get("/admin/familles").then((res) => setFamilles(res.data || [])).catch(() => {});
    api.get("/admin/unites").then((res) => setUnites(res.data || [])).catch(() => {});
    api.get("/admin/fournisseurs").then((res) => setFournisseurs(res.data || [])).catch(() => {});
    api.get("/admin/marques").then((res) => setMarques(res.data || [])).catch(() => {});
    api.get("/admin/phones").then((res) => setPhoneBrands(res.data || [])).catch(() => {});
  }

  function load(overrideFilter = filterBoutiqueId) {
    setLoading(true);
    api.get(buildProductsUrl(overrideFilter)).then((res) => {
      const list = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      setProducts(list);
    }).finally(() => setLoading(false));
    api.get("/admin/categories").then((res) => setCategories(res.data));
    api.get("/admin/familles").then((res) => setFamilles(res.data || [])).catch(() => {});
    api.get("/admin/unites").then((res) => setUnites(res.data || [])).catch(() => {});
    api.get("/admin/fournisseurs").then((res) => setFournisseurs(res.data || [])).catch(() => {});
    api.get("/admin/marques").then((res) => setMarques(res.data || [])).catch(() => {});
    api.get("/admin/phones").then((res) => setPhoneBrands(res.data || [])).catch(() => {});
  }

  useEffect(() => {
    load(filterBoutiqueId);
    const unsub = subscribeRealtime((detail) => {
      const t = detail?.type || detail;
      if (
        t === "product_updated" ||
        t === "product_created" ||
        t === "product_deleted" ||
        t === "category_updated" ||
        t === "achat_updated"
      ) {
        silentSyncProducts(filterBoutiqueId);
      }
    });
    const onBoutiqueSwitch = () => load(filterBoutiqueId);
    window.addEventListener("boutique_switched", onBoutiqueSwitch);
    return () => {
      unsub();
      window.removeEventListener("boutique_switched", onBoutiqueSwitch);
    };
  }, [filterBoutiqueId, activeBoutiqueId]);

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
    const rawPrixParDevise = (product.prixParDevise && typeof product.prixParDevise === "object")
      ? { ...product.prixParDevise }
      : {};
    const rawPrixPromoParDevise = (product.prixPromoParDevise && typeof product.prixPromoParDevise === "object")
      ? { ...product.prixPromoParDevise }
      : {};
    if (product.prix !== undefined && product.prix !== null && rawPrixParDevise.KMF === undefined) {
      rawPrixParDevise.KMF = product.prix;
    }
    if (product.prixSenegal !== undefined && product.prixSenegal !== null && rawPrixParDevise.FCFA === undefined) {
      rawPrixParDevise.FCFA = product.prixSenegal;
    }
    if (product.prixPromo !== undefined && product.prixPromo !== null && rawPrixPromoParDevise.KMF === undefined) {
      rawPrixPromoParDevise.KMF = product.prixPromo;
    }
    if (product.prixPromoSenegal !== undefined && product.prixPromoSenegal !== null && rawPrixPromoParDevise.FCFA === undefined) {
      rawPrixPromoParDevise.FCFA = product.prixPromoSenegal;
    }

    setForm({
      nom: product.nom || "",
      boutiqueId: product.boutiqueId || activeBoutiqueId || boutique?.id || "",
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
      prixParDevise: rawPrixParDevise,
      prixPromoParDevise: rawPrixPromoParDevise,
      enPromo: Boolean(product.enPromo || product.prixPromo || Object.values(rawPrixPromoParDevise).some(v => Number(v) > 0)),
      isNouveau: Boolean(product.isNouveau),
      masquerSurSite: Boolean(product.masquerSurSite),
      noteEtoiles: product.noteEtoiles !== undefined && product.noteEtoiles !== null ? String(product.noteEtoiles) : "5",
      poids: product.poids || "",
      unite: product.unite || "pièce",
      coutAchat: product.coutAchat ?? "",
      stock: product.stock ?? "",
      seuilAlerte: product.seuilAlerte ?? 5,
      hasMarque: Boolean(product.marqueId),
      imageUrl: product.imageUrl || "",
      imageUrl2: product.imageUrl2 || "",
      images: parseJsonField(product.images),
      couleurs: parseJsonField(product.couleurs),
      senteurs: parseJsonField(product.senteurs),
      typeVarianteNom: product.typeVarianteNom || "Senteur",
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

  function getProductVariantsList(p) {
    if (!p) return [];
    const list = [];
    const modeles = parseJsonField(p.modelesCompatibles);
    const couleurs = parseJsonField(p.couleurs);
    const senteurs = parseJsonField(p.senteurs);

    modeles.forEach((m, idx) => {
      const nom = typeof m === "string" ? m : (m.nomComplet || m.nom || m.modele || `Modèle ${idx + 1}`);
      const stk = typeof m === "object" && (m.quantite !== undefined || m.stock !== undefined)
        ? Number(m.quantite !== undefined ? m.quantite : m.stock)
        : Number(p.stock || 0);
      const photo = typeof m === "object" ? (m.photo || m.photoUrl || m.image || null) : null;
      const prix = typeof m === "object" && m.prix ? Number(m.prix) : null;
      list.push({
        type: "Modèle",
        nom,
        stock: stk,
        photo: photo || p.imageUrl,
        prix
      });
    });

    couleurs.forEach((c, idx) => {
      const nom = typeof c === "string" ? c : (c.nom || c.couleur || `Couleur ${idx + 1}`);
      const stk = typeof c === "object" && (c.quantite !== undefined || c.stock !== undefined)
        ? Number(c.quantite !== undefined ? c.quantite : c.stock)
        : Number(p.stock || 0);
      const photo = typeof c === "object" ? (c.photo || c.photoUrl || c.image || null) : null;
      list.push({
        type: "Couleur",
        nom,
        stock: stk,
        photo: photo || p.imageUrl,
        prix: null
      });
    });

    senteurs.forEach((s, idx) => {
      const nom = typeof s === "string" ? s : (s.nom || s.senteur || `Senteur ${idx + 1}`);
      const stk = typeof s === "object" && (s.quantite !== undefined || s.stock !== undefined)
        ? Number(s.quantite !== undefined ? s.quantite : s.stock)
        : Number(p.stock || 0);
      const photo = typeof s === "object" ? (s.photo || s.photoUrl || s.image || null) : null;
      list.push({
        type: "Senteur",
        nom,
        stock: stk,
        photo: photo || p.imageUrl,
        prix: null
      });
    });

    return list;
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

  // Helpers Senteurs / Fragrances
  function addSenteurVariant() {
    setForm(f => ({
      ...f,
      senteurs: [
        ...(f.senteurs || []),
        { nom: "", imageUrl: "", prixKMF: "", prixFCFA: "", stock: "" }
      ]
    }));
  }
  function updateSenteurVariant(index, field, value) {
    setForm(f => {
      const arr = [...(f.senteurs || [])];
      arr[index] = { ...arr[index], [field]: value };
      return { ...f, senteurs: arr };
    });
  }
  function removeSenteurVariant(index) {
    setForm(f => ({
      ...f,
      senteurs: (f.senteurs || []).filter((_, i) => i !== index)
    }));
  }

  // Helper compression d'image pour variante (téléphone ou ordinateur)
  function handleVariantImageUpload(file, onDone) {
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const maxDim = 1000;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL("image/jpeg", 0.82);
          onDone(base64);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'import de la photo.");
    }
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
              prixFCFA: "",
              quantite: "",
              stock: ""
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
            prixFCFA: "",
            quantite: "",
            stock: ""
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

    const generalStock = form.stock !== "" ? Number(form.stock) : 0;

    // Vérifier que la quantité de chaque couleur ne dépasse pas le stock général
    for (const c of (form.couleurs || [])) {
      if (c.nom && c.nom.trim()) {
        const qte = c.quantite !== undefined && c.quantite !== "" ? Number(c.quantite) : (c.stock !== undefined && c.stock !== "" ? Number(c.stock) : null);
        if (qte !== null && qte > generalStock) {
          toast.error(`La quantité de la couleur "${c.nom}" (${qte}) ne peut pas dépasser le stock général du produit (${generalStock}).`);
          return;
        }
      }
    }

    // Vérifier que la quantité de chaque senteur ne dépasse pas le stock général
    for (const s of (form.senteurs || [])) {
      if (s.nom && s.nom.trim()) {
        const qte = s.quantite !== undefined && s.quantite !== "" ? Number(s.quantite) : (s.stock !== undefined && s.stock !== "" ? Number(s.stock) : null);
        if (qte !== null && qte > generalStock) {
          toast.error(`La quantité de la variante "${s.nom}" (${qte}) ne peut pas dépasser le stock général du produit (${generalStock}).`);
          return;
        }
      }
    }

    // Vérifier que la quantité de chaque modèle de smartphone ne dépasse pas le stock général
    for (const m of (form.modelesCompatibles || [])) {
      const qte = m.quantite !== undefined && m.quantite !== "" ? Number(m.quantite) : (m.stock !== undefined && m.stock !== "" ? Number(m.stock) : null);
      if (qte !== null && qte > generalStock) {
        toast.error(`La quantité du modèle "${m.nomComplet || m.nom}" (${qte}) ne peut pas dépasser le stock général du produit (${generalStock}).`);
        return;
      }
    }

    // Sanitize: empty string → 0 or null
    const cleanPrixParDevise = {};
    const cleanPrixPromoParDevise = {};
    formBoutiqueCurrencies.forEach((cur, idx) => {
      const code = cur.code;
      const rawVal = form.prixParDevise?.[code] !== undefined
        ? form.prixParDevise[code]
        : (code === "KMF" ? form.prix : code === "FCFA" ? form.prixSenegal : (idx === 0 ? form.prix : ""));
      if (rawVal !== "" && rawVal !== null && rawVal !== undefined) {
        cleanPrixParDevise[code] = Number(rawVal);
      }
      const rawPromo = form.prixPromoParDevise?.[code] !== undefined
        ? form.prixPromoParDevise[code]
        : (code === "KMF" ? form.prixPromo : code === "FCFA" ? form.prixPromoSenegal : (idx === 0 ? form.prixPromo : ""));
      if (form.enPromo && rawPromo !== "" && rawPromo !== null && rawPromo !== undefined && Number(rawPromo) > 0) {
        cleanPrixPromoParDevise[code] = Number(rawPromo);
      } else {
        cleanPrixPromoParDevise[code] = null;
      }
    });

    const primaryCurrencyCode = formBoutiqueCurrencies[0]?.code || "KMF";
    const resolvedPrix = cleanPrixParDevise.KMF !== undefined
      ? cleanPrixParDevise.KMF
      : (cleanPrixParDevise[primaryCurrencyCode] !== undefined ? cleanPrixParDevise[primaryCurrencyCode] : (form.prix !== "" ? Number(form.prix) : 0));
    const resolvedPrixPromo = form.enPromo
      ? (cleanPrixPromoParDevise.KMF ?? cleanPrixPromoParDevise[primaryCurrencyCode] ?? (form.prixPromo !== "" && form.prixPromo !== null ? Number(form.prixPromo) : null))
      : null;
    const resolvedPrixSenegal = cleanPrixParDevise.FCFA !== undefined
      ? cleanPrixParDevise.FCFA
      : (form.prixSenegal !== "" && form.prixSenegal !== null ? Number(form.prixSenegal) : null);
    const resolvedPrixPromoSenegal = form.enPromo
      ? (cleanPrixPromoParDevise.FCFA ?? (form.prixPromoSenegal !== "" && form.prixPromoSenegal !== null ? Number(form.prixPromoSenegal) : null))
      : null;

    const payload = {
      ...form,
      boutiqueId: form.boutiqueId ? Number(form.boutiqueId) : (activeBoutiqueId || boutique?.id),
      prix: resolvedPrix,
      prixPromo: resolvedPrixPromo,
      prixSenegal: resolvedPrixSenegal,
      prixPromoSenegal: resolvedPrixPromoSenegal,
      prixParDevise: cleanPrixParDevise,
      prixPromoParDevise: cleanPrixPromoParDevise,
      enPromo: Boolean(form.enPromo),
      isNouveau: Boolean(form.isNouveau),
      masquerSurSite: Boolean(form.masquerSurSite),
      noteEtoiles: form.noteEtoiles !== "" ? Number(form.noteEtoiles) : 5.0,
      coutAchat: form.coutAchat !== "" ? Number(form.coutAchat) : 0,
      stock: generalStock,
      seuilAlerte: form.seuilAlerte !== "" ? Number(form.seuilAlerte) : 5,
      categoryId: Number(form.categoryId),
      marqueId: form.hasMarque && form.marqueId ? Number(form.marqueId) : null,
      etat: form.etat || "neuf",
      poids: form.poids || "",
      famille: form.famille || "Accessoires",
      images: (form.images || []).filter(img => Boolean(img && img.trim())),
      couleurs: (form.couleurs || []).filter(c => Boolean(c.nom && c.nom.trim())).map(c => {
        const val = c.quantite !== "" && c.quantite !== undefined && c.quantite !== null ? Number(c.quantite) : (c.stock !== "" && c.stock !== undefined && c.stock !== null ? Number(c.stock) : null);
        return { ...c, quantite: val, stock: val };
      }),
      senteurs: (form.senteurs || []).filter(s => Boolean(s.nom && s.nom.trim())).map(s => {
        const val = s.quantite !== "" && s.quantite !== undefined && s.quantite !== null ? Number(s.quantite) : (s.stock !== "" && s.stock !== undefined && s.stock !== null ? Number(s.stock) : null);
        return { ...s, quantite: val, stock: val };
      }),
      typeVarianteNom: form.typeVarianteNom ? form.typeVarianteNom.trim() : "Senteur",
      modelesCompatibles: (form.modelesCompatibles || []).map(m => {
        const val = m.quantite !== "" && m.quantite !== undefined && m.quantite !== null ? Number(m.quantite) : (m.stock !== "" && m.stock !== undefined && m.stock !== null ? Number(m.stock) : null);
        return { ...m, quantite: val, stock: val };
      })
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
    if (!canHideProduct) {
      showToast("Vous n'avez pas l'autorisation de modifier la visibilité des produits.", "error");
      return;
    }
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
    if (!canRestock) {
      showToast("Vous n'avez pas l'autorisation d'approvisionner les stocks.", "error");
      return;
    }
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
  const [pageSize, setPageSize] = useState(20);

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
    const creatorName = p.creePar?.nom || "Admin Boutique";
    const matchCreePar = !filterCreePar || String(p.creeParId || p.creePar?.id) === String(filterCreePar) || creatorName === filterCreePar;
    const prodBoutiqueNom = p.boutique?.nom || myBoutiques.find(b => Number(b.id) === Number(p.boutiqueId))?.nom || boutique?.nom || "Boutique";
    const matchBoutiqueDirect = !filterBoutiqueDirect || String(p.boutiqueId || p.boutique?.id) === String(filterBoutiqueDirect) || prodBoutiqueNom === filterBoutiqueDirect;

    return matchSearch && matchCat && matchStock && matchGenre && matchMarque && matchVisibilite && matchCreePar && matchBoutiqueDirect;
  });

  // Reset page to 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [search, filterCat, filterStock, filterGenre, filterMarque, filterVisibilite, filterCreePar, filterBoutiqueDirect]);

  // Extraction dynamique et robuste de la liste des personnes ayant enregistré des produits
  const creatorsMap = new Map();
  const mainAdminNom = boutique?.admin?.nom || user?.nom || "Admin Boutique";
  creatorsMap.set(mainAdminNom, { id: mainAdminNom, nom: mainAdminNom, role: "Admin" });
  
  (employees || []).forEach(emp => {
    creatorsMap.set(emp.nom, {
      id: emp.nom,
      nom: emp.nom,
      role: emp.role === "admin" ? "Admin" : "Employé"
    });
  });

  products.forEach(p => {
    if (p.creePar?.nom) {
      creatorsMap.set(p.creePar.nom, {
        id: p.creePar.nom,
        nom: p.creePar.nom,
        role: p.creePar.role === "employe" ? "Employé" : p.creePar.role === "super_admin" ? "Super Admin" : "Admin"
      });
    } else if (p.creeParId) {
      const fallbackNom = `Utilisateur #${p.creeParId}`;
      if (!creatorsMap.has(fallbackNom)) {
        creatorsMap.set(fallbackNom, {
          id: fallbackNom,
          nom: fallbackNom,
          role: "Auteur"
        });
      }
    }
  });
  const creatorsList = Array.from(creatorsMap.values());

  // Extraction dynamique et robuste de la liste des boutiques
  const boutiquesMap = new Map();
  if (boutique?.nom) {
    boutiquesMap.set(boutique.nom, { id: boutique.nom, nom: boutique.nom });
  }
  (myBoutiques || []).forEach(b => {
    if (b.nom) boutiquesMap.set(b.nom, { id: b.nom, nom: b.nom });
  });
  products.forEach(p => {
    if (p.boutique?.nom) {
      boutiquesMap.set(p.boutique.nom, { id: p.boutique.nom, nom: p.boutique.nom });
    }
  });
  const availableBoutiquesList = Array.from(boutiquesMap.values());

  const totalItems = filteredProducts.length;

  // Règle stricte : 1 seul prix par article par devise (Prix Promo s'il existe et > 0, sinon Prix Normal)
  const getProductEffectivePriceForCurrency = (p, currencyCode, isFirstCurrency = false) => {
    const code = String(currencyCode || "KMF").toUpperCase();
    const mapNormal = (p.prixParDevise && typeof p.prixParDevise === "object") ? p.prixParDevise : {};
    const mapPromo = (p.prixPromoParDevise && typeof p.prixPromoParDevise === "object") ? p.prixPromoParDevise : {};

    let normalVal = mapNormal[code];
    let promoVal = mapPromo[code];

    if (normalVal === undefined || normalVal === null || normalVal === "") {
      if (code === "KMF") normalVal = p.prix;
      else if (code === "FCFA") normalVal = p.prixSenegal;
      else if (isFirstCurrency) normalVal = p.prix;
    }
    if (promoVal === undefined || promoVal === null || promoVal === "") {
      if (code === "KMF") promoVal = p.prixPromo;
      else if (code === "FCFA") promoVal = p.prixPromoSenegal;
      else if (isFirstCurrency) promoVal = p.prixPromo;
    }

    const numNormal = Number(normalVal || 0);
    const numPromo = Number(promoVal || 0);
    const hasPromo = Boolean((p.enPromo || numPromo > 0) && numPromo > 0 && (numNormal === 0 || numPromo < numNormal));
    return {
      normal: numNormal,
      promo: hasPromo ? numPromo : null,
      effective: hasPromo ? numPromo : numNormal
    };
  };

  const totalsByCurrency = {};
  boutiqueCurrencies.forEach((cur, idx) => {
    const code = cur.code;
    const totalValeur = filteredProducts.reduce((sum, p) => {
      const { effective } = getProductEffectivePriceForCurrency(p, code, idx === 0);
      return sum + (effective * Number(p.stock || 0));
    }, 0);
    const totalUnitaire = filteredProducts.reduce((sum, p) => {
      const { effective } = getProductEffectivePriceForCurrency(p, code, idx === 0);
      return sum + effective;
    }, 0);
    totalsByCurrency[code] = { totalValeur, totalUnitaire };
  });

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
                <span style={{ fontSize: 24, fontWeight: 800, color: "#B4483A" }}>{filteredProducts.filter(p => Number(p.stock) <= Number(p.seuilAlerte)).length}</span>
              </div>
              {boutiqueCurrencies.map((cur) => {
                const stats = totalsByCurrency[cur.code] || { totalValeur: 0, totalUnitaire: 0 };
                return (
                  <React.Fragment key={cur.code}>
                    <div style={{ width: 1, background: "var(--line)" }}></div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 12, color: cur.color || "var(--forest)", textTransform: "uppercase", fontWeight: 700 }}>
                        Valeur Stock ({cur.shortLabel || cur.code})
                      </span>
                      <span style={{ fontSize: 24, fontWeight: 800, color: cur.color || "var(--forest-dark)" }}>
                        {formatPrice(stats.totalValeur, cur.code)}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                        Unitaire : {formatPrice(stats.totalUnitaire, cur.code)}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
            
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input 
                className="bs-input" 
                style={{ flex: 1, minWidth: 200 }} 
                placeholder="Rechercher un produit, catégorie ou marque..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
              {isMultiBoutiqueAdmin && (
                <select
                  className="bs-select"
                  style={{ width: 210, fontWeight: 700, borderColor: "var(--forest)" }}
                  value={filterBoutiqueId}
                  onChange={(e) => setFilterBoutiqueId(e.target.value)}
                >
                  <option value="">Boutique active ({boutique?.nom})</option>
                  <option value="all">🌐 Toutes mes boutiques ({myBoutiques.length})</option>
                  {myBoutiques.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      🏪 {b.nom}
                    </option>
                  ))}
                </select>
              )}
              <select
                className="bs-select"
                style={{ width: 175, fontWeight: 600 }}
                value={filterBoutiqueDirect}
                onChange={(e) => setFilterBoutiqueDirect(e.target.value)}
              >
                <option value="">Toutes les boutiques ({availableBoutiquesList.length})</option>
                {availableBoutiquesList.map(b => (
                  <option key={b.id} value={b.nom}>{b.nom}</option>
                ))}
              </select>

              <select
                className="bs-select"
                style={{ width: 185, fontWeight: 600 }}
                value={filterCreePar}
                onChange={(e) => setFilterCreePar(e.target.value)}
              >
                <option value="">Tous les auteurs ({creatorsList.length})</option>
                {creatorsList.map(c => (
                  <option key={c.id} value={c.nom}>{c.nom} ({c.role})</option>
                ))}
              </select>

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
            <table className="bs-table" style={{ minWidth: 1280 }}>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Nom du produit</th>
                <th>Boutique</th>
                <th>Enregistré par</th>
                <th>Marque</th>
                <th>Catégorie / Fournisseur</th>
                {boutiqueCurrencies.map((cur) => (
                  <th key={cur.code}>Prix Vente ({cur.code})</th>
                ))}
                <th>Coût d'achat (FCFA)</th>
                <th>Stock</th>
                <th>Visibilité</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <SkeletonTableRows rows={6} cols={10 + boutiqueCurrencies.length} />
              )}
              {!loading && paginatedProducts.length === 0 && (
                <tr>
                  <td colSpan={10 + boutiqueCurrencies.length} style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                    Aucun produit ne correspond à votre recherche.
                  </td>
                </tr>
              )}
              {!loading && paginatedProducts.map((p) => {
                const supplierName = p.fournisseur ? (p.fournisseur.nom || p.fournisseur.nomCompany || p.fournisseur.nomContact) : null;
                const marqueNom = p.marque?.nom || p.Marque?.nom;
                const productBoutiqueNom = p.boutique?.nom || myBoutiques.find(b => Number(b.id) === Number(p.boutiqueId))?.nom || boutique?.nom || "Boutique";
                const creatorName = p.creePar?.nom || "Admin Boutique";
                const creatorRoleLabel = p.creePar?.role === "employe" ? "Employé" : p.creePar?.role === "super_admin" ? "Super Admin" : "Admin";
                return (
                  <tr key={p.id}>
                    <td style={{ width: 60 }}>
                      <img
                        src={p.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=100&q=80"}
                        alt={p.nom}
                        style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover", border: "1px solid var(--line)" }}
                      />
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--ink)", minWidth: 180 }}>
                      <div>{p.nom}</div>
                      <div style={{ fontSize: 11.5, color: "#F59E0B", marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}>
                        <Star size={11} fill="#F59E0B" color="#F59E0B" style={{ display: "inline-block" }} /> <strong>{(p.avis?.length ? (p.avis.reduce((s, a) => s + a.note, 0) / p.avis.length) : (p.noteEtoiles !== undefined && p.noteEtoiles !== null ? Number(p.noteEtoiles) : 5.0)).toFixed(1)}</strong>
                        <span style={{ color: "var(--muted)", fontWeight: 400 }}>({p.avis?.length || 0} avis)</span>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11.5, fontWeight: 700, padding: "4px 9px", borderRadius: 8,
                        background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE",
                        display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap"
                      }}>
                        <Building size={12} /> {productBoutiqueNom}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "inline-flex", flexDirection: "column" }}>
                        <span style={{
                          fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 8,
                          background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1",
                          whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5
                        }}>
                          <User size={11} /> {creatorName}
                        </span>
                        <span style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2, paddingLeft: 4 }}>
                          {creatorRoleLabel}
                        </span>
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
                    {boutiqueCurrencies.map((cur, idx) => {
                      const priceData = getProductEffectivePriceForCurrency(p, cur.code, idx === 0);
                      return (
                        <td key={cur.code}>
                          {priceData.promo ? (
                            <>
                              <span style={{ textDecoration: "line-through", color: "var(--muted)", marginRight: 6, fontSize: 13 }}>
                                {formatPrice(priceData.normal, cur.code)}
                              </span>
                              <span style={{ color: cur.color || "var(--accent)", fontWeight: 800 }}>
                                {formatPrice(priceData.promo, cur.code)}
                              </span>
                            </>
                          ) : priceData.normal > 0 ? (
                            <span style={{ fontWeight: 800, color: cur.color || "var(--ink)" }}>
                              {formatPrice(priceData.normal, cur.code)}
                            </span>
                          ) : (
                            <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                          )}
                          {idx === 0 && p.unite ? <span style={{ color: "var(--muted)", fontSize: 11.5 }}> / {p.unite}</span> : null}
                        </td>
                      );
                    })}
                    <td style={{ color: "var(--muted)" }}>{formatPrice(p.coutAchat || 0, "FCFA")}</td>
                    <td className={p.stock <= p.seuilAlerte ? "bs-stock-low" : ""}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                        <div>
                          <span style={{ fontWeight: 700 }}>{p.stock}</span> {p.unite}
                          {p.stock <= p.seuilAlerte && <AlertTriangle size={14} color="#B4483A" style={{ marginLeft: 6, verticalAlign: "-2px" }} />}
                        </div>

                        {getProductVariantsList(p).length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedProductForVariantView(p)}
                            title="Voir le stock détaillé de chaque variante (couleur, modèle, senteur...)"
                            style={{
                              background: "#EFF6FF", border: "1.5px solid #BFDBFE", color: "#2563EB",
                              padding: "2px 7px", borderRadius: 8, fontSize: 11, fontWeight: 800,
                              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0
                            }}
                          >
                            <Eye size={12} />
                            <span>{getProductVariantsList(p).length}</span>
                          </button>
                        )}
                      </div>
                    </td>

                    <td>
                      <button
                        type="button"
                        onClick={() => toggleVisibility(p)}
                        title={!canHideProduct ? "Autorisation requise pour modifier la visibilité" : (p.masquerSurSite ? "Produit masqué sur le site. Cliquez pour l'afficher sur la boutique." : "Produit visible sur le site. Cliquez pour le masquer.")}
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
                          cursor: canHideProduct ? "pointer" : "not-allowed",
                          opacity: canHideProduct ? 1 : 0.7,
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
                      {canRestock && (
                        <button
                          className="bs-icon-btn"
                          title="Approvisionner (Réappro stock)"
                          style={{ color: "var(--forest)", marginRight: 4 }}
                          onClick={() => openRestockModal(p)}
                        >
                          <Package size={15} />
                        </button>
                      )}
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
                  disabled={!canHideProduct}
                  onChange={(e) => {
                    if (!canHideProduct) {
                      showToast("Vous n'avez pas l'autorisation de modifier la visibilité des produits.", "error");
                      return;
                    }
                    set("masquerSurSite", e.target.checked);
                  }}
                  style={{ width: 20, height: 20, accentColor: "#D97706", cursor: canHideProduct ? "pointer" : "not-allowed", marginTop: 2, flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <label htmlFor="masquerSurSite" style={{ fontWeight: 800, fontSize: 14.5, color: form.masquerSurSite ? "#92400E" : "#1E293B", cursor: canHideProduct ? "pointer" : "not-allowed", margin: 0 }}>
                      Ne pas afficher sur le site (Gérer le stock en attente)
                    </label>
                    {!canHideProduct && (
                      <span style={{ fontSize: 11, color: "#B4483A", fontWeight: 700 }}>(Autorisation requise)</span>
                    )}
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

            {isMultiBoutiqueAdmin && (
              <div style={{
                background: "#EFF6FF",
                border: "1.5px solid #93C5FD",
                borderRadius: 12,
                padding: "14px 16px"
              }}>
                <label style={{ fontWeight: 800, fontSize: 13.5, color: "#1E3A8A", display: "block", marginBottom: 6 }}>
                  🏪 Boutique de destination du produit *
                </label>
                <select
                  className="bs-select"
                  value={form.boutiqueId || activeBoutiqueId || boutique?.id || ""}
                  onChange={(e) => set("boutiqueId", Number(e.target.value))}
                  style={{ background: "#fff", fontWeight: 700 }}
                >
                  {myBoutiques.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nom} — Devises : {(b.devisesDisponibles || [b.devise || "KMF"]).join(" + ")}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11.5, color: "#1D4ED8", marginTop: 4 }}>
                  Ce produit sera enregistré dans la boutique sélectionnée et tracé sous votre compte ({user?.nom || "Admin"}).
                </div>
              </div>
            )}

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

            {/* MARQUE DU PRODUIT (OPTIONNELLE) */}
            <div style={{
              background: form.hasMarque ? "#F0FDF4" : "var(--paper)",
              border: form.hasMarque ? "1.5px solid #86EFAC" : "1px solid var(--line)",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 4,
              transition: "all 0.2s"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", margin: 0, fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.hasMarque)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setForm(f => ({
                        ...f,
                        hasMarque: checked,
                        marqueId: checked ? (f.marqueId || (marques[0]?.id || "")) : ""
                      }));
                    }}
                    style={{ width: 17, height: 17, accentColor: "var(--forest)", cursor: "pointer" }}
                  />
                  <span>Associer une marque à ce produit</span>
                </label>
                {form.hasMarque && (
                  <a href="/admin/marques" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--forest)", fontWeight: 700, textDecoration: "none" }}>
                    + Gérer les marques
                  </a>
                )}
              </div>

              {form.hasMarque && (
                <div style={{ marginTop: 10 }}>
                  <select
                    className="bs-select"
                    value={form.marqueId}
                    onChange={(e) => set("marqueId", e.target.value)}
                    style={{ height: 42, background: "#fff" }}
                  >
                    <option value="">-- Sélectionner la marque --</option>
                    {marques.map((m) => (
                      <option key={m.id} value={m.id}>{m.nom}</option>
                    ))}
                  </select>
                </div>
              )}
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

                                    {/* Prix spécifique et Stock par modèle (optionnel) */}
                                    {isChecked && (
                                      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4, paddingTop: 4, borderTop: "1px dashed #A7F3D0" }}>
                                        <div style={{ display: "flex", gap: 6 }}>
                                          <input
                                            type="number"
                                            placeholder="Prix KMF"
                                            title="Prix spécifique Comores pour ce modèle"
                                            value={modelItem.prixKMF || ""}
                                            onChange={(e) => updateModelPrice(model.id, "prixKMF", e.target.value)}
                                            style={{ width: "50%", height: 26, fontSize: 11, padding: "2px 6px", borderRadius: 4, border: "1px solid #CBD5E1" }}
                                          />
                                          <input
                                            type="number"
                                            placeholder="Prix FCFA"
                                            title="Prix spécifique Sénégal pour ce modèle"
                                            value={modelItem.prixFCFA || ""}
                                            onChange={(e) => updateModelPrice(model.id, "prixFCFA", e.target.value)}
                                            style={{ width: "50%", height: 26, fontSize: 11, padding: "2px 6px", borderRadius: 4, border: "1px solid #CBD5E1" }}
                                          />
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--forest-dark)", whiteSpace: "nowrap" }}>Stock dispo :</span>
                                          <input
                                            type="number"
                                            min="0"
                                            placeholder="Quantité"
                                            title="Quantité en stock pour ce modèle (ne doit pas dépasser le stock général)"
                                            value={modelItem.quantite ?? modelItem.stock ?? ""}
                                            onChange={(e) => {
                                              updateModelPrice(model.id, "quantite", e.target.value);
                                              updateModelPrice(model.id, "stock", e.target.value);
                                            }}
                                            style={{ width: "100%", height: 24, fontSize: 11, padding: "1px 6px", borderRadius: 4, border: "1px solid #CBD5E1", background: "#fff", fontWeight: 700 }}
                                          />
                                        </div>
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

            {/* PROMO & TARIFS DYNAMIQUES SELON LES DEVISES AUTORISÉES PAR LE SUPER ADMIN */}
            <div style={{ background: "var(--paper)", padding: 16, borderRadius: 12, border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                <span style={{
                  fontSize: 11.5, fontWeight: 800, padding: "4px 10px", borderRadius: 20,
                  background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0"
                }}>
                  {formBoutiqueCurrencies.length === 1
                    ? `1 Devise configurée : ${formBoutiqueCurrencies[0].code}`
                    : `${formBoutiqueCurrencies.length} Devises configurées : ${formBoutiqueCurrencies.map(c => c.code).join(" + ")}`}
                </span>
              </div>

              {formBoutiqueCurrencies.map((cur, idx) => {
                const code = cur.code;
                const isFirst = idx === 0;
                const isLast = idx === formBoutiqueCurrencies.length - 1;
                const currentNormal = form.prixParDevise?.[code] !== undefined
                  ? form.prixParDevise[code]
                  : (code === "KMF" ? form.prix : code === "FCFA" ? form.prixSenegal : (isFirst ? form.prix : ""));
                const currentPromo = form.prixPromoParDevise?.[code] !== undefined
                  ? form.prixPromoParDevise[code]
                  : (code === "KMF" ? form.prixPromo : code === "FCFA" ? form.prixPromoSenegal : (isFirst ? form.prixPromo : ""));

                const handleNormalChange = (val) => {
                  setForm(prev => {
                    const nextMap = { ...(prev.prixParDevise || {}), [code]: val };
                    const updates = { prixParDevise: nextMap };
                    if (code === "KMF" || isFirst) updates.prix = val;
                    if (code === "FCFA") updates.prixSenegal = val;
                    return { ...prev, ...updates };
                  });
                };

                const handlePromoChange = (val) => {
                  setForm(prev => {
                    const nextMap = { ...(prev.prixPromoParDevise || {}), [code]: val };
                    const updates = { prixPromoParDevise: nextMap };
                    if (code === "KMF" || isFirst) updates.prixPromo = val;
                    if (code === "FCFA") updates.prixPromoSenegal = val;
                    return { ...prev, ...updates };
                  });
                };

                return (
                  <div
                    key={code}
                    style={{
                      marginBottom: isLast ? 0 : 14,
                      paddingBottom: isLast ? 0 : 14,
                      borderBottom: isLast ? "none" : "1px dashed var(--line)"
                    }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: cur.color || "#2563EB", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>Tarifs {cur.label} {isFirst ? "*" : ""}</span>
                      {!isFirst && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>
                          (Affiché lorsque la devise {code} est sélectionnée)
                        </span>
                      )}
                    </div>
                    <div className="bs-form-row-3">
                      <div className="bs-input-group">
                        <label>Prix Vente ({code}) {isFirst ? "*" : ""}</label>
                        <input
                          className="bs-input"
                          type="number"
                          step="any"
                          required={isFirst}
                          placeholder={`ex: ${code === "EUR" || code === "USD" ? "29.90" : "6500"}`}
                          value={currentNormal}
                          onChange={(e) => handleNormalChange(e.target.value)}
                        />
                      </div>

                      <div className="bs-input-group">
                        <label>Prix Promo ({code})</label>
                        <input
                          className="bs-input"
                          type="number"
                          step="any"
                          disabled={!form.enPromo}
                          placeholder={`ex: ${code === "EUR" || code === "USD" ? "24.90" : "5500"}`}
                          value={currentPromo}
                          onChange={(e) => handlePromoChange(e.target.value)}
                        />
                      </div>

                      <div className="bs-input-group">
                        <label>Réduction ({code})</label>
                        <div style={{
                          height: 44, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
                          padding: "0 14px", background: cur.bg || "#E0F2FE", borderRadius: 8, border: `1.5px solid ${cur.border || "#BAE6FD"}`,
                          fontWeight: 800, color: cur.color || "#0369A1", fontSize: 13, textAlign: "center"
                        }}>
                          {form.enPromo && currentPromo && Number(currentNormal) > 0 && Number(currentPromo) < Number(currentNormal) ? (
                            `-${Math.round(((Number(currentNormal) - Number(currentPromo)) / Number(currentNormal)) * 100)} % de remise`
                          ) : (
                            "Aucune promo active"
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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

                        <div style={{ flex: 3, minWidth: 220, display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            type="text"
                            className="bs-input"
                            placeholder="Lien photo (URL)"
                            value={couleur.imageUrl || ""}
                            onChange={(e) => updateColorVariant(cIdx, "imageUrl", e.target.value)}
                            style={{ flex: 1, height: 36, fontSize: 12.5 }}
                          />
                          <label
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "0 10px",
                              height: 36,
                              background: "#fff",
                              border: "1px solid var(--line)",
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              color: "var(--forest-dark)",
                              cursor: "pointer",
                              whiteSpace: "nowrap"
                            }}
                            title="Importer depuis l'appareil ou téléphone"
                          >
                            <Upload size={14} color="var(--forest)" />
                            Appareil
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleVariantImageUpload(f, (base64) => updateColorVariant(cIdx, "imageUrl", base64));
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>

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
                        <span style={{ color: "var(--muted)", fontWeight: 700 }}>Prix (optionnel) :</span>
                        <input
                          type="number"
                          placeholder="Prix Comores KMF"
                          value={couleur.prixKMF || ""}
                          onChange={(e) => updateColorVariant(cIdx, "prixKMF", e.target.value)}
                          style={{ width: 130, height: 30, fontSize: 12, padding: "2px 8px", borderRadius: 6, border: "1px solid var(--line)" }}
                        />
                        <input
                          type="number"
                          placeholder="Prix Sénégal FCFA"
                          value={couleur.prixFCFA || ""}
                          onChange={(e) => updateColorVariant(cIdx, "prixFCFA", e.target.value)}
                          style={{ width: 130, height: 30, fontSize: 12, padding: "2px 8px", borderRadius: 6, border: "1px solid var(--line)" }}
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: "var(--forest-dark)", fontWeight: 700 }}>Stock dispo :</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="Quantité"
                            title="Quantité en stock pour cette couleur (ne doit pas dépasser le stock général)"
                            value={couleur.quantite ?? couleur.stock ?? ""}
                            onChange={(e) => {
                              updateColorVariant(cIdx, "quantite", e.target.value);
                              updateColorVariant(cIdx, "stock", e.target.value);
                            }}
                            style={{ width: 100, height: 30, fontSize: 12, padding: "2px 8px", borderRadius: 6, border: "1px solid var(--line)", background: "#fff", fontWeight: 700 }}
                          />
                        </div>
                        {couleur.imageUrl && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <img
                              src={couleur.imageUrl}
                              alt=""
                              style={{ width: 30, height: 30, borderRadius: 6, objectFit: "cover", border: "1px solid var(--line)" }}
                            />
                            <button
                              type="button"
                              onClick={() => updateColorVariant(cIdx, "imageUrl", "")}
                              style={{ border: "none", background: "none", color: "#B4483A", fontSize: 11, cursor: "pointer", padding: 0 }}
                            >
                              Retirer photo
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION VARIANTES DE SENTEURS / FRAGRANCES (POUR PARFUMS, COSMETIQUES, ETC.) */}
            <div style={{
              background: "var(--paper)",
              border: "1.5px solid var(--line)",
              borderRadius: 14,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <label style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                    <Sparkles size={18} color="var(--forest)" />
                    Variantes de Senteurs / Fragrances (ou options spécifiques)
                  </label>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    Idéal pour les parfums, brumes, cosmétiques ou articles sans couleur. Le client cliquera sur la senteur pour voir sa photo et son prix.
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Titre sur le site :</span>
                    <input
                      type="text"
                      className="bs-input"
                      value={form.typeVarianteNom || "Senteur"}
                      onChange={(e) => set("typeVarianteNom", e.target.value)}
                      placeholder="ex: Senteur, Fragrance, Parfum..."
                      style={{ width: 130, height: 32, fontSize: 12, padding: "2px 8px" }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={addSenteurVariant}
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
                    <Plus size={14} /> + Ajouter une senteur
                  </button>
                </div>
              </div>

              {(form.senteurs || []).length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", color: "var(--muted)", fontSize: 12.5, background: "rgba(0,0,0,0.02)", borderRadius: 10 }}>
                  Aucune variante de senteur définie. Cliquez sur "+ Ajouter une senteur" pour ce produit (ex: Marshmallow Blush, Vanille Gourmande, Oud Royal...).
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(form.senteurs || []).map((senteur, sIdx) => (
                    <div
                      key={sIdx}
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
                        <input
                          type="text"
                          className="bs-input"
                          placeholder={`Nom (${form.typeVarianteNom || 'senteur'}) (ex: Marshmallow Blush, Vanille Bourbon, etc.)`}
                          value={senteur.nom || ""}
                          onChange={(e) => updateSenteurVariant(sIdx, "nom", e.target.value)}
                          style={{ flex: 2, minWidth: 180, height: 36, fontSize: 13 }}
                        />

                        <div style={{ flex: 3, minWidth: 220, display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            type="text"
                            className="bs-input"
                            placeholder="Lien photo (URL)"
                            value={senteur.imageUrl || ""}
                            onChange={(e) => updateSenteurVariant(sIdx, "imageUrl", e.target.value)}
                            style={{ flex: 1, height: 36, fontSize: 12.5 }}
                          />
                          <label
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "0 10px",
                              height: 36,
                              background: "#fff",
                              border: "1px solid var(--line)",
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              color: "var(--forest-dark)",
                              cursor: "pointer",
                              whiteSpace: "nowrap"
                            }}
                            title="Importer depuis l'appareil ou téléphone"
                          >
                            <Upload size={14} color="var(--forest)" />
                            Appareil
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleVariantImageUpload(f, (base64) => updateSenteurVariant(sIdx, "imageUrl", base64));
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeSenteurVariant(sIdx)}
                          className="bs-icon-btn"
                          title="Supprimer cette senteur"
                          style={{ color: "#B4483A" }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
                        <span style={{ color: "var(--muted)", fontWeight: 700 }}>Prix (optionnel) :</span>
                        <input
                          type="number"
                          placeholder="Prix Comores KMF"
                          value={senteur.prixKMF || ""}
                          onChange={(e) => updateSenteurVariant(sIdx, "prixKMF", e.target.value)}
                          style={{ width: 130, height: 30, fontSize: 12, padding: "2px 8px", borderRadius: 6, border: "1px solid var(--line)" }}
                        />
                        <input
                          type="number"
                          placeholder="Prix Sénégal FCFA"
                          value={senteur.prixFCFA || ""}
                          onChange={(e) => updateSenteurVariant(sIdx, "prixFCFA", e.target.value)}
                          style={{ width: 130, height: 30, fontSize: 12, padding: "2px 8px", borderRadius: 6, border: "1px solid var(--line)" }}
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: "var(--forest-dark)", fontWeight: 700 }}>Stock dispo :</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="Quantité"
                            title={`Quantité en stock pour cette ${form.typeVarianteNom || 'senteur'} (ne doit pas dépasser le stock général)`}
                            value={senteur.quantite ?? senteur.stock ?? ""}
                            onChange={(e) => {
                              updateSenteurVariant(sIdx, "quantite", e.target.value);
                              updateSenteurVariant(sIdx, "stock", e.target.value);
                            }}
                            style={{ width: 100, height: 30, fontSize: 12, padding: "2px 8px", borderRadius: 6, border: "1px solid var(--line)", background: "#fff", fontWeight: 700 }}
                          />
                        </div>
                        {senteur.imageUrl && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <img
                              src={senteur.imageUrl}
                              alt=""
                              style={{ width: 30, height: 30, borderRadius: 6, objectFit: "cover", border: "1px solid var(--line)" }}
                            />
                            <button
                              type="button"
                              onClick={() => updateSenteurVariant(sIdx, "imageUrl", "")}
                              style={{ border: "none", background: "none", color: "#B4483A", fontSize: 11, cursor: "pointer", padding: 0 }}
                            >
                              Retirer photo
                            </button>
                          </div>
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

      {/* MODAL DU COIN D'OEIL / STOCK DÉTAILLÉ DES VARIANTES */}
      {selectedProductForVariantView && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div style={{
            background: "#fff", borderRadius: 20, width: "100%", maxWidth: 640,
            maxHeight: "88vh", overflowY: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
            animation: "popIn 0.2s ease-out"
          }}>
            {/* EN-TÊTE MODAL */}
            <div style={{
              padding: "16px 20px", background: "linear-gradient(135deg, #1E293B, #0F172A)",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img
                  src={selectedProductForVariantView.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=80&q=80"}
                  alt={selectedProductForVariantView.nom}
                  style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }}
                />
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>
                    {selectedProductForVariantView.nom}
                  </h3>
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>
                    Stock global : <strong>{selectedProductForVariantView.stock} {selectedProductForVariantView.unite}</strong> · Stock détaillé par variante
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProductForVariantView(null)}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* CORPS : TABLE DES VARIANTES */}
            <div style={{ padding: 20 }}>
              {(() => {
                const variants = getProductVariantsList(selectedProductForVariantView);
                if (variants.length === 0) {
                  return (
                    <div style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>
                      Aucune variante spécifique enregistrée pour ce produit.
                    </div>
                  );
                }

                return (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
                          <th style={{ padding: "10px 12px", fontSize: 11.5, fontWeight: 800, color: "#64748B" }}>VISUEL</th>
                          <th style={{ padding: "10px 12px", fontSize: 11.5, fontWeight: 800, color: "#64748B" }}>TYPE</th>
                          <th style={{ padding: "10px 12px", fontSize: 11.5, fontWeight: 800, color: "#64748B" }}>NOM VARIANTE</th>
                          <th style={{ padding: "10px 12px", fontSize: 11.5, fontWeight: 800, color: "#64748B" }}>PRIX SPÉCIFIQUE</th>
                          <th style={{ padding: "10px 12px", fontSize: 11.5, fontWeight: 800, color: "#64748B", textAlign: "right" }}>STOCK DISPONIBLE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variants.map((v, i) => {
                          const isLow = v.stock <= (selectedProductForVariantView.seuilAlerte || 5);
                          const isOut = v.stock <= 0;

                          return (
                            <tr key={i} style={{ borderBottom: "1px solid #E2E8F0" }}>
                              <td style={{ padding: "10px 12px", width: 50 }}>
                                <img
                                  src={v.photo || selectedProductForVariantView.imageUrl}
                                  alt={v.nom}
                                  style={{ width: 38, height: 38, borderRadius: 8, objectFit: "cover", background: "#F1F5F9", border: "1px solid #E2E8F0" }}
                                />
                              </td>
                              <td style={{ padding: "10px 12px" }}>
                                <span style={{
                                  fontSize: 10.5, fontWeight: 800, textTransform: "uppercase",
                                  background: "#EFF6FF", color: "#2563EB", padding: "2px 6px", borderRadius: 4
                                }}>
                                  {v.type}
                                </span>
                              </td>
                              <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--ink)", fontSize: 13 }}>
                                {v.nom}
                              </td>
                              <td style={{ padding: "10px 12px", fontSize: 12.5, fontWeight: 600 }}>
                                {v.prix ? formatPrice(v.prix, "KMF") : <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Standard</span>}
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "right" }}>
                                <span style={{
                                  display: "inline-block", padding: "3px 10px", borderRadius: 12,
                                  fontSize: 12, fontWeight: 800,
                                  background: isOut ? "#FEE2E2" : (isLow ? "#FEF3C7" : "#DCFCE7"),
                                  color: isOut ? "#DC2626" : (isLow ? "#D97706" : "#16A34A")
                                }}>
                                  {isOut ? "Épuisé (0)" : `${v.stock} restant(s)`}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            <div style={{ padding: "14px 20px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setSelectedProductForVariantView(null)}
                style={{
                  background: "#F1F5F9", border: "none", color: "#475569",
                  padding: "8px 18px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer"
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

