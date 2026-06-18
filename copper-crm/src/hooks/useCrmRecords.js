import { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../lib/api";
import { storeGet, storeSave, storeRemove, storeSet } from "../lib/store";

const EMPTY_FALLBACK = [];
// The backend free tier spins down when idle and can take 50s+ to wake on the
// first request, which can time out client-side. Retry a couple of times with
// backoff before giving up, instead of immediately showing a stale/empty cache.
const RETRY_DELAYS_MS = [3000, 6000];

function isLocalId(id, type) {
  return !id || String(id).startsWith(type + "-") || String(id).startsWith("demo");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useCrmRecords(type, fallback = EMPTY_FALLBACK) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        try {
          const data = await apiGet(`/api/crm/${type}`);
          if (!alive) return;
          const fetched = Array.isArray(data) ? data : (data.records || []);
          // Always sync the cache to the server's response, even when empty,
          // so stale demo/offline records don't linger after the database changes.
          storeSet(type, fetched);
          setRecords(fetched);
          setError("");
          return;
        } catch (err) {
          if (!alive) return;
          if (attempt < RETRY_DELAYS_MS.length) {
            await wait(RETRY_DELAYS_MS[attempt]);
            continue;
          }
          setError(err.message || "Failed to fetch records");
          // Fallback to localStorage only once every retry has failed
          const cached = storeGet(type);
          setRecords(cached.length ? cached : fallback);
        }
      }
    }

    load().finally(() => alive && setLoading(false));

    return () => { alive = false; };
  }, [type, fallback]);

  useEffect(() => {
    function onUpdate(e) {
      if (e.detail?.type === type) {
        setRecords(storeGet(type));
      }
    }
    window.addEventListener("cs-store", onUpdate);
    return () => window.removeEventListener("cs-store", onUpdate);
  }, [type]);

  const actions = useMemo(() => ({
    async save(record) {
      const saved = storeSave(type, record);
      setRecords(storeGet(type));

      try {
        const mongoId = record._id;
        if (mongoId && !isLocalId(mongoId, type)) {
          const updated = await apiPut(`/api/crm/${type}/${mongoId}`, record);
          storeSave(type, updated);
          setRecords(storeGet(type));
          return updated;
        } else if (!mongoId) {
          const created = await apiPost(`/api/crm/${type}`, record);
          storeSave(type, created);
          setRecords(storeGet(type));
          return created;
        }
      } catch (err) {
        console.error(`Failed to persist ${type} record to the database:`, err);
        setError(err.message || `Failed to save ${type}.`);
      }

      return saved;
    },

    async remove(record) {
      const id = record._id || record.id;
      storeRemove(type, id);
      setRecords(storeGet(type));
      try {
        if (record._id && !isLocalId(record._id, type)) {
          await apiDelete(`/api/crm/${type}/${record._id}`);
        }
      } catch (err) {
        console.error(`Failed to delete ${type} record from the database:`, err);
        setError(err.message || `Failed to delete ${type}.`);
      }
    },

    setRecords,
  }), [type]);

  return { records, loading, error, ...actions };
}
