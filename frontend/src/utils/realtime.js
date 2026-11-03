import { SLUG } from "../api";

const getBaseUrl = () => {
  let url = import.meta.env.VITE_API_URL;
  if (typeof window !== "undefined") {
    if (!url || url === "/" || url === "/api") {
      return "/api";
    }
    if (url.startsWith("/")) {
      return url.endsWith("/api") ? url : `${url}/api`.replace(/\/+/g, "/");
    }
  }
  if (!url) {
    const host = typeof window !== "undefined" && window.location.hostname ? window.location.hostname : "localhost";
    url = `http://${host}:4000/api`;
  }
  url = url.trim().replace(/\/+$/, "");
  if (!url.endsWith("/api")) {
    url += "/api";
  }
  return url;
};

let eventSource = null;
let reconnectTimer = null;

const SUPPORTED_EVENTS = [
  "order_updated",
  "order_created",
  "order_deleted",
  "product_updated",
  "product_created",
  "product_deleted",
  "stock_updated",
  "boutique_updated",
  "category_updated",
  "expense_updated",
  "saving_updated",
  "custom_order_updated",
  "achat_updated"
];

let lastDispatchedKey = "";
let lastDispatchedTime = 0;

function dispatchRealtimeEvent(type, data = {}) {
  const now = Date.now();
  const key = `${type}_${JSON.stringify(data)}`;
  if (key === lastDispatchedKey && now - lastDispatchedTime < 250) {
    return;
  }
  lastDispatchedKey = key;
  lastDispatchedTime = now;

  window.dispatchEvent(
    new CustomEvent("app_realtime_event", {
      detail: { type, data, timestamp: now }
    })
  );
}

export function initRealtimeSync() {
  if (typeof window === "undefined") return;
  if (eventSource && eventSource.readyState !== EventSource.CLOSED) return;

  const streamUrl = `${getBaseUrl()}/store/${SLUG}/realtime/events?_t=${Date.now()}`;

  try {
    eventSource = new EventSource(streamUrl);

    SUPPORTED_EVENTS.forEach((type) => {
      eventSource.addEventListener(type, (e) => {
        let data = {};
        try {
          data = JSON.parse(e.data || "{}");
        } catch (err) {}
        dispatchRealtimeEvent(type, data);
      });
    });

    eventSource.onmessage = (e) => {
      let parsed = {};
      try {
        parsed = JSON.parse(e.data || "{}");
      } catch (err) {}
      const type = parsed.type || "message";
      const data = parsed.data || parsed;
      dispatchRealtimeEvent(type, data);
    };

    eventSource.onerror = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(initRealtimeSync, 3000);
    };
  } catch (err) {
    console.warn("Realtime sync warning:", err);
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
        initRealtimeSync();
      }
    }
  });
}

export function subscribeRealtime(callback) {
  const handler = (e) => {
    if (!callback || !e.detail) return;
    const detail = e.detail;
    const type = detail.type || "";
    const data = detail.data || {};

    if (callback.length >= 2) {
      callback(type, data, detail);
    } else {
      callback(detail);
    }
  };
  window.addEventListener("app_realtime_event", handler);
  return () => window.removeEventListener("app_realtime_event", handler);
}
