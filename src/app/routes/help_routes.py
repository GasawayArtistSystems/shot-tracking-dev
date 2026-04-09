from flask import Blueprint, render_template_string, render_template, send_from_directory, request, jsonify
import markdown
import os
import re

help_bp = Blueprint("help", __name__)

@help_bp.route("/help")
def help_page():
    md_path = os.path.join(os.path.dirname(__file__), "../../docs/user_guide.md")
    try:
        with open(md_path, "r", encoding="utf-8") as f:
            md_content = f.read()
    except FileNotFoundError:
        md_content = "# Help\nHelp content not found."

    # Extract headers for table of contents
    headers = re.findall(r'^##?\s+(.*)', md_content, re.MULTILINE)
    toc = '\n'.join([f'- [{h}](#{re.sub(r"[^a-zA-Z0-9]+", "-", h.strip()).lower().strip("-")})' for h in headers])

    # Add ID anchors to headers
    def header_with_id(match):
        level, text = match.group(1), match.group(2)
        anchor = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip()).lower().strip("-")
        return f"{level} <a id=\"{anchor}\"></a>{text}"

    md_content = re.sub(r'^(#{1,2})\s+(.*)', header_with_id, md_content, flags=re.MULTILINE)

    html_content = markdown.markdown(md_content, extensions=["fenced_code", "tables"])
    toc_html = markdown.markdown(toc)

    return render_template_string("""
    {% extends 'base.html' %}
    {% block content %}
    <div class="flex gap-8 p-8">
        <aside class="w-1/4 bg-gray-100 p-4 rounded-xl h-fit sticky top-8 shadow">
            <h2 class="text-lg font-bold text-black mb-2">Table of Contents</h2>
            <div class="prose">{{ toc|safe }}</div>
        </aside>
        <main class="prose max-w-3xl bg-white text-black p-6 rounded-xl shadow">
            {{ content|safe }}
        </main>
    </div>
    {% endblock %}
    """, content=html_content, toc=toc_html)

@help_bp.route("/help/overview")
def help_overview():
    return render_template("help/help_overview.html")

@help_bp.route("/help/classes")
def help_classes():
    return render_template("help/help_classes.html")

@help_bp.route("/help/getting_started")
def help_getting_started():
    return render_template("help/help_getting_started.html")

@help_bp.route("/help/films")
def help_films():
    return render_template("help/help_films.html")

@help_bp.route("/help/editorial")
def help_editorial():
    return render_template("help/help_editorial.html")

@help_bp.route("/help/markup_tool")
def help_markup_tool():
    return render_template("help/help_markup_tool.html")

@help_bp.route("/help/admin")
def help_admin():
    return render_template("help/help_admin.html")

@help_bp.route("/help/grading")
def help_grading():
    return render_template("help/help_grading.html")

@help_bp.route('/help/maya')
def help_maya():
    return render_template('help/help_maya.html')

@help_bp.route('/help/harmony')
def help_harmony():
    return render_template('help/help_harmony.html')

@help_bp.route('/help/sbpro')
def help_sbpro():
    return render_template('help/help_sbpro.html')

@help_bp.route('/help/timeline')
def help_timeline():
    return render_template('help/help_timeline.html')

@help_bp.route('/tables')
def help_tables():
    return render_template('help/help_tables.html')

@help_bp.route("/help/buttons")
def help_buttons():
    import json
    from flask import current_app

    json_path = os.path.join(current_app.root_path, "..", "static", "help", "buttons.json")
    with open(json_path, "r", encoding="utf-8") as f:
        buttons = json.load(f)

    return render_template("help/help_buttons.html", buttons=buttons)

@help_bp.route("/help/videos")
def help_videos():
    thumbs_dir = os.path.join("src", "static", "help", "thumbs")
    videos_dir = os.path.join("src", "static", "help", "videos")

    video_entries = []
    # Optional: define custom blurbs
    video_blurbs = {
        "st_admin": "The Admin dropdowns and anything related to administrative work.",
        "st_classes_overview": "Complete overview of the classes section of the app.",
        "st_dashboard": "Overview of the dashboard as seen by students.",
        "st_workflow": "Overall and Individual flows explained.",
        "st_timeline_edit": "How to edit the Timeline in the Films app.",
        "st_film_overview": "Each section of the Film section of the app.",
        "st_film_add": "The entire process of adding a film, its scenes, shots, and assets.",
        "st_markup": "The Markup tool and how to use it in production and classes.",
        "st_config_classes": "How the config file is used in classes/production. How to edit the file.",
        "st_overview": "Overview of the entire Shot Tracker app.",
    }

    for file_name in sorted(os.listdir(videos_dir)):
        if file_name.endswith(".mp4"):
            base_name = os.path.splitext(file_name)[0]
            thumb_path = f"/static/help/thumbs/{base_name}.jpg"
            video_path = f"/static/help/videos/{file_name}"

            title = base_name.replace("st_", "").replace("_", " ").title()
            summary = video_blurbs.get(base_name, f"Quick tutorial: {title}.")

            video_entries.append({
                "id": len(video_entries) + 1,
                "title": title,
                "summary": summary,
                "thumbnail": thumb_path,
                "video_url": video_path
            })


    return render_template("help/videos.html", videos=video_entries)

