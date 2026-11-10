import React from "react";

// 1. MVola Logo (Vivid Green MVola logo matching brand)
export function MvolaLogo({ height = 28, style = {} }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, ...style }}>
      <svg height={height} viewBox="0 0 160 55" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Signal arcs above 'M' */}
        <path d="M 32 14 A 8 8 0 0 1 48 14" stroke="#00C853" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M 27 9 A 14 14 0 0 1 53 9" stroke="#00C853" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="40" cy="18" r="2.5" fill="#00C853" />
        {/* MVola Text */}
        <text x="2" y="48" fill="#00C853" fontFamily="Outfit, Inter, sans-serif" fontWeight="900" fontSize="42" letterSpacing="-1">
          MVola
        </text>
      </svg>
    </div>
  );
}

// 2. WERO Logo (Yellow background badge with WERO dark text)
export function WeroLogo({ height = 26, style = {} }) {
  return (
    <div style={{
      background: "#FFF899", border: "1px solid #FFE866", borderRadius: 8,
      padding: "3px 12px", display: "inline-flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)", height, ...style
    }}>
      <span style={{
        fontFamily: "'Outfit', 'Arial Black', sans-serif",
        fontWeight: 900,
        fontSize: Math.round(height * 0.75),
        color: "#1E1E1E",
        letterSpacing: "1px",
        lineHeight: 1
      }}>
        W<span style={{ fontStyle: "italic", opacity: 0.85 }}>e</span>RO
      </span>
    </div>
  );
}

// Alias for backward compatibility
export const HoloLogo = WeroLogo;

// 3. VISA Logo Badge
export function VisaLogo({ height = 20 }) {
  return (
    <div style={{
      background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 6,
      padding: "3px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)", height
    }}>
      <span style={{
        fontFamily: "Impact, sans-serif", fontWeight: 900, fontSize: height * 0.8,
        color: "#1A1F71", fontStyle: "italic", letterSpacing: "-0.5px"
      }}>
        VISA
      </span>
    </div>
  );
}

// 4. MasterCard Logo Badge
export function MastercardLogo({ height = 20 }) {
  return (
    <div style={{
      background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 6,
      padding: "3px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)", height
    }}>
      <svg height={height * 0.85} viewBox="0 0 36 24" fill="none">
        <circle cx="13" cy="12" r="10" fill="#EB001B" />
        <circle cx="23" cy="12" r="10" fill="#F79E1B" fillOpacity="0.9" />
      </svg>
    </div>
  );
}

// 5. PayPal Logo Badge
export function PaypalLogo({ height = 20 }) {
  return (
    <div style={{
      background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 6,
      padding: "3px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)", height
    }}>
      <span style={{
        fontFamily: "Impact, sans-serif", fontWeight: 900, fontSize: height * 0.75,
        color: "#003087", fontStyle: "italic"
      }}>
        Pay<span style={{ color: "#0079C1" }}>Pal</span>
      </span>
    </div>
  );
}

// 6. Virement Bancaire Badge
export function VirementLogo({ height = 20 }) {
  return (
    <div style={{
      background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 6,
      padding: "2px 8px", display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)", height
    }}>
      <span style={{ fontFamily: "sans-serif", fontWeight: 800, fontSize: Math.max(7, height * 0.38), color: "#D97706", lineHeight: 1 }}>
        Virement
      </span>
      <span style={{ fontFamily: "sans-serif", fontWeight: 800, fontSize: Math.max(7, height * 0.38), color: "#0F172A", lineHeight: 1 }}>
        Bancaire
      </span>
    </div>
  );
}

// 7. Cash Logo (Hand holding green Euro banknote)
export function CashLogo({ height = 30, style = {} }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, ...style }}>
      <svg height={height} viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Back banknote */}
        <polygon points="30,5 92,18 78,55 16,42" fill="#2D7A3A" />
        {/* Front banknote main body */}
        <polygon points="22,12 84,25 70,62 8,49" fill="#5BB450" stroke="#1F4D25" strokeWidth="3" />
        {/* Center circle for euro symbol */}
        <circle cx="46" cy="37" r="14" fill="#2E6B34" />
        <text x="40" y="44" fill="#FFFFFF" fontFamily="sans-serif" fontWeight="900" fontSize="18">€</text>
        {/* Corner details on bill */}
        <circle cx="28" cy="22" r="3" fill="#8CE082" />
        <circle cx="64" cy="52" r="3" fill="#8CE082" />
        
        {/* Hand holding cash */}
        <path d="M 5,45 L 24,45 L 24,80 L 5,80 Z" fill="#3D3D3D" stroke="#252525" strokeWidth="4" />
        <path d="M 24,50 Q 55,50 68,57 C 72,59 70,66 65,68 Q 52,66 52,74 C 70,72 98,58 95,72 C 92,86 52,90 24,80 Z" 
              fill="#DDA16E" stroke="#252525" strokeWidth="4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// 8. Combined Payment Badges (VISA + Mastercard + Virement + Paypal)
export function OnlinePaymentBadges({ style = {} }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", ...style }}>
      <VisaLogo height={22} />
      <MastercardLogo height={22} />
      <VirementLogo height={22} />
      <PaypalLogo height={22} />
    </div>
  );
}

// 9. Orange Money Logo
export function OrangeMoneyLogo({ height = 26, style = {} }) {
  return (
    <img
      src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSkuwenMWEMEqLrjTBw59HU3cAqXn5JcznidoH8agbSKg&s=10"
      alt="Orange Money"
      style={{ height, width: height, objectFit: "contain", borderRadius: "50%", background: "#fff", ...style }}
    />
  );
}

// 10. Wave Logo
export function WaveLogo({ height = 26, style = {} }) {
  return (
    <img
      src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ2HroqloJ8NxLB2bTo1KCfBFIqqlRUfjS7lor42fv8dw&s=10"
      alt="Wave"
      style={{ height, width: height, objectFit: "contain", borderRadius: "50%", background: "#fff", ...style }}
    />
  );
}
