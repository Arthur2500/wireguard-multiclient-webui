import logging
import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from config import config_by_name

db = SQLAlchemy()
bcrypt = Bcrypt()
jwt = JWTManager()


def create_app(config_name=None):
    """Application factory."""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')

    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    _configure_logging(app)

    # Initialize extensions
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    CORS(app)

    # Register blueprints
    from app.routes.auth import auth_bp, limiter as auth_limiter
    from app.routes.users import users_bp
    from app.routes.groups import groups_bp
    from app.routes.clients import clients_bp
    from app.routes.stats import stats_bp
    from app.routes.settings import settings_bp

    # Initialize limiter for auth routes
    auth_limiter.init_app(app)

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(groups_bp, url_prefix='/api/groups')
    app.register_blueprint(clients_bp, url_prefix='/api/clients')
    app.register_blueprint(stats_bp, url_prefix='/api/stats')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')

    # Create database tables
    with app.app_context():
        db.create_all()
        
        # Add is_active column to groups table if it doesn't exist (for existing databases)
        _migrate_groups_table(app)

        # Create default admin user if not exists
        from app.models.user import User
        if not User.query.filter_by(username='admin').first():
            # Generate a secure random password for initial setup
            default_password = os.environ.get('ADMIN_PASSWORD', 'admin')
            admin = User(
                username='admin',
                email='admin@example.com',
                role='admin'
            )
            admin.set_password(default_password)
            db.session.add(admin)
            db.session.commit()
            if default_password == 'admin':
                app.logger.warning("Using default admin password 'admin'. Change it immediately!")
                app.logger.warning("Set ADMIN_PASSWORD environment variable to customize the initial password.")

        # Restart all WireGuard interfaces that should be running
        # This ensures interfaces come back up when the container/application restarts
        _restart_wireguard_interfaces(app)

        # Initialize background scheduler for statistics collection
        from app.scheduler import init_scheduler
        scheduler = init_scheduler(app)
        if scheduler:
            # Store scheduler instance for potential shutdown
            app.scheduler = scheduler

    return app


def _migrate_groups_table(app):
    """Add is_active column to groups table if it doesn't exist.
    
    This is a helper for existing databases that don't have the is_active column.
    """
    try:
        # Try to query with is_active to check if column exists
        from app.models.group import Group
        db.session.query(Group.is_active).first()
        app.logger.debug("groups.is_active column already exists")
    except Exception:
        # Column doesn't exist, add it
        app.logger.info("Adding is_active column to groups table...")
        try:
            with db.engine.connect() as conn:
                conn.execute(db.text("ALTER TABLE groups ADD COLUMN is_active BOOLEAN DEFAULT 1"))
                conn.commit()
            app.logger.info("Successfully added is_active column to groups table")
        except Exception as e:
            app.logger.error(f"Failed to add is_active column to groups table: {e}")


def _restart_wireguard_interfaces(app):
    """Restart all WireGuard interfaces marked as running.

    This function is called on application startup to ensure that all
    WireGuard interfaces that should be running are restarted. This provides
    automatic recovery after container/application restarts.
    """
    try:
        from app.models.group import Group

        # Find all groups that should be running
        running_groups = Group.query.filter_by(is_running=True).all()

        if running_groups:
            app.logger.info(f"Restarting {len(running_groups)} WireGuard interface(s) on startup...")

            for group in running_groups:
                try:
                    # Start the interface
                    success = group.start_wireguard()
                    if success:
                        app.logger.info(f"Started WireGuard interface {group.get_wireguard_interface_name()} for group '{group.name}'")
                    else:
                        app.logger.warning(f"Failed to start WireGuard interface for group '{group.name}'")
                except Exception as e:
                    app.logger.error(f"Error starting WireGuard interface for group '{group.name}': {e}")
        else:
            app.logger.debug("No WireGuard interfaces to restart on startup")

    except Exception as e:
        # Don't fail startup if WireGuard restart fails
        app.logger.error(f"Error during WireGuard interface restart: {e}", exc_info=True)


def _configure_logging(app):
    """Configure basic structured logging to stdout."""
    log_level = app.config.get('LOG_LEVEL', 'INFO').upper()

    # Avoid adding duplicate handlers if the app factory is called multiple times (e.g., tests)
    if app.logger.handlers:
        app.logger.setLevel(log_level)
        return

    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        fmt='%(asctime)s %(levelname)s %(name)s %(message)s',
        datefmt='%Y-%m-%dT%H:%M:%SZ'
    )
    handler.setFormatter(formatter)

    app.logger.addHandler(handler)
    app.logger.setLevel(log_level)

    # Align werkzeug (request logs) with app logging level
    logging.getLogger('werkzeug').setLevel(log_level)
