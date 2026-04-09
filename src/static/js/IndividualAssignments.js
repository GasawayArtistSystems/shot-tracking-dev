// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & GLOBALS
// ─────────────────────────────────────────────────────────────────────────────

let hasFetchedAssignments = false;
const modal = document.getElementById("editSelectedModal");


// ─────────────────────────────────────────────────────────────────────────────
// INIT - DOMContentLoaded
// ─────────────────────────────────────────────────────────────────────────────

async function loadAndRenderStepsForSelectedAssignment() {
  const assignmentId = document.getElementById("assignment-select")?.value;
  if (!assignmentId) return;

  try {
    const res = await fetch(`/assignments/api/steps-for-assignment?assignment_id=${assignmentId}`);
    const steps = await res.json();
    renderStepFilters(steps);
  } catch (error) {
    console.error("❌ Error loading steps:", error);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Initial Data Fetch
    await loadAndRenderStepsForSelectedAssignment();
    await fetchIndividualAssignments();
    await scanForNewFiles();

    // Setup Event Bindings
    setupBulkActions();
    setupFilterPanel();
    setupAssignmentSelectHandler();
    setupModalTriggers();
  } catch (error) {
    console.error("❌ Initialization Error:", error);
  }
});

function setupBulkActions() {
  const selectAll = document.getElementById("select-all");
  const checkboxes = document.querySelectorAll(".row-checkbox");
  const editBtn = document.getElementById("edit-selected-btn");

  if (selectAll) {
    selectAll.addEventListener("change", () => {
      checkboxes.forEach(cb => (cb.checked = selectAll.checked));
      updateEditButtonState();
    });
  }

  checkboxes.forEach(cb => {
    cb.addEventListener("change", updateEditButtonState);
  });

  if (editBtn) {
    editBtn.addEventListener("click", handleBulkEdit);
  }
}

function setupFilterPanel() {
  const toggleBtn = document.getElementById("toggle-filter-panel");
  const panel = document.getElementById("step-filter-form");

  if (toggleBtn && panel) {
    // 🔒 Ensure it's hidden initially
    if (!panel.classList.contains("hidden")) {
      panel.classList.add("hidden");
    }

    toggleBtn.textContent = "Show Filters";

    toggleBtn.addEventListener("click", () => {
      panel.classList.toggle("hidden");
      const isVisible = !panel.classList.contains("hidden");
      toggleBtn.textContent = isVisible ? "Hide Filters" : "Show Filters";
    });
  }
}


function setupAssignmentSelectHandler() {
  const assignmentSelect = document.getElementById("assignment-select");
  if (assignmentSelect) {
    assignmentSelect.addEventListener("change", (e) => {
      const selectedOption = e.target.options[e.target.selectedIndex];
      const url = selectedOption.dataset.url;
      if (url) window.location.href = url;
    });
  }
}