@help_bp.route("/help/videos/<int:video_id>")
def help_video_detail(video_id):
    videos_dir = os.path.join("src", "static", "help", "videos")

    # same blurbs as the list page
    video_blurbs = {
        "st_getting_started": "Learn how to navigate the Shot Tracker interface and understand the basics.",
        "st_creating_assignments": "Walkthrough of creating and managing assignments in your class.",
        "st_tracking_progress": "Understand how to track student progress through the workflow.",
    }

    # collect all video files
    video_files = sorted([f for f in os.listdir(videos_dir) if f.endswith(".mp4")])

    # make sure the id is valid
    if video_id < 1 or video_id > len(video_files):
        return "Video not found", 404

    # grab the selected one
    file_name = video_files[video_id - 1]
    base_name = os.path.splitext(file_name)[0]
    title = base_name.replace("st_", "").replace("_", " ").title()

    # use the blurb if it exists
    summary = video_blurbs.get(base_name, f"Quick tutorial: {title}.")
    video_path = f"/static/help/videos/{file_name}"

    # navigation
    prev_id = video_id - 1 if video_id > 1 else None
    next_id = video_id + 1 if video_id < len(video_files) else None

    # render
    return render_template(
        "help/video_detail.html",
        video={
            "title": title,
            "video_url": video_path,
            "summary": summary,
            "thumbnail": f"/static/help/thumbs/{base_name}.jpg",
        },
        prev_id=prev_id,
        next_id=next_id
    )

@help_bp.route('/repo/<path:filename>')
def download_repo_file(filename):
    r"""Serve files from the C:\myapp\Repo directory."""
    repo_path = r"C:\myapp\Repo"
    return send_from_directory(repo_path, filename, as_attachment=True)


@help_bp.route("/help/search")
def help_search():
    """Search across help HTML files safely."""
    try:
        query = request.args.get("q", "").strip().lower()
        results = []

        if not query:
            return jsonify([])

        help_dir = os.path.join(os.path.dirname(__file__), "../../templates/help")
        exclude_files = {"videos.html", "video_detail.html"}

        for fname in os.listdir(help_dir):
            if not fname.endswith(".html") or fname in exclude_files:
                continue

            fpath = os.path.join(help_dir, fname)
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()
                ids = re.findall(r'id="([^"]+)"', content, re.I)

            # Extract IDs from headings
            ids = re.findall(r'id="([^"]+)"', content)

            # strip HTML tags
            # strip HTML tags
            text = re.sub(r"<[^>]+>", " ", content)

            # include ids in search
            search_haystack = (text + " " + " ".join(ids)).lower()

            if query in search_haystack:
                # find an anchor if query matches an id
                anchor = None
                for _id in ids:
                    if query in _id.lower():
                        anchor = _id
                        break

                # snippet extraction from visible text
                match = re.search(r"(.{0,60}" + re.escape(query) + r".{0,60})", text, re.I)
                snippet = match.group(1) + "..." if match else text[:120]
                snippet = re.sub(r"\s+", " ", snippet).strip()

                # title
                title_match = re.search(r"<h1[^>]*>(.*?)</h1>", content, re.I)
                title = title_match.group(1) if title_match else fname.replace(".html", "").replace("_", " ").title()

                results.append({
                    "title": title,
                    "file": fname.replace("help_", "").replace(".html", ""),  # <-- no extra "help_"
                    "snippet": snippet,
                    "anchor": anchor  # <-- new
                })


        return jsonify(results)

    except Exception as e:
        print(f"⚠️ Help search error: {e}")
        return jsonify({"error": str(e)}), 500



@help_bp.route("/help/search_page")
def help_search_page():
    """Render the Help Search UI."""
    return render_template("help/help_search.html")
