-- Avatars bucket also stores ID document uploads. Widen the allowed types
-- to accept PDFs and bump the size cap to 10 MB (was 5 MB).

update storage.buckets
  set allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf'
  ],
  file_size_limit = 10485760
where id = 'avatars';
