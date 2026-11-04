import { ACTIVITY_STATES, ACTIVITY_TYPES } from './agendaRepository.js';
import { AGENDA_STATUS } from './agendaLabels.js';

const inputStyle={width:'100%',background:'#f8fafc',border:'1px solid #cfd8e3',borderRadius:10,padding:'8px 11px',color:'#0f172a',fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'};
const labelStyle={display:'block',fontSize:10,color:'#64748b',marginBottom:4,letterSpacing:.8,textTransform:'uppercase',fontFamily:"'JetBrains Mono',monospace"};
const Field=({label,children})=><div style={{marginBottom:12}}><span style={labelStyle}>{label}</span>{children}</div>;
const Input=({label,...props})=><Field label={label}><input {...props} style={inputStyle}/></Field>;
const Select=({label,opts,...props})=><Field label={label}><select {...props} style={inputStyle}>{opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></Field>;
const Textarea=({label,...props})=><Field label={label}><textarea {...props} rows={3} style={{...inputStyle,resize:'vertical'}}/></Field>;
export function activityLabels(t={},lang='es') {
  const en=lang==='en';
  return {...(en?{activityType:'Type',activityTitle:'Title',activityDueDate:'Due date',activityResponsible:'Responsible',activityStatus:'Status',activityImportance:'Importance',activityUrgency:'Urgency',activityEisenhowerScore:'Eisenhower score',activityComment:'Comment',addActivity:'New activity',activityUpdate:'Save changes',activityEdit:'Edit activity',deleteBtn:'Delete',cancel:'Cancel',selectOpt:'Select…',noActivities:'No activities yet.',task:'Task',emailType:'Email',call:'Call',meeting:'Meeting',note:'Note'}:{activityType:'Tipo',activityTitle:'Título',activityDueDate:'Fecha compromiso',activityResponsible:'Responsable',activityStatus:'Estado',activityImportance:'Importancia',activityUrgency:'Urgencia',activityEisenhowerScore:'Score Eisenhower',activityComment:'Comentario',addActivity:'Nueva actividad',activityUpdate:'Guardar cambios',activityEdit:'Editar actividad',deleteBtn:'Eliminar',cancel:'Cancelar',selectOpt:'Seleccionar…',noActivities:'Sin actividades todavía.',task:'Tarea',emailType:'Email',call:'Llamada',meeting:'Reunión',note:'Nota'}),...AGENDA_STATUS[lang],...t};
}
export function ActivityIcon({n,s=12}) {
  const paths={edit:<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,trash:<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,plus:<path d="M12 5v14M5 12h14"/>,check:<polyline points="20 6 9 17 4 12"/>};
  return <svg stroke="currentColor" strokeWidth="1.8" fill="none" width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">{paths[n]}</svg>;
}
export const activityTypeLabel=(type,t)=>type==='email' || type==='emailType'?t.emailType:(t[type] || type);

// Presentation only: the parent supplies an idle view or the shared native draft.
// No state, effects, independent persistence, or value normalization on rendering.
export function renderDealActivityForm({snapshot:s,controller,users=[],deals=[],lang='es',t,helpers={},error}) {
  const labels=activityLabels(t,lang),d=s.draft;
  const {Inp=Input,Sel=Select,Txta=Textarea,Ic=ActivityIcon}=helpers;
  const blocked=!!s.busy || !!s.blocked;
  const change=(key,value)=>controller.edit({[key]:value});
  const input=(key,label,type='text',extra={})=><Inp label={label+(key==='title'?' *':'')} aria-label={label} type={type} value={d[key] ?? ''} disabled={blocked} onChange={e=>change(key,e.target.value || (type==='date'?null:''))} {...extra}/>;
  const select=(key,label,opts,required=false)=>{
    const all=[...opts];
    if(d[key]!=null && d[key]!=='' && !all.some(o=>String(o.v)===String(d[key])))all.push({v:d[key],l:activityTypeLabel(d[key],labels)});
    return <Sel label={label+(required?' *':'')} aria-label={label} value={String(d[key] ?? '')} disabled={blocked} opts={all} onChange={e=>change(key,e.target.value || (key==='responsible'?'':null))}/>;
  };
  const score=d.importance_score==null || d.importance_score==='' || d.urgency_score==null || d.urgency_score===''?'':Number(d.importance_score)+Number(d.urgency_score);
  const scoreOpts=[{v:'',l:labels.selectOpt},...[1,2,3,4,5].map(n=>({v:String(n),l:String(n)}))];
  const buttonStyle={borderRadius:10,padding:'7px 14px',fontSize:12,fontWeight:500,cursor:blocked?'not-allowed':'pointer',fontFamily:'inherit',display:'inline-flex',alignItems:'center',gap:5,opacity:blocked?.5:1};
  return <form data-presentation="deal" data-editor-key={s.session || undefined} data-editor-mode={s.mode || 'details'} aria-label={lang==='en'?'Deal activity':'Actividad de oportunidad'} onSubmit={e=>{e.preventDefault();if(blocked || !String(d.title || '').trim() || (!s.base && [d.importance_score,d.urgency_score].some(value=>![1,2,3,4,5].includes(Number(value)))))return false;return controller.save({retry:!!s.conflict});}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:8,marginBottom:10}}>
      {select('type',labels.activityType,ACTIVITY_TYPES.filter(v=>v!=='email').map(v=>({v,l:activityTypeLabel(v,labels)})))}
      {input('title',labels.activityTitle,'text',{required:true})}
      {input('due_date',labels.activityDueDate,'date')}
      {select('responsible',labels.activityResponsible,[{v:'',l:labels.selectOpt},...users.map(u=>({v:u.alias || u.name,l:`${u.alias || u.name} (${u.name})`}))])}
      {select('status',labels.activityStatus,ACTIVITY_STATES.map(v=>({v,l:labels[v] || v})))}
      {select('importance_score',labels.activityImportance,scoreOpts,true)}
      {select('urgency_score',labels.activityUrgency,scoreOpts,true)}
      <Inp label={labels.activityEisenhowerScore} aria-label={labels.activityEisenhowerScore} value={score} disabled/>
    </div>
    <Txta label={labels.activityComment} aria-label={labels.activityComment} value={d.comment ?? ''} disabled={blocked} onChange={e=>change('comment',e.target.value)}/>
    {s.session && <details style={{fontSize:11,color:'#64748b',marginTop:8}}><summary>{lang==='en'?'More details':'Más detalles'}</summary>{select('deal_id',lang==='en'?'Opportunity':'Oportunidad',deals.map(deal=>({v:deal.id,l:deal.name})))}</details>}
    <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}>
      {s.session && <button type="button" data-action="cancel-editor" disabled={blocked} onClick={()=>controller.cancel()} style={{...buttonStyle,background:'#fff',color:'#334155',border:'1px solid #cbd5e1'}}>{labels.cancel}</button>}
      <button type="submit" data-action={s.session?'save-editor':'new-deal-activity'} disabled={blocked} style={{...buttonStyle,background:'#003e7e',color:'#fff',border:'1px solid #003e7e'}}>{Ic && <Ic n={s.base?'check':'plus'} s={12}/>} {s.busy?(labels.saving || (lang==='en'?'Saving…':'Guardando…')):s.conflict?(lang==='en'?'Reviewed: retry save':'Revisado: reintentar guardado'):s.base?labels.activityUpdate:labels.addActivity}</button>
    </div>
    {error && <div style={{marginTop:8,fontSize:11,color:'#ef4444',fontFamily:"'JetBrains Mono',monospace"}}>{error}</div>}
    {!error && (d.importance_score==null || d.importance_score==='' || d.urgency_score==null || d.urgency_score==='') && <div style={{marginTop:8,fontSize:11,color:'#64748b',fontFamily:"'JetBrains Mono',monospace"}}>{labels.activityImportance} + {labels.activityUrgency} {lang==='en'?'are required.':'son obligatorios.'}</div>}
  </form>;
}
