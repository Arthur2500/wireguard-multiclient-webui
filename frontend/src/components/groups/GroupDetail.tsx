import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import groupService from '../../services/group.service';
import clientService from '../../services/client.service';
import { Group, Client } from '../../types';
import { formatBytes, downloadFile, formatDate } from '../../utils/helpers';
import { Download, Lock, Unlock, Pencil, Trash2, PlayCircle, StopCircle, RefreshCw } from 'lucide-react';
import GroupMembers from './GroupMembers';
import GroupTrafficStats from '../stats/GroupTrafficStats';
import '../stats/GroupTrafficStats.css';
import './GroupDetail.css';

const GroupDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [serverConfig, setServerConfig] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [wireguardAction, setWireguardAction] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [groupData, clientsData] = await Promise.all([
        groupService.getById(Number(id)),
        clientService.getByGroup(Number(id)),
      ]);
      setGroup(groupData);
      setClients(clientsData);

      // Get current user from localStorage
      const userStr = localStorage.getItem('user');
      if (userStr) {
        setCurrentUser(JSON.parse(userStr));
      }
    } catch (err) {
      setError('Failed to load group data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, loadData]);

  const handleShowConfig = async () => {
    try {
      const config = await groupService.getConfig(Number(id));
      setServerConfig(config.config);
      setShowConfig(true);
    } catch (err) {
      setError('Failed to load server config');
    }
  };

  const handleDownloadConfig = async () => {
    try {
      const config = await groupService.getConfig(Number(id));
      downloadFile(config.config, config.filename);
    } catch (err) {
      setError('Failed to download config');
    }
  };

  const handleDeleteClient = async (clientId: number) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return;

    try {
      await clientService.delete(clientId);
      setClients(clients.filter(c => c.id !== clientId));
    } catch (err) {
      setError('Failed to delete client');
    }
  };

  const handleToggleClientActive = async (client: Client) => {
    try {
      const updated = await clientService.update(client.id, { is_active: !client.is_active });
      setClients(clients.map(c => c.id === client.id ? updated : c));
    } catch (err) {
      setError('Failed to update client');
    }
  };

  const handleDownloadClientConfig = async (clientId: number) => {
    try {
      const config = await clientService.getConfig(clientId);
      downloadFile(config.config, config.filename);
    } catch (err) {
      setError('Failed to download client config');
    }
  };

  const handleToggleWireGuard = async () => {
    const action = group?.is_running ? 'stop' : 'start';
    if (group?.is_running && !window.confirm('Are you sure you want to stop the WireGuard interface?')) return;
    
    setWireguardAction(true);
    try {
      const result = await groupService.toggleWireGuard(Number(id));
      setError('');
      // Update local group state with new is_running status
      if (group) {
        setGroup({ ...group, is_running: result.is_running });
      }
      // Reload group data to ensure consistency
      await loadData();
      alert(`WireGuard interface ${action}ed successfully`);
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action} WireGuard`);
    } finally {
      setWireguardAction(false);
    }
  };

  const handleDownloadAllConfigs = async () => {
    try {
      setWireguardAction(true);
      await groupService.downloadConfigZip(Number(id));
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to download config ZIP');
    } finally {
      setWireguardAction(false);
    }
  };

  const handleUpdateStats = async () => {
    try {
      await groupService.updateStats(Number(id));
      // Reload clients to get updated stats
      const clientsData = await clientService.getByGroup(Number(id));
      setClients(clientsData);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update statistics');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!group) return <div className="error">Group not found</div>;

  return (
    <div className="group-detail">
      <div className="page-header">
        <div>
          <Link to="/groups" className="back-link">← Back to Groups</Link>
          <h1>{group.name}</h1>
          {group.description && <p className="description">{group.description}</p>}
        </div>
        <div className="header-actions">
          <button onClick={handleShowConfig} className="btn-secondary">View Config</button>
          <button onClick={handleDownloadAllConfigs} className="btn-secondary" disabled={wireguardAction} title="Download all configs as ZIP">
            <Download size={16} /> Download Configs (ZIP)
          </button>
          <button 
            onClick={handleToggleWireGuard} 
            className={group.is_running ? 'btn-danger' : 'btn-success'}
            disabled={wireguardAction}
            title={group.is_running ? 'Disable WireGuard' : 'Enable WireGuard'}
          >
            {group.is_running ? <><StopCircle size={16} /> Disable</> : <><PlayCircle size={16} /> Enable</>}
          </button>
          <Link to={`/groups/${id}/edit`} className="btn-primary">Edit Group</Link>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="group-info-cards">
        <div className="info-card">
          <h3>Network</h3>
          <dl>
            <dt>IPv4 Range</dt>
            <dd className="mono">{group.ip_range}</dd>
            <dt>Server IPv4</dt>
            <dd className="mono">{group.server_ip}</dd>
            {group.ip_range_v6 && (
              <>
                <dt>IPv6 Range</dt>
                <dd className="mono">{group.ip_range_v6}</dd>
                <dt>Server IPv6</dt>
                <dd className="mono">{group.server_ip_v6}</dd>
              </>
            )}
            <dt>Port</dt>
            <dd>{group.listen_port}</dd>
          </dl>
        </div>

        <div className="info-card">
          <h3>Settings</h3>
          <dl>
            <dt>DNS</dt>
            <dd className="mono">{group.dns}</dd>
            <dt>Endpoint</dt>
            <dd className="mono">{group.endpoint || 'Not set'}</dd>
            <dt>MTU</dt>
            <dd>{group.mtu}</dd>
          </dl>
        </div>

        <div className="info-card">
          <h3>Options</h3>
          <dl>
            <dt>Owner</dt>
            <dd>{group.owner_username || 'Unknown'}</dd>
            <dt>Keepalive</dt>
            <dd>{group.persistent_keepalive}s</dd>
            <dt>Client-to-Client</dt>
            <dd>
              <span className={`badge ${group.allow_client_to_client ? 'badge-success' : 'badge-warning'}`}>
                {group.allow_client_to_client ? 'Enabled' : 'Disabled'}
              </span>
            </dd>
          </dl>
        </div>
      </div>

      <div className="clients-section">
        <div className="section-header">
          <h2>Clients ({clients.length})</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            {group.is_running && (
              <button onClick={handleUpdateStats} className="btn-secondary" title="Refresh statistics from WireGuard">
                <RefreshCw size={16} /> Update Stats
              </button>
            )}
            <Link to={`/groups/${id}/clients/new`} className="btn-primary">+ Add Client</Link>
          </div>
        </div>

        {clients.length === 0 ? (
          <div className="empty-state">
            <p>No clients yet. Add your first WireGuard client!</p>
          </div>
        ) : (
          <div className="clients-table-container">
            <table className="clients-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>IP Address</th>
                  <th>Status</th>
                  <th>Peer Access</th>
                  <th>Traffic</th>
                  <th>Last Handshake</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className={!client.is_active ? 'disabled' : ''}>
                    <td>
                      <span className="client-name">{client.name}</span>
                      {client.description && (
                        <span className="client-desc">{client.description}</span>
                      )}
                    </td>
                    <td className="mono">
                      {client.assigned_ip}
                      {client.assigned_ip_v6 && <><br />{client.assigned_ip_v6}</>}
                    </td>
                    <td>
                      <span className={`badge ${client.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {client.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${client.can_address_peers ? 'badge-success' : 'badge-warning'}`}>
                        {client.can_address_peers ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>
                      <span className="traffic">
                        ↓ {formatBytes(client.total_received)} / ↑ {formatBytes(client.total_sent)}
                      </span>
                    </td>
                    <td>{formatDate(client.last_handshake)}</td>
                    <td className="actions">
                      <button
                        onClick={() => handleDownloadClientConfig(client.id)}
                        className="btn-action"
                        title="Download Config"
                      >
                        <Download size={14} /> Config
                      </button>
                      <button
                        onClick={() => handleToggleClientActive(client)}
                        className="btn-action"
                        title={client.is_active ? 'Disable' : 'Enable'}
                      >
                        {client.is_active ? <><Lock size={14} /> Disable</> : <><Unlock size={14} /> Enable</>}
                      </button>
                      <Link to={`/clients/${client.id}/edit`} className="btn-action" title="Edit">
                        <Pencil size={14} /> Edit
                      </Link>
                      <button
                        onClick={() => handleDeleteClient(client.id)}
                        className="btn-action btn-danger"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Group Traffic Statistics Section */}
      {group && (
        <GroupTrafficStats groupId={Number(id)} />
      )}

      {/* Group Members Section */}
      {currentUser && group && (
        <GroupMembers
          groupId={Number(id)}
          isOwnerOrAdmin={currentUser.role === 'admin' || group.owner_id === currentUser.id}
          isAdmin={currentUser.role === 'admin'}
        />
      )}

      {showConfig && (
        <div className="modal-overlay" onClick={() => setShowConfig(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Server Configuration</h2>
              <button onClick={() => setShowConfig(false)} className="modal-close">×</button>
            </div>
            <pre className="config-content">{serverConfig}</pre>
            <div className="modal-footer">
              <button onClick={handleDownloadConfig} className="btn-primary">Download</button>
              <button onClick={() => setShowConfig(false)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDetail;
