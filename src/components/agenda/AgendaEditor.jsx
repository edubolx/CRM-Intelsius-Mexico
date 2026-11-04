import { TASK_STATES, ACTIVITY_STATES, ACTIVITY_TYPES } from './agendaRepository.js';
import { AGENDA_STATUS } from './agendaLabels.js';

// Pure form: all changes are local to the shared controller until explicit Save.
export default function AgendaEditor({snapshot:s,controller,users=[],deals=[],lang='es'}) {
  if (!s?.session) return null;
  const task=s.source==='special_task', d=s.draft, details=s.mode!=='inline';
  const change=(key,value)=>controller.edit({[key]:value});
  const input=(key,label,type='text')=><label><span>{label}</span><input aria-label={label} type={type} value={d[key] ?? ''} required={key==='title'} onChange={e=>change(key,e.target.value || (type==='date'?null:''))} /></label>;
  const select=(key,label,options)=>{
    const all=[...options];
    if (d[key] && !all.some(([value])=>String(value)===String(d[key]))) all.push([d[key],d[key]]);
    return <label><span>{label}</span><select aria-label={label} value={d[key] ?? ''} onChange={e=>change(key,e.target.value || null)}>{all.map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>;
  };
  const error=s.error && <div role="alert">{s.error}{s.conflict && <><p>Valores actuales del servidor:</p><ul>{s.conflict.dirty.map(key=><li key={key}>{key}: {String(s.conflict.remote[key] ?? '—')}</li>)}</ul></>}</div>;
  const cancel=<button type="button" data-action="cancel-editor" disabled={s.busy} onClick={()=>controller.cancel()}>Cancelar</button>;
  if(s.mode==='delete') return <section className="agenda-editor" data-editor-key={s.session} data-editor-mode="delete" role="alertdialog" aria-label="Confirmar eliminación">
    <h2>Eliminar {task?'tarea especial':'actividad'}: {d.title}</h2>
    <p>Registro exacto: {s.session}{!task && ` · Tipo original: ${d.type}`}</p>
    {task && <p>Se eliminarán también sus subtareas ({s.childCount} conocidas). No se eliminarán otras tareas.</p>}
    {error}<div className="agenda-editor-actions">{cancel}<button type="button" data-action="confirm-delete" disabled={s.busy} onClick={()=>controller.remove({retry:!!s.conflict})}>{s.busy?'Eliminando…':s.conflict?'Revisado: reintentar eliminación':'Eliminar definitivamente'}</button></div>
  </section>;
  return <form className={`agenda-editor ${details?'':'agenda-inline-editor'}`} data-editor-key={s.session} data-editor-mode={s.mode} aria-label={details?'Detalles de Agenda':'Edición en fila'} onSubmit={e=>{e.preventDefault();return controller.save({retry:!!s.conflict});}}>
    <h2>{s.base?'Editar':'Nueva'} {task?'tarea especial':'actividad'}</h2>
    <fieldset disabled={s.busy}>
      <div className="agenda-editor-fields">
        {input('title','Título')}
        {task ? select('owner_id','Responsable',[['','Sin responsable'],...users.map(u=>[u.id,u.alias || u.name || u.id])]) : input('responsible','Responsable')}
        {select('status','Estado',(task?TASK_STATES:ACTIVITY_STATES).map(value=>[value,AGENDA_STATUS[lang]?.[value] || value]))}
        {input('due_date','Fecha compromiso','date')}
        {select('importance_score','Importancia',[['','Sin prioridad'],...[1,2,3,4,5].map(n=>[n,String(n)])])}
        {select('urgency_score','Urgencia',[['','Sin prioridad'],...[1,2,3,4,5].map(n=>[n,String(n)])])}
        {details && select('deal_id','Oportunidad',[['',task?'Sin oportunidad':'Elige una oportunidad…'],...deals.map(deal=>[deal.id,deal.name])])}
        {details && !task && select('type','Tipo',ACTIVITY_TYPES.map(value=>[value,value]))}
      </div>
      {details && task && <label><span>Descripción</span><textarea aria-label="Descripción" value={d.description || ''} onChange={e=>change('description',e.target.value || null)} /></label>}
      {details && <label><span>Comentarios</span><textarea aria-label="Comentarios" value={(task?d.comments:d.comment) || ''} onChange={e=>change(task?'comments':'comment',e.target.value || (task?null:''))} /></label>}
    </fieldset>
    {error}
    <div className="agenda-editor-actions">
      {!details && <button type="button" disabled={s.busy} onClick={()=>controller.details()}>Detalles</button>}
      {cancel}
      <button type="submit" data-action="save-editor" disabled={s.busy}>{s.busy?'Guardando…':s.conflict?'Revisado: reintentar guardado':'Guardar'}</button>
    </div>
    {s.busy && <p role="status">Guardando…</p>}
  </form>;
}
