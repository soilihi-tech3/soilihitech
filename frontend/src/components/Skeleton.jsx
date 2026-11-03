import React from "react";

export function Skel({ w = "100%", h = 12, r = 8, style }) {
  return <span className="skel" style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />;
}

export function SkeletonStatCards({ count = 4 }) {
  return (
    <div className="bs-dashboard-kpi-grid" style={{ marginBottom: 28 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bs-panel" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <Skel w={46} h={46} r={12} />
          <div style={{ flex: 1, display: "grid", gap: 8 }}>
            <Skel w="60%" h={10} />
            <Skel w="35%" h={18} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTableRows({ rows = 6, cols = 10 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} aria-hidden="true">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} style={{ padding: "16px 12px" }}>
              <Skel w={`${55 + ((r * 7 + c * 13) % 40)}%`} h={12} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonOrderCards({ count = 4 }) {
  return (
    <div style={{ display: "grid", gap: 14 }} role="status" aria-label="Chargement">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bs-panel" style={{ padding: 18, display: "flex", gap: 16, alignItems: "center" }}>
          <Skel w={56} h={56} r={12} />
          <div style={{ flex: 1, display: "grid", gap: 10 }}>
            <Skel w="40%" h={14} />
            <Skel w="70%" h={10} />
            <Skel w="25%" h={10} />
          </div>
          <Skel w={90} h={28} r={20} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonProductGrid({ count = 8 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }} role="status" aria-label="Chargement">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bs-panel" style={{ padding: 12, display: "grid", gap: 10 }}>
          <Skel h={140} r={12} />
          <Skel w="80%" h={12} />
          <Skel w="45%" h={14} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPOSGrid({ count = 10 }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 14
      }}
      role="status"
      aria-label="Chargement des produits"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid var(--line)",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
          }}
        >
          <div>
            <Skel h={110} r={10} style={{ marginBottom: 10 }} />
            <Skel w="40%" h={10} style={{ marginBottom: 6 }} />
            <Skel w="85%" h={14} style={{ marginBottom: 10 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <Skel w="45%" h={16} />
              <Skel w="30%" h={12} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 12 }}>
            <Skel h={34} r={8} />
            <Skel h={34} r={8} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ cols = 6, rows = 8, headers = [] }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
      <table className="bs-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        {headers.length > 0 && (
          <thead>
            <tr>
              {headers.map((h, idx) => (
                <th key={idx} style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          <SkeletonTableRows rows={rows} cols={headers.length || cols} />
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonVariantGrid({ count = 6 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ border: "1.5px solid var(--line)", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Skel w={70} h={70} r={8} />
          <Skel w="75%" h={12} />
          <Skel w="50%" h={10} />
          <Skel w="90%" h={26} r={6} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonOrdersPage() {
  return (
    <div className="container" style={{ padding: "32px 16px", maxWidth: 1000, margin: "0 auto" }}>
      <Skel w={220} h={26} style={{ marginBottom: 10 }} />
      <Skel w={320} h={12} style={{ marginBottom: 24 }} />
      <SkeletonStatCards count={4} />
      <SkeletonOrderCards count={4} />
    </div>
  );
}
