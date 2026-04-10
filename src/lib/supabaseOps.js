export async function supabaseLoad({ supabase, DEFAULT_STAGES }) {
  if (!supabase) return null;
  try {
    const [
      { data: cos },
      { data: cts },
      { data: dlsRaw },
      { data: evals },
      { data: stagesRaw },
      { data: usersRaw },
      { data: projectionsRaw },
    ] = await Promise.all([
      supabase.from('companies').select('*').order('created_at'),
      supabase.from('contacts').select('*').order('created_at'),
      supabase.from('deals').select('*').order('created_at'),
      supabase.from('meddic_evals').select('*').order('date'),
      supabase.from('pipeline_stages').select('*').order('position'),
      supabase.from('crm_users').select('*').order('created_at'),
      supabase.from('deal_projections').select('*'),
    ]);

    let activities = [];
    try {
      const { data } = await supabase.from('deal_activities').select('*').order('due_date');
      activities = data || [];
    } catch {}

    const projectionByDealId = new Map((projectionsRaw || []).map((p) => [p.deal_id, p]));

    const dls = (dlsRaw || []).map((d) => {
      const projection = projectionByDealId.get(d.id);
      const projectionMode = projection?.mode === 'custom_months'
        ? (Number(projection?.custom_months) === 6 ? 'custom_months_6' : 'custom_months')
        : (projection?.mode || 'one_time');
      return {
        ...d,
        value: Number(d.value),
        projectionMode,
        projectionCustomMonths: projection?.custom_months || null,
        meddicHistory: (evals || [])
          .filter((e) => e.deal_id === d.id)
          .map((e) => ({ id: e.id, date: e.date, meddic: e.meddic })),
        activities: (activities || [])
          .filter((a) => a.deal_id === d.id)
          .map((a) => ({
            id: a.id,
            type: a.type,
            title: a.title,
            dueDate: a.due_date,
            responsible: a.responsible,
            status: a.status,
            comment: a.comment || "",
            createdAt: a.created_at,
            updatedAt: a.updated_at,
          })),
      };
    });

    const stages = stagesRaw && stagesRaw.length > 0
      ? stagesRaw.map((s) => ({
          id: s.id,
          name: s.name,
          emoji: s.emoji,
          bg: s.bg,
          border: s.border,
          accent: s.accent,
          isWon: s.is_won,
          isLost: s.is_lost,
        }))
      : null;

    return { co: cos || [], ct: cts || [], dl: dls, stages, users: usersRaw || [] };
  } catch (err) {
    console.error('Supabase load error:', err);
    return null;
  }
}

export async function storageGet({ supabase, SAMPLE_DATA, DEFAULT_STAGES }) {
  const sbData = await supabaseLoad({ supabase, DEFAULT_STAGES });
  if (sbData) {
    return {
      co: sbData.co,
      ct: sbData.ct.map((c) => ({ ...c, titleF: c.title_f, companyId: c.company_id })),
      dl: sbData.dl.map((d) => ({
        ...d,
        companyId: d.company_id,
        contactId: d.contact_id,
        closingDate: d.closing_date,
        leadSource: d.lead_source || "",
        leadSourceCustom: d.lead_source_custom || "",
      })),
      users: sbData.users || SAMPLE_DATA.users,
      currency: SAMPLE_DATA.currency || "USD",
      stages: sbData.stages || DEFAULT_STAGES,
      __source: "supabase",
    };
  }

  return {
    co: [],
    ct: [],
    dl: [],
    users: SAMPLE_DATA.users || [],
    currency: "USD",
    stages: DEFAULT_STAGES,
    __source: "empty",
  };
}
