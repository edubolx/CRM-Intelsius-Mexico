import { dealFromRow, dealToRow } from './dealModel.js';
import { createDealSaveSession } from './dealSave.js';
import { normalizeProducts } from './dealProducts.js';

// Bulk snapshots/imports must not turn absence of the new field into an explicit clear.
export async function saveDealSnapshot(client, deal) {
  const {data:remote,error} = await client.from('deals').select('*').eq('id',deal.id).maybeSingle();
  if (error) throw new Error(error.message);
  const revision = deal.productInterestsRevision ?? deal.product_interests_revision;
  if (!remote && revision != null) throw new Error('El deal fue eliminado; no se recreó desde una copia anterior');
  const hasProducts = Object.hasOwn(deal,'productInterests') || Object.hasOwn(deal,'product_interests');
  const incoming = hasProducts ? normalizeProducts(deal.productInterests ?? deal.product_interests) : normalizeProducts(remote?.product_interests ?? []);
  if (remote && hasProducts && revision == null && JSON.stringify(incoming) !== JSON.stringify(normalizeProducts(remote.product_interests))) throw new Error('Conflicto: falta la revisión de productos; recarga antes de importar cambios');
  const draft = dealToRow({...dealFromRow(deal),productInterests:incoming});
  const session = createDealSaveSession({id:deal.id,mode:remote?'edit':'create',base:remote?{...remote,product_interests_revision:revision ?? remote.product_interests_revision}:{}});
  return session.save(client,draft);
}
