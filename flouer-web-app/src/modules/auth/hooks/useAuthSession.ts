import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/utils/supabase";

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setSessionError(error.message);
        setIsCheckingSession(false);
        return;
      }

      setSession(data.session);
      setIsCheckingSession(false);
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { session, isCheckingSession, sessionError };
}
