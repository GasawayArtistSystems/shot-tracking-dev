let filmTitle = "";


//----------------------------------------------------------------------------------------------------------------------
//  Modals
//----------------------------------------------------------------------------------------------------------------------

// Open Film Config Modal
async function openFilmConfigModal() {
    const semesterSelect = document.getElementById("semesterSelect");

    try {
        const response = await fetch("/semesters");
        const semesters = await response.json();

        semesterSelect.innerHTML = semesters.map(s =>
            `<option value="${s.id}">${s.year}-${s.term}</option>`
        ).join("");

        document.getElementById("film-config-modal").classList.remove("hidden");
    } catch (error) {
        console.error("❌ Failed to load semesters:", error);
        Swal.fire({
            icon: "error",
            title: "Failed to Load Semesters",
            text: "An unexpected error occurred. Please try again."
        });
    }
}

function closeFilmConfigModal() {
    document.getElementById("film-config-modal").classList.add("hidden");
}

// Open Add Film Modal
async function openAddFilmModal() {
    const filmSelect = document.getElementById("existingFilmSelect");

    try {
        const response = await fetch("/films/config/api/list");
        const films = await response.json();

        filmSelect.innerHTML = `
            <option value="">-- Select a Film --</option>
            ${films.map(film => `<option value="${film.id}">${film.name}</option>`).join("")}
        `;

        document.getElementById("add-film-modal").classList.remove("hidden");
    } catch (error) {
        console.error("❌ Failed to load films:", error);
        Swal.fire({
            icon: "error",
            title: "Failed to Load Films",
            text: "An unexpected error occurred. Please try again."
        });
    }
}

// Close Add Film Modal
function closeAddFilmModal() {
    document.getElementById("add-film-modal").classList.add("hidden");
    document.getElementById("newFilmTitle").value = "";
}

// Open Scene Selection Modal with Scene Tracking
function openSceneSelectionModal(scenes, sceneContainer) {
    // Get already added scene numbers
    const existingScenes = Array.from(sceneContainer.querySelectorAll(".scene-item .scene-number"))
        .map(element => element.textContent.trim());

    // Filter out already added scenes
    const availableScenes = scenes.filter(scene => !existingScenes.includes(scene.scene_number));

    // Early exit if all scenes are already added
    if (availableScenes.length === 0) {
        Swal.fire({
            icon: "info",
            title: "All Scenes Added",
            text: "All available scenes for this film have already been added."
        });
        return;
    }

    const sceneOptions = availableScenes.map(scene => `
        <div class="flex items-center mb-2 bg-red-900 text-white px-3 py-2 rounded-lg">
            <input type="checkbox" id="scene-${scene.id}" value="${scene.id}" class="mr-2">
            <label for="scene-${scene.id}" class="flex-1">${scene.scene_number} - ${scene.description || "No Description"}</label>
        </div>
    `).join("");

    Swal.fire({
        title: "Select Scenes",
        html: `
            <div class="text-left max-h-64 overflow-y-auto bg-red-950 p-4 rounded-lg">
                ${sceneOptions}
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Add Selected",
        cancelButtonText: "Cancel",
        customClass: {
            popup: 'bg-red-950 text-white rounded-lg',
            confirmButton: 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg',
            cancelButton: 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg'
        },
        preConfirm: () => {
            const selectedScenes = [];
            availableScenes.forEach(scene => {
                const checkbox = document.getElementById(`scene-${scene.id}`);
                if (checkbox && checkbox.checked) {
                    selectedScenes.push(scene);
                }
            });
            return selectedScenes;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const selectedScenes = result.value;
            selectedScenes.forEach(scene => addSceneToContainer(sceneContainer, scene));
        }
    });
}

// Open Shot Selection Modal
function openShotSelectionModal(shots, shotContainer) {
    const shotOptions = shots.map(shot => `
        <div class="flex items-center mb-2 bg-red-900 text-white px-3 py-2 rounded-lg">
            <input type="checkbox" id="shot-${shot.id}" value="${shot.id}" class="mr-2">
            <label for="shot-${shot.id}" class="flex-1">${shot.shot_number} - ${shot.description || "No Description"}</label>
        </div>
    `).join("");

    Swal.fire({
        title: "Select Shots",
        html: `
            <div class="text-left max-h-64 overflow-y-auto bg-red-950 p-4 rounded-lg">
                ${shotOptions}
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Add Selected",
        cancelButtonText: "Cancel",
        customClass: {
            popup: 'bg-red-950 text-white rounded-lg',
            confirmButton: 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg',
            cancelButton: 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg'
        },
        preConfirm: () => {
            const selectedShots = [];
            shots.forEach(shot => {
                const checkbox = document.getElementById(`shot-${shot.id}`);
                if (checkbox && checkbox.checked) {
                    selectedShots.push(shot);
                }
            });
            return selectedShots;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const selectedShots = result.value;
            selectedShots.forEach(shot => addShotToContainer(shotContainer, shot));
        }
    });
}

