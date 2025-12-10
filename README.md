# WireGuard Multi-Client WebUI

A production-ready web-based management interface for WireGuard VPN, featuring multi-user support, group management, and comprehensive security features.

![License](https://img.shields.io/badge/license-GPLv3-blue.svg)
[![Docker Image CI for Main Branch](https://github.com/Arthur2500/wireguard-multiclient-webui/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/Arthur2500/wireguard-multiclient-webui/actions/workflows/docker-publish.yml)

## Screenshots
<img width="1440" height="812" alt="image" src="https://github.com/user-attachments/assets/fc03d12c-e1e3-43cd-9811-ca646ae0b16b" />
<img width="1440" height="809" alt="image" src="https://github.com/user-attachments/assets/41d1d75a-c0cf-451a-befb-0d6f6162a020" />
<img width="1440" height="799" alt="image" src="https://github.com/user-attachments/assets/ea2f0ff8-00f2-4b3f-8ac1-02affc47ca9f" />
<img width="1440" height="809" alt="image" src="https://github.com/user-attachments/assets/fabd8996-8c1d-4c2f-b5e4-5cf2fbef4e5e" />

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
- **Auto-restart on startup**: Groups enabled by default, automatically restart when container/application starts

### 3. Client Management
- Add unlimited clients to each group
- Automatic IP address allocation
- Per-client settings:
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
- **System-Wide Defaults** (Admin only):
  - Default DNS
  - Default port
  - Default MTU
- **Docker-Compatible Auto-Restart**: WireGuard interfaces automatically restart when application starts

### 5. Statistics & Monitoring
- System overview dashboard
- Per-group traffic statistics
- Per-client traffic statistics
- Connection logging

### 6. Security Features
- JWT token authentication with configurable expiration
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Optional preshared key support
- Input validation and sanitization
- Command injection prevention
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- Rate limiting on authentication endpoints
- Health check endpoints for monitoring

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

   **Change the admin password immediately after first login!**

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
| `WG_USE_PRESHARED_KEY` | Use preshared keys for all clients | `false` |
| `STATS_COLLECTION_INTERVAL` | Automatic stats collection interval (seconds). Set to 10 for real-time stats. Increase (e.g., 60 or 300) for systems with many clients to reduce database I/O. | `10` |
| `JWT_ACCESS_TOKEN_EXPIRES_HOURS` | Token expiration | `24` |

### Docker Compose Ports

- **8080**: Web interface (HTTP)
- WireGuard ports are configured per-group

### File Organization

WireGuard configurations are organized by group name for easy management:

**Interface Names:**
- Each group gets a unique WireGuard interface named after the group
- Format: `wg-{sanitized-group-name}` (e.g., "Office VPN" → `wg-office-vpn`)
- Names are automatically sanitized (lowercase, special characters removed, max 15 chars)

**File Structure:**
```
/etc/wireguard/
├── wg-office-vpn.conf              # Server config for "Office VPN" group
├── wg-office-vpn/                  # Client configs for "Office VPN" group
│   ├── wg-office-vpn-laptop.conf
│   ├── wg-office-vpn-phone.conf
│   └── wg-office-vpn-tablet.conf
├── wg-marketing.conf               # Server config for "Marketing" group
└── wg-marketing/                   # Client configs for "Marketing" group
    ├── wg-marketing-john.conf
    └── wg-marketing-jane.conf
```

This organization:
- Makes it easy to identify which interface belongs to which group
- Keeps related client configurations together in group-specific directories
- Allows easy backup/restore of group configurations
- Simplifies troubleshooting and manual configuration management

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
python -m pytest tests/ -v
```

## Documentation

- **[Production Deployment Guide](DEPLOYMENT.md)** - Complete guide for production deployment
- **[Security Best Practices](SECURITY.md)** - Security hardening and best practices
- **[Security Audit Report](SECURITY-AUDIT.md)** - Comprehensive security assessment
- **[FAQ](FAQ.md)** - Frequently Asked Questions
- **[API Documentation](#api-endpoints)** - API endpoint reference below

## Security

This application implements multiple security layers:

- **Authentication**: JWT tokens with bcrypt password hashing
- **Authorization**: Role-based access control
- **Input Validation**: All inputs sanitized and validated
- **Security Headers**: CSP, HSTS, X-Frame-Options, and more
- **Rate Limiting**: Protection against brute force attacks
- **Command Injection Prevention**: Validated interface names and commands

**Important**: Before deploying to production, read [SECURITY.md](SECURITY.md) and follow all recommendations.

### Quick Security Checklist

- [ ] Change default admin password
- [ ] Set secure `SECRET_KEY` and `JWT_SECRET_KEY`
- [ ] Enable HTTPS with valid certificates
- [ ] Configure firewall rules
- [ ] Set up regular backups
- [ ] Review [SECURITY.md](SECURITY.md) completely

## Health Checks

The application provides health check endpoints for monitoring:

- `GET /api/health` - Basic health check
- `GET /api/ready` - Readiness check with database connectivity

Use these endpoints with Docker health checks, load balancers, or monitoring systems.

## API Endpoints

### Health & Monitoring
- `GET /api/health` - Health check
- `GET /api/ready` - Readiness check with DB connectivity

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
│   (Frontend)    │     │   (Optional)    │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   Flask API     │
                        │   + Gunicorn    │
                        └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
           ┌─────────────────┐      ┌─────────────────┐
           │   SQLite/       │      │   WireGuard     │
           │   PostgreSQL    │      │   (wg-quick)    │
           └─────────────────┘      └─────────────────┘
```

## Troubleshooting

### Container Issues

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f backend

# Restart services
docker-compose restart
```

### WireGuard Issues

```bash
# Check interfaces
sudo wg show

# Verify IP forwarding
sysctl net.ipv4.ip_forward

# Check WireGuard module
lsmod | grep wireguard
```

### Database Issues

```bash
# Check file permissions
ls -la data/

# Stop and backup before manual intervention
docker-compose down
cp data/app.db data/app.db.backup
```

For more troubleshooting, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Performance

### Recommended Resources

- **Small Deployment** (< 50 users): 1 CPU, 1GB RAM
- **Medium Deployment** (50-500 users): 2 CPU, 2GB RAM
- **Large Deployment** (500+ users): 4 CPU, 4GB RAM, PostgreSQL

### Optimization Tips

1. Increase `STATS_COLLECTION_INTERVAL` for systems with many clients
2. Use PostgreSQL instead of SQLite for > 100 concurrent users
3. Increase Gunicorn workers for high traffic
4. Enable nginx caching for static assets

See [DEPLOYMENT.md](DEPLOYMENT.md) for scaling details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code follows the existing style and includes appropriate tests.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Security

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Create an issue with **[SECURITY]** in the title
3. See [SECURITY.md](SECURITY.md) for full security policy

## Acknowledgments

- [WireGuard](https://www.wireguard.com/) - Fast, modern, secure VPN tunnel
- Built with Flask, React, and Docker
- Inspired by the need for secure, multi-tenant VPN management

## Support

- **Documentation**: [README.md](README.md), [SECURITY.md](SECURITY.md), [DEPLOYMENT.md](DEPLOYMENT.md), [FAQ.md](FAQ.md)
- **Issues**: [GitHub Issues](https://github.com/Arthur2500/wireguard-multiclient-webui/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Arthur2500/wireguard-multiclient-webui/discussions)
- **FAQ**: See [FAQ.md](FAQ.md) for common questions

---

**Made for the WireGuard community**
