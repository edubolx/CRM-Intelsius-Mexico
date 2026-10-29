import { dealFromRow, dealToRow } from './dealModel.js';

export const LOCAL_CRM_KEY = 'crm5_data';
export function loadLocalData(storage, initialData) {
  const encoded = storage?.getItem(LOCAL_CRM_KEY);
  const data = encoded ? JSON.parse(encoded) : structuredClone(initialData);
  return {...data,dl:(data.dl || []).map(dealFromRow),__source:'local'};
}

// Offline-only transport for the same save/readback/CAS contract. Never used after a remote failure.
export function createLocalDealClient({storage, initialData}) {
  const dbRow = deal => ({...deal,...dealToRow(deal),id:deal.id,product_interests_revision:deal.productInterestsRevision ?? 0});
  return {from(table) {
    if (table !== 'deals') throw new Error('Tabla local no compatible');
    let operation='read',payload,filters=[];
    const query = {
      select(){return query;}, maybeSingle(){return query;},
      eq(k,v){filters.push([k,v]);return query;},
      insert(row){operation='insert';payload=row;return query;},
      update(row){operation='update';payload=row;return query;},
      then(resolve,reject){return Promise.resolve().then(()=>{
        const data=loadLocalData(storage,initialData), rows=data.dl.map(dbRow);
        const match=row=>filters.every(([k,v])=>row[k]===v);
        if(operation==='read')return {data:rows.find(match) || null,error:null};
        const index=operation==='insert'?rows.findIndex(row=>row.id===payload.id):rows.findIndex(match);
        if(operation==='insert' && index>=0)return {data:null,error:{code:'23505',message:'El deal ya existe'}};
        if(operation==='update' && index<0)return {data:[],error:null};
        const previous=index<0?null:rows[index],next={...previous,...payload};
        const changed=Object.hasOwn(payload,'product_interests') && JSON.stringify(previous?.product_interests ?? [])!==JSON.stringify(payload.product_interests);
        next.product_interests_revision=operation==='insert'?0:(previous?.product_interests_revision ?? 0)+(changed?1:0);
        const ui=dealFromRow(next);
        if(index<0)data.dl.push(ui);else data.dl[index]=ui;
        if (!storage) throw new Error('Almacenamiento local no disponible');
        storage.setItem(LOCAL_CRM_KEY,JSON.stringify(data));
        return {data:[next],error:null};
      }).then(resolve,reject);},
    };
    return query;
  }};
}
