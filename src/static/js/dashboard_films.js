// dashboard_films.js

// Film shot dashboard ONLY — no assignments/classes
// Handles:
// - Loading user film shots
// - Updating shot status
// - Color-coded dropdowns
// - Sort by field/direction



let filmShotsSort = {
  field: "shot_number",
  direction: "asc"
};

document.addEventListener("DOMContentLoaded", () => {
  fetchDashboardFilmShots();
  renderUserAssets();

  const sortField = document.getElementById("sortField");
  const toggleDir = document.getElementById("toggleSortDirection");

  sortField?.addEventListener("change", () => {
    filmShotsSort.field = sortField.value;
    fetchDashboardFilmShots();
  });

  toggleDir?.addEventListener("click", () => {
    filmShotsSort.direction = filmShotsSort.direction === "asc" ? "desc" : "asc";
    toggleDir.textContent = filmShotsSort.direction === "asc" ? "⬆ Asc" : "⬇ Desc";
    fetchDashboardFilmShots();
  });
});

function updateDropdownColor(selectElement) {
  const selectedOption = selectElement.options[selectElement.selectedIndex];
  const color = selectedOption?.getAttribute("data-color") || selectedOption?.style.backgroundColor;

  if (color) {
    selectElement.style.backgroundColor = color;
    selectElement.style.color = "#000";     // readable text, just like assignments
    selectElement.style.border = `2px solid ${color}`;
  } else {
    selectElement.style.backgroundColor = "";
    selectElement.style.color = "";
    selectElement.style.border = "";
  }
}


function handleFilmStatusChange(selectEl) {
  updateDropdownColor(selectEl);

  const newStatus = selectEl.value;
  const stepId = parseInt(selectEl.getAttribute("data-step-id"), 10);

  let sceneId = selectEl.getAttribute("data-scene-id");
  let shotId = selectEl.getAttribute("data-shot-id");

  // Fallbacks if attributes are missing
  if (!sceneId || sceneId === "null" || sceneId === "")
    sceneId = selectEl.closest("tr")?.getAttribute("data-scene-id");
  if (!shotId || shotId === "null" || shotId === "")
    shotId = selectEl.closest("tr")?.getAttribute("data-shot-id");

  sceneId = sceneId ? parseInt(sceneId, 10) : null;
  shotId = shotId ? parseInt(shotId, 10) : null;

  const isScene = sceneId !== null && !isNaN(sceneId);
  const isShot = shotId !== null && !isNaN(shotId);

  const payload = {
    task_type: isScene ? "scene" : isShot ? "shot" : null,
    task_id: isScene ? sceneId : shotId,
    step_id: stepId,
    new_status: newStatus
  };

  console.log("🔁 Sending payload:", payload);

  if (!payload.task_type || !payload.task_id || !payload.step_id || !payload.new_status) {
    console.error("❌ Missing required fields in payload", payload);
    Swal.fire({
      icon: "error",
      title: "Bad Data",
      text: "Missing required fields to update status.",
      toast: true,
      position: "top-end",
      timer: 3000,
      showConfirmButton: false
    });
    return;
  }

  fetch("/dashboard/api/update-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
    .then(res => {
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    })
    .then(data => {
      console.log("✅ Update response:", data);

      // Thumbnail responses skip DB write
      if (data.message && data.message.includes("Thumbnail")) {
        console.log("Local-only update for thumbnail:", payload);
        updateLocalStatus(payload.task_id, payload.step_id, payload.new_status);
      } else if (data.message === "Status updated successfully") {
        updateLocalStatus(payload.task_id, payload.step_id, payload.new_status);
      }

      Swal.fire({
        icon: "success",
        title: "Status Updated",
        text: `Status set to "${newStatus}"`,
        toast: true,
        position: "top-end",
        timer: 2000,
        showConfirmButton: false
      });


      console.log("📡 Triggering crossflow:", { sceneId, stepId, newStatus });

      // ✅ Trigger crossflow update if scene step
      // if (isScene) {
      //   fetch("/films/api/scene_progress/crossflow", {
      //     method: "POST",
      //     headers: { "Content-Type": "application/json" },
      //     body: JSON.stringify({
      //       scene_id: sceneId,
      //       step_id: stepId,
      //       status: newStatus
      //     })
      //   })
      //     .then(res => {
      //       if (!res.ok) throw new Error("Crossflow failed");
      //       return res.json();
      //     })
      //     .then(d => console.log("🔁 Crossflow updated:", d))
      //     .catch(err => console.error("❌ Crossflow failed", err));
      // }
    })
    .catch(err => {
      console.error("❌ Error updating status", err);
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: "Could not save status. Try again.",
        toast: true,
        position: "top-end",
        timer: 3000,
        showConfirmButton: false
      });
    });
}


