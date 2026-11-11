-- Disposable QA database only. No grants for application or authenticated roles.
create table isolated_agenda_operations (
  operation_key text primary key,
  fingerprint text not null,
  result jsonb
);
