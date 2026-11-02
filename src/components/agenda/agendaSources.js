// This store has no write methods. Activities come from the existing dls contract.
export function createAgendaSources(client) {
  let snapshot = { tasks: [], children: [], loading: true, error: "" };
  let request = 0,
    consumers = 0,
    channel;
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
    async load() {
      const current = ++request;
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
        if (current === request)
          emit({
            tasks: parents.data || [],
            children: children.data || [],
            loading: false,
            error: "",
          });
      } catch (error) {
        if (current === request)
          emit({ loading: false, error: error.message || String(error) });
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
