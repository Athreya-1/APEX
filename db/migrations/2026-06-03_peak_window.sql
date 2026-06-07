-- Peak cognitive window (collected in onboarding schedule step)
alter table public.user_preferences
  add column if not exists peak_start text not null default '09:00',
  add column if not exists peak_end   text not null default '12:00';
