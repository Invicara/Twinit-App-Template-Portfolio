import React, { useMemo, useRef, useContext } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import BarChartOutlinedIcon from '@material-ui/icons/BarChartOutlined';
import CircularProgress from '@material-ui/core/CircularProgress';
import { usePopupState } from './map/popup/usePopupState';
import { formControlClasses } from '@mui/material';
import { filterFeatures } from '../../../../client/scripts/mapEntryActions.mjs';
// import { useSelector as useXstateSelector } from '@xstate/react';
import { MapContext, MapMachineContext } from '../PortfolioOverview';
import { useDispatch, useSelector } from "react-redux";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

const useStyles = makeStyles({
  container: {
    width: '100%',
    overflowY: 'auto',
    minHeight: (props) => props.chartHeight + 300,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: -20,
  },
  icon: {
    color: '#5D5D5D',
    fontSize: 26,
    marginRight: 8,
    marginLeft: 15,
  },
  headerText: {
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: 700,
    color: '#000',
  },
  chartWrapper: {
    width: '100%',
    height: (props) => props.chartHeight + 40,
    overflow: 'visible'
  },
});

Tooltip.positioners.centerBar = function (items, eventPosition) {
  if (!items.length) {
    return false;
  }
  const element = items[0].element;
  return {
    x: (element.base + element.x) / 2, 
    y: element.y - element.height / 2.3
  };
};

