from app.routes.auth import auth_bp
from app.routes.users import users_bp
from app.routes.groups import groups_bp
from app.routes.clients import clients_bp
from app.routes.stats import stats_bp
from app.routes.settings import settings_bp

__all__ = ['auth_bp', 'users_bp', 'groups_bp', 'clients_bp', 'stats_bp', 'settings_bp']
