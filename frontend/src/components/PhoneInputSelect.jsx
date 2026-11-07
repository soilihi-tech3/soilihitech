import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";
import { COUNTRIES } from "../utils/countries";

export default function PhoneInputSelect({ value, onChange, defaultCountryCode = "KM", placeholder = "330 00 00" }) {
  const [selectedCountry, setSelectedCountry] = useState(() => {
    // Si la valeur actuelle commence par une clé connue, la détecter
    if (value && value.startsWith("+")) {
      const match = COUNTRIES.find((c) => value.startsWith(c.dialCode));
      if (match) return match;
    }
    return COUNTRIES.find((c) => c.code === defaultCountryCode) || COUNTRIES[0];
  });

  const [phoneNumber, setPhoneNumber] = useState(() => {
    if (!value) return "";
    if (value.startsWith("+")) {
      const match = COUNTRIES.find((c) => value.startsWith(c.dialCode));
      if (match) {
        return value.replace(match.dialCode, "").trim();
      }
    }
    return value;
  });

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  // Synchroniser avec les changements de props externes
  useEffect(() => {
    if (!value) {
      setPhoneNumber("");
      return;
    }
    if (value.startsWith("+")) {
      const match = COUNTRIES.find((c) => value.startsWith(c.dialCode));
      if (match) {
        setSelectedCountry(match);
        setPhoneNumber(value.replace(match.dialCode, "").trim());
      } else {
        setPhoneNumber(value);
      }
    } else {
      setPhoneNumber(value);
    }
  }, [value]);

  // Fermer le dropdown si on clique en dehors
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleCountrySelect(country) {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearch("");
    const cleanNum = phoneNumber.trim().replace(/^0+/, "");
    const full = cleanNum ? `${country.dialCode} ${cleanNum}` : "";
    onChange(full);
  }

  function handleNumberChange(e) {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setPhoneNumber(raw);
    const cleanNum = raw.trim().replace(/^0+/, "");
    const full = cleanNum ? `${selectedCountry.dialCode} ${cleanNum}` : "";
    onChange(full);
  }

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dialCode.includes(search) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: "flex", gap: 6, width: "100%", position: "relative" }} ref={dropdownRef}>
      {/* Bouton Sélecteur de pays avec drapeau et indicatif */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 12px",
          background: "var(--paper)",
          border: "1.5px solid var(--line)",
          borderRadius: "var(--radius-md)",
          fontSize: 14,
          fontWeight: 700,
          color: "var(--ink)",
          cursor: "pointer",
          whiteSpace: "nowrap",
          minWidth: 105,
          justifyContent: "space-between"
        }}
      >
        <span>
          {selectedCountry.flag} {selectedCountry.dialCode}
        </span>
        <ChevronDown size={14} color="var(--muted)" />
      </button>

      {/* Menu déroulant de recherche des pays */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 9999,
            width: 280,
            maxHeight: 260,
            background: "#ffffff",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column"
          }}
        >
          {/* Bar de recherche du pays */}
          <div style={{ padding: 8, borderBottom: "1px solid var(--line)", background: "var(--paper)" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={14} style={{ position: "absolute", left: 10, color: "var(--muted)" }} />
              <input
                type="text"
                autoFocus
                placeholder="Rechercher un pays ou indicatif..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px 6px 30px",
                  fontSize: 12.5,
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                  outline: "none"
                }}
              />
            </div>
          </div>

          {/* Liste défilante des pays */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filteredCountries.length === 0 ? (
              <div style={{ padding: 12, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
                Aucun pays trouvé
              </div>
            ) : (
              filteredCountries.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleCountrySelect(c)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "8px 12px",
                    background: selectedCountry.code === c.code ? "var(--forest-light)" : "transparent",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "var(--ink)",
                    transition: "background 0.15s"
                  }}
                  onMouseEnter={(e) => {
                    if (selectedCountry.code !== c.code) e.currentTarget.style.background = "#f1f5f9";
                  }}
                  onMouseLeave={(e) => {
                    if (selectedCountry.code !== c.code) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{c.flag}</span>
                    <span style={{ fontWeight: selectedCountry.code === c.code ? 700 : 500 }}>{c.name}</span>
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{c.dialCode}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Input du numéro de téléphone */}
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
        <input
          type="tel"
          inputMode="numeric"
          placeholder={placeholder}
          required
          value={phoneNumber}
          onChange={handleNumberChange}
          onKeyDown={(e) => {
            if (!/[0-9]/.test(e.key) && !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"].includes(e.key) && !e.ctrlKey && !e.metaKey) {
              e.preventDefault();
            }
          }}
          style={{
            width: "100%",
            padding: "12px 14px",
            border: "1.5px solid var(--line)",
            borderRadius: "var(--radius-md)",
            fontSize: 14,
            fontFamily: "inherit",
            outline: "none",
            background: "var(--paper)",
            boxSizing: "border-box"
          }}
        />
      </div>
    </div>
  );
}
