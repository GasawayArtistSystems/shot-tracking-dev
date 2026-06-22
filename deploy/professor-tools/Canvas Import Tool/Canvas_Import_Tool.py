"""
Canvas_Import_Tool.py
UC Animation - Shot Tracker Import Tool
PySide6

Converts student AVI submissions from Canvas into webm files
and drops them into the Shot Tracker server folder for markup review.

Workflow:
  1. Pick semester and class from Shot Tracker API
  2. Point at unzipped Canvas submissions folder
  3. Preview detected files
  4. Convert AVI -> webm via ffmpeg and copy to server

Filename conversion:
  BrandonToran_BouncingBall_v006.avi
  -> BouncingBall_BrandonToran_v006.webm

Server output:
  \\GAAAP1PRD01W\Classes\<semester>\<class>\Assignments\
"""

import os
import re
import sys
import subprocess
import threading
import requests

from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QComboBox, QPushButton, QFileDialog, QTableWidget,
    QTableWidgetItem, QTextEdit, QProgressBar, QFrame, QHeaderView,
    QMessageBox, QSplitter
)
from PySide6.QtCore import Qt, Signal, QObject, QThread
from PySide6.QtGui import QFont, QColor


# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────

SHOT_TRACKER_URL = "http://10.23.20.210:8000"
FFMPEG_PATH      = r"C:\Cincy\ffmpeg\bin\ffmpeg.exe"
SERVER_BASE      = r"\\GAAAP1PRD01W\Classes"

# Maps filename tokens back to Shot Tracker assignment names
ASSIGNMENT_TOKEN_MAP = {
    "BouncingBall": "Bouncing Ball",
    "BallBounce":   "Bouncing Ball",   # legacy token from earlier tool version
    "TailPendulum": "Tail Pendulum",
    "TailBounce":   "Tail Bounce",
    "WeightShift":  "Weight Shift",
    "VanillaWalk":  "Vanilla Walk",
}


# ─────────────────────────────────────────────
#  WORKER SIGNALS
# ─────────────────────────────────────────────

class WorkerSignals(QObject):
    log        = Signal(str, str)   # message, level (info/success/error/warn)
    progress   = Signal(int, int)   # current, total
    row_status = Signal(int, str)   # row index, status
    finished   = Signal()


# ─────────────────────────────────────────────
#  CONVERSION WORKER
# ─────────────────────────────────────────────

class ConversionWorker(QThread):

    def __init__(self, files, output_dir, ffmpeg_path):
        super().__init__()
        self.files       = files        # list of dicts from preview table
        self.output_dir  = output_dir
        self.ffmpeg_path = ffmpeg_path
        self.signals     = WorkerSignals()
        self._cancelled  = False

    def cancel(self):
        self._cancelled = True

    def run(self):
        total = len(self.files)
        os.makedirs(self.output_dir, exist_ok=True)

        for i, file_info in enumerate(self.files):
            if self._cancelled:
                self.signals.log.emit("Conversion cancelled.", "warn")
                break

            src_path    = file_info["path"]
            output_name = file_info["output_name"]
            output_path = os.path.join(self.output_dir, output_name)

            self.signals.log.emit(f"Converting: {os.path.basename(src_path)}", "info")
            self.signals.row_status.emit(i, "Converting...")

            try:
                cmd = [
                    self.ffmpeg_path,
                    "-y",
                    "-i", src_path,
                    "-c:v", "libvpx-vp9",
                    "-b:v", "1M",
                    "-c:a", "libopus",
                    output_path
                ]

                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True
                )

                if result.returncode != 0:
                    self.signals.log.emit(
                        f"  ERROR: ffmpeg failed for {os.path.basename(src_path)}", "error"
                    )
                    self.signals.log.emit(f"  {result.stderr[-300:]}", "error")
                    self.signals.row_status.emit(i, "Failed")
                else:
                    self.signals.log.emit(
                        f"  → Saved: {output_name}", "success"
                    )
                    self.signals.row_status.emit(i, "Done ✓")

            except Exception as e:
                self.signals.log.emit(f"  EXCEPTION: {str(e)}", "error")
                self.signals.row_status.emit(i, "Failed")

            self.signals.progress.emit(i + 1, total)

        self.signals.log.emit("─" * 50, "info")
        self.signals.log.emit("Conversion complete.", "success")
        self.signals.finished.emit()


