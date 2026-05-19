import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseKey =
  (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )?.trim()

export const supabaseConfigError =
  !supabaseUrl || !supabaseKey
    ? "Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the deploy environment."
    : ""

export const supabase = createClient(
  supabaseUrl || "https://example.supabase.co",
  supabaseKey || "missing-publishable-key",
)
