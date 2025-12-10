import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import userService from '../../services/user.service';
import { User } from '../../types';
import './UserList.css';

const UserList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await userService.getAll();
      setUsers(data);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await userService.delete(id);
      setUsers(users.filter(u => u.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="user-list-container">
      <div className="page-header">
        <h1>User Management</h1>
        <Link to="/users/new" className="btn-primary">+ New User</Link>
      </div>

      {error && <div className="error-message">{error}</div>}

      {users.length === 0 ? (
        <div className="empty-state">
          <h2>No users yet</h2>
          <p>Create your first user to get started.</p>
          <Link to="/users/new" className="btn-primary">Create User</Link>
        </div>
      ) : (
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Permissions</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className={!user.is_active ? 'disabled' : ''}>
                  <td>
                    <Link to={`/users/${user.id}`} className="user-name">
                      {user.username}
                    </Link>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <div className="permissions-badges">
                      {user.can_create_groups && <span className="badge badge-success" title="Can create groups">✓ Groups</span>}
                      {user.can_create_clients && <span className="badge badge-success" title="Can create clients">✓ Clients</span>}
                      {!user.can_create_groups && !user.can_create_clients && <span className="badge badge-muted">No permissions</span>}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</td>
                  <td className="actions">
                    <Link to={`/users/${user.id}`} className="btn-action">View</Link>
                    <Link to={`/users/${user.id}/edit`} className="btn-action">Edit</Link>
                    <button onClick={() => handleDelete(user.id)} className="btn-action btn-danger">
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

export default UserList;
