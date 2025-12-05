import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import clientService from '../../services/client.service';
import groupService from '../../services/group.service';
import { Group } from '../../types';
import './ClientForm.css';

interface ClientFormData {
  name: string;
  description: string;
  allowed_ips: string;
  can_address_peers: boolean;
  dns_override: string;
  use_preshared_key: boolean;
  is_active: boolean;
}

const ClientForm: React.FC = () => {
  const { groupId, id } = useParams<{ groupId: string; id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [group, setGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState<ClientFormData>({
    name: '',
    description: '',
    allowed_ips: '0.0.0.0/0, ::/0',
    can_address_peers: true,
    dns_override: '',
    use_preshared_key: false,
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadGroup = useCallback(async () => {
    try {
      const groupData = await groupService.getById(Number(groupId));
      setGroup(groupData);
    } catch (err) {
      setError('Failed to load group');
    }
  }, [groupId]);

  const loadClient = useCallback(async () => {
    try {
      const client = await clientService.getById(Number(id));
      setFormData({
        name: client.name,
        description: client.description || '',
        allowed_ips: client.allowed_ips,
        can_address_peers: client.can_address_peers,
        dns_override: client.dns_override || '',
        use_preshared_key: false,
        is_active: client.is_active,
      });
    } catch (err) {
      setError('Failed to load client');
    }
  }, [id]);

  useEffect(() => {
    if (groupId) {
      loadGroup();
    }
    if (isEdit && id) {
      loadClient();
    }
  }, [groupId, id, isEdit, loadGroup, loadClient]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
        await clientService.update(Number(id), {
          name: formData.name,
          description: formData.description,
          allowed_ips: formData.allowed_ips,
          can_address_peers: formData.can_address_peers,
          dns_override: formData.dns_override || undefined,
          is_active: formData.is_active,
        });
      } else if (groupId) {
        await clientService.create(Number(groupId), {
          name: formData.name,
          description: formData.description,
          allowed_ips: formData.allowed_ips,
          can_address_peers: formData.can_address_peers,
          dns_override: formData.dns_override || undefined,
          use_preshared_key: formData.use_preshared_key,
        });
      }
      navigate(groupId ? `/groups/${groupId}` : '/groups');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save client');
    } finally {
      setLoading(false);
    }
  };

  const backUrl = groupId ? `/groups/${groupId}` : '/groups';

  return (
    <div className="client-form-container">
      <div className="page-header">
        <Link to={backUrl} className="back-link">← Back to Group</Link>
        <h1>{isEdit ? 'Edit Client' : 'Add New Client'}</h1>
        {group && <p className="subtitle">Group: {group.name}</p>}
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="client-form">
        <div className="form-section">
          <h2>Client Information</h2>
          
          <div className="form-group">
            <label htmlFor="name">Client Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., John's Laptop"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              placeholder="Optional description"
            />
          </div>
        </div>

        <div className="form-section">
          <h2>Network Settings</h2>
          
          <div className="form-group">
            <label htmlFor="allowed_ips">Allowed IPs</label>
            <input
              type="text"
              id="allowed_ips"
              name="allowed_ips"
              value={formData.allowed_ips}
              onChange={handleChange}
              placeholder="e.g., 0.0.0.0/0, ::/0"
            />
            <small className="help-text">
              IPs this client can route traffic to. Use 0.0.0.0/0 for all traffic.
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="dns_override">DNS Override</label>
            <input
              type="text"
              id="dns_override"
              name="dns_override"
              value={formData.dns_override}
              onChange={handleChange}
              placeholder="Leave empty to use group DNS"
            />
            <small className="help-text">Override the group's DNS settings for this client</small>
          </div>
        </div>

        <div className="form-section">
          <h2>Options</h2>
          
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="can_address_peers"
                checked={formData.can_address_peers}
                onChange={handleChange}
              />
              <span>Can address other peers</span>
            </label>
            <small className="help-text">
              Allow this client to communicate with other clients in the group
            </small>
          </div>

          {!isEdit && (
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="use_preshared_key"
                  checked={formData.use_preshared_key}
                  onChange={handleChange}
                />
                <span>Use preshared key</span>
              </label>
              <small className="help-text">
                Add an extra layer of symmetric-key crypto for post-quantum security
              </small>
            </div>
          )}

          {isEdit && (
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                <span>Client is active</span>
              </label>
              <small className="help-text">
                Disabled clients won't be included in the server configuration
              </small>
            </div>
          )}
        </div>

        <div className="form-actions">
          <Link to={backUrl} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : (isEdit ? 'Update Client' : 'Create Client')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ClientForm;