# ─────────────────────────────────────────────
#  MAIN WINDOW
# ─────────────────────────────────────────────

class CanvasImportTool(QMainWindow):

    def __init__(self):
        super().__init__()
        self.setWindowTitle("UC Animation  ·  Canvas Import Tool")
        self.setMinimumSize(900, 700)
        self._worker       = None
        self._file_infos   = []
        self._semesters    = []   # list of {id, year, term}
        self._build_ui()
        self._load_semesters()

    # ─────────────────────────────────────────
    #  UI
    # ─────────────────────────────────────────

    def _build_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        root = QVBoxLayout(central)
        root.setSpacing(10)
        root.setContentsMargins(16, 16, 16, 16)

        # ── Header ──
        header = QLabel("UC Animation  ·  Canvas → Shot Tracker Import Tool")
        font = QFont()
        font.setBold(True)
        font.setPointSize(13)
        header.setFont(font)
        header.setAlignment(Qt.AlignCenter)
        root.addWidget(header)

        line = QFrame()
        line.setFrameShape(QFrame.HLine)
        line.setFrameShadow(QFrame.Sunken)
        root.addWidget(line)

        # ── Semester + Class row ──
        sc_layout = QHBoxLayout()

        sc_layout.addWidget(QLabel("Semester:"))
        self.semester_combo = QComboBox()
        self.semester_combo.setMinimumWidth(160)
        self.semester_combo.currentIndexChanged.connect(self._on_semester_changed)
        sc_layout.addWidget(self.semester_combo)

        sc_layout.addSpacing(20)

        sc_layout.addWidget(QLabel("Class:"))
        self.class_combo = QComboBox()
        self.class_combo.setMinimumWidth(220)
        self.class_combo.currentIndexChanged.connect(self._update_output_path)
        sc_layout.addWidget(self.class_combo)

        sc_layout.addStretch()

        refresh_btn = QPushButton("↺ Refresh")
        refresh_btn.setFixedWidth(80)
        refresh_btn.clicked.connect(self._load_semesters)
        sc_layout.addWidget(refresh_btn)

        help_btn = QPushButton("? Help")
        help_btn.setFixedWidth(70)
        help_btn.clicked.connect(self._show_help)
        sc_layout.addWidget(help_btn)

        root.addLayout(sc_layout)

        # ── Output path preview ──
        out_layout = QHBoxLayout()
        out_layout.addWidget(QLabel("Output folder:"))
        self.output_label = QLabel("—")
        self.output_label.setStyleSheet("color: #888888; font-size: 10px;")
        self.output_label.setWordWrap(True)
        out_layout.addWidget(self.output_label)
        root.addLayout(out_layout)

        line2 = QFrame()
        line2.setFrameShape(QFrame.HLine)
        line2.setFrameShadow(QFrame.Sunken)
        root.addWidget(line2)

        # ── Folder picker ──
        folder_layout = QHBoxLayout()
        folder_layout.addWidget(QLabel("Canvas submissions folder:"))
        self.folder_label = QLabel("No folder selected")
        self.folder_label.setStyleSheet("color: #888888; font-size: 10px;")
        folder_layout.addWidget(self.folder_label, stretch=1)

        browse_btn = QPushButton("Browse...")
        browse_btn.setFixedWidth(90)
        browse_btn.clicked.connect(self._browse_folder)
        folder_layout.addWidget(browse_btn)

        root.addLayout(folder_layout)

        # ── Splitter: table + log ──
        splitter = QSplitter(Qt.Vertical)

        # File preview table
        self.table = QTableWidget(0, 4)
        self.table.setHorizontalHeaderLabels(["Source File", "Student", "Assignment", "Output Name", ])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(3, QHeaderView.Stretch)
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        splitter.addWidget(self.table)

        # Log
        self.log_box = QTextEdit()
        self.log_box.setReadOnly(True)
        self.log_box.setStyleSheet("background: #1a1a1a; color: #cccccc; font-family: monospace; font-size: 10px;")
        self.log_box.setMaximumHeight(180)
        splitter.addWidget(self.log_box)

        root.addWidget(splitter, stretch=1)

        # ── Progress bar ──
        self.progress_bar = QProgressBar()
        self.progress_bar.setValue(0)
        self.progress_bar.setVisible(False)
        root.addWidget(self.progress_bar)

        # ── Buttons ──
        btn_layout = QHBoxLayout()

        self.status_label = QLabel("")
        self.status_label.setStyleSheet("color: #aaaaaa; font-size: 10px;")
        btn_layout.addWidget(self.status_label)
        btn_layout.addStretch()

        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.setFixedHeight(32)
        self.cancel_btn.setVisible(False)
        self.cancel_btn.clicked.connect(self._cancel)
        btn_layout.addWidget(self.cancel_btn)

        self.convert_btn = QPushButton("Convert & Import All")
        self.convert_btn.setFixedHeight(32)
        self.convert_btn.setFixedWidth(160)
        self.convert_btn.setEnabled(False)
        self.convert_btn.clicked.connect(self._start_conversion)
        btn_layout.addWidget(self.convert_btn)

        root.addLayout(btn_layout)

    # ─────────────────────────────────────────
    #  SHOT TRACKER API
    # ─────────────────────────────────────────

    def _load_semesters(self):
        self._log("Loading semesters from Shot Tracker...", "info")
        try:
            r = requests.get(f"{SHOT_TRACKER_URL}/classes/semesters", timeout=5)
            r.raise_for_status()
            self._semesters = r.json()

            self.semester_combo.blockSignals(True)
            self.semester_combo.clear()
            for s in self._semesters:
                label = f"{s['year']} - {s['term']}"
                self.semester_combo.addItem(label, userData=s["id"])
            self.semester_combo.blockSignals(False)

            self._log(f"  Loaded {len(self._semesters)} semesters.", "success")
            if self._semesters:
                self._on_semester_changed()
        except Exception as e:
            self._log(f"  Could not reach Shot Tracker: {e}", "error")
            self.semester_combo.addItem("Could not load — check server")

    def _on_semester_changed(self):
        semester_id = self.semester_combo.currentData()
        if not semester_id:
            return

        self._log("Loading classes...", "info")
        try:
            r = requests.get(
                f"{SHOT_TRACKER_URL}/classes/api/classes/by-semester/{semester_id}",
                timeout=5
            )
            r.raise_for_status()
            class_names = r.json()

            self.class_combo.clear()
            for name in class_names:
                self.class_combo.addItem(name)

            self._log(f"  Loaded {len(class_names)} classes.", "success")
            self._update_output_path()
        except Exception as e:
            self._log(f"  Could not load classes: {e}", "error")

    def _update_output_path(self):
        semester_label = self.semester_combo.currentText().replace(" - ", "-").replace(" ", "_")
        class_name     = self.class_combo.currentText().replace(" ", "_")

        if semester_label and class_name:
            path = os.path.join(SERVER_BASE, semester_label, class_name, "Assignments")
            self.output_label.setText(path)
        else:
            self.output_label.setText("—")

        self._refresh_preview()

    # ─────────────────────────────────────────
    #  FOLDER BROWSING + FILE DETECTION
    # ─────────────────────────────────────────

    def _browse_folder(self):
        folder = QFileDialog.getExistingDirectory(self, "Select Canvas Submissions Folder")
        if folder:
            self.folder_label.setText(folder)
            self._refresh_preview()

    def _refresh_preview(self):
        folder = self.folder_label.text()
        if not os.path.isdir(folder):
            return

        self._file_infos = []
        self.table.setRowCount(0)

        avi_files = [f for f in os.listdir(folder) if f.lower().endswith(".avi")]

        if not avi_files:
            self._log("No AVI files found in selected folder.", "warn")
            self.convert_btn.setEnabled(False)
            return

        for f in sorted(avi_files):
            info = self._parse_filename(f, folder)
            if info:
                self._file_infos.append(info)

        self._populate_table()
        self.convert_btn.setEnabled(bool(self._file_infos))
        self._log(f"Found {len(self._file_infos)} AVI file(s) ready to convert.", "info")

    def _parse_filename(self, filename, folder):
        """
        Parse BrandonToran_BouncingBall_v006.avi into components.

        Converts:
          student token  BrandonToran -> Brandon Toran (insert space before capitals)
          assignment token BouncingBall -> Bouncing Ball (from TOKEN_MAP)

        Output name: Bouncing Ball_Brandon Toran_v006.webm
        (matches Shot Tracker's existing naming convention)
        """
        base = os.path.splitext(filename)[0]

        # Match Name_Assignment_v### pattern
        m = re.match(r"^([A-Za-z]+)_([A-Za-z0-9]+)_(v\d+)$", base)
        if not m:
            self._log(f"  Skipping (unexpected filename format): {filename}", "warn")
            return None

        student_token    = m.group(1)
        assignment_token = m.group(2)
        version          = m.group(3)

        # Convert assignment token to full name
        assignment_full = ASSIGNMENT_TOKEN_MAP.get(
            assignment_token,
            # Fallback: insert spaces before capitals e.g. TailBounce -> Tail Bounce
            re.sub(r"(?<=[a-z])(?=[A-Z])", " ", assignment_token)
        )

        # Convert student token to full name by inserting space before capitals
        # BrandonToran -> Brandon Toran
        student_full = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", student_token)

        # Build output name matching Shot Tracker convention:
        # AssignmentName_Student Name_version.webm
        output_name = f"{assignment_full}_{student_full}_{version}.webm"

        return {
            "filename":         filename,
            "path":             os.path.join(folder, filename),
            "student":          student_full,
            "assignment":       assignment_full,
            "version":          version,
            "output_name":      output_name,
        }

    def _populate_table(self):
        self.table.setRowCount(len(self._file_infos))
        for i, info in enumerate(self._file_infos):
            self.table.setItem(i, 0, QTableWidgetItem(info["filename"]))
            self.table.setItem(i, 1, QTableWidgetItem(info["student"]))
            self.table.setItem(i, 2, QTableWidgetItem(info["assignment"]))
            self.table.setItem(i, 3, QTableWidgetItem(info["output_name"]))

    # ─────────────────────────────────────────
    #  CONVERSION
    # ─────────────────────────────────────────

    def _start_conversion(self):
        if not self._file_infos:
            QMessageBox.warning(self, "No Files", "No AVI files to convert.")
            return

        output_dir = self.output_label.text()
        if output_dir == "—":
            QMessageBox.warning(self, "No Output", "Please select a semester and class first.")
            return

        if not os.path.isfile(FFMPEG_PATH):
            QMessageBox.critical(
                self, "ffmpeg Not Found",
                f"ffmpeg not found at:\n{FFMPEG_PATH}\n\nMake sure C:\\Cincy\\ffmpeg is installed."
            )
            return

        # Confirm
        result = QMessageBox.question(
            self, "Confirm Import",
            f"Convert {len(self._file_infos)} file(s) and copy to:\n{output_dir}\n\nProceed?",
            QMessageBox.Yes | QMessageBox.No
        )
        if result != QMessageBox.Yes:
            return

        self.convert_btn.setEnabled(False)
        self.cancel_btn.setVisible(True)
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        self.progress_bar.setMaximum(len(self._file_infos))

        self._worker = ConversionWorker(self._file_infos, output_dir, FFMPEG_PATH)
        self._worker.signals.log.connect(self._log)
        self._worker.signals.progress.connect(self._on_progress)
        self._worker.signals.row_status.connect(self._on_row_status)
        self._worker.signals.finished.connect(self._on_finished)
        self._worker.start()

    def _cancel(self):
        if self._worker:
            self._worker.cancel()
        self.cancel_btn.setVisible(False)

    def _on_progress(self, current, total):
        self.progress_bar.setValue(current)
        self.status_label.setText(f"Processing {current} of {total}...")

    def _on_row_status(self, row, status):
        if row < self.table.rowCount():
            item = QTableWidgetItem(status)
            if "Done" in status:
                item.setForeground(QColor("#44cc44"))
            elif "Failed" in status:
                item.setForeground(QColor("#cc4444"))
            else:
                item.setForeground(QColor("#cccc44"))
            self.table.setItem(row, 3, item)

    def _on_finished(self):
        self.convert_btn.setEnabled(True)
        self.cancel_btn.setVisible(False)
        self.status_label.setText("Done.")
        QMessageBox.information(
            self, "Import Complete",
            "All files have been converted and copied to the Shot Tracker server.\n\n"
            "They will now appear in the Markup tool under the Assignments tab."
        )

    # ─────────────────────────────────────────
    #  HELP
    # ─────────────────────────────────────────

    def _show_help(self):
        help_text = """
<h2 style="color:#4488ff;">Canvas → Shot Tracker Import Tool</h2>
<p>This tool converts student AVI submissions from Canvas into webm files
and copies them to the Shot Tracker server for markup review.</p>

<h3 style="color:#44cc44;">Step-by-Step Workflow</h3>
<ol>
  <li><b>Download submissions from Canvas</b><br>
      Go to the assignment → click <i>Download Submissions</i> → unzip the zip file anywhere.</li>

  <li><b>Select the correct Semester and Class</b><br>
      Use the dropdowns at the top. The Output folder will update automatically
      to show exactly where files will be copied on the server.</li>

  <li><b>Browse to the unzipped Canvas folder</b><br>
      Click <i>Browse</i> and select the folder containing the student AVI files.
      The tool will detect all AVIs and show a preview in the table.</li>

  <li><b>Click Convert &amp; Import All</b><br>
      Each AVI is converted to webm, renamed to Shot Tracker format,
      and copied directly to the server. Progress shows in the log below.</li>

  <li><b>Open Shot Tracker Markup</b><br>
      The converted files will now appear under the Assignments tab
      in the Markup tool, ready for review.</li>
</ol>

<h3 style="color:#cccc44;">File Naming</h3>
<p>Student files are automatically renamed from:<br>
<code>BrandonToran_BouncingBall_v001.avi</code><br>
to Shot Tracker format:<br>
<code>Bouncing Ball_Brandon Toran_v001.webm</code></p>

<h3 style="color:#cccc44;">Troubleshooting</h3>
<ul>
  <li><b>Semester dropdown says "Could not load"</b> — Make sure you are connected
      to the UC network or VPN and Shot Tracker is running.</li>
  <li><b>File shows Done ✓ but not on server</b> — Check that the correct
      Semester and Class are selected before converting.</li>
  <li><b>File skipped in preview</b> — The filename doesn't match the expected
      format. Check the student submitted the correct AVI file.</li>
</ul>
        """

        dialog = QMessageBox(self)
        dialog.setWindowTitle("How to Use the Canvas Import Tool")
        dialog.setTextFormat(Qt.RichText)
        dialog.setText(help_text)
        dialog.setStandardButtons(QMessageBox.Ok)
        dialog.setMinimumWidth(600)
        dialog.exec()

    # ─────────────────────────────────────────
    #  LOGGING
    # ─────────────────────────────────────────

    def _log(self, message, level="info"):
        colors = {
            "info":    "#cccccc",
            "success": "#44cc44",
            "error":   "#cc4444",
            "warn":    "#cccc44",
        }
        color = colors.get(level, "#cccccc")
        self.log_box.append(f'<span style="color:{color};">{message}</span>')
        self.log_box.verticalScrollBar().setValue(
            self.log_box.verticalScrollBar().maximum()
        )


# ─────────────────────────────────────────────
#  ENTRY POINT
# ─────────────────────────────────────────────

def main():
    app = QApplication(sys.argv)
    app.setStyle("Fusion")

    # Dark palette
    from PySide6.QtGui import QPalette
    palette = QPalette()
    palette.setColor(QPalette.Window,          QColor(40, 40, 40))
    palette.setColor(QPalette.WindowText,      QColor(220, 220, 220))
    palette.setColor(QPalette.Base,            QColor(25, 25, 25))
    palette.setColor(QPalette.AlternateBase,   QColor(53, 53, 53))
    palette.setColor(QPalette.Text,            QColor(220, 220, 220))
    palette.setColor(QPalette.Button,          QColor(53, 53, 53))
    palette.setColor(QPalette.ButtonText,      QColor(220, 220, 220))
    palette.setColor(QPalette.Highlight,       QColor(42, 130, 218))
    palette.setColor(QPalette.HighlightedText, QColor(0, 0, 0))
    app.setPalette(palette)

    window = CanvasImportTool()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