function openShotAssetModal(assetList) {
    const container = document.getElementById("shot-asset-options");
    const search = document.getElementById("shot-asset-search");

    function renderOptions(filter = "") {
        const filtered = filmAssets.filter(a => a.name.toLowerCase().includes(filter.toLowerCase()));
        const container = document.getElementById("shot-asset-options");
        const selectedIds = JSON.parse(document.getElementById(`shot-${shotAssetContext.shotId}`).dataset.selectedAssets || "[]").map(a => String(a.id));

        container.innerHTML = filtered.map(asset => `
      <label class="flex items-center space-x-3 p-2 border rounded bg-gray-50 text-sm">
        <input type="checkbox"
               value="${asset.id}"
               data-name="${asset.name}"
               data-category="${asset.category}"
               data-file="${asset.file_path || ''}"
               ${selectedIds.includes(String(asset.id)) ? "checked" : ""}>
        <span class="truncate w-full">
          ${asset.name}
          ${asset.file_path ? `<span title="File: ${asset.file_path}">📁</span>` : ''}
        </span>
      </label>
    `).join('');
    }

    renderOptions();
    search.addEventListener('input', e => renderOptions(e.target.value));

    document.getElementById("shot-asset-modal").classList.remove("hidden");
}

function closeShotAssetModal() {
    document.getElementById("shot-asset-modal").classList.add("hidden");
}

// Toggle Scene Visibility
function toggleScenes(button) {
    const sceneContainer = button.closest(".bg-red-800").querySelector(".scene-container");
    const isCollapsed = sceneContainer.classList.toggle("hidden");

    // Update button symbol
    button.textContent = isCollapsed ? "➕" : "➖";
}

// Toggle Shot Visibility
function toggleShots(button) {
    const shotContainer = button.closest(".scene-item").querySelector(".shot-container");
    const isCollapsed = shotContainer.classList.toggle("hidden");

    // Update button symbol
    button.textContent = isCollapsed ? "➕" : "➖";
}

// Toggle Shot Assets Visibility
function toggleAssets(button) {
    const assetContainer = button.closest(".shot-item").querySelector(".asset-container");
    const isCollapsed = assetContainer.classList.toggle("hidden");

    // Update button symbol
    button.textContent = isCollapsed ? "➕" : "➖";
}

//----------------------------------------------------------------------------------------------------------------------
//  Adding Films, Scenes, and Shots
//----------------------------------------------------------------------------------------------------------------------

// Add Film
function addFilm(filmTitle, filmId) {
    const filmList = document.getElementById("film-list");
    const noFilmsMessage = document.getElementById("no-films-message");

    // Remove "No films added yet" message
    if (noFilmsMessage) {
        noFilmsMessage.remove();
    }

    const filmTemplate = document.getElementById("film-template");
    const filmClone = filmTemplate.content.cloneNode(true);

    // Set the film title and ID
    filmClone.querySelector(".film-title").textContent = filmTitle;
    const filmElement = filmClone.querySelector(".bg-red-800");
    filmElement.id = `film-${filmId}`;

    // Append the film to the list
    filmList.appendChild(filmClone);
}

// Save New Film
function saveNewFilm() {
    const newFilmTitle = document.getElementById("newFilmTitle").value.trim();
    const existingFilmId = document.getElementById("existingFilmSelect").value;

    if (!newFilmTitle && !existingFilmId) {
        Swal.fire({
            icon: "error",
            title: "Film Required",
            text: "Please select an existing film or enter a new film title."
        });
        return;
    }

    const filmTitle = newFilmTitle || document.querySelector(`#existingFilmSelect option[value="${existingFilmId}"]`).textContent;
    const filmId = existingFilmId || Math.floor(Math.random() * 1000);

    addFilm(filmTitle, filmId);
    closeAddFilmModal();
}

// --- GLOBAL ASSETS --------------------------------------------------

