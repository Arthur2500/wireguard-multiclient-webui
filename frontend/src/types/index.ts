export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  ip_range: string;
  server_ip: string;
  ip_range_v6: string | null;
  server_ip_v6: string | null;
  server_public_key: string;
  listen_port: number;
  dns: string;
  endpoint: string | null;
  persistent_keepalive: number;
  mtu: number;
  allow_client_to_client: boolean;
  owner_id: number;
  client_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface Client {
  id: number;
  name: string;
  description: string | null;
  public_key: string;
  assigned_ip: string;
  assigned_ip_v6: string | null;
  allowed_ips: string;
  can_address_peers: boolean;
  dns_override: string | null;
  is_active: boolean;
  group_id: number;
  created_at: string | null;
  updated_at: string | null;
  last_handshake: string | null;
  total_received: number;
  total_sent: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface StatsOverview {
  total_groups: number;
  total_clients: number;
  active_clients: number;
  total_users: number | null;
  total_received_bytes: number;
  total_sent_bytes: number;
}

export interface GroupStats {
  group_id: number;
  group_name: string;
  total_clients: number;
  active_clients: number;
  total_received_bytes: number;
  total_sent_bytes: number;
  clients: ClientStats[];
}

export interface ClientStats {
  id: number;
  name: string;
  is_active: boolean;
  received_bytes: number;
  sent_bytes: number;
  last_handshake: string | null;
}
