"""
DAAP Animation Toolset - Help Window
Shows a reference dialog for the shelf tools. Run show() to open it,
or run install_shelf_button() once to add a permanent button.
"""

try:
    from PySide6 import QtWidgets, QtCore
    from shiboken6 import wrapInstance
except ImportError:
    from PySide2 import QtWidgets, QtCore
    from shiboken2 import wrapInstance
import maya.OpenMayaUI as omui
import maya.cmds as cmds

HELP_HTML = """
<style>
h3 { margin-bottom: 2px; color: #ffcc66; }
p { margin-top: 2px; margin-bottom: 10px; }
ul { margin-top: 2px; margin-bottom: 10px; }
li { margin-bottom: 4px; }
.warn { color: #ff6666; font-weight: bold; }
</style>

<p class="warn">Do NOT use File &gt; Open to open files. Use the Dashboard on Shot Tracker!</p>

<h3>Prefs</h3>
<p>Click on this to set the preferences. This turns on Autokey, turns off the cache, and
changes the frame rate to 24FPSX1</p>

<h3>Fix Scene</h3>
<p>If your file is named incorrectly, this button will rename it based on the
assignment. Do NOT use if your scene is already named correctly.</p>

<h3>GAA_Save</h3>
<p>Only for complex assignments (Blocking, Blocking Plus, Polish). Will not
work on regular assignments.</p>
<ul>
<li>If you've completed a step (e.g. Blocking), click this button.</li>
<li>A window opens asking if you want to save that step, and whether to lock
it when done. Lock it if you're moving on to the next step.</li>
<li>Saving saves that step AND the next step. You'll now be working on the
new step in Maya - true whether you saved here or opened via Shot Tracker.</li>
</ul>

<h3>GAA_Open</h3>
<p>Only for complex assignments (Blocking, Blocking Plus, Polish). Will not
work on regular assignments.</p>
<ul>
<li>Asks which step you want to open.</li>
<li>If a step is locked, it will unlock it and make that the current step.</li>
</ul>

<h3>Rigs</h3>
<p>Only used if you are adding rigs to your scene. Most times you will not
need this.</p>

<h3>Face Cam</h3>
<p>Adds a camera attached to the head of a character. Only needed in upper
level courses.</p>

<h3>Scene</h3>
<p>Opens the reference editor.</p>

<h3>Incremental Save</h3>
<p>Bumps the version number of your file, saving an identical copy at the
next version.</p>

<h3>Select Mask Toggle</h3>
<p>Toggles between selecting everything in the scene and selecting only
splines and cameras. Useful with heavy backgrounds you don't want to select.</p>

<h3>Graph Editor</h3>
<p>Opens the Graph Editor.</p>

<h3>Tween Machine</h3>
<p>Opens the Tween Machine controller.</p>

<h3>Spline</h3>
<p>Makes every keyframe FROM NOW ON a spline key. Does not change existing keys.</p>

<h3>Step</h3>
<p>Makes every keyframe FROM NOW ON a stepped key. Does not change existing keys.</p>

<h3>Add</h3>
<p>Adds an inbetween wherever your cursor is on the timeline.</p>

<h3>Delete</h3>
<p>Deletes an inbetween wherever your cursor is on the timeline.</p>

<h3>ZV Parent</h3>
<p>Opens the ZV Parent window, used for attaching and detaching objects.</p>

<h3>X-Sheet</h3>
<p>Loads in an X-sheet from Shot Tracker. Make sure to Export for Maya in Shot Tracker first.</p>

<h3>UC_Blast</h3>
<p>Use this when submitting assignments.</p>

<h3>Film_Shot</h3>
<p>Use this only when submitting FILM SHOTS.</p>

<h3>Assets</h3>
<p>ONLY FOR FILMS! This will look to see if your assets are the most up to date. A Popup 
will show what is not and give you the choice to update or not.</p>

<h3>Submit Assets</h3>
<p>ONLY FOR FILMS! This will submit your asset scene. It automatically changes the status
for the asset to Submitted.</p>

<h3>Picker</h3>
<p>Opens the Picker. Use it to select the parts of a rig.</p>

<h3>Studio Library</h3>
<p>Opens the Studio Library. Use it to save and apply poses for the face and/or fingers.</p>

"""


def maya_main_window():
    ptr = omui.MQtUtil.mainWindow()
    return wrapInstance(int(ptr), QtWidgets.QWidget)


class DaapHelpDialog(QtWidgets.QDialog):

    WINDOW_NAME = "daapHelpDialog"

    def __init__(self, parent=maya_main_window()):
        super(DaapHelpDialog, self).__init__(parent)
        self.setObjectName(self.WINDOW_NAME)
        self.setWindowTitle("DAAP Tool Help")
        self.setMinimumSize(480, 620)
        self.setWindowFlags(self.windowFlags() | QtCore.Qt.WindowStaysOnTopHint)

        layout = QtWidgets.QVBoxLayout(self)

        text = QtWidgets.QTextEdit()
        text.setReadOnly(True)
        text.setHtml(HELP_HTML)
        layout.addWidget(text)

        close_btn = QtWidgets.QPushButton("Close")
        close_btn.clicked.connect(self.close)
        layout.addWidget(close_btn)


def show():
    # close any existing instance first so re-running doesn't stack windows
    for widget in QtWidgets.QApplication.allWidgets():
        if widget.objectName() == DaapHelpDialog.WINDOW_NAME:
            widget.close()
            widget.deleteLater()

    dlg = DaapHelpDialog()
    dlg.show()
    return dlg


def install_shelf_button(shelf_name="Custom"):
    """Run once to add a Help button to the given shelf."""
    if not cmds.shelfLayout(shelf_name, exists=True):
        cmds.error("Shelf '{}' does not exist.".format(shelf_name))
        return

    cmds.shelfButton(
        parent=shelf_name,
        label="Help",
        annotation="DAAP tool help",
        image1="help.png",
        command="import daap_help; daap_help.show()",
        sourceType="python",
    )
