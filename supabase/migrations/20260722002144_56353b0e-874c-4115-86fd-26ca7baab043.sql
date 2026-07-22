
UPDATE public.tbl_profiles
SET signature_url = regexp_replace(
  split_part(signature_url, '?', 1),
  '^.*/storage/v1/object/sign/signatures/', ''
)
WHERE signature_url LIKE '%/storage/v1/object/sign/signatures/%';
