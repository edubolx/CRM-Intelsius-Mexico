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

function inferStageWeight(stageName = "") {
  const v = String(stageName).toLowerCase();
  for (const rule of STAGE_WEIGHT_HINTS) {
    if (rule.match.some((token) => v.includes(token))) return rule.weight;
  }
  return 0.5;
}

function buildMonths() {
  const start = monthStartUtc(new Date());
  return Array.from({ length: 12 }, (_, idx) => addUtcMonths(start, idx));
}

function allocateDealValue(deal, projectionMode, customMonths, monthKeys) {
  const value = Number(deal.value) || 0;
  const closeKey = monthKey(deal.closingDate || deal.closing_date || new Date().toISOString());
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
      actualSales: Number(targetMap.get(monthKey(m))?.actual_amount) || 0,
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
      refresh: "Refrescar",
      loading: "Cargando proyecciones...",
      noData: "No hay datos todavía.",
      estimated: "Estimated Pipeline (MX)",
      weighted: "Weighted Pipeline",
      target: "Corporate Target (HQ)",
      actual: "Actual Sales",
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
      refresh: "Refresh",
      loading: "Loading projections...",
      noData: "No data yet.",
      estimated: "Estimated Pipeline (MX)",
      weighted: "Weighted Pipeline",
      target: "Corporate Target (HQ)",
      actual: "Actual Sales",
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
    refresh: "Refresh",
    loading: "Loading...",
    noData: "No data.",
    estimated: "Estimated Pipeline (MX)",
    weighted: "Weighted Pipeline",
    target: "Corporate Target (HQ)",
    actual: "Actual Sales",
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
        </div>
        <button onClick={load} style={{ background: "#eef2f7", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{copy.refresh}</button>
      </div>

      {loading && <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 14, padding: 18, color: "#64748b" }}>{copy.loading}</div>}
      {!loading && error && <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 14, padding: 18, color: "#be123c" }}>{error}</div>}
      {!loading && !error && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <KpiCard title={copy.estimated} value={fmtMoney(model.totals.estimatedPipeline, currency)} subtitle={`${model.dealsCovered} ${copy.coveredDeals}`} color="#003e7e" />
            <KpiCard title={copy.weighted} value={fmtMoney(model.totals.weightedPipeline, currency)} subtitle={copy.weightedBreakEven} color="#7c2b83" />
            <KpiCard title={copy.target} value={fmtMoney(model.totals.corporateTarget, currency)} subtitle="HQ" color="#5e9732" />
            <KpiCard title={copy.actual} value={fmtMoney(model.totals.actualSales, currency)} subtitle="Closed / booked" color="#16a34a" />
            <KpiCard title={copy.expenses} value={fmtMoney(model.totals.expectedExpenses, currency)} subtitle="12 months" color="#ef4444" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
            <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 10 }}>{copy.cumulative}</div>
              <Sparkline values={model.rows.map((row) => row.cumulativeEstimated)} color="#003e7e" />
              <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>{copy.estimated} vs {copy.target} vs {copy.actual}</div>
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 10 }}>{copy.breakEven}</div>
              <Sparkline values={model.rows.map((row) => row.cumulativeEstimated - row.cumulativeExpenses)} color="#16a34a" />
              <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>{copy.estimated} - {copy.expenses}</div>
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 10 }}>{copy.weightedBreakEven}</div>
              <Sparkline values={model.rows.map((row) => row.cumulativeWeighted - row.cumulativeExpenses)} color="#7c2b83" />
              <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>{copy.weighted} - {copy.expenses}</div>
            </div>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{copy.monthlyTable}</div>
            {model.rows.length === 0 ? (
              <div style={{ padding: 16, color: "#64748b" }}>{copy.noData}</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#334155" }}>
                      {[copy.month, copy.estimated, copy.target, copy.actual, copy.expenses, copy.weighted].map((header) => (
                        <th key={header} style={{ textAlign: "left", padding: "12px 14px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {model.rows.map((row) => (
                      <tr key={row.key}>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9", color: "#0f172a", fontWeight: 500 }}>{row.label}</td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9" }}>{fmtMoney(row.estimatedPipeline, currency)}</td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9" }}>{fmtMoney(row.corporateTarget, currency)}</td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9" }}>{fmtMoney(row.actualSales, currency)}</td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9" }}>{fmtMoney(row.expectedExpenses, currency)}</td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9" }}>{fmtMoney(row.weightedPipeline, currency)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: "#f8fafc", fontWeight: 700, color: "#0f172a" }}>
                      <td style={{ padding: "12px 14px" }}>{copy.total12}</td>
                      <td style={{ padding: "12px 14px" }}>{fmtMoney(model.totals.estimatedPipeline, currency)}</td>
                      <td style={{ padding: "12px 14px" }}>{fmtMoney(model.totals.corporateTarget, currency)}</td>
                      <td style={{ padding: "12px 14px" }}>{fmtMoney(model.totals.actualSales, currency)}</td>
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
