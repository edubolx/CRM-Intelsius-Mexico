import { fieldsFor, newAgendaDraft } from './agendaRepository.js';

// One explicit session for both Agenda and deal context. Render/close never writes.
export function createAgendaController(repository, onPersist = () => {}) {
  let snapshot = {session:null, busy:false, error:'', message:''};
  let flight;
  const listeners = new Set();
  const emit = patch => { snapshot={...snapshot,...patch}; listeners.forEach(fn=>fn()); };
  const controller = {
    getSnapshot: () => snapshot,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    open({source,id,base=null,context='agenda',mode='details',dealId='',childCount=0}) {
      if (snapshot.session) return false;
      emit({session:`${source}:${id}`,source,id,context,mode,base,draft:base ? {...base} : newAgendaDraft(source,id,dealId),childCount,busy:false,error:'',message:'',conflict:null});
      return true;
    },
    edit(patch) {
      if (!snapshot.session || snapshot.busy) return;
      const allowed=Object.fromEntries(Object.entries(patch).filter(([key])=>fieldsFor(snapshot.source).includes(key)));
      emit({draft:{...snapshot.draft,...allowed}});
    },
    details() { if (!snapshot.busy) emit({mode:'details'}); },
    cancel() {
      if (snapshot.busy) return false;
      emit({session:null,error:'',conflict:null});
      return true;
    },
    remove({retry=false}={}) {
      if (flight) return flight;
      if (!snapshot.session || snapshot.mode !== 'delete' || (snapshot.conflict && !retry)) return Promise.resolve(false);
      if (retry && snapshot.conflict) emit({base:snapshot.conflict.remote,conflict:null});
      const attempt={...snapshot};
      emit({busy:true,error:''});
      flight=(async()=>{
        try {
          await repository.remove(attempt);
          onPersist(attempt.source,attempt.base,true);
          emit({session:null,busy:false,error:'',message:'Eliminado',conflict:null});
          return true;
        } catch(error) {
          emit({busy:false,error:error.message || String(error),conflict:error.remote ? {remote:error.remote,dirty:error.dirty} : null});
          return false;
        }
      })().finally(()=>{flight=undefined;});
      return flight;
    },
    save({retry=false}={}) {
      if (flight) return flight;
      if (!snapshot.session || (snapshot.conflict && !retry)) return Promise.resolve(false);
      if (retry && snapshot.conflict) {
        const {remote,dirty}=snapshot.conflict;
        const intended = [...new Set([...dirty,...fieldsFor(snapshot.source).filter(key => (snapshot.draft[key] ?? null) !== (snapshot.base?.[key] ?? null))])];
        emit({base:remote,draft:{...remote,...Object.fromEntries(intended.map(key=>[key,snapshot.draft[key]]))},conflict:null});
      }
      const attempt={...snapshot,draft:{...snapshot.draft}};
      emit({busy:true,error:''});
      flight=(async()=>{
        try {
          const row=await repository.save(attempt);
          onPersist(attempt.source,row,false);
          emit({session:null,busy:false,error:'',message:'Guardado',conflict:null});
          return true;
        } catch(error) {
          emit({busy:false,error:error.message || String(error),conflict:error.remote ? {remote:error.remote,dirty:error.dirty} : null});
          return false;
        }
      })().finally(()=>{flight=undefined;});
      return flight;
    },
  };
  return controller;
}
