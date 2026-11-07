import React, { useState, useEffect, useRef } from "react";
import { 
  ClipboardList, Search, Clock, CheckCircle2, XCircle, 
  Sparkles, Smartphone, Eye, MessageCircle, Printer, 
  Send, RefreshCw, X, ArrowUpDown, Filter, AlertCircle,
  Plus, FileText, Trash2, Pencil, Image as ImageIcon, Camera, Upload, Download, User, Package
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import api from "../../api";
import { SkeletonTableRows } from "../../components/Skeleton.jsx";
import { formatPrice as fcfa } from "../../utils/currency";
import { toast } from "react-hot-toast";
import { useAuth } from "../../context/AuthContext.jsx";
import { saveCache, getCache, enqueueAction, saveOfflineQuote, getOfflineQuotes } from "../../utils/offlineStorage.js";
import { useOffline } from "../../context/OfflineContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";

export default function DemandesSpeciales() {
  const { user } = useAuth();
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const canCreate = isAdmin || perms.includes("creer_demande") || perms.includes("gerer_demandes") || perms.includes("demandes_devis");
  const canEdit = isAdmin || perms.includes("gerer_demandes") || perms.includes("demandes_devis");
  const canDelete = isAdmin || perms.includes("supprimer_demandes");

  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      api.get("/admin/employees")
        .then(res => setEmployees(res.data || []))
        .catch(() => setEmployees([]));
    }
  }, [isAdmin]);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("all");
  const [statutAchatFilter, setStatutAchatFilter] = useState("all"); // 'all' | 'achete' | 'non_achete'
  const [pendingCount, setPendingCount] = useState(0);

  async function handleToggleStatutAchat(req) {
    const nextStatus = req.statutAchat === "achete" ? "non_achete" : "achete";
    try {
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, statutAchat: nextStatus } : r));
      await api.patch(`/admin/custom-requests/${req.id}/achat-status`, { statutAchat: nextStatus });
      toast.success(nextStatus === "achete" ? "Statut : Acheté auprès du fournisseur !" : "Statut : Pas encore acheté.");
    } catch (err) {
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, statutAchat: req.statutAchat } : r));
      toast.error(err.response?.data?.message || "Erreur lors du changement de statut d'achat.");
    }
  }

  // File input refs pour les photos
  const createFileInputRef = useRef(null);
  const editFileInputRef = useRef(null);

  // Photos ajoutées
  const [createPhotos, setCreatePhotos] = useState([]);
  const [editPhotos, setEditPhotos] = useState([]);

  // État du modal de chiffrage / examen
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [quotedArticles, setQuotedArticles] = useState([]);
  const [fraisLivraison, setFraisLivraison] = useState(0);
  const [messageAdmin, setMessageAdmin] = useState("");
  const [submittingQuote, setSubmittingQuote] = useState(false);

  // État du modal de création directe d'une commande / demande sur-mesure
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    nomClient: "",
    telephoneClient: "",
    modeleAppareil: "",
    articles: [{ nom: "", quantite: 1, prixUnitaire: "" }],
    fraisLivraison: 0,
    devisTotal: "",
    statut: "en_attente",
    description: "",
    messageAdmin: "",
    employeId: ""
  });
  const [creatingOrder, setCreatingOrder] = useState(false);

  // État du modal de modification d'une commande / demande existante
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [editForm, setEditForm] = useState({
    nomClient: "",
    telephoneClient: "",
    modeleAppareil: "",
    articles: [{ nom: "", quantite: 1, prixUnitaire: "" }],
    fraisLivraison: 0,
    totalPropose: "",
    statut: "en_attente",
    description: "",
    messageAdmin: "",
    employeId: ""
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);

  const { isOnline } = useOffline();

  useEffect(() => {
    setVisibleCount(20);
    loadRequests();

    const handleSynced = () => {
      loadRequests();
    };
    window.addEventListener("offline_synced", handleSynced);

    const unsub = subscribeRealtime((detail) => {
      const t = detail?.type || detail;
      if (t === "custom_order_updated" || t === "order_created" || t === "order_updated") {
        loadRequests();
      }
    });

    return () => {
      window.removeEventListener("offline_synced", handleSynced);
      unsub();
    };
  }, [statutFilter]);

  async function loadRequests() {
    // 1. Lire d'abord le cache local pour disponibilite instantanee hors-ligne
    const cached = await getCache("admin_custom_requests");
    const offlineQuotes = await getOfflineQuotes();
    if (cached && Array.isArray(cached)) {
      const combined = [...(offlineQuotes || []), ...cached];
      const unique = Array.from(new Map(combined.map(r => [r.code || r.id, r])).values());
      setRequests(unique);
      setLoading(false);
    } else if (offlineQuotes && offlineQuotes.length > 0) {
      setRequests(offlineQuotes);
      setLoading(false);
    } else {
      setLoading(true);
    }

    if (navigator.onLine) {
      try {
        const res = await api.get("/admin/custom-requests", {
          params: {
            search: search.trim() || undefined,
            statut: statutFilter !== "all" ? statutFilter : undefined
          }
        });
        const serverList = res.data.requests || [];
        const combined = [...(offlineQuotes || []), ...serverList];
        const unique = Array.from(new Map(combined.map(r => [r.code || r.id, r])).values());
        setRequests(unique);
        setPendingCount(res.data.pendingCount || 0);
        saveCache("admin_custom_requests", serverList).catch(() => {});
      } catch (err) {
        console.warn("Chargement distant des demandes impossible, conservation du cache:", err);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadRequests();
  }

  // Compression canvas instantanée côté client (identique au côté client store)
  function compressImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const MAX_DIM = 900;
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > MAX_DIM) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              }
            } else {
              if (height > MAX_DIM) {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.75));
          } catch (err) {
            resolve(e.target.result);
          }
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // --- GESTION DES PHOTOS POUR LA CRÉATION ---
  async function handleCreatePhotoSelect(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const maxAllowed = createForm.articles.length;
    const remainingSlots = maxAllowed - createPhotos.length;

    if (remainingSlots <= 0) {
      toast.error(`Vous avez déjà atteint la limite de ${maxAllowed} photo${maxAllowed > 1 ? "s" : ""} pour vos ${maxAllowed} article${maxAllowed > 1 ? "s" : ""}.`);
      if (createFileInputRef.current) createFileInputRef.current.value = "";
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast(`Seules ${remainingSlots} photo(s) ont été ajoutées pour respecter le nombre d'articles.`);
    }

    const compressed = await Promise.all(filesToProcess.map(f => compressImage(f)));
    setCreatePhotos(prev => [...prev, ...compressed]);

    if (createFileInputRef.current) createFileInputRef.current.value = "";
  }

  function handleRemoveCreatePhoto(index) {
    setCreatePhotos(prev => prev.filter((_, i) => i !== index));
  }

  // --- GESTION DES PHOTOS POUR LA MODIFICATION ---
  async function handleEditPhotoSelect(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const maxAllowed = editForm.articles.length;
    const remainingSlots = maxAllowed - editPhotos.length;

    if (remainingSlots <= 0) {
      toast.error(`Vous avez déjà atteint la limite de ${maxAllowed} photo${maxAllowed > 1 ? "s" : ""} pour vos ${maxAllowed} article${maxAllowed > 1 ? "s" : ""}.`);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast(`Seules ${remainingSlots} photo(s) ont été ajoutées pour respecter le nombre d'articles.`);
    }

    const compressed = await Promise.all(filesToProcess.map(f => compressImage(f)));
    setEditPhotos(prev => [...prev, ...compressed]);

    if (editFileInputRef.current) editFileInputRef.current.value = "";
  }

  function handleRemoveEditPhoto(index) {
    setEditPhotos(prev => prev.filter((_, i) => i !== index));
  }

  // --- CHIFFRAGE / EXAMEN ---
  function openQuoteModal(req) {
    setSelectedRequest(req);
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
    const totalDevisCalc = Number(req.totalPropose || 0) + Number(req.fraisLivraison || 0);
    const clientName = req.nomClient ? ` ${req.nomClient}` : "";
    const text = `Bonjour${clientName},\n\nVoici votre facture #${req.code}.\nTotal : ${fcfa(totalDevisCalc)}`;

    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

    window.location.href = waUrl;
  }

  // --- CRÉATION DIRECTE ---
  function handleAddArticleField() {
    setCreateForm(prev => ({
      ...prev,
      articles: [...prev.articles, { nom: "", quantite: 1, prixUnitaire: "" }]
    }));
  }

  function handleRemoveArticleField(index) {
    setCreateForm(prev => {
      if (prev.articles.length <= 1) return prev;
      const updatedArticles = prev.articles.filter((_, idx) => idx !== index);
      // Réduire les photos si nécessaire
      if (createPhotos.length > updatedArticles.length) {
        setCreatePhotos(p => p.slice(0, updatedArticles.length));
      }
      return {
        ...prev,
        articles: updatedArticles
      };
    });
  }

  function handleUpdateArticleField(index, field, value) {
    setCreateForm(prev => {
      const newArticles = [...prev.articles];
      newArticles[index] = { ...newArticles[index], [field]: value };
      return { ...prev, articles: newArticles };
    });
  }

  const createCalculatedTotal = createForm.articles.reduce(
    (sum, a) => sum + (Number(a.prixUnitaire || 0) * Number(a.quantite || 1)),
    Number(createForm.fraisLivraison || 0)
  );

  async function handleCreateDirectOrder(e) {
    e.preventDefault();
    if (!createForm.nomClient.trim() || !createForm.telephoneClient.trim() || !createForm.modeleAppareil.trim()) {
      toast.error("Veuillez renseigner le nom du client, le téléphone et le modèle d'appareil.");
      return;
    }

    const validArticles = createForm.articles.filter(a => a.nom && a.nom.trim().length > 0);
    if (validArticles.length === 0) {
      toast.error("Veuillez renseigner au moins un article demandé.");
      return;
    }

    setCreatingOrder(true);
    const idempotencyKey = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const payload = {
      nomClient: createForm.nomClient.trim(),
      telephoneClient: createForm.telephoneClient.trim(),
      modeleAppareil: createForm.modeleAppareil.trim(),
      employeId: createForm.employeId ? Number(createForm.employeId) : (!isAdmin && user?.id ? user.id : undefined),
      articles: validArticles.map(a => ({
        nom: a.nom.trim(),
        quantite: Number(a.quantite) || 1,
        prixUnitaire: Number(a.prixUnitaire) || 0
      })),
      fraisLivraison: Number(createForm.fraisLivraison) || 0,
      devisTotal: createForm.devisTotal ? Number(createForm.devisTotal) : (createCalculatedTotal > 0 ? createCalculatedTotal : null),
      statut: createForm.statut || "en_attente",
      description: createForm.description ? createForm.description.trim() : null,
      messageAdmin: createForm.messageAdmin ? createForm.messageAdmin.trim() : null,
      photos: createPhotos,
      photoUrl: createPhotos.length > 1 ? JSON.stringify(createPhotos) : (createPhotos[0] || null),
      idempotencyKey
    };

    const processOfflineQuote = async () => {
      const localCode = `DEM-OFFLINE-${Date.now().toString().slice(-6)}`;
      const offlineReq = {
        id: `offline_dem_${Date.now()}`,
        code: localCode,
        isOffline: true,
        createdAt: new Date().toISOString(),
        ...payload
      };

      await enqueueAction({
        type: "DEVIS_SUR_MESURE",
        url: "/admin/custom-requests",
        method: "POST",
        data: payload,
        idempotencyKey
      });

      await saveOfflineQuote(offlineReq);
      setRequests(prev => [offlineReq, ...prev]);

      setIsCreateModalOpen(false);
      setCreatePhotos([]);
      setCreateForm({
        nomClient: "",
        telephoneClient: "",
        modeleAppareil: "",
        articles: [{ nom: "", quantite: 1, prixUnitaire: "" }],
        fraisLivraison: 0,
        devisTotal: "",
        statut: "en_attente",
        description: "",
        messageAdmin: "",
        employeId: ""
      });
      toast.success(`Devis enregistre hors-ligne (#${localCode}). Il sera synchronise automatiquement des le retour du reseau.`);
    };

    if (!navigator.onLine) {
      await processOfflineQuote();
      setCreatingOrder(false);
      return;
    }

    try {
      const res = await api.post("/admin/custom-requests", payload);
      if (res.data && res.data.success) {
        toast.success("Devis / commande personnalisee enregistre avec succes !");
        setIsCreateModalOpen(false);
        setCreatePhotos([]);
        setCreateForm({
          nomClient: "",
          telephoneClient: "",
          modeleAppareil: "",
          articles: [{ nom: "", quantite: 1, prixUnitaire: "" }],
          fraisLivraison: 0,
          devisTotal: "",
          statut: "en_attente",
          description: "",
          messageAdmin: "",
          employeId: ""
        });
        await loadRequests();
      }
    } catch (err) {
      if (!err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
        await processOfflineQuote();
      } else {
        console.error("Erreur creation commande directe:", err);
        toast.error(err.response?.data?.message || "Erreur lors de la creation de la commande.");
      }
    } finally {
      setCreatingOrder(false);
    }
  }

  // --- MODIFICATION D'UNE DEMANDE ---
  function openEditModal(req) {
    setEditingRequest(req);
    const existingArticles = Array.isArray(req.articles) && req.articles.length > 0
      ? req.articles.map(a => ({ nom: a.nom || "", quantite: a.quantite || 1, prixUnitaire: a.prixUnitaire ?? "" }))
      : [{ nom: "", quantite: 1, prixUnitaire: "" }];

    // Charger les photos existantes
    let existingPhotos = [];
    if (req.photoUrl) {
      try {
        const parsed = JSON.parse(req.photoUrl);
        existingPhotos = Array.isArray(parsed) ? parsed.filter(Boolean) : [req.photoUrl];
      } catch (e) {
        existingPhotos = [req.photoUrl];
      }
    }
    setEditPhotos(existingPhotos);

    setEditForm({
      nomClient: req.nomClient || "",
      telephoneClient: req.telephoneClient || "",
      modeleAppareil: req.modeleAppareil || "",
      statut: req.statut || "en_attente",
      statutAchat: req.statutAchat || "non_achete",
      articles: existingArticles,
      fraisLivraison: Number(req.fraisLivraison || 0),
      totalPropose: req.totalPropose ?? "",
      description: req.description || "",
      messageAdmin: req.messageAdmin || "",
      employeId: req.employeId || req.employeAssigne?.id || ""
    });
    setIsEditModalOpen(true);
  }

  function handleAddEditArticleField() {
    setEditForm(prev => ({
      ...prev,
      articles: [...prev.articles, { nom: "", quantite: 1, prixUnitaire: "" }]
    }));
  }

  function handleRemoveEditArticleField(index) {
    setEditForm(prev => {
      if (prev.articles.length <= 1) return prev;
      const updatedArticles = prev.articles.filter((_, idx) => idx !== index);
      if (editPhotos.length > updatedArticles.length) {
        setEditPhotos(p => p.slice(0, updatedArticles.length));
      }
      return {
        ...prev,
        articles: updatedArticles
      };
    });
  }

  function handleUpdateEditArticleField(index, field, value) {
    setEditForm(prev => {
      const newArticles = [...prev.articles];
      newArticles[index] = { ...newArticles[index], [field]: value };
      return { ...prev, articles: newArticles };
    });
  }

  const editCalculatedTotal = editForm.articles.reduce(
    (sum, a) => sum + (Number(a.prixUnitaire || 0) * Number(a.quantite || 1)),
    Number(editForm.fraisLivraison || 0)
  );

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingRequest) return;
    if (!editForm.nomClient.trim() || !editForm.telephoneClient.trim() || !editForm.modeleAppareil.trim()) {
      toast.error("Veuillez renseigner le nom du client, le téléphone et le modèle d'appareil.");
      return;
    }

    const validArticles = editForm.articles.filter(a => a.nom && a.nom.trim().length > 0);
    if (validArticles.length === 0) {
      toast.error("Veuillez renseigner au moins un article demandé.");
      return;
    }

    setSavingEdit(true);
    try {
      const calculatedSubtotal = validArticles.reduce(
        (sum, a) => sum + (Number(a.prixUnitaire || 0) * Number(a.quantite || 1)), 0
      );

      const payload = {
        nomClient: editForm.nomClient.trim(),
        telephoneClient: editForm.telephoneClient.trim(),
        modeleAppareil: editForm.modeleAppareil.trim(),
        employeId: editForm.employeId ? Number(editForm.employeId) : null,
        articles: validArticles.map(a => ({
          nom: a.nom.trim(),
          quantite: Number(a.quantite) || 1,
          prixUnitaire: Number(a.prixUnitaire) || 0
        })),
        fraisLivraison: Number(editForm.fraisLivraison) || 0,
        totalPropose: calculatedSubtotal > 0 ? calculatedSubtotal : (Number(editForm.totalPropose) || 0),
        statut: editForm.statut,
        statutAchat: editForm.statutAchat || "non_achete",
        description: editForm.description ? editForm.description.trim() : null,
        messageAdmin: editForm.messageAdmin ? editForm.messageAdmin.trim() : null,
        photos: editPhotos,
        photoUrl: editPhotos.length > 1 ? JSON.stringify(editPhotos) : (editPhotos[0] || null)
      };

      const res = await api.put(`/admin/custom-requests/${editingRequest.id}`, payload);
      if (res.data && res.data.success) {
        toast.success("Demande sur-mesure modifiée avec succès !");
        setIsEditModalOpen(false);
        setEditingRequest(null);
        await loadRequests();
      }
    } catch (err) {
      console.error("Erreur modification demande:", err);
      toast.error(err.response?.data?.message || "Erreur lors de la modification de la demande.");
    } finally {
      setSavingEdit(false);
    }
  }

  // --- SUPPRESSION D'UNE DEMANDE ---
  async function handleDeleteRequest(req) {
    if (!window.confirm(`Confirmez-vous la suppression définitive de la demande #${req.code} de ${req.nomClient} ?`)) {
      return;
    }
    try {
      const res = await api.delete(`/admin/custom-requests/${req.id}`);
      if (res.data?.success) {
        toast.success("Demande supprimée avec succès !");
        await loadRequests();
      }
    } catch (err) {
      console.error("Erreur suppression demande:", err);
      toast.error(err.response?.data?.message || "Erreur lors de la suppression de la demande.");
    }
  }

  // --- FORMATTAGE PROPRE POUR LE PDF (ASCII STANDARD POUR ÉVITER LES SLASH ET ESPACEMENTS) ---
  function pdfPrice(amount, devise = "FCFA") {
    const num = Math.round(Number(amount || 0));
    const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${formatted} ${devise}`;
  }

  function cleanPdfText(str) {
    if (!str) return "";
    return String(str)
      .replace(/[\u202F\u00A0\u2007\u200B]/g, " ")
      .replace(/[•●]/g, "-")
      .replace(/[’‘`]/g, "'")
      .replace(/[“”]/g, '"')
      .trim();
  }

  // --- TÉLÉCHARGEMENT DIRECT D'UN VRAI FICHIER PDF (NE DEVIENT JAMAIS BLANC) ---
  function handleDownloadDirectPDF() {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      const totalEnAttente = requests.filter(r => r.statut === "en_attente").length;
      const totalValidees = requests.filter(r => r.statut === "valide").length;
      const totalDevisProposes = requests.filter(r => r.statut === "propose").length;
      const totalChiffre = requests.reduce((sum, r) => sum + Number(r.totalPropose || 0) + Number(r.fraisLivraison || 0), 0);

      const dateStr = cleanPdfText(new Date().toLocaleDateString("fr-FR", { 
        day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" 
      }));

      // Bannière En-tête officiel Soilihitech
      doc.setFillColor(30, 41, 59); // Navy #1E293B
      doc.rect(14, 10, 269, 18, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("SOILIHITECH — BORDEREAU OFFICIEL DES COMMANDES SUR-MESURE", 18, 20);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.text(`Document officiel certifié · Généré le ${dateStr}`, 18, 25);

      // Cartouches KPI / Statistiques
      const startY = 32;
      const cardW = 64;
      const cardH = 14;
      const gap = 4.3;

      const kpiData = [
        { label: "TOTAL DEMANDES", val: String(requests.length), col: [15, 23, 42] },
        { label: "EN ATTENTE", val: String(totalEnAttente), col: [37, 99, 235] },
        { label: "DEVIS ENVOYÉS / VALIDÉS", val: String(totalDevisProposes + totalValidees), col: [22, 163, 74] },
        { label: "TOTAL CHIFFRÉ ESTIMÉ", val: pdfPrice(totalChiffre), col: [15, 23, 42] }
      ];

      kpiData.forEach((kpi, i) => {
        const x = 14 + i * (cardW + gap);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, startY, cardW, cardH, 2, 2, "FD");

        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text(cleanPdfText(kpi.label), x + 4, startY + 5);

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(kpi.col[0], kpi.col[1], kpi.col[2]);
        doc.text(cleanPdfText(kpi.val), x + 4, startY + 11);
      });

      // Lignes du tableau
      const tableRows = requests.map(req => {
        const totalReq = Number(req.totalPropose || 0) + Number(req.fraisLivraison || 0);
        const totalDisplay = totalReq > 0 ? pdfPrice(totalReq) : "Non chiffré";

        const articlesStr = (req.articles || [])
          .map(a => `- ${a.nom} (x${a.quantite})${Number(a.prixUnitaire) ? ` : ${pdfPrice(a.prixUnitaire)}` : ""}`)
          .join("\n");

        const note = req.description ? `\nNote : ${req.description}` : "";

        let statutLabel = "En attente";
        if (req.statut === "propose") statutLabel = "Devis envoyé";
        if (req.statut === "valide") statutLabel = "Validée";
        if (req.statut === "refuse") statutLabel = "Refusée";

        const dateReq = new Date(req.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

        return [
          cleanPdfText(`#${req.code}\n${dateReq}`),
          cleanPdfText(`${req.nomClient}\n${req.telephoneClient}`),
          cleanPdfText(req.modeleAppareil || "—"),
          cleanPdfText((articlesStr + note) || "—"),
          cleanPdfText(totalDisplay),
          cleanPdfText(statutLabel)
        ];
      });

      autoTable(doc, {
        startY: 50,
        head: [["RÉFÉRENCE", "CLIENT & CONTACT", "MODÈLE APPAREIL", "ARTICLES DEMANDÉS", "TOTAL DEVIS", "STATUT"]],
        body: tableRows,
        theme: "grid",
        styles: {
          fontSize: 8.5,
          cellPadding: 3.5,
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
          valign: "middle",
          font: "helvetica"
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8.5
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 42, fontStyle: "bold", textColor: [29, 78, 216] },
          1: { cellWidth: 46, fontStyle: "bold" },
          2: { cellWidth: 38 },
          3: { cellWidth: 80 },
          4: { cellWidth: 34, fontStyle: "bold", halign: "right" },
          5: { cellWidth: 29, halign: "center", fontStyle: "bold" }
        },
        didDrawPage: () => {
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text("Document certifié conforme par le système de gestion Soilihitech", 14, 202);
          doc.text(`Page ${doc.internal.getNumberOfPages()}`, 283, 202, { align: "right" });
        }
      });

      const today = new Date().toISOString().split("T")[0];
      const fileName = `Bordereau_Commandes_Soilihitech_${today}.pdf`;
      try {
        const blob = doc.output("blob");
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.style.display = "none";
        link.href = blobUrl;
        link.download = fileName;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        }, 1500);
      } catch (saveErr) {
        doc.save(fileName);
      }
      toast.success("Bordereau PDF enregistré dans vos fichiers !");
    } catch (err) {
      console.error("Erreur génération PDF jsPDF:", err);
      toast.error("Erreur lors de la génération du PDF.");
    }
  }

  // --- EXPORT IMPRESSION HTML ROBUSTE SANS ÉCRAN BLANC ---
  function handleGenerateRealPDF() {
    const totalEnAttente = requests.filter(r => r.statut === "en_attente").length;
    const totalValidees = requests.filter(r => r.statut === "valide").length;
    const totalDevisProposes = requests.filter(r => r.statut === "propose").length;
    const totalChiffre = requests.reduce((sum, r) => sum + Number(r.totalPropose || 0) + Number(r.fraisLivraison || 0), 0);

    const dateStr = new Date().toLocaleDateString("fr-FR", { 
      day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" 
    });

    const rowsHtml = requests.map((req, idx) => {
      let photoSrc = "";
      if (req.photoUrl) {
        try {
          const parsed = JSON.parse(req.photoUrl);
          if (Array.isArray(parsed) && parsed.length > 0) photoSrc = parsed[0];
          else photoSrc = req.photoUrl;
        } catch (e) {
          photoSrc = req.photoUrl;
        }
      }

      const totalReq = Number(req.totalPropose || 0) + Number(req.fraisLivraison || 0);
      const totalDisplay = totalReq > 0 ? fcfa(totalReq) : "Non chiffré";

      const articlesList = (req.articles || [])
        .map(a => `<div>• <strong>${a.nom}</strong> <span style="color:#2563EB;">(x${a.quantite})</span>${Number(a.prixUnitaire) ? ` - ${fcfa(a.prixUnitaire)}` : ""}</div>`)
        .join("");

      const sBadge = statusBadge[req.statut] || statusBadge.en_attente;

      return `
        <tr style="border-bottom: 1px solid #E2E8F0; ${idx % 2 === 0 ? "background: #F8FAFC;" : "background: #FFFFFF;"}">
          <td style="padding: 8px 10px; text-align: center; width: 55px; vertical-align: middle;">
            ${photoSrc 
              ? `<img src="${photoSrc}" alt="Photo" style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid #CBD5E1; display: block; margin: 0 auto;" />`
              : `<div style="width: 44px; height: 44px; background: #E2E8F0; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #64748B; font-weight: 700; text-align: center; margin: 0 auto; line-height: 1.1;">Sans photo</div>`
            }
          </td>
          <td style="padding: 8px 10px; font-family: monospace; font-weight: 800; color: #1D4ED8; font-size: 11.5px; vertical-align: middle;">
            <div>#${req.code}</div>
            <div style="font-size: 10px; color: #64748B; font-weight: normal; margin-top: 2px;">
              ${new Date(req.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </div>
          </td>
          <td style="padding: 8px 10px; vertical-align: middle;">
            <div style="font-weight: 800; font-size: 12.5px; color: #0F172A;">${req.nomClient}</div>
            <div style="font-size: 11px; color: #059669; font-weight: 700; margin-top: 1px;">${req.telephoneClient}</div>
          </td>
          <td style="padding: 8px 10px; font-weight: 700; font-size: 12px; color: #1E293B; vertical-align: middle;">
            ${req.modeleAppareil}
          </td>
          <td style="padding: 8px 10px; font-size: 11.5px; color: #334155; line-height: 1.35; vertical-align: middle;">
            ${articlesList || "—"}
            ${req.description ? `<div style="font-size: 10.5px; color: #64748B; font-style: italic; margin-top: 2px;">Note : ${req.description}</div>` : ""}
          </td>
          <td style="padding: 8px 10px; font-weight: 900; font-size: 12.5px; color: ${totalReq > 0 ? "#15803D" : "#94A3B8"}; vertical-align: middle;">
            ${totalDisplay}
          </td>
          <td style="padding: 8px 10px; text-align: center; vertical-align: middle;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 10px; font-size: 10.5px; font-weight: 800; background: ${sBadge.bg}; color: ${sBadge.color}; border: 1px solid ${sBadge.border}; white-space: nowrap;">
              ${sBadge.label}
            </span>
          </td>
        </tr>
      `;
    }).join("");

    const htmlDoc = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Bordereau des Commandes & Demandes Sur-Mesure — Soilihitech</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 20px;
            color: #0F172A;
            background: #FFFFFF;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #0F172A;
            color: #FFFFFF;
            padding: 12px 20px;
            border-radius: 10px;
            margin-bottom: 20px;
          }
          .btn-print {
            background: #2563EB;
            color: #FFFFFF;
            border: none;
            padding: 8px 18px;
            border-radius: 6px;
            font-weight: 800;
            cursor: pointer;
            font-size: 13px;
          }
          .btn-close {
            background: #334155;
            color: #FFFFFF;
            border: none;
            padding: 8px 14px;
            border-radius: 6px;
            font-weight: 700;
            cursor: pointer;
            font-size: 13px;
          }
          .doc-header {
            border-bottom: 3px solid #2563EB;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .doc-title {
            font-size: 18px;
            font-weight: 900;
            color: #1E293B;
            margin: 0 0 4px 0;
          }
          .doc-subtitle {
            font-size: 11px;
            color: #64748B;
          }
          .kpi-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 8px 0;
            margin-bottom: 16px;
          }
          .kpi-cell {
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            padding: 8px 12px;
            text-align: left;
          }
          .kpi-label {
            font-size: 9px;
            text-transform: uppercase;
            font-weight: 800;
            color: #64748B;
          }
          .kpi-val {
            font-size: 15px;
            font-weight: 900;
            color: #0F172A;
            margin-top: 2px;
          }
          table.main-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            text-align: left;
          }
          table.main-table th {
            background: #1E293B !important;
            color: #FFFFFF !important;
            font-size: 10px;
            font-weight: 800;
            padding: 8px 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            -webkit-print-color-adjust: exact !important;
          }
          @media print {
            .toolbar, .no-print {
              display: none !important;
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
              background: #FFFFFF !important;
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            table.main-table {
              page-break-inside: auto;
            }
            table.main-table tr {
              page-break-inside: avoid;
            }
            thead {
              display: table-header-group;
            }
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <div style="font-weight: 800; font-size: 14px;">Bordereau Officiel des Commandes · Soilihitech</div>
          <div style="display: flex; gap: 10px;">
            <button class="btn-print" onclick="window.focus(); window.print();">Imprimer</button>
            <button class="btn-close" onclick="window.close()">Fermer</button>
          </div>
        </div>

        <div>
          <div class="doc-header">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td>
                  <h1 class="doc-title">LISTE OFFICIELLE DES COMMANDES & DEMANDES SUR-MESURE</h1>
                  <div class="doc-subtitle">Soilihitech E-commerce & Vente Directe · Document généré le ${dateStr}</div>
                </td>
                <td style="text-align: right; vertical-align: top;">
                  <div style="font-size: 16px; font-weight: 900; color: #2563EB;">SOILIHITECH</div>
                  <div style="font-size: 10.5px; color: #64748B; margin-top: 2px;">Service Devis & Commandes</div>
                </td>
              </tr>
            </table>
          </div>

          <table class="kpi-table">
            <tr>
              <td class="kpi-cell" style="width: 25%;">
                <div class="kpi-label">Total Demandes</div>
                <div class="kpi-val">${requests.length}</div>
              </td>
              <td class="kpi-cell" style="width: 25%;">
                <div class="kpi-label">En Attente</div>
                <div class="kpi-val" style="color: #2563EB;">${totalEnAttente}</div>
              </td>
              <td class="kpi-cell" style="width: 25%;">
                <div class="kpi-label">Devis Envoyés / Validés</div>
                <div class="kpi-val" style="color: #16A34A;">${totalDevisProposes + totalValidees}</div>
              </td>
              <td class="kpi-cell" style="width: 25%;">
                <div class="kpi-label">Total Chiffré Estimé</div>
                <div class="kpi-val" style="color: #0F172A;">${fcfa(totalChiffre)}</div>
              </td>
            </tr>
          </table>

          <table class="main-table">
            <thead>
              <tr>
                <th style="width: 55px; text-align: center;">PHOTO</th>
                <th style="width: 130px;">RÉFÉRENCE</th>
                <th style="width: 140px;">CLIENT & CONTACT</th>
                <th style="width: 120px;">MODÈLE APPAREIL</th>
                <th>ARTICLES DEMANDÉS</th>
                <th style="width: 110px;">TOTAL DEVIS</th>
                <th style="width: 110px; text-align: center;">STATUT</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div style="margin-top: 20px; text-align: right; font-size: 10.5px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 10px;">
            Document certifié conforme par le système de gestion Soilihitech · Page 1/1
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlDoc], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const printWindow = window.open(blobUrl, "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up dans votre navigateur pour exporter le PDF.");
    }
  }

  const statusBadge = {
    en_attente: { label: "En attente", bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
    propose: { label: "Devis envoyé", bg: "#FEF3C7", color: "#B45309", border: "#FDE68A" },
    valide: { label: "Validée par client", bg: "#DCFCE7", color: "#15803D", border: "#86EFAC" },
    refuse: { label: "Refusée", bg: "#FEE2E2", color: "#B91C1C", border: "#FCA5A5" }
  };

  return (
    <div className="custom-requests-page" style={{ padding: "clamp(16px, 3vw, 32px)", maxWidth: 1340, margin: "0 auto" }}>
      {/* ── EN-TÊTE PAGE ── */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
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
                Gérez les commandes d'accessoires personnalisées, chiffrez les devis et imprimez des bordereaux officiels
              </span>
              {!isAdmin && (
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 10px",
                  background: "#EFF6FF",
                  border: "1px solid #BFDBFE",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#1D4ED8",
                  marginTop: 6
                }}>
                  <User size={13} />
                  <span>Mes devis attribués & créés ({user?.nom || "Employé"})</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {pendingCount > 0 && (
            <div style={{
              background: "#EFF6FF", border: "1.5px solid #3B82F6", borderRadius: 14,
              padding: "8px 16px", display: "flex", alignItems: "center", gap: 8,
              color: "#1D4ED8", fontWeight: 800, fontSize: 13.5
            }}>
              <Sparkles size={16} />
              {pendingCount} demande{pendingCount > 1 ? "s" : ""} en attente
            </div>
          )}

          <button
            type="button"
            onClick={handleDownloadDirectPDF}
            className="bs-btn-secondary"
            title="Télécharger directement le bordereau officiel au format PDF (Recommandé)"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 16px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 13.5,
              cursor: "pointer",
              background: "#EFF6FF",
              border: "1.5px solid #BFDBFE",
              color: "#1D4ED8"
            }}
          >
            <Download size={16} />
            <span>Télécharger PDF</span>
          </button>

          <button
            type="button"
            onClick={handleGenerateRealPDF}
            className="bs-btn-secondary"
            title="Aperçu ou Impression via navigateur"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 16px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 13.5,
              cursor: "pointer"
            }}
          >
            <Printer size={16} />
            <span>Imprimer</span>
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="bs-btn-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 18px",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 13.5,
                background: "#2563EB",
                boxShadow: "0 4px 14px rgba(37, 99, 235, 0.25)",
                cursor: "pointer"
              }}
            >
              <Plus size={18} />
              <span>+ Nouveau Devis</span>
            </button>
          )}
        </div>
      </div>

      {/* ── FILTRES ET RECHERCHE ── */}
      <div className="no-print" style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 16,
        padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center",
        justifyContent: "space-between", flexWrap: "wrap", gap: 14, boxShadow: "0 2px 10px rgba(0,0,0,0.02)"
      }}>
        {/* STATUT TABS */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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

        {/* FILTRE STATUT ACHAT ET RECHERCHE */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flex: "1 1 500px", justifyContent: "flex-end", flexWrap: "wrap" }}>
          {/* SEGMENTED PILLS - ZERO EMOJIS */}
          <div style={{
            display: "inline-flex",
            background: "#F1F5F9",
            borderRadius: 12,
            padding: 3,
            gap: 2,
            border: "1px solid #E2E8F0"
          }}>
            <button
              type="button"
              onClick={() => setStatutAchatFilter("all")}
              style={{
                padding: "6px 12px",
                borderRadius: 9,
                border: "none",
                fontSize: 12,
                fontWeight: statutAchatFilter === "all" ? 800 : 600,
                background: statutAchatFilter === "all" ? "#FFFFFF" : "transparent",
                color: statutAchatFilter === "all" ? "var(--ink)" : "var(--muted)",
                boxShadow: statutAchatFilter === "all" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5
              }}
            >
              <Package size={13} />
              <span>Tous ({requests.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatutAchatFilter("achete")}
              style={{
                padding: "6px 12px",
                borderRadius: 9,
                border: "none",
                fontSize: 12,
                fontWeight: statutAchatFilter === "achete" ? 800 : 600,
                background: statutAchatFilter === "achete" ? "#DCFCE7" : "transparent",
                color: statutAchatFilter === "achete" ? "#166534" : "var(--muted)",
                boxShadow: statutAchatFilter === "achete" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5
              }}
            >
              <CheckCircle2 size={13} color={statutAchatFilter === "achete" ? "#166534" : "currentColor"} />
              <span>Déjà achetés ({requests.filter(r => r.estAchete).length})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatutAchatFilter("non_achete")}
              style={{
                padding: "6px 12px",
                borderRadius: 9,
                border: "none",
                fontSize: 12,
                fontWeight: statutAchatFilter === "non_achete" ? 800 : 600,
                background: statutAchatFilter === "non_achete" ? "#FEF3C7" : "transparent",
                color: statutAchatFilter === "non_achete" ? "#92400E" : "var(--muted)",
                boxShadow: statutAchatFilter === "non_achete" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5
              }}
            >
              <Clock size={13} color={statutAchatFilter === "non_achete" ? "#92400E" : "currentColor"} />
              <span>Pas encore achetés ({requests.filter(r => !r.estAchete).length})</span>
            </button>
          </div>

          {/* BARRE DE RECHERCHE RAPIDE */}
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 8, flex: "1 1 220px", maxWidth: 320 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="text"
                className="bs-input"
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 34, height: 40, fontSize: 13 }}
              />
              <Search size={15} color="var(--muted)" style={{ position: "absolute", left: 11, top: 12 }} />
            </div>
            <button type="submit" className="bs-btn-primary" style={{ padding: "0 14px", height: 40, fontSize: 13 }}>
              Filtrer
            </button>
          </form>
        </div>
      </div>

      {/* ── TABLE DES DEMANDES ── */}
      <div style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 18,
        overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.03)"
      }}>
        {loading ? (
          <div style={{ overflowX: "auto" }}>
            <table className="requests-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B", width: 64 }}>PHOTO</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>RÉFÉRENCE</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>CLIENT & TÉL</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>MODÈLE APPAREIL</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>ARTICLES DEMANDÉS</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>TOTAL DEVIS</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>STATUT</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>ACHAT FOURNISSEUR</th>
                  <th className="no-print" style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B", textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                <SkeletonTableRows rows={6} cols={9} />
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
            <table className="requests-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B", width: 64 }}>PHOTO</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>RÉFÉRENCE</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>CLIENT & TÉL</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>MODÈLE APPAREIL</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>ARTICLES DEMANDÉS</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>TOTAL DEVIS</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>STATUT</th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B" }}>ACHAT FOURNISSEUR</th>
                  <th className="no-print" style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: "#64748B", textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {requests.filter(req => {
                  if (statutAchatFilter === "achete" && req.statutAchat !== "achete") return false;
                  if (statutAchatFilter === "non_achete" && req.statutAchat === "achete") return false;
                  return true;
                }).slice(0, visibleCount).map(req => {
                  const s = statusBadge[req.statut] || statusBadge.en_attente;
                  const total = Number(req.totalPropose || 0) + Number(req.fraisLivraison || 0);

                  let photoThumb = null;
                  if (req.photoUrl) {
                    try {
                      const parsed = JSON.parse(req.photoUrl);
                      photoThumb = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : req.photoUrl;
                    } catch (e) {
                      photoThumb = req.photoUrl;
                    }
                  }

                  return (
                    <tr key={req.id} style={{ borderBottom: "1px solid #E2E8F0", transition: "background 0.15s" }}>
                      {/* MINIATURE PHOTO */}
                      <td style={{ padding: "14px 16px", width: 64 }}>
                        {photoThumb ? (
                          <a href={photoThumb} target="_blank" rel="noopener noreferrer" title="Cliquer pour agrandir la photo">
                            <img
                              src={photoThumb}
                              alt={req.modeleAppareil}
                              style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", border: "1px solid #CBD5E1", background: "#fff", cursor: "zoom-in" }}
                            />
                          </a>
                        ) : (
                          <div style={{
                            width: 44, height: 44, borderRadius: 8, background: "#F1F5F9",
                            border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#94A3B8"
                          }} title="Aucune photo fournie">
                            <Smartphone size={18} />
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, fontFamily: "monospace", color: "#2563EB" }}>
                          {req.code}
                        </div>
                        {req.isOffline && (
                          <div style={{ fontSize: 10.5, color: "#92400E", background: "#FEF3C7", border: "1px solid #F59E0B", padding: "1px 6px", borderRadius: 4, display: "inline-block", marginTop: 2, fontWeight: 700 }}>
                            En attente de connexion
                          </div>
                        )}
                        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                          {new Date(req.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {req.employeAssigne && (
                          <div style={{ fontSize: 11, color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "1px 6px", borderRadius: 4, display: "inline-block", marginTop: 4, fontWeight: 700 }}>
                            Assigné: {req.employeAssigne.nom}
                          </div>
                        )}
                        {!req.employeAssigne && req.createur && (
                          <div style={{ fontSize: 11, color: "#475569", background: "#F1F5F9", border: "1px solid #CBD5E1", padding: "1px 6px", borderRadius: 4, display: "inline-block", marginTop: 4, fontWeight: 600 }}>
                            Créé: {req.createur.nom}
                          </div>
                        )}
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

                      {/* STATUT ACHAT FOURNISSEUR TOGGLE */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          onClick={() => handleToggleStatutAchat(req)}
                          title="Cliquer pour changer le statut d'approvisionnement"
                          style={{
                            padding: "6px 12px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            background: req.statutAchat === "achete" ? "#DCFCE7" : "#FEF3C7",
                            color: req.statutAchat === "achete" ? "#166534" : "#92400E",
                            border: `1.5px solid ${req.statutAchat === "achete" ? "#86EFAC" : "#FDE68A"}`
                          }}
                        >
                          {req.statutAchat === "achete" ? (
                            <>
                              <CheckCircle2 size={13} color="#166534" />
                              <span>Acheté</span>
                            </>
                          ) : (
                            <>
                              <Clock size={13} color="#92400E" />
                              <span>Pas encore acheté</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="no-print" style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => openQuoteModal(req)}
                            style={{
                              background: "#EFF6FF", border: "1.5px solid #BFDBFE",
                              color: "#2563EB", padding: "6px 10px", borderRadius: 8,
                              fontSize: 12, fontWeight: 800, cursor: "pointer",
                              display: "inline-flex", alignItems: "center", gap: 4
                            }}
                            title="Examiner & Chiffrer"
                          >
                            <Eye size={14} /> Examiner & Chiffrer
                          </button>

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEditModal(req)}
                              title="Modifier cette commande"
                              style={{
                                background: "#F8FAFC", border: "1px solid #CBD5E1", color: "#334155",
                                padding: "6px 8px", borderRadius: 8, cursor: "pointer",
                                display: "inline-flex", alignItems: "center"
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => sendWhatsAppQuote(req)}
                            title="Envoyer le devis sur WhatsApp"
                            style={{
                              background: "#25D366", border: "none", color: "#fff",
                              padding: "6px 8px", borderRadius: 8, cursor: "pointer",
                              display: "inline-flex", alignItems: "center"
                            }}
                          >
                            <MessageCircle size={14} />
                          </button>

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRequest(req)}
                              title="Supprimer cette demande"
                              style={{
                                background: "#FEE2E2", border: "1px solid #FECACA", color: "#DC2626",
                                padding: "6px 8px", borderRadius: 8, cursor: "pointer",
                                display: "inline-flex", alignItems: "center"
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {requests.length > visibleCount && (
              <div style={{ textAlign: "center", padding: "16px 0", borderTop: "1px solid #E2E8F0" }}>
                <button
                  type="button"
                  onClick={() => setVisibleCount(c => c + 20)}
                  style={{
                    background: "#F8FAFC",
                    border: "1.5px solid #CBD5E1",
                    color: "#1E293B",
                    padding: "10px 24px",
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.03)"
                  }}
                >
                  Afficher les 20 demandes suivantes — {Math.min(visibleCount, requests.length)} sur {requests.length}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL DE MODIFICATION D'UNE COMMANDE SUR-MESURE ── */}
      {isEditModalOpen && editingRequest && (
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
                  Modifier la commande #{editingRequest.code}
                </h3>
                <span style={{ fontSize: 12, color: "#94A3B8" }}>
                  Mettez à jour les coordonnées client, les articles demandés, photos ou le statut
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* FORMULAIRE DE MODIFICATION */}
            <form onSubmit={handleSaveEdit} style={{ padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                <div className="bs-input-group">
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                    Nom du client * :
                  </label>
                  <input
                    type="text"
                    required
                    className="bs-input"
                    value={editForm.nomClient}
                    onChange={(e) => setEditForm({ ...editForm, nomClient: e.target.value })}
                  />
                </div>

                <div className="bs-input-group">
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                    Téléphone (WhatsApp) * :
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    className="bs-input"
                    value={editForm.telephoneClient}
                    onChange={(e) => setEditForm({ ...editForm, telephoneClient: e.target.value.replace(/[^0-9+ ]/g, "") })}
                    onKeyDown={(e) => {
                      if (!/[0-9+ ]/.test(e.key) && !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div className="bs-input-group">
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                    Modèle d'appareil * :
                  </label>
                  <input
                    type="text"
                    required
                    className="bs-input"
                    value={editForm.modeleAppareil}
                    onChange={(e) => setEditForm({ ...editForm, modeleAppareil: e.target.value })}
                  />
                </div>

                <div className="bs-input-group">
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                    Statut de la demande :
                  </label>
                  <select
                    className="bs-input"
                    value={editForm.statut}
                    onChange={(e) => setEditForm({ ...editForm, statut: e.target.value })}
                  >
                    <option value="en_attente">En attente (Non chiffré)</option>
                    <option value="propose">Devis envoyé</option>
                    <option value="valide">Validée par client</option>
                    <option value="refuse">Refusée</option>
                  </select>
                </div>

                <div className="bs-input-group">
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                    Achat fournisseur :
                  </label>
                  <select
                    className="bs-input"
                    value={editForm.statutAchat || "non_achete"}
                    onChange={(e) => setEditForm({ ...editForm, statutAchat: e.target.value })}
                  >
                    <option value="non_achete">⏳ Pas encore acheté</option>
                    <option value="achete">✓ Déjà acheté auprès du fournisseur</option>
                  </select>
                </div>
              </div>

              {isAdmin && (
                <div className="bs-input-group" style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                    Employé assigné / responsable du devis :
                  </label>
                  <select
                    className="bs-select"
                    value={editForm.employeId}
                    onChange={(e) => setEditForm({ ...editForm, employeId: e.target.value })}
                    style={{ width: "100%", height: 42, fontSize: 13 }}
                  >
                    <option value="">-- Aucun employé spécifique (Visible par Admin) --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.nom} ({emp.role === "admin" ? "Admin" : "Employé"})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* LISTE DYNAMIQUE DES ARTICLES */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>
                    Articles & accessoires demandés :
                  </label>
                  <button
                    type="button"
                    onClick={handleAddEditArticleField}
                    style={{
                      background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#2563EB",
                      padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4
                    }}
                  >
                    <Plus size={14} /> Ajouter un article
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {editForm.articles.map((art, idx) => (
                    <div key={idx} style={{
                      display: "flex", gap: 6, alignItems: "center",
                      background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "6px 8px", borderRadius: 10
                    }}>
                      <div style={{ flex: 1, minWidth: 100 }}>
                        <input
                          type="text"
                          required
                          className="bs-input"
                          style={{ height: 38, fontSize: 13.5, width: "100%", padding: "0 10px" }}
                          placeholder="Article / accessoire..."
                          value={art.nom}
                          onChange={(e) => handleUpdateEditArticleField(idx, "nom", e.target.value)}
                        />
                      </div>
                      <div style={{ width: 52, flexShrink: 0 }}>
                        <input
                          type="number"
                          min="1"
                          required
                          className="bs-input"
                          style={{ height: 38, fontSize: 13.5, fontWeight: 700, textAlign: "center", width: "100%", padding: "0 2px" }}
                          placeholder="Qté"
                          title="Quantité"
                          value={art.quantite}
                          onChange={(e) => handleUpdateEditArticleField(idx, "quantite", Math.max(1, parseInt(e.target.value) || 1))}
                        />
                      </div>
                      <div style={{ width: 78, flexShrink: 0 }}>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          className="bs-input"
                          style={{ height: 38, fontSize: 13, textAlign: "right", fontWeight: 700, width: "100%", padding: "0 6px" }}
                          placeholder="Prix U."
                          title="Prix unitaire"
                          value={art.prixUnitaire}
                          onChange={(e) => handleUpdateEditArticleField(idx, "prixUnitaire", e.target.value)}
                        />
                      </div>
                      {editForm.articles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEditArticleField(idx)}
                          style={{
                            background: "#FEE2E2", border: "none", color: "#DC2626",
                            width: 32, height: 38, borderRadius: 8, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, padding: 0
                          }}
                          title="Supprimer la ligne"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION PHOTOS (FACULTATIF, LIMITE = NOMBRE D'ARTICLES) */}
              <div style={{
                background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 14,
                padding: 16, marginBottom: 20
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Camera size={16} color="#2563EB" /> Photos des articles / appareil
                  </label>
                  <span style={{
                    fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 10,
                    background: editPhotos.length >= editForm.articles.length ? "#FEF3C7" : "#EFF6FF",
                    color: editPhotos.length >= editForm.articles.length ? "#B45309" : "#1D4ED8"
                  }}>
                    {editPhotos.length} / {editForm.articles.length} photo{editForm.articles.length > 1 ? "s" : ""} (1 max par article)
                  </span>
                </div>

                {/* GRILLE DES PHOTOS EXISTANTES */}
                {editPhotos.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 10, marginBottom: 12 }}>
                    {editPhotos.map((src, index) => (
                      <div key={index} style={{
                        position: "relative", borderRadius: 10, overflow: "hidden",
                        border: "1.5px solid #CBD5E1", background: "#fff", aspectRatio: "1 / 1"
                      }}>
                        <img 
                          src={src} 
                          alt={`Photo ${index + 1}`} 
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                        />
                        <div style={{
                          position: "absolute", top: 4, left: 4, background: "rgba(0,0,0,0.6)",
                          color: "#fff", fontSize: 10, fontWeight: 800, padding: "1px 5px", borderRadius: 6
                        }}>
                          #{index + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveEditPhoto(index)}
                          title="Supprimer cette photo"
                          style={{
                            position: "absolute", top: 4, right: 4, background: "#EF4444",
                            color: "#fff", border: "none", width: 22, height: 22, borderRadius: "50%",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* BOUTON D'AJOUT SI SLOTS DISPONIBLES */}
                {editPhotos.length < editForm.articles.length ? (
                  <div>
                    <input
                      type="file"
                      ref={editFileInputRef}
                      accept="image/*"
                      multiple
                      onChange={handleEditPhotoSelect}
                      style={{ display: "none" }}
                    />
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      style={{
                        width: "100%", border: "1.5px dashed #93C5FD", background: "#EFF6FF",
                        borderRadius: 10, padding: "10px", color: "#2563EB", fontWeight: 700,
                        fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center",
                        justifyContent: "center", gap: 8
                      }}
                    >
                      <Upload size={16} /> Ajouter des photos ({editForm.articles.length - editPhotos.length} restante{editForm.articles.length - editPhotos.length > 1 ? "s" : ""})
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 11.5, color: "#64748B", fontStyle: "italic", textAlign: "center" }}>
                    Limite de {editForm.articles.length} photo{editForm.articles.length > 1 ? "s" : ""} atteinte. Ajoutez un article pour ajouter une photo supplémentaire.
                  </div>
                )}
              </div>

              {/* FRAIS LIVRAISON & TOTAL CALCULÉ */}
              <div style={{
                background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: 14,
                padding: "14px 18px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "#1E40AF" }}>
                    Frais de livraison :
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    className="bs-input"
                    style={{ width: 110, background: "#fff", fontWeight: 700, textAlign: "right" }}
                    value={editForm.fraisLivraison}
                    onChange={(e) => setEditForm({ ...editForm, fraisLivraison: Number(e.target.value) || 0 })}
                  />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1E40AF" }}>KMF</span>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11.5, color: "#1E40AF", fontWeight: 700 }}>SOUS-TOTAL ESTIMÉ :</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#1D4ED8" }}>
                    {fcfa(editCalculatedTotal)}
                  </div>
                </div>
              </div>

              {/* DESCRIPTION & NOTES */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div className="bs-input-group">
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                    Détails ou exigences client :
                  </label>
                  <textarea
                    className="bs-input"
                    style={{ minHeight: 70, resize: "vertical", fontSize: 13 }}
                    placeholder="Détails du client..."
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </div>

                <div className="bs-input-group">
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                    Note interne / Message devis :
                  </label>
                  <textarea
                    className="bs-input"
                    style={{ minHeight: 70, resize: "vertical", fontSize: 13 }}
                    placeholder="Message accompagnant le devis..."
                    value={editForm.messageAdmin}
                    onChange={(e) => setEditForm({ ...editForm, messageAdmin: e.target.value })}
                  />
                </div>
              </div>

              {/* ACTIONS */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  style={{
                    background: "#F1F5F9", border: "none", color: "#475569",
                    padding: "10px 18px", borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: "pointer"
                  }}
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={savingEdit}
                  className="bs-btn-primary"
                  style={{
                    padding: "10px 22px", fontSize: 14, fontWeight: 800,
                    display: "inline-flex", alignItems: "center", gap: 8
                  }}
                >
                  <CheckCircle2 size={16} />
                  {savingEdit ? "Enregistrement..." : "Enregistrer les modifications"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL DE CRÉATION DIRECTE D'UNE COMMANDE SUR-MESURE ── */}
      {isCreateModalOpen && (
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
            {/* EN-TÊTE MODAL CRÉATION */}
            <div style={{
              padding: "16px 20px", background: "linear-gradient(135deg, #1E293B, #0F172A)",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>
                  + Créer une nouvelle commande / demande sur-mesure
                </h3>
                <span style={{ fontSize: 12, color: "#94A3B8" }}>
                  Enregistrez directement une commande client reçue en magasin ou par téléphone
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* FORMULAIRE DE CRÉATION */}
            <form onSubmit={handleCreateDirectOrder} style={{ padding: 24 }}>
              {/* COORDONNÉES DU CLIENT & MODÈLE */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                <div className="bs-input-group">
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                    Nom du client * :
                  </label>
                  <input
                    type="text"
                    required
                    className="bs-input"
                    placeholder="Ex: Mohamed Ali"
                    value={createForm.nomClient}
                    onChange={(e) => setCreateForm({ ...createForm, nomClient: e.target.value })}
                  />
                </div>

                <div className="bs-input-group">
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                    Téléphone (WhatsApp) * :
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    className="bs-input"
                    placeholder="Ex: +269 341 00 00"
                    value={createForm.telephoneClient}
                    onChange={(e) => setCreateForm({ ...createForm, telephoneClient: e.target.value.replace(/[^0-9+ ]/g, "") })}
                    onKeyDown={(e) => {
                      if (!/[0-9+ ]/.test(e.key) && !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div className="bs-input-group">
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                    Modèle d'appareil * :
                  </label>
                  <input
                    type="text"
                    required
                    className="bs-input"
                    placeholder="Ex: iPhone 14 Pro Max, S23 Ultra..."
                    value={createForm.modeleAppareil}
                    onChange={(e) => setCreateForm({ ...createForm, modeleAppareil: e.target.value })}
                  />
                </div>

                <div className="bs-input-group">
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                    Statut initial :
                  </label>
                  <select
                    className="bs-input"
                    value={createForm.statut}
                    onChange={(e) => setCreateForm({ ...createForm, statut: e.target.value })}
                  >
                    <option value="en_attente">En attente (Non chiffré)</option>
                    <option value="propose">Devis proposé</option>
                    <option value="valide">Validé directement</option>
                  </select>
                </div>
              </div>

              {isAdmin && (
                <div className="bs-input-group" style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                    Attribuer à un employé :
                  </label>
                  <select
                    className="bs-select"
                    value={createForm.employeId}
                    onChange={(e) => setCreateForm({ ...createForm, employeId: e.target.value })}
                    style={{ width: "100%", height: 42, fontSize: 13 }}
                  >
                    <option value="">-- Attribué à l'administrateur / Tout le monde --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.nom} ({emp.role === "admin" ? "Admin" : "Employé"})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* LISTE DYNAMIQUE DES ARTICLES */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>
                    Articles & accessoires demandés :
                  </label>
                  <button
                    type="button"
                    onClick={handleAddArticleField}
                    style={{
                      background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#2563EB",
                      padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4
                    }}
                  >
                    <Plus size={14} /> Ajouter un article
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {createForm.articles.map((art, idx) => (
                    <div key={idx} style={{
                      display: "flex", gap: 6, alignItems: "center",
                      background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "6px 8px", borderRadius: 10
                    }}>
                      <div style={{ flex: 1, minWidth: 100 }}>
                        <input
                          type="text"
                          required
                          className="bs-input"
                          style={{ height: 38, fontSize: 13.5, width: "100%", padding: "0 10px" }}
                          placeholder="Article / accessoire..."
                          value={art.nom}
                          onChange={(e) => handleUpdateArticleField(idx, "nom", e.target.value)}
                        />
                      </div>
                      <div style={{ width: 52, flexShrink: 0 }}>
                        <input
                          type="number"
                          min="1"
                          required
                          className="bs-input"
                          style={{ height: 38, fontSize: 13.5, fontWeight: 700, textAlign: "center", width: "100%", padding: "0 2px" }}
                          placeholder="Qté"
                          title="Quantité"
                          value={art.quantite}
                          onChange={(e) => handleUpdateArticleField(idx, "quantite", Math.max(1, parseInt(e.target.value) || 1))}
                        />
                      </div>
                      <div style={{ width: 78, flexShrink: 0 }}>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          className="bs-input"
                          style={{ height: 38, fontSize: 13, textAlign: "right", fontWeight: 700, width: "100%", padding: "0 6px" }}
                          placeholder="Prix U."
                          title="Prix unitaire"
                          value={art.prixUnitaire}
                          onChange={(e) => handleUpdateArticleField(idx, "prixUnitaire", e.target.value)}
                        />
                      </div>
                      {createForm.articles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveArticleField(idx)}
                          style={{
                            background: "#FEE2E2", border: "none", color: "#DC2626",
                            width: 32, height: 38, borderRadius: 8, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, padding: 0
                          }}
                          title="Supprimer la ligne"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION PHOTOS (FACULTATIF, LIMITE = NOMBRE D'ARTICLES) */}
              <div style={{
                background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 14,
                padding: 16, marginBottom: 20
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Camera size={16} color="#2563EB" /> Photos des articles / appareil
                  </label>
                  <span style={{
                    fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 10,
                    background: createPhotos.length >= createForm.articles.length ? "#FEF3C7" : "#EFF6FF",
                    color: createPhotos.length >= createForm.articles.length ? "#B45309" : "#1D4ED8"
                  }}>
                    {createPhotos.length} / {createForm.articles.length} photo{createForm.articles.length > 1 ? "s" : ""} (1 max par article)
                  </span>
                </div>

                {/* GRILLE DES PHOTOS EXISTANTES */}
                {createPhotos.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 10, marginBottom: 12 }}>
                    {createPhotos.map((src, index) => (
                      <div key={index} style={{
                        position: "relative", borderRadius: 10, overflow: "hidden",
                        border: "1.5px solid #CBD5E1", background: "#fff", aspectRatio: "1 / 1"
                      }}>
                        <img 
                          src={src} 
                          alt={`Photo ${index + 1}`} 
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                        />
                        <div style={{
                          position: "absolute", top: 4, left: 4, background: "rgba(0,0,0,0.6)",
                          color: "#fff", fontSize: 10, fontWeight: 800, padding: "1px 5px", borderRadius: 6
                        }}>
                          #{index + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCreatePhoto(index)}
                          title="Supprimer cette photo"
                          style={{
                            position: "absolute", top: 4, right: 4, background: "#EF4444",
                            color: "#fff", border: "none", width: 22, height: 22, borderRadius: "50%",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* BOUTON D'AJOUT SI SLOTS DISPONIBLES */}
                {createPhotos.length < createForm.articles.length ? (
                  <div>
                    <input
                      type="file"
                      ref={createFileInputRef}
                      accept="image/*"
                      multiple
                      onChange={handleCreatePhotoSelect}
                      style={{ display: "none" }}
                    />
                    <button
                      type="button"
                      onClick={() => createFileInputRef.current?.click()}
                      style={{
                        width: "100%", border: "1.5px dashed #93C5FD", background: "#EFF6FF",
                        borderRadius: 10, padding: "10px", color: "#2563EB", fontWeight: 700,
                        fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center",
                        justifyContent: "center", gap: 8
                      }}
                    >
                      <Upload size={16} /> Ajouter des photos ({createForm.articles.length - createPhotos.length} restante{createForm.articles.length - createPhotos.length > 1 ? "s" : ""})
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 11.5, color: "#64748B", fontStyle: "italic", textAlign: "center" }}>
                    Limite de {createForm.articles.length} photo{createForm.articles.length > 1 ? "s" : ""} atteinte. Ajoutez un article pour ajouter une photo supplémentaire.
                  </div>
                )}
              </div>

              {/* FRAIS LIVRAISON & TOTAL CALCULÉ */}
              <div style={{
                background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: 14,
                padding: "14px 18px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "#1E40AF" }}>
                    Frais de livraison :
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    className="bs-input"
                    style={{ width: 110, background: "#fff", fontWeight: 700, textAlign: "right" }}
                    value={createForm.fraisLivraison}
                    onChange={(e) => setCreateForm({ ...createForm, fraisLivraison: Number(e.target.value) || 0 })}
                  />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1E40AF" }}>KMF</span>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11.5, color: "#1E40AF", fontWeight: 700 }}>SOUS-TOTAL ESTIMÉ :</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#1D4ED8" }}>
                    {fcfa(createCalculatedTotal)}
                  </div>
                </div>
              </div>

              {/* DESCRIPTION & NOTES */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div className="bs-input-group">
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                    Détails ou exigences client :
                  </label>
                  <textarea
                    className="bs-input"
                    style={{ minHeight: 70, resize: "vertical", fontSize: 13 }}
                    placeholder="Ex: Couleur violette souhaitée, modèle précis..."
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  />
                </div>

                <div className="bs-input-group">
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                    Note interne / Message devis :
                  </label>
                  <textarea
                    className="bs-input"
                    style={{ minHeight: 70, resize: "vertical", fontSize: 13 }}
                    placeholder="Ex: Commande passée au comptoir, matériel vérifié..."
                    value={createForm.messageAdmin}
                    onChange={(e) => setCreateForm({ ...createForm, messageAdmin: e.target.value })}
                  />
                </div>
              </div>

              {/* ACTIONS */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{
                    background: "#F1F5F9", border: "none", color: "#475569",
                    padding: "10px 18px", borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: "pointer"
                  }}
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={creatingOrder}
                  className="bs-btn-primary"
                  style={{
                    padding: "10px 22px", fontSize: 14, fontWeight: 800,
                    display: "inline-flex", alignItems: "center", gap: 8
                  }}
                >
                  <Plus size={16} />
                  {creatingOrder ? "Enregistrement..." : "Enregistrer la commande"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                      Motif de refus client : {selectedRequest.motifRefus}
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
