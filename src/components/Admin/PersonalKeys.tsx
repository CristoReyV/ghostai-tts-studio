import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import { fetchPersonalKeys, revealPersonalKey, type PersonalKey } from "../../services/adminService";
import "./PersonalKeys.css";

export function PersonalKeysView({ keys, revealed, busy, notice, onReveal, onCopy }: {
  keys: PersonalKey[]; revealed: Record<string, string>; busy: string | null; notice: string;
  onReveal: (key: PersonalKey) => void; onCopy: (key: PersonalKey) => void;
}) {
  return <section className="personal-keys" aria-label="Mis keys personales">
    <h2><KeyRound size={22} /> Mis keys personales</h2>
    <p>Accesos personales asignados a tu cuenta. Copia una key para entrar a GhostAI Studio.</p>
    {keys.length === 0 && <p>No tienes keys personales asignadas.</p>}
    <div className="personal-key-grid">{keys.map(key => <article key={key.id} aria-label={key.label || "Key personal"}>
      <div className="personal-key-title"><h3>{key.label || "Key personal"}</h3><span>{key.canReveal ? "ACTIVA" : "NO DISPONIBLE"}</span></div>
      <p>{key.clientName} · {key.expiresAt === null ? "De por vida · Sin vencimiento" : "Acceso personal"}</p>
      <code>{revealed[key.id] || "••••••••••••••••••••••••"}</code>
      <div className="personal-key-actions">
        <button disabled={!key.canReveal || busy === key.id} onClick={() => onReveal(key)}>{revealed[key.id] ? <EyeOff size={16} /> : <Eye size={16} />}{revealed[key.id] ? "Ocultar key" : "Mostrar key"}</button>
        <button disabled={!key.canReveal || busy === key.id} onClick={() => onCopy(key)}><Copy size={16} />{busy === key.id ? "Procesando…" : "Copiar key"}</button>
      </div>
    </article>)}</div>
    <p role="status" aria-live="polite">{notice}</p>
  </section>;
}

export function PersonalKeys() {
  const [keys, setKeys] = useState<PersonalKey[]>([]);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("Cargando keys personales…");
  useEffect(() => {
    let active = true;
    fetchPersonalKeys().then(data => { if (active) { setKeys(data); setNotice(""); } }).catch(error => { if (active) setNotice(error.message); });
    return () => { active = false; };
  }, []);
  const perform = async (key: PersonalKey, copy: boolean) => {
    if (busy) return;
    if (!copy && revealed[key.id]) { setRevealed(current => { const next = { ...current }; delete next[key.id]; return next; }); return; }
    setBusy(key.id); setNotice("");
    try {
      const value = await revealPersonalKey(key.id);
      if (copy) { await navigator.clipboard.writeText(value); setNotice(`${key.label || "Key"} copiada.`); }
      else setRevealed(current => ({ ...current, [key.id]: value }));
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo acceder a la key."); }
    finally { setBusy(null); }
  };
  return <PersonalKeysView keys={keys} revealed={revealed} busy={busy} notice={notice} onReveal={key => void perform(key, false)} onCopy={key => void perform(key, true)} />;
}
