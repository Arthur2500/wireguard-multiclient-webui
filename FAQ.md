# Frequently Asked Questions (FAQ)

## General Questions

### What is WireGuard Multi-Client WebUI?

WireGuard Multi-Client WebUI is a web-based management interface for WireGuard VPN that allows you to:
- Manage multiple WireGuard networks (groups)
- Create and manage unlimited VPN clients
- Monitor traffic statistics
- Support multiple users with role-based access control

### Is this production-ready?

Yes! The application has been security-hardened and is ready for production deployment. See [SECURITY-AUDIT.md](SECURITY-AUDIT.md) for the complete security assessment.

### Can I use this for personal use?

Absolutely! The application works great for both personal and enterprise use.

## Installation & Setup

### What are the minimum requirements?

- Docker and Docker Compose
- Linux host with kernel ≥5.6 (for WireGuard)
- 1GB RAM, 1 CPU core (for small deployments)
- 20GB disk space

### Do I need to know WireGuard to use this?

No! The application provides a user-friendly interface that handles all WireGuard configuration for you. However, basic VPN knowledge is helpful.

### Can I run this without Docker?

While Docker is recommended, you can run the application directly with Python and Node.js. See the Development Setup section in [README.md](README.md).

### How do I change the default admin password?

1. Log in with username `admin` and password `admin`
2. Go to your profile settings
3. Change password to a strong, unique password

Alternatively, set `ADMIN_PASSWORD` environment variable before first startup.

### Can I use a custom domain?

Yes! Configure a reverse proxy (nginx, Caddy, or Traefik) with SSL certificates. See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## Configuration

### What database should I use?

- **SQLite** (default): Good for small to medium deployments (<100 users)
- **PostgreSQL**: Recommended for large deployments (>100 users)
- **MySQL/MariaDB**: Also supported via SQLAlchemy

### How do I configure HTTPS?

Use a reverse proxy with SSL certificates:
1. Install nginx and certbot
2. Configure nginx to proxy to the application
3. Obtain SSL certificate from Let's Encrypt
4. See [DEPLOYMENT.md](DEPLOYMENT.md) for complete guide

### Can I change the web interface port?

Yes! Edit `docker-compose.yml` and change the port mapping:
```yaml
ports:
  - "8080:80"  # Change 8080 to your preferred port
```

### How do I add more WireGuard ports?

Each group (network) uses a separate UDP port. Add port mappings in `docker-compose.yml`:
```yaml
ports:
  - "51820:51820/udp"
  - "51821:51821/udp"
  - "51822:51822/udp"
```

## Usage

### How many groups can I create?

Unlimited! Each group represents a separate WireGuard network with its own configuration and clients.

### How many clients can I add?

Unlimited! However, performance depends on your server resources. For large deployments (1000+ clients), see the scaling section in [DEPLOYMENT.md](DEPLOYMENT.md).

### Can I assign the same user to multiple groups?

Yes! Users can be members of multiple groups and manage clients in each group they have access to.

### How do I download client configurations?

1. Navigate to the client details page
2. Click "Download Configuration"
3. Transfer the `.conf` file to your device
4. Import into WireGuard client app

### Can clients have custom DNS servers?

Yes! You can set custom DNS servers:
- Per-group (applies to all clients in the group)
- Per-client (overrides group DNS for specific client)

### What is the allowed IPs field?

The "Allowed IPs" field determines which traffic is routed through the VPN:
- `0.0.0.0/0` - All traffic (full tunnel)
- `10.0.0.0/8` - Only private network traffic
- `192.168.1.0/24` - Specific subnet

## Security

### Is this secure?

Yes! The application implements:
- JWT authentication with bcrypt password hashing
- Role-based access control
- Input validation and sanitization
- Security headers (CSP, HSTS, etc.)
- Rate limiting on authentication
- Regular security updates

See [SECURITY.md](SECURITY.md) and [SECURITY-AUDIT.md](SECURITY-AUDIT.md) for details.

### Should I use preshared keys?

Preshared keys provide an additional layer of security (quantum-resistant). Enable by setting:
```bash
WG_USE_PRESHARED_KEY=true
```

### How often should I rotate keys?

WireGuard keys don't expire, but you may want to rotate them periodically for security:
- Client keys: Every 6-12 months
- Server keys: When security policy requires
- Use the "Regenerate Keys" feature in the UI

### Can I use this with existing WireGuard configurations?

This application manages WireGuard through its own database. Importing existing configs is not currently supported, but you can manually recreate them in the UI.

