"""Health check endpoints for monitoring."""
import logging
from flask import Blueprint, jsonify
from app import db
from app.models.group import Group

logger = logging.getLogger(__name__)

health_bp = Blueprint('health', __name__)


@health_bp.route('/health', methods=['GET'])
def health_check():
    """Basic health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'wireguard-webui'
    }), 200


@health_bp.route('/ready', methods=['GET'])
def readiness_check():
    """Readiness check that verifies database connectivity."""
    try:
        # Test database connection with a simple query
        db.session.execute(db.text('SELECT 1'))
        
        return jsonify({
            'status': 'ready',
            'database': 'connected'
        }), 200
    except Exception as e:
        logger.error("Readiness check failed: %s", e)
        return jsonify({
            'status': 'not_ready',
            'database': 'disconnected',
            'error': str(e)
        }), 503
