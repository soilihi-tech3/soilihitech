# Plan d'Architecture & d'Implementation : Commandes Sur-Mesure, POS Vente Directe & Stocks Variantes

Ce document détaille l'intégralité du plan d'architecture technique et fonctionnelle pour répondre aux quatre besoins exprimés par l'utilisateur :

1. **Demandes & Devis Sur-Mesure** : Ajout direct de commandes par l'administrateur ou l'employé, et exportation / impression de la liste en PDF.
2. **Caisse & Vente Directe (POS)** : Sélection par variante (ou ajout direct), décrémentation réelle du stock de la variante vendue et mention sur le ticket de caisse / reçu.
3. **Encaissement & Prix de vente libre en Caisse** : Calcul automatique de la monnaie à rendre ou du reste à payer, et champ de prix vendu personnalisé (impactant le bénéfice réel).
4. **Tableau d'inventaire Produits** : Bouton / icône d'œil pour inspecter instantanément le stock restant de chaque variante d'un produit.

---

## 1. Module Demandes & Devis Sur-Mesure (`DemandesSpeciales.jsx`)

### A. Ajout direct d'une commande / demande personnalisée par l'admin ou employé
- **Bouton d'action** : Ajout d'un bouton principal "+ Nouvelle commande / demande" dans l'en-tête de la page.
- **Modale de création intuitive** :
  - Nom du client (obligatoire) et Téléphone / WhatsApp (obligatoire).
  - Modèle d'appareil ou smartphone ciblé (ex: iPhone 14 Pro, Samsung S24...).
  - Liste dynamique d'articles demandés : possibilité d'ajouter plusieurs lignes avec désignation de l'article et quantité.
  - Chiffrage initial / Total devis (optionnel au départ ou chiffré immédiatement).
  - Statut initial sélectionnable : `en_attente`, `devis_envoye` ou `validee`.
  - Description / Notes internes pour l'équipe.
- **Backend API** :
  - Création de la route `POST /admin/custom-requests` dans `customOrder.controller.js` et `admin.routes.js`.
  - Génération automatique du code de référence normalisé `DEM-AAMMJJ-XXXX`.
  - Émission d'un événement temps réel pour actualiser les listes des autres utilisateurs connectés.

### B. Exportation et Impression de la liste en PDF
- **Bouton dédié** : "Exporter PDF / Imprimer la liste" avec icône imprimante.
- **Mise en page PDF professionnelle et propre** :
  - En-tête : Nom de la boutique, date et heure d'édition, nombre de demandes.
  - Tableau structuré contenant :
    - Référence (code) et Date de création
    - Client & Téléphone
    - Modèle d'appareil
    - Articles demandés et quantités
    - Montant du devis chiffré
    - Statut (En attente, Devis envoyé, Validée, Refusée).
  - Style d'impression optimisé avec feuille de style CSS `@media print` ou composant d'export dédié, sans éléments superflus de navigation.

---

## 2. Vente Directe (POS / Caisse) : Variantes & Stocks Dédiés

### A. Choix entre Ajout Direct et Sélection de Variante
- **Comportement sur la carte produit dans la grille POS** :
  - Si le produit ne possède pas de variante : Bouton unique "+ Ajouter au panier".
  - Si le produit possède des variantes (modèles, couleurs ou senteurs) :
    - Bouton `+ Direct` : Ajoute immédiatement 1 unité du produit standard au prix de base.
    - Bouton `+ Variantes` : Ouvre la modale de sélection détaillée.

