import React, { useState, useEffect, useCallback } from 'react';
import statsService from '../../services/stats.service';
import {
  SystemStats,
  TimeRange,
  TotalTrafficHistory,
  GroupsTrafficHistory,
  ClientsTrafficHistory
} from '../../types';
import { formatBytes } from '../../utils/helpers';
import { Users, FolderOpen, Monitor, CheckCircle, Download, Upload, BarChart3, RefreshCw } from 'lucide-react';
import { NetworkGraph, NetworkGraphMulti } from './NetworkGraph';
import TimeRangeSelector from './TimeRangeSelector';
import './Stats.css';

type GraphView = 'total' | 'groups' | 'clients';

const Stats: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Traffic graph state
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [graphView, setGraphView] = useState<GraphView>('total');
  const [totalTraffic, setTotalTraffic] = useState<TotalTrafficHistory | null>(null);
  const [groupsTraffic, setGroupsTraffic] = useState<GroupsTrafficHistory | null>(null);
  const [clientsTraffic, setClientsTraffic] = useState<ClientsTrafficHistory | null>(null);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficError, setTrafficError] = useState('');

  const loadStats = useCallback(async () => {
    try {
      const data = await statsService.getSystemStats();
      setStats(data);
    } catch (err) {
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrafficData = useCallback(async () => {
    setTrafficLoading(true);
    setTrafficError('');
    try {
      if (graphView === 'total') {
        const data = await statsService.getTotalTraffic(timeRange);
        setTotalTraffic(data);
      } else if (graphView === 'groups') {
        const data = await statsService.getGroupsTraffic(timeRange);
        setGroupsTraffic(data);
      } else if (graphView === 'clients') {
        const data = await statsService.getClientsTraffic(timeRange);
        setClientsTraffic(data);
      }
    } catch (err) {
      console.error('Failed to load traffic data:', err);
      setTrafficError('Failed to load traffic data');
    } finally {
      setTrafficLoading(false);
    }
  }, [timeRange, graphView]);

  const handleCollectTraffic = async () => {
    setTrafficError('');
    try {
      await statsService.collectTraffic();
      await loadTrafficData();
    } catch (err) {
      console.error('Failed to collect traffic:', err);
      setTrafficError('Failed to collect traffic data');
    }
  };

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTrafficData();
  }, [loadTrafficData]);

  // Auto-refresh traffic data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadTrafficData();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadTrafficData]);

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!stats) return null;

  const renderGraph = () => {
    if (trafficLoading) {
      return <div className="graph-loading">Loading graph data...</div>;
    }

    if (trafficError) {
      return <div className="graph-error">{trafficError}</div>;
    }

    if (graphView === 'total' && totalTraffic) {
      return (
        <NetworkGraph
          title="Total Network Traffic"
          data={totalTraffic.data}
          height={350}
        />
      );
    }

    if (graphView === 'groups' && groupsTraffic) {
      const series = groupsTraffic.groups.map((g) => ({
        name: g.group_name,
        data: g.data,
        color: '',
      }));
      return (
        <NetworkGraphMulti
          title="Traffic by Group"
          series={series}
          height={350}
        />
      );
    }

    if (graphView === 'clients' && clientsTraffic) {
      const series = clientsTraffic.clients.map((c) => ({
        name: c.client_name,
        data: c.data,
        color: '',
      }));
      return (
        <NetworkGraphMulti
          title="Traffic by Client"
          series={series}
          height={350}
          showLegend={clientsTraffic.clients.length <= 10}
        />
      );
    }

    return <div className="no-data">No traffic data available. Click "Collect Now" to start recording.</div>;
  };

  return (
    <div className="stats-container">
      <div className="page-header">
        <h1>System Statistics</h1>
      </div>

      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-icon"><Users size={32} /></div>
          <div className="stat-content">
            <h3>{stats.total_users}</h3>
            <p>Total Users</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><FolderOpen size={32} /></div>
          <div className="stat-content">
            <h3>{stats.total_groups}</h3>
            <p>Total Groups</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><Monitor size={32} /></div>
          <div className="stat-content">
            <h3>{stats.total_clients}</h3>
            <p>Total Clients</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><CheckCircle size={32} /></div>
          <div className="stat-content">
            <h3>{stats.active_clients}</h3>
            <p>Active Clients</p>
          </div>
        </div>
      </div>

      <div className="traffic-overview">
        <div className="traffic-card total">
          <h3>Total Network Traffic</h3>
          <div className="traffic-details">
            <div className="traffic-item">
              <span className="label"><Download size={16} /> Received</span>
              <span className="value">{formatBytes(stats.total_received_bytes)}</span>
            </div>
            <div className="traffic-item">
              <span className="label"><Upload size={16} /> Sent</span>
              <span className="value">{formatBytes(stats.total_sent_bytes)}</span>
            </div>
            <div className="traffic-item">
              <span className="label"><BarChart3 size={16} /> Total</span>
              <span className="value">
                {formatBytes(stats.total_received_bytes + stats.total_sent_bytes)}
              </span>
            </div>
          </div>
        </div>

        <div className="traffic-card connections">
          <h3>Recent Activity</h3>
          <div className="connections-count">
            <span className="number">{stats.recent_connections_24h}</span>
            <span className="label">Connections in last 24h</span>
          </div>
        </div>
      </div>

      {/* Network Traffic Graphs Section */}
      <div className="traffic-graphs-section">
        <div className="section-header">
          <h2>Network Traffic Graphs</h2>
          <div className="graph-controls">
            <div className="graph-view-selector">
              <button
                className={`view-btn ${graphView === 'total' ? 'active' : ''}`}
                onClick={() => setGraphView('total')}
              >
                Total
              </button>
              <button
                className={`view-btn ${graphView === 'groups' ? 'active' : ''}`}
                onClick={() => setGraphView('groups')}
              >
                Groups
              </button>
              <button
                className={`view-btn ${graphView === 'clients' ? 'active' : ''}`}
                onClick={() => setGraphView('clients')}
              >
                Clients
              </button>
            </div>
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
            <button
              className="btn-secondary collect-btn"
              onClick={handleCollectTraffic}
              title="Collect traffic data now"
            >
              <RefreshCw size={16} /> Collect Now
            </button>
          </div>
        </div>
        <div className="graph-container">
          {renderGraph()}
        </div>
      </div>

      <div className="groups-stats">
        <h2>Groups Breakdown</h2>
        <table className="stats-table">
          <thead>
            <tr>
              <th>Group Name</th>
              <th>Owner</th>
              <th>Total Clients</th>
              <th>Active Clients</th>
              <th>Data Received</th>
              <th>Data Sent</th>
              <th>Total Traffic</th>
            </tr>
          </thead>
          <tbody>
            {stats.groups.length > 0 ? stats.groups.map((group) => (
              <tr key={group.id}>
                <td className="group-name">{group.name}</td>
                <td>{group.owner}</td>
                <td>{group.client_count}</td>
                <td>
                  <span className={`badge ${group.active_clients > 0 ? 'badge-success' : 'badge-muted'}`}>
                    {group.active_clients}
                  </span>
                </td>
                <td>{formatBytes(group.received_bytes)}</td>
                <td>{formatBytes(group.sent_bytes)}</td>
                <td className="total-traffic">
                  {formatBytes(group.received_bytes + group.sent_bytes)}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '30px' }}>
                  No groups found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="clients-stats">
        <h2>Clients Breakdown</h2>
        <table className="stats-table">
          <thead>
            <tr>
              <th>Client Name</th>
              <th>Group</th>
              <th>Status</th>
              <th>Data Received</th>
              <th>Data Sent</th>
              <th>Total Traffic</th>
            </tr>
          </thead>
          <tbody>
            {stats.clients && stats.clients.length > 0 ? stats.clients.map((client) => (
              <tr key={client.id}>
                <td className="group-name">{client.name}</td>
                <td>{client.group_name}</td>
                <td>
                  <span className={`badge ${client.is_active ? 'badge-success' : 'badge-danger'}`}>
                    {client.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td>{formatBytes(client.received_bytes)}</td>
                <td>{formatBytes(client.sent_bytes)}</td>
                <td className="total-traffic">
                  {formatBytes(client.received_bytes + client.sent_bytes)}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '30px' }}>
                  No clients found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="users-stats">
        <h2>Users Breakdown</h2>
        <table className="stats-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Groups</th>
              <th>Clients</th>
              <th>Data Received</th>
              <th>Data Sent</th>
              <th>Total Traffic</th>
            </tr>
          </thead>
          <tbody>
            {stats.users && stats.users.length > 0 ? stats.users.map((user) => (
              <tr key={user.id}>
                <td className="group-name">{user.username}</td>
                <td>
                  <span className={`badge ${user.role === 'admin' ? 'badge-warning' : 'badge-muted'}`}>
                    {user.role}
                  </span>
                </td>
                <td>{user.group_count}</td>
                <td>{user.client_count}</td>
                <td>{formatBytes(user.received_bytes)}</td>
                <td>{formatBytes(user.sent_bytes)}</td>
                <td className="total-traffic">
                  {formatBytes(user.received_bytes + user.sent_bytes)}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '30px' }}>
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Stats;
