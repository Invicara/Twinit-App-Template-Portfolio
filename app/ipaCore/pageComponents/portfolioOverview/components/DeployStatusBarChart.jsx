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

export default function DeployStatusChart({ userConfig }) {
  const chartHeight = mockDeployData.length * 120;
  const classes = useStyles({ chartHeight });
  const chartTitle = userConfig.handlers.portfolioOverview.config.labels?.chartTitle || 'Status';
  const statusConfig = userConfig.handlers.portfolioOverview.config.statusConfig || {}

  const chartData = useMemo(() => {
    const labels = mockDeployData.map(d => `${d.group} (${d.capacityMW} MW)`);
    const datasets = Object.entries(statusConfig).map(([key, { label, color }]) => ({
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
      <div className={classes.chartWrapper}>
        <Bar data={chartData} options={options} plugins={[ChartDataLabels, groupLabelPlugin, hideLastXGridLinePlugin]} />
      </div>
    </div>
  );
}
