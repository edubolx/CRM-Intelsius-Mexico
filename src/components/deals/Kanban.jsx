import { memo, useState } from "react";

const Kanban = memo(function Kanban({ deals, cos, cts, t, currency, stages, onEdit, onDel, onStage, onViewDeal, fontSizeMode = "medium", helpers }) {
  const { fv, calcTotal, scoreColor, MEDDIC_KEYS, MEDDIC_META, Ic } = helpers;
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const zoom = fontSizeMode === "small" ? 0.9 : fontSizeMode === "large" ? 1.18 : 1;
  const closedNames = stages.filter((s) => s.isWon || s.isLost).map((s) => s.name);
  const wonNames = stages.filter((s) => s.isWon).map((s) => s.name);
  const pipe = deals.filter((d) => !closedNames.includes(d.stage)).reduce((s, d) => s + Number(d.value), 0);
  const won = deals.filter((d) => wonNames.includes(d.stage)).reduce((s, d) => s + Number(d.value), 0);

  return (
    <div style={{ zoom }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {[{ l: t.pipelineTotal, v: fv(pipe, currency), c: "#27aae1" }, { l: t.closedWon, v: fv(won, currency), c: "#22c55e" }, { l: t.totalDeals, v: deals.length, c: "#7c2b83" }].map((s) => (
          <div key={s.l} style={{ background: "#ffffff", border: "1px solid #cfd8e3", borderRadius: 12, padding: "10px 16px", flex: 1, minWidth: 120, boxShadow: '0 4px 12px rgba(15,23,42,.10)' }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: .9, fontFamily: "'JetBrains Mono',monospace", marginBottom: 2 }}>{s.l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.c, fontFamily: "'Inter',Arial,sans-serif" }}>{s.v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 9, overflowX: "auto", paddingBottom: 10, alignItems: "flex-start" }}>
        {stages.map((stg) => {
          const m = stg;
          const stage = stg.name;
          const col = deals.filter((d) => d.stage === stage);
          const colV = col.reduce((s, d) => s + Number(d.value), 0);
          const isOver = over === stage;
          return (
            <div
              key={stg.id}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (drag && drag.stage !== stage) onStage(drag.id, stage);
                setDrag(null);
                setOver(null);
              }}
              style={{ flex: "0 0 205px", background: isOver ? m.bg + "f5" : m.bg, border: `1px solid ${isOver ? m.accent : m.border}`, borderRadius: 12, padding: "11px 9px", transition: "all .15s", boxShadow: isOver ? `0 0 14px ${m.accent}25, 0 10px 22px rgba(15,23,42,.16)` : '0 6px 16px rgba(15,23,42,.10)' }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7, paddingBottom: 7, borderBottom: `1px solid ${m.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 12 }}>{m.emoji}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: m.accent, fontFamily: "'JetBrains Mono',monospace", letterSpacing: .2 }}>{stage}</span>
                </div>
                <span style={{ fontSize: 10, color: "#64748b", background: "#f5f7fa", borderRadius: 4, padding: "1px 5px", fontFamily: "'JetBrains Mono',monospace" }}>{col.length}</span>
              </div>
              {colV > 0 && <div style={{ fontSize: 10, color: m.accent, marginBottom: 7, fontFamily: "'JetBrains Mono',monospace", opacity: .75 }}>{fv(colV, currency)}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {col.map((dl) => {
                  const co = cos.find((c) => c.id === dl.companyId);
                  const ct = cts.find((c) => c.id === dl.contactId);
                  const latestEv = dl.meddicHistory?.slice(-1)[0];
                  const mTotal = calcTotal(latestEv?.meddic);
                  const hasMeddic = dl.meddicHistory?.length > 0;
                  return (
                    <div key={dl.id} draggable onDragStart={() => setDrag(dl)} onDragEnd={() => { setDrag(null); setOver(null); }} style={{ background: "#f5f7fa", border: "1px solid #cbd5e1", borderRadius: 9, padding: "9px", cursor: "grab", userSelect: "none", opacity: drag?.id === dl.id ? .4 : 1, transition: "opacity .1s" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 3 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", lineHeight: 1.3, flex: 1 }}>{dl.name}</div>
                        <div style={{ display: "flex", gap: 1, flexShrink: 0 }}>
                          <button onClick={(e) => { e.stopPropagation(); onViewDeal(dl); }} title="MEDDIC" style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", padding: "2px 3px", opacity: .65 }}><Ic n="meddic" s={11} /></button>
                          <button onClick={(e) => { e.stopPropagation(); onEdit(dl); }} style={{ background: "none", border: "none", color: m.accent, cursor: "pointer", padding: "2px 3px", opacity: .65 }}><Ic n="edit" s={11} /></button>
                          <button onClick={(e) => { e.stopPropagation(); onDel(dl.id); }} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "2px 3px", opacity: .55 }}><Ic n="trash" s={11} /></button>
                        </div>
                      </div>
                      {Number(dl.value) > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: m.accent, marginTop: 4, fontFamily: "'Inter',Arial,sans-serif" }}>{fv(dl.value, currency)}</div>}
                      {co && <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>🏢 {co.name}</div>}
                      {ct && <div style={{ fontSize: 10, color: "#475569" }}>👤 {ct.name}</div>}
                      {dl.closingDate && <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 4, fontFamily: "'JetBrains Mono',monospace" }}>{t.closing}: {dl.closingDate}</div>}

                      <div style={{ marginTop: 7, paddingTop: 7, borderTop: "1px solid #dce4ec", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onViewDeal(dl); }}>
                        {hasMeddic ? (
                          <>
                            <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                              {MEDDIC_KEYS.map((k) => {
                                const meta = MEDDIC_META[k];
                                const sc = latestEv?.meddic[k]?.score || 0;
                                return (
                                  <div key={k} title={`${meta.letter}: ${sc}/5`} style={{ width: 14, height: 14, borderRadius: 3, background: sc > 0 ? meta.color + "33" : "#cfd8e3", border: `1px solid ${sc > 0 ? meta.color + "55" : "#cfd8e3"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ fontSize: 7, color: sc > 0 ? meta.color : "#94a3b8", fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{sc}</span>
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <div style={{ width: 30, height: 4, background: "#cfd8e3", borderRadius: 2, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${(mTotal / 30) * 100}%`, background: scoreColor(mTotal), borderRadius: 2, transition: "width .3s" }} />
                              </div>
                              <span style={{ fontSize: 9, color: scoreColor(mTotal), fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{mTotal}/30</span>
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'JetBrains Mono',monospace", display: "flex", alignItems: "center", gap: 4 }}>
                            <Ic n="meddic" s={9} />MEDDIC sin evaluar
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {col.length === 0 && <div style={{ fontSize: 10, color: "#cfd8e3", textAlign: "center", padding: "10px 0", fontFamily: "'JetBrains Mono',monospace" }}>{t.noDeals}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default Kanban;
