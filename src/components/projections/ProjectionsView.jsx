import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient.js";

const monthKey = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const monthStartUtc = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
const addUtcMonths = (date, months) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
const fmtMonth = (date, lang) => date.toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const fmtMoney = (n, currency = "USD") => new Intl.NumberFormat(currency === "MXN" ? "es-MX" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(n) || 0);

const STAGE_WEIGHT_HINTS = [
  { match: ["prospect", "prospecto"], weight: 0.1 },
  { match: ["qualif", "calific"], weight: 0.25 },
  { match: ["proposal", "propuesta"], weight: 0.5 },
  { match: ["negoci"], weight: 0.75 },
  { match: ["sample", "muestra"], weight: 0.85 },
  { match: ["won", "ganado"], weight: 1 },
  { match: ["lost", "perdido"], weight: 0 },
  { match: ["hold", "pause", "pausa", "congel"], weight: 0 },
];

const WON_STAGE_HINTS = ["won", "ganado", "closed won", "cerrado ganado"];

function inferStageWeight(stageName = "") {
  const v = String(stageName).toLowerCase();
  for (const rule of STAGE_WEIGHT_HINTS) {
    if (rule.match.some((token) => v.includes(token))) return rule.weight;
  }
  return 0.5;
}

function isWonStage(stageName = "", stages = []) {
  const exact = (stages || []).find((s) => s.name === stageName);
  if (exact?.isWon) return true;
  const v = String(stageName).toLowerCase();
  return WON_STAGE_HINTS.some((token) => v.includes(token));
}

function buildMonths() {
  const start = monthStartUtc(new Date());
  return Array.from({ length: 12 }, (_, idx) => addUtcMonths(start, idx));
}

function allocateDealValue(deal, projectionMode, customMonths, monthKeys) {
  const value = Number(deal.value) || 0;
  const effectiveClose = deal.wonAt || deal.won_at || deal.closingDate || deal.closing_date || new Date().toISOString();
  const closeKey = monthKey(effectiveClose);
  const closeIndex = monthKeys.indexOf(closeKey);
  if (closeIndex === -1 || value <= 0) return Array(monthKeys.length).fill(0);

  const arr = Array(monthKeys.length).fill(0);
  const mode = projectionMode || "one_time";

  if (mode === "twelve_months") {
    const perMonth = value / 12;
    for (let i = closeIndex; i < Math.min(closeIndex + 12, monthKeys.length); i += 1) arr[i] += perMonth;
    return arr;
  }

  if (mode === "custom_months") {
    const months = Math.max(1, Number(customMonths) || 1);
    const perMonth = value / months;
    for (let i = closeIndex; i < Math.min(closeIndex + months, monthKeys.length); i += 1) arr[i] += perMonth;
    return arr;
  }

  arr[closeIndex] += value;
  return arr;
}

function Sparkline({ values, color = "#27aae1" }) {
  const width = 220;
  const height = 72;
  const safe = values.length ? values : [0];
  const max = Math.max(...safe, 1);
  const min = Math.min(...safe, 0);
  const range = max - min || 1;
  const points = safe.map((v, i) => {
    const x = (i / Math.max(safe.length - 1, 1)) * (width - 8) + 4;
    const y = height - (((v - min) / range) * (height - 16) + 8);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <polyline fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={points} />
    </svg>
  );
}

function SectionCard({ title, subtitle, children, right }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 14, padding: 16, boxShadow: "0 6px 18px rgba(15,23,42,.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{subtitle}</div> : null}
        </div>
        {right || null}
      </div>
      {children}
    </div>
  );
}

function MiniLegend({ items }) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b" }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: item.color, display: "inline-block" }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function ProjectionModeSelect({ value, onChange, disabled, labels }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        background: "#f8fafc",
        border: "1px solid #cfd8e3",
        borderRadius: 10,
        padding: "8px 10px",
        color: "#0f172a",
        fontSize: 12,
        fontFamily: "inherit",
        outline: "none"
      }}
    >
      <option value="one_time">{labels.oneTime}</option>
      <option value="custom_3">{labels.threeMonths}</option>
      <option value="custom_6">{labels.sixMonths}</option>
      <option value="twelve_months">{labels.twelveMonths}</option>
    </select>
  );
}

