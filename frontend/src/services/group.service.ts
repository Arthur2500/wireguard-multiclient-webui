import api from './api';
import { Group } from '../types';

interface CreateGroupData {
  name: string;
  description?: string;
  ip_range: string;
  ip_range_v6?: string;
  listen_port?: number;
  dns?: string;
  endpoint?: string;
  persistent_keepalive?: number;
  mtu?: number;
}

interface UpdateGroupData {
  name?: string;
  description?: string;
  ip_range_v6?: string;
  dns?: string;
  endpoint?: string;
  persistent_keepalive?: number;
  mtu?: number;
  listen_port?: number;
  is_active?: boolean;
}

interface GroupConfig {
  config: string;
  filename: string;
}

export const groupService = {
  getAll: async (): Promise<Group[]> => {
    const response = await api.get<Group[]>('/groups');
    return response.data;
  },

  getById: async (id: number): Promise<Group> => {
    const response = await api.get<Group>(`/groups/${id}`);
    return response.data;
  },

  create: async (data: CreateGroupData): Promise<Group> => {
    const response = await api.post<Group>('/groups', data);
    return response.data;
  },

  update: async (id: number, data: UpdateGroupData): Promise<Group> => {
    const response = await api.put<Group>(`/groups/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/groups/${id}`);
  },

  getConfig: async (id: number): Promise<GroupConfig> => {
    const response = await api.get<GroupConfig>(`/groups/${id}/config`);
    return response.data;
  },

  getMembers: async (id: number): Promise<any[]> => {
    const response = await api.get(`/groups/${id}/members`);
    return response.data;
  },

  addMember: async (groupId: number, userId: number): Promise<void> => {
    await api.post(`/groups/${groupId}/members`, { user_id: userId });
  },

  removeMember: async (groupId: number, userId: number): Promise<void> => {
    await api.delete(`/groups/${groupId}/members/${userId}`);
  },

  toggleWireGuard: async (id: number): Promise<{ message: string; is_running: boolean }> => {
    const response = await api.post<{ message: string; is_running: boolean }>(`/groups/${id}/wireguard/toggle`);
    return response.data;
  },

  updateStats: async (id: number): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>(`/groups/${id}/wireguard/stats`);
    return response.data;
  },

  downloadConfigZip: async (id: number): Promise<void> => {
    const response = await api.get(`/groups/${id}/config/download-zip`, {
      responseType: 'blob'
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `group-${id}-configs.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default groupService;
