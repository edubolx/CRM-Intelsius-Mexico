import AgendaEditor from '../agenda/AgendaEditor.jsx';
import { buildAgenda } from '../agenda/agendaModel.js';

// Compact deal list; the same controller, repository and editor own every mutation.
export default function ActivitiesPanel({deal,deals=[deal],users=[],lang='es',agendaController,agendaEditor}) {
  const context=`deal:${deal.id}`;
  const rows=buildAgenda({deals:[deal],users});
  const open=(row,mode='details')=>agendaController.open({source:row.source,id:row.id,base:row.nativeRow,context,mode});
  return <section aria-label="Actividades de oportunidad">
    <button type="button" data-action="new-deal-activity" disabled={!!agendaEditor?.session} onClick={()=>agendaController.open({source:'deal_activity',id:crypto.randomUUID(),dealId:deal.id,context})}>+ Nueva actividad</button>
    {agendaEditor?.session && agendaEditor.context===context && <AgendaEditor snapshot={agendaEditor} controller={agendaController} users={users} deals={deals} lang={lang} />}
    {agendaEditor?.session && agendaEditor.context!==context && <p role="status">Termina o cancela la edición abierta en Agenda.</p>}
    <div role="list">
      {rows.map(row=><article role="listitem" key={row.key} data-agenda-key={row.key} className="agenda-context-item">
        <strong>{row.title}</strong> <span>{row.nativeType} · {row.status} · {row.ownerLabel} · {row.dueDate || 'Sin fecha'}</span>
        <button type="button" data-edit-key={row.key} disabled={!!agendaEditor?.session} onClick={()=>open(row)}>Editar</button>
        <button type="button" data-delete-key={row.key} disabled={!!agendaEditor?.session} onClick={()=>open(row,'delete')}>Eliminar</button>
        {row.comment && <p>{row.comment}</p>}
      </article>)}
    </div>
  </section>;
}
