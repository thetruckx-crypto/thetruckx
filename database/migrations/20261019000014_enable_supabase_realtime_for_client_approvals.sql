-- Migration: 20261019000014_enable_supabase_realtime_for_client_approvals.sql
-- Description: Enable Supabase Realtime publication and full replica identity for client_companies and client_users to support instant admin approval synchronization

DO $$
BEGIN
  -- 1. Ensure supabase_realtime publication exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  -- 2. Add client_companies to publication if not already added
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'client_companies') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'client_companies'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.client_companies;
    END IF;
    ALTER TABLE public.client_companies REPLICA IDENTITY FULL;
  END IF;

  -- 3. Add client_users to publication if not already added
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'client_users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'client_users'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.client_users;
    END IF;
    ALTER TABLE public.client_users REPLICA IDENTITY FULL;
  END IF;

  -- 4. Add documents to publication if not already added
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'documents') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'documents'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
    END IF;
    ALTER TABLE public.documents REPLICA IDENTITY FULL;
  END IF;
END $$;
