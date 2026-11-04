// Source reader and confirmed-write cache. Activities retain the existing dls contract.
export function createAgendaSources(client) {
  let snapshot = { tasks: [], children: [], loading: true, error: "" };
  let request = 0,
    consumers = 0,
    channel,
    pendingAccepts;
  const listeners = new Set();
  const emit = (patch) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  };
  const store = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    accept(row, removed = false) {
      // A confirmed row does not establish collection completeness.
      pendingAccepts?.set(row.id, removed ? null : row);
      const tasks = snapshot.tasks.filter(task => task.id !== row.id);
      emit({
        tasks: removed ? tasks : [...tasks, row],
        children: removed
          ? snapshot.children.filter(child => child.parent_task_id !== row.id)
          : snapshot.children,
      });
    },
    async load() {
      const current = ++request;
      const accepted = new Map();
      pendingAccepts = accepted;
      try {
        if (!client)
          throw new Error(
            "Agenda: connection unavailable / conexión no disponible",
          );
        const [parents, children] = await Promise.all([
          client.from("special_tasks").select("*").order("id"),
          client.from("special_task_subtasks").select("*").order("id"),
        ]);
        if (parents.error) throw parents.error;
        if (children.error) throw children.error;
        if (current === request) {
          // Retain unrelated full-read rows without reverting newer confirmations.
          const tasks = new Map((parents.data || []).map(row => [row.id, row]));
          accepted.forEach((row, id) => row === null ? tasks.delete(id) : tasks.set(id, row));
          emit({
            tasks: [...tasks.values()],
            children: (children.data || []).filter(child => accepted.get(child.parent_task_id) !== null),
            loading: false,
            error: "",
          });
        }
      } catch (error) {
        if (current === request)
          emit({ loading: false, error: error.message || String(error) });
      } finally {
        if (current === request) pendingAccepts = undefined;
      }
    },
    start() {
      if (consumers++ === 0) {
        if (client)
          channel = client
            .channel("crm-realtime-agenda")
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "special_tasks" },
              () => store.load(),
            )
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "special_task_subtasks" },
              () => store.load(),
            )
            .subscribe();
        emit({ loading: true, error: "" });
        store.load();
      }
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        if (--consumers === 0) {
          ++request; // Ignore responses from the source reader being unmounted.
          if (channel) client.removeChannel(channel);
          channel = undefined;
        }
      };
    },
  };
  return store;
}
