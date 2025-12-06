from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from datetime import datetime, timedelta
from app.models.user import User
from app.models.group import Group
from app.models.client import Client
from app.models.stats import ConnectionLog, TrafficHistory
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

    # Per-client statistics
    clients_stats = []
    clients = Client.query.all()
    for client in clients:
        clients_stats.append({
            'id': client.id,
            'name': client.name,
            'group_name': client.group.name,
            'is_active': client.is_active,
            'received_bytes': client.total_received,
            'sent_bytes': client.total_sent,
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
        'clients': clients_stats,
        'recent_connections_24h': recent_logs_count,
    }), 200


def get_time_range(range_param):
    """Get start time based on range parameter."""
    now = datetime.utcnow()
    if range_param == '1h':
        return now - timedelta(hours=1)
    elif range_param == '1d':
        return now - timedelta(days=1)
    elif range_param == '1w':
        return now - timedelta(weeks=1)
    else:
        return now - timedelta(hours=1)  # Default to 1 hour


@stats_bp.route('/traffic/total', methods=['GET'])
@admin_required
def get_total_traffic_history():
    """Get total system traffic history (admin only)."""
    range_param = request.args.get('range', '1h')
    start_time = get_time_range(range_param)

    # Get traffic history where both client_id and group_id are null (system-wide)
    history = TrafficHistory.query.filter(
        TrafficHistory.recorded_at >= start_time,
        TrafficHistory.client_id.is_(None),
        TrafficHistory.group_id.is_(None)
    ).order_by(TrafficHistory.recorded_at.asc()).all()

    return jsonify({
        'range': range_param,
        'data': [h.to_dict() for h in history]
    }), 200


@stats_bp.route('/traffic/groups', methods=['GET'])
@admin_required
def get_groups_traffic_history():
    """Get traffic history per group (admin only)."""
    range_param = request.args.get('range', '1h')
    start_time = get_time_range(range_param)

    # Get all groups
    groups = Group.query.all()

    result = []
    for group in groups:
        history = TrafficHistory.query.filter(
            TrafficHistory.recorded_at >= start_time,
            TrafficHistory.group_id == group.id,
            TrafficHistory.client_id.is_(None)
        ).order_by(TrafficHistory.recorded_at.asc()).all()

        result.append({
            'group_id': group.id,
            'group_name': group.name,
            'data': [h.to_dict() for h in history]
        })

    return jsonify({
        'range': range_param,
        'groups': result
    }), 200


@stats_bp.route('/traffic/clients', methods=['GET'])
@admin_required
def get_clients_traffic_history():
    """Get traffic history per client (admin only)."""
    range_param = request.args.get('range', '1h')
    start_time = get_time_range(range_param)

    # Get all clients
    clients = Client.query.all()

    result = []
    for client in clients:
        history = TrafficHistory.query.filter(
            TrafficHistory.recorded_at >= start_time,
            TrafficHistory.client_id == client.id
        ).order_by(TrafficHistory.recorded_at.asc()).all()

        result.append({
            'client_id': client.id,
            'client_name': client.name,
            'group_id': client.group_id,
            'data': [h.to_dict() for h in history]
        })

    return jsonify({
        'range': range_param,
        'clients': result
    }), 200


@stats_bp.route('/traffic/group/<int:group_id>', methods=['GET'])
@jwt_required()
def get_group_traffic_history(group_id):
    """Get traffic history for a specific group."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    if not user.can_access_group(group):
        return jsonify({'error': 'Access denied'}), 403

    range_param = request.args.get('range', '1h')
    start_time = get_time_range(range_param)

    # Get group total traffic history
    group_history = TrafficHistory.query.filter(
        TrafficHistory.recorded_at >= start_time,
        TrafficHistory.group_id == group_id,
        TrafficHistory.client_id.is_(None)
    ).order_by(TrafficHistory.recorded_at.asc()).all()

    # Get per-client traffic history
    clients = Client.query.filter_by(group_id=group_id).all()
    clients_data = []
    for client in clients:
        history = TrafficHistory.query.filter(
            TrafficHistory.recorded_at >= start_time,
            TrafficHistory.client_id == client.id
        ).order_by(TrafficHistory.recorded_at.asc()).all()

        clients_data.append({
            'client_id': client.id,
            'client_name': client.name,
            'data': [h.to_dict() for h in history]
        })

    return jsonify({
        'range': range_param,
        'group_id': group_id,
        'group_name': group.name,
        'group_data': [h.to_dict() for h in group_history],
        'clients': clients_data
    }), 200


@stats_bp.route('/traffic/record', methods=['POST'])
@admin_required
def record_traffic():
    """Record traffic data (for background task or external collector)."""
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    records = data.get('records', [])

    for record in records:
        history = TrafficHistory(
            client_id=record.get('client_id'),
            group_id=record.get('group_id'),
            received_bytes=record.get('received_bytes', 0),
            sent_bytes=record.get('sent_bytes', 0),
            recorded_at=datetime.utcnow()
        )
        db.session.add(history)

    db.session.commit()

    return jsonify({'message': f'Recorded {len(records)} traffic entries'}), 201


@stats_bp.route('/traffic/collect', methods=['POST'])
@admin_required
def collect_traffic():
    """Collect current traffic stats from all clients and record them."""
    now = datetime.utcnow()

    # Get all clients and their current traffic
    clients = Client.query.all()
    groups_data = {}
    total_received = 0
    total_sent = 0

    for client in clients:
        # Record client traffic (absolute values)
        client_history = TrafficHistory(
            client_id=client.id,
            group_id=client.group_id,
            received_bytes=client.total_received,
            sent_bytes=client.total_sent,
            recorded_at=now
        )
        db.session.add(client_history)

        # Aggregate for group
        if client.group_id not in groups_data:
            groups_data[client.group_id] = {'received': 0, 'sent': 0}
        groups_data[client.group_id]['received'] += client.total_received
        groups_data[client.group_id]['sent'] += client.total_sent

        total_received += client.total_received
        total_sent += client.total_sent

    # Record group totals
    for group_id, data in groups_data.items():
        group_history = TrafficHistory(
            client_id=None,
            group_id=group_id,
            received_bytes=data['received'],
            sent_bytes=data['sent'],
            recorded_at=now
        )
        db.session.add(group_history)

    # Record system total
    total_history = TrafficHistory(
        client_id=None,
        group_id=None,
        received_bytes=total_received,
        sent_bytes=total_sent,
        recorded_at=now
    )
    db.session.add(total_history)

    db.session.commit()

    return jsonify({
        'message': 'Traffic collected successfully',
        'clients_count': len(clients),
        'groups_count': len(groups_data)
    }), 200


@stats_bp.route('/traffic/cleanup', methods=['POST'])
@admin_required
def cleanup_traffic_history():
    """Clean up old traffic history data (older than 1 week)."""
    cutoff = datetime.utcnow() - timedelta(weeks=1)

    deleted = TrafficHistory.query.filter(
        TrafficHistory.recorded_at < cutoff
    ).delete()

    db.session.commit()

    return jsonify({
        'message': f'Deleted {deleted} old traffic records'
    }), 200
