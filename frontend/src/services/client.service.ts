import api from './api';
import { Client } from '../types';

interface CreateClientData {
  name: string;
  description?: string;
  allowed_ips?: string;
  can_address_peers?: boolean;
  dns_override?: string;
  use_preshared_key?: boolean;
  expires_at?: string;
}

interface UpdateClientData {
  name?: string;
  description?: string;
  allowed_ips?: string;
  can_address_peers?: boolean;
  dns_override?: string;
  is_active?: boolean;
  expires_at?: string | null;
}

interface ClientConfig {
  config: string;
  filename: string;
}

export const clientService = {
  getByGroup: async (groupId: number): Promise<Client[]> => {
    const response = await api.get<Client[]>(`/clients/group/${groupId}`);
    return response.data;
  },

  getById: async (id: number): Promise<Client> => {
    const response = await api.get<Client>(`/clients/${id}`);
    return response.data;
  },

  create: async (groupId: number, data: CreateClientData): Promise<Client> => {
    const response = await api.post<Client>(`/clients/group/${groupId}`, data);
    return response.data;
  },

  update: async (id: number, data: UpdateClientData): Promise<Client> => {
    const response = await api.put<Client>(`/clients/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/clients/${id}`);
  },

  getConfig: async (id: number): Promise<ClientConfig> => {
    const response = await api.get<ClientConfig>(`/clients/${id}/config`);
    return response.data;
  },

  regenerateKeys: async (id: number, regeneratePresharedKey?: boolean): Promise<Client> => {
    const response = await api.post<Client>(`/clients/${id}/regenerate-keys`, {
      regenerate_preshared_key: regeneratePresharedKey,
    });
    return response.data;
  },

  checkExpiration: async (): Promise<{ deactivated_count: number; deactivated_clients: any[] }> => {
    const response = await api.post<{ deactivated_count: number; deactivated_clients: any[] }>('/clients/check-expiration');
    return response.data;
  },
};

export default clientService;
