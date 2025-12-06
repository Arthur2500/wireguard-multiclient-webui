from datetime import datetime
from app import db
import os
import logging

logger = logging.getLogger(__name__)


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

    # IPv4 configuration
    assigned_ip = db.Column(db.String(15), nullable=False)

    # IPv6 configuration (optional)
    assigned_ip_v6 = db.Column(db.String(39))

    # Client-specific settings
    allowed_ips = db.Column(db.String(255), default='0.0.0.0/0, ::/0')  # What IPs client can route
    can_address_peers = db.Column(db.Boolean, default=True)  # Can this client talk to other clients

    # Custom DNS (overrides group DNS)
    dns_override = db.Column(db.String(255))

    # Status
    is_active = db.Column(db.Boolean, default=True)
    expires_at = db.Column(db.DateTime, nullable=True)  # Optional expiration date

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
            'assigned_ip_v6': self.assigned_ip_v6,
            'allowed_ips': self.allowed_ips,
            'can_address_peers': self.can_address_peers,
            'dns_override': self.dns_override,
            'is_active': self.is_active,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
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

        # Determine allowed IPs - what traffic should go through the VPN tunnel
        # Default behavior: use whatever is configured in client.allowed_ips
        allowed_ips = self.allowed_ips

        # If client can't address peers and group doesn't allow client-to-client
        # then restrict to only server IP (no peer-to-peer routing)
        if not self.can_address_peers or not group.allow_client_to_client:
            # Check if full tunnel is requested (0.0.0.0/0)
            if self.allowed_ips and '0.0.0.0/0' in self.allowed_ips:
                # Keep full tunnel routing
                allowed_ips = '0.0.0.0/0, ::/0'
            else:
                # Only route to server IP and VPN subnet, not other clients
                allowed_ips = f"{group.ip_range}"
                if group.ip_range_v6:
                    allowed_ips += f", {group.ip_range_v6}"

        # Build Address line with IPv4 and optional IPv6
        address = f"{self.assigned_ip}/{group.get_subnet_mask()}"
        if self.assigned_ip_v6 and group.ip_range_v6:
            address += f", {self.assigned_ip_v6}/{group.get_subnet_mask_v6()}"

        config = f"""[Interface]
PrivateKey = {self.private_key}
Address = {address}
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

    def save_client_config(self):
        """Save WireGuard client configuration to file."""
        if not self.group:
            logger.warning("Cannot save client config for client_id=%s without group", self.id)
            return False

        group_dir = self.group.get_group_config_dir()
        if not group_dir:
            logger.warning("Cannot save client config for client_id=%s, group directory not available", self.id)
            return False

        # Ensure group directory exists
        os.makedirs(group_dir, exist_ok=True)

        # Generate client filename
        client_filename = f"{self.name.lower().replace(' ', '-').replace('/', '-')}.conf"
        client_filepath = os.path.join(group_dir, client_filename)

        try:
            config_content = self.generate_client_config()
            with open(client_filepath, 'w') as f:
                f.write(config_content)
            logger.info("Client config saved for client_id=%s to %s", self.id, client_filepath)
            return True
        except Exception as e:
            logger.error("Failed to save client config for client_id=%s: %s", self.id, e, exc_info=True)
            return False

    def delete_client_config(self):
        """Delete WireGuard client configuration file."""
        if not self.group:
            return

        group_dir = self.group.get_group_config_dir()
        if not group_dir:
            return

        client_filename = f"{self.name.lower().replace(' ', '-').replace('/', '-')}.conf"
        client_filepath = os.path.join(group_dir, client_filename)

        try:
            if os.path.exists(client_filepath):
                os.remove(client_filepath)
                logger.info("Client config deleted for client_id=%s from %s", self.id, client_filepath)
        except Exception as e:
            logger.error("Failed to delete client config for client_id=%s: %s", self.id, e, exc_info=True)

