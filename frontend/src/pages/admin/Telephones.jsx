import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { 
  Smartphone, Plus, Trash2, Edit2, Check, X, Layers, ChevronDown, ChevronRight, 
  Sparkles, Search, CheckCircle2, AlertCircle 
} from "lucide-react";
import api from "../../api";

export default function AdminTelephones() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedBrandIds, setExpandedBrandIds] = useState({});

  // Formulaire nouvelle marque
  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const [newBrandNom, setNewBrandNom] = useState("");
  const [newBrandIcone, setNewBrandIcone] = useState("");

  // Édition marque
  const [editingBrandId, setEditingBrandId] = useState(null);
  const [editBrandNom, setEditBrandNom] = useState("");

  // Formulaire ajout modèle (par marque)
  const [addingModelForBrandId, setAddingModelForBrandId] = useState(null);
  const [newModelNom, setNewModelNom] = useState("");
  const [batchModelsText, setBatchModelsText] = useState("");
  const [isBatchMode, setIsBatchMode] = useState(false);

  // Édition modèle
  const [editingModelId, setEditingModelId] = useState(null);
  const [editModelNom, setEditModelNom] = useState("");

  useEffect(() => {
    loadPhones();
  }, []);

  async function loadPhones() {
    setLoading(true);
    try {
      const res = await api.get("/admin/phones");
      const data = res.data || [];
      setBrands(data);

      // Ouvrir toutes les marques par défaut si moins de 4
      if (data.length <= 4) {
        const initExpanded = {};
        data.forEach(b => { initExpanded[b.id] = true; });
        setExpandedBrandIds(initExpanded);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors du chargement des marques et modèles.");
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(brandId) {
    setExpandedBrandIds(prev => ({
      ...prev,
      [brandId]: !prev[brandId]
    }));
  }

  // --- GESTION DES MARQUES ---

  async function handleCreateBrand(e) {
    e.preventDefault();
    if (!newBrandNom.trim()) return;

    try {
      await api.post("/admin/phones/brands", {
        nom: newBrandNom.trim(),
        iconeUrl: newBrandIcone.trim() || null
      });
      toast.success(`Marque "${newBrandNom.trim()}" créée avec succès.`);
      setNewBrandNom("");
      setNewBrandIcone("");
      setShowAddBrandModal(false);
      loadPhones();
    } catch (err) {
      toast.error(err.response?.data?.message || "Impossible de créer la marque.");
    }
  }

  async function handleUpdateBrand(brandId) {
    if (!editBrandNom.trim()) return;
    try {
      await api.put(`/admin/phones/brands/${brandId}`, { nom: editBrandNom.trim() });
      toast.success("Marque mise à jour.");
      setEditingBrandId(null);
      loadPhones();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la mise à jour.");
    }
  }

  async function handleDeleteBrand(brand) {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer la marque "${brand.nom}" et TOUS ses modèles associés ?`)) {
      return;
    }
    try {
      await api.delete(`/admin/phones/brands/${brand.id}`);
      toast.success(`Marque "${brand.nom}" supprimée.`);
      loadPhones();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la suppression.");
    }
  }

  // --- GESTION DES SOUS-MODÈLES ---

  async function handleCreateModel(brandId) {
    if (isBatchMode) {
      if (!batchModelsText.trim()) return;
      try {
        const res = await api.post("/admin/phones/models/batch", {
          brandId,
          noms: batchModelsText
        });
        toast.success(res.data?.message || "Modèles ajoutés avec succès.");
        setBatchModelsText("");
        setAddingModelForBrandId(null);
        loadPhones();
      } catch (err) {
        toast.error(err.response?.data?.message || "Erreur lors de l'ajout en lot.");
      }
    } else {
      if (!newModelNom.trim()) return;
      try {
        await api.post("/admin/phones/models", {
          brandId,
          nom: newModelNom.trim()
        });
        toast.success(`Modèle "${newModelNom.trim()}" ajouté.`);
        setNewModelNom("");
        setAddingModelForBrandId(null);
        loadPhones();
      } catch (err) {
        toast.error(err.response?.data?.message || "Erreur lors de l'ajout du modèle.");
      }
    }
  }

  async function handleUpdateModel(modelId) {
    if (!editModelNom.trim()) return;
    try {
      await api.put(`/admin/phones/models/${modelId}`, { nom: editModelNom.trim() });
      toast.success("Modèle modifié.");
      setEditingModelId(null);
      loadPhones();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la modification.");
    }
  }

  async function handleDeleteModel(model) {
    if (!window.confirm(`Supprimer le modèle "${model.nomComplet || model.nom}" ?`)) return;
    try {
      await api.delete(`/admin/phones/models/${model.id}`);
      toast.success("Modèle supprimé.");
      loadPhones();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la suppression.");
    }
  }

  // Presets rapides pour assister l'administrateur
  async function applyPreset(brandId, brandName) {
    let presetModels = [];
    if (brandName.toLowerCase().includes("iphone") || brandName.toLowerCase().includes("apple")) {
      presetModels = [
        "iPhone 11", "iPhone 11 Pro", "iPhone 11 Pro Max",
        "iPhone 12", "iPhone 12 Pro", "iPhone 12 Pro Max",
        "iPhone 13", "iPhone 13 Pro", "iPhone 13 Pro Max",
        "iPhone 14", "iPhone 14 Plus", "iPhone 14 Pro", "iPhone 14 Pro Max",
        "iPhone 15", "iPhone 15 Plus", "iPhone 15 Pro", "iPhone 15 Pro Max",
        "iPhone 16", "iPhone 16 Plus", "iPhone 16 Pro", "iPhone 16 Pro Max",
        "iPhone XR", "iPhone X / XS", "iPhone XS Max"
      ];
    } else if (brandName.toLowerCase().includes("samsung")) {
      presetModels = [
        "Samsung S21", "Samsung S21 Ultra", "Samsung S22", "Samsung S22 Ultra",
        "Samsung S23", "Samsung S23 Ultra", "Samsung S24", "Samsung S24 Ultra",
        "Samsung A14", "Samsung A15", "Samsung A24", "Samsung A25", "Samsung A34", "Samsung A54", "Samsung A55"
      ];
    } else if (brandName.toLowerCase().includes("tecno")) {
      presetModels = [
        "Tecno Spark 10", "Tecno Spark 20", "Tecno Spark 20 Pro",
        "Tecno Camon 20", "Tecno Camon 30", "Tecno Pop 7", "Tecno Pop 8"
      ];
    }

    if (presetModels.length === 0) {
      toast("Aucun modèle automatique prédéfini pour cette marque.");
      return;
    }

    try {
      await api.post("/admin/phones/models/batch", {
        brandId,
        noms: presetModels
      });
      toast.success(`${presetModels.length} modèles pré-remplis pour ${brandName} !`);
      loadPhones();
    } catch (err) {
      toast.error("Erreur lors de l'application du modèle.");
    }
  }

  // Filtrage
  const filteredBrands = brands.filter(b => {
    const matchBrand = b.nom.toLowerCase().includes(search.toLowerCase());
    const matchModel = (b.modeles || []).some(m => (m.nom || "").toLowerCase().includes(search.toLowerCase()) || (m.nomComplet || "").toLowerCase().includes(search.toLowerCase()));
    return matchBrand || matchModel;
  });

  const totalModelesCount = brands.reduce((sum, b) => sum + (b.modeles?.length || 0), 0);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 60 }}>
      {/* EN-TÊTE DE LA PAGE */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: "var(--forest-dark)", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 10 }}>
            <Smartphone size={26} color="var(--forest)" />
            Modèles de Téléphones & Compatibilités
          </h2>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13.5, lineHeight: 1.5 }}>
            Gérez dynamiquement vos marques (iPhone, Samsung...) et leurs sous-modèles (XR, 11, 14 Pro Max...). Ces modèles apparaissent instantanément dans la fiche d'ajout de produit et permettent aux clients de sélectionner leur téléphone sur le site.
          </p>
        </div>

        <button
          onClick={() => setShowAddBrandModal(true)}
          style={{
            background: "var(--forest)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 18px",
            fontSize: 13.5,
            fontWeight: 800,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(31, 77, 58, 0.25)"
          }}
        >
          <Plus size={16} /> Ajouter une Marque
        </button>
      </div>

      {/* STATS & RECHERCHE */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "var(--forest-light)", padding: 10, borderRadius: 10, color: "var(--forest)" }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Marques Actives</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--forest-dark)" }}>{brands.length}</div>
          </div>
        </div>

        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "#EFF6FF", padding: 10, borderRadius: 10, color: "#1D4ED8" }}>
            <Smartphone size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Total Modèles Enregistrés</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#1E3A8A" }}>{totalModelesCount}</div>
          </div>
        </div>
      </div>

      {/* BARRE DE RECHERCHE */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <Search size={18} color="var(--muted)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
        <input
          type="text"
          className="bs-input"
          placeholder="Rechercher une marque ou un modèle spécifique (ex: iPhone 14, S24 Ultra, Camon...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: 42, height: 44, fontSize: 14 }}
        />
      </div>

      {/* CHARGEMENT */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
          Chargement des modèles de téléphones...
        </div>
      )}

      {/* AUCUNE MARQUE */}
      {!loading && brands.length === 0 && (
        <div style={{ background: "var(--paper)", border: "1.5px dashed var(--line)", borderRadius: 16, padding: "50px 20px", textAlign: "center" }}>
          <Smartphone size={40} color="var(--muted)" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ fontSize: 18, color: "var(--forest-dark)", margin: "0 0 6px" }}>Aucune marque de téléphone enregistrée</h3>
          <p style={{ color: "var(--muted)", fontSize: 13.5, maxWidth: 480, margin: "0 auto 18px" }}>
            Commencez par ajouter votre première marque (ex: iPhone, Samsung, Tecno) pour ensuite y lister vos sous-modèles compatibles.
          </p>
          <button
            onClick={() => setShowAddBrandModal(true)}
            style={{
              background: "var(--forest)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontWeight: 800,
              fontSize: 13.5,
              cursor: "pointer"
            }}
          >
            + Créer la première marque
          </button>
        </div>
      )}

      {/* LISTE DES MARQUES & MODÈLES */}
      {!loading && filteredBrands.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filteredBrands.map((brand) => {
            const isExpanded = Boolean(expandedBrandIds[brand.id]);
            const models = brand.modeles || [];
            const isEditing = editingBrandId === brand.id;

            return (
              <div 
                key={brand.id}
                style={{
                  background: "var(--paper)",
                  border: isExpanded ? "1.5px solid var(--forest)" : "1px solid var(--line)",
                  borderRadius: 14,
                  overflow: "hidden",
                  transition: "all 0.15s ease",
                  boxShadow: isExpanded ? "0 4px 16px rgba(0,0,0,0.06)" : "none"
                }}
              >
                {/* EN-TÊTE DE LA MARQUE */}
                <div 
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 18px",
                    background: isExpanded ? "var(--forest-light)" : "transparent",
                    cursor: "pointer",
                    userSelect: "none"
                  }}
                  onClick={() => toggleExpand(brand.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                    <button
                      type="button"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "var(--forest-dark)" }}
                    >
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </button>

                    {isEditing ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          className="bs-input"
                          style={{ height: 34, fontSize: 14, fontWeight: 700, width: 220 }}
                          value={editBrandNom}
                          onChange={(e) => setEditBrandNom(e.target.value)}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateBrand(brand.id)}
                          style={{ background: "var(--forest)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                        >
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingBrandId(null)}
                          style={{ background: "var(--line)", color: "var(--ink)", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: "var(--forest-dark)" }}>
                          {brand.nom}
                        </span>
                        <span style={{
                          fontSize: 11.5,
                          fontWeight: 800,
                          padding: "2px 10px",
                          borderRadius: 20,
                          background: models.length > 0 ? "#DCFCE7" : "#FEE2E2",
                          color: models.length > 0 ? "#166534" : "#991B1B"
                        }}>
                          {models.length} modèle(s) configuré(s)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* BOUTONS ACTIONS MARQUE */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                    {!isEditing && (
                      <button
                        type="button"
                        className="bs-icon-btn"
                        title="Modifier le nom de la marque"
                        onClick={() => {
                          setEditingBrandId(brand.id);
                          setEditBrandNom(brand.nom);
                        }}
                      >
                        <Edit2 size={15} />
                      </button>
                    )}

                    <button
                      type="button"
                      className="bs-icon-btn"
                      title="Supprimer la marque"
                      style={{ color: "#B4483A" }}
                      onClick={() => handleDeleteBrand(brand)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* CONTENU DÉPLIÉ (SOUS-MODÈLES) */}
                {isExpanded && (
                  <div style={{ padding: "18px", borderTop: "1px solid var(--line)" }}>
                    {/* BARRE D'ACTION SOUS-MODÈLE */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
                        Sous-modèles disponibles pour {brand.nom} :
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {/* Bouton preset si la marque est vide */}
                        {models.length === 0 && (
                          <button
                            type="button"
                            onClick={() => applyPreset(brand.id, brand.nom)}
                            style={{
                              background: "#EFF6FF",
                              color: "#1D4ED8",
                              border: "1px solid #BFDBFE",
                              borderRadius: 8,
                              padding: "6px 12px",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6
                            }}
                          >
                            <Sparkles size={14} /> Pré-remplir la gamme {brand.nom}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setAddingModelForBrandId(brand.id);
                            setIsBatchMode(false);
                            setNewModelNom("");
                          }}
                          style={{
                            background: "var(--forest-light)",
                            color: "var(--forest-dark)",
                            border: "1px solid var(--forest)",
                            borderRadius: 8,
                            padding: "6px 12px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5
                          }}
                        >
                          <Plus size={14} /> + Ajouter un modèle
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAddingModelForBrandId(brand.id);
                            setIsBatchMode(true);
                            setBatchModelsText("");
                          }}
                          style={{
                            background: "var(--paper)",
                            color: "var(--forest-dark)",
                            border: "1px solid var(--line)",
                            borderRadius: 8,
                            padding: "6px 12px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer"
                          }}
                        >
                          + Ajout en lot (Plusieurs)
                        </button>
                      </div>
                    </div>

                    {/* FORMULAIRE EN LIGNE AJOUT MODÈLE */}
                    {addingModelForBrandId === brand.id && (
                      <div style={{ background: "#F8FAFC", border: "1.5px solid var(--line)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                        {!isBatchMode ? (
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <input
                              type="text"
                              className="bs-input"
                              placeholder={`Ex: ${brand.nom} 14 Pro Max ou XR`}
                              value={newModelNom}
                              onChange={(e) => setNewModelNom(e.target.value)}
                              style={{ flex: 1, minWidth: 200, height: 38 }}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleCreateModel(brand.id)}
                              style={{ background: "var(--forest)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}
                            >
                              Ajouter
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddingModelForBrandId(null)}
                              style={{ background: "var(--line)", color: "var(--ink)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--forest-dark)" }}>
                              Collez ou écrivez plusieurs modèles (séparés par une virgule ou un retour à la ligne) :
                            </label>
                            <textarea
                              className="bs-input"
                              rows={4}
                              placeholder={`Exemple :\n${brand.nom} 11\n${brand.nom} 12 Pro\n${brand.nom} 13 Pro Max\n${brand.nom} 14`}
                              value={batchModelsText}
                              onChange={(e) => setBatchModelsText(e.target.value)}
                              style={{ lineHeight: 1.5, fontSize: 13 }}
                              autoFocus
                            />
                            <div style={{ display: "flex", gap: 10 }}>
                              <button
                                type="button"
                                onClick={() => handleCreateModel(brand.id)}
                                style={{ background: "var(--forest)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}
                              >
                                Enregistrer ces modèles
                              </button>
                              <button
                                type="button"
                                onClick={() => setAddingModelForBrandId(null)}
                                style={{ background: "var(--line)", color: "var(--ink)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* GRILLE DES MODÈLES EXISTANTS */}
                    {models.length === 0 ? (
                      <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: 13, background: "rgba(0,0,0,0.02)", borderRadius: 10 }}>
                        Aucun sous-modèle enregistré pour {brand.nom}. Cliquez sur "+ Ajouter un modèle" ou utilisez le bouton de pré-remplissage.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {models.map((model) => {
                          const isModelEditing = editingModelId === model.id;

                          if (isModelEditing) {
                            return (
                              <div key={model.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#FFFBEB", border: "1px solid #F59E0B", borderRadius: 8, padding: "2px 6px" }}>
                                <input
                                  type="text"
                                  className="bs-input"
                                  style={{ height: 28, fontSize: 12, padding: "2px 6px", width: 140 }}
                                  value={editModelNom}
                                  onChange={(e) => setEditModelNom(e.target.value)}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateModel(model.id)}
                                  style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                                >
                                  OK
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingModelId(null)}
                                  style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: "2px 4px" }}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div 
                              key={model.id}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                background: "var(--paper)",
                                border: "1px solid var(--line)",
                                borderRadius: 8,
                                padding: "6px 12px",
                                fontSize: 13,
                                fontWeight: 700,
                                color: "var(--ink)",
                                transition: "all 0.15s ease"
                              }}
                            >
                              <span>{model.nomComplet || model.nom}</span>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <button
                                  type="button"
                                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--muted)" }}
                                  title="Renommer"
                                  onClick={() => {
                                    setEditingModelId(model.id);
                                    setEditModelNom(model.nom);
                                  }}
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  type="button"
                                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#B4483A" }}
                                  title="Supprimer ce modèle"
                                  onClick={() => handleDeleteModel(model)}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CRÉATION DE MARQUE */}
      {showAddBrandModal && (
        <div 
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999
          }}
          onClick={() => setShowAddBrandModal(false)}
        >
          <div 
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 24,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: "var(--forest-dark)", fontWeight: 900 }}>
                Nouvelle Marque de Téléphone
              </h3>
              <button 
                type="button"
                onClick={() => setShowAddBrandModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateBrand} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="bs-input-group">
                <label style={{ fontSize: 13, fontWeight: 700 }}>Nom de la marque *</label>
                <input
                  type="text"
                  className="bs-input"
                  placeholder="Ex: iPhone, Samsung, Tecno, Infinix, Xiaomi..."
                  value={newBrandNom}
                  onChange={(e) => setNewBrandNom(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    background: "var(--forest)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    padding: "11px 16px",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: "pointer"
                  }}
                >
                  Créer la Marque
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddBrandModal(false)}
                  style={{
                    background: "var(--line)",
                    color: "var(--ink)",
                    border: "none",
                    borderRadius: 10,
                    padding: "11px 16px",
                    fontSize: 14,
                    cursor: "pointer"
                  }}
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
