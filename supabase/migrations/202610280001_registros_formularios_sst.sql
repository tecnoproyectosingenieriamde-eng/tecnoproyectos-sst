-- SST digital forms: private archive with submission-only access for authenticated users.
-- Apply manually to a NON-PRODUCTION Supabase project first, after reviewing schema/roles.
-- This migration is a draft; it is not executed by committing it to GitHub.

create table if not exists public.registros_formularios_sst (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  codigo_formato text not null,
  titulo_formato text not null,
  datos_formulario jsonb not null default '{}'::jsonb,
  firmas jsonb not null default '{}'::jsonb,
  pdf_path text not null,
  estado text not null default 'completado' check (estado in ('completado'))
);

alter table public.registros_formularios_sst enable row level security;

-- Signed-in users may submit records, but cannot list/read/update/delete them.
drop policy if exists "sst_forms_insert_authenticated" on public.registros_formularios_sst;
create policy "sst_forms_insert_authenticated"
  on public.registros_formularios_sst
  for insert to authenticated
  with check (created_by = auth.uid());

-- Only the superadmin role can consult stored records.
drop policy if exists "sst_forms_select_superadmin" on public.registros_formularios_sst;
create policy "sst_forms_select_superadmin"
  on public.registros_formularios_sst
  for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.rol = 'superadmin'
    )
  );

-- No update/delete policies are intentionally defined for normal workflow.
-- Create a private bucket named 'sst-formularios-pdf' in Supabase Storage.
-- Storage object policies should be added only after confirming bucket setup and
-- the actual profile role column. Never make this bucket public.
