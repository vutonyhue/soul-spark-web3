-- =============================================
-- MESSAGING FEATURE: Database Schema
-- =============================================

-- 1. Create conversations table
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  name text,
  avatar_url text,
  last_message_id uuid,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create conversation_participants table
CREATE TABLE public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  last_read_at timestamptz,
  is_muted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- 3. Create messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'file', 'system')),
  media_url text,
  reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  is_edited boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add foreign key for last_message_id after messages table exists
ALTER TABLE public.conversations 
  ADD CONSTRAINT conversations_last_message_id_fkey 
  FOREIGN KEY (last_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;

-- 4. Create indexes for performance
CREATE INDEX idx_conversation_participants_user_id ON public.conversation_participants(user_id);
CREATE INDEX idx_conversation_participants_conversation_id ON public.conversation_participants(conversation_id);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_conversations_last_message_at ON public.conversations(last_message_at DESC NULLS LAST);

-- 5. Create trigger for updated_at on conversations
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Create trigger for updated_at on messages
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Enable Row Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 8. Create helper function to check if user is participant (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE user_id = _user_id
      AND conversation_id = _conversation_id
      AND left_at IS NULL
  )
$$;

-- =============================================
-- RLS POLICIES FOR conversations
-- =============================================

-- Users can view conversations they participate in
CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  USING (public.is_conversation_participant(auth.uid(), id));

-- Users can create conversations
CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Participants can update conversation (name, avatar for groups)
CREATE POLICY "Participants can update conversations"
  ON public.conversations FOR UPDATE
  USING (public.is_conversation_participant(auth.uid(), id));

-- =============================================
-- RLS POLICIES FOR conversation_participants
-- =============================================

-- Users can view participants of conversations they're in
CREATE POLICY "Users can view participants of their conversations"
  ON public.conversation_participants FOR SELECT
  USING (public.is_conversation_participant(auth.uid(), conversation_id));

-- Users can add participants (for creating conversations or inviting)
CREATE POLICY "Users can add participants"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    (user_id = auth.uid() OR public.is_conversation_participant(auth.uid(), conversation_id))
  );

-- Users can update their own participant record (mute, last_read)
CREATE POLICY "Users can update their own participant record"
  ON public.conversation_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can leave conversations (set left_at)
CREATE POLICY "Users can leave conversations"
  ON public.conversation_participants FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES FOR messages
-- =============================================

-- Participants can view messages in their conversations
CREATE POLICY "Participants can view messages"
  ON public.messages FOR SELECT
  USING (public.is_conversation_participant(auth.uid(), conversation_id));

-- Participants can send messages
CREATE POLICY "Participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    public.is_conversation_participant(auth.uid(), conversation_id)
  );

-- Users can edit their own messages
CREATE POLICY "Users can edit their own messages"
  ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id);

-- Users can delete their own messages (soft delete)
CREATE POLICY "Users can delete their own messages"
  ON public.messages FOR DELETE
  USING (auth.uid() = sender_id);

-- =============================================
-- Function to update conversation last_message
-- =============================================

CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET 
    last_message_id = NEW.id,
    last_message_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message();