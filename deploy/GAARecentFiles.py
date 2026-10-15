"""
GAARecentFiles.py
UC GAA Shot Tracker -- keep File > Recent Files up to date

Maya only adds a scene to File > Recent Files when it's opened or saved
through its own File menu. Every GAA tool (Assignments.py, Assets.py,
GAASave.py, SaveNextVersion.py, the Capstone*.py flows) opens and saves
with cmds.file() instead, which skips that step -- so nothing a student
saved to the server ever showed up there.

Rather than patching each tool's save/open call, install() registers
after-open and after-save scene callbacks that hand the scene to Maya's
own addRecentFile proc, the same one File > Open/Save use (it de-dupes
and moves the entry to the top). Called once per Maya session from
launcher.py's -command payload; safe to call again, it won't register
twice.
"""

import maya.cmds as cmds
import maya.mel as mel
import maya.OpenMaya as om

_callback_ids = []


def _add_current_scene(*_):
    try:
        path = cmds.file(q=True, sceneName=True)
        if not path:
            return
        file_type = (cmds.file(q=True, type=True) or ["mayaAscii"])[0]
        mel.eval('addRecentFile("{}", "{}")'.format(
            path.replace("\\", "/").replace('"', '\\"'), file_type
        ))
    except Exception as e:
        cmds.warning(f"GAARecentFiles: could not add scene to Recent Files: {e}")


def install():
    if _callback_ids:
        return
    for msg in (om.MSceneMessage.kAfterOpen, om.MSceneMessage.kAfterSave):
        _callback_ids.append(om.MSceneMessage.addCallback(msg, _add_current_scene))
