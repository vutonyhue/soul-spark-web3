# FUN Profile API Gateway

Cloudflare Worker API Gateway với JWT verification bằng JWKS (Big Tech Style).

## 🏗️ Kiến trúc

```
Frontend (React)
    │
    │ Authorization: Bearer <JWT>
    ▼
Cloudflare Worker (API Gateway)
    │
    ├── 1. Verify JWT bằng JWKS (jose library)
    │      └── JWKS URL: ${SUPABASE_URL}/auth/v1/.well-known/jwks.json
    │      └── Issuer: ${SUPABASE_URL}/auth/v1
    │      └── userId = payload.sub
    │
    ├── 2. Call Supabase REST API với Service Role Key
    │
    └── 3. Return response
```

## 🔐 Security Features

- **JWKS Verification**: JWT được verify locally bằng public key, không cần gọi Supabase Auth mỗi request
- **CORS Whitelist**: Chỉ cho phép origins trong `ALLOWED_ORIGINS`
- **Input Validation**: Allowlist fields cho profile update, blocklist fields bảo vệ
- **Service Role Key**: Chỉ tồn tại trong Worker, không bao giờ xuống frontend

## 📦 API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | ❌ | Health check |
| GET | `/api/profile/me` | ✅ | Get current user's profile |
| PATCH | `/api/profile/me` | ✅ | Update current user's profile |
| POST | `/api/media/presign` | ✅ | Get presigned URL (TODO) |

### Profile Update Fields (Allowlist)

Chỉ các field sau được phép update:
- `display_name`
- `bio`
- `avatar_url`
- `website`

Các field sau bị **BLOCK** (không thể update từ client):
- `id`
- `camly_balance`
- `wallet_address`
- `created_at`
- `updated_at`

## 🚀 Setup

### 1. Install dependencies

```bash
cd worker
npm install
```

### 2. Set secrets

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Paste your Supabase Service Role Key when prompted
```

### 3. Development

```bash
wrangler dev
# Worker runs at http://localhost:8787
```

### 4. Deploy to Cloudflare

```bash
wrangler deploy
# Note the deployed URL: https://funprofile-api.<subdomain>.workers.dev
```

### 5. Update Frontend

Cập nhật `.env` trong frontend:

```env
VITE_WORKER_API_BASE_URL=https://funprofile-api.<subdomain>.workers.dev
```

## 🧪 Testing

```bash
# Health check
curl http://localhost:8787/api/health

# Get profile (need JWT)
curl -H "Authorization: Bearer <your_jwt>" http://localhost:8787/api/profile/me

# Update profile
curl -X PATCH \
  -H "Authorization: Bearer <your_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"display_name": "New Name", "bio": "Hello!"}' \
  http://localhost:8787/api/profile/me
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

### Frontend (.env)

| Name | Description |
|------|-------------|
| `VITE_WORKER_API_BASE_URL` | Worker URL (e.g., http://localhost:8787) |

## ⚠️ Production Checklist

- [ ] Set `ALLOWED_ORIGINS` to production domain only
- [ ] Deploy with `wrangler deploy`
- [ ] Update frontend `VITE_WORKER_API_BASE_URL`
- [ ] Verify CORS is blocking unauthorized origins
- [ ] Test all endpoints with production JWT
