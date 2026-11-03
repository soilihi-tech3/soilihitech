import React, { createContext, useContext, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle2, Loader2 } from "lucide-react";

/**
 * ReceiptPrinter Component Suite
 * Inspired by tactile POS thermal printers with authentic stepped feeding and serrated edge paper.
 */

const easeOut = [0.23, 1, 0.32, 1];
const easeInOut = [0.77, 0, 0.175, 1];

const receiptToothCount = 40;
const receiptToothDepth = 4;
const receiptToothPoints = Array.from(
  { length: receiptToothCount * 2 },
  (_, index) => {
    const x = 100 - ((index + 1) * 100) / (receiptToothCount * 2);
    const y = index % 2 === 0 ? "100%" : `calc(100% - ${receiptToothDepth}px)`;
    return `${x}% ${y}`;
  }
).join(", ");

export const receiptClipPath = `polygon(0 0, 100% 0, 100% calc(100% - ${receiptToothDepth}px), ${receiptToothPoints})`;

export const printingTransformKeyframes = [
  "translateY(calc(-100% + 2px))",
  "translateY(-91%)",
  "translateY(-91%)",
  "translateY(-81%)",
  "translateY(-81%)",
  "translateY(-70%)",
  "translateY(-70%)",
  "translateY(-58%)",
  "translateY(-58%)",
  "translateY(-45%)",
  "translateY(-45%)",
  "translateY(-32%)",
  "translateY(-32%)",
  "translateY(-20%)",
  "translateY(-20%)",
  "translateY(-10%)",
  "translateY(-10%)",
  "translateY(-3%)",
  "translateY(-3%)",
  "translateY(0%)",
];

export const printingKeyframeTimes = [
  0, 0.075, 0.105, 0.18, 0.21, 0.285, 0.315, 0.39, 0.42, 0.495, 0.525, 0.6,
  0.63, 0.705, 0.735, 0.81, 0.84, 0.915, 0.945, 1,
];

const defaultStatusLabels = {
  processing: "Traitement de votre commande...",
  printing: "Impression du ticket de caisse...",
  complete: "Commande validée avec succès !"
};

const ReceiptPrinterContext = createContext(null);

function useReceiptPrinter(componentName) {
  const context = useContext(ReceiptPrinterContext);
  if (!context) {
    throw new Error(`${componentName} must be used inside ReceiptPrinter.Root.`);
  }
  return context;
}

export function ReceiptPrinterRoot({
  stage = "complete",
  feedMotion = "stepped",
  animate = true,
  children,
  className = "",
  style = {},
  ...props
}) {
  const shouldReduceMotion = useReducedMotion();
  const contextValue = useMemo(() => ({
    animate,
    feedMotion,
    shouldMove: animate && !shouldReduceMotion,
    stage
  }), [animate, feedMotion, shouldReduceMotion, stage]);

  return (
    <ReceiptPrinterContext.Provider value={contextValue}>
      <div
        className={`bs-printer-root ${className}`}
        data-stage={stage}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          maxWidth: 420,
          margin: "0 auto",
          ...style
        }}
        {...props}
      >
        {children}
      </div>
    </ReceiptPrinterContext.Provider>
  );
}

export function ReceiptPrinterMachine({
  children,
  className = "",
  style = {},
  ...props
}) {
  return (
    <div
      className={`bs-printer-machine ${className}`}
      style={{
        position: "relative",
        isolation: "isolate",
        width: "100%",
        overflow: "hidden",
        borderRadius: 24,
        background: "linear-gradient(180deg, #18181B 0%, #121215 100%)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        padding: 12,
        paddingBottom: 28,
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        zIndex: 20,
        ...style
      }}
      {...props}
    >
      {children}
      {/* Printer slit exit */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          bottom: 10,
          height: 8,
          borderRadius: 4,
          background: "#09090B",
          border: "1px solid #27272A",
          boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.8)",
          zIndex: 40
        }}
      />
    </div>
  );
}

