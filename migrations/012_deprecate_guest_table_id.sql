-- wedding_guests.table_id is dead, and dangerously plausible-looking.
--
-- It is a uuid column sitting right next to table_assignment. Nothing writes
-- it, nothing reads it, and it is null on all 713 rows. The real seating link
-- is table_assignment, a text label matching the table's name in the layout.
--
-- Left in place rather than dropped, because dropping a column is not something
-- to do on a hunch and there is no cost to keeping it. The comment is the
-- point: the next person to build a seating feature will see table_id in the
-- schema, assume it is the foreign key it looks like, and write to a column
-- nothing reads. That is exactly how plus-one data was being lost.
--
-- If you would rather be rid of it, this is safe given it is empty and
-- unreferenced:
--   ALTER TABLE wedding_guests DROP COLUMN table_id;
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

COMMENT ON COLUMN wedding_guests.table_id IS
  'DEPRECATED — always null, never read, never written. Seating uses table_assignment (text label). Do not start using this column; add to table_assignment or model seating properly instead.';

COMMENT ON COLUMN wedding_guests.table_assignment IS
  'The real seating link: the table label from the layout, e.g. "Table 4". A party occupies one row, so a guest with a plus one takes two seats at this table.';
