# Film and Class Tracker

A Flask-based web application for managing classes, films, and assignments. Designed for educational institutions to streamline progress tracking and workflow management.

---

## 📁 Project Structure

```
Film-and-Class-Tracker/
├── src/
│   └── app/
│       ├── __init__.py
│       ├── routes/
│       ├── utils/
│       └── ...
├── static/
├── templates/
├── wsgi.py
├── start_production.bat
├── requirements.txt
├── config.py
├── README.md
└── ...
```

---

## ⚙️ Requirements

Install required packages with:

```bash
pip install -r requirements.txt
```

---

## 🚀 Quick Start

### 🧪 Development Mode

1. Set environment variables:

```bash
set FLASK_APP=src.app
set FLASK_ENV=development
```

2. Run the app:

```bash
flask run
```

The app will be available at [http://localhost:5000](http://localhost:5000).

### 🏁 Production Mode (Windows)

1. Double-click or run:

```bash
start_production.bat
```

This uses `waitress` to serve the app on:

```
http://localhost:8080
```

If needed, edit `wsgi.py` to make sure it contains:

```python
from src.app import create_app

app = create_app()
```

---

## 🔐 Configurations

All config settings (dev, prod) are in `config.py`. The app uses the `ProductionConfig` class by default when running via `waitress`.

---

## 📦 Deployment Tips

* Tag stable releases:

  ```bash
  git tag prod-YYYY-MM-DD
  git push origin --tags
  ```

* Use `main` for production, `dev` branch for experiments.

* Keep `start_production.bat` for ease of launch on Windows.

---

## ✅ Ready to Go!

* App launches via `start_production.bat`
* Dev work runs easily via `flask run`
* Code lives in `src/app/`
* Waitress serves it fast and clean in production

Enjoy maintaining and scaling the Film and Class Tracker!

---

## 👨‍💻 Maintained by

Mike Gasaway
Gasman Group, LLC
00gasman00@gmail.com
