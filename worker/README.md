# FUN Profile API Gateway

Cloudflare Worker làm API Gateway bảo mật cho ứng dụng FUN Profile.

## Kiến trúc

```
Frontend (React) --[Bearer Token]--> Cloudflare Worker --[Service Role Key]--> Supabase
```

## Cài đặt

```bash
cd worker
npm install
```

## Cấu hình Secrets

```bash
# Set Supabase Service Role Key (bắt buộc)
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Nhập key khi được yêu cầu
```

## Chạy Local

```bash
npm run dev
# Worker sẽ chạy tại http://localhost:8787
```

## Deploy Production

```bash
npm run deploy
# Worker URL: https://funprofile-api.<subdomain>.workers.dev
```

## API Endpoints

### `GET /api/profile/me`
Lấy profile của user đang đăng nhập.

**Headers:**
- `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "profile": {
    "id": "uuid",
    "display_name": "John Doe",
    "bio": "Hello world",
    "avatar_url": "https://...",
    "camly_balance": 100,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### `PATCH /api/profile/me`
Cập nhật profile của user đang đăng nhập.

**Headers:**
- `Authorization: Bearer <access_token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "display_name": "New Name",
  "bio": "New bio",
  "avatar_url": "https://..."
}
```

### `POST /api/media/presign`
(Chưa triển khai) Tạo URL upload ảnh.

### `GET /api/health`
Health check endpoint.

## Environment Variables

| Variable | Type | Description |
|----------|------|-------------|
| `SUPABASE_URL` | var | Supabase project URL |
| `SUPABASE_ANON_KEY` | var | Supabase anon key (for token verification) |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | Supabase service role key (for DB access) |
| `ALLOWED_ORIGIN` | var | CORS origin (optional, default: *) |

## Xem Logs

```bash
npm run tail
```
