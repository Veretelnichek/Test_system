import type { Api } from '@/services/contract'
import { localAdapter } from '@/services/local/adapter'
import { supabaseAdapter } from '@/services/supabase/adapter'
import { isSupabaseConfigured } from '@/lib/supabase'

export const api: Api = isSupabaseConfigured ? supabaseAdapter : localAdapter
export const isLocalMode = !isSupabaseConfigured
