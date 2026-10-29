import { PRODUCT_CATALOGUE, changeProductLine } from '../../lib/dealProducts.js';

const controlStyle = { width:'100%',boxSizing:'border-box',padding:'7px 8px',border:'1px solid #cfd8e3',borderRadius:6,background:'#fff',color:'#0f172a',font:'inherit' };
const buttonStyle = { border:'1px solid #cfd8e3',borderRadius:6,padding:'6px 9px',background:'#fff',color:'#003e7e',font:'inherit',cursor:'pointer' };
export default function ProductInterestEditor({value = [], onChange, lang = 'es', disabled = false}) {
  const en = lang === 'en', unknown = en ? 'To define' : 'Por definir';
  const label = {line:en?'Line':'Línea',size:en?'Size':'Tamaño',temperature:en?'Temperature (°C)':'Temperatura (°C)',quantity:en?'Quantity':'Cantidad',periodicity:en?'Frequency':'Periodicidad'};
  const update = (index,key,val) => onChange(value.map((row,i) => i !== index ? row : key === 'line' ? changeProductLine(row,val) : {...row,[key]:val}));
  return <fieldset disabled={disabled} style={{margin:'10px 0',padding:12,border:'1px solid #cfd8e3',borderRadius:9,fontSize:12,minWidth:0}}>
    <legend style={{fontWeight:600,color:'#003e7e'}}>{en?'Products of interest':'Productos de interés'}</legend>
    {value.map((row,index) => {
      const c = PRODUCT_CATALOGUE[row.line];
      const select = (key,options,required=false) => <label style={{display:'grid',gap:4}} htmlFor={`product-${row.id}-${key}`}>
        {label[key]}{required?' *':''}
        <select id={`product-${row.id}-${key}`} aria-label={`${label[key]} ${index+1}`} required={required} disabled={key !== 'line' && key !== 'periodicity' && !c} value={row[key] ?? ''} onChange={e=>update(index,key,e.target.value)} style={controlStyle}>
          <option value="">{required?(en?'Select line':'Selecciona línea'):unknown}</option>
          {options.map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>
      </label>;
      return <div key={row.id} role="group" aria-label={`${en?'Product':'Producto'} ${index+1}`} style={{padding:'9px 0',borderBottom:'1px solid #e2e8f0'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:9}}>
          {select('line',Object.keys(PRODUCT_CATALOGUE).map(v=>[v,v]),true)}
          {select('size',(c?.sizes || []).map(v=>[v,v]))}
          {select('temperature',(c?.temperatures || []).map(v=>[v,v === 'Dry Ice'?v:`${v} °C`]))}
          <label htmlFor={`product-${row.id}-quantity`} style={{display:'grid',gap:4}}>{label.quantity}
            <input id={`product-${row.id}-quantity`} aria-label={`${label.quantity} ${index+1}`} type="number" min="1" max={Number.MAX_SAFE_INTEGER} step="1" placeholder={unknown} value={row.quantity ?? ''} onChange={e=>update(index,'quantity',e.target.value)} style={controlStyle}/>
          </label>
          {select('periodicity',[['one_time',en?'One-time purchase':'Compra única'],['monthly',en?'Monthly purchase':'Compra mensual']])}
        </div>
        <button type="button" aria-label={`${en?'Remove product':'Eliminar producto'} ${index+1}`} onClick={()=>onChange(value.filter((_,i)=>i!==index))} style={{...buttonStyle,color:'#b91c1c',marginTop:8}}>{en?'Remove':'Eliminar'}</button>
      </div>;
    })}
    <button type="button" aria-label={en?'Add product':'Agregar producto'} onClick={()=>onChange([...value,{id:crypto.randomUUID(),line:'',size:null,temperature:null,quantity:null,periodicity:null}])} style={{...buttonStyle,marginTop:8}}>+ {en?'Add product':'Agregar producto'}</button>
  </fieldset>;
}
