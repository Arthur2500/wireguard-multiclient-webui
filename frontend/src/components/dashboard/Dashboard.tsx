import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import statsService from '../../services/stats.service';
import groupService from '../../services/group.service';
import { StatsOverview, Group, User } from '../../types';
import { formatBytes } from '../../utils/helpers';
import { FolderOpen, Monitor, CheckCircle, Users, Plug } from 'lucide-react';
import './Dashboard.css';

interface DashboardProps {
  user: User | null;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, groupsData] = await Promise.all([
        statsService.getOverview(),
        groupService.getAll(),
      ]);
      setStats(statsData);
      setGroups(groupsData);
    } catch (err: any) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Welcome back, {user?.username}</p>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-icon"><FolderOpen size={32} /></div>
          <div className="stat-content">
            <h3>{stats?.total_groups || 0}</h3>
            <p>Total Groups</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><Monitor size={32} /></div>
          <div className="stat-content">
            <h3>{stats?.total_clients || 0}</h3>
            <p>Total Clients</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><CheckCircle size={32} /></div>
          <div className="stat-content">
            <h3>{stats?.active_clients || 0}</h3>
            <p>Active Clients</p>
          </div>
        </div>

        {user?.role === 'admin' && (
          <div className="stat-card">
            <div className="stat-icon"><Users size={32} /></div>
            <div className="stat-content">
              <h3>{stats?.total_users || 0}</h3>
              <p>Total Users</p>
            </div>
          </div>
        )}
      </div>

      <div className="groups-section">
        <div className="section-header">
          <h2>Your Groups</h2>
          <Link to="/groups/new" className="btn-primary">+ New Group</Link>
        </div>

        {groups.length === 0 ? (
          <div className="empty-state">
            <p>No groups yet. Create your first WireGuard group!</p>
          </div>
        ) : (
          <div className="groups-grid">
            {groups.map((group) => (
              <Link to={`/groups/${group.id}`} key={group.id} className="group-card">
                <h3>{group.name}</h3>
                <p className="ip-range mono">{group.ip_range}</p>
                {group.ip_range_v6 && <p className="ip-range-v6 mono">{group.ip_range_v6}</p>}
                <div className="group-meta">
                  <span><Users size={14} /> {group.client_count} clients</span>
                  <span><Plug size={14} /> Port {group.listen_port}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
