import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext.jsx";

// Sub-components
import SuperAdminSidebar from "./components/SuperAdminSidebar";
import SuperAdminHeader from "./components/SuperAdminHeader";
import SuperAdminKpis from "./components/SuperAdminKpis";
import BoutiquesTab from "./components/BoutiquesTab";
import UsersTab from "./components/UsersTab";
import ModulesTab from "./components/ModulesTab";

// Modals
import CreateBoutiqueModal from "./components/CreateBoutiqueModal";
import EditBoutiqueModal from "./components/EditBoutiqueModal";
import EditUserModal from "./components/EditUserModal";
import CreateUserModal from "./components/CreateUserModal";
import ConfirmModal from "./components/ConfirmModal";

export default function SuperAdmin() {
  const { user, logout } = useAuth();

  // Primary data states
  const [boutiques, setBoutiques] = useState([]);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard"); // "dashboard" | "boutiques" | "users" | "global_modules"
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Feedback notifications
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  // Modal states
  const [createForm, setCreateForm] = useState(null);
  const [createUserForm, setCreateUserForm] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editUserForm, setEditUserForm] = useState(null);
  const [deleteBoutiqueId, setDeleteBoutiqueId] = useState(null);
  const [deleteUserObj, setDeleteUserObj] = useState(null);
  const [modulesForm, setModulesForm] = useState(null);

  // Data fetching
  function loadData() {
    setLoading(true);
    api.get("/superadmin/boutiques")
      .then((res) => setBoutiques(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));

    api.get("/superadmin/stats")
      .then((res) => setStats(res.data))
      .catch(() => {});

    api.get("/superadmin/users")
      .then((res) => setUsers(res.data || []))
      .catch(() => {});
  }

  useEffect(loadData, []);

  // Helper notification handler
  function showSuccess(msg) {
    setSucces(msg);
    setTimeout(() => setSucces(""), 3500);
  }
  function showError(msg) {
    setErreur(msg);
    setTimeout(() => setErreur(""), 4500);
  }

  // ── BOUTIQUE ACTIONS ──
  async function handleToggleBoutiqueStatus(b) {
    try {
      const nextStatus = b.statut === "active" ? "suspendue" : "active";
      await api.patch(`/superadmin/boutiques/${b.id}/statut`, { statut: nextStatus });
      showSuccess(`Boutique « ${b.nom} » ${nextStatus === "active" ? "activée" : "suspendue"}.`);
      loadData();
    } catch (err) {
      showError(err.response?.data?.message || "Erreur lors du changement de statut.");
    }
  }

  async function submitCreateBoutique() {
    if (!createForm?.nomBoutique || !createForm?.slug) {
      showError("Veuillez remplir le nom de la boutique et son slug.");
      return;
    }
    if (!createForm?.existingAdminId && (!createForm?.nomAdmin || (!createForm?.emailAdmin && !createForm?.telephoneAdmin))) {
      showError("Veuillez renseigner un nouvel administrateur ou sélectionner un administrateur existant.");
      return;
    }
    try {
      const res = await api.post("/superadmin/boutiques", createForm);
      showSuccess(res.data?.attachedExistingAdmin
        ? "Nouvelle boutique créée et rattachée à l'administrateur existant (accès Multi-Boutiques activé) !"
        : "Nouvelle boutique et son compte admin créés avec succès !");
      loadData();
      return res.data;
    } catch (err) {
      showError(err.response?.data?.message || "Impossible de créer la boutique.");
    }
  }

  async function submitEditBoutique() {
    if (!editForm) return;
    try {
      await api.put(`/superadmin/boutiques/${editForm.id}`, {
        nom: editForm.nom,
        slug: editForm.slug,
        customDomain: editForm.customDomain,
        formuleAbonnement: editForm.formuleAbonnement,
        devise: editForm.devise,
        devisesDisponibles: editForm.devisesDisponibles,
        motDePasseAdmin: editForm.motDePasseAdmin
      });
      setEditForm(null);
      showSuccess("Boutique et devises mises à jour avec succès !");
      loadData();
    } catch (err) {
      showError(err.response?.data?.message || "Impossible de modifier la boutique.");
    }
  }

  async function confirmDeleteBoutique() {
    if (!deleteBoutiqueId) return;
    try {
      await api.delete(`/superadmin/boutiques/${deleteBoutiqueId}`);
      setDeleteBoutiqueId(null);
      showSuccess("Boutique et ses administrateurs supprimés avec succès.");
      loadData();
    } catch (err) {
      showError(err.response?.data?.message || "Impossible de supprimer la boutique.");
    }
  }

  // ── MODULE ACTIONS ──
  async function handleGlobalModuleToggle(moduleKey, activeState) {
    try {
      await api.put("/superadmin/modules/global", { moduleKey, active: activeState });
      showSuccess(`Le module "${moduleKey}" a été ${activeState ? "activé" : "désactivé"} pour TOUTES les boutiques.`);
      loadData();
    } catch (err) {
      showError(err.response?.data?.message || "Erreur lors de la mise à jour globale des modules.");
    }
  }

  async function handleBoutiqueModulesUpdate(boutiqueId, newModulesMap) {
    try {
      await api.put(`/superadmin/boutiques/${boutiqueId}/modules`, { modulesActifs: newModulesMap });
      showSuccess("Modules de la boutique mis à jour avec succès.");
      loadData();
    } catch (err) {
      showError(err.response?.data?.message || "Erreur lors de la mise à jour des modules.");
    }
  }

  // ── USER ACTIONS ──
  async function submitEditUser() {
    if (!editUserForm) return;
    try {
      await api.put(`/superadmin/users/${editUserForm.id}`, editUserForm);
      setEditUserForm(null);
      showSuccess(`Utilisateur « ${editUserForm.nom} » mis à jour avec succès.`);
      loadData();
    } catch (err) {
      showError(err.response?.data?.message || "Erreur lors de la modification de l'utilisateur.");
    }
  }

  async function handleToggleUserStatus(targetUser) {
    try {
      const nextStatut = targetUser.statut === "actif" ? "suspendu" : "actif";
      await api.patch(`/superadmin/users/${targetUser.id}/statut`, { statut: nextStatut });
      showSuccess(`Compte de « ${targetUser.nom} » ${nextStatut === "actif" ? "réactivé" : "suspendu"}.`);
      loadData();
    } catch (err) {
      showError(err.response?.data?.message || "Erreur lors de la modification du statut utilisateur.");
    }
  }

  async function confirmDeleteUser() {
    if (!deleteUserObj) return;
    try {
      await api.delete(`/superadmin/users/${deleteUserObj.id}`);
      setDeleteUserObj(null);
      showSuccess(`Utilisateur « ${deleteUserObj.nom} » supprimé définitivement.`);
      loadData();
    } catch (err) {
      showError(err.response?.data?.message || "Impossible de supprimer cet utilisateur.");
    }
  }

  async function submitCreateUser() {
    if (!createUserForm?.nom || !createUserForm?.email || !createUserForm?.motDePasse) {
      showError("Veuillez remplir tous les champs obligatoires (nom, email, mot de passe).");
      return;
    }
    try {
      const res = await api.post("/superadmin/users", createUserForm);
      showSuccess(`Nouvel utilisateur (${createUserForm.role}) créé avec succès !`);
      loadData();
      return res.data;
    } catch (err) {
      showError(err.response?.data?.message || "Impossible de créer l'utilisateur.");
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh", background: "var(--paper)" }}>
      {/* ── SIDEBAR ── */}
      <SuperAdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        boutiquesCount={boutiques.length}
        usersCount={users.length}
        user={user}
        logout={logout}
        onNewBoutique={() => setCreateForm({ nomBoutique: "", slug: "", formuleAbonnement: "standard", nomAdmin: "", emailAdmin: "", motDePasseAdmin: "" })}
      />

      {/* ── MAIN CONTENT AREA ── */}
      <main style={{ padding: "32px 40px", overflowY: "auto" }}>
        {/* HEADER */}
        <SuperAdminHeader
          onRefresh={loadData}
          loading={loading}
          onNewBoutique={() => setCreateForm({ nomBoutique: "", slug: "", formuleAbonnement: "standard", nomAdmin: "", emailAdmin: "", motDePasseAdmin: "" })}
          onNewUser={() => setCreateUserForm({ nom: "", email: "", telephone: "", role: "super_admin", boutiqueId: "", motDePasse: "" })}
        />

        {/* ALERTS */}
        {erreur && (
          <div style={{
            background: "#FDF2F0", border: "1px solid #F8D7D2", color: "#B4483A",
            padding: "12px 18px", borderRadius: 12, marginBottom: 24,
            display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600
          }}>
            <XCircle size={18} />
            <span>{erreur}</span>
          </div>
        )}

        {succes && (
          <div style={{
            background: "#EBF7F0", border: "1px solid #C4E5D3", color: "#1F4D3A",
            padding: "12px 18px", borderRadius: 12, marginBottom: 24,
            display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600
          }}>
            <CheckCircle2 size={18} />
            <span>{succes}</span>
          </div>
        )}

        {/* KPIS OVERVIEW BAR */}
        <SuperAdminKpis stats={stats} boutiques={boutiques} users={users} />

        {/* TAB CONTENTS */}
        {activeTab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <BoutiquesTab
              boutiques={boutiques}
              search={search}
              setSearch={setSearch}
              onNewBoutique={() => setCreateForm({ nomBoutique: "", slug: "", formuleAbonnement: "standard", nomAdmin: "", emailAdmin: "", motDePasseAdmin: "" })}
              onEdit={setEditForm}
              onModules={(b) => {
                setActiveTab("global_modules");
              }}
              onToggleStatus={handleToggleBoutiqueStatus}
              onDelete={setDeleteBoutiqueId}
            />
            
            <UsersTab
              users={users}
              boutiques={boutiques}
              onEditUser={setEditUserForm}
              onToggleUserStatus={handleToggleUserStatus}
              onDeleteUser={setDeleteUserObj}
            />
          </div>
        )}

        {activeTab === "boutiques" && (
          <BoutiquesTab
            boutiques={boutiques}
            search={search}
            setSearch={setSearch}
            onNewBoutique={() => setCreateForm({ nomBoutique: "", slug: "", formuleAbonnement: "standard", nomAdmin: "", emailAdmin: "", motDePasseAdmin: "" })}
            onEdit={setEditForm}
            onModules={(b) => {
              setActiveTab("global_modules");
            }}
            onToggleStatus={handleToggleBoutiqueStatus}
            onDelete={setDeleteBoutiqueId}
          />
        )}

        {activeTab === "users" && (
          <UsersTab
            users={users}
            boutiques={boutiques}
            onEditUser={setEditUserForm}
            onToggleUserStatus={handleToggleUserStatus}
            onDeleteUser={setDeleteUserObj}
          />
        )}

        {activeTab === "global_modules" && (
          <ModulesTab
            boutiques={boutiques}
            onGlobalToggle={handleGlobalModuleToggle}
            onBoutiqueModulesUpdate={handleBoutiqueModulesUpdate}
          />
        )}
      </main>

      {/* ── MODALS ── */}
      {createForm && (
        <CreateBoutiqueModal
          form={createForm}
          setForm={setCreateForm}
          existingAdmins={(users || []).filter(u => u && u.role === "admin")}
          onSubmit={submitCreateBoutique}
          onClose={() => setCreateForm(null)}
        />
      )}

      {createUserForm && (
        <CreateUserModal
          form={createUserForm}
          setForm={setCreateUserForm}
          boutiques={boutiques}
          onSubmit={submitCreateUser}
          onClose={() => setCreateUserForm(null)}
        />
      )}

      {editForm && (
        <EditBoutiqueModal
          form={editForm}
          setForm={setEditForm}
          onSubmit={submitEditBoutique}
          onClose={() => setEditForm(null)}
        />
      )}

      {editUserForm && (
        <EditUserModal
          form={editUserForm}
          setForm={setEditUserForm}
          boutiques={boutiques}
          onSubmit={submitEditUser}
          onClose={() => setEditUserForm(null)}
        />
      )}

      {deleteBoutiqueId && (
        <ConfirmModal
          title="Supprimer la boutique ?"
          message="Attention : Cette action est irréversible. Toutes les données associées (utilisateurs, commandes, produits) seront définitivement supprimées."
          onConfirm={confirmDeleteBoutique}
          onClose={() => setDeleteBoutiqueId(null)}
          confirmText="Supprimer la boutique"
        />
      )}

      {deleteUserObj && (
        <ConfirmModal
          title={`Supprimer l'utilisateur "${deleteUserObj.nom}" ?`}
          message="Êtes-vous sûr de vouloir supprimer définitivement cet utilisateur ? Il ne pourra plus accéder à son compte."
          onConfirm={confirmDeleteUser}
          onClose={() => setDeleteUserObj(null)}
          confirmText="Supprimer l'utilisateur"
        />
      )}
    </div>
  );
}
