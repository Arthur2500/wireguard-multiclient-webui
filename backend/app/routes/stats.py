from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from datetime import datetime, timedelta
from app.models.user import User
from app.models.group import Group
from app.models.client import Client
from app.models.stats import ConnectionLog
from app.utils.decorators import admin_required
from app import db

stats_bp = Blueprint('stats', __name__)


@stats_bp.route('/overview', methods=['GET'])
@jwt_required()
def get_overview():
    """Get system overview statistics."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.is_admin():
        total_groups = Group.query.count()
        total_clients = Client.query.count()
        active_clients = Client.query.filter_by(is_active=True).count()
        total_users = User.query.count()

        # Calculate total traffic
        total_received = db.session.query(func.sum(Client.total_received)).scalar() or 0
        total_sent = db.session.query(func.sum(Client.total_sent)).scalar() or 0
    else:
        # Filter by accessible groups
        groups = Group.query.filter_by(owner_id=user_id).all()
        group_ids = [g.id for g in groups] + [g.id for g in user.managed_groups]

        total_groups = len(set(group_ids))
        total_clients = Client.query.filter(Client.group_id.in_(group_ids)).count()
        active_clients = Client.query.filter(
            Client.group_id.in_(group_ids),
            Client.is_active == True
        ).count()
        total_users = None  # Not visible to non-admins

        total_received = db.session.query(func.sum(Client.total_received)).filter(
            Client.group_id.in_(group_ids)
        ).scalar() or 0
        total_sent = db.session.query(func.sum(Client.total_sent)).filter(
            Client.group_id.in_(group_ids)
        ).scalar() or 0

    return jsonify({
        'total_groups': total_groups,
        'total_clients': total_clients,
        'active_clients': active_clients,
        'total_users': total_users,
        'total_received_bytes': total_received,
        'total_sent_bytes': total_sent,
    }), 200


@stats_bp.route('/group/<int:group_id>', methods=['GET'])
@jwt_required()
def get_group_stats(group_id):
    """Get statistics for a specific group."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    if not user.can_access_group(group):
        return jsonify({'error': 'Access denied'}), 403

    clients = Client.query.filter_by(group_id=group_id).all()

    total_clients = len(clients)
    active_clients = sum(1 for c in clients if c.is_active)
    total_received = sum(c.total_received for c in clients)
    total_sent = sum(c.total_sent for c in clients)

    # Client breakdown
    client_stats = []
    for client in clients:
        client_stats.append({
            'id': client.id,
            'name': client.name,
            'is_active': client.is_active,
            'received_bytes': client.total_received,
            'sent_bytes': client.total_sent,
            'last_handshake': client.last_handshake.isoformat() if client.last_handshake else None,
        })

    return jsonify({
        'group_id': group_id,
        'group_name': group.name,
        'total_clients': total_clients,
        'active_clients': active_clients,
        'total_received_bytes': total_received,
        'total_sent_bytes': total_sent,
        'clients': client_stats,
    }), 200


