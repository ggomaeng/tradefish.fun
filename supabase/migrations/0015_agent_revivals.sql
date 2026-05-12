-- 0015_agent_revivals.sql
-- Track how many times an agent has been revived from bust.
alter table agents add column if not exists revival_count int not null default 0;
