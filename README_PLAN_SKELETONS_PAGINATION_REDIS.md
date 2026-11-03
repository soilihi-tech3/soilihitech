# Plan Technique : Skeletons Ultra-Rapides, Pagination par 20 et Cache Redis

Ce document détaille l'architecture complète pour éliminer les écrans blancs, accélérer le chargement des données sur toute la plateforme (Admin, Vente Directe POS et Boutique Client), paginer par blocs de 20 éléments et exploiter Redis pour supprimer les requêtes répétitives en base de données.

---

## 1. Objectifs Principaux

1. **Zéro écran blanc (Skeletons ultra-rapides)** :
   - Remplacer tout temps d'attente ou conteneur vide par des skeletons visuels immédiats avec effet shimmer.
   - Corriger en priorité la page **Vente Directe (POS)** qui affiche actuellement un écran vide avant la réponse de l'API.
   - Harmoniser les skeletons sur l'ensemble des tableaux d'administration et les grilles de produits du site public.

2. **Affichage par blocs de 20 éléments (Pagination / Chunking)** :
   - Charger 20 éléments par défaut sur toutes les vues (Produits, Vente Directe, Commandes, Demandes, Catalogue client).
   - Proposer un chargement fluide des 20 éléments suivants (bouton "Charger la suite" ou pagination rapide) à la demande du client ou de l'administrateur.

3. **Mise en cache Redis intelligente (Éviter les va-et-vient MySQL)** :
   - Mettre en cache dans Redis les requêtes lourdes et récurrentes (produits, variantes, catégories, stocks, paramètres boutique).
   - Servir les données en moins de 10 ms depuis la mémoire vive.
   - Mettre en place une invalidation ciblée automatique : dès qu'une vente est enregistrée, qu'un stock est modifié ou qu'un produit est créé/édité, les clés de cache associées sont immédiatement purgées.

---

## 2. Architecture & Composants à Implémenter

### A. Skeletons Visuels Globaux (Frontend)

1. **Composant centralisé `src/components/Skeleton.jsx`** :
   - `SkeletonPOSGrid` : simulation fidèle de 12 cartes de produits de caisse (image, titre, famille, badge stock, prix, boutons).
   - `SkeletonTable` : tableau complet avec en-tête stylisé et 8 lignes animées adaptées au nombre de colonnes.
   - `SkeletonProductGrid` : grille de 8 à 12 cartes produits e-commerce pour le catalogue et la page d'accueil client.
   - `SkeletonStatCards` : simulation des 4 à 8 cartes de statistiques du tableau de bord et des commandes.

2. **Intégration par page** :
   - `VenteDirecte.jsx` : intégrer `SkeletonPOSGrid` activé dès le premier milliseconde du montage tant que `products.length === 0 && loading`.
   - `Produits.jsx` : intégrer `SkeletonTable` avec 10 colonnes lors du changement de filtre ou de page.
   - `Orders.jsx` : skeleton sur les KPI et sur le tableau des commandes.
   - `SalesHistory.jsx` : skeleton sur la liste des ventes directes.
   - `DemandesSpeciales.jsx` : skeleton sur le tableau des demandes sur-mesure.
   - `Catalogue.jsx` & `Home.jsx` : skeleton de cartes de produits lors du filtrage par catégorie ou recherche.

---

### B. Pagination par 20 Éléments (Backend & Frontend)

1. **Standardisation Backend** :
   - Paramètres acceptés : `?page=1&limit=20` (limite fixée par défaut à 20 au lieu de tout charger sans limite).
   - Réponse API standardisée :
     ```json
     {
       "success": true,
       "items": [...],
       "pagination": {
         "total": 142,
         "page": 1,
         "limit": 20,
         "totalPages": 8,
         "hasMore": true
       }
     }
     ```
   - Routes ciblées :
     - `GET /api/admin/products`
     - `GET /api/admin/pos/products`
     - `GET /api/admin/orders`
     - `GET /api/admin/custom-requests`
     - `GET /api/admin/sales`
     - `GET /api/store/:slug/products`

2. **Comportement Frontend** :
   - **Vente Directe** : chargement instantané des 20 premiers produits. Si recherche saisie, recherche dynamique sur les 20 correspondants.
   - **Catalogue Client** : affichage des 20 premiers produits avec bouton discret "Afficher 20 produits supplémentaires" ou pagination.
   - **Tables Admin** : conservation de la pagination avec 20 lignes par page par défaut.

---

### C. Stratégie de Cache Redis (Backend)

1. **Configuration et Fallback (`backend/src/config/cache.js`)** :
   - Connexion via `ioredis` sur `process.env.REDIS_URL` ou `redis://127.0.0.1:6379`.
   - Fallback automatique en mémoire locale (`Map`) si Redis n'est pas démarré, garantissant que l'application ne plante jamais.

2. **Nomenclature des Clés Redis** :
   - `cache:boutique:{id}:products:p{page}:l{limit}:cat{cat}:q{search}` (TTL: 300s)
   - `cache:boutique:{id}:pos:p{page}:l20` (TTL: 180s)
   - `cache:boutique:{id}:categories` (TTL: 600s)
   - `cache:boutique:{id}:marques` (TTL: 600s)
   - `cache:store:{slug}:catalog:p{page}:l20` (TTL: 180s)

3. **Politique d'Invalidation Automatique** :
   - Lors de `POST/PUT/DELETE /admin/products` : purge immédiate de `*cache:boutique:{id}:products*` et `*cache:store:{slug}*`.
   - Lors d'une vente POS ou commande en ligne : décrémentation des stocks et purge immédiate de `*cache:boutique:{id}:pos*` et `*cache:boutique:{id}:products*` afin que les stocks restent toujours synchronisés.

---

## 3. Découpage en Phases d'Exécution

| Phase | Description | Fichiers impactés |
|---|---|---|
| **Phase 1** | Création des composants Skeleton dédiés POS et Tableaux | `frontend/src/components/Skeleton.jsx`, `frontend/src/styles.css` |
| **Phase 2** | Élimination de l'écran blanc sur Vente Directe & Intégration Skeletons | `frontend/src/pages/admin/VenteDirecte.jsx`, `Produits.jsx`, `Catalogue.jsx` |
| **Phase 3** | Mise en place de la pagination par 20 (chunking) | Contrôleurs backend + hooks de chargement frontend |
| **Phase 4** | Activation du cache Redis sur les routes produits/POS/catalogue | `backend/src/config/cache.js`, `backend/src/routes/admin.routes.js`, `store.routes.js` |
| **Phase 5** | Invalidation dynamique du cache lors des ventes et modifications de stocks | Contrôleurs `order.controller.js`, `product.controller.js` |
| **Phase 6** | Tests complets de performance, de fluidité et de persistance | Validation navigateur et métriques de latence |
