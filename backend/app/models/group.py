from datetime import datetime
from app import db
import ipaddress
import os
import logging

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
    listen_port = db.Column(db.Integer, default=51820)
    dns = db.Column(db.String(255), default='1.1.1.1, 8.8.8.8')
    endpoint = db.Column(db.String(255))
    persistent_keepalive = db.Column(db.Integer, default=25)
    mtu = db.Column(db.Integer, default=1420)

    # Client-to-client communication
    allow_client_to_client = db.Column(db.Boolean, default=True)

    # WireGuard status
    is_running = db.Column(db.Boolean, default=False)

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

        config = f"""[Interface]
PrivateKey = {self.server_private_key}
Address = {address}
ListenPort = {self.listen_port}
"""

        # Build PostUp rules for NAT and forwarding
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

        # Add client-to-client communication restrictions based on group and client settings
        active_clients = self.clients.filter_by(is_active=True).all()

        if not self.allow_client_to_client:
            # Group-level restriction: block ALL client-to-client communication
            # Add rules to drop packets between clients
            for client in active_clients:
                postup_rules.append(f"iptables -A FORWARD -i %i -s {client.assigned_ip} -d {self.ip_range} ! -d {self.server_ip} -j DROP")
                postdown_rules.insert(0, f"iptables -D FORWARD -i %i -s {client.assigned_ip} -d {self.ip_range} ! -d {self.server_ip} -j DROP")
        else:
            # Group allows client-to-client, but check individual client restrictions
            for client in active_clients:
                if not client.can_address_peers:
                    # This client cannot address other peers
                    # Drop packets from this client to other clients (but allow to server)
                    postup_rules.append(f"iptables -A FORWARD -i %i -s {client.assigned_ip} -d {self.ip_range} ! -d {self.server_ip} -j DROP")
                    postdown_rules.insert(0, f"iptables -D FORWARD -i %i -s {client.assigned_ip} -d {self.ip_range} ! -d {self.server_ip} -j DROP")

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

            # Add IPv6 client-to-client restrictions if configured
            if not self.allow_client_to_client:
                for client in active_clients:
                    if client.assigned_ip_v6:
                        postup_rules.append(f"ip6tables -A FORWARD -i %i -s {client.assigned_ip_v6} -d {self.ip_range_v6} ! -d {self.server_ip_v6} -j DROP")
                        postdown_rules.insert(0, f"ip6tables -D FORWARD -i %i -s {client.assigned_ip_v6} -d {self.ip_range_v6} ! -d {self.server_ip_v6} -j DROP")
            else:
                for client in active_clients:
                    if not client.can_address_peers and client.assigned_ip_v6:
                        postup_rules.append(f"ip6tables -A FORWARD -i %i -s {client.assigned_ip_v6} -d {self.ip_range_v6} ! -d {self.server_ip_v6} -j DROP")
                        postdown_rules.insert(0, f"ip6tables -D FORWARD -i %i -s {client.assigned_ip_v6} -d {self.ip_range_v6} ! -d {self.server_ip_v6} -j DROP")

        # Add PostUp and PostDown rules
        config += "PostUp = " + "; ".join(postup_rules) + "\n"
        config += "PostDown = " + "; ".join(postdown_rules) + "\n"

        # Add client peers
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
        """Get the configuration directory path for this group."""
        from config import Config

        config_path = Config.WG_CONFIG_PATH
        if not config_path:
            return None

        group_dirname = f"{self.name.lower().replace(' ', '-').replace('/', '-')}"
        return os.path.join(config_path, group_dirname)

    def save_server_config(self):
        """Save WireGuard server configuration to file."""
        group_dir = self.get_group_config_dir()
        if not group_dir:
            logger.warning("WG_CONFIG_PATH not set, cannot save server config for group_id=%s", self.id)
            return False

        # Create group directory if it doesn't exist
        os.makedirs(group_dir, exist_ok=True)

        # Save server config
        server_filepath = os.path.join(group_dir, "server.conf")
        try:
            config_content = self.generate_server_config()
            with open(server_filepath, 'w') as f:
                f.write(config_content)
            logger.info("Server config saved for group_id=%s to %s", self.id, server_filepath)
        except Exception as e:
            logger.error("Failed to save server config for group_id=%s: %s", self.id, e, exc_info=True)
            return False

        # Get list of expected client config files
        expected_client_files = set()
        for client in self.clients.filter_by(is_active=True):
            client_filename = f"{client.name.lower().replace(' ', '-').replace('/', '-')}.conf"
            expected_client_files.add(client_filename)
            client.save_client_config()

        # Remove client config files that are no longer needed
        try:
            existing_files = os.listdir(group_dir)
            for filename in existing_files:
                if filename == "server.conf":
                    continue
                if filename.endswith('.conf') and filename not in expected_client_files:
                    old_filepath = os.path.join(group_dir, filename)
                    os.remove(old_filepath)
                    logger.info("Removed obsolete client config: %s", old_filepath)
        except Exception as e:
            logger.error("Failed to clean up old client configs for group_id=%s: %s", self.id, e)

        # Start/reload WireGuard interface only if it was already running
        if self.is_running:
            self.start_wireguard()

        return True

    def get_wireguard_interface_name(self):
        """Get the WireGuard interface name for this group."""
        # Use group ID to create unique interface names (wg0, wg1, etc.)
        return f"wg{self.id}"

    def start_wireguard(self):
        """Start or reload the WireGuard interface for this group."""
        from app.utils.wireguard import reload_wireguard_interface

        group_dir = self.get_group_config_dir()
        if not group_dir:
            return False

        server_filepath = os.path.join(group_dir, "server.conf")
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
        """Delete WireGuard server configuration directory and all its contents."""
        # Stop WireGuard interface first
        self.stop_wireguard()

        group_dir = self.get_group_config_dir()
        if not group_dir:
            return

        try:
            if os.path.exists(group_dir):
                import shutil
                shutil.rmtree(group_dir)
                logger.info("Group config directory deleted for group_id=%s from %s", self.id, group_dir)
        except Exception as e:
            logger.error("Failed to delete group config directory for group_id=%s: %s", self.id, e, exc_info=True)

