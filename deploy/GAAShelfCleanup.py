"""
GAAShelfCleanup.py
UC GAA Shot Tracker -- keep only the lab's shelf tabs

Maya rebuilds its built-in shelf tabs (Curves, Surfaces, Rigging, Arnold...)
on startup no matter what userPrefs.mel says. Called once per launch from
launcher.py's -command payload, after the UI is built: deletes every shelf
tab not listed in KEEP and selects the GAA tab.
"""

import maya.cmds as cmds
import maya.mel as mel

# Shelf names (the internal name, e.g. "Polygons" is the "Poly Modeling" tab).
KEEP = ("Polygons", "GAA")


def run():
    top = mel.eval("$tmpShelfTop = $gShelfTopLevel")
    tabs = cmds.shelfTabLayout(top, query=True, childArray=True) or []
    for tab in tabs:
        if tab not in KEEP:
            cmds.deleteUI(top + "|" + tab, layout=True)
    if "GAA" in (cmds.shelfTabLayout(top, query=True, childArray=True) or []):
        cmds.shelfTabLayout(top, edit=True, selectTab="GAA")
