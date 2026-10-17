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
export async function loginAdmin(
  credentials: string | { email: string; password: string } | { adminKey: string }
): Promise<boolean> {
  const baseUrl = getGatewayBaseUrl();
  const body = typeof credentials === "string" ? { adminToken: credentials } : credentials;
  const res = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
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

export interface EmailConfigStatus {
  provider: "resend" | "smtp" | "sandbox";
  isLive: boolean;
  deliveryMode?: "manual" | "provider";
  sender: string;
}

/**
 * Fetches full admin session info including role, identity, and email provider status.
 */
export async function fetchAdminSession(): Promise<{
  authenticated: boolean;
  admin?: AdminUserIdentity;
  email?: EmailConfigStatus;
}> {
  const baseUrl = getGatewayBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/admin/auth/status`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) return { authenticated: false };
    const data = await res.json();
    return {
      authenticated: data.authenticated === true,
      admin: data.admin || undefined,
      email: data.email || undefined,
    };
  } catch (_) {
    return { authenticated: false };
  }
}

/**
 * Logs out of admin session and expires cookie.
 */
export async function logoutAdmin(): Promise<void> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/auth/logout`, {
      method: "POST",
      credentials: "include",
  });
  if (!res.ok) throw new Error("No se pudo cerrar la sesión. Intenta de nuevo.");
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

// ── Member Access Management Services ────────────────────────────────

export interface AdminMember {
  id: string;
  client_id: string;
  key_id: string | null;
  name: string;
  email: string;
  access_plan: "monthly" | "annual";
  status: "pending" | "invited" | "active" | "expired" | "revoked";
  created_at: string;
  invited_at: string | null;
  activated_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  tokenPublicId?: string | null;
  lastUsedAt?: string | null;
  last_email_sent_at?: string | null;
  last_email_status?: "not_sent" | "sent" | "failed" | null;
  last_email_sent_by?: string | null;
  last_email_error?: string | null;
}

export interface AdminUserIdentity {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "operator";
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "operator";
  status: "pending" | "active" | "disabled";
  created_at: string;
  invited_at: string | null;
  activated_at: string | null;
  last_login_at: string | null;
  invited_by: string | null;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string | null;
  admin_email: string;
  admin_role: string;
  action: string;
  target_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface EmailPreviewData {
  to: string;
  name: string;
  plan: string;
  subject: string;
  preheader: string;
  html: string;
  text: string;
  activationLink: string;
  invitationExpiresAt: string;
}

export interface SendInvitationResult {
  ok: boolean;
  processed: number;
  succeededCount: number;
  failedCount: number;
  succeeded: Array<{ memberId: string; email: string; messageId?: string; simulated?: boolean }>;
  failed: Array<{ memberId: string; email?: string; error: string }>;
}

export interface EmailPayload {
  memberId: string;
  name: string;
  email: string;
  plan: string;
  activationLink: string;
  subject: string;
  body: string;
}

export interface BulkImportResultRow {
  rowNumber: number;
  memberId?: string;
  name: string;
  email: string;
  plan?: string;
  status: "CREATED" | "ALREADY_EXISTS" | "ERROR";
  existingStatus?: string;
  message?: string;
  activationLink?: string;
  emailPayload?: EmailPayload;
}

export interface BulkImportSummary {
  processed: number;
  newCount: number;
  existingCount: number;
  errorCount: number;
  monthlyCount: number;
  annualCount: number;
}

export interface BulkImportResponse {
  ok: boolean;
  summary: BulkImportSummary;
  results: BulkImportResultRow[];
  createdMembers: AdminMember[];
  emailPayloads: EmailPayload[];
  zeroRealEmailsSent: boolean;
}

export interface ActivationResponse {
  ok: boolean;
  authenticated: boolean;
  accessKey: string | null;
  clientName: string;
  accessPlan: string;
  activatedAt: string;
  expiresAt: string;
  memberId: string;
}

/**
 * Lists all registered members.
 */
export async function fetchAdminMembers(): Promise<AdminMember[]> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/members`, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Error listando miembros (${res.status})`);
  }

  const data = await res.json();
  return data.members || [];
}

/**
 * Creates a single member with individual key & activation link.
 */
export async function createAdminMember(
  name: string,
  email: string,
  accessPlan: "monthly" | "annual" = "monthly"
): Promise<{
  member: AdminMember;
  activationToken: string;
  activationLink: string;
  emailPayload: EmailPayload;
}> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, email, accessPlan }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Error creando miembro (${res.status})`);
  }

  return await res.json();
}

/**
 * Bulk imports members.
 */
export async function bulkCreateAdminMembers(
  members: Array<{ name: string; email: string; accessPlan: string | null }>
): Promise<BulkImportResponse> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/members/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ members }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Error en importación masiva (${res.status})`);
  }

  return await res.json();
}

/**
 * Renews a member (+30 days or +365 days).
 */
export async function renewAdminMember(
  memberId: string,
  extension: "monthly" | "annual"
): Promise<{ ok: boolean; memberId: string; accessPlan: string; expiresAt: string; status: string }> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/members/renew`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ memberId, extension }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Error renovando membresía (${res.status})`);
  }

  return await res.json();
}

