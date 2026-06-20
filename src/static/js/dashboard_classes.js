
// Handles class assignments ONLY
// - Loads assignments per student
// - Updates status of assignment steps
// - Uploads assignment files

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
        individual_assignment_id,
        step_id,
        current_status: newStatus
      })
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
      showConfirmButton: false
    });

  } catch (err) {
    console.error("❌ Failed to update status:", err);
    Swal.fire({
      icon: "error",
      title: "Update failed",
      text: err.message || "Something went wrong"
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

function updateDropdownColor(selectElement) {
  const selectedOption = selectElement.options[selectElement.selectedIndex];
  if (selectedOption && selectedOption.style.backgroundColor) {
    selectElement.style.backgroundColor = selectedOption.style.backgroundColor;
  }
}

