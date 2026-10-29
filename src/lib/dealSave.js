import { normalizeProducts } from './dealProducts.js';

const FIELDS = ['name','value','stage','company_id','contact_id','closing_date','won_at','notes','lead_source','lead_source_custom','product_interests'];
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const sameField = (key,a,b) => {
  if (same(a,b)) return true;
  if (key !== 'won_at' || typeof a !== 'string' || typeof b !== 'string') return false;
  const parts = value => /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/i.exec(value);
  const left = parts(a), right = parts(b);
  if (!left || !right) return false;
  const seconds = value => Date.parse(value[1] + value[3]);
  // Compare whole seconds and exact fractions separately: Date.parse truncates microseconds.
  return Number.isFinite(seconds(left)) && seconds(left) === seconds(right) && (left[2] ?? '').replace(/0+$/,'') === (right[2] ?? '').replace(/0+$/,'');
};
const sameDesired = (a,b) => same({...a,won_at:undefined},{...b,won_at:undefined}) && sameField('won_at',a.won_at,b.won_at);
const snapshot = row => Object.fromEntries(FIELDS.filter(k => Object.hasOwn(row,k)).map(k => [k,k === 'product_interests' ? normalizeProducts(row[k]) : row[k]]));
const conflict = () => new Error('Conflicto: los productos cambiaron o el deal fue eliminado. Conservamos tu borrador; revisa la versión actual antes de reintentar.');

// One instance per open form, never per click. No upsert: edits cannot resurrect deleted deals.
export function createDealSaveSession({id, mode, base = {}}) {
  if (typeof id !== 'string' || !id.trim() || !['create','edit'].includes(mode)) throw new Error('Sesión de deal inválida');
  let baseline = snapshot({...base,product_interests:base.product_interests ?? []});
  let revision = base.product_interests_revision ?? 0;
  let busy = false, pending = null;
  const read = async client => {
    const {data,error} = await client.from('deals').select('*').eq('id',id).maybeSingle();
    if (error || !data || Array.isArray(data) || data.id !== id || !Array.isArray(data.product_interests) || data.product_interests_revision == null || !Number.isSafeInteger(Number(data.product_interests_revision)) || Number(data.product_interests_revision) < 0) throw new Error('No se pudo confirmar el deal. Conservamos tu borrador; reintenta para verificar.');
    return data;
  };
  const matches = (row, attempt) => Object.entries(attempt.payload).every(([k,v]) => sameField(k,k === 'product_interests' ? normalizeProducts(row[k]) : row[k],v)) && (!attempt.productsChanged || (attempt.create ? Number(row.product_interests_revision) === 0 : Number(row.product_interests_revision) > attempt.revision));
  const finish = row => {
    baseline = snapshot(row); revision = row.product_interests_revision; mode = 'edit'; pending = null;
    return {ok:true,row};
  };
  return { id, async save(client, draft) {
    if (busy) throw new Error('Ya se está guardando este deal');
    busy = true;
    try {
      const desired = snapshot({...draft,product_interests:Object.hasOwn(draft,'product_interests') ? draft.product_interests : baseline.product_interests});
      if (pending) {
        if (!sameDesired(desired,pending.desired)) throw new Error('No se pudo confirmar la intención anterior. Conservamos los cambios; verifica el deal y vuelve a abrirlo antes de guardar otra intención.');
        const row = await read(client);
        if (matches(row,pending)) return finish(row);
        if (mode === 'create' || Number(row.product_interests_revision) !== pending.revision) throw conflict();
        // An edit which demonstrably did not land can safely retry the original CAS.
      }
      const payload = mode === 'create' ? {...desired,id} : Object.fromEntries(Object.entries(desired).filter(([k,v]) => !sameField(k,v,baseline[k])));
      const productsChanged = Object.hasOwn(payload,'product_interests');
      if (mode === 'edit' && !Object.keys(payload).length) return finish(await read(client));
      if (productsChanged && (!Number.isSafeInteger(Number(revision)) || Number(revision) < 0)) throw conflict();
      pending = {payload,desired,productsChanged,revision:Number(revision),create:mode === 'create'};
      let response, writeError;
      try {
        let query = mode === 'create' ? client.from('deals').insert(payload) : client.from('deals').update(payload).eq('id',id);
        if (mode === 'edit' && productsChanged) query = query.eq('product_interests_revision',revision);
        response = await query.select('*');
        writeError = response?.error;
      } catch (error) { writeError = error; }
      if (mode === 'edit' && !writeError && (!Array.isArray(response?.data) || response.data.length !== 1)) {
        // An explicit zero-row CAS result is a conflict, not evidence of a successful write.
        pending = null;
        throw conflict();
      }
      let row;
      try { row = await read(client); }
      catch (error) {
        // Confirmed server rejection is retryable; transport/missing acknowledgements stay pending.
        if (writeError?.code && writeError.code !== '23505') pending = null;
        throw new Error(writeError?.code ? `${writeError.message}. No se pudo confirmar el deal` : error.message);
      }
      if (!matches(row,pending)) {
        if (writeError?.code && writeError.code !== '23505') { pending = null; throw new Error(writeError.message); }
        throw conflict();
      }
      return finish(row);
    } finally { busy = false; }
  }};
}
