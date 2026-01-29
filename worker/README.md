# FUN Profile API Gateway

Cloudflare Worker API Gateway với JWT verification bằng JWKS (Big Tech Style) và OAuth 2.0/OIDC Identity Provider.

## 🏗️ Kiến trúc

```
Frontend (React)
    │
    │ Authorization: Bearer <JWT>
    ▼
Cloudflare Worker (API Gateway + OAuth IdP)
    │
    ├── 1. Verify JWT bằng JWKS (jose library)
    │      └── JWKS URL: ${SUPABASE_URL}/auth/v1/.well-known/jwks.json
    │      └── Issuer: ${SUPABASE_URL}/auth/v1
    │      └── userId = payload.sub
    │
    ├── 2. Call Supabase REST API với Service Role Key
    │
    ├── 3. OAuth 2.0/OIDC Endpoints
    │      └── /.well-known/openid-configuration
    │      └── /.well-known/jwks.json
    │      └── /oauth/authorize
    │      └── /oauth/token
    │      └── /oauth/userinfo
    │
    └── 4. Return response
```

## 🔐 Security Features

- **JWKS Verification**: JWT được verify locally bằng public key, không cần gọi Supabase Auth mỗi request
- **CORS Whitelist**: Chỉ cho phép origins trong `ALLOWED_ORIGINS`
- **Input Validation**: Allowlist fields cho profile update, blocklist fields bảo vệ
- **Service Role Key**: Chỉ tồn tại trong Worker, không bao giờ xuống frontend
- **PKCE Required**: OAuth clients phải sử dụng PKCE (S256) để bảo vệ authorization code
- **RS256 Signing**: Tất cả tokens được sign bằng RSA-256

## 📦 API Endpoints

### Profile API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | ❌ | Health check |
| GET | `/api/profile/me` | ✅ | Get current user's profile |
| PATCH | `/api/profile/me` | ✅ | Update current user's profile |
| POST | `/api/media/presign` | ✅ | Get presigned URL for media upload |

### OAuth 2.0 / OIDC Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/.well-known/openid-configuration` | ❌ | OIDC Discovery document |
| GET | `/.well-known/jwks.json` | ❌ | Public keys for JWT verification |
| GET | `/oauth/authorize` | ❌ | Start authorization flow (redirects to consent) |
| POST | `/oauth/authorize/callback` | ✅ | Receive consent from frontend |
| POST | `/oauth/token` | ❌ | Exchange code for tokens |
| GET | `/oauth/userinfo` | Bearer | Get user claims |

### OAuth Scopes

| Scope | Claims |
|-------|--------|
| `openid` | `sub` |
| `profile` | `name`, `picture` |
| `email` | `email` |
| `wallet` | `wallet_address`, `camly_balance` |

## 🚀 Setup

### 1. Install dependencies

```bash
cd worker
npm install
```

### 2. Generate RSA Key Pair (for OAuth)

```bash
# Generate 2048-bit RSA key pair
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

### 3. Set secrets

```bash
# Supabase
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Paste your Supabase Service Role Key when prompted

# OAuth RSA Keys
wrangler secret put FUNID_RSA_PRIVATE_KEY < private.pem
wrangler secret put FUNID_RSA_PUBLIC_KEY < public.pem
wrangler secret put FUNID_RSA_KID
# Enter: funid-key-2026
```

### 4. Development

```bash
wrangler dev
# Worker runs at http://localhost:8787
```

### 5. Deploy to Cloudflare

```bash
wrangler deploy
# Note the deployed URL: https://funprofile-api.<subdomain>.workers.dev
```

## 🧪 Testing

### Health Check
```bash
curl http://localhost:8787/api/health
```

### OIDC Discovery
```bash
curl http://localhost:8787/.well-known/openid-configuration
```

### JWKS
```bash
curl http://localhost:8787/.well-known/jwks.json
```

### Get Profile (need JWT)
```bash
curl -H "Authorization: Bearer <your_jwt>" http://localhost:8787/api/profile/me
```

### OAuth Flow Test
```bash
# 1. Start authorization
open "http://localhost:8787/oauth/authorize?response_type=code&client_id=test&redirect_uri=http://localhost:3000/callback&scope=openid%20profile&state=abc123&code_challenge=xxx&code_challenge_method=S256"

# 2. Exchange code for tokens
curl -X POST http://localhost:8787/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=xxx&redirect_uri=http://localhost:3000/callback&client_id=test&code_verifier=yyy"
```

## 📊 Performance

| Metric | Old (Auth API call) | New (JWKS) |
|--------|---------------------|------------|
| Token verify | 100-200ms | 5-10ms |
| Scalability | Bottleneck | Stateless |
| Network calls | 2 per request | 1 per request |

## 🔧 Environment Variables

### Worker (wrangler.toml + secrets)

| Name | Type | Description |
|------|------|-------------|
| `SUPABASE_URL` | var | Supabase project URL |
| `SUPABASE_ANON_KEY` | var | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | Supabase service role key |
| `ALLOWED_ORIGINS` | var | Comma-separated allowed origins |
| `FUNID_ISSUER` | var | OAuth issuer URL |
| `FUNID_FRONTEND_URL` | var | Frontend URL for consent redirect |
| `FUNID_RSA_PRIVATE_KEY` | **secret** | RSA private key (PEM) |
| `FUNID_RSA_PUBLIC_KEY` | **secret** | RSA public key (PEM) |
| `FUNID_RSA_KID` | **secret** | Key ID for JWKS |

## ⚠️ Production Checklist

- [ ] Set `ALLOWED_ORIGINS` to production domain only
- [ ] Generate and set RSA key pair secrets
- [ ] Deploy with `wrangler deploy`
- [ ] Update frontend `VITE_WORKER_API_BASE_URL`
- [ ] Verify CORS is blocking unauthorized origins
- [ ] Test all OAuth endpoints
- [ ] Register OAuth clients in database
