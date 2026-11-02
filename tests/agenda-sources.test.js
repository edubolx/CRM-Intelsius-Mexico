import test from "node:test";
import assert from "node:assert/strict";
async function storeModule() {
  try {
    return await import("../src/components/agenda/agendaSources.js");
  } catch (error) {
    if (error.code === "ERR_MODULE_NOT_FOUND")
      assert.fail("Agenda bulk read store must exist");
    throw error;
  }
}
function clientFixture() {
  const reads = [],
    handlers = [],
    removed = [];
  const channel = {
    on(event, filter, cb) {
      handlers.push({ filter, cb });
      return channel;
    },
    subscribe() {
      return channel;
    },
  };
  const client = {
    from(table) {
      reads.push(table);
      return {
        select(columns) {
          assert.equal(columns, "*");
          return {
            order: async () => ({ data: [{ id: table }], error: null }),
          };
        },
      };
    },
    channel() {
      return channel;
    },
    removeChannel(c) {
      removed.push(c);
    },
  };
  return { client, reads, handlers, removed };
}
test("one bulk source owner reads parents/children only, refreshes read-only and releases realtime", async () => {
  const { createAgendaSources } = await storeModule();
  const fixture = clientFixture(),
    store = createAgendaSources(fixture.client);
  const stop = store.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fixture.reads, ["special_tasks", "special_task_subtasks"]);
  await store.load();
  assert.deepEqual(
    new Set(fixture.reads),
    new Set(["special_tasks", "special_task_subtasks"]),
  );
  assert.equal(fixture.handlers.length, 2);
  assert.equal(store.getSnapshot().tasks[0].id, "special_tasks");
  assert.equal(store.getSnapshot().children[0].id, "special_task_subtasks");
  assert.equal(store.getSnapshot().loading, false);
  const second = store.start();
  assert.equal(fixture.handlers.length, 2);
  second();
  stop();
  assert.equal(fixture.removed.length, 1);
});

test("failed bulk read exposes an error and a successful retry clears it", async () => {
  const { createAgendaSources } = await storeModule();
  let fail = true;
  const client = {
    from(table) {
      return {
        select() {
          return {
            order: async () =>
              table === "special_task_subtasks" && fail
                ? { error: { message: "Child read failed" } }
                : { data: [{ id: table }] },
          };
        },
      };
    },
  };
  const store = createAgendaSources(client);
  await store.load();
  assert.equal(store.getSnapshot().loading, false);
  assert.equal(store.getSnapshot().error, "Child read failed");
  assert.deepEqual(store.getSnapshot().tasks, []);
  fail = false;
  await store.load();
  assert.equal(store.getSnapshot().error, "");
  assert.equal(store.getSnapshot().tasks.length, 1);
  const missing = createAgendaSources(null);
  await missing.load();
  assert.match(missing.getSnapshot().error, /connection unavailable/);
});

test("slower old reads cannot replace a newer snapshot or resurrect a stopped reader", async () => {
  const { createAgendaSources } = await storeModule();
  const pending = [];
  const fixture = clientFixture();
  fixture.client.from = (table) => ({
    select: () => ({
      order: () => new Promise((resolve) => pending.push({ table, resolve })),
    }),
  });
  const store = createAgendaSources(fixture.client);
  const older = store.load(),
    newer = store.load();
  pending[2].resolve({ data: [{ id: "new" }] });
  pending[3].resolve({ data: [] });
  await newer;
  pending[0].resolve({ data: [{ id: "old" }] });
  pending[1].resolve({ data: [] });
  await older;
  assert.equal(store.getSnapshot().tasks[0].id, "new");
  const stop = store.start();
  stop();
  pending[4].resolve({ data: [{ id: "stopped" }] });
  pending[5].resolve({ data: [] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(store.getSnapshot().tasks[0].id, "new");
});
