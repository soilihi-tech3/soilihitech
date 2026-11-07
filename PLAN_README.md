# Plan d'implémentation : Traçabilité Produits, Gestion des Dettes & Acomptes POS, Statut Achat Devis et Assistance WhatsApp

> **Statut global : TERMINÉ ET VALIDÉ**

Ce plan détaille l'implémentation complète des fonctionnalités demandées sur le SaaS multi-boutiques.

---

## 1. Gestion des Produits (`/admin/produits`) - [Statut : Terminée]

### Objectifs
- Savoir précisément **qui** a enregistré chaque produit et **dans quelle boutique**.
- Permettre de filtrer par utilisateur ayant enregistré et par boutique.
- Rendre les **KPIs en haut 100% dynamiques** selon ces filtres (pour savoir par exemple : *combien de produits un employé a enregistrés, et quelle valeur de stock cela représente*).

### Réalisations
1. **Nouvelles Colonnes dans la Table des Produits** :
   - **Boutique** : Badge avec le nom de la boutique avec icône vectorielle.
   - **Enregistré par** : Nom complet et rôle de la personne (`Admin`, `Employé`).
2. **Nouveaux Filtres dans la Barre Supérieure** :
   - **Filtre "Enregistré par"** : `Tous les auteurs (X)` / liste dynamique des administrateurs et employés.
   - **Filtre "Boutique"** : `Toutes les boutiques (Y)` / liste toujours visible des boutiques accessibles.
3. **KPIs Dynamiques** :
   - `TOTAL PRODUITS` & `RÉSULTATS` : nombre de produits correspondant au filtre sélectionné.
   - `VALEUR STOCK (FCFA)` & `VALEUR STOCK (KMF)` : recalculés instantanément sur la base des produits filtrés.
   - `ALERTES STOCK` : recalculé sur la sélection.

---

## 2. Historique des Ventes (`/admin/ventes-historique`) - [Statut : Terminée]

### Objectifs
- Suivre les paiements complets, partiels (acomptes) et impayés sans émojis bruts.
- Disposer d'une date d'échéance claire pour savoir quand le client doit payer le solde.
- Pouvoir relancer directement le client débiteur sur WhatsApp avec un message personnalisable par l'administrateur.
- Permettre d'encaisser directement le solde restant (ou un acompte) en 1 clic.

### Réalisations
1. **Nouvelles Colonnes dans la Table des Ventes** :
   - **Statut Paiement** :
     - `Payé` (Badge vert avec icône SVG)
     - `Partiel` (Badge ambré avec mention du reste à payer, ex: *Reste: 3 000 KMF*)
     - `Non payé` (Badge rouge avec mention de la dette totale)
   - **Date d'échéance** : Affiche la date convenue (ex: *15 nov. 2026*) avec indicateur "En retard" si dépassée, ou `—` si soldé.
   - **Montant détaillé** : Affiche le total, le montant reçu et le montant restant dû.
2. **Nouveau Filtre de Statut Paiement (sans émojis)** :
   - `Tous les règlements`
   - `Dettes (Non payé & Partiel)`
   - `Payé intégralement`
   - `Partiel (Acompte restant)`
   - `Non payé (Dette totale)`
3. **Actions Directes d'Encaissement & Relance WhatsApp** :
   - Bouton de **règlement direct** (`CreditCard`) permettant de solder ou verser un acompte avec recalcul instantané.
   - Bouton **WhatsApp** ouvrant un modal de prévisualisation et personnalisation du message avant envoi direct.

---

## 3. Vente Directe / POS Caisse (`/admin/vente`) - [Statut : Terminée]

### Objectifs
- Gérer les ventes à crédit et les acomptes au moment de l'encaissement comptoir.
- Saisir automatiquement la date à laquelle le client s'engage à payer le solde.
- Bloquer toute saisie de lettres dans le champ téléphone.

### Réalisations
1. **Détection d'acompte / reste à payer** :
   - Lorsque `Montant reçu du client` < `Total à payer` :
     - Affichage dynamique d'une bannière d'alerte :
       - Statut : `Partiel (Acompte)` ou `Non payé (À crédit)`.
       - Reste à payer calculé : `Total - Montant reçu`.
     - **Champ obligatoire : Date d'échéance du paiement** (calendrier pour choisir le jour prévu du règlement).
     - Le nom et le téléphone du client deviennent requis.
   - Le champ téléphone bloque strictement les caractères alphabétiques à la frappe.
2. **Backend (`/api/admin/ventes/directe`)** :
   - Enregistrement des colonnes dans la table `orders` :
     - `statutPaiement` (`paye`, `partiel`, `non_paye`)
     - `montantPaye`
     - `montantRestant`
     - `dateEcheance`

---

## 4. Demandes & Devis Sur-Mesure (`/admin/demandes`) - [Statut : Terminée]

### Objectifs
- Savoir si les articles commandés/chiffrés ont déjà été achetés/approvisionnés auprès des fournisseurs.
- Pouvoir filtrer les devis selon qu'ils sont achetés ou pas encore achetés avec une interface soignée sans émojis.
- Bloquer la saisie de lettres dans les champs téléphones.

### Réalisations
1. **Nouvelle Colonne "Achat Fournisseur"** :
   - Bouton interactif avec icônes SVG :
     - `Acheté` (Pastille verte avec CheckCircle)
     - `Pas encore acheté` (Pastille ambrée avec Clock)
   - Clic en 1 touche pour changer le statut d'achat directement depuis le tableau.
2. **Onglets Segments Modernes (sans émojis)** :
   - `Tous (X)`
   - `Déjà achetés (Y)`
   - `Pas encore achetés (Z)`
3. **Champs Téléphones Sécurisés** :
   - Modales de création et modification de devis équipées d'un blocage strict des lettres.

---

## 5. Message WhatsApp d'assistance sur le site public - [Statut : Terminée]

### Objectifs
- Quand un client clique sur le bouton WhatsApp d'assistance ou "Besoin d'aide" sur le site, le message doit automatiquement mentionner le nom de la boutique.

### Réalisations
- Remplacement du texte générique par le template dynamique :
  > `"Bonjour [Nom de la boutique], je vous contacte pour..."`
- Intégré dans `Footer.jsx`, `Register.jsx`, `DemandeSurMesure.jsx` et `SuiviDemande.jsx`.
