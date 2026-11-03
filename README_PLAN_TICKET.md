# PLAN D'ARCHITECTURE ET GUIDE D'IMPLÉMENTATION : SYSTÈME D'IMPRIMERIE THERMIQUE ET TICKET DE CAISSE (RECEIPT PRINTER)

Ce document constitue le guide technique complet pour exporter, adapter et intégrer le système d'imprimerie thermique et de génération de tickets de caisse dans une autre boutique ou un autre projet web.

---

## 1. Vue d'ensemble de la solution

Le système fournit une expérience d'impression complète composée de trois piliers complémentaires :
1. **Composant UI interactif (Imprimante Thermique Animée) :**
   - Animation réaliste pas-à-pas de l'avancée du papier thermique.
   - Écran OLED intégré avec statuts dynamiques (`processing`, `printing`, `complete`).
   - Découpe crantée en dents de scie réaliste via CSS `clip-path`.
   - Code-barres vectoriel SVG déterministe généré à la volée.
2. **Génération directe de PDF thermique (jsPDF) :**
   - Téléchargement direct d'un fichier PDF au format rouleau continu 80mm sans ouvrir la boîte de dialogue d'impression système du navigateur.
   - Calcul dynamique de la hauteur du rouleau selon le nombre d'articles et la longueur des descriptions.
   - Retour à la ligne automatique (`doc.splitTextToSize`) pour ne jamais tronquer les noms d'articles ni les variantes.
   - Tracé vectoriel du code-barres directement dans le PDF.
3. **Compatibilité imprimante thermique physique (POS 80mm) :**
   - Règles CSS `@media print` dédiées pour les sorties papier sur imprimantes de caisse (Epson, Xprinter, Sunmi, Star Micronics).

---

## 2. Dépendances requises

Pour intégrer ce module dans une nouvelle boutique React (Vite ou Next.js), installez les dépendances suivantes :

```bash
npm install motion jspdf lucide-react react-hot-toast
```

### Rôle de chaque librairie :
- `motion` (ou `framer-motion`) : Gère les transitions fluides du papier et le moteur pas-à-pas de l'imprimante.
- `jspdf` : Génère le ticket PDF côté client avec dimensions personnalisées [80mm, hauteur variable].
- `lucide-react` : Icônes d'interface (imprimante, téléchargement, rotation, fermeture, etc.).
- `react-hot-toast` : Notifications lors du succès du téléchargement ou en cas d'erreur.

---

## 3. Structure des fichiers à exporter

Pour réutiliser le système dans un autre projet, il suffit de copier deux composants principaux et d'ajouter une règle CSS :

```text
src/
├── components/
│   ├── ReceiptPrinter.jsx   # Composant d'imprimante physique (machine, écran, moteur papier, code-barres SVG)
│   └── ReceiptModal.jsx     # Modale d'orchestration, formatage des articles, calcul PDF et boutons d'action
└── styles.css               # Règles d'impression @media print pour rouleaux 80mm
```

---

## 4. Détail du composant `ReceiptPrinter.jsx`

Ce composant utilise le patron de conception **Compound Component** (`Root`, `Machine`, `Header`, `Screen`, `Status`, `Output`, `Paper`).

### Spécificités techniques clés :
1. **Découpe en dents de scie du papier (`receiptClipPath`) :**
   Génère un polygone CSS composé de 40 crans sur le bas du papier pour imiter la déchirure du ticket de caisse.
2. **Animation par paliers (`printingTransformKeyframes`) :**
   20 micro-avancées saccadées combinées à des temps d'arrêt (`times`), simulant fidèlement le moteur pas-à-pas d'une tête thermique.
3. **Générateur de code-barres vectoriel (`BarcodeSvg`) :**
   Prend la référence de commande (ex: `COM-B042`) et génère dynamiquement un code-barres SVG lisible sans librairie externe lourde.

---

## 5. Détail du composant `ReceiptModal.jsx`

Ce composant orchestre les données de commande, la logique métier de la boutique et la génération du PDF.

### A. Extraction universelle des articles et variantes (`getArticleDetails`) :
Permet d'absorber n'importe quelle structure d'objet produit sans perte d'information :
```javascript
export function getArticleDetails(it) {
  const pu = Number(it.prixUnitaire || it.product?.prix || 0);
  const qte = Number(it.quantite || 1);
  const lineTotal = pu * qte;
  const productName = (
    it.product?.nom ||
    it.product?.titre ||
    it.nom ||
    it.nomProduit ||
    it.designation ||
    "Article"
  ).trim();

  const resolveVal = (val) => {
    if (!val) return null;
    if (typeof val === "object") return val.nom || val.label || val.name || null;
    return String(val).trim();
  };

  const parts = [];
  const brand = resolveVal(it.marqueTelephone || it.selectedBrand || it.marque || it.product?.marque?.nom);
  const model = resolveVal(it.modele || it.selectedModele || it.modeleTelephone);
  const color = resolveVal(it.couleur || it.selectedCouleur);
  const scent = resolveVal(it.senteur || it.selectedSenteur);
  const size = resolveVal(it.taille || it.selectedTaille || it.pointure);
  const customVar = resolveVal(it.variante);

  if (brand && !productName.toLowerCase().includes(brand.toLowerCase())) parts.push(brand);
  if (model) parts.push(model);
  if (color) parts.push(color);
  if (scent) parts.push(scent);
  if (size) parts.push(`Taille: ${size}`);
  if (customVar) parts.push(customVar);

  return {
    productName,
    pu,
    qte,
    lineTotal,
    variantText: parts.length > 0 ? parts.join(" · ") : ""
  };
}
```

