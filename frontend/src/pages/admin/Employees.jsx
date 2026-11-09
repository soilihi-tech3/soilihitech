import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { 
  PlusCircle, Edit, Trash2, Shield, Lock, CheckCircle, Ban, User, AlertCircle, X, 
  ShieldCheck, UserCheck, Key, Settings, Layers, Package, ShoppingCart, Image, Eye, 
  EyeOff, Copy, RefreshCw, Send, CreditCard, History, ShoppingBag, ClipboardList, Award, Smartphone, Truck, Scale, MessageCircle, FileText, Store
} from "lucide-react";
import api from "../../api";
import TablePagination from "../../components/TablePagination";
import { useAuth } from "../../context/AuthContext.jsx";
import { SkeletonTableRows } from "../../components/Skeleton.jsx";
import { getBoutiqueCurrencies } from "../../utils/currency.js";

const PERMISSIONS_LIST = [
  { key: "voir_dashboard", label: "Tableau de bord Opérationnel", desc: "Aperçu des performances personnelles et activités", icon: Settings },
  { key: "vente_directe", label: "Caisse & Vente Directe (POS)", desc: "Encaisser les ventes directes au comptoir et tickets", icon: CreditCard },
  { key: "historique_ventes", label: "Historique des Ventes", desc: "Consulter l'historique des encaissements et reçus", icon: History },
  { key: "modifier_vente", label: "Modifier les Ventes Directes", desc: "Modifier les ventes enregistrées, paniers et paiements", icon: Edit },
  { key: "supprimer_vente", label: "Supprimer les Ventes Directes", desc: "Supprimer ou annuler définitivement des ventes de la caisse", icon: Trash2 },
  { key: "gerer_commandes", label: "Commandes en ligne", desc: "Traitement, affectation et suivi des livraisons", icon: ShoppingCart },
  { key: "voir_demandes", label: "Consulter Demandes & Devis", desc: "Voir les demandes de devis et commandes sur-mesure", icon: ClipboardList },
  { key: "creer_demande", label: "Ajouter & Créer un Devis", desc: "Créer et enregistrer de nouvelles demandes et devis sur-mesure", icon: PlusCircle },
  { key: "gerer_demandes", label: "Chiffrer & Modifier Devis", desc: "Modifier et chiffrer les propositions de devis et commandes spéciales", icon: ClipboardList },
  { key: "supprimer_demandes", label: "Supprimer Demandes & Devis", desc: "Supprimer définitivement des demandes de devis", icon: Trash2 },
  { key: "voir_depenses", label: "Consulter les Dépenses", desc: "Voir la liste des dépenses et les totaux", icon: FileText },
  { key: "creer_depense", label: "Ajouter des Dépenses", desc: "Créer et enregistrer de nouvelles dépenses", icon: PlusCircle },
  { key: "modifier_depense", label: "Modifier les Dépenses", desc: "Éditer et mettre à jour les dépenses existantes", icon: Edit },
  { key: "supprimer_depense", label: "Supprimer les Dépenses", desc: "Supprimer définitivement des dépenses enregistrées", icon: Trash2 },
  { key: "voir_produits", label: "Consulter le Catalogue Produits", desc: "Voir la liste des articles et stocks disponibles", icon: Package },
  { key: "ajouter_modifier_produit", label: "Ajouter & Modifier des Produits", desc: "Créer ou éditer les fiches articles, prix et variantes", icon: Package },
  { key: "approvisionner_produit", label: "Approvisionnement du Stock", desc: "Enregistrer des réapprovisionnements et entrées de marchandises", icon: ShoppingBag },
  { key: "cacher_produit", label: "Masquer / Cacher un Produit", desc: "Activer ou masquer des produits de la vitrine en ligne", icon: EyeOff },
  { key: "supprimer_produit", label: "Supprimer des Produits", desc: "Supprimer définitivement des articles du catalogue", icon: Trash2 },
  { key: "voir_marques", label: "Consulter les Marques", desc: "Voir la liste des marques de produits", icon: Award },
  { key: "gerer_marques", label: "Gérer Marques (Ajout/Modif/Suppr)", desc: "Créer, modifier et supprimer les marques", icon: Award },
  { key: "voir_telephones", label: "Consulter Modèles Téléphones", desc: "Voir les marques et modèles de téléphones", icon: Smartphone },
  { key: "gerer_telephones", label: "Gérer Modèles (Ajout/Modif/Suppr)", desc: "Créer, modifier et supprimer les modèles et compatibilités", icon: Smartphone },
  { key: "gerer_categories", label: "Catégories & Familles", desc: "Organisation des rayons et catégories de produits", icon: Layers },
  { key: "achats_stocks", label: "Achats & Stocks", desc: "Enregistrer des réapprovisionnements et gérer les stocks", icon: ShoppingBag },
  { key: "gerer_fournisseurs", label: "Fournisseurs", desc: "Ajouter, modifier ou supprimer des fournisseurs", icon: Truck },
  { key: "gerer_unites", label: "Unités de vente", desc: "Gérer les unités de vente (pièce, mètre, etc.)", icon: Scale },
  { key: "gerer_avis", label: "Avis Clients WhatsApp", desc: "Consulter et publier les témoignages clients", icon: MessageCircle },
  { key: "voir_clients", label: "Consulter les Clients", desc: "Voir la liste des clients et coordonnées", icon: UserCheck },
  { key: "gerer_banners", label: "Bannières & Promotions", desc: "Gestion des carousels visuels et promotions", icon: Image },
  { key: "gerer_parametres", label: "Paramètres Boutique", desc: "Coordonnées, adresses et réglages généraux", icon: Settings },
];

