-- Ephemeral PostgreSQL QA bootstrap. Never target Supabase production.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.projects (id text PRIMARY KEY);
CREATE TABLE public.memberships (project_id text NOT NULL REFERENCES public.projects(id),user_id uuid NOT NULL REFERENCES auth.users(id),role text NOT NULL,PRIMARY KEY(project_id,user_id));
CREATE FUNCTION public.project_role(project_id text) RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULL::text $$;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL,file_size_limit bigint,allowed_mime_types text[]);
INSERT INTO public.projects(id) VALUES ('qa-a'),('qa-b');
INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000001');
