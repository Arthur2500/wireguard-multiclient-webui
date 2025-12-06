from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from app.models.user import User
from app import db


def admin_required(fn):
    """Decorator to require admin role."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        
        if not user or not user.is_admin():
            return jsonify({'error': 'Admin access required'}), 403
        
        return fn(*args, **kwargs)
    return wrapper


def group_access_required(fn):
    """Decorator to require group access."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Store user in kwargs for access in route
        kwargs['current_user'] = user
        
        return fn(*args, **kwargs)
    return wrapper
