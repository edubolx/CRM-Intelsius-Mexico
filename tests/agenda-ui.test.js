import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithEsbuild } from "vite";
import { buildAgenda } from "../src/components/agenda/agendaModel.js";
async function component(file = "AgendaView.jsx") {
  let source;
  try {
    source = await readFile(
      new URL(`../src/components/agenda/${file}`, import.meta.url),
      "utf8",
    );
  } catch {
    assert.fail("Agenda view must exist");
  }
  source = source
    .replace(/import ['"].*\.css['"];?/g, "")
    .replace(
      /from ['"]([^'"]+\.js)['"]/g,
      (_, path) =>
        `from '${new URL(path, new URL("../src/components/agenda/AgendaView.jsx", import.meta.url)).href}'`,
    );
  const { code } = await transformWithEsbuild(source, "AgendaView.jsx", {
    loader: "jsx",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(`import React from '${import.meta.resolve("react")}';\n${code}`).toString("base64")}`
  );
}
const rows = buildAgenda({
  tasks: [
    {
      id: "p",
      title: "Parent",
      status: "waiting",
      due_date: "2026-10-01",
      importance_score: 4,
      urgency_score: 5,
    },
  ],
  children: [
    { id: "c", parent_task_id: "p", title: "Nested child", status: "waiting" },
  ],
  deals: [
    {
      id: "d",
      name: "Linked deal",
      activities: [
        {
          id: "a",
          title: "A mail",
          type: "emailType",
          status: "done",
          createdAt: "2026-10-20T12:30:00Z",
        },
      ],
    },
  ],
});
const props = {
  rows,
  today: "2026-11-02",
  lang: "es",
  state: { view: "pending", filters: {}, expanded: {} },
  onStateChange() {},
  onEdit() {},
  onOpenDeal() {},
  onNewTask() {},
  onNewActivity() {},
  onLegacy() {},
  deals: [{ id: "d", name: "Linked deal" }],
  source: { loading: false, error: "" },
};
function nodes(tree) {
  const out = [];
  function visit(el) {
    if (!React.isValidElement(el)) return;
    out.push(el);
    React.Children.forEach(el.props.children, visit);
  }
  visit(tree);
  return out;
}
test("three views share filters, history uses existing-date meanings and priorities expose four bands plus unknown", async () => {
  const { default: Agenda } = await component();
  const history = renderToStaticMarkup(
    React.createElement(Agenda, {
      ...props,
      state: { ...props.state, view: "history" },
      lang: "en",
    }),
  );
  assert.match(history, /A mail/);
  assert.doesNotMatch(history, />Parent<|Completion date/);
  assert.match(history, /Created/);
  assert.match(history, /2026-10-20/);
  const priority = renderToStaticMarkup(
    React.createElement(Agenda, {
      ...props,
      state: { ...props.state, view: "priority" },
    }),
  );
  for (const band of ["8+", "6+", "4+", "rest", "unknown"])
    assert.ok(priority.includes(`data-band="${band}"`), band);
  assert.match(priority, /Parent/);
  assert.doesNotMatch(priority, /A mail/);
  const filtered = renderToStaticMarkup(
    React.createElement(Agenda, {
      ...props,
      state: { ...props.state, view: "history", filters: { type: "call" } },
    }),
  );
  assert.doesNotMatch(filtered, /A mail/);
  assert.match(filtered, /Sin resultados/);
});

test("nested disclosure and creation route only to existing source writers; load/error hide incomplete totals", async () => {
  const { default: Agenda } = await component();
  const expanded = renderToStaticMarkup(
    React.createElement(Agenda, {
      ...props,
      state: { ...props.state, expanded: { "special_task:p": true } },
    }),
  );
  assert.match(expanded, /Nested child/);
  assert.match(expanded, /aria-expanded="true"/);
  assert.match(expanded, /Editar subtareas/);
  let created, activityDeal, legacy;
  const tree = Agenda({
    ...props,
    state: { ...props.state, newMode: true, newDeal: "d" },
    onNewTask: () => {
      created = true;
    },
    onNewActivity: (id) => {
      activityDeal = id;
    },
    onLegacy: (value) => {
      legacy = value;
    },
  });
  const all = nodes(tree);
  all.find((n) => n.props["data-action"] === "new-task").props.onClick();
  assert.equal(created, true);
  all.find((n) => n.props["data-action"] === "new-activity").props.onClick();
  assert.equal(activityDeal, "d");
  all
    .find((n) => n.props["data-action"] === "legacy-activities")
    .props.onClick();
  assert.equal(legacy, "activities");
  for (const source of [
    { loading: true },
    { loading: false, error: "offline" },
  ]) {
    const html = renderToStaticMarkup(
      React.createElement(Agenda, { ...props, source }),
    );
    assert.doesNotMatch(html, /data-agenda-id|agenda-stats|agenda-tabs/);
    assert.match(html, source.loading ? /role="status"/ : /role="alert"/);
  }
});

test("linked special tasks in deal context are a read-only second view of the same source IDs", async () => {
  const { default: Linked } = await component("LinkedSpecialTasks.jsx");
  const linkedRows = buildAgenda({
    tasks: [
      {
        id: "p",
        deal_id: "d",
        title: "Linked original",
        status: "waiting",
        comments: "Original comment",
      },
      { id: "other", deal_id: "else", title: "Not here" },
    ],
    children: [{ id: "c", parent_task_id: "p", title: "Linked child" }],
  });
  let opened;
  const tree = Linked({
    rows: linkedRows,
    dealId: "d",
    lang: "en",
    source: { loading: false },
    onEdit: (id) => {
      opened = id;
    },
  });
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Waiting/);
  assert.match(html, /data-agenda-key="special_task:p"/);
  assert.match(html, /Linked child|Original comment/);
  assert.doesNotMatch(html, /Not here|<input|<select|<textarea/);
  nodes(tree)
    .find((n) => n.type === "button")
    .props.onClick();
  assert.equal(opened, "p");
});

test("Agenda pending view renders real counters, shared labeled filters, native state and source-ID actions", async () => {
  const { default: Agenda } = await component();
  let edited, next;
  const tree = Agenda({
    ...props,
    onEdit: (row) => {
      edited = row;
    },
    onStateChange: (state) => {
      next = state;
    },
  });
  const html = renderToStaticMarkup(tree);
  for (const label of [
    "Agenda",
    "Pendientes",
    "Prioridades",
    "Historial",
    "Vencidas",
    "Sin fecha",
    "Responsable",
    "Tipo",
    "Oportunidad",
    "Fecha compromiso",
  ])
    assert.ok(html.includes(label), label);
  assert.match(html, /data-agenda-id="special_task:p"/);
  assert.doesNotMatch(html, /A mail|Nested child|Completadas esta semana/);
  nodes(tree)
    .find(
      (n) =>
        n.type === "button" && n.props["data-edit-key"] === "special_task:p",
    )
    .props.onClick();
  assert.equal(edited.id, "p");
  assert.equal(edited.source, "special_task");
  nodes(tree)
    .find((n) => n.props["data-view"] === "history")
    .props.onClick();
  assert.equal(next.view, "history");
  assert.deepEqual(next.filters, {});
});
