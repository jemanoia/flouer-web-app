begin;

alter table if exists public.sales_records enable row level security;
alter table if exists public.sales_record_items enable row level security;
alter table if exists public.products enable row level security;
alter table if exists storage.objects enable row level security;

drop policy if exists "sales_records_select_authenticated" on public.sales_records;
create policy "sales_records_select_authenticated"
  on public.sales_records
  for select
  to authenticated
  using (true);

drop policy if exists "sales_records_insert_authenticated" on public.sales_records;
create policy "sales_records_insert_authenticated"
  on public.sales_records
  for insert
  to authenticated
  with check (true);

drop policy if exists "sales_records_update_authenticated" on public.sales_records;
create policy "sales_records_update_authenticated"
  on public.sales_records
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "sales_record_items_select_authenticated" on public.sales_record_items;
create policy "sales_record_items_select_authenticated"
  on public.sales_record_items
  for select
  to authenticated
  using (true);

drop policy if exists "products_select_authenticated" on public.products;
create policy "products_select_authenticated"
  on public.products
  for select
  to authenticated
  using (true);

-- Replace this bucket id with your real receipt bucket name in Supabase Storage.
drop policy if exists "sales_receipts_upload_authenticated" on storage.objects;
create policy "sales_receipts_upload_authenticated"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'sales-receipts');

drop policy if exists "sales_receipts_update_authenticated" on storage.objects;
create policy "sales_receipts_update_authenticated"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'sales-receipts')
  with check (bucket_id = 'sales-receipts');

drop policy if exists "sales_receipts_select_authenticated" on storage.objects;
create policy "sales_receipts_select_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'sales-receipts');

commit;
