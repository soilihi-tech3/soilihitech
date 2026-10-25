import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Phone, Mail, Store, Facebook, Instagram, MessageCircle, Info, Package, Grid, Home as HomeIcon, Clock, ShieldCheck, Truck, CheckCircle, Headphones, FileText } from "lucide-react";
import api, { SLUG } from "../api";

import { useAuth } from "../context/AuthContext.jsx";
import { MvolaLogo, WeroLogo, VisaLogo, MastercardLogo, PaypalLogo, VirementLogo, CashLogo } from "./PaymentLogos";

export default function Footer() {
  const { boutique: boutiqueContext } = useAuth();
  const [boutiqueLocal, setBoutiqueLocal] = useState(null);
  const [categories, setCategories] = useState([]);

  const boutique = boutiqueContext || boutiqueLocal;

  useEffect(() => {
    if (!boutiqueContext) {
      api.get(`/store/${SLUG}`).then(res => setBoutiqueLocal(res.data)).catch(() => { });
    }
    api.get(`/store/${SLUG}/categories`).then(res => setCategories(res.data || [])).catch(() => { });
  }, [boutiqueContext]);

  const rawWaNum = boutique?.whatsappNumber || boutique?.telephone || "";
  const cleanWaNum = rawWaNum.replace(/[^0-9]/g, "");
  const whatsappUrl = cleanWaNum ? `https://wa.me/${cleanWaNum}?text=${encodeURIComponent("Bonjour ! Je souhaite avoir des informations sur vos produits.")}` : null;
  const facebookUrl = boutique?.facebookUrl || "https://facebook.com";
  const instagramUrl = boutique?.instagramUrl || "https://instagram.com";
  const tiktokUrl = boutique?.tiktokUrl || "https://tiktok.com";
  const horaires = boutique?.horairesOuverture || "Tous les jours de 08h30 à 23h00";

  return (
    <>
      {/* ── BANNIÈRE DE CONFIANCE HORIZONTALE SUR LE FOND DU SITE (OUTSIDE FOOTER) ── */}
      <div style={{
        background: "var(--paper)",
        borderTop: "1px solid var(--line)",
        padding: "20px 24px"
      }}>
        <div style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12
        }}>
          {/* CARTE 1: PAIEMENT SÉCURISÉ */}
          <div style={{
            background: "var(--card)",
            borderRadius: 14,
            padding: "14px 14px",
            textAlign: "center",
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "#E8F0FE", color: "#1A73E8",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 8
            }}>
              <ShieldCheck size={20} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--ink)", marginBottom: 2 }}>
              Paiement sécurisé
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.35 }}>
              Paiement à la livraison ou en ligne avec reçu
            </div>
          </div>

          {/* CARTE 2: COMMANDE SUIVIE */}
          <div style={{
            background: "var(--card)",
            borderRadius: 14,
            padding: "14px 14px",
            textAlign: "center",
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "#EBF7F0", color: "var(--forest)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 8
            }}>
              <Truck size={20} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--ink)", marginBottom: 2 }}>
              Commande suivie
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.35 }}>
              Suivi et notification à chaque étape
            </div>
          </div>

          {/* CARTE 3: PRODUITS VÉRIFIÉS AUTHENTIQUES */}
          <div style={{
            background: "var(--card)",
            borderRadius: 14,
            padding: "14px 14px",
            textAlign: "center",
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "#FFF4EB", color: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 8
            }}>
              <CheckCircle size={20} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--ink)", marginBottom: 2 }}>
              100% Authentique
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.35 }}>
              Produits certifiés et rigoureusement contrôlés
            </div>
          </div>

          {/* CARTE 4: SUPPORT 24H / 7J */}
          <div style={{
            background: "var(--card)",
            borderRadius: 14,
            padding: "14px 14px",
            textAlign: "center",
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "#F3E8FF", color: "#7E22CE",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 8
            }}>
              <Headphones size={20} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--ink)", marginBottom: 2 }}>
              Support 7j / 7
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.35 }}>
              Service client à votre écoute pour vous assister
            </div>
          </div>
        </div>
      </div>

      <footer style={{ background: "var(--forest-dark)", color: "#F0F3EC", padding: "28px 24px 16px", marginTop: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, marginBottom: 20 }}>

          {/* COLONNE 1: À PROPOS & LOGO (SLIM) */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              {boutique?.logoUrl ? (
                <img src={boutique.logoUrl} alt={boutique.nom} style={{ height: 34, borderRadius: 6, objectFit: "contain", background: "#fff", padding: 2 }} />
              ) : (
                <Store size={22} color="#A8BEB1" />
              )}
              <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{boutique?.nom || ""}</span>
            </div>
            <p style={{
              color: "#A8BEB1",
              lineHeight: 1.5,
              fontSize: 12.5,
              margin: 0,
              maxWidth: 320,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden"
            }}>
              {boutique?.aProposText || "Soilihitech — Votre référence pour les accessoires téléphoniques : chargeurs rapides GaN, câbles renforcés, glaces trempées 9D, coques antichoc et audio haute fidélité."}
            </p>
          </div>

          {/* COLONNE 2: NAVIGATION */}
          <div>
            <h4 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12, color: "#fff", fontWeight: 800 }}>Navigation</h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <li><Link to="/" style={{ color: "#A8BEB1", textDecoration: "none", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}><HomeIcon size={14} /> Accueil</Link></li>
              <li><Link to="/catalogue" style={{ color: "#A8BEB1", textDecoration: "none", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}><Grid size={14} /> Tous nos produits</Link></li>
              <li><Link to="/demande-sur-mesure" style={{ color: "#A8BEB1", textDecoration: "none", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}><FileText size={14} /> Demande sur-mesure</Link></li>
              <li><Link to="/mes-commandes" style={{ color: "#A8BEB1", textDecoration: "none", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}><Package size={14} /> Suivi de mes commandes</Link></li>
            </ul>
          </div>

          {/* COLONNE 3: NOS BOUTIQUES & HORAIRES */}
          <div>
            <h4 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12, color: "#fff", fontWeight: 800 }}>Boutiques & Horaires</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "#A8BEB1", fontSize: 12.5 }}>
                <Clock size={16} style={{ color: "#A7F3D0", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontWeight: 700, color: "#fff", fontSize: 12 }}>Horaires d'ouverture :</div>
                  <div>{horaires}</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "#A8BEB1", fontSize: 12.5 }}>
                <MapPin size={16} style={{ color: "#A7F3D0", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontWeight: 700, color: "#fff", fontSize: 12 }}>Adresse principale :</div>
                  <div>{boutique?.adresse || "Adresse non renseignée"}</div>
                </div>
              </div>

              {boutique?.adresse2 && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "#A8BEB1", fontSize: 12.5 }}>
                  <MapPin size={16} style={{ color: "#A7F3D0", flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: "#fff", fontSize: 12 }}>Seconde adresse :</div>
                    <div>{boutique.adresse2}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* COLONNE 4: NOUS CONTACTER & RÉSEAUX SOCIAUX */}
          <div>
            <h4 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12, color: "#fff", fontWeight: 800 }}>Nous Contacter</h4>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px 0", display: "flex", flexDirection: "column", gap: 8 }}>
              <li style={{ display: "flex", alignItems: "center", gap: 8, color: "#A8BEB1", fontSize: 12.5 }}>
                <Phone size={15} style={{ color: "#A7F3D0", flexShrink: 0 }} />
                <div>
                  <span style={{ fontWeight: 700, color: "#fff" }}>Tél : {boutique?.telephone || "+33 1 23 45 67 89"}</span>
                  {boutique?.telephone2 && (
                    <span style={{ fontWeight: 700, color: "#fff", marginLeft: 8 }}>| {boutique.telephone2}</span>
                  )}
                </div>
              </li>
              {boutique?.emailContact && (
                <li style={{ display: "flex", alignItems: "center", gap: 8, color: "#A8BEB1", fontSize: 12.5 }}>
                  <Mail size={15} style={{ color: "#A7F3D0", flexShrink: 0 }} />
                  <span>{boutique.emailContact}</span>
                </li>
              )}
            </ul>

            {/* ICÔNES DE RÉSEAUX SOCIAUX DÉPLACÉES ICI */}
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, color: "#A8BEB1", fontWeight: 700, marginBottom: 8 }}>
                Suivez-nous :
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Facebook"
                  style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", transition: "all 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#1877F2"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                >
                  <Facebook size={16} />
                </a>
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Instagram"
                  style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", transition: "all 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#E4405F"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                >
                  <Instagram size={16} />
                </a>
                <a
                  href={tiktokUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="TikTok"
                  style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", transition: "all 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#000000"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 1 1-5.2-1.74 2.89 2.89 0 0 1 2.31-1.42V8.9a6.34 6.34 0 0 0-5.46 6.31 6.34 6.34 0 1 0 11.8-3.41V9.5a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.0-0.93z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* MOYENS DE PAIEMENT ACCEPTÉS (SLIM) */}
        <div style={{ maxWidth: 1280, margin: "0 auto 14px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.8, color: "#7B9686", fontWeight: 800 }}>
              Paiement 100% Sécurisé & Modes de règlement acceptés :
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {/* MVola */}
              <div style={{ background: "#fff", padding: "3px 8px", borderRadius: 6, display: "flex", alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <MvolaLogo height={20} />
              </div>

              {/* WERO */}
              <div style={{ background: "#fff", padding: "3px 6px", borderRadius: 6, display: "flex", alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <WeroLogo height={20} />
              </div>

              {/* Cartes / Paypal / Virement */}
              <div style={{ background: "#fff", padding: "3px 6px", borderRadius: 6, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <VisaLogo height={16} />
                <MastercardLogo height={16} />
                <VirementLogo height={16} />
                <PaypalLogo height={16} />
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div style={{ maxWidth: 1280, margin: "0 auto", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", color: "#7B9686", fontSize: 12, gap: 10 }}>
          <div>© 2026 {boutique?.nom || "Marché Vert"}. Tous droits réservés.</div>
          <div style={{ display: "flex", gap: 16 }}>
            <span>Qualité & Authenticité Garanties</span>
          </div>
        </div>
      </footer>

      {/* ── BOUTON FLOTTANT WHATSAPP STYLE ASSISTANT IA QUI GLISSE ── */}
      {whatsappUrl && (
        <aside
          aria-label="Assistant WhatsApp"
          className="bs-wa-float-widget"
        >
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="bs-wa-pill-link"
            title="Discutez en direct avec nous sur WhatsApp"
          >
            <span className="bs-wa-status-dot"></span>
            <span className="bs-wa-label">
              <strong>Besoin d'aide ?</strong> Écrivez-nous
            </span>
            <div className="bs-wa-avatar-btn">
              <MessageCircle size={21} fill="#ffffff" color="#25D366" />
              <span className="bs-wa-pulse-ring"></span>
            </div>
          </a>
        </aside>
      )}
    </>
  );
}
