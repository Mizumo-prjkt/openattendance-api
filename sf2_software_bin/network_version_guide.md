# Network Version Guide

The Qt SF2 DepEd Attendance App includes a powerful Network Server component. This allows external applications (such as a remote Node.js web server or other clients) to send raw JSON attendance data directly to this Python application for automated Excel SF2 generation.

## How to Start the Server

You can launch the server in several ways:

### 1. Through the Main Application
- **GUI Mode:** Run `python3 main.py` and click the **Network Server** button on the main screen.
- **Terminal UI (TUI) Mode:** Run `python3 main.py --terminal-only` and select the **Network Server** option from the startup menu.

### 2. Standalone Server Script
You can bypass the main application entirely using the robust `server.py` entry point:
- **Headless Mode (Background Agent):** `python3 server.py --mode headless` (or simply `python3 server.py`)
- **Textual TUI:** `python3 server.py --mode tui`
- **PyQt6 GUI:** `python3 server.py --mode gui`

---

## Configuration (`.env`)

The server configurations are automatically managed via a `.env` file in the project root directory. If one doesn't exist, it will be auto-generated upon your first startup.

**Default `.env` configuration:**
```env
HOST=0.0.0.0
PORT=5000
MODE=HEADLESS
```
- `HOST`: Set to `0.0.0.0` to allow external remote connections, or `127.0.0.1` for local-only traffic.
- `PORT`: The port the Flask API will listen on.

You can modify these settings via the TUI/GUI or by directly editing the `.env` file!

---

## API Endpoint Specification

**Endpoint:** `POST /gen-sf2`
**Content-Type:** `application/json`

The endpoint expects a JSON payload matching the standard automated processing structure detailed in the `json_guide_structure.md`.  

**Important:** The network server natively implements `--force-yes` logic. If a payload contains more than 30 male or 30 female students, the server will **not** crash; it will automatically chunk the data and generate multiple spreadsheet files in the background (e.g., `_1.xlsx`, `_2.xlsx`).

### Expected Success Response (HTTP 200)

Upon successful processing, the endpoint does **NOT** return a generic JSON message. Instead, it natively packages all generated `.xlsx` spreadsheets (including overflow chunked files) into a `.zip` archive and **streams the ZIP file directly back to the client** (`application/zip`). 

You can receive and save this file programmatically in your JS client or test it in your terminal as shown below.

---

## Sample curl Requests

Here are commands you can run from your terminal to test the server connection and payload processing. Make sure the server is actively running before testing!

### 1. Basic Local Payload Test

```bash
curl -X POST http://127.0.0.1:5000/gen-sf2 \
-H "Content-Type: application/json" \
--output generated_reports.zip \
-d '{
    "school_info": {
        "name": "Network API High",
        "id": "111222",
        "year": "2024-2025",
        "month": "March",
        "grade": "11",
        "section": "Gold"
    },
    "students": [
        {
            "name": "Doe, John",
            "gender": "M",
            "attendance": {"2025-03-01": "PRESENT"}
        }
    ],
    "holidays": []
}'
```

### 2. Testing with an Existing File

If you have a JSON file (e.g., your `test.json` or `test_exceed.json`), you can send the entire file payload natively via cURL using the `@` symbol:

```bash
curl -X POST http://127.0.0.1:5000/gen-sf2 \
-H "Content-Type: application/json" \
--output my_reports.zip \
-d @test.json
```

### 3. Remote External Server Request
If the Python app is hosted on IP `192.168.3.44`, send the request from an external application or remote terminal like so:

```bash
curl -X POST http://192.168.3.44:5000/gen-sf2 \
-H "Content-Type: application/json" \
--output overflow_reports.zip \
-d @test_exceed.json
```

---

## Logging
All network interactions, including connection IP addresses and generation statuses, are actively logged to your UI console and permanently saved historically within `logs/server_history.log`.
