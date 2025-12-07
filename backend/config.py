import os
from datetime import timedelta
import tempfile

basedir = os.path.abspath(os.path.dirname(__file__))


class Config:
    """Base configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', f'sqlite:///{os.path.join(basedir, "app.db")}')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.environ.get('JWT_ACCESS_TOKEN_EXPIRES_HOURS', 24)))
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO').upper()

    # WireGuard defaults
    WG_DEFAULT_DNS = os.environ.get('WG_DEFAULT_DNS', '1.1.1.1, 8.8.8.8')
    WG_DEFAULT_ENDPOINT = os.environ.get('WG_DEFAULT_ENDPOINT', '')
    WG_DEFAULT_PORT = int(os.environ.get('WG_DEFAULT_PORT', 51820))
    WG_CONFIG_PATH = os.environ.get('WG_CONFIG_PATH', '/etc/wireguard')
    WG_DEFAULT_MTU = int(os.environ.get('WG_DEFAULT_MTU', 1420))
    WG_DEFAULT_KEEPALIVE = int(os.environ.get('WG_DEFAULT_KEEPALIVE', 25))
    WG_USE_PRESHARED_KEY = os.environ.get('WG_USE_PRESHARED_KEY', 'false').lower() in ('true', '1', 'yes')
    
    # Statistics collection (in seconds)
    STATS_COLLECTION_INTERVAL = int(os.environ.get('STATS_COLLECTION_INTERVAL', 300))


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    # Use environment variable for testing, set to temp dir if not already set
    if 'WG_CONFIG_PATH' not in os.environ:
        os.environ['WG_CONFIG_PATH'] = tempfile.mkdtemp(prefix='wg-test-')
    WG_CONFIG_PATH = os.environ['WG_CONFIG_PATH']


config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
