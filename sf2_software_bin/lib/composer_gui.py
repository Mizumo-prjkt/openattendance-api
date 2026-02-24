from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QPushButton, QLabel, QLineEdit, QDialog, 
    QMessageBox, QTableWidget, QTableWidgetItem, 
    QHeaderView, QRadioButton, QButtonGroup, QAbstractItemView,
    QScrollArea, QFrame, QGridLayout, QFileDialog
)
from PyQt6.QtCore import Qt, QSize
from PyQt6.QtGui import QColor, QBrush, QFont
import datetime
import calendar
import os
import sys

# Import shared processor logic
try:
    from . import processor
except ImportError:
    import processor

class SchoolInfoDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Step 1: School Information")
        self.resize(400, 300)
        self.data = {}
        
        layout = QVBoxLayout(self)
        
        # Inputs
        self.inputs = {}
        form_layout = QGridLayout()
        
        fields = [
            ("School Name:", "school_name", "e.g. Rizal High School"),
            ("School ID:", "school_id", "123456"),
            ("School Year:", "school_year", f"{datetime.date.today().year}-{datetime.date.today().year+1}"),
            ("Month:", "month", datetime.date.today().strftime("%B")),
            ("Grade Level:", "grade", "10"),
            ("Section:", "section", "A")
        ]
        
        for idx, (label_text, key, placeholder) in enumerate(fields):
            label = QLabel(label_text)
            inp = QLineEdit()
            inp.setPlaceholderText(placeholder)
            self.inputs[key] = inp
            form_layout.addWidget(label, idx, 0)
            form_layout.addWidget(inp, idx, 1)
            
        layout.addLayout(form_layout)
        
        # Buttons
        btn_layout = QHBoxLayout()
        self.btn_next = QPushButton("Next: Add Students")
        self.btn_next.clicked.connect(self.validate_and_proceed)
        btn_layout.addStretch()
        btn_layout.addWidget(self.btn_next)
        
        layout.addLayout(btn_layout)
        
    def validate_and_proceed(self):
        # Validate Inputs
        for key, inp in self.inputs.items():
            val = inp.text().strip()
            if not val:
                QMessageBox.warning(self, "Validation Error", f"{key.replace('_', ' ').title()} is required.")
                return
            self.data[key] = val
            
        # Validate School Year format (YYYY-YYYY)
        sy = self.data["school_year"]
        try:
             # Basic check
             if "-" not in sy:
                 # Check if it's just a year
                 int(sy)
             else:
                 parts = sy.split("-")
                 int(parts[0])
                 int(parts[1])
        except ValueError:
             QMessageBox.warning(self, "Validation Error", "School Year must be 'YYYY' or 'YYYY-YYYY'.")
             return

        # Proceed
        self.accept()

