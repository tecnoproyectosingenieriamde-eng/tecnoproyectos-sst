-- SST digital forms archive. Additive migration: does not alter existing SST tables,
-- policies, or buckets. Review and apply manually to Supabase after preview testing.
-- User-facing access: authenticated users can submit; only superadmin can read records/PDFs.

create table if not exists public.registros_formularios_sst (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  codigo_formato text not null,
  titulo_formato text not null,
  datos_formulario jsonb not null default '{}'::jsonb,
  firmas jsonb not null default '{}'::jsonb,
  pdf_path text not null,
  estado text not null default 'completado'
    check (estado = 'completado')
);

alter table public.registros_formularios_sst enable row level security;

-- RLS policies are the authorization boundary; grants only expose the operations
-- needed by the client. No UPDATE or DELETE policy is created.
revoke all on public.registros_formularios_sst from anon, authenticated;
grant insert, select on public.registros_formularios_sst to authenticated;

drop policy if exists "sst_forms_insert_authenticated"
  on public.registros_formularios_sst;
create policy "sst_forms_insert_authenticated"
  on public.registros_formularios_sst
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (storage.foldername(pdf_path))[1] = (select auth.uid())::text
  );

drop policy if exists "sst_forms_select_superadmin"
  on public.registros_formularios_sst;
create policy "sst_forms_select_superadmin"
  on public.registros_formularios_sst
  for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.rol = 'superadmin'
    )
  );

create index if not exists registros_formularios_sst_created_at_idx
  on public.registros_formularios_sst (created_at desc);
create index if not exists registros_formularios_sst_codigo_idx
  on public.registros_formularios_sst (codigo_formato);

-- Dedicated private bucket for completed PDFs. Only this new bucket is touched.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sst-formularios-pdf',
  'sst-formularios-pdf',
  false,
  20971520,
  array['application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Uploads are limited to a folder named after the authenticated user's UUID.
drop policy if exists "sst_forms_upload_own_pdf" on storage.objects;
create policy "sst_forms_upload_own_pdf"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'sst-formularios-pdf'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Reading/listing objects in this bucket is reserved to the superadmin profile.
drop policy if exists "sst_forms_read_superadmin" on storage.objects;
create policy "sst_forms_read_superadmin"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'sst-formularios-pdf'
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.rol = 'superadmin'
    )
  );

-- Intentionally no update/delete policy for stored PDFs.
