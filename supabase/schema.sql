-- Create a table to sync Clerk users and manage their subscriptions
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id TEXT UNIQUE NOT NULL,
    email TEXT,
    pro_mode_active BOOLEAN DEFAULT false,
    subscription_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow public read access to the users table, 
-- but in reality, you might restrict this. For now, we allow authenticated reads.
-- Or just let the Service Role bypass RLS (the API routes will use Service Role).
CREATE POLICY "Enable read access for all users" ON public.users FOR SELECT USING (true);
