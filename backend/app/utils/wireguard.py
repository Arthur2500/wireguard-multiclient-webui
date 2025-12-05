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
        # Fallback: Generate placeholder keys for development
        # WARNING: These are NOT valid WireGuard keys and won't work in production
        if not _wg_warning_shown:
            logger.warning(
                "WireGuard tools not found. Generating placeholder keys for development. "
                "Install wireguard-tools for production use."
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
        psk = subprocess.run(
            ['wg', 'genpsk'],
            capture_output=True,
            text=True,
            check=True
        ).stdout.strip()
        return psk
    except (subprocess.SubprocessError, FileNotFoundError):
        # Fallback: Generate using Python - this is valid for preshared keys
        return base64.b64encode(os.urandom(32)).decode('utf-8')
