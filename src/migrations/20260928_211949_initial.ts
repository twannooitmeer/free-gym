import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('nl', 'en');
  CREATE TYPE "public"."enum_customers_membership_status" AS ENUM('none', 'trial', 'active', 'paused', 'cancelled');
  CREATE TYPE "public"."enum_session_series_days_of_week" AS ENUM('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
  CREATE TYPE "public"."enum_session_series_frequency" AS ENUM('weekly');
  CREATE TYPE "public"."enum_sessions_status" AS ENUM('scheduled', 'cancelled');
  CREATE TYPE "public"."enum_bookings_status" AS ENUM('confirmed', 'cancelled', 'attended', 'noshow');
  CREATE TYPE "public"."enum_bookings_source" AS ENUM('web', 'classpass', 'manual');
  CREATE TYPE "public"."enum_bookings_payment_status" AS ENUM('free', 'credit', 'unpaid', 'paid', 'refunded');
  CREATE TYPE "public"."enum_membership_types_billing_model" AS ENUM('unlimited', 'credits', 'period');
  CREATE TYPE "public"."enum_memberships_status" AS ENUM('active', 'paused', 'expired', 'cancelled');
  CREATE TYPE "public"."enum_integrations_provider" AS ENUM('classpass', 'custom');
  CREATE TYPE "public"."enum_settings_opening_hours_day" AS ENUM('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
  CREATE TYPE "public"."enum_email_provider" AS ENUM('resend', 'sendgrid');
  CREATE TABLE "admins_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "admins" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "customers_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"phone" varchar,
  	"date_of_birth" timestamp(3) with time zone,
  	"membership_status" "enum_customers_membership_status" DEFAULT 'none',
  	"notes" varchar,
  	"email_verified" boolean DEFAULT false,
  	"verification_code" varchar,
  	"verification_expires_at" timestamp(3) with time zone,
  	"verification_attempts" numeric DEFAULT 0,
  	"verification_sent_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "teachers_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "teachers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"bio" varchar,
  	"avatar_id" integer,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "session_types" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"color" varchar DEFAULT '#dc2626',
  	"price_cents" numeric DEFAULT 0 NOT NULL,
  	"covered_by_membership" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "session_types_locales" (
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "session_series_days_of_week" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_session_series_days_of_week",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "session_series_skip_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"reason" varchar
  );
  
  CREATE TABLE "session_series" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"active" boolean DEFAULT true,
  	"type_id" integer NOT NULL,
  	"teacher_id" integer NOT NULL,
  	"start_time" varchar DEFAULT '18:00' NOT NULL,
  	"duration_minutes" numeric DEFAULT 60 NOT NULL,
  	"capacity" numeric DEFAULT 16 NOT NULL,
  	"location" varchar,
  	"frequency" "enum_session_series_frequency" DEFAULT 'weekly' NOT NULL,
  	"interval" numeric DEFAULT 1,
  	"starts_on" timestamp(3) with time zone NOT NULL,
  	"ends_on" timestamp(3) with time zone,
  	"horizon_weeks" numeric DEFAULT 8,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "session_series_locales" (
  	"title" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type_id" integer NOT NULL,
  	"teacher_id" integer NOT NULL,
  	"starts_at" timestamp(3) with time zone NOT NULL,
  	"duration_minutes" numeric DEFAULT 60 NOT NULL,
  	"capacity" numeric DEFAULT 16 NOT NULL,
  	"location" varchar,
  	"status" "enum_sessions_status" DEFAULT 'scheduled' NOT NULL,
  	"series_id" integer,
  	"series_override" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "sessions_locales" (
  	"title" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "bookings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"customer_id" integer NOT NULL,
  	"session_id" integer NOT NULL,
  	"status" "enum_bookings_status" DEFAULT 'confirmed' NOT NULL,
  	"source" "enum_bookings_source" DEFAULT 'web' NOT NULL,
  	"payment_status" "enum_bookings_payment_status" DEFAULT 'free' NOT NULL,
  	"used_membership_id" integer,
  	"credits_used" numeric DEFAULT 0,
  	"amount_cents" numeric DEFAULT 0,
  	"external_id" varchar,
  	"check_in_code" varchar,
  	"checked_in_at" timestamp(3) with time zone,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "membership_types" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"billing_model" "enum_membership_types_billing_model" DEFAULT 'unlimited' NOT NULL,
  	"price_cents" numeric DEFAULT 0 NOT NULL,
  	"credits_included" numeric,
  	"validity_days" numeric,
  	"covers_all_types" boolean DEFAULT true,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "membership_types_locales" (
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "membership_types_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"session_types_id" integer
  );
  
  CREATE TABLE "memberships" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"customer_id" integer NOT NULL,
  	"type_id" integer NOT NULL,
  	"status" "enum_memberships_status" DEFAULT 'active' NOT NULL,
  	"starts_at" timestamp(3) with time zone NOT NULL,
  	"ends_at" timestamp(3) with time zone,
  	"credits_remaining" numeric,
  	"paid_amount_cents" numeric DEFAULT 0,
  	"payment_reference" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "integrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"provider" "enum_integrations_provider" NOT NULL,
  	"enabled" boolean DEFAULT false,
  	"config" jsonb,
  	"last_sync_at" timestamp(3) with time zone,
  	"last_sync_status" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" integer,
  	"customers_id" integer,
  	"teachers_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "settings_opening_hours" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"day" "enum_settings_opening_hours_day" NOT NULL,
  	"closed" boolean DEFAULT false,
  	"open" varchar DEFAULT '09:00',
  	"close" varchar DEFAULT '22:00'
  );
  
  CREATE TABLE "settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"gym_name" varchar DEFAULT 'Your Gym' NOT NULL,
  	"gym_contact_email" varchar,
  	"gym_contact_phone" varchar,
  	"gym_address" varchar,
  	"gym_default_location" varchar,
  	"gym_privacy_url" varchar,
  	"gym_terms_url" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "settings_locales" (
  	"gym_tagline" varchar,
  	"gym_about" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "theme" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"schedule_session_past" varchar DEFAULT '#141414',
  	"schedule_session_future" varchar DEFAULT '#262626',
  	"schedule_session_booked" varchar DEFAULT '#3d1414',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "email" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"provider" "enum_email_provider" DEFAULT 'resend' NOT NULL,
  	"from_address" varchar,
  	"api_key" varchar,
  	"verification_required" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "admins_sessions" ADD CONSTRAINT "admins_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_sessions" ADD CONSTRAINT "customers_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "teachers_sessions" ADD CONSTRAINT "teachers_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "teachers" ADD CONSTRAINT "teachers_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "session_types_locales" ADD CONSTRAINT "session_types_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."session_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "session_series_days_of_week" ADD CONSTRAINT "session_series_days_of_week_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."session_series"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "session_series_skip_dates" ADD CONSTRAINT "session_series_skip_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."session_series"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "session_series" ADD CONSTRAINT "session_series_type_id_session_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."session_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "session_series" ADD CONSTRAINT "session_series_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "session_series_locales" ADD CONSTRAINT "session_series_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."session_series"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_type_id_session_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."session_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_series_id_session_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."session_series"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sessions_locales" ADD CONSTRAINT "sessions_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_used_membership_id_memberships_id_fk" FOREIGN KEY ("used_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "membership_types_locales" ADD CONSTRAINT "membership_types_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."membership_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "membership_types_rels" ADD CONSTRAINT "membership_types_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."membership_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "membership_types_rels" ADD CONSTRAINT "membership_types_rels_session_types_fk" FOREIGN KEY ("session_types_id") REFERENCES "public"."session_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "memberships" ADD CONSTRAINT "memberships_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "memberships" ADD CONSTRAINT "memberships_type_id_membership_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."membership_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_teachers_fk" FOREIGN KEY ("teachers_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_opening_hours" ADD CONSTRAINT "settings_opening_hours_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_locales" ADD CONSTRAINT "settings_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "admins_sessions_order_idx" ON "admins_sessions" USING btree ("_order");
  CREATE INDEX "admins_sessions_parent_id_idx" ON "admins_sessions" USING btree ("_parent_id");
  CREATE INDEX "admins_updated_at_idx" ON "admins" USING btree ("updated_at");
  CREATE INDEX "admins_created_at_idx" ON "admins" USING btree ("created_at");
  CREATE UNIQUE INDEX "admins_email_idx" ON "admins" USING btree ("email");
  CREATE INDEX "customers_sessions_order_idx" ON "customers_sessions" USING btree ("_order");
  CREATE INDEX "customers_sessions_parent_id_idx" ON "customers_sessions" USING btree ("_parent_id");
  CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
  CREATE UNIQUE INDEX "customers_email_idx" ON "customers" USING btree ("email");
  CREATE INDEX "teachers_sessions_order_idx" ON "teachers_sessions" USING btree ("_order");
  CREATE INDEX "teachers_sessions_parent_id_idx" ON "teachers_sessions" USING btree ("_parent_id");
  CREATE INDEX "teachers_avatar_idx" ON "teachers" USING btree ("avatar_id");
  CREATE INDEX "teachers_updated_at_idx" ON "teachers" USING btree ("updated_at");
  CREATE INDEX "teachers_created_at_idx" ON "teachers" USING btree ("created_at");
  CREATE UNIQUE INDEX "teachers_email_idx" ON "teachers" USING btree ("email");
  CREATE UNIQUE INDEX "session_types_slug_idx" ON "session_types" USING btree ("slug");
  CREATE INDEX "session_types_updated_at_idx" ON "session_types" USING btree ("updated_at");
  CREATE INDEX "session_types_created_at_idx" ON "session_types" USING btree ("created_at");
  CREATE UNIQUE INDEX "session_types_locales_locale_parent_id_unique" ON "session_types_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "session_series_days_of_week_order_idx" ON "session_series_days_of_week" USING btree ("order");
  CREATE INDEX "session_series_days_of_week_parent_idx" ON "session_series_days_of_week" USING btree ("parent_id");
  CREATE INDEX "session_series_skip_dates_order_idx" ON "session_series_skip_dates" USING btree ("_order");
  CREATE INDEX "session_series_skip_dates_parent_id_idx" ON "session_series_skip_dates" USING btree ("_parent_id");
  CREATE INDEX "session_series_type_idx" ON "session_series" USING btree ("type_id");
  CREATE INDEX "session_series_teacher_idx" ON "session_series" USING btree ("teacher_id");
  CREATE INDEX "session_series_updated_at_idx" ON "session_series" USING btree ("updated_at");
  CREATE INDEX "session_series_created_at_idx" ON "session_series" USING btree ("created_at");
  CREATE UNIQUE INDEX "session_series_locales_locale_parent_id_unique" ON "session_series_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "sessions_type_idx" ON "sessions" USING btree ("type_id");
  CREATE INDEX "sessions_teacher_idx" ON "sessions" USING btree ("teacher_id");
  CREATE INDEX "sessions_starts_at_idx" ON "sessions" USING btree ("starts_at");
  CREATE INDEX "sessions_series_idx" ON "sessions" USING btree ("series_id");
  CREATE INDEX "sessions_updated_at_idx" ON "sessions" USING btree ("updated_at");
  CREATE INDEX "sessions_created_at_idx" ON "sessions" USING btree ("created_at");
  CREATE UNIQUE INDEX "sessions_locales_locale_parent_id_unique" ON "sessions_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id");
  CREATE INDEX "bookings_session_idx" ON "bookings" USING btree ("session_id");
  CREATE INDEX "bookings_used_membership_idx" ON "bookings" USING btree ("used_membership_id");
  CREATE INDEX "bookings_external_id_idx" ON "bookings" USING btree ("external_id");
  CREATE UNIQUE INDEX "bookings_check_in_code_idx" ON "bookings" USING btree ("check_in_code");
  CREATE INDEX "bookings_updated_at_idx" ON "bookings" USING btree ("updated_at");
  CREATE INDEX "bookings_created_at_idx" ON "bookings" USING btree ("created_at");
  CREATE UNIQUE INDEX "bookings_one_active_per_customer_session" ON "bookings" USING btree ("customer_id","session_id") WHERE "bookings"."status" <> 'cancelled';
  CREATE UNIQUE INDEX "membership_types_slug_idx" ON "membership_types" USING btree ("slug");
  CREATE INDEX "membership_types_updated_at_idx" ON "membership_types" USING btree ("updated_at");
  CREATE INDEX "membership_types_created_at_idx" ON "membership_types" USING btree ("created_at");
  CREATE UNIQUE INDEX "membership_types_locales_locale_parent_id_unique" ON "membership_types_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "membership_types_rels_order_idx" ON "membership_types_rels" USING btree ("order");
  CREATE INDEX "membership_types_rels_parent_idx" ON "membership_types_rels" USING btree ("parent_id");
  CREATE INDEX "membership_types_rels_path_idx" ON "membership_types_rels" USING btree ("path");
  CREATE INDEX "membership_types_rels_session_types_id_idx" ON "membership_types_rels" USING btree ("session_types_id");
  CREATE INDEX "memberships_customer_idx" ON "memberships" USING btree ("customer_id");
  CREATE INDEX "memberships_type_idx" ON "memberships" USING btree ("type_id");
  CREATE INDEX "memberships_updated_at_idx" ON "memberships" USING btree ("updated_at");
  CREATE INDEX "memberships_created_at_idx" ON "memberships" USING btree ("created_at");
  CREATE INDEX "integrations_updated_at_idx" ON "integrations" USING btree ("updated_at");
  CREATE INDEX "integrations_created_at_idx" ON "integrations" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_admins_id_idx" ON "payload_preferences_rels" USING btree ("admins_id");
  CREATE INDEX "payload_preferences_rels_customers_id_idx" ON "payload_preferences_rels" USING btree ("customers_id");
  CREATE INDEX "payload_preferences_rels_teachers_id_idx" ON "payload_preferences_rels" USING btree ("teachers_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "settings_opening_hours_order_idx" ON "settings_opening_hours" USING btree ("_order");
  CREATE INDEX "settings_opening_hours_parent_id_idx" ON "settings_opening_hours" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "settings_locales_locale_parent_id_unique" ON "settings_locales" USING btree ("_locale","_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "admins_sessions" CASCADE;
  DROP TABLE "admins" CASCADE;
  DROP TABLE "customers_sessions" CASCADE;
  DROP TABLE "customers" CASCADE;
  DROP TABLE "teachers_sessions" CASCADE;
  DROP TABLE "teachers" CASCADE;
  DROP TABLE "session_types" CASCADE;
  DROP TABLE "session_types_locales" CASCADE;
  DROP TABLE "session_series_days_of_week" CASCADE;
  DROP TABLE "session_series_skip_dates" CASCADE;
  DROP TABLE "session_series" CASCADE;
  DROP TABLE "session_series_locales" CASCADE;
  DROP TABLE "sessions" CASCADE;
  DROP TABLE "sessions_locales" CASCADE;
  DROP TABLE "bookings" CASCADE;
  DROP TABLE "membership_types" CASCADE;
  DROP TABLE "membership_types_locales" CASCADE;
  DROP TABLE "membership_types_rels" CASCADE;
  DROP TABLE "memberships" CASCADE;
  DROP TABLE "integrations" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "settings_opening_hours" CASCADE;
  DROP TABLE "settings" CASCADE;
  DROP TABLE "settings_locales" CASCADE;
  DROP TABLE "theme" CASCADE;
  DROP TABLE "email" CASCADE;
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_customers_membership_status";
  DROP TYPE "public"."enum_session_series_days_of_week";
  DROP TYPE "public"."enum_session_series_frequency";
  DROP TYPE "public"."enum_sessions_status";
  DROP TYPE "public"."enum_bookings_status";
  DROP TYPE "public"."enum_bookings_source";
  DROP TYPE "public"."enum_bookings_payment_status";
  DROP TYPE "public"."enum_membership_types_billing_model";
  DROP TYPE "public"."enum_memberships_status";
  DROP TYPE "public"."enum_integrations_provider";
  DROP TYPE "public"."enum_settings_opening_hours_day";
  DROP TYPE "public"."enum_email_provider";`)
}
