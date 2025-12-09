import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import userService from '../../services/user.service';
import { User } from '../../types';
import './UserDetail.css';

const UserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUser();
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

  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <div className="error">User not found</div>;

  return (
    <div className="user-detail-container">
      <div className="page-header">
        <div>
          <Link to="/users" className="back-link">← Back to Users</Link>
          <h1>User: {user.username}</h1>
        </div>
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
