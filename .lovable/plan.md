

# Kế hoạch xây dựng tính năng Nhắn tin (Messaging) cho Fun Profile

## Tổng quan

Xây dựng hệ thống nhắn tin thời gian thực (Real-time Messaging) cho phép người dùng Fun Profile gửi tin nhắn trực tiếp cho nhau, với khả năng import lịch sử chat từ ứng dụng khác.

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     FUN PROFILE MESSAGING                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐  │
│  │  Conversations  │     │     Messages    │     │   Realtime   │  │
│  │  (Danh sách)    │────▶│  (Tin nhắn)     │◀───│   Supabase   │  │
│  └─────────────────┘     └─────────────────┘     └──────────────┘  │
│          │                       │                                  │
│          ▼                       ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SUPABASE DATABASE                         │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐  │   │
│  │  │  conversations │  │    messages    │  │ conversation_ │  │   │
│  │  │  (hội thoại)   │  │  (tin nhắn)    │  │  participants │  │   │
│  │  └────────────────┘  └────────────────┘  └───────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Database Schema (30 phút)

### Bảng `conversations` - Quản lý hội thoại

```sql
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  name text,                    -- Tên nhóm (nếu là group chat)
  avatar_url text,              -- Avatar nhóm
  last_message_id uuid,         -- Tin nhắn cuối cùng
  last_message_at timestamptz,  -- Thời gian tin nhắn cuối
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Bảng `conversation_participants` - Thành viên hội thoại

```sql
CREATE TABLE public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,          -- NULL nếu còn trong nhóm
  last_read_at timestamptz,     -- Đọc tin nhắn cuối lúc nào
  is_muted boolean DEFAULT false,
  UNIQUE(conversation_id, user_id)
);
```

### Bảng `messages` - Tin nhắn

```sql
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'file', 'system')),
  media_url text,               -- URL hình ảnh/video/file
  reply_to_id uuid REFERENCES messages(id), -- Trả lời tin nhắn nào
  is_edited boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### RLS Policies

```sql
-- Chỉ thành viên mới xem được tin nhắn
CREATE POLICY "Members can view conversation messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
      AND left_at IS NULL
    )
  );

-- Chỉ thành viên mới gửi được tin nhắn
CREATE POLICY "Members can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
      AND left_at IS NULL
    )
  );
```

---

## Phase 2: API Endpoints trên Cloudflare Worker (2-3 giờ)

### Các endpoints cần triển khai

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/api/conversations` | GET | Danh sách hội thoại của user |
| `/api/conversations` | POST | Tạo hội thoại mới |
| `/api/conversations/:id/messages` | GET | Lấy tin nhắn trong hội thoại |
| `/api/conversations/:id/messages` | POST | Gửi tin nhắn |
| `/api/conversations/:id/read` | POST | Đánh dấu đã đọc |
| `/api/messages/:id` | PATCH | Sửa tin nhắn |
| `/api/messages/:id` | DELETE | Xóa tin nhắn |

---

## Phase 3: Frontend UI (3-4 giờ)

### 3.1 Trang Messages (`/messages`)

```text
┌────────────────────────────────────────────────────────────────────┐
│  [←]  Tin nhắn                                    [🔍] [✏️ Mới]   │
├────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ [👤] Nguyễn Văn A                                    14:30  │  │
│  │      Okay, hẹn gặp lại!                              ✓✓    │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ [👤👤] Nhóm dự án FUN                                13:00  │  │
│  │        @Bạn: Gửi file rồi nhé                        ●     │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ [👤] Trần Thị B                                     Hôm qua │  │
│  │      Cảm ơn bạn nhiều!                               ✓     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### 3.2 Trang Chat Detail (`/messages/:conversationId`)

```text
┌────────────────────────────────────────────────────────────────────┐
│  [←]  [👤] Nguyễn Văn A                          [📞] [📹] [⋮]   │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│                          Hôm nay                                   │
│                                                                    │
│     ┌──────────────────────────────────────┐                       │
│     │ Chào bạn, bạn khỏe không?            │  14:25                │
│     └──────────────────────────────────────┘                       │
│                                                                    │
│                    ┌──────────────────────────────────────┐        │
│          14:28     │ Mình khỏe, cảm ơn bạn!               │        │
│                    └──────────────────────────────────────┘        │
│                                                                    │
│     ┌──────────────────────────────────────┐                       │
│     │ Okay, hẹn gặp lại!                   │  14:30                │
│     └──────────────────────────────────────┘                       │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│  [📎]  Aa nhập tin nhắn...                                 [📤]   │
└────────────────────────────────────────────────────────────────────┘
```

### Components cần tạo

