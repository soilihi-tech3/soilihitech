import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Store, ShieldCheck, Truck, Sparkles, Phone, MapPin, Mail, ArrowRight, Award, Check, Package, Shield, HeartHandshake } from "lucide-react";
import api, { SLUG } from "../../api";

function CountUp({ end, duration = 2000 }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime = null;
    let animationFrameId = null;

    const animate = (time) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4); // easeOutQuart
      setCount(Math.floor(ease * end));
      
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };
    
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [end, duration]);

  return <>{count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}</>;
}

export default function About() {
  const [boutique, setBoutique] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    api.get(`/store/${SLUG}`).then(res => setBoutique(res.data)).catch(() => {});
  }, []);

  // Détection dynamique de l'image de bannière hero depuis les données de la boutique
  const dynamicHeroBanner = (() => {
    if (boutique?.aProposBannerUrl) return boutique.aProposBannerUrl;
    if (boutique?.bannerSlides) {
      let slides = boutique.bannerSlides;
      if (typeof slides === "string") {
        try { slides = JSON.parse(slides); } catch (e) { slides = []; }
      }
      if (Array.isArray(slides) && slides.length > 0 && slides[0]?.imageUrl) {
        return slides[0].imageUrl;
      }
    }
    return "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1600&q=80";
  })();

  // Image dynamique de présentation
  const dynamicAboutImage = (() => {
    if (boutique?.aProposImageUrl) return boutique.aProposImageUrl;
    if (boutique?.bannerSlides) {
      let slides = boutique.bannerSlides;
      if (typeof slides === "string") {
        try { slides = JSON.parse(slides); } catch (e) { slides = []; }
      }
      if (Array.isArray(slides) && slides.length > 1 && slides[1]?.imageUrl) {
        return slides[1].imageUrl;
      }
    }
    return boutique?.logoUrl || "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80";
  })();

  return (
    <div style={{ paddingBottom: 60 }}>
      <style>{`
        .modern-service-card {
          background: var(--card, #fff);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.05);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          border: 1px solid var(--line);
        }
        .modern-service-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.08);
        }
        .services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          margin-bottom: 40px;
        }
      `}</style>

      {/* BANNIÈRE HÉRO À PROPOS DYNAMIQUE */}
      <div className="bs-about-hero" style={{
        position: "relative",
        borderRadius: 20,
        overflow: "hidden",
        minHeight: 240,
        margin: "16px 0 32px",
        backgroundImage: `url('${dynamicHeroBanner}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        textAlign: "center",
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        padding: "36px 16px"
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(15,23,42,0.75), rgba(15,23,42,0.9))" }}></div>
        <div style={{ position: "relative", zIndex: 2, maxWidth: 720 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.15)", backdropFilter: "blur(6px)",
            padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12
          }}>
            <Sparkles size={15} color="#F472B6" /> Notre Histoire & Engagement
          </div>
          <h1 style={{ fontSize: "clamp(24px, 5vw, 36px)", fontWeight: 900, margin: 0, letterSpacing: "-0.5px" }}>
            À propos de {boutique?.nom || "Soilihitech"}
          </h1>
          <p style={{ fontSize: "clamp(13.5px, 3.5vw, 16px)", marginTop: 10, opacity: 0.95, lineHeight: 1.6 }}>
            Votre référence exclusive en accessoires téléphoniques : chargeurs rapides GaN, glaces 9D, coques antichoc, câbles et écouteurs sans fil.
          </p>
        </div>
      </div>

      {/* BLOC PRÉSENTATION ET VALEURS */}
      <div className="bs-about-grid" style={{ marginBottom: 40 }}>
        <div>
          <h2 style={{ fontSize: "clamp(20px, 4vw, 26px)", fontWeight: 800, color: "var(--forest-dark)", marginBottom: 14 }}>
            Qui sommes-nous ?
          </h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.75, color: "var(--ink)", marginBottom: 20 }}>
            {boutique?.aProposText || 
              "Bienvenue chez Soilihitech. Nous sélectionnons avec exigence le meilleur des accessoires pour vos smartphones : blocs de charge rapide de 20W à 65W GaN, câbles certifiés Type-C et Lightning, protections écran 9D et antiespion, pochettes silicone et écouteurs sans fil haute performance. Tous nos articles sont testés, garantis neufs et compatibles avec les marques leaders : Apple, Samsung, Tecno, Infinix, Xiaomi, Oraimo et Anker."
            }
          </p>
          
          <div style={{ marginTop: 30, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Card 1 */}
            <div className="modern-service-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--forest-dark)", fontWeight: 800, marginBottom: 8, fontSize: 15 }}>
                <ShieldCheck size={20} color="var(--forest)" /> 100% Authentique & Testé
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                Tous nos accessoires électroniques sont testés avant expédition pour garantir sécurité et longévité.
              </p>
            </div>

            {/* Card 2 */}
            <div className="modern-service-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--forest-dark)", fontWeight: 800, marginBottom: 8, fontSize: 15 }}>
                <Truck size={20} color="var(--forest)" /> Livraison Express
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                Livraison soignée et rapide directement chez vous ou en point relais.
              </p>
            </div>

            {/* Card 3 */}
            <div className="modern-service-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--forest-dark)", fontWeight: 800, marginBottom: 8, fontSize: 15 }}>
                <Package size={20} color="var(--accent)" /> Suivi & Conseil WhatsApp
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                Assistance directe pour trouver la compatibilité exacte de votre téléphone.
              </p>
            </div>

            {/* Card 4 */}
            <div className="modern-service-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--forest-dark)", fontWeight: 800, marginBottom: 8, fontSize: 15 }}>
                <Shield size={20} color="#0284C7" /> Protection Renforcée
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                Glaces et coques anti-chocs conçues pour protéger votre écran contre les chutes sévères.
              </p>
            </div>
          </div>

          {/* STATS SECTION */}
          <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 16 }}>
            <div className="modern-service-card" style={{ padding: "16px 10px", alignItems: "center", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "var(--forest)", marginBottom: 4 }}><CountUp end={6759} />+</div>
              <div style={{ fontSize: 12, color: "var(--forest-dark)", fontWeight: 700, lineHeight: 1.3 }}>Clients<br/>Satisfaits</div>
            </div>
            <div className="modern-service-card" style={{ padding: "16px 10px", alignItems: "center", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "var(--accent)", marginBottom: 4 }}><CountUp end={35009} />+</div>
              <div style={{ fontSize: 12, color: "var(--forest-dark)", fontWeight: 700, lineHeight: 1.3 }}>Avis Positifs<br/>Vérifiés</div>
            </div>
            <div className="modern-service-card" style={{ padding: "16px 10px", alignItems: "center", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0284C7", marginBottom: 4 }}><CountUp end={47995} />+</div>
              <div style={{ fontSize: 12, color: "var(--forest-dark)", fontWeight: 700, lineHeight: 1.3 }}>Accessoires<br/>Livrés</div>
            </div>
            <div className="modern-service-card" style={{ padding: "16px 10px", alignItems: "center", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#2563EB", marginBottom: 4 }}><CountUp end={67595} />+</div>
              <div style={{ fontSize: 12, color: "var(--forest-dark)", fontWeight: 700, lineHeight: 1.3 }}>Recharges &<br/>Glaces Expédiées</div>
            </div>
          </div>
        </div>

        {/* IMAGE DYNAMIQUE DE PRÉSENTATION */}
        <div style={{ position: "relative", marginTop: 12, display: "flex", justifyContent: "center" }}>
          <img 
            src={dynamicAboutImage} 
            alt="À propos" 
            onClick={() => setIsZoomed(true)}
            style={{ 
              width: "100%", 
              maxWidth: 420,
              height: 360, 
              objectFit: "cover", 
              borderRadius: 18, 
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              cursor: "zoom-in" 
            }}
          />
          <div style={{
            position: "absolute", bottom: -14, left: 14, right: 14,
            background: "#fff", padding: "12px 16px", borderRadius: 14,
            boxShadow: "0 6px 20px rgba(0,0,0,0.1)", border: "1px solid var(--line)",
            display: "flex", alignItems: "center", gap: 12,
            maxWidth: 392,
            margin: "0 auto"
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--forest-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Award size={20} color="var(--forest-dark)" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--forest-dark)" }}>Grandes Marques Officielles</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Apple, Samsung, Tecno, Anker, Baseus...</div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION ADRESSES & CONTACTS */}
      <div style={{ background: "var(--paper)", padding: "24px 16px", borderRadius: 18, border: "1px solid var(--line)", marginTop: 24 }}>
        <h3 style={{ fontSize: "clamp(18px, 4vw, 22px)", fontWeight: 800, color: "var(--forest-dark)", marginTop: 0, marginBottom: 20, textAlign: "center" }}>
          Nos Coordonnées & Boutiques
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {/* NOS BOUTIQUES */}
          <div style={{ background: "#fff", padding: 18, borderRadius: 14, border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--forest)", fontWeight: 800, fontSize: 14.5, marginBottom: 10 }}>
              <MapPin size={18} /> Nos Adresses & Boutiques
            </div>
            <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <MapPin size={14} color="var(--forest)" style={{ flexShrink: 0 }} /> {boutique?.adresse || "Moroni Centre, Grande Comore"}
            </div>
            {boutique?.adresse2 && (
              <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600, marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <MapPin size={14} color="var(--forest)" style={{ flexShrink: 0 }} /> {boutique.adresse2}
              </div>
            )}
          </div>

          {/* NOUS CONTACTER */}
          <div style={{ background: "#fff", padding: 18, borderRadius: 14, border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--forest)", fontWeight: 800, fontSize: 14.5, marginBottom: 10 }}>
              <Phone size={18} /> Téléphones & Assistance WhatsApp
            </div>
            <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>
              {boutique?.telephone || "+269 332 00 00"}
            </div>
            {boutique?.telephone2 && (
              <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600, marginTop: 6 }}>
                {boutique.telephone2}
              </div>
            )}
          </div>

          {/* HORAIRES */}
          <div style={{ background: "#fff", padding: 18, borderRadius: 14, border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--forest)", fontWeight: 800, fontSize: 14.5, marginBottom: 10 }}>
              <Store size={18} /> Service Client & Horaires
            </div>
            <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>
              {boutique?.horaires || "Du Lundi au Samedi : 08h00 - 19h00"}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
              Commandes en ligne 24h/24, 7j/7
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
