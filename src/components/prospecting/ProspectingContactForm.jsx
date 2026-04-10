import { useState } from "react";

export default function ProspectingContactForm({ init = {}, onSave, onClose, helpers }) {
  const { Inp, Txta, Btn } = helpers;
  const [f, setF] = useState({ company_id: '', name: '', title: '', email: '', phone: '', linkedin_url: '', notes: '', ...init });
  const s = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  return (
    <>
      <Inp label="Nombre *" value={f.name} onChange={s('name')} />
      <Inp label="Cargo" value={f.title || ''} onChange={s('title')} />
      <Inp label="Email" value={f.email || ''} onChange={s('email')} />
      <Inp label="Teléfono" value={f.phone || ''} onChange={s('phone')} />
      <Inp label="LinkedIn" value={f.linkedin_url || ''} onChange={s('linkedin_url')} />
      <Txta label="Notas" value={f.notes || ''} onChange={s('notes')} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn v="ghost" ch="Cancelar" onClick={onClose} />
        <Btn ch="Guardar" onClick={() => onSave(f)} disabled={!f.name?.trim()} />
      </div>
    </>
  );
}
