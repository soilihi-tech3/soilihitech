# Plan d'Implementation : Permissions Admin (Ventes & Achats) et Gestion des Stocks par Variante

Ce document contient l'intégralité du plan d'architecture et d'implémentation établi avant l'exécution du code pour répondre aux exigences suivantes :
1. Restriction stricte des droits de modification et suppression des ventes et des achats aux seuls administrateurs.
2. Gestion fine des stocks par variante (Couleurs, Senteurs, Modèles de smartphones) avec contrôles de cohérence et affichage dynamique côté boutique.

---

## 1. Contexte et Objectifs

### A. Sécurisation des Ventes et des Achats
- **Problème initial** : Les employés avaient la possibilité d'interagir ou il n'y avait pas de distinction claire entre les rôles pour la modification et la suppression des enregistrements de ventes et d'achats.
- **Règle métier** : Seul un utilisateur avec le rôle `admin` ou `superadmin` est autorisé à modifier ou supprimer une vente ou un achat fournisseur. Les employés conservent uniquement la consultation et l'impression des reçus.
- **Impact sur les stocks** :
  - La suppression d'une vente doit obligatoirement réintégrer les quantités vendues dans le stock des produits (restockage automatique).
  - La modification d'un achat doit réajuster le stock selon la différence (nouveau stock = ancien stock + différence).
  - La suppression d'un achat doit déduire la quantité achetée du stock du produit.

### B. Gestion des Stocks par Variante
- **Problème initial** : Le stock était uniquement géré au niveau global du produit. Lorsqu'un produit disposait de plusieurs couleurs, senteurs ou modèles compatibles (ex: coques iPhone 13, 14, 14 Pro), il était impossible de définir et de suivre le stock restant par variante.
- **Règles métier** :
  1. Lors de l'ajout ou modification d'un produit, chaque couleur, senteur ou modèle de smartphone dispose d'un champ numérique "Quantité / Stock disponible".
  2. Règle de cohérence stricte : la quantité d'une variante ne doit en aucun cas dépasser le stock global du produit.
  3. Côté boutique (fiche produit) :
     - Si une variante a un stock nul ou négatif (stock <= 0), son élément de sélection devient grisé, son libellé est barré et un badge "Épuisé" est affiché.
     - Si le client clique sur une variante épuisée, une notification claire l'avertit et l'invite à choisir une variante disponible.
     - Le badge principal de stock sous le titre du produit affiche en temps réel le stock restant de la variante active sélectionnée au lieu du stock global uniquement.
     - Le bouton "Ajouter au panier" est automatiquement désactivé avec le libellé "Variante épuisée (Choisir une autre)" dès qu'une variante sélectionnée est en rupture.
     - Le compteur de quantité est plafonné au stock disponible de la variante sélectionnée.

---

## 2. Architecture Technique et Plan Détaillé

### Partie 1 : Backend (API Express & Sequelize)

Fichier concerné : `backend/src/routes/admin.routes.js`

