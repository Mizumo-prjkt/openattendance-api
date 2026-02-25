import psycopg2

def run_hotpatch():
    # Hardcoded configuration as requested
    db_user = "admin"
    db_password = "12345678"
    db_host = "localhost"
    db_name = "openattendance"
    db_port = 5432

    print(f"Connecting to Postgres at {db_host}:{db_port}/{db_name} as {db_user}...")
    
    try:
        conn = psycopg2.connect(
            user=db_user,
            host=db_host,
            database=db_name,
            password=db_password,
            port=db_port
        )
        conn.autocommit = True
        cur = conn.cursor()
        print("Purging database (dropping public schema)...")
        cur.execute("DROP SCHEMA public CASCADE;")
        cur.execute("CREATE SCHEMA public;")
        print("Database purged and schema recreated.")
        print("Connected successfully.")

        print("Applying Main Schema...")
        schema_sql = """
-- 1. Students
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    last_name TEXT,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    phone_number TEXT,
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relationship TEXT CHECK (emergency_contact_relationship IN ('parent', 'guardian')),
    student_id TEXT NOT NULL UNIQUE,
    qr_code_token TEXT UNIQUE,
    profile_image_path TEXT,
    classroom_section TEXT,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    gender TEXT CHECK (gender IN('Male', 'Female', 'Other'))
);

-- 2. Configurations
CREATE TABLE IF NOT EXISTS configurations (
    config_id SERIAL PRIMARY KEY,
    school_name TEXT NOT NULL,
    school_type TEXT CHECK (school_type IN ('public', 'private', 'charter', 'international')),
    school_id TEXT,
    address TEXT,
    logo_directory TEXT,
    organization_hotline TEXT,
    country_code TEXT NOT NULL,
    created_config_date TEXT,
    principal_name TEXT,
    principal_title TEXT DEFAULT 'School Principal',
    school_year TEXT DEFAULT '2026-2027',
    fixed_weekday_schedule BOOLEAN DEFAULT TRUE,
    time_source TEXT DEFAULT 'ntp' CHECK (time_source IN ('ntp', 'server', 'client')),
    time_zone_offset INTEGER DEFAULT 0,
    auto_time_zone BOOLEAN DEFAULT TRUE,
    ntp_server TEXT DEFAULT 'pool.ntp.org',
    enable_utc_correction BOOLEAN DEFAULT TRUE,
    fallback_source TEXT DEFAULT 'server' CHECK (fallback_source IN ('server', 'client'))
);

-- 3. Staff Accounts (Created before others to satisfy FK constraints)
CREATE TABLE IF NOT EXISTS staff_accounts (
    id SERIAL PRIMARY KEY,
    staff_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone_number TEXT,
    email_address TEXT UNIQUE,
    staff_type TEXT NOT NULL CHECK (staff_type IN ('student_council', 'teacher', 'security', 'admin')),
    teacher_type TEXT,
    adviser_unit TEXT,
    profile_image_path TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

-- 4. Excused
CREATE TABLE IF NOT EXISTS excused (
    excused_id SERIAL PRIMARY KEY,
    student_id TEXT NOT NULL,
    requester_staff_id TEXT NOT NULL,
    processor_id TEXT,
    processor_type TEXT CHECK (processor_type IN ('staff', 'admin')),
    reason TEXT NOT NULL,
    request_datetime TIMESTAMP NOT NULL,
    verdict_datetime TIMESTAMP,
    result TEXT NOT NULL CHECK (result IN ('pending', 'excused', 'rejected')) DEFAULT 'pending',
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (requester_staff_id) REFERENCES staff_accounts(staff_id)
);

-- 5. Present
CREATE TABLE IF NOT EXISTS present (
    present_id SERIAL PRIMARY KEY,
    student_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    time_in TIMESTAMP NOT NULL,
    time_out TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (staff_id) REFERENCES staff_accounts(staff_id)
);

-- 6. Absent
CREATE TABLE IF NOT EXISTS absent (
    absent_id SERIAL PRIMARY KEY,
    student_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    reason TEXT,
    absent_datetime TIMESTAMP NOT NULL,
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (staff_id) REFERENCES staff_accounts(staff_id)
);

-- 7. Staff Login Credentials
CREATE TABLE IF NOT EXISTS staff_login (
    login_id SERIAL PRIMARY KEY,
    staff_id TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    FOREIGN KEY (staff_id) REFERENCES staff_accounts(staff_id) ON DELETE CASCADE
);

-- 8. Events
CREATE TABLE IF NOT EXISTS events (
    event_id SERIAL PRIMARY KEY,
    event_name TEXT NOT NULL,
    event_description TEXT,
    location TEXT,
    start_datetime TIMESTAMP NOT NULL,
    end_datetime TIMESTAMP NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('planned', 'ongoing', 'completed', 'cancelled')) DEFAULT 'planned',
    created_by_staff_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_staff_id) REFERENCES staff_accounts(staff_id)
);

-- 9. Event Attendees
CREATE TABLE IF NOT EXISTS event_attendees (
    event_attendee_id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    student_id TEXT NOT NULL,
    check_in_time TIMESTAMP NOT NULL,
    check_out_time TIMESTAMP,
    checked_in_by_staff_id TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (checked_in_by_staff_id) REFERENCES staff_accounts(staff_id),
    UNIQUE (event_id, student_id)
);

-- 10. Granular Daily Attendance Logs
CREATE TABLE IF NOT EXISTS daily_attendance_logs (
    log_id SERIAL PRIMARY KEY,
    student_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    log_date DATE NOT NULL,
    log_slot TEXT NOT NULL CHECK (log_slot IN ('morning_in', 'morning_out', 'afternoon_in', 'afternoon_out', 'evening_in', 'evening_out')),
    log_time TIME NOT NULL,
    log_datetime TIMESTAMP NOT NULL,
    UNIQUE(student_id, log_date, log_slot),
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (staff_id) REFERENCES staff_accounts(staff_id)
);

-- 11. System Logs
CREATE TABLE IF NOT EXISTS system_logs (
    log_id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    level TEXT NOT NULL CHECK (level IN ('INFO', 'DEBUG', 'WARN', 'ERROR', 'FATAL')),
    message TEXT NOT NULL,
    source TEXT,
    details TEXT
);

-- 12. SMS Provider Settings
CREATE TABLE IF NOT EXISTS sms_provider_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    provider_type TEXT CHECK (provider_type IN ('api', 'usb')),
    provider_name TEXT NOT NULL,
    api_url TEXT,
    api_key TEXT,
    sender_name TEXT,
    tty_path TEXT,
    baud_rate INTEGER,
    message_template TEXT,
    curl_config_json JSONB,
    sms_enabled BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Sections (Classes)
CREATE TABLE IF NOT EXISTS sections (
    section_id SERIAL PRIMARY KEY,
    section_name TEXT NOT NULL UNIQUE,
    adviser_staff_id TEXT,
    room_number TEXT,
    grade_level INTEGER,
    strand TEXT,
    schedule_data JSONB,
    allowed_days TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (adviser_staff_id) REFERENCES staff_accounts(staff_id) ON DELETE SET NULL
);

-- 14. SMS Logs
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

-- 15. Single Index Performance Table
CREATE TABLE IF NOT EXISTS perf_test_single_idx (
    id SERIAL PRIMARY KEY,
    data TEXT,
    indexed_col INT
);
CREATE INDEX IF NOT EXISTS idx_perf_single ON perf_test_single_idx(indexed_col);

-- 16. Multi-Index Performance Table
CREATE TABLE IF NOT EXISTS perf_test_multi_idx (
    id SERIAL PRIMARY KEY,
    data TEXT,
    col1 INT,
    col2 INT,
    col3 TEXT
);
CREATE INDEX IF NOT EXISTS idx_perf_multi_1 ON perf_test_multi_idx(col1);
CREATE INDEX IF NOT EXISTS idx_perf_multi_2 ON perf_test_multi_idx(col2);
CREATE INDEX IF NOT EXISTS idx_perf_multi_3 ON perf_test_multi_idx(col3);

-- 17. Random Access Tables
CREATE TABLE IF NOT EXISTS perf_test_random_1 (id SERIAL PRIMARY KEY, val TEXT);
CREATE TABLE IF NOT EXISTS perf_test_random_2 (id SERIAL PRIMARY KEY, val TEXT);
CREATE TABLE IF NOT EXISTS perf_test_random_3 (id SERIAL PRIMARY KEY, val TEXT);

-- 18. Barrage/Concurrency Table
CREATE TABLE IF NOT EXISTS perf_test_barrage (id SERIAL PRIMARY KEY, val TIMESTAMP);

-- 19. Size Growth Table
CREATE TABLE IF NOT EXISTS perf_test_size_growth (id SERIAL PRIMARY KEY, payload TEXT);

-- 20. Router Settings
CREATE TABLE IF NOT EXISTS router_settings (
    id SERIAL PRIMARY KEY,
    router_url TEXT DEFAULT 'http://192.168.8.1/',
    username TEXT DEFAULT 'admin',
    password TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
        """
        cur.execute(schema_sql)
        print("Schema applied successfully!")


        print("Applying Database Migration...")
        migration_sql = """
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

ALTER TABLE students ALTER COLUMN gender TYPE TEXT;
ALTER TABLE students ALTER COLUMN status TYPE TEXT;
ALTER TABLE students ALTER COLUMN emergency_contact_relationship TYPE TEXT;
UPDATE students SET gender = 'Male' WHERE gender ILIKE 'male';
UPDATE students SET gender = 'Female' WHERE gender ILIKE 'female';
UPDATE students SET gender = 'Other' WHERE gender ILIKE 'other';
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
    allowed_days TEXT,
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
ALTER TABLE present ADD COLUMN IF NOT EXISTS location TEXT;
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

-- 21. Add Huawei Router Settings
CREATE TABLE IF NOT EXISTS router_settings (
    id SERIAL PRIMARY KEY,
    router_url TEXT DEFAULT 'http://192.168.8.1/',
    username TEXT DEFAULT 'admin',
    password TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
        """
        cur.execute(migration_sql)
        print("Migration applied successfully!")

        # Apply specific tables discovered from server.js for maximum assurance.
        print("Applying dynamic schema rules from server.js...")
        server_js_extra = [
            "CREATE TABLE IF NOT EXISTS calendar_config (id SERIAL PRIMARY KEY, country TEXT DEFAULT 'PH', state TEXT, region TEXT);",
            "CREATE TABLE IF NOT EXISTS calendar_custom_holidays (id SERIAL PRIMARY KEY, name TEXT NOT NULL, date TEXT NOT NULL, type TEXT DEFAULT 'event');",
            "ALTER TABLE sms_provider_settings ADD COLUMN IF NOT EXISTS modem_ip TEXT;",
            "ALTER TABLE sms_provider_settings ADD COLUMN IF NOT EXISTS modem_password TEXT;",
            "ALTER TABLE sms_provider_settings ADD COLUMN IF NOT EXISTS curl_config_json TEXT;",
            "ALTER TABLE configurations ADD COLUMN IF NOT EXISTS db_version TEXT DEFAULT '0.0.0';",
            "ALTER TABLE configurations ADD COLUMN IF NOT EXISTS ntp_server TEXT DEFAULT 'pool.ntp.org';",
            "ALTER TABLE configurations ADD COLUMN IF NOT EXISTS time_in_start TIME DEFAULT '06:00:00';",
            "ALTER TABLE configurations ADD COLUMN IF NOT EXISTS time_late_threshold TIME DEFAULT '08:00:00';",
            "ALTER TABLE configurations ADD COLUMN IF NOT EXISTS time_out_target TIME DEFAULT '16:00:00';",
            "ALTER TABLE configurations ADD COLUMN IF NOT EXISTS fixed_weekday_schedule BOOLEAN DEFAULT TRUE;",
            "ALTER TABLE configurations ADD COLUMN IF NOT EXISTS strict_attendance_window BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE configurations ADD COLUMN IF NOT EXISTS time_source TEXT DEFAULT 'ntp';",
            "ALTER TABLE configurations ADD COLUMN IF NOT EXISTS fallback_source TEXT DEFAULT 'server';",
            "ALTER TABLE configurations ADD COLUMN IF NOT EXISTS enable_utc_correction BOOLEAN DEFAULT true;",
            "ALTER TABLE configurations ADD COLUMN IF NOT EXISTS auto_time_zone BOOLEAN DEFAULT true;",
            "ALTER TABLE configurations ADD COLUMN IF NOT EXISTS time_zone_offset INTEGER DEFAULT 0;",
            "ALTER TABLE configurations ADD COLUMN IF NOT EXISTS cert_expiry_date TIMESTAMP;",
            "ALTER TABLE configurations ADD COLUMN IF NOT EXISTS feature_event_based BOOLEAN DEFAULT TRUE;",
            "ALTER TABLE configurations ADD COLUMN IF NOT EXISTS feature_id_generation BOOLEAN DEFAULT TRUE;",
            "ALTER TABLE configurations ADD COLUMN IF NOT EXISTS feature_sf2_generation BOOLEAN DEFAULT TRUE;",
            "ALTER TABLE present ADD COLUMN IF NOT EXISTS time_in_client TEXT;",
            "ALTER TABLE present ADD COLUMN IF NOT EXISTS time_in_server TIMESTAMP;",
            "ALTER TABLE present ADD COLUMN IF NOT EXISTS time_out_client TEXT;",
            "ALTER TABLE present ADD COLUMN IF NOT EXISTS time_out_server TIMESTAMP;",
            "ALTER TABLE event_attendance ADD COLUMN IF NOT EXISTS time_in_client TEXT;",
            "ALTER TABLE event_attendance ADD COLUMN IF NOT EXISTS time_in_server TIMESTAMP;",
            "ALTER TABLE event_attendance ADD COLUMN IF NOT EXISTS time_out_client TEXT;",
            "ALTER TABLE event_attendance ADD COLUMN IF NOT EXISTS time_out_server TIMESTAMP;",
            "ALTER TABLE event_attendance ADD COLUMN IF NOT EXISTS time_out TIMESTAMP;",
            "ALTER TABLE present ADD COLUMN IF NOT EXISTS time_out TIMESTAMP;",
            "ALTER TABLE staff_login ADD COLUMN IF NOT EXISTS security_question TEXT;",
            "ALTER TABLE staff_login ADD COLUMN IF NOT EXISTS security_answer TEXT;",
            "ALTER TABLE staff_login ADD COLUMN IF NOT EXISTS recovery_code TEXT;",
            "ALTER TABLE absent ALTER COLUMN staff_id DROP NOT NULL;",
            "ALTER TABLE events ALTER COLUMN created_by_staff_id DROP NOT NULL;"
        ]

        for stmt in server_js_extra:
            try:
                cur.execute(stmt)
            except Exception as e:
                # Ignore duplicate column / table errors safely
                pass
                
        print("Dynamic schema rules applied safely.")
                
        cur.close()
        conn.close()
        print("Database hotpatch completed successfully.")

    except Exception as e:
        print(f"Failed to connect or apply hotpatch: {e}")

if __name__ == '__main__':
    run_hotpatch()