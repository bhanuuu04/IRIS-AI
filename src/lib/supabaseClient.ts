import { createClient } from '@supabase/supabase-js'

export const createClerkSupabaseClient = (clerkToken: string) => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        // Get the custom Supabase token from Clerk
        fetch: async (url, options = {}) => {
          const headers = new Headers(options?.headers)
          headers.set('Authorization', `Bearer ${clerkToken}`)

          return fetch(url, {
            ...options,
            headers,
          })
        },
      },
    }
  )
}
