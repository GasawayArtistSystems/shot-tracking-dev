import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import os
import shutil
import threading


# Paths
SOURCE_ROOT = r"D:\Reviews"
DEST_ROOT = r"\\GAAAP1PRD01W\Reviews"

    # Create main window
root = tk.Tk()
root.title("Review File Manager")
root.geometry("380x250")

# Label at the top
label = tk.Label(root, text="Choose an action:", font=("Arial", 12))
label.pack(pady=10)

# Progress bar (create it here, not after mainloop)
progress = ttk.Progressbar(root, orient="horizontal", length=300, mode="determinate")
progress.pack(pady=10)

# -------------------------
# Copy action
# -------------------------
def copy_folder():
    folder = filedialog.askdirectory(
        initialdir=SOURCE_ROOT,
        title="Select Local Folder to Copy"
    )
    if not folder:
        return

    worker = threading.Thread(
        target=copy_folder_worker,
        args=(folder,),
        daemon=True
    )
    worker.start()

def copy_folder_worker(folder):
    folder_name = os.path.basename(folder)
    dest_path = os.path.join(DEST_ROOT, folder_name)

    try:
        os.makedirs(dest_path, exist_ok=True)

        # Collect all files
        all_files = []
        for root_dir, _, files in os.walk(folder):
            for file in files:
                all_files.append(os.path.join(root_dir, file))

        total_files = len(all_files)

        if total_files == 0:
            root.after(
                0,
                lambda: messagebox.showinfo(
                    "Info",
                    "No files found to copy."
                )
            )
            return

        # Initialize progress bar ON UI THREAD
        root.after(
            0,
            lambda: (
                progress.config(maximum=total_files),
                progress.config(value=0)
            )
        )

        # Copy files
        for i, src_file in enumerate(all_files, start=1):
            rel_path = os.path.relpath(src_file, folder)
            dest_file = os.path.join(dest_path, rel_path)

            os.makedirs(os.path.dirname(dest_file), exist_ok=True)
            shutil.copy2(src_file, dest_file)

            # Update progress safely
            root.after(
                0,
                lambda v=i: progress.config(value=v)
            )

        root.after(
            0,
            lambda: messagebox.showinfo(
                "Success",
                f"Copied {total_files} files to:\n{dest_path}"
            )
        )

    except Exception as e:
        root.after(
            0,
            lambda: messagebox.showerror(
                "Error",
                str(e)
            )
        )


copy_button = tk.Button(root, text="📂 Copy Local Folder to Server", width=30, command=copy_folder)
copy_button.pack(pady=5)

# -------------------------
# Helper: count files/folders
# -------------------------
def count_contents(path):
    file_count = 0
    folder_count = 0
    for _, dirs, files in os.walk(path):
        folder_count += len(dirs)
        file_count += len(files)
    return file_count, folder_count

# -------------------------
# Delete Local action
# -------------------------
def delete_local_folder():
    folder = filedialog.askdirectory(initialdir=SOURCE_ROOT, title="Select Local Folder to Delete")
    if not folder:
        return

    files, dirs = count_contents(folder)
    confirm = messagebox.askyesno(
        "Confirm Delete",
        f"Delete this LOCAL folder?\n{folder}\n\n"
        f"(It contains {files} files and {dirs} subfolders)"
    )
    if not confirm:
        return

    try:
        shutil.rmtree(folder)
        messagebox.showinfo("Deleted", f"Local folder removed:\n{folder}")
    except Exception as e:
        messagebox.showerror("Error", str(e))

delete_local_button = tk.Button(root, text="🗑 Delete Local Folder", width=30, command=delete_local_folder)
delete_local_button.pack(pady=5)

# -------------------------
# Delete Server action
# -------------------------
def delete_server_folder():
    folder = filedialog.askdirectory(initialdir=DEST_ROOT, title="Select Server Folder to Delete")
    if not folder:
        return

    files, dirs = count_contents(folder)
    confirm = messagebox.askyesno(
        "Confirm Delete",
        f"Delete this SERVER folder?\n{folder}\n\n"
        f"(It contains {files} files and {dirs} subfolders)"
    )
    if not confirm:
        return

    try:
        shutil.rmtree(folder)
        messagebox.showinfo("Deleted", f"Server folder removed:\n{folder}")
    except Exception as e:
        messagebox.showerror("Error", str(e))

delete_server_button = tk.Button(root, text="🗑 Delete Server Folder", width=30, command=delete_server_folder)
delete_server_button.pack(pady=5)





# Run the window
root.mainloop()

