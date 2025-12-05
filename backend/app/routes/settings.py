from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.models.settings import Settings, DEFAULT_SETTINGS
from app.utils.decorators import admin_required
from app import db

settings_bp = Blueprint('settings', __name__)


@settings_bp.route('', methods=['GET'])
@jwt_required()
def get_settings():
    """Get all settings."""
    settings = Settings.query.all()
    
    # Return settings as key-value pairs
    result = dict(DEFAULT_SETTINGS)
    for setting in settings:
        result[setting.key] = setting.value
    
    return jsonify(result), 200


@settings_bp.route('/<string:key>', methods=['GET'])
@jwt_required()
def get_setting(key):
    """Get a specific setting."""
    setting = Settings.query.filter_by(key=key).first()
    
    if setting:
        return jsonify(setting.to_dict()), 200
    
    # Check if it's a default setting
    if key in DEFAULT_SETTINGS:
        return jsonify({
            'key': key,
            'value': DEFAULT_SETTINGS[key],
            'description': None,
            'updated_at': None,
        }), 200
    
    return jsonify({'error': 'Setting not found'}), 404


@settings_bp.route('/<string:key>', methods=['PUT'])
@admin_required
def update_setting(key):
    """Update a setting (admin only)."""
    data = request.get_json()
    
    if not data or 'value' not in data:
        return jsonify({'error': 'Value required'}), 400
    
    setting = Settings.set(
        key=key,
        value=data['value'],
        description=data.get('description')
    )
    
    return jsonify(setting.to_dict()), 200


@settings_bp.route('/bulk', methods=['PUT'])
@admin_required
def update_settings_bulk():
    """Update multiple settings at once (admin only)."""
    data = request.get_json()
    
    if not data or not isinstance(data, dict):
        return jsonify({'error': 'Settings dictionary required'}), 400
    
    updated = []
    for key, value in data.items():
        setting = Settings.set(key=key, value=str(value))
        updated.append(setting.to_dict())
    
    return jsonify(updated), 200


@settings_bp.route('/defaults', methods=['GET'])
@jwt_required()
def get_default_settings():
    """Get default WireGuard settings."""
    return jsonify(DEFAULT_SETTINGS), 200


@settings_bp.route('/reset', methods=['POST'])
@admin_required
def reset_settings():
    """Reset all settings to defaults (admin only)."""
    # Delete all settings
    Settings.query.delete()
    db.session.commit()
    
    return jsonify({'message': 'Settings reset to defaults'}), 200
