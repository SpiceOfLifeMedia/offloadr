CREATE TYPE "public"."user_kind" AS ENUM('ems_staff', 'member');--> statement-breakpoint
CREATE TYPE "public"."organization_membership_role" AS ENUM('admin', 'producer', 'student');--> statement-breakpoint
CREATE TYPE "public"."school_plan_tier" AS ENUM('starter', 'standard', 'program');--> statement-breakpoint
CREATE TYPE "public"."school_status" AS ENUM('active', 'trialing', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."storage_mode" AS ENUM('object_storage', 'google_drive');--> statement-breakpoint
CREATE TYPE "public"."project_access_mode" AS ENUM('quick_upload', 'student_accounts', 'both', 'closed');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'uploading', 'review_needed', 'ready_for_editor', 'delivered', 'archived');--> statement-breakpoint
CREATE TYPE "public"."project_workflow_type" AS ENUM('podcast_studio', 'general_video');--> statement-breakpoint
CREATE TYPE "public"."student_workflow_choice" AS ENUM('smart_draft', 'manual');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('draft', 'needs_review', 'approved', 'rejected', 'exported');--> statement-breakpoint
CREATE TYPE "public"."file_type" AS ENUM('audio', 'video', 'image', 'project_file', 'document', 'export', 'other');--> statement-breakpoint
CREATE TYPE "public"."media_uploader_kind" AS ENUM('user', 'student', 'student_account');--> statement-breakpoint
CREATE TYPE "public"."processing_status" AS ENUM('uploaded', 'processing', 'proxy_ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."upload_status" AS ENUM('pending', 'uploading', 'uploaded', 'failed', 'processing');--> statement-breakpoint
CREATE TYPE "public"."activity_actor_kind" AS ENUM('user', 'student_account', 'system');--> statement-breakpoint
CREATE TYPE "public"."recording_session_source" AS ENUM('hardware', 'simulated', 'browser_demo');--> statement-breakpoint
CREATE TYPE "public"."recording_session_status" AS ENUM('idle', 'ready', 'recording', 'stopping', 'uploading', 'complete', 'error');--> statement-breakpoint
CREATE TYPE "public"."student_upload_code_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."student_account_status" AS ENUM('active', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."helper_device_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."render_job_kind" AS ENUM('smart_draft', 'final_render', 'highlight');--> statement-breakpoint
CREATE TYPE "public"."render_job_status" AS ENUM('queued', 'submitted', 'processing', 'complete', 'failed', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."render_provider" AS ENUM('descript', 'shotstack', 'vizard', 'creatomate', 'remotion', 'stub');--> statement-breakpoint
CREATE TABLE "seller_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text,
	"name" text,
	"email" text,
	"phone" text,
	"suburb" text,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_profiles_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text,
	"seller_clerk_id" text,
	"seller_name" text,
	"seller_email" text,
	"seller_phone" text,
	"title" text NOT NULL,
	"price" numeric,
	"reserve_price" numeric,
	"suburb" text,
	"exact_address" text,
	"meetup_times" text[],
	"item_note" text,
	"description" text,
	"source_url" text,
	"status" text DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holds" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"buyer_name" text,
	"buyer_email" text,
	"buyer_mobile" text,
	"selected_time" text,
	"status" text DEFAULT 'created' NOT NULL,
	"payment_intent_id" text,
	"buyer_token" text,
	"reserved_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"source" text DEFAULT 'offly' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_emails_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"referrer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_reason" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"handled_at" timestamp with time zone,
	"internal_note" text,
	"alerted_at" timestamp with time zone,
	"sales_stage" text DEFAULT 'new' NOT NULL,
	"sales_stage_updated_at" timestamp with time zone,
	"sales_stage_updated_by" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_kind" DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"role" "organization_membership_role" DEFAULT 'producer' NOT NULL,
	"is_owner" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"status" "school_status" DEFAULT 'active' NOT NULL,
	"plan_tier" "school_plan_tier" DEFAULT 'starter' NOT NULL,
	"display_name" varchar(255),
	"logo_url" text,
	"storage_mode" "storage_mode" DEFAULT 'object_storage' NOT NULL,
	"drive_shared_drive_id" varchar(128),
	"drive_root_folder_id" varchar(128),
	"drive_connected_at" timestamp with time zone,
	"student_accounts_enabled" boolean DEFAULT false NOT NULL,
	"quick_upload_mode_allowed" boolean DEFAULT true NOT NULL,
	"student_username_format" varchar(80),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"project_name" varchar(255) NOT NULL,
	"episode_title" varchar(255),
	"client_name" varchar(255),
	"recording_date" varchar(50),
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"description" text,
	"editor_notes" text,
	"expected_camera_count" integer,
	"expected_audio_setup" varchar(100),
	"class_group" varchar(120),
	"lesson_type" varchar(40),
	"student_instructions" text,
	"upload_method" varchar(40),
	"due_date" varchar(50),
	"submission_status" "submission_status" DEFAULT 'draft' NOT NULL,
	"student_workflow_choice" "student_workflow_choice",
	"student_workflow_choice_at" timestamp,
	"project_workflow_type" "project_workflow_type" DEFAULT 'general_video' NOT NULL,
	"access_mode" "project_access_mode" DEFAULT 'quick_upload' NOT NULL,
	"storage_mode" "storage_mode" DEFAULT 'object_storage' NOT NULL,
	"drive_folder_id" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" varchar(100),
	"mic_label" varchar(100),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"original_file_name" varchar(500) NOT NULL,
	"clean_file_name" varchar(500),
	"file_type" "file_type" DEFAULT 'other' NOT NULL,
	"media_role" varchar(100),
	"file_size" bigint DEFAULT 0 NOT NULL,
	"duration" integer,
	"upload_status" "upload_status" DEFAULT 'pending' NOT NULL,
	"processing_status" "processing_status" DEFAULT 'uploaded' NOT NULL,
	"proxy_file_url" text,
	"thumbnail_url" text,
	"storage_path" text,
	"drive_file_id" varchar(128),
	"drive_web_view_link" text,
	"public_url" text,
	"notes" text,
	"checksum" varchar(64),
	"uploaded_at" timestamp,
	"uploader_kind" "media_uploader_kind" DEFAULT 'user' NOT NULL,
	"student_uploader_name" varchar(120),
	"student_upload_code_id" integer,
	"uploader_student_account_id" integer,
	"submitted_at" timestamp with time zone,
	"submission_id" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editor_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"share_token" varchar(128) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"password" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "editor_shares_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"organization_id" integer,
	"user_id" integer,
	"actor_kind" "activity_actor_kind" NOT NULL,
	"actor_student_account_id" integer,
	"ip_hash" varchar(64),
	"action" varchar(100) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"batch_label" varchar(255),
	"total_files" integer DEFAULT 0 NOT NULL,
	"uploaded_files" integer DEFAULT 0 NOT NULL,
	"failed_files" integer DEFAULT 0 NOT NULL,
	"total_bytes" bigint DEFAULT 0 NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recording_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"status" "recording_session_status" DEFAULT 'idle' NOT NULL,
	"source" "recording_session_source" DEFAULT 'simulated' NOT NULL,
	"label" varchar(255),
	"started_at" timestamp,
	"stopped_at" timestamp,
	"duration_ms" integer,
	"file_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_message" varchar(1000),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_upload_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"code" varchar(16) NOT NULL,
	"status" "student_upload_code_status" DEFAULT 'active' NOT NULL,
	"max_uploads" integer,
	"upload_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"year_level" varchar(20),
	"subject" varchar(80),
	"external_ref" varchar(120),
	"archived_at" timestamp with time zone,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"username" varchar(80) NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"given_name" varchar(80),
	"family_name" varchar(80),
	"password_hash" text NOT NULL,
	"password_must_change" boolean DEFAULT true NOT NULL,
	"email" varchar(255),
	"status" "student_account_status" DEFAULT 'active' NOT NULL,
	"archived_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_password_resets" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_account_id" integer NOT NULL,
	"issued_temp_password_hash" text NOT NULL,
	"issued_by_user_id" integer NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "class_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"student_account_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"role" varchar(32) DEFAULT 'student' NOT NULL,
	"added_by_user_id" integer NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_class_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"class_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"can_upload" boolean DEFAULT true NOT NULL,
	"can_view_own" boolean DEFAULT true NOT NULL,
	"can_view_class" boolean DEFAULT false NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"added_by_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_student_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"student_account_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"can_upload" boolean DEFAULT true NOT NULL,
	"can_view_own" boolean DEFAULT true NOT NULL,
	"added_by_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"student_account_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_hash" varchar(64),
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "student_project_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" varchar(64) NOT NULL,
	"student_account_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"file_count" integer DEFAULT 0 NOT NULL,
	"total_bytes" bigint DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reopened_at" timestamp with time zone,
	"reopened_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "student_project_submissions_submission_id_unique" UNIQUE("submission_id")
);
--> statement-breakpoint
CREATE TABLE "helper_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"device_label" varchar(120) NOT NULL,
	"status" "helper_device_status" DEFAULT 'active' NOT NULL,
	"api_key_hash" varchar(64) NOT NULL,
	"hostname" varchar(255),
	"os_version" varchar(64),
	"helper_version" varchar(32),
	"paired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paired_by_user_id" integer NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"last_uptime_sec" integer,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helper_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"event_id" varchar(64) NOT NULL,
	"kind" varchar(64) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_label" varchar(120),
	"ts" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helper_pairing_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"code" varchar(16) NOT NULL,
	"device_label" varchar(120) NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_device_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timelines" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"student_account_id" integer,
	"smart_draft_generated" boolean DEFAULT false NOT NULL,
	"provider" varchar(40),
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "render_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"timeline_id" integer,
	"provider" "render_provider" NOT NULL,
	"kind" "render_job_kind" DEFAULT 'smart_draft' NOT NULL,
	"status" "render_job_status" DEFAULT 'queued' NOT NULL,
	"external_job_id" varchar(200),
	"preview_url" text,
	"final_export_url" text,
	"error_message" text,
	"raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_shares" ADD CONSTRAINT "editor_shares_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_batches" ADD CONSTRAINT "upload_batches_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_sessions" ADD CONSTRAINT "recording_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_sessions" ADD CONSTRAINT "recording_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_sessions" ADD CONSTRAINT "recording_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_upload_codes" ADD CONSTRAINT "student_upload_codes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_upload_codes" ADD CONSTRAINT "student_upload_codes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_upload_codes" ADD CONSTRAINT "student_upload_codes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_accounts" ADD CONSTRAINT "student_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_accounts" ADD CONSTRAINT "student_accounts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_password_resets" ADD CONSTRAINT "student_password_resets_student_account_id_student_accounts_id_fk" FOREIGN KEY ("student_account_id") REFERENCES "public"."student_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_password_resets" ADD CONSTRAINT "student_password_resets_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_memberships" ADD CONSTRAINT "class_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_memberships" ADD CONSTRAINT "class_memberships_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_memberships" ADD CONSTRAINT "class_memberships_class_org_fk" FOREIGN KEY ("class_id","organization_id") REFERENCES "public"."classes"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_memberships" ADD CONSTRAINT "class_memberships_student_org_fk" FOREIGN KEY ("student_account_id","organization_id") REFERENCES "public"."student_accounts"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_class_access" ADD CONSTRAINT "project_class_access_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_class_access" ADD CONSTRAINT "project_class_access_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_class_access" ADD CONSTRAINT "project_class_access_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "public"."projects"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_class_access" ADD CONSTRAINT "project_class_access_class_org_fk" FOREIGN KEY ("class_id","organization_id") REFERENCES "public"."classes"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_student_access" ADD CONSTRAINT "project_student_access_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_student_access" ADD CONSTRAINT "project_student_access_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_student_access" ADD CONSTRAINT "project_student_access_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "public"."projects"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_student_access" ADD CONSTRAINT "project_student_access_student_org_fk" FOREIGN KEY ("student_account_id","organization_id") REFERENCES "public"."student_accounts"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_sessions" ADD CONSTRAINT "student_sessions_student_account_id_student_accounts_id_fk" FOREIGN KEY ("student_account_id") REFERENCES "public"."student_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_sessions" ADD CONSTRAINT "student_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_devices" ADD CONSTRAINT "helper_devices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_devices" ADD CONSTRAINT "helper_devices_paired_by_user_id_users_id_fk" FOREIGN KEY ("paired_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_devices" ADD CONSTRAINT "helper_devices_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_events" ADD CONSTRAINT "helper_events_device_id_helper_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."helper_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_events" ADD CONSTRAINT "helper_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_pairing_codes" ADD CONSTRAINT "helper_pairing_codes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_pairing_codes" ADD CONSTRAINT "helper_pairing_codes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_pairing_codes" ADD CONSTRAINT "helper_pairing_codes_consumed_device_id_helper_devices_id_fk" FOREIGN KEY ("consumed_device_id") REFERENCES "public"."helper_devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timelines" ADD CONSTRAINT "timelines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_timeline_id_timelines_id_fk" FOREIGN KEY ("timeline_id") REFERENCES "public"."timelines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_submissions_source_email_created_idx" ON "contact_submissions" USING btree ("source","email","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_memberships_user_org_unique" ON "organization_memberships" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_id_org_unique" ON "projects" USING btree ("id","organization_id");--> statement-breakpoint
CREATE INDEX "activity_logs_org_idx" ON "activity_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_actor_student_idx" ON "activity_logs" USING btree ("actor_student_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_upload_codes_code_unique" ON "student_upload_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "student_upload_codes_project_idx" ON "student_upload_codes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "student_upload_codes_org_idx" ON "student_upload_codes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "classes_org_idx" ON "classes" USING btree ("organization_id","archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "classes_id_org_unique" ON "classes" USING btree ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_accounts_org_username_unique" ON "student_accounts" USING btree ("organization_id","username");--> statement-breakpoint
CREATE INDEX "student_accounts_org_status_idx" ON "student_accounts" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "student_accounts_id_org_unique" ON "student_accounts" USING btree ("id","organization_id");--> statement-breakpoint
CREATE INDEX "student_password_resets_student_idx" ON "student_password_resets" USING btree ("student_account_id");--> statement-breakpoint
CREATE INDEX "class_memberships_class_student_idx" ON "class_memberships" USING btree ("class_id","student_account_id");--> statement-breakpoint
CREATE INDEX "class_memberships_student_idx" ON "class_memberships" USING btree ("student_account_id");--> statement-breakpoint
CREATE INDEX "class_memberships_org_idx" ON "class_memberships" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_class_access_unique" ON "project_class_access" USING btree ("project_id","class_id");--> statement-breakpoint
CREATE INDEX "project_class_access_org_idx" ON "project_class_access" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_student_access_unique" ON "project_student_access" USING btree ("project_id","student_account_id");--> statement-breakpoint
CREATE INDEX "project_student_access_org_idx" ON "project_student_access" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "student_sessions_student_idx" ON "student_sessions" USING btree ("student_account_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "helper_devices_api_key_hash_unique" ON "helper_devices" USING btree ("api_key_hash");--> statement-breakpoint
CREATE INDEX "helper_devices_org_idx" ON "helper_devices" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "helper_events_device_event_id_unique" ON "helper_events" USING btree ("device_id","event_id");--> statement-breakpoint
CREATE INDEX "helper_events_device_ts_idx" ON "helper_events" USING btree ("device_id","ts");--> statement-breakpoint
CREATE INDEX "helper_events_org_ts_idx" ON "helper_events" USING btree ("organization_id","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "helper_pairing_codes_code_unique" ON "helper_pairing_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "helper_pairing_codes_org_idx" ON "helper_pairing_codes" USING btree ("organization_id");