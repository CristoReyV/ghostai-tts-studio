import {useRef,useState} from "react";
import {applyBillingSync,previewBillingSync,sheetSyncDate} from "../../services/billingService";
import type {BillingSyncInfo,BillingSyncPreview} from "../../services/billingService";
import {BillingSyncPreviewDialog} from "./BillingSyncPreviewDialog";
import "./BillingDashboard.css";

export function SheetSyncControl({isOwner,sync,onSynced,disabled=false}:{isOwner:boolean;sync:BillingSyncInfo|null;onSynced:()=>Promise<void>;disabled?:boolean}) {
  const [preview,setPreview]=useState<BillingSyncPreview|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[feedback,setFeedback]=useState("");
  const flight=useRef(false),trigger=useRef<HTMLButtonElement>(null);
  async function inspect() {
    if(flight.current)return;flight.current=true;setBusy(true);setError("");setFeedback("");
    try{setPreview(await previewBillingSync());}catch(e){setError((e as Error).message);}finally{flight.current=false;setBusy(false);}
  }
  async function apply() {
    if(flight.current||!preview)return;flight.current=true;setBusy(true);setError("");setFeedback("");
    try {
      await applyBillingSync(preview.previewToken);setPreview(null);setFeedback("Sincronización aplicada. Miembros y facturación actualizados.");
      try{await onSynced();}catch(_){setError("La sincronización se guardó, pero no se pudo actualizar la vista. Pulsa Actualizar o vuelve a entrar a la pestaña.");}
    } catch(e) {setPreview(null);setError((e as Error).message);try{await onSynced();}catch(_){/* A fresh preview will re-read the authoritative state. */}}
    finally{flight.current=false;setBusy(false);}
  }
  function cancel() {if(!busy){setPreview(null);trigger.current?.focus();}}
  return <div className="billing-sheet-sync">
    <div className="billing-sheet-sync-bar"><div><strong>Fuente: Google Sheets</strong><small>Última sincronización: {sheetSyncDate(sync)}{sync&&<> · Por: {sync.metadata.lastSheetSyncBy?.role.toUpperCase()||"OWNER"}</>}</small></div>{isOwner&&<button ref={trigger} disabled={disabled||busy} onClick={()=>void inspect()}>{busy&&!preview?"Leyendo tabla…":"Sincronizar tabla"}</button>}</div>
    {error&&<p role="alert" className="billing-error">{error}</p>}{feedback&&<p role="status" className="billing-feedback">{feedback}</p>}
    {isOwner&&preview&&<BillingSyncPreviewDialog preview={preview} busy={busy} onCancel={cancel} onApply={()=>void apply()}/>}
  </div>;
}
