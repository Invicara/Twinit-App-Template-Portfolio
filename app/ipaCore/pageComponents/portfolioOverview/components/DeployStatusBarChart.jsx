import React, {useMemo, useContext, useEffect, useState} from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import BarChartOutlinedIcon from "@material-ui/icons/BarChartOutlined";
import CircularProgress from "@material-ui/core/CircularProgress";
import { getFilter, setFilter } from "../../../redux/filters";
import { useDispatch, useSelector as useReduxSelector, useStore } from 'react-redux';
import {ScriptCache} from "@invicara/ipa-core/modules/IpaUtils/index.js";
import {IafScriptEngine} from "@dtplatform/iaf-script-engine";
import {getGlobalFilterFunctions} from "../../utils/filters.global.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

const useStyles = makeStyles({
  container: {
    width: "100%",
    overflowY: "auto",
    minHeight: (props) => props.chartHeight + 300,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    marginBottom: -20,
  },
  icon: {
    color: "#5D5D5D",
    fontSize: 26,
    marginRight: 8,
    marginLeft: 0,
  },
  headerText: {
    fontFamily: "Inter",
    fontSize: 15,
    fontWeight: 700,
    marginTop: 4,
    color: '#000',
  },
  chartWrapper: {
    width: "100%",
    height: (props) => props.chartHeight + 40,
    overflow: "visible",
  },
});

Tooltip.positioners.centerBar = function (items, eventPosition) {
  if (!items.length) {
    return false;
  }
  const element = items[0].element;
  return {
    x: (element.base + element.x) / 2,
    y: element.y - element.height / 2.3,
  };
};

