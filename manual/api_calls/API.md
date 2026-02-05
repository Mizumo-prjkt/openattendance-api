# OpenAttendance API Backend Call Guide

## Base URL
```
http://localhost:8080
```
**Note:** PORT is currently hardcoded as `8080`. To change it, modify the `PORT` constant in `server.js`, or create an `.env` file and add a `PORT` variable.

---

## Table of Contents
1. [Database Configuration](#database-configuration)
2. [Setup Endpoints](#setup-endpoints)
3. [Benchmark Endpoints](#benchmark-endpoints)
4. [Student Endpoints](#student-endpoints)

---

## Database Configuration

### Environment Variables

The application requires PostgreSQL connection details via environment variables in `.env` file:

```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=openattendance
DB_PASSWORD=password
DB_PORT=5432
```

**Default Values:**
- `DB_USER`: postgres
- `DB_HOST`: localhost
- `DB_NAME`: openattendance
- `DB_PASSWORD`: password
- `DB_PORT`: 5432

**Auto-Initialization:**
- On first run, the API automatically checks if database tables exist
- If tables don't exist, it creates them from `database_schema.sql`
- This ensures the database is ready for use

---

## Setup Endpoints

### 1. Create Admin Account
**Endpoint:** `POST /api/setup/create-admin`

**Description:** Creates an initial admin account for the system by creating entries in both `staff_accounts` and `staff_login` tables. Can only be created if no staff login account exists.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "admin_username",
  "password": "secure_password",
  "name": "John Doe",
  "staff_id": "STAFF001",
  "email_address": "admin@school.com",
  "staff_type": "teacher"
}
```

**Required Fields:**
- `username` (string) - Unique login username
- `password` (string) - Account password (will be hashed with bcrypt)
- `name` (string) - Full name of the staff member
- `staff_id` (string) - Unique staff identifier
- `staff_type` (string) - One of: `student_council`, `teacher`, `security`

**Optional Fields:**
- `email_address` (string) - Staff email address

**Response Success (200):**
```json
{
  "message": "Admin account successfuly created",
  "id": 1
}
```

**Response Error (400):**
```json
{
  "error": "Username, Password, Name, Staff ID, and Staff Type are required."
}
```

**Response Error (409):**
```json
{
  "error": "An admin account already exists!!!"
}
```

**Response Error (500):**
```json
{
  "error": "Error message details"
}
```

**Notes:**
- Creates both a `staff_accounts` entry and a `staff_login` entry in a transaction
- Password is hashed using bcrypt with 10 salt rounds before storage
- If any error occurs, the entire transaction is rolled back

---

### 2. Validate Admin Credentials
**Endpoint:** `POST /api/setup/validate-admin`

**Description:** Validates admin login credentials against stored credentials in the database.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "admin_username",
  "password": "password_to_verify"
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Admin credentials are valid"
}
```

**Response Error (400):**
```json
{
  "error": "Username and password are not provided"
}
```

**Response Error (401):**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

**Response Error (500):**
```json
{
  "error": "Database error during validation: Error message details"
}
```
or
```json
{
  "error": "Error during password comparison on bcrypt side..."
}
```

---

### 3. Configure School Setup
**Endpoint:** `POST /api/setup/configure`

**Description:** Saves initial school configuration including name, type, address, hotline, country code, and logo upload.

**Request Headers:**
```
Content-Type: multipart/form-data
```

**Request Body (Form Data):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| school_name | string | Yes | Name of the school |
| school_type | string | No | Type of school (e.g., Primary, Secondary) |
| address | string | No | School address |
| organization_hotline | string | No | Contact hotline number |
| country_code | string | Yes | ISO country code (e.g., US, GB, IN) |
| logo_file | file | No | School logo image (PNG/JPG/JPEG only) |

**Response Success (200):**
```json
{
  "message": "Configuration saved successfully.",
  "id": 1
}
```

**Response Error (400):**
```json
{
  "error": "School name or country code are required..."
}
```

**Response Error (409):**
```json
{
  "error": "Configuration entry already exists, abort."
}
```

**Response Error (500):**
```json
{
  "error": "Error message details"
}
```

---

### 4. Verify Database Schema
**Endpoint:** `GET /api/setup/verify-schema`

**Description:** Verifies and initializes the database schema by executing the schema SQL file and checking if all expected tables exist.

**Request Headers:** None required

**Request Body:** None

**Response Success (200):**
```json
{
  "sucess": true,
  "actions": [
    {
      "table": "staff_login",
      "status": "exists"
    },
    {
      "table": "students",
      "status": "exists"
    },
    {
      "table": "configurations",
      "status": "missing"
    }
  ]
}
```

**Note:** Response field is `sucess` (typo in implementation - should be `success`)

**Response Error (500):**
```json
{
  "error": "Failed to verify DB schema",
  "details": "Error message details"
}
```

---

## Benchmark Endpoints

### 5. Sequential Write Benchmark
**Endpoint:** `POST /api/benchmark/sequential-write`

**Description:** Performs a single database write operation to test sequential write performance.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{}
```

**Response Success (200):**
```json
{
  "message": "success",
  "id": 42
}
```

**Response Error (500):**
```json
{
  "error": "Error message details"
}
```

---

### 6. Bulk Write Benchmark
**Endpoint:** `POST /api/benchmark/bulk-write`

**Description:** Performs bulk database write operations in a transaction to test bulk write performance.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "records": [
    {
      "col_text1": "value1",
      "col_text2": "value2",
      "col_int1": 100
    },
    {
      "col_text1": "value3",
      "col_text2": "value4",
      "col_int1": 200
    }
  ]
}
```

**Response Success (200):**
```json
{
  "message": "success",
  "count": 2
}
```

**Response Error (400):**
```json
{
  "error": "Invalid Payload, 'records' array not found..."
}
```

**Response Error (500):**
```json
{
  "error": "Error message details"
}
```

---

### 7. Read All Benchmark Data
**Endpoint:** `GET /api/benchmark/read-all`

**Description:** Retrieves all records from the benchmark test table.

**Request Headers:** None required

**Request Body:** None

**Response Success (200):**
```json
{
  "message": "success",
  "data": [
    {
      "id": 1
    },
    {
      "id": 2
    },
    {
      "id": 3
    }
  ]
}
```

**Response Error (500):**
```json
{
  "error": "Error message details"
}
```

---

### 8. Cleanup Benchmark Data
**Endpoint:** `POST /api/benchmark/cleanup`

**Description:** Clears all benchmark test data from the database and resets the identity/auto-increment counter.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{}
```

**Response Success (200):**
```json
{
  "message": "success",
  "deleted_rows": "All (Truncated)"
}
```

**Response Error (500):**
```json
{
  "error": "Error message details"
}
```

---

## Student Endpoints

### 9. Add Student
**Endpoint:** `POST /api/students/add`

**Description:** Adds a new student to the system with auto-generated QR code token for attendance tracking.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "student_id": "STU001"
}
```

**Response Success (200):**
```json
{
  "message": "Student added",
  "student": {
    "id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "student_id": "STU001",
    "qr_code_token": "550e8400-e29b-41d4-a716-446655440000"
  },
  "qr_data": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response Error (500):**
```json
{
  "error": "Error message details"
}
```

---

## Error Handling

All endpoints follow standard HTTP status codes:

| Status Code | Meaning |
|-------------|---------|
| 200 | Success |
| 400 | Bad Request (missing/invalid parameters) |
| 401 | Unauthorized (invalid credentials) |
| 409 | Conflict (duplicate entry/resource exists) |
| 500 | Internal Server Error |

---

## Notes

- **Server Port:** Currently hardcoded to `8080`
- **Database:** PostgreSQL with automatic schema initialization on first run
- **Environment Variables:** Required for database connection (see Database Configuration section)
- **Timestamps:** Managed in UTC and converted to local time in logs
- **Passwords:** Hashed using bcrypt with 10 salt rounds
- **Image Uploads:** Accepted formats are PNG, JPG, JPEG only
- **QR Tokens:** Generated as secure UUIDs
- **Transactions:** Bulk operations use database transactions with automatic rollback on error
- **Debug Mode:** Enable with `--debug` flag for extended logging (creates logs in `data/logs/`)
- **Callback-Based:** Uses callback-style async (not Promise-based)

---

## Example Usage

### Creating Admin Account
```bash
curl -X POST http://localhost:8080/api/setup/create-admin \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "SecurePass123",
    "name": "John Doe",
    "staff_id": "STAFF001",
    "email_address": "admin@school.com",
    "staff_type": "teacher"
  }'
```

### Validating Admin
```bash
curl -X POST http://localhost:8080/api/setup/validate-admin \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "SecurePass123"}'
```

### Adding a Student
```bash
curl -X POST http://localhost:8080/api/students/add \
  -H "Content-Type: application/json" \
  -d '{"first_name": "John", "last_name": "Doe", "student_id": "STU001"}'
```

### Configuring School
```bash
curl -X POST http://localhost:8080/api/setup/configure \
  -F "school_name=ABC School" \
  -F "country_code=US" \
  -F "school_type=Secondary" \
  -F "address=123 Main St" \
  -F "organization_hotline=555-1234" \
  -F "logo_file=@/path/to/logo.png"
```

### Running Sequential Write Benchmark
```bash
curl -X POST http://localhost:8080/api/benchmark/sequential-write \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Verifying Database Schema
```bash
curl -X GET http://localhost:8080/api/setup/verify-schema
```

---

**Last Updated:** February 5, 2026  
**API Version:** Updated for PostgreSQL callback-based implementation
