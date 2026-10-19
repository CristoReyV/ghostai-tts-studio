/**
 * @file src/components/Admin/AdminDashboard.tsx
 * Private Administrative Console for GhostAI Access Control, Member Management & TTS Operations.
 * Isolated from normal Studio user views.
 *
 * Implements:
 *  - GHOSTAI MEMBER ACCESS 01: Bulk Member Import (.xlsx / .csv), cryptographic keys, renewal & revocation.
 *  - GHOSTAI ADMIN USERS + EMAIL EXPERIENCE 02:
 *      * Multi-Admin RBAC (OWNER vs ADMIN).
 *      * Dedicated ADMINISTRADORES and AUDITORÍA tabs for OWNER.
 *      * One-time cryptographic activation link generation for partner/new admins.
 *      * Last active OWNER deactivation protection.
 *      * Full Email HTML Preview (sandboxed iframe + plain text toggle).
 *      * Single & Bulk sending with duplicate-click protection ("ENVIANDO...").
 *      * Per-member email delivery status (NO ENVIADA, ENVIADA, ACTIVADO, ERROR).
 *      * Individual batch safety with isolated execution.
 *      * OWNER-authorized key delivery through authenticated email preparation.
 */

import { ManualInvitationActions } from "./ManualInvitationActions";
import { BillingDashboard } from "./BillingDashboard";
import { SheetSyncControl } from "./SheetSyncControl";
import { fetchSheetSyncStatus } from "../../services/billingService";
import type { BillingSyncInfo } from "../../services/billingService";
import { MemberOperationDetails, MemberOperationalBadge } from "./MemberOperationDetails";
import { getMemberOperationalState, matchesMemberFilters, EMAIL_TYPE_LABELS } from "../../services/memberOperations";
import { markMemberEmail } from "../../services/adminService";
import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  Key,
  Users,
  Activity,
  LogOut,
  ArrowLeft,
  Plus,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Lock,
  Upload,
  FileSpreadsheet,
  Mail,
  Search,
  Eye,
  Sparkles,
  X,
  Send,
  CheckCircle2,
  Crown,
  FileText,
} from "lucide-react";
import {
  loginAdmin,
  prepareManualInvitation,
  manageOperatorKey,
  createInvitationLink,
  auditBulkPreview,
  logoutAdmin,
  fetchAdminSession,
  fetchAdminClients,
  createAdminClient,
  updateAdminClientStatus,
  fetchAdminTokens,
  createAdminToken,
  revokeAdminToken,
  fetchAdminTtsOperations,
  fetchAdminMembers,
  createAdminMember,
  bulkCreateAdminMembers,
  renewAdminMember,
  revokeAdminMember,
  regenerateAdminMemberKey,
  fetchAdminUsers,
  inviteAdminUser,
  updateAdminUserStatus,
  fetchAdminAuditLogs,
  sendMemberInvitations,
  type AdminClient,
  type AdminToken,
  type AdminTtsSession,
  type AdminMember,
  type BulkImportResponse,
  type EmailPayload,
  type AdminUserIdentity,
  type AdminUser,
  type AdminAuditLog,
  type EmailPreviewData,
  type SendInvitationResult,
  type EmailConfigStatus,
} from "../../services/adminService";
import {
  parseCsv,
  parseXlsx,
  validateMemberRows,
  get12MembersCsvText,
  type ValidationSummary,
} from "../../services/memberImportParser";