function setupModalTriggers() {
  const applyBtn = document.getElementById("apply-bulk-status");
  if (applyBtn) {
    applyBtn.addEventListener("click", handleBulkStatusApply);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// API CALLS
// ─────────────────────────────────────────────────────────────────────────────

async function fetchIndividualAssignments() {
  try {
    const apiUrl = `/assignments/api/individual_assignments?assignment_id=${window.assignmentId}&user_id=${window.userId}`;
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const data = await response.json();
    console.log("✅ Fetched Individual Assignments:", data);  // ✅ Add this line

    // ✅ Make sure the data includes the correct assignment IDs
    updateIndividualAssignmentsTable(data.assignments, data.status_options);
  } catch (error) {
    console.error("❌ Error fetching individual assignments:", error);
  }
}


async function fetchUnassignedStudents() {
  try {
    const apiUrl = `/assignments/api/unassigned_students?class_id=${window.classId}&assignment_id=${window.assignmentId}`;
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const data = await response.json();
    populateStudentDropdown(data.unassigned_students || []);
  } catch (error) {
    console.error("❌ Error fetching unassigned students:", error);
  }
}

async function scanForNewFiles() {
  try {
    const response = await fetch(`/assignments/api/scan-folder-for-new-files?class_id=${window.classId}`);
    const result = await response.json();

    if (result.swal) Swal.fire(result.swal);
    if (result.success && result.updated?.length > 0) await fetchIndividualAssignments();
  } catch (error) {
    console.error("❌ File scan error:", error);
  }
}

function groupAssignmentsByStudent(assignments) {
    const grouped = {};
    assignments.forEach(a => {
        if (!grouped[a.student_name]) {
            grouped[a.student_name] = [];
        }
        grouped[a.student_name].push(a);
    });
    return grouped;
}
  

// ─────────────────────────────────────────────────────────────────────────────
// UI AND DOM UPDATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function updateIndividualAssignmentsTable(assignments, statusOptions) {
    let tableRows = document.querySelectorAll("#individual-assignments-table tbody tr");

    let groupedAssignments = {};
    assignments.forEach(assignment => {
      let key = `${assignment.id}`;  // or include student name if needed

      if (!groupedAssignments[key]) {
        groupedAssignments[key] = {
          ...assignment,
          statuses: []
        };
      }

      assignment.statuses.forEach(status => {
        groupedAssignments[key].statuses.push({
          step_id: status.step_id,
          step_name: status.step_name,
          current_status: status.current_status
        });
      });
    });
      

    console.log("✅ Grouped Assignments: ", groupedAssignments);


    Object.values(groupedAssignments).forEach((assignment, index) => {
      let row = Array.from(tableRows).find(r => r.dataset.assignmentId == assignment.id);

        if (!row) {
            console.error(`❌ Error: Row for student ${assignment.student_name} not found.`);
            return;
        }

        let statusCell = row.querySelector(".status-cell");
        if (!statusCell) {
            console.error(`❌ Error: Status cell for ${assignment.student_name} not found.`);
            return;
        }

        let dropdownHTML = "";
        assignment.statuses.forEach(status => {
            let stepId = status.step_id;
            let stepName = status.step_name || "Unknown Step";  // ✅ Correct step name
            let currentStatus = status.current_status;
            let statusColor = "#FFFFFF"; // Default white background

            // ✅ Get the color from statusOptions if available
            if (statusOptions[stepId]) {
                let matchingStatus = statusOptions[stepId].find(opt => opt.name === currentStatus);
                if (matchingStatus) {
                    statusColor = matchingStatus.color; // ✅ Apply color
                }
            }

            dropdownHTML += `<div class="status-container" style="display: inline-block; text-align: center; margin: 3px;">
                                <span class="status-title text-xs font-semibold text-white mb-1 block">
                                    ${stepName}  <!-- ✅ Uses correct step_name -->
                                </span>
                                    <select class="status-dropdown bg-gray-800 text-black border border-gray-600 rounded px-2 py-1 text-sm w-[100px] h-[28px]"
                                        data-assignment-id="${assignment.id}"
                                        data-step-id="${stepId}"
                                        style="background-color: ${statusColor || '#ffffff'}; width: 100px; height: 26px; font-size: 12px;"
                                        onchange="updateDropdownColor(this); updateStatus(this)">
                                    ${statusOptions[stepId] ? statusOptions[stepId].map(option => `
                                        <option value="${option.name}" 
                                                style="background-color: ${option.color || '#ffffff'};"
                                                ${option.name === currentStatus ? 'selected' : ''}>
                                            ${option.name}
                                        </option>
                                    `).join('') : '<option value="">No Status Available</option>'}
                                </select>
                            </div>`;
        });

        statusCell.innerHTML = dropdownHTML;
    });

    console.log("✅ Successfully updated the assignments table.");
}

function createStatusElement(status, assignmentId, options) {
  const container = document.createElement("div");
  container.className = "status-container";
  container.style.marginBottom = "8px";

  // ✅ Add step name as label
  const label = document.createElement("span");
  label.className = "status-title block text-xs mb-1";
  label.textContent = status.step_name || "Step";
  label.style.color = "#ffffff";
  container.appendChild(label);

  // ✅ Correct the assignment ID handling
  const select = document.createElement("select");
  select.className = "status-dropdown";
  select.dataset.assignmentId = assignmentId;  // ✅ Fixed
  select.dataset.stepId = status.step_id;
  select.addEventListener("change", () => updateStatus(select));

  // Populate dropdown options
  options.forEach(option => {
    const opt = document.createElement("option");
    opt.value = option.name;
    opt.textContent = option.name;
    opt.style.backgroundColor = option.color || "#ffffff";
    opt.style.color = "#000000";

    // Preserve the current selection
    if (option.name === status.current_status) {
      opt.selected = true;
      select.style.backgroundColor = option.color || "#ffffff";
      select.style.color = "#000000";
    }

    select.appendChild(opt);
  });

  container.appendChild(select);
  updateDropdownColor(select);
  return container;
}


// Helper function to check if a color is dark or light
function isDarkColor(color) {
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Use the luminance formula
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b);
  return luminance < 140;  // Adjust this threshold if needed
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL AND FORM LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return console.error(`❌ Modal not found: ${modalId}`);
  modal.classList.remove("hidden");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return console.error(`❌ Modal not found: ${modalId}`);
  modal.classList.add("hidden");
}

