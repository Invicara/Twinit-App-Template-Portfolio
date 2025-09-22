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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels,
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
    const { ctx, scales, data } = chart;
    const rows = opts?.data || [];                  // ← you pass this in options.plugins.groupLabelPlugin.data
    const fmt  = opts?.formatter || (b => b.label); // ← optional formatter

    if (!rows.length) return;

    ctx.save();
    ctx.fillStyle = opts?.color || '#1D1D1D';
    ctx.font = (opts?.font?.string) || (ChartJS.defaults.font && ChartJS.defaults.font.string) || '12px sans-serif';
    ctx.textBaseline = 'bottom';

    const yScale = scales.y, xScale = scales.x;
    rows.forEach((bin, i) => {
      const label = fmt(bin);
      const y = yScale.getPixelForValue(i) - 6;     // a bit above the bar
      const total = chart.getSortedVisibleDatasetMetas().reduce((s, m) => {
        const v = m.controller.getParsed(i)?.x ?? 0;
        return s + (chart.isDatasetVisible(m.index) ? Number(v) : 0);
      }, 0);
      const x = xScale.getPixelForValue(total);
      ctx.textAlign = 'left';
      ctx.fillText(label, x + 8, y);
    });

    ctx.restore();
  }
};

// one-time global registration (module scope)
if (!ChartJS.registry.plugins.get('groupLabelPlugin')) {
  ChartJS.register(GroupLabelPlugin);
}

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

