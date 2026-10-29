-- Read-only check for the restore lab. Run only against 127.0.0.1:55522.
-- The second statement fails if public.transfers is absent.

select case
  when to_regclass('public.transfers') is null then 'FAIL'
  else 'PASS'
end as transfers_table;

select count(*)::bigint as transfers_rows
from public.transfers;
