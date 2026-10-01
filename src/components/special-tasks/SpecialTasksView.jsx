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

const emptyTask = {
  title: "",
  description: "",
  ownerId: "",
  importanceScore: 3,
  urgencyScore: 3,
  dueDate: "",
  status: "notStarted",
  dealId: "",
  comments: "",
};

const inputStyle = { width: "100%", background: "#f8fafc", border: "1px solid #cfd8e3", borderRadius: 10, padding: "8px 11px", color: "#0f172a", fontSize: 13, fontFamily: "inherit", outline: "none" };
const labelStyle = { display: "block", fontSize: 10, color: "#64748b", marginBottom: 4, letterSpacing: .8, textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace" };

const uid = () => crypto.randomUUID();
const score = (task) => Number(task.importanceScore || 0) + Number(task.urgencyScore || 0);
const isHigh = (value) => Number(value || 0) >= 4;
const quadrantFor = (task) => {
  const important = isHigh(task.importanceScore);
  const urgent = isHigh(task.urgencyScore);
  if (important && urgent) return "doNow";
  if (important && !urgent) return "schedule";
  if (!important && urgent) return "delegate";
  return "backlog";
};
const statusLabel = (value) => STATUSES.find((s) => s.value === value)?.label || value;

function Field({ label, children }) {
  return <div style={{ marginBottom: 12 }}>{label && <label style={labelStyle}>{label}</label>}{children}</div>;
}

function TaskForm({ initialTask, users, deals, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initialTask || emptyTask);
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const finalScore = score(form);

  return (
    <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 16, padding: 16, boxShadow: "0 6px 18px rgba(15,23,42,.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, color: "#0f172a" }}>{form.id ? "Editar tarea especial" : "Nueva tarea especial"}</h3>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Score final: <b>{finalScore}</b> · {QUADRANTS.find((q) => q.key === quadrantFor(form))?.title}</div>
        </div>
        <button onClick={onCancel} style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 10, padding: "7px 12px", cursor: "pointer", color: "#334155" }}>Cerrar</button>
      </div>

      <Field label="Título">
        <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ej. Resolver tema especial de operación" style={inputStyle} />
      </Field>
      <Field label="Descripción">
        <textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
        <Field label="Responsable">
          <select value={form.ownerId || ""} onChange={(e) => set("ownerId", e.target.value)} style={inputStyle}>
            <option value="">— Sin responsable —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.alias || u.email}</option>)}
          </select>
        </Field>
        <Field label="Deal relacionado">
          <select value={form.dealId || ""} onChange={(e) => set("dealId", e.target.value)} style={inputStyle}>
            <option value="">— Sin deal —</option>
            {deals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Fecha límite">
          <input type="date" value={form.dueDate || ""} onChange={(e) => set("dueDate", e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Estado">
          <select value={form.status || "notStarted"} onChange={(e) => set("status", e.target.value)} style={inputStyle}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Importancia 1–5">
          <select value={form.importanceScore} onChange={(e) => set("importanceScore", Number(e.target.value))} style={inputStyle}>
            {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Urgencia 1–5">
          <select value={form.urgencyScore} onChange={(e) => set("urgencyScore", Number(e.target.value))} style={inputStyle}>
            {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Comentarios / notas">
        <textarea value={form.comments || ""} onChange={(e) => set("comments", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel} style={{ background: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}>Cancelar</button>
        <button disabled={saving || !form.title.trim()} onClick={() => onSave(form)} style={{ background: "#003e7e", color: "#fff", border: "1px solid #003e7e", borderRadius: 10, padding: "8px 14px", cursor: saving ? "not-allowed" : "pointer", opacity: saving || !form.title.trim() ? .65 : 1 }}>{saving ? "Guardando..." : "Guardar"}</button>
      </div>
    </div>
  );
}

function TaskCard({ task, usersById, dealsById, onEdit, onDelete }) {
  const q = QUADRANTS.find((x) => x.key === quadrantFor(task));
  return (
    <div style={{ background: "#fff", border: `1px solid ${q?.color || "#cbd5e1"}33`, borderLeft: `4px solid ${q?.color || "#64748b"}`, borderRadius: 12, padding: 10, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{task.title}</div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: q?.color, fontWeight: 700 }}>{score(task)}</div>
      </div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, lineHeight: 1.45 }}>
        {usersById.get(task.ownerId)?.name || usersById.get(task.ownerId)?.alias || "Sin responsable"}
        {task.dueDate ? ` · ${task.dueDate}` : ""}
        {task.dealId ? ` · ${dealsById.get(task.dealId)?.name || "Deal"}` : ""}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
        <span style={{ fontSize: 10, color: "#334155", background: "#f1f5f9", borderRadius: 999, padding: "3px 8px" }}>{statusLabel(task.status)}</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => onEdit(task)} style={{ background: "none", border: "none", color: "#003e7e", cursor: "pointer", fontSize: 11 }}>Editar</button>
          <button onClick={() => onDelete(task)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 11 }}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

export default function SpecialTasksView({ users = [], deals = [], search = "" }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingTask, setEditingTask] = useState(null);
  const [filters, setFilters] = useState({ ownerId: "", status: "", quadrant: "", dealId: "", due: "" });

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const dealsById = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);

  const loadTasks = async () => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase.from("special_tasks").select("*").order("eisenhower_score", { ascending: false }).order("due_date", { ascending: true });
    if (loadError) {
      setError(loadError.message || "No se pudieron cargar las tareas especiales.");
      setTasks([]);
    } else {
      setTasks((data || []).map((row) => ({
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
      })));
    }
    setLoading(false);
  };

  useEffect(() => { loadTasks(); }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    const channel = supabase
      .channel("crm-realtime-special_tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "special_tasks" }, loadTasks)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    return tasks.filter((task) => {
      const haystack = [task.title, task.description, task.comments, usersById.get(task.ownerId)?.name, dealsById.get(task.dealId)?.name].join(" ").toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (filters.ownerId && task.ownerId !== filters.ownerId) return false;
      if (filters.status && task.status !== filters.status) return false;
      if (filters.quadrant && quadrantFor(task) !== filters.quadrant) return false;
      if (filters.dealId && task.dealId !== filters.dealId) return false;
      if (filters.due === "overdue" && (!task.dueDate || task.dueDate >= today || task.status === "done" || task.status === "cancelled")) return false;
      if (filters.due === "withDue" && !task.dueDate) return false;
      return true;
    });
  }, [tasks, search, filters, usersById, dealsById]);

  const saveTask = async (form) => {
    const now = new Date().toISOString();
    const row = {
      id: form.id || uid(),
      title: form.title.trim(),
      description: form.description || null,
      owner_id: form.ownerId || null,
      deal_id: form.dealId || null,
      importance_score: Number(form.importanceScore || 0),
      urgency_score: Number(form.urgencyScore || 0),
      due_date: form.dueDate || null,
      status: form.status || "notStarted",
      comments: form.comments || null,
      updated_at: now,
    };
    if (!form.id) row.created_at = now;
    setSaving(true);
    const { error: saveError } = await supabase.from("special_tasks").upsert([row], { onConflict: "id" });
    setSaving(false);
    if (saveError) {
      setError(saveError.message || "No se pudo guardar la tarea.");
      return;
    }
    setEditingTask(null);
    await loadTasks();
  };

  const deleteTask = async (task) => {
    if (!window.confirm(`¿Eliminar tarea "${task.title}"?`)) return;
    const { error: deleteError } = await supabase.from("special_tasks").delete().eq("id", task.id);
    if (deleteError) setError(deleteError.message || "No se pudo eliminar la tarea.");
    await loadTasks();
  };

  const summary = QUADRANTS.map((q) => ({ ...q, count: filteredTasks.filter((task) => quadrantFor(task) === q.key).length }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>Tareas especiales</h2>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>Seguimiento operativo independiente con matriz Eisenhower y score directo.</div>
        </div>
        <button onClick={() => setEditingTask(emptyTask)} style={{ background: "#003e7e", color: "#fff", border: "1px solid #003e7e", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontWeight: 600 }}>+ Nueva tarea</button>
      </div>

      {error && <div style={{ background: "#fde8e8", color: "#9a3535", border: "1px solid #d4a0a0", borderRadius: 12, padding: 12, fontSize: 12 }}>⚠️ {error}</div>}
      {editingTask && <TaskForm initialTask={editingTask} users={users} deals={deals} onSave={saveTask} onCancel={() => setEditingTask(null)} saving={saving} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10 }}>
        {summary.map((q) => <div key={q.key} style={{ background: q.bg, border: `1px solid ${q.color}33`, borderRadius: 12, padding: 12 }}><div style={{ fontSize: 10, color: q.color, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase" }}>{q.title}</div><div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{q.count}</div><div style={{ fontSize: 11, color: "#64748b" }}>{q.subtitle}</div></div>)}
      </div>

      <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 14, padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <select value={filters.ownerId} onChange={(e) => setFilters((f) => ({ ...f, ownerId: e.target.value }))} style={inputStyle}><option value="">Todos los responsables</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name || u.alias}</option>)}</select>
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} style={inputStyle}><option value="">Todos los estados</option>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        <select value={filters.quadrant} onChange={(e) => setFilters((f) => ({ ...f, quadrant: e.target.value }))} style={inputStyle}><option value="">Todos los cuadrantes</option>{QUADRANTS.map((q) => <option key={q.key} value={q.key}>{q.title}</option>)}</select>
        <select value={filters.dealId} onChange={(e) => setFilters((f) => ({ ...f, dealId: e.target.value }))} style={inputStyle}><option value="">Todos los deals</option>{deals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <select value={filters.due} onChange={(e) => setFilters((f) => ({ ...f, due: e.target.value }))} style={inputStyle}><option value="">Todas las fechas</option><option value="overdue">Vencidas</option><option value="withDue">Con fecha límite</option></select>
      </div>

      {loading ? <div style={{ color: "#64748b", fontSize: 12 }}>Cargando tareas especiales...</div> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(245px,1fr))", gap: 12 }}>
            {QUADRANTS.map((q) => (
              <div key={q.key} style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 14, padding: 12, minHeight: 180 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div><div style={{ fontSize: 13, fontWeight: 800, color: q.color }}>{q.title}</div><div style={{ fontSize: 10, color: "#64748b" }}>{q.subtitle}</div></div>
                  <span style={{ fontSize: 11, color: q.color, background: q.bg, borderRadius: 999, padding: "3px 8px" }}>{filteredTasks.filter((task) => quadrantFor(task) === q.key).length}</span>
                </div>
                {filteredTasks.filter((task) => quadrantFor(task) === q.key).map((task) => <TaskCard key={task.id} task={task} usersById={usersById} dealsById={dealsById} onEdit={setEditingTask} onDelete={deleteTask} />)}
              </div>
            ))}
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #cbd5e1", fontSize: 13, fontWeight: 800 }}>Tabla detallada</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980, fontSize: 12 }}>
                <thead><tr style={{ background: "#f8fafc", color: "#475569" }}>{["Tarea", "Responsable", "Imp.", "Urg.", "Score", "Cuadrante", "Estado", "Fecha límite", "Deal", "Acciones"].map((h) => <th key={h} style={{ textAlign: "left", padding: "9px 10px", borderBottom: "1px solid #cbd5e1" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {filteredTasks.map((task) => {
                    const q = QUADRANTS.find((x) => x.key === quadrantFor(task));
                    return <tr key={task.id} style={{ borderBottom: "1px solid #eef2f7" }}><td style={{ padding: "9px 10px", fontWeight: 700 }}>{task.title}<div style={{ fontSize: 10, color: "#64748b", fontWeight: 400 }}>{task.description}</div></td><td style={{ padding: "9px 10px" }}>{usersById.get(task.ownerId)?.name || usersById.get(task.ownerId)?.alias || "—"}</td><td style={{ padding: "9px 10px" }}>{task.importanceScore}</td><td style={{ padding: "9px 10px" }}>{task.urgencyScore}</td><td style={{ padding: "9px 10px", fontWeight: 800 }}>{score(task)}</td><td style={{ padding: "9px 10px", color: q?.color, fontWeight: 700 }}>{q?.title}</td><td style={{ padding: "9px 10px" }}>{statusLabel(task.status)}</td><td style={{ padding: "9px 10px" }}>{task.dueDate || "—"}</td><td style={{ padding: "9px 10px" }}>{dealsById.get(task.dealId)?.name || "—"}</td><td style={{ padding: "9px 10px" }}><button onClick={() => setEditingTask(task)} style={{ background: "none", border: "none", color: "#003e7e", cursor: "pointer" }}>Editar</button></td></tr>;
                  })}
                  {filteredTasks.length === 0 && <tr><td colSpan="10" style={{ padding: 24, color: "#94a3b8", textAlign: "center", fontFamily: "'JetBrains Mono',monospace" }}>Sin tareas especiales.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
