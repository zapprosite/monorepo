create table if not exists hvac_field_cases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  author text not null,
  source_type text not null, -- field_experience, youtube_summary, service_note
  source_url text,
  source_title text,

  brand text,
  model text,
  model_family text,
  equipment_type text,
  alarm_codes text[],
  components text[],
  symptoms text[],

  problem_summary text not null,
  field_technique text not null,
  safety_notes text,
  limitations text,

  evidence_level text not null, -- field_experience, video_summary, manual_exact
  confidence text not null default 'medium', -- high, medium, low
  status text not null default 'draft', -- draft, approved, deprecated
  metadata jsonb default '{}'::jsonb
);

-- Indexes for common queries
create index if not exists hvac_field_cases_author_idx on hvac_field_cases(author);
create index if not exists hvac_field_cases_status_idx on hvac_field_cases(status);
create index if not exists hvac_field_cases_brand_idx on hvac_field_cases(brand);
create index if not exists hvac_field_cases_alarm_codes_idx on hvac_field_cases using gin(alarm_codes);
create index if not exists hvac_field_cases_components_idx on hvac_field_cases using gin(components);
create index if not exists hvac_field_cases_source_type_idx on hvac_field_cases(source_type);
