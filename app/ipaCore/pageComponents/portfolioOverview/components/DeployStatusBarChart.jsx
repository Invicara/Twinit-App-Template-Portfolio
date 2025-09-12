import React, { useMemo } from 'react';
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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

const useStyles = makeStyles({
  container: {
    width: '100%',
    overflowY: 'auto',
    minHeight: '125vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  icon: {
    color: '#5D5D5D',
    fontSize: 26,
    marginRight: 8,
    marginLeft: 0,
  },
  headerText: {
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: 700,
    marginTop: 4,
    color: '#000',
  },
  chartWrapper: {
    width: '100%',
    height: (props) => props.chartHeight,
  },
});

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

      let circleColor = '#000';
      if (item.capacityMW === 900) circleColor = '#1DC0F7';
      else if (item.capacityMW === 1300) circleColor = '#0072BC';
      else if (item.capacityMW === 1450) circleColor = '#1D1D1D';

      const circleRadius = 4;
      ctx.fillStyle = circleColor;
      ctx.beginPath();
      ctx.arc(labelX + circleRadius, labelY - 1, circleRadius, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = '#000';
      ctx.textAlign = 'left';
      ctx.fillText(item.group, labelX + circleRadius * 2 + 4, labelY);
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
  { group: 'CP0/CPY Palier', capacityMW: 900, status: { notStarted: 10, inProgress: 7, atRisk: 3, completed: 20 } },
  { group: "P4/P'4 Palier", capacityMW: 1300, status: { notStarted: 5, inProgress: 6, atRisk: 2, completed: 7 } },
  { group: 'N4 Palier', capacityMW: 1450, status: { notStarted: 4, inProgress: 1, atRisk: 0, completed: 0 } },
];

const STATUS_CONFIG = {
  notStarted: { label: 'Not started', color: '#d3d3d3' },
  inProgress: { label: 'In Progress', color: '#f4b740' },
  atRisk: { label: 'At risk', color: '#e53935' },
  completed: { label: 'Completed', color: '#66bb6a' },
};

export default function DeployStatusChart() {
  const chartHeight = mockDeployData.length * 120;
  const classes = useStyles({ chartHeight });

  const chartData = useMemo(() => {
    const labels = mockDeployData.map(d => `${d.group} (${d.capacityMW} MW)`);
    const datasets = Object.entries(STATUS_CONFIG).map(([key, { label, color }]) => ({
      label,
      data: mockDeployData.map(d => d.status[key]),
      backgroundColor: color,
      stack: 'stack1',
      barThickness: 56,
    }));
    return { labels, datasets };
  }, []);

  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { left: 0, right: 10, top: 0, bottom: 0 } },
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
      tooltip: { enabled: false },
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
      },
      y: {
        stacked: true,
        categoryPercentage: 0.4,
        barPercentage: 0.6,
        grid: { display: false, drawBorder: false },
        border: { display: false },
        ticks: { display: false },
      },
    },
  };

  return (
    <div className={classes.container}>
      {/* Header */}
      <div className={classes.header}>
        <BarChartOutlinedIcon className={classes.icon} />
        <span className={classes.headerText}>
          Deploy Status by Palier Group
        </span>
      </div>

      {/* Chart */}
      <div className={classes.chartWrapper}>
        <Bar data={chartData} options={options} plugins={[ChartDataLabels, groupLabelPlugin, hideLastXGridLinePlugin]} />
      </div>
    </div>
  );
}
