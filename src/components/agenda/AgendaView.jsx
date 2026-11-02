import {
  dateGroup,
  priorityBand,
  priorityScore,
  selectAgenda,
} from "./agendaModel.js";
import "./agenda.css";
import { AGENDA_STATUS as STATUS } from "./agendaLabels.js";

const TEXT = {
  es: {
    subtitle: "Tareas y actividades, en un solo lugar.",
    pending: "Pendientes",
    priority: "Prioridades",
    history: "Historial",
    overdue: "Vencidas",
    today: "Hoy",
    next: "Próximas",
    none: "Sin fecha",
    search: "Buscar tareas, actividades u oportunidades…",
    owner: "Responsable",
    type: "Tipo",
    link: "Oportunidad",
    date: "Fecha compromiso",
    all: "Todos",
    yes: "Con oportunidad",
    no: "Sin oportunidad",
    unassigned: "Sin responsable",
    task: "Tarea",
    email: "Correo",
    call: "Llamada",
    meeting: "Reunión",
    note: "Nota",
    clear: "Limpiar",
    state: "Estado",
    score: "Prioridad",
    unknown: "Sin prioridad",
    edit: "Abrir editor original",
    special: "Tarea especial",
    activity: "Actividad",
    new: "+ Nuevo",
    children:
      "Las subtareas se muestran dentro de su tarea, sin duplicar contadores.",
  },
  en: {
    subtitle: "Tasks and activities, in one place.",
    pending: "Pending",
    priority: "Priorities",
    history: "History",
    overdue: "Overdue",
    today: "Today",
    next: "Upcoming",
    none: "No date",
    search: "Search tasks, activities or opportunities…",
    owner: "Responsible",
    type: "Type",
    link: "Opportunity",
    date: "Due date",
    all: "All",
    yes: "With opportunity",
    no: "Without opportunity",
    unassigned: "Unassigned",
    task: "Task",
    email: "Email",
    call: "Call",
    meeting: "Meeting",
    note: "Note",
    clear: "Clear",
    state: "Status",
    score: "Priority",
    unknown: "No priority",
    edit: "Open source editor",
    special: "Special task",
    activity: "Activity",
    new: "+ New",
    children: "Subtasks stay inside their parent and are not counted twice.",
  },
};

