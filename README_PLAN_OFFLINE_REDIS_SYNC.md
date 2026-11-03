# Plan d'Architecture : Mode Hors-Ligne Intégral (Offline-First), Synchronisation Automatique & Cache Redis

Ce document définit la feuille de route technique pour permettre à toute la plateforme **Soilihitech** (Caisse POS, Devis & Demandes sur-mesure, Catalogue et Navigation) de fonctionner **sans connexion Internet**, avec **téléchargement et ouverture de l'application hors-ligne**, stockage local sécurisé, et **synchronisation automatique en arrière-plan** dès le rétablissement du réseau.

---

## 1. Problématique & Objectifs

Aux Comores et au Sénégal, les coupures de réseau internet ou d'électricité sont fréquentes. Une boutique physique et un service de devis ne doivent **jamais s'arrêter** sous prétexte que le signal 4G ou la fibre est coupé.

### Objectifs Clés :
1. **Ouverture de l'application hors-ligne** : L'employé ou l'administrateur peut ouvrir l'application sur son téléphone ou son ordinateur même sans signal Internet grâce au Service Worker PWA (Cache Storage).
2. **Caisse & Vente Directe (POS) 100% Offline** :
   - Le catalogue complet de produits, variantes et prix reste consultable.
   - L'encaissement est validé immédiatement en local.
   - Le ticket de caisse PDF est généré et enregistré directement dans le téléphone.
   - Le stock local est décrémenté en temps réel sur la session.
3. **Devis & Demandes sur-mesure Offline** :
   - Création de devis personnalisés, ajout d'articles et estimation tarifaire possibles hors-ligne.
   - Un identifiant temporaire certifié (`DEM-OFFLINE-...`) est attribué.
4. **Synchronisation Automatique Silencieuse** :
   - Dès que le signal Internet revient, une file d'attente (IndexedDB) transmet automatiquement toutes les ventes et tous les devis au serveur.
   - Protection stricte contre les doublons via des clés d'idempotence (`idempotency_key`).
5. **Cache Redis Côté Serveur** :
   - Réponse ultra-rapide (< 10 ms) pour les requêtes catalogue, paramètres et stocks.
   - Invalidation automatique du cache dès qu'une vente ou une modification de stock survient.

---

## 2. Architecture Technique Globale

```
+--------------------------------------------------------------------------------+
|                         APPLICATION CLIENT / MOBILE PWA                        |
|                                                                                |
|  +---------------------+   +---------------------+   +-----------------------+ |
|  |   Service Worker    |   |   IndexedDB Queue   |   |   Offline Context     | |
|  |   (Cache Storage)   |   |  (Storage Local)    |   |   (Détecteur Réseau)  | |
|  | - Fichiers HTML/JS  |   | - Catalogue produits|   | - Écouteur online     | |
|  | - Feuilles de style |   | - Ventes en attente |   | - Auto-synchro queue  | |
|  | - Logos & Icônes    |   | - Devis en attente  |   | - Toasts discrets     | |
|  +---------------------+   +---------------------+   +-----------------------+ |
+---------------------------------------+----------------------------------------+
                                        |
                 (Rétablissement Connexion Internet Auto)
                                        |
                                        v
+--------------------------------------------------------------------------------+
|                         SERVEUR BACKEND (NODE.JS / EXPRESS)                    |
|                                                                                |
|  +---------------------+   +---------------------+   +-----------------------+ |
|  |  Contrôleurs Synchro|   |  Sécurité Doublons  |   |   Cache RAM Redis     | |
|  | - POST /sales       |   | - Clé d'idempotence |   | - Catalogue en RAM    | |
|  | - POST /custom-req  |   | - Anti double vente |   | - Invalidation instant| |
|  +---------------------+   +---------------------+   +-----------------------+ |
+---------------------------------------+----------------------------------------+
                                        |
                                        v
+--------------------------------------------------------------------------------+
|                    BASE DE DONNÉES CLOUD PERSISTANTE (TiDB)                     |
+--------------------------------------------------------------------------------+
```

---

## 3. Détail des Modules & Implémentation

### A. Service Worker & Ouverture Hors-Ligne (PWA)
1. **Stratégie Cache Storage** :
   - *Assets statiques* (HTML, JS, CSS, icônes) : stratégie **Stale-While-Revalidate**. Si le téléphone est hors-ligne, le navigateur charge instantanément la version en cache local.
   - *Images produits* : mise en cache à la première visualisation pour affichage hors-ligne dans la caisse POS.
2. **Fichier `public/sw.js`** :
   - Déclaration des routes critiques à mettre en cache : `/`, `/admin/vente`, `/admin/demandes`, `/admin/ventes-historique`.
   - Gestion des pannes de réseau sans renvoyer d'écran d'erreur navigateur.

---

### B. Moteur Local IndexedDB (`offlineStorage.js`)
La base locale navigateur `SoilihitechOfflineDB` comportera trois tables internes :

1. **`catalog_cache`** :
   - Copie intégrale des produits actifs, catégories, variantes de couleurs/modèles et prix KMF/FCFA.
   - Mis à jour automatiquement à chaque visite en ligne, conservé indéfiniment pour utilisation hors-ligne.
