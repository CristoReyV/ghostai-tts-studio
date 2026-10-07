/**
 * @file src/services/recoveryService.ts
 * Frontend service for communicating with the Gateway Temporary Recovery Vault endpoints.
 */

import { getGatewayBaseUrl, getGatewayAuthToken } from "./gateway";
import type { RecoverySessionSummary, RecoveryItem } from "../types/tts";

function getAuthHeaders(): HeadersInit {
  const token = getGatewayAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetches all active recovery sessions for the authenticated client.
 */
export async function fetchRecoverySessions(): Promise<RecoverySessionSummary[]> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/tts/generations`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    if (res.status === 403) return []; // Legacy or not client token
    throw new Error(`Error consultando sesiones de recuperación (${res.status})`);
  }

  const data = await res.json();
  return data.sessions || [];
}

/**
 * Rehydrates a session by fetching its project and item metadata.
 */
export async function recoverSession(sessionId: string): Promise<{
  session: RecoverySessionSummary;
  items: RecoveryItem[];
}> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/tts/generations/recover`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ sessionId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Error recuperando sesión (${res.status})`);
  }

  const data = await res.json();
  return {
    session: data.session,
    items: data.items || [],
  };
}

/**
 * Downloads a single recovered audio stream as a Blob.
 */
export async function downloadRecoveredAudioBlob(
  sessionId: string,
  narrationId: string
): Promise<Blob> {
  const baseUrl = getGatewayBaseUrl();
  const token = getGatewayAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${baseUrl}/api/tts/generations/audio?sessionId=${encodeURIComponent(
    sessionId
  )}&narrationId=${encodeURIComponent(narrationId)}`;

  const res = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    throw new Error(`Error descargando audio del recovery vault (${res.status})`);
  }

  return await res.blob();
}

/**
 * Deletes a recovery session and associated vault files.
 */
export async function deleteRecoverySession(sessionId: string): Promise<boolean> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(
    `${baseUrl}/api/tts/generations?sessionId=${encodeURIComponent(sessionId)}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error(`Error eliminando sesión (${res.status})`);
  }

  const data = await res.json();
  return data.ok === true;
}

/**
 * Sends ZIP verification metadata to Gateway.
 */
export async function reportZipVerification(
  sessionId: string,
  verified: boolean,
  packageSha256?: string,
  itemCount?: number
): Promise<boolean> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/tts/generations/verify`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      sessionId,
      verified,
      packageSha256: packageSha256 || null,
      itemCount: typeof itemCount === "number" ? itemCount : undefined,
    }),
  });

  if (!res.ok) return false;
  const data = await res.json().catch(() => ({}));
  return data.ok === true;
}
