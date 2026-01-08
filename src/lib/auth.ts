import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"] & {
  organizations: Database["public"]["Tables"]["organizations"]["Row"] | null;
};

export type AuthData = {
  user: {
    id: string;
    email: string | undefined;
  };
  profile: Profile;
};

/**
 * Cached auth function - only makes one request per render cycle
 * Use this instead of directly calling supabase.auth.getUser() in pages
 */
export const getAuthData = cache(async (): Promise<AuthData | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(*)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    profile: profile as Profile,
  };
});

/**
 * Get cached supabase client - ensures same client is used across components
 */
export const getCachedSupabase = cache(async () => {
  return await createClient();
});