async function addGlobalAsset(button) {
    const filmContainer = button.closest(".bg-red-800");
    const filmId = filmContainer.id.replace("film-", "");
    const assetList = filmContainer.querySelector(".global-assets .asset-list");

    // Step 1️⃣ Ask whether to add all or choose manually
    const { isConfirmed, isDenied } = await Swal.fire({
        title: "Add Assets",
        text: "Do you want to add all remaining assets for this film?",
        icon: "question",
        showDenyButton: true,
        confirmButtonText: "Yes, add all remaining assets",
        denyButtonText: "No, let me choose",
        confirmButtonColor: "#16A34A", // green
        denyButtonColor: "#6B7280"
    });

    // ✅ Add all assets
    if (isConfirmed) {
        const res = await fetch(`/films/config/films/${filmId}/assets/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ add_all: true })
        });
        const data = await res.json();

        if (data.success && data.assets) {
            Swal.fire("✅ Success", data.message, "success");
            const assetList = button.closest(".film-inner").querySelector(".asset-list");
            data.assets.forEach(a => {
                const item = document.createElement("div");
                item.className = "bg-slate-700 text-white p-2 rounded flex justify-between items-center";
                item.dataset.type = a.category;   // <-- add this
                item.dataset.name = a.name;       // <-- add this
                item.innerHTML = `
                    ${a.category}: ${a.name}
                    <button class="text-gray-300 hover:text-red-500 delete-asset" data-id="${a.id}">
                        🗑️
                    </button>`;
                assetList.appendChild(item);

            });
        } else {
            Swal.fire("⚠️ Error", data.error || "No assets found.", "error");
        }
        return;
    }


    // ✅ Choose assets manually
    if (isDenied) {
        const res = await fetch(`/films/config/assets/${filmId}`);
        const assets = await res.json();

        if (!assets || assets.length === 0) {
            Swal.fire("No assets available", "All assets might already be added.", "info");
            return;
        }

        // Build checkbox list grouped by category
        const grouped = {};
        assets.forEach(a => {
            grouped[a.category] = grouped[a.category] || [];
            grouped[a.category].push(a);
        });

        let html = "<div style='text-align:left; max-height:300px; overflow:auto;'>";
        Object.entries(grouped).forEach(([category, list]) => {
            html += `<h4 style='font-weight:bold; margin-top:8px;'>${category}</h4>`;
            list.forEach(a => {
                html += `
          <div>
            <input type='checkbox' value='${a.id}' id='asset-${a.id}'>
            <label for='asset-${a.id}' class='ml-1'>${a.name}</label>
          </div>`;
            });
        });
        html += "</div>";

        const { value: selectedIds } = await Swal.fire({
            title: "Select Assets",
            html,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "Add Selected",
            cancelButtonText: "Cancel",
            customClass: {
                popup: 'bg-red-950 text-white rounded-lg',
                confirmButton: 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg',
                cancelButton: 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg'
            },
            preConfirm: () => {
                return Array.from(document.querySelectorAll("input[type='checkbox']:checked"))
                    .map(cb => parseInt(cb.value));
            }
        });

        if (selectedIds && selectedIds.length > 0) {
            const res2 = await fetch(`/films/config/films/${filmId}/assets/add`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ add_all: false, asset_ids: selectedIds })
            });

            const data2 = await res2.json();
            if (data2.success) {
                Swal.fire("✅ Success", data2.message, "success");

                if (data2.assets && data2.assets.length) {
                    const assetListEl = button.closest(".film-inner").querySelector(".asset-list");
                    data2.assets.forEach(a => {
                        const item = document.createElement("div");
                        item.className = "bg-slate-700 text-white p-2 rounded flex justify-between items-center";
                        item.dataset.type = a.category;   // <-- add this
                        item.dataset.name = a.name;       // <-- and this
                        item.innerHTML = `
                            ${a.category}: ${a.name}
                            <button class="text-gray-300 hover:text-red-500 delete-asset" data-id="${a.id}">
                            🗑️
                            </button>`;
                        assetListEl.appendChild(item);
                    });
                }
            } else {
                Swal.fire("⚠️ Error", data2.error || "Failed to add selected assets.", "error");
            }

        }
    }
}




// Add Scene to a Film
async function addScene(button) {
    const filmContainer = button.closest(".bg-red-800");
    const filmId = filmContainer.id.replace("film-", "");
    const sceneContainer = filmContainer.querySelector(".scene-container");

    try {
        const response = await fetch(`/films/config/${filmId}/scenes`);
        if (!response.ok) {
            console.error(`❌ Failed to load scenes for film ID ${filmId}`);
            throw new Error("Failed to load scenes");
        }

        const scenes = await response.json();

        // Get the list of already added scene numbers
        const existingScenes = Array.from(sceneContainer.querySelectorAll(".scene-item .scene-number"))
            .map(element => element.textContent.trim());

        // Filter out already added scenes
        const availableScenes = scenes.filter(scene => !existingScenes.includes(scene.scene_number));

        // If no more scenes are available, exit early
        if (availableScenes.length === 0) {
            Swal.fire({
                icon: "info",
                title: "All Scenes Added",
                text: "All available scenes for this film have already been added."
            });
            return;
        }

        // Show the scene selection modal
        Swal.fire({
            title: "Add Scenes",
            text: "Do you want to add all remaining scenes for this film?",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: availableScenes.length > 0 ? "Yes, add all remaining scenes" : "All Scenes Added",
            cancelButtonText: "No, let me choose",
            confirmButtonColor: availableScenes.length > 0 ? "#7C3AED" : "#6B7280", // Purple if scenes available, gray if not
            cancelButtonColor: "#6B7280",
            allowOutsideClick: false
        }).then((result) => {
            if (result.isConfirmed && availableScenes.length > 0) {
                // Add all remaining scenes
                availableScenes.forEach(scene => addSceneToContainer(sceneContainer, scene));
            } else if (!result.isConfirmed) {
                // Open scene selection modal
                openSceneSelectionModal(availableScenes, sceneContainer);
            }
        });

    } catch (error) {
        console.error("❌ Failed to load scenes:", error);
        Swal.fire({
            icon: "error",
            title: "Failed to Load Scenes",
            text: "An unexpected error occurred. Please try again."
        });
    }
}

// Add Scene to Container in Sorted Order
function addSceneToContainer(sceneContainer, scene) {
    // Create the scene element
    const sceneTemplate = document.getElementById("scene-template");
    const sceneClone = sceneTemplate.content.cloneNode(true);

    // Set the scene number and ID
    sceneClone.querySelector(".scene-number").textContent = scene.scene_number;
    const sceneElement = sceneClone.querySelector(".scene-item");
    sceneElement.id = `scene-${scene.id}`;

    // Append the scene
    sceneContainer.appendChild(sceneClone);

    // Re-sort the scenes after adding the new one
    const scenes = Array.from(sceneContainer.querySelectorAll(".scene-item"));

    scenes.sort((a, b) => {
        const numA = parseInt(a.querySelector(".scene-number").textContent.trim());
        const numB = parseInt(b.querySelector(".scene-number").textContent.trim());
        return numA - numB;
    });

    // Clear and re-add in sorted order
    sceneContainer.innerHTML = "";
    scenes.forEach(scene => sceneContainer.appendChild(scene));

}

// Add Shot
async function addShot(button) {
    const sceneElement = button.closest(".scene-item");
    const sceneId = sceneElement.id.replace("scene-", "");

    try {
        const response = await fetch(`/films/config/scenes/${sceneId}/shots`);
        if (!response.ok) {
            console.error(`❌ Failed to load shots for scene ID ${sceneId}`);
            throw new Error("Failed to load shots");
        }

        const shots = await response.json();

        const existingShots = Array.from(sceneElement.querySelectorAll(".shot-item .shot-number"))
            .map(el => el.textContent.trim());

        console.groupCollapsed(`🧪 Add Shot Debug for scene-${sceneId}`);
        console.log("🧠 Scene ID used in fetch:", sceneId);
        console.log("📥 Backend shots returned:", shots.map(s => s.shot_number));
        console.log("🧱 Shots currently in DOM:", existingShots);
        console.groupEnd();

        const availableShots = shots.filter(shot => {
            return !existingShots.includes(shot.shot_number);
        });

        if (availableShots.length === 0) {
            Swal.fire({
                icon: "info",
                title: "All Shots Added",
                text: "All available shots for this scene have already been added."
            });
            return;
        }

        Swal.fire({
            title: "Add Shots",
            text: "Do you want to add all remaining shots for this scene?",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: availableShots.length > 0 ? "Yes, add all remaining shots" : "All Shots Added",
            cancelButtonText: "No, let me choose",
            confirmButtonColor: availableShots.length > 0 ? "#3B82F6" : "#6B7280",
            cancelButtonColor: "#6B7280",
            allowOutsideClick: false
        }).then((result) => {
            if (result.isConfirmed && availableShots.length > 0) {
                availableShots.forEach(shot => addShotToContainer(sceneElement, shot));
            } else if (!result.isConfirmed) {
                openShotSelectionModal(availableShots, sceneElement);
            }
        });

    } catch (error) {
        console.error("❌ Failed to load shots:", error);
        Swal.fire({
            icon: "error",
            title: "Failed to Load Shots",
            text: "An unexpected error occurred. Please try again."
        });
    }
}


// Add Shot to Container in Sorted Order
function addShotToContainer(sceneElement, shot) {
    const shotContainer = sceneElement.querySelector(".shot-container");

    // Check if the shot is already present
    const existingShotNumbers = Array.from(shotContainer.querySelectorAll(".shot-item .shot-number"))
        .map(element => element.textContent.trim());
    if (existingShotNumbers.includes(shot.shot_number)) {
        console.warn(`🚫 Shot ${shot.shot_number} already exists. Skipping.`);
        return;
    }

    // Create the shot element
    const shotTemplate = document.getElementById("shot-template");
    const shotClone = shotTemplate.content.cloneNode(true);

    // Set the shot number and ID
    shotClone.querySelector(".shot-number").textContent = shot.shot_number;
    const shotElement = shotClone.querySelector(".shot-item");
    shotElement.id = `shot-${shot.id}`;

    // Append the shot
    shotContainer.appendChild(shotElement);

    // Re-sort the shots after adding the new one
    const shots = Array.from(shotContainer.querySelectorAll(".shot-item"));

    shots.sort((a, b) => {
        const numA = parseInt(a.querySelector(".shot-number").textContent.trim());
        const numB = parseInt(b.querySelector(".shot-number").textContent.trim());
        return numA - numB;
    });

    // Clear and re-add in sorted order
    shotContainer.innerHTML = "";
    shots.forEach(shot => shotContainer.appendChild(shot));

    // Ensure the "+ Add Shot" button is always present
    addShotButtonIfMissing(sceneElement);


}

document.querySelectorAll(".shot-item").forEach(shot => {
    const shotId = shot.id.replace("shot-", "");
    const selections = {};

    shot.querySelectorAll(".asset-select").forEach(select => {
        const category = select.dataset.category;
        const selectedIds = Array.from(select.selectedOptions).map(opt => parseInt(opt.value));
        selections[category] = selectedIds;
    });

    console.log("Shot ID:", shotId, "Selected Assets:", selections);
    // ⏎ store this in your config structure
});

//----------------------------------------------------------------------------------------------------------------------
//  Removing Films, Scenes, and Shots
//----------------------------------------------------------------------------------------------------------------------

// Remove Film
function removeFilm(button) {
    const filmElement = button.closest(".bg-red-800");
    filmElement.remove();
}

// Remove Scene Button
function removeScene(button) {
    const sceneElement = button.closest(".scene-item");
    const sceneContainer = sceneElement.parentNode;

    // Remove the scene
    sceneElement.remove();
}

// Remove Shot and Ensure "+ Add Shot" Button
function removeShot(button) {
    const shotElement = button.closest(".shot-item");
    const sceneElement = shotElement.closest(".scene-item");

    // Remove the shot
    shotElement.remove();

    // Ensure the "+ Add Shot" button is always present
    addShotButtonIfMissing(sceneElement);
}

// Ensure the "+ Add Shot" button is present
function addShotButtonIfMissing(sceneElement) {
    const shotContainer = sceneElement.querySelector(".shot-container");

    // Check if the button is already present
    if (!sceneElement.querySelector(".add-shot-button")) {
        const addShotButton = document.createElement("button");
        addShotButton.className = "bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 add-shot-button mb-2";
        addShotButton.textContent = "+ Add Shot";
        addShotButton.onclick = () => addShot(addShotButton.closest(".scene-item"));

        // Append the button directly to the scene, not the shot container
        sceneElement.appendChild(addShotButton);
    }
}

//----------------------------------------------------------------------------------------------------------------------
//  Utility Functions
//----------------------------------------------------------------------------------------------------------------------

// Populate Semester Dropdown on Load
document.addEventListener("DOMContentLoaded", () => {
    const semesterSelect = document.getElementById("semesterSelect");
    const currentYear = new Date().getFullYear();
    const semesters = ["Spring", "Summer", "Fall"];

    for (let year = currentYear; year <= currentYear + 5; year++) {
        semesters.forEach(semester => {
            const option = document.createElement("option");
            option.value = `${year}-${semester}`;
            option.textContent = `${year} ${semester}`;
            semesterSelect.appendChild(option);
        });
    }
});

let shotAssetContext = { sceneId: null, shotId: null };
let filmAssets = [];

document.body.addEventListener("click", async (e) => {
    if (e.target.classList.contains("select-assets-btn")) {
        const shotEl = e.target.closest(".shot-item");
        const shotId = shotEl.id.replace("shot-", "");
        const sceneId = shotEl.closest(".scene-item").id.replace("scene-", "");
        const filmId = shotEl.closest(".bg-red-800").id.replace("film-", "");

        window.shotAssetContext = { sceneId, shotId };

        // ✅ Fetch asset list if not already loaded
        if (!filmAssets.length) {
            try {
                const res = await fetch(`/films/config/assets/${filmId}`);
                filmAssets = await res.json();

                // Inject virtual file_path for each asset using known logic
                const filmEl = document.getElementById(`film-${filmId}`);
                const titleEl = filmEl.querySelector(".film-title");
                const filmTitleFromDom = titleEl?.textContent.trim() || "UNKNOWN_FILM";


            } catch (err) {
                console.error("❌ Failed to fetch assets:", err);
                return;
            }
        }


        const previouslySelected = JSON.parse(shotEl.dataset.selectedAssets || "[]");
        const selectedIds = previouslySelected.map(a => a.id);

        const container = document.getElementById("shot-asset-options");
        const search = document.getElementById("shot-asset-search");

        const renderOptions = (filter = "") => {
            const filtered = filmAssets.filter(a => a.name.toLowerCase().includes(filter.toLowerCase()));
            container.innerHTML = filtered.map(asset => `
        <label class="flex items-center space-x-3 p-2 border rounded bg-gray-50 text-sm">
        <input type="checkbox"
                value="${asset.id}"
                data-name="${asset.name}"
                data-category="${asset.category}"
                data-file="${asset.file_path || ''}"
                ${selectedIds.includes(String(asset.id)) ? "checked" : ""}>
        <span class="truncate w-full">
            ${asset.name}
            ${asset.file_path ? `<span title="File: ${asset.file_path}">📁</span>` : ''}
        </span>
        </label>
    `).join('');
        };


        renderOptions();
        search.value = "";
        search.oninput = (e) => renderOptions(e.target.value);

        document.getElementById("shot-asset-modal").classList.remove("hidden");
    }
});


function confirmShotAssetSelection() {
    if (!window.shotAssetContext) {
        console.error("No shot context found for asset selection");
        return;
    }

    const { sceneId, shotId } = window.shotAssetContext;
    const shotElement = document.querySelector(`#scene-${sceneId} #shot-${shotId}`);
    if (!shotElement) {
        console.error("Shot element not found for", sceneId, shotId);
        return;
    }

    const assetContainer = shotElement.querySelector(".asset-container");
    const assetSummary = shotElement.querySelector(".asset-summary");

    // Get selected assets
    const selected = Array.from(document.querySelectorAll("#shot-asset-options input[type='checkbox']:checked"))
        .map(cb => ({
            id: cb.value,
            name: cb.dataset.name,
            category: cb.dataset.category
        }));

    // Save selections for reuse
    shotElement.dataset.selectedAssets = JSON.stringify(selected);

    // Clear existing and rebuild
    assetContainer.innerHTML = "";
    selected.forEach(asset => {
        const div = document.createElement("div");
        div.className = "bg-gray-500 text-white rounded px-2 py-1 mb-1 text-sm";
        div.textContent = `${asset.category}: ${asset.name}`;
        assetContainer.appendChild(div);
    });

    // Update summary text
    assetSummary.textContent = selected.length
        ? `${selected.length} asset${selected.length > 1 ? "s" : ""} selected`
        : "None selected";

    closeShotAssetModal();
}


//----------------------------------------------------------------------------------------------------------------------
//  SAVING FUNCTIONS
//----------------------------------------------------------------------------------------------------------------------

function saveFilmConfigDraft() {
    const config = buildFilmConfigObject();

    fetch("/films/config/api/save-draft", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(config)
    })
        .then(async res => {
            const text = await res.text();
            try {
                return JSON.parse(text);
            } catch {
                throw new Error("Non-JSON response: " + text);
            }
        })
        .then(data => {
            if (data.error) {
                alert("❌ Error saving draft: " + data.error);
            } else {
                alert("✅ Draft saved successfully to:\n" + data.draft_path);
            }
        })
        .catch(err => {
            console.error("Save Draft Error:", err);
            alert("❌ Failed to save draft.");
        });
}

function buildFilmConfigObject() {
    const config = {};
    const filmElements = document.querySelectorAll("#film-list .bg-red-800");

    filmElements.forEach(film => {
        const filmId = film.id.replace("film-", "");
        const filmTitle = film.querySelector(".film-title").textContent.trim();

        const scenesData = {};
        const defaultSteps = ["Layout", "Anim", "Comp"];

        // 🔹 Gather top-level (global) assets
        const globalAssetElements = film.querySelectorAll(".global-assets .asset-list > div");
        const assets = {
            "Sets": [],
            "BGs": [],
            "Rigs": [],
            "Props - 2D": [],
            "Props - 3D": [],
            "Light Rigs": []
        };
        globalAssetElements.forEach(div => {
            const type = div.dataset.type;
            const name = div.dataset.name;
            // --- Normalize category names so everything maps cleanly ---
            let normalizedType = type.trim();

            // Character/Rigs variations → Rigs
            if (/^character.?\/?rigs?$/i.test(normalizedType) || /^characters.?\/?rigs?$/i.test(normalizedType)) {
                normalizedType = "Rigs";
            }

            // Prop spelling variations → Props - 2D or 3D
            if (/prop.?2d/i.test(normalizedType)) normalizedType = "Props - 2D";
            if (/prop.?3d/i.test(normalizedType)) normalizedType = "Props - 3D";

            // Background variants → BGs
            if (/^bg|background/i.test(normalizedType)) normalizedType = "BGs";

            // Light rigs variations
            if (/light.?rig/i.test(normalizedType)) normalizedType = "Light Rigs";

            // Now push safely
            if (assets[normalizedType]) {
                assets[normalizedType].push({ name, file_path: null });
            } else {
                // If new/unrecognized category appears, create it dynamically
                assets[normalizedType] = [{ name, file_path: null }];
            }

        });

        // 🔹 Gather scenes and shots
        const sceneElements = film.querySelectorAll(".scene-item");
        sceneElements.forEach(scene => {
            const sceneId = scene.id.replace("scene-", "");
            const sceneNumber = scene.querySelector(".scene-number").textContent.trim();

            const shotElements = scene.querySelectorAll(".shot-item");
            const shots = Array.from(shotElements).map(shot => {
                const shotNumber = shot.querySelector(".shot-number").textContent.trim();
                const camera = shot.querySelector("input[type='checkbox']")?.checked || false;

                let assetsByCategory = {
                    "Sets": [],
                    "Character/Rigs": [],
                    "Light Rigs": [],
                    "Props - 3D": [],
                    "Props - 2D": []
                };

                try {
                    const selected = JSON.parse(shot.dataset.selectedAssets || "[]");
                    selected.forEach(asset => {
                        if (assetsByCategory[asset.category]) {
                            assetsByCategory[asset.category].push({
                                name: asset.name
                            });

                        }
                    });
                } catch {
                    // Ignore malformed asset JSON
                }

                return {
                    number: shotNumber,
                    camera,
                    assets: assetsByCategory
                };
            });

            scenesData[sceneId] = {
                scene_number: sceneNumber,
                shots
            };
        });

        // 🔹 Save everything for this film
        config[filmId] = {
            title: filmTitle,
            steps: defaultSteps,
            assets,   // ✅ include global assets here
            scenes: scenesData
        };
    });

    return config;
}




function saveFinalJson() {
    const config = buildFilmConfigObject();

    console.log("💾 Using saveFinalJson — good save path!");

    fetch("/films/config/api/save-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                Swal.fire({
                    icon: "error",
                    title: "Error saving JSON",
                    text: data.error
                });
            } else {
                Swal.fire({
                    icon: "success",
                    title: "JSON saved successfully!",
                    html: `<p class='text-left text-sm'>${data.json_path}</p>`
                }).then(() => {
                    document.getElementById("film-config-modal").classList.add("hidden");
                });
            }
        })
        .catch(err => {
            console.error("Save JSON Error:", err);
            Swal.fire({
                icon: "error",
                title: "Failed to Save JSON",
                text: "An unexpected error occurred."
            });
        });
}




