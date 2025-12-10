# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Security Hardening & Production Readiness (December 2024)

#### Added
- **Security Features**:
  - Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy)
  - Command injection prevention with interface name validation
  - Input sanitization helpers for filenames and interface names
  - Health check endpoints (`/api/health`, `/api/ready`)
  - Docker health checks in containers
  
- **Code Quality**:
  - Helper function for date parsing (eliminates duplicate code)
  - Input sanitization functions
  - Interface name validation with regex
  
- **Documentation**:
  - SECURITY.md - Comprehensive security best practices guide
  - DEPLOYMENT.md - Production deployment guide
  - SECURITY-AUDIT.md - Security audit report
  - FAQ.md - Frequently Asked Questions
  - Enhanced README with better organization and troubleshooting

#### Changed
- Updated gunicorn to ≥22.0.0 (fixes HTTP Request/Response Smuggling vulnerability)
- Pinned all Python dependencies with minimum versions
- Improved README structure with emojis and better sections
- Enhanced error handling in WireGuard utility functions
- Improved Docker compose with health checks and proper dependencies

#### Security
- ✅ Fixed: Gunicorn HTTP Request/Response Smuggling vulnerability (updated to v22.0.0)
- ✅ Verified: Zero CodeQL security vulnerabilities
- ✅ Added: Command injection prevention in subprocess calls
- ✅ Added: Comprehensive input validation and sanitization
- ✅ Added: Security headers on all responses
- ✅ Added: Interface name validation (regex: `^[a-z0-9\-]{1,15}$`)

### Architecture Simplification

#### Changed
- **Simplified Architecture**: Removed all peer-to-peer communication features to make this a simple wg-quick wrapper
- **Auto-Start Groups**: Groups now default to `is_running=True` and are automatically started on creation
- **Docker-Compatible Auto-Restart**: WireGuard interfaces automatically restart when application/container starts (replaces systemd integration)
- **Server Config Location**: Server configurations are now properly saved in the group-specific directory

#### Removed
- Removed `can_address_peers` field from Client model
- Removed `allow_client_to_client` field from Group model
- Removed complex peer-to-peer iptables rules from server configuration generation
- Removed peer-communication options from frontend UI (GroupForm and ClientForm)
- Removed peer-communication toggles from group and client display components

### Technical Details
- Groups are created with `is_running=True` by default for immediate availability
- On application startup, all groups with `is_running=True` are automatically restarted
- This works in Docker containers (no systemd required) and provides absolute reliability
- Server configuration files are stored as `/etc/wireguard/wg{id}.conf` (e.g., `wg1.conf`, `wg2.conf`)
- Client configuration files are stored as `/etc/wireguard/wg{id}-{client-name}.conf` (e.g., `wg1-laptop.conf`)
- Config files are created with secure permissions (0600) to prevent "world accessible" warnings
- Uses standard wg-quick interface naming for proper compatibility

### Migration Notes
- **No database migration needed**: The database is always rebuilt from scratch
- Old columns (`can_address_peers`, `allow_client_to_client`) are ignored if present
- Existing deployments should delete their database and let it be recreated

### Breaking Changes
- API no longer accepts `allow_client_to_client` parameter in group creation/update
- API no longer accepts `can_address_peers` parameter in client creation/update
- Frontend interfaces updated to remove peer-communication controls
