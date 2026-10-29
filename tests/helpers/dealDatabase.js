const id='00000000-0000-4000-8000-000000000011';
const product={id:'00000000-0000-4000-8000-000000000012',line:'Orca M'};
// In-memory transport implements Supabase filters/atomic row writes; no external calls.
function database(initial=null) {
  const db={row:structuredClone(initial),writes:[],reads:0,ackLost:false,empty:false,emptyAfter:false,readMissing:false,gate:null};
  db.from=()=>{
    let op='read', payload, filters=[];
    const q={select(){return q;},insert(p){op='insert';payload=p;return q;},update(p){op='update';payload=p;return q;},eq(k,v){filters.push([k,v]);return q;},maybeSingle(){return q;},then(resolve,reject){return (async()=>{
      if(op==='read'){db.reads++;return {data:db.readMissing?null:structuredClone(db.row),error:null};}
      if(db.gate) await db.gate;
      db.writes.push({op,payload:structuredClone(payload),filters});
      if(db.empty)return {data:[],error:null};
      if(op==='insert' && db.row)return {data:null,error:{code:'23505',message:'duplicate'}};
      if(op==='update' && (!db.row || !filters.every(([k,v])=>db.row[k]===v)))return {data:[],error:null};
      const old=db.row;db.row={...old,...payload};
      if(op==='insert')db.row.product_interests_revision=0;
      else if(payload.product_interests && JSON.stringify(old?.product_interests)!==JSON.stringify(payload.product_interests))db.row.product_interests_revision=(old?.product_interests_revision||0)+1;
      db.row.product_interests_revision??=0;
      if(db.ackLost){db.ackLost=false;throw new Error('lost ACK');}
      return {data:db.emptyAfter?[]:[structuredClone(db.row)],error:null};
    })().then(resolve,reject);}};
    return q;
  };
  return db;
}
export { database, id, product };