```text
src/
├── pages/
│   ├── Messages.tsx          # Danh sách hội thoại
│   └── ChatDetail.tsx        # Chi tiết hội thoại
├── components/
│   └── messages/
│       ├── ConversationList.tsx    # Danh sách hội thoại
│       ├── ConversationItem.tsx    # 1 item hội thoại
│       ├── MessageList.tsx         # Danh sách tin nhắn
│       ├── MessageBubble.tsx       # Bubble tin nhắn
│       ├── MessageInput.tsx        # Ô nhập tin nhắn
│       └── NewConversationDialog.tsx # Dialog tạo hội thoại mới
└── hooks/
    └── useMessages.ts        # Hook quản lý messages với React Query
```

---

## Phase 4: Real-time với Supabase (1-2 giờ)

### Subscription để nhận tin nhắn mới

```typescript
// useRealtimeMessages.ts
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useRealtimeMessages(conversationId: string, onNewMessage: (msg) => void) {
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          onNewMessage(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, onNewMessage]);
}
```

---

## Phase 5 (Tuỳ chọn): Import Chat từ ứng dụng khác (2-3 giờ)

### Hỗ trợ import từ:

| Nguồn | Format | Độ phức tạp |
|-------|--------|-------------|
| **Facebook Messenger** | JSON (từ Download Your Data) | Trung bình |
| **WhatsApp** | TXT export | Đơn giản |
| **Telegram** | JSON export | Trung bình |
| **Zalo** | Không hỗ trợ export | Không khả thi |

### Trang Import Chat (`/messages/import`)

```text
┌────────────────────────────────────────────────────────────────────┐
│  [←]  Import lịch sử chat                                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│   Chọn nguồn để import:                                            │
│                                                                    │
│   ┌────────────────────────────────────────────────────────────┐   │
│   │  [📘] Facebook Messenger                                   │   │
│   │       Import từ file JSON (Download Your Data)             │   │
│   └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│   ┌────────────────────────────────────────────────────────────┐   │
│   │  [📗] WhatsApp                                             │   │
│   │       Import từ file TXT export                            │   │
│   └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│   ┌────────────────────────────────────────────────────────────┐   │
│   │  [✈️] Telegram                                              │   │
│   │       Import từ file JSON export                           │   │
│   └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│   ⚠️ Lưu ý: Chỉ tin nhắn văn bản được import.                      │
│      Hình ảnh và file đính kèm cần upload thủ công.                │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Cách hoạt động Import

1. User upload file export (JSON/TXT)
2. Hệ thống parse và hiển thị preview
3. User chọn conversation để import
4. Map người tham gia với user Fun Profile (nếu có)
5. Import messages vào database

---

## Timeline ước tính

| Phase | Thời gian | Mô tả |
|-------|-----------|-------|
| Phase 1 | 30 phút | Database schema |
| Phase 2 | 2-3 giờ | API endpoints |
| Phase 3 | 3-4 giờ | Frontend UI |
| Phase 4 | 1-2 giờ | Real-time messaging |
| Phase 5 | 2-3 giờ | Import chat (tuỳ chọn) |
| **Tổng** | **7-12 giờ** | |

---

## Kết quả mong đợi

1. **Nhắn tin 1-1:** Gửi tin nhắn trực tiếp giữa 2 người
2. **Nhóm chat:** Tạo và quản lý nhóm chat
3. **Real-time:** Tin nhắn hiển thị ngay lập tức
4. **Thông báo:** Badge hiển thị số tin chưa đọc
5. **Media:** Gửi hình ảnh, video, file
6. **Import:** Import lịch sử từ Messenger/WhatsApp/Telegram

---

## Phần kỹ thuật bổ sung

### Cấu trúc files mới

```text
src/
├── pages/
│   ├── Messages.tsx
│   └── ChatDetail.tsx
├── components/
│   └── messages/
│       ├── ConversationList.tsx
│       ├── ConversationItem.tsx
│       ├── MessageList.tsx
│       ├── MessageBubble.tsx
│       ├── MessageInput.tsx
│       ├── NewConversationDialog.tsx
│       └── ImportChatDialog.tsx
├── hooks/
│   ├── useConversations.ts
│   ├── useMessages.ts
│   └── useRealtimeMessages.ts
└── lib/
    └── chat-importers/
        ├── messenger.ts
        ├── whatsapp.ts
        └── telegram.ts

worker/src/
├── messages/
│   ├── conversations.ts
│   ├── messages.ts
│   └── read-status.ts
```

### API thêm vào `src/lib/api.ts`

```typescript
// ========== MESSAGES API ==========

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  avatar_url: string | null;
  last_message: Message | null;
  last_message_at: string | null;
  unread_count: number;
  participants: Array<{
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  }>;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'file' | 'system';
  media_url: string | null;
  reply_to: Message | null;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  sender?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export async function getConversations(): Promise<ApiResponse<{ conversations: Conversation[] }>>
export async function createConversation(participantIds: string[], type?: string, name?: string): Promise<...>
export async function getMessages(conversationId: string, limit?: number, before?: string): Promise<...>
export async function sendMessage(conversationId: string, content: string, type?: string): Promise<...>
export async function markAsRead(conversationId: string): Promise<...>
```

