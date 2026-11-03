import React, { useEffect, useState, useRef } from "react";
import { Printer, Download, X, RotateCcw, ShoppingBag, Store, Truck, Sparkles, Share2, MessageCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import jsPDF from "jspdf";
import { useAuth } from "../context/AuthContext.jsx";
import { formatPrice as fcfa } from "../utils/currency.js";
import { ReceiptPrinter, BarcodeSvg } from "./ReceiptPrinter.jsx";

function cleanPdfText(text) {
  if (!text) return "";
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[«»“”]/g, '"')
    .trim();
}

function pdfPrice(val, devise) {
  const num = Number(val || 0);
  const formatted = num.toLocaleString("fr-FR").replace(/\s/g, " ");
  return `${formatted} ${cleanPdfText(devise || "FCFA")}`;
}

function drawVectorBarcode(doc, value, centerX, y, totalW, h) {
  doc.setFillColor(15, 23, 42);
  const barCount = 44;
  let seed = 0;
  for (let i = 0; i < value.length; i++) {
    seed = (seed + value.charCodeAt(i) * (i + 1)) % 1000;
  }
  const startX = centerX - totalW / 2;
  const unitW = totalW / (barCount * 1.5);
  let curX = startX;

  for (let i = 0; i < barCount; i++) {
    const isBlack = (i % 2 === 0) || (i % 5 === 0);
    const pseudo = (seed * (i + 7) + 13) % 10;
    const w = unitW * (isBlack ? (pseudo > 7 ? 2.2 : pseudo > 3 ? 1.5 : 1) : (pseudo > 6 ? 1.5 : 1));
    if (isBlack) {
      doc.rect(curX, y, w, h, "F");
    }
    curX += w + 0.3;
  }
}

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

  if (brand && !productName.toLowerCase().includes(brand.toLowerCase())) {
    parts.push(brand);
  }
  if (model) parts.push(model);
  if (color) parts.push(color);
  if (scent) parts.push(scent);
  if (size) parts.push(`Taille: ${size}`);
  if (customVar) parts.push(customVar);

  const variantText = parts.length > 0 ? parts.join(" · ") : "";

  return {
    productName,
    pu,
    qte,
    lineTotal,
    variantText
  };
}

const STATUT_LABELS = {
  en_attente_paiement: "PAIEMENT EN ATTENTE",
  en_attente: "EN ATTENTE DE CONFIRMATION",
  validee: "COMMANDE CONFIRMÉE",
  en_preparation: "EN COURS DE PRÉPARATION",
  pret_retrait: "PRÊT À RÉCUPÉRER EN BOUTIQUE",
  en_livraison: "EN COURS DE LIVRAISON",
  recuperee: "RÉCUPÉRÉE / RÉGLÉE",
  livree: "LIVRÉE / RÉGLÉE",
  annulee: "COMMANDE ANNULÉE"
};

const MOYEN_LABELS = {
  cash: "CASH / ESPÈCES",
  especes: "CASH / ESPÈCES",
  mvola: "MVOLA MOBILE MONEY",
  wero: "WERO",
  holam: "WERO",
  carte: "CARTE BANCAIRE",
  wave: "WAVE (UNITECHPAY)",
  orange: "ORANGE MONEY (UNITECHPAY)",
  unitechpay: "MOBILE MONEY",
  whatsapp: "COMMANDE WHATSAPP"
};

