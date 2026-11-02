import test from "node:test";
import assert from "node:assert/strict";
async function model() {
  try {
    return await import("../src/components/agenda/agendaModel.js");
  } catch (error) {
    if (error.code === "ERR_MODULE_NOT_FOUND")
      assert.fail("Agenda read model must exist");
    throw error;
  }
}
const today = "2026-11-02";
test("only unique verified Edu/Mafe aliases join display identities; aliases and source values stay separate", async () => {
  const { buildAgenda } = await model();
  const users = [
    { id: "u", alias: "Edu", name: "Eduardo" },
    { id: "m", alias: "Mafe" },
    { id: "other", alias: "Other" },
  ];
  const deals = [
    {
      id: "d",
      activities: ["Edu", "Mafe", "Edu-USA", "Other", ""].map(
        (responsible, id) => ({ id, responsible }),
      ),
    },
  ];
  const rows = buildAgenda({
    tasks: [{ id: "p", owner_id: "u" }],
    users,
    deals,
  });
  assert.deepEqual(
    rows.map((r) => r.ownerKey),
    [
      "user:u",
      "user:u",
      "user:m",
      "alias:Edu-USA",
      "alias:Other",
      "unassigned",
    ],
  );
  const ambiguous = buildAgenda({
    users: [...users, { id: "u2", alias: "Edu" }],
    deals,
  });
  assert.equal(ambiguous[0].ownerKey, "alias:Edu");
  assert.equal(deals[0].activities[0].responsible, "Edu");
});
const tasks = [
  {
    id: "same",
    title: "Duplicate title",
    status: "waiting",
    owner_id: "u",
    due_date: null,
    importance_score: 4,
    urgency_score: 4,
  },
  {
    id: "closed",
    title: "Cancelled",
    status: "cancelled",
    due_date: "2026-10-01",
  },
];
const deals = [
  {
    id: "d",
    name: "Opportunity",
    activities: [
      {
        id: "same",
        title: "Duplicate title",
        type: "emailType",
        status: "done",
        dueDate: "2026-10-01",
      },
      {
        id: "open",
        title: "Call",
        type: "call",
        status: "blocked",
        dueDate: today,
      },
    ],
  },
];
test("shared filters search child titles without extra rows and combine across sources and history", async () => {
  const { buildAgenda, selectAgenda } = await model();
  const rows = buildAgenda({
    tasks,
    deals,
    children: [{ id: "c", parent_task_id: "same", title: "Needle" }],
  });
  assert.equal(
    selectAgenda(rows, { search: "needle" }, today).pending[0].key,
    "special_task:same",
  );
  assert.equal(
    selectAgenda(
      rows,
      {
        search: "opportunity",
        type: "email",
        linked: "yes",
        date: "overdue",
        owner: "unassigned",
      },
      today,
    ).history.length,
    1,
  );
  assert.equal(
    selectAgenda(rows, { linked: "no", date: "none", owner: "user:u" }, today)
      .pending.length,
    1,
  );
  assert.equal(selectAgenda(rows, { type: "note" }, today).counts.pending, 0);
  assert.equal(
    selectAgenda(rows, { date: "today" }, today).pending[0].key,
    "deal_activity:open",
  );
});

test("bands use sum thresholds and explicitly retain missing/invalid priority outside the four bands", async () => {
  const { priorityBand, priorityScore } = await model();
  for (const [a, b, band] of [
    [4, 4, "8+"],
    [3, 3, "6+"],
    [2, 2, "4+"],
    [1, 1, "rest"],
    [null, 5, "unknown"],
    ["", 4, "unknown"],
    ["oops", 4, "unknown"],
  ]) {
    assert.equal(priorityBand({ importance: a, urgency: b }), band);
  }
  assert.equal(priorityScore({ importance: null, urgency: 5 }), null);
});

test("repeated source snapshots deduplicate by source ID, while child display resolves owners without mutating source", async () => {
  const { buildAgenda } = await model();
  const child = {
    id: "c",
    parent_task_id: "same",
    owner_id: "only-child",
    title: "Child",
  };
  const rows = buildAgenda({
    tasks: [...tasks, tasks[0]],
    deals: [...deals, deals[0]],
    children: [child],
    users: [{ id: "only-child", alias: "Mafe" }],
  });
  assert.equal(rows.length, 4);
  assert.equal(
    rows.find((row) => row.key === "special_task:same").children[0].ownerLabel,
    "Mafe",
  );
  assert.equal("ownerLabel" in child, false);
});

test("read union namespaces IDs, preserves sources and nests children without counting them", async () => {
  const { buildAgenda, selectAgenda } = await model();
  const children = [
    { id: "c", parent_task_id: "same", title: "Child", status: "notStarted" },
  ];
  const before = JSON.stringify({ tasks, deals, children });
  const rows = buildAgenda({ tasks, deals, children });
  assert.equal(rows.length, 4);
  assert.equal(new Set(rows.map((r) => r.key)).size, 4);
  assert.equal(
    rows.find((r) => r.key === "special_task:same").children[0].id,
    "c",
  );
  assert.equal(
    rows.find((r) => r.key === "deal_activity:same").nativeType,
    "emailType",
  );
  assert.equal(rows.find((r) => r.key === "deal_activity:same").type, "email");
  assert.equal(rows.find((r) => r.key === "special_task:same").dealId, "");
  const result = selectAgenda(rows, {}, today);
  assert.equal(result.pending.length, 2);
  assert.equal(result.history.length, 2);
  assert.deepEqual(result.counts, {
    pending: 2,
    history: 2,
    overdue: 0,
    today: 1,
    next: 0,
    none: 1,
  });
  assert.equal(JSON.stringify({ tasks, deals, children }), before);
  assert.equal("completedAt" in rows[0], false);
});
