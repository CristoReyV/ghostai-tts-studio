/**
 * @file src/services/adminService.ts
 * Frontend administrative service communicating with Gateway admin endpoints.
 * Uses temporary HttpOnly session cookies (credentials: "include").
 * Never persists or stores GHOSTAI_ADMIN_AUTH_TOKEN in the browser.
 */

import { getGatewayBaseUrl } from "./gateway";

export interface AdminClient {
  id: string;
  name: string;
  email: string | null;
  status: "active" | "suspended";
  created_at: string;
  activeTokensCount?: number;
  lastUsedAt?: string | null;
}

export interface AdminToken {
  id: string;
  clientId: string;
  clientName: string;
  tokenPublicId: string;
  label: string | null;
  status: "active" | "revoked";
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface AdminTtsSession {
  id: string;
  clientId: string;
  clientName: string;
  projectId: string | null;
  projectTitle: string;
  status: string;
  itemCount: number;
  readyCount: number;
  errorCount: number;
  zipStatus: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Exchanges admin credential for HttpOnly session cookie.
 * Frontend caller must immediately wipe credential input from memory and DOM.
 */
export async function loginAdmin(adminToken: string): Promise<boolean> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ adminToken }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || "Credencial administrativa inválida.");
  }

  const data = await res.json();
  return data.authenticated === true;
}

/**
 * Checks if current admin session cookie is active.
 */
export async function checkAdminStatus(): Promise<boolean> {
  const baseUrl = getGatewayBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/admin/auth/status`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.authenticated === true;
  } catch (_) {
    return false;
  }
}

/**
 * Logs out of admin session and expires cookie.
 */
export async function logoutAdmin(): Promise<void> {
  const baseUrl = getGatewayBaseUrl();
  try {
    await fetch(`${baseUrl}/api/admin/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (_) {}
}

/**
 * Lists all registered clients.
 */
export async function fetchAdminClients(): Promise<AdminClient[]> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/clients`, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Error listando clientes (${res.status})`);
  }

  const data = await res.json();
  return data.clients || [];
}

/**
 * Creates a new client.
 */
export async function createAdminClient(name: string, email?: string): Promise<AdminClient> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/clients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, email: email || null }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Error creando cliente (${res.status})`);
  }

  return await res.json();
}

/**
 * Updates a client's status (active | suspended).
 */
export async function updateAdminClientStatus(
  clientId: string,
  status: "active" | "suspended"
): Promise<boolean> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/clients`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ clientId, status }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Error actualizando estado del cliente (${res.status})`);
  }

  return true;
}

/**
 * Lists access tokens.
 */
export async function fetchAdminTokens(clientId?: string): Promise<AdminToken[]> {
  const baseUrl = getGatewayBaseUrl();
  const url = clientId
    ? `${baseUrl}/api/admin/access-tokens?clientId=${encodeURIComponent(clientId)}`
    : `${baseUrl}/api/admin/access-tokens`;

  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Error listando access tokens (${res.status})`);
  }

  const data = await res.json();
  return data.tokens || [];
}

/**
 * Generates an access token.
 * Plaintext token is returned ONLY ONCE in this response.
 */
export async function createAdminToken(
  clientId: string,
  label?: string,
  expiresAt?: string
): Promise<{ token: string; tokenId: string; label: string | null; createdAt: string; expiresAt: string | null }> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/access-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      clientId,
      label: label || null,
      expiresAt: expiresAt || null,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Error generando token (${res.status})`);
  }

  return await res.json();
}

/**
 * Revokes an access token.
 */
export async function revokeAdminToken(tokenId: string): Promise<boolean> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/access-tokens/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ tokenId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Error revocando token (${res.status})`);
  }

  return true;
}

/**
 * Audits TTS operation sessions (metadata only).
 */
export async function fetchAdminTtsOperations(): Promise<AdminTtsSession[]> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/tts/operations`, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Error listando operaciones TTS (${res.status})`);
  }

  const data = await res.json();
  return data.sessions || [];
}
