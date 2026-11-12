"""
GAAXSheet.py
UC GAA Shot Tracker -- X-Sheet panel for Maya

A dockable, read-only X-Sheet. Export the sheet from the Shot Tracker
dashboard ("Export for Maya" on the X-Sheet page), then load the JSON file
here. The row for the current Maya frame is highlighted and follows the
time slider; clicking a row jumps the time slider to that frame.

Shelf button (Python):
    import GAAXSheet; GAAXSheet.show_panel()
"""

import json
import os

try:
    from PySide6 import QtCore, QtWidgets
except ImportError:  # older Maya
    from PySide2 import QtCore, QtWidgets

import maya.cmds as cmds
from maya.app.general.mayaMixin import MayaQWidgetDockableMixin

PANEL_NAME = "GAAXSheetPanel"
OPTION_VAR = "GAAXSheetLastFile"
EXPORT_FORMAT = "shot-tracker-xsheet"

# How Sounds-column symbol spans (hold / accent) are shown in each frame cell.
SYMBOL_TEXT = {
    ("hold", None): "— hold",
    ("accent", "up"): "▲ up",
    ("accent", "down"): "▼ down",
    ("accent", "settle"): "~ settle",
}


def build_model(data):
    """Turns the exported JSON into (headers, first_frame, rows of text).
    No Maya or Qt in here, so it can be tested on its own."""
    columns = [c for c in data.get("columns", []) if c.get("category") != "frame"]
    headers = ["Frame"] + [c["name"] for c in columns]

    first = int(data.get("frame_start") or 1)
    cells_by_frame = {r["frame"]: (r.get("cells") or {}) for r in data.get("rows", [])}
    last = max([int(data.get("frame_end") or first)] + list(cells_by_frame))

    symbol_at = {}
    for s in data.get("symbols", []):
        label = SYMBOL_TEXT.get((s["symbol_type"], s.get("direction")), s["symbol_type"])
        for frame in range(s["frame_start"], s["frame_end"] + 1):
            symbol_at[(s["column_key"], frame)] = label

    rows = []
    for frame in range(first, last + 1):
        cells = cells_by_frame.get(frame, {})
        row = [str(frame)]
        for c in columns:
            text = cells.get(c["key"]) or symbol_at.get((c["key"], frame), "")
            row.append(str(text))
        rows.append(row)
    return headers, first, rows


class XSheetPanel(MayaQWidgetDockableMixin, QtWidgets.QWidget):
    def __init__(self, parent=None):
        super(XSheetPanel, self).__init__(parent=parent)
        self.setObjectName(PANEL_NAME)
        self.setWindowTitle("X-Sheet")

        self._path = ""
        self._first_frame = 1
        self._current_row = -1

        self._build_ui()

        self._timer = QtCore.QTimer(self)
        self._timer.setInterval(150)
        self._timer.timeout.connect(self._sync_to_time)

        last = cmds.optionVar(q=OPTION_VAR) if cmds.optionVar(exists=OPTION_VAR) else ""
        if last and os.path.isfile(last):
            self._load(last)

    # ---- UI ----------------------------------------------------------
    def _build_ui(self):
        layout = QtWidgets.QVBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)

        buttons = QtWidgets.QHBoxLayout()
        load_btn = QtWidgets.QPushButton("Load X-Sheet...")
        load_btn.clicked.connect(self._choose_file)
        reload_btn = QtWidgets.QPushButton("Reload")
        reload_btn.clicked.connect(self._reload)
        buttons.addWidget(load_btn)
        buttons.addWidget(reload_btn)
        buttons.addStretch(1)
        layout.addLayout(buttons)

        self._info = QtWidgets.QLabel("No X-Sheet loaded. Use Load X-Sheet... to pick the exported .json file.")
        self._info.setWordWrap(True)
        layout.addWidget(self._info)

        self._table = QtWidgets.QTableWidget()
        self._table.setEditTriggers(QtWidgets.QAbstractItemView.NoEditTriggers)
        self._table.setSelectionBehavior(QtWidgets.QAbstractItemView.SelectRows)
        self._table.setSelectionMode(QtWidgets.QAbstractItemView.SingleSelection)
        self._table.verticalHeader().setVisible(False)
        self._table.verticalHeader().setDefaultSectionSize(22)
        self._table.cellClicked.connect(self._on_cell_clicked)
        layout.addWidget(self._table)

    # ---- loading -----------------------------------------------------
    def _choose_file(self):
        start = os.path.dirname(self._path) if self._path else os.path.expanduser("~")
        path, _ = QtWidgets.QFileDialog.getOpenFileName(
            self, "Load X-Sheet", start, "X-Sheet (*.json)"
        )
        if path:
            self._load(path)

    def _reload(self):
        if self._path:
            self._load(self._path)
        else:
            self._choose_file()

    def _load(self, path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if data.get("format") != EXPORT_FORMAT:
                raise ValueError("This is not a Shot Tracker X-Sheet export.")
            headers, first, rows = build_model(data)
        except Exception as e:
            cmds.warning("X-Sheet: could not load {}: {}".format(path, e))
            QtWidgets.QMessageBox.warning(self, "X-Sheet", "Could not load that file:\n{}".format(e))
            return

        self._path = path
        cmds.optionVar(stringValue=(OPTION_VAR, path))
        self._first_frame = first
        self._current_row = -1

        self._table.clear()
        self._table.setColumnCount(len(headers))
        self._table.setRowCount(len(rows))
        self._table.setHorizontalHeaderLabels(headers)
        for r, row in enumerate(rows):
            for c, text in enumerate(row):
                item = QtWidgets.QTableWidgetItem(text)
                if c == 0:
                    item.setTextAlignment(QtCore.Qt.AlignCenter)
                self._table.setItem(r, c, item)
        self._table.resizeColumnsToContents()

        who = data.get("student_name") or ""
        self._info.setText("{}{}  |  exported {}".format(
            data.get("assignment_name", ""),
            " - " + who if who else "",
            data.get("exported_at", ""),
        ))
        self._sync_to_time()

    # ---- timeline sync -----------------------------------------------
    def _sync_to_time(self):
        row = int(round(cmds.currentTime(q=True))) - self._first_frame
        if row == self._current_row:
            return
        self._current_row = row
        self._table.blockSignals(True)
        if 0 <= row < self._table.rowCount():
            self._table.selectRow(row)
            self._table.scrollToItem(self._table.item(row, 0), QtWidgets.QAbstractItemView.PositionAtCenter)
        else:
            self._table.clearSelection()
        self._table.blockSignals(False)

    def _on_cell_clicked(self, row, _column):
        cmds.currentTime(self._first_frame + row, edit=True)

    def showEvent(self, event):
        self._timer.start()
        super(XSheetPanel, self).showEvent(event)

    def hideEvent(self, event):
        self._timer.stop()
        super(XSheetPanel, self).hideEvent(event)


_panel = None


def show_panel():
    global _panel
    control = PANEL_NAME + "WorkspaceControl"
    if cmds.workspaceControl(control, query=True, exists=True):
        cmds.deleteUI(control)
    _panel = XSheetPanel()
    _panel.show(dockable=True, floating=False, area="right", retain=False)
