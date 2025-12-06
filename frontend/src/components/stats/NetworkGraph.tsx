import React, { useMemo, useEffect, useState } from 'react';
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

// Hook to get current theme colors
const useThemeColors = () => {
  const [colors, setColors] = useState({
    primary: '#dc2626',
    success: '#22c55e',
    info: '#3b82f6',
    textPrimary: '#1a1a1a',
    textSecondary: '#555555',
    border: '#cccccc',
    bgPrimary: '#ffffff',
  });

  useEffect(() => {
    const updateColors = () => {
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);

      setColors({
        primary: computedStyle.getPropertyValue('--primary').trim() || '#dc2626',
        success: computedStyle.getPropertyValue('--success').trim() || '#22c55e',
        info: '#3b82f6',
        textPrimary: computedStyle.getPropertyValue('--text-primary').trim() || '#1a1a1a',
        textSecondary: computedStyle.getPropertyValue('--text-secondary').trim() || '#555555',
        border: computedStyle.getPropertyValue('--border').trim() || '#cccccc',
        bgPrimary: computedStyle.getPropertyValue('--bg-primary').trim() || '#ffffff',
      });
    };

    updateColors();

    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          updateColors();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  return colors;
};

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
  const themeColors = useThemeColors();

  const chartData: ChartData<'line'> = useMemo(() => {
    const labels = data.map(d => formatTime(d.recorded_at));

    const datasets = [];

    if (showDownload) {
      // Convert hex to rgba
      const downloadColorRgba = hexToRgba(themeColors.success, 0.1);

      datasets.push({
        label: 'Download',
        data: data.map(d => d.received_bytes),
        borderColor: themeColors.success,
        backgroundColor: downloadColorRgba,
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      });
    }

    if (showUpload) {
      const uploadColorRgba = hexToRgba(themeColors.info, 0.1);

      datasets.push({
        label: 'Upload',
        data: data.map(d => d.sent_bytes),
        borderColor: themeColors.info,
        backgroundColor: uploadColorRgba,
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      });
    }

    return { labels, datasets };
  }, [data, showUpload, showDownload, themeColors]);

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
          color: themeColors.textPrimary,
          padding: 15,
          font: {
            size: 12,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
          },
        },
      },
      title: {
        display: true,
        text: title,
        color: themeColors.textPrimary,
        font: {
          size: 16,
          weight: 'bold' as const,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
        },
        padding: {
          bottom: 20,
        },
      },
      tooltip: {
        backgroundColor: themeColors.bgPrimary,
        titleColor: themeColors.textPrimary,
        bodyColor: themeColors.textSecondary,
        borderColor: themeColors.border,
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        usePointStyle: true,
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
          color: themeColors.border,
          drawTicks: false,
        },
        ticks: {
          color: themeColors.textSecondary,
          maxTicksLimit: 10,
          padding: 8,
          font: {
            size: 11,
          },
        },
        border: {
          color: themeColors.border,
        },
      },
      y: {
        grid: {
          color: themeColors.border,
          drawTicks: false,
        },
        min: 0,
        ticks: {
          color: themeColors.textSecondary,
          padding: 8,
          font: {
            size: 11,
          },
          callback: (value) => formatBytes(value as number),
        },
        border: {
          color: themeColors.border,
        },
      },
    },
  }), [title, themeColors]);

  return (
    <div className="network-graph" style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

// Helper function to convert hex to rgba
const hexToRgba = (hex: string, alpha: number): string => {
  // Remove # if present
  hex = hex.replace('#', '');

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Multi-series graph for groups/clients
export const NetworkGraphMulti: React.FC<NetworkGraphMultiProps> = ({
  title,
  series,
  height = 300,
  showLegend = true,
}) => {
  const themeColors = useThemeColors();

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
        backgroundColor: hexToRgba(color, 0.1),
        fill: false,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
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
          color: themeColors.textPrimary,
          padding: 15,
          font: {
            size: 12,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
          },
        },
      },
      title: {
        display: true,
        text: title,
        color: themeColors.textPrimary,
        font: {
          size: 16,
          weight: 'bold' as const,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
        },
        padding: {
          bottom: 20,
        },
      },
      tooltip: {
        backgroundColor: themeColors.bgPrimary,
        titleColor: themeColors.textPrimary,
        bodyColor: themeColors.textSecondary,
        borderColor: themeColors.border,
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        usePointStyle: true,
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
          color: themeColors.border,
          drawTicks: false,
        },
        ticks: {
          color: themeColors.textSecondary,
          maxTicksLimit: 10,
          padding: 8,
          font: {
            size: 11,
          },
        },
        border: {
          color: themeColors.border,
        },
      },
      y: {
        grid: {
          color: themeColors.border,
          drawTicks: false,
        },
        min: 0,
        ticks: {
          color: themeColors.textSecondary,
          padding: 8,
          font: {
            size: 11,
          },
          callback: (value) => formatBytes(value as number),
        },
        border: {
          color: themeColors.border,
        },
      },
    },
  }), [title, showLegend, themeColors]);

  return (
    <div className="network-graph" style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

export default NetworkGraph;
