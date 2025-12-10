from datetime import datetime
from app import db
import ipaddress
import os
import logging
import shutil

logger = logging.getLogger(__name__)


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
    listen_port = db.Column(db.Integer, nullable=True)  # Auto-assigned if not provided
    dns = db.Column(db.String(255), default='1.1.1.1, 8.8.8.8')
    endpoint = db.Column(db.String(255))
    persistent_keepalive = db.Column(db.Integer, default=25)
    mtu = db.Column(db.Integer, default=1420)

    # WireGuard status - enabled by default for reliability
    is_running = db.Column(db.Boolean, default=True)

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

    def get_auto_listen_port(self):
        """Get or assign an auto-generated unique listen port based on group ID.

        Returns:
            int: A unique port number for this group's WireGuard interface
        """
        # If port is explicitly set, use it
        if self.listen_port and self.listen_port > 0:
            return self.listen_port

        # Generate unique port: base_port (51820) + group_id
        # This ensures each group gets a unique port
        # e.g., group 1 -> 51821, group 2 -> 51822, etc.
        base_port = 51820
        return base_port + self.id

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
            'is_running': self.is_running,
            'owner_id': self.owner_id,
            'owner_username': self.owner.username if self.owner else None,
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

        # Get unique listen port
        listen_port = self.get_auto_listen_port()

        config = f"""[Interface]
PrivateKey = {self.server_private_key}
Address = {address}
ListenPort = {listen_port}
"""

        # Build PostUp rules for NAT and forwarding (simplified - no peer-to-peer restrictions)
        postup_rules = [
            # Enable NAT/masquerading for outbound traffic to internet
            "iptables -t nat -A POSTROUTING ! -o %i -j MASQUERADE",
            # Allow forwarding from WireGuard to other interfaces (outbound)
            "iptables -A FORWARD -i %i -j ACCEPT",
            # Allow forwarding to WireGuard from other interfaces (inbound)
            "iptables -A FORWARD -o %i -j ACCEPT",
        ]

        postdown_rules = [
            # Disable NAT/masquerading
            "iptables -t nat -D POSTROUTING ! -o %i -j MASQUERADE",
            # Disable forwarding rules
            "iptables -D FORWARD -i %i -j ACCEPT",
            "iptables -D FORWARD -o %i -j ACCEPT",
        ]

        # Add IPv6 rules if configured
        if self.ip_range_v6:
            postup_rules.extend([
                "ip6tables -t nat -A POSTROUTING ! -o %i -j MASQUERADE",
                "ip6tables -A FORWARD -i %i -j ACCEPT",
                "ip6tables -A FORWARD -o %i -j ACCEPT",
            ])
            postdown_rules.extend([
                "ip6tables -t nat -D POSTROUTING ! -o %i -j MASQUERADE",
                "ip6tables -D FORWARD -i %i -j ACCEPT",
                "ip6tables -D FORWARD -o %i -j ACCEPT",
            ])

        # Add PostUp and PostDown rules
        config += "PostUp = " + "; ".join(postup_rules) + "\n"
        config += "PostDown = " + "; ".join(postdown_rules) + "\n"

        # Add client peers
        active_clients = self.clients.filter_by(is_active=True).all()
        for client in active_clients:
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

    def get_group_config_dir(self):
        """Get the configuration directory path for this group.

        Returns a group-specific subdirectory for storing client configs.
        """
        from config import Config

        config_path = Config.WG_CONFIG_PATH
        if not config_path:
            return None

        # Create group-specific subdirectory using sanitized group name
        interface_name = self.get_wireguard_interface_name()
        group_dir = os.path.join(config_path, interface_name)
        return group_dir

    def get_server_config_path(self):
        """Get the full path to the server config file.

        Returns a path like /etc/wireguard/wg-groupname.conf which wg-quick expects.
        Server config is stored in the base WireGuard directory for wg-quick compatibility.
        """
        from config import Config

        config_path = Config.WG_CONFIG_PATH
        if not config_path:
            return None

        interface_name = self.get_wireguard_interface_name()
        return os.path.join(config_path, f"{interface_name}.conf")

    def save_server_config(self):
        """Save WireGuard server configuration to file."""
        server_filepath = self.get_server_config_path()
        if not server_filepath:
            logger.warning("WG_CONFIG_PATH not set, cannot save server config for group_id=%s", self.id)
            return False

        # Ensure directory exists
        config_dir = os.path.dirname(server_filepath)
        os.makedirs(config_dir, exist_ok=True)

        # Save server config with secure permissions (0600)
        try:
            config_content = self.generate_server_config()

            # Write with secure permissions
            with open(server_filepath, 'w') as f:
                f.write(config_content)

            # Set secure permissions (0600 - owner read/write only)
            os.chmod(server_filepath, 0o600)

            logger.info("Server config saved for group_id=%s to %s", self.id, server_filepath)
        except Exception as e:
            logger.error("Failed to save server config for group_id=%s: %s", self.id, e, exc_info=True)
            return False

        # Save all active client configs
        for client in self.clients.filter_by(is_active=True):
            client.save_client_config()

        # Start/reload WireGuard interface if it should be running
        if self.is_running:
            self.start_wireguard()

        return True

    def get_wireguard_interface_name(self):
        """Get the WireGuard interface name for this group.

        Uses sanitized group name for the interface name (e.g., 'wg-groupname').
        Falls back to group ID if sanitization results in empty string.
        """
        # Sanitize group name: lowercase, replace spaces and special chars with hyphens
        sanitized = self.name.lower()
        # Replace spaces and special characters with hyphens
        sanitized = ''.join(c if c.isalnum() else '-' for c in sanitized)
        # Remove consecutive hyphens
        while '--' in sanitized:
            sanitized = sanitized.replace('--', '-')
        # Remove leading/trailing hyphens
        sanitized = sanitized.strip('-')

        # Fallback to group ID if name is empty after sanitization
        if not sanitized:
            sanitized = f"group{self.id}"

        # Limit length to avoid filesystem issues (max 15 chars for interface name in Linux)
        if len(sanitized) > 12:  # Leave room for 'wg-' prefix
            sanitized = sanitized[:12]
        sanitized = sanitized.rstrip('-')

        # Final check: ensure we have a valid name
        if not sanitized:
            sanitized = f"group{self.id}"

        return f"wg-{sanitized}"

    def start_wireguard(self):
        """Start or reload the WireGuard interface for this group."""
        from app.utils.wireguard import reload_wireguard_interface

        server_filepath = self.get_server_config_path()
        if not server_filepath:
            return False

        interface_name = self.get_wireguard_interface_name()

        success = reload_wireguard_interface(interface_name, server_filepath)
        if success:
            self.is_running = True
            db.session.commit()
        return success

    def stop_wireguard(self):
        """Stop the WireGuard interface for this group."""
        from app.utils.wireguard import stop_wireguard_interface

        interface_name = self.get_wireguard_interface_name()
        success = stop_wireguard_interface(interface_name)
        if success:
            self.is_running = False
            db.session.commit()
        return success

    def update_client_stats(self):
        """Update client statistics from WireGuard interface."""
        from app.utils.wireguard import get_wireguard_stats
        from datetime import datetime, timezone

        if not self.is_running:
            return False

        interface_name = self.get_wireguard_interface_name()
        stats = get_wireguard_stats(interface_name)

        if not stats:
            return False

        # Update each client's stats
        for client in self.clients.filter_by(is_active=True):
            if client.public_key in stats:
                peer_stats = stats[client.public_key]

                # Update handshake time (Unix timestamp to datetime)
                if peer_stats['latest_handshake'] > 0:
                    client.last_handshake = datetime.fromtimestamp(peer_stats['latest_handshake'], tz=timezone.utc).replace(tzinfo=None)

                # Update traffic stats
                client.total_received = peer_stats['received_bytes']
                client.total_sent = peer_stats['sent_bytes']

        db.session.commit()
        return True

    def delete_server_config(self):
        """Delete WireGuard server configuration file and group directory."""
        # Stop WireGuard interface first
        self.stop_wireguard()

        server_filepath = self.get_server_config_path()
        if server_filepath:
            try:
                if os.path.exists(server_filepath):
                    os.remove(server_filepath)
                    logger.info("Server config deleted for group_id=%s from %s", self.id, server_filepath)
            except Exception as e:
                logger.error("Failed to delete server config for group_id=%s: %s", self.id, e, exc_info=True)

        # Delete group directory with all client configs
        group_dir = self.get_group_config_dir()
        if group_dir:
            try:
                if os.path.exists(group_dir):
                    shutil.rmtree(group_dir)
                    logger.info("Group directory deleted for group_id=%s from %s", self.id, group_dir)
            except Exception as e:
                logger.error("Failed to delete group directory for group_id=%s: %s", self.id, e, exc_info=True)

