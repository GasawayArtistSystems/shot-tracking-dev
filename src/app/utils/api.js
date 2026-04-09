import API_BASE_URL from "../../apiConfig";

export async function updateAssignmentStepStatus({
  assignment,
  stepName,
  newStatus,
  apiRoot = API_BASE_URL,
}) {
    const step = assignment?.statuses?.find((s) => s.step_name === stepName);
    const step_id = step?.step_id;
  
    if (!step_id || !assignment?.individual_assignment_id) {
      console.warn(`⚠️ Cannot update step '${stepName}': missing step_id or assignment ID`);
      return;
    }
  
    const res = await fetch(`${apiRoot}/assignments/api/update-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        individual_assignment_id: assignment.individual_assignment_id,
        step_id,
        current_status: newStatus,
      }),
    });
  
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.error || "Failed to update step");
    }
  
    console.log(`✅ Updated '${stepName}' step to: ${newStatus}`);
  }
  