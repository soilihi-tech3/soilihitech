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
