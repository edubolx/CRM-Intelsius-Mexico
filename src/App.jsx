import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, useReducer, memo } from "react";
import Papa from "papaparse";
import { supabase } from './supabaseClient.js'

// ─── i18n ─────────────────────────────────────────────────────────────────────
const T = {
  es: {
    appName:"CRM Intelsius México", pipeline:"Pipeline", companies:"Empresas", contacts:"Contactos", usersTab:"Usuarios",
    newDeal:"Deal", newCompany:"Empresa", newContact:"Contacto",
    editDeal:"Editar Deal", newDealTitle:"Nuevo Deal",
    editCompany:"Editar Empresa", newCompanyTitle:"Nueva Empresa",
    editContact:"Editar Contacto", newContactTitle:"Nuevo Contacto",
    search:"Buscar...", save:"Guardar", cancel:"Cancelar",
    pipelineTotal:"Pipeline Total", closedWon:"Cerrado Ganado", totalDeals:"Total Deals",
    dealsW:"deals", contactsW:"contactos",
    noCompanies:"No hay empresas aún.", noContacts:"No hay contactos aún.", noDeals:"Sin deals.",
    closing:"Cierre", meddic:"MEDDIC", meddicScore:"Score MEDDIC",
    meddicTotal:"Score Total", meddicMax:"/ 30",
    meddicHistory:"Historial de evaluaciones",
    meddicNewEval:"Nueva evaluación",
    meddicSaveEval:"Guardar evaluación",
    meddicNotes:"Notas / evidencia",
    meddicNotesPlaceholder:"¿Qué información respalda esta calificación?",
    meddicDate:"Fecha",
    meddicNoHistory:"Sin evaluaciones previas.",
    meddicSaved:"Evaluación guardada correctamente.",
    meddicDeleteEval:"Eliminar evaluación",
    meddicDeleteConfirm:"¿Seguro que quieres eliminar esta evaluación?",
    viewDeal:"Ver deal",
    closeDeal:"Cerrar",
    activities:"Actividades",
    activityType:"Tipo",
    activityTitle:"Título",
    activityDueDate:"Fecha compromiso",
    activityResponsible:"Responsable",
    activityStatus:"Estado",
    activityComment:"Comentario",
    addActivity:"Nueva actividad",
    activityEdit:"Editar actividad",
    activityUpdate:"Guardar cambios",
    noActivities:"Sin actividades todavía.",
    pending:"Pendiente",
    inProgress:"En progreso",
    done:"Hecha",
    blocked:"Bloqueada",
    call:"Llamada",
    meeting:"Reunión",
    task:"Tarea",
    note:"Nota",
    emailType:"Email",
    dashboard:"Dashboard",
    overdue:"Vencidas",
    dueSoon:"Por vencer (7 días)",
    completedWeek:"Completadas semana",
    all:"Todas",
    companyName:"Nombre de empresa", industry:"Industria", website:"Sitio web",
    phone:"Teléfono", notes:"Notas", name:"Nombre", email:"Email",
    titleF:"Cargo / Título", linkedin:"LinkedIn", company:"Empresa",
    dealName:"Nombre del Deal", value:"Valor", stage:"Stage",
    contact:"Contacto", closingDate:"Fecha de cierre", selectOpt:"— Selecciona —",
    leadSource:"Cómo llegó", leadSourceCustom:"Origen custom",
    newUser:"Usuario", newUserTitle:"Nuevo usuario", editUser:"Editar usuario", noUsers:"No hay usuarios aún.",
    userAlias:"Alias", userEmail:"Correo", userName:"Nombre",
    importExport:"Importar / Exportar", importCSV:"Importar CSV", exportCSV:"Exportar CSV",
    downloadTemplate:"Descargar plantilla", importTitle:"Carga masiva",
    importDesc:"Sube un archivo CSV con el formato de la plantilla.",
    importSuccess:"registros importados correctamente.", importErrors:"filas con errores (omitidas):",
    importColError:"Columnas requeridas faltantes", dragDrop:"Arrastra tu CSV aquí o haz clic",
    processing:"Procesando...", close:"Cerrar", overwriteWarn:"Duplicados serán omitidos.",
    loading:"Cargando datos...", loadError:"Error al cargar datos. Usando datos de ejemplo.",
    saving:"Guardando...", saveError:"Error al guardar.",
    currency:"Moneda",
    pipelineEditor:"Editar Pipeline", addStage:"Agregar stage", stageName:"Nombre del stage",
    stageEmoji:"Emoji", stageWon:"Ganado", stageLost:"Perdido", stageDefault:"(por defecto)",
    moveUp:"Subir", moveDown:"Bajar", stageInUse:"Este stage tiene deals — no se puede eliminar.",
    resetPipeline:"Restablecer",
    confirmDelete:"Confirmar eliminación", deleteBtn:"Eliminar", deleteCascade:"Eliminar todo",
    deleteKeep:"Solo la empresa",
    confirmDeleteCompany:'¿Eliminar la empresa "{name}"?',
    confirmDeleteCompanyCascade:'Esta empresa tiene {contacts} contacto(s) y {deals} deal(s) asociados.',
    confirmDeleteCascadeOption:"¿Qué deseas hacer con los registros asociados?",
    cascadeDeleteAll:"Eliminar empresa, contactos y deals asociados",
    cascadeUnlink:"Eliminar empresa y desvincular contactos y deals",
    confirmDeleteContact:'¿Eliminar el contacto "{name}"?',
    confirmDeleteContactCascade:'Este contacto tiene {deals} deal(s) asociado(s). Se desvinculará de ellos.',
    confirmDeleteDeal:'¿Eliminar el deal "{name}"?',
    actionIrreversible:"Esta acción no se puede deshacer.",
    ph:{ companyName:"Ej. Acme Corp", industry:"Tecnología, Retail...", website:"empresa.com",
         phone:"+52 55 ...", name:"Nombre Completo", email:"correo@empresa.com",
         titleF:"CEO, Director...", linkedin:"linkedin.com/in/...", dealName:"Ej. Enterprise Deal" },
  },
  en: {
    appName:"CRM Intelsius México", pipeline:"Pipeline", companies:"Companies", contacts:"Contacts", usersTab:"Users",
    newDeal:"Deal", newCompany:"Company", newContact:"Contact",
    editDeal:"Edit Deal", newDealTitle:"New Deal",
    editCompany:"Edit Company", newCompanyTitle:"New Company",
    editContact:"Edit Contact", newContactTitle:"New Contact",
    search:"Search...", save:"Save", cancel:"Cancel",
    pipelineTotal:"Total Pipeline", closedWon:"Closed Won", totalDeals:"Total Deals",
    dealsW:"deals", contactsW:"contacts",
    noCompanies:"No companies yet.", noContacts:"No contacts yet.", noDeals:"No deals.",
    closing:"Close", meddic:"MEDDIC", meddicScore:"MEDDIC Score",
    meddicTotal:"Total Score", meddicMax:"/ 30",
    meddicHistory:"Evaluation history",
    meddicNewEval:"New evaluation",
    meddicSaveEval:"Save evaluation",
    meddicNotes:"Notes / evidence",
    meddicNotesPlaceholder:"What information supports this score?",
    meddicDate:"Date",
    meddicNoHistory:"No previous evaluations.",
    meddicSaved:"Evaluation saved successfully.",
    meddicDeleteEval:"Delete evaluation",
    meddicDeleteConfirm:"Are you sure you want to delete this evaluation?",
    viewDeal:"View deal",
    closeDeal:"Close",
    activities:"Activities",
    activityType:"Type",
    activityTitle:"Title",
    activityDueDate:"Due date",
    activityResponsible:"Owner",
    activityStatus:"Status",
    activityComment:"Comment",
    addActivity:"New activity",
    activityEdit:"Edit activity",
    activityUpdate:"Save changes",
    noActivities:"No activities yet.",
    pending:"Pending",
    inProgress:"In progress",
    done:"Done",
    blocked:"Blocked",
    call:"Call",
    meeting:"Meeting",
    task:"Task",
    note:"Note",
    emailType:"Email",
    dashboard:"Dashboard",
    overdue:"Overdue",
    dueSoon:"Due in 7 days",
    completedWeek:"Completed this week",
    all:"All",
    companyName:"Company name", industry:"Industry", website:"Website",
    phone:"Phone", notes:"Notes", name:"Name", email:"Email",
    titleF:"Title / Role", linkedin:"LinkedIn", company:"Company",
    dealName:"Deal name", value:"Value", stage:"Stage",
    contact:"Contact", closingDate:"Closing date", selectOpt:"— Select —",
    leadSource:"Lead source", leadSourceCustom:"Custom source",
    newUser:"User", newUserTitle:"New user", editUser:"Edit user", noUsers:"No users yet.",
    userAlias:"Alias", userEmail:"Email", userName:"Name",
    importExport:"Import / Export", importCSV:"Import CSV", exportCSV:"Export CSV",
    downloadTemplate:"Download template", importTitle:"Bulk import",
    importDesc:"Upload a CSV following the template format.",
    importSuccess:"records imported.", importErrors:"rows with errors (skipped):",
    importColError:"Missing required columns", dragDrop:"Drag CSV here or click to select",
    processing:"Processing...", close:"Close", overwriteWarn:"Duplicates will be skipped.",
    loading:"Loading data...", loadError:"Error loading data. Using sample data.",
    saving:"Saving...", saveError:"Error saving.",
    currency:"Currency",
    pipelineEditor:"Edit Pipeline", addStage:"Add stage", stageName:"Stage name",
    stageEmoji:"Emoji", stageWon:"Won", stageLost:"Lost", stageDefault:"(default)",
    moveUp:"Move up", moveDown:"Move down", stageInUse:"This stage has deals — cannot delete.",
    resetPipeline:"Reset",
    confirmDelete:"Confirm deletion", deleteBtn:"Delete", deleteCascade:"Delete all",
    deleteKeep:"Company only",
    confirmDeleteCompany:'Delete company "{name}"?',
    confirmDeleteCompanyCascade:'This company has {contacts} contact(s) and {deals} deal(s) linked.',
    confirmDeleteCascadeOption:"What would you like to do with associated records?",
    cascadeDeleteAll:"Delete company, contacts and associated deals",
    cascadeUnlink:"Delete company and unlink contacts and deals",
    confirmDeleteContact:'Delete contact "{name}"?',
    confirmDeleteContactCascade:'This contact has {deals} associated deal(s). They will be unlinked.',
    confirmDeleteDeal:'Delete deal "{name}"?',
    actionIrreversible:"This action cannot be undone.",
    ph:{ companyName:"e.g. Acme Corp", industry:"Technology, Retail...", website:"company.com",
         phone:"+1 555 ...", name:"Full Name", email:"name@company.com",
         titleF:"CEO, Director...", linkedin:"linkedin.com/in/...", dealName:"e.g. Enterprise Deal" },
  },
};

// ─── MEDDIC definitions ───────────────────────────────────────────────────────
const MEDDIC_KEYS = ["M","E","D","D2","I","C"];
const MEDDIC_META = {
  M:  { letter:"M", color:"#4a9eff", glow:"#4a9eff33",
        es:{ name:"Metrics",         desc:"Impacto económico cuantificable del deal" },
        en:{ name:"Metrics",         desc:"Quantifiable economic impact of the deal" } },
  E:  { letter:"E", color:"#34d399", glow:"#34d39933",
        es:{ name:"Economic Buyer",  desc:"Decisor con autoridad presupuestal" },
        en:{ name:"Economic Buyer",  desc:"Decision maker with budget authority" } },
  D:  { letter:"D", color:"#fbbf24", glow:"#fbbf2433",
        es:{ name:"Decision Criteria",desc:"Criterios técnicos y de negocio para elegir" },
        en:{ name:"Decision Criteria",desc:"Technical and business criteria for selection" } },
  D2: { letter:"D", color:"#f97316", glow:"#f9731633",
        es:{ name:"Decision Process", desc:"Proceso y pasos para tomar la decisión" },
        en:{ name:"Decision Process", desc:"Steps and process to reach a decision" } },
  I:  { letter:"I", color:"#c084fc", glow:"#c084fc33",
        es:{ name:"Identify Pain",   desc:"Dolor crítico del negocio que resolvemos" },
        en:{ name:"Identify Pain",   desc:"Critical business pain we are solving" } },
  C:  { letter:"C", color:"#22d3ee", glow:"#22d3ee33",
        es:{ name:"Champion",        desc:"Promotor interno con influencia y motivación" },
        en:{ name:"Champion",        desc:"Internal promoter with influence and motivation" } },
};

const emptyMeddic = () => Object.fromEntries(MEDDIC_KEYS.map(k=>[k,{score:0,notes:""}]));
const calcTotal   = (m) => m ? MEDDIC_KEYS.reduce((s,k)=>s+(Number(m[k]?.score)||0),0) : 0;

const scoreColor = (score, max=30) => {
  const pct = score/max;
  if (pct >= 0.8) return "#22c55e";
  if (pct >= 0.6) return "#fbbf24";
  if (pct >= 0.4) return "#f97316";
  return "#ef4444";
};

// ─── CSV helpers (using Papaparse for robust parsing) ─────────────────────────

const CO_COLS = ["name","industry","website","phone","notes"];
const CT_COLS = ["name","email","phone","titleF","linkedin","companyName","notes"];

function toCSV(rows, cols) {
  const data = rows.map(r => {
    const obj = {};
    cols.forEach(c => { obj[c] = r[c] ?? ""; });
    return obj;
  });
  return Papa.unparse(data, { columns: cols });
}

function parseCSV(text) {
  const result = Papa.parse(text.trim(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: h => h.trim(),
    transform: v => v.trim(),
  });
  return {
    headers: result.meta.fields || [],
    rows: result.data || [],
    errors: result.errors || [],
  };
}
function downloadBlob(content,filename){const blob=new Blob(["\uFEFF"+content],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);}

// ─── Constants ────────────────────────────────────────────────────────────────
// ─── Pipeline Stage System (configurable) ─────────────────────────────────────
const STAGE_PALETTE = [
  { bg:"#e8f4fc", border:"#a0c4e0", accent:"#003e7e" },
  { bg:"#e8f5ee", border:"#a0d4b8", accent:"#5e9732" },
  { bg:"#eef0fc", border:"#b0b8d8", accent:"#27aae1" },
  { bg:"#f3e8f5", border:"#c4a0d4", accent:"#7c2b83" },
  { bg:"#e6f6fa", border:"#90c4cc", accent:"#003e7e" },
  { bg:"#e8f0fc", border:"#a0b4d4", accent:"#27aae1" },
  { bg:"#eaf4e8", border:"#a0c8a0", accent:"#5e9732" },
  { bg:"#f3eaf5", border:"#c0a8d0", accent:"#7c2b83" },
];
const WON_STYLE  = { bg:"#eaf4e8", border:"#a0c8a0", accent:"#5e9732" };
const LOST_STYLE = { bg:"#fde8e8", border:"#d4a0a0", accent:"#ef4444" };