interface AdminDashboardProps {
  onBackToStudio: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToStudio }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUserIdentity | null>(null);
  const [emailConfig, setEmailConfig] = useState<EmailConfigStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"members" | "admins" | "audit" | "clients" | "tokens" | "operations" | "billing">("members");

  const manualEmail = emailConfig?.deliveryMode === "manual" || !emailConfig?.isLive;
  const serverEmailReady = emailConfig?.isLive === true;
  const isOwner = adminUser?.role === "owner";
  const isOperator = adminUser?.role === "operator";
  const [operatorKey, setOperatorKey] = useState<string | null>(null);

  // Login form state
  const [loginMode, setLoginMode] = useState<"token" | "credentials" | "key">("key");
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const loginInputRef = useRef<HTMLInputElement>(null);

  // Data states
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [lastSheetSync, setLastSheetSync] = useState<BillingSyncInfo|null>(null);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [tokens, setTokens] = useState<AdminToken[]>([]);
  const [operations, setOperations] = useState<AdminTtsSession[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);

  // Member search & filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [planFilter, setPlanFilter] = useState<"all" | "monthly" | "annual">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "invited" | "active" | "expired" | "revoked">("all");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  // Bulk Importer Modal State
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkParsing, setBulkParsing] = useState<boolean>(false);
  const [bulkParseError, setBulkParseError] = useState<string | null>(null);
  const [bulkValidation, setBulkValidation] = useState<ValidationSummary | null>(null);
  const [bulkImporting, setBulkImporting] = useState<boolean>(false);
  const [bulkImportResult, setBulkImportResult] = useState<BulkImportResponse | null>(null);

  // Single Member Modal State
  const [showMemberModal, setShowMemberModal] = useState<boolean>(false);
  const [newMemberName, setNewMemberName] = useState<string>("");
  const [newMemberEmail, setNewMemberEmail] = useState<string>("");
  const [newMemberPlan, setNewMemberPlan] = useState<"monthly" | "annual">("monthly");
  const [creatingMember, setCreatingMember] = useState<boolean>(false);

  // Member Action Modals
  const [renewTarget, setRenewTarget] = useState<AdminMember | null>(null);
  const [renewPlan, setRenewPlan] = useState<"monthly" | "annual">("monthly");
  const [isRenewing, setIsRenewing] = useState<boolean>(false);

  const [revokeTarget, setRevokeTarget] = useState<AdminMember | null>(null);
  const [isRevoking, setIsRevoking] = useState<boolean>(false);

  const [detailTarget, setDetailTarget] = useState<AdminMember | null>(null);
  const [generatedInvite, setGeneratedInvite] = useState<{ link: string; payload: EmailPayload } | null>(null);

  // Email Experience 02 Modals & States
  const [previewTarget, setPreviewTarget] = useState<AdminMember | null>(null);
  const [needsActionFilter, setNeedsActionFilter] = useState(false);
  const [emailHandedOff, setEmailHandedOff] = useState(false);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [trackingFeedback, setTrackingFeedback] = useState("");
  const [emailTrackingTarget, setEmailTrackingTarget] = useState<{ member: AdminMember; sent: boolean } | null>(null);
  const trackingInFlight = useRef(false);
  const [previewData, setPreviewData] = useState<EmailPreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [previewViewMode, setPreviewViewMode] = useState<"html" | "text">("html");
  const [isSendingFromPreview, setIsSendingFromPreview] = useState<boolean>(false);

  const [showBulkSendConfirm, setShowBulkSendConfirm] = useState<boolean>(false);
  const [isBulkSending, setIsBulkSending] = useState<boolean>(false);
  const [bulkSendSummary, setBulkSendSummary] = useState<SendInvitationResult | null>(null);
  const [sendingMemberId, setSendingMemberId] = useState<string | null>(null);

  // Admin Management Modals (OWNER Only)
  const [showInviteAdminModal, setShowInviteAdminModal] = useState<boolean>(false);
  const [newAdminName, setNewAdminName] = useState<string>("");
  const [newAdminEmail, setNewAdminEmail] = useState<string>("");
  const [newAdminRole, setNewAdminRole] = useState<"admin" | "owner">("admin");
  const [isInvitingAdmin, setIsInvitingAdmin] = useState<boolean>(false);
  const [createdAdminInvite, setCreatedAdminInvite] = useState<{ link: string; token: string; name: string } | null>(null);
  const [isUpdatingAdminId, setIsUpdatingAdminId] = useState<string | null>(null);

  // Legacy Modals
  const [showClientModal, setShowClientModal] = useState<boolean>(false);
  const [clientName, setClientName] = useState<string>("");
  const [clientEmail, setClientEmail] = useState<string>("");

  const [showTokenModal, setShowTokenModal] = useState<boolean>(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [tokenLabel, setTokenLabel] = useState<string>("");

  const [oneTimeToken, setOneTimeToken] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // 1. Initial Auth Check
  useEffect(() => {
    fetchAdminSession()
      .then((session) => {
        setIsAuthenticated(session.authenticated);
        setAdminUser(session.admin || null);
        setEmailConfig(session.email || null);
        setLoading(false);
      })
      .catch(() => {
        setIsAuthenticated(false);
        setAdminUser(null);
        setEmailConfig(null);
        setLoading(false);
      });
  }, []);

  // 2. Load Data on Auth
  const loadData = async () => {
    setDataError(null);
    try {
      if (activeTab === "members") {
        const data = await fetchAdminMembers();
        setMembers(data);
        if (isOwner || isOperator) setLastSheetSync(await fetchSheetSyncStatus());
      } else if (activeTab === "admins" && adminUser?.role === "owner") {
        const users = await fetchAdminUsers();
        setAdminUsers(users);
      } else if (activeTab === "audit" && adminUser?.role === "owner") {
        const logs = await fetchAdminAuditLogs();
        setAuditLogs(logs);
      } else if (activeTab === "clients") {
        const data = await fetchAdminClients();
        setClients(data);
      } else if (activeTab === "tokens") {
        const data = await fetchAdminTokens();
        setTokens(data);
      } else if (activeTab === "operations") {
        const data = await fetchAdminTtsOperations();
        setOperations(data);
      }
    } catch (err) {
      setDataError((err as Error).message);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, activeTab]);

  async function refreshAfterSheetSync() {
    const [freshMembers, sync] = await Promise.all([fetchAdminMembers(), fetchSheetSyncStatus()]);
    setMembers(freshMembers);setLastSheetSync(sync);
  }

  // 3. Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      let ok = false;
      if (loginMode !== "credentials") {
        const tokenVal = loginInputRef.current?.value || "";
        if (!tokenVal.trim()) return;
        if (loginInputRef.current) loginInputRef.current.value = "";
        ok = await loginAdmin(loginMode === "key" ? { adminKey: tokenVal.trim() } : tokenVal.trim());
        if (loginInputRef.current) loginInputRef.current.value = "";
      } else {
        if (!loginEmail.trim() || !loginPassword) return;
        ok = await loginAdmin({ email: loginEmail.trim(), password: loginPassword });
        setLoginPassword("");
      }

      if (ok) {
        const session = await fetchAdminSession();
        setAdminUser(session.admin || null);
        setEmailConfig(session.email || null);
        setIsAuthenticated(true);
      } else {
        setLoginError("Credencial administrativa inválida.");
      }
    } catch (err) {
      if (loginInputRef.current) loginInputRef.current.value = "";
      setLoginPassword("");
      setLoginError((err as Error).message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 4. Handle Logout
  const handleLogout = async () => {
    try { await logoutAdmin(); }
    catch (err) { setDataError((err as Error).message); return; }
    setOperatorKey(null);
    setPreviewTarget(null);
    setPreviewData(null);
    setDetailTarget(null);
    setEmailTrackingTarget(null);
    setTrackingFeedback("");
    setEmailHandedOff(false);
    setOneTimeToken(null);
    setGeneratedInvite(null);
    setCreatedAdminInvite(null);
    setSelectedMemberIds(new Set());
    setActiveTab("members");
    setIsAuthenticated(false);
    setAdminUser(null);
    setMembers([]);
    setClients([]);
    setTokens([]);
    setOperations([]);
    setAdminUsers([]);
    setAuditLogs([]);
  };

  // ── Legacy Client Handlers ────────────────────────────────────────────────
  const handleCreateClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    try {
      await createAdminClient(clientName.trim(), clientEmail.trim() || undefined);
      setShowClientModal(false);
      setClientName("");
      setClientEmail("");
      await loadData();
    } catch (err) {
      setDataError((err as Error).message);
    }
  };

  const handleToggleClientStatus = async (client: AdminClient) => {
    const nextStatus = client.status === "active" ? "suspended" : "active";
    try {
      await updateAdminClientStatus(client.id, nextStatus);
      await loadData();
    } catch (err) {
      setDataError((err as Error).message);
    }
  };

  // ── Legacy Token Handlers ─────────────────────────────────────────────────
  const handleCreateTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) return;
    try {
      const result = await createAdminToken(selectedClientId, tokenLabel.trim() || undefined);
      setShowTokenModal(false);
      setTokenLabel("");
      setOneTimeToken(result.token);
      await loadData();
    } catch (err) {
      setDataError((err as Error).message);
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    if (!window.confirm("¿Estás seguro de que deseas revocar esta Access Key? El cliente perderá acceso inmediatamente.")) {
      return;
    }
    try {
      await revokeAdminToken(tokenId);
      await loadData();
    } catch (err) {
      setDataError((err as Error).message);
    }
  };

  // ── Member Bulk Import Handlers ───────────────────────────────────────────
  const handleFileSelected = async (file: File) => {
    setBulkFile(file);
    setBulkParsing(true);
    setBulkParseError(null);
    setBulkValidation(null);
    setBulkImportResult(null);

    try {
      const existingMembers = await fetchAdminMembers();
      setMembers(existingMembers);

      let parsedRows: any[] = [];
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
        const text = await file.text();
        parsedRows = parseCsv(text);
      } else if (fileName.endsWith(".xlsx")) {
        const buffer = await file.arrayBuffer();
        parsedRows = await parseXlsx(buffer);
      } else {
        throw new Error("Formato no soportado. Por favor sube un archivo .xlsx o .csv.");
      }

      if (parsedRows.length === 0) {
        throw new Error("El archivo no contiene filas de miembros válidas o legibles.");
      }

      const validation = validateMemberRows(parsedRows, existingMembers);
      setBulkValidation(validation);
    } catch (err) {
      setBulkParseError((err as Error).message);
    } finally {
      setBulkParsing(false);
    }
  };

  const handleLoad12Fixture = () => {
    const csv = get12MembersCsvText();
    const parsed = parseCsv(csv);
    const validation = validateMemberRows(parsed, members);
    setBulkValidation(validation);
    setBulkFile(new File([csv], "12_miembros_vigentes.csv", { type: "text/csv" }));
    setBulkParseError(null);
    setBulkImportResult(null);
  };

  const handleConfirmBulkImport = async () => {
    if (!bulkValidation) return;
    setBulkImporting(true);
    setDataError(null);

    try {
      const validRowsToCreate = bulkValidation.rows
        .filter((r) => r.isValid)
        .map((r) => ({
          name: r.name,
          email: r.email,
          accessPlan: r.accessPlan,
        }));

      const res = await bulkCreateAdminMembers(validRowsToCreate);
      setBulkImportResult(res);
      await loadData();
    } catch (err) {
      setDataError((err as Error).message);
    } finally {
      setBulkImporting(false);
    }
  };

  // ── Single Member Create ──────────────────────────────────────────────────
  const handleCreateSingleMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;

    setCreatingMember(true);
    setDataError(null);

    try {
      const res = await createAdminMember(newMemberName.trim(), newMemberEmail.trim(), newMemberPlan);
      setShowMemberModal(false);
      setNewMemberName("");
      setNewMemberEmail("");
      setGeneratedInvite({
        link: res.activationLink,
        payload: res.emailPayload,
      });
      await loadData();
    } catch (err) {
      setDataError((err as Error).message);
    } finally {
      setCreatingMember(false);
    }
  };

  // ── Member Renewal ────────────────────────────────────────────────────────
  const handleConfirmRenew = async () => {
    if (!renewTarget) return;
    setIsRenewing(true);
    setDataError(null);

    try {
      await renewAdminMember(renewTarget.id, renewPlan);
      setRenewTarget(null);
      await loadData();
    } catch (err) {
      setDataError((err as Error).message);
    } finally {
      setIsRenewing(false);
    }
  };

  // ── Member Revocation ─────────────────────────────────────────────────────
  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    setIsRevoking(true);
    setDataError(null);

    try {
      await revokeAdminMember(revokeTarget.id);
      setRevokeTarget(null);
      await loadData();
    } catch (err) {
      setDataError((err as Error).message);
    } finally {
      setIsRevoking(false);
    }
  };

  // ── Member Invitation & Regenerate ────────────────────────────────────────
  const handleRegenerateKey = async (member: AdminMember) => {
    if (!window.confirm(`¿Regenerar GhostAI Key para '${member.name}'? La key actual será revocada y se generará una nueva.`)) {
      return;
    }
    try {
      const res = await regenerateAdminMemberKey(member.id);
      setGeneratedInvite({
        link: res.activationLink,
        payload: res.emailPayload,
      });
      await loadData();
    } catch (err) {
      setDataError((err as Error).message);
    }
  };

  // ── EMAIL EXPERIENCE 02 HANDLERS ─────────────────────────────────────────

  // 1. Preview Email Modal
  const handleOpenEmailPreview = async (member: AdminMember) => {
    setDetailTarget(null);
    setEmailHandedOff(false);
    setTrackingFeedback("");
    setPreviewTarget(member);
    setLoadingPreview(true);
    setDataError(null);
    try {
      setPreviewData(null);
      const data = await prepareManualInvitation(member.id);
      setPreviewData(data);
    } catch (err) {
      setDataError((err as Error).message);
      setPreviewTarget(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleEmailTracking = async (member: AdminMember, sent: boolean, confirmed = false) => {
    if (trackingInFlight.current) return;
    if (!confirmed) { setEmailTrackingTarget({ member, sent }); setTrackingFeedback(""); return; }
    trackingInFlight.current = true;
    setTrackingBusy(true);
    setTrackingFeedback("");
    try {
      const keyId = sent ? previewData?.keyId : member.key_id;
      if (!keyId) throw new Error("Actualiza y prepara el correo de nuevo.");
      const updated = await markMemberEmail(member.id, keyId, sent ? "sent" : "not_sent", sent ? previewData?.expectedSentAt ?? null : member.last_email_sent_at || null);
      setMembers(current => current.map(m => m.id === updated.id ? updated : m));
      setDetailTarget(current => current?.id === updated.id ? updated : current);
      setPreviewTarget(current => current?.id === updated.id ? updated : current);
      setPreviewData(current => current ? { ...current, expectedSentAt: updated.last_email_sent_at || null } : current);
      setEmailHandedOff(false);
      setEmailTrackingTarget(null);
      setTrackingFeedback(sent ? "Envío registrado. GhostAI no envió ningún correo." : "Envío desmarcado. La auditoría se conserva.");
    } catch (err) { setTrackingFeedback((err as Error).message); }
    finally { trackingInFlight.current = false; setTrackingBusy(false); }
  };

  // 2. Send Invitation from Preview Modal
  const handleSendFromPreview = async () => {
    if (!previewTarget) return;
    setIsSendingFromPreview(true);
    setDataError(null);
    try {
      const res = await sendMemberInvitations(previewTarget.id);
      setPreviewTarget(null);
      setPreviewData(null);
      setBulkSendSummary(res);
      await loadData();
    } catch (err) {
      setDataError((err as Error).message);
    } finally {
      setIsSendingFromPreview(false);
    }
  };

  // 3. Single Send directly from Table
  const handleSendSingleDirect = async (member: AdminMember) => {
    if (!serverEmailReady) { await handleOpenEmailPreview(member); return; }
    setSendingMemberId(member.id);
    setDataError(null);
    try {
      const res = await sendMemberInvitations(member.id);
      setBulkSendSummary(res);
      await loadData();
    } catch (err) {
      setDataError((err as Error).message);
    } finally {
      setSendingMemberId(null);
    }
  };

  // 4. Bulk Send Execution (with Rate/Duplicate Click Protection)
  const handleConfirmBulkSend = async () => {
    if (selectedMemberIds.size === 0 || isBulkSending) return;
    setIsBulkSending(true);
    setDataError(null);
    try {
      const res = await sendMemberInvitations(Array.from(selectedMemberIds));
      setShowBulkSendConfirm(false);
      setSelectedMemberIds(new Set());
      setBulkSendSummary(res);
      await loadData();
    } catch (err) {
      setDataError((err as Error).message);
    } finally {
      setIsBulkSending(false);
    }
  };

  // ── OWNER ADMIN MANAGEMENT HANDLERS ───────────────────────────────────────
  const handleInviteAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminName.trim() || !newAdminEmail.trim()) return;

    setIsInvitingAdmin(true);
    setDataError(null);
    try {
      const res = await inviteAdminUser(newAdminName.trim(), newAdminEmail.trim(), newAdminRole);
      setCreatedAdminInvite({
        link: res.activationLink,
        token: res.activationToken,
        name: res.adminUser.name,
      });
      setShowInviteAdminModal(false);
      setNewAdminName("");
      setNewAdminEmail("");
      setNewAdminRole("admin");
      await loadData();
    } catch (err) {
      setDataError((err as Error).message);
    } finally {
      setIsInvitingAdmin(false);
    }
  };

  const handleToggleAdminStatus = async (admin: AdminUser) => {
    const nextStatus = admin.status === "active" ? "disabled" : "active";

    // Validate if trying to disable last owner
    if (nextStatus === "disabled" && admin.role === "owner") {
      const activeOwners = adminUsers.filter((u) => u.role === "owner" && u.status === "active");
      if (activeOwners.length <= 1) {
        alert("Protección de Seguridad: No es posible desactivar al único Owner activo del sistema.");
        return;
      }
    }

    if (!window.confirm(`¿Confirmas ${nextStatus === "active" ? "reactivar" : "desactivar"} a '${admin.name}'?`)) {
      return;
    }

    setIsUpdatingAdminId(admin.id);
    setDataError(null);
    try {
      await updateAdminUserStatus(admin.id, nextStatus);
      await loadData();
    } catch (err) {
      setDataError((err as Error).message);
    } finally {
      setIsUpdatingAdminId(null);
    }
  };

  // Copy helper
  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(id);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (_) {}
  };

  // Filtered members list
  const actionCount = members.filter(m => getMemberOperationalState(m).needsAction).length;
  const filteredMembers = members.filter(m => matchesMemberFilters(m, { search: searchQuery, plan: planFilter, status: statusFilter, needsAction: needsActionFilter }));

  const allSelected =
    filteredMembers.length > 0 &&
    filteredMembers.every((m) => selectedMemberIds.has(m.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedMemberIds(new Set());
    } else {
      const next = new Set<string>();
      filteredMembers.forEach((m) => next.add(m.id));
      setSelectedMemberIds(next);
    }
  };

  const toggleSelectMember = (id: string) => {
    const next = new Set(selectedMemberIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedMemberIds(next);
  };

  // Loading Screen
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#080c14", color: "#e2e8f0" }}>
        <RefreshCw className="animate-spin text-cyan-400" size={32} />
      </div>
    );
  }

  // ── Login Screen ────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#080c14", padding: "1.5rem" }}>
        <div style={{ width: "100%", maxWidth: "420px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", padding: "2rem", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={{ display: "inline-flex", padding: "0.75rem", borderRadius: "50%", background: "rgba(56, 189, 248, 0.1)", color: "#38bdf8", marginBottom: "1rem" }}>
              <Shield size={36} />
            </div>
            <h1 style={{ fontSize: "1.35rem", fontWeight: "bold", color: "#f8fafc", margin: "0 0 0.5rem 0" }}>GHOSTAI ADMIN</h1>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>Consola de gestión de miembros y control de acceso</p>
          </div>

          {/* Login Mode Tabs */}
          <div style={{ display: "flex", background: "#080c14", padding: "0.25rem", borderRadius: "8px", marginBottom: "1.25rem" }}>
            <button type="button" onClick={() => setLoginMode("key")} style={{ flex: 1, color: "#38bdf8", background: "#1e293b", border: 0, borderRadius: "6px", cursor: "pointer" }}>ADMIN KEY</button>
            <button
              type="button"
              onClick={() => setLoginMode("token")}
              style={{ flex: 1, padding: "0.45rem", border: "none", borderRadius: "6px", background: loginMode === "token" ? "#1e293b" : "none", color: loginMode === "token" ? "#38bdf8" : "#64748b", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer" }}
            >
              Master Token
            </button>
            <button
              type="button"
              onClick={() => setLoginMode("credentials")}
              style={{ flex: 1, padding: "0.45rem", border: "none", borderRadius: "6px", background: loginMode === "credentials" ? "#1e293b" : "none", color: loginMode === "credentials" ? "#38bdf8" : "#64748b", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer" }}
            >
              Email & Contraseña
            </button>
          </div>

          {loginError && (
            <div style={{ background: "rgba(244, 63, 94, 0.1)", border: "1px solid #f43f5e", borderRadius: "8px", padding: "0.75rem", color: "#fda4af", fontSize: "0.85rem", marginBottom: "1rem" }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit}>
            {loginMode !== "credentials" ? (
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#cbd5e1", marginBottom: "0.5rem" }}>
                  {loginMode === "key" ? "ADMIN KEY" : "Master Auth Token"}
                </label>
                <input
                  ref={loginInputRef}
                  type="password"
                  placeholder={loginMode === "key" ? "gai_admin_…" : "Introduce la credencial maestra"}
                  autoComplete="off"
                  style={{ width: "100%", padding: "0.65rem 0.85rem", background: "#080c14", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc", fontSize: "0.9rem", boxSizing: "border-box" }}
                  required
                />
                <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.4rem" }}>
                  Se emitirá una sesión HttpOnly temporal con rol de Administrador.
                </p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#cbd5e1", marginBottom: "0.4rem" }}>
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="admin@ghostai.app"
                    autoComplete="email"
                    style={{ width: "100%", padding: "0.65rem 0.85rem", background: "#080c14", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc", fontSize: "0.9rem", boxSizing: "border-box" }}
                    required
                  />
                </div>
                <div style={{ marginBottom: "1.25rem" }}>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#cbd5e1", marginBottom: "0.4rem" }}>
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Tu contraseña personal"
                    autoComplete="current-password"
                    style={{ width: "100%", padding: "0.65rem 0.85rem", background: "#080c14", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc", fontSize: "0.9rem", boxSizing: "border-box" }}
                    required
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              style={{ width: "100%", padding: "0.75rem", background: "#0284c7", border: "none", borderRadius: "8px", color: "#ffffff", fontWeight: "600", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem" }}
            >
              {isLoggingIn ? <RefreshCw className="animate-spin" size={16} /> : <Lock size={16} />}
              <span>{isLoggingIn ? "Verificando..." : "Ingresar a Admin"}</span>
            </button>
          </form>

          <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
            <button
              onClick={onBackToStudio}
              style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "0.85rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <ArrowLeft size={14} /> Volver a GhostAI Studio
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Authenticated Admin Console ─────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080c14", color: "#e2e8f0", display: "flex", flexDirection: "column", fontFamily: "'Outfit', sans-serif" }}>
      {/* Top Navbar */}
      <header className="admin-navbar" style={{ borderBottom: "1px solid #1e293b", background: "#0f172a", padding: "0.75rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", minWidth: 0 }}>
          <button
            onClick={onBackToStudio}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.75rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#cbd5e1", fontSize: "0.8rem", cursor: "pointer" }}
          >
            <ArrowLeft size={14} /> Volver a Studio
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", minWidth: 0 }}>
            <Shield className="text-cyan-400" size={20} />
            <span style={{ fontWeight: "800", fontSize: "1.1rem", letterSpacing: "0.05em", color: "#f8fafc" }}>GHOSTAI ADMIN</span>
            
            {/* Role Badge */}
            {adminUser?.role === "owner" ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", padding: "0.15rem 0.6rem", background: "linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(99, 102, 241, 0.25) 100%)", border: "1px solid #a855f7", color: "#c084fc", borderRadius: "4px", fontWeight: "800", letterSpacing: "0.04em" }}>
                <Crown size={12} /> OWNER
              </span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", padding: "0.15rem 0.6rem", background: "rgba(56, 189, 248, 0.15)", border: "1px solid #38bdf8", color: "#38bdf8", borderRadius: "4px", fontWeight: "700" }}>
                {isOperator ? "OPERATOR" : "ADMIN"}
              </span>
            )}

            {/* Email Provider Indicator Badge (Section 12: EMAIL: LIVE / SANDBOX) */}
            <span
              id="admin-email-status-badge"
              title={
                emailConfig?.isLive
                  ? `Proveedor activo: ${emailConfig.provider.toUpperCase()} (${emailConfig.sender})`
                  : "Prepara y copia el correo con la key para enviarlo desde tu cuenta."
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                fontSize: "0.75rem",
                padding: "0.15rem 0.6rem",
                borderRadius: "4px",
                fontWeight: "700",
                letterSpacing: "0.04em",
                background: emailConfig?.isLive ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                border: emailConfig?.isLive ? "1px solid #10b981" : "1px solid #f59e0b",
                color: emailConfig?.isLive ? "#34d399" : "#fbbf24",
              }}
            >
              <Mail size={12} />
              EMAIL: {serverEmailReady ? "LIVE" : "ENVÍO MANUAL"}
            </span>

            {/* Admin identity display */}
            <span style={{ fontSize: "0.8rem", color: "#94a3b8", marginLeft: "0.25rem" }}>
              {adminUser?.name || adminUser?.email || "Master"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            onClick={handleLogout}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.75rem", background: "rgba(244, 63, 94, 0.15)", border: "1px solid #f43f5e", borderRadius: "6px", color: "#fda4af", fontSize: "0.8rem", cursor: "pointer" }}
          >
            <LogOut size={14} /> Cerrar Sesión Admin
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ maxWidth: "1280px", width: "100%", margin: "0 auto", padding: "1.5rem", flex: 1 }}>
        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid #1e293b", marginBottom: "1.5rem", overflowX: "auto" }}>
          <button
            onClick={() => setActiveTab("members")}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem", border: "none", background: "none", borderBottom: activeTab === "members" ? "2px solid #38bdf8" : "2px solid transparent", color: activeTab === "members" ? "#38bdf8" : "#94a3b8", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            <Users size={16} /> MIEMBROS ({members.length})
          </button>

          {(isOwner || isOperator) && <button onClick={() => setActiveTab("billing")} style={{ display: "flex", alignItems: "center", padding: "0.6rem 1.25rem", border: "none", background: "none", borderBottom: activeTab === "billing" ? "2px solid #73dcd6" : "2px solid transparent", color: activeTab === "billing" ? "#9af5df" : "#94a3b8", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}>FACTURACIÓN</button>}
          {/* Tab: ADMINISTRADORES (Visible ONLY to OWNER) */}
          {adminUser?.role === "owner" && (
            <button
              onClick={() => setActiveTab("admins")}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem", border: "none", background: "none", borderBottom: activeTab === "admins" ? "2px solid #a855f7" : "2px solid transparent", color: activeTab === "admins" ? "#c084fc" : "#94a3b8", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              <Crown size={16} /> ADMINISTRADORES ({adminUsers.length})
            </button>
          )}

          {/* Tab: AUDITORÍA (Visible ONLY to OWNER) */}
          {adminUser?.role === "owner" && (
            <button
              onClick={() => setActiveTab("audit")}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem", border: "none", background: "none", borderBottom: activeTab === "audit" ? "2px solid #a855f7" : "2px solid transparent", color: activeTab === "audit" ? "#c084fc" : "#94a3b8", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              <FileText size={16} /> AUDITORÍA ({auditLogs.length})
            </button>
          )}

          {!isOperator && (<button
            onClick={() => setActiveTab("clients")}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem", border: "none", background: "none", borderBottom: activeTab === "clients" ? "2px solid #38bdf8" : "2px solid transparent", color: activeTab === "clients" ? "#38bdf8" : "#94a3b8", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            <Users size={16} /> CLIENTES ({clients.length})
          </button>)}
          {!isOperator && (<button
            onClick={() => setActiveTab("tokens")}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem", border: "none", background: "none", borderBottom: activeTab === "tokens" ? "2px solid #38bdf8" : "2px solid transparent", color: activeTab === "tokens" ? "#38bdf8" : "#94a3b8", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            <Key size={16} /> TOKENS ({tokens.length})
          </button>)}
          {!isOperator && (<button
            onClick={() => setActiveTab("operations")}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem", border: "none", background: "none", borderBottom: activeTab === "operations" ? "2px solid #38bdf8" : "2px solid transparent", color: activeTab === "operations" ? "#38bdf8" : "#94a3b8", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            <Activity size={16} /> OPERACIÓN TTS ({operations.length})
          </button>)}
        </div>

        {activeTab === "billing" && (isOwner || isOperator) && <BillingDashboard isOwner={isOwner} onSynced={refreshAfterSheetSync} />}
        {dataError && (
          <div style={{ background: "rgba(244, 63, 94, 0.1)", border: "1px solid #f43f5e", borderRadius: "8px", padding: "0.75rem", color: "#fda4af", marginBottom: "1.5rem" }}>
            {dataError}
          </div>
        )}

        {/* ── TAB: MIEMBROS (PRIMARY) ────────────────────────────────────── */}
        {activeTab === "members" && (
          <div>
            {(isOwner || isOperator) && <div className="billing"><SheetSyncControl isOwner={isOwner} sync={lastSheetSync} onSynced={refreshAfterSheetSync}/></div>}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <button aria-pressed={needsActionFilter} onClick={() => setNeedsActionFilter(true)} style={{ color: "#fcd34d", background: needsActionFilter ? "#422006" : "#1e293b", border: "1px solid #a16207", borderRadius: "7px", padding: "0.65rem", fontWeight: 750, cursor: "pointer" }}>NECESITAN ACCIÓN: {actionCount}</button>
              {needsActionFilter && <><span style={{ color: "#fcd34d", fontSize: "0.8rem" }}>Filtro NECESITA ACCIÓN activo</span><button onClick={() => setNeedsActionFilter(false)} style={{ color: "#cbd5e1", background: "#1e293b", border: "1px solid #475569", padding: "0.5rem", borderRadius: "6px", cursor: "pointer" }}>Mostrar todos</button></>}
            </div>
            {/* Top Toolbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 0, flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: 1, maxWidth: "340px" }}>
                  <Search size={15} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o correo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem 0.75rem 0.5rem 2.25rem", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "6px", color: "#f8fafc", fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>

                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value as any)}
                  style={{ padding: "0.5rem 0.75rem", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "6px", color: "#f8fafc", fontSize: "0.85rem" }}
                >
                  <option value="all">Todos los planes</option>
                  <option value="monthly">Mensual</option>
                  <option value="annual">Anual</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  style={{ padding: "0.5rem 0.75rem", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "6px", color: "#f8fafc", fontSize: "0.85rem" }}
                >
                  <option value="all">Todos los estados</option>
                  <option value="pending">PENDING</option>
                  <option value="invited">INVITED</option>
                  <option value="active">ACTIVE</option>
                  <option value="expired">EXPIRED</option>
                  <option value="revoked">REVOKED</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {selectedMemberIds.size > 0 && (
                  <button
                    onClick={async () => { try { await auditBulkPreview(Array.from(selectedMemberIds)); setShowBulkSendConfirm(true); } catch (err) { setDataError((err as Error).message); } }}
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", background: "linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer" }}
                  >
                    <Send size={15} /> {!serverEmailReady ? "PREPARAR CORREOS" : "ENVIAR INVITACIONES"} ({selectedMemberIds.size})
                  </button>
                )}

                {isOwner && (<button
                  onClick={() => {
                    setBulkFile(null);
                    setBulkValidation(null);
                    setBulkParseError(null);
                    setBulkImportResult(null);
                    setShowBulkModal(true);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer" }}
                >
                  <Upload size={15} /> IMPORTAR MIEMBROS
                </button>)}

                {isOwner && (<button
                  onClick={() => setShowMemberModal(true)}
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0.85rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#cbd5e1", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer" }}
                >
                  <Plus size={15} /> Nuevo Miembro
                </button>)}
              </div>
            </div>

            {/* Members Table */}
            <p className="admin-table-scroll-hint">Desliza la tabla hacia los lados para ver el estado y las acciones.</p>
            <div className="admin-member-table" role="region" aria-label="Tabla de miembros, desplazamiento horizontal" tabIndex={0} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", minWidth: "1000px" }}>
                <thead>
                  <tr style={{ background: "#1e293b", color: "#94a3b8", textAlign: "left" }}>
                    <th style={{ width: "36px", padding: "0.75rem 0.5rem 0.75rem 1rem" }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        style={{ cursor: "pointer" }}
                      />
                    </th>
                    <th style={{ padding: "0.75rem 0.75rem" }}>Nombre</th>
                    <th style={{ padding: "0.75rem 0.75rem" }}>Correo</th>
                    <th style={{ padding: "0.75rem 0.75rem" }}>Plan</th>
                    <th style={{ padding: "0.75rem 0.75rem" }}>Estado</th>
                    <th style={{ padding: "0.75rem 0.75rem" }}>Acción / estado operativo</th>
                    <th style={{ padding: "0.75rem 0.75rem" }}>Key</th>
                    <th style={{ padding: "0.75rem 0.75rem" }}>Vence</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
                        No se encontraron miembros registrados. Haz clic en "IMPORTAR MIEMBROS" para cargar la lista.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m) => {
                      const isSelected = selectedMemberIds.has(m.id);
                      const isSending = sendingMemberId === m.id;
                      const maskedKey = m.tokenPublicId
                        ? `gai_live_${m.tokenPublicId.slice(0, 4)}••••`
                        : "GHOSTAI-••••-ABCD";

                      // Member Status badge
                      const statusBadge = {
                        pending: { bg: "rgba(148, 163, 184, 0.15)", text: "#94a3b8" },
                        invited: { bg: "rgba(56, 189, 248, 0.15)", text: "#38bdf8" },
                        active: { bg: "rgba(16, 185, 129, 0.15)", text: "#34d399" },
                        expired: { bg: "rgba(245, 158, 11, 0.15)", text: "#fbbf24" },
                        revoked: { bg: "rgba(244, 63, 94, 0.15)", text: "#fda4af" },
                      }[m.status] || { bg: "#1e293b", text: "#94a3b8" };

                      return (
                        <tr key={m.id} style={{ borderTop: "1px solid #1e293b", background: isSelected ? "rgba(2, 132, 199, 0.08)" : undefined }}>
                          <td style={{ padding: "0.75rem 0.5rem 0.75rem 1rem" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectMember(m.id)}
                              style={{ cursor: "pointer" }}
                            />
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", fontWeight: "700", color: "#f8fafc" }}>
                            <span
                              onClick={() => setDetailTarget(m)}
                              style={{ cursor: "pointer", borderBottom: "1px dotted #38bdf8" }}
                              title="Ver ficha del miembro"
                            >
                              {m.name}
                            </span>
                            {lastSheetSync?.metadata.notInSheetMemberIds?.includes(m.id) && <small style={{display:"block",color:"#fcd34d",fontSize:"0.65rem",marginTop:"0.3rem"}}>NO ESTÁ EN TABLA ACTUAL</small>}
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", color: "#94a3b8" }}>{m.email}</td>
                          <td style={{ padding: "0.75rem 0.75rem" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.2rem 0.5rem",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: "bold",
                                background: m.access_plan === "annual" ? "rgba(168, 85, 247, 0.15)" : "rgba(56, 189, 248, 0.15)",
                                color: m.access_plan === "annual" ? "#c084fc" : "#38bdf8",
                              }}
                            >
                              {m.access_plan === "annual" ? "Anual" : "Mensual"}
                            </span>
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.2rem 0.5rem",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: "800",
                                background: statusBadge.bg,
                                color: statusBadge.text,
                                letterSpacing: "0.03em",
                              }}
                            >
                              {m.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem" }}>
                            <MemberOperationalBadge member={m} />
                            <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.25rem" }}>{m.last_email_status === "sent" && m.last_email_sent_at ? "CORREO ENVIADO" : m.last_email_status === "failed" ? "ERROR DE CORREO" : "CORREO NO ENVIADO"}</div>
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", fontFamily: "monospace", fontSize: "0.8rem", color: "#94a3b8" }}>
                            {maskedKey}
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", color: "#cbd5e1", fontSize: "0.8rem" }}>
                            {m.expires_at ? new Date(m.expires_at).toLocaleDateString() : "—"}
                          </td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
                              {/* Preview Email Button */}
                              <button
                                onClick={() => { setDetailTarget(m); setTrackingFeedback(""); }}
                                title="Ver detalle y operación del miembro"
                                style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "0.3rem 0.5rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "4px", color: "#38bdf8", fontSize: "0.75rem", cursor: "pointer" }}
                              >
                                <Eye size={12} />
                                <span>Detalle</span>
                              </button>

                              {!isOperator && (<button onClick={async () => { try { const link = manualEmail ? (await prepareManualInvitation(m.id)).activationLink : await createInvitationLink(m.id); await navigator.clipboard.writeText(link); setCopiedLink(m.id); } catch (err) { setDataError((err as Error).message); } }} style={{ color: "#38bdf8", background: "#1e293b", border: "1px solid #334155", borderRadius: "4px", cursor: "pointer" }}>{copiedLink === m.id ? "Copiado" : "Copiar enlace"}</button>)}
                              {/* Direct Send Invitation Button */}
                              <button
                                onClick={() => handleSendSingleDirect(m)}
                                disabled={isSending}
                                title={!serverEmailReady ? "Ver entrega segura preparada" : "Enviar invitación por correo ahora"}
                                style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "0.3rem 0.5rem", background: "#0284c7", border: "none", borderRadius: "4px", color: "#ffffff", fontSize: "0.75rem", cursor: isSending ? "not-allowed" : "pointer" }}
                              >
                                {isSending ? <RefreshCw className="animate-spin" size={12} /> : <Send size={12} />}
                                <span>{isSending ? "Enviando..." : !serverEmailReady ? "Preparar correo" : "Enviar"}</span>
                              </button>

                              {!isOperator && (<button
                                onClick={() => {
                                  setRenewTarget(m);
                                  setRenewPlan(m.access_plan);
                                }}
                                title="Renovar suscripción (+1M / +1Y)"
                                style={{ padding: "0.3rem 0.5rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "4px", color: "#34d399", fontSize: "0.75rem", cursor: "pointer" }}
                              >
                                Renovar
                              </button>)}

                              {m.status !== "revoked" && !isOperator ? (<button
                                  onClick={() => setRevokeTarget(m)}
                                  title="Revocar acceso"
                                  style={{ padding: "0.3rem 0.5rem", background: "rgba(244, 63, 94, 0.1)", border: "1px solid #f43f5e", borderRadius: "4px", color: "#fda4af", fontSize: "0.75rem", cursor: "pointer" }}
                                >
                                  Revocar
                                </button>
                              ) : m.status === "revoked" ? (
                                <span style={{ fontSize: "0.75rem", color: "#f43f5e" }}>Revocado</span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB: ADMINISTRADORES (Visible ONLY to OWNER) ───────────────── */}
        {activeTab === "admins" && adminUser?.role === "owner" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", margin: 0, fontWeight: "700", color: "#f8fafc", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Crown className="text-purple-400" size={20} /> Gestión de Administradores
                </h2>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
                  Control de roles RBAC (Owner / Admin) y generación de invitaciones de un solo uso.
                </p>
              </div>

              <button
                onClick={() => {
                  setCreatedAdminInvite(null);
                  setShowInviteAdminModal(true);
                }}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer" }}
              >
                <Plus size={16} /> INVITAR ADMINISTRADOR
              </button>
            </div>

            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#1e293b", color: "#94a3b8", textAlign: "left" }}>
                    <th style={{ padding: "0.75rem 1rem" }}>Nombre</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Correo</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Rol</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Estado</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Creado / Invitado</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Último Acceso</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((u) => {
                    const isLastActiveOwner =
                      u.role === "owner" &&
                      u.status === "active" &&
                      adminUsers.filter((a) => a.role === "owner" && a.status === "active").length <= 1;

                    const roleBadge = u.role === "owner"
                      ? { bg: "rgba(168, 85, 247, 0.15)", text: "#c084fc", label: "OWNER" }
                      : { bg: "rgba(56, 189, 248, 0.15)", text: "#38bdf8", label: u.role === "operator" ? "OPERATOR" : "ADMIN" };

                    const statusBadge = {
                      active: { bg: "rgba(16, 185, 129, 0.15)", text: "#34d399", label: "ACTIVO" },
                      pending: { bg: "rgba(245, 158, 11, 0.15)", text: "#fbbf24", label: "PENDIENTE" },
                      disabled: { bg: "rgba(244, 63, 94, 0.15)", text: "#fda4af", label: "DESACTIVADO" },
                    }[u.status] || { bg: "#1e293b", text: "#94a3b8", label: u.status };

                    return (
                      <tr key={u.id} style={{ borderTop: "1px solid #1e293b" }}>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: "700", color: "#f8fafc" }}>{u.name}</td>
                        <td style={{ padding: "0.75rem 1rem", color: "#94a3b8" }}>{u.email}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{ display: "inline-block", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold", background: roleBadge.bg, color: roleBadge.text }}>
                            {roleBadge.label}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{ display: "inline-block", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold", background: statusBadge.bg, color: statusBadge.text }}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: "#94a3b8" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: "0.75rem 1rem", color: "#94a3b8" }}>
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Nunca"}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          {u.role === "operator" && <><button onClick={async () => { if (!window.confirm("Rotar la admin key invalidará la anterior y sus sesiones. ¿Continuar?")) return; try { const r = await manageOperatorKey("rotate", u.id); setOperatorKey(r.key || null); } catch (err) { setDataError((err as Error).message); } }}>Rotar admin key</button><button onClick={async () => { if (!window.confirm("Revocar la admin key y sus sesiones. ¿Continuar?")) return; try { await manageOperatorKey("revoke", u.id); } catch (err) { setDataError((err as Error).message); } }}>Revocar admin key</button></>}
                          {u.status === "active" ? (
                            <button
                              onClick={() => handleToggleAdminStatus(u)}
                              disabled={isLastActiveOwner || isUpdatingAdminId === u.id}
                              title={isLastActiveOwner ? "No es posible desactivar al único Owner activo del sistema" : "Desactivar acceso"}
                              style={{ padding: "0.25rem 0.6rem", background: isLastActiveOwner ? "#1e293b" : "rgba(244, 63, 94, 0.15)", border: `1px solid ${isLastActiveOwner ? "#334155" : "#f43f5e"}`, borderRadius: "4px", color: isLastActiveOwner ? "#64748b" : "#fda4af", fontSize: "0.75rem", cursor: isLastActiveOwner ? "not-allowed" : "pointer" }}
                            >
                              {isUpdatingAdminId === u.id ? "Procesando..." : "Desactivar"}
                            </button>
                          ) : u.status === "disabled" ? (
                            <button
                              onClick={() => handleToggleAdminStatus(u)}
                              disabled={isUpdatingAdminId === u.id}
                              style={{ padding: "0.25rem 0.6rem", background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", borderRadius: "4px", color: "#34d399", fontSize: "0.75rem", cursor: "pointer" }}
                            >
                              {isUpdatingAdminId === u.id ? "Procesando..." : "Reactivar"}
                            </button>
                          ) : (
                            <span style={{ fontSize: "0.75rem", color: "#fbbf24" }}>Pendiente Activación</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB: AUDITORÍA (Visible ONLY to OWNER) ─────────────────────── */}
        {activeTab === "audit" && adminUser?.role === "owner" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", margin: 0, fontWeight: "700", color: "#f8fafc", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <FileText className="text-cyan-400" size={20} /> Registro de Auditoría de Administradores
                </h2>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
                  Historial inmutable de acciones administrativas: quién realizó cada operación y sobre qué miembro/recurso.
                </p>
              </div>

              <button
                onClick={loadData}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.8rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#cbd5e1", fontSize: "0.8rem", cursor: "pointer" }}
              >
                <RefreshCw size={14} /> Actualizar
              </button>
            </div>

            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#1e293b", color: "#94a3b8", textAlign: "left" }}>
                    <th style={{ padding: "0.75rem 1rem" }}>Fecha / Hora</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Administrador</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Acción</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Destino</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: "2.5rem", textAlign: "center", color: "#64748b" }}>
                        No hay registros de auditoría recientes.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} style={{ borderTop: "1px solid #1e293b" }}>
                        <td style={{ padding: "0.75rem 1rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: "600", color: "#f8fafc" }}>
                          <div>{log.admin_email}</div>
                          <span style={{ fontSize: "0.7rem", color: log.admin_role === "owner" ? "#c084fc" : "#38bdf8", fontWeight: "700" }}>
                            {log.admin_role.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{ display: "inline-block", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontFamily: "monospace", background: "#1e293b", color: "#38bdf8" }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "#94a3b8", fontSize: "0.8rem" }}>
                          {log.target_id ? log.target_id.slice(0, 8) + "..." : "—"}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: "#cbd5e1", fontSize: "0.8rem" }}>
                          {log.metadata ? JSON.stringify(log.metadata) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB: CLIENTES (LEGACY) ────────────────────────────────────────── */}
        {activeTab === "clients" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.1rem", margin: 0, fontWeight: "600" }}>Directorio de Clientes Gateway</h2>
              <button
                onClick={() => setShowClientModal(true)}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", background: "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer" }}
              >
                <Plus size={16} /> Crear Cliente
              </button>
            </div>

            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#1e293b", color: "#94a3b8", textAlign: "left" }}>
                    <th style={{ padding: "0.75rem 1rem" }}>Nombre</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Email</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Estado</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Creado</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Tokens Activos</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Último Uso</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} style={{ borderTop: "1px solid #1e293b" }}>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: "600", color: "#f8fafc" }}>{c.name}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#94a3b8" }}>{c.email || "—"}</td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span style={{ display: "inline-block", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold", background: c.status === "active" ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)", color: c.status === "active" ? "#34d399" : "#fda4af" }}>
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#94a3b8" }}>{new Date(c.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#cbd5e1" }}>{c.activeTokensCount ?? 0}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#94a3b8" }}>{c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleString() : "Nunca"}</td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                        <button
                          onClick={() => handleToggleClientStatus(c)}
                          style={{ padding: "0.25rem 0.6rem", background: c.status === "active" ? "rgba(244, 63, 94, 0.15)" : "rgba(16, 185, 129, 0.15)", border: `1px solid ${c.status === "active" ? "#f43f5e" : "#10b981"}`, borderRadius: "4px", color: c.status === "active" ? "#fda4af" : "#34d399", fontSize: "0.75rem", cursor: "pointer" }}
                        >
                          {c.status === "active" ? "Suspender" : "Activar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB: TOKENS (LEGACY) ─────────────────────────────────────────── */}
        {activeTab === "tokens" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.1rem", margin: 0, fontWeight: "600" }}>Access Tokens</h2>
              {isOwner && (<button
                onClick={() => {
                  if (clients.length > 0) setSelectedClientId(clients[0].id);
                  setShowTokenModal(true);
                }}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", background: "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer" }}
              >
                <Plus size={16} /> Generar Key Manual
              </button>)}
            </div>

            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#1e293b", color: "#94a3b8", textAlign: "left" }}>
                    <th style={{ padding: "0.75rem 1rem" }}>Cliente</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Label</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Public ID</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Estado</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Creado</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Expira</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Último Uso</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((t) => (
                    <tr key={t.id} style={{ borderTop: "1px solid #1e293b" }}>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: "600", color: "#f8fafc" }}>{t.clientName}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#cbd5e1" }}>{t.label || "Sin etiqueta"}</td>
                      <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "#38bdf8" }}>
                        gai_live_{t.tokenPublicId.slice(0, 8)}••••••••
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span style={{ display: "inline-block", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold", background: t.status === "active" ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)", color: t.status === "active" ? "#34d399" : "#fda4af" }}>
                          {t.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#94a3b8" }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#94a3b8" }}>{t.expiresAt ? new Date(t.expiresAt).toLocaleDateString() : "Permanente"}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#94a3b8" }}>{t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : "Nunca"}</td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                        {t.status === "active" && (
                          <button
                            onClick={() => handleRevokeToken(t.id)}
                            style={{ padding: "0.25rem 0.6rem", background: "rgba(244, 63, 94, 0.15)", border: "1px solid #f43f5e", borderRadius: "4px", color: "#fda4af", fontSize: "0.75rem", cursor: "pointer" }}
                          >
                            Revocar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB: OPERACIÓN TTS (AUDIT) ──────────────────────────────────── */}
        {activeTab === "operations" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "1.1rem", margin: 0, fontWeight: "600" }}>Auditoría de Sesiones TTS</h2>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  Supervisión de recuperación y descargas. Vista estricta de metadata (sin audio ni texto).
                </p>
              </div>
              <button
                onClick={loadData}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.8rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#cbd5e1", fontSize: "0.8rem", cursor: "pointer" }}
              >
                <RefreshCw size={14} /> Actualizar
              </button>
            </div>

            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#1e293b", color: "#94a3b8", textAlign: "left" }}>
                    <th style={{ padding: "0.75rem 1rem" }}>Cliente</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Session ID</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Proyecto</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Estado</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Audios</th>
                    <th style={{ padding: "0.75rem 1rem" }}>ZIP Status</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.map((op) => (
                    <tr key={op.id} style={{ borderTop: "1px solid #1e293b" }}>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: "600", color: "#f8fafc" }}>{op.clientName}</td>
                      <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "#94a3b8" }}>{op.id.slice(0, 8)}...</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#cbd5e1" }}>{op.projectTitle}</td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span style={{ display: "inline-block", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold", background: op.status === "ready" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)", color: op.status === "ready" ? "#34d399" : "#fbbf24" }}>
                          {op.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#f8fafc" }}>{op.readyCount} / {op.itemCount}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#94a3b8" }}>{op.zipStatus.toUpperCase()}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#94a3b8" }}>{new Date(op.createdAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: EMAIL PREVIEW (SECTION 9) ─────────────────────────────────── */}
      {emailTrackingTarget && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="tracking-email-title" aria-describedby="tracking-email-description"
          onClick={event => { if (event.target === event.currentTarget && !trackingInFlight.current) setEmailTrackingTarget(null); }}
          onKeyDown={event => { if (event.key === "Escape" && !trackingInFlight.current) { event.stopPropagation(); setEmailTrackingTarget(null); } }}
          style={{ position: "fixed", inset: 0, zIndex: 200, display: "grid", placeItems: "center", padding: "1rem", background: "#080c14ee" }}>
          <div style={{ width: "min(460px, 100%)", maxHeight: "90vh", overflowY: "auto", overflowWrap: "anywhere", padding: "1.5rem", border: "1px solid #64748b", borderRadius: "10px", background: "#0f172a" }}>
            <h3 id="tracking-email-title">{emailTrackingTarget.sent ? "¿Registrar este envío?" : "¿Desmarcar este envío?"}</h3>
            <p><strong>{emailTrackingTarget.member.name}</strong><br />{emailTrackingTarget.member.email}</p>
            <p id="tracking-email-description" style={{ color: "#cbd5e1" }}>{emailTrackingTarget.sent
              ? "Confirma solo si ya enviaste este correo desde tu cuenta. GhostAI registrará el envío y tu identidad en auditoría; no enviará ningún correo."
              : "Se marcará como no enviado. El correo externo no se puede retirar. La corrección quedará en auditoría."}</p>
            {trackingFeedback && <p role="status">{trackingFeedback}</p>}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button autoFocus disabled={trackingBusy} onClick={() => setEmailTrackingTarget(null)} style={{ minHeight: "44px", padding: "0.65rem", color: "#e2e8f0", border: "1px solid #475569", borderRadius: "6px", background: "#1e293b" }}>Cancelar</button>
              <button disabled={trackingBusy} onClick={() => handleEmailTracking(emailTrackingTarget.member, emailTrackingTarget.sent, true)} style={{ minHeight: "44px", padding: "0.65rem", border: 0, borderRadius: "6px", background: "#0369a1", color: "white" }}>{trackingBusy ? "GUARDANDO..." : emailTrackingTarget.sent ? "CONFIRMAR ENVÍO" : "CONFIRMAR DESMARCADO"}</button>
            </div>
          </div>
        </div>
      )}
      {previewTarget && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", zIndex: 140 }}>
          <div style={{ width: "100%", maxWidth: "720px", maxHeight: "90vh", background: "#0f172a", border: "1px solid #0284c7", borderRadius: "12px", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)" }}>
            {/* Header */}
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Mail className="text-cyan-400" size={20} />
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: "700", color: "#f8fafc" }}>
                  Preparar correo — {previewTarget.name}
                </h3>
              </div>
              <button
                onClick={() => {
                  setPreviewTarget(null);
                  setPreviewData(null);
                }}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "1.5rem", overflowY: "auto", flex: 1 }}>
              {loadingPreview ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
                  <RefreshCw className="animate-spin text-cyan-400" size={28} style={{ margin: "0 auto 0.5rem auto" }} />
                  <p style={{ margin: 0 }}>Generando plantilla HTML profesional de GhostAI...</p>
                </div>
              ) : previewData ? (
                <>
                  {/* Meta box */}
                  <div style={{ background: "#080c14", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.85rem" }}>
                    <div style={{ marginBottom: "0.35rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ color: "#64748b", fontWeight: "700", width: "80px" }}>PARA:</span>
                      <span style={{ color: "#f8fafc" }}>{previewData.to}</span>
                    </div>
                    <div style={{ marginBottom: "0.35rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ color: "#64748b", fontWeight: "700", width: "80px" }}>ASUNTO:</span>
                      <span style={{ color: "#38bdf8", fontWeight: "600" }}>{previewData.subject}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ color: "#64748b", fontWeight: "700", width: "80px" }}>PREHEADER:</span>
                      <span style={{ color: "#94a3b8" }}>{previewData.preheader}</span>
                    </div>
                  </div>

                  <MemberOperationDetails member={previewTarget} busy={trackingBusy} onUndo={() => handleEmailTracking(previewTarget, false)} />
                  <p style={{ color: "#7dd3fc", fontSize: "0.85rem" }}>Tipo de correo: {previewData.emailType ? EMAIL_TYPE_LABELS[previewData.emailType] : "Acceso"}</p>
                  {previewData.requiresServerDelivery ? <div role="status" style={{ border: "1px solid #0284c7", padding: "1rem", borderRadius: "8px", marginBottom: "1rem" }}><p>La GhostAI Key se incluye en el correo de este miembro.</p><p>{serverEmailReady ? "Revisa el destinatario antes de enviar." : "Entrega preparada. OWNER debe configurar el proveedor de correo antes de enviar."}</p></div> : manualEmail && <ManualInvitationActions key={previewTarget.id} email={previewData} onHandoff={() => setEmailHandedOff(true)} />}
                  {manualEmail && <div style={{ margin: "1rem 0", padding: "0.85rem", border: "1px solid #334155", borderRadius: "8px" }}><p style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>Cuando hayas enviado el correo desde tu cuenta, registra la confirmación aquí. Copiar o abrir tu correo no lo marca como enviado.</p><button disabled={!emailHandedOff || trackingBusy || !previewData.keyId} onClick={() => handleEmailTracking(previewTarget, true)} style={{ padding: "0.65rem", border: 0, borderRadius: "6px", background: emailHandedOff ? "#047857" : "#334155", color: "#fff", cursor: emailHandedOff && !trackingBusy ? "pointer" : "not-allowed" }}>{trackingBusy ? "GUARDANDO..." : "MARCAR COMO ENVIADO"}</button></div>}
                  {trackingFeedback && <p role="status" style={{ color: "#7dd3fc" }}>{trackingFeedback}</p>}

                  {/* Format Toggle */}
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <button
                      onClick={() => setPreviewViewMode("html")}
                      style={{ padding: "0.35rem 0.75rem", borderRadius: "4px", border: "none", background: previewViewMode === "html" ? "#0284c7" : "#1e293b", color: "#ffffff", fontSize: "0.75rem", fontWeight: "600", cursor: "pointer" }}
                    >
                      HTML Render (Cuerpo Real)
                    </button>
                    <button
                      onClick={() => setPreviewViewMode("text")}
                      style={{ padding: "0.35rem 0.75rem", borderRadius: "4px", border: "none", background: previewViewMode === "text" ? "#0284c7" : "#1e293b", color: "#ffffff", fontSize: "0.75rem", fontWeight: "600", cursor: "pointer" }}
                    >
                      Plain Text Fallback
                    </button>
                  </div>

                  {/* Render Area */}
                  {previewViewMode === "html" ? (
                    <div style={{ border: "1px solid #1e293b", borderRadius: "8px", overflow: "hidden", background: "#050811" }}>
                      <iframe
                        title="Email HTML Preview"
                        srcDoc={previewData.html}
                        sandbox="allow-same-origin"
                        style={{ width: "100%", height: "380px", border: "none", display: "block" }}
                      />
                    </div>
                  ) : (
                    <div style={{ background: "#050811", border: "1px solid #1e293b", borderRadius: "8px", padding: "1rem", maxHeight: "380px", overflowY: "auto" }}>
                      <pre style={{ margin: 0, color: "#cbd5e1", fontSize: "0.85rem", whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                        {previewData.text}
                      </pre>
                    </div>
                  )}

                  <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#64748b" }}>
                    Guarda la key y envía este correo únicamente al miembro indicado.
                  </div>
                </>
              ) : null}
            </div>

            {/* Footer */}
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #1e293b", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => {
                  setPreviewTarget(null);
                  setPreviewData(null);
                }}
                style={{ padding: "0.5rem 1rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#cbd5e1", fontSize: "0.85rem", cursor: "pointer" }}
              >
                Cerrar
              </button>
              {serverEmailReady && (<button
                type="button"
                disabled={isSendingFromPreview || loadingPreview || !previewData?.deliveryReady}
                onClick={handleSendFromPreview}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1.25rem", background: "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "700", fontSize: "0.85rem", cursor: isSendingFromPreview ? "not-allowed" : "pointer" }}
              >
                {isSendingFromPreview ? <RefreshCw className="animate-spin" size={14} /> : <Send size={14} />}
                <span>{isSendingFromPreview ? "Enviando..." : "ENVIAR INVITACIÓN"}</span>
              </button>)}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: BULK SEND CONFIRMATION (SECTION 10 & 15) ──────────────────── */}
      {showBulkSendConfirm && manualEmail && (<div role="dialog" aria-label="Preparar correos seleccionados" style={{ position: "fixed", inset: 0, background: "#080c14ee", zIndex: 135, display: "grid", placeItems: "center", padding: "1rem" }}><div style={{ background: "#0f172a", border: "1px solid #0284c7", borderRadius: "12px", padding: "1.5rem", width: "min(640px, 95vw)", maxHeight: "85vh", overflowY: "auto" }}><h2>Preparar correos seleccionados</h2><p>Abre cada invitación para copiarla o enviarla desde tu correo. Cada persona recibe su propio enlace; no se envía nada automáticamente.</p>{members.filter(m => selectedMemberIds.has(m.id)).map(m => <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", margin: "0.75rem 0" }}><span>{m.name}<br /><small>{m.email}</small></span><button onClick={() => handleOpenEmailPreview(m)}>Preparar correo</button></div>)}<button onClick={() => setShowBulkSendConfirm(false)}>Cerrar sin enviar</button></div></div>)}

      {showBulkSendConfirm && !manualEmail && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 140 }}>
          <div style={{ width: "100%", maxWidth: "540px", background: "#0f172a", border: "1px solid #0284c7", borderRadius: "12px", padding: "1.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
              <Send className="text-cyan-400" size={24} />
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700", color: "#f8fafc" }}>
                Confirmar Envío de Invitaciones
              </h3>
            </div>

            <p style={{ margin: "0 0 1rem 0", fontSize: "0.9rem", color: "#cbd5e1" }}>
              Vas a enviar <strong>{selectedMemberIds.size} invitaciones</strong> por correo electrónico profesional de GhostAI.
            </p>

            {/* List of recipients */}
            <div style={{ maxHeight: "200px", overflowY: "auto", background: "#080c14", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.75rem", marginBottom: "1rem" }}>
              {members
                .filter((m) => selectedMemberIds.has(m.id))
                .map((m) => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.35rem 0", borderBottom: "1px solid #1e293b", fontSize: "0.8rem" }}>
                    <span style={{ color: "#f8fafc", fontWeight: "600" }}>{m.name}</span>
                    <span style={{ color: "#94a3b8" }}>{m.email}</span>
                  </div>
                ))}
            </div>

            <div style={{ background: "rgba(56, 189, 248, 0.08)", border: "1px solid #0284c7", borderRadius: "6px", padding: "0.75rem", fontSize: "0.8rem", color: "#93c5fd", marginBottom: "1.25rem" }}>
              ✓ Procesamiento individual por miembro (seguridad batch). Si un correo falla, los demás continúan.<br />
              ✓ Cuerpo HTML dark premium sin adjuntos .html.<br />
              ✓ La key personal está incluida en el correo del miembro.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                disabled={isBulkSending}
                onClick={() => setShowBulkSendConfirm(false)}
                style={{ padding: "0.5rem 1rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#cbd5e1", fontSize: "0.85rem", cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isBulkSending}
                onClick={handleConfirmBulkSend}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1.25rem", background: isBulkSending ? "#334155" : "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "700", fontSize: "0.85rem", cursor: isBulkSending ? "not-allowed" : "pointer" }}
              >
                {isBulkSending ? <RefreshCw className="animate-spin" size={14} /> : <Send size={14} />}
                <span>{isBulkSending ? "ENVIANDO..." : "ENVIAR"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: BULK SEND SUMMARY / RESULTS (SECTION 11 & 14) ─────────────── */}
      {bulkSendSummary && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 140 }}>
          <div style={{ width: "100%", maxWidth: "560px", maxHeight: "85vh", background: "#0f172a", border: "1px solid #10b981", borderRadius: "12px", padding: "1.75rem", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <CheckCircle2 className="text-emerald-400" size={22} />
                <h4 style={{ margin: 0, fontSize: "1.2rem", color: "#f8fafc", fontWeight: "bold" }}>
                  Resultado del Envío
                </h4>
              </div>
              <button
                onClick={() => setBulkSendSummary(null)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Counts badges */}
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem" }}>
              <div style={{ flex: 1, background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", borderRadius: "8px", padding: "0.75rem", textAlign: "center" }}>
                <span style={{ display: "block", fontSize: "1.3rem", fontWeight: "bold", color: "#34d399" }}>
                  {bulkSendSummary.succeededCount}
                </span>
                <span style={{ fontSize: "0.75rem", color: "#a7f3d0" }}>ENVIADOS</span>
              </div>
              {bulkSendSummary.failedCount > 0 && (
                <div style={{ flex: 1, background: "rgba(244, 63, 94, 0.15)", border: "1px solid #f43f5e", borderRadius: "8px", padding: "0.75rem", textAlign: "center" }}>
                  <span style={{ display: "block", fontSize: "1.3rem", fontWeight: "bold", color: "#fda4af" }}>
                    {bulkSendSummary.failedCount}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#fecdd3" }}>FALLARON</span>
                </div>
              )}
            </div>

            {/* Detailed per-recipient list */}
            <div style={{ maxHeight: "240px", overflowY: "auto", background: "#080c14", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.75rem", marginBottom: "1.25rem" }}>
              {bulkSendSummary.succeeded.map((s, idx) => (
                <div key={`s_${idx}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0", borderBottom: "1px solid #1e293b", fontSize: "0.8rem" }}>
                  <div>
                    <span style={{ color: "#f8fafc", fontWeight: "600", display: "block" }}>{s.email}</span>
                    <span style={{ color: "#64748b", fontSize: "0.75rem" }}>ID: {s.memberId.slice(0, 8)}...</span>
                  </div>
                  <span style={{ color: "#34d399", fontWeight: "700" }}>✓ ENVIADO</span>
                </div>
              ))}
              {bulkSendSummary.failed.map((f, idx) => (
                <div key={`f_${idx}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0", borderBottom: "1px solid #1e293b", fontSize: "0.8rem" }}>
                  <div>
                    <span style={{ color: "#fda4af", fontWeight: "600", display: "block" }}>{f.email || f.memberId}</span>
                    <span style={{ color: "#64748b", fontSize: "0.75rem" }}>ID: {f.memberId.slice(0, 8)}...</span>
                  </div>
                  <span style={{ color: "#fda4af", fontWeight: "700" }} title={f.error}>✗ {f.error}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setBulkSendSummary(null)}
                style={{ padding: "0.5rem 1.25rem", background: "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "700", cursor: "pointer" }}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: INVITAR NUEVO ADMINISTRADOR (OWNER ONLY) ─────────────────── */}
      {showInviteAdminModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 130 }}>
          <div style={{ width: "100%", maxWidth: "480px", background: "#0f172a", border: "1px solid #a855f7", borderRadius: "12px", padding: "1.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Crown className="text-purple-400" size={22} />
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700", color: "#f8fafc" }}>
                  Nuevo Administrador
                </h3>
              </div>
              <button
                onClick={() => setShowInviteAdminModal(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: "0 0 1rem 0", fontSize: "0.85rem", color: "#94a3b8" }}>
              Se generará una invitación criptográfica de un solo uso. No se almacena ninguna contraseña fija visible.
            </p>

            <form onSubmit={handleInviteAdminSubmit}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "0.4rem" }}>
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="Ej: Arturo QA"
                  required
                  style={{ width: "100%", padding: "0.6rem", background: "#080c14", border: "1px solid #334155", borderRadius: "6px", color: "#f8fafc", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "0.4rem" }}>
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="admin@smartbrain.lat"
                  required
                  style={{ width: "100%", padding: "0.6rem", background: "#080c14", border: "1px solid #334155", borderRadius: "6px", color: "#f8fafc", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "0.4rem" }}>
                  Rol Asignado
                </label>
                <select
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value as any)}
                  style={{ width: "100%", padding: "0.6rem", background: "#080c14", border: "1px solid #334155", borderRadius: "6px", color: "#f8fafc", boxSizing: "border-box" }}
                >
                  <option value="admin">ADMIN (Gestión de miembros e invitaciones; sin acceso a secretos ni gestión de Owner)</option>
                  <option value="owner">OWNER (Control total y gestión de administradores)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowInviteAdminModal(false)}
                  style={{ padding: "0.5rem 1rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#cbd5e1", cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isInvitingAdmin}
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1.25rem", background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "700", cursor: isInvitingAdmin ? "not-allowed" : "pointer" }}
                >
                  {isInvitingAdmin ? <RefreshCw className="animate-spin" size={14} /> : <Crown size={14} />}
                  <span>{isInvitingAdmin ? "Generando..." : "Crear Invitación"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ENLACE DE ACTIVACIÓN DE ADMIN GENERADO ─────────────────────── */}
      {createdAdminInvite && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 140 }}>
          <div style={{ width: "100%", maxWidth: "520px", background: "#0f172a", border: "2px solid #a855f7", borderRadius: "12px", padding: "1.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem", color: "#c084fc" }}>
              <Crown size={24} />
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "bold" }}>
                Invitación de Administrador Lista
              </h3>
            </div>

            <p style={{ color: "#cbd5e1", fontSize: "0.85rem", lineHeight: "1.4", margin: "0 0 1rem 0" }}>
              Se ha creado la invitación para <strong>{createdAdminInvite.name}</strong>. Comparte este enlace personal de un solo uso para que establezca su contraseña segura:
            </p>

            <div style={{ background: "#080c14", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.75rem", marginBottom: "1.25rem", wordBreak: "break-all", fontFamily: "monospace", fontSize: "0.85rem", color: "#38bdf8" }}>
              {createdAdminInvite.link}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={() => handleCopyText(createdAdminInvite.link, "admin_invite_link")}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.6rem 1.25rem", background: copiedLink === "admin_invite_link" ? "#10b981" : "#a855f7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "600", cursor: "pointer" }}
              >
                {copiedLink === "admin_invite_link" ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedLink === "admin_invite_link" ? "¡Enlace Copiado!" : "COPIAR ENLACE"}</span>
              </button>

              <button
                onClick={() => setCreatedAdminInvite(null)}
                style={{ padding: "0.6rem 1.25rem", background: "#334155", border: "none", borderRadius: "6px", color: "#f8fafc", fontWeight: "600", cursor: "pointer" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: BULK MEMBER IMPORTER ───────────────────────────────────────── */}
      {showBulkModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", zIndex: 120 }}>
          <div style={{ width: "100%", maxWidth: "860px", maxHeight: "90vh", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)" }}>
            {/* Header */}
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Upload className="text-cyan-400" size={20} />
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700", color: "#f8fafc" }}>
                  IMPORTAR MIEMBROS EN LOTE
                </h3>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "1.5rem", overflowY: "auto", flex: 1 }}>
              {!bulkImportResult ? (
                <>
                  {/* Dropzone */}
                  <div
                    style={{
                      border: "2px dashed #334155",
                      borderRadius: "10px",
                      padding: "1.75rem",
                      textAlign: "center",
                      background: "#080c14",
                      marginBottom: "1.25rem",
                      position: "relative",
                    }}
                  >
                    <FileSpreadsheet className="text-cyan-400" size={36} style={{ margin: "0 auto 0.75rem auto" }} />
                    <h4 style={{ margin: "0 0 0.35rem 0", fontSize: "1rem", color: "#f8fafc" }}>
                      Arrastra tu archivo .xlsx o .csv aquí
                    </h4>
                    <p style={{ margin: "0 0 1rem 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                      Columnas requeridas: <strong>NOMBRE</strong>, <strong>CORREO</strong>, <strong>Tipo de Acceso</strong> (Mensual / Anual)
                    </p>

                    <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          padding: "0.5rem 1rem",
                          background: "#0284c7",
                          borderRadius: "6px",
                          color: "#ffffff",
                          fontSize: "0.85rem",
                          fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        <Upload size={14} /> Seleccionar Archivo
                        <input
                          type="file"
                          accept=".xlsx,.csv,.txt"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileSelected(e.target.files[0]);
                            }
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={handleLoad12Fixture}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          padding: "0.5rem 1rem",
                          background: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: "6px",
                          color: "#cbd5e1",
                          fontSize: "0.85rem",
                          fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        <Sparkles size={14} className="text-cyan-400" /> Cargar 12 Miembros Vigentes (Demostración)
                      </button>
                    </div>

                    {bulkFile && (
                      <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#38bdf8" }}>
                        Archivo seleccionado: <strong>{bulkFile.name}</strong>
                      </div>
                    )}

                    {bulkParsing && (
                      <div style={{ marginTop: "1rem", color: "#38bdf8", fontSize: "0.85rem" }}>
                        <RefreshCw className="animate-spin" size={16} style={{ display: "inline", marginRight: "0.4rem" }} />
                        Validando estructura y duplicados...
                      </div>
                    )}
                  </div>

                  {bulkParseError && (
                    <div style={{ background: "rgba(244, 63, 94, 0.1)", border: "1px solid #f43f5e", borderRadius: "8px", padding: "0.75rem", color: "#fda4af", marginBottom: "1.25rem", fontSize: "0.85rem" }}>
                      {bulkParseError}
                    </div>
                  )}

                  {/* Validation Summary */}
                  {bulkValidation && (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
                        <div style={{ background: "#080c14", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.75rem", textAlign: "center" }}>
                          <span style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#f8fafc" }}>{bulkValidation.total}</span>
                          <span style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8" }}>Total Filas</span>
                        </div>
                        <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid #10b981", borderRadius: "8px", padding: "0.75rem", textAlign: "center" }}>
                          <span style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#34d399" }}>{bulkValidation.validCount}</span>
                          <span style={{ display: "block", fontSize: "0.75rem", color: "#a7f3d0" }}>Válidas para Importar</span>
                        </div>
                        <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid #f59e0b", borderRadius: "8px", padding: "0.75rem", textAlign: "center" }}>
                          <span style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#fbbf24" }}>{bulkValidation.existingCount}</span>
                          <span style={{ display: "block", fontSize: "0.75rem", color: "#fde68a" }}>Duplicados</span>
                        </div>
                        <div style={{ background: "rgba(244, 63, 94, 0.1)", border: "1px solid #f43f5e", borderRadius: "8px", padding: "0.75rem", textAlign: "center" }}>
                          <span style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#fda4af" }}>{bulkValidation.errorCount}</span>
                          <span style={{ display: "block", fontSize: "0.75rem", color: "#fecdd3" }}>Errores</span>
                        </div>
                      </div>

                      {/* Preview Rows Table */}
                      <div style={{ border: "1px solid #1e293b", borderRadius: "8px", overflow: "hidden", maxHeight: "240px", overflowY: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                          <thead>
                            <tr style={{ background: "#1e293b", color: "#94a3b8", textAlign: "left" }}>
                              <th style={{ padding: "0.5rem 0.75rem" }}>Nombre</th>
                              <th style={{ padding: "0.5rem 0.75rem" }}>Correo</th>
                              <th style={{ padding: "0.5rem 0.75rem" }}>Plan</th>
                              <th style={{ padding: "0.5rem 0.75rem" }}>Estado Validación</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkValidation.rows.map((r, idx) => (
                              <tr key={idx} style={{ borderTop: "1px solid #1e293b", background: r.isValid ? undefined : "rgba(244, 63, 94, 0.05)" }}>
                                <td style={{ padding: "0.5rem 0.75rem", fontWeight: "600", color: "#f8fafc" }}>{r.name || "—"}</td>
                                <td style={{ padding: "0.5rem 0.75rem", color: "#94a3b8" }}>{r.email || "—"}</td>
                                <td style={{ padding: "0.5rem 0.75rem" }}>
                                  <span style={{ padding: "0.15rem 0.4rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold", background: r.accessPlan === "annual" ? "rgba(168, 85, 247, 0.15)" : "rgba(56, 189, 248, 0.15)", color: r.accessPlan === "annual" ? "#c084fc" : "#38bdf8" }}>
                                    {r.accessPlan === "annual" ? "Anual" : "Mensual"}
                                  </span>
                                </td>
                                <td style={{ padding: "0.5rem 0.75rem" }}>
                                  {r.isValid ? (
                                    <span style={{ color: "#34d399", fontWeight: "600" }}>✓ Listo</span>
                                  ) : (
                                    <span style={{ color: "#fda4af" }}>{r.errorMessage || r.validationStatus}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Import Success Result */
                <div>
                  <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
                    <div style={{ display: "inline-flex", padding: "0.75rem", borderRadius: "50%", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", marginBottom: "0.75rem" }}>
                      <CheckCircle2 size={40} />
                    </div>
                    <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "1.25rem", color: "#f8fafc" }}>
                      ¡Importación en Lote Completada!
                    </h4>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>
                      Se crearon {bulkImportResult.summary.newCount} miembros nuevos y se generaron sus credenciales correspondientes.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #1e293b", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              {!bulkImportResult ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(false)}
                    style={{ padding: "0.5rem 1rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#cbd5e1", fontSize: "0.85rem", cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!bulkValidation || bulkValidation.validCount === 0 || bulkImporting}
                    onClick={handleConfirmBulkImport}
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1.25rem", background: "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "700", fontSize: "0.85rem", cursor: bulkImporting ? "not-allowed" : "pointer" }}
                  >
                    {bulkImporting ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
                    <span>{bulkImporting ? "Importando..." : `Confirmar e Importar (${bulkValidation?.validCount ?? 0})`}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  style={{ padding: "0.5rem 1.25rem", background: "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "700", cursor: "pointer" }}
                >
                  Cerrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: NUEVO MIEMBRO INDIVIDUAL ───────────────────────────────────── */}
      {showMemberModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 120 }}>
          <div style={{ width: "100%", maxWidth: "440px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", color: "#f8fafc", fontWeight: "bold" }}>
              Registrar Nuevo Miembro
            </h3>
            <form onSubmit={handleCreateSingleMember}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "0.4rem" }}>Nombre Completo *</label>
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Ej: Laura Martínez"
                  required
                  style={{ width: "100%", padding: "0.6rem", background: "#080c14", border: "1px solid #334155", borderRadius: "6px", color: "#f8fafc", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "0.4rem" }}>Correo Electrónico *</label>
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="laura@empresa.com"
                  required
                  style={{ width: "100%", padding: "0.6rem", background: "#080c14", border: "1px solid #334155", borderRadius: "6px", color: "#f8fafc", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "0.4rem" }}>Tipo de Plan *</label>
                <select
                  value={newMemberPlan}
                  onChange={(e) => setNewMemberPlan(e.target.value as any)}
                  style={{ width: "100%", padding: "0.6rem", background: "#080c14", border: "1px solid #334155", borderRadius: "6px", color: "#f8fafc", boxSizing: "border-box" }}
                >
                  <option value="monthly">Mensual (30 días)</option>
                  <option value="annual">Anual (365 días)</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  style={{ padding: "0.5rem 1rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#cbd5e1", cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingMember}
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", background: "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "600", cursor: creatingMember ? "not-allowed" : "pointer" }}
                >
                  {creatingMember ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={14} />}
                  <span>{creatingMember ? "Creando..." : "Crear Miembro"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: RENOVAR ACCESO ──────────────────────────────────────────────── */}
      {renewTarget && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 120 }}>
          <div style={{ width: "100%", maxWidth: "420px", background: "#0f172a", border: "1px solid #10b981", borderRadius: "10px", padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem", color: "#f8fafc" }}>Renovar Suscripción de Miembro</h3>
            <p style={{ margin: "0 0 1rem 0", fontSize: "0.85rem", color: "#94a3b8" }}>
              Renovar el acceso para <strong>{renewTarget.name}</strong> ({renewTarget.email}).
            </p>
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "0.4rem" }}>Periodo de Renovación</label>
              <select
                value={renewPlan}
                onChange={(e) => setRenewPlan(e.target.value as any)}
                style={{ width: "100%", padding: "0.6rem", background: "#080c14", border: "1px solid #334155", borderRadius: "6px", color: "#f8fafc", boxSizing: "border-box" }}
              >
                <option value="monthly">Extender +1 Mes (30 días)</option>
                <option value="annual">Extender +1 Año (365 días)</option>
              </select>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setRenewTarget(null)}
                style={{ padding: "0.5rem 1rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#cbd5e1", cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isRenewing}
                onClick={handleConfirmRenew}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", background: "#10b981", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "600", cursor: isRenewing ? "not-allowed" : "pointer" }}
              >
                {isRenewing ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
                <span>{isRenewing ? "Renovando..." : "Confirmar Renovación"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: REVOCAR ACCESO ──────────────────────────────────────────────── */}
      {revokeTarget && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 120 }}>
          <div style={{ width: "100%", maxWidth: "440px", background: "#0f172a", border: "1px solid #f43f5e", borderRadius: "10px", padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#f43f5e", marginBottom: "0.75rem" }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "bold" }}>Revocar Acceso Inmediato</h3>
            </div>
            <p style={{ margin: "0 0 1rem 0", fontSize: "0.85rem", color: "#e2e8f0", lineHeight: "1.4" }}>
              ¿Estás seguro de que deseas revocar el acceso a <strong>{revokeTarget.name}</strong> ({revokeTarget.email})?
              La GhostAI Key asociada será invalidada de inmediato y no podrá realizar peticiones TTS.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                style={{ padding: "0.5rem 1rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#cbd5e1", cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isRevoking}
                onClick={handleConfirmRevoke}
                style={{ padding: "0.5rem 1rem", background: "#e11d48", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "600", cursor: isRevoking ? "not-allowed" : "pointer" }}
              >
                {isRevoking ? "Revocando..." : "Sí, Revocar Acceso"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: FICHA DETALLADA DEL MIEMBRO ─────────────────────────────────── */}
      {detailTarget && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 120 }}>
          <div style={{ width: "100%", maxWidth: "600px", maxHeight: "90vh", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", overflowY: "auto", padding: "1.75rem", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid #1e293b", paddingBottom: "0.75rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#f8fafc", fontWeight: "bold" }}>
                  Ficha de Miembro
                </h3>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>ID: {detailTarget.id}</span>
              </div>
              <button
                onClick={() => setDetailTarget(null)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Attributes Grid */}
            <MemberOperationDetails member={detailTarget} busy={trackingBusy} onUndo={() => handleEmailTracking(detailTarget, false)} />
            {trackingFeedback && <p role="status" style={{ color: "#7dd3fc" }}>{trackingFeedback}</p>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem", overflowWrap: "anywhere" }}>
              <div style={{ background: "#080c14", border: "1px solid #1e293b", borderRadius: "6px", padding: "0.6rem 0.85rem" }}>
                <span style={{ display: "block", fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Nombre</span>
                <span style={{ fontSize: "0.9rem", fontWeight: "600", color: "#f8fafc" }}>{detailTarget.name}</span>
              </div>

              <div style={{ background: "#080c14", border: "1px solid #1e293b", borderRadius: "6px", padding: "0.6rem 0.85rem" }}>
                <span style={{ display: "block", fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Correo</span>
                <span style={{ fontSize: "0.9rem", color: "#cbd5e1" }}>{detailTarget.email}</span>
              </div>

              <div style={{ background: "#080c14", border: "1px solid #1e293b", borderRadius: "6px", padding: "0.6rem 0.85rem" }}>
                <span style={{ display: "block", fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Plan</span>
                <span style={{ fontSize: "0.9rem", fontWeight: "bold", color: detailTarget.access_plan === "annual" ? "#c084fc" : "#38bdf8" }}>
                  {detailTarget.access_plan === "annual" ? "Anual (365 días)" : "Mensual (30 días)"}
                </span>
              </div>

              <div style={{ background: "#080c14", border: "1px solid #1e293b", borderRadius: "6px", padding: "0.6rem 0.85rem" }}>
                <span style={{ display: "block", fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Estado Actual</span>
                <span style={{ fontSize: "0.9rem", fontWeight: "800", color: detailTarget.status === "active" ? "#34d399" : detailTarget.status === "revoked" ? "#fda4af" : "#fbbf24" }}>
                  {detailTarget.status.toUpperCase()}
                </span>
              </div>

              <div style={{ background: "#080c14", border: "1px solid #1e293b", borderRadius: "6px", padding: "0.6rem 0.85rem" }}>
                <span style={{ display: "block", fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Creado</span>
                <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{new Date(detailTarget.created_at).toLocaleString()}</span>
              </div>

              <div style={{ background: "#080c14", border: "1px solid #1e293b", borderRadius: "6px", padding: "0.6rem 0.85rem" }}>
                <span style={{ display: "block", fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Última Invitación</span>
                <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{detailTarget.invited_at ? new Date(detailTarget.invited_at).toLocaleString() : "No enviada"}</span>
              </div>

              <div style={{ background: "#080c14", border: "1px solid #1e293b", borderRadius: "6px", padding: "0.6rem 0.85rem" }}>
                <span style={{ display: "block", fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Activado</span>
                <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{detailTarget.activated_at ? new Date(detailTarget.activated_at).toLocaleString() : "Pendiente de activación"}</span>
              </div>

              <div style={{ background: "#080c14", border: "1px solid #1e293b", borderRadius: "6px", padding: "0.6rem 0.85rem" }}>
                <span style={{ display: "block", fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Vencimiento</span>
                <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#f8fafc" }}>{detailTarget.expires_at ? new Date(detailTarget.expires_at).toLocaleString() : "—"}</span>
              </div>

              <div style={{ gridColumn: "1 / -1", background: "#080c14", border: "1px solid #1e293b", borderRadius: "6px", padding: "0.6rem 0.85rem" }}>
                <span style={{ display: "block", fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Key ID & Public Hint</span>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#38bdf8" }}>
                    ID: {detailTarget.key_id || "No asignado"} • gai_live_{detailTarget.tokenPublicId?.slice(0, 8) || "••••"}••••
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    Último uso: {detailTarget.lastUsedAt ? new Date(detailTarget.lastUsedAt).toLocaleString() : "Nunca"}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ borderTop: "1px solid #1e293b", paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => {
                    handleOpenEmailPreview(detailTarget);
                    setDetailTarget(null);
                  }}
                  style={{ padding: "0.4rem 0.75rem", background: "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer" }}
                >
                  Ver Email
                </button>

                {!isOperator && (<button
                  onClick={() => {
                    setRenewTarget(detailTarget);
                    setRenewPlan(detailTarget.access_plan);
                    setDetailTarget(null);
                  }}
                  style={{ padding: "0.4rem 0.75rem", background: "#10b981", border: "none", borderRadius: "6px", color: "#ffffff", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer" }}
                >
                  Renovar
                </button>)}

                {isOwner && (<button
                  onClick={() => {
                    handleRegenerateKey(detailTarget);
                    setDetailTarget(null);
                  }}
                  style={{ padding: "0.4rem 0.75rem", background: "#334155", border: "none", borderRadius: "6px", color: "#cbd5e1", fontSize: "0.8rem", cursor: "pointer" }}
                >
                  Regenerar Key
                </button>)}
              </div>

              {detailTarget.status !== "revoked" && !isOperator && (<button
                  onClick={() => {
                    setRevokeTarget(detailTarget);
                    setDetailTarget(null);
                  }}
                  style={{ padding: "0.4rem 0.75rem", background: "rgba(244,63,94,0.15)", border: "1px solid #f43f5e", borderRadius: "6px", color: "#fda4af", fontSize: "0.8rem", cursor: "pointer" }}
                >
                  Revocar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: INVITACIÓN GENERADA / PLANTILLA DE CORREO (LEGACY) ──────────── */}
      {generatedInvite && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 130 }}>
          <div style={{ width: "100%", maxWidth: "520px", background: "#0f172a", border: "1px solid #0284c7", borderRadius: "12px", padding: "1.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Mail className="text-cyan-400" size={20} />
                <h4 style={{ margin: 0, fontSize: "1.15rem", color: "#f8fafc", fontWeight: "bold" }}>
                  Enlace de Invitación Preparado
                </h4>
              </div>
              <button
                onClick={() => setGeneratedInvite(null)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.85rem", color: "#94a3b8" }}>
              El enlace de activación ha sido generado (vigencia de 7 días, un solo uso). Copia la plantilla para enviarla al miembro:
            </p>

            <div style={{ background: "#080c14", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>Asunto:</div>
              <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#f8fafc", marginBottom: "0.75rem" }}>
                {generatedInvite.payload.subject}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>Cuerpo del Correo:</div>
              <pre style={{ margin: 0, fontSize: "0.8rem", color: "#cbd5e1", whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                {generatedInvite.payload.body}
              </pre>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={() => handleCopyText(generatedInvite.payload.body, "invite_body")}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", background: copiedLink === "invite_body" ? "#10b981" : "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer" }}
              >
                {copiedLink === "invite_body" ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedLink === "invite_body" ? "¡Copiada!" : "Copiar Plantilla"}</span>
              </button>

              <button
                onClick={() => handleCopyText(generatedInvite.link, "invite_link_only")}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", background: copiedLink === "invite_link_only" ? "#10b981" : "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#38bdf8", fontSize: "0.85rem", cursor: "pointer" }}
              >
                {copiedLink === "invite_link_only" ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedLink === "invite_link_only" ? "¡Copiado!" : "Copiar Solo Enlace"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ONE-TIME KEY DISPLAY (LEGACY) ─────────────────────────────── */}
      {oneTimeToken && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 140 }}>
          <div style={{ width: "100%", maxWidth: "500px", background: "#0f172a", border: "2px solid #eab308", borderRadius: "12px", padding: "1.75rem", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.75)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "#fbbf24", marginBottom: "1rem" }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: "bold" }}>GUARDA ESTA KEY AHORA</h3>
            </div>

            <p style={{ color: "#e2e8f0", fontSize: "0.85rem", lineHeight: "1.4", margin: "0 0 1rem 0" }}>
              Esta llave de acceso se muestra <strong>UNA SOLA VEZ</strong>. Por seguridad criptográfica, el servidor no almacena el secreto en texto plano.
            </p>

            <div style={{ background: "#020617", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.75rem", marginBottom: "1.25rem", wordBreak: "break-all", fontFamily: "monospace", fontSize: "0.85rem", color: "#38bdf8" }}>
              {oneTimeToken}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(oneTimeToken);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                }}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.6rem 1.25rem", background: copiedKey ? "#10b981" : "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "600", cursor: "pointer" }}
              >
                {copiedKey ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedKey ? "¡Copiada al Portapapeles!" : "COPIAR KEY"}</span>
              </button>

              <button
                onClick={() => setOneTimeToken(null)}
                style={{ padding: "0.6rem 1.25rem", background: "#334155", border: "none", borderRadius: "6px", color: "#f8fafc", fontWeight: "600", cursor: "pointer" }}
              >
                Cerrar y Descartar
              </button>
            </div>
          </div>
        </div>
      )}

      {isOwner && operatorKey && <div role="dialog" aria-label="Nueva admin key" style={{ position: "fixed", inset: 0, background: "#080c14ee", zIndex: 200, display: "grid", placeItems: "center" }}><div style={{ background: "#0f172a", padding: "2rem", maxWidth: "90vw", overflowWrap: "anywhere" }}><h2>Admin key · solo se muestra una vez</h2><code>{operatorKey}</code><p>Guárdala antes de cerrar. El servidor conserva únicamente su hash.</p><button onClick={() => navigator.clipboard.writeText(operatorKey)}>Copiar admin key</button><button onClick={() => setOperatorKey(null)}>Cerrar</button></div></div>}

      {/* ── MODAL: CREAR CLIENTE (LEGACY) ─────────────────────────────────── */}
      {showClientModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 120 }}>
          <div style={{ width: "100%", maxWidth: "400px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", color: "#f8fafc" }}>Crear Nuevo Cliente</h3>
            <form onSubmit={handleCreateClientSubmit}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "0.4rem" }}>Nombre del Cliente *</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ej: Productora Alpha"
                  required
                  style={{ width: "100%", padding: "0.6rem", background: "#080c14", border: "1px solid #334155", borderRadius: "6px", color: "#f8fafc", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "0.4rem" }}>Email de Contacto (Opcional)</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="contacto@alpha.com"
                  style={{ width: "100%", padding: "0.6rem", background: "#080c14", border: "1px solid #334155", borderRadius: "6px", color: "#f8fafc", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  style={{ padding: "0.5rem 1rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#cbd5e1", cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: "0.5rem 1rem", background: "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "600", cursor: "pointer" }}
                >
                  Crear Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: GENERAR KEY MANUAL (LEGACY) ─────────────────────────────── */}
      {showTokenModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 120 }}>
          <div style={{ width: "100%", maxWidth: "420px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", color: "#f8fafc" }}>Generar Access Key Manual</h3>
            <form onSubmit={handleCreateTokenSubmit}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "0.4rem" }}>Cliente Destino *</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  required
                  style={{ width: "100%", padding: "0.6rem", background: "#080c14", border: "1px solid #334155", borderRadius: "6px", color: "#f8fafc", boxSizing: "border-box" }}
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.status})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "0.4rem" }}>Etiqueta de la Key (Opcional)</label>
                <input
                  type="text"
                  value={tokenLabel}
                  onChange={(e) => setTokenLabel(e.target.value)}
                  placeholder="Ej: Llave Principal Editor"
                  style={{ width: "100%", padding: "0.6rem", background: "#080c14", border: "1px solid #334155", borderRadius: "6px", color: "#f8fafc", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowTokenModal(false)}
                  style={{ padding: "0.5rem 1rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#cbd5e1", cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: "0.5rem 1rem", background: "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "600", cursor: "pointer" }}
                >
                  Generar Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