async function fetchDashboardFilmShots() {
  try {
    console.log("📡 Fetching dashboard data...");

    const selectedUser = document.getElementById("userSelect")?.value;
    const url = selectedUser
      ? `/films/api/film/dashboard_data?user_id=${selectedUser}`
      : `/films/api/film/dashboard_data`;

    const res = await fetch(url);

    const text = await res.text();
    const films = JSON.parse(text);
    const container = document.getElementById("todo-film-shots");
    container.innerHTML = "";

    if (!Array.isArray(films) || films.length === 0) {
      console.log("🎯 Fetched films:", films);
      container.innerHTML = `<div class="text-gray-400 p-3">No shots assigned.</div>`;
      return;
    }

    films.forEach((film, index) => {
      if (!film.shots || film.shots.length === 0) return;

      film.shots = sortShots(film.shots);

      const filmSection = document.createElement("div");
      filmSection.className = "mb-4";
      const filmToggleId = `film-${index}`;

      const filmHeader = document.createElement("div");
      filmHeader.className = "flex justify-between items-center bg-slate-700 text-white font-bold px-4 py-2 border-b border-slate-600";

      const filmTitle = document.createElement("span");
      filmTitle.textContent = film.title;
      filmTitle.className = "cursor-pointer";
      filmTitle.onclick = () => {
        const body = document.getElementById(filmToggleId);
        if (body) body.classList.toggle("hidden");
      };

      // 📜 View Script button
      const scriptBtn = document.createElement("a");
      scriptBtn.textContent = "📜 View Script";
      scriptBtn.href = `/dashboard/films/get_script/${encodeURIComponent(film.title)}`;
      scriptBtn.target = "_blank";
      scriptBtn.className = "bg-green-700 hover:bg-green-800 text-white px-3 py-1 rounded text-sm";

      filmHeader.appendChild(filmTitle);
      filmHeader.appendChild(scriptBtn);

      filmHeader.onclick = () => {
        const body = document.getElementById(filmToggleId);
        if (body) body.classList.toggle("hidden");
      };

      const filmBody = document.createElement("div");
      filmBody.id = filmToggleId;

      const groupedByScene = {};
      const thumbnailTasks = film.shots.filter(s => s.shot_id === null);
      const realShots = film.shots.filter(s => s.shot_id !== null);

      for (const shot of realShots) {
        const key = shot.scene_number || "Unknown Scene";
        if (!groupedByScene[key]) groupedByScene[key] = [];
        if (!groupedByScene[key].some(s => s.shot_id === shot.shot_id)) {
          groupedByScene[key].push(shot);
        }
      }

      if (thumbnailTasks.length > 0) {
        groupedByScene["__thumbnails__"] = thumbnailTasks;
      }

      for (const [sceneNum, shots] of Object.entries(groupedByScene)) {
        const sceneToggleId = `${filmToggleId}-scene-${sceneNum}`;
        const isThumbnailSection = sceneNum === "__thumbnails__";

        const sceneHeader = document.createElement("div");
        sceneHeader.className = "cursor-pointer text-yellow-400 text-sm font-semibold px-4 py-1 bg-slate-800 border-b border-slate-600";
        sceneHeader.textContent = isThumbnailSection ? "Thumbnails & Storyboards" : `Scene ${sceneNum}`;
        sceneHeader.onclick = () => {
          const section = document.getElementById(sceneToggleId);
          if (section) section.classList.toggle("hidden");
        };

        const sceneBody = document.createElement("div");
        sceneBody.id = sceneToggleId;

        const table = document.createElement("table");
        table.className = "min-w-full text-white text-sm border-collapse";

        const thead = document.createElement("thead");
        thead.innerHTML = `
          <tr class="bg-slate-600 text-white uppercase">
            <th class="px-4 py-2 text-left">Shot</th>
            <th class="px-4 py-2 text-left">Step</th>
            <th class="px-4 py-2 text-left">Status</th>
            <th class="px-4 py-2 text-left">Due</th>
          </tr>
        `;

        const tbody = document.createElement("tbody");


        

        shots.forEach(shot => {
          shot.steps.forEach(step => {
            if (step.status?.toLowerCase() === "approved") return;

            const dropdown = document.createElement("select");
            dropdown.className = "status-dropdown bg-gray-200 text-black px-2 py-1 rounded text-sm cursor-pointer";
            dropdown.setAttribute("data-step-id", step.step_id);

            const isThumbnail = shot.shot_number === "—" || shot.shot_number === "-";

            if (isThumbnail && shot.scene_id != null) {
              // 🟡 Thumbnails use scene-level updates
              dropdown.setAttribute("data-scene-id", shot.scene_id);
              dropdown.setAttribute("data-task-type", "scene");
            } else if (shot.shot_id != null) {
              // 🎬 Real shots
              dropdown.setAttribute("data-shot-id", shot.shot_id);
              dropdown.setAttribute("data-task-type", "shot");
            }
            

            (step.dropdown_options || []).forEach(opt => {
              const option = document.createElement("option");
              option.value = opt.name;
              option.textContent = opt.name;
              option.selected = (opt.name?.toLowerCase() === (step.status || "").toLowerCase());
              option.style.backgroundColor = opt.color;
              option.setAttribute("data-color", opt.color);  // ✅ add this line
              dropdown.appendChild(option);
            });

            dropdown.onchange = () => handleFilmStatusChange(dropdown);
            setTimeout(() => updateDropdownColor(dropdown), 0);

            const tr = document.createElement("tr");
            tr.className = "bg-slate-700 border-b border-slate-600";

            if (step.scene_id !== undefined && step.scene_id !== null) {
              tr.setAttribute("data-scene-id", step.scene_id);
            }

            // 🟡 Only set shot-id for real shots (not thumbnails)
            if (shot.shot_id !== undefined && shot.shot_id !== null && shot.shot_number !== "—") {
              tr.setAttribute("data-shot-id", shot.shot_id);
            }


            tr.innerHTML = `
              <td class="px-4 py-2">Shot ${shot.shot_number || "—"}</td>
              <td class="px-4 py-2">${step.step_name || `Step ${step.step_id}`}</td>
              <td class="px-4 py-2"></td>
              <td class="px-4 py-2">${step.due_date || "--"}</td>
            `;
            tr.children[2].appendChild(dropdown);
            tbody.appendChild(tr);
          });
        });

        table.appendChild(thead);
        table.appendChild(tbody);
        sceneBody.appendChild(table);
        filmBody.appendChild(sceneHeader);
        filmBody.appendChild(sceneBody);
      }

      filmSection.appendChild(filmHeader);
      filmSection.appendChild(filmBody);
      container.appendChild(filmSection);
    });
  } catch (err) {
    console.error("❌ Error loading film shots:", err);
  }
}



