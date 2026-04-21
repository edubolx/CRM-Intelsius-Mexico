import { useState } from "react";

export default function ActivitiesDashboard({ dls, t, onUpdateActivityStatus, onOpenActivity, helpers }) {
  const { today, startOfWeek, ACTIVITY_STATUSES, Sel, iSx } = helpers;
  const [filter, setFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const all = dls.flatMap((d) => (d.activities || []).map((a) => ({ ...a, dealId: d.id, dealName: d.name })));
  const responsibleOptions = [...new Set(all.map((a) => (a.responsible || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const base = responsibleFilter === "all" ? all : all.filter((a) => (a.responsible || "").trim() === responsibleFilter);
  const now = new Date();
  const todayS = today();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const parseDateSafe = (v) => {
    if (!v) return null;
    const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const inCurrentWeek = (v) => {
    const d = parseDateSafe(v);
    return !!d && d >= weekStart && d < weekEnd;
  };

  const pending = base.filter((a) => a.status !== "done");
  const overdue = pending.filter((a) => a.dueDate && a.dueDate < todayS);
  const dueSoon = pending.filter((a) => a.dueDate && a.dueDate >= todayS && a.dueDate <= new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10));
  const completedWeek = base.filter((a) => a.status === "done" && [a.completedAt, a.updatedAt, a.createdAt, a.dueDate].some(inCurrentWeek));

  const lists = { all: base, pending, overdue, dueSoon, completedWeek };
  const rows = (lists[filter] || base).slice().sort((a, b) => {
    const scoreDiff = Number(b.eisenhowerScore ?? -1) - Number(a.eisenhowerScore ?? -1);
    if (scoreDiff !== 0) return scoreDiff;
    return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31');
  });
  const statusOpts = ACTIVITY_STATUSES.map((v) => ({ v, l: t[v] }));

  const cards = [
    { k: "pending", l: t.pending, v: pending.length, c: "#27aae1" },
    { k: "overdue", l: t.overdue, v: overdue.length, c: "#ef4444" },
    { k: "dueSoon", l: t.dueSoon, v: dueSoon.length, c: "#f59e0b" },
    { k: "completedWeek", l: t.completedWeek, v: completedWeek.length, c: "#22c55e" },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => setFilter("all")} style={{ background: filter === "all" ? "#003e7e" : "#ffffff", color: filter === "all" ? "#fff" : "#334155", border: "1px solid #cbd5e1", borderRadius: 9, padding: "7px 12px", fontSize: 11, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace" }}>{t.all} ({base.length})</button>
        {cards.map((s) => (
          <button key={s.k} onClick={() => setFilter(s.k)} style={{ background: filter === s.k ? s.c + "22" : "#ffffff", color: filter === s.k ? s.c : "#334155", border: `1px solid ${filter === s.k ? s.c : "#cbd5e1"}`, borderRadius: 9, padding: "7px 12px", fontSize: 11, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace" }}>
            {s.l} ({s.v})
          </button>
        ))}
        <div style={{ marginLeft: "auto", minWidth: 220 }}>
          <Sel label={t.activityResponsible} value={responsibleFilter} onChange={(e) => setResponsibleFilter(e.target.value)} opts={[{ v: "all", l: t.allResponsibles || "All" }, ...responsibleOptions.map((r) => ({ v: r, l: r }))]} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {cards.map((s) => (
          <div key={s.k} style={{ background: "#ffffff", border: "1px solid #cfd8e3", borderRadius: 12, padding: "10px 16px", flex: 1, minWidth: 130, boxShadow: '0 4px 12px rgba(15,23,42,.10)' }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: .9, fontFamily: "'JetBrains Mono',monospace", marginBottom: 2 }}>{s.l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.c, fontFamily: "'Inter',Arial,sans-serif" }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((a) => (
          <div key={a.id} onClick={() => onOpenActivity(a.dealId)} style={{ background: "#ffffff", border: "1px solid #cfd8e3", borderRadius: 10, padding: "10px 12px", cursor: "pointer", boxShadow: '0 4px 12px rgba(15,23,42,.10)' }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", background: "#f5f7fa", border: "1px solid #cfd8e3", borderRadius: 5, padding: "2px 6px" }}>{t[a.type] || a.type}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{a.title}</span>
                <span style={{ fontSize: 10, color: "#003e7e", fontFamily: "'JetBrains Mono',monospace", background: "#eaf3ff", border: "1px solid #cbd5e1", borderRadius: 5, padding: "2px 6px" }}>Deal: {a.dealName}</span>
              </div>
              <select value={a.status} onClick={(e) => e.stopPropagation()} onChange={(e) => onUpdateActivityStatus(a.dealId, a.id, e.target.value)} style={{ ...iSx, padding: "3px 6px", fontSize: 11, width: 140 }}>
                {statusOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              {a.dueDate && <span style={{ fontSize: 10, color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>📅 {a.dueDate}</span>}
              {a.responsible && <span style={{ fontSize: 10, color: "#475569" }}>👤 {a.responsible}</span>}
              {a.importanceScore != null && <span style={{ fontSize: 10, color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>Imp {a.importanceScore}</span>}
              {a.urgencyScore != null && <span style={{ fontSize: 10, color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>Urg {a.urgencyScore}</span>}
              {a.eisenhowerScore != null && <span style={{ fontSize: 10, color: "#003e7e", fontFamily: "'JetBrains Mono',monospace", background: "#eaf3ff", border: "1px solid #cbd5e1", borderRadius: 5, padding: "2px 6px" }}>Score {a.eisenhowerScore}</span>}
            </div>
            {a.comment && <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>{a.comment}</div>}
          </div>
        ))}
        {!rows.length && <div style={{ fontSize: 11, color: "#94a3b8" }}>{t.noActivities}</div>}
      </div>
    </div>
  );
}
