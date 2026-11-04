import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const read=path=>readFile(new URL(`../src/${path}`,import.meta.url),'utf8');
test('Agenda is the work surface; legacy grids/files/routes are removed, not hidden', async()=>{
  const app=await read('App.jsx');
  assert.match(app,/k:"agenda"/);
  assert.doesNotMatch(app,/SpecialTasksView|ActivitiesDashboard|setTab\(['"]specialTasks|tab==="specialTasks"|tab==="activities"/);
  assert.match(app,/tab==="agenda"\s*&&\s*\(/);
  for(const path of ['components/special-tasks/SpecialTasksView.jsx','components/activities/ActivitiesDashboard.jsx']) await assert.rejects(access(new URL(`../src/${path}`,import.meta.url)));
});
test('Agenda and deal context share editor/controller/repository and preserve journal consumers', async()=>{
  const app=await read('App.jsx'),panel=await read('components/activities/ActivitiesPanel.jsx');
  assert.match(app,/createAgendaController/);assert.match(app,/createAgendaRepository/);
  assert.match(app,/editor=\{!viewDeal \|\| agendaEditor.context/); // Closing a deal returns its retained shared draft to Agenda.
  assert.match(app,/<AgendaEditor/); assert.match(panel,/<AgendaEditor/);
  assert.match(panel,/data-edit-key/); assert.match(panel,/data-delete-key/);
  assert.doesNotMatch(panel,/onAddActivity|onUpdateActivityStatus|completedAt/);
  assert.doesNotMatch(app,/upsert\(allActivities|const allActivities/);
  assert.match(app,/const addManualJournalEntry=/); assert.match(app,/const deleteManualJournalEntry=/);
  assert.match(app,/activities:.*map|activities:.*filter/s);
});
