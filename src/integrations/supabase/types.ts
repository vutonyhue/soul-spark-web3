export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_muted: boolean
          joined_at: string
          last_read_at: string | null
          left_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          left_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          left_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          last_message_at: string | null
          last_message_id: string | null
          name: string | null
          type: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_id?: string | null
          name?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_id?: string | null
          name?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_last_message_id_fkey"
            columns: ["last_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          is_deleted: boolean
          is_edited: boolean
          media_url: string | null
          message_type: string
          reply_to_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_edited?: boolean
          media_url?: string | null
          message_type?: string
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_edited?: boolean
          media_url?: string | null
          message_type?: string
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_authorization_codes: {
        Row: {
          client_id: string
          code: string
          code_challenge: string | null
          code_challenge_method: string | null
          created_at: string | null
          expires_at: string
          id: string
          nonce: string | null
          redirect_uri: string
          scope: string
          state: string | null
          used: boolean | null
          user_id: string
        }
        Insert: {
          client_id: string
          code: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          nonce?: string | null
          redirect_uri: string
          scope: string
          state?: string | null
          used?: boolean | null
          user_id: string
        }
        Update: {
          client_id?: string
          code?: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          nonce?: string | null
          redirect_uri?: string
          scope?: string
          state?: string | null
          used?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_authorization_codes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      oauth_clients: {
        Row: {
          client_id: string
          client_name: string
          client_secret_hash: string
          client_uri: string | null
          created_at: string | null
          created_by: string | null
          grant_types: string[] | null
          id: string
          is_active: boolean | null
          is_confidential: boolean | null
          logo_uri: string | null
          redirect_uris: string[]
          scopes: string[] | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string
          client_name: string
          client_secret_hash: string
          client_uri?: string | null
          created_at?: string | null
          created_by?: string | null
          grant_types?: string[] | null
          id?: string
          is_active?: boolean | null
          is_confidential?: boolean | null
          logo_uri?: string | null
          redirect_uris: string[]
          scopes?: string[] | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          client_name?: string
          client_secret_hash?: string
          client_uri?: string | null
          created_at?: string | null
          created_by?: string | null
          grant_types?: string[] | null
          id?: string
          is_active?: boolean | null
          is_confidential?: boolean | null
          logo_uri?: string | null
          redirect_uris?: string[]
          scopes?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      oauth_consents: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          scopes: string[]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          scopes: string[]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          scopes?: string[]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      oauth_refresh_tokens: {
        Row: {
          client_id: string
          created_at: string | null
          expires_at: string
          id: string
          revoked: boolean | null
          revoked_at: string | null
          scope: string
          token_hash: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          revoked?: boolean | null
          revoked_at?: string | null
          scope: string
          token_hash: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          revoked?: boolean | null
          revoked_at?: string | null
          scope?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_refresh_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      posts: {
        Row: {
          coin_reward: number | null
          comments_count: number | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          likes_count: number | null
          media_type: string | null
          shares_count: number | null
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          coin_reward?: number | null
          comments_count?: number | null
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number | null
          media_type?: string | null
          shares_count?: number | null
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          coin_reward?: number | null
          comments_count?: number | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number | null
          media_type?: string | null
          shares_count?: number | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_posts_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          camly_balance: number | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          wallet_address: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          camly_balance?: number | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          wallet_address?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          camly_balance?: number | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_oauth_data: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
