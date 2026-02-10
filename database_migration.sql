-- api/database_migration.sql
-- Migration Script: Upgrade Database Schema
-- Run this to update an existing database to the latest structure
-- Hotfix Requirement!!!

BEGIN;

-- 1. Update sms_provider_settings
ALTER TABLE sms_provider_settings ADD COLUMN IF NOT EXISTS provider_type TEXT CHECK (provider_type IN ('api', 'usb'));
ALTER TABLE sms_provider_settings ADD COLUMN IF NOT EXISTS api_url TEXT;
ALTER TABLE sms_provider_settings ADD COLUMN IF NOT EXISTS api_key TEXT;
ALTER TABLE sms_provider_settings ADD COLUMN IF NOT EXISTS tty_path TEXT;
ALTER TABLE sms_provider_settings ADD COLUMN IF NOT EXISTS baud_rate INTEGER;
ALTER TABLE sms_provider_settings ADD COLUMN IF NOT EXISTS message_template TEXT;
ALTER TABLE sms_provider_settings ADD COLUMN IF NOT EXISTS curl_config_json JSONB;
ALTER TABLE sms_provider_settings ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT FALSE;

-- 2. Update students
ALTER TABLE students ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('Male', 'Female', 'Other'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT CHECK (emergency_contact_relationship IN ('parent', 'guardian'));

-- Fix gender constraint to ensure it matches Title Case
-- First, sanitize existing data to prevent constraint violation errors during migration
-- Ensure columns are TEXT to avoid padding issues (CHAR vs TEXT)
ALTER TABLE students ALTER COLUMN gender TYPE TEXT;
ALTER TABLE students ALTER COLUMN status TYPE TEXT;
ALTER TABLE students ALTER COLUMN emergency_contact_relationship TYPE TEXT;
UPDATE students SET gender = 'Male' WHERE gender ILIKE 'male';
UPDATE students SET gender = 'Female' WHERE gender ILIKE 'female';
UPDATE students SET gender = 'Other' WHERE gender ILIKE 'other';
-- then we proceed to fix it.
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_gender_check;
ALTER TABLE students ADD CONSTRAINT students_gender_check CHECK (gender IN ('Male', 'Female', 'Other'));


-- 3. Update configurations
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS school_id TEXT;

-- 4. Create sections table
CREATE TABLE IF NOT EXISTS sections (
    section_id SERIAL PRIMARY KEY,
    section_name TEXT NOT NULL UNIQUE,
    adviser_staff_id TEXT,
    room_number TEXT,
    schedule_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (adviser_staff_id) REFERENCES staff_accounts(staff_id)
);

-- 5. Create sms_logs table
CREATE TABLE IF NOT EXISTS sms_logs (
    sms_id SERIAL PRIMARY KEY,
    recipient_number TEXT NOT NULL,
    recipient_name TEXT,
    related_student_id TEXT,
    message_body TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,
    FOREIGN KEY (related_student_id) REFERENCES students(student_id)
);

-- 6. Update staff_accounts check constraint to allow 'admin'
ALTER TABLE staff_accounts DROP CONSTRAINT IF EXISTS staff_accounts_staff_type_check;
ALTER TABLE staff_accounts ADD CONSTRAINT staff_accounts_staff_type_check CHECK (staff_type IN ('student_council', 'teacher', 'security', 'admin'));

-- 7. Update sections to include grade_level and strand
ALTER TABLE sections ADD COLUMN IF NOT EXISTS grade_level INTEGER;
ALTER TABLE sections ADD COLUMN IF NOT EXISTS strand TEXT;

-- 8. Create events table
CREATE TABLE IF NOT EXISTS events (
    event_id SERIAL PRIMARY KEY,
    event_name TEXT NOT NULL,
    location TEXT,
    start_datetime TIMESTAMP,
    status TEXT CHECK (status IN ('planned', 'ongoing', 'completed', 'cancelled')),
    attendee_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


COMMIT;
