import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import clientService from '../../services/client.service';
import groupService from '../../services/group.service';
import { Client, Group } from '../../types';
import { formatBytes, downloadFile, formatDate } from '../../utils/helpers';
import { Download, Lock, Unlock, Pencil, Trash2, Search } from 'lucide-react';
import './ClientList.css';

const ClientList: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const groupsData = await groupService.getAll();
      setGroups(groupsData);

      // Load clients from all groups concurrently using Promise.all() to reduce total loading time compared to sequential requests
      const clientPromises = groupsData.map(group =>
        clientService.getByGroup(group.id)
      );
      const clientsArrays = await Promise.all(clientPromises);
      const allClients = clientsArrays.flat();
      setClients(allClients);
    } catch (err: any) {
      console.error('Failed to load clients:', err);
      setError('Failed to load clients');
    } finally {
      setLoading(false);
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

  const getClientGroup = (client: Client): Group | undefined => {
    return groups.find(g => g.id === client.group_id);
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.assigned_ip.includes(searchTerm);
    const matchesGroup = selectedGroup === 'all' || client.group_id.toString() === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="client-list-container">
      <div className="page-header">
        <h1>All Clients</h1>
        <div className="header-actions">
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            + New Client
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="filters-bar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="group-filter">Group:</label>
          <select
            id="group-filter"
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
          >
            <option value="all">All Groups</option>
            {groups.map(group => (
              <option key={group.id} value={group.id.toString()}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="clients-stats-summary">
        <div className="stat-item">
          <span className="label">Total Clients:</span>
          <span className="value">{filteredClients.length}</span>
        </div>
        <div className="stat-item">
          <span className="label">Active:</span>
          <span className="value">{filteredClients.filter(c => c.is_active).length}</span>
        </div>
        <div className="stat-item">
          <span className="label">Inactive:</span>
          <span className="value">{filteredClients.filter(c => !c.is_active).length}</span>
        </div>
      </div>

      {filteredClients.length === 0 ? (
        <div className="empty-state">
          <p>No clients found matching your criteria.</p>
        </div>
      ) : (
        <div className="clients-table-container">
          <table className="clients-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Group</th>
                <th>IP Address</th>
                <th>Status</th>
                <th>Traffic</th>
                <th>Last Handshake</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => {
                const group = getClientGroup(client);
                return (
                  <tr key={client.id} className={!client.is_active ? 'disabled' : ''}>
                    <td>
                      <Link to={`/clients/${client.id}`} className="client-name-link">
                        <span className="client-name">{client.name}</span>
                      </Link>
                      {client.description && (
                        <span className="client-desc">{client.description}</span>
                      )}
                    </td>
                    <td>
                      {group ? (
                        <Link to={`/groups/${group.id}`} className="group-link">
                          {group.name}
                        </Link>
                      ) : (
                        <span className="text-muted">Unknown</span>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Client Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Client</h2>
              <button onClick={() => setShowCreateModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <p>Select a group to create a new client:</p>
              {groups.length === 0 ? (
                <div className="empty-state">
                  <p>No groups available. Create a group first to add clients.</p>
                  <Link to="/groups/new" className="btn-primary" onClick={() => setShowCreateModal(false)}>
                    + Create New Group
                  </Link>
                </div>
              ) : (
                <div className="groups-selection">
                  {groups.map(group => (
                    <Link
                      key={group.id}
                      to={`/groups/${group.id}/clients/new`}
                      className="group-option"
                      onClick={() => setShowCreateModal(false)}
                    >
                      <h3>{group.name}</h3>
                      <p className="ip-range mono">{group.ip_range}</p>
                      <span className="client-count">{group.client_count} clients</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientList;
