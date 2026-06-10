import { useMemo, useState } from "react";

const FILTERS = ["all", "system", "manual", "activity", "stage", "created"];

function formatDateTime(value) {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

function safeText(value) {
  return String(value || "").trim();
}

export default function DealJournalPanel({
  deal,
  t,
  users,
  journalEnabled,
  onAddManualEntry,
  onDeleteManualEntry,
  helpers,
}) {
  const { uid, Btn, Ic, Sel, Inp, Txta } = helpers;
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");
  const [form, setForm] = useState(() => ({
    kind: "note",
    author: "",
    authorCustom: "",
    content: "",
  }));

  const hasUsers = (users || []).length > 0;

  const entries = useMemo(() => {
    const items = [];

    if (deal?.created_at && safeText(deal?.name)) {
      items.push({
        id: `deal-created-${deal.id}`,
        source: "system",
        kind: "created",
        title: t.journalDealCreated,
        content: deal.name,
        createdAt: deal.created_at,
        canDelete: false,
      });
    }

    (deal?.activities || []).forEach((activity) => {
      if (!activity?.createdAt || !safeText(activity?.title)) return;
      items.push({
        id: `activity-${activity.id}`,
        source: "system",
        kind: "activity",
        title: `${t.journalActivityPrefix}: ${t[activity.type] || activity.type}`,
        content: [activity.title, safeText(activity.comment)].filter(Boolean).join("\n\n"),
        createdAt: activity.createdAt,
        dueDate: activity.dueDate || "",
        responsible: activity.responsible || "",
        status: activity.status || "",
        canDelete: false,
      });
    });

    (deal?.journalEntries || []).forEach((entry) => {
      if (!entry?.createdAt) return;
      if (entry.source === "manual" && !safeText(entry.content)) return;
      if (entry.kind === "stage" && (!safeText(entry.meta?.fromStage) || !safeText(entry.meta?.toStage))) return;

      if (entry.source === "manual") {
        items.push({
          id: entry.id,
          source: "manual",
          kind: "manual",
          manualKind: entry.kind,
          title: entry.kind === "comment" ? t.journalComment : t.journalNote,
          content: entry.content,
          author: entry.author || "",
          createdAt: entry.createdAt,
          canDelete: true,
        });
        return;
      }

      if (entry.kind === "stage") {
        items.push({
          id: entry.id,
          source: "system",
          kind: "stage",
          title: t.journalStageChanged,
          content: `${entry.meta?.fromStage} → ${entry.meta?.toStage}`,
          createdAt: entry.createdAt,
          canDelete: false,
        });
      }
    });

    return items
      .sort((a, b) => {
        const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (diff !== 0) return diff;
        return String(a.id).localeCompare(String(b.id));
      })
      .filter((item) => {
        if (filter !== "all") {
          if (filter === "system" && item.source !== "system") return false;
          if (filter === "manual" && item.source !== "manual") return false;
          if (filter === "activity" && item.kind !== "activity") return false;
          if (filter === "stage" && item.kind !== "stage") return false;
          if (filter === "created" && item.kind !== "created") return false;
        }

        const q = safeText(query).toLowerCase();
        if (!q) return true;

        const haystack = [
          item.title,
          item.content,
          item.author,
          item.responsible,
          item.status,
          item.dueDate,
        ]
          .filter(Boolean)
          .join(" \n ")
          .toLowerCase();

        return haystack.includes(q);
      });
  }, [deal, filter, query, t]);

  const resetForm = () => setForm({ kind: "note", author: "", authorCustom: "", content: "" });

  const handleAdd = async () => {
    const content = safeText(form.content);
    const author = safeText(hasUsers ? form.author : form.authorCustom);

    if (!journalEnabled || !content || !author || saving) return;

    setSaving(true);
    setLocalError("");
    try {
      const ok = await onAddManualEntry({
        id: uid(),
        kind: form.kind,
        author,
        content,
      });

      if (!ok) {
        setLocalError(t.journalSaveError);
        return;
      }

      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (entry) => {
    if (!entry?.canDelete) return;
    if (!window.confirm(t.journalDeleteConfirm)) return;
    await onDeleteManualEntry(entry.id);
  };

  const filterOpts = FILTERS.map((value) => ({ v: value, l: t[`journalFilter_${value}`] || value }));

  return (
    <div>
      <div style={{ background: "#f8fafc", border: "1px solid #cfd8e3", borderRadius: 12, padding: 12, marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8, marginBottom: 8 }}>
          <Sel
            label={t.journalEntryType}
            value={form.kind}
            onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value }))}
            opts={[{ v: "note", l: t.journalNote }, { v: "comment", l: t.journalComment }]}
          />
          {hasUsers ? (
            <Sel
              label={t.activityResponsible + " *"}
              value={form.author}
              onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
              opts={[{ v: "", l: t.selectOpt }, ...(users || []).map((u) => ({ v: u.alias || u.name, l: `${u.alias || u.name} (${u.name})` }))]}
            />
          ) : (
            <Inp
              label={t.journalAuthor + " *"}
              value={form.authorCustom}
              onChange={(e) => setForm((p) => ({ ...p, authorCustom: e.target.value }))}
            />
          )}
        </div>

        <Txta
          label={t.journalWriteLabel}
          value={form.content}
          onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, color: journalEnabled ? "#64748b" : "#ef4444", fontFamily: "'JetBrains Mono',monospace" }}>
            {journalEnabled ? t.journalHint : t.journalUnavailable}
          </div>
          <Btn
            ch={<><Ic n="plus" s={12} />{saving ? (t.saving || "Guardando...") : t.journalAddEntry}</>}
            onClick={handleAdd}
            disabled={saving || !journalEnabled}
            sx={{ opacity: saving || !journalEnabled ? 0.65 : 1, pointerEvents: saving || !journalEnabled ? "none" : "auto" }}
          />
        </div>
        {localError && <div style={{ marginTop: 8, fontSize: 11, color: "#ef4444", fontFamily: "'JetBrains Mono',monospace" }}>{localError}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(170px,220px) 1fr", gap: 8, marginBottom: 12 }}>
        <Sel label={t.journalFilter} value={filter} onChange={(e) => setFilter(e.target.value)} opts={filterOpts} />
        <Inp label={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!entries.length && <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'JetBrains Mono',monospace" }}>{t.journalEmpty}</div>}
        {entries.map((entry) => (
          <div key={entry.id} style={{ background: entry.source === "manual" ? "#f8fafc" : "#f5f7fa", border: "1px solid #cfd8e3", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", background: "#fff", border: "1px solid #cfd8e3", borderRadius: 5, padding: "2px 6px" }}>
                  {entry.source === "manual" ? t.journalManual : t.journalSystem}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{entry.title}</span>
                {entry.author && <span style={{ fontSize: 11, color: "#475569" }}>👤 {entry.author}</span>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>{formatDateTime(entry.createdAt)}</span>
                {entry.canDelete && (
                  <button title={t.deleteBtn} onClick={() => deleteEntry(entry)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 2 }}>
                    <Ic n="trash" s={12} />
                  </button>
                )}
              </div>
            </div>

            {entry.content && <div style={{ marginTop: 6, fontSize: 12, color: "#334155", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{entry.content}</div>}

            {(entry.dueDate || entry.responsible || entry.status) && (
              <div style={{ display: "flex", gap: 8, marginTop: 7, flexWrap: "wrap" }}>
                {entry.dueDate && <span style={{ fontSize: 10, color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>📅 {entry.dueDate}</span>}
                {entry.responsible && <span style={{ fontSize: 10, color: "#475569" }}>👤 {entry.responsible}</span>}
                {entry.status && <span style={{ fontSize: 10, color: "#475569" }}>{t[entry.status] || entry.status}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