export default function ReceiptModal({
  order,
  boutique: boutiqueProp,
  onClose,
  onContinue,
  autoAnimate = true
}) {
  const { user, boutique: boutiqueContext } = useAuth();
  const boutique = boutiqueProp || boutiqueContext;

  const [stage, setStage] = useState(autoAnimate ? "processing" : "complete");
  const timersRef = useRef([]);

  const runAnimation = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setStage("processing");

    const t1 = setTimeout(() => {
      setStage("printing");
    }, 450);

    const t2 = setTimeout(() => {
      setStage("complete");
    }, 2400);

    timersRef.current = [t1, t2];
  };

  useEffect(() => {
    if (autoAnimate) {
      runAnimation();
    } else {
      setStage("complete");
    }
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, [order?.id, autoAnimate]);

  if (!order) return null;

  const storeName = boutique?.nom || "Soilihitech";
  const activeDevise = order.devise || boutique?.devise || "KMF";

  const clientName =
    order.client?.nom || order.clientNom || order.nomClient || user?.nom || "Client comptoir";
  const clientPhone =
    order.client?.telephone || order.clientTelephone || order.telephoneClient || "";

  const isRecharge =
    order.typeVente === "recharge_mobile" ||
    order.notes?.includes("recharge_mobile") ||
    order.items?.some((it) => it.product?.nom?.toLowerCase().includes("recharge"));

  const isPOS =
    !isRecharge &&
    (order.typeVente === "vente_directe" ||
      order.adresseLivraison?.includes("Achat direct") ||
      Boolean(order.montantRecu));

  const isRetrait = !isRecharge && !isPOS && order.modeLivraison === "retrait";

  const typeHeader = isRecharge
    ? "RECHARGE CRÉDIT MOBILE"
    : isPOS
    ? "VENTE DIRECTE EN BOUTIQUE"
    : isRetrait
    ? "COMMANDE EN LIGNE (RETRAIT)"
    : "COMMANDE EN LIGNE (LIVRAISON)";

  const orderNumber =
    order.reference ||
    (order.id ? `#COM-B${String(order.id).padStart(3, "0")}` : "#COM-2026");

  const formattedDate = order.createdAt
    ? new Date(order.createdAt).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : new Date().toLocaleString("fr-FR");

  const totalAmount = Number(order.total || 0);
  const paymentLabel =
    MOYEN_LABELS[order.moyenPaiement] ||
    (order.moyenPaiement ? order.moyenPaiement.toUpperCase() : "PAIEMENT SÉCURISÉ");

  const buildPdfBlob = () => {
    const items = order.items || [];
      const isCash = order.moyenPaiement === "cash" || order.moyenPaiement === "especes";
      const hasChange = isCash && Boolean(order.montantRecu);

      let estimatedItemsH = 0;
      items.forEach((it) => {
        const { productName, variantText } = getArticleDetails(it);
        const nameLen = productName.length;
        const extraLines = Math.max(1, Math.ceil(nameLen / 26));
        const varLines = variantText ? Math.max(1, Math.ceil(variantText.length / 36)) : 0;
        estimatedItemsH += (extraLines * 3.5) + (varLines * 3.2) + 9;
      });

      const dynamicHeight = Math.max(170, 130 + estimatedItemsH + (hasChange ? 15 : 0));

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [80, dynamicHeight]
      });

      let y = 10;
      const centerX = 40;
      const leftX = 6;
      const rightX = 74;

      // 1. Boutique Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(cleanPdfText(storeName).toUpperCase(), centerX, y, { align: "center" });
      y += 5;

      if (boutique?.adresse) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(cleanPdfText(boutique.adresse), centerX, y, { align: "center" });
        y += 3.5;
      }

      if (boutique?.telephone) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Tel : ${boutique.telephone}`, centerX, y, { align: "center" });
        y += 4;
      }

      // 2. Dashed Line
      doc.setDrawColor(203, 213, 225);
      doc.setLineDashPattern([1.2, 1.2], 0);
      doc.line(leftX, y, rightX, y);
      y += 5;

      // 3. Ticket Title & Reference
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(cleanPdfText(typeHeader), centerX, y, { align: "center" });
      y += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`N* ${cleanPdfText(orderNumber)}  ·  ${formattedDate}`, centerX, y, { align: "center" });
      y += 5;

      // 4. Dashed Line
      doc.line(leftX, y, rightX, y);
      y += 4.5;

      // 5. Client & Sale Details
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);

      doc.setFont("helvetica", "bold");
      doc.text("Client :", leftX, y);
      doc.setFont("helvetica", "normal");
      doc.text(cleanPdfText(clientName), leftX + 13, y);
      y += 4;

      if (clientPhone && clientPhone !== "non_renseigne") {
        doc.setFont("helvetica", "bold");
        doc.text("Tel :", leftX, y);
        doc.setFont("helvetica", "normal");
        doc.text(cleanPdfText(clientPhone), leftX + 13, y);
        y += 4;
      }

      if (order.employeAssigne?.nom) {
        doc.setFont("helvetica", "bold");
        doc.text("Caissier :", leftX, y);
        doc.setFont("helvetica", "normal");
        doc.text(cleanPdfText(order.employeAssigne.nom), leftX + 16, y);
        y += 4;
      }

      doc.setFont("helvetica", "bold");
      doc.text("Paiement :", leftX, y);
      doc.setFont("helvetica", "normal");
      doc.text(cleanPdfText(paymentLabel), leftX + 17, y);
      y += 5;

      // 6. Dashed Line
      doc.line(leftX, y, rightX, y);
      y += 4;

      // 7. Table Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text("ARTICLE / DETAILS", leftX, y);
      doc.text("TOTAL", rightX, y, { align: "right" });
      y += 2.5;

      doc.setLineDashPattern([], 0);
      doc.setDrawColor(226, 232, 240);
      doc.line(leftX, y, rightX, y);
      doc.setLineDashPattern([1.2, 1.2], 0);
      doc.setDrawColor(203, 213, 225);
      y += 4;

      // 8. Articles Rows (Full Names & Details, No Truncation)
      if (items.length > 0) {
        items.forEach((it) => {
          const { productName, pu, qte, lineTotal, variantText } = getArticleDetails(it);
          const cleanNom = cleanPdfText(productName);

          // Full article name wrapping across lines without cutting off
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(15, 23, 42);
          const splitName = doc.splitTextToSize(cleanNom, 48);
          doc.text(splitName, leftX, y);

          // Total aligned on the right of the first line
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.text(pdfPrice(lineTotal, activeDevise), rightX, y, { align: "right" });
          y += splitName.length * 3.4;

          // Variant details if present (Full text, wrapped if needed)
          if (variantText) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.8);
            doc.setTextColor(37, 99, 235);
            const splitVar = doc.splitTextToSize(`(${cleanPdfText(variantText)})`, 66);
            doc.text(splitVar, leftX + 1.5, y);
            y += splitVar.length * 3;
          }

          // Quantity x Unit Price subline
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139);
          doc.text(`${qte}  x  ${pdfPrice(pu, activeDevise)}`, leftX + 1.5, y);
          y += 4.5;
        });
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text("Detail des articles enregistre", centerX, y, { align: "center" });
        y += 5;
      }

      // 9. Dashed Line
      doc.line(leftX, y, rightX, y);
      y += 4.5;

      // 10. Totals Breakdown
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);

      if (order.sousTotal && Number(order.sousTotal) !== totalAmount) {
        doc.setFont("helvetica", "normal");
        doc.text("Sous-total :", leftX, y);
        doc.text(pdfPrice(order.sousTotal, activeDevise), rightX, y, { align: "right" });
        y += 4;
      }

      if (order.fraisLivraison !== undefined && order.fraisLivraison !== null) {
        doc.setFont("helvetica", "normal");
        doc.text("Livraison :", leftX, y);
        const feeText =
          Number(order.fraisLivraison) === 0
            ? "Gratuite"
            : pdfPrice(order.fraisLivraison, activeDevise);
        doc.text(feeText, rightX, y, { align: "right" });
        y += 4;
      }

      // TOTAL REGLE HIGHLIGHT BOX
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(leftX, y, rightX - leftX, 7.5, 1, 1, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text("TOTAL REGLE :", leftX + 2.5, y + 5);
      doc.text(pdfPrice(totalAmount, activeDevise), rightX - 2.5, y + 5, { align: "right" });
      y += 11;

      if (hasChange) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text("Montant recu :", leftX + 1, y);
        doc.text(pdfPrice(order.montantRecu, activeDevise), rightX - 1, y, { align: "right" });
        y += 3.8;

        doc.setFont("helvetica", "bold");
        doc.setTextColor(22, 163, 74);
        doc.text("Monnaie rendue :", leftX + 1, y);
        doc.text(pdfPrice(order.monnaieRendue || 0, activeDevise), rightX - 1, y, {
          align: "right"
        });
        y += 5;
      }

      // 11. Dashed Line
      doc.setLineDashPattern([1.2, 1.2], 0);
      doc.line(leftX, y, rightX, y);
      y += 5;

      // 12. Vector Barcode in jsPDF
      const cleanId = orderNumber.replace(/[^a-zA-Z0-9]/g, "");
      drawVectorBarcode(doc, cleanId, centerX, y, 46, 7.5);
      y += 11;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(cleanPdfText(orderNumber), centerX, y, { align: "center" });
      y += 5;

      // 13. Footer
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("Merci de votre confiance !", centerX, y, { align: "center" });
      y += 3.5;
      doc.text(`A tres bientot chez ${cleanPdfText(storeName)}.`, centerX, y, { align: "center" });

      const fileName = `Ticket-${cleanId || "Commande"}.pdf`;
      const blob = doc.output("blob");
      return { doc, blob, fileName, cleanId };
  };

  const handleDownloadPDF = () => {
    try {
      const { doc, blob, fileName } = buildPdfBlob();
      try {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.style.display = "none";
        link.href = blobUrl;
        link.download = fileName;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        }, 1500);
      } catch (saveErr) {
        doc.save(fileName);
      }
      toast.success("Facture PDF telechargee avec succes !");
    } catch (err) {
      console.error("Erreur telechargement PDF ticket:", err);
      toast.error("Erreur lors de la generation du PDF.");
    }
  };

  const handleShare = async () => {
    try {
      const { blob, fileName } = buildPdfBlob();
      const pdfFile = new File([blob], fileName, { type: "application/pdf" });

      const clientGreeting = clientName && clientName !== "Client comptoir" ? ` ${clientName}` : "";
      const shareText = `Bonjour${clientGreeting},\n\nVoici votre facture.`;

      // 1. Partage natif avec piece jointe PDF (iPhone, Android, Safari, Chrome mobile)
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({
            files: [pdfFile],
            title: `Facture ${cleanPdfText(orderNumber)}`,
            text: shareText
          });
          return;
        } catch (shareErr) {
          if (shareErr.name === "AbortError") {
            return;
          }
          console.warn("Partage natif annule ou echoue, bascule vers telechargement + message:", shareErr);
        }
      }

      // 2. Si le partage de fichier natif n'est pas supporte (ex: PC de bureau) : telecharger le fichier et ouvrir WhatsApp
      try {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.style.display = "none";
        link.href = blobUrl;
        link.download = fileName;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        }, 1500);
      } catch (e) {
        // Ignorer
      }

      const cleanPhone = (clientPhone || "").replace(/[^0-9]/g, "");
      const waUrl = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(shareText)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;

      window.open(waUrl, "_blank");
      toast.success("Facture PDF telechargee. Vous pouvez la glisser dans la discussion WhatsApp !");
    } catch (err) {
      console.error("Erreur partage facture PDF:", err);
      toast.error("Erreur lors de la preparation de la facture.");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(10, 15, 29, 0.75)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px 12px",
        overflowY: "auto"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          margin: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        }}
      >
        <ReceiptPrinter.Root
          stage={stage}
          feedMotion="stepped"
          animate={true}
        >
          {/* PRINTER DEVICE */}
          <ReceiptPrinter.Machine>
            {/* Top header on the printer device */}
            <ReceiptPrinter.Header>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, var(--forest), #3D8C5D)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    boxShadow: "0 2px 8px rgba(34, 75, 53, 0.4)"
                  }}
                >
                  <Sparkles size={14} />
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    color: "#E4E4E7",
                    textTransform: "uppercase"
                  }}
                >
                  {storeName}
                </span>
                {order?.isOffline && (
                  <span style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E", padding: "2px 7px", borderRadius: 10, fontWeight: 700, marginLeft: 4 }}>
                    Hors-Ligne
                  </span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  onClick={runAnimation}
                  title="Rejouer l'impression"
                  style={{
                    background: "#27272A",
                    color: "#E4E4E7",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 20,
                    padding: "4px 10px",
                    fontSize: 11.5,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <RotateCcw size={12} /> Rejouer
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "none",
                    borderRadius: "50%",
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#A1A1AA",
                    cursor: "pointer"
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            </ReceiptPrinter.Header>

            {/* OLED SCREEN */}
            <ReceiptPrinter.Screen>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#FFFFFF",
                      letterSpacing: 0.2
                    }}
                  >
                    {isPOS ? "Vente en Caisse" : "Achat en Ligne"}
                  </div>
                  <div style={{ fontSize: 11, color: "#71717A", marginTop: 2 }}>
                    Réf. {orderNumber}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#A1A1AA",
                      textTransform: "uppercase",
                      letterSpacing: 0.5
                    }}
                  >
                    Total
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 900,
                      color: "#4ADE80",
                      letterSpacing: -0.2
                    }}
                  >
                    {fcfa(totalAmount, activeDevise)}
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              <ReceiptPrinter.Status
                statusLabels={{
                  processing: "Traitement de votre commande...",
                  printing: "Impression du ticket de caisse...",
                  complete: "Commande validée avec succès !"
                }}
              />
            </ReceiptPrinter.Screen>
          </ReceiptPrinter.Machine>

          {/* OUTPUT CONTAINER (PAPER ROLLS OUT STEP-BY-STEP) */}
          <ReceiptPrinter.Output maxHeight="32rem">
            <ReceiptPrinter.Paper className="bs-receipt-paper-printable">
              {/* STORE BRANDING */}
              <div
                style={{
                  textAlign: "center",
                  borderBottom: "1px dashed #CBD5E1",
                  paddingBottom: 12,
                  marginBottom: 12
                }}
              >
                {boutique?.logoUrl && (
                  <img
                    src={boutique.logoUrl}
                    alt={storeName}
                    style={{
                      maxHeight: 36,
                      maxWidth: 120,
                      objectFit: "contain",
                      margin: "0 auto 6px",
                      display: "block"
                    }}
                  />
                )}
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    letterSpacing: 1.5,
                    color: "#0F172A",
                    textTransform: "uppercase"
                  }}
                >
                  {storeName}
                </div>
                {boutique?.adresse && (
                  <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>
                    {boutique.adresse}
                  </div>
                )}
                {boutique?.telephone && (
                  <div style={{ fontSize: 10, color: "#64748B", marginTop: 1 }}>
                    Tél : {boutique.telephone}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: "#0F172A",
                    marginTop: 6,
                    letterSpacing: 0.8
                  }}
                >
                  {typeHeader}
                </div>
                <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>
                  N° {orderNumber} · {formattedDate}
                </div>
              </div>

              {/* CLIENT INFO */}
              <div
                style={{
                  fontSize: 10.5,
                  color: "#334155",
                  marginBottom: 10,
                  lineHeight: 1.5
                }}
              >
                <div>
                  <strong>Client :</strong> {clientName}
                </div>
                {clientPhone && clientPhone !== "non_renseigne" && (
                  <div>
                    <strong>Tél :</strong> {clientPhone}
                  </div>
                )}
                {order.employeAssigne?.nom && (
                  <div>
                    <strong>Caissier :</strong> {order.employeAssigne.nom}
                  </div>
                )}
                <div>
                  <strong>Paiement :</strong> {paymentLabel}
                </div>
              </div>

              {/* ITEMS TABLE */}
              <div
                style={{
                  borderTop: "1px dashed #CBD5E1",
                  borderBottom: "1px dashed #CBD5E1",
                  padding: "8px 0",
                  marginBottom: 10
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 9.5,
                    fontWeight: 900,
                    color: "#0F172A",
                    borderBottom: "1px solid #E2E8F0",
                    paddingBottom: 4,
                    marginBottom: 8,
                    letterSpacing: 0.5
                  }}
                >
                  <span>ARTICLE / DÉTAILS</span>
                  <span>TOTAL</span>
                </div>

                {order.items && order.items.length > 0 ? (
                  order.items.map((it, idx) => {
                    const { productName, pu, qte, lineTotal, variantText } = getArticleDetails(it);

                    return (
                      <div
                        key={idx}
                        style={{
                          marginBottom: 8,
                          paddingBottom: 6,
                          borderBottom:
                            idx < order.items.length - 1 ? "1px dotted #E2E8F0" : "none"
                        }}
                      >
                        {/* Article full name & total */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: 10
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: 11,
                              color: "#0F172A",
                              lineHeight: 1.35,
                              wordBreak: "break-word",
                              flex: 1
                            }}
                          >
                            {productName}
                          </span>
                          <span
                            style={{
                              textAlign: "right",
                              fontWeight: 900,
                              fontSize: 11.5,
                              color: "#0F172A",
                              whiteSpace: "nowrap"
                            }}
                          >
                            {fcfa(lineTotal, activeDevise)}
                          </span>
                        </div>

                        {/* Variant details (model, color, etc.) */}
                        {variantText && (
                          <div
                            style={{
                              fontSize: 10,
                              color: "#2563EB",
                              fontWeight: 700,
                              marginTop: 2,
                              wordBreak: "break-word"
                            }}
                          >
                            ({variantText})
                          </div>
                        )}

                        {/* Qty x Price */}
                        <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>
                          {qte} × {fcfa(pu, activeDevise)}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ fontSize: 10, color: "#64748B", textAlign: "center" }}>
                    Détail des articles enregistré
                  </div>
                )}
              </div>

              {/* TOTALS & BREAKDOWN */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  fontSize: 10.5,
                  color: "#1E293B",
                  marginBottom: 12
                }}
              >
                {order.sousTotal && Number(order.sousTotal) !== totalAmount && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748B" }}>Sous-total :</span>
                    <span>{fcfa(order.sousTotal, activeDevise)}</span>
                  </div>
                )}

                {order.fraisLivraison !== undefined && order.fraisLivraison !== null && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748B" }}>Livraison :</span>
                    <span style={{ fontWeight: 600 }}>
                      {Number(order.fraisLivraison) === 0
                        ? "Gratuite"
                        : fcfa(order.fraisLivraison, activeDevise)}
                    </span>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 14,
                    fontWeight: 900,
                    color: "#0F172A",
                    paddingTop: 4,
                    marginTop: 2,
                    borderTop: "1px solid #E2E8F0"
                  }}
                >
                  <span>TOTAL RÉGLÉ :</span>
                  <span>{fcfa(totalAmount, activeDevise)}</span>
                </div>

                {order.montantRecu && (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 10.5,
                        color: "#475569",
                        marginTop: 3
                      }}
                    >
                      <span>Montant reçu :</span>
                      <span>{fcfa(order.montantRecu, activeDevise)}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11.5,
                        fontWeight: 800,
                        color: "#16A34A"
                      }}
                    >
                      <span>Monnaie rendue :</span>
                      <span>{fcfa(order.monnaieRendue || 0, activeDevise)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* AUTHENTIC BARCODE */}
              <div
                style={{
                  borderTop: "1px dashed #CBD5E1",
                  paddingTop: 10,
                  marginBottom: 10,
                  textAlign: "center"
                }}
              >
                <BarcodeSvg value={orderNumber.replace("#", "")} height={36} />
              </div>

              {/* FOOTER MESSAGE */}
              <div
                style={{
                  textAlign: "center",
                  fontSize: 9.5,
                  color: "#64748B",
                  lineHeight: 1.4
                }}
              >
                Merci de votre confiance !<br />
                À très bientôt chez {storeName}.
              </div>
            </ReceiptPrinter.Paper>
          </ReceiptPrinter.Output>
        </ReceiptPrinter.Root>

        {/* BOTTOM ACTION BUTTONS */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: "100%",
            maxWidth: 380,
            marginTop: 14,
            padding: "0 6px"
          }}
        >
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <button
              type="button"
              onClick={handleDownloadPDF}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 12,
                background: "var(--forest)",
                color: "#fff",
                border: "none",
                fontWeight: 800,
                fontSize: 12.5,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                boxShadow: "0 4px 12px rgba(31, 77, 58, 0.35)",
                transition: "transform 0.15s ease"
              }}
            >
              <Download size={15} /> Télécharger PDF
            </button>

            <button
              type="button"
              onClick={handleShare}
              title="Partager la facture directement sur WhatsApp"
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 12,
                background: "#25D366",
                color: "#fff",
                border: "none",
                fontWeight: 800,
                fontSize: 12.5,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                boxShadow: "0 4px 12px rgba(37, 211, 102, 0.35)",
                transition: "transform 0.15s ease"
              }}
            >
              <MessageCircle size={15} /> Partager Facture
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <button
              type="button"
              onClick={onContinue || onClose}
              style={{
                flex: 1,
                padding: "9px 14px",
                borderRadius: 12,
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                color: "#1E293B",
                fontWeight: 800,
                fontSize: 12.5,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)"
              }}
            >
              {onContinue ? "Continuer" : "Fermer"}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              title="Imprimer sur imprimante physique"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "#F1F5F9",
                border: "1px solid #CBD5E1",
                color: "#475569",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0
              }}
            >
              <Printer size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
