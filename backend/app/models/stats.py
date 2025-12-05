from datetime import datetime
from app import db


class ConnectionLog(db.Model):
    """Connection log model for statistics tracking."""
    __tablename__ = 'connection_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    
    # Connection info
    handshake_time = db.Column(db.DateTime, nullable=False)
    endpoint = db.Column(db.String(50))  # Client's real IP:port
    
    # Transfer stats
    received_bytes = db.Column(db.BigInteger, default=0)
    sent_bytes = db.Column(db.BigInteger, default=0)
    
    # Timestamp
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    client = db.relationship('Client', backref='connection_logs')
    group = db.relationship('Group', backref='connection_logs')
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'client_id': self.client_id,
            'group_id': self.group_id,
            'handshake_time': self.handshake_time.isoformat() if self.handshake_time else None,
            'endpoint': self.endpoint,
            'received_bytes': self.received_bytes,
            'sent_bytes': self.sent_bytes,
            'recorded_at': self.recorded_at.isoformat() if self.recorded_at else None,
        }