1. **Endpoint PUT `/admin/orders/:id` (Modification d'une vente)** :
   - Middleware de protection : `authMiddleware`, `tenantMiddleware`, `requireRole("admin")`.
   - Champs modifiables : `clientNom`, `clientTelephone`, `statut`, `modePaiement`, `notes`.
   - Émission d'événement temps réel SSE / Broadcast pour mise à jour immédiate des interfaces connectées.

2. **Endpoint DELETE `/admin/orders/:id` (Suppression d'une vente & Restockage)** :
   - Middleware de protection : `authMiddleware`, `tenantMiddleware`, `requireRole("admin")`.
   - Exécution sous transaction SQL Sequelize (`sequelize.transaction`) :
     - Récupération de la commande et de l'ensemble de ses lignes d'articles (`items`).
     - Pour chaque article, incrémentation du stock du produit correspondant : `Product.increment('stock', { by: item.quantite })`.
     - Suppression des articles de la commande (`OrderItem.destroy`).
     - Suppression de la commande (`Order.destroy`).
   - Notification temps réel du stock mis à jour.

3. **Endpoint PUT `/admin/achats/:id` (Modification d'un achat)** :
   - Middleware de protection : `authMiddleware`, `tenantMiddleware`, `requireRole("admin")`.
   - Calcul de la différence de quantité : `diff = nouvelleQuantite - ancienneQuantite`.
   - Ajustement du stock produit : `Product.increment('stock', { by: diff })`.
   - Mise à jour des informations de l'achat (coût unitaire, coût total, fournisseur, notes).

4. **Endpoint DELETE `/admin/achats/:id` (Suppression d'un achat)** :
   - Middleware de protection : `authMiddleware`, `tenantMiddleware`, `requireRole("admin")`.
   - Décrémentation du stock du produit selon la quantité achetée supprimée.
   - Suppression définitive de la ligne d'approvisionnement.

---

### Partie 2 : Frontend Administration

#### A. Historique des Ventes (`frontend/src/pages/admin/SalesHistory.jsx`)
1. Vérification du rôle utilisateur :
   ```javascript
   const isAdmin = user?.role === "admin" || user?.role === "superadmin";
   ```
2. Tableau des ventes :
   - Affichage de la colonne "Actions" avec boutons d'édition (icône crayon) et de suppression (icône corbeille) uniquement si `isAdmin === true`.
   - Pour les employés : affichage unique du bouton "Voir le reçu".
3. Modale de modification de vente :
   - Formulaire permettant d'ajuster le nom du client, son téléphone, le mode de paiement, le statut de la commande et les observations.
4. Modale de confirmation de suppression :
   - Message explicite informant que les articles de la vente seront réintégrés automatiquement au stock du magasin.

#### B. Gestion des Achats (`frontend/src/pages/admin/Achats.jsx`)
1. Vérification du rôle utilisateur (`isAdmin`).
2. Tableau des approvisionnements :
   - Colonne "Actions" conditionnée à `isAdmin`.
3. Modale d'édition d'achat :
   - Modification de la quantité achetée, du prix unitaire et du fournisseur avec recalcul automatique du montant total.
4. Modale de confirmation de suppression :
   - Avertissement confirmant que la quantité achetée sera retirée du stock du produit.

#### C. Gestion des Produits (`frontend/src/pages/admin/Produits.jsx`)
1. **Section Couleurs** :
   - Ajout d'un champ numérique "Stock dispo" pour chaque couleur.
   - Liaison avec les propriétés `quantite` et `stock`.
2. **Section Senteurs / Fragrances** :
   - Ajout d'un champ numérique "Stock dispo" pour chaque senteur.
   - Liaison avec les propriétés `quantite` et `stock`.
3. **Section Modèles de Smartphones (iPhone, Samsung, etc.)** :
   - Pour chaque modèle coché, ajout d'un champ "Stock dispo" à côté des champs de prix spécifiques Comores et Sénégal.
4. **Validation à la soumission (`handleSubmit`)** :
   - Vérification que pour chaque couleur, senteur ou modèle renseigné, la quantité ne soit pas supérieure au stock général du produit (`form.stock`).
   - Blocage de la validation et affichage d'un toast d'erreur explicite en cas de dépassement.

---

### Partie 3 : Frontend Boutique Client (`frontend/src/pages/store/ProductDetail.jsx`)

1. **Calcul dynamique du stock de la variante sélectionnée** :
   - Fonction utilitaire `getVariantStock(v)` extrayant `v.quantite` ou `v.stock`.
   - Détermination du stock actif `displayStock` selon la variante choisie :
     - Si couleur choisie : stock de la couleur.
     - Si modèle choisi : stock du modèle.
     - Si couleur et modèle choisis : minimum entre le stock du modèle et celui de la couleur.
     - Si aucune variante avec stock spécifique : repli sur le stock global du produit.

2. **Badge principal de stock (sous le titre et les avis)** :
   - Au lieu d'afficher continuellement le stock global du produit, le badge indique :
     - En stock : `En stock : X pièce(s) restante(s) (Nom de la variante) · Stock total : Y`.
     - En rupture : `Rupture de stock · [Nom de la variante] épuisé(e)` (fond rouge clair, bordure rouge).
     - Stock maximal en panier atteint : indication de la limite atteinte pour cette variante.

3. **Pastilles et boutons de sélection** :
   - **Couleurs** : chaque pastille affiche `[Nom couleur | X dispo]`. Si épuisé : pastille grisée, texte barré, badge `Épuisé`.
   - **Senteurs** : chaque pastille affiche `[Nom senteur | X dispo]`. Si épuisé : pastille grisée, texte barré, badge `Épuisé`.
   - **Modèles de smartphone** : chaque puce affiche `[Modèle | X dispo]`. Si épuisé : puce grisée, texte barré, badge `Épuisé`.

4. **Interactions et alertes utilisateur** :
   - Clic sur une variante épuisée : déclenchement immédiat d'un toast d'avertissement invitant à choisir une autre option.
   - Bannière d'alerte rouge affichée au-dessus du bouton de panier si une variante sélectionnée est en rupture.
   - Bouton "Ajouter au panier" désactivé (`disabled`) avec le texte "Variante épuisée (Choisir une autre)".
   - Compteur de quantité borné entre 1 et le stock disponible de la variante sélectionnée.

5. **Contexte du Panier (`frontend/src/context/CartContext.jsx`)** :
   - Prise en charge du paramètre `stockVariante` dans la fonction `addToCart`.
   - Empêchement de dépasser le stock maximal alloué à la variante lors d'ajouts répétés.

---

## 3. Matrice de Test et Validation

| Fonctionnalité | Scénario de test | Résultat attendu |
|---|---|---|
| Sécurité Ventes | Connexion employé sur `SalesHistory` | Aucun bouton Modifier ni Supprimer visible. Reçu accessible. |
| Sécurité Ventes | Connexion admin sur `SalesHistory` | Boutons Modifier et Supprimer visibles et fonctionnels. |
| Restockage | Suppression d'une vente de 2 unités de Produit A (stock initial 10) | Stock de Produit A passe automatiquement à 12. |
| Sécurité Achats | Connexion admin sur `Achats` | Modification et suppression d'achats fonctionnelles avec ajustement du stock produit. |
| Admin Produits | Saisie d'une variante avec stock = 15 alors que stock global = 10 | Soumission bloquée avec message d'erreur. |
| Boutique | Sélection d'une couleur ayant un stock de 2 | Badge principal indique 2 pièces restantes pour cette couleur. |
| Boutique | Sélection d'un modèle ayant un stock de 0 | Pastille barrée avec badge "Épuisé", alerte affichée, bouton d'ajout désactivé. |
| Panier | Tentative d'ajout de 3 unités d'une variante ayant un stock de 2 | Quantité ajustée automatiquement à 2 avec message d'avertissement. |
