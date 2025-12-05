import api from './api';
import { Group } from '../types';

interface CreateGroupData {
  name: string;
  description?: string;
  ip_range: string;
  listen_port?: number;
  dns?: string;
  endpoint?: string;
  persistent_keepalive?: number;
  mtu?: number;
  allow_client_to_client?: boolean;
}

interface UpdateGroupData {
  name?: string;
  description?: string;
  dns?: string;
  endpoint?: string;
  persistent_keepalive?: number;
  mtu?: number;
  allow_client_to_client?: boolean;
  listen_port?: number;
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
};

export default groupService;