2. **`sync_queue`** (File d'attente d'envoi) :
   - Chaque vente ou devis créé sans Internet est empilé avec :
     - `id` : identifiant local unique UUID (`sync_xxx`).
     - `type` : `"VENTE_DIRECTE"` ou `"DEVIS_SUR_MESURE"`.
     - `endpoint` : `/admin/sales` ou `/admin/custom-requests`.
     - `payload` : données complètes de la transaction.
     - `timestamp` : heure exacte de la saisie physique.
     - `idempotencyKey` : empreinte anti-doublon.
3. **`local_sales` & `local_quotes`** :
   - Permet d'afficher immédiatement la vente dans l'historique local avec la mention visuelle *"En attente de connexion"* au lieu d'attendre le serveur.

---

### C. Adaptation de la Vente Directe (POS)
Dans [VenteDirecte.jsx](file:///Users/soilihiabdou/Downloads/soilihielec/boutique/boutiques/frontend/src/pages/admin/VenteDirecte.jsx) :
1. **Détection automatique d'état** :
   - Si `navigator.onLine` est faux ou si la requête API échoue (timeout), bascule transparente en mode caisse autonome.
2. **Validation locale immédiate** :
   - Génération du numéro de ticket : `POS-LOCAL-[TIMESTAMP]-[RAND]`.
   - Décrémentation instantanée du stock dans le cache local pour éviter de revendre un article épuisé.
   - Ouverture et téléchargement immédiat du reçu PDF sur le téléphone.
   - Enregistrement de la vente dans la table `sync_queue`.
   - Notification discrète : *"Vente enregistrée hors-ligne. Elle sera synchronisée dès le retour d'Internet."*

---

### D. Adaptation des Demandes & Devis Sur-Mesure
Dans [DemandesSpeciales.jsx](file:///Users/soilihiabdou/Downloads/soilihielec/boutique/boutiques/frontend/src/pages/admin/DemandesSpeciales.jsx) :
1. **Création hors-ligne** :
   - Si le réseau est indisponible, l'enregistrement du devis ne bloque pas.
   - Un numéro de dossier temporaire est généré : `DEM-LOCAL-[DATE]-[RAND]`.
   - Le devis est stocké dans la `sync_queue` et ajouté dans la liste affichée avec un badge orange *"En attente de synchronisation"*.
2. **Chiffrage & Modification hors-ligne** :
   - Les articles et montants saisis sont mémorisés localement et mis en file d'attente.

---

### E. Synchronisation Automatique Silencieuse (`OfflineContext.jsx`)
1. **Écouteurs d'événements réseau** :
   - `window.addEventListener("online")` : déclenche immédiatement le vidage de la file d'attente.
   - Polling léger de connectivité (ping toutes les 30 secondes vers `/api/health` pour s'assurer que la connexion est réelle et pas un faux signal Wi-Fi sans accès Internet).
2. **Ordre chronologique de synchronisation** :
   - Dépilement des actions dans l'ordre de leur création (`timestamp ASC`).
   - Pour chaque action transmise avec succès, suppression de l'entrée dans IndexedDB.
   - Toast discret en bas d'écran : *"Connexion rétablie : X vente(s) et devis synchronisés avec succès."*

---

### F. Backend & Cache Redis (`backend/`)
1. **Couche Cache Redis** :
   - Mise en cache mémoire des endpoints publics et caisse :
     - `store:products:all` (TTL 1 heure).
     - `store:categories` (TTL 24 heures).
     - `store:settings` (TTL 24 heures).
   - Invalidation ciblée dès qu'une vente est validée ou qu'un produit est mis à jour : purge automatique de `store:products:*`.
2. **Protection Anti-Doublons (Idempotence)** :
   - Vérification de l'`idempotencyKey` envoyée par le frontend.
   - Si une vente avec la même clé a déjà été insérée suite à une reconnexion instable, le backend renvoie le résultat existant sans recréer une deuxième vente ni décrémenter deux fois le stock.

---

## 4. Plan de Déploiement par Phases

| Phase | Intitulé | Actions Principales |
|---|---|---|
| **Phase 1** | *Service Worker PWA Shell* | Mise en cache des pages et scripts pour permettre l'ouverture hors-ligne sans connexion. |
| **Phase 2** | *Stockage Local IndexedDB* | Création de `SoilihitechOfflineDB` avec mise en cache du catalogue et gestion de la file d'attente. |
| **Phase 3** | *Vente Directe POS Offline* | Encaissement hors-ligne, décrémentation locale du stock et génération directe du ticket de caisse PDF. |
| **Phase 4** | *Devis & Demandes Offline* | Création et consultation des devis hors-ligne avec codes locaux. |
| **Phase 5** | *Synchronisation Automatique* | Envoi automatique des transactions dès reconnexion et affichage des indicateurs de statut. |
| **Phase 6** | *Intégration Cache Redis* | Cache mémoire haute performance sur le backend avec invalidation intelligente. |