function downloadConfigAsJSON(config) {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "film_config.json";
    a.click();
    URL.revokeObjectURL(url);
}

//----------------------------------------------------------------------------------------------------------------------
//  RELOAD FUNCTIONS
//----------------------------------------------------------------------------------------------------------------------

async function loadOldFilmConfig() {
    try {
        const res = await fetch("/films/config/api/configs");
        const data = await res.json();

        const picker = document.getElementById("config-file-picker");
        const list = document.getElementById("configFileList");

        if (!data.configs || data.configs.length === 0) {
            alert("No saved configs available.");
            return;
        }

        picker.classList.remove("hidden");
        list.innerHTML = "";

        data.configs.forEach(filename => {
            const li = document.createElement("li");
            const btn = document.createElement("button");
            btn.textContent = filename;
            btn.className = "w-full text-left px-3 py-2 bg-purple-700 hover:bg-purple-600 rounded text-white";
            btn.onclick = async () => {
                picker.classList.add("hidden");

                const loadRes = await fetch(`/films/config/api/load/${filename}`);
                const configData = await loadRes.json();
                injectOldConfigIntoEditor(configData);
            };
            li.appendChild(btn);
            list.appendChild(li);
        });
    } catch (err) {
        console.error("❌ Failed to load config", err);
        alert("Failed to load config.");
    }
}