function openAddStudentModal() {
  const modal = document.getElementById("addStudentModal");
  if (!modal) return console.error("❌ Add Student Modal not found.");

  // Clear any previous selections
  const studentSelect = document.getElementById("studentSelect");
  if (studentSelect) studentSelect.innerHTML = "<option>Loading...</option>";

  // Fetch the list of unassigned students
  fetchUnassignedStudents();

  // Show the modal
  openModal("addStudentModal");
}

// ✅ Ensure this function is globally accessible
window.openAddStudentModal = openAddStudentModal;


function closeAddStudentModal() {
  const modal = document.getElementById("addStudentModal");
  if (!modal) return console.error("❌ Add Student Modal not found.");
  modal.classList.add("hidden");
}

// ✅ Ensure this function is globally accessible
window.closeAddStudentModal = closeAddStudentModal;


function populateStudentDropdown(students) {
  const studentSelect = document.getElementById("studentSelect");
  if (!studentSelect) return console.error("❌ Student select element not found.");

  studentSelect.innerHTML = "";  // Clear previous options

  if (students.length === 0) {
    studentSelect.innerHTML = '<option disabled>No students available</option>';
    return;
  }

  students.forEach(student => {
    const option = document.createElement("option");
    option.value = student.id;
    option.textContent = student.name;
    studentSelect.appendChild(option);
  });
}

function addStudentToAssignment() {
  const studentSelect = document.getElementById("studentSelect");
  const studentId = studentSelect ? studentSelect.value : null;

  if (!studentId) {
    alert("Please select a student.");
    return;
  }

  try {
    fetch("/assignments/api/add_student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignment_id: window.assignmentId,
        student_id: studentId
      })
    })
      .then(response => response.json())
      .then(result => {
        if (result.success) {
          Swal.fire({
            icon: "success",
            title: "Student Added!",
            text: "The student was successfully added to this assignment.",
            confirmButtonColor: "#3085d6",
            confirmButtonText: "Great!"
          }).then(() => location.reload());
        } else {
          Swal.fire({
            icon: "error",
            title: "Failed to Add Student",
            text: result.error || "Something went wrong. Please try again."
          });
        }
      });
  } catch (error) {
    console.error("❌ Error adding student:", error);
    alert("Failed to add student.");
  }
}

// ✅ Ensure this function is globally accessible
window.addStudentToAssignment = addStudentToAssignment;


// ─────────────────────────────────────────────────────────────────────────────
// STATUS UPDATE LOGIC
// ─────────────────────────────────────────────────────────────────────────────

// ✅ Make sure this function is outside and globally accessible
window.updateDropdownColor = function (selectElement) {
    if (!selectElement) {
        console.warn("⚠️ Dropdown not found:", selectElement);
        return;
    }

    let selectedOption = selectElement.options[selectElement.selectedIndex];
    if (selectedOption) {
        selectElement.style.backgroundColor = selectedOption.style.backgroundColor;
    } else {
        console.warn("⚠️ No selected option found for:", selectElement);
    }
};

// --- IndividualAssignments.js — REPLACE window.updateStatus entirely ---
window.updateStatus = async function (selectElement) {
  const assignmentId = selectElement.getAttribute("data-assignment-id");
  const stepId = selectElement.getAttribute("data-step-id");
  const newStatus = selectElement.value;

  if (!assignmentId || !stepId || !newStatus) {
    console.error("❌ Missing required params in updateStatus", { assignmentId, stepId, newStatus });
    return;
  }

  try {
    const res = await fetch('/assignments/api/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        individual_assignment_id: assignmentId,
        step_id: stepId,
        current_status: newStatus
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      console.error("❌ Error updating status:", data);
      return;
    }

    if (typeof window.updateDropdownColor === "function") {
      window.updateDropdownColor(selectElement); // why: instant visual feedback
    }

    // ✅ No second POST. Use server-provided crossflow updates.
    if (Array.isArray(data.updated_steps)) {
      applyCrossflowUpdates(data.updated_steps);
    }
  } catch (err) {
    console.error("❌ Error during status update:", err);
  }
};


