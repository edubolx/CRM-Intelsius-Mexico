import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { transformWithEsbuild } from "vite";

// Minimal deterministic hook host: exercises real effects/handlers without DOM or network.
// It is not a substitute for the separate browser QA.
const hostKey = "__agendaLifecycleTest";
const hookModule = `const host = () => globalThis.${hostKey};
export const Fragment = Symbol.for('react.fragment');
export function useState(initial) { const h=host(), i=h.index++; if (!(i in h.values)) h.values[i]=typeof initial==='function'?initial():initial; return [h.values[i], next=>{h.values[i]=typeof next==='function'?next(h.values[i]):next;}]; }
export function useRef(initial) { return useState(()=>({current:initial}))[0]; }
export function useMemo(fn) { host().index++; return fn(); }
export function useSyncExternalStore(subscribe,get) { host().index++; return get(); }
export function useEffect(fn,deps) { const h=host(),i=h.index++,old=h.deps[i]; if (!old || !deps || deps.some((v,j)=>v!==old[j])) {h.pending.push(()=>{h.cleanups[i]?.();h.cleanups[i]=fn();});h.deps[i]=deps;} }
`;
const hookURL = `data:text/javascript;base64,${Buffer.from(hookModule).toString("base64")}`;
let moduleSequence = 0;
async function loadComponent(relative, client) {
  const url = new URL(`../src/${relative}`, import.meta.url);
  let source = await readFile(url, "utf8");
  source = source.replace(/import React from ['"]react['"];?/g, "");
  source = source.replace(/from ['"]react['"]/g, `from '${hookURL}'`);
  source = source.replace(
    /import \{ supabase \} from ['"][^'"]+['"];?/,
    `const supabase = globalThis.${hostKey}.client;`,
  );
  for (const match of [...source.matchAll(/from ['"]([^'"]+\.jsx)['"]/g)]) {
    const child = await loadComponent(
      new URL(match[1], url).pathname.split("/src/")[1],
      client,
    );
    source = source.replace(match[0], `from '${child}'`);
  }
  source = source.replace(
    /from ['"]([^'"]+\.js)['"]/g,
    (_, path) => `from '${new URL(path, url).href}'`,
  );
  const { code } = await transformWithEsbuild(source, relative, {
    loader: "jsx",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
  });
  return `data:text/javascript;base64,${Buffer.from(`import React from '${import.meta.resolve("react")}';\n${code}\n// test module ${++moduleSequence}`).toString("base64")}`;
}
const nodes = (tree) => {
  const all = [];
  function visit(el) {
    if (!React.isValidElement(el)) return;
    all.push(el);
    React.Children.forEach(el.props.children, visit);
  }
  visit(tree);
  return all;
};
function host(client) {
  const h = {
    client,
    index: 0,
    values: [],
    deps: [],
    cleanups: [],
    pending: [],
    render(Component, props) {
      h.index = 0;
      h.pending = [];
      const tree = Component(props);
      for (const effect of h.pending) effect();
      return tree;
    },
    stop() {
      for (const fn of h.cleanups) fn?.();
    },
  };
  globalThis[hostKey] = h;
  return h;
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
function fakeClient() {
  const writes = [],
    reads = [],
    removed = [];
  const tables = {
    special_tasks: [
      { id: "one", title: "Identical", status: "waiting" },
      { id: "two", title: "Identical", status: "notStarted" },
    ],
    special_task_subtasks: [],
  };
  const client = {
    from(table) {
      const query = {
        select() {
          reads.push(table);
          return query;
        },
        order() {
          return query;
        },
        then(resolve) {
          return Promise.resolve({ data: tables[table], error: null }).then(
            resolve,
          );
        },
        upsert() {
          writes.push(table);
          throw Error("Unexpected write");
        },
      };
      return query;
    },
    channel() {
      const c = {
        on() {
          return c;
        },
        subscribe() {
          return c;
        },
      };
      return c;
    },
    removeChannel(c) {
      removed.push(c);
    },
  };
  return { client, reads, writes, removed };
}
test("exact-ID legacy task navigation highlights/scrolls only that record, and opening/closing writes nothing", async () => {
  const fixture = fakeClient(),
    h = host(fixture.client),
    scrolls = [],
    focuses = [];
  const previous = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      return {
        scrollIntoView() {
          scrolls.push(id);
        },
        focus() {
          focuses.push(id);
        },
      };
    },
  };
  try {
    const { default: Tasks } = await import(
      await loadComponent(
        "components/special-tasks/SpecialTasksView.jsx",
        fixture.client,
      )
    );
    const props = {
      users: [],
      deals: [],
      search: "does not match",
      lang: "en",
      focusTaskId: "two",
    };
    h.render(Tasks, props);
    await tick();
    const tree = h.render(Tasks, props);
    assert.deepEqual(
      nodes(tree)
        .filter((n) => n.props["data-special-task-id"])
        .map((n) => n.props["data-special-task-id"]),
      ["two"],
    );
    assert.ok(nodes(tree).some(node => node.type === "button" && node.props.children === "Show all"));
    assert.deepEqual(scrolls, ["special-task-two"]);
    assert.deepEqual(focuses, []);
    h.stop();
    assert.deepEqual(fixture.writes, []);
    assert.equal(fixture.removed.length, 2);
  } finally {
    globalThis.document = previous;
    delete globalThis[hostKey];
  }
});

test("new-task route creates only an unsaved blank local row until the existing editor is used", async () => {
  const fixture = fakeClient(),
    h = host(fixture.client);
  try {
    const { default: Tasks } = await import(
      await loadComponent(
        "components/special-tasks/SpecialTasksView.jsx",
        fixture.client,
      )
    );
    const props = { users: [], deals: [], createOnOpen: true };
    h.render(Tasks, props);
    // React StrictMode replays mount effects before either bulk read settles.
    h.stop();
    h.cleanups = [];
    h.deps = [];
    h.render(Tasks, props);
    await tick();
    const tree = h.render(Tasks, props);
    assert.equal(
      nodes(tree).filter((n) => n.props["data-special-task-id"]).length,
      3,
    );
    assert.deepEqual(fixture.writes, []);
    h.stop();
  } finally {
    delete globalThis[hostKey];
  }
});

test("exact-ID activity route fills the existing form once, preserves native type/null due date, and retains a draft across refresh", async () => {
  const h = host(null),
    writes = [];
  try {
    const { default: Activities } = await import(
      await loadComponent("components/activities/ActivitiesPanel.jsx")
    );
    const helpers = {
      today: () => "2026-11-02",
      uid: () => "new",
      ACTIVITY_TYPES: ["emailType", "task"],
      ACTIVITY_STATUSES: ["pending", "done"],
      Sel: () => null,
      Inp: () => null,
      Txta: () => null,
      Btn: () => null,
      Ic: () => null,
      iSx: {},
    };
    const props = {
      deal: {
        activities: [
          { id: "a", title: "Identical", type: "task" },
          {
            id: "b",
            title: "Identical",
            type: "emailType",
            dueDate: null,
            status: "done",
          },
        ],
      },
      focusActivityId: "b",
      t: {
        activityTitle: "Title",
        activityDueDate: "Due",
        activityType: "Type",
      },
      users: [],
      helpers,
      onUpdateActivity: () => writes.push("update"),
      onAddActivity: () => writes.push("add"),
    };
    h.render(Activities, props);
    let tree = h.render(Activities, props),
      all = nodes(tree);
    assert.equal(
      all.find((n) => n.props.label === "Type").props.value,
      "emailType",
    );
    assert.equal(all.find((n) => n.props.label === "Due").props.value, "");
    all
      .find((n) => n.props.label === "Title *")
      .props.onChange({ target: { value: "Retained draft" } });
    tree = h.render(Activities, {
      ...props,
      deal: { activities: [...props.deal.activities] },
    });
    assert.equal(
      nodes(tree).find((n) => n.props.label === "Title *").props.value,
      "Retained draft",
    );
    assert.deepEqual(writes, []);
    h.stop();
    const nativeHost = host(null);
    const nativeProps = {
      ...props,
      deal: { activities: [{ ...props.deal.activities[1], type: "email" }] },
    };
    nativeHost.render(Activities, nativeProps);
    const nativeTree = nativeHost.render(Activities, nativeProps);
    const typeField = nodes(nativeTree).find((n) => n.props.label === "Type");
    assert.equal(typeField.props.value, "email");
    assert.ok(
      typeField.props.opts.some((option) => option.v === "email"),
      "native email must remain a visible option",
    );
    nativeHost.stop();
  } finally {
    delete globalThis[hostKey];
  }
});