const DEFAULT_STAGES = [
  { id:"s1", name:"Prospecto",           emoji:"🔍", ...STAGE_PALETTE[0], isWon:false, isLost:false },
  { id:"s2", name:"Calificado",          emoji:"✅", ...STAGE_PALETTE[1], isWon:false, isLost:false },
  { id:"s3", name:"Propuesta",           emoji:"📄", ...STAGE_PALETTE[2], isWon:false, isLost:false },
  { id:"s4", name:"Negociación",         emoji:"🤝", ...STAGE_PALETTE[3], isWon:false, isLost:false },
  { id:"s5", name:"Muestras entregadas", emoji:"📦", ...STAGE_PALETTE[4], isWon:false, isLost:false },
  { id:"s6", name:"Cerrado Ganado",      emoji:"🏆", ...WON_STYLE,       isWon:true,  isLost:false },
  { id:"s7", name:"Cerrado Perdido",     emoji:"❌", ...LOST_STYLE,       isWon:false, isLost:true  },
];

// Helper: get style map from stages array (keyed by stage name for backward compat)
const stageStyle = (stages, stageName) => {
  const s = stages.find(st=>st.name===stageName);
  if(s) return s;
  // fallback for unknown stages
  return { bg:"#ffffff", border:"#c8d6e4", accent:"#5a6b7a", emoji:"❓", isWon:false, isLost:false };
};

// ─── Currency system ──────────────────────────────────────────────────────────
const CURRENCIES = [
  { code:"MXN", symbol:"$",  locale:"es-MX", label:"MXN — Peso mexicano" },
  { code:"USD", symbol:"$",  locale:"en-US", label:"USD — US Dollar" },
  { code:"EUR", symbol:"€",  locale:"de-DE", label:"EUR — Euro" },
  { code:"GBP", symbol:"£",  locale:"en-GB", label:"GBP — British Pound" },
  { code:"BRL", symbol:"R$", locale:"pt-BR", label:"BRL — Real brasileño" },
  { code:"COP", symbol:"$",  locale:"es-CO", label:"COP — Peso colombiano" },
  { code:"CLP", symbol:"$",  locale:"es-CL", label:"CLP — Peso chileno" },
  { code:"ARS", symbol:"$",  locale:"es-AR", label:"ARS — Peso argentino" },
  { code:"PEN", symbol:"S/", locale:"es-PE", label:"PEN — Sol peruano" },
  { code:"JPY", symbol:"¥",  locale:"ja-JP", label:"JPY — Japanese Yen" },
];
const fv = (n, currencyCode) => {
  const c = CURRENCIES.find(c=>c.code===currencyCode) || CURRENCIES[0];
  return new Intl.NumberFormat(c.locale,{style:"currency",currency:c.code,maximumFractionDigits:0}).format(Number(n)||0);
};

const today=()=>new Date().toISOString().slice(0,10);
const startOfWeek = (d=new Date()) => {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate()+diff);
  x.setHours(0,0,0,0);
  return x;
};
const ACTIVITY_TYPES = ["call","emailType","meeting","task","note"];
const ACTIVITY_STATUSES = ["pending","inProgress","done","blocked"];
const LEAD_SOURCES = ["LinkedIn","Email marketing","Referido","Llamada en frío","Custom"];

// ─── Storage helpers (Supabase with localStorage fallback) ────────────────────
const STORAGE_KEY = "crm5_data";
const uid = () => crypto.randomUUID();

// ---- Supabase helpers ----
async function supabaseLoad() {
  if (!supabase) return null;
  try {
    const [{ data: cos }, { data: cts }, { data: dls_raw }, { data: evals }, { data: stages_raw }, { data: users_raw }] = await Promise.all([
      supabase.from('companies').select('*').order('created_at'),
      supabase.from('contacts').select('*').order('created_at'),
      supabase.from('deals').select('*').order('created_at'),
      supabase.from('meddic_evals').select('*').order('date'),
      supabase.from('pipeline_stages').select('*').order('position'),
      supabase.from('crm_users').select('*').order('created_at'),
    ]);

    let activities = [];
    try {
      const { data } = await supabase.from('deal_activities').select('*').order('due_date');
      activities = data || [];
    } catch {}

    // Attach meddicHistory to each deal
    const dls = (dls_raw || []).map(d => ({
      ...d,
      value: Number(d.value),
      meddicHistory: (evals || [])
        .filter(e => e.deal_id === d.id)
        .map(e => ({ id: e.id, date: e.date, meddic: e.meddic })),
      activities: (activities || [])
        .filter(a => a.deal_id === d.id)
        .map(a => ({
          id: a.id,
          type: a.type,
          title: a.title,
          dueDate: a.due_date,
          responsible: a.responsible,
          status: a.status,
          comment: a.comment || "",
          createdAt: a.created_at,
        })),
    }));

    const stages = stages_raw && stages_raw.length > 0
      ? stages_raw.map(s => ({ id: s.id, name: s.name, emoji: s.emoji, bg: s.bg, border: s.border, accent: s.accent, isWon: s.is_won, isLost: s.is_lost }))
      : null;

    return { co: cos || [], ct: cts || [], dl: dls, stages, users: users_raw || [] };
  } catch (err) {
    console.error('Supabase load error:', err);
    return null;
  }
}

async function supabaseSaveAll({ cos, cts, dls, stages, users }) {
  if (!supabase) return false;
  try {
    // Upsert companies
    if (cos.length > 0) {
      await supabase.from('companies').upsert(
        cos.map(({ id, name, industry, website, phone, notes }) => ({ id, name, industry, website, phone, notes })),
        { onConflict: 'id' }
      );
    }
    // Upsert contacts
    if (cts.length > 0) {
      await supabase.from('contacts').upsert(
        cts.map(({ id, name, email, phone, titleF: title_f, linkedin, companyId: company_id, notes }) =>
          ({ id, name, email, phone, title_f, linkedin, company_id: company_id || null, notes })),
        { onConflict: 'id' }
      );
    }
    // Upsert deals (without meddicHistory)
    if (dls.length > 0) {
      await supabase.from('deals').upsert(
        dls.map(({ id, name, value, stage, companyId: company_id, contactId: contact_id, closingDate: closing_date, notes, leadSource: lead_source, leadSourceCustom: lead_source_custom }) =>
          ({ id, name, value, stage, company_id: company_id || null, contact_id: contact_id || null, closing_date, notes, lead_source, lead_source_custom })),
        { onConflict: 'id' }
      );
      // Upsert + sync deletes for MEDDIC evals
      const allEvals = dls.flatMap(d =>
        (d.meddicHistory || []).map(e => ({ id: e.id, deal_id: d.id, date: e.date, meddic: e.meddic }))
      );
      if (allEvals.length > 0) {
        await supabase.from('meddic_evals').upsert(allEvals, { onConflict: 'id' });
      }
      const { data: existingEvals } = await supabase.from('meddic_evals').select('id,deal_id');
      const validDealIds = new Set(dls.map(d=>d.id));
      const validEvalIds = new Set(allEvals.map(e=>e.id));
      const staleIds = (existingEvals || [])
        .filter(e => validDealIds.has(e.deal_id) && !validEvalIds.has(e.id))
        .map(e => e.id);
      if (staleIds.length > 0) {
        await supabase.from('meddic_evals').delete().in('id', staleIds);
      }

      // Upsert + sync deletes for deal activities (if table exists)
      try {
        const allActivities = dls.flatMap(d =>
          (d.activities || []).map(a => ({
            id: a.id,
            deal_id: d.id,
            type: a.type,
            title: a.title,
            due_date: a.dueDate || null,
            responsible: a.responsible || "",
            status: a.status || "pending",
            comment: a.comment || "",
          }))
        );
        if (allActivities.length > 0) {
          await supabase.from('deal_activities').upsert(allActivities, { onConflict: 'id' });
        }
        // NOTE: avoid auto-deleting "stale" activities from snapshots,
        // because concurrent tabs/sessions can cause accidental removals.
        // Activity deletes are handled explicitly when user clicks delete.
      } catch {}
    }
    // Upsert users (best-effort so it never blocks deal/contact saves)
    if ((users || []).length > 0) {
      try {
        await supabase.from('crm_users').upsert(
          users.map(({id,name,alias,email})=>({id,name,alias,email})),
          { onConflict: 'id' }
        );
      } catch (e) {
        console.warn('crm_users upsert skipped:', e?.message || e);
      }
    }

    // Upsert stages
    if (stages.length > 0) {
      await supabase.from('pipeline_stages').upsert(
        stages.map((s, i) => ({ id: s.id, name: s.name, emoji: s.emoji, bg: s.bg, border: s.border, accent: s.accent, is_won: s.isWon, is_lost: s.isLost, position: i })),
        { onConflict: 'id' }
      );
    }
    return true;
  } catch (err) {
    console.error('Supabase save error:', err);
    return false;
  }
}

// ---- Unified API ----
async function storageGet(fallback) {
  const sbData = await supabaseLoad();
  if (sbData) {
    return {
      co: sbData.co,
      ct: sbData.ct.map(c => ({ ...c, titleF: c.title_f, companyId: c.company_id })),
      dl: sbData.dl.map(d => ({ ...d, companyId: d.company_id, contactId: d.contact_id, closingDate: d.closing_date, leadSource: d.lead_source || "", leadSourceCustom: d.lead_source_custom || "" })),
      users: sbData.users || fallback.users,
      currency: fallback.currency || "USD",
      stages: sbData.stages || fallback.stages,
      __source: "supabase",
    };
  }

  // Safety-first: never auto-load sample/local data into the live app,
  // so we avoid accidental overwrites of real database content.
  return {
    co: [],
    ct: [],
    dl: [],
    users: fallback.users || [],
    currency: "USD",
    stages: fallback.stages || DEFAULT_STAGES,
    __source: "empty",
  };
}

async function storageSave(data) {
  const sbOk = await supabaseSaveAll({ cos: data.co, cts: data.ct, dls: data.dl, stages: data.stages, users: data.users || [] });
  return sbOk;
}

// ─── Sample data ──────────────────────────────────────────────────────────────
const SC=[{id:"sc1",name:"Acme Corp",industry:"Tecnología",website:"acme.com",phone:"+52 55 1234 5678",notes:"Cliente potencial grande"},{id:"sc2",name:"GlobalSoft",industry:"Software",website:"globalsoft.io",phone:"+52 55 9876 5432",notes:""}];
const SCT=[{id:"sct1",name:"Ana García",email:"ana@acme.com",phone:"+52 55 1111 2222",titleF:"CEO",linkedin:"linkedin.com/in/anagarcia",companyId:"sc1",notes:""},{id:"sct2",name:"Carlos López",email:"carlos@globalsoft.io",phone:"+52 55 3333 4444",titleF:"CTO",linkedin:"",companyId:"sc2",notes:""}];
const SDL=[
  {id:"sd1",name:"Implementación Enterprise",value:120000,stage:"Propuesta",companyId:"sc1",contactId:"sct1",closingDate:"2026-06-30",notes:"Requiere demo técnica",
   meddicHistory:[{id:"h1",date:"2026-03-01",meddic:{M:{score:4,notes:"ROI estimado 3x en 18 meses"},E:{score:3,notes:"Acceso parcial al CFO"},D:{score:3,notes:"Criterio principal: integración con SAP"},D2:{score:2,notes:"Proceso no documentado aún"},I:{score:4,notes:"Problema de eficiencia operativa crítico"},C:{score:3,notes:"Ana García apoya internamente"}}}]},
  {id:"sd2",name:"Licencia Anual",value:45000,stage:"Calificado",companyId:"sc2",contactId:"sct2",closingDate:"2026-05-15",notes:"",meddicHistory:[]},
  {id:"sd3",name:"Consultoría + Muestras",value:18000,stage:"Muestras entregadas",companyId:"sc1",contactId:"sct1",closingDate:"2026-07-01",notes:"Muestras enviadas el 10 mar",meddicHistory:[]},
];
const SAMPLE_USERS = [{id:"u1",name:"Edu",alias:"Edu",email:"eduardo.bolanos@intelsius.com"}];
const SAMPLE_DATA = { co: SC, ct: SCT, dl: SDL, users: SAMPLE_USERS, currency: "USD", stages: DEFAULT_STAGES };

// ─── CRM Data Context & Reducer ───────────────────────────────────────────────
const CRMContext = createContext(null);
const useCRM = () => useContext(CRMContext);

const initialDataState = { cos:[], cts:[], dls:[], users:[], currency:"USD", stages:DEFAULT_STAGES };

function crmReducer(state, action) {
  switch(action.type) {
    case "LOAD":       return { ...state, ...action.payload };
    case "SET_COS":    return { ...state, cos: typeof action.payload==="function"?action.payload(state.cos):action.payload };
    case "SET_CTS":    return { ...state, cts: typeof action.payload==="function"?action.payload(state.cts):action.payload };
    case "SET_DLS":    return { ...state, dls: typeof action.payload==="function"?action.payload(state.dls):action.payload };
    case "SET_USERS":  return { ...state, users: typeof action.payload==="function"?action.payload(state.users):action.payload };
    case "SET_CURRENCY": return { ...state, currency: action.payload };
    case "SET_STAGES": return { ...state, stages: action.payload };
    default: return state;
  }
}

