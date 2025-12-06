from datetime import datetime
from app import db
from config import Config


class Settings(db.Model):
    """Global settings model."""
    __tablename__ = 'settings'

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text)
    description = db.Column(db.Text)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @staticmethod
    def get(key, default=None):
        """Get a setting value."""
        setting = Settings.query.filter_by(key=key).first()
        return setting.value if setting else default

    @staticmethod
    def set(key, value, description=None):
        """Set a setting value."""
        setting = Settings.query.filter_by(key=key).first()
        if setting:
            setting.value = value
            if description:
                setting.description = description
        else:
            setting = Settings(key=key, value=value, description=description)
            db.session.add(setting)
        db.session.commit()
        return setting

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'key': self.key,
            'value': self.value,
            'description': self.description,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


# Default settings keys
DEFAULT_SETTINGS = {
    'wg_default_dns': Config.WG_DEFAULT_DNS,
    'wg_default_endpoint': Config.WG_DEFAULT_ENDPOINT,
    'wg_default_port': str(Config.WG_DEFAULT_PORT),
    'wg_default_mtu': str(getattr(Config, 'WG_DEFAULT_MTU', 1420)),
    'wg_default_keepalive': str(getattr(Config, 'WG_DEFAULT_KEEPALIVE', 25)),
    'wg_config_path': Config.WG_CONFIG_PATH,
    'allow_user_registration': 'false',
    'max_clients_per_group': '250',
}
