import { useState } from "react";

export default function ActivitiesPanel({
  deal,
  t,
  users,
  onAddActivity,
  onDeleteActivity,
  onUpdateActivityStatus,
  onUpdateActivity,
  helpers,
}) {
  const { today, uid, ACTIVITY_TYPES, ACTIVITY_STATUSES, Sel, Inp, Txta, Btn, Ic, iSx } = helpers;

  const makeEmptyForm = () => ({ type: "task", title: "", dueDate: today(), responsible: "", status: "pending", comment: "" });
  const [form, setForm] = useState(makeEmptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");
  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const typeOpts = ACTIVITY_TYPES.map((v) => ({ v, l: t[v] }));
  const statusOpts = ACTIVITY_STATUSES.map((v) => ({ v, l: t[v] }));

  const resetForm = () => {
    setForm(makeEmptyForm());
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.title?.trim() || saving) return;
    setLocalError("");
    setSaving(true);
    try {
      if (editingId) {
        const ok = await onUpdateActivity(editingId, { ...form, title: form.title.trim() });
        if (!ok) {
          setLocalError('No se pudo guardar la actividad.');
          return;
        }
        resetForm();
        return;
      }
      const nowIso = new Date().toISOString();
      const ok = await onAddActivity({
        id: uid(),
        ...form,
        title: form.title.trim(),
        createdAt: nowIso,
        updatedAt: nowIso,
        completedAt: form.status === "done" ? nowIso : null,
      });
      if (!ok) {
        setLocalError('No se pudo guardar la actividad.');
        return;
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (a) => {
    setEditingId(a.id);
    setForm({
      type: a.type || "task",
      title: a.title || "",
      dueDate: a.dueDate || today(),
      responsible: a.responsible || "",
      status: a.status || "pending",
      comment: a.comment || "",
    });
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8, marginBottom: 10 }}>
        <Sel label={t.activityType} value={form.type} onChange={(e) => setF("type", e.target.value)} opts={typeOpts} />
        <Inp label={t.activityTitle + " *"} value={form.title} onChange={(e) => setF("title", e.target.value)} />
        <Inp label={t.activityDueDate} type="date" value={form.dueDate} onChange={(e) => setF("dueDate", e.target.value)} />
        <Sel label={t.activityResponsible} value={form.responsible} onChange={(e) => setF("responsible", e.target.value)} opts={[{ v: "", l: t.selectOpt }, ...(users || []).map((u) => ({ v: u.alias || u.name, l: `${u.alias || u.name} (${u.name})` }))]} />
        <Sel label={t.activityStatus} value={form.status} onChange={(e) => setF("status", e.target.value)} opts={statusOpts} />
      </div>
      <Txta label={t.activityComment} value={form.comment} onChange={(e) => setF("comment", e.target.value)} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        {editingId && <Btn v="ghost" ch={t.cancel} onClick={resetForm} />}
        <Btn ch={<><Ic n={editingId ? "check" : "plus"} s={12} />{saving ? (t.saving || 'Guardando...') : (editingId ? t.activityUpdate : t.addActivity)}</>} onClick={handleSave} disabled={saving} sx={{ opacity: saving ? 0.65 : 1, pointerEvents: saving ? 'none' : 'auto' }} />
      </div>
      {localError && <div style={{ marginTop: 8, fontSize: 11, color: '#ef4444', fontFamily: "'JetBrains Mono',monospace" }}>{localError}</div>}

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {(!(deal.activities || []).length) && <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'JetBrains Mono',monospace" }}>{t.noActivities}</div>}
        {[...(deal.activities || [])].sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")).map((a) => (
          <div key={a.id} style={{ background: "#f5f7fa", border: "1px solid #cfd8e3", borderRadius: 10, padding: "9px 10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", background: "#ffffff", border: "1px solid #cfd8e3", borderRadius: 5, padding: "2px 6px" }}>{t[a.type] || a.type}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{a.title}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <select value={a.status} onChange={(e) => onUpdateActivityStatus(a.id, e.target.value)} style={{ ...iSx, padding: "3px 6px", fontSize: 11, width: 120 }}>
                  {statusOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                <button title={t.activityEdit} onClick={() => startEdit(a)} style={{ background: "none", border: "none", color: "#003e7e", cursor: "pointer", padding: 2 }}><Ic n="edit" s={12} /></button>
                <button title={t.deleteBtn} onClick={() => onDeleteActivity(a.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 2 }}><Ic n="trash" s={12} /></button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              {a.dueDate && <span style={{ fontSize: 10, color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>📅 {a.dueDate}</span>}
              {a.responsible && <span style={{ fontSize: 10, color: "#475569" }}>👤 {a.responsible}</span>}
            </div>
            {a.comment && <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>{a.comment}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
