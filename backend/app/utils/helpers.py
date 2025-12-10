"""Helper functions for common patterns across the application."""
import logging
import re
from datetime import datetime
from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from app.models.user import User
from app.models.group import Group
from app.models.client import Client

logger = logging.getLogger(__name__)


def get_current_user():
    """Get the current authenticated user.
    
    Returns:
        User: The current user object or None if not found
    """
    try:
        user_id = int(get_jwt_identity())
        return User.query.get(user_id)
    except (ValueError, TypeError) as e:
        logger.error("Failed to get current user: %s", e)
        return None


def validate_request_data(data, required_fields):
    """Validate that request data contains required fields.
    
    Args:
        data: The request data dictionary
        required_fields: List of required field names
        
    Returns:
        tuple: (is_valid, error_message) where is_valid is bool
    """
    if not data:
        return False, "No data provided"
    
    missing_fields = []
    for field in required_fields:
        # Check if field exists and is not None or empty string
        if field not in data or data[field] is None or data[field] == '':
            missing_fields.append(field)
    
    if missing_fields:
        return False, f"Missing required fields: {', '.join(missing_fields)}"
    
    return True, None


def create_error_response(message, status_code=400):
    """Create a standardized error response.
    
    Args:
        message: Error message
        status_code: HTTP status code
        
    Returns:
        tuple: (response, status_code)
    """
    return jsonify({'error': message}), status_code


def create_success_response(data=None, message=None, status_code=200):
    """Create a standardized success response.
    
    Args:
        data: Response data (dict or list)
        message: Optional success message
        status_code: HTTP status code
        
    Returns:
        tuple: (response, status_code)
    """
    if message:
        response = {'message': message}
        if data:
            response['data'] = data
        return jsonify(response), status_code
    
    return jsonify(data) if data is not None else jsonify({}), status_code


def log_request(endpoint, user_id=None, **kwargs):
    """Log an incoming request with context.
    
    Args:
        endpoint: Name of the endpoint
        user_id: User ID making the request
        **kwargs: Additional context to log
    """
    context = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    logger.info("Request %s user_id=%s %s", endpoint, user_id, context)


def log_action(action, entity_type, entity_id, user_id, **kwargs):
    """Log a user action with structured context.
    
    Args:
        action: Action performed (created, updated, deleted, etc.)
        entity_type: Type of entity (group, client, user, etc.)
        entity_id: ID of the entity
        user_id: User ID performing the action
        **kwargs: Additional context to log
    """
    context = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    logger.info("%s %s id=%s by user_id=%s %s", action.capitalize(), entity_type, entity_id, user_id, context)


def check_group_access(user, group):
    """Check if user has access to a group.
    
    Args:
        user: User object
        group: Group object
        
    Returns:
        tuple: (has_access, error_response) where error_response is None if has_access is True
    """
    if not group:
        logger.warning("Group not found for user_id=%s", user.id if user else None)
        return False, create_error_response("Group not found", 404)
    
    if not user.can_access_group(group):
        logger.warning("Access denied to group_id=%s for user_id=%s", group.id, user.id)
        return False, create_error_response("Access denied", 403)
    
    return True, None


def check_client_access(user, client):
    """Check if user has access to a client.
    
    Args:
        user: User object
        client: Client object
        
    Returns:
        tuple: (has_access, error_response) where error_response is None if has_access is True
    """
    if not client:
        logger.warning("Client not found for user_id=%s", user.id if user else None)
        return False, create_error_response("Client not found", 404)
    
    if not user.can_access_group(client.group):
        logger.warning("Access denied to client_id=%s for user_id=%s", client.id, user.id)
        return False, create_error_response("Access denied", 403)
    
    return True, None


def check_group_ownership(user, group):
    """Check if user is owner of a group or is admin.
    
    Args:
        user: User object
        group: Group object
        
    Returns:
        tuple: (is_owner, error_response) where error_response is None if is_owner is True
    """
    if group.owner_id != user.id and not user.is_admin():
        logger.warning("Ownership check failed for group_id=%s by user_id=%s", group.id, user.id)
        return False, create_error_response("Only owner can perform this action", 403)
    
    return True, None


def parse_expiration_date(date_string):
    """Parse expiration date from various formats.
    
    Args:
        date_string: Date string in ISO format or YYYY-MM-DD format
        
    Returns:
        datetime: Parsed datetime object
        
    Raises:
        ValueError: If date format is invalid
    """
    if not date_string:
        return None
    
    try:
        if 'T' in date_string:
            # ISO format with time
            return datetime.fromisoformat(date_string.replace('Z', '+00:00'))
        else:
            # Date only format (YYYY-MM-DD) - set to end of day
            return datetime.strptime(date_string, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
    except (ValueError, TypeError) as e:
        raise ValueError('Invalid expiration date format. Expected YYYY-MM-DD or ISO format')


def sanitize_filename(filename):
    """Sanitize a filename to prevent path traversal and other security issues.
    
    Args:
        filename: Original filename
        
    Returns:
        str: Sanitized filename safe for filesystem use
    """
    # Remove any path components
    filename = filename.split('/')[-1].split('\\')[-1]
    
    # Replace unsafe characters with hyphens
    filename = re.sub(r'[^\w\s\-.]', '-', filename)
    
    # Replace spaces with hyphens
    filename = filename.replace(' ', '-')
    
    # Remove multiple consecutive hyphens
    filename = re.sub(r'-+', '-', filename)
    
    # Lowercase and strip
    filename = filename.lower().strip('-')
    
    # Ensure it's not empty and doesn't start with a dot
    if not filename or filename.startswith('.'):
        filename = 'config' + filename
    
    return filename


def sanitize_interface_name(name, max_length=15):
    """Sanitize a name for use as a WireGuard interface name.
    
    Args:
        name: Original name
        max_length: Maximum length for interface name (default: 15 for Linux)
        
    Returns:
        str: Sanitized interface name that matches pattern ^[a-z0-9][a-z0-9\-]{0,14}$
    """
    # Convert to lowercase
    sanitized = name.lower()
    
    # Replace spaces and non-alphanumeric chars (except hyphens) with hyphens
    sanitized = re.sub(r'[^a-z0-9\-]', '-', sanitized)
    
    # Remove multiple consecutive hyphens
    sanitized = re.sub(r'-+', '-', sanitized)
    
    # Remove leading/trailing hyphens
    sanitized = sanitized.strip('-')
    
    # Ensure it starts with alphanumeric (not hyphen)
    if sanitized and not sanitized[0].isalnum():
        sanitized = 'wg-' + sanitized
    
    # Truncate to max_length
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length].rstrip('-')
    
    # Ensure it's not empty and starts with alphanumeric
    if not sanitized or not sanitized[0].isalnum():
        sanitized = 'wg0'
    
    return sanitized
