import { TrafficDataPoint } from '../types';

export function formatBytes(bytes: number): string {
  if (bytes === 0 || isNaN(bytes) || !isFinite(bytes)) return '0 B';
  if (bytes < 0) bytes = 0;
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0 || i >= sizes.length) return '0 B';
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleString();
}

export function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Aggregates traffic data points to a maximum of maxPoints by averaging data in buckets.
 * This reduces the number of points displayed while preserving data accuracy.
 *
 * @param data - Array of traffic data points
 * @param maxPoints - Maximum number of points to return (default: 100)
 * @returns Aggregated data points
 */
export function aggregateTrafficData(
  data: TrafficDataPoint[],
  maxPoints: number = 100
): TrafficDataPoint[] {
  // If data is already smaller than or equal to maxPoints, return as-is
  if (data.length <= maxPoints) {
    return data;
  }

  // Calculate bucket size
  const bucketSize = Math.ceil(data.length / maxPoints);
  const aggregated: TrafficDataPoint[] = [];

  for (let i = 0; i < data.length; i += bucketSize) {
    const bucket = data.slice(i, Math.min(i + bucketSize, data.length));

    // Use the first point's metadata
    const firstPoint = bucket[0];

    // Use the first timestamp of the bucket (or last if first is null)
    let timestamp = firstPoint?.recorded_at || null;
    if (!timestamp && bucket.length > 0) {
      timestamp = bucket.find(d => d.recorded_at)?.recorded_at || null;
    }

    // Calculate average bytes for the bucket
    const totalReceived = bucket.reduce((sum, d) => sum + d.received_bytes, 0);
    const totalSent = bucket.reduce((sum, d) => sum + d.sent_bytes, 0);

    aggregated.push({
      id: firstPoint?.id || 0,
      client_id: firstPoint?.client_id || null,
      group_id: firstPoint?.group_id || null,
      recorded_at: timestamp,
      received_bytes: Math.round(totalReceived / bucket.length),
      sent_bytes: Math.round(totalSent / bucket.length),
    });
  }

  return aggregated;
}
