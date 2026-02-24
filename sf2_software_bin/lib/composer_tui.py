from textual.app import App, ComposeResult
from textual.screen import Screen
from textual.widgets import Header, Footer, Input, Button, Label, DataTable, Static, RadioSet, RadioButton
from textual.containers import Container, Grid, Horizontal, Vertical
from textual.reactive import reactive
from . import processor
import datetime
import os

class InfoScreen(Screen):
    """Input initial school info."""
    
    BINDINGS = [("escape", "app.quit", "Quit")]

    def compose(self) -> ComposeResult:
        yield Header()
        yield Label("School Information Setup", classes="title")
        yield Vertical(
            Label("School Name:"),
            Input(placeholder="e.g. Rizal High School", id="school_name"),
            Label("School ID:"),
            Input(placeholder="123456", id="school_id"),
            Label("School Year:"),
            Input(placeholder=str(datetime.date.today().year) + "-" + str(datetime.date.today().year+1), id="school_year"),
            Label("Month (e.g. January):"),
            Input(placeholder=datetime.date.today().strftime("%B"), id="month"),
            Label("Grade Level:"),
            Input(placeholder="10", id="grade"),
            Label("Section:"),
            Input(placeholder="A", id="section"),
            Button("Next: Add Students", variant="primary", id="btn_next"),
            classes="form-container"
        )
        yield Footer()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        """Handle Enter key press."""
        # If last input (section), trigger next
        if event.input.id == "section":
             self.on_button_pressed(Button.Pressed(self.query_one("#btn_next")))

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn_next":
            # Validation
            data = {
                "school_name": self.query_one("#school_name").value,
                "school_id": self.query_one("#school_id").value,
                "school_year": self.query_one("#school_year").value,
                "month": self.query_one("#month").value,
                "grade": self.query_one("#grade").value,
                "section": self.query_one("#section").value,
            }
            if not all(data.values()):
                self.notify("Please fill all fields", severity="error")
                return
            
            # Initialize dates
            try:
                # processor.get_weekdays_in_month handles the string parsing now
                dates = processor.get_weekdays_in_month(data["school_year"], data["month"])
                self.app.composer_data.update(data)
                self.app.composer_data["dates"] = dates
                self.app.push_screen("students")
            except ValueError as e:
                self.notify(str(e), severity="error")

class StudentScreen(Screen):
    """Add/Remove students."""
    
    def compose(self) -> ComposeResult:
        yield Header()
        yield Label("Student Management", classes="title")
        yield Horizontal(
            Vertical(
                Label("Add Student"),
                Input(placeholder="Last Name, First Name", id="student_name"),
                Label("Gender:"),
                RadioSet(RadioButton("Male", value=True), RadioButton("Female"), id="gender"),
                Button("Add Student", id="btn_add"),
                classes="input-panel"
            ),
            Vertical(
                DataTable(id="student_table"),
                Horizontal(
                    Button("Remove Selected", id="btn_remove", variant="error"),
                    Button(id="spacer", disabled=True, classes="hidden"), # Spacer
                    classes="button-row"
                ),
                classes="list-panel"
            )
        )
        yield Horizontal(
            Button("Back", variant="default", id="btn_back"),
            Button("Next: Attendance", variant="primary", id="btn_next_att"),
            classes="nav-panel"
        )
        yield Footer()

    def on_mount(self) -> None:
        table = self.query_one(DataTable)
        table.add_columns("Name", "Gender")
        table.cursor_type = "row"

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn_add":
            name = self.query_one("#student_name").value
            if not name:
                self.notify("Name required", severity="error")
                return
                
            gender_idx = self.query_one("#gender").pressed_index
            gender = "Male" if gender_idx == 0 else "Female"
            
            # Update Data
            if gender == "Male":
                self.app.composer_data["students_male"].append({"name": name, "attendance": {}})
            else:
                self.app.composer_data["students_female"].append({"name": name, "attendance": {}})
                
            self.refresh_table()
            self.query_one("#student_name").value = ""
            self.query_one("#student_name").focus()
            
        elif event.button.id == "btn_remove":
            pass 
        elif event.button.id == "btn_back":
            self.app.pop_screen()
        elif event.button.id == "btn_next_att":
            self.app.push_screen("attendance")

    def refresh_table(self):
        table = self.query_one(DataTable)
        table.clear()
        
        # Sort data before display
        self.app.composer_data["students_male"].sort(key=lambda x: x["name"].lower())
        self.app.composer_data["students_female"].sort(key=lambda x: x["name"].lower())
        
        for s in self.app.composer_data["students_male"]:
            table.add_row(s["name"], "Male")
        for s in self.app.composer_data["students_female"]:
            table.add_row(s["name"], "Female")

