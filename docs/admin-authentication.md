# Admin Authentication Guide

## Overview

The UCSD WebReg Export app includes secure admin endpoints for managing quarter data. These endpoints are protected by a comprehensive authentication system designed with security best practices.

## Security Features

### 🔐 Token-Based Authentication
- **Secure Token Generation**: Cryptographically secure 256-bit tokens
- **Timing-Safe Comparison**: Prevents timing attacks
- **No Hardcoded Defaults**: Requires explicit configuration

### 🛡️ Additional Protections
- **Rate Limiting**: 10 requests per 15 minutes per IP
- **IP Whitelisting**: Optional restriction by IP address
- **Security Headers**: Prevents common web vulnerabilities
- **Audit Logging**: All admin access attempts are logged
- **Request Delays**: Artificial delays on failed attempts

## Setup Instructions

### 1. Generate an Admin Token

Run the token generator script:
```bash
node scripts/generate-admin-token.js
```

This will output a secure token like:
```
Generated secure admin token:
  Kg7Xh9mPqR3tUv5wYz2aBc4dEf6gHj8kLn0pQs1rTu2v

✅ Token meets all security requirements
```

### 2. Configure Environment

Create a `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

Add your generated token:
```env
ADMIN_TOKEN=Kg7Xh9mPqR3tUv5wYz2aBc4dEf6gHj8kLn0pQs1rTu2v
```

### 3. Optional: IP Whitelisting

For additional security, restrict admin access by IP:
```env
ADMIN_IP_WHITELIST=203.0.113.1,203.0.113.2
```

## Using Admin Endpoints

### Authentication Header

Include the token in your requests:
```http
Authorization: Bearer YOUR_ADMIN_TOKEN
```

### Example: Update Quarters

```bash
curl -X POST http://localhost:3000/api/update-quarters \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

### Response
```json
{
  "success": true,
  "message": "Quarters updated successfully",
  "quartersCount": 10,
  "duration": "2341ms"
}
```

## Security Best Practices

### ✅ DO
- Generate unique tokens for each environment
- Rotate tokens regularly (monthly recommended)
- Use environment variables or secure key management
- Monitor admin access logs
- Use HTTPS in production
- Implement IP whitelisting for production

### ❌ DON'T
- Commit tokens to version control
- Share tokens between environments
- Use weak or guessable tokens
- Disable security features
- Log tokens in plaintext

## Troubleshooting

### "Unauthorized" Error
1. Check token is set in environment: `echo $ADMIN_TOKEN`
2. Verify Bearer prefix in header
3. Ensure token meets 32+ character requirement

### "Too many requests" Error
- Wait 15 minutes for rate limit to reset
- Check if multiple services are using same IP

### "Forbidden" Error
- Verify your IP is whitelisted (if enabled)
- Check `ADMIN_IP_WHITELIST` configuration

## Monitoring

### Access Logs

Successful admin access:
```
[ADMIN ACCESS] {"timestamp":"2025-01-07T10:30:00Z","success":true,"reason":"Authentication successful","ip":"::1","endpoint":"/api/update-quarters","method":"POST"}
```

Failed attempts:
```
[ADMIN ACCESS DENIED] {"timestamp":"2025-01-07T10:30:00Z","success":false,"reason":"Invalid token","ip":"192.168.1.100","endpoint":"/api/update-quarters","method":"POST"}
```

### Security Alerts

The system will warn on startup if:
- No admin token is configured
- Token doesn't meet security requirements
- Security configuration issues detected

## Architecture

```
┌─────────────────┐
│   API Request   │
└────────┬────────┘
         │
┌────────▼────────┐
│ Security Headers│ ← Prevents XSS, Clickjacking
└────────┬────────┘
         │
┌────────▼────────┐
│  Rate Limiting  │ ← 10 req/15min per IP
└────────┬────────┘
         │
┌────────▼────────┐
│ Token Auth Check│ ← Timing-safe comparison
└────────┬────────┘
         │
┌────────▼────────┐
│  IP Whitelist   │ ← Optional extra security
└────────┬────────┘
         │
┌────────▼────────┐
│  Audit Logging  │ ← All attempts logged
└────────┬────────┘
         │
┌────────▼────────┐
│ Admin Endpoint  │
└─────────────────┘
```

## Token Rotation

### Manual Rotation
1. Generate new token: `node scripts/generate-admin-token.js`
2. Update `.env` file
3. Restart application
4. Update all API clients

### Automated Rotation (Future)
Consider implementing automated token rotation with:
- Multiple valid tokens during transition
- Gradual token expiration
- Notification system for rotation events