import sys
import threading
import logging
import os
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QLabel, QLineEdit, QPushButton, QTextEdit)
from PyQt6.QtCore import pyqtSignal, QObject
from lib.network import envparse
from lib.network import handshake

logger = envparse.logger

class QtLogHandler(logging.Handler, QObject):
    """Custom logging handler to emit PyQt6 signals."""
    new_record = pyqtSignal(str)
    
    def __init__(self):
        logging.Handler.__init__(self)
        QObject.__init__(self)
        
    def emit(self, record):
        msg = self.format(record)
        self.new_record.emit(msg)

class ServerGUI(QMainWindow):
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.server_instance = None
        self.flask_thread = None
        self.is_running = False
        
        self.init_ui()
        self.setup_logging()
        
    def init_ui(self):
        self.setWindowTitle("SF2 Server Control Panel")
        self.resize(600, 400)
        
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        
        # --- Config Section ---
        config_layout = QHBoxLayout()
        
        config_layout.addWidget(QLabel("IP Address:"))
        self.host_input = QLineEdit(self.config.get("HOST", "0.0.0.0"))
        config_layout.addWidget(self.host_input)
        
        config_layout.addWidget(QLabel("Port:"))
        self.port_input = QLineEdit(str(self.config.get("PORT", "5000")))
        config_layout.addWidget(self.port_input)
        
        self.save_btn = QPushButton("Save Config to .env")
        self.save_btn.clicked.connect(self.save_config)
        config_layout.addWidget(self.save_btn)
        
        main_layout.addLayout(config_layout)
        
        # --- Controls Section ---
        self.toggle_btn = QPushButton("Start Server")
        self.toggle_btn.setStyleSheet("background-color: #2e7d32; color: white;")
        self.toggle_btn.clicked.connect(self.toggle_server)
        main_layout.addWidget(self.toggle_btn)
        
        # --- Logs Section ---
        main_layout.addWidget(QLabel("Live Handshake Logs:"))
        self.log_viewer = QTextEdit()
        self.log_viewer.setReadOnly(True)
        self.log_viewer.setStyleSheet("background-color: #1e1e1e; color: #a5d6a7; font-family: monospace;")
        main_layout.addWidget(self.log_viewer)
        
    def setup_logging(self):
        self.qt_handler = QtLogHandler()
        self.qt_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S"))
        self.qt_handler.new_record.connect(self.append_log)
        logger.addHandler(self.qt_handler)
        self.append_log(">>> GUI Initialized. Ready to start.")
        
    def append_log(self, msg):
        self.log_viewer.append(msg)
        
    def save_config(self):
        host = self.host_input.text()
        port = self.port_input.text()
        envparse.update_env({"HOST": host, "PORT": port})
        self.append_log(f">>> Configuration Saved: HOST={host}, PORT={port}")
        
    def toggle_server(self):
        if not self.is_running:
            host = self.host_input.text()
            try:
                port = int(self.port_input.text())
            except ValueError:
                self.append_log("[ERROR] Port must be a valid number.")
                return
                
            self.append_log(f">>> Attempting to start server on {host}:{port}...")
            
            try:
                from werkzeug.serving import make_server
                
                self.server_instance = make_server(host, port, handshake.app)
                self.flask_thread = threading.Thread(target=self.server_instance.serve_forever, daemon=True)
                self.flask_thread.start()
                
                self.is_running = True
                self.toggle_btn.setText("Stop Server")
                self.toggle_btn.setStyleSheet("background-color: #c62828; color: white;")
                self.append_log(">>> [ONLINE] Server is actively listening for JSON Handshakes.")
                
            except Exception as e:
                self.append_log(f">>> [ERROR] Failed to start server: {str(e)}")
        else:
            if self.server_instance:
                self.server_instance.shutdown()
                self.server_instance = None
                
            self.is_running = False
            self.toggle_btn.setText("Start Server")
            self.toggle_btn.setStyleSheet("background-color: #2e7d32; color: white;")
            self.append_log(">>> [OFFLINE] Server gracefully stopped.")

    def closeEvent(self, event):
        """Cleanup handler when window closes."""
        if self.is_running and self.server_instance:
            self.server_instance.shutdown()
        event.accept()

def launch_gui(config):
    app = QApplication(sys.argv)
    window = ServerGUI(config)
    window.show()
    sys.exit(app.exec())
