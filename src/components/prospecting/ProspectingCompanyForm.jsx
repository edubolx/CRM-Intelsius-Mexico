import { useState } from "react";

export default function ProspectingCompanyForm({ init = {}, onSave, onClose, lang, users = [], helpers }) {
  const { Inp, Sel, Txta, Btn, PROSPECTING_STATUSES } = helpers;
  const [f, setF] = useState({ name: '', status: 'nueva', owner_id: '', industry: '', country: '', company_size: '', lead_source: '', priority: '', notes: '', ...init });
  const s = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  return (
    <>
      <Inp label="Nombre de empresa *" value={f.name} onChange={s('name')} />
      <Sel label="Estado" value={f.status} onChange={s('status')} opts={PROSPECTING_STATUSES.map((st) => ({ v: st.value, l: st.label[lang] }))} />
      <Sel label="Owner" value={f.owner_id || ''} onChange={s('owner_id')} opts={[{ v: '', l: '— Selecciona —' }, ...users.map((u) => ({ v: u.alias || u.name, l: u.alias || u.name }))]} />
      <Inp label="Industria" value={f.industry || ''} onChange={s('industry')} />
      <Inp label="País" value={f.country || ''} onChange={s('country')} />
      <Inp label="Tamaño" value={f.company_size || ''} onChange={s('company_size')} />
      <Inp label="Origen lead" value={f.lead_source || ''} onChange={s('lead_source')} />
      <Inp label="Prioridad" value={f.priority || ''} onChange={s('priority')} />
      <Txta label="Notas" value={f.notes || ''} onChange={s('notes')} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn v="ghost" ch="Cancelar" onClick={onClose} />
        <Btn ch="Guardar" onClick={() => onSave(f)} disabled={!f.name?.trim()} />
      </div>
    </>
  );
}
