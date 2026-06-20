document.addEventListener("change", async (e) => {
  const fileInput = e.target;
  if (!fileInput.matches(".assignment-upload")) return;

  const form = fileInput.closest("form");
  const file = fileInput.files[0];
  if (!file) return;

  const assignmentId = form.dataset.assignmentId;
  const assignmentName = form.dataset.assignmentName;
  const className = form.dataset.className;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("assignment_id", assignmentId);
  formData.append("assignment_name", assignmentName);
  formData.append("class_name", className);

  try {
    const res = await fetch("/review/upload_assignment", {
      method: "POST",
      body: formData
    });

    const result = await res.json();

    if (res.ok) {
      await Swal.fire({
        icon: "success",
        title: "Uploaded!",
        text: `${result.file_name} has been uploaded and submitted.`,
        timer: 2000,
        showConfirmButton: false
      });

      fetchUserAssignmentsForSemester(); // 🔁 Refresh dashboard after upload
    } else {
      Swal.fire("Error", result.error || "Upload failed", "error");
    }
  } catch (err) {
    console.error("Upload error:", err);
    Swal.fire("Upload Error", "See console for details", "error");
  }
});

async function getCurrentSemesterId() {
  const resp = await fetch("/semesters/current");
  if (!resp.ok) {
    throw new Error("No active semester found");
  }
  const semester = await resp.json();
  return semester.id;
}

async function updateAssignmentStatus(individual_assignment_id, step_id, newStatus) {
  try {
    const res = await fetch("/dashboard/api/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        individual_assignment_id,
        step_id,
        current_status: newStatus,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update status");
    }

    console.log(`✅ Updated status for assignment ${individual_assignment_id}`);
  } catch (err) {
    console.error("❌ Failed to update assignment status:", err);
  }
}

// ------ THIS BELOW IS WHERE THE TEST SEMESTER IS ! ------------------------------------------------------------------------------------------------
async function fetchUserAssignmentsForSemester() {
  try {
    const currentSemesterRes = await fetch("/semesters/current");
    const semesterData = await currentSemesterRes.json();

    const semesterId = window.testSemesterId || semesterData.id; // <--------------------------------right here change back to the commented
    //const semesterId = semesterData.id;

    const userParam = window.testUserId ? `&user_id=${window.testUserId}` : "";
    const res = await fetch(`/dashboard/api/user_assignments?semester_id=${semesterId}${userParam}`);

    const data = await res.json();

    if (res.ok) {
      const assignments = data.todo || data;   // ✅ fallback if no .todo
      renderTodoAssignments(assignments);
    } else {
      console.error("❌ Error loading dashboard assignments:", data.error);
    }

  } catch (err) {
    console.error("❌ Error fetching assignments:", err);
  }
}

