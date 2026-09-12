function dedupeById(items = []) {
  const map = new Map();
  items.forEach((item) => {
    if (!item?.id) return;
    map.set(item.id, item);
  });
  return Array.from(map.values());
}

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
    ] = await Promise.all([
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

    let journalEntries = [];
    let journalEnabled = false;
    try {
      const { data, error } = await supabase.from('deal_journal_entries').select('*').order('created_at');
      if (error) throw error;
      journalEntries = data || [];
      journalEnabled = true;
    } catch {}

    const dls = (dlsRaw || []).map((d) => ({
      ...d,
      value: Number(d.value),
      pipelineType: d.pipeline_type || (d.lead_source_custom === 'USA Handover - Michael' ? 'usa_handover' : 'mexico'),
      leadSource: d.lead_source || '',
      leadSourceCustom: d.lead_source_custom || '',
      priorityRank: d.priority_rank ?? null,
      previousOwner: d.previous_owner || '',
      currentOwner: d.current_owner || '',
      productInterest: d.product_interest || '',
      nextBestAction: d.next_best_action || '',
      transitionEmailStatus: d.transition_email_status || '',
      transitionEmailDraft: d.transition_email_draft || '',
      opencrmAccountId: d.opencrm_account_id || '',
      opencrmAccountUrl: d.opencrm_account_url || '',
      workCompletedSummary: d.work_completed_summary || '',
      stageChangedAt: d.stage_changed_at || null,
      meddicHistory: (evals || [])
        .filter((e) => e.deal_id === d.id)
        .map((e) => ({ id: e.id, date: e.date, meddic: e.meddic })),
      activities: dedupeById(
        (activities || [])
          .filter((a) => a.deal_id === d.id)
          .map((a) => ({
            id: a.id,
            type: a.type,
            title: a.title,
            dueDate: a.due_date,
            responsible: a.responsible,
            status: a.status,
            comment: a.comment || "",
            importanceScore: a.importance_score ?? null,
            urgencyScore: a.urgency_score ?? null,
            eisenhowerScore: a.eisenhower_score ?? ((a.importance_score != null && a.urgency_score != null) ? Number(a.importance_score || 0) + Number(a.urgency_score || 0) : null),
            createdAt: a.created_at,
            updatedAt: a.updated_at,
          }))
      ),
      journalEntries: dedupeById(
        (journalEntries || [])
          .filter((entry) => entry.deal_id === d.id)
          .map((entry) => ({
            id: entry.id,
            source: entry.source,
            kind: entry.entry_type,
            title: entry.title || "",
            content: entry.content || "",
            author: entry.author || "",
            meta: entry.meta || {},
            createdAt: entry.created_at,
          }))
      ),
    }));

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
          pipelineType: s.pipeline_type || (String(s.name || '').startsWith('USA Handover | ') ? 'usa_handover' : 'mexico'),
        }))
      : null;

    return { co: cos || [], ct: cts || [], dl: dls, stages, users: usersRaw || [], journalEnabled };
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
        pipelineType: d.pipeline_type || (d.lead_source_custom === 'USA Handover - Michael' ? 'usa_handover' : 'mexico'),
        leadSource: d.lead_source || "",
        leadSourceCustom: d.lead_source_custom || "",
        priorityRank: d.priority_rank ?? null,
        previousOwner: d.previous_owner || "",
        currentOwner: d.current_owner || "",
        productInterest: d.product_interest || "",
        nextBestAction: d.next_best_action || "",
        transitionEmailStatus: d.transition_email_status || "",
        transitionEmailDraft: d.transition_email_draft || "",
        opencrmAccountId: d.opencrm_account_id || "",
        opencrmAccountUrl: d.opencrm_account_url || "",
        workCompletedSummary: d.work_completed_summary || "",
        stageChangedAt: d.stage_changed_at || null,
      })),
      users: sbData.users || SAMPLE_DATA.users,
      currency: SAMPLE_DATA.currency || "USD",
      stages: sbData.stages || DEFAULT_STAGES,
      journalEnabled: !!sbData.journalEnabled,
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
    journalEnabled: false,
    __source: "empty",
  };
}
