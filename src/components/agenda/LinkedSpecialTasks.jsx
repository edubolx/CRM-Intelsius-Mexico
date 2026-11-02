import { AGENDA_STATUS } from "./agendaLabels.js";

// A second read-only view of original task IDs; never an activity/journal copy.
export default function LinkedSpecialTasks({
  rows = [],
  dealId,
  lang = "es",
  source,
  onEdit,
  onRetry,
}) {
  const en = lang === "en";
  const statuses = AGENDA_STATUS[en ? "en" : "es"];
  const tasks = rows.filter(
    (row) => row.source === "special_task" && row.dealId === dealId,
  );
  return (
    <aside
      className="agenda"
      style={{ marginTop: 24 }}
      aria-label={en ? "Linked special tasks" : "Tareas especiales vinculadas"}
    >
      <h2 style={{ fontSize: 14, marginBottom: 10 }}>
        {en ? "Linked special tasks" : "Tareas especiales vinculadas"}
      </h2>
      <p className="agenda-footnote">
        {en
          ? "Original tasks, not copies in Activities or Journal."
          : "Tareas originales, no copias en Actividades ni Bitácora."}
      </p>
      {source?.loading ? (
        <p role="status">{en ? "Loading…" : "Cargando…"}</p>
      ) : source?.error ? (
        <p role="alert">
          {source.error}{" "}
          <button className="agenda-link" onClick={onRetry}>
            {en ? "Retry" : "Reintentar"}
          </button>
        </p>
      ) : tasks.length === 0 ? (
        <p className="agenda-muted">
          {en
            ? "No linked special tasks."
            : "Sin tareas especiales vinculadas."}
        </p>
      ) : (
        tasks.map((row) => (
          <article
            key={row.key}
            data-agenda-key={row.key}
            style={{
              background: "#f8fafc",
              border: "1px solid #dfe6ed",
              borderRadius: 8,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <button
              className="agenda-title-button"
              onClick={() => onEdit(row.id)}
              aria-label={`${en ? "Open source task" : "Abrir tarea original"}: ${row.title}`}
            >
              {row.title} ↗
            </button>
            <div className="agenda-meta">
              {row.ownerLabel || (en ? "Unassigned" : "Sin responsable")} ·{" "}
              {en ? "Due date" : "Fecha compromiso"}:{" "}
              {row.dueDate || (en ? "No date" : "Sin fecha")} ·{" "}
              {statuses[row.status] || row.status}
            </div>
            {row.description && (
              <p className="agenda-comment">{row.description}</p>
            )}
            {row.comment && <p className="agenda-comment">{row.comment}</p>}
            {row.children.length > 0 && (
              <details>
                <summary style={{ cursor: "pointer", marginTop: 8 }}>
                  {en ? "Subtasks" : "Subtareas"} ·{" "}
                  {
                    row.children.filter((child) => child.status === "done")
                      .length
                  }
                  /{row.children.length}
                </summary>
                <ul style={{ paddingLeft: 18 }}>
                  {row.children.map((child) => (
                    <li key={child.id} style={{ marginTop: 6 }}>
                      {child.title} · {statuses[child.status] || child.status} ·{" "}
                      {child.due_date || (en ? "No date" : "Sin fecha")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        ))
      )}
    </aside>
  );
}
