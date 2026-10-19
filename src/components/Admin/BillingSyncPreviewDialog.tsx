import {useRef} from "react";
import type {KeyboardEvent} from "react";
import {billingMoney,sheetSyncDate} from "../../services/billingService";
import type {BillingSyncPreview} from "../../services/billingService";

export function BillingSyncPreviewDialog({preview,busy,onCancel,onApply}:{preview:BillingSyncPreview;busy:boolean;onCancel:()=>void;onApply:()=>void}) {
  const dialog = useRef<HTMLDivElement>(null);
  const {counts} = preview;
  function keys(event:KeyboardEvent<HTMLDivElement>) {
    if(event.key==="Escape"&&!busy){event.preventDefault();onCancel();}
    if(event.key!=="Tab")return;
    const buttons=dialog.current?.querySelectorAll<HTMLElement>("summary,button:not(:disabled)");
    if(!buttons?.length){event.preventDefault();dialog.current?.focus();return;}
    const first=buttons[0],last=buttons[buttons.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  return <div className="billing-backdrop" onClick={event=>{if(event.target===event.currentTarget&&!busy)onCancel();}}>
    <div ref={dialog} className="billing-edit billing-sync-preview" role="dialog" aria-modal="true" aria-labelledby="billing-sync-title" aria-describedby="billing-sync-scope" tabIndex={-1} onKeyDown={keys}>
      <p className="billing-eyebrow">VISTA PREVIA</p><h3 id="billing-sync-title">Sincronizar con Google Sheets</h3>
      <p className="billing-sync-source">Hoja actual: <strong>{preview.rows} miembros</strong></p>
      <small>{preview.validRows} {preview.validRows===1?"fila válida":"filas válidas"} · {counts.invalid} {counts.invalid===1?"inválida":"inválidas"}</small>
      <small>Última sincronización: {sheetSyncDate(preview.lastSync)}</small>
      <h4>Cambios detectados</h4>
      <ul className="billing-sync-counts">
        <li><strong>+ {counts.newMembers}</strong><span>{counts.newMembers===1?"miembro nuevo":"miembros nuevos"}</span></li>
        <li><strong>{counts.amountsUpdated}</strong><span>{counts.amountsUpdated===1?"monto a actualizar":"montos a actualizar"}</span></li>
        <li><strong>{counts.plansChanged}</strong><span>{counts.plansChanged===1?"plan diferente":"planes diferentes"}</span></li>
        <li><strong>{counts.unchanged}</strong><span>sin cambios</span></li>
        <li><strong>{counts.needsReview}</strong><span>{counts.needsReview===1?"requiere revisión":"requieren revisión"}</span></li>
        {counts.missingAmounts>0&&<li><strong>{counts.missingAmounts}</strong><span>SIN MONTO</span></li>}
      </ul>
      <div className="billing-sync-totals">{!preview.totals.length&&<p>Sin importes conocidos para comparar.</p>}{preview.totals.map(total=><dl key={total.currency} aria-label={`Totales en ${total.currency}`}>
        <div><dt>Total registrado actual</dt><dd>{billingMoney(total.beforeMinor,total.currency)}</dd></div>
        <div className="billing-sync-after"><dt>Nuevo total</dt><dd>{billingMoney(total.afterMinor,total.currency)}</dd></div>
        {total.sheetMinor!==total.afterMinor&&<div><dt>Total de la hoja</dt><dd>{billingMoney(total.sheetMinor,total.currency)}</dd></div>}
      </dl>)}</div>
      <p id="billing-sync-scope" className="billing-caption">Nuevos accesos PENDING, sin enviar correos. Cambios de plan automáticos solo en PENDING. Los cobros confirmados y las vigencias existentes se conservan.</p>
      {preview.unknownAmounts.after>0&&<p className="billing-caption">{preview.unknownAmounts.after} {preview.unknownAmounts.after===1?"miembro sin monto o moneda queda":"miembros sin monto o moneda quedan"} fuera de los totales.</p>}
      {preview.existingNotInSheet>0&&<p className="billing-caption">{preview.existingNotInSheet} {preview.existingNotInSheet===1?"miembro fuera de la hoja se conserva":"miembros fuera de la hoja se conservan"}.</p>}
      {preview.details.length>0&&<details className="billing-sync-details" open={counts.needsReview>0}><summary>Ver cambios y revisiones ({preview.details.length})</summary><ul>{preview.details.map((detail,index)=><li key={index}><strong>{detail.name}</strong><small>{detail.row?"Fila "+detail.row+" · ":""}{detail.classification==="NEW_MEMBER"?"Nuevo miembro":detail.classification==="PLAN_CHANGED"?"Plan diferente":detail.classification==="AMOUNT_CHANGED"?"Monto diferente":detail.classification==="EXISTING_NOT_IN_SHEET"?"NO ESTÁ EN TABLA ACTUAL":detail.classification==="MISSING_AMOUNT"?"SIN MONTO":"REQUIERE REVISIÓN"}{detail.newAmountMinor!==null&&detail.currency?" · "+billingMoney(detail.newAmountMinor,detail.currency):""}</small>{detail.reason&&<p>{detail.reason}</p>}</li>)}</ul></details>}
      {!preview.canApply&&<p className="billing-caption">Revisa la hoja: se necesita al menos una fila aplicable y se admiten hasta 1,000.</p>}
      <div className="billing-actions"><button type="button" autoFocus disabled={busy} onClick={onCancel}>Cancelar</button><button type="button" className="billing-primary" disabled={busy||!preview.canApply} onClick={onApply}>{busy?"Aplicando…":"Aplicar sincronización"}</button></div>
    </div>
  </div>;
}
