from datetime import datetime
from app import db


class Client(db.Model):
    """Client model for WireGuard peers."""
    __tablename__ = 'clients'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    
    # WireGuard keys
    private_key = db.Column(db.String(44), nullable=False)
    public_key = db.Column(db.String(44), nullable=False)
    preshared_key = db.Column(db.String(44))  # Optional for extra security
    
    # IP configuration
    assigned_ip = db.Column(db.String(15), nullable=False)
    
    # Client-specific settings
    allowed_ips = db.Column(db.String(255), default='0.0.0.0/0, ::/0')  # What IPs client can route
    can_address_peers = db.Column(db.Boolean, default=True)  # Can this client talk to other clients
    
    # Custom DNS (overrides group DNS)
    dns_override = db.Column(db.String(255))
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    
    # Group relationship
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_handshake = db.Column(db.DateTime)
    
    # Stats
    total_received = db.Column(db.BigInteger, default=0)  # bytes
    total_sent = db.Column(db.BigInteger, default=0)  # bytes
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'public_key': self.public_key,
            'assigned_ip': self.assigned_ip,
            'allowed_ips': self.allowed_ips,
            'can_address_peers': self.can_address_peers,
            'dns_override': self.dns_override,
            'is_active': self.is_active,
            'group_id': self.group_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_handshake': self.last_handshake.isoformat() if self.last_handshake else None,
            'total_received': self.total_received,
            'total_sent': self.total_sent,
        }
    
    def generate_client_config(self):
        """Generate WireGuard client configuration file content."""
        group = self.group
        dns = self.dns_override or group.dns
        
        # Determine allowed IPs based on can_address_peers setting
        if self.can_address_peers and group.allow_client_to_client:
            allowed_ips = self.allowed_ips
        else:
            # Only route to server IP, not other clients
            allowed_ips = f"{group.server_ip}/32"
            if self.allowed_ips and '0.0.0.0/0' in self.allowed_ips:
                # Also add internet routing
                allowed_ips = '0.0.0.0/0, ::/0'
        
        config = f"""[Interface]
PrivateKey = {self.private_key}
Address = {self.assigned_ip}/{group.get_subnet_mask()}
"""
        
        if dns:
            config += f"DNS = {dns}\n"
        
        if group.mtu:
            config += f"MTU = {group.mtu}\n"
        
        config += f"""
[Peer]
PublicKey = {group.server_public_key}
AllowedIPs = {allowed_ips}
"""
        
        if self.preshared_key:
            config += f"PresharedKey = {self.preshared_key}\n"
        
        if group.endpoint:
            config += f"Endpoint = {group.endpoint}:{group.listen_port}\n"
        
        if group.persistent_keepalive:
            config += f"PersistentKeepalive = {group.persistent_keepalive}\n"
        
        return config
