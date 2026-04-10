import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { crmReducer, initialDataState } from "./crmReducer.js";
import { storageGet } from "../lib/supabaseOps.js";

const CRMContext = createContext(null);

export const useCRM = () => useContext(CRMContext);

export function CRMProvider({ children, sampleData, defaultStages }) {
  const [data, dispatch] = useReducer(crmReducer, {
    ...initialDataState,
    stages: defaultStages,
  });
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const initialLoadDone = useRef(false);
  const canAutoSave = useRef(true);

  const reloadFromSupabase = useCallback(async () => {
    const loaded = await storageGet({
      supabase,
      SAMPLE_DATA: sampleData,
      DEFAULT_STAGES: defaultStages,
    });
    canAutoSave.current = loaded.__source === "supabase";
    dispatch({
      type: "LOAD",
      payload: {
        cos: loaded.co,
        cts: loaded.ct,
        dls: loaded.dl,
        users: loaded.users || [],
        currency: loaded.currency || "USD",
        stages: loaded.stages || defaultStages,
      },
    });
    return loaded;
  }, [sampleData, defaultStages]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await storageGet({
        supabase,
        SAMPLE_DATA: sampleData,
        DEFAULT_STAGES: defaultStages,
      });
      if (!cancelled) {
        canAutoSave.current = loaded.__source === "supabase";
        dispatch({
          type: "LOAD",
          payload: {
            cos: loaded.co,
            cts: loaded.ct,
            dls: loaded.dl,
            users: loaded.users || [],
            currency: loaded.currency || "USD",
            stages: loaded.stages || defaultStages,
          },
        });
        setLoading(false);
        setTimeout(() => {
          initialLoadDone.current = true;
        }, 50);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sampleData, defaultStages]);

  useEffect(() => {
    if (!supabase) return;

    const tables = ['deals', 'deal_activities', 'meddic_evals', 'companies', 'contacts', 'pipeline_stages', 'crm_users'];
    const channels = tables.map((table) =>
      supabase
        .channel(`crm-realtime-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, async () => {
          if (!initialLoadDone.current) return;
          await reloadFromSupabase();
        })
        .subscribe()
    );

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [reloadFromSupabase]);

  const ctx = useMemo(
    () => ({
      ...data,
      dispatch,
      loading,
      saveStatus,
      saveMessage,
      setSaveStatus,
      setSaveMessage,
      reloadFromSupabase,
      setCos: (p) => dispatch({ type: "SET_COS", payload: p }),
      setCts: (p) => dispatch({ type: "SET_CTS", payload: p }),
      setDls: (p) => dispatch({ type: "SET_DLS", payload: p }),
      setUsers: (p) => dispatch({ type: "SET_USERS", payload: p }),
      setCurrency: (v) => dispatch({ type: "SET_CURRENCY", payload: v }),
      setStages: (v) => dispatch({ type: "SET_STAGES", payload: v }),
      canAutoSave,
    }),
    [data, loading, saveStatus, saveMessage, reloadFromSupabase]
  );

  return <CRMContext.Provider value={ctx}>{children}</CRMContext.Provider>;
}
