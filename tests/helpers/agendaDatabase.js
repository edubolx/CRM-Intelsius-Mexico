// In-memory PostgREST boundary; production repository/controller execute unchanged.
export function database(seed = {}) {
  const tables = structuredClone({ special_tasks: [], deal_activities: [], ...seed });
  const calls = [];
  let fault, readFault;
  const client = { from(table) {
    let operation = 'read', payload, filters = [];
    const query = {
      select() { return query; }, order() { return query; },
      eq(k,v) { filters.push([k,v]); return query; },
      is(k,v) { filters.push([k,v]); return query; },
      insert(row) { operation='insert'; payload=row; return query; },
      update(row) { operation='update'; payload=row; return query; },
      delete() { operation='delete'; return query; },
      maybeSingle() { return query; }, single() { return query; },
      then(resolve,reject) {
        return Promise.resolve().then(() => {
          calls.push({table,operation,payload:structuredClone(payload),filters:structuredClone(filters)});
          if (operation==='read' && readFault) { const message=readFault; readFault=null; throw Error(message); }
          if (fault?.before && operation !== 'read') { const f=fault; fault=null; throw Error(f.message || 'offline'); }
          const matches = row => filters.every(([k,v]) => (row[k] ?? null) === v);
          let data=tables[table].filter(matches);
          if (operation==='insert') {
            if (tables[table].some(r=>r.id===payload.id)) return {data:null,error:{code:'23505'}};
            data=[structuredClone(payload)]; tables[table].push(...data);
          }
          if (operation==='update') data.forEach(row=>Object.assign(row,payload));
          if (operation==='delete') tables[table]=tables[table].filter(row=>!matches(row));
          if (fault && operation!=='read') { const f=fault; fault=null; if(f.lost) {readFault=f.readError; throw Error('lost ACK');} if(f.empty) return {data:null,error:null}; }
          return {data: structuredClone(operation==='delete' ? data : data[0] || null),error:null};
        }).then(resolve,reject);
      },
    }; return query;
  }};
  return {client,tables,calls, fail(next) {fault=next;}, failRead(message) {readFault=message;}};
}
