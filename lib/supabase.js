import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// supabase will be null when env vars are not set (local dev without Supabase)
export const supabase = url && key ? createClient(url, key) : null;