function RevenueTypeSelect({ value, onChange, disabled, labels }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        background: "#f8fafc",
        border: "1px solid #cfd8e3",
        borderRadius: 10,
        padding: "8px 10px",
        color: "#0f172a",
        fontSize: 12,
        fontFamily: "inherit",
        outline: "none"
      }}
    >
      <option value="singleuse">{labels.singleuse}</option>
      <option value="multiuse">{labels.multiuse}</option>
      <option value="renta">{labels.renta}</option>
    </select>
  );
}

function MoneyInput({ value, onCommit, disabled, placeholder }) {
  const [draft, setDraft] = useState(value === '' || value === null || value === undefined ? '' : String(Number(value || 0)));

  useEffect(() => {
    setDraft(value === '' || value === null || value === undefined ? '' : String(Number(value || 0)));
  }, [value]);

  return (
    <input
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const parsed = Number(String(draft).replace(/[^0-9.-]/g, ""));
        onCommit(Number.isFinite(parsed) ? parsed : 0);
      }}
      style={{
        width: 120,
        background: disabled ? "#f1f5f9" : "#ffffff",
        border: "1px solid #cfd8e3",
        borderRadius: 8,
        padding: "7px 9px",
        color: "#0f172a",
        fontSize: 12,
        fontFamily: "inherit",
        outline: "none",
        textAlign: "right"
      }}
      inputMode="decimal"
    />
  );
}

function KpiCard({ title, value, subtitle, color }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 14, padding: 16, boxShadow: "0 6px 18px rgba(15,23,42,.08)" }}>
      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8, letterSpacing: 0.8, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || "#0f172a", marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b" }}>{subtitle}</div>
    </div>
  );
}