function injectOldConfigIntoEditor(config) {
    console.log("🔁 Injecting config into editor", config);
    const filmList = document.getElementById("film-list");
    filmList.innerHTML = "";

    Object.entries(config).forEach(([filmId, filmData]) => {
        const filmTemplate = document.getElementById("film-template");
        const filmClone = filmTemplate.content.cloneNode(true);
        const filmElement = filmClone.querySelector(".bg-red-800");
        filmElement.id = `film-${filmId}`;
        filmElement.querySelector(".film-title").textContent = filmData.title;

        const sceneContainer = filmElement.querySelector(".scene-container");
        // --- Load Global Assets if present ---
        if (filmData.assets) {
            const assetList = filmElement.querySelector(".global-assets .asset-list");
            if (assetList) {
                Object.entries(filmData.assets).forEach(([category, items]) => {
                    items.forEach(asset => {
                        const assetDiv = document.createElement("div");
                        assetDiv.className = "bg-gray-700 text-white p-2 rounded flex justify-between items-center";
                        assetDiv.innerHTML = `
          <span>${category}: ${asset.name}</span>
          <button onclick="this.parentNode.remove()" class="text-red-400 hover:text-red-600">🗑️</button>
        `;
                        assetDiv.dataset.type = category;
                        assetDiv.dataset.name = asset.name;
                        assetList.appendChild(assetDiv);
                    });
                });
            }
        }


        Object.entries(filmData.scenes || {}).forEach(([sceneId, sceneData]) => {
            if (sceneId === "default") return;

            const sceneNumber = sceneData.scene_number || sceneId;
            const sceneTemplate = document.getElementById("scene-template");
            const sceneClone = sceneTemplate.content.cloneNode(true);
            const sceneElement = sceneClone.querySelector(".scene-item");
            sceneElement.id = `scene-${parseInt(sceneId, 10)}`;
            sceneElement.dataset.sceneNumber = sceneNumber;
            sceneElement.querySelector(".scene-number").textContent = sceneNumber;

            const shotContainer = sceneElement.querySelector(".shot-container");

            (sceneData.shots || []).forEach(shot => {
                const shotNumber = typeof shot === "string" ? shot : shot.number;
                const shotTemplate = document.getElementById("shot-template");
                const shotClone = shotTemplate.content.cloneNode(true);
                const shotElement = shotClone.querySelector(".shot-item");
                shotElement.id = `shot-${shotNumber}`;
                shotElement.dataset.shotNumber = shotNumber;
                shotElement.querySelector(".shot-number").textContent = shotNumber;

                if (shot.camera) {
                    shotElement.querySelector("input[type='checkbox']").checked = true;
                }

                const assetList = shot.assets || {};
                let flatAssets = [];

                Object.entries(assetList).forEach(([category, items]) => {
                    items.forEach(a => {
                        const match = filmAssets.find(f => f.name === a.name && f.category === category);
                        flatAssets.push({
                            id: match?.id || null,
                            name: a.name || a,
                            category,
                            file_path: a.file_path || match?.file_path || null
                        });
                    });
                });

                shotElement.dataset.selectedAssets = JSON.stringify(flatAssets);
                confirmShotAssetSelectionFor(shotElement);

                shotContainer.appendChild(shotElement);
            });

            sceneContainer.appendChild(sceneElement);
        });

        filmList.appendChild(filmClone);
    });
}

