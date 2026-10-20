import React from 'react';
import { childrenFor } from './subtaskModel.js';

const fieldStyle = { boxSizing: 'border-box', width: '100%', border: '1px solid transparent', background: 'transparent', borderRadius: 5, padding: '6px 7px', color: '#475569', fontFamily: 'inherit', fontSize: 12 };
const buttonStyle = { border: 'none', borderRadius: 5, padding: '5px 7px', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 11 };

export function SubtaskControls({ task, expanded, progress, onToggle }) {
  const label = `${expanded ? 'Ocultar' : 'Mostrar'} subtareas de ${task.title || 'nueva tarea'}${progress.total ? `. ${progress.done} de ${progress.total} completadas` : ''}`;
  return <button type="button" onClick={onToggle} disabled={task.isNew} aria-expanded={expanded} aria-controls={`subtasks-${task.id}`} aria-label={label} title={task.isNew ? 'Guarda primero la tarea padre.' : label} style={{ border: 'none', background: 'transparent', color: '#94a3b8', width: 22, padding: '8px 0', flexShrink: 0, cursor: task.isNew ? 'default' : 'pointer', fontSize: 13 }}>{expanded ? '▾' : '▸'}</button>;
}

export function SubtaskComposer({ empty, disabled, onAdd }) {
  const [value, setValue] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const submitted = React.useRef(false);
  const submit = () => {
    const title = value.trim();
    if (disabled || !title || submitted.current) return;
    submitted.current = true;
    onAdd(title);
    setValue('');
    setEditing(false);
  };
  const quietButton = { ...buttonStyle, color: '#94a3b8', fontSize: 12, padding: '6px 4px' };
  if (!empty && !editing) return <button type="button" disabled={disabled} onClick={() => setEditing(true)} style={quietButton}>+ Nueva subtarea</button>;
  return <form aria-label="Crear subtarea" onSubmit={event => { event.preventDefault(); submit(); }} style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: 620 }}>
    <input aria-label="Nueva subtarea" placeholder="Escribe una subtarea…" value={value} disabled={disabled} autoFocus={editing} onChange={event => { submitted.current = false; setValue(event.target.value); }} onBlur={submit} onKeyDown={event => { if (event.key === 'Escape') { submitted.current = true; setValue(''); setEditing(false); } }} style={fieldStyle} />
    <button type="submit" aria-label="Guardar nueva subtarea" disabled={disabled || !value.trim()} title="Añadir subtarea" style={quietButton}>+</button>
  </form>;
}

export function SubtaskPanel({ task, rows, users, statuses, store, expanded = true, onAdd = () => {} }) {
  const children = childrenFor(rows, task.id);
  const edit = (child, patch, save = false) => {
    store.edit(task.id, child.id, patch);
    if (save) store.save(task.id, child.id);
  };
  const remove = child => {
    if (!child.isNew && !window.confirm(`¿Eliminar subtarea "${child.title || 'sin título'}"?`)) return;
    store.remove(task.id, child.id);
  };
  return <tr id={`subtasks-${task.id}`} hidden={!expanded}>
    <td colSpan={12} style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 18px 8px 30px' }}>
      <div style={{ maxWidth: 1050, borderLeft: '1px solid #e2e8f0', paddingLeft: 10 }}>
        {children.length > 0 && <div role="list" aria-label="Subtareas">
          {children.map(child => {
            const syncLabel = child.deleting ? 'Eliminando…' : child.sync === 'saving' ? 'Guardando…' : child.sync === 'saved' ? 'Guardado' : child.sync === 'error' ? 'Error: no confirmado' : 'Borrador sin guardar';
            return <div key={child.id} role="listitem" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 155px 130px 140px auto', gap: 6, alignItems: 'center', padding: '3px 0' }}>
              <input aria-label="Título de subtarea" required value={child.title} placeholder="Título requerido..." disabled={child.deleting} onChange={event => edit(child, { title: event.target.value })} onBlur={() => store.save(task.id, child.id)} style={{ ...fieldStyle, color: '#334155', textDecoration: child.status === 'done' ? 'line-through' : 'none' }} />
              <select aria-label="Responsable de subtarea" title="Responsable" value={child.ownerId} disabled={child.deleting} onChange={event => edit(child, { ownerId: event.target.value }, true)} style={fieldStyle}><option value="">Sin responsable</option>{users.map(user => <option key={user.id} value={user.id}>{user.name || user.alias || user.email}</option>)}</select>
              <select aria-label="Estado de subtarea" title="Estado" value={child.status} disabled={child.deleting} onChange={event => edit(child, { status: event.target.value }, true)} style={fieldStyle}>{statuses.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
              <input aria-label="Fecha límite de subtarea" title="Fecha límite" type="date" value={child.dueDate} disabled={child.deleting} onChange={event => edit(child, { dueDate: event.target.value }, true)} style={fieldStyle} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span role="status" aria-live="polite" aria-label={syncLabel} title={syncLabel} style={{ color: child.sync === 'error' ? '#b91c1c' : '#94a3b8', fontSize: 10 }}>{child.sync === 'saved' ? '✓' : child.sync === 'error' ? '!' : '…'}</span>
                <button type="button" aria-label={child.isNew ? 'Cancelar borrador' : 'Eliminar subtarea'} title={child.isNew ? 'Cancelar borrador' : 'Eliminar subtarea'} disabled={child.deleting} onClick={() => remove(child)} style={{ ...buttonStyle, color: '#94a3b8' }}>×</button>
              </div>
              {child.error && <div role="alert" style={{ gridColumn: '1 / -1', color: '#b91c1c', fontSize: 11 }}>{child.error} {child.sync === 'error' && <button type="button" onClick={() => child.errorOperation === 'delete' ? remove(child) : store.save(task.id, child.id, { retry: true })} style={buttonStyle}>Reintentar</button>}</div>}
            </div>;
          })}
        </div>}
        <SubtaskComposer empty={children.length === 0} disabled={task.isNew} onAdd={onAdd} />
      </div>
    </td>
  </tr>;
}
