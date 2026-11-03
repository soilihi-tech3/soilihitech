import { SkeletonTableRows } from "../../components/Skeleton.jsx";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { PlusCircle, List, Pencil, Trash2, Image as ImageIcon, Layers } from "lucide-react";
import api from "../../api";
import ImageUploader from "../../components/ImageUploader.jsx";
import TablePagination from "../../components/TablePagination.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";

export default function AdminCategories() {
  const [activeTab, setActiveTab] = useState("liste"); // "liste" | "ajout" | "familles"
  const [categories, setCategories] = useState([]);
  const [familles, setFamilles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingFamilleId, setEditingFamilleId] = useState(null);

  const [search, setSearch] = useState("");

  const initialCategoryForm = {
    nom: "",
    imageUrl: ""
  };
  const [categoryForm, setCategoryForm] = useState(initialCategoryForm);

  const initialFamilleForm = {
    nom: "",
    categoryId: "",
    description: "",
    imageUrl: ""
  };
  const [familleForm, setFamilleForm] = useState(initialFamilleForm);

  function silentSyncCategories() {
    Promise.all([
      api.get("/admin/categories"),
      api.get("/admin/familles")
    ]).then(([resCats, resFams]) => {
      setCategories(resCats.data || []);
      setFamilles(resFams.data || []);
    }).catch(() => {});
  }

  function load() {
    setLoading(true);
    Promise.all([
      api.get("/admin/categories"),
      api.get("/admin/familles")
    ]).then(([resCats, resFams]) => {
      const cats = resCats.data || [];
      const fams = resFams.data || [];
      setCategories(cats);
      setFamilles(fams);
      if (cats.length > 0 && !familleForm.categoryId) {
        setFamilleForm(f => ({ ...f, categoryId: f.categoryId || cats[0].id }));
      }
    }).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const unsub = subscribeRealtime((detail) => {
      if (detail.type === "category_updated") {
        silentSyncCategories();
      }
    });
    return () => unsub();
  }, []);

  function showToast(msg, type = "success") {
    if (type === "success") {
      toast.success(msg);
    } else {
      toast.error(msg);
    }
  }

  // --- CATEGORY ACTIONS ---
  function startEditCategory(cat) {
    setEditingId(cat.id);
    setCategoryForm({
      nom: cat.nom || "",
      imageUrl: cat.imageUrl || ""
    });
    setActiveTab("ajout");
  }

  function cancelEditCategory() {
    setEditingId(null);
    setCategoryForm(initialCategoryForm);
    setActiveTab("liste");
  }

  async function handleCategorySubmit(e) {
    e.preventDefault();
    if (!categoryForm.nom.trim()) return;

    try {
      if (editingId) {
        const res = await api.put(`/admin/categories/${editingId}`, categoryForm);
        const updatedCat = res.data;
        setCategories((prev) =>
          prev.map((c) =>
            c.id === editingId
              ? (updatedCat && updatedCat.id ? updatedCat : { ...c, ...categoryForm })
              : c
          )
        );
        showToast("Catégorie modifiée avec succès !");
      } else {
        const res = await api.post("/admin/categories", categoryForm);
        const newCat = res.data;
        const newCatItem = newCat && newCat.id ? newCat : { ...categoryForm, id: Date.now() };
        setCategories((prev) => [newCatItem, ...prev]);
        showToast("Nouvelle catégorie ajoutée !");
      }
      setEditingId(null);
      setCategoryForm(initialCategoryForm);
      setActiveTab("liste");
      silentSyncCategories();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur inconnue.";
      showToast("Erreur : " + msg, "error");
    }
  }

  async function deleteCategory(id) {
    if (!confirm("Voulez-vous vraiment supprimer cette catégorie ?")) return;
    setCategories((prev) => prev.filter((c) => c.id !== id));
    showToast("Catégorie supprimée.");
    try {
      await api.delete(`/admin/categories/${id}`);
      silentSyncCategories();
    } catch (err) {
      load();
    }
  }

  // --- SOUS-CATÉGORIES (FAMILLES) ACTIONS ---
  function startEditFamille(fam) {
    setEditingFamilleId(fam.id);
    setFamilleForm({
      nom: fam.nom || "",
      categoryId: fam.categoryId || fam.category?.id || (categories[0]?.id || ""),
      description: fam.description || "",
      imageUrl: fam.imageUrl || ""
    });
  }

  function cancelEditFamille() {
    setEditingFamilleId(null);
    setFamilleForm({
      ...initialFamilleForm,
      categoryId: categories[0]?.id || ""
    });
  }

  async function handleFamilleSubmit(e) {
    e.preventDefault();
    if (!familleForm.nom.trim()) return;

    const payload = {
      nom: familleForm.nom.trim(),
      categoryId: familleForm.categoryId ? Number(familleForm.categoryId) : null,
      description: familleForm.description,
      imageUrl: familleForm.imageUrl
    };

    try {
      if (editingFamilleId) {
        const res = await api.put(`/admin/familles/${editingFamilleId}`, payload);
        const updatedFam = res.data;
        setFamilles((prev) =>
          prev.map((f) =>
            f.id === editingFamilleId
              ? (updatedFam && updatedFam.id ? updatedFam : { ...f, ...payload })
              : f
          )
        );
        showToast("Sous-catégorie modifiée !");
      } else {
        const res = await api.post("/admin/familles", payload);
        const newFam = res.data;
        const newFamItem = newFam && newFam.id ? newFam : { ...payload, id: Date.now() };
        setFamilles((prev) => [...prev, newFamItem]);
        showToast("Nouvelle sous-catégorie créée !");
      }
      setEditingFamilleId(null);
      setFamilleForm({
        ...initialFamilleForm,
        categoryId: categories[0]?.id || ""
      });
      silentSyncCategories();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur inconnue.";
      showToast("Erreur : " + msg, "error");
    }
  }

  async function deleteFamille(id) {
    if (!confirm("Voulez-vous vraiment supprimer cette sous-catégorie ?")) return;
    setFamilles((prev) => prev.filter((f) => f.id !== id));
    showToast("Sous-catégorie supprimée.");
    try {
      await api.delete(`/admin/familles/${id}`);
      silentSyncCategories();
    } catch (err) {
      load();
    }
  }

  // Pagination for categories
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filteredCategories = categories.filter((c) =>
    !search || c.nom?.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => { setCurrentPage(1); }, [search]);

  const totalItems = filteredCategories.length;
  const paginatedCategories = filteredCategories.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Gestion des Catégories & Sous-catégories</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Créez vos catégories principales et associez-y leurs sous-catégories respectives.
          </p>
        </div>

        {/* TABS DE NAVIGATION */}
        <div style={{ display: "flex", gap: 8, background: "var(--paper)", padding: 4, borderRadius: 30, border: "1px solid var(--line)" }}>
          <button
            className={`bs-btn-primary ${activeTab === "liste" ? "" : "inactive"}`}
            style={{
              padding: "8px 18px", borderRadius: 24, fontSize: 13,
              background: activeTab === "liste" ? "var(--forest)" : "transparent",
              color: activeTab === "liste" ? "#fff" : "var(--muted)", boxShadow: "none"
            }}
            onClick={() => { setEditingId(null); setCategoryForm(initialCategoryForm); setActiveTab("liste"); }}
          >
            <List size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} /> Catégories ({categories.length})
          </button>

          <button
            className={`bs-btn-primary ${activeTab === "ajout" ? "" : "inactive"}`}
            style={{
              padding: "8px 18px", borderRadius: 24, fontSize: 13,
              background: activeTab === "ajout" ? "var(--forest)" : "transparent",
              color: activeTab === "ajout" ? "#fff" : "var(--muted)", boxShadow: "none"
            }}
            onClick={() => {
              if (!editingId) { setCategoryForm(initialCategoryForm); }
              setActiveTab("ajout");
            }}
          >
            <PlusCircle size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} /> {editingId ? "Modifier catégorie" : "Ajouter catégorie"}
          </button>

          <button
            className={`bs-btn-primary ${activeTab === "familles" ? "" : "inactive"}`}
            style={{
              padding: "8px 18px", borderRadius: 24, fontSize: 13,
              background: activeTab === "familles" ? "var(--forest)" : "transparent",
              color: activeTab === "familles" ? "#fff" : "var(--muted)", boxShadow: "none"
            }}
            onClick={() => setActiveTab("familles")}
          >
            <Layers size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} /> Sous-catégories ({familles.length})
          </button>
        </div>
      </div>

      {/* ONGLET 1: LISTE DES CATÉGORIES */}
      {activeTab === "liste" && (
        <div className="bs-panel" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ background: "var(--paper)", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 13, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Total Catégories</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)" }}>{categories.length}</span>
              </div>
              <div style={{ width: 1, background: "var(--line)" }}></div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 13, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Résultats</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)" }}>{filteredCategories.length}</span>
              </div>
            </div>
            
            <div style={{ display: "flex" }}>
              <input 
                className="bs-input" 
                style={{ flex: 1, maxWidth: 400 }} 
                placeholder="Rechercher une catégorie..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </div>
          </div>

          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
          <table className="bs-table" style={{ minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ width: 70 }}>Image</th>
                <th style={{ width: 220 }}>Nom de la catégorie</th>
                <th>Sous-catégories associées</th>
                <th style={{ width: 100, textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <SkeletonTableRows rows={6} cols={4} />
              )}
              {!loading && paginatedCategories.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                    Aucune catégorie trouvée.
                  </td>
                </tr>
              )}
              {!loading && paginatedCategories.map((c) => {
                const subs = familles.filter(f => Number(f.categoryId) === Number(c.id));
                return (
                  <tr key={c.id}>
                    <td>
                      {c.imageUrl ? (
                        <img
                          src={c.imageUrl}
                          alt={c.nom}
                          style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover", border: "1px solid var(--line)" }}
                        />
                      ) : (
                        <div style={{ width: 46, height: 46, borderRadius: 8, background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", color: "var(--muted)" }}>
                          <ImageIcon size={20} />
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: 800, color: "var(--forest-dark)", fontSize: 15 }}>{c.nom}</td>
                    <td>
                      {subs.length > 0 ? (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          {subs.map(s => (
                            <span 
                              key={s.id} 
                              style={{ 
                                background: "var(--forest-light)", 
                                color: "var(--forest-dark)", 
                                padding: "4px 10px", 
                                borderRadius: 12, 
                                fontSize: 12, 
                                fontWeight: 700, 
                                border: "1px solid var(--line)" 
                              }}
                            >
                              {s.nom}
                            </span>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setFamilleForm({ ...initialFamilleForm, categoryId: c.id });
                              setActiveTab("familles");
                            }}
                            style={{
                              background: "none",
                              border: "1px dashed var(--forest)",
                              color: "var(--forest)",
                              padding: "3px 8px",
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                            title="Ajouter une sous-catégorie à cette catégorie"
                          >
                            + Ajouter
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "var(--muted)", fontSize: 13, fontStyle: "italic" }}>Aucune sous-catégorie</span>
                          <button
                            type="button"
                            onClick={() => {
                              setFamilleForm({ ...initialFamilleForm, categoryId: c.id });
                              setActiveTab("familles");
                            }}
                            style={{
                              background: "none",
                              border: "1px dashed var(--forest)",
                              color: "var(--forest)",
                              padding: "3px 8px",
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                          >
                            + Ajouter
                          </button>
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button className="bs-icon-btn" title="Modifier" onClick={() => startEditCategory(c)}><Pencil size={15} /></button>{" "}
                      <button className="bs-icon-btn" title="Supprimer" style={{ color: "#B4483A" }} onClick={() => deleteCategory(c.id)}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          <TablePagination
            totalItems={totalItems}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* ONGLET 2: CREER OU MODIFIER UNE CATÉGORIE */}
      {activeTab === "ajout" && (
        <div className="bs-panel" style={{ maxWidth: 600, margin: "0 auto" }}>
          <h3 style={{ marginTop: 0, fontSize: 20, color: "var(--forest-dark)", borderBottom: "1px solid var(--line)", paddingBottom: 12, marginBottom: 20 }}>
            {editingId ? "Modifier la catégorie" : "Créer une nouvelle catégorie"}
          </h3>

          <form onSubmit={handleCategorySubmit} className="bs-auth-form" style={{ gap: 16 }}>
            <div className="bs-input-group">
              <label>Nom de la catégorie *</label>
              <input
                className="bs-input"
                required
                placeholder="ex: Électroniques, Cosmétique, Téléphonie & Accessoires..."
                value={categoryForm.nom}
                onChange={(e) => setCategoryForm(f => ({ ...f, nom: e.target.value }))}
              />
            </div>

            <ImageUploader
              label="Image d'illustration"
              value={categoryForm.imageUrl}
              onChange={(url) => setCategoryForm(f => ({ ...f, imageUrl: url }))}
            />

            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <button
                type="button"
                style={{
                  background: "var(--paper)",
                  border: "1px solid var(--line)",
                  color: "var(--ink)",
                  padding: "12px 20px",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  flex: 1
                }}
                onClick={cancelEditCategory}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="bs-btn-primary"
                style={{ flex: 2 }}
                disabled={!categoryForm.nom.trim()}
              >
                {editingId ? "Enregistrer les modifications" : "Créer la catégorie"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ONGLET 3: GESTION DES SOUS-CATÉGORIES */}
      {activeTab === "familles" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* FORMULAIRE D'AJOUT / MODIFICATION DE SOUS-CATÉGORIE */}
          <div className="bs-panel">
            <h3 style={{ marginTop: 0, fontSize: 18, color: "var(--forest-dark)", borderBottom: "1px solid var(--line)", paddingBottom: 10, marginBottom: 16 }}>
              {editingFamilleId ? "Modifier la sous-catégorie" : "Ajouter une sous-catégorie"}
            </h3>

            <form onSubmit={handleFamilleSubmit} className="bs-auth-form" style={{ gap: 14 }}>
              <div className="bs-input-group">
                <label>Catégorie parente *</label>
                <select
                  className="bs-select"
                  required
                  value={familleForm.categoryId}
                  onChange={(e) => setFamilleForm(f => ({ ...f, categoryId: e.target.value }))}
                >
                  <option value="">-- Choisir la catégorie parente --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.nom}</option>
                  ))}
                </select>
              </div>

              <div className="bs-input-group">
                <label>Nom de la sous-catégorie *</label>
                <input
                  className="bs-input"
                  required
                  placeholder="ex: Chargeurs & Blocs Rapides, Câbles USB-C, Écouteurs..."
                  value={familleForm.nom}
                  onChange={(e) => setFamilleForm(f => ({ ...f, nom: e.target.value }))}
                />
              </div>

              <div className="bs-input-group">
                <label>Description (optionnel)</label>
                <input
                  className="bs-input"
                  placeholder="ex: Chargeurs rapides, adaptateurs secteur..."
                  value={familleForm.description}
                  onChange={(e) => setFamilleForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <ImageUploader
                label="Image d'illustration (optionnel)"
                value={familleForm.imageUrl}
                onChange={(url) => setFamilleForm(f => ({ ...f, imageUrl: url }))}
              />

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                {editingFamilleId && (
                  <button
                    type="button"
                    className="bs-btn-primary"
                    style={{ background: "#E2E8E3", color: "var(--ink)", flex: 1 }}
                    onClick={cancelEditFamille}
                  >
                    Annuler
                  </button>
                )}
                <button
                  type="submit"
                  className="bs-btn-primary"
                  style={{ flex: 2 }}
                  disabled={!familleForm.nom.trim() || !familleForm.categoryId}
                >
                  {editingFamilleId ? "Enregistrer" : "Créer la sous-catégorie"}
                </button>
              </div>
            </form>
          </div>

          {/* LISTE DES SOUS-CATÉGORIES */}
          <div className="bs-panel" style={{ padding: 0 }}>
            <div style={{ background: "var(--paper)", padding: "14px 18px", borderBottom: "1px solid var(--line)", fontWeight: 800, color: "var(--forest-dark)", fontSize: 16 }}>
              Liste des sous-catégories créées ({familles.length})
            </div>

            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
            <table className="bs-table" style={{ minWidth: 500 }}>
              <thead>
                <tr>
                  <th>Sous-catégorie</th>
                  <th>Catégorie parente</th>
                  <th style={{ width: 80, textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {familles.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>
                      Aucune sous-catégorie définie.
                    </td>
                  </tr>
                ) : (
                  familles.map((fam) => {
                    const parentCat = categories.find(c => Number(c.id) === Number(fam.categoryId));
                    return (
                      <tr key={fam.id}>
                        <td style={{ fontWeight: 700, color: "var(--ink)" }}>{fam.nom}</td>
                        <td>
                          <span style={{ 
                            background: "#EFF6FF", 
                            color: "#1D4ED8", 
                            padding: "3px 10px", 
                            borderRadius: 12, 
                            fontSize: 12, 
                            fontWeight: 700, 
                            border: "1px solid #BFDBFE" 
                          }}>
                            {parentCat ? parentCat.nom : (fam.category?.nom || "Non assignée")}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button className="bs-icon-btn" title="Modifier" onClick={() => startEditFamille(fam)}><Pencil size={15} /></button>{" "}
                          <button className="bs-icon-btn" title="Supprimer" style={{ color: "#B4483A" }} onClick={() => deleteFamille(fam.id)}><Trash2 size={15} /></button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
