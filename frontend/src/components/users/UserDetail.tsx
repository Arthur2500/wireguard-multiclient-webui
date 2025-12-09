import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import userService from '../../services/user.service';
import { User } from '../../types';
import { Pencil, Lock, Unlock, Trash2 } from 'lucide-react';
import './UserDetail.css';

const UserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  useEffect(() => {
    loadUser();
    // Get current user from localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadUser = async () => {
    try {
      const data = await userService.getById(Number(id));
      setUser(data);
    } catch (err) {
      setError('Failed to load user');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    if (!user) return;
    
    const action = user.is_active ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;

    setActionInProgress(true);
    try {
      const updated = await userService.update(user.id, { is_active: !user.is_active });
      setUser(updated);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action} user`);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    
    if (!window.confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) return;

    setActionInProgress(true);
    try {
      await userService.delete(user.id);
      navigate('/users');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete user');
      setActionInProgress(false);
    }
  };

  // Only admins can manage other users
  const canManage = currentUser?.role === 'admin';

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
        {canManage && (
          <div className="header-actions">
            <button
              onClick={handleToggleActive}
              className={user.is_active ? 'btn-danger' : 'btn-success'}
              disabled={actionInProgress}
              title={user.is_active ? 'Disable User' : 'Enable User'}
            >
              {user.is_active ? <><Lock size={16} /> Disable</> : <><Unlock size={16} /> Enable</>}
            </button>
            <Link to="/users" className="btn-secondary">
              <Pencil size={16} /> Edit User
            </Link>
            <button
              onClick={handleDelete}
              className="btn-danger"
              disabled={actionInProgress}
              title="Delete User"
            >
              <Trash2 size={16} /> Delete
            </button>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="user-info-cards">
        <div className="info-card">
          <h3>Account Information</h3>
          <dl>
            <dt>Username</dt>
            <dd>{user.username}</dd>
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
            <dt>Can Create Groups</dt>
            <dd>
              <span className={`badge ${user.can_create_groups ? 'badge-success' : 'badge-danger'}`}>
                {user.can_create_groups ? 'Yes' : 'No'}
              </span>
            </dd>
            <dt>Can Create Clients</dt>
            <dd>
              <span className={`badge ${user.can_create_clients ? 'badge-success' : 'badge-danger'}`}>
                {user.can_create_clients ? 'Yes' : 'No'}
              </span>
            </dd>
          </dl>
        </div>

        <div className="info-card">
          <h3>Account Details</h3>
          <dl>
            <dt>Created At</dt>
            <dd>{user.created_at ? new Date(user.created_at).toLocaleString() : '-'}</dd>
            <dt>Updated At</dt>
            <dd>{user.updated_at ? new Date(user.updated_at).toLocaleString() : '-'}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
};

export default UserDetail;
