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
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// Constants for graph configuration
const EMPTY_GRAPH_TIME_POINTS = 12;
const TIME_INTERVAL_MINUTES = 5;
const DEFAULT_DATA_POINT = { received_bytes: 0, sent_bytes: 0 };

// Generate time labels even when data is empty
const generateTimeLabels = (data: TrafficDataPoint[], count: number = EMPTY_GRAPH_TIME_POINTS): string[] => {
  if (data.length > 0) {
    return data.map(d => formatTime(d.recorded_at));
  }
  
  // Generate empty time labels for the past period
  const now = new Date();
  const labels: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * TIME_INTERVAL_MINUTES * 60 * 1000);
    labels.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }
  return labels;
};

// Calculate data rate (bytes/second) from cumulative data points
const calculateRates = (data: TrafficDataPoint[]): { received_rate: number; sent_rate: number }[] => {
  if (data.length < 2) {
    return data.map(() => ({ received_rate: 0, sent_rate: 0 }));
  }
  
  const rates = [];
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      // First point - no previous data, assume 0 rate
      rates.push({ received_rate: 0, sent_rate: 0 });
    } else {
      const current = data[i];
      const previous = data[i - 1];
      
      // Calculate time difference in seconds
      const currentTime = new Date(current.recorded_at || '').getTime();
      const previousTime = new Date(previous.recorded_at || '').getTime();
      const timeDiffSeconds = (currentTime - previousTime) / 1000;
      
      if (timeDiffSeconds > 0) {
        // Calculate byte differences
        const receivedDiff = Math.max(0, current.received_bytes - previous.received_bytes);
        const sentDiff = Math.max(0, current.sent_bytes - previous.sent_bytes);
        
        // Calculate rates (bytes per second)
        rates.push({
          received_rate: receivedDiff / timeDiffSeconds,
          sent_rate: sentDiff / timeDiffSeconds,
        });
      } else {
        rates.push({ received_rate: 0, sent_rate: 0 });
      }
    }
  }
  
  return rates;
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
    const labels = generateTimeLabels(data);
    const dataPoints = data.length > 0 ? data : Array(labels.length).fill(DEFAULT_DATA_POINT);
    const rates = calculateRates(data);

    const datasets = [];

    if (showDownload) {
      // Convert hex to rgba
      const downloadColorRgba = hexToRgba(themeColors.success, 0.1);

      datasets.push({
        label: 'Download Rate',
        data: data.length > 0 ? rates.map(r => r.received_rate) : dataPoints.map(() => 0),
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
        label: 'Upload Rate',
        data: data.length > 0 ? rates.map(r => r.sent_rate) : dataPoints.map(() => 0),
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
            return `${context.dataset.label}: ${formatBytes(value)}/s`;
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
          callback: (value) => `${formatBytes(value as number)}/s`,
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

    let sortedTimestamps = Array.from(allTimestamps).sort();
    let labels: string[];
    
    // If no data, generate empty time labels using the shared function
    if (sortedTimestamps.length === 0) {
      // Create dummy data points for label generation
      const dummyData: TrafficDataPoint[] = [];
      labels = generateTimeLabels(dummyData, EMPTY_GRAPH_TIME_POINTS);
      sortedTimestamps = Array(EMPTY_GRAPH_TIME_POINTS).fill(null);
    } else {
      labels = sortedTimestamps.map(t => formatTime(t));
    }

    const datasets = series.map((s, index) => {
      const color = s.color || getColor(index);
      const dataMap = new Map(s.data.map(d => [d.recorded_at, d]));
      const rates = calculateRates(s.data);

      return {
        label: s.name,
        data: sortedTimestamps.map((t, idx) => {
          if (t === null) return 0; // For empty data
          const point = dataMap.get(t);
          if (!point) return 0;
          
          // Find the index in the original data
          const dataIndex = s.data.findIndex(d => d.recorded_at === t);
          if (dataIndex >= 0 && dataIndex < rates.length) {
            return rates[dataIndex].received_rate + rates[dataIndex].sent_rate;
          }
          return 0;
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
            return `${context.dataset.label}: ${formatBytes(value)}/s`;
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
          callback: (value) => formatBytes(value as number)/s,
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
