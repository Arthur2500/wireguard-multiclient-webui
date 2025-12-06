from datetime import datetime, timezone
from app import db
from app.utils.datetime_utils import utc_now


class Settings(db.Model):
    """Global settings model."""
    __tablename__ = 'settings'
    
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text)
    description = db.Column(db.Text)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now)
    
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
    'wg_default_dns': '1.1.1.1, 8.8.8.8',
    'wg_default_endpoint': '',
    'wg_default_port': '51820',
    'wg_default_mtu': '1420',
    'wg_default_keepalive': '25',
    'wg_config_path': '/etc/wireguard',
    'allow_user_registration': 'false',
    'max_clients_per_group': '250',
}
