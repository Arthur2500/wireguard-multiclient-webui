import api from './api';
import { 
  StatsOverview, 
  GroupStats, 
  UserStats, 
  SystemStats, 
  DetailedClientStats,
  TimeRange,
  TotalTrafficHistory,
  GroupsTrafficHistory,
  ClientsTrafficHistory,
  GroupDetailedTrafficHistory
} from '../types';

export const statsService = {
  getOverview: async (): Promise<StatsOverview> => {
    const response = await api.get<StatsOverview>('/stats/overview');
    return response.data;
  },

  getGroupStats: async (groupId: number): Promise<GroupStats> => {
    const response = await api.get<GroupStats>(`/stats/group/${groupId}`);
    return response.data;
  },

  getClientStats: async (clientId: number): Promise<DetailedClientStats> => {
    const response = await api.get<DetailedClientStats>(`/stats/client/${clientId}`);
    return response.data;
  },

  getUserStats: async (userId: number): Promise<UserStats> => {
    const response = await api.get<UserStats>(`/stats/user/${userId}`);
    return response.data;
  },

  getSystemStats: async (): Promise<SystemStats> => {
    const response = await api.get<SystemStats>('/stats/system');
    return response.data;
  },

  // Traffic history endpoints
  getTotalTraffic: async (range: TimeRange = '1h'): Promise<TotalTrafficHistory> => {
    const response = await api.get<TotalTrafficHistory>(`/stats/traffic/total?range=${range}`);
    return response.data;
  },

  getGroupsTraffic: async (range: TimeRange = '1h'): Promise<GroupsTrafficHistory> => {
    const response = await api.get<GroupsTrafficHistory>(`/stats/traffic/groups?range=${range}`);
    return response.data;
  },

  getClientsTraffic: async (range: TimeRange = '1h'): Promise<ClientsTrafficHistory> => {
    const response = await api.get<ClientsTrafficHistory>(`/stats/traffic/clients?range=${range}`);
    return response.data;
  },

  getGroupTrafficHistory: async (groupId: number, range: TimeRange = '1h'): Promise<GroupDetailedTrafficHistory> => {
    const response = await api.get<GroupDetailedTrafficHistory>(`/stats/traffic/group/${groupId}?range=${range}`);
    return response.data;
  },

  collectTraffic: async (): Promise<void> => {
    await api.post('/stats/traffic/collect');
  },
};

export default statsService;
