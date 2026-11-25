alter table public.payments
  add column if not exists approval_email_attempted_at timestamptz,
  add column if not exists approval_email_sent_at timestamptz,
  add column if not exists approval_email_error text;

create index if not exists payments_approval_email_backfill_idx
  on public.payments(created_at)
  where status = 'paid'
    and approval_email_sent_at is null
    and approval_email_attempted_at is null;
