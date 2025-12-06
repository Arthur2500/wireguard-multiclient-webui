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
