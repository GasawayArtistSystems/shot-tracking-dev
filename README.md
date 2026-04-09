# Shot Tracker

Shot Tracker is a workflow-driven production tracking system for animation classes and film pipelines.

It supports:

* Class assignments and grading workflows
* Film production tracking (sequences, shots, tasks)
* Review + markup system
* Workflow state management

---

## 📁 Project Structure

```
shot-tracking-dev/
├── src/                # Main application (Flask + React)
├── scripts/            # Utility and helper scripts
├── docs/               # Documentation
├── config/             # Config files
├── Start_Server.bat    # Production entry point
├── wsgi.py             # WSGI entry
├── package.json        # Frontend dependencies
```

---

## 🚀 Setup

### Backend (Flask)

```bash
cd src
pip install -r requirements.txt
python run_flask.py
```

---

### Frontend (React)

```bash
cd src/static/react
npm install
npm run dev
```

---

## 🏁 Production (Windows)

Run:

```bash
Start_Server.bat
```

This starts the app using `waitress` at:

```
http://localhost:8000
```

---

## ⚠️ Important Notes

* Media files (videos, uploads, logs) are NOT tracked in Git
* `.env` is required for configuration
* Do not commit large files
* Use `scripts/` for utilities and helpers

---

## 🧪 Status

Stable baseline after repository cleanup and structure reorganization.

---

## 👨‍💻 Maintained by

Mike Gasaway
Gasman Group, LLC