export default function AdminEmployees() {
  const { user: currentUser, boutique, myBoutiques = [], activeBoutiqueId } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState(null); // 'create' | 'edit' | 'permissions' | 'credentials' | null
  const [selectedUser, setSelectedUser] = useState(null);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [showAllBoutiques, setShowAllBoutiques] = useState(true);

  const [form, setForm] = useState({ 
    nom: "", email: "", telephone: "", motDePasse: "", role: "employe", boutiqueId: "", permissions: ["voir_dashboard", "vente_directe", "historique_ventes", "voir_produits"] 
  });
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const targetBoutiqueObj = myBoutiques.find(b => Number(b.id) === Number(form.boutiqueId)) || boutique;
  const boutiqueCurrencies = getBoutiqueCurrencies(targetBoutiqueObj);

  function load() { 
    setLoading(true);
    const query = (myBoutiques.length > 1 && showAllBoutiques) ? "?allMyBoutiques=true" : "";
    api.get(`/admin/employees${query}`)
      .then((res) => setUsers(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false)); 
  }
  
  useEffect(() => {
    load();
  }, [activeBoutiqueId, showAllBoutiques, myBoutiques.length]);

  useEffect(() => {
    const onSwitched = () => load();
    window.addEventListener("boutique_switched", onSwitched);
    return () => window.removeEventListener("boutique_switched", onSwitched);
  }, [showAllBoutiques, myBoutiques.length]);

  function generateRandomPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm((f) => ({ ...f, motDePasse: pwd }));
    setShowPassword(true);
  }

  function openCreateModal() {
    const randomPwd = Math.random().toString(36).slice(-8) + "A1!";
    setForm({ 
      nom: "", 
      email: "", 
      telephone: "", 
      motDePasse: randomPwd, 
      role: "employe", 
      boutiqueId: activeBoutiqueId || boutique?.id || "",
      permissions: ["voir_dashboard", "vente_directe", "historique_ventes", "voir_produits", "creer_demande"],
      deviseAutorisee: "TOUTES"
    });
    setShowPassword(true);
    setErreur("");
    setSucces("");
    setModalType("create");
  }

  function openEditModal(u) {
    setSelectedUser(u);
    setForm({
      nom: u.nom || "",
      email: u.email || "",
      telephone: u.telephone || "",
      motDePasse: "",
      role: u.role || "employe",
      boutiqueId: u.boutiqueId || activeBoutiqueId || boutique?.id || "",
      permissions: Array.isArray(u.permissions) ? u.permissions : [],
      deviseAutorisee: u.deviseAutorisee || "TOUTES"
    });
    setShowPassword(false);
    setErreur("");
    setSucces("");
    setModalType("edit");
  }

  function openPermissionsModal(u) {
    setSelectedUser(u);
    setForm({
      ...u,
      role: u.role || "employe",
      permissions: Array.isArray(u.permissions) ? u.permissions : [],
      deviseAutorisee: u.deviseAutorisee || "TOUTES"
    });
    setErreur("");
    setSucces("");
    setModalType("permissions");
  }

  async function handleCreate(e) {
    e.preventDefault();
    setErreur("");
    setSucces("");
    try {
      const res = await api.post("/admin/employees", form);
      const createdData = res.data;
      
      setCreatedCredentials({
        nom: createdData.nom,
        identifiant: createdData.email || createdData.telephone,
        email: createdData.email,
        telephone: createdData.telephone,
        motDePasse: createdData.generatedPassword || form.motDePasse,
        role: createdData.role === "admin" ? "Administrateur" : "Employé"
      });

      setModalType("credentials");
      load();
    } catch (err) {
      setErreur(err.response?.data?.message || "Impossible de créer l'utilisateur.");
    }
  }

  async function handleUpdate(e) {
    e?.preventDefault?.();
    setErreur("");
    setSucces("");
    try {
      await api.put(`/admin/employees/${selectedUser.id}`, form);
      setSucces("Utilisateur mis à jour avec succès !");
      setTimeout(() => { setModalType(null); load(); }, 900);
    } catch (err) {
      setErreur(err.response?.data?.message || "Impossible de mettre à jour l'utilisateur.");
    }
  }

  async function toggleStatus(u) {
    if (currentUser && currentUser.id === u.id) {
      toast.error("Vous ne pouvez pas suspendre votre propre compte administrateur actuellement connecté.");
      return;
    }

    const actionText = u.statut === "actif" ? "suspendre / désactiver" : "réactiver";
    const confirmMessage = `Voulez-vous vraiment ${actionText} le compte de "${u.nom}" (${u.email}) ?`;
    
    if (!window.confirm(confirmMessage)) return;

    try {
      await api.patch(`/admin/employees/${u.id}/status`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la modification du statut.");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) return;
    try {
      await api.delete(`/admin/employees/${id}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Impossible de supprimer cet utilisateur.");
    }
  }

  function togglePermissionKey(key) {
    setForm((prev) => {
      const currentPerms = prev.permissions || [];
      if (currentPerms.includes(key)) {
        return { ...prev, permissions: currentPerms.filter(k => k !== key) };
      } else {
        return { ...prev, permissions: [...currentPerms, key] };
      }
    });
  }

  function copyCredentialsToClipboard() {
    if (!createdCredentials) return;
    const textToCopy = `Compte ${createdCredentials.role} créé avec succès !\nNom: ${createdCredentials.nom}\nIdentifiant: ${createdCredentials.identifiant}\nMot de passe temporaire: ${createdCredentials.motDePasse}\n\nNote: Le mot de passe devra être changé lors de la première connexion.`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <>
      {/* ── HEADER TOOLBAR ── */}
      <div className="bs-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Gestion des Utilisateurs & Droits d'Accès</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Gérez votre équipe, attribuez le rôle (Admin ou Employé), réactivez les employés bloqués (5 essais MDP) et configurez les droits d'accès.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {myBoutiques.length > 1 && (
            <button
              type="button"
              onClick={() => setShowAllBoutiques(prev => !prev)}
              style={{
                padding: "9px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                border: showAllBoutiques ? "1.5px solid #2563EB" : "1px solid var(--line)",
                background: showAllBoutiques ? "#EFF6FF" : "#fff",
                color: showAllBoutiques ? "#1D4ED8" : "var(--ink)",
                display: "flex", alignItems: "center", gap: 6
              }}
            >
              <Store size={15} />
              {showAllBoutiques ? `Toutes mes boutiques (${myBoutiques.length})` : `Boutique active (${boutique?.nom})`}
            </button>
          )}
          <button 
            className="bs-btn-primary" 
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12 }} 
            onClick={openCreateModal}
          >
            <PlusCircle size={18} /> Ajouter un utilisateur
          </button>
        </div>
      </div>

      {/* ── TABLE UTILISATEURS ── */}
      <div className="bs-panel" style={{ padding: 0 }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
          <table className="bs-table" style={{ width: "100%", minWidth: 700, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Utilisateur</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Contact</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Rôle, Boutique & Accès</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Statut</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTableRows rows={5} cols={5} />
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 36, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
                  Aucun utilisateur enregistré pour le moment.
                </td>
              </tr>
            ) : (
              users.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((u) => {
                const isActif = u.statut === "actif";
                const isAdmin = u.role === "admin";
                const isLockedMdp = !isActif && (u.lockReason === "5_tentatives_mdp" || Number(u.failedLoginAttempts) >= 5);
                const perms = Array.isArray(u.permissions) ? u.permissions : [];
                const uBoutiqueNom = u.Boutique?.nom || myBoutiques.find(b => Number(b.id) === Number(u.boutiqueId))?.nom || boutique?.nom;

                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--line)", background: !isActif ? "#FFF9F9" : "transparent" }}>
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: "50%", 
                          background: isAdmin ? "var(--forest)" : isActif ? "var(--forest-light)" : "#FDF2F0",
                          color: isAdmin ? "#fff" : isActif ? "var(--forest)" : "#B4483A", 
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 800, fontSize: 14
                        }}>
                          {u.nom?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{u.nom}</div>
                          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>ID #{u.id}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{u.email || "—"}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{u.telephone || "Sans téléphone"}</div>
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-start" }}>
                        {uBoutiqueNom && (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1",
                            padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700
                          }}>
                            <Store size={12} color="var(--forest)" /> {uBoutiqueNom}
                          </span>
                        )}
                        {isAdmin ? (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            background: "var(--forest-light)", border: "1px solid var(--forest-light)",
                            borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 800, color: "var(--forest-dark)"
                          }}>
                            <ShieldCheck size={14} color="var(--forest)" /> Admin (Accès Total)
                          </span>
                        ) : (
                          <div>
                            <button
                              onClick={() => openPermissionsModal(u)}
                              style={{
                                background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 20,
                                padding: "5px 12px", fontSize: 12, fontWeight: 700, color: "var(--forest-dark)",
                                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6
                              }}
                            >
                              <Shield size={14} color="var(--forest)" />
                              {perms.length} accès attribué{perms.length > 1 ? "s" : ""}
                            </button>
                            <div style={{ marginTop: 5 }}>
                              <span style={{
                                fontSize: 10.5, fontWeight: 800, padding: "2px 7px", borderRadius: 6,
                                background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE"
                              }}>
                                {(!u.deviseAutorisee || u.deviseAutorisee === "TOUTES") ? "Devises : Toutes autorisées" : `Devise : ${u.deviseAutorisee}`}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        <span
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            padding: "4px 10px", borderRadius: 12, fontSize: 11.5, fontWeight: 700,
                            background: isActif ? "#EBF7F0" : "#FDF2F0",
                            color: isActif ? "#1F4D3A" : "#B4483A"
                          }}
                        >
                          {isActif ? <CheckCircle size={13} /> : <Ban size={13} />}
                          {isActif ? "Actif" : "Suspendu"}
                        </span>
                        {isLockedMdp && (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "3px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 800,
                            background: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5"
                          }}>
                            <Lock size={11} /> Bloqué (5 essais MDP)
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: "14px 18px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                        {!isActif && !isAdmin && (
                          <button
                            onClick={() => toggleStatus(u)}
                            style={{
                              background: "#16A34A", color: "#fff", border: "none",
                              borderRadius: 8, padding: "5px 10px", fontSize: 11.5, fontWeight: 800,
                              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4
                            }}
                            title="Réactiver le compte de cet employé"
                          >
                            <CheckCircle size={13} /> Réactiver
                          </button>
                        )}
                        {!isActif && isAdmin && (
                          <span
                            title="Seul le Super Administrateur peut réactiver un compte Administrateur désactivé"
                            style={{
                              fontSize: 10.5, fontWeight: 800, padding: "4px 8px", borderRadius: 8,
                              background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A"
                            }}
                          >
                            🔒 Réactivation par Super Admin
                          </span>
                        )}
                        {!isAdmin && (
                          <button
                            onClick={() => openPermissionsModal(u)}
                            className="bs-icon-btn"
                            title="Gérer les droits d'accès"
                            style={{ color: "var(--forest)" }}
                          >
                            <Shield size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(u)}
                          className="bs-icon-btn"
                          title="Modifier l'utilisateur"
                        >
                          <Edit size={16} />
                        </button>
                        {isActif && (
                          <button
                            onClick={() => toggleStatus(u)}
                            className="bs-icon-btn"
                            title="Suspendre l'accès"
                            style={{ color: "#D97706" }}
                          >
                            <Ban size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="bs-icon-btn"
                          title="Supprimer"
                          style={{ color: "#B4483A" }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
        <TablePagination
          totalItems={users.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(1); }}
        />
      </div>

      {/* ── STANDALONE PAGE MODAL: AJOUTER / MODIFIER UN UTILISATEUR ── */}
      {(modalType === "create" || modalType === "edit") && (
        <div 
          onClick={() => setModalType(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(22,52,36,0.5)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 20, padding: 32,
              maxWidth: 640, width: "90%", maxHeight: "90vh", overflowY: "auto",
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)"
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid var(--line)", paddingBottom: 14 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: "var(--forest-dark)" }}>
                  {modalType === "create" ? "Ajouter un nouvel Utilisateur" : `Modifier l'utilisateur : ${selectedUser?.nom}`}
                </h2>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                  Renseignez les coordonnées et définissez le rôle et les autorisations.
                </div>
              </div>
              <button onClick={() => setModalType(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {erreur && (
              <div style={{ background: "#FDF2F0", color: "#B4483A", padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={16} /> {erreur}
              </div>
            )}
            {succes && (
              <div style={{ background: "#EBF7F0", color: "#1F4D3A", padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={16} /> {succes}
              </div>
            )}

            <form onSubmit={modalType === "create" ? handleCreate : handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Informational Inputs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="bs-field">
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Nom complet *</label>
                  <input className="bs-input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex: Ousmane Sow" required />
                </div>

                <div className="bs-field">
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Adresse Email</label>
                  <input className="bs-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ex: ousmane@marche-vert.com" />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="bs-field">
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Téléphone</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    className="bs-input"
                    value={form.telephone}
                    onChange={(e) => setForm({ ...form, telephone: e.target.value.replace(/[^0-9+ ]/g, "") })}
                    onKeyDown={(e) => {
                      if (!/[0-9+ ]/.test(e.key) && !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                      }
                    }}
                    placeholder="ex: +221 77 123 45 67"
                  />
                </div>

                <div className="bs-field" style={{ position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>
                      {modalType === "create" ? "Mot de passe généré *" : "Mot de passe (facultatif)"}
                    </label>
                    {modalType === "create" && (
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        style={{ background: "none", border: "none", color: "var(--forest)", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <RefreshCw size={12} /> Régénérer
                      </button>
                    )}
                  </div>
                  <div style={{ position: "relative" }}>
                    <input 
                      className="bs-input" 
                      type={showPassword ? "text" : "password"} 
                      style={{ paddingRight: 40 }}
                      placeholder={modalType === "create" ? "Mot de passe" : "Laisser vide si inchangé"} 
                      value={form.motDePasse} 
                      onChange={(e) => setForm({ ...form, motDePasse: e.target.value })} 
                      required={modalType === "create"} 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer", color: "var(--muted)"
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* BOUTIQUE D'AFFECTATION (SI L'ADMIN GÈRE PLUSIEURS BOUTIQUES) */}
              {myBoutiques.length > 1 && (
                <div style={{ background: "#EFF6FF", padding: 14, borderRadius: 12, border: "1.5px solid #BFDBFE" }}>
                  <label style={{ fontSize: 12.5, fontWeight: 800, color: "#1E40AF", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Store size={15} /> Boutique d'affectation de cet utilisateur *
                  </label>
                  <select
                    className="bs-input"
                    value={form.boutiqueId || activeBoutiqueId || boutique?.id || ""}
                    onChange={(e) => setForm({ ...form, boutiqueId: Number(e.target.value) })}
                    style={{ background: "#fff", fontWeight: 700 }}
                  >
                    {myBoutiques.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nom} ({(b.devisesDisponibles || [b.devise || "KMF"]).join(" / ")})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* RÔLE SELECTION CARDS */}
              <div style={{ marginTop: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 800, color: "var(--forest-dark)", display: "block", marginBottom: 8 }}>
                  Sélectionnez le Rôle de l'utilisateur :
                </label>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {/* Option 1: Admin */}
                  <div
                    onClick={() => setForm({ ...form, role: "admin" })}
                    style={{
                      border: form.role === "admin" ? "2px solid var(--forest)" : "1px solid var(--line)",
                      background: form.role === "admin" ? "var(--forest-light)" : "var(--paper)",
                      borderRadius: 12, padding: 14, cursor: "pointer", transition: "all 0.15s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <ShieldCheck size={18} color="var(--forest)" />
                      <span style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)" }}>Administrateur</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      Accès complet et illimité à tous les menus, statistiques, paramètres et gestion des utilisateurs.
                    </div>
                  </div>

                  {/* Option 2: Employé */}
                  <div
                    onClick={() => setForm({ ...form, role: "employe" })}
                    style={{
                      border: form.role === "employe" ? "2px solid var(--forest)" : "1px solid var(--line)",
                      background: form.role === "employe" ? "var(--forest-light)" : "var(--paper)",
                      borderRadius: 12, padding: 14, cursor: "pointer", transition: "all 0.15s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <UserCheck size={18} color="var(--forest)" />
                      <span style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)" }}>Employé</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      Accès restreint. Vous choisissez exactement les menus auxquels l'employé aura accès.
                    </div>
                  </div>
                </div>
              </div>

              {/* DEVISE ATTRIBUÉE (PAYS / CAISSE) POUR EMPLOYÉ (UNIQUEMENT SI LA BOUTIQUE A PLUS D'UNE DEVISE) */}
              {form.role === "employe" && boutiqueCurrencies.length > 1 && (
                <div style={{ marginTop: 8, background: "#F8FAFC", padding: 14, borderRadius: 14, border: "1.5px solid #E2E8F0" }}>
                  <label style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", display: "block", marginBottom: 4 }}>
                    Devise & Caisse autorisées à cet employé :
                  </label>
                  <p style={{ margin: "0 0 10px 0", fontSize: 11.5, color: "#64748B" }}>
                    Choisissez si cet employé est assigné à une devise spécifique ou à toutes les devises de la boutique.
                  </p>
                  
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${boutiqueCurrencies.length + 1}, 1fr)`, gap: 10 }}>
                    <div
                      type="button"
                      onClick={() => setForm({ ...form, deviseAutorisee: "TOUTES" })}
                      style={{
                        border: (!form.deviseAutorisee || form.deviseAutorisee === "TOUTES") ? "2px solid #2563EB" : "1px solid #CBD5E1",
                        background: (!form.deviseAutorisee || form.deviseAutorisee === "TOUTES") ? "#EFF6FF" : "#FFFFFF",
                        borderRadius: 10, padding: 10, cursor: "pointer", textAlign: "center", transition: "all 0.15s"
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 12.5, color: (!form.deviseAutorisee || form.deviseAutorisee === "TOUTES") ? "#1D4ED8" : "#334155" }}>
                        {boutiqueCurrencies.map(c => c.code).join(" & ")}
                      </div>
                      <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 2 }}>
                        Toutes les devises
                      </div>
                    </div>

                    {boutiqueCurrencies.map((c) => (
                      <div
                        key={c.code}
                        type="button"
                        onClick={() => setForm({ ...form, deviseAutorisee: c.code })}
                        style={{
                          border: form.deviseAutorisee === c.code ? "2px solid #16A34A" : "1px solid #CBD5E1",
                          background: form.deviseAutorisee === c.code ? "#DCFCE7" : "#FFFFFF",
                          borderRadius: 10, padding: 10, cursor: "pointer", textAlign: "center", transition: "all 0.15s"
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 12.5, color: form.deviseAutorisee === c.code ? "#15803D" : "#334155" }}>
                          {c.flag} {c.code} seul
                        </div>
                        <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 2 }}>
                          {c.country}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* GRANULAR PERMISSIONS MATRIX IF ROLE IS EMPLOYE */}
              {form.role === "employe" ? (
                <div style={{ marginTop: 10, background: "var(--paper)", padding: 16, borderRadius: 14, border: "1px solid var(--line)" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--forest-dark)", marginBottom: 10 }}>
                    Attribuer les accès granulaires pour cet employé :
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {PERMISSIONS_LIST.map((item) => {
                      const checked = (form.permissions || []).includes(item.key);

                      return (
                        <label
                          key={item.key}
                          onClick={() => togglePermissionKey(item.key)}
                          style={{
                            display: "flex", alignItems: "flex-start", gap: 10,
                            padding: 10, borderRadius: 10, border: "1px solid var(--line)",
                            background: checked ? "#fff" : "transparent",
                            cursor: "pointer"
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {}}
                            style={{ width: 16, height: 16, marginTop: 2, accentColor: "var(--forest)" }}
                          />
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: checked ? 700 : 600, color: checked ? "var(--forest-dark)" : "var(--ink)" }}>
                              {item.label}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>{item.desc}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ background: "var(--forest-light)", borderRadius: 12, padding: 12, color: "var(--forest-dark)", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldCheck size={18} color="var(--forest)" />
                  En tant qu'Admin, cet utilisateur bénéficiera automatiquement de la totalité des accès.
                </div>
              )}

              {/* Form Buttons */}
              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button 
                  type="button" 
                  onClick={() => setModalType(null)} 
                  style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid var(--line)", background: "#fff", fontWeight: 600, cursor: "pointer" }}
                >
                  Annuler
                </button>
                <button type="submit" className="bs-btn-primary" style={{ flex: 1, borderRadius: 12 }}>
                  {modalType === "create" ? "Créer l'utilisateur & envoyer identifiants" : "Enregistrer les modifications"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIRMATION IDENTIFIANTS APRÈS CRÉATION ── */}
      {modalType === "credentials" && createdCredentials && (
        <div 
          onClick={() => setModalType(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(22,52,36,0.5)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 20, padding: 32,
              maxWidth: 520, width: "90%",
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
              textAlign: "center"
            }}
          >
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#EBF7F0", color: "#1F4D3A", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <CheckCircle size={32} />
            </div>

            <h2 style={{ margin: "0 0 8px", fontSize: 20, color: "var(--forest-dark)" }}>Compte créé avec succès !</h2>
            <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 20px" }}>
              Un e-mail d'accueil avec ces identifiants a été envoyé {createdCredentials.email ? `à ${createdCredentials.email}` : "à l'utilisateur"}.
            </p>

            <div style={{ background: "var(--paper)", padding: 20, borderRadius: 14, border: "1px solid var(--line)", textAlign: "left", marginBottom: 20 }}>
              <div style={{ fontSize: 13, marginBottom: 8, color: "var(--ink)" }}>
                <strong>Nom complet :</strong> {createdCredentials.nom}
              </div>
              <div style={{ fontSize: 13, marginBottom: 8, color: "var(--ink)" }}>
                <strong>Identifiant :</strong> <span style={{ fontFamily: "monospace", color: "var(--forest-dark)", fontWeight: 700 }}>{createdCredentials.identifiant}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--ink)" }}>
                <strong>Mot de passe générique :</strong> <span style={{ fontFamily: "monospace", color: "#163424", fontWeight: 800, background: "#E2E8F0", padding: "2px 8px", borderRadius: 6 }}>{createdCredentials.motDePasse}</span>
              </div>
            </div>

            <div style={{ fontSize: 12.5, color: "#D97706", background: "#FEF3C7", padding: "10px 14px", borderRadius: 10, marginBottom: 20, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, textAlign: "left" }}>
              <Key size={16} /> À la 1ère connexion, cet utilisateur devra obligatoirement modifier son mot de passe.
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={copyCredentialsToClipboard}
                style={{
                  flex: 1, padding: "12px", borderRadius: 12, border: "1px solid var(--forest)",
                  background: copied ? "var(--forest)" : "#fff", color: copied ? "#fff" : "var(--forest)",
                  fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8
                }}
              >
                {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                {copied ? "Copié !" : "Copier les identifiants"}
              </button>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="bs-btn-primary"
                style={{ flex: 1, borderRadius: 12 }}
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ACCÈS ET PERMISSIONS SEULES ── */}
      {modalType === "permissions" && (
        <div 
          onClick={() => setModalType(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(22,52,36,0.5)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 20, padding: 32,
              maxWidth: 540, width: "90%", maxHeight: "90vh", overflowY: "auto",
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: "var(--forest-dark)" }}>Droits d'accès & Autorisations</h2>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{selectedUser?.nom} ({selectedUser?.email})</div>
              </div>
              <button onClick={() => setModalType(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {succes && (
              <div style={{ background: "#EBF7F0", color: "#1F4D3A", padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={16} /> {succes}
              </div>
            )}

            {/* DEVISE ASSIGNÉE DANS PERMISSIONS */}
            <div style={{ marginBottom: 16, background: "var(--paper)", padding: 14, borderRadius: 12, border: "1.5px solid var(--line)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--forest-dark)", marginBottom: 4 }}>
                Devise & Caisse autorisées à cet employé :
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
                Choisissez si cet employé accède uniquement aux prix KMF, FCFA, ou aux deux :
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, deviseAutorisee: "TOUTES" })}
                  style={{
                    padding: "7px 6px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                    border: (!form.deviseAutorisee || form.deviseAutorisee === "TOUTES") ? "2px solid #2563EB" : "1px solid var(--line)",
                    background: (!form.deviseAutorisee || form.deviseAutorisee === "TOUTES") ? "#EFF6FF" : "#fff",
                    color: (!form.deviseAutorisee || form.deviseAutorisee === "TOUTES") ? "#1D4ED8" : "var(--ink)"
                  }}
                >
                  KMF & FCFA
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, deviseAutorisee: "KMF" })}
                  style={{
                    padding: "7px 6px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                    border: form.deviseAutorisee === "KMF" ? "2px solid #16A34A" : "1px solid var(--line)",
                    background: form.deviseAutorisee === "KMF" ? "#DCFCE7" : "#fff",
                    color: form.deviseAutorisee === "KMF" ? "#15803D" : "var(--ink)"
                  }}
                >
                  KMF (Comores)
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, deviseAutorisee: "FCFA" })}
                  style={{
                    padding: "7px 6px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                    border: form.deviseAutorisee === "FCFA" ? "2px solid #D97706" : "1px solid var(--line)",
                    background: form.deviseAutorisee === "FCFA" ? "#FEF3C7" : "#fff",
                    color: form.deviseAutorisee === "FCFA" ? "#B45309" : "var(--ink)"
                  }}
                >
                  FCFA (Sénégal)
                </button>
              </div>
            </div>

            <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600, marginBottom: 12 }}>
              Activez ou désactivez les menus accessibles à cet employé :
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 340, overflowY: "auto", paddingRight: 4 }}>
              {PERMISSIONS_LIST.map((item) => {
                const checked = (form.permissions || []).includes(item.key);

                return (
                  <label
                    key={item.key}
                    onClick={() => togglePermissionKey(item.key)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)",
                      background: checked ? "var(--forest-light)" : "#fff",
                      cursor: "pointer", transition: "all 0.15s"
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: checked ? 700 : 500, color: checked ? "var(--forest-dark)" : "var(--ink)" }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      style={{ width: 18, height: 18, accentColor: "var(--forest)", cursor: "pointer" }}
                    />
                  </label>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button type="button" onClick={() => setModalType(null)} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid var(--line)", background: "#fff", fontWeight: 600, cursor: "pointer" }}>
                Fermer
              </button>
              <button type="button" onClick={handleUpdate} className="bs-btn-primary" style={{ flex: 1, borderRadius: 12 }}>
                Enregistrer les droits
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