const groupLabelPlugin = {
  id: 'groupLabelPlugin',
  afterDatasetsDraw(chart) {
    const { ctx, scales, chartArea } = chart;
    const yScale = scales.y;

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.font = '14px Inter, sans-serif';

    mockDeployData.forEach((item, i) => {
      const y = yScale.getPixelForValue(i);
      const barThickness = 30;
      const labelGap = 24;
      const labelX = chartArea.left;
      const labelY = y - barThickness / 2 - labelGap;

      let circleColor = item.color || '#000';

      const circleRadius = 4;
      ctx.fillStyle = circleColor;
      ctx.beginPath();
      ctx.arc(labelX + circleRadius, labelY - 1, circleRadius, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = '#000';
      ctx.textAlign = 'left';

        // Build label string
  const mwValue = item.max ?? item.label;
  const text =
    typeof mwValue === 'number'
      ? `${item.id} (${mwValue} MW)`
      : `${item.id} (${item.label})`;

  ctx.fillText(text, labelX + circleRadius * 2 + 4, labelY);
    });

    ctx.restore();
  },
};

const hideLastXGridLinePlugin = {
  id: 'hideLastXGridLine',
  afterDraw: (chart) => {
    const xScale = chart.scales.x;
    const ctx = chart.ctx;
    const lastPixel = xScale.getPixelForValue(xScale.max);

    ctx.save();
    ctx.strokeStyle = chart.options.plugins?.background?.color || '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(lastPixel, chart.chartArea.top);
    ctx.lineTo(lastPixel, chart.chartArea.bottom + 5);
    ctx.stroke();
    ctx.restore();
  },
};

const mockDeployData = [
  { id: 'low',  min: 0, max: 900, color: "#8ecbff",  label: "< 900", status: { notStarted: 10, inProgress: 7, atRisk: 3, completed: 20 } },
  { id: "mid", min: 900, max: 1300, color: "#1DC0F7", label: "900–1299", status: { notStarted: 5, inProgress: 6, atRisk: 2, completed: 7 } },
  { id: 'high', min: 1300, max: 1450,color: "#0072BC", label: "1300–1449", status: { notStarted: 4, inProgress: 1, atRisk: 0, completed: 0 } },
  { id: 'ultra', min: 1450, max: null,  label: "≥1450", color: "#1D1D1D", status: { notStarted: 4, inProgress: 1, atRisk: 0, completed: 0 } },
];

// const mockDeployData = [
// { id: "low", min: 0, max: 900, color: "#8ecbff", label: "< 900", status: { notStarted: 10, inProgress: 7, atRisk: 3, completed: 20 } },
// { id: "mid", min: 900, max: 1300, color: "#1DC0F7", label: "900–1299", status: { notStarted: 5, inProgress: 6, atRisk: 2, completed: 7 } },
// { id: "high", min: 1300, max: 1450, color: "#0072BC", label: "1300–1449", status: { notStarted: 4, inProgress: 1, atRisk: 0, completed: 0 } },
// { id: "ultra", min: 1450, max: null, color: "#1D1D1D", label: "≥1450", status: { notStarted: 4, inProgress: 1, atRisk: 0, completed: 0 } }
// ],

export default function DeployStatusChart({ userConfig, chartConfig, context, mmvSend, snapshot }) {
  const chartHeight = mockDeployData.length * 120;
  const classes = useStyles({ chartHeight });
   const dispatch = useDispatch();
  const chartTitle = userConfig.handlers.portfolioOverview.config.labels?.chartTitle || 'Status';
  const statusConfig = userConfig.handlers.portfolioOverview.config.statusConfig || {}
  const popupRefs = useRef([]);
//  const portContext = useContext(MapMachineContext);
  const { send, actor } = useContext(MapMachineContext);
  // const [popupState, setPopupState] = usePopupState({ open: false });
const chartData = useMemo(() => {
  if (!chartConfig?.data) {
    return { labels: [], datasets: [] }; // safe fallback
  }

  const labels = chartConfig.data.map(d => `${d.id} (${d.max ?? d.label} MW)`);
  const datasets = Object.entries(chartConfig?.statusConfig).map(([key, { label, color }]) => ({
    label,
    data: chartConfig.data.map(d => d.status[key] ?? 0),
    backgroundColor: color,
    stack: 'stack1',
    barThickness: 56,
  }));

  return { labels, datasets };
}, [chartConfig]);


 const isLoading = !chartData?.datasets?.length;

  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { 
      padding: { 
        left: 10, 
        right: 10, 
        top: 28, 
        bottom: 0 
      } 
    },
    clip: false,
    plugins: {
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
              const percent = ((statusTotal / total) * 100).toFixed(0);
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
        position: 'centerBar', 
        displayColors: false,
        padding: 12,
        backgroundColor: '#000',
        titleColor: '#fff',
        bodyColor: '#fff',
        bodyFont: { family: 'Inter', size: 12 },
        callbacks: {
          title: () => null,
          label: (context) => {
            const datasetLabel = context.dataset.label || '';
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
        grid: { display: true, drawBorder: false, color: '#d3d3d3' },
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
onClick: (evt, elements) => {

  console.log('context');
  console.log(context);
 const { datasetIndex, index } = elements[0];

   const datasetLabel = chartData.datasets[datasetIndex].label;

    // Bar label = capacity bin (whatever your X axis labels are)
    const capacityLabel = chartData.labels[index];

  const filteredSites = context.data.site.slice(0, 5);

  snapshot.stateValue = 'portfolio';
  snapshot.self = actor;

  filterFeatures({
      mapMachineInput: snapshot,
      data: filteredSites,
      dispatch: dispatch,
      send: mmvSend
  });

  const newData = {...context, data: {building: context.data.building, site: filteredSites}};
    mmvSend({
      type: 'FILTER_BY_STATUS_AND_CAPACITY',
      filteredSites,
    });
}
  };

  return (
    <div className={classes.container}>
      {/* Header */}
      <div className={classes.header}>
        <BarChartOutlinedIcon className={classes.icon} />
        <span className={classes.headerText}>
          {chartTitle}
        </span>
      </div>

      {/* Chart */}
      <div className={classes.chartWrapper} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {isLoading ? (
          <CircularProgress />
        ) : (
          <Bar
            data={chartData}
            options={options}
            plugins={[ChartDataLabels, groupLabelPlugin, hideLastXGridLinePlugin]}
          />
        )}
      </div>
    </div>
  );
}
