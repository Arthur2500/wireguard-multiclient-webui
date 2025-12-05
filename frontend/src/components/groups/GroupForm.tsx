import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import groupService from '../../services/group.service';
import './GroupForm.css';

interface GroupFormData {
  name: string;
  description: string;
  ip_range: string;
  listen_port: number;
  dns: string;
  endpoint: string;
  persistent_keepalive: number;
  mtu: number;
  allow_client_to_client: boolean;
}

const GroupForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState<GroupFormData>({
    name: '',
    description: '',
    ip_range: '10.0.0.0/24',
    listen_port: 51820,
    dns: '1.1.1.1, 8.8.8.8',
    endpoint: '',
    persistent_keepalive: 25,
    mtu: 1420,
    allow_client_to_client: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadGroup = useCallback(async () => {
    try {
      const group = await groupService.getById(Number(id));
      setFormData({
        name: group.name,
        description: group.description || '',
        ip_range: group.ip_range,
        listen_port: group.listen_port,
        dns: group.dns,
        endpoint: group.endpoint || '',
        persistent_keepalive: group.persistent_keepalive,
        mtu: group.mtu,
        allow_client_to_client: group.allow_client_to_client,
      });
    } catch (err) {
      setError('Failed to load group');
    }
  }, [id]);

  useEffect(() => {
    if (isEdit && id) {
      loadGroup();
    }
  }, [id, isEdit, loadGroup]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
              type === 'number' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isEdit && id) {
        await groupService.update(Number(id), formData);
      } else {
        await groupService.create(formData);
      }
      navigate('/groups');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="group-form-container">
      <div className="page-header">
        <Link to="/groups" className="back-link">← Back to Groups</Link>
        <h1>{isEdit ? 'Edit Group' : 'Create New Group'}</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="group-form">
        <div className="form-section">
          <h2>Basic Information</h2>
          
          <div className="form-group">
            <label htmlFor="name">Group Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., Office VPN"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Optional description for this group"
            />
          </div>
        </div>

        <div className="form-section">
          <h2>Network Configuration</h2>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ip_range">IP Range (CIDR) *</label>
              <input
                type="text"
                id="ip_range"
                name="ip_range"
                value={formData.ip_range}
                onChange={handleChange}
                required
                placeholder="e.g., 10.0.0.0/24"
                disabled={isEdit}
              />
              {isEdit && <small className="help-text">IP range cannot be changed after creation</small>}
            </div>

            <div className="form-group">
              <label htmlFor="listen_port">Listen Port</label>
              <input
                type="number"
                id="listen_port"
                name="listen_port"
                value={formData.listen_port}
                onChange={handleChange}
                min={1}
                max={65535}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="endpoint">Server Endpoint</label>
            <input
              type="text"
              id="endpoint"
              name="endpoint"
              value={formData.endpoint}
              onChange={handleChange}
              placeholder="e.g., vpn.example.com or 203.0.113.1"
            />
            <small className="help-text">Public IP or domain clients will connect to</small>
          </div>

          <div className="form-group">
            <label htmlFor="dns">DNS Servers</label>
            <input
              type="text"
              id="dns"
              name="dns"
              value={formData.dns}
              onChange={handleChange}
              placeholder="e.g., 1.1.1.1, 8.8.8.8"
            />
          </div>
        </div>

        <div className="form-section">
          <h2>Advanced Options</h2>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="persistent_keepalive">Persistent Keepalive (seconds)</label>
              <input
                type="number"
                id="persistent_keepalive"
                name="persistent_keepalive"
                value={formData.persistent_keepalive}
                onChange={handleChange}
                min={0}
                max={65535}
              />
            </div>

            <div className="form-group">
              <label htmlFor="mtu">MTU</label>
              <input
                type="number"
                id="mtu"
                name="mtu"
                value={formData.mtu}
                onChange={handleChange}
                min={1280}
                max={1500}
              />
            </div>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="allow_client_to_client"
                checked={formData.allow_client_to_client}
                onChange={handleChange}
              />
              <span>Allow client-to-client communication</span>
            </label>
            <small className="help-text">Enable clients to communicate with each other through the VPN</small>
          </div>
        </div>

        <div className="form-actions">
          <Link to="/groups" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : (isEdit ? 'Update Group' : 'Create Group')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default GroupForm;
