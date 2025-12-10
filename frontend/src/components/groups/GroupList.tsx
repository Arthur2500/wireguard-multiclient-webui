import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import groupService from '../../services/group.service';
import { Group, User } from '../../types';
import './GroupList.css';

interface GroupListProps {
  user: User | null;
}

const GroupList: React.FC<GroupListProps> = ({ user }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await groupService.getAll();
      setGroups(data);
    } catch (err) {
      setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this group?')) return;

    try {
      await groupService.delete(id);
      setGroups(groups.filter(g => g.id !== id));
    } catch (err) {
      setError('Failed to delete group');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="group-list-container">
      <div className="page-header">
        <h1>WireGuard Groups</h1>
        {user?.can_create_groups && (
          <Link to="/groups/new" className="btn-primary">+ New Group</Link>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {groups.length === 0 ? (
        <div className="empty-state">
          <h2>No groups yet</h2>
          <p style={{ marginBottom: '15px' }}>Create your first WireGuard group to get started.</p>
          {user?.can_create_groups && (
            <Link to="/groups/new" className="btn-primary">Create Group</Link>
          )}
        </div>
      ) : (
        <div className="groups-table-container">
          <table className="groups-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Owner</th>
                <th>IP Range (IPv4)</th>
                <th>IPv6 Range</th>
                <th>Server IP</th>
                <th>Port</th>
                <th>Clients</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id}>
                  <td>
                    <Link to={`/groups/${group.id}`} className="group-name">
                      {group.name}
                    </Link>
                    {group.description && (
                      <span className="group-desc">{group.description}</span>
                    )}
                  </td>
                  <td>{group.owner_username || 'Unknown'}</td>
                  <td className="mono">{group.ip_range}</td>
                  <td className="mono">{group.ip_range_v6 || '-'}</td>
                  <td className="mono">{group.server_ip}</td>
                  <td>{group.listen_port}</td>
                  <td>{group.client_count}</td>
                  <td>
                    <span className={`badge ${group.is_running ? 'badge-success' : 'badge-warning'}`}>
                      {group.is_running ? 'Running' : 'Stopped'}
                    </span>
                  </td>
                  <td className="actions">
                    <Link to={`/groups/${group.id}`} className="btn-action">View</Link>
                    <Link to={`/groups/${group.id}/edit`} className="btn-action">Edit</Link>
                    <button onClick={() => handleDelete(group.id)} className="btn-action btn-danger">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default GroupList;
