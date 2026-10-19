export const SUBTASK_STATUSES = ['notStarted', 'inProgress', 'waiting', 'blocked', 'done', 'cancelled'];

export const childrenFor = (rows, parentId) => rows.filter(child => child.parentTaskId === parentId);

export function childProgress(rows, parentId) {
  const children = childrenFor(rows, parentId).filter(child => !child.isNew);
  return { done: children.filter(child => child.status === 'done').length, total: children.length };
}

export function newSubtask(parent, id) {
  if (parent.isNew || !parent.id) throw new Error('Guarda primero la tarea padre.');
  return { id, parentTaskId: parent.id, title: '', ownerId: parent.ownerId || '', status: 'notStarted', dueDate: '', isNew: true };
}

export function rowToSubtask(row) {
  const baseValues = { title: row.title || '', ownerId: row.owner_id || '', status: row.status || 'notStarted', dueDate: row.due_date || '' };
  return { id: row.id, parentTaskId: row.parent_task_id, ...baseValues, baseValues, serverRevision: row.revision ?? 0, createdAt: row.created_at, updatedAt: row.updated_at, isNew: false };
}

export function subtaskToRow(child) {
  const title = String(child.title || '').trim();
  if (!title) throw new Error('El título de la subtarea es obligatorio.');
  if (!child.id || !child.parentTaskId) throw new Error('La subtarea necesita una tarea padre guardada.');
  if (!SUBTASK_STATUSES.includes(child.status)) throw new Error('Estado de subtarea inválido.');
  return { id: child.id, parent_task_id: child.parentTaskId, title, owner_id: child.ownerId || null, status: child.status, due_date: child.dueDate || null };
}
