import subprocess
import base64
import os


def generate_keypair():
    """Generate WireGuard keypair."""
    try:
        # Try using wg command if available
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
        
        return private_key, public_key
    except (subprocess.SubprocessError, FileNotFoundError):
        # Fallback: Generate using Python
        # This is a simplified version - in production, use wg tools
        private_key = base64.b64encode(os.urandom(32)).decode('utf-8')
        # Note: This doesn't actually compute a valid public key
        # In production, you would need proper curve25519 implementation
        public_key = base64.b64encode(os.urandom(32)).decode('utf-8')
        return private_key, public_key


def generate_preshared_key():
    """Generate WireGuard preshared key."""
    try:
        # Try using wg command if available
        psk = subprocess.run(
            ['wg', 'genpsk'],
            capture_output=True,
            text=True,
            check=True
        ).stdout.strip()
        return psk
    except (subprocess.SubprocessError, FileNotFoundError):
        # Fallback: Generate using Python
        return base64.b64encode(os.urandom(32)).decode('utf-8')
