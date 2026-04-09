// ✅ Load current semester on DOM ready
document.addEventListener("DOMContentLoaded", () => {
    loadCurrentSemester();
    loadSemesters();
});
  

function loadSemesters() {
    const container = document.getElementById("semester-list");
    if (!container) return;

    fetch("/semesters")
        .then(response => response.json())
        .then(data => {
            container.innerHTML = data.length
                ? data.map(sem => `
                    <div class="flex justify-between p-2 border-b border-gray-600">
                        <span>${sem.term} ${sem.year} (${sem.start_date} - ${sem.end_date})</span>
                        <div>
                            <button class="bg-yellow-500 text-white px-2 py-1 rounded" onclick='openModal(true, ${JSON.stringify(sem)})'>Edit</button>
                            <button class="bg-red-500 text-white px-2 py-1 rounded" onclick="deleteSemester(${sem.id})">Delete</button>
                        </div>
                    </div>
                `).join("")
                : "<p class='text-gray-400'>No semesters available.</p>";
        })
        .catch(error => console.error("❌ Error loading semesters:", error));
}

function loadCurrentSemester() {
    const semesterDisplay = document.getElementById("current-semester");
    if (!semesterDisplay) return;

    semesterDisplay.innerHTML = "<span class='text-gray-400'>Loading semester...</span>";

    fetch("/semesters/current")
        .then(response => response.ok ? response.json() : null)
        .then(data => {
            semesterDisplay.innerHTML = data
                ? `<span class="text-green-400 font-semibold">${data.term} ${data.year}</span>`
                : "<span class='text-gray-400'>No active semester</span>";
        })
        .catch(error => console.error("❌ Error fetching current semester:", error));
}

function submitSemester() {
    const modal = document.getElementById("semester-modal");
    const id = modal.dataset.id || null;

    const data = {
        term: document.getElementById("semester-name").value,
        year: document.getElementById("semester-year").value,
        start_date: document.getElementById("semester-start").value,
        end_date: document.getElementById("semester-end").value
    };

    const method = id ? "PUT" : "POST";
    const url = id ? `/semesters/${id}` : "/semesters";

    fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    })
        .then(response => response.json())
        .then(() => {
            closeModal();
            loadSemesters();
        })
        .catch(error => console.error("❌ Error saving semester:", error));
}

function deleteSemester(id) {
    Swal.fire({
        title: "Are you sure?",
        text: "You won't be able to revert this!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, delete it!"
    }).then((result) => {
        if (result.isConfirmed) {
            fetch(`/semesters/${id}`, { method: "DELETE" })
                .then(res => res.json().then(data => ({ ok: res.ok, data })))
                .then(({ ok, data }) => {
                    if (!ok) {
                        throw new Error(data.error || "Delete failed");
                    }

                    Swal.fire("Deleted!", "The semester has been deleted.", "success");
                    loadSemesters();
                })
                .catch(error => {
                    console.error("❌ Error deleting semester:", error);
                    Swal.fire({
                        icon: "error",
                        title: "Delete Failed",
                        text: error.message || "An error occurred while deleting the semester.",
                    });
                });
          
        }
    });
}

function openModal(isEdit = false, semesterData = null) {
    const modal = document.getElementById("semester-modal");
    const title = document.getElementById("modal-title");
    const saveButton = document.getElementById("modal-save-btn");

    if (isEdit && semesterData) {
        title.textContent = "Edit Semester";
        saveButton.textContent = "Update";

        // Populate form
        document.getElementById("semester-name").value = semesterData.term;
        document.getElementById("semester-year").value = semesterData.year;
        document.getElementById("semester-start").value = semesterData.start_date;
        document.getElementById("semester-end").value = semesterData.end_date;
        modal.dataset.id = semesterData.id;
    } else {
        title.textContent = "Add Semester";
        saveButton.textContent = "Save";

        // Clear form
        document.getElementById("semester-name").value = "";
        document.getElementById("semester-year").value = "";
        document.getElementById("semester-start").value = "";
        document.getElementById("semester-end").value = "";
        delete modal.dataset.id;
    }

    modal.classList.remove("hidden");
}

function closeModal() {
    document.getElementById("semester-modal").classList.add("hidden");
}

// ✅ Make functions globally accessible for inline event handlers
window.openModal = openModal;
window.closeModal = closeModal;
window.submitSemester = submitSemester;
window.deleteSemester = deleteSemester;
window.editSemester = openModal;