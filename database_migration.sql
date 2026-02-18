-- api/database_migration.sql
-- Migration Script: Upgrade Database Schema
-- Run this to update an existing database to the latest structure
-- Hotfix Requirement!!!

-- VERSION: 1.0.1

BEGIN;

-- 1. Update sms_provider_settings

CREATE TABLE IF NOT EXISTS sms_provider_settings (
    id SERIAL PRIMARY KEY,
    provider_type TEXT DEFAULT 'api',
    api_url TEXT,
    api_key TEXT,
    tty_path TEXT,
    baud_rate INTEGER,
    message_template TEXT,
    curl_config_json JSONB,
    sms_enabled BOOLEAN DEFAULT FALSE
);

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
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS fixed_weekday_schedule BOOLEAN DEFAULT TRUE;

-- 4. Create sections table
CREATE TABLE IF NOT EXISTS sections (
    section_id SERIAL PRIMARY KEY,
    section_name TEXT NOT NULL UNIQUE,
    adviser_staff_id TEXT,
    room_number TEXT,
    schedule_data JSONB,
    allowed_days TEXT, -- Stored as comma-separated days (e.g. "Mon,Wed,Fri") or indexes "1,3,5"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (adviser_staff_id) REFERENCES staff_accounts(staff_id) ON DELETE SET NULL
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

-- Hotfix for the events
ALTER TABLE events ADD COLUMN IF NOT EXISTS attendee_count INTEGER DEFAULT 0;

-- 9. Add end_datetime and event_type to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_datetime TIMESTAMP;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type TEXT;

-- 10. Add created_by_staff_id to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by_staff_id TEXT;

-- 11. Create event_staff table
CREATE TABLE IF NOT EXISTS event_staff (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    staff_id TEXT NOT NULL,
    role TEXT DEFAULT 'Staff',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staff_accounts(staff_id) ON DELETE CASCADE,
    UNIQUE(event_id, staff_id)
);

-- 12. Create event_attendance table
CREATE TABLE IF NOT EXISTS event_attendance (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    student_id TEXT NOT NULL,
    time_in TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    location TEXT,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- 13. Add security fields to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_hash TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS secure_mode BOOLEAN DEFAULT FALSE;

-- 14. Create event_notes table
CREATE TABLE IF NOT EXISTS event_notes (
    note_id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    staff_id TEXT,
    note_content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staff_accounts(staff_id) ON DELETE SET NULL
);

-- 15. Fix sections foreign key
ALTER TABLE sections DROP CONSTRAINT IF EXISTS sections_adviser_staff_id_fkey;
ALTER TABLE sections ADD CONSTRAINT sections_adviser_staff_id_fkey FOREIGN KEY (adviser_staff_id) REFERENCES staff_accounts(staff_id) ON DELETE SET NULL;

-- 16. Update configurations for ID Cards
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS principal_name TEXT;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS principal_title TEXT DEFAULT 'School Principal';
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2024-2025';

-- 17. Maintenance Mode
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT FALSE;

-- 18. Attendance Present and event checks
ALTEER TABLE present ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE event_attendance ADD COLUMN IF NOT EXISTS location TEXT;

-- 19. Calendar Config and Holidays
CREATE TABLE IF NOT EXISTS calendar_config (
    id SERIAL PRIMARY KEY,
    country TEXT DEFAULT 'PH',
    state TEXT,
    region TEXT
);

CREATE TABLE IF NOT EXISTS calendar_custom_holidays (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT DEFAULT 'event'
);


-- 20. Add Time Configuration Columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configurations' AND column_name='time_source') THEN
        ALTER TABLE configurations ADD COLUMN time_source TEXT DEFAULT 'ntp' CHECK (time_source IN ('ntp', 'server', 'client'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configurations' AND column_name='time_zone_offset') THEN
        ALTER TABLE configurations ADD COLUMN time_zone_offset INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configurations' AND column_name='auto_time_zone') THEN
        ALTER TABLE configurations ADD COLUMN auto_time_zone BOOLEAN DEFAULT TRUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configurations' AND column_name='ntp_server') THEN
        ALTER TABLE configurations ADD COLUMN ntp_server TEXT DEFAULT 'pool.ntp.org';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configurations' AND column_name='enable_utc_correction') THEN
        ALTER TABLE configurations ADD COLUMN enable_utc_correction BOOLEAN DEFAULT TRUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configurations' AND column_name='fallback_source') THEN
        ALTER TABLE configurations ADD COLUMN fallback_source TEXT DEFAULT 'server' CHECK (fallback_source IN ('server', 'client'));
    END IF;
END $$;

COMMIT;
