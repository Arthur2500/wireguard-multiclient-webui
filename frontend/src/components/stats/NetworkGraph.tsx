import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  ChartData,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TrafficDataPoint } from '../../types';
import { formatBytes } from '../../utils/helpers';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface NetworkGraphProps {
  title: string;
  data: TrafficDataPoint[];
  showUpload?: boolean;
  showDownload?: boolean;
  height?: number;
}

interface MultiSeriesData {
  name: string;
  data: TrafficDataPoint[];
  color: string;
}

interface NetworkGraphMultiProps {
  title: string;
  series: MultiSeriesData[];
  height?: number;
  showLegend?: boolean;
}

// Color palette for multiple series
const COLORS = [
  '#dc2626', // red (primary)
  '#22c55e', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

const getColor = (index: number): string => {
  return COLORS[index % COLORS.length];
};

const formatTime = (dateString: string | null): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Single series graph (upload/download)
export const NetworkGraph: React.FC<NetworkGraphProps> = ({
  title,
  data,
  showUpload = true,
  showDownload = true,
  height = 300,
}) => {
  const chartData: ChartData<'line'> = useMemo(() => {
    const labels = data.map(d => formatTime(d.recorded_at));
    
    const datasets = [];
    
    if (showDownload) {
      datasets.push({
        label: 'Download',
        data: data.map(d => d.received_bytes),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5,
      });
    }
    
    if (showUpload) {
      datasets.push({
        label: 'Upload',
        data: data.map(d => d.sent_bytes),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5,
      });
    }
    
    return { labels, datasets };
  }, [data, showUpload, showDownload]);

  const options: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          color: 'var(--text-primary)',
        },
      },
      title: {
        display: true,
        text: title,
        color: 'var(--text-primary)',
        font: {
          size: 16,
          weight: 'bold',
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.raw as number;
            return `${context.dataset.label}: ${formatBytes(value)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'var(--border)',
        },
        ticks: {
          color: 'var(--text-secondary)',
          maxTicksLimit: 10,
        },
      },
      y: {
        grid: {
          color: 'var(--border)',
        },
        min: 0,
        ticks: {
          color: 'var(--text-secondary)',
          callback: (value) => formatBytes(value as number),
        },
      },
    },
  }), [title]);

  return (
    <div className="network-graph" style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

// Multi-series graph for groups/clients
export const NetworkGraphMulti: React.FC<NetworkGraphMultiProps> = ({
  title,
  series,
  height = 300,
  showLegend = true,
}) => {
  const chartData: ChartData<'line'> = useMemo(() => {
    // Get all unique timestamps across all series
    const allTimestamps = new Set<string>();
    series.forEach(s => {
      s.data.forEach(d => {
        if (d.recorded_at) allTimestamps.add(d.recorded_at);
      });
    });
    
    const sortedTimestamps = Array.from(allTimestamps).sort();
    const labels = sortedTimestamps.map(t => formatTime(t));
    
    const datasets = series.map((s, index) => {
      const color = s.color || getColor(index);
      const dataMap = new Map(s.data.map(d => [d.recorded_at, d]));
      
      return {
        label: s.name,
        data: sortedTimestamps.map(t => {
          const point = dataMap.get(t);
          return point ? point.received_bytes + point.sent_bytes : 0;
        }),
        borderColor: color,
        backgroundColor: `${color}20`,
        fill: false,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5,
      };
    });
    
    return { labels, datasets };
  }, [series]);

  const options: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: showLegend,
        position: 'top',
        labels: {
          usePointStyle: true,
          color: 'var(--text-primary)',
        },
      },
      title: {
        display: true,
        text: title,
        color: 'var(--text-primary)',
        font: {
          size: 16,
          weight: 'bold',
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.raw as number;
            return `${context.dataset.label}: ${formatBytes(value)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'var(--border)',
        },
        ticks: {
          color: 'var(--text-secondary)',
          maxTicksLimit: 10,
        },
      },
      y: {
        grid: {
          color: 'var(--border)',
        },
        min: 0,
        ticks: {
          color: 'var(--text-secondary)',
          callback: (value) => formatBytes(value as number),
        },
      },
    },
  }), [title, showLegend]);

  return (
    <div className="network-graph" style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

export default NetworkGraph;
