import React, { useMemo, useContext, useEffect } from "react";
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
import { filterFeatures } from "../../../../client/scripts/mapEntryActions.mjs";
import { MapMachineContext } from "../PortfolioOverview";
import { getSiteFilter, setSiteFilter } from "../../../redux/filters";
import { useDispatch, useSelector as useReduxSelector, useStore } from 'react-redux';
import { DatasetLinked } from "@mui/icons-material";

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

const groupLabelPlugin = {
  id: "groupLabelPlugin",
  afterDatasetsDraw(chart, args, options) {
    const data = options.data || []; 
    const { ctx, scales, chartArea } = chart;
    const yScale = scales.y;

    ctx.save();
    ctx.textBaseline = "middle";
    ctx.font = "14px Inter, sans-serif";

    data.forEach((item, i) => {
      const y = yScale.getPixelForValue(i);
      const barThickness = 30;
      const labelGap = 24;
      const labelX = chartArea.left;
      const labelY = y - barThickness / 2 - labelGap;

      const circleColor = item.color || "#000";
      const circleRadius = 4;
      ctx.fillStyle = circleColor;
      ctx.beginPath();
      ctx.arc(labelX + circleRadius, labelY - 1, circleRadius, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "#000";
      ctx.textAlign = "left";

      const mwValue = item.max ?? item.label;
      const capitalizedId =
        String(item.id || "")
          .charAt(0)
          .toUpperCase() + String(item.id || "").slice(1);
      const text =
        typeof mwValue === "number"
          ? `${capitalizedId} (${mwValue} MW)`
          : `${capitalizedId} (${item.label})`;

      ctx.fillText(text, labelX + circleRadius * 2 + 4, labelY);
    });

    ctx.restore();
  },
};

export default function DeployStatusChart({ userConfig, chartConfig, context, snapshot, send }) {
  const chartHeight = (chartConfig?.data?.length || 0) * 120;
  const classes = useStyles({ chartHeight });
  const chartTitle = userConfig.handlers.portfolioOverview.config.labels?.chartTitle || "Status";

  const siteFilter = useReduxSelector(getSiteFilter);

  const { actor } = useContext(MapMachineContext);

  const dispatch = useDispatch()

  const handleBarClick = (site) => {
    dispatch(setSiteFilter(site))
  }

   const findCapacityRange = (capacityValue) => {
    const bins = chartConfig?.data || [];
    bins.sort((a, b) => (a.min ?? -Infinity) - (b.min ?? -Infinity));

    for (let i = 0; i < bins.length; i++) {
      const { min = -Infinity, max = Infinity } = bins[i];
      const isLastBin = i === bins.length - 1;

      if (isLastBin) {
        if (capacityValue >= min) return bins[i];
      } else {
        if (capacityValue >= min && capacityValue <= max) return bins[i];
      }
    }

    return null;
  }

  const chartData = useMemo(() => {
    if (!chartConfig?.data) {
      return { labels: [], datasets: [] }; 
    }

    const labels = chartConfig.data.map((d) => {
      const idStr = String(d.id || "");
      const capitalizedId = idStr.charAt(0).toUpperCase() + idStr.slice(1);
      return `${capitalizedId} (${d.max ?? d.label} MW)`;
    });

    const datasets = Object.entries(chartConfig?.statusConfig).map(
      ([key, { label, color }]) => ({
        label,
        data: chartConfig.data.map((d) => d.status[key] ?? 0),
        backgroundColor: color,
        stack: "stack1",
        barThickness: 56,
      }),
    );

    return { labels, datasets };
  }, [chartConfig]);

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
        data: chartConfig?.data || [],
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
        position: "centerBar",
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
          color: "#d3d3d3",
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
    onClick: async (evt, elements) => {
     // const { datasetIndex, index } = elements[0];
    if (!elements.length) return;

    const { datasetIndex, index } = elements[0];
    const datasetLabel = chartData.datasets[datasetIndex].label;
    const capacityLabel = chartData.labels[index];

    // find the matching status from config
    const match = Object.values(chartConfig?.statusConfig || {}).find(
        (status) => status.label === datasetLabel
    );

    if (!match) return;

    const statusId = match.statusId;

    // Optional: parse capacity value from label (e.g., "Low (900 MW)")

    const isLastBin = chartConfig.data[index].max === null;

    const capacityValue = isLastBin
      ? Infinity
      : Number(capacityLabel.replace(/\D/g, ""));

    const capacityRange = findCapacityRange(capacityValue);


    const filter = {
        site: {
            op: "and",
            rules: [
                { fn: "statusIn", args: { values: statusId } },
                { fn: "capacityBetween", args: 
                  { min:capacityRange?.min, 
                    max:capacityRange?.max 
                  }
                },
            ],
        },
    }


    // Dispatch to Redux filters
    dispatch(setSiteFilter(filter));

      // const filteredSites = context.data.site.slice(0, 5);

      // snapshot.stateValue = context.namedPaths[0][0].state
      // snapshot.self = actor;

      // filterFeatures({
      //   mapMachineInput: snapshot,
      //   data: filteredSites,
      //   filteredLabels: {
      //     status: match?.statusId,
      //     capacity: capacityRange,
      //   },
      //   legend: chartConfig?.data,
      // });

      // const newData = {
      //   ...context,
      //   data: { building: context.data.building, site: filteredSites },
      // };

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
              groupLabelPlugin
            ]}
          />
        )}
      </div>
    </div>
  );
}