export function ReceiptPrinterHeader({
  children,
  className = "",
  style = {},
  ...props
}) {
  return (
    <div
      className={`bs-printer-header ${className}`}
      style={{
        position: "relative",
        zIndex: 10,
        display: "flex",
        height: 40,
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
        padding: "0 4px",
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function ReceiptPrinterScreen({
  children,
  className = "",
  style = {},
  ...props
}) {
  return (
    <div
      className={`bs-printer-screen ${className}`}
      style={{
        position: "relative",
        zIndex: 10,
        overflow: "hidden",
        borderRadius: 16,
        background: "#09090B",
        border: "1px solid #27272A",
        padding: "14px 16px",
        color: "#F4F4F5",
        boxShadow: "inset 0 2px 8px rgba(0, 0, 0, 0.9)",
        ...style
      }}
      {...props}
    >
      <div style={{ position: "relative", zIndex: 10 }}>{children}</div>
    </div>
  );
}

export function ReceiptPrinterStatus({
  children,
  statusLabels = defaultStatusLabels,
  className = "",
  style = {},
  ...props
}) {
  const { animate, shouldMove, stage } = useReceiptPrinter("ReceiptPrinter.Status");
  const isComplete = stage === "complete";

  return (
    <div
      className={`bs-printer-status ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
        marginTop: 8,
        paddingTop: 8,
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        ...style
      }}
      {...props}
    >
      <span
        aria-hidden="true"
        style={{
          position: "relative",
          width: 20,
          height: 20,
          display: "grid",
          placeItems: "center",
          flexShrink: 0
        }}
      >
        <AnimatePresence initial={false} mode="wait">
          {isComplete ? (
            <motion.span
              key="complete"
              initial={{ opacity: animate ? 0 : 1, transform: shouldMove ? "scale(0.8)" : "scale(1)" }}
              animate={{ opacity: 1, transform: "scale(1)" }}
              exit={{ opacity: animate ? 0 : 1, transform: shouldMove ? "scale(0.8)" : "scale(1)" }}
              transition={{ duration: animate ? 0.2 : 0, ease: easeOut }}
              style={{ color: "#22C55E", display: "grid", placeItems: "center" }}
            >
              <CheckCircle2 size={18} strokeWidth={2.5} />
            </motion.span>
          ) : (
            <motion.span
              key="working"
              initial={{ opacity: animate ? 0 : 1, transform: shouldMove ? "scale(0.8)" : "scale(1)" }}
              animate={{ opacity: 1, transform: "scale(1)" }}
              exit={{ opacity: animate ? 0 : 1, transform: shouldMove ? "scale(0.8)" : "scale(1)" }}
              transition={{ duration: animate ? 0.2 : 0, ease: easeOut }}
              style={{ color: "#A1A1AA", display: "grid", placeItems: "center" }}
            >
              <Loader2 size={17} className={animate ? "bs-spin" : ""} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      <div
        aria-live="polite"
        role="status"
        style={{ minWidth: 0, flex: 1, overflow: "hidden" }}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: animate ? 0 : 1, transform: shouldMove ? "translateY(4px)" : "translateY(0)" }}
            animate={{ opacity: 1, transform: "translateY(0)" }}
            exit={{ opacity: animate ? 0 : 1, transform: shouldMove ? "translateY(-4px)" : "translateY(0)" }}
            transition={{ duration: animate ? 0.2 : 0, ease: easeOut }}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: isComplete ? "#4ADE80" : "#A1A1AA",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {children ?? statusLabels[stage]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function ReceiptPrinterOutput({
  children,
  className = "",
  style = {},
  maxHeight = "36rem",
  ...props
}) {
  const { animate, feedMotion, shouldMove, stage } = useReceiptPrinter("ReceiptPrinter.Output");
  const isReceiptVisible = stage !== "processing";
  const shouldUseSteppedFeed = feedMotion === "stepped" && stage === "printing" && shouldMove;

  return (
    <div
      className={`bs-printer-output ${className}`}
      style={{
        position: "relative",
        zIndex: 10,
        marginTop: -16,
        width: "90%",
        maxWidth: 360,
        maxHeight: maxHeight,
        overflow: "hidden",
        padding: "0 10px",
        paddingBottom: 24,
        ...style
      }}
      {...props}
    >
      {/* Slit shadow gradient over emerging paper */}
      {isReceiptVisible && (
        <div
          aria-hidden="true"
          style={{
            pointerEvents: "none",
            position: "absolute",
            left: 10,
            right: 10,
            top: 0,
            height: 10,
            background: "linear-gradient(to bottom, rgba(9, 9, 11, 0.85), transparent)",
            zIndex: 30,
            filter: "blur(2px)"
          }}
        />
      )}

      <motion.div
        initial={false}
        animate={{
          opacity: isReceiptVisible ? 1 : 0,
          transform:
            stage === "printing" && shouldMove
              ? shouldUseSteppedFeed
                ? printingTransformKeyframes
                : "translateY(0%)"
              : isReceiptVisible || !shouldMove
              ? "translateY(0%)"
              : "translateY(calc(-100% + 2px))"
        }}
        aria-hidden={stage !== "complete"}
        transition={{
          opacity: { duration: animate ? 0.2 : 0, ease: easeOut },
          transform: {
            duration: shouldMove ? 1.85 : 0,
            ease: shouldUseSteppedFeed ? "linear" : easeInOut,
            times: shouldUseSteppedFeed ? printingKeyframeTimes : undefined
          }
        }}
        style={{
          position: "relative",
          isolation: "isolate",
          filter: "drop-shadow(0 12px 24px rgba(0, 0, 0, 0.25)) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15))"
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export function ReceiptPrinterPaper({
  children,
  className = "",
  style = {},
  ...props
}) {
  return (
    <article
      className={`bs-printer-paper ${className}`}
      style={{
        position: "relative",
        zIndex: 10,
        background: "#FFFFFF",
        color: "#18181B",
        fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
        padding: "24px 20px 28px",
        minHeight: 280,
        clipPath: receiptClipPath,
        borderTop: "1px solid rgba(0, 0, 0, 0.05)",
        ...style
      }}
      {...props}
    >
      {children}
    </article>
  );
}

/**
 * Authentic SVG Barcode generator for receipts
 */
export function BarcodeSvg({ value = "COM-1001", height = 44, className = "" }) {
  // Deterministic bar widths derived from string
  const bars = useMemo(() => {
    const list = [];
    let seed = 0;
    for (let i = 0; i < value.length; i++) {
      seed = (seed + value.charCodeAt(i) * (i + 1)) % 1000;
    }
    const barCount = 46;
    for (let i = 0; i < barCount; i++) {
      const isBlack = (i % 2 === 0) || (i % 5 === 0);
      const pseudo = (seed * (i + 7) + 13) % 10;
      const width = isBlack ? (pseudo > 7 ? 3 : pseudo > 3 ? 2 : 1) : (pseudo > 6 ? 2 : 1);
      list.push({ isBlack, width });
    }
    return list;
  }, [value]);

  const totalWidth = bars.reduce((sum, b) => sum + b.width, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        style={{ width: "100%", maxWidth: 220, height: height, display: "block" }}
        className={className}
        preserveAspectRatio="none"
      >
        {bars.map((bar, idx) => {
          const currentX = bars.slice(0, idx).reduce((acc, b) => acc + b.width, 0);
          if (!bar.isBlack) return null;
          return (
            <rect
              key={idx}
              x={currentX}
              y={0}
              width={bar.width}
              height={height}
              fill="#09090B"
            />
          );
        })}
      </svg>
      <span style={{ fontSize: 10, letterSpacing: 2, color: "#52525B", fontWeight: 700 }}>
        {value}
      </span>
    </div>
  );
}

export const ReceiptPrinter = {
  Root: ReceiptPrinterRoot,
  Machine: ReceiptPrinterMachine,
  Header: ReceiptPrinterHeader,
  Screen: ReceiptPrinterScreen,
  Status: ReceiptPrinterStatus,
  Output: ReceiptPrinterOutput,
  Paper: ReceiptPrinterPaper
};

export default ReceiptPrinter;
