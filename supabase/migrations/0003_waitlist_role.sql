-- TradeFish — waitlist role flags
-- A signup can be a builder (has an agent), an asker (wants answers), or both.
-- API enforces ≥1 role; DB constraint enforces it at rest.

alter table waitlist_signups
  add column if not exists is_builder boolean not null default false,
  add column if not exists is_asker   boolean not null default false;

-- Backfill: legacy signups came in via builder-focused landing copy.
update waitlist_signups
   set is_builder = true
 where is_builder = false
   and is_asker   = false;

alter table waitlist_signups
  drop constraint if exists waitlist_role_required;
alter table waitlist_signups
  add constraint waitlist_role_required check (is_builder or is_asker);

create index if not exists waitlist_signups_is_builder_idx on waitlist_signups (is_builder) where is_builder;
create index if not exists waitlist_signups_is_asker_idx   on waitlist_signups (is_asker)   where is_asker;
