import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import clientService from '../../services/client.service';
import statsService from '../../services/stats.service';
import { Client, TimeRange, TrafficDataPoint } from '../../types';
import { formatBytes, downloadFile, formatDate } from '../../utils/helpers';
import { Download, Lock, Unlock, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { NetworkGraph } from '../stats/NetworkGraph';
import TimeRangeSelector from '../stats/TimeRangeSelector';
import './ClientDetail.css';

const ClientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Traffic graph state
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [trafficData, setTrafficData] = useState<TrafficDataPoint[]>([]);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

  const loadClient = useCallback(async () => {
    try {
      const clientData = await clientService.getById(Number(id));
      setClient(clientData);
    } catch (err) {
      setError('Failed to load client');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadTrafficData = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setTrafficLoading(true);
    } else {
      setIsAutoRefreshing(true);
    }
    try {
      const data = await statsService.getClientTrafficHistory(Number(id), timeRange);
      setTrafficData(data.data || []);
    } catch (err) {
      console.error('Failed to load traffic data:', err);
      // Only set error for initial load, not for background refreshes
      if (!isBackground) {
        setError('Failed to load traffic data');
      }
    } finally {
      if (!isBackground) {
        setTrafficLoading(false);
      } else {
        setIsAutoRefreshing(false);
      }
    }
  }, [id, timeRange]);

  useEffect(() => {
    if (id) {
      loadClient();
    }
  }, [id, loadClient]);

  useEffect(() => {
    loadTrafficData();
  }, [loadTrafficData]);

  // Auto-refresh every 5 seconds, preventing overlapping requests
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRefreshing) {
        setIsRefreshing(true);
        Promise.all([
          loadTrafficData(true),
          loadClient()
        ]).finally(() => setIsRefreshing(false));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [loadTrafficData, loadClient, isRefreshing]);

  const handleToggleActive = async () => {
    if (!client) return;
    
    try {
      const updated = await clientService.update(client.id, { is_active: !client.is_active });
      setClient(updated);
    } catch (err) {
      setError('Failed to update client');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this client?')) return;
    
    try {
      await clientService.delete(Number(id));
      navigate('/clients');
    } catch (err) {
      setError('Failed to delete client');
    }
  };

  const handleDownloadConfig = async () => {
    if (!client) return;
    
    try {
      const config = await clientService.getConfig(client.id);
      downloadFile(config.config, config.filename);
    } catch (err) {
      setError('Failed to download config');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!client) return <div className="error">Client not found</div>;

  return (
    <div className="client-detail">
      <div className="page-header">
        <div className="header-title">
          <Link to="/clients" className="back-link">
            <ArrowLeft size={18} /> Back to Clients
          </Link>
          <h1>{client.name}</h1>
          {client.description && <p className="description">{client.description}</p>}
        </div>
        <div className="header-actions">
          <button onClick={handleDownloadConfig} className="btn-secondary">
            <Download size={16} /> Download Config
          </button>
          <button onClick={handleToggleActive} className={client.is_active ? 'btn-warning' : 'btn-success'}>
            {client.is_active ? <><Lock size={16} /> Disable</> : <><Unlock size={16} /> Enable</>}
          </button>
          <Link to={`/clients/${id}/edit`} className="btn-primary">
            <Pencil size={16} /> Edit
          </Link>
          <button onClick={handleDelete} className="btn-danger">
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="client-info-cards">
        <div className="info-card">
          <h3>Network</h3>
          <dl>
            <dt>IPv4 Address</dt>
            <dd className="mono">{client.assigned_ip}</dd>
            {client.assigned_ip_v6 && (
              <>
                <dt>IPv6 Address</dt>
                <dd className="mono">{client.assigned_ip_v6}</dd>
              </>
            )}
            <dt>Allowed IPs</dt>
            <dd className="mono">{client.allowed_ips}</dd>
            {client.dns_override && (
              <>
                <dt>DNS Override</dt>
                <dd className="mono">{client.dns_override}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="info-card">
          <h3>Status</h3>
          <dl>
            <dt>State</dt>
            <dd>
              <span className={`badge ${client.is_active ? 'badge-success' : 'badge-danger'}`}>
                {client.is_active ? 'Active' : 'Disabled'}
              </span>
            </dd>
            <dt>Last Handshake</dt>
            <dd>{formatDate(client.last_handshake)}</dd>
            {client.expires_at && (
              <>
                <dt>Expires At</dt>
                <dd>{formatDate(client.expires_at)}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="info-card">
          <h3>Traffic Statistics</h3>
          <dl>
            <dt>Data Received</dt>
            <dd>{formatBytes(client.total_received)}</dd>
            <dt>Data Sent</dt>
            <dd>{formatBytes(client.total_sent)}</dd>
            <dt>Total Traffic</dt>
            <dd className="total">{formatBytes(client.total_received + client.total_sent)}</dd>
          </dl>
        </div>
      </div>

      {/* Traffic Graph Section */}
      <div className="traffic-section">
        <div className="traffic-section-header">
          <h3>Network Traffic</h3>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>

        {trafficLoading && <div className="traffic-loading">Loading traffic data...</div>}

        {!trafficLoading && (
          <div
            className="traffic-graph-section"
            style={{
              opacity: isAutoRefreshing ? 0.7 : 1,
              transition: 'opacity 0.3s ease-in-out'
            }}
          >
            <NetworkGraph
              title={`${client.name} - Network Traffic`}
              data={trafficData}
              height={300}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDetail;
