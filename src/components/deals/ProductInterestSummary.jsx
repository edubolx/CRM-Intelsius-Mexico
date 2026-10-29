export default function ProductInterestSummary({value = [], compact = false, lang = 'es'}) {
  if (!value.length) return null;
  const en = lang === 'en';
  const describe = row => [row.line,row.size,row.temperature ? (row.temperature === 'Dry Ice' ? row.temperature : `${row.temperature} °C`) : null,row.quantity != null ? `×${row.quantity}` : null,row.periodicity === 'monthly' ? (en?'Monthly':'Mensual') : row.periodicity === 'one_time' ? (en?'One time':'Una vez') : row.periodicity === 'rental' ? (en?'Rental':'Renta') : null].filter(Boolean).join(' · ');
  const visible = compact ? value.slice(0,2) : value;
  return <div aria-label={en?'Products of interest':'Productos de interés'} title={value.map(describe).join('\n')} style={{fontSize:compact?10:12,color:'#475569',lineHeight:1.5,marginTop:5}}>
    {visible.map((row,i)=><div key={row.id} data-product-summary-row="" style={compact?{whiteSpace:'nowrap',overflow:'hidden',display:'flex',gap:4}:undefined}>
      <span style={compact?{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0}:undefined}>{describe(row)}</span>
      {compact && i === 1 && value.length > 2 && <span style={{flexShrink:0,fontWeight:600}}>+{value.length-2}</span>}
    </div>)}
  </div>;
}