export function deriveChartMatrix({ data, ctx, chartCfg }) {
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
  if (!legend.unknown) legend.unknown = { label: 'Unknown', color: '#CCCCCC' };

  // rows
  const seriesKeysSeen = new Set(Object.keys(legend));
  const rows = bins.map(b => ({ ...b, buckets: {} }));

  // choose bin for a feature:
  const getRow = (f) => {
    // priority: explicit bin.test(feature) takes precedence
    const byTest = rows.find(r => typeof r.test === 'function' && r.test(f, ctx));
    if (byTest) return byTest;

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
    const row = getRow(f);
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



//TODO: move that to external script
const defaultChartCfg =  {
  // 1) where items come from (no childPath)
  itemsOf: (data /* context.data */) => {
    const sites = Array.isArray(data?.site) ? data.site : [];
    return sites.flatMap(s => Array.isArray(s.buildings) ? s.buildings : []);
  },

  // 2) GROUP: Palier bins from ReactorModel, using ONLY bins[].test
  group: {
    id: 'palier',
    bins: [
      {
        id: 'CP0/CPY', label: 'CP0/CPY Palier',
        test: (b) => /CP0|CP1|CPY/i.test(String(b?.ReactorModel || '')),
      },
      {
        id: "P4/P'4", label: "P4/P'4 Palier",
        test: (b) => /P4|'?P4/i.test(String(b?.ReactorModel || '')),
      },
      {
        id: 'N4', label: 'N4 Palier',
        test: (b) => /N4/i.test(String(b?.ReactorModel || '')),
      },
      {
        id: 'Other', label: 'Other',
        test: () => true, // catch-all
      },
    ],
    // optional pretty label
    groupLabel: (bin) => bin.label,
  },

  // 3) SERIES: StatusId → stacks, with your label/color maps
  series: {
    id: 'status',
    keyProp: (b) => String(b?.StatusId ?? 'unknown'),
    config: {
      colorMap: {
        "1": "#d3d3d3",   // Not started / Planned (adjust if you want your old palette)
        "2": "#f4b740",   // In Progress / Construction
        "3": "#66bb6a",   // Completed / Operating
        "4": "#e53935",   // At risk / Suspended Operation
        "5": "#6B7280",   // Permanent Shutdown
        "unknown": "#CCCCCC",
      },
      labelMap: {
        "1": "Not started",
        "2": "In Progress",
        "3": "Completed",
        "4": "At risk",
        "5": "Permanent Shutdown",
        "unknown": "Unknown",
      },
    },
    // keep a stable legend order
    order: (keys) => {
      const pref = ['1','2','4','3','5','unknown']; // your desired sequence
      return pref.filter(k => keys.includes(k)).concat(keys.filter(k => !pref.includes(k)));
    },
  },

  // 4) METRIC
  metric: { type: 'count' },

  // 5) Click → filters (map back to your predicate registry)
  filter: {
    scope: 'site',
    combine: 'and',
    rules: {
      series: (statusKey) =>
          statusKey === 'unknown' ? null : ({ fn: 'statusIn', args: { values: [statusKey] } }),
      group:  (bin) => ({ fn: 'reactorPalierIn', args: { values: [bin.id] } }),
    },
  },
};


export function buildChartData(matrix) {
  const { rows, legend, seriesKeys, labels } = matrix;

  let datasets = seriesKeys.map(k => ({
    key: k,
    label: (legend[k]?.label ?? k),
    data: rows.map(r => r.buckets[k] ?? 0),
    backgroundColor: (legend[k]?.color ?? '#999'),
    stack: 'stack1',
    barThickness: 56,
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
  const filterCfg = chartCfg?.filter;
  if (!filterCfg?.rules) return {};
  const scope = filterCfg.scope || 'site';
  const op = (filterCfg.combine || 'and');
  const rules = [];

  if (typeof filterCfg.rules.series === 'function' && click?.seriesKey != null) {
    const r = filterCfg.rules.series(click.seriesKey, { legend: click.series, ctx: click.ctx });
    if (r) rules.push(r);
  }
  if (typeof filterCfg.rules.group === 'function' && click?.bin) {
    const r = filterCfg.rules.group(click.bin, { ctx: click.ctx });
    if (r) rules.push(r);
  }
  if (!rules.length) return {};
  return { [scope]: { op, rules } };
};



export default function DeployStatusChart({ userConfig, context, snapshot, send, stateKey }) {
  const rowsCount = Object.keys(defaultChartCfg.series.config.labelMap).length;
  const chartHeight = Math.max(240, rowsCount * 80);
  const classes = useStyles({ chartHeight });
  const chartTitle = userConfig.handlers.portfolioOverview.config.labels?.chartTitle || "Status";

  const filter = useReduxSelector(getFilter);

  const matrix = useMemo(() => deriveChartMatrix({
    data: context.data,       // plain array of features
    ctx: {  },
    chartCfg: defaultChartCfg,
  }), [context.data]);

  const chartData = useMemo(() => buildChartData(matrix), [matrix]);

  const dispatch = useDispatch();

  const isLoading =
    !chartData?.datasets?.length ||
    chartData.datasets.every((ds) => ds.data.every((v) => v === 0));

  const options = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { left: 0, right: 10, top: 40, bottom: 0 } },
    plugins: {
      groupLabelPlugin: {
        data: matrix?.data || [],
        formatter: defaultChartCfg?.groupLabel
      },
      legend: {
        display: true,
        position: "bottom",
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 8,
          boxHeight: 8,
          padding: 20,
          font: { family: "Inter", size: 10, weight: "400" },
          generateLabels(chart) {
            const datasets = chart.data.datasets;
            const total = datasets.reduce(
              (sum, ds) => sum + ds.data.reduce((a, b) => a + b, 0),
              0,
            );
            return datasets.map((ds, i) => {
              const statusTotal = ds.data.reduce((a, b) => a + b, 0);
              const percent = ((statusTotal / total) * 100).toFixed(0);
              return {
                text: `${percent}% ${ds.label}`,
                fillStyle: ds.backgroundColor,
                strokeStyle: ds.backgroundColor,
                hidden: !chart.isDatasetVisible(i),
                pointStyle: "circle",
              };
            });
          },
        },
      },
      tooltip: {
        position: "centerBar",
        yAlign: "bottom",
        xAlign: "center",
        displayColors: false,
        padding: 12,
        backgroundColor: "#000",
        titleColor: "#fff",
        bodyColor: "#fff",
        bodyFont: { family: "Inter", size: 12 },
        callbacks: {
          title: () => null,
          label: (context) => {
            const datasetLabel = context.dataset.label || "";
            const value = context.parsed.x;
            return `${datasetLabel}: ${value}`;
          },
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
          //color: "#d3d3d3",
          color: (ctx) => {
            return ctx.tick.value === ctx.chart.scales.x.max ? 'transparent' : '#d3d3d3';
        },

        },
        ticks: {
          color: "#555",
          font: { size: 12 },
          callback: function (value) {
            const maxValue = this.max;
            return value === maxValue ? "" : value;
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
      const newFilter = getChartFilters({ seriesKey, series: matrix.legend[seriesKey], bin, ctx: {} }, defaultChartCfg);
      // dispatch newFilter…
    },
  };

  return (
    <div className={classes.container}>
      {/* Header */}
      <div className={classes.header}>
        <BarChartOutlinedIcon className={classes.icon} />
        <span className={classes.headerText}>{chartTitle}</span>
      </div>

      {/* Chart */}
      <div
        className={classes.chartWrapper}
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {isLoading ? (
          <CircularProgress />
        ) : (
          <Bar
            data={chartData}
            options={options}
            plugins={[
              ChartDataLabels,
              GroupLabelPlugin
            ]}
          />
        )}
      </div>
    </div>
  );
}
