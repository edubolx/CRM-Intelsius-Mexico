import { useState } from "react";
import ActivitiesPanel from "../activities/ActivitiesPanel.jsx";

export default function DealDetailModal({
  deal,
  cos,
  cts,
  users,
  lang,
  currency,
  stages,
  t,
  onSaveEval,
  onDeleteEval,
  onAddActivity,
  onDeleteActivity,
  onUpdateActivityStatus,
  onUpdateActivity,
  onEditDeal,
  onClose,
  helpers,
}) {
  const {
    stageStyle,
    calcTotal,
    scoreColor,
    fv,
    Modal,
    Btn,
    Ic,
    MeddicPanel,
    today,
    uid,
    ACTIVITY_TYPES,
    ACTIVITY_STATUSES,
    Sel,
    Inp,
    Txta,
    iSx,
  } = helpers;

  const [tab, setTab] = useState(deal._openTab || "meddic");
  const co = cos.find((c) => c.id === deal.companyId);
  const ct = cts.find((c) => c.id === deal.contactId);
  const m = stageStyle(stages, deal.stage);
  const latestMeddic = deal.meddicHistory?.slice(-1)[0];
  const meddicTotal = calcTotal(latestMeddic?.meddic);

  return (
    <Modal title={deal.name} onClose={onClose} extraWide>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18, padding: "12px 14px", background: "#f5f7fa", borderRadius: 10, border: "1px solid #cfd8e3" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <span style={{ fontSize: 13 }}>{m.emoji}</span>
          <span style={{ color: m.accent, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{deal.stage}</span>
        </div>
        <div style={{ color: "#94a3b8" }}>·</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: m.accent, fontFamily: "'Inter',Arial,sans-serif" }}>{fv(deal.value, currency)}</div>
        {co && <><div style={{ color: "#94a3b8" }}>·</div><div style={{ fontSize: 12, color: "#475569" }}>🏢 {co.name}</div></>}
        {ct && <><div style={{ color: "#94a3b8" }}>·</div><div style={{ fontSize: 12, color: "#475569" }}>👤 {ct.name}</div></>}
        {deal.closingDate && <><div style={{ color: "#94a3b8" }}>·</div><div style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>{t.closing}: {deal.closingDate}</div></>}
        {(deal.leadSource || deal.leadSourceCustom) && <><div style={{ color: "#94a3b8" }}>·</div><div style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>{t.leadSource}: {deal.leadSource === "Custom" ? (deal.leadSourceCustom || "Custom") : deal.leadSource}</div></>}
        <div style={{ marginLeft: "auto" }}>
          <Btn ch={<><Ic n="edit" s={11} />{t.editDeal}</>} v="subtle" sx={{ fontSize: 11, padding: "4px 10px" }} onClick={onEditDeal} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 2, marginBottom: 18, borderBottom: "1px solid #cfd8e3" }}>
        {[{ k: "meddic", l: "MEDDIC", icon: "meddic" }, { k: "notes", l: t.notes, icon: "edit" }, { k: "activities", l: t.activities, icon: "history" }].map((tb) => (
          <button key={tb.k} onClick={() => setTab(tb.k)} style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === tb.k ? "#003e7e" : "transparent"}`, padding: "8px 14px", color: tab === tb.k ? "#27aae1" : "#64748b", fontFamily: "inherit", fontSize: 12, fontWeight: tab === tb.k ? 600 : 400, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <Ic n={tb.icon} s={12} />{tb.l}
            {tb.k === "meddic" && latestMeddic && (
              <span style={{ fontSize: 10, color: scoreColor(meddicTotal), fontFamily: "'JetBrains Mono',monospace", background: scoreColor(meddicTotal) + "22", borderRadius: 4, padding: "1px 6px", marginLeft: 2 }}>{meddicTotal}/30</span>
            )}
          </button>
        ))}
      </div>

      {tab === "meddic" && <MeddicPanel deal={deal} lang={lang} t={t} onSaveEval={onSaveEval} onDeleteEval={onDeleteEval} />}
      {tab === "notes" && (
        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {deal.notes || <span style={{ color: "#94a3b8", fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>Sin notas.</span>}
        </div>
      )}
      {tab === "activities" && (
        <ActivitiesPanel
          deal={deal}
          t={t}
          users={users}
          onAddActivity={onAddActivity}
          onDeleteActivity={onDeleteActivity}
          onUpdateActivityStatus={onUpdateActivityStatus}
          onUpdateActivity={onUpdateActivity}
          helpers={{ today, uid, ACTIVITY_TYPES, ACTIVITY_STATUSES, Sel, Inp, Txta, Btn, Ic, iSx }}
        />
      )}
    </Modal>
  );
}
