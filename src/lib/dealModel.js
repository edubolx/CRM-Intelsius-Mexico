import { normalizeProducts } from './dealProducts.js';

// Camel-case UI model; never infer catalogue selections from the legacy free-text field.
export function dealFromRow(row) {
  return {
    ...row,
    companyId: row.company_id ?? row.companyId ?? '',
    contactId: row.contact_id ?? row.contactId ?? '',
    closingDate: row.closing_date ?? row.closingDate ?? '',
    wonAt: row.won_at ?? row.wonAt ?? null,
    leadSource: row.lead_source ?? row.leadSource ?? '',
    leadSourceCustom: row.lead_source_custom ?? row.leadSourceCustom ?? '',
    productInterests: structuredClone(row.product_interests ?? row.productInterests ?? []),
    productInterestsRevision: row.product_interests_revision ?? row.productInterestsRevision ?? 0,
  };
}
export function dealToRow(deal) {
  return {
    name: deal.name || '', value: Number(deal.value) || 0, stage: deal.stage || '',
    company_id: deal.companyId || null, contact_id: deal.contactId || null,
    closing_date: deal.closingDate || null, won_at: deal.wonAt || null,
    notes: deal.notes || '', lead_source: deal.leadSource || null,
    lead_source_custom: deal.leadSourceCustom || null,
    product_interests: normalizeProducts(deal.productInterests ?? deal.product_interests ?? []),
  };
}
