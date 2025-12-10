from app.utils.wireguard import generate_keypair, generate_preshared_key
from app.utils.decorators import admin_required

__all__ = ['generate_keypair', 'generate_preshared_key', 'admin_required']
