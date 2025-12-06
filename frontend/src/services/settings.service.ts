import api from './api';

export interface DefaultSettings {
  wg_default_dns: string;
  wg_default_endpoint: string;
  wg_default_port: string;
  wg_default_mtu: string;
  wg_default_keepalive: string;
  wg_config_path: string;
  allow_user_registration: string;
  max_clients_per_group: string;
}

export const settingsService = {
  getDefaults: async (): Promise<DefaultSettings> => {
    const response = await api.get<DefaultSettings>('/settings/defaults');
    return response.data;
  },

  getAll: async (): Promise<any> => {
    const response = await api.get('/settings');
    return response.data;
  },

  get: async (key: string): Promise<any> => {
    const response = await api.get(`/settings/${key}`);
    return response.data;
  },

  update: async (key: string, value: string): Promise<any> => {
    const response = await api.put(`/settings/${key}`, { value });
    return response.data;
  },
};

export default settingsService;
