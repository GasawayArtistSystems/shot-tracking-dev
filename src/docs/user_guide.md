# 📝 User Guide

## 🔐 Logging In
Use your assigned login name and password.

## 🧭 Navigation
- Dashboard: See your current status
- Classes: Manage rosters and videos

## 🎯 Video Markup
Click “Markup” next to any film to begin.

## 📞 Need Help?
Contact your instructor or admin.

## 🎬 Playblast Tool – Instructor Overview

The GAA Playblast Tool enables students to render their animation assignments and automatically submit them to the assignment tracker.

### How It Works:
- Students generate `.webm` files from Maya using the tool.
- When rendering in **1080p**, the system marks their assignment as **"Submitted"** in the backend database.
- Submission is linked based on metadata embedded in the Maya file:
  - `GAA_user` → student login name
  - `GAA_class` → class name
  - `GAA_assignment` → assignment name

### Naming Convention:
Files are named as:

```
AssignmentName_Student Name_v#.webm
```

For example:  
```
BouncingBall_Bari Ann_v3.webm
```

### Where to Find Videos:
Videos are automatically copied to a shared output folder defined by each class in the assignment config file.

### Instructor Tips:
- Ensure students **create scenes via the Assignment Tool** to embed the necessary metadata.
- Review `.webm` submissions in the shared output folders or via your instructor dashboard.
- **540p playblasts** are intended for student previews and will **not** mark assignments as submitted.

### Coming Soon:
- Support for multi-step film assignments (modeling → blocking → polish)
- Automated submission feedback from instructors
- Submission audit history and grading integration