function CRMProvider({ children }) {
  const [data, dispatch] = useReducer(crmReducer, initialDataState);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");
  const initialLoadDone = useRef(false);
  const canAutoSave = useRef(true);
  const saveQueue = useRef(Promise.resolve());

  // Load
  useEffect(()=>{
    let cancelled = false;
    (async()=>{
      const loaded = await storageGet(SAMPLE_DATA);
      if(!cancelled){
        // Save is allowed only when initial load came from Supabase.
        canAutoSave.current = loaded.__source === "supabase";
        dispatch({ type:"LOAD", payload:{ cos:loaded.co, cts:loaded.ct, dls:loaded.dl, users:loaded.users||[], currency:loaded.currency||"USD", stages:loaded.stages||DEFAULT_STAGES }});
        setLoading(false);
        setTimeout(()=>{ initialLoadDone.current = true; }, 50);
      }
    })();
    return ()=>{ cancelled = true; };
  },[]);

  // Immediate queued save (no debounce): saves right away while serializing writes.
  useEffect(()=>{
    if(!initialLoadDone.current) return;
    if(!canAutoSave.current) {
      setSaveStatus("error");
      return;
    }

    saveQueue.current = saveQueue.current.then(async()=>{
      setSaveStatus("saving");
      const ok = await storageSave({ co:data.cos, ct:data.cts, dl:data.dls, users:data.users, currency:data.currency, stages:data.stages });
      setSaveStatus(ok?"saved":"error");
      setTimeout(()=>setSaveStatus("idle"), 1000);
    }).catch(()=>setSaveStatus("error"));
  },[data]);

  const ctx = useMemo(()=>({
    ...data, dispatch, loading, saveStatus,
    // Convenience setters
    setCos: p => dispatch({type:"SET_COS",payload:p}),
    setCts: p => dispatch({type:"SET_CTS",payload:p}),
    setDls: p => dispatch({type:"SET_DLS",payload:p}),
    setUsers: p => dispatch({type:"SET_USERS",payload:p}),
    setCurrency: v => dispatch({type:"SET_CURRENCY",payload:v}),
    setStages: v => dispatch({type:"SET_STAGES",payload:v}),
  }),[data, loading, saveStatus]);

  return <CRMContext.Provider value={ctx}>{children}</CRMContext.Provider>;
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic = ({n,s=15})=>{
  const p={stroke:"currentColor",strokeWidth:"1.8",fill:"none",width:s,height:s,viewBox:"0 0 24 24"};
  const icons={
    building:<svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>,
    users:<svg {...p}><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87"/></svg>,
    layers:<svg {...p}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
    plus:<svg {...p} strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    edit:<svg {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    trash:<svg {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
    x:<svg {...p} strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    search:<svg {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    link:<svg {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    globe:<svg {...p}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    upload:<svg {...p}><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
    download:<svg {...p}><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>,
    template:<svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
    check:<svg {...p} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    alert:<svg {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    chevDown:<svg {...p} strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>,
    chevUp:<svg {...p} strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>,
    star:<svg {...p} fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
    history:<svg {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    meddic:<svg {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    arrowRight:<svg {...p} strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  };
  return icons[n]||null;
};

// ─── Primitives ───────────────────────────────────────────────────────────────
const iSx={width:"100%",background:"#f0f4f8",border:"1px solid #c8d6e4",borderRadius:8,padding:"8px 11px",color:"#1a2a3a",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
const Lbl=({ch})=><label style={{display:"block",fontSize:10,color:"#6b7d8e",marginBottom:4,letterSpacing:.8,textTransform:"uppercase",fontFamily:"'JetBrains Mono',monospace"}}>{ch}</label>;
const Fld=({label,children})=><div style={{marginBottom:12}}>{label&&<Lbl ch={label}/>}{children}</div>;
const Inp=({label,...p})=><Fld label={label}><input {...p} style={{...iSx,...p.style}}/></Fld>;
const Txta=({label,...p})=><Fld label={label}><textarea {...p} rows={p.rows||3} style={{...iSx,resize:"vertical"}}/></Fld>;
const Sel=({label,opts,...p})=><Fld label={label}><select {...p} style={{...iSx}}>{opts.map(o=><option key={o.v??o} value={o.v??o}>{o.l??o}</option>)}</select></Fld>;
const Btn=({ch,onClick,v="primary",sx={},disabled=false})=>{
  const vs={primary:{background:"#003e7e",color:"#fff",border:"none"},ghost:{background:"transparent",color:"#5a6b7a",border:"1px solid #c8d6e4"},subtle:{background:"#c8d6e4",color:"#4a5a6a",border:"1px solid #8ea4b8"},success:{background:"#16a34a22",color:"#22c55e",border:"1px solid #16a34a44"}};
  return <button onClick={onClick} disabled={disabled} style={{...vs[v],borderRadius:8,padding:"7px 14px",fontSize:12,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:5,opacity:disabled?.5:1,transition:"opacity .12s, background .12s",...sx}}>{ch}</button>;
};

// ─── Loading Screen ───────────────────────────────────────────────────────────
function LoadingScreen({lang}){
  const t = T[lang] || T.es;
  return(
    <div style={{minHeight:"100vh",background:"#f0f4f8",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20}}>
      <div style={{width:48,height:48,background:"linear-gradient(135deg,#003e7e,#27aae1)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:"#fff",animation:"pulse 1.5s ease-in-out infinite"}}>◆</div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
        <span style={{fontSize:16,fontFamily:"'DM Sans',Arial,sans-serif",color:"#1a2a3a"}}>{t.appName}</span>
        <span style={{fontSize:12,color:"#6b7d8e",fontFamily:"'JetBrains Mono',monospace"}}>{t.loading}</span>
      </div>
      <div style={{width:140,height:3,background:"#c8d6e4",borderRadius:3,overflow:"hidden"}}>
        <div style={{width:"40%",height:"100%",background:"linear-gradient(90deg,#003e7e,#27aae1)",borderRadius:3,animation:"loadbar 1.2s ease-in-out infinite"}}/>
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1;} 50%{transform:scale(1.08);opacity:.85;} }
        @keyframes loadbar { 0%{transform:translateX(-100%);} 100%{transform:translateX(350%);} }
      `}</style>
    </div>
  );
}

// ─── Save Status Indicator ────────────────────────────────────────────────────
function SaveIndicator({status}){
  if(status==="idle") return null;
  const styles = {
    saving: { color:"#6b7d8e", text:"..." },
    saved:  { color:"#22c55e", text:"✓" },
    error:  { color:"#ef4444", text:"!" },
  };
  const s = styles[status] || styles.saving;
  return(
    <span style={{fontSize:10,color:s.color,fontFamily:"'JetBrains Mono',monospace",display:"inline-flex",alignItems:"center",gap:3,padding:"2px 8px",background:s.color+"15",borderRadius:5,transition:"all .2s"}}>
      {s.text}
    </span>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({title,onClose,children,wide=false,extraWide=false}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,40,80,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,backdropFilter:"blur(8px)"}}>
      <div style={{background:"#ffffff",border:"1px solid #c8d6e4",borderRadius:16,width:extraWide?"min(900px,98vw)":wide?"min(680px,97vw)":"min(490px,96vw)",maxHeight:"94vh",overflowY:"auto",padding:24,boxShadow:"0 16px 48px rgba(0,62,126,.12)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h3 style={{margin:0,color:"#1a2a3a",fontFamily:"'DM Sans',Arial,sans-serif",fontSize:18}}>{title}</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#6b7d8e",cursor:"pointer",padding:3}}><Ic n="x"/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────
function ConfirmDeleteModal({config, t, onClose}){
  if(!config) return null;
  const {type, name, associatedContacts=0, associatedDeals=0, onDelete, onCascadeDelete, onUnlinkDelete} = config;
  const hasCascade = type==="company" && (associatedContacts>0 || associatedDeals>0);
  const hasContactDeals = type==="contact" && associatedDeals>0;

  const msg = type==="company"
    ? t.confirmDeleteCompany.replace("{name}",name)
    : type==="contact"
    ? t.confirmDeleteContact.replace("{name}",name)
    : t.confirmDeleteDeal.replace("{name}",name);

  const cascadeMsg = type==="company"
    ? t.confirmDeleteCompanyCascade.replace("{contacts}",associatedContacts).replace("{deals}",associatedDeals)
    : type==="contact"
    ? t.confirmDeleteContactCascade.replace("{deals}",associatedDeals)
    : "";

  const dangerBtn = {background:"#dc2626",color:"#fff",border:"none"};
  const warningBtn = {background:"#dc262622",color:"#ef4444",border:"1px solid #dc262644"};

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,40,80,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1001,backdropFilter:"blur(8px)"}}>
      <div style={{background:"#ffffff",border:"1px solid #d4a0a0",borderRadius:16,width:"min(440px,94vw)",padding:24,boxShadow:"0 16px 48px rgba(0,62,126,.12)"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <div style={{width:36,height:36,borderRadius:9,background:"#fde8e8",border:"1px solid #d4a0a0",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444",flexShrink:0}}>
            <Ic n="alert" s={18}/>
          </div>
          <h3 style={{margin:0,color:"#1a2a3a",fontFamily:"'DM Sans',Arial,sans-serif",fontSize:16}}>{t.confirmDelete}</h3>
        </div>

        {/* Message */}
        <div style={{background:"#fde8e8",border:"1px solid #d4a0a055",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:13,color:"#1a2a3a",lineHeight:1.6,marginBottom:6}}>{msg}</div>
          {(hasCascade||hasContactDeals) && (
            <div style={{fontSize:12,color:"#f97316",lineHeight:1.5,marginTop:6,padding:"8px 10px",background:"#f9731608",borderRadius:7,border:"1px solid #f9731622"}}>
              {cascadeMsg}
            </div>
          )}
          <div style={{fontSize:11,color:"#5a6b7a",marginTop:8,fontFamily:"'JetBrains Mono',monospace"}}>{t.actionIrreversible}</div>
        </div>

        {/* Actions */}
        {hasCascade ? (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{fontSize:11,color:"#5a6b7a",marginBottom:2}}>{t.confirmDeleteCascadeOption}</div>
            <button onClick={()=>{onCascadeDelete();onClose();}}
              style={{...dangerBtn,borderRadius:8,padding:"9px 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,width:"100%"}}>
              <Ic n="trash" s={13}/>{t.cascadeDeleteAll}
            </button>
            <button onClick={()=>{onUnlinkDelete();onClose();}}
              style={{...warningBtn,borderRadius:8,padding:"9px 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,width:"100%"}}>
              <Ic n="link" s={13}/>{t.cascadeUnlink}
            </button>
            <button onClick={onClose}
              style={{background:"transparent",color:"#5a6b7a",border:"1px solid #c8d6e4",borderRadius:8,padding:"9px 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit",width:"100%"}}>
              {t.cancel}
            </button>
          </div>
        ) : (
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn v="ghost" ch={t.cancel} onClick={onClose}/>
            <button onClick={()=>{onDelete();onClose();}}
              style={{...dangerBtn,borderRadius:8,padding:"7px 16px",fontSize:12,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:5}}>
              <Ic n="trash" s={12}/>{t.deleteBtn}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pipeline Editor Modal ────────────────────────────────────────────────────
function PipelineEditor({stages, dls, t, onSave, onClose}){
  const [draft, setDraft] = useState(()=>JSON.parse(JSON.stringify(stages)));
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  const dealsPerStage = (name) => dls.filter(d=>d.name && d.stage===name).length;

  const update = (idx, key, val) => setDraft(p=>p.map((s,i)=>i===idx?{...s,[key]:val}:s));

  const addStage = () => {
    const pi = draft.filter(s=>!s.isWon&&!s.isLost).length;
    const pal = STAGE_PALETTE[pi % STAGE_PALETTE.length];
    const newStage = { id:uid(), name:"", emoji:"📋", ...pal, isWon:false, isLost:false };
    // Insert before the won/lost stages
    const wonLostIdx = draft.findIndex(s=>s.isWon||s.isLost);
    if(wonLostIdx===-1) setDraft(p=>[...p, newStage]);
    else setDraft(p=>[...p.slice(0,wonLostIdx), newStage, ...p.slice(wonLostIdx)]);
  };

  const remove = (idx) => setDraft(p=>p.filter((_,i)=>i!==idx));

  const move = (from, to) => {
    if(to<0||to>=draft.length) return;
    setDraft(p=>{
      const arr=[...p];
      const [item]=arr.splice(from,1);
      arr.splice(to,0,item);
      return arr;
    });
  };

  const handleDrop = (toIdx) => {
    if(dragIdx===null||dragIdx===toIdx) return;
    move(dragIdx, toIdx);
    setDragIdx(null);
    setOverIdx(null);
  };

  const setWon = (idx) => setDraft(p=>p.map((s,i)=>({...s, isWon:i===idx, ...(i===idx?WON_STYLE:s.isWon?STAGE_PALETTE[0]:{})})));
  const setLost = (idx) => setDraft(p=>p.map((s,i)=>({...s, isLost:i===idx, ...(i===idx?LOST_STYLE:s.isLost?STAGE_PALETTE[1]:{})})));

  const valid = draft.length>=2 && draft.every(s=>s.name.trim()) && draft.some(s=>s.isWon) && draft.some(s=>s.isLost);

  return(
    <Modal title={t.pipelineEditor} onClose={onClose} wide>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
        {draft.map((stage,i)=>{
          const count = dealsPerStage(stage.name);
          const canDel = count===0 && !stage.isWon && !stage.isLost;
          const isOver = overIdx===i;
          return(
            <div key={stage.id}
              draggable
              onDragStart={()=>setDragIdx(i)}
              onDragEnd={()=>{setDragIdx(null);setOverIdx(null);}}
              onDragOver={e=>{e.preventDefault();setOverIdx(i);}}
              onDragLeave={()=>setOverIdx(null)}
              onDrop={e=>{e.preventDefault();handleDrop(i);}}
              style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:isOver?stage.accent+"15":stage.bg,border:`1px solid ${isOver?stage.accent:stage.border}`,borderRadius:10,cursor:"grab",transition:"all .12s",opacity:dragIdx===i?.4:1}}>
              {/* Drag handle & order */}
              <div style={{display:"flex",flexDirection:"column",gap:2,color:"#8ea4b8",flexShrink:0,cursor:"grab"}}>
                <button onClick={()=>move(i,i-1)} disabled={i===0} style={{background:"none",border:"none",color:"#6b7d8e",cursor:i===0?"default":"pointer",padding:0,fontSize:10,opacity:i===0?.3:1}}><Ic n="chevUp" s={10}/></button>
                <button onClick={()=>move(i,i+1)} disabled={i===draft.length-1} style={{background:"none",border:"none",color:"#6b7d8e",cursor:i===draft.length-1?"default":"pointer",padding:0,fontSize:10,opacity:i===draft.length-1?.3:1}}><Ic n="chevDown" s={10}/></button>
              </div>
              {/* Emoji input */}
              <input value={stage.emoji} onChange={e=>update(i,"emoji",e.target.value)}
                style={{width:32,background:"transparent",border:"1px solid #c8d6e4",borderRadius:6,textAlign:"center",fontSize:16,padding:"2px 0",color:"#1a2a3a",outline:"none"}}/>
              {/* Name input */}
              <input value={stage.name} onChange={e=>update(i,"name",e.target.value)}
                placeholder={t.stageName}
                style={{flex:1,background:"#f0f4f8",border:"1px solid #c8d6e4",borderRadius:6,padding:"6px 9px",color:"#1a2a3a",fontSize:12,fontFamily:"inherit",outline:"none",minWidth:0}}/>
              {/* Won/Lost toggles */}
              <button onClick={()=>setWon(i)}
                style={{background:stage.isWon?"#22c55e22":"transparent",border:`1px solid ${stage.isWon?"#22c55e44":"#c8d6e4"}`,borderRadius:6,padding:"3px 8px",fontSize:10,color:stage.isWon?"#22c55e":"#6b7d8e",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap"}}>
                {t.stageWon}
              </button>
              <button onClick={()=>setLost(i)}
                style={{background:stage.isLost?"#ef444422":"transparent",border:`1px solid ${stage.isLost?"#ef444444":"#c8d6e4"}`,borderRadius:6,padding:"3px 8px",fontSize:10,color:stage.isLost?"#ef4444":"#6b7d8e",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap"}}>
                {t.stageLost}
              </button>
              {/* Deal count badge */}
              {count>0&&<span style={{fontSize:9,color:"#5a6b7a",background:"#f0f4f8",borderRadius:4,padding:"2px 6px",fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>{count} deals</span>}
              {/* Delete */}
              <button onClick={()=>canDel&&remove(i)} title={!canDel?t.stageInUse:""}
                style={{background:"none",border:"none",color:canDel?"#ef4444":"#c8d6e4",cursor:canDel?"pointer":"not-allowed",padding:2,opacity:canDel?.7:.3,flexShrink:0}}>
                <Ic n="trash" s={12}/>
              </button>
            </div>
          );
        })}
      </div>

      {/* Add stage & actions */}
      <div style={{display:"flex",gap:8,justifyContent:"space-between",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:8}}>
          <Btn v="subtle" ch={<><Ic n="plus" s={12}/>{t.addStage}</>} onClick={addStage}/>
          <Btn v="ghost" ch={t.resetPipeline} onClick={()=>setDraft(JSON.parse(JSON.stringify(DEFAULT_STAGES)))}/>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn v="ghost" ch={t.cancel} onClick={onClose}/>
          <Btn ch={t.save} disabled={!valid} onClick={()=>{onSave(draft);onClose();}}/>
        </div>
      </div>

      {!valid && (
        <div style={{marginTop:10,fontSize:11,color:"#f97316",fontFamily:"'JetBrains Mono',monospace"}}>
          {draft.some(s=>!s.name.trim()) && "• Todos los stages necesitan nombre. "}
          {!draft.some(s=>s.isWon) && "• Marca un stage como Ganado. "}
          {!draft.some(s=>s.isLost) && "• Marca un stage como Perdido."}
        </div>
      )}
    </Modal>
  );
}

// ─── MEDDIC Score Ring ────────────────────────────────────────────────────────
function ScoreRing({score,max=30,size=48,strokeW=4}){
  const r=(size-strokeW*2)/2;
  const circ=2*Math.PI*r;
  const pct=score/max;
  const c=scoreColor(score,max);
  return(
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#c8d6e4" strokeWidth={strokeW}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={strokeW}
        strokeDasharray={`${circ*pct} ${circ*(1-pct)}`} strokeLinecap="round"
        style={{transition:"stroke-dasharray .4s ease"}}/>
      <text x={size/2} y={size/2} dominantBaseline="middle" textAnchor="middle"
        style={{transform:"rotate(90deg)",transformOrigin:`${size/2}px ${size/2}px`,fill:c,fontSize:size<40?9:11,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>
        {score}
      </text>
    </svg>
  );
}

// ─── Score bar (0-5) ──────────────────────────────────────────────────────────
function ScoreBar({value, onChange, color}){
  return(
    <div style={{display:"flex",gap:4,alignItems:"center"}}>
      {[1,2,3,4,5].map(i=>(
        <button key={i} onClick={()=>onChange(value===i?0:i)}
          style={{width:26,height:26,borderRadius:6,border:`1px solid ${i<=value?color:"#c8d6e4"}`,
            background:i<=value?color+"33":"transparent",color:i<=value?color:"#8ea4b8",
            cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",
            transition:"all .12s",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {i}
        </button>
      ))}
      <span style={{fontSize:10,color:"#6b7d8e",marginLeft:4,fontFamily:"'JetBrains Mono',monospace"}}>{value}/5</span>
    </div>
  );
}

// ─── MEDDIC Panel ─────────────────────────────────────────────────────────────
function MeddicPanel({deal, lang, t, onSaveEval, onDeleteEval}){
  const latest = deal.meddicHistory?.slice(-1)[0] || null;
  const [draft, setDraft] = useState(()=>({
    date: today(),
    meddic: latest ? JSON.parse(JSON.stringify(latest.meddic)) : emptyMeddic(),
  }));
  const [showHistory, setShowHistory] = useState(false);
  const [expandedKey, setExpandedKey] = useState(null);
  const [saveNotice, setSaveNotice] = useState(false);

  const total = calcTotal(draft.meddic);
  const prevTotal = latest ? calcTotal(latest.meddic) : null;
  const delta = prevTotal !== null ? total - prevTotal : null;

  const setScore = (k,v) => setDraft(p=>({...p, meddic:{...p.meddic,[k]:{...p.meddic[k],score:v}}}));
  const setNotes = (k,v) => setDraft(p=>({...p, meddic:{...p.meddic,[k]:{...p.meddic[k],notes:v}}}));

  const handleSave = () => {
    onSaveEval({ id:uid(), date:draft.date, meddic:draft.meddic });
    setSaveNotice(true);
    setTimeout(()=>setSaveNotice(false), 1800);
  };

  return(
    <div>
      {/* Header with total */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <ScoreRing score={total} size={54}/>
          <div>
            <div style={{fontSize:11,color:"#6b7d8e",fontFamily:"'JetBrains Mono',monospace",letterSpacing:.8,textTransform:"uppercase",marginBottom:2}}>{t.meddicTotal}</div>
            <div style={{display:"flex",alignItems:"baseline",gap:6}}>
              <span style={{fontSize:24,fontWeight:700,color:scoreColor(total),fontFamily:"'DM Sans',Arial,sans-serif"}}>{total}</span>
              <span style={{fontSize:13,color:"#6b7d8e",fontFamily:"'JetBrains Mono',monospace"}}>{t.meddicMax}</span>
              {delta!==null && delta!==0 && (
                <span style={{fontSize:11,color:delta>0?"#22c55e":"#ef4444",background:delta>0?"#08240e":"#fde8e8",borderRadius:5,padding:"1px 7px",fontFamily:"'JetBrains Mono',monospace"}}>
                  {delta>0?"+":""}{delta} vs prev
                </span>
              )}
            </div>
          </div>
        </div>
        <button onClick={()=>setShowHistory(p=>!p)}
          style={{background:"#c8d6e4",border:"1px solid #8ea4b8",borderRadius:8,padding:"6px 12px",color:"#4a5a6a",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontFamily:"'JetBrains Mono',monospace"}}>
          <Ic n="history" s={12}/>{t.meddicHistory} ({deal.meddicHistory?.length||0})
        </button>
      </div>

      {/* Progress bar overall */}
      <div style={{height:4,background:"#c8d6e4",borderRadius:4,marginBottom:20,overflow:"hidden"}}>
        <div style={{height:"100%",background:`linear-gradient(90deg,#003e7e,${scoreColor(total)})`,width:`${(total/30)*100}%`,borderRadius:4,transition:"width .4s ease"}}/>
      </div>

      {/* MEDDIC rows */}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {MEDDIC_KEYS.map(k=>{
          const meta = MEDDIC_META[k];
          const info = meta[lang] || meta.es;
          const val  = draft.meddic[k] || {score:0,notes:""};
          const isExp = expandedKey === k;
          return(
            <div key={k} style={{background:"#f0f4f8",border:`1px solid ${isExp?meta.color+"55":"#c8d6e4"}`,borderRadius:11,overflow:"hidden",transition:"border-color .15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",cursor:"pointer"}}
                onClick={()=>setExpandedKey(isExp?null:k)}>
                <div style={{width:32,height:32,borderRadius:8,background:meta.color+"22",border:`1px solid ${meta.color}44`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:14,fontWeight:700,color:meta.color,fontFamily:"'DM Sans',Arial,sans-serif"}}>{meta.letter}</span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <span style={{fontSize:12,fontWeight:600,color:"#1a2a3a"}}>{info.name}</span>
                    {val.notes && <span style={{fontSize:9,color:"#6b7d8e",fontFamily:"'JetBrains Mono',monospace",background:"#c8d6e4",borderRadius:4,padding:"1px 5px"}}>nota</span>}
                  </div>
                  <div style={{fontSize:10,color:"#6b7d8e",lineHeight:1.4}}>{info.desc}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                  <div style={{display:"flex",gap:2}}>
                    {[1,2,3,4,5].map(i=>(
                      <div key={i} style={{width:6,height:16,borderRadius:2,background:i<=val.score?meta.color:"#c8d6e4",transition:"background .12s"}}/>
                    ))}
                  </div>
                  <span style={{fontSize:11,fontWeight:700,color:meta.color,fontFamily:"'JetBrains Mono',monospace",minWidth:14,textAlign:"right"}}>{val.score}</span>
                  <span style={{color:"#8ea4b8",marginLeft:2}}><Ic n={isExp?"chevUp":"chevDown"} s={12}/></span>
                </div>
              </div>

              {isExp && (
                <div style={{borderTop:`1px solid ${meta.color}22`,padding:"12px 14px 14px",background:meta.color+"08"}}>
                  <div style={{marginBottom:12}}>
                    <Lbl ch="Score"/>
                    <ScoreBar value={val.score} onChange={v=>setScore(k,v)} color={meta.color}/>
                  </div>
                  <Fld label={t.meddicNotes}>
                    <textarea value={val.notes} onChange={e=>setNotes(k,e.target.value)}
                      rows={3} placeholder={t.meddicNotesPlaceholder}
                      style={{...iSx,borderColor:meta.color+"33",resize:"vertical"}}/>
                  </Fld>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save evaluation */}
      <div style={{display:"flex",gap:10,alignItems:"center",marginTop:16,paddingTop:14,borderTop:"1px solid #c8d6e4"}}>
        <Fld label={t.meddicDate} style={{margin:0}}>
          <input type="date" value={draft.date} onChange={e=>setDraft(p=>({...p,date:e.target.value}))}
            style={{...iSx,width:150}}/>
        </Fld>
        <div style={{flexGrow:1}}/>
        <Btn ch={<><Ic n="check" s={12}/>{t.meddicSaveEval}</>} v="success" onClick={handleSave}/>
      </div>
      {saveNotice && (
        <div style={{marginTop:8,fontSize:11,color:"#22c55e",fontFamily:"'JetBrains Mono',monospace",display:"flex",alignItems:"center",gap:6}}>
          <Ic n="check" s={11}/>{t.meddicSaved}
        </div>
      )}

      {/* History */}
      {showHistory && (
        <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid #c8d6e4"}}>
          <div style={{fontSize:12,fontWeight:600,color:"#4a5a6a",marginBottom:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:.5}}>{t.meddicHistory}</div>
          {(!deal.meddicHistory || deal.meddicHistory.length===0) && (
            <div style={{fontSize:11,color:"#8ea4b8",fontFamily:"'JetBrains Mono',monospace"}}>{t.meddicNoHistory}</div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[...(deal.meddicHistory||[])].reverse().map((ev,i)=>{
              const tot=calcTotal(ev.meddic);
              const prev=[...(deal.meddicHistory||[])].reverse()[i+1];
              const prevTot=prev?calcTotal(prev.meddic):null;
              const d=prevTot!==null?tot-prevTot:null;
              return(
                <div key={ev.id} style={{background:"#f0f4f8",border:"1px solid #c8d6e4",borderRadius:10,padding:"10px 12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{fontSize:11,color:"#5a6b7a",fontFamily:"'JetBrains Mono',monospace"}}>{ev.date}</span>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {d!==null&&d!==0&&<span style={{fontSize:10,color:d>0?"#22c55e":"#ef4444",fontFamily:"'JetBrains Mono',monospace"}}>{d>0?"+":""}{d}</span>}
                      <ScoreRing score={tot} size={36} strokeW={3}/>
                      <button
                        title={t.meddicDeleteEval}
                        onClick={()=>{ if(window.confirm(t.meddicDeleteConfirm)){ onDeleteEval(ev.id); } }}
                        style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",padding:2,opacity:.75}}
                      >
                        <Ic n="trash" s={12}/>
                      </button>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {MEDDIC_KEYS.map(k=>{
                      const meta=MEDDIC_META[k];
                      const s=ev.meddic[k]?.score||0;
                      return(
                        <div key={k} style={{display:"flex",alignItems:"center",gap:4,background:"#ffffff",border:"1px solid #c8d6e4",borderRadius:6,padding:"3px 8px"}}>
                          <span style={{fontSize:10,fontWeight:700,color:meta.color,fontFamily:"'DM Sans',Arial,sans-serif"}}>{meta.letter}</span>
                          <span style={{fontSize:10,color:meta.color,fontFamily:"'JetBrains Mono',monospace"}}>{s}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:3}}>
                    {MEDDIC_KEYS.filter(k=>ev.meddic[k]?.notes).map(k=>{
                      const meta=MEDDIC_META[k];
                      const info=meta[lang]||meta.es;
                      return(
                        <div key={k} style={{fontSize:10,color:"#5a6b7a",lineHeight:1.4}}>
                          <span style={{color:meta.color,fontWeight:600}}>{info.name}: </span>
                          {ev.meddic[k].notes}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivitiesPanel({deal,t,users,onAddActivity,onDeleteActivity,onUpdateActivityStatus,onUpdateActivity}){
  const emptyForm = { type:"task", title:"", dueDate:today(), responsible:"", status:"pending", comment:"" };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  const typeOpts = ACTIVITY_TYPES.map(v=>({v,l:t[v]}));
  const statusOpts = ACTIVITY_STATUSES.map(v=>({v,l:t[v]}));

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const handleSave = () => {
    if(!form.title?.trim()) return;
    if(editingId){
      onUpdateActivity(editingId, {...form, title: form.title.trim()});
      resetForm();
      return;
    }
    onAddActivity({ id: uid(), ...form, title: form.title.trim(), createdAt: new Date().toISOString() });
    setForm(p=>({...p,title:"",comment:"",status:"pending"}));
  };

  const startEdit = (a) => {
    setEditingId(a.id);
    setForm({
      type:a.type||"task",
      title:a.title||"",
      dueDate:a.dueDate||today(),
      responsible:a.responsible||"",
      status:a.status||"pending",
      comment:a.comment||"",
    });
  };

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:8,marginBottom:10}}>
        <Sel label={t.activityType} value={form.type} onChange={e=>setF("type",e.target.value)} opts={typeOpts}/>
        <Inp label={t.activityTitle+" *"} value={form.title} onChange={e=>setF("title",e.target.value)} />
        <Inp label={t.activityDueDate} type="date" value={form.dueDate} onChange={e=>setF("dueDate",e.target.value)} />
        <Sel label={t.activityResponsible} value={form.responsible} onChange={e=>setF("responsible",e.target.value)} opts={[{v:"",l:t.selectOpt},...(users||[]).map(u=>({v:u.alias||u.name,l:`${u.alias||u.name} (${u.name})`}))]} />
        <Sel label={t.activityStatus} value={form.status} onChange={e=>setF("status",e.target.value)} opts={statusOpts}/>
      </div>
      <Txta label={t.activityComment} value={form.comment} onChange={e=>setF("comment",e.target.value)} />
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
        {editingId && <Btn v="ghost" ch={t.cancel} onClick={resetForm}/>}        
        <Btn ch={<><Ic n={editingId?"check":"plus"} s={12}/>{editingId?t.activityUpdate:t.addActivity}</>} onClick={handleSave}/>
      </div>

      <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:8}}>
        {(!(deal.activities||[]).length) && (
          <div style={{fontSize:11,color:"#8ea4b8",fontFamily:"'JetBrains Mono',monospace"}}>{t.noActivities}</div>
        )}
        {[...(deal.activities||[])].sort((a,b)=>(a.dueDate||"").localeCompare(b.dueDate||"")).map(a=>(
          <div key={a.id} style={{background:"#f0f4f8",border:"1px solid #c8d6e4",borderRadius:10,padding:"9px 10px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
              <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                <span style={{fontSize:10,fontFamily:"'JetBrains Mono',monospace",background:"#ffffff",border:"1px solid #c8d6e4",borderRadius:5,padding:"2px 6px"}}>{t[a.type]||a.type}</span>
                <span style={{fontSize:12,fontWeight:600,color:"#1a2a3a"}}>{a.title}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <select value={a.status} onChange={e=>onUpdateActivityStatus(a.id,e.target.value)} style={{...iSx,padding:"3px 6px",fontSize:11,width:120}}>
                  {statusOpts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                <button title={t.activityEdit} onClick={()=>startEdit(a)} style={{background:"none",border:"none",color:"#003e7e",cursor:"pointer",padding:2}}><Ic n="edit" s={12}/></button>
                <button title={t.deleteBtn} onClick={()=>onDeleteActivity(a.id)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",padding:2}}><Ic n="trash" s={12}/></button>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}>
              {a.dueDate && <span style={{fontSize:10,color:"#5a6b7a",fontFamily:"'JetBrains Mono',monospace"}}>📅 {a.dueDate}</span>}
              {a.responsible && <span style={{fontSize:10,color:"#5a6b7a"}}>👤 {a.responsible}</span>}
            </div>
            {a.comment && <div style={{fontSize:11,color:"#6b7d8e",marginTop:4,lineHeight:1.5}}>{a.comment}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivitiesDashboard({dls,t,onUpdateActivityStatus,onOpenActivity}){
  const [filter, setFilter] = useState("all");
  const all = dls.flatMap(d => (d.activities||[]).map(a=>({...a,dealId:d.id,dealName:d.name})));
  const now = new Date();
  const todayS = today();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate()+7);

  const pending = all.filter(a=>a.status!=="done");
  const overdue = pending.filter(a=>a.dueDate && a.dueDate < todayS);
  const dueSoon = pending.filter(a=>a.dueDate && a.dueDate >= todayS && a.dueDate <= new Date(now.getTime()+7*86400000).toISOString().slice(0,10));
  const completedWeek = all.filter(a=>a.status==="done" && a.dueDate && new Date(a.dueDate)>=weekStart && new Date(a.dueDate)<weekEnd);

  const lists = { all, pending, overdue, dueSoon, completedWeek };
  const rows = lists[filter] || all;
  const statusOpts = ACTIVITY_STATUSES.map(v=>({v,l:t[v]}));

  const cards = [
    {k:"pending",l:t.pending,v:pending.length,c:"#27aae1"},
    {k:"overdue",l:t.overdue,v:overdue.length,c:"#ef4444"},
    {k:"dueSoon",l:t.dueSoon,v:dueSoon.length,c:"#f59e0b"},
    {k:"completedWeek",l:t.completedWeek,v:completedWeek.length,c:"#22c55e"},
  ];

  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        <button onClick={()=>setFilter("all")} style={{background:filter==="all"?"#003e7e":"#ffffff",color:filter==="all"?"#fff":"#4a5a6a",border:"1px solid #b8d8eb",borderRadius:9,padding:"7px 12px",fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>{t.all} ({all.length})</button>
        {cards.map(s=>(
          <button key={s.k} onClick={()=>setFilter(s.k)} style={{background:filter===s.k?s.c+"22":"#ffffff",color:filter===s.k?s.c:"#4a5a6a",border:`1px solid ${filter===s.k?s.c:"#b8d8eb"}`,borderRadius:9,padding:"7px 12px",fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>
            {s.l} ({s.v})
          </button>
        ))}
      </div>

      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        {cards.map(s=>(
          <div key={s.k} style={{background:"#ffffff",border:"1px solid #c8d6e4",borderRadius:12,padding:"10px 16px",flex:1,minWidth:130}}>
            <div style={{fontSize:10,color:"#6b7d8e",textTransform:"uppercase",letterSpacing:.9,fontFamily:"'JetBrains Mono',monospace",marginBottom:2}}>{s.l}</div>
            <div style={{fontSize:20,fontWeight:700,color:s.c,fontFamily:"'DM Sans',Arial,sans-serif"}}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {rows.map(a=>(
          <div key={a.id} onClick={()=>onOpenActivity(a.dealId)} style={{background:"#ffffff",border:"1px solid #c8d6e4",borderRadius:10,padding:"10px 12px",cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                <span style={{fontSize:10,fontFamily:"'JetBrains Mono',monospace",background:"#f0f4f8",border:"1px solid #c8d6e4",borderRadius:5,padding:"2px 6px"}}>{t[a.type]||a.type}</span>
                <span style={{fontSize:12,fontWeight:600,color:"#1a2a3a"}}>{a.title}</span>
                <span style={{fontSize:10,color:"#003e7e",fontFamily:"'JetBrains Mono',monospace",background:"#eaf3ff",border:"1px solid #b8d8eb",borderRadius:5,padding:"2px 6px"}}>Deal: {a.dealName}</span>
              </div>
              <select value={a.status} onClick={e=>e.stopPropagation()} onChange={e=>onUpdateActivityStatus(a.dealId,a.id,e.target.value)} style={{...iSx,padding:"3px 6px",fontSize:11,width:140}}>
                {statusOpts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}>
              {a.dueDate && <span style={{fontSize:10,color:"#5a6b7a",fontFamily:"'JetBrains Mono',monospace"}}>📅 {a.dueDate}</span>}
              {a.responsible && <span style={{fontSize:10,color:"#5a6b7a"}}>👤 {a.responsible}</span>}
            </div>
            {a.comment && <div style={{fontSize:11,color:"#6b7d8e",marginTop:4,lineHeight:1.5}}>{a.comment}</div>}
          </div>
        ))}
        {!rows.length && <div style={{fontSize:11,color:"#8ea4b8"}}>{t.noActivities}</div>}
      </div>
    </div>
  );
}

// ─── Deal Detail Modal ────────────────────────────────────────────────────────
function DealDetailModal({deal, cos, cts, users, lang, currency, stages, t, onSaveEval, onDeleteEval, onAddActivity, onDeleteActivity, onUpdateActivityStatus, onUpdateActivity, onEditDeal, onClose}){
  const [tab, setTab] = useState(deal._openTab || "meddic");
  const co = cos.find(c=>c.id===deal.companyId);
  const ct = cts.find(c=>c.id===deal.contactId);
  const m  = stageStyle(stages, deal.stage);
  const latestMeddic = deal.meddicHistory?.slice(-1)[0];
  const meddicTotal  = calcTotal(latestMeddic?.meddic);

  return(
    <Modal title={deal.name} onClose={onClose} extraWide>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:18,padding:"12px 14px",background:"#f0f4f8",borderRadius:10,border:"1px solid #c8d6e4"}}>
        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12}}>
          <span style={{fontSize:13}}>{m.emoji}</span>
          <span style={{color:m.accent,fontWeight:600,fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>{deal.stage}</span>
        </div>
        <div style={{color:"#8ea4b8"}}>·</div>
        <div style={{fontSize:14,fontWeight:700,color:m.accent,fontFamily:"'DM Sans',Arial,sans-serif"}}>{fv(deal.value,currency)}</div>
        {co&&<><div style={{color:"#8ea4b8"}}>·</div><div style={{fontSize:12,color:"#5a6b7a"}}>🏢 {co.name}</div></>}
        {ct&&<><div style={{color:"#8ea4b8"}}>·</div><div style={{fontSize:12,color:"#5a6b7a"}}>👤 {ct.name}</div></>}
        {deal.closingDate&&<><div style={{color:"#8ea4b8"}}>·</div><div style={{fontSize:11,color:"#5a6b7a",fontFamily:"'JetBrains Mono',monospace"}}>{t.closing}: {deal.closingDate}</div></>}
        {(deal.leadSource || deal.leadSourceCustom) && <><div style={{color:"#8ea4b8"}}>·</div><div style={{fontSize:11,color:"#5a6b7a",fontFamily:"'JetBrains Mono',monospace"}}>{t.leadSource}: {deal.leadSource==="Custom"?(deal.leadSourceCustom||"Custom"):deal.leadSource}</div></>}
        <div style={{marginLeft:"auto"}}>
          <Btn ch={<><Ic n="edit" s={11}/>{t.editDeal}</>} v="subtle" sx={{fontSize:11,padding:"4px 10px"}} onClick={onEditDeal}/>
        </div>
      </div>

      <div style={{display:"flex",gap:2,marginBottom:18,borderBottom:"1px solid #c8d6e4"}}>
        {[{k:"meddic",l:"MEDDIC",icon:"meddic"},{k:"notes",l:t.notes,icon:"edit"},{k:"activities",l:t.activities,icon:"history"}].map(tb=>(
          <button key={tb.k} onClick={()=>setTab(tb.k)}
            style={{background:"none",border:"none",borderBottom:`2px solid ${tab===tb.k?"#003e7e":"transparent"}`,padding:"8px 14px",color:tab===tb.k?"#27aae1":"#6b7d8e",fontFamily:"inherit",fontSize:12,fontWeight:tab===tb.k?600:400,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
            <Ic n={tb.icon} s={12}/>{tb.l}
            {tb.k==="meddic" && latestMeddic && (
              <span style={{fontSize:10,color:scoreColor(meddicTotal),fontFamily:"'JetBrains Mono',monospace",background:scoreColor(meddicTotal)+"22",borderRadius:4,padding:"1px 6px",marginLeft:2}}>{meddicTotal}/30</span>
            )}
          </button>
        ))}
      </div>

      {tab==="meddic" && (
        <MeddicPanel deal={deal} lang={lang} t={t} onSaveEval={onSaveEval} onDeleteEval={onDeleteEval}/>
      )}
      {tab==="notes" && (
        <div style={{fontSize:13,color:"#5a6b7a",lineHeight:1.7,whiteSpace:"pre-wrap"}}>
          {deal.notes || <span style={{color:"#8ea4b8",fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>Sin notas.</span>}
        </div>
      )}
      {tab==="activities" && (
        <ActivitiesPanel
          deal={deal}
          t={t}
          users={users}
          onAddActivity={onAddActivity}
          onDeleteActivity={onDeleteActivity}
          onUpdateActivityStatus={onUpdateActivityStatus}
          onUpdateActivity={onUpdateActivity}
        />
      )}
    </Modal>
  );
}

// ─── Forms ────────────────────────────────────────────────────────────────────
function UsrForm({init={},t,onSave,onClose}){const[f,setF]=useState({name:"",alias:"",email:"",...init});const s=k=>e=>setF(p=>({...p,[k]:e.target.value}));return<><Inp label={t.userName+" *"} value={f.name} onChange={s("name")} /><Inp label={t.userAlias+" *"} value={f.alias} onChange={s("alias")} /><Inp label={t.userEmail+" *"} value={f.email} onChange={s("email")} /><div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}><Btn v="ghost" ch={t.cancel} onClick={onClose}/><Btn ch={t.save} onClick={()=>f.name&&f.alias&&f.email&&onSave(f)}/></div></>;}

function CoForm({init={},t,onSave,onClose}){const[f,setF]=useState({name:"",industry:"",website:"",phone:"",notes:"",...init});const s=k=>e=>setF(p=>({...p,[k]:e.target.value}));return<><Inp label={t.companyName+" *"} value={f.name} onChange={s("name")} placeholder={t.ph.companyName}/><Inp label={t.industry} value={f.industry} onChange={s("industry")} placeholder={t.ph.industry}/><Inp label={t.website} value={f.website} onChange={s("website")} placeholder={t.ph.website}/><Inp label={t.phone} value={f.phone} onChange={s("phone")} placeholder={t.ph.phone}/><Txta label={t.notes} value={f.notes} onChange={s("notes")}/><div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}><Btn v="ghost" ch={t.cancel} onClick={onClose}/><Btn ch={t.save} onClick={()=>f.name&&onSave(f)}/></div></>;}
function CtForm({init={},cos,t,onSave,onClose}){const[f,setF]=useState({name:"",email:"",phone:"",titleF:"",linkedin:"",companyId:"",notes:"",...init});const s=k=>e=>setF(p=>({...p,[k]:e.target.value}));const coOpts=[{v:"",l:t.selectOpt},...cos.map(c=>({v:c.id,l:c.name}))];return<><Inp label={t.name+" *"} value={f.name} onChange={s("name")} placeholder={t.ph.name}/><Inp label={t.email} value={f.email} onChange={s("email")} placeholder={t.ph.email}/><Inp label={t.phone} value={f.phone} onChange={s("phone")} placeholder={t.ph.phone}/><Inp label={t.titleF} value={f.titleF} onChange={s("titleF")} placeholder={t.ph.titleF}/><Inp label={t.linkedin} value={f.linkedin} onChange={s("linkedin")} placeholder={t.ph.linkedin}/><Sel label={t.company} value={f.companyId} onChange={s("companyId")} opts={coOpts}/><Txta label={t.notes} value={f.notes} onChange={s("notes")}/><div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}><Btn v="ghost" ch={t.cancel} onClick={onClose}/><Btn ch={t.save} onClick={()=>f.name&&onSave(f)}/></div></>;}
function DlForm({init={},cos,cts,t,lang,currency,stages,onSave,onClose}){
  const defaultStage=stages[0]?.name||"";
  const [f,setF]=useState({name:"",value:0,stage:defaultStage,companyId:"",contactId:"",leadSource:"",leadSourceCustom:"",closingDate:"",notes:"",...init});
  const s=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const coOpts=[{v:"",l:t.selectOpt},...cos.map(c=>({v:c.id,l:c.name}))];
  const ctOpts=[{v:"",l:t.selectOpt},...cts.map(c=>({v:c.id,l:c.name}))];
  const stOpts=stages.map(st=>({v:st.name,l:st.name}));
  const sourceOpts=[{v:"",l:t.selectOpt},...LEAD_SOURCES.map(x=>({v:x,l:x}))];

  return <>
    <Inp label={t.dealName+" *"} value={f.name} onChange={s("name")} placeholder={t.ph.dealName}/>
    <Inp label={`${t.value} (${currency})`} type="number" value={f.value} onChange={s("value")}/>
    <Sel label={t.stage} value={f.stage} onChange={s("stage")} opts={stOpts}/>
    <Sel label={t.company} value={f.companyId} onChange={s("companyId")} opts={coOpts}/>
    <Sel label={t.contact} value={f.contactId} onChange={s("contactId")} opts={ctOpts}/>
    <Sel label={t.leadSource} value={f.leadSource||""} onChange={s("leadSource")} opts={sourceOpts}/>
    {(f.leadSource==="Custom") && (
      <Inp label={t.leadSourceCustom} value={f.leadSourceCustom||""} onChange={s("leadSourceCustom")} placeholder="Ej. Evento/Expo"/>
    )}
    <Inp label={t.closingDate} type="date" value={f.closingDate} onChange={s("closingDate")}/>
    <Txta label={t.notes} value={f.notes} onChange={s("notes")}/>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}>
      <Btn v="ghost" ch={t.cancel} onClick={onClose}/>
      <Btn ch={t.save} onClick={()=>f.name&&onSave(f)}/>
    </div>
  </>;
}

// ─── Import Modal ─────────────────────────────────────────────────────────────
function ImportModal({type,t,cos,onImportCo,onImportCt,onClose}){const[state,setState]=useState("idle");const[result,setResult]=useState(null);const[dragOver,setDragOver]=useState(false);const fileRef=useRef();const isCo=type==="company";const cols=isCo?CO_COLS:CT_COLS;const templateData=isCo?[{name:"Acme Corp",industry:"Tecnología",website:"acme.com",phone:"+52 55 1234 5678",notes:""}]:[{name:"Ana García",email:"ana@empresa.com",phone:"+52 55 1111 2222",titleF:"CEO",linkedin:"",companyName:"Acme Corp",notes:""}];const downloadTemplate=()=>downloadBlob(toCSV(templateData,cols),isCo?"plantilla_empresas.csv":"plantilla_contactos.csv");const processFile=file=>{if(!file)return;setState("processing");const reader=new FileReader();reader.onload=e=>{const{headers,rows,errors:parseErrors}=parseCSV(e.target.result);const missing=cols.filter(c=>!headers.includes(c));if(missing.length){setResult({ok:0,errors:[`${t.importColError}: ${missing.join(", ")}`],missing:true});setState("result");return;}let ok=0,errors=[...parseErrors.map(pe=>`CSV row ${pe.row+2}: ${pe.message}`)];const imported=[];rows.forEach((row,i)=>{if(!row.name?.trim()){errors.push(`Fila ${i+2}: name vacío`);return;}if(isCo){imported.push({id:uid(),name:row.name.trim(),industry:row.industry||"",website:row.website||"",phone:row.phone||"",notes:row.notes||""});ok++;}else{const co=cos.find(c=>c.name.toLowerCase()===(row.companyName||"").toLowerCase());imported.push({id:uid(),name:row.name.trim(),email:row.email||"",phone:row.phone||"",titleF:row.titleF||"",linkedin:row.linkedin||"",companyId:co?.id||"",notes:row.notes||""});ok++;}});if(isCo)onImportCo(imported);else onImportCt(imported);setResult({ok,errors});setState("result");};reader.readAsText(file,"UTF-8");};const onDrop=e=>{e.preventDefault();setDragOver(false);processFile(e.dataTransfer.files[0]);};return(<Modal title={`${t.importTitle} — ${isCo?t.companies:t.contacts}`} onClose={onClose} wide><div style={{background:"#f0f4f8",border:"1px solid #c8d6e4",borderRadius:10,padding:14,marginBottom:16}}><p style={{fontSize:12,color:"#5a6b7a",margin:"0 0 10px",lineHeight:1.6}}>{t.importDesc}</p><p style={{fontSize:11,color:"#5a6b7a",margin:"0 0 12px"}}>{t.overwriteWarn}</p><div style={{background:"#ffffff",borderRadius:8,padding:"10px 12px",marginBottom:12}}><div style={{fontSize:10,color:"#6b7d8e",fontFamily:"'JetBrains Mono',monospace",letterSpacing:.7,marginBottom:6,textTransform:"uppercase"}}>Columnas</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{cols.map(c=><span key={c} style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",background:"#c8d6e4",color:"#4a5a6a",borderRadius:5,padding:"2px 8px"}}>{c}</span>)}</div></div><Btn ch={<><Ic n="template" s={12}/>{t.downloadTemplate}</>} v="subtle" onClick={downloadTemplate}/></div>{state==="idle"&&(<div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={onDrop} onClick={()=>fileRef.current?.click()} style={{border:`2px dashed ${dragOver?"#003e7e":"#c8d6e4"}`,borderRadius:12,padding:"32px 20px",textAlign:"center",cursor:"pointer",background:dragOver?"#0d1a2e":"#f0f4f8",transition:"all .15s"}}><div style={{color:dragOver?"#27aae1":"#8ea4b8",marginBottom:8}}><Ic n="upload" s={28}/></div><div style={{fontSize:13,color:dragOver?"#27aae1":"#5a6b7a"}}>{t.dragDrop}</div><input ref={fileRef} type="file" accept=".csv,text/csv" style={{display:"none"}} onChange={e=>processFile(e.target.files[0])}/></div>)}{state==="result"&&result&&(<div>{!result.missing&&(<div style={{background:"#e8f5ee",border:"1px solid #a0d4b0",borderRadius:10,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}><span style={{color:"#22c55e"}}><Ic n="check" s={16}/></span><span style={{fontSize:13,color:"#22c55e",fontWeight:600}}>{result.ok} {t.importSuccess}</span></div>)}{result.errors?.length>0&&(<div style={{background:"#fde8e8",border:"1px solid #d4a0a0",borderRadius:10,padding:"12px 16px",marginBottom:12}}><div style={{fontSize:12,color:"#ef4444",fontWeight:600,marginBottom:6}}>{result.errors.length} {t.importErrors}</div>{result.errors.map((e,i)=><div key={i} style={{fontSize:11,color:"#9a3535",fontFamily:"'JetBrains Mono',monospace",marginBottom:2}}>• {e}</div>)}</div>)}<div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn ch={t.close} v="primary" onClick={onClose}/></div></div>)}</Modal>);}

// ─── Bulk Bar ─────────────────────────────────────────────────────────────────
function BulkBar({type,t,data,cos,onImportCo,onImportCt}){const[open,setOpen]=useState(false);const[importOpen,setImportOpen]=useState(false);const isCo=type==="company";const handleExport=()=>{const cols=isCo?CO_COLS:CT_COLS;const rows=isCo?data:data.map(ct=>{const co=cos.find(c=>c.id===ct.companyId);return{...ct,companyName:co?.name||""};});const filename=isCo?`empresas_${new Date().toISOString().slice(0,10)}.csv`:`contactos_${new Date().toISOString().slice(0,10)}.csv`;downloadBlob(toCSV(rows,cols),filename);};return(<><div style={{position:"relative",display:"inline-block"}}><Btn ch={<><Ic n="layers" s={12}/>{t.importExport}<Ic n="chevDown" s={11}/></>} v="subtle" onClick={()=>setOpen(p=>!p)}/>{open&&(<div style={{position:"absolute",right:0,top:"calc(100% + 6px)",background:"#ffffff",border:"1px solid #c8d6e4",borderRadius:10,minWidth:200,boxShadow:"0 8px 32px rgba(0,62,126,.1)",zIndex:100,overflow:"hidden"}}><button onClick={()=>{setOpen(false);setImportOpen(true);}} style={{width:"100%",background:"none",border:"none",color:"#1a2a3a",padding:"10px 14px",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontFamily:"inherit",borderBottom:"1px solid #b8d8eb"}}><Ic n="upload" s={13}/>{t.importCSV}</button><button onClick={()=>{setOpen(false);handleExport();}} style={{width:"100%",background:"none",border:"none",color:"#1a2a3a",padding:"10px 14px",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontFamily:"inherit",borderBottom:"1px solid #b8d8eb"}}><Ic n="download" s={13}/>{t.exportCSV}</button><button onClick={()=>{setOpen(false);const cols=isCo?CO_COLS:CT_COLS;const tpl=isCo?[{name:"Ejemplo SA",industry:"Retail",website:"ejemplo.com",phone:"+52 55 0000 0000",notes:""}]:[{name:"Juan Pérez",email:"juan@co.com",phone:"+52 55 0000 0000",titleF:"Gerente",linkedin:"",companyName:"Ejemplo SA",notes:""}];downloadBlob(toCSV(tpl,cols),isCo?"plantilla_empresas.csv":"plantilla_contactos.csv");}} style={{width:"100%",background:"none",border:"none",color:"#4a5a6a",padding:"10px 14px",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontFamily:"inherit"}}><Ic n="template" s={13}/>{t.downloadTemplate}</button></div>)}</div>{importOpen&&<ImportModal type={type} t={t} cos={cos} onImportCo={onImportCo} onImportCt={onImportCt} onClose={()=>setImportOpen(false)}/>}{open&&<div style={{position:"fixed",inset:0,zIndex:99}} onClick={()=>setOpen(false)}/>}</>);}

// ─── Kanban ───────────────────────────────────────────────────────────────────
const Kanban = memo(function Kanban({deals,cos,cts,t,lang,currency,stages,onEdit,onDel,onStage,onViewDeal,fontSizeMode="medium"}){
  const[drag,setDrag]=useState(null);
  const[over,setOver]=useState(null);
  const zoom = fontSizeMode==="small" ? 0.9 : fontSizeMode==="large" ? 1.18 : 1;
  const closedNames = stages.filter(s=>s.isWon||s.isLost).map(s=>s.name);
  const wonNames = stages.filter(s=>s.isWon).map(s=>s.name);
  const pipe=deals.filter(d=>!closedNames.includes(d.stage)).reduce((s,d)=>s+Number(d.value),0);
  const won=deals.filter(d=>wonNames.includes(d.stage)).reduce((s,d)=>s+Number(d.value),0);
  return(
    <div style={{zoom}}>
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        {[{l:t.pipelineTotal,v:fv(pipe,currency),c:"#27aae1"},{l:t.closedWon,v:fv(won,currency),c:"#22c55e"},{l:t.totalDeals,v:deals.length,c:"#7c2b83"}].map(s=>(
          <div key={s.l} style={{background:"#ffffff",border:"1px solid #c8d6e4",borderRadius:12,padding:"10px 16px",flex:1,minWidth:120}}>
            <div style={{fontSize:10,color:"#6b7d8e",textTransform:"uppercase",letterSpacing:.9,fontFamily:"'JetBrains Mono',monospace",marginBottom:2}}>{s.l}</div>
            <div style={{fontSize:20,fontWeight:700,color:s.c,fontFamily:"'DM Sans',Arial,sans-serif"}}>{s.v}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:9,overflowX:"auto",paddingBottom:10,alignItems:"flex-start"}}>
        {stages.map(stg=>{
          const m=stg;
          const stage=stg.name;
          const col=deals.filter(d=>d.stage===stage);
          const colV=col.reduce((s,d)=>s+Number(d.value),0);
          const isOver=over===stage;
          return(
            <div key={stg.id}
              onDragOver={e=>{e.preventDefault();setOver(stage);}}
              onDragLeave={()=>setOver(null)}
              onDrop={e=>{e.preventDefault();if(drag&&drag.stage!==stage)onStage(drag.id,stage);setDrag(null);setOver(null);}}
              style={{flex:"0 0 205px",background:isOver?m.bg+"f5":m.bg,border:`1px solid ${isOver?m.accent:m.border}`,borderRadius:12,padding:"11px 9px",transition:"all .15s",boxShadow:isOver?`0 0 14px ${m.accent}25`:"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7,paddingBottom:7,borderBottom:`1px solid ${m.border}`}}>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <span style={{fontSize:12}}>{m.emoji}</span>
                  <span style={{fontSize:10,fontWeight:600,color:m.accent,fontFamily:"'JetBrains Mono',monospace",letterSpacing:.2}}>{stage}</span>
                </div>
                <span style={{fontSize:10,color:"#6b7d8e",background:"#f0f4f8",borderRadius:4,padding:"1px 5px",fontFamily:"'JetBrains Mono',monospace"}}>{col.length}</span>
              </div>
              {colV>0&&<div style={{fontSize:10,color:m.accent,marginBottom:7,fontFamily:"'JetBrains Mono',monospace",opacity:.75}}>{fv(colV,currency)}</div>}
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {col.map(dl=>{
                  const co=cos.find(c=>c.id===dl.companyId);
                  const ct=cts.find(c=>c.id===dl.contactId);
                  const latestEv=dl.meddicHistory?.slice(-1)[0];
                  const mTotal=calcTotal(latestEv?.meddic);
                  const hasMeddic=dl.meddicHistory?.length>0;
                  return(
                    <div key={dl.id} draggable
                      onDragStart={()=>setDrag(dl)}
                      onDragEnd={()=>{setDrag(null);setOver(null);}}
                      style={{background:"#f0f4f8",border:"1px solid #b8d8eb",borderRadius:9,padding:"9px",cursor:"grab",userSelect:"none",opacity:drag?.id===dl.id?.4:1,transition:"opacity .1s"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:3}}>
                        <div style={{fontSize:12,fontWeight:600,color:"#1a2a3a",lineHeight:1.3,flex:1}}>{dl.name}</div>
                        <div style={{display:"flex",gap:1,flexShrink:0}}>
                          <button onClick={e=>{e.stopPropagation();onViewDeal(dl);}} title="MEDDIC"
                            style={{background:"none",border:"none",color:"#4a5a6a",cursor:"pointer",padding:"2px 3px",opacity:.65}}><Ic n="meddic" s={11}/></button>
                          <button onClick={e=>{e.stopPropagation();onEdit(dl);}}
                            style={{background:"none",border:"none",color:m.accent,cursor:"pointer",padding:"2px 3px",opacity:.65}}><Ic n="edit" s={11}/></button>
                          <button onClick={e=>{e.stopPropagation();onDel(dl.id);}}
                            style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",padding:"2px 3px",opacity:.55}}><Ic n="trash" s={11}/></button>
                        </div>
                      </div>
                      {Number(dl.value)>0&&<div style={{fontSize:13,fontWeight:700,color:m.accent,marginTop:4,fontFamily:"'DM Sans',Arial,sans-serif"}}>{fv(dl.value,currency)}</div>}
                      {co&&<div style={{fontSize:10,color:"#5a6b7a",marginTop:3}}>🏢 {co.name}</div>}
                      {ct&&<div style={{fontSize:10,color:"#5a6b7a"}}>👤 {ct.name}</div>}
                      {dl.closingDate&&<div style={{fontSize:9,color:"#8ea4b8",marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>{t.closing}: {dl.closingDate}</div>}

                      {/* MEDDIC score badge */}
                      <div style={{marginTop:7,paddingTop:7,borderTop:"1px solid #dce4ec",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}
                        onClick={e=>{e.stopPropagation();onViewDeal(dl);}}>
                        {hasMeddic ? (
                          <>
                            <div style={{display:"flex",gap:2,alignItems:"center"}}>
                              {MEDDIC_KEYS.map(k=>{
                                const meta=MEDDIC_META[k];
                                const sc=latestEv?.meddic[k]?.score||0;
                                return(
                                  <div key={k} title={`${meta.letter}: ${sc}/5`}
                                    style={{width:14,height:14,borderRadius:3,background:sc>0?meta.color+"33":"#c8d6e4",border:`1px solid ${sc>0?meta.color+"55":"#c8d6e4"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                    <span style={{fontSize:7,color:sc>0?meta.color:"#8ea4b8",fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{sc}</span>
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:4}}>
                              <div style={{width:30,height:4,background:"#c8d6e4",borderRadius:2,overflow:"hidden"}}>
                                <div style={{height:"100%",width:`${(mTotal/30)*100}%`,background:scoreColor(mTotal),borderRadius:2,transition:"width .3s"}}/>
                              </div>
                              <span style={{fontSize:9,color:scoreColor(mTotal),fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{mTotal}/30</span>
                            </div>
                          </>
                        ) : (
                          <div style={{fontSize:9,color:"#8ea4b8",fontFamily:"'JetBrains Mono',monospace",display:"flex",alignItems:"center",gap:4}}>
                            <Ic n="meddic" s={9}/>MEDDIC sin evaluar
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {col.length===0&&<div style={{fontSize:10,color:"#c8d6e4",textAlign:"center",padding:"10px 0",fontFamily:"'JetBrains Mono',monospace"}}>{t.noDeals}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ─── App Inner (consumes CRM context) ─────────────────────────────────────────
function AppInner(){
  const { cos, cts, dls, users, currency, stages, loading, saveStatus, setCos, setCts, setDls, setUsers, setCurrency, setStages } = useCRM();
  const[lang,setLang]=useState("es");
  const t=T[lang];
  const[tab,setTab]=useState("deals");
  const[pipelineEditorOpen,setPipelineEditorOpen]=useState(false);
  const[pipelineFontSize,setPipelineFontSize]=useState("medium");
  const[q,setQ]=useState("");
  const[modal,setModal]=useState(null);
  const[viewDeal,setViewDeal]=useState(null);
  const[confirmDel,setConfirmDel]=useState(null);

  // ── CRUD operations ──
  const withSaveStatus = async (fn) => {
    setSaveStatus("saving");
    try {
      await fn();
      setSaveStatus("saved");
      setTimeout(()=>setSaveStatus("idle"),1000);
      return true;
    } catch (e) {
      console.error('save op error:', e);
      setSaveStatus("error");
      return false;
    }
  };

  const saveCo=async f=>{
    const row = { ...(f.id?f:{...f,id:uid()}) };
    const ok = await withSaveStatus(async()=>{
      await supabase.from('companies').upsert([{ id:row.id, name:row.name, industry:row.industry||"", website:row.website||"", phone:row.phone||"", notes:row.notes||"" }], { onConflict:'id' });
    });
    if(!ok) return;
    setCos(p=>f.id?p.map(c=>c.id===row.id?row:c):[...p,row]);
    setModal(null);
  };

  const saveCt=async f=>{
    const row = { ...(f.id?f:{...f,id:uid()}) };
    const ok = await withSaveStatus(async()=>{
      await supabase.from('contacts').upsert([{ id:row.id, name:row.name, email:row.email||"", phone:row.phone||"", title_f:row.titleF||"", linkedin:row.linkedin||"", company_id:row.companyId||null, notes:row.notes||"" }], { onConflict:'id' });
    });
    if(!ok) return;
    setCts(p=>f.id?p.map(c=>c.id===row.id?row:c):[...p,row]);
    setModal(null);
  };

  const saveUsr=async f=>{
    const row = { ...(f.id?f:{...f,id:uid()}) };
    const ok = await withSaveStatus(async()=>{
      await supabase.from('crm_users').upsert([{ id:row.id, name:row.name, alias:row.alias, email:row.email }], { onConflict:'id' });
    });
    if(!ok) return;
    setUsers(p=>f.id?p.map(u=>u.id===row.id?row:u):[...p,row]);
    setModal(null);
  };

  const saveDl=async f=>{
    const base={meddicHistory:[],activities:[]};
    const row = f.id ? {...dls.find(d=>d.id===f.id), ...f} : {...base,...f,id:uid()};
    const ok = await withSaveStatus(async()=>{
      await supabase.from('deals').upsert([{ id:row.id, name:row.name, value:Number(row.value)||0, stage:row.stage, company_id:row.companyId||null, contact_id:row.contactId||null, closing_date:row.closingDate||null, notes:row.notes||"", lead_source:row.leadSource||null, lead_source_custom:row.leadSourceCustom||null }], { onConflict:'id' });
    });
    if(!ok) return;
    setDls(p=>f.id?p.map(d=>d.id===row.id?row:d):[...p,row]);
    setModal(null);
    if(viewDeal&&viewDeal.id===row.id)setViewDeal(p=>({...p,...row}));
  };
  const chStage=(id,stage)=>setDls(p=>p.map(d=>d.id===id?{...d,stage}:d));

  // ── Delete with confirmation ──
  const requestDelCo=(id)=>{
    const co = cos.find(c=>c.id===id);
    if(!co) return;
    const assocCts = cts.filter(c=>c.companyId===id);
    const assocDls = dls.filter(d=>d.companyId===id);
    setConfirmDel({
      type:"company",
      name: co.name,
      associatedContacts: assocCts.length,
      associatedDeals: assocDls.length,
      // Simple delete (no associated records)
      onDelete: ()=>{
        setCos(p=>p.filter(c=>c.id!==id));
      },
      // Cascade: delete company + all associated contacts & deals
      onCascadeDelete: ()=>{
        setCos(p=>p.filter(c=>c.id!==id));
        setCts(p=>p.filter(c=>c.companyId!==id));
        setDls(p=>p.filter(d=>d.companyId!==id));
        if(viewDeal?.companyId===id) setViewDeal(null);
      },
      // Unlink: delete company, clear companyId on contacts & deals
      onUnlinkDelete: ()=>{
        setCos(p=>p.filter(c=>c.id!==id));
        setCts(p=>p.map(c=>c.companyId===id?{...c,companyId:""}:c));
        setDls(p=>p.map(d=>d.companyId===id?{...d,companyId:""}:d));
      },
    });
  };

  const requestDelCt=(id)=>{
    const ct = cts.find(c=>c.id===id);
    if(!ct) return;
    const assocDls = dls.filter(d=>d.contactId===id);
    setConfirmDel({
      type:"contact",
      name: ct.name,
      associatedDeals: assocDls.length,
      onDelete: ()=>{
        setCts(p=>p.filter(c=>c.id!==id));
        // Unlink deals that referenced this contact
        setDls(p=>p.map(d=>d.contactId===id?{...d,contactId:""}:d));
      },
    });
  };

  const requestDelDl=(id)=>{
    const dl = dls.find(d=>d.id===id);
    if(!dl) return;
    setConfirmDel({
      type:"deal",
      name: dl.name,
      onDelete: ()=>{
        setDls(p=>p.filter(d=>d.id!==id));
        if(viewDeal?.id===id) setViewDeal(null);
      },
    });
  };

  const requestDelUsr=(id)=>{
    const u = users.find(x=>x.id===id);
    if(!u) return;
    if(window.confirm(`¿Eliminar usuario ${u.alias || u.name}?`)){
      setUsers(p=>p.filter(x=>x.id!==id));
    }
  };

  const saveEval=(dealId,ev)=>{
    setDls(p=>p.map(d=>{
      if(d.id!==dealId)return d;
      const hist=[...(d.meddicHistory||[]),ev];
      return{...d,meddicHistory:hist};
    }));
    setViewDeal(p=>{
      if(!p||p.id!==dealId)return p;
      const hist=[...(p.meddicHistory||[]),ev];
      return{...p,meddicHistory:hist};
    });
  };

  const deleteEval=(dealId, evalId)=>{
    setDls(p=>p.map(d=>{
      if(d.id!==dealId)return d;
      return {...d, meddicHistory:(d.meddicHistory||[]).filter(e=>e.id!==evalId)};
    }));
    setViewDeal(p=>{
      if(!p||p.id!==dealId)return p;
      return {...p, meddicHistory:(p.meddicHistory||[]).filter(e=>e.id!==evalId)};
    });
  };

  const addActivity=(dealId, activity)=>{
    setDls(p=>p.map(d=>d.id===dealId?{...d,activities:[...(d.activities||[]),activity]}:d));
    setViewDeal(p=>p&&p.id===dealId?{...p,activities:[...(p.activities||[]),activity]}:p);
  };
  const deleteActivity=(dealId, activityId)=>{
    setDls(p=>p.map(d=>d.id===dealId?{...d,activities:(d.activities||[]).filter(a=>a.id!==activityId)}:d));
    setViewDeal(p=>p&&p.id===dealId?{...p,activities:(p.activities||[]).filter(a=>a.id!==activityId)}:p);
    if (supabase) {
      supabase.from('deal_activities').delete().eq('id', activityId).then(()=>{}).catch(()=>{});
    }
  };
  const updateActivityStatus=(dealId, activityId, status)=>{
    setDls(p=>p.map(d=>d.id===dealId?{...d,activities:(d.activities||[]).map(a=>a.id===activityId?{...a,status}:a)}:d));
    setViewDeal(p=>p&&p.id===dealId?{...p,activities:(p.activities||[]).map(a=>a.id===activityId?{...a,status}:a)}:p);
  };

  const updateActivity=(dealId, activityId, patch)=>{
    setDls(p=>p.map(d=>d.id===dealId?{...d,activities:(d.activities||[]).map(a=>a.id===activityId?{...a,...patch}:a)}:d));
    setViewDeal(p=>p&&p.id===dealId?{...p,activities:(p.activities||[]).map(a=>a.id===activityId?{...a,...patch}:a)}:p);
  };

  const openDealActivities=(dealId)=>{
    const d = dls.find(x=>x.id===dealId);
    if(!d) return;
    setViewDeal({...d, _openTab:"activities"});
  };

  const importCos=rows=>setCos(p=>{const ex=new Set(p.map(c=>c.name.toLowerCase()));return[...p,...rows.filter(r=>!ex.has(r.name.toLowerCase()))];});
  const importCts=rows=>setCts(p=>{const ex=new Set(p.map(c=>c.email?.toLowerCase()).filter(Boolean));return[...p,...rows.filter(r=>!r.email||!ex.has(r.email.toLowerCase()))];});

  // ── Memoized filters (must be before any early return) ──
  const ql=q.toLowerCase();
  const fCo=useMemo(()=>cos.filter(c=>c.name.toLowerCase().includes(ql)||c.industry?.toLowerCase().includes(ql)),[cos,ql]);
  const fCt=useMemo(()=>cts.filter(c=>c.name.toLowerCase().includes(ql)||c.email?.toLowerCase().includes(ql)),[cts,ql]);
  const fDl=useMemo(()=>dls.filter(d=>d.name.toLowerCase().includes(ql)),[dls,ql]);
  const fUs=useMemo(()=>users.filter(u=>u.name.toLowerCase().includes(ql)||u.alias?.toLowerCase().includes(ql)||u.email?.toLowerCase().includes(ql)),[users,ql]);

  const TABS=[{k:"deals",l:t.pipeline,i:"layers"},{k:"companies",l:t.companies,i:"building"},{k:"contacts",l:t.contacts,i:"users"},{k:"activities",l:t.activities,i:"history"},{k:"users",l:t.usersTab,i:"users"}];
  const addL=tab==="deals"?t.newDeal:tab==="companies"?t.newCompany:tab==="contacts"?t.newContact:tab==="users"?t.newUser:null;
  const addT=tab==="deals"?"deal":tab==="companies"?"company":tab==="contacts"?"contact":tab==="users"?"user":null;

  // ── Show loading screen while data loads ──
  if(loading) return <LoadingScreen lang={lang}/>;

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:#f0f4f8;}
        ::-webkit-scrollbar-thumb{background:#c8d6e4;border-radius:4px;}
        input[type=date]::-webkit-calendar-picker-indicator{}
        input::placeholder,textarea::placeholder{color:#c8d6e4;}
        select option{background:#ffffff;}
        button:focus{outline:none;}
      `}</style>
      <div style={{minHeight:"100vh",background:"#f0f4f8",fontFamily:"'DM Sans',Arial,sans-serif",color:"#1a2a3a"}}>

        {/* Header */}
        <header style={{background:"#ffffff",borderBottom:"1px solid #b8d8eb",padding:"13px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:9}}>
              <img src="/intelsius-logo.jpg" alt="Intelsius" style={{height:30,width:"auto",borderRadius:4,objectFit:"contain",background:"#fff"}} />
              <span style={{fontSize:19,fontFamily:"'DM Sans',Arial,sans-serif",color:"#1a2a3a"}}>{t.appName}</span>
              <SaveIndicator status={saveStatus}/>
            </div>
            <div style={{fontSize:10,color:"#8ea4b8",fontFamily:"'JetBrains Mono',monospace",marginTop:2,paddingLeft:39}}>
              {cos.length} {t.companies.toLowerCase()} · {cts.length} {t.contactsW} · {dls.length} deals
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
            <div style={{display:"flex",background:"#f0f4f8",border:"1px solid #b8d8eb",borderRadius:7,overflow:"hidden"}}>
              {["es","en"].map(l=>(
                <button key={l} onClick={()=>setLang(l)} style={{background:lang===l?"#003e7e":"transparent",color:lang===l?"#fff":"#6b7d8e",border:"none",padding:"4px 13px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",letterSpacing:.5,transition:"all .12s"}}>{l.toUpperCase()}</button>
              ))}
            </div>
            <select value={currency} onChange={e=>setCurrency(e.target.value)}
              title={t.currency}
              style={{background:"#f0f4f8",border:"1px solid #b8d8eb",borderRadius:7,padding:"4px 8px",color:"#1a2a3a",fontSize:11,fontFamily:"'JetBrains Mono',monospace",cursor:"pointer",outline:"none"}}>
              {CURRENCIES.map(c=>(
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
            <div style={{position:"relative"}}>
              <span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:"#8ea4b8"}}><Ic n="search" s={12}/></span>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder={t.search}
                style={{background:"#ffffff",border:"1px solid #b8d8eb",borderRadius:7,padding:"6px 11px 6px 27px",color:"#1a2a3a",fontSize:12,fontFamily:"inherit",outline:"none",width:160}}/>
            </div>
            {addT && <Btn ch={<><Ic n="plus" s={12}/>{addL}</>} onClick={()=>setModal({type:addT,data:{}})} sx={{padding:"6px 14px"}}/>}
          </div>
        </header>

        {/* Tabs */}
        <nav style={{background:"#ffffff",borderBottom:"1px solid #b8d8eb",padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:2}}>
            {TABS.map(tb=>(
              <button key={tb.k} onClick={()=>setTab(tb.k)}
                style={{background:"none",border:"none",borderBottom:`2px solid ${tab===tb.k?"#003e7e":"transparent"}`,padding:"10px 15px",color:tab===tb.k?"#27aae1":"#6b7d8e",fontFamily:"inherit",fontSize:13,fontWeight:tab===tb.k?600:400,cursor:"pointer",display:"flex",alignItems:"center",gap:5,transition:"color .12s"}}>
                <Ic n={tb.i} s={12}/>{tb.l}
              </button>
            ))}
          </div>
          {tab==="deals"&&(
            <div style={{padding:"6px 0",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <div style={{display:"flex",background:"#f0f4f8",border:"1px solid #b8d8eb",borderRadius:7,overflow:"hidden"}}>
                {[{k:"small",l:"Pequeño"},{k:"medium",l:"Mediano"},{k:"large",l:"Grande"}].map(o=>(
                  <button key={o.k} onClick={()=>setPipelineFontSize(o.k)} style={{background:pipelineFontSize===o.k?"#003e7e":"transparent",color:pipelineFontSize===o.k?"#fff":"#6b7d8e",border:"none",padding:"4px 10px",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>{o.l}</button>
                ))}
              </div>
              <Btn v="subtle" ch={<><Ic n="edit" s={12}/>{t.pipelineEditor}</>} onClick={()=>setPipelineEditorOpen(true)} sx={{fontSize:11,padding:"5px 12px"}}/>
            </div>
          )}
          {(tab==="companies"||tab==="contacts")&&(
            <div style={{padding:"6px 0"}}>
              <BulkBar type={tab==="companies"?"company":"contact"} t={t}
                data={tab==="companies"?cos:cts} cos={cos}
                onImportCo={importCos} onImportCt={importCts}/>
            </div>
          )}
        </nav>

        {/* Content */}
        <main style={{padding:18}}>
          {tab==="deals"&&(
            <Kanban deals={fDl} cos={cos} cts={cts} t={t} lang={lang} currency={currency} stages={stages}
              onEdit={d=>setModal({type:"deal",data:d})}
              onDel={requestDelDl} onStage={chStage}
              onViewDeal={d=>setViewDeal({...dls.find(x=>x.id===d.id)})}
              fontSizeMode={pipelineFontSize}/>
          )}
          {tab==="companies"&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(265px,1fr))",gap:11}}>
              {fCo.map(co=>{const coD=dls.filter(d=>d.companyId===co.id);const coC=cts.filter(c=>c.companyId===co.id);const ch=(co.name.charCodeAt(0)*47)%360;return(<div key={co.id} style={{background:"#ffffff",border:"1px solid #b8d8eb",borderRadius:13,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{width:38,height:38,borderRadius:9,background:`hsl(${ch},55%,14%)`,border:`1px solid hsl(${ch},55%,28%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:`hsl(${ch},75%,60%)`,marginBottom:9,fontFamily:"'DM Sans',Arial,sans-serif"}}>{co.name.charAt(0).toUpperCase()}</div><div style={{fontSize:14,fontWeight:600,color:"#1a2a3a"}}>{co.name}</div>{co.industry&&<div style={{fontSize:11,color:"#6b7d8e",marginTop:1}}>{co.industry}</div>}</div><div style={{display:"flex",gap:3}}><button onClick={()=>setModal({type:"company",data:co})} style={{background:"none",border:"none",color:"#003e7e",cursor:"pointer",padding:3,opacity:.7}}><Ic n="edit" s={12}/></button><button onClick={()=>requestDelCo(co.id)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",padding:3,opacity:.65}}><Ic n="trash" s={12}/></button></div></div><div style={{borderTop:"1px solid #b8d8eb",marginTop:11,paddingTop:9,display:"flex",flexDirection:"column",gap:4}}>{co.phone&&<div style={{fontSize:11,color:"#5a6b7a"}}>📞 {co.phone}</div>}{co.website&&<div style={{fontSize:11,color:"#003e7e",display:"flex",alignItems:"center",gap:3}}><Ic n="globe" s={10}/>{co.website}</div>}</div><div style={{display:"flex",gap:7,marginTop:9}}><span style={{fontSize:11,color:"#5a6b7a",background:"#f0f4f8",borderRadius:5,padding:"2px 7px"}}>💼 {coD.length} {t.dealsW}</span><span style={{fontSize:11,color:"#5a6b7a",background:"#f0f4f8",borderRadius:5,padding:"2px 7px"}}>👤 {coC.length} {t.contactsW}</span></div>{co.notes&&<div style={{fontSize:11,color:"#6b7d8e",marginTop:9,borderTop:"1px solid #b8d8eb",paddingTop:8,lineHeight:1.5}}>{co.notes}</div>}</div>);})}
              {fCo.length===0&&<div style={{color:"#c8d6e4",padding:40,fontFamily:"'JetBrains Mono',monospace",fontSize:12,gridColumn:"1/-1",textAlign:"center"}}>{t.noCompanies}</div>}
            </div>
          )}
          {tab==="contacts"&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(245px,1fr))",gap:11}}>
              {fCt.map(ct=>{const co=cos.find(c=>c.id===ct.companyId);const ch=(ct.name.charCodeAt(0)*83)%360;return(<div key={ct.id} style={{background:"#ffffff",border:"1px solid #b8d8eb",borderRadius:13,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div style={{display:"flex",gap:10,alignItems:"flex-start"}}><div style={{width:40,height:40,borderRadius:"50%",background:`hsl(${ch},50%,13%)`,border:`1px solid hsl(${ch},50%,26%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:`hsl(${ch},70%,58%)`,flexShrink:0,fontFamily:"'DM Sans',Arial,sans-serif"}}>{ct.name.charAt(0).toUpperCase()}</div><div><div style={{fontSize:14,fontWeight:600,color:"#1a2a3a"}}>{ct.name}</div>{ct.titleF&&<div style={{fontSize:11,color:"#7c2b83",marginTop:1}}>{ct.titleF}</div>}{co&&<div style={{fontSize:11,color:"#6b7d8e",marginTop:1}}>🏢 {co.name}</div>}</div></div><div style={{display:"flex",gap:3,flexShrink:0}}><button onClick={()=>setModal({type:"contact",data:ct})} style={{background:"none",border:"none",color:"#003e7e",cursor:"pointer",padding:3,opacity:.7}}><Ic n="edit" s={12}/></button><button onClick={()=>requestDelCt(ct.id)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",padding:3,opacity:.65}}><Ic n="trash" s={12}/></button></div></div><div style={{marginTop:10,display:"flex",flexDirection:"column",gap:4}}>{ct.email&&<div style={{fontSize:11,color:"#5a6b7a"}}>✉️ {ct.email}</div>}{ct.phone&&<div style={{fontSize:11,color:"#5a6b7a"}}>📞 {ct.phone}</div>}{ct.linkedin&&<div style={{fontSize:11,color:"#003e7e",display:"flex",alignItems:"center",gap:3}}><Ic n="link" s={10}/><a href={ct.linkedin.startsWith('http')?ct.linkedin:`https://${ct.linkedin}`} target="_blank" rel="noopener noreferrer" style={{color:"#003e7e",textDecoration:"underline",wordBreak:"break-all"}}>{ct.linkedin}</a></div>}</div>{ct.notes&&<div style={{fontSize:11,color:"#6b7d8e",marginTop:9,borderTop:"1px solid #b8d8eb",paddingTop:8,lineHeight:1.5}}>{ct.notes}</div>}</div>);})}
              {fCt.length===0&&<div style={{color:"#c8d6e4",padding:40,fontFamily:"'JetBrains Mono',monospace",fontSize:12,gridColumn:"1/-1",textAlign:"center"}}>{t.noContacts}</div>}
            </div>
          )}
          {tab==="activities"&&(
            <ActivitiesDashboard dls={dls} t={t} onUpdateActivityStatus={updateActivityStatus} onOpenActivity={openDealActivities}/>
          )}
          {tab==="users"&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:11}}>
              {fUs.map(u=>(
                <div key={u.id} style={{background:"#ffffff",border:"1px solid #b8d8eb",borderRadius:13,padding:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:600,color:"#1a2a3a"}}>{u.name}</div>
                      <div style={{fontSize:11,color:"#7c2b83",marginTop:1}}>@{u.alias}</div>
                    </div>
                    <div style={{display:"flex",gap:3}}>
                      <button onClick={()=>setModal({type:"user",data:u})} style={{background:"none",border:"none",color:"#003e7e",cursor:"pointer",padding:3,opacity:.7}}><Ic n="edit" s={12}/></button>
                      <button onClick={()=>requestDelUsr(u.id)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",padding:3,opacity:.65}}><Ic n="trash" s={12}/></button>
                    </div>
                  </div>
                  <div style={{marginTop:8,fontSize:11,color:"#5a6b7a"}}>✉️ {u.email}</div>
                </div>
              ))}
              {fUs.length===0&&<div style={{color:"#c8d6e4",padding:40,fontFamily:"'JetBrains Mono',monospace",fontSize:12,gridColumn:"1/-1",textAlign:"center"}}>{t.noUsers}</div>}
            </div>
          )}
        </main>
      </div>

      {/* Deal Detail / MEDDIC modal */}
      {viewDeal&&(
        <DealDetailModal
          deal={viewDeal}
          cos={cos} cts={cts} users={users} lang={lang} currency={currency} stages={stages} t={t}
          onSaveEval={ev=>saveEval(viewDeal.id,ev)}
          onDeleteEval={evalId=>deleteEval(viewDeal.id,evalId)}
          onAddActivity={activity=>addActivity(viewDeal.id,activity)}
          onDeleteActivity={activityId=>deleteActivity(viewDeal.id,activityId)}
          onUpdateActivityStatus={(activityId,status)=>updateActivityStatus(viewDeal.id,activityId,status)}
          onUpdateActivity={(activityId,patch)=>updateActivity(viewDeal.id,activityId,patch)}
          onEditDeal={()=>{setModal({type:"deal",data:viewDeal});setViewDeal(null);}}
          onClose={()=>setViewDeal(null)}/>
      )}

      {modal?.type==="company"&&<Modal title={modal.data.id?t.editCompany:t.newCompanyTitle} onClose={()=>setModal(null)}><CoForm init={modal.data} t={t} onSave={saveCo} onClose={()=>setModal(null)}/></Modal>}
      {modal?.type==="contact"&&<Modal title={modal.data.id?t.editContact:t.newContactTitle} onClose={()=>setModal(null)}><CtForm init={modal.data} cos={cos} t={t} onSave={saveCt} onClose={()=>setModal(null)}/></Modal>}
      {modal?.type==="user"&&<Modal title={modal.data.id?t.editUser:t.newUserTitle} onClose={()=>setModal(null)}><UsrForm init={modal.data} t={t} onSave={saveUsr} onClose={()=>setModal(null)}/></Modal>}
      {modal?.type==="deal"&&<Modal title={modal.data.id?t.editDeal:t.newDealTitle} onClose={()=>setModal(null)}><DlForm init={modal.data} cos={cos} cts={cts} t={t} lang={lang} currency={currency} stages={stages} onSave={saveDl} onClose={()=>setModal(null)}/></Modal>}

      {/* Confirm Delete Dialog */}
      <ConfirmDeleteModal config={confirmDel} t={t} onClose={()=>setConfirmDel(null)}/>

      {/* Pipeline Editor */}
      {pipelineEditorOpen&&(
        <PipelineEditor stages={stages} dls={dls} t={t}
          onSave={s=>setStages(s)} onClose={()=>setPipelineEditorOpen(false)}/>
      )}
    </>
  );
}

// ─── App (wraps AppInner with CRMProvider) ────────────────────────────────────
export default function App(){
  return(
    <CRMProvider>
      <AppInner/>
    </CRMProvider>
  );
}
