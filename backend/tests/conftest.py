import pytest
from app import create_app, db, limiter
from app.models.user import User


@pytest.fixture
def app():
    """Create application for testing."""
    app = create_app('testing')
    
    # Disable rate limiting for tests
    limiter.enabled = False
    
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Test client."""
    return app.test_client()


@pytest.fixture
def auth_headers(client):
    """Get auth headers with admin token."""
    # Login as admin
    response = client.post('/api/auth/login', json={
        'username': 'admin',
        'password': 'admin'
    })
    token = response.get_json()['access_token']
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture
def user_headers(client, auth_headers):
    """Create a regular user and get auth headers."""
    # Create a regular user
    client.post('/api/users', json={
        'username': 'testuser',
        'email': 'test@example.com',
        'password': 'testpassword123',
        'role': 'user'
    }, headers=auth_headers)
    
    # Login as the user
    response = client.post('/api/auth/login', json={
        'username': 'testuser',
        'password': 'testpassword123'
    })
    token = response.get_json()['access_token']
    return {'Authorization': f'Bearer {token}'}
