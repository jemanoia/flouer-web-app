begin;

drop policy if exists "sales_receipts_upload_authenticated" on storage.objects;
create policy "sales_receipts_upload_authenticated"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'payment-receipts');

drop policy if exists "sales_receipts_update_authenticated" on storage.objects;
create policy "sales_receipts_update_authenticated"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'payment-receipts')
  with check (bucket_id = 'payment-receipts');

drop policy if exists "sales_receipts_select_authenticated" on storage.objects;
create policy "sales_receipts_select_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'payment-receipts');

commit;
