begin;

alter table public.portal_bills
  add column if not exists ocr_result jsonb;

commit;
