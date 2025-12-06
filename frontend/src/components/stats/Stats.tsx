import React, { useState, useEffect } from 'react';
import statsService from '../../services/stats.service';
import { SystemStats } from '../../types';
import { formatBytes } from '../../utils/helpers';
import { Users, FolderOpen, Monitor, CheckCircle, Download, Upload, BarChart3 } from 'lucide-react';
import './Stats.css';

const Stats: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await statsService.getSystemStats();
      setStats(data);
    } catch (err) {
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!stats) return null;

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
