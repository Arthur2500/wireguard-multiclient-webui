import subprocess
import base64
import os
import logging

logger = logging.getLogger(__name__)

# Track if we've warned about missing wg command
_wg_warning_shown = False


def generate_keypair():
    """Generate WireGuard keypair.

    Uses the wg command if available, otherwise falls back to generating
    random bytes that can be used for testing/development. In production,
    the wg tools should be available.
    """
    global _wg_warning_shown

    try:
        # Try using wg command if available
        logger.debug("Generating WireGuard keypair via wg binary")
        private_key = subprocess.run(
            ['wg', 'genkey'],
            capture_output=True,
            text=True,
            check=True
        ).stdout.strip()

        public_key = subprocess.run(
            ['wg', 'pubkey'],
            input=private_key,
            capture_output=True,
            text=True,
            check=True
        ).stdout.strip()

        logger.debug("WireGuard keypair generated using system tooling")
        return private_key, public_key
    except (subprocess.SubprocessError, FileNotFoundError) as exc:
        # Fallback: Generate placeholder keys for development
        # WARNING: These are NOT valid WireGuard keys and won't work in production
        if not _wg_warning_shown:
            logger.warning(
                "WireGuard tools not found or failed (using placeholder keys). "
                "Install wireguard-tools for production use.",
                exc_info=exc
            )
            _wg_warning_shown = True

        # Generate random base64-encoded 32-byte keys (correct format, but invalid crypto)
        private_key = base64.b64encode(os.urandom(32)).decode('utf-8')
        public_key = base64.b64encode(os.urandom(32)).decode('utf-8')
        return private_key, public_key


def generate_preshared_key():
    """Generate WireGuard preshared key.

    Preshared keys are just random 32-byte values, so the fallback
    implementation is cryptographically valid.
    """
    try:
        # Try using wg command if available
        logger.debug("Generating WireGuard preshared key via wg binary")
        psk = subprocess.run(
            ['wg', 'genpsk'],
            capture_output=True,
            text=True,
            check=True
        ).stdout.strip()
        logger.debug("WireGuard preshared key generated using system tooling")
        return psk
    except (subprocess.SubprocessError, FileNotFoundError) as exc:
        # Fallback: Generate using Python - this is valid for preshared keys
        logger.warning(
            "WireGuard preshared key generation falling back to Python implementation.",
            exc_info=exc
        )
        return base64.b64encode(os.urandom(32)).decode('utf-8')


def start_wireguard_interface(interface_name, config_path):
    """Start a WireGuard interface using wg-quick.

    Args:
        interface_name: Name of the interface (e.g., 'wg0')
        config_path: Full path to the config file (used to verify it exists)

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Verify config file exists
        if not os.path.exists(config_path):
            logger.error("Config file not found: %s", config_path)
            return False
        
        # Check if interface already exists
        result = subprocess.run(
            ['wg', 'show', interface_name],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            logger.info("WireGuard interface %s already running", interface_name)
            # Reload config by stopping and starting
            stop_wireguard_interface(interface_name)

        # Start the interface with wg-quick using just the interface name
        # wg-quick will look for /etc/wireguard/{interface_name}.conf
        subprocess.run(
            ['wg-quick', 'up', interface_name],
            capture_output=True,
            text=True,
            check=True
        )
        logger.info("WireGuard interface %s started successfully", interface_name)
        return True

    except subprocess.CalledProcessError as e:
        logger.error("Failed to start WireGuard interface %s: %s", interface_name, e.stderr)
        return False
    except FileNotFoundError:
        logger.error("wg-quick command not found. Install wireguard-tools.")
        return False


def stop_wireguard_interface(interface_name):
    """Stop a WireGuard interface using wg-quick.

    Args:
        interface_name: Name of the interface (e.g., 'wg0')

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        result = subprocess.run(
            ['wg-quick', 'down', interface_name],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            logger.info("WireGuard interface %s stopped successfully", interface_name)
            return True
        else:
            # Interface might not be running, still consider it success
            logger.debug("WireGuard interface %s down returned code %d: %s", interface_name, result.returncode, result.stderr)
            return True

    except FileNotFoundError:
        logger.error("wg-quick command not found. Install wireguard-tools.")
        return False
    except Exception as e:
        logger.error("Failed to stop WireGuard interface %s: %s", interface_name, e)
        return False


def reload_wireguard_interface(interface_name, config_path):
    """Reload a WireGuard interface configuration.

    Args:
        interface_name: Name of the interface (e.g., 'wg0')
        config_path: Full path to the config file

    Returns:
        bool: True if successful, False otherwise
    """
    stop_wireguard_interface(interface_name)
    return start_wireguard_interface(interface_name, config_path)


def get_wireguard_stats(interface_name):
    """Get statistics for a WireGuard interface.

    Args:
        interface_name: Name of the interface (e.g., 'wg0')

    Returns:
        dict: Dictionary with peer statistics or None if failed
    """
    try:
        result = subprocess.run(
            ['wg', 'show', interface_name, 'dump'],
            capture_output=True,
            text=True,
            check=True
        )

        peers = {}
        lines = result.stdout.strip().split('\n')

        # Skip header line (interface info)
        for line in lines[1:]:
            if not line:
                continue

            parts = line.split('\t')
            if len(parts) >= 6:
                public_key = parts[0]
                # preshared_key = parts[1]
                # endpoint = parts[2]
                # allowed_ips = parts[3]
                latest_handshake = int(parts[4]) if parts[4] else 0
                received_bytes = int(parts[5]) if parts[5] else 0
                sent_bytes = int(parts[6]) if len(parts) > 6 and parts[6] else 0

                peers[public_key] = {
                    'latest_handshake': latest_handshake,
                    'received_bytes': received_bytes,
                    'sent_bytes': sent_bytes
                }

        return peers

    except subprocess.CalledProcessError as e:
        logger.debug("Failed to get WireGuard stats for %s: %s", interface_name, e.stderr)
        return None
    except Exception as e:
        logger.error("Error getting WireGuard stats: %s", e)
        return None

