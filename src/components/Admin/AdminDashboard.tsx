/**
 * @file src/components/Admin/AdminDashboard.tsx
 * Private Administrative Console for GhostAI Access Control, Member Management & TTS Operations.
 * Isolated from normal Studio user views.
 *
 * Implements GHOSTAI MEMBER ACCESS 01:
 *  - Bulk Member Import (.xlsx / .csv) with live validation preview & duplicate detection
 *  - Individual key management & cryptographic invitation links
 *  - Individual member controls: renew (+1M / +1Y), revoke, regenerate key, resend invite
 *  - Ready-to-send email payloads (zero real emails sent)
 *  - Detailed audit inspect modals
 */

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
} from "lucide-react";
import {
  loginAdmin,
  logoutAdmin,
  checkAdminStatus,
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
  inviteAdminMember,
  regenerateAdminMemberKey,
  type AdminClient,
  type AdminToken,
  type AdminTtsSession,
  type AdminMember,
  type BulkImportResponse,
  type EmailPayload,
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
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"members" | "clients" | "tokens" | "operations">("members");

  // Login form state
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const loginInputRef = useRef<HTMLInputElement>(null);

  // Data states
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [tokens, setTokens] = useState<AdminToken[]>([]);
  const [operations, setOperations] = useState<AdminTtsSession[]>([]);
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
  const [bulkConfirming, setBulkConfirming] = useState<boolean>(false);
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

  const [batchInvitesResult, setBatchInvitesResult] = useState<{
    sentCount: number;
    invitations: Array<{ memberId: string; activationLink: string; emailPayload: EmailPayload }>;
  } | null>(null);

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
    checkAdminStatus()
      .then((authed) => {
        setIsAuthenticated(authed);
        setLoading(false);
      })
      .catch(() => {
        setIsAuthenticated(false);
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

  // 3. Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tokenVal = loginInputRef.current?.value || "";
    if (!tokenVal.trim()) return;

    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const ok = await loginAdmin(tokenVal.trim());
      if (loginInputRef.current) {
        loginInputRef.current.value = "";
      }
      if (ok) {
        setIsAuthenticated(true);
      } else {
        setLoginError("Credencial administrativa inválida.");
      }
    } catch (err) {
      if (loginInputRef.current) {
        loginInputRef.current.value = "";
      }
      setLoginError((err as Error).message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 4. Handle Logout
  const handleLogout = async () => {
    await logoutAdmin();
    setIsAuthenticated(false);
    setMembers([]);
    setClients([]);
    setTokens([]);
    setOperations([]);
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
      // Send valid rows to gateway
      const validRowsToCreate = bulkValidation.rows
        .filter((r) => r.isValid)
        .map((r) => ({
          name: r.name,
          email: r.email,
          accessPlan: r.accessPlan,
        }));

      const res = await bulkCreateAdminMembers(validRowsToCreate);
      setBulkImportResult(res);
      setBulkConfirming(false);
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
  const handleResendInvite = async (member: AdminMember) => {
    try {
      const res = await inviteAdminMember(member.id);
      if (res.invitations.length > 0) {
        setGeneratedInvite({
          link: res.invitations[0].activationLink,
          payload: res.invitations[0].emailPayload,
        });
      }
      await loadData();
    } catch (err) {
      setDataError((err as Error).message);
    }
  };

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

  const handleBatchInviteSelected = async () => {
    if (selectedMemberIds.size === 0) return;
    try {
      const res = await inviteAdminMember(Array.from(selectedMemberIds));
      setBatchInvitesResult(res);
      setSelectedMemberIds(new Set());
      await loadData();
    } catch (err) {
      setDataError((err as Error).message);
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
  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      !searchQuery ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPlan =
      planFilter === "all" || m.access_plan === planFilter;

    const matchesStatus =
      statusFilter === "all" || m.status === statusFilter;

    return matchesSearch && matchesPlan && matchesStatus;
  });

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

          {loginError && (
            <div style={{ background: "rgba(244, 63, 94, 0.1)", border: "1px solid #f43f5e", borderRadius: "8px", padding: "0.75rem", color: "#fda4af", fontSize: "0.85rem", marginBottom: "1rem" }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit}>
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#cbd5e1", marginBottom: "0.5rem" }}>
                Admin Auth Credential
              </label>
              <div style={{ position: "relative" }}>
                <input
                  ref={loginInputRef}
                  type="password"
                  placeholder="Introduce la credencial administrativa"
                  autoComplete="off"
                  style={{ width: "100%", padding: "0.65rem 0.85rem", background: "#080c14", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc", fontSize: "0.9rem", boxSizing: "border-box" }}
                  required
                />
              </div>
              <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.4rem" }}>
                La credencial no se almacena en el navegador; se emite una sesión HttpOnly temporal.
              </p>
            </div>

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
      <header style={{ borderBottom: "1px solid #1e293b", background: "#0f172a", padding: "0.75rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            onClick={onBackToStudio}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.75rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#cbd5e1", fontSize: "0.8rem", cursor: "pointer" }}
          >
            <ArrowLeft size={14} /> Volver a Studio
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Shield className="text-cyan-400" size={20} />
            <span style={{ fontWeight: "800", fontSize: "1.1rem", letterSpacing: "0.05em", color: "#f8fafc" }}>GHOSTAI ADMIN</span>
            <span style={{ fontSize: "0.75rem", padding: "0.15rem 0.5rem", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", borderRadius: "4px", fontWeight: "600" }}>MEMBER ACCESS 01</span>
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
        <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid #1e293b", marginBottom: "1.5rem" }}>
          <button
            onClick={() => setActiveTab("members")}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem", border: "none", background: "none", borderBottom: activeTab === "members" ? "2px solid #38bdf8" : "2px solid transparent", color: activeTab === "members" ? "#38bdf8" : "#94a3b8", fontWeight: "700", cursor: "pointer" }}
          >
            <Users size={16} /> MIEMBROS ({members.length})
          </button>
          <button
            onClick={() => setActiveTab("clients")}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem", border: "none", background: "none", borderBottom: activeTab === "clients" ? "2px solid #38bdf8" : "2px solid transparent", color: activeTab === "clients" ? "#38bdf8" : "#94a3b8", fontWeight: "600", cursor: "pointer" }}
          >
            <Users size={16} /> CLIENTES ({clients.length})
          </button>
          <button
            onClick={() => setActiveTab("tokens")}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem", border: "none", background: "none", borderBottom: activeTab === "tokens" ? "2px solid #38bdf8" : "2px solid transparent", color: activeTab === "tokens" ? "#38bdf8" : "#94a3b8", fontWeight: "600", cursor: "pointer" }}
          >
            <Key size={16} /> TOKENS ({tokens.length})
          </button>
          <button
            onClick={() => setActiveTab("operations")}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem", border: "none", background: "none", borderBottom: activeTab === "operations" ? "2px solid #38bdf8" : "2px solid transparent", color: activeTab === "operations" ? "#38bdf8" : "#94a3b8", fontWeight: "600", cursor: "pointer" }}
          >
            <Activity size={16} /> OPERACIÓN TTS ({operations.length})
          </button>
        </div>

        {dataError && (
          <div style={{ background: "rgba(244, 63, 94, 0.1)", border: "1px solid #f43f5e", borderRadius: "8px", padding: "0.75rem", color: "#fda4af", marginBottom: "1.5rem" }}>
            {dataError}
          </div>
        )}

        {/* ── TAB: MIEMBROS (PRIMARY) ────────────────────────────────────── */}
        {activeTab === "members" && (
          <div>
            {/* Top Toolbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: "280px" }}>
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
                    onClick={handleBatchInviteSelected}
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", background: "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer" }}
                  >
                    <Send size={15} /> ENVIAR {selectedMemberIds.size} INVITACIONES
                  </button>
                )}

                <button
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
                </button>

                <button
                  onClick={() => setShowMemberModal(true)}
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0.85rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#cbd5e1", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer" }}
                >
                  <Plus size={15} /> Nuevo Miembro
                </button>
              </div>
            </div>

            {/* Members Table */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
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
                    <th style={{ padding: "0.75rem 0.75rem" }}>Key</th>
                    <th style={{ padding: "0.75rem 0.75rem" }}>Invitación</th>
                    <th style={{ padding: "0.75rem 0.75rem" }}>Activado</th>
                    <th style={{ padding: "0.75rem 0.75rem" }}>Vence</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
                        No se encontraron miembros registrados. Haz clic en "IMPORTAR MIEMBROS" para cargar la lista.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m) => {
                      const isSelected = selectedMemberIds.has(m.id);
                      const maskedKey = m.tokenPublicId
                        ? `gai_live_${m.tokenPublicId.slice(0, 4)}••••`
                        : "GHOSTAI-••••-ABCD";

                      // Status colors
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
                          <td style={{ padding: "0.75rem 0.75rem", fontFamily: "monospace", fontSize: "0.8rem", color: "#94a3b8" }}>
                            {maskedKey}
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", color: "#94a3b8", fontSize: "0.8rem" }}>
                            {m.invited_at ? new Date(m.invited_at).toLocaleDateString() : "No enviada"}
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", color: "#94a3b8", fontSize: "0.8rem" }}>
                            {m.activated_at ? new Date(m.activated_at).toLocaleDateString() : "Pendiente"}
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", color: "#cbd5e1", fontSize: "0.8rem" }}>
                            {m.expires_at ? new Date(m.expires_at).toLocaleDateString() : "—"}
                          </td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
                              <button
                                onClick={() => handleResendInvite(m)}
                                title="Reenviar Invitación / Generar enlace"
                                style={{ padding: "0.3rem 0.5rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "4px", color: "#38bdf8", fontSize: "0.75rem", cursor: "pointer" }}
                              >
                                Invitar
                              </button>

                              <button
                                onClick={() => {
                                  setRenewTarget(m);
                                  setRenewPlan(m.access_plan);
                                }}
                                title="Renovar suscripción (+1M / +1Y)"
                                style={{ padding: "0.3rem 0.5rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "4px", color: "#34d399", fontSize: "0.75rem", cursor: "pointer" }}
                              >
                                Renovar
                              </button>

                              {m.status !== "revoked" ? (
                                <button
                                  onClick={() => setRevokeTarget(m)}
                                  title="Revocar acceso"
                                  style={{ padding: "0.3rem 0.5rem", background: "rgba(244, 63, 94, 0.1)", border: "1px solid #f43f5e", borderRadius: "4px", color: "#fda4af", fontSize: "0.75rem", cursor: "pointer" }}
                                >
                                  Revocar
                                </button>
                              ) : (
                                <span style={{ fontSize: "0.75rem", color: "#f43f5e" }}>Revocado</span>
                              )}

                              <button
                                onClick={() => setDetailTarget(m)}
                                title="Ver detalles"
                                style={{ padding: "0.3rem 0.5rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "4px", color: "#94a3b8", fontSize: "0.75rem", cursor: "pointer" }}
                              >
                                <Eye size={13} />
                              </button>
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
              <button
                onClick={() => {
                  if (clients.length > 0) setSelectedClientId(clients[0].id);
                  setShowTokenModal(true);
                }}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", background: "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer" }}
              >
                <Plus size={16} /> Generar Key Manual
              </button>
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
                          accept=".xlsx,.csv"
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
                          color: "#38bdf8",
                          fontSize: "0.85rem",
                          fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        <Sparkles size={14} /> Cargar Lista Vigente (12 Miembros)
                      </button>
                    </div>

                    {bulkFile && (
                      <div style={{ marginTop: "0.85rem", fontSize: "0.8rem", color: "#38bdf8" }}>
                        Archivo seleccionado: <strong>{bulkFile.name}</strong> ({(bulkFile.size / 1024).toFixed(1)} KB)
                      </div>
                    )}
                  </div>

                  {bulkParsing && (
                    <div style={{ padding: "1.5rem", textAlign: "center", color: "#38bdf8" }}>
                      <RefreshCw className="animate-spin" size={24} style={{ margin: "0 auto 0.5rem auto" }} />
                      <span>Analizando y validando archivo...</span>
                    </div>
                  )}

                  {bulkParseError && (
                    <div style={{ background: "rgba(244, 63, 94, 0.1)", border: "1px solid #f43f5e", borderRadius: "8px", padding: "0.75rem", color: "#fda4af", fontSize: "0.85rem", marginBottom: "1rem" }}>
                      {bulkParseError}
                    </div>
                  )}

                  {/* Validation Summary & Preview Table */}
                  {bulkValidation && (
                    <div>
                      {/* Summary Badges */}
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", padding: "0.75rem 1rem", background: "#080c14", border: "1px solid #1e293b", borderRadius: "8px", marginBottom: "1rem" }}>
                        <div style={{ fontSize: "0.9rem", fontWeight: "700", color: "#f8fafc" }}>
                          {bulkValidation.total} miembros encontrados:
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#38bdf8" }}>
                          <strong>{bulkValidation.monthlyCount}</strong> Mensual
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#c084fc" }}>
                          <strong>{bulkValidation.annualCount}</strong> Anual
                        </div>
                        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
                          <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", background: "rgba(16, 185, 129, 0.15)", color: "#34d399", fontWeight: "bold" }}>
                            {bulkValidation.validCount} Válidos
                          </span>
                          {bulkValidation.existingCount > 0 && (
                            <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", fontWeight: "bold" }}>
                              {bulkValidation.existingCount} Ya Existen
                            </span>
                          )}
                          {bulkValidation.errorCount > 0 && (
                            <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", background: "rgba(244, 63, 94, 0.15)", color: "#fda4af", fontWeight: "bold" }}>
                              {bulkValidation.errorCount} Errores
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Preview Table */}
                      <div style={{ maxHeight: "280px", overflowY: "auto", border: "1px solid #1e293b", borderRadius: "8px" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                          <thead>
                            <tr style={{ background: "#1e293b", color: "#94a3b8", textAlign: "left", position: "sticky", top: 0 }}>
                              <th style={{ padding: "0.6rem 0.75rem" }}>#</th>
                              <th style={{ padding: "0.6rem 0.75rem" }}>NOMBRE</th>
                              <th style={{ padding: "0.6rem 0.75rem" }}>CORREO</th>
                              <th style={{ padding: "0.6rem 0.75rem" }}>ACCESO</th>
                              <th style={{ padding: "0.6rem 0.75rem" }}>VALIDACIÓN</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkValidation.rows.map((r) => {
                              const badgeStyle = r.isValid
                                ? { bg: "rgba(16, 185, 129, 0.15)", text: "#34d399" }
                                : r.isExisting
                                ? { bg: "rgba(245, 158, 11, 0.15)", text: "#fbbf24" }
                                : { bg: "rgba(244, 63, 94, 0.15)", text: "#fda4af" };

                              return (
                                <tr key={r.rowNumber} style={{ borderTop: "1px solid #1e293b", background: r.isValid ? "transparent" : "rgba(15, 23, 42, 0.5)" }}>
                                  <td style={{ padding: "0.6rem 0.75rem", color: "#64748b" }}>{r.rowNumber}</td>
                                  <td style={{ padding: "0.6rem 0.75rem", fontWeight: "600", color: "#f8fafc" }}>{r.name || "—"}</td>
                                  <td style={{ padding: "0.6rem 0.75rem", color: "#cbd5e1" }}>{r.email || "—"}</td>
                                  <td style={{ padding: "0.6rem 0.75rem", color: "#94a3b8" }}>{r.planLabel}</td>
                                  <td style={{ padding: "0.6rem 0.75rem" }}>
                                    <span style={{ display: "inline-block", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold", background: badgeStyle.bg, color: badgeStyle.text }}>
                                      {r.validationStatus}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Import Result Summary (Section 20) */
                <div>
                  <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                    <div style={{ display: "inline-flex", padding: "0.75rem", borderRadius: "50%", background: "rgba(16, 185, 129, 0.15)", color: "#34d399", marginBottom: "0.75rem" }}>
                      <CheckCircle2 size={36} />
                    </div>
                    <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1.25rem", color: "#f8fafc", fontWeight: "800" }}>
                      IMPORTACIÓN COMPLETADA
                    </h4>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>
                      Se han generado claves individuales y tokens de activación únicos para los nuevos miembros.
                    </p>
                  </div>

                  {/* Summary Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
                    <div style={{ background: "#080c14", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.75rem", textAlign: "center" }}>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase" }}>Procesadas</div>
                      <div style={{ fontSize: "1.35rem", fontWeight: "bold", color: "#f8fafc" }}>{bulkImportResult.summary.processed}</div>
                    </div>
                    <div style={{ background: "#080c14", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.75rem", textAlign: "center" }}>
                      <div style={{ fontSize: "0.75rem", color: "#10b981", textTransform: "uppercase" }}>Nuevos</div>
                      <div style={{ fontSize: "1.35rem", fontWeight: "bold", color: "#34d399" }}>{bulkImportResult.summary.newCount}</div>
                    </div>
                    <div style={{ background: "#080c14", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.75rem", textAlign: "center" }}>
                      <div style={{ fontSize: "0.75rem", color: "#f59e0b", textTransform: "uppercase" }}>Ya Existían</div>
                      <div style={{ fontSize: "1.35rem", fontWeight: "bold", color: "#fbbf24" }}>{bulkImportResult.summary.existingCount}</div>
                    </div>
                    <div style={{ background: "#080c14", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.75rem", textAlign: "center" }}>
                      <div style={{ fontSize: "0.75rem", color: "#38bdf8", textTransform: "uppercase" }}>Mensuales</div>
                      <div style={{ fontSize: "1.35rem", fontWeight: "bold", color: "#38bdf8" }}>{bulkImportResult.summary.monthlyCount}</div>
                    </div>
                    <div style={{ background: "#080c14", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.75rem", textAlign: "center" }}>
                      <div style={{ fontSize: "0.75rem", color: "#c084fc", textTransform: "uppercase" }}>Anuales</div>
                      <div style={{ fontSize: "1.35rem", fontWeight: "bold", color: "#c084fc" }}>{bulkImportResult.summary.annualCount}</div>
                    </div>
                  </div>

                  {/* Results list with copy actions */}
                  <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid #1e293b", borderRadius: "8px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                      <thead>
                        <tr style={{ background: "#1e293b", color: "#94a3b8", textAlign: "left", position: "sticky", top: 0 }}>
                          <th style={{ padding: "0.6rem 0.75rem" }}>Nombre</th>
                          <th style={{ padding: "0.6rem 0.75rem" }}>Correo</th>
                          <th style={{ padding: "0.6rem 0.75rem" }}>Plan</th>
                          <th style={{ padding: "0.6rem 0.75rem" }}>Estado</th>
                          <th style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>Enlace de Activación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkImportResult.results.map((r, idx) => (
                          <tr key={idx} style={{ borderTop: "1px solid #1e293b" }}>
                            <td style={{ padding: "0.6rem 0.75rem", fontWeight: "600", color: "#f8fafc" }}>{r.name}</td>
                            <td style={{ padding: "0.6rem 0.75rem", color: "#cbd5e1" }}>{r.email}</td>
                            <td style={{ padding: "0.6rem 0.75rem", color: "#94a3b8" }}>{r.plan || "—"}</td>
                            <td style={{ padding: "0.6rem 0.75rem" }}>
                              <span style={{ display: "inline-block", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold", background: r.status === "CREATED" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)", color: r.status === "CREATED" ? "#34d399" : "#fbbf24" }}>
                                {r.status}
                              </span>
                            </td>
                            <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                              {r.activationLink ? (
                                <button
                                  onClick={() => handleCopyText(r.activationLink!, `bulk_${idx}`)}
                                  style={{ padding: "0.25rem 0.5rem", background: copiedLink === `bulk_${idx}` ? "#10b981" : "#1e293b", border: "1px solid #334155", borderRadius: "4px", color: "#f8fafc", fontSize: "0.75rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                                >
                                  {copiedLink === `bulk_${idx}` ? <Check size={12} /> : <Copy size={12} />}
                                  <span>{copiedLink === `bulk_${idx}` ? "Copiado" : "Copiar Enlace"}</span>
                                </button>
                              ) : (
                                <span style={{ color: "#64748b" }}>—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #1e293b", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              {!bulkImportResult ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(false)}
                    style={{ padding: "0.5rem 1rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#cbd5e1", cursor: "pointer" }}
                  >
                    Cancelar
                  </button>

                  {bulkValidation && bulkValidation.validCount > 0 && (
                    <button
                      type="button"
                      disabled={bulkImporting}
                      onClick={() => setBulkConfirming(true)}
                      style={{ padding: "0.5rem 1.25rem", background: "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "700", cursor: "pointer" }}
                    >
                      CREAR {bulkValidation.validCount} ACCESOS
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  style={{ padding: "0.5rem 1.25rem", background: "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "700", cursor: "pointer" }}
                >
                  Finalizar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIRMAR CREACIÓN EN LOTE ─────────────────────────────────── */}
      {bulkConfirming && bulkValidation && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 130 }}>
          <div style={{ width: "100%", maxWidth: "440px", background: "#0f172a", border: "1px solid #0284c7", borderRadius: "12px", padding: "1.75rem", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75)" }}>
            <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "1.15rem", color: "#f8fafc", fontWeight: "bold" }}>
              ¿Confirmar Creación de {bulkValidation.validCount} Accesos?
            </h4>
            <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.85rem", color: "#cbd5e1", lineHeight: "1.5" }}>
              Se generarán claves GhostAI únicas y tokens de activación para <strong>{bulkValidation.validCount} nuevos miembros</strong> ({bulkValidation.monthlyCount} Mensual, {bulkValidation.annualCount} Anual).
              {bulkValidation.existingCount > 0 && (
                <span> Los {bulkValidation.existingCount} miembros existentes no serán duplicados.</span>
              )}
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setBulkConfirming(false)}
                style={{ padding: "0.5rem 1rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#cbd5e1", cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={bulkImporting}
                onClick={handleConfirmBulkImport}
                style={{ padding: "0.5rem 1.25rem", background: "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "700", cursor: "pointer" }}
              >
                {bulkImporting ? "Creando..." : "Sí, Crear Accesos"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: NUEVO MIEMBRO INDIVIDUAL ───────────────────────────────────── */}
      {showMemberModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 120 }}>
          <div style={{ width: "100%", maxWidth: "420px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1.25rem 0", fontSize: "1.15rem", color: "#f8fafc" }}>Crear Nuevo Miembro</h3>
            <form onSubmit={handleCreateSingleMember}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "0.4rem" }}>Nombre Completo *</label>
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Ej: Jose Varela"
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
                  placeholder="usuario@ejemplo.com"
                  required
                  style={{ width: "100%", padding: "0.6rem", background: "#080c14", border: "1px solid #334155", borderRadius: "6px", color: "#f8fafc", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "0.4rem" }}>Tipo de Acceso *</label>
                <select
                  value={newMemberPlan}
                  onChange={(e) => setNewMemberPlan(e.target.value as any)}
                  style={{ width: "100%", padding: "0.6rem", background: "#080c14", border: "1px solid #334155", borderRadius: "6px", color: "#f8fafc", boxSizing: "border-box" }}
                >
                  <option value="monthly">Mensual (30 días tras activar)</option>
                  <option value="annual">Anual (365 días tras activar)</option>
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
                  style={{ padding: "0.5rem 1.25rem", background: "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "700", cursor: "pointer" }}
                >
                  {creatingMember ? "Creando..." : "Crear Miembro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: RENOVAR MIEMBRO ────────────────────────────────────────────── */}
      {renewTarget && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 120 }}>
          <div style={{ width: "100%", maxWidth: "420px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.15rem", color: "#f8fafc" }}>Renovar Acceso</h3>
            <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.85rem", color: "#94a3b8" }}>
              Miembro: <strong style={{ color: "#f8fafc" }}>{renewTarget.name}</strong> ({renewTarget.email})
            </p>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "0.5rem" }}>
                Extensión a aplicar:
              </label>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setRenewPlan("monthly")}
                  style={{
                    flex: 1,
                    padding: "0.6rem",
                    borderRadius: "6px",
                    border: renewPlan === "monthly" ? "2px solid #38bdf8" : "1px solid #334155",
                    background: renewPlan === "monthly" ? "rgba(56, 189, 248, 0.15)" : "#080c14",
                    color: renewPlan === "monthly" ? "#38bdf8" : "#cbd5e1",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  + 1 Mes (30 días)
                </button>

                <button
                  type="button"
                  onClick={() => setRenewPlan("annual")}
                  style={{
                    flex: 1,
                    padding: "0.6rem",
                    borderRadius: "6px",
                    border: renewPlan === "annual" ? "2px solid #c084fc" : "1px solid #334155",
                    background: renewPlan === "annual" ? "rgba(168, 85, 247, 0.15)" : "#080c14",
                    color: renewPlan === "annual" ? "#c084fc" : "#cbd5e1",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  + 1 Año (365 días)
                </button>
              </div>
              <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.5rem" }}>
                Si el usuario sigue activo, se sumará desde su fecha de vencimiento actual. Si está expirado, se sumará desde hoy.
              </p>
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
                style={{ padding: "0.5rem 1.25rem", background: "#10b981", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "700", cursor: "pointer" }}
              >
                {isRenewing ? "Renovando..." : "Confirmar Renovación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: REVOCAR MIEMBRO ────────────────────────────────────────────── */}
      {revokeTarget && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 120 }}>
          <div style={{ width: "100%", maxWidth: "440px", background: "#0f172a", border: "1px solid #f43f5e", borderRadius: "10px", padding: "1.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#fda4af", marginBottom: "0.75rem" }}>
              <AlertTriangle size={22} />
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: "bold" }}>¿Revocar Acceso de Miembro?</h3>
            </div>

            <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.85rem", color: "#e2e8f0", lineHeight: "1.5" }}>
              Se invalidará inmediatamente el acceso de <strong>{revokeTarget.name}</strong> ({revokeTarget.email}). Su GhostAI Key y tokens de invitación quedarán revocados en el servidor.
            </p>
            <p style={{ margin: "0 0 1.5rem 0", fontSize: "0.8rem", color: "#94a3b8" }}>
              Otros usuarios y miembros no serán afectados por esta revocación.
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
                style={{ padding: "0.5rem 1.25rem", background: "#f43f5e", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "700", cursor: "pointer" }}
              >
                {isRevoking ? "Revocando..." : "Sí, Revocar Acceso"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: FICHA DETALLADA DEL MIEMBRO (Section 21) ───────────────────── */}
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
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

              <div style={{ gridColumn: "span 2", background: "#080c14", border: "1px solid #1e293b", borderRadius: "6px", padding: "0.6rem 0.85rem" }}>
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

              {detailTarget.revoked_at && (
                <div style={{ gridColumn: "span 2", background: "rgba(244,63,94,0.1)", border: "1px solid #f43f5e", borderRadius: "6px", padding: "0.6rem 0.85rem", color: "#fda4af" }}>
                  <span style={{ display: "block", fontSize: "0.7rem", textTransform: "uppercase" }}>Fecha de Revocación</span>
                  <span style={{ fontSize: "0.85rem" }}>{new Date(detailTarget.revoked_at).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Administrative Actions */}
            <div style={{ borderTop: "1px solid #1e293b", paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => {
                    handleResendInvite(detailTarget);
                    setDetailTarget(null);
                  }}
                  style={{ padding: "0.4rem 0.75rem", background: "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer" }}
                >
                  Reenviar Invitación
                </button>

                <button
                  onClick={() => {
                    setRenewTarget(detailTarget);
                    setRenewPlan(detailTarget.access_plan);
                    setDetailTarget(null);
                  }}
                  style={{ padding: "0.4rem 0.75rem", background: "#10b981", border: "none", borderRadius: "6px", color: "#ffffff", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer" }}
                >
                  Renovar Acceso
                </button>

                <button
                  onClick={() => {
                    handleRegenerateKey(detailTarget);
                    setDetailTarget(null);
                  }}
                  style={{ padding: "0.4rem 0.75rem", background: "#334155", border: "none", borderRadius: "6px", color: "#cbd5e1", fontSize: "0.8rem", cursor: "pointer" }}
                >
                  Regenerar Key
                </button>
              </div>

              {detailTarget.status !== "revoked" && (
                <button
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

      {/* ── MODAL: INVITACIÓN GENERADA / PLANTILLA DE CORREO (Section 18) ──────── */}
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
                <span>{copiedLink === "invite_body" ? "¡Copiada!" : "Copiar Plantilla Completa"}</span>
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

      {/* ── MODAL: INVITACIONES EN LOTE PREPARADAS (Section 19) ───────────────── */}
      {batchInvitesResult && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 130 }}>
          <div style={{ width: "100%", maxWidth: "600px", maxHeight: "85vh", background: "#0f172a", border: "1px solid #0284c7", borderRadius: "12px", padding: "1.75rem", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Send className="text-cyan-400" size={20} />
                <h4 style={{ margin: 0, fontSize: "1.2rem", color: "#f8fafc", fontWeight: "bold" }}>
                  {batchInvitesResult.sentCount} Invitaciones Preparadas
                </h4>
              </div>
              <button
                onClick={() => setBatchInvitesResult(null)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: "0 0 1rem 0", fontSize: "0.85rem", color: "#94a3b8" }}>
              Se generaron tokens de activación de un solo uso para cada miembro. Zero correos reales enviados.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.25rem" }}>
              {batchInvitesResult.invitations.map((inv, idx) => (
                <div key={idx} style={{ background: "#080c14", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#f8fafc", fontSize: "0.85rem", display: "block" }}>{inv.emailPayload.name}</strong>
                    <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>{inv.emailPayload.email} • Plan {inv.emailPayload.plan}</span>
                  </div>
                  <button
                    onClick={() => handleCopyText(inv.emailPayload.body, `batch_${idx}`)}
                    style={{ padding: "0.35rem 0.75rem", background: copiedLink === `batch_${idx}` ? "#10b981" : "#1e293b", border: "1px solid #334155", borderRadius: "4px", color: "#38bdf8", fontSize: "0.75rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                  >
                    {copiedLink === `batch_${idx}` ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedLink === `batch_${idx}` ? "Copiada" : "Copiar Plantilla"}</span>
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setBatchInvitesResult(null)}
                style={{ padding: "0.5rem 1.25rem", background: "#0284c7", border: "none", borderRadius: "6px", color: "#ffffff", fontWeight: "700", cursor: "pointer" }}
              >
                Cerrar
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