/**
 * Revokes a member and immediately invalidates their key.
 */
export async function revokeAdminMember(memberId: string): Promise<boolean> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/members/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ memberId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Error revocando miembro (${res.status})`);
  }

  return true;
}

/**
 * Generates fresh invitations / email payloads for one or more members.
 * Zero real emails sent.
 */
export async function inviteAdminMember(
  target: string | string[]
): Promise<{
  ok: boolean;
  sentCount: number;
  invitations: Array<{
    memberId: string;
    activationToken: string;
    activationLink: string;
    emailPayload: EmailPayload;
  }>;
}> {
  const baseUrl = getGatewayBaseUrl();
  const payload = Array.isArray(target) ? { memberIds: target } : { memberId: target };

  const res = await fetch(`${baseUrl}/api/admin/members/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Error generando invitaciones (${res.status})`);
  }

  return await res.json();
}

/**
 * Regenerates an individual key for a member.
 */
export async function regenerateAdminMemberKey(
  memberId: string
): Promise<{
  member: AdminMember;
  activationToken: string;
  activationLink: string;
  emailPayload: EmailPayload;
}> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/members/regenerate-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ memberId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Error regenerando llave (${res.status})`);
  }

  return await res.json();
}

/**
 * Public activation call when user opens an invitation link (?activate=<token>).
 */
export async function activateMember(token: string): Promise<ActivationResponse> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/members/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || "No se pudo activar el acceso. El enlace puede haber expirado o ya fue utilizado.");
  }

  return await res.json();
}

/**
 * Lists all administrators. OWNER only.
 */
export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/users`, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Error listando administradores (${res.status})`);
  }

  const data = await res.json();
  return data.users || [];
}

/**
 * Invites a new administrator. OWNER only.
 */
export async function inviteAdminUser(
  name: string,
  email: string,
  role: "owner" | "admin" = "admin"
): Promise<{ adminUser: AdminUser; activationToken: string; activationLink: string }> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, email, role }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Error invitando administrador (${res.status})`);
  }

  return await res.json();
}

/**
 * Updates administrator status (active | disabled). OWNER only.
 */
export async function updateAdminUserStatus(
  adminId: string,
  status: "active" | "disabled"
): Promise<AdminUser> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/users/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ adminId, status }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Error actualizando administrador (${res.status})`);
  }

  const data = await res.json();
  return data.adminUser;
}

/**
 * Lists administrative audit logs. OWNER only.
 */
export async function fetchAdminAuditLogs(limit: number = 100, offset: number = 0): Promise<AdminAuditLog[]> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/audit-logs?limit=${limit}&offset=${offset}`, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Error listando registros de auditoría (${res.status})`);
  }

  const data = await res.json();
  return data.logs || [];
}

/**
 * Previews personalized invitation email HTML and plain text for a member.
 */
export async function previewMemberEmail(memberId: string): Promise<EmailPreviewData> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/members/email-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ memberId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Error generando vista previa de correo (${res.status})`);
  }

  const data = await res.json();
  return data.preview;
}

/**
 * Sends invitation email(s) to 1 or more members.
 */
export async function sendMemberInvitations(
  memberIds: string | string[]
): Promise<SendInvitationResult> {
  const baseUrl = getGatewayBaseUrl();
  const payload = Array.isArray(memberIds) ? { memberIds } : { memberId: memberIds };

  const res = await fetch(`${baseUrl}/api/admin/members/send-invitation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Error enviando invitaciones (${res.status})`);
  }

  return await res.json();
}

/**
 * Activates an invited administrator account with their password.
 */
export async function activateAdminAccount(
  token: string,
  password: string
): Promise<{ ok: boolean; authenticated: boolean; admin: AdminUserIdentity }> {
  const baseUrl = getGatewayBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/auth/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token, password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Error activando cuenta de administrador (${res.status})`);
  }

  return await res.json();
}


export async function manageOperatorKey(action: "rotate" | "revoke", adminId: string): Promise<{ key?: string }> {
 const res = await fetch(getGatewayBaseUrl() + "/api/admin/keys", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, adminId }) });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error?.message || "Error gestionando admin key.");
 return data;
}
export async function createInvitationLink(memberId: string): Promise<string> {
 const res = await fetch(getGatewayBaseUrl() + "/api/admin/members/invite", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId }) });
 const data = await res.json();
 if (!res.ok || !data.invitations?.[0]?.activationLink) throw new Error(data.errors?.[0]?.error || data.error?.message || "No se pudo crear el enlace.");
 return data.invitations[0].activationLink;
}
export async function auditBulkPreview(memberIds: string[]): Promise<void> {
 const res = await fetch(getGatewayBaseUrl() + "/api/admin/members/send-invitation", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberIds, previewOnly: true }) });
 if (!res.ok) throw new Error("No se pudo preparar el envío.");
}

export async function prepareManualInvitation(memberId: string): Promise<EmailPreviewData> {
 const res = await fetch(getGatewayBaseUrl() + "/api/admin/members/prepare-email", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId }) });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error?.message || "No se pudo preparar el correo.");
 return data.preview;
}