export default function AgendaView({
  rows = [],
  today,
  lang = "es",
  state,
  onStateChange,
  onEdit,
  onOpenDeal,
  onNewTask,
  onNewActivity,
  onLegacy,
  deals = [],
  source,
  onRetry,
}) {
  const language = lang === "en" ? "en" : "es",
    t = TEXT[language];
  const { view = "pending", filters = {}, expanded = {} } = state;
  const change = (patch) => onStateChange({ ...state, ...patch });
  const filter = (key, value) =>
    change({ filters: { ...filters, [key]: value } });
  const result = selectAgenda(rows, filters, today);
  const owners = [
    ...new Map(
      rows.map((row) => [row.ownerKey, row.ownerLabel || t.unassigned]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const select = (key, label, options) => (
    <label>
      <span>{label}</span>
      <select
        aria-label={label}
        value={filters[key] || ""}
        onChange={(event) => filter(key, event.target.value)}
      >
        <option value="">{t.all}</option>
        {options.map(([value, name]) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
  const renderItem = (row) => (
    <div key={row.key}>
      <article
        className="agenda-item"
        data-agenda-id={row.key}
        data-agenda-key={row.key}
      >
        <div className="agenda-title">
          {row.source === "special_task" && (
            <button
              className="agenda-disclosure"
              aria-label={`${language === "en" ? "Subtasks" : "Subtareas"}: ${row.title}`}
              aria-expanded={!!expanded[row.key]}
              aria-controls={`agenda-children-${row.id}`}
              onClick={() =>
                change({
                  expanded: { ...expanded, [row.key]: !expanded[row.key] },
                })
              }
            >
              {expanded[row.key] ? "▾" : "▸"}
            </button>
          )}
          <div>
            <button
              className="agenda-title-button"
              data-edit-key={row.key}
              onClick={() => onEdit(row)}
              title={t.edit}
            >
              {row.title}
            </button>
            <div className="agenda-meta">
              {row.source === "special_task" ? t.special : t.activity} ·{" "}
              {t[row.type] || row.type}
              {row.children.length > 0 &&
                ` · ${row.children.filter((child) => child.status === "done").length}/${row.children.length}`}
            </div>
            {row.comment && <p className="agenda-comment">{row.comment}</p>}
          </div>
        </div>
        <div data-label={t.owner}>{row.ownerLabel || t.unassigned}</div>
        <div data-label={t.link}>
          {row.dealId ? (
            <button
              className="agenda-link"
              onClick={() => onOpenDeal(row.dealId)}
            >
              {row.dealName || row.dealId} ↗
            </button>
          ) : (
            <span className="agenda-muted">{t.no}</span>
          )}
        </div>
        <div
          data-label={t.date}
          className={dateGroup(row, today) === "overdue" ? "agenda-late" : ""}
        >
          {row.dueDate || t.none}
          {view === "history" && (
            <div className="agenda-meta">
              {language === "en" ? "Created" : "Creación"}:{" "}
              {row.createdAt ? row.createdAt.slice(0, 10) : "—"}
            </div>
          )}
        </div>
        <div data-label={t.state}>
          <span className={`agenda-status ${row.status}`}>
            {STATUS[language][row.status] || row.status}
          </span>
        </div>
        <div data-label={t.score}>
          <span className="agenda-score">
            {priorityScore(row) ?? t.unknown}
          </span>
        </div>
      </article>
      {expanded[row.key] && row.source === "special_task" && (
        <div className="agenda-children" id={`agenda-children-${row.id}`}>
          <div role="list">
            {row.children.map((child) => (
              <div className="agenda-child" role="listitem" key={child.id}>
                <strong>↳ {child.title}</strong>
                <span>{child.ownerLabel || t.unassigned}</span>
                <span>{child.due_date || t.none}</span>
                <span className={`agenda-status ${child.status}`}>
                  {STATUS[language][child.status] || child.status}
                </span>
              </div>
            ))}
          </div>
          <button className="agenda-link" onClick={() => onEdit(row)}>
            {language === "en"
              ? "Edit subtasks / Add subtask"
              : "Editar subtareas / Nueva subtarea"}
          </button>
        </div>
      )}
    </div>
  );
  const visible = view === "history" ? result.history : result.pending;
  const empty = (
    <div className="agenda-empty">
      {language === "en"
        ? "No results. Try different filters."
        : "Sin resultados. Prueba otros filtros."}
    </div>
  );
  const bandTitles =
    language === "en"
      ? {
          "8+": "Do now · 8+",
          "6+": "Schedule · 6+",
          "4+": "Delegate · 4+",
          rest: "Backlog · <4",
          unknown: t.unknown,
        }
      : {
          "8+": "Hacer ahora · 8+",
          "6+": "Programar · 6+",
          "4+": "Delegar · 4+",
          rest: "Pendiente · <4",
          unknown: t.unknown,
        };
  const renderBand = (band) => (
    <section key={band} className="agenda-band" data-band={band}>
      <h2>
        {bandTitles[band]} ·{" "}
        {visible.filter((row) => priorityBand(row) === band).length}
      </h2>
      {visible.filter((row) => priorityBand(row) === band).map(renderItem)}
    </section>
  );
  if (source?.loading || source?.error)
    return (
      <section className="agenda">
        <h1>Agenda</h1>
        <div
          className="agenda-message"
          role={source.error ? "alert" : "status"}
        >
          {source.error
            ? `${language === "en" ? "Could not load Agenda" : "No se pudo cargar Agenda"}: ${source.error}`
            : language === "en"
              ? "Loading tasks and subtasks…"
              : "Cargando tareas y subtareas…"}
          {source.error && (
            <button className="agenda-link" onClick={onRetry}>
              {language === "en" ? "Retry" : "Reintentar"}
            </button>
          )}
        </div>
      </section>
    );
  return (
    <section className="agenda" aria-label="Agenda">
      <div className="agenda-heading">
        <div>
          <h1>Agenda</h1>
          <p>{t.subtitle}</p>
        </div>
        <button
          className="agenda-primary"
          onClick={() => change({ newMode: !state.newMode })}
        >
          {t.new}
        </button>
      </div>
      {state.newMode && (
        <div
          className="agenda-new"
          aria-label={
            language === "en"
              ? "Create in source editor"
              : "Crear en editor original"
          }
        >
          <button
            className="agenda-primary"
            data-action="new-task"
            onClick={onNewTask}
          >
            {language === "en" ? "+ Special task" : "+ Tarea especial"}
          </button>
          <label>
            {t.link}
            <select
              aria-label={
                language === "en" ? "Choose opportunity" : "Elegir oportunidad"
              }
              value={state.newDeal || ""}
              onChange={(event) => change({ newDeal: event.target.value })}
            >
              <option value="">
                {language === "en"
                  ? "Choose an opportunity…"
                  : "Elige una oportunidad…"}
              </option>
              {deals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="agenda-primary"
            data-action="new-activity"
            disabled={!deals.some((deal) => deal.id === state.newDeal)}
            onClick={() => onNewActivity(state.newDeal)}
          >
            {language === "en"
              ? "+ Activity in opportunity"
              : "+ Actividad en oportunidad"}
          </button>
        </div>
      )}
      <div className="agenda-tabs" aria-label="Agenda views">
        {["pending", "priority", "history"].map((key) => (
          <button
            key={key}
            data-view={key}
            aria-pressed={view === key}
            onClick={() => change({ view: key })}
          >
            {t[key]}{" "}
            <span>
              {key === "history"
                ? result.counts.history
                : result.counts.pending}
            </span>
          </button>
        ))}
      </div>
      <div className="agenda-stats">
        {["pending", "overdue", "today", "none"].map((key) => (
          <div key={key}>
            <span>{t[key]}</span>
            <strong>{result.counts[key]}</strong>
          </div>
        ))}
      </div>
      <div className="agenda-filters">
        <label className="agenda-search">
          <span>{t.search}</span>
          <input
            type="search"
            aria-label={t.search}
            placeholder={t.search}
            value={filters.search || ""}
            onChange={(event) => filter("search", event.target.value)}
          />
        </label>
        {select("owner", t.owner, owners)}
        {select(
          "type",
          t.type,
          ["task", "email", "call", "meeting", "note"].map((key) => [
            key,
            t[key],
          ]),
        )}
        {select("linked", t.link, [
          ["yes", t.yes],
          ["no", t.no],
        ])}
        {select(
          "date",
          t.date,
          ["overdue", "today", "next", "none"].map((key) => [key, t[key]]),
        )}
        <button className="agenda-link" onClick={() => change({ filters: {} })}>
          {t.clear}
        </button>
      </div>
      {view === "history" && (
        <p className="agenda-footnote">
          {language === "en"
            ? "Due date / Created — not completion dates."
            : "Fecha compromiso / Creación — no son fechas de finalización."}
        </p>
      )}
      {view === "priority" ? (
        <>
          <div className="agenda-bands">
            {["8+", "6+", "4+", "rest"].map(renderBand)}
          </div>
          <div className="agenda-unknown">{renderBand("unknown")}</div>
          {visible.length === 0 && empty}
        </>
      ) : (
        <div className="agenda-table">
          <div className="agenda-columns">
            {[t.task, t.owner, t.link, t.date, t.state, t.score].map(
              (label) => (
                <span key={label}>{label}</span>
              ),
            )}
          </div>
          {view === "history"
            ? visible.map(renderItem)
            : ["overdue", "today", "next", "none"].map((group) => {
                const items = visible.filter(
                  (row) => dateGroup(row, today) === group,
                );
                return (
                  items.length > 0 && (
                    <section key={group} aria-label={t[group]}>
                      <h2 className={`agenda-group ${group}`}>
                        {t[group]} <span>{items.length}</span>
                      </h2>
                      {items.map(renderItem)}
                    </section>
                  )
                );
              })}
          {visible.length === 0 && empty}
        </div>
      )}
      <p className="agenda-footnote">
        {t.children} ·{" "}
        {language === "en" ? "Reference date" : "Fecha de referencia"}: {today}
      </p>
      <div className="agenda-editors">
        <button
          className="agenda-link"
          data-action="legacy-tasks"
          onClick={() => onLegacy("specialTasks")}
        >
          {language === "en"
            ? "Special tasks · source grid"
            : "Tareas especiales · cuadrícula original"}
        </button>
        <button
          className="agenda-link"
          data-action="legacy-activities"
          onClick={() => onLegacy("activities")}
        >
          {language === "en"
            ? "Activities · original view"
            : "Actividades · vista original"}
        </button>
      </div>
    </section>
  );
}