@stats_bp.route('/client/<int:client_id>', methods=['GET'])
@jwt_required()
def get_client_stats(client_id):
    """Get statistics for a specific client."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    client = Client.query.get(client_id)
    if not client:
        return jsonify({'error': 'Client not found'}), 404

    if not user.can_access_group(client.group):
        return jsonify({'error': 'Access denied'}), 403

    # Get recent connection logs
    recent_logs = ConnectionLog.query.filter_by(client_id=client_id).order_by(
        ConnectionLog.recorded_at.desc()
    ).limit(100).all()

    return jsonify({
        'client_id': client_id,
        'client_name': client.name,
        'is_active': client.is_active,
        'total_received_bytes': client.total_received,
        'total_sent_bytes': client.total_sent,
        'last_handshake': client.last_handshake.isoformat() if client.last_handshake else None,
        'connection_logs': [log.to_dict() for log in recent_logs],
    }), 200


@stats_bp.route('/user/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user_stats(user_id):
    """Get statistics for a specific user."""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)

    # Users can only view their own stats unless admin
    if not current_user.is_admin() and current_user_id != user_id:
        return jsonify({'error': 'Access denied'}), 403

    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({'error': 'User not found'}), 404

    # Get all groups owned by or accessible to this user
    owned_groups = Group.query.filter_by(owner_id=user_id).all()
    member_groups = target_user.managed_groups

    all_groups = list(set(owned_groups + member_groups))
    group_ids = [g.id for g in all_groups]

    # Get clients from all accessible groups
    clients = Client.query.filter(Client.group_id.in_(group_ids)).all() if group_ids else []

    total_received = sum(c.total_received for c in clients)
    total_sent = sum(c.total_sent for c in clients)
    active_clients = sum(1 for c in clients if c.is_active)

    # Per-group breakdown
    groups_stats = []
    for group in all_groups:
        group_clients = [c for c in clients if c.group_id == group.id]
        groups_stats.append({
            'id': group.id,
            'name': group.name,
            'is_owner': group.owner_id == user_id,
            'client_count': len(group_clients),
            'active_clients': sum(1 for c in group_clients if c.is_active),
            'received_bytes': sum(c.total_received for c in group_clients),
            'sent_bytes': sum(c.total_sent for c in group_clients),
        })

    return jsonify({
        'user_id': user_id,
        'username': target_user.username,
        'total_groups': len(all_groups),
        'owned_groups': len(owned_groups),
        'member_groups': len(member_groups),
        'total_clients': len(clients),
        'active_clients': active_clients,
        'total_received_bytes': total_received,
        'total_sent_bytes': total_sent,
        'groups': groups_stats,
    }), 200


@stats_bp.route('/system', methods=['GET'])
@admin_required
def get_system_stats():
    """Get system-wide statistics (admin only)."""
    # Total counts
    total_users = User.query.count()
    total_groups = Group.query.count()
    total_clients = Client.query.count()
    active_clients = Client.query.filter_by(is_active=True).count()

    # Traffic totals
    total_received = db.session.query(func.sum(Client.total_received)).scalar() or 0
    total_sent = db.session.query(func.sum(Client.total_sent)).scalar() or 0

    # Per-group statistics
    groups_stats = []
    groups = Group.query.all()
    for group in groups:
        clients = Client.query.filter_by(group_id=group.id).all()
        groups_stats.append({
            'id': group.id,
            'name': group.name,
            'owner': group.owner.username,
            'client_count': len(clients),
            'active_clients': sum(1 for c in clients if c.is_active),
            'received_bytes': sum(c.total_received for c in clients),
            'sent_bytes': sum(c.total_sent for c in clients),
        })

    # Per-user statistics
    users_stats = []
    users = User.query.all()
    for user in users:
        user_groups = Group.query.filter_by(owner_id=user.id).all()
        user_group_ids = [g.id for g in user_groups] + [g.id for g in user.managed_groups]
        user_clients = Client.query.filter(Client.group_id.in_(user_group_ids)).all() if user_group_ids else []
        users_stats.append({
            'id': user.id,
            'username': user.username,
            'role': user.role,
            'group_count': len(set(user_group_ids)),
            'client_count': len(user_clients),
            'received_bytes': sum(c.total_received for c in user_clients),
            'sent_bytes': sum(c.total_sent for c in user_clients),
        })

    # Recent activity (last 24 hours)
    yesterday = datetime.utcnow() - timedelta(hours=24)
    recent_logs_count = ConnectionLog.query.filter(
        ConnectionLog.recorded_at >= yesterday
    ).count()

    return jsonify({
        'total_users': total_users,
        'total_groups': total_groups,
        'total_clients': total_clients,
        'active_clients': active_clients,
        'total_received_bytes': total_received,
        'total_sent_bytes': total_sent,
        'groups': groups_stats,
        'users': users_stats,
        'recent_connections_24h': recent_logs_count,
    }), 200
