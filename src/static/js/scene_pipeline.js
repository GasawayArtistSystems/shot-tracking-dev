let currentFilmId = null;
let assets = {};
let sceneConfig = {};


// ---------------------------------------------------------
// LOAD PIPELINE UI
// ---------------------------------------------------------

async function loadScenePipeline(filmId) {

    currentFilmId = filmId;

    await loadAssets();
    await loadScenes();

}


// ---------------------------------------------------------
// LOAD ASSETS
// ---------------------------------------------------------

async function loadAssets() {

    const response = await fetch(`/pipeline/assets/${currentFilmId}`);
    assets = await response.json();

}


// ---------------------------------------------------------
// LOAD SCENES
// ---------------------------------------------------------

async function loadScenes() {

    const response = await fetch(`/pipeline/scenes/${currentFilmId}`);
    const scenes = await response.json();

    const tableBody = document.getElementById("scenePipelineTableBody");

    tableBody.innerHTML = "";

    for (const scene of scenes) {

        const sceneNumber = scene.scene_number;

        const row = document.createElement("tr");

        row.innerHTML = `
            <td class="scene-number">${sceneNumber}</td>

            <td>
                <select class="set-select" data-scene="${sceneNumber}">
                    ${buildOptions(assets.sets)}
                </select>
            </td>

            <td>
                <button class="rigs-btn" data-scene="${sceneNumber}">
                    Select Rigs
                </button>
                <div class="rigs-display"></div>
            </td>

            <td>
                <button class="props-btn" data-scene="${sceneNumber}">
                    Select Props
                </button>
                <div class="props-display"></div>
            </td>

            <td>
                <select class="bg-select" data-scene="${sceneNumber}">
                    ${buildOptions(assets.bgs)}
                </select>
            </td>

            <td>
                <select class="light-select" data-scene="${sceneNumber}">
                    ${buildOptions(assets.light_rigs)}
                </select>
            </td>

            <td>
                <button class="save-scene-btn" data-scene="${sceneNumber}">
                    Save
                </button>
            </td>
        `;

        tableBody.appendChild(row);

    }

    attachRowEvents();

    await loadSceneConfigs();

}


// ---------------------------------------------------------
// BUILD SELECT OPTIONS
// ---------------------------------------------------------

function buildOptions(list) {

    if (!list) return "";

    let html = `<option value="">-- None --</option>`;

    for (const item of list) {
        html += `<option value="${item}">${item}</option>`;
    }

    return html;

}


// ---------------------------------------------------------
// LOAD EXISTING CONFIG
// ---------------------------------------------------------

async function loadSceneConfigs() {

    const response = await fetch(`/pipeline/config`);
    const config = await response.json();

    if (!config.films) return;

    const film = config.films[currentFilmId];

    if (!film) return;

    sceneConfig = film.scenes || {};

    for (const sceneNumber in sceneConfig) {

        const scene = sceneConfig[sceneNumber];

        const setSelect = document.querySelector(`.set-select[data-scene="${sceneNumber}"]`);
        const bgSelect = document.querySelector(`.bg-select[data-scene="${sceneNumber}"]`);
        const lightSelect = document.querySelector(`.light-select[data-scene="${sceneNumber}"]`);

        if (setSelect) setSelect.value = scene.set || "";
        if (bgSelect) bgSelect.value = scene.bgs?.[0] || "";
        if (lightSelect) lightSelect.value = scene.light_rigs?.[0] || "";

        updateMultiDisplay(sceneNumber, "rigs", scene.rigs);
        updateMultiDisplay(sceneNumber, "props", scene.props);

    }

}


// ---------------------------------------------------------
// MULTI DISPLAY
// ---------------------------------------------------------

function updateMultiDisplay(sceneNumber, type, list) {

    if (!list) return;

    const row = document.querySelector(`button[data-scene="${sceneNumber}"].${type}-btn`)
        .parentElement
        .querySelector(`.${type}-display`);

    row.innerHTML = list.join(", ");

}


// ---------------------------------------------------------
// ATTACH EVENTS
// ---------------------------------------------------------

function attachRowEvents() {

    // Save buttons
    document.querySelectorAll(".save-scene-btn").forEach(btn => {

        btn.addEventListener("click", async function() {

            const sceneNumber = this.dataset.scene;

            await saveScene(sceneNumber);

        });

    });


    // Rigs selector
    document.querySelectorAll(".rigs-btn").forEach(btn => {

        btn.addEventListener("click", function(){

            const sceneNumber = this.dataset.scene;

            openMultiSelectModal(sceneNumber, "rigs", assets.rigs);

        });

    });


    // Props selector
    document.querySelectorAll(".props-btn").forEach(btn => {

        btn.addEventListener("click", function(){

            const sceneNumber = this.dataset.scene;

            openMultiSelectModal(sceneNumber, "props", assets.props);

        });

    });

}


// ---------------------------------------------------------
// SAVE SCENE
// ---------------------------------------------------------

async function saveScene(sceneNumber) {

    const row = document.querySelector(`.set-select[data-scene="${sceneNumber}"]`).closest("tr");

    const set = row.querySelector(".set-select").value;
    const bg = row.querySelector(".bg-select").value;
    const light = row.querySelector(".light-select").value;

    const rigs = sceneConfig[sceneNumber]?.rigs || [];
    const props = sceneConfig[sceneNumber]?.props || [];

    const payload = {
        set: set,
        rigs: rigs,
        props: props,
        light_rigs: light ? [light] : [],
        bgs: bg ? [bg] : [],
        camera_rigs: []
    };

    const response = await fetch(`/pipeline/scene/${currentFilmId}/${sceneNumber}`, {

        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify(payload)

    });

    const result = await response.json();

    console.log("Saved", result);

}

let modalScene = null;
let modalType = null;


// ---------------------------------------------------------
// OPEN MULTI SELECT MODAL
// ---------------------------------------------------------

function openMultiSelectModal(sceneNumber, type, list) {

    modalScene = sceneNumber;
    modalType = type;

    const modal = document.getElementById("assetSelectModal");
    const listContainer = document.getElementById("assetSelectList");

    listContainer.innerHTML = "";

    const existing = sceneConfig[sceneNumber]?.[type] || [];

    for (const item of list) {

        const checked = existing.includes(item) ? "checked" : "";

        listContainer.innerHTML += `
            <div class="asset-option">
                <label>
                    <input type="checkbox" value="${item}" ${checked}>
                    ${item}
                </label>
            </div>
        `;

    }

    modal.style.display = "block";

}


// ---------------------------------------------------------
// SAVE MODAL SELECTION
// ---------------------------------------------------------

function saveModalSelection() {

    const checkboxes = document.querySelectorAll("#assetSelectList input");

    const selected = [];

    checkboxes.forEach(cb => {

        if (cb.checked) {
            selected.push(cb.value);
        }

    });

    if (!sceneConfig[modalScene]) {
        sceneConfig[modalScene] = {};
    }

    sceneConfig[modalScene][modalType] = selected;

    updateMultiDisplay(modalScene, modalType, selected);

    closeModal();

}


// ---------------------------------------------------------
// CLOSE MODAL
// ---------------------------------------------------------

function closeModal() {

    const modal = document.getElementById("assetSelectModal");
    modal.style.display = "none";

}