async function renderTodoAssignments(assignments) {
  const tbody = document.getElementById("todo-table-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!assignments || assignments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-gray-400 py-4">
          No assignments to show
        </td>
      </tr>`;
    return;
  }

  console.log("First assignment object:", assignments[0]); 

  // Group by class_name + class_id
  const groupedByClass = assignments.reduce((acc, a) => {
    const key = `${a.class_name}||${a.class_id}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  for (const [classKey, classAssignments] of Object.entries(groupedByClass)) {
    const [class_name, class_id] = classKey.split("||");

    // Fetch grade summary for this class
    let gradeSummary = null;
    try {
      const gradeRes = await fetch(`/dashboard/api/grade_summary?class_id=${class_id}`);
      if (gradeRes.ok) gradeSummary = await gradeRes.json();
    } catch (err) {
      console.warn("Could not load grade summary for class", class_id);
    }

    // Class header row with grade summary
    const classHeaderRow = document.createElement("tr");
    classHeaderRow.classList.add("bg-gray-600");
    classHeaderRow.innerHTML = `
      <td colspan="7" class="px-4 py-3">
        <div class="flex items-center justify-between">
          <span class="text-white font-bold text-lg">${class_name}</span>
          ${gradeSummary ? `
            <div class="flex gap-6 text-sm">
              <span class="text-green-400 font-semibold">
                Current Grade: 
                <span class="text-white">${gradeSummary.current_letter}</span>
                <span class="text-gray-300">(${gradeSummary.current_points}/${gradeSummary.current_max})</span>
              </span>
              <span class="text-yellow-400 font-semibold">
                Grade if no more submissions: 
                <span class="text-white">${gradeSummary.projected_letter}</span>
                <span class="text-gray-300">(${gradeSummary.projected_points}/${gradeSummary.projected_max})</span>
              </span>
            </div>
          ` : ""}
        </div>
      </td>
    `;
    tbody.appendChild(classHeaderRow);

    // Group assignments within this class by assignment_name
    const groupedByAssignment = classAssignments.reduce((acc, a) => {
      const key = `${a.assignment_name}||${a.completion_date}||${a.individual_assignment_id}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(a);
      return acc;
    }, {});

    for (const [assignKey, steps] of Object.entries(groupedByAssignment)) {
      const [assignment_name, completion_date, individual_assignment_id] = assignKey.split("||");

      // Find this assignment's grade breakdown from summary
      const assignmentGrade = gradeSummary?.assignments?.find(
        a => a.assignment_name === assignment_name
      );

      // Assignment header row
      const headerRow = document.createElement("tr");
      headerRow.classList.add("bg-gray-800", "text-white");
      headerRow.innerHTML = `
        <td class="px-4 py-2 border-b border-gray-600 font-bold">${assignment_name}</td>
        <td class="px-4 py-2 border-b border-gray-600">${completion_date}</td>
        <td class="px-4 py-2 border-b border-gray-600" colspan="2"></td>
        <td class="px-4 py-2 border-b border-gray-600 text-green-400">
          ${assignmentGrade ? `${assignmentGrade.earned}/${assignmentGrade.max_points}` : "—"}
        </td>
        <td class="px-4 py-2 border-b border-gray-600">
          <button 
            class="history-btn text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded"
            data-ia-id="${individual_assignment_id}"
            onclick="toggleHistory(this, ${individual_assignment_id})">
            History ▾
          </button>
        </td>
        <td class="px-4 py-2 border-b border-gray-600"></td>
      `;
      tbody.appendChild(headerRow);

      // Hidden history row
      const historyRow = document.createElement("tr");
      historyRow.id = `history-row-${individual_assignment_id}`;
      historyRow.classList.add("hidden", "bg-gray-900");
      historyRow.innerHTML = `
        <td colspan="7" class="px-8 py-2">
          <div id="history-content-${individual_assignment_id}" class="text-sm text-gray-300">
            Loading...
          </div>
        </td>
      `;
      tbody.appendChild(historyRow);

      // Step rows
      steps.forEach(step => {
        const {
          step_id,
          step_name,
          assignment_status,
          dropdown_options,
          grades,
        } = step;

        const dropdownId = `dropdown-${individual_assignment_id}-${step_id}`;
        const dropdownHTML = (dropdown_options && dropdown_options.length > 0) ? `
          <select id="${dropdownId}"
                  class="status-dropdown bg-gray-200 text-black px-2 py-1 rounded text-sm cursor-pointer"
                  data-assignment-id="${individual_assignment_id}"
                  data-step-id="${step_id}"
                  onchange="handleStatusChange(this)">
            ${dropdown_options.map(option => `
              <option value="${option.name}" 
                      ${assignment_status === option.name ? "selected" : ""} 
                      style="background-color:${option.color}; color:#000;"
                      data-color="${option.color}">
                ${option.name}
              </option>
            `).join("")}
          </select>` : "—";

        const reviewCellId = `review-${individual_assignment_id}-${step_id}`;

        const row = document.createElement("tr");
        row.classList.add("hover:bg-gray-700");
        row.innerHTML = `
          <td></td>
          <td></td>
          <td class="px-4 py-2 border-b border-gray-600">${step_name}</td>
          <td class="px-4 py-2 border-b border-gray-600">${dropdownHTML}</td>
          <td class="px-4 py-2 border-b border-gray-600">
            ${(grades && grades.length > 0) ? grades.join(", ") : "—"}
          </td>
          <td class="px-4 py-2 border-b border-gray-600"></td>
          <td class="px-4 py-2 border-b border-gray-600" id="${reviewCellId}">Checking...</td>
        `;
        tbody.appendChild(row);

        // Apply dropdown color
        setTimeout(() => {
          const dropdown = document.getElementById(dropdownId);
          if (dropdown) updateDropdownColor(dropdown);
        }, 0);

        // Check for review files
        const stepMap = { "Planning": "PL", "Blocking": "BL", "Blocking Plus": "BP", "Polish": "P" };
        let stepCode = stepMap[step_name] || "";
        let reviewUrl = `/dashboard/api/reviews/${encodeURIComponent(assignment_name)}`;
        if (stepCode) reviewUrl += `?step=${stepCode}`;

        fetch(reviewUrl)
          .then(res => res.json())
          .then(data => {
            const cell = document.getElementById(reviewCellId);
            if (!cell) return;

            if (data.exists && Array.isArray(data.reviews) && data.reviews.length > 0) {
              const uniqueReviews = Array.from(
                new Map(data.reviews.map(r => [r.path, r])).values()
              );
              uniqueReviews.sort((a, b) => new Date(b.date) - new Date(a.date));

              const latest = uniqueReviews[0];
              const older = uniqueReviews.length > 1 ? uniqueReviews[1] : null;

              let html = `
                <a href="${latest.path}" target="_blank"
                  class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-xs rounded block mb-1">
                  Latest Review
                </a>
              `;
              if (older && older.path !== latest.path) {
                html += `
                  <a href="${older.path}" target="_blank"
                    class="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 text-xs rounded block">
                    Older Review
                  </a>
                `;
              }
              cell.innerHTML = html;
            } else {
              cell.innerHTML = "—";
            }
          })
          .catch(() => {
            const cell = document.getElementById(reviewCellId);
            if (cell) cell.innerHTML = "—";
          });
      });
    }
  }
}

// History toggle
async function toggleHistory(btn, individualAssignmentId) {
  const row = document.getElementById(`history-row-${individualAssignmentId}`);
  const content = document.getElementById(`history-content-${individualAssignmentId}`);

  if (!row) return;

  const isHidden = row.classList.contains("hidden");
  row.classList.toggle("hidden");
  btn.textContent = isHidden ? "History ▴" : "History ▾";

  if (isHidden) {
    try {
      const res = await fetch(`/dashboard/api/grade_history/${individualAssignmentId}`);
      const data = await res.json();

      if (!data.history || data.history.length === 0) {
        content.innerHTML = "<span class='text-gray-500 italic'>No grade history yet.</span>";
        return;
      }

      content.innerHTML = `
        <table class="text-xs w-full">
          <thead>
            <tr class="text-gray-400">
              <th class="text-left pr-4">Step</th>
              <th class="text-left pr-4">From</th>
              <th class="text-left pr-4">To</th>
              <th class="text-left pr-4">Date</th>
            </tr>
          </thead>
          <tbody>
            ${data.history.map(h => `
              <tr class="border-t border-gray-700">
                <td class="pr-4 py-1">${h.step_name}</td>
                <td class="pr-4 py-1 text-red-400">${h.old_grade}</td>
                <td class="pr-4 py-1 text-green-400">${h.new_grade}</td>
                <td class="pr-4 py-1 text-gray-400">${h.changed_at}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    } catch (err) {
      content.innerHTML = "<span class='text-red-400'>Error loading history.</span>";
    }
  }
}


async function updateAssignmentStatus(individual_assignment_id, step_id, newStatus) {
  if (!individual_assignment_id || !step_id || !newStatus) {
    console.warn("⚠️ Missing assignment_id, step_id, or status");
    return;
  }

  try {
    const res = await fetch("/dashboard/api/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_type: "assignment",                 // ✅ match backend
        task_id: individual_assignment_id,       // ✅ match backend
        step_id,
        new_status: newStatus,                   // ✅ match backend
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.error || "Failed to update status");
    }

    console.log(`✅ Status updated: ${individual_assignment_id} — ${step_id} => ${newStatus}`);

    Swal.fire({
      icon: "success",
      title: "Status updated!",
      text: `Step ${step_id} saved as: ${newStatus}`,
      timer: 1500,
      showConfirmButton: false,
    });

  } catch (err) {
    console.error("❌ Failed to update status:", err);
    Swal.fire({
      icon: "error",
      title: "Update failed",
      text: err.message || "Something went wrong",
    });
  }
}




function handleStatusChange(dropdown) {
  updateDropdownColor(dropdown);
  const individual_assignment_id = dropdown.dataset.assignmentId;
  const step_id = dropdown.dataset.stepId;
  const newStatus = dropdown.value;
  updateAssignmentStatus(individual_assignment_id, step_id, newStatus);
}



document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('debugSemesterSelect');
  if (!select) return;

  // Restore previously selected override (if any)
  const saved = localStorage.getItem("debugSemesterId");
  if (saved) {
    select.value = saved;
    window.testSemesterId = parseInt(saved);
  }

  select.addEventListener('change', () => {
    const val = select.value;
    if (val) {
      localStorage.setItem("debugSemesterId", val);
      window.testSemesterId = parseInt(val);
    } else {
      localStorage.removeItem("debugSemesterId");
      delete window.testSemesterId;
    }
    location.reload();
  });
});



// ✅ Real-time color update
function updateDropdownColor(selectElement) {
  const selectedOption = selectElement.options[selectElement.selectedIndex];
  const color = selectedOption?.getAttribute("data-color");
  if (color) {
    // ✅ apply background only to the closed dropdown (selected state)
    selectElement.style.backgroundColor = color;
    selectElement.style.color = "#000";  // adjust text so it’s readable
    selectElement.style.border = `2px solid ${color}`;
  } else {
    // reset if no color
    selectElement.style.backgroundColor = "";
    selectElement.style.color = "";
    selectElement.style.border = "";
  }
}




function updateTodoAssignmentsTable(assignments) {
  const tbody = document.querySelector("#user-assignments-table tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  assignments.forEach(assignment => {
    const row = document.createElement("tr");
    row.classList.add("border-t", "text-black");

    const nameCell = `<td class="p-3">${assignment.assignment_name}</td>`;
    const startDate = `<td class="p-3">${assignment.start_date}</td>`;
    const completionDate = `<td class="p-3">${assignment.completion_date}</td>`;
    const status = `<td class="p-3 text-gray-300">${assignment.current_status}</td>`;
    const grade = `<td class="p-3 text-gray-400">${assignment.grade}</td>`;
    const upload = `<td class="p-3"><button class="btn btn-sm">Upload</button></td>`;

    row.innerHTML = nameCell + startDate + completionDate + status + grade + upload;
    tbody.appendChild(row);
  });
}

async function fetchUserAssignments() {
  const tableBody = document.querySelector("#user-assignments-table tbody");
  tableBody.innerHTML = "";

  try {
    const response = await fetch("/dashboard/api/user_assignments");
    const assignments = await response.json();

    assignments.forEach(assignment => {
      const row = document.createElement("tr");

      // // Build the dropdown
      // const statusOptions = ["Not Started", "In Progress", "Completed"];
      // const statusDropdown = `
      //         <select disabled>
      //             ${statusOptions.map(status => `
      //                 <option value="${status}" ${status === assignment.current_status ? "selected" : ""}>${status}</option>
      //             `).join("")}
      //         </select>
      //     `;

      const uploadButton = `
              <input type="file" id="file-upload-${assignment.id}" hidden>
              <button onclick="document.getElementById('file-upload-${assignment.id}').click()">Upload</button>
          `;

      row.innerHTML = `
              <td>${assignment.assignment_name}</td>
              <td>${assignment.start_date}</td>
              <td>${assignment.completion_date}</td>
              <td>${statusDropdown}</td>
              <td><input type="text" value="${assignment.grade}" readonly></td>
              <td>${uploadButton}</td>
          `;

      tableBody.appendChild(row);
    });
  } catch (err) {
    console.error("❌ Error loading assignments:", err);
  }
}

function renderTodoTable(assignments) {
  const tbody = document.querySelector("#todo-table tbody");
  tbody.innerHTML = "";
  assignments.forEach(item => {
    const row = document.createElement("tr");
    row.innerHTML = `
          <td>${item.assignment_name}</td>
          <td>${item.class_name}</td>
          <td>${item.step_name}</td>
          <td>${item.current_status}</td>
      `;
    tbody.appendChild(row);
  });
}

function renderGradedTable(assignments) {
  const tbody = document.querySelector("#graded-table tbody");
  tbody.innerHTML = "";
  assignments.forEach(item => {
    const row = document.createElement("tr");
    row.innerHTML = `
          <td>${item.assignment_name}</td>
          <td>${item.class_name}</td>
          <td>${item.step_name}</td>
          <td>${item.current_status}</td>
      `;
    tbody.appendChild(row);
  });
}


async function fetchAndRenderUserClasses() {
  try {
    const response = await fetch("/dashboard/api/user_classes");
    const data = await response.json();

    if (!response.ok || !Array.isArray(data)) {
      throw new Error("Invalid class data");
    }

    renderCollapsibleClasses(data);
  } catch (err) {
    console.error("❌ Failed to load classes:", err);
  }
}

async function renderCollapsibleClasses() {
  const container = document.getElementById("class-collapsible-list");
  if (!container) {
    console.warn("⚠️ Missing #class-collapsible-list");
    return;
  }

  container.innerHTML = "<p class='text-gray-400'>Loading...</p>";

  try {
    const res = await fetch("/review/api/graded_assignments_with_files");
    const data = await res.json();

    if (!res.ok || !Array.isArray(data)) throw new Error("Invalid graded assignments");

    if (data.length === 0) {
      container.innerHTML = "<p class='text-gray-400'>No graded assignments yet.</p>";
      return;
    }

    // Group by class
    const grouped = {};
    data.forEach(item => {
      if (!grouped[item.class_name]) grouped[item.class_name] = [];
      grouped[item.class_name].push(item);
    });

    container.innerHTML = "";

    for (const [className, assignments] of Object.entries(grouped)) {
      const section = document.createElement("div");
      section.classList.add("class-section", "mb-2", "bg-gray-800", "rounded", "shadow");

      const header = document.createElement("div");
      header.classList.add("cursor-pointer", "p-3", "text-white", "font-semibold", "bg-gray-700", "rounded-t");
      header.innerText = className;
      header.addEventListener("click", () => content.classList.toggle("hidden"));

      const content = document.createElement("div");
      content.classList.add("p-3", "bg-gray-900", "text-white", "hidden");

      assignments.forEach(assign => {
        const item = document.createElement("div");
        item.classList.add("flex", "justify-between", "items-center", "py-1", "border-b", "border-gray-700");

        const name = document.createElement("span");
        name.innerText = `${assign.assignment_name} — ${assign.grade || "Ungraded"}`;

        const viewBtn = document.createElement("a");
        viewBtn.href = `/review/get_video?path=${encodeURIComponent(assign.file_path)}`;
        viewBtn.target = "_blank";
        viewBtn.className = "bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1 rounded shadow";
        viewBtn.innerText = "View";

        item.appendChild(name);
        item.appendChild(viewBtn);
        content.appendChild(item);
      });

      section.appendChild(header);
      section.appendChild(content);
      container.appendChild(section);
    }
  } catch (err) {
    console.error("❌ Failed to load graded classes:", err);
    container.innerHTML = "<p class='text-red-400'>Error loading graded assignments.</p>";
  }
}


async function loadStudentDropdown() {
  const select = document.getElementById("userSelect");
  if (!select) return;

  console.log("📢 Fetching student list...");

  try {
    const res = await fetch("/dashboard/admin/api/students");
    const users = await res.json();

    console.log("✅ Students loaded:", users);

    if (!Array.isArray(users)) {
      console.warn("⚠️ Unexpected response (not an array):", users);
      if (users.error) {
        const option = document.createElement("option");
        option.textContent = `⚠️ ${users.error}`;
        option.disabled = true;
        select.appendChild(option);
      }
      return;
    }

    users.forEach(user => {
      const option = document.createElement("option");
      option.value = user.id;
      option.textContent = user.name;
      select.appendChild(option);
    });

    select.addEventListener("change", () => {
      const selectedId = select.value;
      if (!selectedId) return;

      console.log("👥 Selected user ID:", selectedId);
      window.testUserId = selectedId;
      fetchUserAssignmentsForSemester();
    });

  } catch (err) {
    console.error("❌ Failed to load students:", err);
  }
}






document.addEventListener("DOMContentLoaded", () => {
  fetchAndRenderUserClasses();
  fetchUserAssignmentsForSemester();

  if (window.is_admin === true || window.is_admin === "true") {
    console.log("👑 Admin detected, loading dropdown...");
    loadStudentDropdown();
  } else {
    console.log("👤 Not an admin — skipping dropdown.");
  }
});

