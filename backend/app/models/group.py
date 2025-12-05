from datetime import datetime
from app import db
import ipaddress


class Group(db.Model):
    """Group model for WireGuard configurations."""
    __tablename__ = 'groups'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    
    # WireGuard server configuration
    server_private_key = db.Column(db.String(44), nullable=False)
    server_public_key = db.Column(db.String(44), nullable=False)
    
    # IPv4 configuration
    ip_range = db.Column(db.String(18), nullable=False)  # e.g., 10.0.0.0/24
    server_ip = db.Column(db.String(15), nullable=False)  # Server's IP in the range
    
    # IPv6 configuration (optional)
    ip_range_v6 = db.Column(db.String(43))  # e.g., fd00::/64
    server_ip_v6 = db.Column(db.String(39))  # Server's IPv6 in the range
    
    # WireGuard configuration
    listen_port = db.Column(db.Integer, default=51820)
    dns = db.Column(db.String(255), default='1.1.1.1, 8.8.8.8')
    endpoint = db.Column(db.String(255))
    persistent_keepalive = db.Column(db.Integer, default=25)
    mtu = db.Column(db.Integer, default=1420)
    
    # Client-to-client communication
    allow_client_to_client = db.Column(db.Boolean, default=True)
    
    # Ownership
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    clients = db.relationship('Client', backref='group', lazy='dynamic', cascade='all, delete-orphan')
    
    def get_next_available_ip(self):
        """Get the next available IPv4 address in the range."""
        network = ipaddress.ip_network(self.ip_range, strict=False)
        
        # Get all used IPs
        used_ips = set()
        used_ips.add(ipaddress.ip_address(self.server_ip))
        
        for client in self.clients:
            if client.assigned_ip:
                used_ips.add(ipaddress.ip_address(client.assigned_ip))
        
        # Find next available
        for ip in network.hosts():
            if ip not in used_ips:
                return str(ip)
        
        return None
    
    def get_next_available_ip_v6(self):
        """Get the next available IPv6 address in the range."""
        if not self.ip_range_v6:
            return None
            
        network = ipaddress.ip_network(self.ip_range_v6, strict=False)
        
        # Get all used IPv6 addresses
        used_ips = set()
        if self.server_ip_v6:
            used_ips.add(ipaddress.ip_address(self.server_ip_v6))
        
        for client in self.clients:
            if client.assigned_ip_v6:
                used_ips.add(ipaddress.ip_address(client.assigned_ip_v6))
        
        # Find next available (iterate through first 1000 hosts to avoid memory issues)
        count = 0
        for ip in network.hosts():
            if ip not in used_ips:
                return str(ip)
            count += 1
            if count > 1000:
                break
        
        return None
    
    def get_subnet_mask(self):
        """Get the subnet mask from IP range."""
        network = ipaddress.ip_network(self.ip_range, strict=False)
        return str(network.prefixlen)
    
    def get_subnet_mask_v6(self):
        """Get the IPv6 subnet mask from IP range."""
        if not self.ip_range_v6:
            return None
        network = ipaddress.ip_network(self.ip_range_v6, strict=False)
        return str(network.prefixlen)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'ip_range': self.ip_range,
            'server_ip': self.server_ip,
            'ip_range_v6': self.ip_range_v6,
            'server_ip_v6': self.server_ip_v6,
            'server_public_key': self.server_public_key,
            'listen_port': self.listen_port,
            'dns': self.dns,
            'endpoint': self.endpoint,
            'persistent_keepalive': self.persistent_keepalive,
            'mtu': self.mtu,
            'allow_client_to_client': self.allow_client_to_client,
            'owner_id': self.owner_id,
            'client_count': self.clients.count(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def generate_server_config(self):
        """Generate WireGuard server configuration file content."""
        # Build Address line with IPv4 and optional IPv6
        address = f"{self.server_ip}/{self.get_subnet_mask()}"
        if self.server_ip_v6 and self.ip_range_v6:
            address += f", {self.server_ip_v6}/{self.get_subnet_mask_v6()}"
        
        config = f"""[Interface]
PrivateKey = {self.server_private_key}
Address = {address}
ListenPort = {self.listen_port}
"""
        
        # Add PostUp and PostDown for NAT if client-to-client is enabled
        if self.allow_client_to_client:
            config += """PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT"""
            if self.ip_range_v6:
                config += """; ip6tables -A FORWARD -i %i -j ACCEPT; ip6tables -A FORWARD -o %i -j ACCEPT"""
            config += "\n"
            config += """PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT"""
            if self.ip_range_v6:
                config += """; ip6tables -D FORWARD -i %i -j ACCEPT; ip6tables -D FORWARD -o %i -j ACCEPT"""
            config += "\n"
        
        # Add client peers
        for client in self.clients.filter_by(is_active=True):
            allowed_ips = f"{client.assigned_ip}/32"
            if client.assigned_ip_v6:
                allowed_ips += f", {client.assigned_ip_v6}/128"
            config += f"""
[Peer]
# {client.name}
PublicKey = {client.public_key}
AllowedIPs = {allowed_ips}
"""
            if client.preshared_key:
                config += f"PresharedKey = {client.preshared_key}\n"
        
        return config
