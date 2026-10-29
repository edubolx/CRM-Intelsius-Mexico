// Fixed CRM catalogue. Sizes intentionally have no unit.
const orcaTemps = Object.freeze(['2 a 8', '15 a 25', '-15 a -25', 'Dry Ice']);
const bioTemps = Object.freeze(['2 a 8', '15 a 25', 'Dry Ice']);
const entry = (sizes, temperatures) => Object.freeze({ sizes: Object.freeze(sizes), temperatures });
export const PRODUCT_CATALOGUE = Object.freeze({
  'Orca M': entry(['4', '11', '23', '50'], orcaTemps),
  'Orca S': entry(['4', '11', '23', '50'], orcaTemps),
  'Orca pallet': entry(['100', '255', '345'], orcaTemps),
  Biotherm: entry(['7', '10', '15', '30', '45', '80'], bioTemps),
  Pharmatherm: entry(['7', '10', '15', '30', '45', '80'], bioTemps),
});
export const isUUID = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const optional = v => v === '' || v == null ? null : v;
export function normalizeProducts(rows = []) {
  if (!Array.isArray(rows)) throw new Error('Productos: lista inválida');
  const ids = new Set();
  return rows.map((row, i) => {
    const fail = message => { throw new Error(`Producto ${i + 1}: ${message}`); };
    if (!row || typeof row !== 'object' || Object.keys(row).some(k => !['id','line','size','temperature','quantity','periodicity'].includes(k))) fail('campos inválidos');
    if (!isUUID(row.id) || ids.has(row.id.toLowerCase())) fail('identificador inválido o duplicado');
    ids.add(row.id.toLowerCase());
    const c = Object.hasOwn(PRODUCT_CATALOGUE, row.line) && PRODUCT_CATALOGUE[row.line];
    if (!c) fail('selecciona una línea');
    const size = optional(row.size), temperature = optional(row.temperature), periodicity = optional(row.periodicity);
    if (size !== null && !c.sizes.includes(size)) fail('tamaño no válido para la línea');
    if (temperature !== null && !c.temperatures.includes(temperature)) fail('temperatura no válida para la línea');
    if (periodicity !== null && !['one_time','monthly','rental'].includes(periodicity)) fail('periodicidad inválida');
    let quantity = optional(row.quantity);
    if (quantity !== null) {
      if (typeof quantity === 'string' && !/^\d+$/.test(quantity)) fail('cantidad debe ser un entero positivo');
      if (!['string','number'].includes(typeof quantity)) fail('cantidad inválida');
      quantity = Number(quantity);
      if (!Number.isSafeInteger(quantity) || quantity <= 0) fail('cantidad debe ser un entero positivo seguro');
    }
    return { id:row.id, line:row.line, size, temperature, quantity, periodicity };
  });
}
export function changeProductLine(row, line) {
  const c = PRODUCT_CATALOGUE[line];
  return { ...row, line, size: c?.sizes.includes(row.size) ? row.size : null, temperature: c?.temperatures.includes(row.temperature) ? row.temperature : null };
}
