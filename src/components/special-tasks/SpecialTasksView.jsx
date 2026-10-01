import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient.js";

const STATUSES = [
  { value: "notStarted", label: "Not started" },
  { value: "inProgress", label: "In progress" },
  { value: "waiting", label: "Waiting" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

const QUADRANTS = [
  { key: "doNow", title: "Do now", subtitle: "Importante + urgente", color: "#ef4444", bg: "#fde8e8" },
  { key: "schedule", title: "Schedule", subtitle: "Importante + no urgente", color: "#f59e0b", bg: "#fff7ed" },
  { key: "delegate", title: "Delegate", subtitle: "Urgente + menos importante", color: "#27aae1", bg: "#e8f4fc" },
  { key: "backlog", title: "Backlog / Eliminate", subtitle: "Baja urgencia + baja importancia", color: "#64748b", bg: "#f1f5f9" },
];

const inputStyle = { width: "100%", boxSizing: "border-box", background: "transparent", border: "1px solid transparent", borderRadius: 8, padding: "7px 9px", color: "#0f172a", fontSize: 12, fontFamily: "inherit", outline: "none" };
const filterStyle = { width: "100%", background: "#f8fafc", border: "1px solid #cfd8e3", borderRadius: 10, padding: "8px 11px", color: "#0f172a", fontSize: 13, fontFamily: "inherit", outline: "none" };
const GRID_COLUMNS = [720, 170, 96, 96, 76, 150, 140, 140, 230, 280, 76, 82];
const GRID_WIDTH = GRID_COLUMNS.reduce((sum, w) => sum + w, 0);
const uid = () => crypto.randomUUID();
const score = (task) => Number(task.importanceScore || 0) + Number(task.urgencyScore || 0);
const quadrantFor = (task) => {
  const total = score(task);
  if (total >= 8) return "doNow";
  if (total >= 6) return "schedule";
  if (total >= 4) return "delegate";
  return "backlog";
};
const statusLabel = (value) => STATUSES.find((s) => s.value === value)?.label || value;
const newTask = () => ({
  id: uid(),
  title: "",
  description: "",
  ownerId: "",
  dealId: "",
  importanceScore: 3,
  urgencyScore: 3,
  dueDate: "",
  status: "notStarted",
  comments: "",
  isNew: true,
});

function rowToTask(row) {
  return {
    id: row.id,
    title: row.title || "",
    description: row.description || "",
    ownerId: row.owner_id || "",
    dealId: row.deal_id || "",
    importanceScore: row.importance_score ?? 3,
    urgencyScore: row.urgency_score ?? 3,
    eisenhowerScore: row.eisenhower_score ?? Number(row.importance_score || 0) + Number(row.urgency_score || 0),
    dueDate: row.due_date || "",
    status: row.status || "notStarted",
    comments: row.comments || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isNew: false,
  };
}

function taskToRow(task) {
  const now = new Date().toISOString();
  const row = {
    id: task.id,
    title: String(task.title || "").trim(),
    description: task.description || null,
    owner_id: task.ownerId || null,
    deal_id: task.dealId || null,
    importance_score: Number(task.importanceScore || 0),
    urgency_score: Number(task.urgencyScore || 0),
    due_date: task.dueDate || null,
    status: task.status || "notStarted",
    comments: task.comments || null,
    updated_at: now,
  };
  if (task.isNew) row.created_at = now;
  return row;
}

function EditableCell({ children, w = 120 }) {
  return <td style={{ padding: 0, borderBottom: "1px solid #eef2f7", width: w, minWidth: w, verticalAlign: "top" }}>{children}</td>;
}

export default function SpecialTasksView({ users = [], deals = [], search = "" }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingById, setSavingById] = useState({});
  const [filters, setFilters] = useState({ ownerId: "", status: "", quadrant: "", dealId: "", due: "" });

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const dealsById = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);

  const loadTasks = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase.from("special_tasks").select("*").order("eisenhower_score", { ascending: false }).order("due_date", { ascending: true });
    if (loadError) {
      setError(loadError.message || "No se pudieron cargar las tareas especiales.");
      setTasks([]);
    } else {
      setTasks((data || []).map(rowToTask));
    }
    if (!quiet) setLoading(false);
  };

  useEffect(() => { loadTasks(); }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    const channel = supabase
      .channel("crm-realtime-special_tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "special_tasks" }, () => loadTasks({ quiet: true }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateLocal = (id, patch) => setTasks((prev) => prev.map((task) => task.id === id ? { ...task, ...patch } : task));

  const saveTask = async (task) => {
    if (!String(task.title || "").trim()) return;
    setSavingById((prev) => ({ ...prev, [task.id]: "saving" }));
    const { error: saveError } = await supabase.from("special_tasks").upsert([taskToRow(task)], { onConflict: "id" }).select("*").single();
    if (saveError) {
      setSavingById((prev) => ({ ...prev, [task.id]: "error" }));
      setError(saveError.message || "No se pudo guardar la tarea.");
      return;
    }
    setSavingById((prev) => ({ ...prev, [task.id]: "saved" }));
    setTasks((prev) => prev.map((item) => item.id === task.id ? { ...item, isNew: false } : item));
    setTimeout(() => setSavingById((prev) => ({ ...prev, [task.id]: "" })), 1400);
  };

  const patchAndSave = async (id, patch) => {
    const task = tasks.find((x) => x.id === id);
    if (!task) return;
    const next = { ...task, ...patch };
    updateLocal(id, patch);
    await saveTask(next);
  };

  const addInlineRow = () => setTasks((prev) => [newTask(), ...prev]);

  const deleteTask = async (task) => {
    if (task.isNew && !task.title.trim()) {
      setTasks((prev) => prev.filter((x) => x.id !== task.id));
      return;
    }
    if (!window.confirm(`¿Eliminar tarea "${task.title || "sin título"}"?`)) return;
    if (!task.isNew) {
      const { error: deleteError } = await supabase.from("special_tasks").delete().eq("id", task.id);
      if (deleteError) {
        setError(deleteError.message || "No se pudo eliminar la tarea.");
        return;
      }
    }
    setTasks((prev) => prev.filter((x) => x.id !== task.id));
  };

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    return tasks
      .filter((task) => {
        const haystack = [task.title, task.description, task.comments, usersById.get(task.ownerId)?.name, dealsById.get(task.dealId)?.name].join(" ").toLowerCase();
        if (q && !haystack.includes(q)) return false;
        if (filters.ownerId && task.ownerId !== filters.ownerId) return false;
        if (filters.status && task.status !== filters.status) return false;
        if (filters.quadrant && quadrantFor(task) !== filters.quadrant) return false;
        if (filters.dealId && task.dealId !== filters.dealId) return false;
        if (filters.due === "overdue" && (!task.dueDate || task.dueDate >= today || task.status === "done" || task.status === "cancelled")) return false;
        if (filters.due === "withDue" && !task.dueDate) return false;
        return true;
      })
      .sort((a, b) => {
        const doneDiff = Number(a.status === "done") - Number(b.status === "done");
        if (doneDiff) return doneDiff;
        const scoreDiff = score(b) - score(a);
        if (scoreDiff) return scoreDiff;
        const urgencyDiff = Number(b.urgencyScore || 0) - Number(a.urgencyScore || 0);
        if (urgencyDiff) return urgencyDiff;
        return String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31"));
      });
  }, [tasks, search, filters, usersById, dealsById]);

  const summary = QUADRANTS.map((q) => ({ ...q, count: filteredTasks.filter((task) => quadrantFor(task) === q.key).length }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>Tareas especiales</h2>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>Grid editable directo. Score = importancia + urgencia; misma suma = misma categoría.</div>
        </div>
        <button onClick={addInlineRow} style={{ background: "#003e7e", color: "#fff", border: "1px solid #003e7e", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontWeight: 600 }}>+ Nueva fila</button>
      </div>

      {error && <div style={{ background: "#fde8e8", color: "#9a3535", border: "1px solid #d4a0a0", borderRadius: 12, padding: 12, fontSize: 12 }}>⚠️ {error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10 }}>
        {summary.map((q) => <div key={q.key} style={{ background: q.bg, border: `1px solid ${q.color}33`, borderRadius: 12, padding: 12 }}><div style={{ fontSize: 10, color: q.color, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase" }}>{q.title}</div><div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{q.count}</div><div style={{ fontSize: 11, color: "#64748b" }}>{q.subtitle}</div></div>)}
      </div>

      <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 14, padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <select value={filters.ownerId} onChange={(e) => setFilters((f) => ({ ...f, ownerId: e.target.value }))} style={filterStyle}><option value="">Todos los responsables</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name || u.alias}</option>)}</select>
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} style={filterStyle}><option value="">Todos los estados</option>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        <select value={filters.quadrant} onChange={(e) => setFilters((f) => ({ ...f, quadrant: e.target.value }))} style={filterStyle}><option value="">Todos los cuadrantes</option>{QUADRANTS.map((q) => <option key={q.key} value={q.key}>{q.title}</option>)}</select>
        <select value={filters.dealId} onChange={(e) => setFilters((f) => ({ ...f, dealId: e.target.value }))} style={filterStyle}><option value="">Todos los deals</option>{deals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <select value={filters.due} onChange={(e) => setFilters((f) => ({ ...f, due: e.target.value }))} style={filterStyle}><option value="">Todas las fechas</option><option value="overdue">Vencidas</option><option value="withDue">Con fecha límite</option></select>
      </div>

      {loading ? <div style={{ color: "#64748b", fontSize: 12 }}>Cargando tareas especiales...</div> : (
        <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>Cuadrícula editable</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>Tip: crea una fila, escribe el título y sal de la celda para guardar.</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: GRID_WIDTH, minWidth: GRID_WIDTH, borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
              <colgroup>{GRID_COLUMNS.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
              <thead><tr style={{ background: "#f8fafc", color: "#475569" }}>{["Tarea", "Responsable", "Imp. (5 alto)", "Urg. (5 alto)", "Score", "Cuadrante", "Estado", "Fecha límite", "Deal", "Comentarios", "Sync", ""].map((h) => <th key={h} style={{ textAlign: "left", padding: "9px 10px", borderBottom: "1px solid #cbd5e1", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const q = QUADRANTS.find((x) => x.key === quadrantFor(task));
                  const saveState = savingById[task.id];
                  const cellInput = { ...inputStyle };
                  return (
                    <tr key={task.id} style={{ background: task.isNew ? "#f8fafc" : "#fff" }}>
                      <EditableCell w={720}><input value={task.title} title={task.title || ""} placeholder="Nueva tarea..." onChange={(e) => updateLocal(task.id, { title: e.target.value })} onBlur={(e) => patchAndSave(task.id, { title: e.target.value })} style={{ ...cellInput, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} /></EditableCell>
                      <EditableCell w={165}><select value={task.ownerId || ""} onChange={(e) => patchAndSave(task.id, { ownerId: e.target.value })} style={cellInput}><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name || u.alias || u.email}</option>)}</select></EditableCell>
                      <EditableCell w={72}><select value={task.importanceScore} onChange={(e) => patchAndSave(task.id, { importanceScore: Number(e.target.value) })} style={cellInput}>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}</select></EditableCell>
                      <EditableCell w={72}><select value={task.urgencyScore} onChange={(e) => patchAndSave(task.id, { urgencyScore: Number(e.target.value) })} style={cellInput}>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}</select></EditableCell>
                      <EditableCell w={70}><div style={{ padding: "9px 10px", fontWeight: 900, color: q?.color }}>{score(task)}</div></EditableCell>
                      <EditableCell w={145}><div style={{ padding: "9px 10px", color: q?.color, fontWeight: 800 }}>{q?.title}</div></EditableCell>
                      <EditableCell w={135}><select value={task.status || "notStarted"} onChange={(e) => patchAndSave(task.id, { status: e.target.value })} style={cellInput}>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></EditableCell>
                      <EditableCell w={135}><input type="date" value={task.dueDate || ""} onChange={(e) => patchAndSave(task.id, { dueDate: e.target.value })} style={cellInput} /></EditableCell>
                      <EditableCell w={210}><select value={task.dealId || ""} onChange={(e) => patchAndSave(task.id, { dealId: e.target.value })} style={cellInput}><option value="">—</option>{deals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></EditableCell>
                      <EditableCell w={250}><textarea value={task.comments || ""} onChange={(e) => updateLocal(task.id, { comments: e.target.value })} onBlur={(e) => patchAndSave(task.id, { comments: e.target.value })} rows={2} style={{ ...cellInput, resize: "vertical" }} /></EditableCell>
                      <EditableCell w={72}><div style={{ padding: "9px 10px", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: saveState === "error" ? "#ef4444" : saveState === "saved" ? "#16a34a" : "#94a3b8" }}>{saveState === "saving" ? "..." : saveState === "saved" ? "saved" : saveState === "error" ? "error" : task.isNew ? "new" : ""}</div></EditableCell>
                      <EditableCell w={76}><button onClick={() => deleteTask(task)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "9px 10px", fontSize: 11 }}>Eliminar</button></EditableCell>
                    </tr>
                  );
                })}
                {filteredTasks.length === 0 && <tr><td colSpan="12" style={{ padding: 24, color: "#94a3b8", textAlign: "center", fontFamily: "'JetBrains Mono',monospace" }}>Sin tareas especiales. Usa “+ Nueva fila”.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
