import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

/**
 * Subscribes to Supabase auth state. Returns the current user/session and a
 * loading flag that is true until the initial getSession() resolves.
 *
 * Always set up onAuthStateChange BEFORE calling getSession() (per Supabase docs).
 */
export function useAuthSession(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, session, loading: false });
    });

    supabase.auth.getSession().then(({ data }) => {
      setState({
        user: data.session?.user ?? null,
        session: data.session,
        loading: false,
      });
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

/**
 * Reads the current user's roles directly from public.user_roles
 * (RLS policy "Users view own roles" allows this).
 */
export function useIsMaster(userId: string | undefined) {
  return useQuery({
    enabled: !!userId,
    queryKey: ["auth", "is-master", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "master_admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

export async function signOut() {
  await supabase.auth.signOut();
}