export default function ProjectionsView({ lang = "es", deals = [], stages = [], currency = "USD" }) {
  const [targets, setTargets] = useState([]);
  const [dealProjections, setDealProjections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingDealId, setSavingDealId] = useState("");
  const [savingMonthKey, setSavingMonthKey] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const load = useCallback(async () => {
    if (!supabase) {
      setError(lang === "es" ? "Supabase no está configurado en este entorno." : "Supabase is not configured in this environment.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [{ data: targetsData, error: targetsError }, { data: projectionsData, error: projectionsError }] = await Promise.all([
        supabase.from("monthly_targets_actuals").select("*").order("month_start", { ascending: true }),
        supabase.from("deal_projections").select("*")
      ]);
      if (targetsError) throw targetsError;
      if (projectionsError) throw projectionsError;
      setTargets(targetsData || []);
      setDealProjections(projectionsData || []);
    } catch (err) {
      console.error("load projections error", err);
      setError(err?.message || (lang === "es" ? "No se pudieron cargar las proyecciones." : "Could not load projections."));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    load();
  }, [load]);

  const dealRows = useMemo(() => {
    const projectionMap = new Map((dealProjections || []).map((row) => [row.deal_id, row]));
    return (deals || [])
      .filter((deal) => {
        const stage = String(deal.stage || "").toLowerCase();
        return !stage.includes("lost") && !stage.includes("perdido") && !stage.includes("hold") && !stage.includes("pausa") && !stage.includes("congel");
      })
      .sort((a, b) => String(a.closingDate || a.closing_date || "").localeCompare(String(b.closingDate || b.closing_date || "")))
      .map((deal) => {
        const projection = projectionMap.get(deal.id) || null;
        const uiMode = projection?.mode === "custom_months"
          ? (Number(projection?.custom_months) === 6 ? "custom_6" : "custom_3")
          : (projection?.mode || "one_time");
        return {
          id: deal.id,
          name: deal.name,
          company: deal.company || deal.companyName || "",
          stage: deal.stage,
          value: Number(deal.value) || 0,
          closingDate: (isWonStage(deal.stage, stages) ? (deal.wonAt || deal.won_at || deal.closingDate || deal.closing_date || "") : (deal.closingDate || deal.closing_date || "")),
          uiMode,
          revenueType: projection?.revenue_type || "singleuse",
        };
      });
  }, [deals, dealProjections]);

  const saveProjectionMode = useCallback(async (dealId, uiMode) => {
    if (!supabase) return;
    const current = (dealProjections || []).find((row) => row.deal_id === dealId) || {};
    const payload = uiMode === "custom_6"
      ? { deal_id: dealId, mode: "custom_months", custom_months: 6, revenue_type: current.revenue_type || "singleuse" }
      : uiMode === "custom_3"
      ? { deal_id: dealId, mode: "custom_months", custom_months: 3, revenue_type: current.revenue_type || "singleuse" }
      : uiMode === "twelve_months"
      ? { deal_id: dealId, mode: "twelve_months", custom_months: null, revenue_type: current.revenue_type || "singleuse" }
      : { deal_id: dealId, mode: "one_time", custom_months: null, revenue_type: current.revenue_type || "singleuse" };

    setSavingDealId(dealId);
    setError("");
    setSuccessMessage("");
    const { error: upsertError } = await supabase.from("deal_projections").upsert([payload], { onConflict: "deal_id" });
    setSavingDealId("");
    if (upsertError) {
      setError(upsertError.message || (lang === "es" ? "No se pudo guardar la proyección del deal." : "Could not save deal projection."));
      await load();
      return;
    }
    setDealProjections((prev) => {
      const others = (prev || []).filter((row) => row.deal_id !== dealId);
      return [...others, payload];
    });
    setSuccessMessage(lang === 'es' ? 'Proyección guardada.' : 'Projection saved.');
  }, [dealProjections, lang, load]);

  const saveRevenueType = useCallback(async (dealId, revenueType) => {
    if (!supabase) return;
    const current = (dealProjections || []).find((row) => row.deal_id === dealId) || {};
    const payload = {
      deal_id: dealId,
      mode: current.mode || 'one_time',
      custom_months: current.custom_months ?? null,
      revenue_type: revenueType,
    };

    setSavingDealId(dealId);
    setError("");
    setSuccessMessage("");
    const { error: upsertError } = await supabase.from('deal_projections').upsert([payload], { onConflict: 'deal_id' });
    setSavingDealId("");
    if (upsertError) {
      setError(upsertError.message || (lang === 'es' ? 'No se pudo guardar el tipo de deal.' : 'Could not save deal type.'));
      await load();
      return;
    }
    setDealProjections((prev) => {
      const others = (prev || []).filter((row) => row.deal_id !== dealId);
      return [...others, payload];
    });
    setSuccessMessage(lang === 'es' ? 'Tipo de deal guardado.' : 'Deal type saved.');
  }, [dealProjections, lang, load]);

  const saveMonthlyField = useCallback(async (rowKey, field, nextValue) => {
    if (!supabase) return;
    setSavingMonthKey(`${rowKey}:${field}`);
    setError("");
    setSuccessMessage("");

    const existing = (targets || []).find((row) => monthKey(row.month_start) === rowKey);
    const payload = {
      month_start: `${rowKey}-01`,
      budget_amount: field === 'budget_amount' ? nextValue : Number(existing?.budget_amount || 0),
      actual_amount: field === 'actual_amount' ? nextValue : Number(existing?.actual_amount || 0),
      expected_expense_amount: field === 'expected_expense_amount' ? nextValue : Number(existing?.expected_expense_amount || 0),
    };

    const { error: upsertError } = await supabase.from('monthly_targets_actuals').upsert([payload], { onConflict: 'month_start' });
    setSavingMonthKey("");
    if (upsertError) {
      setError(upsertError.message || (lang === 'es' ? 'No se pudo guardar el valor mensual.' : 'Could not save monthly value.'));
      await load();
      return;
    }
    setTargets((prev) => {
      const prevRows = prev || [];
      const current = prevRows.find((row) => monthKey(row.month_start) === rowKey);
      if (current) {
        return prevRows.map((row) => monthKey(row.month_start) === rowKey ? { ...row, [field]: nextValue } : row);
      }
      return [...prevRows, payload];
    });
    setSuccessMessage(lang === 'es' ? 'Valor mensual guardado.' : 'Monthly value saved.');
  }, [lang, load, targets]);

  const model = useMemo(() => {
    const months = buildMonths();
    const keys = months.map(monthKey);
    const targetMap = new Map((targets || []).map((row) => [monthKey(row.month_start), row]));
    const projectionMap = new Map((dealProjections || []).map((row) => [row.deal_id, row]));
    const stageMap = new Map((stages || []).map((s) => [s.name, s]));

    const rows = months.map((m) => ({
      key: monthKey(m),
      label: fmtMonth(m, lang),
      estimatedPipeline: 0,
      weightedPipeline: 0,
      corporateTarget: Number(targetMap.get(monthKey(m))?.budget_amount) || 0,
      actualSales: 0,
      actualSalesAuto: 0,
      actualSalesManual: null,
      expectedExpenses: Number(targetMap.get(monthKey(m))?.expected_expense_amount) || 0,
    }));

    const activeDeals = (deals || []).filter((deal) => {
      const stage = String(deal.stage || "").toLowerCase();
      return !stage.includes("lost") && !stage.includes("perdido") && !stage.includes("hold") && !stage.includes("pausa") && !stage.includes("congel");
    });

    activeDeals.forEach((deal) => {
      const projection = projectionMap.get(deal.id) || null;
      const alloc = allocateDealValue(deal, projection?.mode, projection?.custom_months, keys);
      const stageWeight = stageMap.has(deal.stage) ? inferStageWeight(stageMap.get(deal.stage)?.name) : inferStageWeight(deal.stage);
      alloc.forEach((amount, idx) => {
        rows[idx].estimatedPipeline += amount;
        rows[idx].weightedPipeline += amount * stageWeight;
      });
    });

    (deals || []).forEach((deal) => {
      if (!isWonStage(deal.stage, stages)) return;
      const wonKey = monthKey(deal.wonAt || deal.won_at || deal.closingDate || deal.closing_date || "");
      const idx = keys.indexOf(wonKey);
      if (idx === -1) return;
      rows[idx].actualSalesAuto += Number(deal.value) || 0;
    });

    rows.forEach((row) => {
      const targetRow = targetMap.get(row.key);
      const manualValue = targetRow?.actual_amount;
      row.actualSalesManual = manualValue === null || manualValue === undefined ? null : Number(manualValue) || 0;
      row.actualSales = row.actualSalesManual !== null ? row.actualSalesManual : row.actualSalesAuto;
    });

    let cumulativeEstimated = 0;
    let cumulativeWeighted = 0;
    let cumulativeTarget = 0;
    let cumulativeActual = 0;
    let cumulativeExpenses = 0;
    rows.forEach((row) => {
      cumulativeEstimated += row.estimatedPipeline;
      cumulativeWeighted += row.weightedPipeline;
      cumulativeTarget += row.corporateTarget;
      cumulativeActual += row.actualSales;
      cumulativeExpenses += row.expectedExpenses;
      row.cumulativeEstimated = cumulativeEstimated;
      row.cumulativeWeighted = cumulativeWeighted;
      row.cumulativeTarget = cumulativeTarget;
      row.cumulativeActual = cumulativeActual;
      row.cumulativeExpenses = cumulativeExpenses;
    });

    const totals = rows.reduce((acc, row) => ({
      estimatedPipeline: acc.estimatedPipeline + row.estimatedPipeline,
      weightedPipeline: acc.weightedPipeline + row.weightedPipeline,
      corporateTarget: acc.corporateTarget + row.corporateTarget,
      actualSales: acc.actualSales + row.actualSales,
      expectedExpenses: acc.expectedExpenses + row.expectedExpenses,
    }), { estimatedPipeline: 0, weightedPipeline: 0, corporateTarget: 0, actualSales: 0, expectedExpenses: 0 });

    return { rows, totals, dealsCovered: activeDeals.length };
  }, [targets, dealProjections, deals, stages, lang]);

  const copy = {
    es: {
      title: "Proyecciones",
      subtitle: "Restaurado desde backend de Supabase. Esta vista usa monthly_targets_actuals + deal_projections + deals activos.",
      coverageNote: "Cobertura automática: si un deal no tiene configuración en deal_projections, entra por default como one_time en su mes de cierre.",
      monthlyDetail: "Vista ejecutiva rolling de 12 meses con cálculo simple y ponderado por etapa.",
      dealConfigTitle: "Configuración por deal",
      dealConfigSubtitle: "Aquí sí vive el selector por deal. Cambia el período sin tocar el resto del CRM.",
      dealName: "Deal",
      dealStage: "Stage",
      dealValue: "Valor",
      dealClose: "Cierre",
      dealMode: "Período",
      revenueType: "Tipo de deal",
      oneTime: "Pago único",
      multiuse: "Venta Multiuse",
      renta: "Renta",
      singleuse: "Venta Singleuse",
      threeMonths: "3 meses",
      sixMonths: "6 meses",
      twelveMonths: "12 meses",
      saving: "Guardando...",
      editableHint: "Corporate Target (HQ) y Expected Expenses se pueden editar aquí. Actual Sales funciona en modo híbrido: toma automático desde deals ganados y permite override manual por mes.",
      refresh: "Refrescar",
      loading: "Cargando proyecciones...",
      noData: "No hay datos todavía.",
      estimated: "Estimated Pipeline (MX)",
      weighted: "Weighted Pipeline",
      target: "Corporate Target (HQ)",
      actual: "Actual Sales",
      actualAuto: "Actual Sales (Auto)",
      actualManual: "Actual Sales (Manual Override)",
      expenses: "Expected Expenses",
      monthlyTable: "Tabla mensual (12 meses)",
      cumulative: "Comparative Cumulative",
      breakEven: "Break-even Cumulative (Focus)",
      weightedBreakEven: "Weighted Break-even Cumulative (by Stage)",
      month: "Month",
      total12: "Total 12m",
      coveredDeals: "deals considerados",
      source: "Fuente",
      sourceText: "monthly_targets_actuals · deal_projections · deals",
    },
    en: {
      title: "Projections",
      subtitle: "Restored from Supabase backend. This view uses monthly_targets_actuals + deal_projections + active deals.",
      coverageNote: "Automatic coverage: if a deal has no row in deal_projections, it defaults to one_time on its closing month.",
      monthlyDetail: "Rolling 12-month executive view with simple and stage-weighted calculation.",
      dealConfigTitle: "Per-deal configuration",
      dealConfigSubtitle: "The selector lives here, inside Projections, without touching the rest of the CRM.",
      dealName: "Deal",
      dealStage: "Stage",
      dealValue: "Value",
      dealClose: "Close",
      dealMode: "Period",
      revenueType: "Deal type",
      oneTime: "One-time",
      multiuse: "Multiuse Sale",
      renta: "Rental",
      singleuse: "Singleuse Sale",
      threeMonths: "3 months",
      sixMonths: "6 months",
      twelveMonths: "12 months",
      saving: "Saving...",
      editableHint: "Corporate Target (HQ) and Expected Expenses can be edited here. Actual Sales runs in hybrid mode: auto from won deals with optional monthly manual override.",
      refresh: "Refresh",
      loading: "Loading projections...",
      noData: "No data yet.",
      estimated: "Estimated Pipeline (MX)",
      weighted: "Weighted Pipeline",
      target: "Corporate Target (HQ)",
      actual: "Actual Sales",
      actualAuto: "Actual Sales (Auto)",
      actualManual: "Actual Sales (Manual Override)",
      expenses: "Expected Expenses",
      monthlyTable: "Monthly table (12 months)",
      cumulative: "Comparative Cumulative",
      breakEven: "Break-even Cumulative (Focus)",
      weightedBreakEven: "Weighted Break-even Cumulative (by Stage)",
      month: "Month",
      total12: "Total 12m",
      coveredDeals: "deals covered",
      source: "Source",
      sourceText: "monthly_targets_actuals · deal_projections · deals",
    }
  }[lang] || {
    title: "Projections",
    subtitle: "",
    coverageNote: "",
    monthlyDetail: "",
    dealConfigTitle: "Per-deal configuration",
    dealConfigSubtitle: "",
    dealName: "Deal",
    dealStage: "Stage",
    dealValue: "Value",
    dealClose: "Close",
    dealMode: "Period",
    revenueType: "Deal type",
    oneTime: "One-time",
    multiuse: "Multiuse Sale",
    renta: "Rental",
    singleuse: "Singleuse Sale",
    threeMonths: "3 months",
    sixMonths: "6 months",
    twelveMonths: "12 months",
    saving: "Saving...",
    editableHint: "",
    refresh: "Refresh",
    loading: "Loading...",
    noData: "No data.",
    estimated: "Estimated Pipeline (MX)",
    weighted: "Weighted Pipeline",
    target: "Corporate Target (HQ)",
    actual: "Actual Sales",
    actualAuto: "Actual Sales (Auto)",
    actualManual: "Actual Sales (Manual Override)",
    expenses: "Expected Expenses",
    monthlyTable: "Monthly table",
    cumulative: "Comparative Cumulative",
    breakEven: "Break-even Cumulative (Focus)",
    weightedBreakEven: "Weighted Break-even Cumulative (by Stage)",
    month: "Month",
    total12: "Total 12m",
    coveredDeals: "deals covered",
    source: "Source",
    sourceText: "",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>{copy.title}</div>
          <div style={{ fontSize: 12, color: "#64748b", maxWidth: 780 }}>{copy.subtitle}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>{copy.source}: {copy.sourceText}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 8, maxWidth: 820 }}>{copy.coverageNote}</div>
        </div>
        <button onClick={load} style={{ background: "#eef2f7", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{copy.refresh}</button>
      </div>

      {loading && <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 14, padding: 18, color: "#64748b" }}>{copy.loading}</div>}
      {!loading && error && <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 14, padding: 18, color: "#be123c" }}>{error}</div>}
      {!loading && !error && successMessage && <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 14, padding: 14, color: "#047857", fontSize: 12 }}>{successMessage}</div>}
      {!loading && !error && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <KpiCard title={copy.estimated} value={fmtMoney(model.totals.estimatedPipeline, currency)} subtitle={`${model.dealsCovered} ${copy.coveredDeals}`} color="#003e7e" />
            <KpiCard title={copy.weighted} value={fmtMoney(model.totals.weightedPipeline, currency)} subtitle={copy.weightedBreakEven} color="#7c2b83" />
            <KpiCard title={copy.target} value={fmtMoney(model.totals.corporateTarget, currency)} subtitle="HQ" color="#5e9732" />
            <KpiCard title={copy.actual} value={fmtMoney(model.totals.actualSales, currency)} subtitle="Closed / booked" color="#16a34a" />
            <KpiCard title={copy.expenses} value={fmtMoney(model.totals.expectedExpenses, currency)} subtitle="12 months" color="#ef4444" />
          </div>

          <SectionCard title={copy.dealConfigTitle} subtitle={copy.dealConfigSubtitle} right={savingDealId ? <span style={{ fontSize: 11, color: "#64748b" }}>{copy.saving}</span> : null}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#334155" }}>
                    {[copy.dealName, copy.dealStage, copy.dealValue, copy.dealClose, copy.dealMode, copy.revenueType].map((header) => (
                      <th key={header} style={{ textAlign: "left", padding: "12px 14px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dealRows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9", color: "#0f172a", fontWeight: 600 }}>{row.name}</td>
                      <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9" }}>{row.stage}</td>
                      <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9" }}>{fmtMoney(row.value, currency)}</td>
                      <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{row.closingDate || "—"}</td>
                      <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9", minWidth: 180 }}>
                        <ProjectionModeSelect
                          value={row.uiMode}
                          disabled={savingDealId === row.id}
                          onChange={(nextValue) => saveProjectionMode(row.id, nextValue)}
                          labels={{ oneTime: copy.oneTime, threeMonths: copy.threeMonths, sixMonths: copy.sixMonths, twelveMonths: copy.twelveMonths }}
                        />
                      </td>
                      <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9", minWidth: 190 }}>
                        <RevenueTypeSelect
                          value={row.revenueType}
                          disabled={savingDealId === row.id}
                          onChange={(nextValue) => saveRevenueType(row.id, nextValue)}
                          labels={{ singleuse: copy.singleuse, multiuse: copy.multiuse, renta: copy.renta }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
            <SectionCard title={copy.cumulative} subtitle={copy.monthlyDetail}>
              <Sparkline values={model.rows.map((row) => row.cumulativeEstimated)} color="#003e7e" />
              <MiniLegend items={[{ label: copy.estimated, color: "#003e7e" }, { label: copy.target, color: "#5e9732" }, { label: copy.actual, color: "#16a34a" }]} />
            </SectionCard>
            <SectionCard title={copy.breakEven} subtitle={`${copy.estimated} - ${copy.expenses}`}>
              <Sparkline values={model.rows.map((row) => row.cumulativeEstimated - row.cumulativeExpenses)} color="#16a34a" />
              <MiniLegend items={[{ label: copy.estimated, color: "#003e7e" }, { label: copy.expenses, color: "#ef4444" }]} />
            </SectionCard>
            <SectionCard title={copy.weightedBreakEven} subtitle={`${copy.weighted} - ${copy.expenses}`}>
              <Sparkline values={model.rows.map((row) => row.cumulativeWeighted - row.cumulativeExpenses)} color="#7c2b83" />
              <MiniLegend items={[{ label: copy.weighted, color: "#7c2b83" }, { label: copy.expenses, color: "#ef4444" }]} />
            </SectionCard>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
              <div>{copy.monthlyTable}</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: "#64748b", marginTop: 4 }}>{copy.editableHint}</div>
            </div>
            {model.rows.length === 0 ? (
              <div style={{ padding: 16, color: "#64748b" }}>{copy.noData}</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#334155" }}>
                      {[copy.month, copy.estimated, copy.target, copy.actual, copy.actualAuto, copy.expenses, copy.weighted].map((header) => (
                        <th key={header} style={{ textAlign: "left", padding: "12px 14px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {model.rows.map((row) => (
                      <tr key={row.key}>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9", color: "#0f172a", fontWeight: 500 }}>{row.label}</td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9" }}>{fmtMoney(row.estimatedPipeline, currency)}</td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9" }}>
                          <MoneyInput value={row.corporateTarget} disabled={savingMonthKey === `${row.key}:budget_amount`} onCommit={(nextValue) => saveMonthlyField(row.key, 'budget_amount', nextValue)} />
                        </td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9" }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <MoneyInput
                              value={row.actualSalesManual !== null ? row.actualSalesManual : ''}
                              placeholder={String(Number(row.actualSalesAuto || 0))}
                              disabled={savingMonthKey === `${row.key}:actual_amount`}
                              onCommit={(nextValue) => saveMonthlyField(row.key, 'actual_amount', nextValue)}
                            />
                            <span style={{ fontSize: 10, color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>
                              {row.actualSalesManual !== null ? 'manual override activo' : `auto: ${fmtMoney(row.actualSalesAuto, currency)}`}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9" }}>{fmtMoney(row.actualSalesAuto, currency)}</td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9" }}>
                          <MoneyInput value={row.expectedExpenses} disabled={savingMonthKey === `${row.key}:expected_expense_amount`} onCommit={(nextValue) => saveMonthlyField(row.key, 'expected_expense_amount', nextValue)} />
                        </td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9" }}>{fmtMoney(row.weightedPipeline, currency)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: "#f8fafc", fontWeight: 700, color: "#0f172a" }}>
                      <td style={{ padding: "12px 14px" }}>{copy.total12}</td>
                      <td style={{ padding: "12px 14px" }}>{fmtMoney(model.totals.estimatedPipeline, currency)}</td>
                      <td style={{ padding: "12px 14px" }}>{fmtMoney(model.totals.corporateTarget, currency)}</td>
                      <td style={{ padding: "12px 14px" }}>{fmtMoney(model.totals.actualSales, currency)}</td>
                      <td style={{ padding: "12px 14px" }}>{fmtMoney(model.rows.reduce((acc, row) => acc + (row.actualSalesAuto || 0), 0), currency)}</td>
                      <td style={{ padding: "12px 14px" }}>{fmtMoney(model.totals.expectedExpenses, currency)}</td>
                      <td style={{ padding: "12px 14px" }}>{fmtMoney(model.totals.weightedPipeline, currency)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
