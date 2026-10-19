import React from 'react';
import { childrenFor } from './subtaskModel.js';

const fieldStyle = { boxSizing: 'border-box', width: '100%', border: '1px solid #cfd8e3', background: '#fff', borderRadius: 7, padding: '7px 9px', color: '#0f172a', fontFamily: 'inherit', fontSize: 12 };
const buttonStyle = { border: '1px solid #cbd5e1', borderRadius: 7, padding: '5px 9px', background: '#fff', color: '#003e7e', cursor: 'pointer', fontSize: 11 };

export function SubtaskControls({ task, expanded, progress, onToggle, onAdd }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 9px 8px', flexWrap: 'wrap' }}>
    <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={`subtasks-${task.id}`} aria-label={`${expanded ? 'Ocultar' : 'Mostrar'} subtareas de ${task.title || 'nueva tarea'}`} style={buttonStyle}>{expanded ? '▾' : '▸'} Subtareas</button>
    <span style={{ color: '#64748b', fontSize: 11 }}>{progress.done} de {progress.total} completadas</span>
    <button type="button" onClick={onAdd} disabled={task.isNew} title={task.isNew ? 'Guarda primero la tarea padre.' : 'Añadir subtarea'} style={{ ...buttonStyle, opacity: task.isNew ? .5 : 1, cursor: task.isNew ? 'not-allowed' : 'pointer' }}>+ Subtarea</button>
    {task.isNew && <span style={{ color: '#64748b', fontSize: 11 }}>Guarda primero la tarea padre.</span>}
  </div>;
}

export function SubtaskPanel({ task, rows, users, statuses, store, expanded = true }) {
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
    <td colSpan={12} style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 18px 16px 38px' }}>
      <div style={{ maxWidth: 1280, borderLeft: '3px solid #cbd5e1', paddingLeft: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 9 }}>Subtareas — no modifican el estado ni el cuadrante de la tarea padre</div>
        {children.length === 0 ? <div style={{ color: '#64748b', fontSize: 12 }}>Sin subtareas. Usa “+ Subtarea”.</div> : <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead><tr>{['Título', 'Responsable', 'Estado', 'Fecha límite', 'Guardado / acciones'].map((label, index) => <th key={label} style={{ width: index === 0 ? '32%' : '17%', textAlign: 'left', fontSize: 11, color: '#64748b', padding: '4px 5px' }}>{label}</th>)}</tr></thead>
          <tbody>{children.map(child => <tr key={child.id}>
            <td style={{ padding: 5, verticalAlign: 'top' }}><input aria-label="Título de subtarea" required value={child.title} placeholder="Título requerido..." disabled={child.deleting} onChange={event => edit(child, { title: event.target.value })} onBlur={() => store.save(task.id, child.id)} style={fieldStyle} /></td>
            <td style={{ padding: 5, verticalAlign: 'top' }}><select aria-label="Responsable de subtarea" value={child.ownerId} disabled={child.deleting} onChange={event => edit(child, { ownerId: event.target.value }, true)} style={fieldStyle}><option value="">Sin responsable</option>{users.map(user => <option key={user.id} value={user.id}>{user.name || user.alias || user.email}</option>)}</select></td>
            <td style={{ padding: 5, verticalAlign: 'top' }}><select aria-label="Estado de subtarea" value={child.status} disabled={child.deleting} onChange={event => edit(child, { status: event.target.value }, true)} style={fieldStyle}>{statuses.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></td>
            <td style={{ padding: 5, verticalAlign: 'top' }}><input aria-label="Fecha límite de subtarea" type="date" value={child.dueDate} disabled={child.deleting} onChange={event => edit(child, { dueDate: event.target.value }, true)} style={fieldStyle} /></td>
            <td style={{ padding: 5, verticalAlign: 'top', fontSize: 11 }}>
              <div role="status" aria-live="polite" style={{ color: child.sync === 'error' ? '#b91c1c' : child.sync === 'saved' ? '#15803d' : '#64748b', marginBottom: 5 }}>{child.deleting ? 'Eliminando…' : child.sync === 'saving' ? 'Guardando…' : child.sync === 'saved' ? 'Guardado' : child.sync === 'error' ? 'Error: no confirmado' : 'Borrador sin guardar'}</div>
              {child.error && <div role="alert" style={{ color: '#b91c1c', marginBottom: 5 }}>{child.error}</div>}
              {child.sync === 'error' && <button type="button" onClick={() => child.errorOperation === 'delete' ? remove(child) : store.save(task.id, child.id, { retry: true })} style={buttonStyle}>Reintentar</button>}{' '}
              <button type="button" disabled={child.deleting} onClick={() => remove(child)} style={{ ...buttonStyle, color: '#b91c1c' }}>{child.isNew ? 'Cancelar borrador' : 'Eliminar'}</button>
            </td>
          </tr>)}</tbody>
        </table>}
      </div>
    </td>
  </tr>;
}
