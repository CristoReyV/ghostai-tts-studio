/**
 * @file src/components/Admin/AdminDashboard.tsx
 * Private Administrative Console for GhostAI Access Control & TTS Operations Audit.
 * Isolated from normal Studio user views.
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
  type AdminClient,
  type AdminToken,
  type AdminTtsSession,
} from "../../services/adminService";

interface AdminDashboardProps {
  onBackToStudio: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToStudio }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"clients" | "tokens" | "operations">("clients");

  // Login form state
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const loginInputRef = useRef<HTMLInputElement>(null);

  // Data states
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [tokens, setTokens] = useState<AdminToken[]>([]);
  const [operations, setOperations] = useState<AdminTtsSession[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);

  // Create Client Modal
  const [showClientModal, setShowClientModal] = useState<boolean>(false);
  const [clientName, setClientName] = useState<string>("");
  const [clientEmail, setClientEmail] = useState<string>("");

  // Create Token Modal
  const [showTokenModal, setShowTokenModal] = useState<boolean>(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [tokenLabel, setTokenLabel] = useState<string>("");

  // One-time Secret Display Modal
  const [oneTimeToken, setOneTimeToken] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

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
      if (activeTab === "clients") {
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
      // IMMEDIATELY wipe input from DOM and memory
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
    setClients([]);
    setTokens([]);
    setOperations([]);
  };

  // 5. Create Client
  const handleCreateClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    try {
      await createAdminClient(clientName.trim(), clientEmail.trim() || undefined);
      setShowClientModal(false);
      setClientName("");
      setClientEmail("");
      loadData();
    } catch (err) {
      setDataError((err as Error).message);
    }
  };

  // 6. Toggle Client Status
  const handleToggleClientStatus = async (client: AdminClient) => {
    const nextStatus = client.status === "active" ? "suspended" : "active";
    try {
      await updateAdminClientStatus(client.id, nextStatus);
      loadData();
    } catch (err) {
      setDataError((err as Error).message);
    }
  };

  // 7. Create Token
  const handleCreateTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) return;
    try {
      const result = await createAdminToken(selectedClientId, tokenLabel.trim() || undefined);
      setShowTokenModal(false);
      setTokenLabel("");
      // Show one-time secret modal
      setOneTimeToken(result.token);
      loadData();
    } catch (err) {
      setDataError((err as Error).message);
    }
  };

  // 8. Revoke Token
  const handleRevokeToken = async (tokenId: string) => {
    if (!window.confirm("¿Estás seguro de que deseas revocar esta Access Key? El cliente perderá acceso inmediatamente.")) {
      return;
    }
    try {
      await revokeAdminToken(tokenId);
      loadData();
    } catch (err) {
      setDataError((err as Error).message);
    }
  };

  // Copy Key to Clipboard
  const handleCopyOneTimeKey = async () => {
    if (!oneTimeToken) return;
    try {
      await navigator.clipboard.writeText(oneTimeToken);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch (_) {}
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0b0f19", color: "#e2e8f0" }}>
        <RefreshCw className="animate-spin text-cyan-400" size={32} />
      </div>
    );
  }

  // ── Login Screen ────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#080c14", padding: "1.5rem" }}>
        <div style={{ width: "100%", maxWidth: "420px", background: "#111827", border: "1px solid #1f2937", borderRadius: "12px", padding: "2rem", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={{ display: "inline-flex", padding: "0.75rem", borderRadius: "50%", background: "rgba(56, 189, 248, 0.1)", color: "#38bdf8", marginBottom: "1rem" }}>
              <Shield size={36} />
            </div>
            <h1 style={{ fontSize: "1.35rem", fontWeight: "bold", color: "#f8fafc", margin: "0 0 0.5rem 0" }}>GHOSTAI ADMIN</h1>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>Consola de gestión de clientes y llaves de acceso</p>
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
                  style={{ width: "100%", padding: "0.65rem 0.85rem", background: "#0b0f19", border: "1px solid #374151", borderRadius: "8px", color: "#f8fafc", fontSize: "0.9rem", boxSizing: "border-box" }}
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
              style={{ width: "100%", padding: "0.75rem", background: "#2563eb", border: "none", borderRadius: "8px", color: "#ffffff", fontWeight: "600", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem" }}
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
    <div style={{ minHeight: "100vh", backgroundColor: "#080c14", color: "#e2e8f0", display: "flex", flexDirection: "column" }}>
      {/* Top Navbar */}
      <header style={{ borderBottom: "1px solid #1f2937", background: "#0f172a", padding: "0.75rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            onClick={onBackToStudio}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.75rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#cbd5e1", fontSize: "0.8rem", cursor: "pointer" }}
          >
            <ArrowLeft size={14} /> Volver a Studio
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Shield className="text-cyan-400" size={20} />
            <span style={{ fontWeight: "bold", fontSize: "1.1rem", letterSpacing: "0.05em", color: "#f8fafc" }}>GHOSTAI ADMIN</span>
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
      <div style={{ maxWidth: "1200px", width: "100%", margin: "0 auto", padding: "1.5rem", flex: 1 }}>
        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid #1f2937", marginBottom: "1.5rem" }}>
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

        {/* ── TAB 1: CLIENTES ────────────────────────────────────────────── */}
        {activeTab === "clients" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.1rem", margin: 0, fontWeight: "600" }}>Directorio de Clientes</h2>
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
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                        No hay clientes registrados.
                      </td>
                    </tr>
                  ) : (
                    clients.map((c) => (
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
                          <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                            <button
                              onClick={() => {
                                setSelectedClientId(c.id);
                                setShowTokenModal(true);
                              }}
                              style={{ padding: "0.3rem 0.6rem", background: "#334155", border: "none", borderRadius: "4px", color: "#f8fafc", fontSize: "0.75rem", cursor: "pointer" }}
                            >
                              Generar Key
                            </button>
                            <button
                              onClick={() => handleToggleClientStatus(c)}
                              style={{ padding: "0.3rem 0.6rem", background: c.status === "active" ? "rgba(244, 63, 94, 0.1)" : "rgba(16, 185, 129, 0.1)", border: c.status === "active" ? "1px solid #f43f5e" : "1px solid #10b981", borderRadius: "4px", color: c.status === "active" ? "#fda4af" : "#34d399", fontSize: "0.75rem", cursor: "pointer" }}
                            >
                              {c.status === "active" ? "Suspender" : "Reactivar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 2: TOKENS ──────────────────────────────────────────────── */}
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
                <Plus size={16} /> Generar Key
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
                    <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                        No hay tokens registrados.
                      </td>
                    </tr>
                  ) : (
                    tokens.map((t) => (
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
                              style={{ padding: "0.3rem 0.6rem", background: "rgba(244, 63, 94, 0.1)", border: "1px solid #f43f5e", borderRadius: "4px", color: "#fda4af", fontSize: "0.75rem", cursor: "pointer" }}
                            >
                              Revocar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 3: OPERACIÓN TTS ────────────────────────────────────────── */}
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
                    <th style={{ padding: "0.75rem 1rem" }}>Expira</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                        No hay sesiones registradas en el vault.
                      </td>
                    </tr>
                  ) : (
                    operations.map((op) => (
                      <tr key={op.id} style={{ borderTop: "1px solid #1e293b" }}>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: "600", color: "#f8fafc" }}>{op.clientName}</td>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "#94a3b8" }}>{op.id.slice(0, 8)}...</td>
                        <td style={{ padding: "0.75rem 1rem", color: "#cbd5e1" }}>{op.projectTitle}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{ display: "inline-block", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold", background: op.status === "ready" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)", color: op.status === "ready" ? "#34d399" : "#fbbf24" }}>
                            {op.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: "#f8fafc" }}>
                          {op.readyCount} / {op.itemCount}
                          {op.errorCount > 0 && <span style={{ color: "#f43f5e", marginLeft: "0.3rem" }}>({op.errorCount} err)</span>}
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{ display: "inline-block", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold", background: op.zipStatus === "verified" ? "rgba(16, 185, 129, 0.15)" : op.zipStatus === "failed" ? "rgba(244, 63, 94, 0.15)" : "#1e293b", color: op.zipStatus === "verified" ? "#34d399" : op.zipStatus === "failed" ? "#fda4af" : "#94a3b8" }}>
                            {op.zipStatus.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: "#94a3b8" }}>{new Date(op.createdAt).toLocaleTimeString()}</td>
                        <td style={{ padding: "0.75rem 1rem", color: "#94a3b8" }}>{new Date(op.expiresAt).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: Crear Cliente ───────────────────────────────────────────── */}
      {showClientModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 100 }}>
          <div style={{ width: "100%", maxWidth: "400px", background: "#111827", border: "1px solid #1f2937", borderRadius: "8px", padding: "1.5rem" }}>
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
                  style={{ width: "100%", padding: "0.6rem", background: "#0b0f19", border: "1px solid #374151", borderRadius: "6px", color: "#f8fafc", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "0.4rem" }}>Email de Contacto (Opcional)</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="contacto@alpha.com"
                  style={{ width: "100%", padding: "0.6rem", background: "#0b0f19", border: "1px solid #374151", borderRadius: "6px", color: "#f8fafc", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  style={{ padding: "0.5rem 1rem", background: "#334155", border: "none", borderRadius: "6px", color: "#f8fafc", cursor: "pointer" }}
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

      {/* ── MODAL: Generar Key ────────────────────────────────────────────── */}
      {showTokenModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 100 }}>
          <div style={{ width: "100%", maxWidth: "420px", background: "#111827", border: "1px solid #1f2937", borderRadius: "8px", padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", color: "#f8fafc" }}>Generar Access Key</h3>
            <form onSubmit={handleCreateTokenSubmit}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "0.4rem" }}>Cliente Destino *</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  required
                  style={{ width: "100%", padding: "0.6rem", background: "#0b0f19", border: "1px solid #374151", borderRadius: "6px", color: "#f8fafc", boxSizing: "border-box" }}
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
                  style={{ width: "100%", padding: "0.6rem", background: "#0b0f19", border: "1px solid #374151", borderRadius: "6px", color: "#f8fafc", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowTokenModal(false)}
                  style={{ padding: "0.5rem 1rem", background: "#334155", border: "none", borderRadius: "6px", color: "#f8fafc", cursor: "pointer" }}
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

      {/* ── MODAL: ONE-TIME KEY DISPLAY ───────────────────────────────────── */}
      {oneTimeToken && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 110 }}>
          <div style={{ width: "100%", maxWidth: "500px", background: "#0f172a", border: "2px solid #eab308", borderRadius: "12px", padding: "1.75rem", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.75)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "#fbbf24", marginBottom: "1rem" }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: "bold" }}>GUARDA ESTA KEY AHORA</h3>
            </div>

            <p style={{ color: "#e2e8f0", fontSize: "0.85rem", lineHeight: "1.4", margin: "0 0 1rem 0" }}>
              Esta llave de acceso se muestra <strong>UNA SOLA VEZ</strong>. Por seguridad criptográfica, el servidor no almacena el secreto en texto plano y no podrá volver a generarse ni recuperarse.
            </p>

            <div style={{ background: "#020617", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.75rem", marginBottom: "1.25rem", wordBreak: "break-all", fontFamily: "monospace", fontSize: "0.85rem", color: "#38bdf8" }}>
              {oneTimeToken}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={handleCopyOneTimeKey}
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
    </div>
  );
};