class AttendanceScreen(Screen):
    """Mark attendance."""
    
    BINDINGS = [("h", "toggle_holiday", "Toggle Holiday")]
    
    def compose(self) -> ComposeResult:
        yield Header()
        yield Label("INTERACT: Click Cell (Toggle P/A) | Press 'h' (Toggle Holiday Column)", classes="title")
        yield DataTable()
        yield Horizontal(
            Button("Back", variant="warning", id="btn_back"),
            Button("Save to Excel", variant="success", id="btn_save"),
            classes="action-bar"
        )
        yield Footer()

    def on_mount(self) -> None:
        self.load_matrix()

    def load_matrix(self):
        table = self.query_one(DataTable)
        table.clear(columns=True)
        
        dates = self.app.composer_data["dates"]
        
        # Sort students before loading matrix too
        self.app.composer_data["students_male"].sort(key=lambda x: x["name"].lower())
        self.app.composer_data["students_female"].sort(key=lambda x: x["name"].lower())
        
        # Build columns with Holiday indicators and Weekdays
        # dates are "YYYY-MM-DD"
        cols = ["Name"]
        for d in dates:
            dt = datetime.datetime.strptime(d, "%Y-%m-%d")
            day_str = dt.strftime("%d") # 05
            # Custom Day Name map
            # M, T, W, TH, F
            weekday = dt.weekday()
            day_map = ["(M)", "(T)", "(W)", "(TH)", "(F)", "(S)", "(SU)"]
            day_name = day_map[weekday]
            
            # Single line label for better compatibility
            label = f"{day_str} {day_name}"
            
            if d in self.app.composer_data["holidays"]:
                label += " (H)"
            cols.append(label)
            
        table.add_columns(*cols)
        
        all_students = self.app.composer_data["students_male"] + self.app.composer_data["students_female"]
        
        for s in all_students:
            row = [s["name"]]
            for d in dates:
                if d in self.app.composer_data["holidays"]:
                     row.append("HOLIDAY")
                else:
                    status = s.get("attendance", {}).get(d, "PRESENT")
                    symbol = "P" if status == "PRESENT" else "A"
                    row.append(symbol)
            table.add_row(*row)

    def on_data_table_cell_selected(self, event: DataTable.CellSelected) -> None:
        """Handle mouse click on cell."""
        try:
            row_idx = event.coordinate.row
            col_idx = event.coordinate.column

            if col_idx == 0: return # Name column
            
            dates = self.app.composer_data["dates"] 
            if col_idx - 1 >= len(dates): return
            
            # Toggle Logic
            self.action_toggle_status_mouse(row_idx, col_idx)
        except Exception as e:
            self.notify(f"Error handling click: {e}", severity="error")

    def action_toggle_status_mouse(self, row, col):
        if col == 0: return
        dates = self.app.composer_data["dates"]
        date_str = dates[col-1]
        
        all_students = self.app.composer_data["students_male"] + self.app.composer_data["students_female"]
        if row >= len(all_students): return # Guard against bounds
        
        student = all_students[row]
        
        if date_str in self.app.composer_data["holidays"]:
             self.notify("Holiday set. Press 'h' to unset column.", severity="warning")
             return

        current = student.get("attendance", {}).get(date_str, "PRESENT")
        new_status = "ABSENT" if current == "PRESENT" else "PRESENT"
        
        if "attendance" not in student: student["attendance"] = {}
        student["attendance"][date_str] = new_status
        
        # Update UI
        symbol = "P" if new_status == "PRESENT" else "A"
        try:
            self.query_one(DataTable).update_cell_at(DataTable.Coordinate(row, col), symbol)
        except Exception:
            # Fallback refresh if update_cell_at fails (e.g. strict checks)
            self.load_matrix()

    def key_h(self):
        """Toggle Holiday for current column."""
        try:
            table = self.query_one(DataTable)
            if not table.cursor_coordinate:
                self.notify("Select a column first.", severity="warning")
                return
                
            col = table.cursor_coordinate.column
            if col == 0: 
                self.notify("Cannot mark Name column as holiday.", severity="warning")
                return
            
            dates = self.app.composer_data["dates"]
            if col - 1 >= len(dates): return

            date_str = dates[col-1]
            
            if date_str in self.app.composer_data["holidays"]:
                self.app.composer_data["holidays"].remove(date_str)
                self.notify(f"Removed Holiday: {date_str}")
            else:
                self.app.composer_data["holidays"].add(date_str)
                self.notify(f"Set Holiday: {date_str}")

            # Refresh drawing
            self.load_matrix()
        except Exception as e:
             self.notify(f"Error toggling holiday: {e}", severity="error")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn_save":
             self.app.push_screen(SaveComposerScreen())
        elif event.button.id == "btn_back":
             self.app.pop_screen()


