import { useEffect, useRef, useState } from "react";
import { applySkoolSync, fetchSkoolSync, previewSkoolSync, type SkoolPreview, type SkoolSyncInfo } from "../../services/skoolService";
import "./BillingDashboard.css";
export function SkoolSyncPreview({ preview, busy, progress, onApply, onCancel }: { preview: SkoolPreview; busy: boolean; progress: string; onApply: () => void; onCancel: () => void }) {
  const labels: Record<string, string> = { NEW: "NUEVO", REMOVED: "BAJA SKOOL", REJOINED: "REGRESA A SKOOL", EXPIRY_CHANGED: "VENCIMIENTO ACTUALIZADO", INVALID: "REVISAR", INACTIVE_ROW: "SIN MEMBRESÍA VIGENTE", NEEDS_OWNER_REVIEW: "REQUIERE REVISIÓN OWNER" };
  return <div role="dialog" aria-modal="true" aria-label="Sincronizar miembros SKOOL" style={{ position: "fixed", inset: 0, zIndex: 150, background: "#080c14ed", display: "grid", placeItems: "center", padding: "1rem" }}><section className="billing-panel" style={{ width: "min(760px, 94vw)", maxHeight: "85vh", overflowY: "auto", boxSizing: "border-box" }}>
    <h2>Sincronizar miembros SKOOL</h2><p>{preview.rows} personas en la hoja · {preview.counts.newMembers} nuevos · {preview.counts.existing} existentes · {preview.counts.removed} bajas · {preview.counts.rejoined} regresan · {preview.counts.expiryChanges} vencimientos · {preview.counts.invalid} errores</p>
    <p>La hoja define quién puede tener acceso. Las bajas revocan el acceso, la key y los enlaces de quienes no estén vigentes en la hoja, incluidos los planes anteriores. Se conserva el historial de pagos. No se envían correos.</p>
    {!preview.canApply && <p role="alert" className="billing-error">Revisa la hoja antes de aplicar. Una hoja vacía o con errores no puede producir altas ni bajas.</p>}
    <div style={{ maxHeight: "40vh", overflowY: "auto" }}>{preview.details.map((row, index) => <div key={`${row.row}-${index}`} style={{ padding: ".7rem 0", borderBottom: "1px solid #293b55" }}><strong>{row.name}</strong><small style={{ display: "block", color: "#a7b6cd" }}>{labels[row.classification] || row.classification}{row.reason ? ` · ${row.reason}` : ""}</small></div>)}</div>
    <p role="status" aria-live="polite">{progress}</p><div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem", marginTop: "1rem" }}><button disabled={busy} onClick={onCancel}>Cancelar</button><button disabled={busy || !preview.canApply} onClick={onApply}>{busy ? "Sincronizando SKOOL…" : "Aplicar sincronización SKOOL"}</button></div>
  </section></div>;
}
export function SkoolSyncControl({ isOwner, onSynced }: { isOwner: boolean; onSynced: () => Promise<void> }) {
  const [info, setInfo] = useState<SkoolSyncInfo | null>(null), [preview, setPreview] = useState<SkoolPreview | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [feedback, setFeedback] = useState("");
  const flight = useRef(false), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { let active = true; fetchSkoolSync().then(data => { if (active) setInfo(data); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  async function inspect() {
    if (flight.current) return; flight.current = true; setBusy(true); setError(""); setFeedback("");
    try { setPreview(await previewSkoolSync()); } catch (e) { setError((e as Error).message); } finally { setBusy(false); flight.current = false; }
  }
  async function apply() {
    if (flight.current || !preview) return; flight.current = true; setBusy(true); setError("");
    let current = preview, created = 0, removed = 0, updated = 0;
    try {
      for (let batch = 0; batch < 130; batch++) {
        if (current.sourceFingerprint !== preview.sourceFingerprint) throw new Error("La hoja SKOOL cambió durante la carga. Abre una nueva vista previa.");
        const result = await applySkoolSync(current.previewToken);
        created += result.created; removed += result.removed; updated += result.updated;
        setFeedback(`${created} accesos nuevos cargados${result.needsContinuation ? ` · faltan ${result.remaining}` : ""}.`);
        if (!result.needsContinuation) { setPreview(null); setInfo(await fetchSkoolSync()); setFeedback(`SKOOL actualizado: ${created} nuevos, ${removed} bajas y ${updated} actualizados. Correos enviados: 0.`); await onSynced(); return; }
        current = await previewSkoolSync();
      }
      throw new Error("La carga necesita continuar. Abre una nueva vista previa; los accesos creados se conservan.");
    } catch (e) { setPreview(null); setError((e as Error).message); try { await onSynced(); } catch { /* Keep the sync error visible. */ } }
    finally { setBusy(false); flight.current = false; }
  }
  if (info && !info.configured) return null;
  const date = info?.sync ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(info.sync.synced_at)) + " CDMX" : "Sin sincronización";
  return <div className="billing-sheet-sync"><div className="billing-sheet-sync-bar"><div><strong>Miembros SKOOL · acceso según la hoja</strong><small>Última sincronización: {date}</small></div>{isOwner && <button ref={trigger} disabled={busy} onClick={() => void inspect()}>{busy ? "Procesando SKOOL…" : "Sincronizar SKOOL"}</button>}</div>{error && <p role="alert" className="billing-error">{error}</p>}{!preview && feedback && <p role="status" className="billing-feedback">{feedback}</p>}{preview && <SkoolSyncPreview preview={preview} busy={busy} progress={feedback} onApply={() => void apply()} onCancel={() => { if (!busy) { setPreview(null); trigger.current?.focus(); } }} />}</div>;
}
