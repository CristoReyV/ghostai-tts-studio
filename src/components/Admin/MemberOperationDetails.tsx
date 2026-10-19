import type { AdminMember } from "../../services/adminService";
import { EMAIL_TYPE_LABELS, getMemberOperationalState } from "../../services/memberOperations";

const colors = { muted: "#94a3b8", danger: "#fda4af", attention: "#fcd34d", info: "#7dd3fc", success: "#6ee7b7" };
export function MemberOperationalBadge({ member }: { member: AdminMember }) {
  const operation = getMemberOperationalState(member);
  return <span title={operation.recommendedAction} style={{ display: "inline-block", maxWidth: "185px", padding: "0.3rem 0.5rem", borderRadius: "5px", background: "#1e293b", color: colors[operation.severity], fontSize: "0.72rem", fontWeight: 750, lineHeight: 1.45 }}>{operation.label}</span>;
}

export function MemberOperationDetails({ member, busy, onUndo }: { member: AdminMember; busy: boolean; onUndo: () => void }) {
  const operation = getMemberOperationalState(member);
  const sent = member.last_email_status === "sent" && !!member.last_email_sent_at;
  return <section aria-label="Operación del miembro" style={{ border: "1px solid #334155", padding: "1rem", borderRadius: "8px", marginBottom: "1rem" }}>
    <h3 style={{ marginTop: 0 }}>OPERACIÓN</h3>
    <MemberOperationalBadge member={member} />
    <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.5rem 1rem", fontSize: "0.85rem", marginBottom: "1rem" }}>
      <dt>Último correo</dt><dd style={{ margin: 0 }}>{sent ? "Envío registrado manualmente" : member.last_email_status === "failed" ? "Error de correo" : "NO ENVIADO / SIN CONFIRMACIÓN"}</dd>
      <dt>Tipo</dt><dd style={{ margin: 0 }}>{member.last_email_type ? EMAIL_TYPE_LABELS[member.last_email_type] : "Sin registrar"}</dd>
      <dt>Enviado por</dt><dd style={{ margin: 0 }}>{member.last_email_sent_by_name || (member.last_email_sent_by ? "Administrador registrado" : "Sin registrar")}{member.last_email_sent_by_role ? ` (${member.last_email_sent_by_role.toUpperCase()})` : ""}</dd>
      <dt>Fecha</dt><dd style={{ margin: 0 }}>{member.last_email_sent_at ? new Date(member.last_email_sent_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" }) + " (CDMX)" : "—"}</dd>
    </dl>
    <p style={{ color: "#cbd5e1", fontSize: "0.85rem" }}>Acción recomendada: <strong>{operation.recommendedAction}</strong></p>
    {sent && <button disabled={busy} onClick={onUndo} style={{ background: "#1e293b", border: "1px solid #64748b", color: "#e2e8f0", padding: "0.55rem", borderRadius: "6px", cursor: "pointer" }}>DESMARCAR ENVÍO</button>}
  </section>;
}
