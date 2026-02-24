from textual.app import App, ComposeResult
from textual.screen import Screen
from textual.widgets import Header, Footer, DataTable, DirectoryTree, Button, Label, Input, Static
from textual.containers import Container, Horizontal, Vertical
from textual.binding import Binding
import os
from . import parser

class FileSelectionScreen(Screen):
    """Screen to select a file."""
    
    BINDINGS = [("escape", "app.quit", "Quit")]

    def compose(self) -> ComposeResult:
        yield Header()
        yield Label("Select a file to parse (JSON/CSV):", classes="title")
        yield DirectoryTree(os.getcwd())
        yield Footer()

    def on_directory_tree_file_selected(self, event: DirectoryTree.FileSelected) -> None:
        """Called when a file is selected."""
        filepath = event.path
        if filepath.suffix.lower() in ['.json', '.csv']:
            self.app.load_file(str(filepath))
        else:
            self.notify("Please select a .json or .csv file", severity="error")

class SaveScreen(Screen):
    """Screen to save file."""
    
    def compose(self) -> ComposeResult:
        yield Label("Enter filename to save (e.g. output.json):")
        yield Input(placeholder="output.json", id="filename_input")
        yield Horizontal(
            Button("Save", variant="success", id="btn_confirm_save"),
            Button("Cancel", variant="error", id="btn_cancel_save"),
            classes="dialog-buttons"
        )
        
    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn_confirm_save":
            filename = self.query_one("#filename_input").value
            if filename:
                self.app.save_file(filename)
        elif event.button.id == "btn_cancel_save":
            self.app.pop_screen()

class DataScreen(Screen):
    """Screen to view and manipulate data."""
    
    BINDINGS = [
        ("v", "validate", "Validate"),
        ("f", "format", "Format"),
        ("s", "save", "Save"),
        ("b", "back", "Back"),
        ("q", "quit", "Quit"),
    ]

    def compose(self) -> ComposeResult:
        yield Header()
        yield Container(
            Label(id="status-bar", content="Ready"),
            DataTable(),
            Horizontal(
                Button("Validate", id="btn_validate", variant="primary"),
                Button("Format", id="btn_format", variant="warning"),
                Button("Save", id="btn_save", variant="success"),
                Button("Back", id="btn_back", variant="default"),
                classes="action-bar"
            )
        )
        yield Footer()

    def on_mount(self) -> None:
        self.update_table(self.app.current_data)

    def update_table(self, data):
        table = self.query_one(DataTable)
        table.clear(columns=True)
        table.cursor_type = "row"
        table.zebra_stripes = True
        
        if not data:
            return

        headers = list(data[0].keys())
        table.add_columns(*headers)

        for item in data:
            row = [str(item.get(h, "")) for h in headers]
            table.add_row(*row)
            
    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn_validate":
            self.action_validate()
        elif event.button.id == "btn_format":
            self.action_format()
        elif event.button.id == "btn_save":
            self.action_save()
        elif event.button.id == "btn_back":
            self.action_back()

    def action_validate(self):
        is_valid, msg = parser.validate_data(self.app.current_data)
        if is_valid:
            self.notify(msg, severity="information")
            self.query_one("#status-bar").update(f"Status: {msg}")
        else:
            self.notify("Validation Failed", severity="error")
            self.query_one("#status-bar").update(f"Errors: {msg}")

    def action_format(self):
        self.app.current_data = parser.format_data(self.app.current_data)
        self.update_table(self.app.current_data)
        self.notify("Data formatted", severity="information")

    def action_save(self):
        self.app.push_screen(SaveScreen())
    
    def action_back(self):
        self.app.pop_screen()

class AttendanceApp(App):
    """Main TUI App."""
    
    CSS = """
    .action-bar {
        height: 3;
        dock: bottom;
        align: center middle;
        background: $boost;
    }
    Button {
        margin: 0 1;
    }
    #status-bar {
        dock: top;
        padding: 1;
        background: $panel;
    }
    .title {
        padding: 1;
        text-align: center;
    }
    """
    
    SCREENS = {
        "files": FileSelectionScreen,
        "data": DataScreen,
    }

    def __init__(self, initial_file=None):
        super().__init__()
        self.initial_file = initial_file
        self.current_data = []

    def on_mount(self) -> None:
        if self.initial_file:
            self.load_file(self.initial_file)
        else:
            # Show startup menu
            pass

class StartupScreen(Screen):
    """Initial choice screen."""
    def compose(self) -> ComposeResult:
        yield Header()
        yield Container(
            Label("Welcome to SF2 Attendance Tool", classes="title"),
            Button("Browse Existing File", id="btn_browse", variant="primary"),
            Button("Compose New Report", id="btn_compose", variant="success"),
            Button("Network Server", id="btn_server", variant="warning"),
            Button("Quit", id="btn_quit", variant="error"),
            classes="startup-menu"
        )
        yield Footer()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn_browse":
            self.app.push_screen("files")
        elif event.button.id == "btn_compose":
            self.app.exit(result="COMPOSER")
        elif event.button.id == "btn_server":
            self.app.exit(result="SERVER")
        elif event.button.id == "btn_quit":
            self.app.exit()

class AttendanceApp(App):
    """Main TUI App."""
    
    CSS = """
    .action-bar {
        height: 3;
        dock: bottom;
        align: center middle;
        background: $boost;
    }
    Button {
        margin: 1;
    }
    #status-bar {
        dock: top;
        padding: 1;
        background: $panel;
    }
    .title {
        padding: 1;
        text-align: center;
        background: $accent;
        color: white;
    }
    .startup-menu {
        align: center middle;
    }
    """
    
    SCREENS = {
        "startup": StartupScreen,
        "files": FileSelectionScreen,
        "data": DataScreen,
    }

    def __init__(self, initial_file=None):
        super().__init__()
        self.initial_file = initial_file
        self.current_data = []

    def on_mount(self) -> None:
        if self.initial_file:
            self.load_file(self.initial_file)
        else:
            self.push_screen("startup")

    def load_file(self, filepath):
        try:
            self.current_data = parser.load_data(filepath)
            self.push_screen("data")
            self.notify(f"Loaded {os.path.basename(filepath)}")
        except Exception as e:
            self.notify(f"Error loading file: {e}", severity="error")

    def save_file(self, filename):
        try:
            parser.save_data(self.current_data, filename)
            self.pop_screen() # Close Save Dialog
            self.notify(f"Saved to {filename}", severity="information")
        except Exception as e:
            self.notify(f"Error saving: {e}", severity="error")

def run_tui(filepath=None):
    app = AttendanceApp(initial_file=filepath)
    result = app.run()
    return result