### B. Modale de Sélection de Variante en Caisse
- Affichage de l'en-tête du produit (titre, catégorie, prix de base, stock total).
- Liste des déclinaisons disponibles :
  - Miniature photo de la variante.
  - Intitulé complet (ex: `iPhone 14 Pro`, `Bleu`, `Rose poudré`, `Perceuse robot`).
  - Prix spécifique (s'il existe un prix propre à la variante, sinon prix standard).
  - Stock restant pour cette variante spécifique (badge vert si disponible, rouge si épuisé).
  - Bouton "+ Ajouter 1" qui incrémente la variante spécifique dans le panier de caisse.

### C. Décrémentation réelle et synchrone des stocks de variantes
- **Backend (`backend/src/routes/admin.routes.js`)** :
  - Dans la route `POST /ventes/directe` :
    - Réception pour chaque item vendu : `productId`, `quantite`, `selectedCouleur`, `selectedModele`, `selectedSenteur`.
    - Mise à jour du JSON du produit :
      - Pour les couleurs : décrémentation de la quantité dans `p.couleurs`. Si le stock de "Bleu" était de 2 et qu'on en vend 1, il devient 1.
      - Pour les modèles : décrémentation de la quantité dans `p.modelesCompatibles`.
      - Pour les senteurs : décrémentation de la quantité dans `p.senteurs`.
    - Décrémentation du stock général : `p.stock = Math.max(0, p.stock - it.quantite)`.
    - Sauvegarde immédiate du produit et broadcast de l'événement temps réel `product_updated`.

### D. Mention précise de la variante sur le Reçu / Ticket de caisse
- L'enregistrement dans `OrderItem` stocke :
  - `modele` : nom du modèle sélectionné.
  - `couleur` : nom de la couleur ou de la senteur sélectionnée.
  - `imageUrl` : image spécifique de la variante.
- Le ticket de caisse imprimé / affiché détaille chaque ligne :
  - Exemple : `Pochette Silicone iPhone (Modèle : iPhone 14 Pro, Couleur : Bleu) x1`

---

## 3. Encaissement : Monnaie Rendue & Prix de Vente Libre

### A. Calcul automatique de la Monnaie Rendue / Reste à Payer
- **Panneau de règlement de la caisse** :
  - Champ de saisie : "Montant reçu du client" (champ numérique).
  - Boutons de raccourcis rapides selon la devise :
    - Comores (KMF) : Montant exact, +500, +1 000, +2 000, +5 000, +10 000, +20 000, +50 000 KMF.
    - Sénégal (FCFA) : Montant exact, +500, +1 000, +2 000, +5 000, +10 000 FCFA.
  - Calcul dynamique en direct :
    - Si `montantRecu >= totalAPayer` :
      - Affichage d'un grand encadré vert : **Monnaie à rendre : (montantRecu - totalAPayer)**.
    - Si `montantRecu > 0 && montantRecu < totalAPayer` :
      - Affichage d'un avertissement orange : **Reste à payer : (totalAPayer - montantRecu)**.

### B. Champ "Prix Vendu Personnalisé" (Prix Libre Négocié)
- Pour chaque ligne d'article dans le panier de caisse :
  - Affichage du prix de vente catalogue indicatif (ex: 2 500 KMF).
  - Champ modifiable optionnel "Prix vendu réel" permettant à l'employé/admin de fixer le prix convenu avec le client (ex: 6 000 KMF).
- **Impact comptable et financier** :
  - Le sous-total de la vente est recalculé sur la base de ce nouveau prix.
  - Lors de la validation, le prix unitaire réel vendu est sauvegardé dans `OrderItem.prixUnitaire`.
  - La marge bénéficiaire est calculée sur la base de ce prix réel : `Marge = (Prix Vendu Réel - Coût d'Achat) * Quantité`.
  - Le surplus de vente est directement répercuté dans le chiffre d'affaires et le bénéfice net calculé sur le Dashboard et le Bilan Financier.

---

## 4. Tableau d'Inventaire Produits (`Produits.jsx`) : Consultation Rapide des Stocks

### A. Icône d'Inspection des Variantes (Icône œil)
- Dans la table d'inventaire des produits :
  - Dans la colonne "STOCK" ou dans la colonne "ACTIONS", détection automatique de la présence de variantes (`couleurs`, `senteurs`, `modelesCompatibles`).
  - Si le produit dispose de variantes :
    - Affichage d'un bouton avec icône œil (`Eye`) ou cube (`Boxes`) et badge : `Variantes (X)`.
- Au clic sur l'icône :
  - Ouverture d'un panneau / modale moderne "Stocks détaillés par variante" :
    - Nom du produit et stock global.
    - Tableau récapitulatif listant chaque variante :
      - Type (Couleur, Senteur, Modèle de smartphone).
      - Miniature photo ou pastille couleur.
      - Nom de la variante.
      - Stock disponible restant avec code couleur (Vert si > 3, Orange si <= 3, Rouge si 0 / Épuisé).

---

## 5. Matrice Récapitulative des Fichiers et Modifications

| Composant | Fichiers cibles | Modifications prévues |
|---|---|---|
| **Demandes & Devis** | `frontend/src/pages/admin/DemandesSpeciales.jsx`<br>`backend/src/controllers/customOrder.controller.js`<br>`backend/src/routes/admin.routes.js` | - Bouton et modale d'ajout manuel de demande par l'admin/employé.<br>- Endpoint backend `POST /admin/custom-requests`.<br>- Fonction d'impression et export PDF propre de la liste des demandes. |
| **Sélection Variantes POS** | `frontend/src/pages/admin/VenteDirecte.jsx` | - Boutons "+ Direct" et "+ Variantes" sur chaque carte produit.<br>- Modale de sélection de variantes avec photos, prix et stocks temps réel. |
| **Stocks Variantes & Reçu** | `backend/src/routes/admin.routes.js`<br>`frontend/src/pages/admin/VenteDirecte.jsx` | - Décrémentation du stock spécifique de la variante vendue dans le JSON produit.<br>- Transmission des variantes dans `OrderItem` (`modele`, `couleur`, `imageUrl`).<br>- Affichage de la variante sur le reçu imprimable. |
| **Encaissement & Monnaie** | `frontend/src/pages/admin/VenteDirecte.jsx` | - Champ montant reçu client + raccourcis coupures de billets.<br>- Affichage dynamique "Monnaie à rendre" ou "Reste à payer". |
| **Prix de Vente Libre** | `frontend/src/pages/admin/VenteDirecte.jsx`<br>`backend/src/routes/admin.routes.js` | - Champ de prix vendu personnalisé par article dans le panier POS.<br>- Prise en compte du prix vendu dans le total et le calcul de bénéfice. |
| **Table Produits (Œil)** | `frontend/src/pages/admin/Produits.jsx` | - Icône d'œil sur les produits ayant des variantes.<br>- Modale claire listant le stock restant de chaque variante. |
