/**
 * @file src/services/projectStorage.ts
 * Cross-tab and persistent storage for GhostAI TTS Studio sessions.
 * Enables seamless project state transfer when opening in a new top-level tab.
 *
 * SECURITY:
 * - NO API keys or secrets are ever stored.
 * - Stores only user project metadata and generated narration items / audio Blobs.
 */

import type { GhostAiTtsProject, StudioNarrationItem } from "../types/tts";

const DB_NAME = "ghostai_tts_studio_db";
const DB_VERSION = 1;
const STORE_NAME = "active_session";
const SESSION_KEY = "current_project_session";

export interface StoredSessionData {
  key: string;
  project: GhostAiTtsProject;
  items: Array<Omit<StudioNarrationItem, "audioUrl"> & { audioBlob?: Blob }>;
  savedAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this environment"));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

/**
 * Persists the active project and ready items into IndexedDB.
 */
export async function saveActiveSession(
  project: GhostAiTtsProject,
  items: StudioNarrationItem[]
): Promise<void> {
  try {
    const db = await openDB();
    // Strip audioUrl (object URLs cannot be serialized and will be recreated on load)
    const cleanItems = items.map((it) => {
      const { audioUrl, ...rest } = it;
      return rest;
    });

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const sessionData: StoredSessionData = {
        key: SESSION_KEY,
        project,
        items: cleanItems,
        savedAt: new Date().toISOString(),
      };
      const req = store.put(sessionData);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error("Failed to put session"));
    });
  } catch (err) {
    console.warn("[GhostAI Storage] Failed to save active session:", err);
  }
}

/**
 * Loads the stored active session if available and creates fresh object URLs for audio Blobs.
 */
export async function loadActiveSession(): Promise<{
  project: GhostAiTtsProject;
  items: StudioNarrationItem[];
  savedAt: string;
} | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(SESSION_KEY);
      req.onsuccess = () => {
        const data = req.result as StoredSessionData | undefined;
        if (!data || !data.project || !Array.isArray(data.items)) {
          return resolve(null);
        }

        const restoredItems: StudioNarrationItem[] = data.items.map((it) => ({
          ...(it as unknown as StudioNarrationItem),
          audioUrl: it.audioBlob ? URL.createObjectURL(it.audioBlob) : undefined,
        }));

        resolve({
          project: data.project,
          items: restoredItems,
          savedAt: data.savedAt,
        });
      };
      req.onerror = () => reject(req.error || new Error("Failed to get session"));
    });
  } catch (err) {
    console.warn("[GhostAI Storage] Failed to load active session:", err);
    return null;
  }
}

/**
 * Clears the stored active session when a project is intentionally reset.
 */
export async function clearActiveSession(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(SESSION_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error("Failed to delete session"));
    });
  } catch (err) {
    console.warn("[GhostAI Storage] Failed to clear active session:", err);
  }
}
