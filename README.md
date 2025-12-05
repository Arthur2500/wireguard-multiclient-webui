# WireGuard Multi-Client WebUI

A comprehensive web-based management interface for WireGuard VPN, featuring multi-user support, group management, and client-to-client communication controls.

![License](https://img.shields.io/badge/license-GPLv3-blue.svg)

## Features

### 1. Account Management System
- **Admin Role**: Full system access, user management, global settings
- **User Role**: Manage own groups and clients
- Secure password hashing with bcrypt
- JWT-based authentication

### 2. Group Management
- Create multiple WireGuard configurations (groups)
- Each group has its own IP range
- Assign group access to users
- Per-group configuration settings

### 3. Client Management
- Add unlimited clients to each group
- Automatic IP address allocation
- Per-client settings:
  - Enable/disable client-to-client communication
  - Custom DNS override
  - Custom allowed IPs
- One-click configuration download
- QR code generation (coming soon)

### 4. WireGuard Configuration
- **Per-Group Settings**:
  - IP range (CIDR notation)
  - Listen port
  - DNS servers
  - MTU
  - Persistent keepalive
  - Client-to-client toggle
- **System-Wide Defaults** (Admin only):
  - Default DNS
  - Default port
  - Default MTU

### 5. Statistics & Monitoring
- System overview dashboard
- Per-group traffic statistics
- Per-client traffic statistics
- Connection logging

### 6. Security Features
- JWT token authentication
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Preshared key support for clients
- Input validation

## Quick Start with Docker

### Prerequisites
- Docker and Docker Compose
- Linux host with WireGuard kernel module

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Arthur2500/wireguard-multiclient-webui.git
cd wireguard-multiclient-webui
```

2. Create environment file:
```bash
cp .env.example .env
# Edit .env and set secure values for SECRET_KEY and JWT_SECRET_KEY
```

3. Start the containers:
```bash
docker-compose up -d
```

4. Access the web interface at `http://localhost:8080`

5. Login with default credentials:
   - Username: `admin`
   - Password: `admin`
   
   **⚠️ Change the admin password immediately after first login!**

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Flask secret key | (required) |
| `JWT_SECRET_KEY` | JWT signing key | (required) |
| `DATABASE_URL` | Database connection string | `sqlite:////data/app.db` |
| `WG_CONFIG_PATH` | WireGuard config directory | `/etc/wireguard` |
| `WG_DEFAULT_DNS` | Default DNS servers | `1.1.1.1, 8.8.8.8` |
| `WG_DEFAULT_PORT` | Default listen port | `51820` |
| `JWT_ACCESS_TOKEN_EXPIRES_HOURS` | Token expiration | `24` |

### Docker Compose Ports

- **8080**: Web interface (HTTP)
- WireGuard ports are configured per-group

## Development Setup

### Backend (Flask)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
python run.py
```

### Frontend (React)

```bash
cd frontend
npm install
npm start
```

### Running Tests

```bash
cd backend
pytest tests/ -v
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Groups
- `GET /api/groups` - List accessible groups
- `POST /api/groups` - Create group
- `GET /api/groups/:id` - Get group details
- `PUT /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group
- `GET /api/groups/:id/config` - Get server config

### Clients
- `GET /api/clients/group/:id` - List clients in group
- `POST /api/clients/group/:id` - Create client
- `GET /api/clients/:id` - Get client details
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client
- `GET /api/clients/:id/config` - Get client config

### Statistics
- `GET /api/stats/overview` - System overview
- `GET /api/stats/group/:id` - Group statistics
- `GET /api/stats/client/:id` - Client statistics
- `GET /api/stats/system` - System-wide stats (Admin)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   React SPA     │────▶│   Nginx Proxy   │
│   (Frontend)    │     │                 │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   Flask API     │
                        │   (Backend)     │
                        └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
           ┌─────────────────┐      ┌─────────────────┐
           │   SQLite DB     │      │   WireGuard     │
           │                 │      │   Configs       │
           └─────────────────┘      └─────────────────┘
```

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

If you discover a security vulnerability, please report it privately by opening an issue with "[SECURITY]" in the title.