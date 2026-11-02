import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const read = (path) =>
  readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
const baseline = (path) =>
  execFileSync(
    "git",
    ["show", `b8bb9537a582a57d8e623f4d191c0a69b4473040:src/${path}`],
    { encoding: "utf8" },
  );
const between = (text, start, end) =>
  text.slice(text.indexOf(start), text.indexOf(end));
test("App exposes one Agenda nav while retaining explicit legacy routes and one shared read owner", async () => {
  const app = await read("App.jsx");
  const nav = between(app, "const TABS=", "const addL=");
  assert.match(nav, /k:"agenda"/);
  assert.doesNotMatch(nav, /k:"specialTasks"|k:"activities"/);
  assert.match(app, /tab==="agenda"\s*&&\s*!viewDeal/);
  assert.match(app, /<AgendaView/);
  assert.match(app, /useAgendaSources\(supabase/);
  assert.match(app, /tab==="specialTasks"/);
  assert.match(app, /tab==="activities"/);
  assert.match(app, /focusTaskId=\{taskRoute\.focusId\}/);
  assert.match(app, /focusActivityId=\{viewDeal\._focusActivityId\}/);
  assert.match(app, /initialTab=\{viewDeal\._openTab\}/);
  assert.match(app, /search: q/);
  assert.match(app, /if \(create\) setQ\(''\)/);
});
test("source writers and dls activity contract remain unchanged; task navigation cannot autofocus/blur-save", async () => {
  const app = await read("App.jsx"),
    old = baseline("App.jsx");
  assert.equal(
    between(app, "const addActivity=", "const addManualJournalEntry="),
    between(old, "const addActivity=", "const addManualJournalEntry="),
  );
  assert.equal(
    between(app, "let activities = [];", "const stages = stages_raw"),
    between(old, "let activities = [];", "const stages = stages_raw"),
  );
  const task = await read("components/special-tasks/SpecialTasksView.jsx");
  assert.match(task, /focusTaskId/);
  assert.match(task, /task\.id === focusTaskId/);
  assert.match(task, /scrollIntoView/);
  assert.doesNotMatch(task, /autoFocus|\.focus\(/);
  for (const file of ["subtaskStore.js", "subtaskModel.js", "SubtaskPanel.jsx"])
    assert.equal(
      await read(`components/special-tasks/${file}`),
      baseline(`components/special-tasks/${file}`),
    );
});
test("activity selection is exact ID and preserves native emailType and an absent due date", async () => {
  const activity = await read("components/activities/ActivitiesPanel.jsx");
  assert.match(activity, /activity\.id === focusActivityId/);
  assert.match(activity, /type: a\.type \|\| "task"/);
  assert.match(activity, /dueDate: a\.dueDate \|\| ""/);
  assert.doesNotMatch(activity, /autoFocus|\.focus\(/);
});
