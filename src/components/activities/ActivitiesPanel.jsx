import AgendaEditor from '../agenda/AgendaEditor.jsx';
import { buildAgenda } from '../agenda/agendaModel.js';
import { ACTIVITY_STATES } from '../agenda/agendaRepository.js';
import { ActivityIcon, activityLabels, activityTypeLabel } from '../agenda/DealActivityForm.jsx';

// Original deal presentation; every mutation still belongs to the shared session.
export default function ActivitiesPanel({deal,deals=[deal],users=[],lang='es',t,helpers={},agendaController,agendaEditor}) {
  const context=`deal:${deal.id}`;
  const labels=activityLabels(t,lang),Ic=helpers.Ic || ActivityIcon;
  // Opening the ficha renders a view, not an abandoned global draft.
  const empty={type:'task',title:'',deal_id:deal.id,due_date:helpers.today?.() || new Date().toLocaleDateString('en-CA'),responsible:'',status:'pending',comment:'',importance_score:'',urgency_score:''};
  const owns=agendaEditor?.session && agendaEditor.context===context;
  const view=owns?agendaEditor:{source:'deal_activity',session:null,draft:empty,blocked:!!agendaEditor?.session};
  let formSession=owns?agendaEditor.session:null;
  let formToken=owns?agendaEditor.sessionToken:null;
  const matches=current=>!!formSession && current.session===formSession && current.sessionToken===formToken && current.context===context && current.source==='deal_activity';
  const acquire=()=>{
    const current=agendaController.getSnapshot();
    if(formSession)return matches(current) && current.mode!=='delete';
    // An idle render may acquire once, but never after another open or from a blocked view.
    if(current.session || agendaEditor?.session || current.sessionToken!==agendaEditor?.sessionToken)return false;
    if(!agendaController.open({source:'deal_activity',id:crypto.randomUUID(),dealId:deal.id,context}))return false;
    formSession=agendaController.getSnapshot().session;
    formToken=agendaController.getSnapshot().sessionToken;
    agendaController.edit(empty);
    return true;
  };
  const formController={...agendaController,
    edit:patch=>{if(acquire())agendaController.edit(patch);},
    save:options=>acquire()?agendaController.save(options):false,
    cancel:()=>matches(agendaController.getSnapshot())?agendaController.cancel():false,
    remove:options=>matches(agendaController.getSnapshot()) && agendaController.getSnapshot().mode==='delete'?agendaController.remove(options):false,
  };
  const score=row=>{
    const {importance_score:importance,urgency_score:urgency,eisenhower_score:stored}=row.nativeRow;
    return [importance,urgency].every(value=>value!=null && value!=='' && Number.isFinite(Number(value)))?Number(importance)+Number(urgency):stored ?? null;
  };
  const rows=buildAgenda({deals:[deal],users}).sort((a,b)=>Number(score(b) ?? -1)-Number(score(a) ?? -1) || (a.nativeRow.due_date || '9999-12-31').localeCompare(b.nativeRow.due_date || '9999-12-31'));
  const open=(row,mode='details')=>agendaController.open({source:row.source,id:row.id,base:row.nativeRow,context,mode});
  const metadata={fontSize:10,color:'#475569',fontFamily:"'JetBrains Mono',monospace"};
  return <section aria-label={lang==='en'?'Deal activities':'Actividades de oportunidad'}>
    <AgendaEditor snapshot={view} controller={formController} users={users} deals={deals} lang={lang} presentation="deal" t={t} helpers={helpers} />
    {agendaEditor?.session && !owns && <p role="status">{lang==='en'?'Finish or cancel the open Agenda edit.':'Termina o cancela la edición abierta en Agenda.'}</p>}
    <div role="list" style={{marginTop:14,display:'flex',flexDirection:'column',gap:8}}>
      {!rows.length && <div style={{fontSize:11,color:'#94a3b8',fontFamily:"'JetBrains Mono',monospace"}}>{labels.noActivities}</div>}
      {rows.map(row=>{
        const a=row.nativeRow;
        const statuses=ACTIVITY_STATES.includes(a.status)?ACTIVITY_STATES:[...ACTIVITY_STATES,a.status];
        return <article role="listitem" key={row.key} data-agenda-key={row.key} className="deal-activity-card" style={{background:'#f5f7fa',border:'1px solid #cfd8e3',borderRadius:10,padding:'9px 10px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
            <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
              <span style={{fontSize:10,fontFamily:"'JetBrains Mono',monospace",background:'#ffffff',border:'1px solid #cfd8e3',borderRadius:5,padding:'2px 6px'}}>{activityTypeLabel(a.type,labels)}</span>
              <span style={{fontSize:12,fontWeight:600,color:'#0f172a'}}>{a.title}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <select aria-label={`${labels.activityStatus}: ${a.title}`} data-status-key={row.key} value={a.status} disabled={!!agendaEditor?.session} onChange={e=>{if(!open(row))return false;agendaController.edit({status:e.target.value});return agendaController.save();}} style={{...helpers.iSx,background:'#f8fafc',border:'1px solid #cfd8e3',borderRadius:10,color:'#0f172a',padding:'3px 6px',fontSize:11,width:120}}>
                {statuses.map(status=><option key={status} value={status}>{labels[status] || status}</option>)}
              </select>
              <button type="button" title={labels.activityEdit} aria-label={`${labels.activityEdit}: ${a.title}`} data-edit-key={row.key} disabled={!!agendaEditor?.session} onClick={()=>open(row)} style={{background:'none',border:'none',color:'#003e7e',cursor:'pointer',padding:2}}><Ic n="edit" s={12}/></button>
              <button type="button" title={labels.deleteBtn} aria-label={`${labels.deleteBtn}: ${a.title}`} data-delete-key={row.key} disabled={!!agendaEditor?.session} onClick={()=>open(row,'delete')} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',padding:2}}><Ic n="trash" s={12}/></button>
            </div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:6,flexWrap:'wrap'}}>
            {a.due_date && <span style={metadata}>📅 {a.due_date}</span>}
            {a.responsible && <span style={{fontSize:10,color:'#475569'}}>👤 {a.responsible}</span>}
            {a.importance_score!=null && <span style={metadata}>Imp {a.importance_score}</span>}
            {a.urgency_score!=null && <span style={metadata}>Urg {a.urgency_score}</span>}
            {score(row)!=null && <span style={{...metadata,color:'#003e7e',background:'#eaf3ff',border:'1px solid #cbd5e1',borderRadius:5,padding:'2px 6px'}}>Score {score(row)}</span>}
          </div>
          {a.comment && <div style={{fontSize:11,color:'#64748b',marginTop:4,lineHeight:1.5}}>{a.comment}</div>}
        </article>;
      })}
    </div>
  </section>;
}
