from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.widgets import Header, Footer, Input, Button, RichLog, Static
from textual.reactive import reactive
from lib.network import envparse
import threading
import os
import sys

# Get logger from envparse to reroute some output to TUI
logger = envparse.logger

class ServerTUI(App):
    """A Textual app to manage the SF2 Network Server."""
    
    CSS = """
    Screen {
        layout: vertical;
    }
    
    #sidebar {
        width: 35;
        dock: left;
        padding: 1 2;
        background: $panel;
    }
    
    #main-content {
        width: 100%;
        height: 100%;
        padding: 1 2;
    }
    
    Input {
        margin-bottom: 1;
    }
    
    Button {
        width: 100%;
        margin-top: 1;
    }
    
    .started {
        background: $success;
        color: white;
    }
    
    RichLog {
        height: 100%;
        border: solid $accent;
    }
    """
    
    BINDINGS = [
        ("q", "quit", "Quit"),
        ("s", "toggle_server", "Start/Stop Server")
    ]
    
    server_running = reactive(False)
    
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.flask_thread = None
        # We need a reference to the werkzeug server object to shut it down gracefully, 
        # but killing the daemon thread on exit is acceptable for this headless proxy.
        from werkzeug.serving import make_server
        self.server_instance = None
        
    def compose(self) -> ComposeResult:
        """Create child widgets for the app."""
        yield Header(show_clock=True)
        
        with Horizontal():
            with Vertical(id="sidebar"):
                yield Static("[b]Server Configuration[/b]\n")
                yield Input(value=self.config.get("HOST", "0.0.0.0"), placeholder="Host IP", id="input-host")
                yield Input(value=str(self.config.get("PORT", "5000")), placeholder="Port", id="input-port")
                yield Button("Save Config to .env", id="btn-save", variant="primary")
                
                yield Static("\n[b]Controls[/b]\n")
                yield Button("Start Server", id="btn-toggle", variant="success")
                
            with Vertical(id="main-content"):
                yield Static("[b]Live Handshake Logs[/b]")
                self.log_widget = RichLog(highlight=True, markup=True)
                yield self.log_widget
                
        yield Footer()

    def on_mount(self) -> None:
        self.log_widget.write("[System] TUI Initialised.")
        self.log_widget.write(f"[System] Loaded Host: {self.config.get('HOST', '0.0.0.0')}  Port: {self.config.get('PORT', '5000')}")
        
    def on_button_pressed(self, event: Button.Pressed) -> None:
        """Handle button presses."""
        if event.button.id == "btn-save":
            host = self.query_one("#input-host").value
            port = self.query_one("#input-port").value
            envparse.update_env({"HOST": host, "PORT": port})
            self.log_widget.write(f"[Config] Saved to .env -> {host}:{port}")
            
        elif event.button.id == "btn-toggle":
            self.action_toggle_server()

    def action_toggle_server(self) -> None:
        btn = self.query_one("#btn-toggle")
        
        if not self.server_running:
            # Start Server
            host = self.query_one("#input-host").value
            port = int(self.query_one("#input-port").value)
            
            self.log_widget.write(f"[Server] Attempting to start on {host}:{port}...")
            
            try:
                from lib.network import handshake
                from werkzeug.serving import make_server
                
                self.server_instance = make_server(host, port, handshake.app)
                
                self.flask_thread = threading.Thread(target=self.server_instance.serve_forever, daemon=True)
                self.flask_thread.start()
                
                self.server_running = True
                btn.label = "Stop Server"
                btn.variant = "error"
                self.log_widget.write("[Server] [green]ONLINE[/green] and listening for JSON payloads.")
                
            except Exception as e:
                self.log_widget.write(f"[Server] [red]ERROR starting server: {e}[/red]")
                
        else:
            # Stop Server
            if self.server_instance:
                self.server_instance.shutdown()
                self.server_instance = None
                
            self.server_running = False
            btn.label = "Start Server"
            btn.variant = "success"
            self.log_widget.write("[Server] [yellow]OFFLINE[/yellow].")

def launch_tui(config):
    """Launcher entry point for the TUI."""
    app = ServerTUI(config)
    app.run()