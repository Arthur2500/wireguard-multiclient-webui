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
    if (!id) return;
    
    try {
      const user = await userService.getById(Number(id));
      setFormData({
        username: user.username,
        email: user.email,
        password: '', // Don't pre-fill password for security
        role: user.role,
        can_create_groups: user.can_create_groups,
        can_create_clients: user.can_create_clients,
      });
    } catch (err) {
      setError('Failed to load user');
    }
  }, [id]);

  useEffect(() => {
    if (isEdit) {
      loadUser();
    }
  }, [isEdit, loadUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isEdit) {
        // For edit, only send fields that should be updated
        const updateData: any = {
          email: formData.email,
          role: formData.role,
          can_create_groups: formData.can_create_groups,
          can_create_clients: formData.can_create_clients,
        };
        
        // Only include password if it's been changed
        if (formData.password) {
          updateData.password = formData.password;
        }
        
        await userService.update(Number(id), updateData);
      } else {
        // For create, all fields are required
        await userService.create(formData);
      }
      navigate('/users');
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${isEdit ? 'update' : 'create'} user`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-form-container">
      <div className="page-header">
        <div>
          <Link to="/users" className="back-link">← Back to Users</Link>
          <h1>{isEdit ? 'Edit User' : 'Create New User'}</h1>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="user-form">
        <div className="form-content">
          <div className="form-section">
            <h2>Account Information</h2>
            
            <div className="form-group">
              <label htmlFor="username">
                Username <span className="required">*</span>
              </label>
              <input
                type="text"
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                disabled={isEdit}
                placeholder="Enter username"
              />
              {isEdit && (
                <small className="form-help">Username cannot be changed</small>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="email">
                Email <span className="required">*</span>
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="user@example.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">
                Password {!isEdit && <span className="required">*</span>}
              </label>
              <input
                type="password"
                id="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!isEdit}
                minLength={8}
                placeholder={isEdit ? 'Leave empty to keep current password' : 'Minimum 8 characters'}
              />
              {isEdit && (
                <small className="form-help">Leave empty to keep current password</small>
              )}
            </div>
          </div>

          <div className="form-section">
            <h2>Role & Permissions</h2>
            
            <div className="form-group">
              <label htmlFor="role">
                Role <span className="required">*</span>
              </label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <small className="form-help">
                Admins have full access to all features and can manage users
              </small>
            </div>

            <div className="form-group">
              <label>Permissions</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.can_create_groups}
                    onChange={(e) => setFormData({ ...formData, can_create_groups: e.target.checked })}
                  />
                  <span>Can create groups</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.can_create_clients}
                    onChange={(e) => setFormData({ ...formData, can_create_clients: e.target.checked })}
                  />
                  <span>Can create clients</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={() => navigate('/users')}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : (isEdit ? 'Update User' : 'Create User')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserForm;