function confirmShotAssetSelectionFor(shotEl) {
    const container = shotEl.querySelector(".asset-container");
    const summary = shotEl.querySelector(".asset-summary");

    try {
        const selected = JSON.parse(shotEl.dataset.selectedAssets || "[]");

        const grouped = selected.reduce((acc, a) => {
            acc[a.category] = acc[a.category] || [];
            acc[a.category].push(a.name);
            return acc;
        }, {});

        const order = ["Sets", "Character/Rigs", "Light Rigs", "Props - 3D", "Props - 2D"];

        container.innerHTML = "";

        order.forEach(cat => {
            const label = document.createElement("label");
            label.className = "block text-gray-300";
            label.textContent = cat + ":";

            const list = document.createElement("div");
            list.className = "bg-gray-500 p-2 rounded-lg mb-2";
            list.textContent = grouped[cat]?.join(", ") || "None available";

            container.appendChild(label);
            container.appendChild(list);
        });

        summary.textContent = selected.length
            ? selected.map(a => a.name).join(", ")
            : "None selected";
    } catch (err) {
        console.warn("⚠️ Could not render asset summary:", err);
    }
}

function toggleFilmBlock(button) {
    const film = button.closest(".bg-red-800");
    const inner = film.querySelector(".film-inner");
    const hidden = inner.classList.toggle("hidden");
    button.textContent = hidden ? "➕" : "➖";
}
  


