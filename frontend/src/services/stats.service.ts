import api from './api';
import { StatsOverview, GroupStats, UserStats, SystemStats } from '../types';

export const statsService = {
  getOverview: async (): Promise<StatsOverview> => {
    const response = await api.get<StatsOverview>('/stats/overview');
    return response.data;
  },

  getGroupStats: async (groupId: number): Promise<GroupStats> => {
    const response = await api.get<GroupStats>(`/stats/group/${groupId}`);
    return response.data;
  },

  getClientStats: async (clientId: number): Promise<any> => {
    const response = await api.get<any>(`/stats/client/${clientId}`);
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
};

export default statsService;
