import { useState } from "react";
import type { EmailPreviewData } from "../../services/adminService";

export function invitationMailto(email: EmailPreviewData): string {
  return `mailto:${encodeURIComponent(email.to)}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.text)}`;
}

export function ManualInvitationActions({ email, onHandoff }: { email: EmailPreviewData; onHandoff?: () => void }) {
  const [feedback, setFeedback] = useState("");
  const buttonStyle = { padding: "0.55rem 0.75rem", borderRadius: "6px", border: "1px solid #334155", background: "#1e293b", color: "#e2e8f0", cursor: "pointer", fontSize: "0.8rem" };
  async function copy(kind: "text" | "html" | "link" | "subject" | "to") {
    try {
      if (kind === "html") {
        if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("Usa Copiar texto; este navegador no admite copiar formato.");
        await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([email.html], { type: "text/html" }), "text/plain": new Blob([email.text], { type: "text/plain" }) })]);
      } else {
        const value = kind === "link" ? email.activationLink : kind === "subject" ? email.subject : kind === "to" ? email.to : email.text;
        await navigator.clipboard.writeText(value);
      }
      setFeedback("Copiado. Pégalo en tu correo y revisa antes de enviar.");
      if (kind === "html" || kind === "text") onHandoff?.();
    } catch (err) { setFeedback(err instanceof Error ? err.message : "No se pudo copiar. Selecciona el texto de la vista previa."); }
  }
  return <section aria-label="Envío manual" style={{ border: "1px solid #0284c7", borderRadius: "8px", padding: "1rem", marginTop: "1rem" }}>
    <p style={{ margin: "0 0 0.75rem", color: "#cbd5e1", fontSize: "0.85rem" }}>Abre tu correo con el mensaje preparado o copia el contenido. El envío lo haces tú desde tu cuenta.</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      <a href={invitationMailto(email)} onClick={() => onHandoff?.()} style={{ ...buttonStyle, background: "#0284c7", textDecoration: "none" }}>Abrir mi correo</a>
      <button onClick={() => copy("html")} style={buttonStyle}>Copiar con formato</button>
      <button onClick={() => copy("text")} style={buttonStyle}>Copiar texto</button>
      <button onClick={() => copy("link")} style={buttonStyle}>Copiar enlace</button>
      <button onClick={() => copy("subject")} style={buttonStyle}>Copiar asunto</button>
      <button onClick={() => copy("to")} style={buttonStyle}>Copiar destinatario</button>
    </div>
    <p style={{ color: "#94a3b8", fontSize: "0.75rem", marginBottom: 0 }}>“Abrir mi correo” utiliza tu aplicación predeterminada y texto sin formato. Para conservar el diseño GhostAI, pega “Copiar con formato” en el cuerpo del correo. GhostAI no confirma el envío externo: después de enviarlo, pulsa MARCAR COMO ENVIADO.</p>
    <p role="status" style={{ color: "#38bdf8", fontSize: "0.8rem" }}>{feedback}</p>
  </section>;
}