## Monitoring & Statistics

### How accurate are the traffic statistics?

Statistics are collected from WireGuard interfaces at intervals defined by `STATS_COLLECTION_INTERVAL` (default: 10 seconds). They are accurate within this interval.

### Can I export statistics?

Currently, statistics are stored in the database. You can query the database directly or use the API to export data.

### What are health check endpoints?

Health check endpoints allow monitoring systems to verify the application is running:
- `/api/health` - Basic health check
- `/api/ready` - Database connectivity check

## Performance & Scaling

### How many users can this support?

It depends on your server resources:
- **Small** (<50 users): 1 CPU, 1GB RAM
- **Medium** (50-500 users): 2 CPU, 2GB RAM
- **Large** (500+ users): 4 CPU, 4GB RAM with PostgreSQL

### How do I optimize for many clients?

1. Increase `STATS_COLLECTION_INTERVAL` to reduce database I/O
2. Use PostgreSQL instead of SQLite
3. Increase Gunicorn workers
4. Use faster storage (SSD)

See [DEPLOYMENT.md](DEPLOYMENT.md) for scaling details.

### Can I run multiple instances?

The application uses SQLite by default, which doesn't support multiple instances. For load balancing:
1. Use PostgreSQL database
2. Set up a load balancer
3. Ensure session persistence via JWT tokens

## Backup & Recovery

### How do I backup my data?

Backup these items:
1. Database: `data/app.db`
2. WireGuard configs: `wireguard/` directory
3. Environment file: `.env`

See [DEPLOYMENT.md](DEPLOYMENT.md) for automated backup scripts.

### How do I restore from backup?

1. Stop the application
2. Replace database and configs with backup copies
3. Restart the application

### What happens if I lose the database?

You'll lose:
- User accounts and passwords
- Group configurations
- Client assignments

WireGuard configs are separate files and won't be lost, but you'll need to recreate the database entries manually.

## Troubleshooting

### The web interface won't load

1. Check container status: `docker-compose ps`
2. Check logs: `docker-compose logs -f`
3. Verify firewall allows port 8080
4. Check if port is already in use: `netstat -tulpn | grep 8080`

### WireGuard interface won't start

1. Check WireGuard module: `lsmod | grep wireguard`
2. Verify IP forwarding: `sysctl net.ipv4.ip_forward`
3. Check container logs: `docker-compose logs backend`
4. Verify config syntax: `wg show`

### Clients can't connect

1. Verify server firewall allows WireGuard port (UDP)
2. Check client configuration has correct endpoint
3. Verify group is enabled in the UI
4. Check server logs for errors

### Database is locked

1. Stop the application: `docker-compose down`
2. Check for file locks: `lsof data/app.db`
3. Restart: `docker-compose up -d`

For more troubleshooting, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Updates & Maintenance

### How do I update the application?

```bash
cd /opt/wireguard-multiclient-webui
git pull
docker-compose pull
docker-compose up -d
```

Always backup before updating!

### How often should I update?

- **Security updates**: Immediately
- **Feature updates**: When needed
- **System updates**: Monthly

### Will updates break my configuration?

Configuration is stored in the database and environment files, which are not affected by updates. Always backup before updating.

## Contributing

### Can I contribute to this project?

Yes! Contributions are welcome. See the Contributing section in [README.md](README.md).

### I found a bug, what should I do?

1. Check if it's already reported in GitHub Issues
2. If not, create a new issue with:
   - Description of the bug
   - Steps to reproduce
   - Your environment details
   - Logs (if available)

### I have a security concern

Please report security issues privately:
1. Create an issue with **[SECURITY]** in the title
2. Do not disclose details publicly
3. See [SECURITY.md](SECURITY.md) for full policy

## Support

### Where can I get help?

- **Documentation**: README.md, SECURITY.md, DEPLOYMENT.md
- **GitHub Issues**: Report bugs and request features
- **GitHub Discussions**: Ask questions and share experiences

### Is there commercial support?

Currently, this is a community-supported project. Commercial support may be available in the future.

## License

### Can I use this commercially?

Yes! This project is licensed under GPLv3, which allows commercial use with certain requirements. See [LICENSE](LICENSE) for details.

### Can I modify the code?

Yes! GPLv3 allows modifications, but you must:
- Keep the same license
- Make your changes available
- Credit the original authors

---

**Didn't find your question?** Ask on [GitHub Discussions](https://github.com/Arthur2500/wireguard-multiclient-webui/discussions)