// --- IndividualAssignments.js — ADD once, near updateStatus ---
function applyCrossflowUpdates(updatedSteps) {
  updatedSteps.forEach(update => {
    // why: backend returns the *target* IA + step to update
    const selector = `select.status-dropdown[data-assignment-id="${update.target_individual_id}"][data-step-id="${update.step_id}"]`;
    const relatedDropdown = document.querySelector(selector);
    if (!relatedDropdown) {
      console.warn("⚠️ Related dropdown not found for selector:", selector);
      return;
    }
    relatedDropdown.value = update.child_status;
    if (typeof window.updateDropdownColor === "function") {
      window.updateDropdownColor(relatedDropdown);
    }
  });
}



// --- IndividualAssignments.js — REPLACE updateRelatedDropdowns entirely ---
async function updateRelatedDropdowns(assignmentId, stepId, newStatus) {
  try {
    const response = await fetch('/assignments/api/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        individual_assignment_id: assignmentId,
        step_id: stepId,
        current_status: newStatus
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      console.error("❌ Error updating related statuses:", data);
      return;
    }

    if (Array.isArray(data.updated_steps)) {
      data.updated_steps.forEach(update => {
        // use the backend’s keys: target_individual_id + step_id
        const relatedDropdown = document.querySelector(
          `select.status-dropdown[data-assignment-id="${update.target_individual_id}"][data-step-id="${update.step_id}"]`
        );
        if (relatedDropdown) {
          relatedDropdown.value = update.child_status;
          if (typeof window.updateDropdownColor === "function") {
            updateDropdownColor(relatedDropdown);
          }
        } else {
          console.warn("⚠️ Not found:", update);
        }
      });

    }
  } catch (error) {
    console.error("❌ Network error while updating related statuses:", error);
    if (window.Swal) {
      Swal.fire({ icon: "error", title: "Network Error", text: "Something went wrong while updating related statuses." });
    }
  }
}





// ─────────────────────────────────────────────────────────────────────────────
// STEP AND FILTER LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function renderStepFilters(steps) {
  const container = document.getElementById("step-checkboxes");
  if (!container) return console.error("❌ Step checkboxes container not found.");

  container.innerHTML = "";  // Clear existing checkboxes

  steps.forEach(step => {
    const label = document.createElement("label");
    label.className = "inline-flex items-center space-x-2";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.dataset.stepId = step.id;
    checkbox.dataset.stepName = step.name;
    checkbox.addEventListener("change", () => toggleColumnVisibility(step.id, checkbox.checked));

    const span = document.createElement("span");
    span.textContent = step.name;

    label.appendChild(checkbox);
    label.appendChild(span);
    container.appendChild(label);
  });
}

function toggleColumnVisibility(stepId, isVisible) {
  const cells = document.querySelectorAll(`[data-step-id="${stepId}"]`);
  cells.forEach(cell => (cell.style.display = isVisible ? "inline-block" : "none"));
}

function selectAllSteps() {
  const checkboxes = document.querySelectorAll("#step-checkboxes input[type=checkbox]");
  const statusContainers = document.querySelectorAll(".status-container");

  checkboxes.forEach(cb => {
    cb.checked = true;
    toggleColumnVisibility(cb.dataset.stepId, true);
  });

  // ✅ Make sure the status containers are also shown
  statusContainers.forEach(container => {
    container.style.display = "block";
  });
}

// ✅ Ensure this function is globally accessible
window.selectAllSteps = selectAllSteps;



function excludeFBAndGradeSteps() {
  const checkboxes = document.querySelectorAll("#step-checkboxes input[type=checkbox]");
  const statusContainers = document.querySelectorAll(".status-container");

  checkboxes.forEach(cb => {
    const stepName = cb.dataset.stepName?.toLowerCase() || "";
    const shouldInclude = !stepName.includes("fb") && !stepName.includes("grade");

    // ✅ Hide the checkbox itself
    cb.checked = shouldInclude;
    toggleColumnVisibility(cb.dataset.stepId, shouldInclude);

    // ✅ Hide the status container for these steps
    statusContainers.forEach(container => {
      const label = container.querySelector(".status-title");
      if (label && label.textContent.toLowerCase().includes("fb") || label.textContent.toLowerCase().includes("grade")) {
        container.style.display = shouldInclude ? "block" : "none";
      }
    });
  });
}


