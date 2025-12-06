import api from './api';
import { User } from '../types';

interface CreateUserData {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  can_create_groups?: boolean;
  can_create_clients?: boolean;
}

interface UpdateUserData {
  email?: string;
  role?: 'admin' | 'user';
  is_active?: boolean;
  password?: string;
  can_create_groups?: boolean;
  can_create_clients?: boolean;
}

export const userService = {
  getAll: async (): Promise<User[]> => {
    const response = await api.get<User[]>('/users');
    return response.data;
  },

  getById: async (id: number): Promise<User> => {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  },

  create: async (data: CreateUserData): Promise<User> => {
    const response = await api.post<User>('/users', data);
    return response.data;
  },

  update: async (id: number, data: UpdateUserData): Promise<User> => {
    const response = await api.put<User>(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};

export default userService;