class SaveComposerScreen(Screen):
    """Save dialog."""
    def compose(self) -> ComposeResult:
        yield Label("Enter filename to save (e.g. output.xlsx):")
        yield Input(placeholder="output.xlsx", id="filename")
        yield Horizontal(
            Button("Save", variant="success", id="btn_confirm"),
            Button("Cancel", variant="error", id="btn_cancel")
        )

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn_confirm":
            fname = self.query_one("#filename").value
            if not fname: return
            
            # Sanitize: Replace spaces with underscores
            fname = fname.strip().replace(" ", "_")
            
            # Ensure extension
            if not fname.endswith(".xlsx"):
                fname += ".xlsx"
                
            # Check for duplicates
            if os.path.exists(fname):
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                base, ext = os.path.splitext(fname)
                fname = f"{base}_{timestamp}{ext}"
                self.notify(f"File exists. Saving as {fname}", severity="warning")
            
            try:
                # Need absolute path to template
                template = os.path.join(os.getcwd(), "sf2-template", "SF2Template.xlsx")
                processor.save_to_excel(self.app.composer_data, template, fname)
                self.app.exit(result=f"Saved to {fname}")
            except Exception as e:
                self.notify(str(e), severity="error")
        elif event.button.id == "btn_cancel":
            self.app.pop_screen()

class ComposerApp(App):
    CSS = """
    .form-container {
        padding: 1;
        overflow-y: auto;
        height: 100%;
    }
    .nav-panel {
        height: 3;
        align: right middle;
    }
    .action-bar {
        height: 3;
        align: center middle;
    }
    Input {
        margin: 1 0;
    }
    Label {
        margin-top: 1;
    }
    .title {
        text-align: center;
        padding: 1;
        background: $primary;
        color: white;
        dock: top;
    }
    """
    SCREENS = {
        "info": InfoScreen,
        "students": StudentScreen,
        "attendance": AttendanceScreen
    }
    
    BINDINGS = [("h", "ignore", "Toggle Holiday")] 

    def __init__(self):
        super().__init__()
        self.composer_data = {
            "students_male": [],
            "students_female": [],
            "dates": [],
            "holidays": set()
        }

    def on_mount(self) -> None:
        self.push_screen("info")


def run_composer():
    app = ComposerApp()
    res = app.run()
    if res:
        print(res)

if __name__ == "__main__":
    run_composer()
