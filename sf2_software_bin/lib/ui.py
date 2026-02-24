from PyQt6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QPushButton, QTableWidget, 
                             QTableWidgetItem, QFileDialog, QLabel, QMessageBox)
from PyQt6.QtCore import Qt
import os
from . import parser

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("SF2 Attendance Viewer")
        self.resize(800, 600)
        
        # Central Widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Layout
        layout = QVBoxLayout(central_widget)
        
        # Top Bar
        top_layout = QHBoxLayout()
        self.btn_load = QPushButton("Load File")
        self.btn_load.clicked.connect(self.load_file)
        
        self.btn_compose = QPushButton("Compose Report")
        self.btn_compose.clicked.connect(self.launch_composer)

        self.btn_server = QPushButton("Network Server")
        self.btn_server.clicked.connect(self.launch_server_gui)
        
        self.lbl_status = QLabel("Ready")
        
        top_layout.addWidget(self.btn_load)
        top_layout.addWidget(self.btn_compose)
        top_layout.addWidget(self.btn_server)
        top_layout.addWidget(self.lbl_status)
        top_layout.addStretch()
        
        layout.addLayout(top_layout)
        
        # Table
        self.table = QTableWidget()
        layout.addWidget(self.table)
        
    def load_file(self):
        file_name, _ = QFileDialog.getOpenFileName(
            self, "Open Data File", os.getcwd(), "Data Files (*.json *.csv);;All Files (*)"
        )
        
        if file_name:
            self.process_file(file_name)

    def launch_composer(self):
        try:
            from . import composer_gui
            # We keep a reference to the window to prevent garbage collection
            self.composer_window = composer_gui.run_composer_gui()
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to launch composer: {e}")

    def launch_server_gui(self):
        try:
            from lib.network import ui, envparse
            config = envparse.load_or_create_env()
            self.server_window = ui.ServerGUI(config)
            self.server_window.show()
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to launch Network Server: {e}")

    def process_file(self, filepath):
        try:
            self.lbl_status.setText(f"Loading {os.path.basename(filepath)}...")
            data = parser.load_data(filepath)
            self.populate_table(data)
            self.lbl_status.setText(f"Loaded {len(data)} records.")
        except Exception as e:
            QMessageBox.critical(self, "Error", str(e))
            self.lbl_status.setText("Error loading file.")

    def populate_table(self, data):
        if not data:
            self.table.setRowCount(0)
            self.table.setColumnCount(0)
            return

        # Assume list of dicts
        headers = list(data[0].keys())
        self.table.setColumnCount(len(headers))
        self.table.setHorizontalHeaderLabels(headers)
        self.table.setRowCount(len(data))
        
        for row_idx, row_data in enumerate(data):
            for col_idx, header in enumerate(headers):
                item = QTableWidgetItem(str(row_data.get(header, "")))
                self.table.setItem(row_idx, col_idx, item)

