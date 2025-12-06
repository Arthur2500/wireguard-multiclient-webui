import logging
import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from config import config_by_name

db = SQLAlchemy()
bcrypt = Bcrypt()
jwt = JWTManager()
limiter = Limiter(key_func=get_remote_address, default_limits=["200 per day", "50 per hour"])


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
    limiter.init_app(app)
    CORS(app)

    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.users import users_bp
    from app.routes.groups import groups_bp
    from app.routes.clients import clients_bp
    from app.routes.stats import stats_bp
    from app.routes.settings import settings_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(groups_bp, url_prefix='/api/groups')
    app.register_blueprint(clients_bp, url_prefix='/api/clients')
    app.register_blueprint(stats_bp, url_prefix='/api/stats')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')

    # Create database tables
    with app.app_context():
        db.create_all()

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

    return app


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
