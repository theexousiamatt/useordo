-- This migration matches the restricted snapshot already created on the live
-- legacy Ordo Supabase project prior to installing project stages.
-- The backup schema has no API grants; keep it private and review retention.
CREATE SCHEMA IF NOT EXISTS ordo_release_backup;
REVOKE ALL ON SCHEMA ordo_release_backup FROM PUBLIC, anon, authenticated;
COMMENT ON SCHEMA ordo_release_backup IS 'Restricted release snapshots for recovery; not a public schema';

CREATE TABLE ordo_release_backup.tasks_before_legacy_stages AS TABLE public.tasks;
CREATE TABLE ordo_release_backup.projects_before_legacy_stages AS TABLE public.projects;
CREATE TABLE ordo_release_backup.project_members_before_legacy_stages AS TABLE public.project_members;
CREATE TABLE ordo_release_backup.workspace_members_before_legacy_stages AS TABLE public.workspace_members;
CREATE TABLE ordo_release_backup.task_assignees_before_legacy_stages AS TABLE public.task_assignees;
CREATE TABLE ordo_release_backup.task_labels_before_legacy_stages AS TABLE public.task_labels;
CREATE TABLE ordo_release_backup.snapshot_manifest_before_legacy_stages AS
SELECT now() AS snapshot_at,
  (SELECT count(*) FROM public.tasks) AS tasks_count,
  (SELECT count(*) FROM public.projects) AS projects_count,
  (SELECT count(*) FROM public.project_members) AS project_members_count,
  (SELECT count(*) FROM public.workspace_members) AS workspace_members_count,
  (SELECT count(*) FROM public.task_assignees) AS task_assignees_count,
  (SELECT count(*) FROM public.task_labels) AS task_labels_count;

ALTER TABLE ordo_release_backup.tasks_before_legacy_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordo_release_backup.projects_before_legacy_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordo_release_backup.project_members_before_legacy_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordo_release_backup.workspace_members_before_legacy_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordo_release_backup.task_assignees_before_legacy_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordo_release_backup.task_labels_before_legacy_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordo_release_backup.snapshot_manifest_before_legacy_stages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA ordo_release_backup FROM PUBLIC, anon, authenticated;