class StudentManagerDialog(QDialog):
    def __init__(self, school_data, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Step 2: Student Management")
        self.resize(600, 400)
        self.school_data = school_data
        
        # Data storage
        self.students_male = []
        self.students_female = []
        
        layout = QVBoxLayout(self)
        
        # Add Student Section
        add_group = QFrame()
        add_group.setFrameStyle(QFrame.Shape.StyledPanel)
        add_layout = QHBoxLayout(add_group)
        
        self.inp_name = QLineEdit()
        self.inp_name.setPlaceholderText("Last Name, First Name")
        
        self.gender_group = QButtonGroup(self)
        self.rb_male = QRadioButton("Male")
        self.rb_male.setChecked(True)
        self.rb_female = QRadioButton("Female")
        self.gender_group.addButton(self.rb_male)
        self.gender_group.addButton(self.rb_female)
        
        self.btn_add = QPushButton("Add Student")
        self.btn_add.clicked.connect(self.add_student)
        
        add_layout.addWidget(QLabel("Name:"))
        add_layout.addWidget(self.inp_name)
        add_layout.addWidget(self.rb_male)
        add_layout.addWidget(self.rb_female)
        add_layout.addWidget(self.btn_add)
        
        layout.addWidget(add_group)
        
        # Student List (Table)
        self.table = QTableWidget()
        self.table.setColumnCount(2)
        self.table.setHorizontalHeaderLabels(["Name", "Gender"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        layout.addWidget(self.table)
        
        # Actions
        action_layout = QHBoxLayout()
        self.btn_remove = QPushButton("Remove Selected")
        self.btn_remove.clicked.connect(self.remove_student)
        self.btn_next = QPushButton("Next: Attendance Matrix")
        self.btn_next.clicked.connect(self.accept)
        
        action_layout.addWidget(self.btn_remove)
        action_layout.addStretch()
        action_layout.addWidget(self.btn_next)
        
        layout.addLayout(action_layout)
        
        self.inp_name.returnPressed.connect(self.add_student)

    def add_student(self):
        name = self.inp_name.text().strip()
        if not name:
            return
            
        gender = "Male" if self.rb_male.isChecked() else "Female"
        
        student = {"name": name, "attendance": {}}
        if gender == "Male":
            self.students_male.append(student)
        else:
            self.students_female.append(student)
            
        self.inp_name.clear()
        self.inp_name.setFocus()
        self.refresh_table()
        
    def remove_student(self):
        rows = self.table.selectionModel().selectedRows()
        if not rows:
            return
            
        # Get selected name
        row = rows[0].row()
        name_item = self.table.item(row, 0)
        gender_item = self.table.item(row, 1)
        name = name_item.text()
        gender = gender_item.text()
        
        reply = QMessageBox.question(self, "Confirm Delete", 
                                   f"Are you sure you want to remove '{name}'?",
                                   QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
                                   
        if reply == QMessageBox.StandardButton.Yes:
            target_list = self.students_male if gender == "Male" else self.students_female
            # Remove by name (simple linear search)
            for i, s in enumerate(target_list):
                if s["name"] == name:
                    del target_list[i]
                    break
            self.refresh_table()

    def refresh_table(self):
        self.table.setRowCount(0)
        
        # Sort
        self.students_male.sort(key=lambda x: x["name"].lower())
        self.students_female.sort(key=lambda x: x["name"].lower())
        
        all_students = [(s, "Male") for s in self.students_male] + \
                       [(s, "Female") for s in self.students_female]
                       
        self.table.setRowCount(len(all_students))
        for i, (s, gender) in enumerate(all_students):
            self.table.setItem(i, 0, QTableWidgetItem(s["name"]))
            self.table.setItem(i, 1, QTableWidgetItem(gender))

class AttendanceMatrixWindow(QMainWindow):
    def __init__(self, school_data, students_male, students_female):
        super().__init__()
        self.setWindowTitle("Step 3: Attendance Matrix")
        self.resize(1000, 600)
        
        self.school_data = school_data
        self.students_male = students_male
        self.students_female = students_female
        
        # Calculate Dates
        try:
            self.dates = processor.get_weekdays_in_month(
                school_data["school_year"], school_data["month"]
            )
        except Exception as e:
            QMessageBox.critical(self, "Date Error", str(e))
            self.dates = []

        self.holidays = set()
        
        # UI
        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout(central)
        
        # Info Header
        info_label = QLabel(f"School: {school_data['school_name']} | Year: {school_data['school_year']} | Month: {school_data['month']}")
        info_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        info_label.setStyleSheet("font-weight: bold; font-size: 14px; padding: 5px;")
        layout.addWidget(info_label)
        
        help_label = QLabel("Left Click Cell: Toggle Present/Absent | Click Header: Toggle Holiday (Red)")
        help_label.setStyleSheet("color: gray;")
        layout.addWidget(help_label)
        
        # Matrix Table
        self.table = QTableWidget()
        layout.addWidget(self.table)
        
        # Buttons
        btn_layout = QHBoxLayout()
        self.btn_save = QPushButton("Save to Excel")
        self.btn_save.clicked.connect(self.save_file)
        self.btn_save.setStyleSheet("background-color: #4CAF50; color: white; padding: 5px;")
        
        btn_layout.addStretch()
        btn_layout.addWidget(self.btn_save)
        layout.addLayout(btn_layout)
        
        self.setup_table()
        
    def setup_table(self):
        # Columns: Name + Dates
        self.table.setColumnCount(1 + len(self.dates))
        
        headers = ["Name"]
        for d in self.dates:
            dt = datetime.datetime.strptime(d, "%Y-%m-%d")
            day_str = dt.strftime("%d")
            day_map = ["(M)", "(T)", "(W)", "(TH)", "(F)", "(S)", "(SU)"]
            day_name = day_map[dt.weekday()]
            headers.append(f"{day_str}\n{day_name}")
            
        self.table.setHorizontalHeaderLabels(headers)
        self.table.horizontalHeader().sectionClicked.connect(self.on_header_clicked)
        
        # Rows
        all_students = self.students_male + self.students_female
        self.table.setRowCount(len(all_students))
        
        for i, s in enumerate(all_students):
            # Name Item (Read Only)
            name_item = QTableWidgetItem(s["name"])
            name_item.setFlags(name_item.flags() ^ Qt.ItemFlag.ItemIsEditable)
            self.table.setItem(i, 0, name_item)
            
            # Date Cells
            for j, d in enumerate(self.dates):
                status = s.get("attendance", {}).get(d, "PRESENT")
                text = "P" if status == "PRESENT" else "A"
                if d in self.holidays:
                    text = "" # Holiday usually blank in body? Or 'H'? 
                              # TUI used 'H' or blank. Processor skips blank.
                              # Let's use visual cues mostly.
                
                item = QTableWidgetItem(text)
                item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                item.setFlags(item.flags() ^ Qt.ItemFlag.ItemIsEditable)
                
                self.update_cell_visuals(item, status, d in self.holidays)
                self.table.setItem(i, j+1, item)
                
        self.table.cellClicked.connect(self.on_cell_clicked)

    def update_cell_visuals(self, item, status, is_holiday):
        if is_holiday:
            item.setBackground(QColor("#FFCDD2")) # Light Red
            item.setText("")
        elif status == "ABSENT":
            item.setBackground(QColor("#FFEBEE"))
            item.setForeground(QColor("red"))
            item.setText("A")
        else:
            item.setBackground(QColor("white"))
            item.setForeground(QColor("black"))
            item.setText("P")

    def on_cell_clicked(self, row, col):
        if col == 0: return
        
        date_str = self.dates[col-1]
        
        # If Holiday, maybe warn or allow toggle? 
        if date_str in self.holidays:
            QMessageBox.information(self, "Holiday", "This day is marked as a Holiday. Click the header to unmark it.")
            return

        all_students = self.students_male + self.students_female
        student = all_students[row]
        
        current = student.get("attendance", {}).get(date_str, "PRESENT")
        new_status = "ABSENT" if current == "PRESENT" else "PRESENT"
        
        # Update Data
        if "attendance" not in student: student["attendance"] = {}
        student["attendance"][date_str] = new_status
        
        # Update UI
        item = self.table.item(row, col)
        self.update_cell_visuals(item, new_status, False)

    def on_header_clicked(self, idx):
        if idx == 0: return
        
        date_str = self.dates[idx-1]
        
        if date_str in self.holidays:
            self.holidays.remove(date_str)
        else:
            self.holidays.add(date_str)
            
        # Refresh Data Column
        all_students = self.students_male + self.students_female
        for i, s in enumerate(all_students):
            item = self.table.item(i, idx)
            status = s.get("attendance", {}).get(date_str, "PRESENT")
            self.update_cell_visuals(item, status, date_str in self.holidays)

    def save_file(self):
        reply = QMessageBox.question(self, "Confirm Save", 
                                   "Are you sure you want to save this attendance report?",
                                   QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
        if reply != QMessageBox.StandardButton.Yes:
            return

        default_name = f"Attendance_{self.school_data['month']}_{self.school_data['section']}.xlsx"
        # Sanitize
        default_name = default_name.replace(" ", "_")
        
        # File Dialog
        # We can simulate the timestamp logic if we just do logical save, 
        # but usage of QFileDialog suggests interactive choice.
        # User requirement: "if theres a duplicate, just attatch the date and time"
        # Since this is a GUI "Save As", the user picks the name. 
        # But if we just want "Save", we can auto-generate.
        # Let's let user pick, but if they pick an existing one, we warn OR we implement the requirement.
        # The requirement "strict regex on saving like if the user inputs spaces... become underscore" implies input field.
        # Let's use an input dialog for filename to strictly follow user's TUI request logic?
        # Or standard QFileDialog? QFileDialog is better for GUI. 
        # Let's use QFileDialog but apply sanitization to the result.
        
        cwd = os.getcwd()
        fpath, _ = QFileDialog.getSaveFileName(self, "Save Attendance Report", os.path.join(cwd, default_name), "Excel Files (*.xlsx)")
        
        if not fpath:
            return
            
        # Apply Sanitization logic to the chosen BASENAME
        dirname = os.path.dirname(fpath)
        basename = os.path.basename(fpath)
        
        # Replace spaces
        basename = basename.replace(" ", "_")
        
        # Check duplicate (if QFileDialog didn't already warn? It usually does).
        # But if we change the name (Sanitization), we might collide with another file.
        final_path = os.path.join(dirname, basename)
        
        if os.path.exists(final_path):
             timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
             base, ext = os.path.splitext(basename)
             basename = f"{base}_{timestamp}{ext}"
             final_path = os.path.join(dirname, basename)
             QMessageBox.information(self, "File Exists", f"Filename collision detected. Saving as {basename}")
             
        try:
            # Prepare Data Package for Processor
            composer_data = {
                "school_name": self.school_data["school_name"],
                "school_id": self.school_data["school_id"],
                "school_year": self.school_data["school_year"],
                "month": self.school_data["month"],
                "grade": self.school_data["grade"],
                "section": self.school_data["section"],
                "dates": self.dates,
                "holidays": self.holidays,
                "students_male": self.students_male,
                "students_female": self.students_female
            }
            
            template = os.path.join(os.getcwd(), "sf2-template", "SF2Template.xlsx")
            processor.save_to_excel(composer_data, template, final_path)
            QMessageBox.information(self, "Success", f"File saved successfully to:\n{final_path}")
            
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to save: {str(e)}")


class AttendanceMatrixWindow(QMainWindow):
    def __init__(self, school_data, students_male, students_female):
        super().__init__()
        self.setWindowTitle("Step 3: Attendance Matrix")
        self.resize(1000, 600)
        
        self.school_data = school_data
        self.students_male = students_male
        self.students_female = students_female
        
        # Calculate Dates
        try:
            self.dates = processor.get_weekdays_in_month(
                school_data["school_year"], school_data["month"]
            )
        except Exception as e:
            QMessageBox.critical(self, "Date Error", str(e))
            self.dates = []

        self.holidays = set()
        
        # UI
        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout(central)
        
        # Info Header
        info_label = QLabel(f"School: {school_data['school_name']} | Year: {school_data['school_year']} | Month: {school_data['month']}")
        info_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        info_label.setStyleSheet("font-weight: bold; font-size: 14px; padding: 5px;")
        layout.addWidget(info_label)
        
        help_label = QLabel("Left Click Cell: Toggle Present/Absent | Click Header: Toggle Holiday (Red)")
        help_label.setStyleSheet("color: gray;")
        layout.addWidget(help_label)
        
        # Matrix Table
        self.table = QTableWidget()
        layout.addWidget(self.table)
        
        # Buttons
        btn_layout = QHBoxLayout()
        self.btn_save = QPushButton("Save to Excel")
        self.btn_save.clicked.connect(self.save_file)
        self.btn_save.setStyleSheet("background-color: #4CAF50; color: white; padding: 5px;")
        
        btn_layout.addStretch()
        btn_layout.addWidget(self.btn_save)
        layout.addLayout(btn_layout)
        
        self.setup_table()
        
    def setup_table(self):
        # Columns: Name + Dates
        self.table.setColumnCount(1 + len(self.dates))
        
        headers = ["Name"]
        for d in self.dates:
            dt = datetime.datetime.strptime(d, "%Y-%m-%d")
            day_str = dt.strftime("%d")
            day_map = ["(M)", "(T)", "(W)", "(TH)", "(F)", "(S)", "(SU)"]
            day_name = day_map[dt.weekday()]
            headers.append(f"{day_str}\n{day_name}")
            
        self.table.setHorizontalHeaderLabels(headers)
        self.table.horizontalHeader().sectionClicked.connect(self.on_header_clicked)
        
        # Rows
        all_students = self.students_male + self.students_female
        self.table.setRowCount(len(all_students))
        
        for i, s in enumerate(all_students):
            # Name Item (Read Only)
            name_item = QTableWidgetItem(s["name"])
            name_item.setFlags(name_item.flags() ^ Qt.ItemFlag.ItemIsEditable)
            self.table.setItem(i, 0, name_item)
            
            # Date Cells
            for j, d in enumerate(self.dates):
                status = s.get("attendance", {}).get(d, "PRESENT")
                text = "P" if status == "PRESENT" else "A"
                if d in self.holidays:
                    text = "" 
                
                item = QTableWidgetItem(text)
                item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                item.setFlags(item.flags() ^ Qt.ItemFlag.ItemIsEditable)
                
                self.update_cell_visuals(item, status, d in self.holidays)
                self.table.setItem(i, j+1, item)
                
        self.table.cellClicked.connect(self.on_cell_clicked)

    def update_cell_visuals(self, item, status, is_holiday):
        if is_holiday:
            item.setBackground(QColor("#FFCDD2")) # Light Red
            item.setText("")
        elif status == "ABSENT":
            item.setBackground(QColor("#FFEBEE"))
            item.setForeground(QColor("red"))
            item.setText("A")
        else:
            item.setBackground(QColor("white"))
            item.setForeground(QColor("black"))
            item.setText("P")

    def on_cell_clicked(self, row, col):
        if col == 0: return
        
        date_str = self.dates[col-1]
        
        # If Holiday, maybe warn or allow toggle? 
        if date_str in self.holidays:
            QMessageBox.information(self, "Holiday", "This day is marked as a Holiday. Click the header to unmark it.")
            return

        all_students = self.students_male + self.students_female
        student = all_students[row]
        
        current = student.get("attendance", {}).get(date_str, "PRESENT")
        new_status = "ABSENT" if current == "PRESENT" else "PRESENT"
        
        # Update Data
        if "attendance" not in student: student["attendance"] = {}
        student["attendance"][date_str] = new_status
        
        # Update UI
        item = self.table.item(row, col)
        self.update_cell_visuals(item, new_status, False)

    def on_header_clicked(self, idx):
        if idx == 0: return
        
        date_str = self.dates[idx-1]
        
        if date_str in self.holidays:
            self.holidays.remove(date_str)
        else:
            self.holidays.add(date_str)
            
        # Refresh Data Column
        all_students = self.students_male + self.students_female
        for i, s in enumerate(all_students):
            item = self.table.item(i, idx)
            status = s.get("attendance", {}).get(date_str, "PRESENT")
            self.update_cell_visuals(item, status, date_str in self.holidays)

    def save_file(self):
        reply = QMessageBox.question(self, "Confirm Save", 
                                   "Are you sure you want to save this attendance report?",
                                   QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
        if reply != QMessageBox.StandardButton.Yes:
            return

        default_name = f"Attendance_{self.school_data['month']}_{self.school_data['section']}.xlsx"
        default_name = default_name.replace(" ", "_")
        
        cwd = os.getcwd()
        fpath, _ = QFileDialog.getSaveFileName(self, "Save Attendance Report", os.path.join(cwd, default_name), "Excel Files (*.xlsx)")
        
        if not fpath:
            return
            
        dirname = os.path.dirname(fpath)
        basename = os.path.basename(fpath)
        basename = basename.replace(" ", "_")
        final_path = os.path.join(dirname, basename)
        
        if os.path.exists(final_path):
             timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
             base, ext = os.path.splitext(basename)
             basename = f"{base}_{timestamp}{ext}"
             final_path = os.path.join(dirname, basename)
             QMessageBox.information(self, "File Exists", f"Filename collision detected. Saving as {basename}")
             
        try:
            composer_data = {
                "school_name": self.school_data["school_name"],
                "school_id": self.school_data["school_id"],
                "school_year": self.school_data["school_year"],
                "month": self.school_data["month"],
                "grade": self.school_data["grade"],
                "section": self.school_data["section"],
                "dates": self.dates,
                "holidays": self.holidays,
                "students_male": self.students_male,
                "students_female": self.students_female
            }
            
            template = os.path.join(os.getcwd(), "sf2-template", "SF2Template.xlsx")
            processor.save_to_excel(composer_data, template, final_path)
            QMessageBox.information(self, "Success", f"File saved successfully to:\n{final_path}")
            
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to save: {str(e)}")

def run_composer_gui():
    import sys
    from PyQt6.QtWidgets import QApplication
    
    # Ensure app exists
    app = QApplication.instance()
    if not app:
        # This path is hit if run_composer_gui is called without an existing QApplication
        # (e.g. if main.py didn't create it, which shouldn't happen with current main.py structure)
        app = QApplication(sys.argv)
    
    # Step 1: Info
    info_dialog = SchoolInfoDialog()
    if info_dialog.exec() == QDialog.DialogCode.Accepted:
        school_data = info_dialog.data
        
        # Step 2: Students
        student_dialog = StudentManagerDialog(school_data)
        if student_dialog.exec() == QDialog.DialogCode.Accepted:
            
            # Step 3: Matrix
            window = AttendanceMatrixWindow(school_data, student_dialog.students_male, student_dialog.students_female)
            window.show()
            return window
            
    return None

if __name__ == "__main__":
    from PyQt6.QtWidgets import QApplication
    app = QApplication(sys.argv)
    w = run_composer_gui()
    if w:
        sys.exit(app.exec())