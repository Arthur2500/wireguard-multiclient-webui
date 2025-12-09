import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import userService from '../../services/user.service';
import { User } from '../../types';
import { formatDate } from '../../utils/helpers';
import { Pencil, Lock, Unlock, Mail, User as UserIcon } from 'lucide-react';
import './UserDetail.css';

const UserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const userData = await userService.getById(Number(id));
      setUser(userData);
    } catch (err) {
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, loadData]);

  const handleToggleActive = async () => {
    if (!user) return;
    
    const action = user.is_active ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      const updated = await userService.update(user.id, { is_active: !user.is_active });
      setUser(updated);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action} user`);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <div className="error">User not found</div>;

  return (
    <div className="user-detail">
      <div className="page-header">
        <div>
          <Link to="/users" className="back-link">← Back to Users</Link>
          <h1>{user.username}</h1>
          <p className="description">{user.email}</p>
        </div>
        <div className="header-actions">
          <button
            onClick={handleToggleActive}
            className={user.is_active ? 'btn-danger' : 'btn-success'}
            title={user.is_active ? 'Disable User' : 'Enable User'}
          >
            {user.is_active ? <><Lock size={16} /> Disable</> : <><Unlock size={16} /> Enable</>}
          </button>
          <Link to={`/users/${id}/edit`} className="btn-primary">
            <Pencil size={16} /> Edit User
          </Link>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="user-info-cards">
        <div className="info-card">
          <h3>Account Information</h3>
          <dl>
            <dt>Username</dt>
            <dd className="mono">{user.username}</dd>
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Role</dt>
            <dd>
              <span className={`badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}`}>
                {user.role}
              </span>
            </dd>
            <dt>Status</dt>
            <dd>
              <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
            </dd>
          </dl>
        </div>

        <div className="info-card">
          <h3>Permissions</h3>
          <dl>
            <dt>Create Groups</dt>
            <dd>
              <span className={`badge ${user.can_create_groups ? 'badge-success' : 'badge-muted'}`}>
                {user.can_create_groups ? '✓ Allowed' : '✗ Not Allowed'}
              </span>
            </dd>
            <dt>Create Clients</dt>
            <dd>
              <span className={`badge ${user.can_create_clients ? 'badge-success' : 'badge-muted'}`}>
                {user.can_create_clients ? '✓ Allowed' : '✗ Not Allowed'}
              </span>
            </dd>
          </dl>
        </div>

        <div className="info-card">
          <h3>Timestamps</h3>
          <dl>
            <dt>Created</dt>
            <dd>{formatDate(user.created_at)}</dd>
            <dt>Last Updated</dt>
            <dd>{formatDate(user.updated_at)}</dd>
          </dl>
        </div>
      </div>

      <div className="info-section">
        <div className="section-header">
          <h2>User Overview</h2>
        </div>
        <div className="info-content">
          <div className="info-item">
            <UserIcon size={20} className="info-icon" />
            <div>
              <strong>Account Type:</strong>
              <p>
                This user has {user.role === 'admin' ? 'administrative' : 'standard'} privileges
                {user.role === 'admin' && ' and can access all system features'}
              </p>
            </div>
          </div>
          <div className="info-item">
            <Mail size={20} className="info-icon" />
            <div>
              <strong>Contact:</strong>
              <p>Email notifications will be sent to {user.email}</p>
            </div>
          </div>
          {!user.is_active && (
            <div className="info-item warning">
              <Lock size={20} className="info-icon" />
              <div>
                <strong>Account Disabled:</strong>
                <p>This user account is currently inactive and cannot access the system</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDetail;
