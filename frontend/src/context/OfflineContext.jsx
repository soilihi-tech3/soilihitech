import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../api";
import { getPendingActions, removeAction } from "../utils/offlineStorage";

export const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncToast, setSyncToast] = useState(null);

  const checkPending = async () => {
    try {
      const actions = await getPendingActions();
      setPendingCount(actions.length);
      return actions;
    } catch (e) {
      return [];
    }
  };

  useEffect(() => {
    checkPending();
  }, []);

  const syncOfflineQueue = async () => {
    if (!navigator.onLine || isSyncing) return;
    const actions = await checkPending();
    if (actions.length === 0) return;

    setIsSyncing(true);
    let successCount = 0;

    for (const action of actions) {
      try {
        const payload = action.data || {};
        if (action.idempotencyKey && !payload.idempotencyKey) {
          payload.idempotencyKey = action.idempotencyKey;
        }

        if (action.method === "POST" || action.method === "post") {
          await api.post(action.url, payload);
        } else if (action.method === "PUT" || action.method === "put") {
          await api.put(action.url, payload);
        } else if (action.method === "DELETE" || action.method === "delete") {
          await api.delete(action.url);
        }
        await removeAction(action.id);
        successCount++;
      } catch (err) {
        console.error("Erreur lors de la synchronisation de l'action offline:", action, err);
        // Si le serveur renvoie 4xx (hors 408/429), c'est une requete invalide ou deja traitee, on la retire pour ne pas bloquer la file
        if (err.response && err.response.status >= 400 && err.response.status < 500 && err.response.status !== 408 && err.response.status !== 429) {
          await removeAction(action.id);
        }
      }
    }

    await checkPending();
    setIsSyncing(false);

    if (successCount > 0) {
      setSyncToast(`Connexion retablie : ${successCount} operation(s) synchronisee(s) avec succes.`);
      setTimeout(() => setSyncToast(null), 5000);
      window.dispatchEvent(new CustomEvent("offline_synced", { detail: { count: successCount } }));
    }
  };

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      syncOfflineQueue();
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial sync check if back online
    if (navigator.onLine) {
      syncOfflineQueue();
    }

    // Ping periodique (toutes les 30 secondes) pour tester la vraie connectivite Internet
    const pingInterval = setInterval(async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }
      try {
        await api.get("/health", { timeout: 4000 });
        if (!isOnline) {
          setIsOnline(true);
          syncOfflineQueue();
        }
      } catch (err) {
        // En cas d'echec reseau du ping
        if (!err.response) {
          setIsOnline(false);
        }
      }
    }, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(pingInterval);
    };
  }, [isOnline]);

  return (
    <OfflineContext.Provider value={{ isOnline, isSyncing, pendingCount, syncOfflineQueue, syncToast, checkPending }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  return useContext(OfflineContext);
}