function createFilmDOM(filmId, title, steps = ["Layout", "Anim", "Comp"]) {
    const div = document.createElement("div");
    div.id = `film-${filmId}`;
    div.className = "bg-red-800 p-4 rounded-lg";

    div.innerHTML = `
    <div class="flex justify-between items-center mb-2">
      <h3 class="film-title text-xl font-bold text-white">${title}</h3>
      <button onclick="removeFilm(${filmId})" class="text-white">🗑️</button>
    </div>
    <div class="scenes space-y-2"></div>
  `;

    div.dataset.steps = JSON.stringify(steps);
    return div;
}

function createSceneDOM(sceneNumber) {
    const div = document.createElement("div");
    div.className = "scene-item bg-red-700 p-3 rounded";

    div.innerHTML = `
    <div class="scene-number font-semibold text-white mb-1">${sceneNumber}</div>
    <div class="shots space-y-2 ml-4"></div>
  `;

    return div;
}

function createShotDOM(shotNumber) {
    const div = document.createElement("div");
    div.className = "shot-item bg-red-600 p-2 rounded";

    div.innerHTML = `
    <div class="flex items-center justify-between">
      <span class="shot-number text-white">${shotNumber}</span>
      <label class="text-white text-sm ml-2">
        Camera <input type="checkbox" />
      </label>
    </div>
  `;

    return div;
}