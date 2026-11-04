export const TASK_STATES = ['notStarted', 'inProgress', 'waiting', 'blocked', 'done', 'cancelled'];
export const ACTIVITY_STATES = ['pending', 'inProgress', 'done', 'blocked'];
export const ACTIVITY_TYPES = ['task', 'emailType', 'email', 'call', 'meeting', 'note'];
const COMMON = ['title', 'deal_id', 'status', 'due_date', 'importance_score', 'urgency_score'];
export const fieldsFor = source => {
  if (source === 'special_task') return [...COMMON, 'description', 'owner_id', 'comments'];
  if (source === 'deal_activity') return [...COMMON, 'type', 'responsible', 'comment'];
  throw new Error('Origen de Agenda inválido.');
};
const tableFor = source => { fieldsFor(source); return source === 'special_task' ? 'special_tasks' : 'deal_activities'; };
export function newAgendaDraft(source, id, dealId = '') {
  return { id, title: '', deal_id: dealId || null, status: source === 'special_task' ? 'notStarted' : 'pending', due_date: null, importance_score: 3, urgency_score: 3,
    ...(source === 'special_task' ? { description: null, owner_id: null, comments: null } : { type: 'task', responsible: '', comment: '' }) };
}
function values(source, draft, base) {
  const row = Object.fromEntries(fieldsFor(source).map(key => [key, draft[key] ?? null]));
  if (!base || draft.title !== base.title) row.title = String(row.title || '').trim();
  if (!String(row.title || '').trim()) throw new Error('El título es obligatorio.');
  if (source === 'deal_activity' && !row.deal_id) throw new Error('Elige una oportunidad para la actividad.');
  if ((!base || row.status !== base.status) && !(source === 'special_task' ? TASK_STATES : ACTIVITY_STATES).includes(row.status)) throw new Error('Estado inválido para este origen.');
  if (source === 'deal_activity' && (!base || row.type !== base.type) && !ACTIVITY_TYPES.includes(row.type)) throw new Error('Tipo de actividad inválido.');
  for (const key of ['importance_score','urgency_score']) {
    if (base && row[key] === base[key]) continue;
    if (row[key] == null || row[key] === '') {
      if (source === 'special_task') throw new Error('La prioridad debe estar entre 1 y 5.');
      continue; // Preserve activity fields which natively allow missing scores.
    }
    row[key] = Number(row[key]);
    if (!Number.isInteger(row[key]) || row[key] < 1 || row[key] > 5) throw new Error('La prioridad debe estar entre 1 y 5.');
  }
  return row;
}
export function createAgendaRepository(client) {
  // An unconfirmed UPDATE may already have committed. Keep its field intentions
  // across failed readbacks, keyed by native source/ID, not by the latest dirty set.
  const unresolvedUpdates = new Map();
  const read = async (source, id) => {
    if (!client) throw new Error('Conexión no disponible.');
    const {data,error} = await client.from(tableFor(source)).select('*').eq('id',id).maybeSingle();
    if (error) throw error;
    if (data && data.id !== id) throw new Error('Identidad de registro no confirmada.');
    return data;
  };
  const conflict = (remote, dirty) => Object.assign(new Error('Conflicto: el registro cambió. Tu borrador se conserva; revisa y reintenta explícitamente.'), {remote,dirty});
  return {
    read,
    async remove({source,id,base}) {
      if (!base || base.id !== id) throw new Error('Selecciona el registro exacto antes de eliminar.');
      const remote = await read(source,id);
      if (!remote) return;
      const dirty = fieldsFor(source).filter(key => (remote[key] ?? null) !== (base[key] ?? null));
      if (dirty.length) throw conflict(remote,dirty);
      let query = client.from(tableFor(source)).delete().eq('id',id);
      for (const key of fieldsFor(source)) query = base[key] == null ? query.is(key,null) : query.eq(key,base[key]);
      let failure;
      try { const {error} = await query.select('*'); if (error) failure = error; }
      catch (error) { failure = error; }
      const remaining = await read(source,id);
      if (!remaining) return;
      if (failure) throw failure;
      throw conflict(remaining,fieldsFor(source));
    },
    async save({ source, id, draft, base }) {
      if (!id || draft?.id !== id || (base && base.id !== id)) throw new Error('La identidad exacta del registro no coincide.');
      const row = values(source, draft, base);
      if (!client) throw new Error('Conexión no disponible.');
      const table = tableFor(source);
      const checked = data => {
        if (!data || data.id !== id) throw new Error('Guardado no confirmado.');
        return data;
      };
      if (!base) {
        const existing = await read(source,id);
        const matches = remote => remote && fieldsFor(source).every(key => (remote[key] ?? null) === (row[key] ?? null));
        if (existing) {
          if (matches(existing)) return existing;
          throw conflict(existing, fieldsFor(source));
        }
        try {
          const { data, error } = await client.from(table).insert({id, ...row}).select('*').single();
          if (error) throw error;
          if (matches(data)) return checked(data);
          throw new Error('Guardado no confirmado.');
        } catch (error) {
          const remote = await read(source,id);
          if (matches(remote)) return remote;
          throw error;
        }
      }
      const dirty = fieldsFor(source).filter(key => (row[key] ?? null) !== (base[key] ?? null));
      const identity = `${source}:${id}`;
      const unresolved = unresolvedUpdates.get(identity);
      if (unresolved) {
        // Do not issue a new write or acknowledge only its newest dirty fields.
        // A reverted field is still intentional when the old attempt is unresolved.
        const intended = [...new Set([...unresolved.dirty, ...dirty])];
        const remote = checked(await read(source,id)); // failure retains metadata
        unresolvedUpdates.delete(identity);
        if (intended.every(key => (remote[key] ?? null) === (row[key] ?? null))) return remote;
        throw conflict(remote,intended);
      }
      if (!dirty.length) {
        const remote = checked(await read(source,id));
        const differences = fieldsFor(source).filter(key => (remote[key] ?? null) !== (row[key] ?? null));
        if (differences.length) throw conflict(remote,differences);
        return remote;
      }
      let query = client.from(table).update(Object.fromEntries(dirty.map(key => [key,row[key]]))).eq('id',id);
      for (const key of dirty) query = base[key] == null ? query.is(key,null) : query.eq(key,base[key]);
      unresolvedUpdates.set(identity,{dirty, row});
      try {
        const {data,error} = await query.select('*').maybeSingle();
        if (error) throw error;
        if (data && dirty.every(key => (data[key] ?? null) === (row[key] ?? null))) {
          const saved = checked(data);
          unresolvedUpdates.delete(identity);
          return saved;
        }
      } catch (error) {
        const remote = await read(source,id);
        if (remote && dirty.every(key => (remote[key] ?? null) === (row[key] ?? null))) {
          unresolvedUpdates.delete(identity);
          return remote;
        }
        // A successful read of the original attempted fields resolves a definite
        // non-application too; preserve the error/draft but allow an ordinary retry.
        if (remote && dirty.every(key => (remote[key] ?? null) === (base[key] ?? null))) unresolvedUpdates.delete(identity);
        throw error;
      }
      const remote = checked(await read(source,id));
      unresolvedUpdates.delete(identity);
      if (dirty.every(key => (remote[key] ?? null) === (row[key] ?? null))) return remote;
      throw conflict(remote,dirty);
    },
  };
}
