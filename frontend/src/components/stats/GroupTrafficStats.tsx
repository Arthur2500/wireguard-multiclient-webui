import React, { useState, useEffect, useCallback } from 'react';
import statsService from '../../services/stats.service';
import { TimeRange, GroupDetailedTrafficHistory } from '../../types';
import { NetworkGraph, NetworkGraphMulti } from './NetworkGraph';
import TimeRangeSelector from './TimeRangeSelector';
import './GroupTrafficStats.css';

interface GroupTrafficStatsProps {
  groupId: number;
}

type GraphView = 'total' | 'clients';

const GroupTrafficStats: React.FC<GroupTrafficStatsProps> = ({ groupId }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [graphView, setGraphView] = useState<GraphView>('total');
  const [trafficData, setTrafficData] = useState<GroupDetailedTrafficHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadTrafficData = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    } else {
      setIsAutoRefreshing(true);
    }
    setError('');
    try {
      const data = await statsService.getGroupTrafficHistory(groupId, timeRange);
      setTrafficData(data);
    } catch (err) {
      setError('Failed to load traffic data');
      console.error('Failed to load group traffic data:', err);
    } finally {
      if (!isBackground) {
        setLoading(false);
      } else {
        setIsAutoRefreshing(false);
      }
    }
  }, [groupId, timeRange]);

  useEffect(() => {
    loadTrafficData();
  }, [loadTrafficData]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadTrafficData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [loadTrafficData]);

  if (error) {
    return <div className="group-traffic-error">{error}</div>;
  }

  const hasData = trafficData && (trafficData.group_data.length > 0 || trafficData.clients.some(c => c.data.length > 0));

  const renderGraph = () => {
    if (!trafficData) return null;

    if (graphView === 'total') {
      return (
        <NetworkGraph
          title={`${trafficData.group_name} - Total Traffic`}
          data={trafficData.group_data}
          height={300}
        />
      );
    }

    if (graphView === 'clients' && trafficData.clients.length > 0) {
      return (
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
      );
    }

    return null;
  };

  return (
    <div className="group-traffic-stats">
      <div className="traffic-section-header">
        <h3>Network Traffic</h3>
        <div className="traffic-controls">
          <div className="graph-view-selector">
            <button
              className={`view-btn ${graphView === 'total' ? 'active' : ''}`}
              onClick={() => setGraphView('total')}
            >
              Total
            </button>
            <button
              className={`view-btn ${graphView === 'clients' ? 'active' : ''}`}
              onClick={() => setGraphView('clients')}
              disabled={!trafficData || trafficData.clients.length === 0}
            >
              Clients
            </button>
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      {loading && <div className="traffic-loading">Loading traffic data...</div>}

      {!loading && trafficData && (
        <div
          className="traffic-graph-section"
          style={{
            opacity: isAutoRefreshing ? 0.7 : 1,
            transition: 'opacity 0.3s ease-in-out'
          }}
        >
          {renderGraph()}
        </div>
      )}
    </div>
  );
};

export default GroupTrafficStats;