function sortShots(shots) {
  if (!Array.isArray(shots)) return [];
  const { field, direction } = filmShotsSort;
  return [...shots].sort((a, b) => {
    let valA = (a.steps?.[0]?.[field]) ?? a[field];
    let valB = (b.steps?.[0]?.[field]) ?? b[field];

    if (field.toLowerCase().includes("date")) {
      valA = valA ? new Date(valA).getTime() : 0;
      valB = valB ? new Date(valB).getTime() : 0;
    }

    if (valA < valB) return direction === "asc" ? -1 : 1;
    if (valA > valB) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

function renderUserAssets() {
  const assetList = document.getElementById("todo-assets-list");
  if (!assetList) return;


  fetch("/dashboard/api/user_assets")
    .then(res => res.json())
    .then(assets => {
      if (!assets || assets.length === 0) {
        assetList.innerHTML = "<p class='text-gray-400 px-4 py-2'>No assets assigned.</p>";
        return;
      }

      // Build header and rows
      const rows = assets.map(a => {
        const due = a.due_date ? a.due_date : "—";
        const statusColor = a.node_color || "#666";
        return `
          <tr class="border-t border-slate-700 hover:bg-slate-700 text-sm">
            <td class="px-4 py-2">${a.name}<br><span class="text-xs text-gray-400">${a.category}</span></td>
            <td class="px-4 py-2">${a.film_name}</td>
            <td class="px-4 py-2">${a.step_name}</td>
            <td class="px-4 py-2">${due}</td>
            <td class="px-4 py-2">
              <select class="rounded px-2 py-1 text-sm" style="background-color: ${statusColor}; color: white;" disabled>
                <option selected>${a.status}</option>
              </select>
            </td>
          </tr>`;
      }).join("");

      assetList.innerHTML = `
      <table class="min-w-full text-white text-sm table-auto">
        <thead class="bg-slate-700 text-xs uppercase text-gray-300">
          <tr>
            <th class="px-4 py-2 text-left">Asset</th>
            <th class="px-4 py-2 text-left">Film</th>
            <th class="px-4 py-2 text-left">Step</th>
            <th class="px-4 py-2 text-left">Due Date</th>
            <th class="px-4 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          ${assets.map(a => {
        const due = a.due_date || "—";
            // 🧩 Sort step_nodes by Y value from their "position" string (e.g. "100 30")
            const nodeOptions = a.step_nodes
              .sort((x, y) => {
                const getY = (pos) => {
                  if (!pos) return 0;
                  const parts = pos.split(" ");
                  return parseFloat(parts[1]) || 0; // second number is Y
                };
                return getY(x.position) - getY(y.position);
              })
              .map(n => {
                const selected = n.node_id === a.node_id ? "selected" : "";
                return `<option value="${n.node_id}" style="background-color: ${n.color}" ${selected}>${n.name}</option>`;
              })
              .join("");



        return `
              <tr class="border-b border-slate-700 hover:bg-slate-700">
                <td class="px-4 py-2">
                  <div class="font-semibold">${a.name}</div>
                  <div class="text-xs text-gray-400">${a.category}</div>
                </td>
                <td class="px-4 py-2">${a.film_name}</td>
                <td class="px-4 py-2">${a.step_name}</td>
                <td class="px-4 py-2 text-sm">${due}</td>
                <td class="px-4 py-2">
                  <select
                      class="text-black text-sm px-2 py-1 rounded"
                      data-asset-id="${a.asset_id}" 
                      data-step-id="${a.step_id}">
                    ${nodeOptions}
                  </select>
                </td>
              </tr>
            `;
      }).join("")}
        </tbody>
      </table>
    `;

      assetList.querySelectorAll("select[data-asset-id]").forEach(select => {
        // 🟡 Set initial color on load
        const selectedOption = select.options[select.selectedIndex];
        select.style.backgroundColor = selectedOption.style.backgroundColor || "#888";

        select.addEventListener("change", e => {
          const assetId = select.dataset.assetId;
          const stepId = select.dataset.stepId;
          const newNodeId = select.value;

          console.log("Sending update:", { asset_id: assetId, step_id: stepId, node_id: newNodeId });

          fetch("/dashboard/api/update_asset_status", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              asset_id: assetId,
              step_id: stepId,
              node_id: newNodeId
            })
          })
            .then(res => {
              if (!res.ok) throw new Error("Update failed");
              return res.json();
            })
            .then(() => {
              const selectedOption = select.options[select.selectedIndex];
              select.style.backgroundColor = selectedOption.style.backgroundColor || "#888";
            })
            .catch(err => {
              console.error("Error updating asset status:", err);
              alert("⚠️ Failed to update status.");
            });
        });
      });



    });
}

// --- Local UI update for thumbnails or skipped DB writes ---
function updateLocalStatus(taskId, stepId, newStatus) {
  const cell = document.querySelector(
    `[data-shot-id="${taskId}"] [data-step-id="${stepId}"]`
  );
  if (cell && cell.tagName === "SELECT") {
    const option = Array.from(cell.options).find(
      (opt) => opt.value === newStatus
    );
    if (option) cell.value = option.value;
    updateDropdownColor(cell);
    cell.classList.add("ring-2", "ring-green-500");
    setTimeout(() => cell.classList.remove("ring-2", "ring-green-500"), 800);
  }
}

