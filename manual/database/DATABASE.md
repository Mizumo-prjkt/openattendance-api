# OpenAttendance PostgreSQL Database Schema Guide

## Overview

The OpenAttendance system uses PostgreSQL with 13 interconnected tables to manage student attendance, staff accounts, events, and system operations. This document provides a comprehensive guide to the database structure, relationships, and usage.

**Database Name:** `openattendance`  
**Last Updated:** February 5, 2026

---

## Table of Contents

1. [Database Architecture](#database-architecture)
2. [Table Relationships](#table-relationships)
3. [Core Tables Documentation](#core-tables-documentation)
4. [Data Integrity Rules](#data-integrity-rules)

---

## Database Architecture

### System Components

```
Core Setup Layer
├── configurations          (School metadata)
└── admin_login            (Admin credentials)

Users Layer
├── students               (Student records)
└── staff_accounts         (Staff/Security records)
    └── staff_login        (Staff authentication)

Attendance Layer
├── present                (Check-in/out records)
├── absent                 (Absence records)
├── excused                (Excuse requests)
└── daily_attendance_logs  (Granular time logs)

Events Layer
├── events                 (Event definitions)
└── event_attendees        (Event attendance)

Operations Layer
├── benchmark_test         (Performance testing)
├── system_logs            (Activity logging)
└── sms_provider_settings  (SMS configuration)
```

---

## Table Relationships

### Entity Relationship Map

```
students ──→ present ──→ staff_accounts
          ├→ absent
          ├→ excused (requester_staff_id) ──→ staff_accounts
          ├→ daily_attendance_logs
          └→ event_attendees ──→ events ──→ staff_accounts

staff_accounts ──→ staff_login
```

---

## Core Tables Documentation

---

### 1. **students**

**Purpose:** Stores student profile information and QR code tokens for attendance tracking.

**Columns:**

| Column | Type | Nullable | Unique | Constraints | Description |
|--------|------|----------|--------|-------------|-------------|
| id | SERIAL | NO | YES (PK) | PRIMARY KEY | Auto-incrementing unique identifier |
| last_name | TEXT | YES | NO | — | Student's last name |
| first_name | TEXT | NO | NO | NOT NULL | Student's first name (required) |
| middle_name | TEXT | YES | NO | — | Student's middle name |
| phone_number | TEXT | YES | NO | — | Student's contact phone |
| address | TEXT | YES | NO | — | Student's residential address |
| emergency_contact_name | TEXT | YES | NO | — | Name of emergency contact |
| emergency_contact_phone | TEXT | YES | NO | — | Emergency contact phone number |
| emergency_contact_relationship | TEXT | YES | NO | CHECK | Must be 'parent' or 'guardian' |
| student_id | TEXT | NO | YES | NOT NULL, UNIQUE | Unique student identifier (e.g., STU001) |
| qr_code_token | TEXT | YES | YES | UNIQUE | UUID token for QR code generation |
| profile_image_path | TEXT | YES | NO | — | Path to student profile photo |
| classroom_section | TEXT | YES | NO | — | Classroom/section assignment |

**Key Relationships:**
- ✓ Referenced by: `present`, `absent`, `excused`, `daily_attendance_logs`, `event_attendees`
- ✗ References: None

**Indexes:**
- `id` (Primary Key)
- `student_id` (Unique)
- `qr_code_token` (Unique)

---

### 2. **staff_accounts**

**Purpose:** Maintains staff profile information including teachers, security personnel, and student council members.

**Columns:**

| Column | Type | Nullable | Unique | Constraints | Description |
|--------|------|----------|--------|-------------|-------------|
| id | SERIAL | NO | YES (PK) | PRIMARY KEY | Auto-incrementing unique identifier |
| staff_id | TEXT | NO | YES | NOT NULL, UNIQUE | Unique staff identifier (e.g., STAFF001) |
| name | TEXT | NO | NO | NOT NULL | Full name of staff member |
| phone_number | TEXT | YES | NO | — | Staff contact phone |
| email_address | TEXT | YES | YES | UNIQUE | Staff email (must be unique if provided) |
| staff_type | TEXT | NO | NO | NOT NULL, CHECK | One of: 'student_council', 'teacher', 'security' |
| teacher_type | TEXT | YES | NO | — | Type of teacher (e.g., subject, grade level) |
| adviser_unit | TEXT | YES | NO | — | Unit/grade the staff advises |
| profile_image_path | TEXT | YES | NO | — | Path to staff profile photo |
| active | INTEGER | NO | NO | NOT NULL, CHECK, DEFAULT 1 | Status: 1 (active) or 0 (inactive) |

**Key Relationships:**
- ✓ Referenced by: `staff_login`, `excused`, `present`, `absent`, `daily_attendance_logs`, `events`, `event_attendees`
- ✗ References: None

**Indexes:**
- `id` (Primary Key)
- `staff_id` (Unique)
- `email_address` (Unique)

---

### 3. **staff_login**

**Purpose:** Stores encrypted login credentials for staff account authentication.

**Columns:**

| Column | Type | Nullable | Unique | Constraints | Description |
|--------|------|----------|--------|-------------|-------------|
| login_id | SERIAL | NO | YES (PK) | PRIMARY KEY | Auto-incrementing unique identifier |
| staff_id | TEXT | NO | YES | NOT NULL, UNIQUE, FK | Reference to staff_accounts(staff_id) |
| username | TEXT | NO | YES | NOT NULL, UNIQUE | Unique login username |
| password | TEXT | NO | NO | NOT NULL | Bcrypt-hashed password (never plaintext) |

**Key Relationships:**
- ✓ References: `staff_accounts` (ON DELETE CASCADE) — Deleting staff removes login
- ✗ Referenced by: None

**Indexes:**
- `login_id` (Primary Key)
- `staff_id` (Unique, Foreign Key)
- `username` (Unique)

**Security Notes:**
- Passwords are hashed using bcrypt with 10 salt rounds
- Cascading delete ensures orphaned logins are removed when staff is deleted

---

### 4. **configurations**

**Purpose:** Stores school-wide configuration settings and metadata.

**Columns:**

| Column | Type | Nullable | Unique | Constraints | Description |
|--------|------|----------|--------|-------------|-------------|
| config_id | SERIAL | NO | YES (PK) | PRIMARY KEY | Auto-incrementing unique identifier |
| school_name | TEXT | NO | NO | NOT NULL | Official school name |
| school_type | TEXT | YES | NO | CHECK | One of: 'public', 'private', 'charter', 'international' |
| address | TEXT | YES | NO | — | School's physical address |
| logo_directory | TEXT | YES | NO | — | File path to school logo image |
| organization_hotline | TEXT | YES | NO | — | School contact hotline number |
| country_code | TEXT | NO | NO | NOT NULL | ISO country code (e.g., US, GB, IN) |
| created_config_date | TEXT | YES | NO | — | Configuration creation date/label |

**Key Relationships:**
- ✓ References: None
- ✗ Referenced by: None

**Notes:**
- Only one configuration record should exist in production
- Can be enforced with application logic
- Consider migrating `created_config_date` to TIMESTAMP or DATE for consistency

---

### 5. **present**

**Purpose:** Records student check-in and check-out times for attendance tracking.

**Columns:**

| Column | Type | Nullable | Unique | Constraints | Description |
|--------|------|----------|--------|-------------|-------------|
| present_id | SERIAL | NO | YES (PK) | PRIMARY KEY | Auto-incrementing unique identifier |
| student_id | TEXT | NO | NO | NOT NULL, FK | Reference to students(student_id) |
| staff_id | TEXT | NO | NO | NOT NULL, FK | Reference to staff_accounts(staff_id) |
| time_in | TIMESTAMP | NO | NO | NOT NULL | Check-in timestamp |
| time_out | TIMESTAMP | YES | NO | — | Check-out timestamp (nullable until student leaves) |

**Key Relationships:**
- ✓ References: 
  - `students` (student_id)
  - `staff_accounts` (staff_id)
- ✗ Referenced by: None

**Indexes:**
- `present_id` (Primary Key)
- Foreign Key: `student_id`
- Foreign Key: `staff_id`

**Usage Notes:**
- `time_in` is required when record is created
- `time_out` is updated when student leaves
- Staff member who recorded the check-in is tracked

---

### 6. **absent**

**Purpose:** Records student absences with reason and timestamp.

**Columns:**

| Column | Type | Nullable | Unique | Constraints | Description |
|--------|------|----------|--------|-------------|-------------|
| absent_id | SERIAL | NO | YES (PK) | PRIMARY KEY | Auto-incrementing unique identifier |
| student_id | TEXT | NO | NO | NOT NULL, FK | Reference to students(student_id) |
| staff_id | TEXT | NO | NO | NOT NULL, FK | Reference to staff_accounts(staff_id) |
| reason | TEXT | YES | NO | — | Reason for absence (e.g., sick, family emergency) |
| absent_datetime | TIMESTAMP | NO | NO | NOT NULL | When absence was recorded |

**Key Relationships:**
- ✓ References:
  - `students` (student_id)
  - `staff_accounts` (staff_id)
- ✗ Referenced by: None

**Indexes:**
- `absent_id` (Primary Key)
- Foreign Key: `student_id`
- Foreign Key: `staff_id`

---

### 7. **excused**

**Purpose:** Manages absence excuse requests from staff with approval workflow.

**Columns:**

| Column | Type | Nullable | Unique | Constraints | Description |
|--------|------|----------|--------|-------------|-------------|
| excused_id | SERIAL | NO | YES (PK) | PRIMARY KEY | Auto-incrementing unique identifier |
| student_id | TEXT | NO | NO | NOT NULL, FK | Reference to students(student_id) |
| requester_staff_id | TEXT | NO | NO | NOT NULL, FK | Staff member requesting the excuse |
| processor_id | TEXT | YES | NO | — | Admin or staff who processed the request |
| processor_type | TEXT | YES | NO | CHECK | One of: 'staff', 'admin' |
| reason | TEXT | NO | NO | NOT NULL | Reason for absence excuse request |
| request_datetime | TIMESTAMP | NO | NO | NOT NULL | When request was submitted |
| verdict_datetime | TIMESTAMP | YES | NO | — | When request was processed (NULL if pending) |
| result | TEXT | NO | NO | NOT NULL, CHECK, DEFAULT 'pending' | One of: 'pending', 'excused', 'rejected' |

**Key Relationships:**
- ✓ References:
  - `students` (student_id)
  - `staff_accounts` (requester_staff_id)
- ✗ Referenced by: None

**Indexes:**
- `excused_id` (Primary Key)
- Foreign Key: `student_id`
- Foreign Key: `requester_staff_id`

**Workflow:**
1. Request created with result = 'pending'
2. Admin/staff reviews and updates result to 'excused' or 'rejected'
3. `verdict_datetime` is set when processed
4. `processor_id` and `processor_type` record who processed it

---

### 8. **daily_attendance_logs**

**Purpose:** Provides granular time-slot based attendance logging (morning/afternoon/evening sessions).

**Columns:**

| Column | Type | Nullable | Unique | Constraints | Description |
|--------|------|----------|--------|-------------|-------------|
| log_id | SERIAL | NO | YES (PK) | PRIMARY KEY | Auto-incrementing unique identifier |
| student_id | TEXT | NO | NO | NOT NULL, FK | Reference to students(student_id) |
| staff_id | TEXT | NO | NO | NOT NULL, FK | Reference to staff_accounts(staff_id) |
| log_date | DATE | NO | NO | NOT NULL | Date of attendance |
| log_slot | TEXT | NO | NO | NOT NULL, CHECK | One of: 'morning_in', 'morning_out', 'afternoon_in', 'afternoon_out', 'evening_in', 'evening_out' |
| log_time | TIME | NO | NO | NOT NULL | Time of the log entry |
| log_datetime | TIMESTAMP | NO | NO | NOT NULL | Full timestamp of the log |
| UNIQUE | — | — | — | (student_id, log_date, log_slot) | One entry per student per slot per day |

**Key Relationships:**
- ✓ References:
  - `students` (student_id)
  - `staff_accounts` (staff_id)
- ✗ Referenced by: None

**Indexes:**
- `log_id` (Primary Key)
- Foreign Key: `student_id`
- Foreign Key: `staff_id`
- Composite Unique: (student_id, log_date, log_slot)

**Session Structure:**
- **Morning:** in/out
- **Afternoon:** in/out
- **Evening:** in/out

**Notes:**
- Prevents duplicate entries for the same student in the same slot on same day
- Enables detailed analysis of attendance patterns by session

---

### 9. **events**

**Purpose:** Defines school events and tracks their lifecycle (planned → ongoing → completed/cancelled).

**Columns:**

| Column | Type | Nullable | Unique | Constraints | Description |
|--------|------|----------|--------|-------------|-------------|
| event_id | SERIAL | NO | YES (PK) | PRIMARY KEY | Auto-incrementing unique identifier |
| event_name | TEXT | NO | NO | NOT NULL | Name of the event |
| event_description | TEXT | YES | NO | — | Detailed description of the event |
| location | TEXT | YES | NO | — | Physical location of the event |
| start_datetime | TIMESTAMP | NO | NO | NOT NULL | Event start time |
| end_datetime | TIMESTAMP | NO | NO | NOT NULL | Event end time |
| status | TEXT | NO | NO | NOT NULL, CHECK, DEFAULT 'planned' | One of: 'planned', 'ongoing', 'completed', 'cancelled' |
| created_by_staff_id | TEXT | NO | NO | NOT NULL, FK | Staff member who created the event |
| created_at | TIMESTAMP | NO | NO | DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | NO | NO | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Key Relationships:**
- ✓ References: `staff_accounts` (created_by_staff_id)
- ✗ Referenced by: `event_attendees`

**Indexes:**
- `event_id` (Primary Key)
- Foreign Key: `created_by_staff_id`

**Event Lifecycle:**
```
planned → ongoing → completed
   ↓→ cancelled
```

---

### 10. **event_attendees**

**Purpose:** Records student attendance at school events with check-in/out tracking.

**Columns:**

| Column | Type | Nullable | Unique | Constraints | Description |
|--------|------|----------|--------|-------------|-------------|
| event_attendee_id | SERIAL | NO | YES (PK) | PRIMARY KEY | Auto-incrementing unique identifier |
| event_id | INTEGER | NO | NO | NOT NULL, FK | Reference to events(event_id) |
| student_id | TEXT | NO | NO | NOT NULL, FK | Reference to students(student_id) |
| check_in_time | TIMESTAMP | NO | NO | NOT NULL | When student checked in |
| check_out_time | TIMESTAMP | YES | NO | — | When student checked out (nullable) |
| checked_in_by_staff_id | TEXT | NO | NO | NOT NULL, FK | Staff member who checked in student |
| UNIQUE | — | — | — | (event_id, student_id) | One attendance record per student per event |

**Key Relationships:**
- ✓ References:
  - `events` (event_id, ON DELETE CASCADE)
  - `students` (student_id)
  - `staff_accounts` (checked_in_by_staff_id)
- ✗ Referenced by: None

**Indexes:**
- `event_attendee_id` (Primary Key)
- Foreign Key: `event_id` (Cascading delete)
- Foreign Key: `student_id`
- Foreign Key: `checked_in_by_staff_id`
- Composite Unique: (event_id, student_id)

**Cascading Delete:**
- Deleting an event automatically removes all attendee records

---

### 11. **benchmark_test**

**Purpose:** Used for database performance testing and benchmarking operations.

**Columns:**

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | SERIAL | NO | Primary key for test records |
| col_text1 | TEXT | YES | Test text column 1 |
| col_text2 | TEXT | YES | Test text column 2 |
| col_int1 | INTEGER | YES | Test integer column 1 |
| col_int2 | INTEGER | YES | Test integer column 2 |
| col_real1 | REAL | YES | Test float/real column 1 |
| col_real2 | REAL | YES | Test float/real column 2 |
| col_blob1 | BYTEA | YES | Test binary data column |
| col_date1 | DATE | YES | Test date column |
| col_bool1 | BOOLEAN | YES | Test boolean column |

**Key Relationships:**
- ✓ References: None
- ✗ Referenced by: None

**Purpose Endpoints:**
- POST `/api/benchmark/sequential-write` — Single insert test
- POST `/api/benchmark/bulk-write` — Bulk insert in transaction
- GET `/api/benchmark/read-all` — Read performance test
- POST `/api/benchmark/cleanup` — TRUNCATE table and reset identity

---

### 12. **system_logs**

**Purpose:** Captures system-level operational logs for debugging and monitoring.

**Columns:**

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| log_id | SERIAL | NO | Auto-incrementing unique identifier |
| timestamp | TIMESTAMP | NO | When log entry was created (DEFAULT CURRENT_TIMESTAMP) |
| level | TEXT | NO | Log level: 'INFO', 'DEBUG', 'WARN', 'ERROR', 'FATAL' |
| message | TEXT | NO | Main log message |
| source | TEXT | YES | Component/module that generated the log |
| details | TEXT | YES | Additional context or error details |

**Key Relationships:**
- ✓ References: None
- ✗ Referenced by: None

**Log Levels:**
- **INFO** — Informational messages
- **DEBUG** — Development/debugging details
- **WARN** — Warning conditions
- **ERROR** — Error conditions
- **FATAL** — Critical/fatal errors

---

### 13. **sms_provider_settings**

**Purpose:** Stores SMS provider configuration for notifications (designed as singleton table).

**Columns:**

| Column | Type | Nullable | Constraints | Description |
|--------|------|----------|-------------|-------------|
| id | INTEGER | NO | PRIMARY KEY, CHECK (id = 1) | Forced singleton (only one record allowed) |
| provider_name | TEXT | NO | NOT NULL | SMS provider name (e.g., Twilio) |
| sender_name | TEXT | YES | — | Name to appear as sender in SMS |
| updated_at | TIMESTAMP | NO | DEFAULT CURRENT_TIMESTAMP | Last configuration update |

**Key Relationships:**
- ✓ References: None
- ✗ Referenced by: None

**Singleton Pattern:**
- `CHECK (id = 1)` ensures only one record can exist
- UPDATE operation modifies existing record
- Prevents multiple SMS configurations

---

## Data Integrity Rules

### Foreign Key Constraints

| Constraint | From Table | To Table | On Delete | Notes |
|-----------|-----------|----------|-----------|-------|
| student_id | present | students | — | Standard FK |
| staff_id | present | staff_accounts | — | Standard FK |
| student_id | absent | students | — | Standard FK |
| staff_id | absent | staff_accounts | — | Standard FK |
| student_id | excused | students | — | Standard FK |
| requester_staff_id | excused | staff_accounts | — | Standard FK |
| student_id | daily_attendance_logs | students | — | Standard FK |
| staff_id | daily_attendance_logs | staff_accounts | — | Standard FK |
| event_id | event_attendees | events | CASCADE | Deleting event removes attendees |
| student_id | event_attendees | students | — | Standard FK |
| checked_in_by_staff_id | event_attendees | staff_accounts | — | Standard FK |
| staff_id | staff_login | staff_accounts | CASCADE | Deleting staff removes login |
| created_by_staff_id | events | staff_accounts | — | Standard FK |

### Unique Constraints

| Table | Column(s) | Purpose |
|-------|-----------|---------|
| students | student_id | One identifier per student |
| students | qr_code_token | Unique QR codes |
| staff_accounts | staff_id | One identifier per staff |
| staff_accounts | email_address | No duplicate emails |
| staff_login | staff_id | One login per staff |
| staff_login | username | No duplicate usernames |
| daily_attendance_logs | (student_id, log_date, log_slot) | One entry per slot per day |
| event_attendees | (event_id, student_id) | One attendance per event |

### Check Constraints

| Table | Column | Allowed Values | Purpose |
|-------|--------|----------------|---------|
| students | emergency_contact_relationship | parent, guardian | Contact type validation |
| staff_accounts | staff_type | student_council, teacher, security | Staff category |
| staff_accounts | active | 0, 1 | Active/inactive status |
| configurations | school_type | public, private, charter, international | School type |
| excused | processor_type | staff, admin | Processor authority level |
| excused | result | pending, excused, rejected | Request status |
| daily_attendance_logs | log_slot | morning_in, morning_out, afternoon_in, afternoon_out, evening_in, evening_out | Time slot |
| events | status | planned, ongoing, completed, cancelled | Event lifecycle |
| system_logs | level | INFO, DEBUG, WARN, ERROR, FATAL | Log severity |
| sms_provider_settings | id | 1 | Singleton enforcement |

---

## Common Query Patterns

### Get Student Attendance for a Date
```sql
SELECT s.first_name, s.last_name, dal.log_slot, dal.log_time
FROM daily_attendance_logs dal
JOIN students s ON dal.student_id = s.student_id
WHERE dal.log_date = '2026-02-05'
ORDER BY s.first_name, dal.log_slot;
```

### Get Pending Excuse Requests
```sql
SELECT e.excused_id, s.first_name, s.last_name, e.reason, e.request_datetime
FROM excused e
JOIN students s ON e.student_id = s.student_id
WHERE e.result = 'pending'
ORDER BY e.request_datetime DESC;
```

### Get Event Attendance Report
```sql
SELECT e.event_name, COUNT(ea.event_attendee_id) as attendee_count
FROM events e
LEFT JOIN event_attendees ea ON e.event_id = ea.event_id
WHERE e.status IN ('completed', 'ongoing')
GROUP BY e.event_id, e.event_name;
```

### Get Active Staff Members
```sql
SELECT staff_id, name, staff_type, email_address
FROM staff_accounts
WHERE active = 1
ORDER BY name;
```

---

## Design Notes

### Best Practices Implemented

✅ **Normalization:** Tables are normalized to reduce redundancy  
✅ **Referential Integrity:** Foreign keys enforce data relationships  
✅ **Unique Constraints:** Prevent duplicate entries where appropriate  
✅ **Timestamps:** Created/updated timestamps for audit trail  
✅ **Cascading Deletes:** Related records cleaned up automatically  
✅ **Check Constraints:** Data validation at database level  
✅ **Composite Keys:** Complex uniqueness rules (e.g., per-student per-slot logs)  

### Future Notings

⚠️ **Singleton Pattern:** For SMS settings, consider application-level enforcement instead of database check  
⚠️ **Date Fields:** Consider standardizing date storage (use TIMESTAMP for consistency)  
⚠️ **Audit Trail:** Add `created_by` and `updated_by` to more tables for better tracking  
⚠️ **Soft Deletes:** Consider adding `deleted_at` column for data retention policies  
⚠️ **Indexes:** Add indexes on frequently queried columns (log_date, student_id in daily logs)  

---

## Backup and Recovery

- Regular PostgreSQL backups should include all 13 tables
- Foreign key constraints prevent orphaned records
- Cascading deletes clean up related data automatically
- Transaction support ensures data consistency during bulk operations

---

**Schema Version:** 1.0  
**Compatible With:** PostgreSQL 9.5+  
**Last Updated:** February 5, 2026
