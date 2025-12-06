export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  is_active: boolean;
  can_create_groups: boolean;
  can_create_clients: boolean;
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
  owner_username: string | null;
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
  expires_at: string | null;
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

export interface DetailedClientStats {
  client_id: number;
  client_name: string;
  is_active: boolean;
  total_received_bytes: number;
  total_sent_bytes: number;
  last_handshake: string | null;
  connection_logs: Array<{
    id: number;
    client_id: number;
    group_id: number;
    handshake_time: string | null;
    endpoint: string | null;
    received_bytes: number;
    sent_bytes: number;
    recorded_at: string | null;
  }>;
}

export interface UserStats {
  user_id: number;
  username: string;
  total_groups: number;
  owned_groups: number;
  member_groups: number;
  total_clients: number;
  active_clients: number;
  total_received_bytes: number;
  total_sent_bytes: number;
  groups: Array<{
    id: number;
    name: string;
    is_owner: boolean;
    client_count: number;
    active_clients: number;
    received_bytes: number;
    sent_bytes: number;
  }>;
}

export interface SystemStats {
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
  users: Array<{
    id: number;
    username: string;
    role: string;
    group_count: number;
    client_count: number;
    received_bytes: number;
    sent_bytes: number;
  }>;
  recent_connections_24h: number;
}

// Traffic history types
export interface TrafficDataPoint {
  id: number;
  client_id: number | null;
  group_id: number | null;
  received_bytes: number;
  sent_bytes: number;
  recorded_at: string | null;
}

export type TimeRange = '1h' | '1d' | '1w';

export interface TotalTrafficHistory {
  range: TimeRange;
  data: TrafficDataPoint[];
}

export interface GroupTrafficData {
  group_id: number;
  group_name: string;
  data: TrafficDataPoint[];
}

export interface GroupsTrafficHistory {
  range: TimeRange;
  groups: GroupTrafficData[];
}

export interface ClientTrafficData {
  client_id: number;
  client_name: string;
  group_id: number;
  data: TrafficDataPoint[];
}

export interface ClientsTrafficHistory {
  range: TimeRange;
  clients: ClientTrafficData[];
}

export interface GroupDetailedTrafficHistory {
  range: TimeRange;
  group_id: number;
  group_name: string;
  group_data: TrafficDataPoint[];
  clients: Array<{
    client_id: number;
    client_name: string;
    data: TrafficDataPoint[];
  }>;
}
