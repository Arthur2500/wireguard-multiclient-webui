import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import userService from '../../services/user.service';
import { User } from '../../types';
import './UserList.css';

const UserList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user',
    can_create_groups: true,
    can_create_clients: true,
  });

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

  const handleToggleActive = async (user: User) => {
    try {
      const updated = await userService.update(user.id, { is_active: !user.is_active });
      setUsers(users.map(u => u.id === user.id ? updated : u));
    } catch (err) {
      setError('Failed to update user');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      if (editUser) {
        const updateData: any = { 
          email: formData.email, 
          role: formData.role,
          can_create_groups: formData.can_create_groups,
          can_create_clients: formData.can_create_clients,
        };
        if (formData.password) updateData.password = formData.password;
        const updated = await userService.update(editUser.id, updateData);
        setUsers(users.map(u => u.id === editUser.id ? updated : u));
      } else {
        const newUser = await userService.create(formData);
        setUsers([...users, newUser]);
      }
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save user');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditUser(null);
    setFormData({ username: '', email: '', password: '', role: 'user', can_create_groups: true, can_create_clients: true });
  };

  const openEditForm = (user: User) => {
    setEditUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      can_create_groups: user.can_create_groups,
      can_create_clients: user.can_create_clients,
    });
    setShowForm(true);
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="user-list-container">
      <div className="page-header">
        <h1>User Management</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">+ Add User</button>
      </div>

      {error && <div className="error-message">{error}</div>}

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
                <td className="user-name">
                  <Link to={`/users/${user.id}`} className="user-link">
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
                  <button onClick={() => openEditForm(user)} className="btn-action">Edit</button>
                  <button onClick={() => handleToggleActive(user)} className="btn-action">
                    {user.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => handleDelete(user.id)} className="btn-action btn-danger">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editUser ? 'Edit User' : 'Add New User'}</h2>
              <button onClick={resetForm} className="modal-close">×</button>
            </div>
            <form onSubmit={handleSubmit} className="user-form">
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  required
                  disabled={!!editUser}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="password">
                  Password {editUser && '(leave empty to keep current)'}
                </label>
                <input
                  type="password"
                  id="password"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  required={!editUser}
                  minLength={8}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="role">Role</label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as 'admin' | 'user'})}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="form-group">
                <label>Permissions</label>
                <div className="checkbox-group">
                  <label className="checkbox-label" htmlFor="can_create_groups">
                    <input
                      type="checkbox"
                      id="can_create_groups"
                      checked={formData.can_create_groups}
                      onChange={e => setFormData({...formData, can_create_groups: e.target.checked})}
                    />
                    <span>Can create groups</span>
                  </label>
                  <label className="checkbox-label" htmlFor="can_create_clients">
                    <input
                      type="checkbox"
                      id="can_create_clients"
                      checked={formData.can_create_clients}
                      onChange={e => setFormData({...formData, can_create_clients: e.target.checked})}
                    />
                    <span>Can create clients</span>
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">
                  {editUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserList;