// define the plugin once
const GroupLabelPlugin = {
  id: 'groupLabelPlugin',
  afterDatasetsDraw(chart, _args, opts) {
    const { ctx, scales, data, chartArea } = chart;
    const rows = opts?.data || [];                  // ← you pass this in options.plugins.groupLabelPlugin.data
    const fmt  = opts?.formatter || (b => b.label); // ← optional formatter
    if (!rows.length) return;

    ctx.save();
    ctx.fillStyle = opts?.color || '#1D1D1D';
    ctx.font = (opts?.font?.string) || (ChartJS.defaults.font && ChartJS.defaults.font.string) || '12px sans-serif';
    ctx.textBaseline = 'bottom';
    const meta = chart.getDatasetMeta(0);

    const yScale = scales.y, xScale = scales.x;
    rows.forEach((bin, i) => {
      const bar = meta.data[i];
      if (!bar) return;
      const y = yScale.getPixelForValue(i);
      const labelX = chartArea.left;
      const topY   = bar.y - bar.height / 2;
      const labelY = topY - 4; // label baseline just above bar

      const circleColor = bin.color || "#7e7e7e";
      const circleRadius = 4;
      ctx.fillStyle = circleColor;
      ctx.beginPath();
      ctx.arc(labelX + circleRadius, labelY - 6, circleRadius, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "#000";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic"; // good for labelY alignment

      const label = fmt(bin);
      const textX =  labelX + circleRadius * 2 + 4;
      ctx.fillText(label, textX, labelY);
    });

    ctx.restore();
  }
};

const get = (obj, path, dflt) => {
  if (typeof path === 'function') return path(obj);
  if (!path) return Array.isArray(obj) ? obj : dflt;
  return path.split('.').reduce((o, k) => (o && k in o ? o[k] : undefined), obj) ?? dflt;
};

const inRange = (v, min, max) => {
  if (v == null || Number.isNaN(+v)) return false;
  if (min != null && +v < min) return false;
  if (max != null && max !== Infinity && +v >= max) return false;
  return true;
};

const sanitizeColor = (c) => {
  if (!c) return '#999';
  const m = /^#([0-9a-f]{8})$/i.exec(String(c).trim());
  if (m) {
    const hex = m[1];
    const r = parseInt(hex.slice(0,2),16);
    const g = parseInt(hex.slice(2,4),16);
    const b = parseInt(hex.slice(4,6),16);
    const a = parseInt(hex.slice(6,8),16) / 255;
    return `rgba(${r},${g},${b},${a})`;
  }
  return c;
};

export function deriveChartMatrix({ data, fns, chartCfg }) {
  const ctx = {};
  // items
  const items =
      typeof chartCfg?.itemsOf === 'function'
          ? chartCfg.itemsOf(data, ctx)
          : (Array.isArray(data) ? data : get(data, chartCfg?.dataPath, []));

  const bins = (chartCfg?.group?.bins || []).map(b => ({ ...b }));

  // legend from maps
  const labelMap = chartCfg?.series?.config?.labelMap || {};
  const colorMap = chartCfg?.series?.config?.colorMap || {};
  const legend = Object.keys(labelMap).reduce((acc, k) => {
    acc[k] = { label: labelMap[k], color: sanitizeColor(colorMap[k] || '#999') };
    return acc;
  }, {});
  if (!legend.unknown) legend.unknown = { label: 'Other', color: '#CCCCCC' };

  // rows
  const seriesKeysSeen = new Set(Object.keys(legend));
  const rows = bins.map(b => ({ ...b, buckets: {} }));

  // choose bin for a feature:
  const getRow = (fns,f) => {
    // priority: explicit bin.test(feature) takes precedence
    const byFilterTest = rows.find(r => {
      if(typeof r.test === 'string' ) {
        const pred = fns[r.test] && fns[r.test]({ values: [r.id] });
        return pred(f);
      } else if (typeof r.test === 'function'){
        return r.test(f, r);
      }
    });
    if (byFilterTest) return byFilterTest;

    // fallback: numeric bins via valueProp
    if (typeof chartCfg?.group?.valueProp === 'function') {
      const v = chartCfg.group.valueProp(f, ctx);
      return rows.find(r => inRange(v, r.min ?? -Infinity, r.max ?? Infinity));
    }
    return undefined;
  };

  // weight
  const weightOf = (f) => {
    if (chartCfg?.metric?.type === 'sum' && typeof chartCfg?.metric?.valueProp === 'function') {
      const w = Number(chartCfg.metric.valueProp(f, ctx));
      return Number.isFinite(w) ? w : 0;
    }
    return 1;
  };

  // accumulate
  for (const f of items) {
    const row = getRow(fns, f);
    if (!row) continue;

    const w = weightOf(f);
    let key = chartCfg?.series?.keyProp?.(f, ctx);
    if (!key) key = 'unknown';
    key = String(key);

    seriesKeysSeen.add(key);
    row.buckets[key] = (row.buckets[key] || 0) + w;
  }

  // series order
  const allKeys = Array.from(seriesKeysSeen);
  const seriesKeys = (typeof chartCfg?.series?.order === 'function')
      ? chartCfg.series.order(allKeys, legend)
      : allKeys;

  // sort rows by total desc
  rows.sort((a, b) => {
    const ta = Object.values(a.buckets).reduce((s, v) => s + (v || 0), 0);
    const tb = Object.values(b.buckets).reduce((s, v) => s + (v || 0), 0);
    return tb - ta;
  });

  // labels
  const labels = rows.map(bin =>
      typeof chartCfg?.group?.groupLabel === 'function'
          ? chartCfg.group.groupLabel(bin)
          : (bin.label ?? String(bin.id))
  );

  return { rows, legend, seriesKeys, labels };
}


export function buildChartData(matrix) {
  const { rows, legend, seriesKeys, labels } = matrix;

  let datasets = seriesKeys.map(k => ({
    key: k,
    label: (legend[k]?.label ?? k),
    data: rows.map(r => r.buckets[k] ?? 0),
    backgroundColor: (legend[k]?.color ?? '#999'),
    stack: 'stack1',
    maxBarThickness: 30,
  }));

  // drop all-zero series
  datasets = datasets.filter(ds => ds.data.some(v => v > 0));

  // drop empty bins
  const keepRow = rows.map((_, i) => datasets.some(ds => (ds.data[i] || 0) > 0));
  const finalLabels = labels.filter((_, i) => keepRow[i]);
  datasets = datasets.map(ds => ({ ...ds, data: ds.data.filter((_, i) => keepRow[i]) }));

  return { labels: finalLabels, datasets };
}



/**
 * Build a scoped global-filter object from a chart click, using chartCfg.filter.
 *
 * @param {{ seriesKey: string, series?: any, bin?: {id:string,min?:number,max?:number,label?:string,unit?:string}, ctx?: any }} click
 * @param {any} chartCfg  // popupConfig.chart
 * @returns {{ [scope: string]: { op: 'and'|'or', rules: any[] } } | {}}
 */
export const getChartFilters = (click, chartCfg) => {
  const filterCfg = chartCfg?.filter || {};
  const scope   = filterCfg.scope  || 'site';
  const op      = filterCfg.combine || 'and';
  const rules   = [];

  // helper: build a rule from a def:
  // - function: (payload, ctx) => Rule|null
  // - string:   treated as fn name; payload is turned into args.values
  // - object:   already a rule
  const makeRule = (def, payload, ctx) => {
    if (!def) return null;
    if (typeof def === 'function') return def(payload, ctx) || null;
    if (typeof def === 'string') {
      const values = payload == null
          ? []
          : Array.isArray(payload) ? payload : [payload];
      return { fn: def, args: { values: values.map(String) } };
    }
    if (def && typeof def.fn === 'string') return def;
    return null;
  };

  // build series rule (default to statusIn if mapper not provided)
  if (click?.seriesKey != null) {
    const seriesDef = filterCfg.rules?.series;
    const r = makeRule(seriesDef, String(click.seriesKey), { legend: click.series, click, chartCfg });
    if (r) rules.push(r);
  }

  const seriesKeyLower = (click?.seriesKey ?? '').toString().toLowerCase();
  const isOtherStatus = seriesKeyLower === 'unknown' || seriesKeyLower === 'unkown' || seriesKeyLower === 'other';

  // When clicking Other status segment, only apply status filter (no group) so all sites with Other/no status show
  if (click?.bin && !isOtherStatus) {
    const groupDef = filterCfg.rules?.group ?? (click.bin.test);
    const r = makeRule(groupDef, String(click.bin.id), { bin: click.bin, click, chartCfg });
    if (r) rules.push(r);
  }

  if (!rules.length) return {};

  // de-dupe same-fn rules by unioning args.values
  const merged = [];
  for (const rule of rules) {
    const i = merged.findIndex(r => r.fn === rule.fn);
    if (i === -1) {
      merged.push(rule);
    } else {
      const a = merged[i].args || {};
      const b = rule.args || {};
      const av = Array.isArray(a.values) ? a.values : [];
      const bv = Array.isArray(b.values) ? b.values : [];
      merged[i] = {
        fn: rule.fn,
        args: { ...a, ...b, values: Array.from(new Set([...av, ...bv])) }
      };
    }
  }



  //return { [scope]: { op, rules: merged } };
  return { op, rules: merged };
};

/** Get sorted values array for a rule by fn name, or null if missing */
function getRuleValues(node, fnName) {
  if (!node?.rules) return null;
  const rule = node.rules.find((r) => r && r.fn === fnName);
  const vals = rule?.args?.values;
  return Array.isArray(vals) ? [...vals].map(String).sort() : null;
}

/** True if current site filter matches the same chart segment as newFilter (status + group) */
function isSameChartSegment(currentNode, newFilter) {
  if (!currentNode || !newFilter?.rules?.length) return false;
  const chartFns = ['statusIn', 'buildingTypeIn'];
  for (const fn of chartFns) {
    const a = getRuleValues(currentNode, fn);
    const b = getRuleValues(newFilter, fn);
    const aStr = (a || []).join(',');
    const bStr = (b || []).join(',');
    if (aStr !== bStr) return false;
  }
  return true;
}

export default function DeployStatusChart({ handler, context, onFilterChange, chartCfg, initialFilter }) {
  const chartTitle = handler.config.labels?.chartTitle || 'Status';
  const fns = getGlobalFilterFunctions('building', false);
  const gateReady = useReduxSelector((s) => !!s.graphicsGate?.byState?.portfolio?.ready);

  const matrix = useMemo(() => deriveChartMatrix({
    data: context.data,
    fns,
    chartCfg
  }), [context.data, chartCfg]);

  const chartData = useMemo(() => buildChartData(matrix), [matrix]);

  const rowsCount = Math.max(1, (matrix?.labels?.length || 0));
  const chartHeight = Math.max(240, rowsCount * 80);
  const classes = useStyles({ chartHeight });

  // IMPORTANT: this is NOT "graphics downloaded", this is "3D layer initialized"
  const [layerReady, setLayerReady] = useState(false);


 useEffect(() => {
  const onLoading = (e) => {
    if (e?.detail?.stateValue === 'portfolio') setLayerReady(false);
  };

  const onReady = (e) => {
    if (e?.detail?.stateValue === 'portfolio') setLayerReady(true);
  };

  window.addEventListener('mmv:3d-layer-loading', onLoading);
  window.addEventListener('mmv:3d-layer-initialized', onReady);

  return () => {
    window.removeEventListener('mmv:3d-layer-loading', onLoading);
    window.removeEventListener('mmv:3d-layer-initialized', onReady);
  };
}, []);

  const isChartEmpty =
    !chartData?.datasets?.length ||
    chartData.datasets.every((ds) => ds.data.every((v) => v === 0));

  // Gate by layerReady FIRST so nothing renders early
const isLoading = !gateReady || isChartEmpty;

  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { left: 0, right: 10, top: 40, bottom: 0 } },
    plugins: {
      groupLabelPlugin: {
        data: matrix?.rows || [],
        formatter: chartCfg?.group?.groupLabel
      },
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          boxHeight: 8,
          padding: 20,
          font: { family: 'Inter', size: 10, weight: '400' },
          generateLabels(chart) {
            const datasets = chart.data.datasets;
            const total = datasets.reduce((sum, ds) => sum + ds.data.reduce((a, b) => a + b, 0), 0);
            return datasets.map((ds, i) => {
              const statusTotal = ds.data.reduce((a, b) => a + b, 0);
              const percent = total ? ((statusTotal / total) * 100).toFixed(0) : '0';
              return {
                text: `${percent}% ${ds.label}`,
                fillStyle: ds.backgroundColor,
                strokeStyle: ds.backgroundColor,
                hidden: !chart.isDatasetVisible(i),
                pointStyle: 'circle',
              };
            });
          },
        },
      },
      tooltip: {
        position: 'centerBar',
        yAlign: 'bottom',
        xAlign: 'center',
        displayColors: false,
        padding: 12,
        backgroundColor: '#000',
        titleColor: '#fff',
        bodyColor: '#fff',
        bodyFont: { family: 'Inter', size: 12 },
        callbacks: {
          title: () => null,
          label: (ctx) => `${ctx.dataset.label || ''}: ${ctx.parsed.x}`,
        },
      },
      datalabels: false,
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          display: true,
          drawBorder: false,
          color: (ctx) => (ctx.tick.value === ctx.chart.scales.x.max ? 'transparent' : '#d3d3d3'),
        },
        ticks: {
          color: '#555',
          font: { size: 12 },
          callback: function(value) {
            const maxValue = this.max;
            return value === maxValue ? '' : value;
          },
        },
        border: { display: false },
        clip: false,
      },
      y: {
        stacked: true,
        categoryPercentage: 0.4,
        barPercentage: 0.6,
        grid: { display: false, drawBorder: false },
        border: { display: false },
        ticks: { display: false },
        clip: false,
      },
    },
    onClick: (evt, elements, chart) => {
      if (!elements.length) return;
      const { datasetIndex, index } = elements[0];
      const seriesKey = chart.data.datasets[datasetIndex].key;
      const bin = matrix.rows[index];
      const newFilter = getChartFilters(
        { seriesKey, series: matrix.legend[seriesKey], bin, ctx: {} },
        chartCfg
      );
      if (!Object.keys(newFilter).length) return;
      if (isSameChartSegment(initialFilter, newFilter)) {
        onFilterChange(null, { clear: true });
      } else {
        onFilterChange(newFilter, { replace: true });
      }
    },
  };

  return (
    <div className={classes.container}>
      <div className={classes.header}>
        <BarChartOutlinedIcon className={classes.icon} />
        <span className={classes.headerText}>{chartTitle}</span>
      </div>

      <div
        className={classes.chartWrapper}
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      >
        {isLoading ? (
          <CircularProgress />
        ) : (
          <Bar data={chartData} options={options} plugins={[ChartDataLabels, GroupLabelPlugin]} />
        )}
      </div>
    </div>
  );
}

