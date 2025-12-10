"""Background scheduler for periodic tasks."""
import logging
from datetime import datetime
from functools import partial
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)


def collect_traffic_stats(app):
    """Collect traffic statistics from all clients."""
    with app.app_context():
        try:
            from app.models.client import Client
            from app.models.group import Group
            from app.models.stats import TrafficHistory
            from app import db
            
            # First, update client stats from WireGuard for all running groups
            running_groups = Group.query.filter_by(is_running=True).all()
            for group in running_groups:
                try:
                    group.update_client_stats()
                except Exception as e:
                    logger.error(f"Error updating stats for group {group.name}: {e}")
            
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
            
            logger.debug(f"Collected traffic stats for {len(clients)} clients, {len(groups_data)} groups")
            
        except Exception as e:
            logger.error(f"Error collecting traffic stats: {e}", exc_info=True)


def init_scheduler(app):
    """Initialize the background scheduler for periodic tasks."""
    interval = app.config.get('STATS_COLLECTION_INTERVAL', 300)
    
    if interval <= 0:
        logger.info("Stats collection scheduler disabled (interval <= 0)")
        return None
    
    scheduler = BackgroundScheduler(daemon=True)
    
    # Add traffic collection job
    scheduler.add_job(
        func=partial(collect_traffic_stats, app),
        trigger=IntervalTrigger(seconds=interval),
        id='collect_traffic_stats',
        name='Collect traffic statistics',
        replace_existing=True
    )
    
    scheduler.start()
    logger.info(f"Stats collection scheduler started (interval: {interval}s)")
    
    return scheduler
