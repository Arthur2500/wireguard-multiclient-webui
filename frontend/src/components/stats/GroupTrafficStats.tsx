import React, { useState, useEffect, useCallback } from 'react';
import statsService from '../../services/stats.service';
import { TimeRange, GroupDetailedTrafficHistory } from '../../types';
import { NetworkGraph, NetworkGraphMulti } from './NetworkGraph';
import TimeRangeSelector from './TimeRangeSelector';
import { RefreshCw } from 'lucide-react';
import './GroupTrafficStats.css';

interface GroupTrafficStatsProps {
  groupId: number;
}

const GroupTrafficStats: React.FC<GroupTrafficStatsProps> = ({ groupId }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [trafficData, setTrafficData] = useState<GroupDetailedTrafficHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadTrafficData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await statsService.getGroupTrafficHistory(groupId, timeRange);
      setTrafficData(data);
    } catch (err) {
      setError('Failed to load traffic data');
      console.error('Failed to load group traffic data:', err);
    } finally {
      setLoading(false);
    }
  }, [groupId, timeRange]);

  const handleCollectTraffic = async () => {
    try {
      await statsService.collectTraffic();
      await loadTrafficData();
    } catch (err) {
      console.error('Failed to collect traffic:', err);
    }
  };

  useEffect(() => {
    loadTrafficData();
  }, [loadTrafficData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadTrafficData();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadTrafficData]);

  if (error) {
    return <div className="group-traffic-error">{error}</div>;
  }

  const hasData = trafficData && (trafficData.group_data.length > 0 || trafficData.clients.some(c => c.data.length > 0));

  return (
    <div className="group-traffic-stats">
      <div className="traffic-section-header">
        <h3>Network Traffic</h3>
        <div className="traffic-controls">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          <button 
            className="btn-secondary collect-btn" 
            onClick={handleCollectTraffic}
            title="Collect traffic data now"
          >
            <RefreshCw size={16} /> Collect
          </button>
        </div>
      </div>

      {loading && <div className="traffic-loading">Loading traffic data...</div>}

      {!loading && !hasData && (
        <div className="no-traffic-data">
          No traffic data available. Click "Collect" to start recording.
        </div>
      )}

      {!loading && hasData && trafficData && (
        <>
          {/* Group total traffic graph */}
          <div className="traffic-graph-section">
            <NetworkGraph
              title={`${trafficData.group_name} - Total Traffic`}
              data={trafficData.group_data}
              height={300}
            />
          </div>

          {/* Per-client traffic graph */}
          {trafficData.clients.length > 0 && (
            <div className="traffic-graph-section">
              <NetworkGraphMulti
                title="Traffic by Client"
                series={trafficData.clients.map((c) => ({
                  name: c.client_name,
                  data: c.data,
                  color: '',
                }))}
                height={300}
                showLegend={trafficData.clients.length <= 10}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GroupTrafficStats;
