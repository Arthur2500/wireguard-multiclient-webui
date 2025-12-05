import api from './api';
import { StatsOverview, GroupStats, ClientStats } from '../types';

interface SystemStats {
  total_users: number;
  total_groups: number;
  total_clients: number;
  active_clients: number;
  total_received_bytes: number;
  total_sent_bytes: number;
  groups: Array<{
    id: number;
    name: string;
    owner: string;
    client_count: number;
    active_clients: number;
    received_bytes: number;
    sent_bytes: number;
  }>;
  recent_connections_24h: number;
}

export const statsService = {
  getOverview: async (): Promise<StatsOverview> => {
    const response = await api.get<StatsOverview>('/stats/overview');
    return response.data;
  },

  getGroupStats: async (groupId: number): Promise<GroupStats> => {
    const response = await api.get<GroupStats>(`/stats/group/${groupId}`);
    return response.data;
  },

  getClientStats: async (clientId: number): Promise<ClientStats> => {
    const response = await api.get<ClientStats>(`/stats/client/${clientId}`);
    return response.data;
  },

  getSystemStats: async (): Promise<SystemStats> => {
    const response = await api.get<SystemStats>('/stats/system');
    return response.data;
  },
};

export default statsService;
