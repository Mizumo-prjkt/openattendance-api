from flask import Flask, request, jsonify, send_file
import os
import tempfile
import json
import zipfile
import io
from lib import json_processor
from lib.network.envparse import logger

app = Flask(__name__)

@app.route('/gen-sf2', methods=['POST'])
def handle_ping():
    """
    Receives JSON data directly from the external JS Server and 
    generates the Attendance Spreadsheets.
    """
    if not request.is_json:
        logger.warning(f"Rejected non-JSON request from {request.remote_addr}")
        return jsonify({"error": "Request must be JSON"}), 400

    payload = request.get_json()
    logger.info(f"Received JSON Handshake payload from {request.remote_addr}")

    # Write payload to a temporary file for the existing json_processor logic
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as tmp:
            json.dump(payload, tmp)
            tmp_path = tmp.name

        logger.info(f"Processing JSON payload mapped to {tmp_path}")
        
        # We always set force_split to True for Server logic to avoid sudden aborts 
        # crashing a completely automated workflow.
        generated_files = json_processor.process_json_to_excel(tmp_path, force_split=True)
        
        # Clean up tmp file
        os.remove(tmp_path)
        
        logger.info(f"Successfully generated {len(generated_files)} report(s). Packaging into ZIP...")
        
        # Package files into a ZIP archive in memory
        memory_file = io.BytesIO()
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            for file_path in generated_files:
                zf.write(file_path, os.path.basename(file_path))
        
        # Reset memory file pointer to the beginning
        memory_file.seek(0)
        
        # Clean up generated files on the server to save space
        for file_path in generated_files:
            try:
                os.remove(file_path)
            except OSError:
                pass
                
        logger.info("Sending ZIP payload back to client.")
        
        return send_file(
            memory_file,
            mimetype='application/zip',
            as_attachment=True,
            download_name='Attendance_Reports.zip'
        )

    except Exception as e:
        logger.error(f"Error processing JSON Handshake: {e}")
        return jsonify({
            "error": "Failed to process attendance data",
            "details": str(e)
        }), 500

def start_server(host, port):
    """Starts the Flask server natively."""
    logger.info(f"Initialising Server Handshake on {host}:{port}")
    app.run(host=host, port=port, debug=False, use_reloader=False)