### B. Génération PDF directe (`handleDownloadPDF`) :
- **Largeur fixe :** 80mm.
- **Hauteur variable :** `Math.max(170, 130 + estimatedItemsH + extraFields)`.
- **Rendu multi-lignes sans troncature :**
  ```javascript
  const splitName = doc.splitTextToSize(cleanNom, 48);
  doc.text(splitName, leftX, y);
  y += splitName.length * 3.4;
  ```
- **Nettoyage ASCII pour jsPDF :** Suppression des accents non gérés par la police standard avec `cleanPdfText` pour éviter tout caractère illisible.
- **Sauvegarde directe sans boîte système :** `doc.save("Ticket-XXX.pdf")`.

---

## 6. Styles CSS pour imprimante thermique physique (`@media print`)

À ajouter dans votre feuille de style globale (`styles.css` ou `index.css`) :

```css
@media print {
  body * {
    visibility: hidden;
  }
  .bs-receipt-paper-printable,
  .bs-receipt-paper-printable * {
    visibility: visible;
  }
  .bs-receipt-paper-printable {
    position: absolute;
    left: 0;
    top: 0;
    width: 80mm !important;
    max-width: 80mm !important;
    margin: 0 !important;
    padding: 6mm !important;
    box-shadow: none !important;
    background: #ffffff !important;
    color: #000000 !important;
    clip-path: none !important;
    font-family: 'Courier New', Courier, monospace !important;
  }
  @page {
    size: 80mm auto;
    margin: 0;
  }
}
```

---

## 7. Guide d'intégration dans une page ou un composant

### Exemple d'utilisation basique :
```jsx
import React, { useState } from "react";
import ReceiptModal from "./components/ReceiptModal";

export function MaPageVente() {
  const [ticketOrder, setTicketOrder] = useState(null);

  const boutiqueInfo = {
    nom: "Ma Nouvelle Boutique",
    adresse: "Centre-ville, Moroni",
    telephone: "+269 333 00 00",
    devise: "KMF",
    logoUrl: "/logo.png"
  };

  const handleVenteTerminee = (commandeCreee) => {
    setTicketOrder(commandeCreee);
  };

  return (
    <div>
      <button onClick={() => setTicketOrder(commandeExemple)}>
        Voir le ticket de caisse
      </button>

      {ticketOrder && (
        <ReceiptModal
          order={ticketOrder}
          boutique={boutiqueInfo}
          onClose={() => setTicketOrder(null)}
          onContinue={() => setTicketOrder(null)}
        />
      )}
    </div>
  );
}
```

### Format attendu pour l'objet `order` :
```json
{
  "id": 42,
  "reference": "#COM-B042",
  "createdAt": "2026-11-03T10:00:00Z",
  "client": { "nom": "Faruck", "telephone": "+221 77 000 00 00" },
  "typeVente": "vente_directe",
  "modeLivraison": "retrait",
  "moyenPaiement": "cash",
  "montantRecu": 10000,
  "monnaieRendue": 2000,
  "total": 8000,
  "sousTotal": 8000,
  "fraisLivraison": 0,
  "devise": "FCFA",
  "items": [
    {
      "quantite": 1,
      "prixUnitaire": 1000,
      "product": { "nom": "Pochette Silicone iPhone 14" },
      "modele": "iPhone 14",
      "couleur": "Rose"
    },
    {
      "quantite": 1,
      "prixUnitaire": 7000,
      "product": { "nom": "Parfum KAYALI Eden Juicy Apple" },
      "senteur": "Pomme Rouge Florale"
    }
  ]
}
```

---

## 8. Liste de contrôle (Checklist) pour déploiement dans une nouvelle boutique

- [ ] Installer les modules npm `motion`, `jspdf`, `lucide-react`, `react-hot-toast`.
- [ ] Copier `ReceiptPrinter.jsx` dans `src/components/`.
- [ ] Copier `ReceiptModal.jsx` dans `src/components/`.
- [ ] Ajouter les styles `@media print` dans la feuille de styles globale.
- [ ] Vérifier que la fonction de devise (`formatPrice` ou utilitaire similaire) correspond à la devise locale de la nouvelle boutique (FCFA, KMF, EUR, etc.).
- [ ] Vérifier que la prop `boutique` transmet le nom, l'adresse, le téléphone et éventuellement le logo.
- [ ] Tester le téléchargement direct du PDF : vérifier qu'aucun nom long n'est tronqué et que le fichier se télécharge directement.
- [ ] Tester le bouton physique d'impression pour s'assurer que le papier 80mm s'imprime sans éléments d'interface parasites.
