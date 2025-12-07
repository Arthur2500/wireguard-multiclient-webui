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
  allowed_ips_mode: 'all' | 'subnet' | 'custom';
  dns_override: string;
  is_active: boolean;
  expires_at: string;
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
    allowed_ips_mode: 'all',
    dns_override: '',
    is_active: true,
    expires_at: '',
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

  const isSubnetMode = (allowedIps: string, groupData: Group | null): boolean => {
    if (!groupData) return false;

    return allowedIps === groupData.ip_range ||
           allowedIps === `${groupData.ip_range}, ${groupData.ip_range_v6}` ||
           allowedIps === groupData.ip_range_v6;
  };

  const loadClient = useCallback(async () => {
    try {
      const client = await clientService.getById(Number(id));
      // Determine the mode based on the allowed_ips value
      let mode: 'all' | 'subnet' | 'custom' = 'custom';
      if (client.allowed_ips === '0.0.0.0/0, ::/0') {
        mode = 'all';
      } else if (isSubnetMode(client.allowed_ips, group)) {
        mode = 'subnet';
      }

      setFormData({
        name: client.name,
        description: client.description || '',
        allowed_ips: client.allowed_ips,
        allowed_ips_mode: mode,
        dns_override: client.dns_override || '',
        is_active: client.is_active,
        expires_at: client.expires_at ? client.expires_at.split('T')[0] : '',
      });
    } catch (err) {
      setError('Failed to load client');
    }
  }, [id, group]);

  useEffect(() => {
    if (groupId) {
      loadGroup();
    }
    if (isEdit && id) {
      loadClient();
    }
  }, [groupId, id, isEdit, loadGroup, loadClient]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleAllowedIpsModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mode = e.target.value as 'all' | 'subnet' | 'custom';
    let newAllowedIps = formData.allowed_ips;

    if (mode === 'all') {
      newAllowedIps = '0.0.0.0/0, ::/0';
    } else if (mode === 'subnet' && group) {
      // Use the group's IP range
      if (group.ip_range_v6) {
        newAllowedIps = `${group.ip_range}, ${group.ip_range_v6}`;
      } else {
        newAllowedIps = group.ip_range;
      }
    }
    // For 'custom', keep the current value

    setFormData(prev => ({
      ...prev,
      allowed_ips_mode: mode,
      allowed_ips: newAllowedIps,
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
          dns_override: formData.dns_override || undefined,
          is_active: formData.is_active,
          expires_at: formData.expires_at ? formData.expires_at : null,
        });
      } else if (groupId) {
        await clientService.create(Number(groupId), {
          name: formData.name,
          description: formData.description,
          allowed_ips: formData.allowed_ips,
          dns_override: formData.dns_override || undefined,
          expires_at: formData.expires_at || undefined,
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
            <label htmlFor="allowed_ips_mode">Traffic Routing</label>
            <select
              id="allowed_ips_mode"
              name="allowed_ips_mode"
              value={formData.allowed_ips_mode}
              onChange={handleAllowedIpsModeChange}
            >
              <option value="all">Route all traffic through VPN</option>
              <option value="subnet">Route only VPN subnet traffic</option>
              <option value="custom">Custom allowed IPs</option>
            </select>
            <small className="help-text">
              Choose how traffic should be routed for this client
            </small>
          </div>

          {formData.allowed_ips_mode === 'custom' && (
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
          )}

          {formData.allowed_ips_mode !== 'custom' && (
            <div className="form-group">
              <label>Allowed IPs (auto-configured)</label>
              <input
                type="text"
                value={formData.allowed_ips}
                disabled
                style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }}
              />
              <small className="help-text">
                {formData.allowed_ips_mode === 'all'
                  ? 'All traffic will be routed through the VPN'
                  : 'Only traffic to the VPN subnet will be routed through the VPN'}
              </small>
            </div>
          )}

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

          <div className="form-group">
            <label htmlFor="expires_at">Expiration Date (Optional)</label>
            <input
              type="date"
              id="expires_at"
              name="expires_at"
              value={formData.expires_at}
              onChange={handleChange}
              min={new Date().toISOString().split('T')[0]}
            />
            <small className="help-text">
              Client will be automatically deactivated after this date. Leave empty for no expiration.
            </small>
          </div>
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
