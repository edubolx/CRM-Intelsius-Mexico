import { newSubtask, rowToSubtask, subtaskToRow } from './subtaskModel.js';

const editableFields = ['title', 'ownerId', 'status', 'dueDate'];
const serverMetadata = row => ({ serverRevision: row.serverRevision, baseValues: row.baseValues, createdAt: row.createdAt, updatedAt: row.updatedAt });

export function createSubtaskRepository(client) {
  const confirmed = (data, error, child) => {
    if (error) throw error;
    if (!data || data.id !== child.id || data.parent_task_id !== child.parentTaskId) throw new Error('No se pudo confirmar la subtarea guardada.');
    return rowToSubtask(data);
  };
  return {
    async list() {
      const { data, error } = await client.from('special_task_subtasks').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(rowToSubtask);
    },
    async write(child) {
      const row = subtaskToRow(child);
      const read = async () => {
        const { data, error } = await client.from('special_task_subtasks').select('*').eq('parent_task_id', child.parentTaskId).eq('id', child.id).maybeSingle();
        return confirmed(data, error, child);
      };
      let recovered;
      if (child.isNew) {
        const { data, error } = await client.from('special_task_subtasks').insert(row).select('*').single();
        if (error?.code !== '23505') return confirmed(data, error, child);
        // A lost INSERT ACK is reconciled against that INSERT's snapshot,
        // never by an upsert or an unconditional all-fields update.
        recovered = await read();
        child = { ...child, isNew: false, serverRevision: recovered.serverRevision, baseValues: child.baseValues || child.insertBaseValues || rowToSubtask(row).baseValues };
      }
      const fields = { title: 'title', ownerId: 'owner_id', status: 'status', dueDate: 'due_date' };
      const intended = rowToSubtask(row);
      const base = child.baseValues || {};
      const dirty = editableFields.filter(key => intended[key] !== base[key]);
      const patch = Object.fromEntries(dirty.map(key => [fields[key], row[fields[key]]]));
      const overlaps = remote => dirty.some(key => remote[key] !== base[key] && remote[key] !== intended[key]);
      const conflict = remote => {
        const error = new Error('Conflicto: otra persona cambió esta subtarea. Se conserva tu borrador; reintenta explícitamente para aplicar tus cambios.');
        error.remote = remote;
        error.dirtyFields = dirty;
        return error;
      };
      if (recovered && overlaps(recovered)) throw conflict(recovered);
      if (!dirty.length) {
        const remote = recovered || await read();
        // An earlier UPDATE may have committed without an acknowledgement.
        // A local reversion to the old base is still an intention: never
        // replace it with a different remote value and label it "saved".
        const differences = editableFields.filter(key => remote[key] !== intended[key]);
        if (differences.length) {
          const error = conflict(remote);
          error.dirtyFields = differences;
          throw error;
        }
        return remote;
      }
      let serverRevision = child.serverRevision;
      for (let attempt = 0; attempt < 2; attempt++) {
        const { data, error } = await client.from('special_task_subtasks').update(patch).eq('parent_task_id', child.parentTaskId).eq('id', child.id).eq('revision', serverRevision).select('*').maybeSingle();
        if (error) throw error;
        if (data) return confirmed(data, null, child);
        const remote = await read();
        if (attempt || overlaps(remote)) throw conflict(remote);
        serverRevision = remote.serverRevision;
      }
    },
    async remove(child) {
      const { data, error } = await client.from('special_task_subtasks').delete().eq('parent_task_id', child.parentTaskId).eq('id', child.id).select('*');
      if (error) throw error;
      if (!Array.isArray(data) || data.length > 1) throw new Error('No se pudo confirmar la eliminación de la subtarea.');
      if (data.length === 1) { confirmed(data[0], null, child); return; }
      const { data: remaining, error: readError } = await client.from('special_task_subtasks').select('*').eq('parent_task_id', child.parentTaskId).eq('id', child.id).maybeSingle();
      if (readError) throw readError;
      if (remaining) throw new Error('No se pudo confirmar la eliminación de la subtarea.');
    },
  };
}

