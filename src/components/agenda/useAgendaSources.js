import { useEffect, useState, useSyncExternalStore } from "react";
import { createAgendaSources } from "./agendaSources.js";

// A single App-level owner also supplies linked tasks in the deal context.
// Disable it before mounting SpecialTasksView, which owns the legacy writers.
export function useAgendaSources(client, enabled) {
  const [store] = useState(() => createAgendaSources(client));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => (enabled ? store.start() : undefined), [store, enabled]);
  return { ...snapshot, retry: store.load };
}
