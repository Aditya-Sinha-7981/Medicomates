import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

/** Browser client for password recovery only (anon key). */
export const supabaseAuth =
  url && anonKey ? createClient(url, anonKey) : null;