// ✅ Ensure this function is globally accessible
window.excludeFBAndGradeSteps = excludeFBAndGradeSteps;



function switchAssignment(selectedValue) {
  console.log("📢 Switching to assignment:", selectedValue);
  window.location.href = selectedValue;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function refreshAssignmentsTable() {
  console.log("🔄 Refreshing assignments table...");
  location.reload();
}

function updateEditButtonState() {
  const checkboxes = document.querySelectorAll(".row-checkbox");
  const editBtn = document.getElementById("edit-selected-btn");
  if (!editBtn) return console.error("❌ Edit button not found.");

  const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
  editBtn.disabled = !anyChecked;
}

function handleBulkEdit() {
  const selectedIds = Array.from(document.querySelectorAll(".row-checkbox"))
    .filter(cb => cb.checked)
    .map(cb => cb.dataset.id);

  if (selectedIds.length === 0) {
    alert("Please select at least one assignment.");
    return;
  }

  const container = document.getElementById("step-dropdowns");
  if (!container) return console.error("❌ Step dropdown container not found.");

  // Clear previous options
  container.innerHTML = "<p>Loading steps...</p>";

  // Fetch the steps for the selected assignments
  fetch("/assignments/api/steps-for-assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignment_ids: selectedIds })
  })
    .then(response => response.json())
    .then(data => {
      const steps = data.steps || [];
      const statusOptions = data.status_options || {};

      // Clear the loading message
      container.innerHTML = "";

      // Populate the dropdowns
      steps.forEach(step => {
        const group = document.createElement("div");
        group.className = "flex flex-col mb-4";

        const label = document.createElement("label");
        label.className = "text-sm font-medium text-white mb-1";
        label.textContent = step.name;
        group.appendChild(label);

        const select = document.createElement("select");
        select.name = `step-${step.id}`;
        select.dataset.stepId = step.id;
        select.className = "border px-3 py-2 rounded text-black";

        // Add the options
        const options = statusOptions[step.id] || [];
        options.forEach(option => {
          const opt = document.createElement("option");
          opt.value = option.name;
          opt.textContent = option.name;
          opt.style.backgroundColor = option.color || "#ffffff";
          opt.style.color = "#000000";  // Black text for contrast
          select.appendChild(opt);
        });

        group.appendChild(select);
        container.appendChild(group);
      });
    })
    .catch(error => {
      console.error("❌ Error loading steps for selected assignments:", error);
      container.innerHTML = "<p>Error loading steps. Please try again.</p>";
    });

  // Show the modal
  openModal("editSelectedModal");
}

// ✅ Make sure this function is globally accessible
window.handleBulkEdit = handleBulkEdit;

function handleBulkStatusApply() {
  const selectedIds = Array.from(document.querySelectorAll(".row-checkbox"))
    .filter(cb => cb.checked)
    .map(cb => cb.dataset.id);

  if (selectedIds.length === 0) {
    alert("Please select at least one assignment.");
    return;
  }

  const stepInputs = document.querySelectorAll("#step-dropdowns select");
  const updates = {};

  stepInputs.forEach(select => {
    const stepId = select.dataset.stepId;
    const status = select.value;
    if (status && stepId) {
      updates[stepId] = status;
    }
  });

  if (Object.keys(updates).length === 0) {
    alert("Please select at least one status to change.");
    return;
  }

  // Apply updates
  Promise.all(selectedIds.map(async (assignmentId) => {
    for (const [stepId, newStatus] of Object.entries(updates)) {
      await updateRelatedDropdowns(assignmentId, stepId, newStatus);
    }
  }))
    .then(() => {
      Swal.fire({
        icon: "success",
        title: "Updated!",
        text: `✅ ${selectedIds.length} assignments updated successfully.`,
        timer: 2000,
        showConfirmButton: false,
      });
      refreshAssignmentsTable();
    })
    .catch(error => {
      console.error("❌ Bulk update error:", error);
      Swal.fire({
        icon: "error",
        title: "Bulk Update Failed",
        text: "Something went wrong. Please try again."
      });
    });
}


// ---------------------------------------------------------------------------------------------------------