import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient.js";

export default function ProspectingBoard({ lang, users = [], helpers, forms }) {
  const {
    uid,
    PROSPECTING_STATUSES,
    PROSPECTING_ACTIVITY_TYPES,
    PROSPECTING_ACTIVITY_STATUSES,
    Btn,
    Ic,
    Modal,
    iSx,
  } = helpers;
  const { ProspectingCompanyForm, ProspectingContactForm, ProspectingActivityForm } = forms;

  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [activeTab, setActiveTab] = useState("timeline");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const statusLabel = useCallback((status) => {
    const found = PROSPECTING_STATUSES.find((s) => s.value === status);
    return found ? found.label[lang] : status;
  }, [lang, PROSPECTING_STATUSES]);

  const activityTypeLabel = useCallback((type) => {
    const found = PROSPECTING_ACTIVITY_TYPES.find((s) => s.value === type);
    return found ? found.label[lang] : type;
  }, [lang, PROSPECTING_ACTIVITY_TYPES]);

  const loadProspecting = useCallback(async () => {
    setLoading(true);
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const [{ data: co }, { data: ct }, { data: ac }] = await Promise.all([
        supabase.from('prospecting_companies').select('*').order('updated_at', { ascending: false }),
        supabase.from('prospecting_contacts').select('*').order('created_at', { ascending: false }),
        supabase.from('prospecting_activities').select('*').order('activity_at', { ascending: false }),
      ]);
      setCompanies(co || []);
      setContacts(ct || []);
      setActivities(ac || []);
      if (!selectedCompanyId && (co || []).length) setSelectedCompanyId(co[0].id);
    } catch (e) {
      console.warn('Prospecting load skipped:', e?.message || e);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => { loadProspecting(); }, [loadProspecting]);

  const ownerOptions = useMemo(() => {
    const fromCompanies = companies.map((c) => c.owner_id).filter(Boolean);
    return [...new Set(fromCompanies)].sort((a, b) => String(a).localeCompare(String(b)));
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (ownerFilter !== 'all' && (c.owner_id || '') !== ownerFilter) return false;
      if (!q) return true;
      return (c.name || '').toLowerCase().includes(q);
    });
  }, [companies, statusFilter, ownerFilter, search]);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) || null;
  const companyContacts = contacts.filter((c) => c.company_id === selectedCompanyId && !c.is_archived);
  const companyActivities = activities.filter((a) => a.company_id === selectedCompanyId);

  const ensureOk = (result, op) => {
    if (result?.error) throw new Error(result.error.message || op);
    return result;
  };

  const guardedSave = async (fn) => {
    setSaveError("");
    setSaving(true);
    try {
      await fn();
      return true;
    } catch (e) {
      setSaveError(e?.message || 'No se pudo guardar');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const upsertCompany = async (payload) => {
    const row = {
      id: payload.id || uid(),
      name: payload.name?.trim(),
      status: payload.status || 'nueva',
      owner_id: payload.owner_id || null,
      industry: payload.industry || null,
      country: payload.country || null,
      company_size: payload.company_size || null,
      lead_source: payload.lead_source || null,
      priority: payload.priority || null,
      notes: payload.notes || null,
      updated_at: new Date().toISOString(),
    };
    if (!row.name) return;
    const ok = await guardedSave(async () => {
      ensureOk(await supabase.from('prospecting_companies').upsert([row], { onConflict: 'id' }), 'save prospecting company');
      await loadProspecting();
    });
    if (!ok) return;
    setSelectedCompanyId(row.id);
    setModal(null);
  };

  const upsertContact = async (payload) => {
    const row = {
      id: payload.id || uid(),
      company_id: payload.company_id || selectedCompanyId,
      name: payload.name?.trim(),
      title: payload.title || null,
      email: payload.email || null,
      phone: payload.phone || null,
      linkedin_url: payload.linkedin_url || null,
      notes: payload.notes || null,
      is_archived: false,
    };
    if (!row.company_id || !row.name) return;
    const ok = await guardedSave(async () => {
      ensureOk(await supabase.from('prospecting_contacts').upsert([row], { onConflict: 'id' }), 'save prospecting contact');
      await loadProspecting();
    });
    if (!ok) return;
    setModal(null);
  };

  const upsertActivity = async (payload) => {
    const row = {
      id: payload.id || uid(),
      company_id: payload.company_id || selectedCompanyId,
      contact_id: payload.contact_id || null,
      activity_type: payload.activity_type || 'investigacion',
      status: payload.status || 'pendiente',
      activity_at: payload.activity_at || new Date().toISOString(),
      outcome: payload.outcome || null,
      next_step: payload.next_step || null,
      next_action_at: payload.next_action_at || null,
      owner_id: payload.owner_id || null,
      notes: payload.notes || null,
      attachment_url: payload.attachment_url || null,
      updated_at: new Date().toISOString(),
    };
    if (!row.company_id) return;
    const ok = await guardedSave(async () => {
      ensureOk(await supabase.from('prospecting_activities').upsert([row], { onConflict: 'id' }), 'save prospecting activity');
      await loadProspecting();
    });
    if (!ok) return;
    setModal(null);
  };

  const deleteCompany = async (companyId) => {
    const totalContacts = contacts.filter((c) => c.company_id === companyId && !c.is_archived).length;
    const totalActivities = activities.filter((a) => a.company_id === companyId).length;
    const ok = window.confirm(`¿Borrar empresa y todo su historial de prospección?\n\nSe eliminarán ${totalContacts} contactos y ${totalActivities} actividades asociadas.`);
    if (!ok) return;
    const saved = await guardedSave(async () => {
      ensureOk(await supabase.from('prospecting_activities').delete().eq('company_id', companyId), 'delete prospecting activities');
      ensureOk(await supabase.from('prospecting_contacts').delete().eq('company_id', companyId), 'delete prospecting contacts');
      ensureOk(await supabase.from('prospecting_companies').delete().eq('id', companyId), 'delete prospecting company');
      await loadProspecting();
    });
    if (!saved) return;
    if (selectedCompanyId === companyId) {
      const remaining = companies.filter((c) => c.id !== companyId);
      setSelectedCompanyId(remaining[0]?.id || '');
      setActiveTab('timeline');
    }
  };

  const deleteContact = async (contactId) => {
    const ct = contacts.find((c) => c.id === contactId);
    if (!ct) return;
    const ok = window.confirm(`¿Borrar contacto "${ct.name}"?`);
    if (!ok) return;
    const saved = await guardedSave(async () => {
      ensureOk(await supabase.from('prospecting_activities').update({ contact_id: null }).eq('contact_id', contactId), 'unlink prospecting contact');
      ensureOk(await supabase.from('prospecting_contacts').delete().eq('id', contactId), 'delete prospecting contact');
      await loadProspecting();
    });
    if (!saved) return;
  };

  const deleteActivity = async (activityId) => {
    const ok = window.confirm('¿Borrar esta actividad de prospección?');
    if (!ok) return;
    const saved = await guardedSave(async () => {
      ensureOk(await supabase.from('prospecting_activities').delete().eq('id', activityId), 'delete prospecting activity');
      await loadProspecting();
    });
    if (!saved) return;
  };

  const updateProspectingActivityStatus = async (activityId, status) => {
    await guardedSave(async () => {
      ensureOk(await supabase.from('prospecting_activities').update({ status, updated_at: new Date().toISOString() }).eq('id', activityId), 'update prospecting activity status');
      await loadProspecting();
    });
  };

  if (loading) return <div style={{ padding: 20, fontSize: 12, color: '#64748b' }}>Cargando prospección...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {saveError && <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', borderRadius: 10, padding: '10px 12px', fontSize: 12 }}>{saveError}</div>}
      {saving && <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 10, padding: '10px 12px', fontSize: 12 }}>Guardando cambios en prospección…</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn ch={<><Ic n="plus" s={12} />Empresa</>} onClick={() => setModal({ type: 'company', data: {} })} disabled={saving} />
          <Btn v="subtle" ch={<><Ic n="plus" s={12} />Actividad</>} onClick={() => setModal({ type: 'activity', data: { company_id: selectedCompanyId } })} disabled={!selectedCompanyId || saving} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input placeholder="Buscar empresa..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...iSx, width: 180, padding: '6px 10px' }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...iSx, width: 160, padding: '6px 10px' }}>
            <option value="all">Todos estados</option>
            {PROSPECTING_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label[lang]}</option>)}
          </select>
          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} style={{ ...iSx, width: 160, padding: '6px 10px' }}>
            <option value="all">Todos owners</option>
            {ownerOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
        <div style={{ background: '#fff', border: '1px solid #cfd8e3', borderRadius: 12, overflow: 'hidden', boxShadow: '0 6px 18px rgba(15,23,42,.12)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, padding: '10px 12px', fontSize: 10, color: '#64748b', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase' }}>
            <div>Empresa</div><div>Estado</div><div>Owner</div><div>Próx. acción</div>
          </div>
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {filteredCompanies.map((c) => {
              const cActivities = activities.filter((a) => a.company_id === c.id);
              const nextDate = cActivities.map((a) => a.next_action_at).filter(Boolean).sort()[0] || '—';
              return (
                <button key={c.id} onClick={() => setSelectedCompanyId(c.id)} style={{ width: '100%', textAlign: 'left', background: selectedCompanyId === c.id ? '#eff6ff' : '#fff', border: 'none', borderTop: '1px solid #cfd8e3', padding: '10px 12px', cursor: 'pointer' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, fontSize: 12, color: '#0f172a', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div>{statusLabel(c.status)}</div>
                    <div>{c.owner_id || '—'}</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{nextDate ? String(nextDate).slice(0, 10) : '—'}</div>
                  </div>
                </button>
              );
            })}
            {!filteredCompanies.length && <div style={{ padding: 16, fontSize: 12, color: '#94a3b8' }}>Sin empresas de prospección.</div>}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #cfd8e3', borderRadius: 12, minHeight: 520, padding: 12, boxShadow: '0 6px 18px rgba(15,23,42,.12)' }}>
          {!selectedCompany ? (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Selecciona una empresa para ver detalle.</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>{selectedCompany.name}</h3>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#64748b' }}>
                    <span>{statusLabel(selectedCompany.status)}</span>
                    <span>•</span>
                    <span>{selectedCompany.owner_id || 'Sin owner'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Btn v="ghost" ch="Editar" onClick={() => setModal({ type: 'company', data: selectedCompany })} disabled={saving} />
                  <Btn v="subtle" ch="+ Contacto" onClick={() => setModal({ type: 'contact', data: { company_id: selectedCompany.id } })} disabled={saving} />
                  <Btn v="ghost" ch={<><Ic n="trash" s={11} />Borrar</>} sx={{ color: '#ef4444', border: '1px solid #ef444455' }} onClick={() => deleteCompany(selectedCompany.id)} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 12, borderBottom: '1px solid #e5edf5' }}>
                {[{ k: 'timeline', l: 'Timeline' }, { k: 'contacts', l: 'Contactos' }, { k: 'summary', l: 'Resumen' }].map((tb) => (
                  <button key={tb.k} onClick={() => setActiveTab(tb.k)} style={{ background: 'none', border: 'none', borderBottom: activeTab === tb.k ? '2px solid #003e7e' : '2px solid transparent', padding: '8px 10px', cursor: 'pointer', fontSize: 12, color: activeTab === tb.k ? '#003e7e' : '#64748b' }}>{tb.l}</button>
                ))}
              </div>

              {activeTab === 'timeline' && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 390, overflowY: 'auto' }}>
                  <Btn v="subtle" ch={<><Ic n="plus" s={12} />Nueva actividad</>} onClick={() => setModal({ type: 'activity', data: { company_id: selectedCompany.id } })} disabled={saving} />
                  {companyActivities.map((a) => {
                    const ctc = contacts.find((c) => c.id === a.contact_id);
                    return (
                      <div key={a.id} onClick={() => setModal({ type: 'activity', data: a })} style={{ background: '#f8fafc', border: '1px solid #cfd8e3', borderRadius: 10, padding: '10px 11px', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{activityTypeLabel(a.activity_type)} {ctc ? `· ${ctc.name}` : ''}</div>
                            <select value={a.status || 'pendiente'} onClick={(e) => e.stopPropagation()} onChange={(e) => updateProspectingActivityStatus(a.id, e.target.value)} style={{ ...iSx, width: 130, padding: '2px 8px', fontSize: 11, height: 24, background: '#eef4fa' }}>
                              {PROSPECTING_ACTIVITY_STATUSES.map((st) => <option key={st.value} value={st.value}>{st.label[lang]}</option>)}
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ fontSize: 10, color: '#64748b', fontFamily: "'JetBrains Mono',monospace" }}>{String(a.activity_at || '').slice(0, 16).replace('T', ' ')}</div>
                            <button title="Borrar actividad" onClick={(e) => { e.stopPropagation(); deleteActivity(a.id); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2, opacity: .7 }}><Ic n="trash" s={12} /></button>
                          </div>
                        </div>
                        {a.outcome && <div style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>Resultado: {a.outcome}</div>}
                        {a.next_step && <div style={{ fontSize: 11, color: '#334155' }}>Siguiente paso: {a.next_step}</div>}
                        {a.next_action_at && <div style={{ fontSize: 11, color: '#334155' }}>Próxima acción: {String(a.next_action_at).slice(0, 10)}</div>}
                        {a.notes && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, whiteSpace: 'pre-wrap' }}>{a.notes}</div>}
                      </div>
                    );
                  })}
                  {!companyActivities.length && <div style={{ fontSize: 12, color: '#94a3b8' }}>Sin actividades registradas.</div>}
                </div>
              )}

              {activeTab === 'contacts' && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 390, overflowY: 'auto' }}>
                  {companyContacts.map((c) => (
                    <div key={c.id} style={{ background: '#f8fafc', border: '1px solid #cfd8e3', borderRadius: 10, padding: '10px 11px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</div>
                        <button title="Borrar contacto" onClick={() => deleteContact(c.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2, opacity: .7 }}><Ic n="trash" s={12} /></button>
                      </div>
                      <div style={{ fontSize: 11, color: '#475569' }}>{[c.title, c.email, c.phone].filter(Boolean).join(' · ') || 'Sin datos adicionales'}</div>
                    </div>
                  ))}
                  {!companyContacts.length && <div style={{ fontSize: 12, color: '#94a3b8' }}>Sin contactos.</div>}
                </div>
              )}

              {activeTab === 'summary' && (
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #cfd8e3', borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Total actividades</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#003e7e' }}>{companyActivities.length}</div>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid #cfd8e3', borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Contactos activos</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#003e7e' }}>{companyContacts.length}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1', background: '#f8fafc', border: '1px solid #cfd8e3', borderRadius: 10, padding: 10, fontSize: 12, color: '#334155' }}>
                    {selectedCompany.notes || 'Sin notas de empresa.'}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {modal?.type === 'company' && (
        <Modal title={modal.data?.id ? 'Editar empresa de prospección' : 'Nueva empresa de prospección'} onClose={() => setModal(null)}>
          <ProspectingCompanyForm lang={lang} init={modal.data} users={users} onSave={upsertCompany} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'contact' && (
        <Modal title="Nuevo contacto de prospección" onClose={() => setModal(null)}>
          <ProspectingContactForm init={modal.data} onSave={upsertContact} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'activity' && (
        <Modal title={modal.data?.id ? 'Editar actividad de prospección' : 'Nueva actividad de prospección'} onClose={() => setModal(null)}>
          <ProspectingActivityForm lang={lang} init={modal.data} contacts={companyContacts} users={users} onSave={upsertActivity} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
