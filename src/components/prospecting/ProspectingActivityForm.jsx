import { useState } from "react";

export default function ProspectingActivityForm({ init = {}, onSave, onClose, contacts = [], users = [], lang, helpers }) {
  const { Inp, Sel, Txta, Btn, PROSPECTING_ACTIVITY_TYPES, PROSPECTING_ACTIVITY_STATUSES } = helpers;
  const [f, setF] = useState({ company_id: '', contact_id: '', activity_type: 'investigacion', status: 'pendiente', activity_at: new Date().toISOString().slice(0, 16), outcome: '', next_step: '', next_action_at: '', owner_id: '', notes: '', attachment_url: '', ...init });
  const s = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  return (
    <>
      <Sel label="Tipo" value={f.activity_type} onChange={s('activity_type')} opts={PROSPECTING_ACTIVITY_TYPES.map((st) => ({ v: st.value, l: st.label[lang] }))} />
      <Sel label="Estado" value={f.status || 'pendiente'} onChange={s('status')} opts={PROSPECTING_ACTIVITY_STATUSES.map((st) => ({ v: st.value, l: st.label[lang] }))} />
      <Sel label="Contacto" value={f.contact_id || ''} onChange={s('contact_id')} opts={[{ v: '', l: 'Solo empresa' }, ...contacts.map((c) => ({ v: c.id, l: c.name }))]} />
      <Inp label="Fecha/hora" type="datetime-local" value={String(f.activity_at || '').slice(0, 16)} onChange={s('activity_at')} />
      <Inp label="Resultado" value={f.outcome || ''} onChange={s('outcome')} />
      <Inp label="Siguiente paso" value={f.next_step || ''} onChange={s('next_step')} />
      <Inp label="Fecha próxima acción" type="date" value={f.next_action_at ? String(f.next_action_at).slice(0, 10) : ''} onChange={s('next_action_at')} />
      <Sel label="Responsable" value={f.owner_id || ''} onChange={s('owner_id')} opts={[{ v: '', l: '— Selecciona —' }, ...users.map((u) => ({ v: u.alias || u.name, l: u.alias || u.name }))]} />
      <Inp label="Adjunto/URL" value={f.attachment_url || ''} onChange={s('attachment_url')} />
      <Txta label="Notas" value={f.notes || ''} onChange={s('notes')} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn v="ghost" ch="Cancelar" onClick={onClose} />
        <Btn ch="Guardar" onClick={() => onSave(f)} />
      </div>
    </>
  );
}
