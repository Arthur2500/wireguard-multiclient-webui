import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import userService from '../../services/user.service';
import './UserForm.css';

interface UserFormData {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  can_create_groups: boolean;
  can_create_clients: boolean;
}

const UserForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    email: '',
    password: '',
    role: 'user',
    can_create_groups: true,
    can_create_clients: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadUser = useCallback(async () => {
    try {
      const user = await userService.getById(Number(id));
      setFormData({
        username: user.username,
        email: user.email,
        password: '',
        role: user.role,
        can_create_groups: user.can_create_groups,
        can_create_clients: user.can_create_clients,
      });
    } catch (err) {
      setError('Failed to load user');
    }
  }, [id]);

  useEffect(() => {
    if (isEdit && id) {
      loadUser();
    }
  }, [id, isEdit, loadUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isEdit && id) {
        const updateData: any = {
          email: formData.email,
          role: formData.role,
          can_create_groups: formData.can_create_groups,
          can_create_clients: formData.can_create_clients,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await userService.update(Number(id), updateData);
      } else {
        await userService.create(formData);
      }
      navigate('/users');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-form-container">
      <div className="page-header">
        <Link to="/users" className="back-link">← Back to Users</Link>
        <h1>{isEdit ? 'Edit User' : 'Create New User'}</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="user-form">
        <div className="form-section">
          <h2>Basic Information</h2>

          <div className="form-group">
            <label htmlFor="username">Username *</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              disabled={isEdit}
              placeholder="e.g., john.doe"
            />
            {isEdit && <small className="help-text">Username cannot be changed after creation</small>}
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="e.g., john.doe@example.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password {isEdit && '(leave empty to keep current)'}
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required={!isEdit}
              minLength={8}
              placeholder={isEdit ? 'Enter new password to change' : 'Minimum 8 characters'}
            />
            <small className="help-text">Minimum 8 characters required</small>
          </div>
        </div>

        <div className="form-section">
          <h2>Role & Permissions</h2>

          <div className="form-group">
            <label htmlFor="role">Role</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <small className="help-text">Admins have full system access</small>
          </div>

          <div className="form-group">
            <label>Permissions</label>
            <div className="checkbox-group">
              <label className="checkbox-label" htmlFor="can_create_groups">
                <input
                  type="checkbox"
                  id="can_create_groups"
                  name="can_create_groups"
                  checked={formData.can_create_groups}
                  onChange={handleChange}
                />
                <span>Can create groups</span>
              </label>
              <label className="checkbox-label" htmlFor="can_create_clients">
                <input
                  type="checkbox"
                  id="can_create_clients"
                  name="can_create_clients"
                  checked={formData.can_create_clients}
                  onChange={handleChange}
                />
                <span>Can create clients</span>
              </label>
            </div>
            <small className="help-text">Control what this user can create</small>
          </div>
        </div>

        <div className="form-actions">
          <Link to="/users" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : (isEdit ? 'Update User' : 'Create User')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserForm;
