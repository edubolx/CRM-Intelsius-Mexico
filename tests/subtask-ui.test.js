import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';
import { createSubtaskStore } from '../src/components/special-tasks/subtaskStore.js';

async function components() {
  let source;
  try { source = await readFile(new URL('../src/components/special-tasks/SubtaskPanel.jsx', import.meta.url), 'utf8'); } catch { assert.fail('SubtaskPanel frontend must exist'); }
  source = source.replace("from 'react'", `from '${import.meta.resolve('react')}'`).replace("from './subtaskModel.js'", `from '${new URL('../src/components/special-tasks/subtaskModel.js', import.meta.url).href}'`);
  const { code } = await transformWithEsbuild(source, 'SubtaskPanel.jsx', { loader: 'jsx', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

test('collapsed disclosure is a single discreet arrow, with accessible progress and unsaved-parent guard', async () => {
  const { SubtaskControls } = await components();
  const props = { task: { id: 'p', title: 'Parent', isNew: true }, expanded: false, progress: { done: 2, total: 5 }, onToggle() {}, onAdd() {} };
  const html = renderToStaticMarkup(React.createElement(SubtaskControls, props));
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls="subtasks-p"/);
  assert.match(html, /2 de 5 completadas/);
  assert.match(html, /disabled=""/);
  assert.match(html, /Guarda primero/);
  assert.equal(html.replace(/<[^>]*>/g, ''), '▸');
  assert.equal((html.match(/<button/g) || []).length, 1);
});

test('empty dropdown immediately offers a blank composer without creating a stored draft', async () => {
  const { SubtaskPanel } = await components();
  const store = createSubtaskStore({ list: async () => [] });
  const html = renderToStaticMarkup(React.createElement(SubtaskPanel, { task: { id: 'p' }, rows: [], store, users: [], statuses: [], expanded: true }));
  assert.match(html, /aria-label="Nueva subtarea"/);
  assert.match(html, /placeholder="Escribe una subtarea…"/);
  assert.doesNotMatch(html, /Sin subtareas|no modifican el estado/);
  assert.equal(store.getSnapshot().rows.length, 0);
});

test('child panel renders six statuses, required title, owner, date and visible retry without touching parents', async () => {
  const { SubtaskPanel } = await components();
  const store = createSubtaskStore({ list: async () => [], write: async () => { throw Error('offline'); } });
  store.add({ id: 'p', isNew: false }, 'c'); store.edit('p', 'c', { title: 'Retained' }); await store.save('p', 'c');
  const html = renderToStaticMarkup(React.createElement(SubtaskPanel, { task: { id: 'p', isNew: false }, rows: store.getSnapshot().rows, store, users: [{ id: 'u', name: 'Edu' }], statuses: ['notStarted', 'inProgress', 'waiting', 'blocked', 'done', 'cancelled'].map(value => ({ value, label: value })) }));
  assert.match(html, /colSpan="12"|colspan="12"/);
  assert.match(html, /id="subtasks-p"/);
  assert.match(html, /required=""/);
  assert.match(html, /value="Retained"/);
  assert.match(html, /type="date"/);
  assert.match(html, /value="cancelled"/);
  assert.match(html, /offline/);
  assert.match(html, /Reintentar/);
  assert.match(html, /Edu/);
});

test('existing children form a lightweight list with the add button inside the dropdown', async () => {
  const { SubtaskPanel } = await components();
  const child = { id: 'c', parentTaskId: 'p', title: 'Existing child', ownerId: '', dueDate: '', status: 'notStarted', sync: 'saved' };
  const html = renderToStaticMarkup(React.createElement(SubtaskPanel, { task: { id: 'p' }, rows: [child], store: {}, users: [], statuses: [] }));
  assert.match(html, /role="list"/);
  assert.match(html, /role="listitem"/);
  assert.match(html, /\+ Nueva subtarea/);
  assert.doesNotMatch(html, /<thead|Guardado \/ acciones|aria-label="Nueva subtarea"/);
});

test('visible conflict retry explicitly authorizes saving but title blur does not', async () => {
  const { SubtaskPanel } = await components(); const calls = [];
  const child = { id: 'c', parentTaskId: 'p', title: 'Local draft', ownerId: '', dueDate: '', status: 'notStarted', isNew: false, sync: 'error', errorOperation: 'save', error: 'Conflicto', conflict: true };
  const tree = SubtaskPanel({ task: { id: 'p' }, rows: [child], users: [], statuses: [], store: { save(...args) { calls.push(args); } } });
  const nodes = [];
  const walk = element => { if (!React.isValidElement(element)) return; nodes.push(element); React.Children.forEach(element.props.children, walk); };
  walk(tree);
  nodes.find(node => node.type === 'input' && node.props['aria-label'] === 'Título de subtarea').props.onBlur();
  nodes.find(node => node.type === 'button' && node.props.children === 'Reintentar').props.onClick();
  assert.deepEqual(calls, [['p', 'c'], ['p', 'c', { retry: true }]]);
});

test('composer is wired to one explicitly titled draft and save within the parent dropdown', async () => {
  const source = await readFile(new URL('../src/components/special-tasks/SpecialTasksView.jsx', import.meta.url), 'utf8');
  assert.match(source, /onAdd=\{\(title\) => addSubtask\(task, title\)\}/);
  assert.match(source, /subtaskStore\.edit\(task\.id, childId, \{ title \}\)/);
  assert.match(source, /subtaskStore\.save\(task\.id, childId\)/);
  assert.match(source, /display: "flex", alignItems: "center".*<SubtaskControls/);
});

test('parent summary/filter pipeline stays separate; children load even when collapsed and realtime cleans up', async () => {
  const source = await readFile(new URL('../src/components/special-tasks/SpecialTasksView.jsx', import.meta.url), 'utf8');
  assert.match(source, /return tasks\s*\.filter/);
  assert.match(source, /count: filteredTasks\.filter/);
  assert.match(source, /filteredTasks\.map/);
  assert.match(source, /subtaskStore\.load\(\)/);
  assert.match(source, /table: "special_task_subtasks"/);
  assert.match(source, /supabase\.removeChannel\(childChannel\)/);
  assert.match(source, /childProgress\(subtasks\.rows, task\.id\)/);
  assert.match(source, /subtareas.*eliminarán|eliminarán.*subtareas/);
});