// One store survives panel toggles. Versions protect drafts and edits from stale
// reads/acknowledgements; each child has at most one in-flight write.
export function createSubtaskStore(repository) {
  let snapshot = { rows: [], loading: true, error: '' };
  let revision = 0;
  let loadId = 0;
  const listeners = new Set();
  const flights = new Map();
  const deleted = new Map();
  const emit = (patch) => { snapshot = { ...snapshot, ...patch }; listeners.forEach(listener => listener()); };
  const find = (parentId, id) => snapshot.rows.find(row => row.id === id && row.parentTaskId === parentId);
  const replace = (parentId, id, patch) => emit({ rows: snapshot.rows.map(row => row.id === id && row.parentTaskId === parentId ? { ...row, ...patch, revision: ++revision } : row) });

  const store = {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async load() {
      const request = ++loadId;
      const started = revision;
      try {
        const remote = await repository.list();
        if (request !== loadId) return;
        const local = new Map(snapshot.rows.map(row => [row.id, row]));
        const rows = remote.filter(row => !deleted.has(row.id) || deleted.get(row.id) <= started).map(row => {
          const current = local.get(row.id);
          local.delete(row.id);
          if (current && (current.isNew || current.sync !== 'saved' || current.revision > started || current.deleting)) return current;
          return { ...row, sync: 'saved', error: '', revision: started };
        });
        for (const row of local.values()) {
          if (row.isNew || row.sync !== 'saved' || row.revision > started || row.deleting) rows.push(row);
        }
        emit({ rows, loading: false, error: '' });
      } catch (error) {
        if (request === loadId) emit({ loading: false, error: error.message || 'No se pudieron cargar las subtareas.' });
      }
    },
    add(parent, id) {
      const row = { ...newSubtask(parent, id), sync: 'dirty', error: '', revision: ++revision, version: 0 };
      emit({ rows: [...snapshot.rows, row] });
    },
    edit(parentId, id, patch) {
      const row = find(parentId, id);
      if (!row || row.deleting) return;
      const allowed = Object.fromEntries(Object.entries(patch).filter(([key]) => ['title', 'ownerId', 'status', 'dueDate'].includes(key)));
      replace(parentId, id, { ...allowed, version: (row.version || 0) + 1, ...(row.conflict ? {} : { sync: flights.has(id) ? 'saving' : 'dirty', error: '', errorOperation: '' }) });
    },
    save(parentId, id, { retry = false } = {}) {
      const existing = flights.get(id);
      if (existing) return existing;
      if (!find(parentId, id) || find(parentId, id).deleting || (find(parentId, id).conflict && !retry)) return Promise.resolve();
      const run = async () => {
        while (find(parentId, id)) {
          const row = find(parentId, id);
          const version = row.version || 0;
          replace(parentId, id, { sync: 'saving', error: '', errorOperation: '', conflict: false });
          try {
            const validated = subtaskToRow(row);
            const attempt = row.isNew ? { insertAttempted: true, insertBaseValues: row.insertBaseValues || rowToSubtask(validated).baseValues } : {};
            if (row.isNew) replace(parentId, id, attempt);
            const saved = await repository.write({ ...row, ...attempt });
            if (!saved || saved.id !== id || saved.parentTaskId !== parentId || saved.isNew) throw new Error('No se pudo confirmar la subtarea guardada.');
            const current = find(parentId, id);
            if (!current) return;
            const changed = (current.version || 0) !== version;
            const acknowledged = Object.fromEntries(editableFields.filter(key => !changed || current[key] === row[key]).map(key => [key, saved[key]]));
            replace(parentId, id, { ...acknowledged, ...serverMetadata(saved), isNew: false, sync: changed ? 'saving' : 'saved', error: '' });
            if (!changed) return;
          } catch (error) {
            const current = find(parentId, id);
            const remote = error.remote;
            const rebased = remote ? { ...serverMetadata(remote), ...Object.fromEntries(editableFields.filter(key => !error.dirtyFields.includes(key) && current?.[key] === row[key]).map(key => [key, remote[key]])) } : {};
            replace(parentId, id, { ...rebased, conflict: !!remote, sync: 'error', error: error.message || 'No se pudo guardar la subtarea.', errorOperation: 'save' });
            return;
          }
        }
      };
      // Start synchronously so the first write captures current edits, but keep
      // cleanup in finally; callers always share the same in-flight promise.
      const promise = run().finally(() => { if (flights.get(id) === promise) flights.delete(id); });
      flights.set(id, promise);
      return promise;
    },
    async remove(parentId, id) {
      const row = find(parentId, id);
      if (!row || row.deleting) return;
      replace(parentId, id, { deleting: true, error: '' });
      await flights.get(id);
      const current = find(parentId, id);
      if (!current) return;
      try {
        if (!current.isNew || current.insertAttempted) await repository.remove(current);
        deleted.set(id, ++revision);
        emit({ rows: snapshot.rows.filter(item => !(item.id === id && item.parentTaskId === parentId)) });
      } catch (error) {
        replace(parentId, id, { deleting: false, sync: 'error', error: error.message || 'No se pudo eliminar la subtarea.', errorOperation: 'delete' });
      }
    },
  };
  return store;
}
