// 🎬 sceneReviewSession.js
// ✅ Fallback for API base path if not imported
console.log("🆕 sceneReviewSession.js tracing enabled");

// 🔁 Single bridge: push options to global + notify React (if bound)
function pushStatusOptions(opts) {
    const options = Array.isArray(opts) ? opts : [];

    if (typeof window !== "undefined") {
        window.statusOptionsForStep = options;

        if (typeof window.refreshSceneStatusOptions === "function") {
            try {
                window.refreshSceneStatusOptions(options);
            } catch (err) {
                console.warn("refreshSceneStatusOptions threw:", err);
            }
        }
    }
}

// Ensure base URL available for fetch
const API_BASE_URL =
    (typeof window !== "undefined" && window.API_BASE_URL)
        ? window.API_BASE_URL
        : (process.env.NODE_ENV === "development"
            ? "http://localhost:5000"
            : "");


// Attach a traced save function to window so your click handler can call it.
if (typeof window !== "undefined") {

window.saveReviewedTrace = async function saveReviewedTrace(annotations = {}) {
    try {
        console.log("[SAV1] Save clicked");

        // Try to get the *exact* current video path your player is showing
        const current = window.currentVideoPath || "";
        let folder = "";
        let pattern = "";

        if (current) {
            const rawPath = current.includes("/review/get_video?path=")
                ? decodeURIComponent(current.split("/review/get_video?path=")[1])
                : current;

            folder = rawPath.substring(0, rawPath.lastIndexOf("\\"));
            const file = rawPath.substring(rawPath.lastIndexOf("\\") + 1);

            // Normalize to a base pattern (server will append _v*.webm if missing)
            pattern = file
                .replace(/_v\d+.*\.webm$/i, "_*.webm")  // versioned → generalize
                .replace(/_R\.webm$/i, "_*.webm");      // reviewed → generalize
        } else {
            // Fallback: rebuild from globals the session set
            const film = window.selectedFilmName || "Unknown";
            const scene = String(window.selectedSceneNum || "").padStart(3, "0");
            const shot = String(window.currentShotNumber || "").padStart(3, "0");
            const step = (window.selectedStepCode || "LAY").toUpperCase();
            folder = `\\\\GAAAP1PRD01W\\Films\\${film}\\${scene}\\${shot}`;
            pattern = `${film}_${scene}_${shot}_${step}_*.webm`;
        }

        console.log("[SAV2] Built payload", { folder, pattern });

        const res = await fetch(`${API_BASE_URL}/review/save_reviewed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder, pattern, annotations }),
        });

        console.log("[SAV3] Response status", res.status);
        const data = await res.json().catch(() => ({}));
        console.log("[SAV3] Response body", data);

        if (!res.ok) {
            // surface server-detailed stage + error
            throw new Error(`${data?.stage || "save"}: ${data?.error || "failed"}`);
        }
        return data;
    } catch (err) {
        console.error("[SAVX] Save reviewed error:", err);
        throw err;
    }
};
}


// 🔹 Helper: fetch live status for a specific shot + step
async function fetchShotStatus(sceneNumber, shotNumber, stepId) {
    try {
        // why: tolerate timing—use whichever step id is available
        const effectiveStepId = stepId || window.feedbackStepId || window.currentStepId || null;

        if (!sceneNumber || !shotNumber || !effectiveStepId) {
            console.warn("⚠️ Missing params for fetchShotStatus:", {
                sceneNumber,
                shotNumber,
                effectiveStepId,
            });
            return "Unknown";
        }

        const url =
            `${API_BASE_URL}/review/get_shot_step_status` +
            `?scene=${encodeURIComponent(sceneNumber)}` +
            `&shot=${encodeURIComponent(shotNumber)}` +
            `&step_id=${encodeURIComponent(effectiveStepId)}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data?.resolved_path && !data.resolved_path.includes("*")) {
            window.selectedResolvedFile = data.resolved_path;
            console.log("🟢 selectedResolvedFile set from backend:", window.selectedResolvedFile);
        }

        if (data.status) {
            console.log(`✅ Loaded status for shot ${shotNumber}:`, data.status);
            return data.status;
        } else {
            console.warn("⚠️ No status found:", data);
            return "Unknown";
        }
    } catch (err) {
        console.error("❌ fetchShotStatus error:", err);
        return "Unknown";
    }
}

    // /app/sceneReviewSession.js  — corrected init up to waitForSceneButtons

    export function initSceneReviewSession({ setSelectedFile, allShots, selectedFile, currentStepPrefix = "LAY" }) {
        console.log("🎬 Scene Review Session initialized");
        window.__allShotsRef__ = Array.isArray(allShots) ? allShots : (window.__allShotsRef__ || []);


        // Build playlist using allShots if available
        let scenePlaylist = [];

        // Fetch live statuses for all shots in the scene (after feedback step is known)
        (async () => {
            console.log("🧠 Waiting for feedback step ID before fetching statuses...");

            // wait up to ~2s for feedback step id to appear
            let retries = 0;
            while (!window.feedbackStepId && retries < 10) {
                await new Promise((res) => setTimeout(res, 200));
                retries++;
            }

            console.log("🎯 Using feedback step ID:", window.feedbackStepId);

            if (!window.feedbackStepId) {
                console.warn("⚠️ No feedback step ID found, skipping status fetch");
                return;
            }

            console.log("🧠 Fetching live statuses for all shots...");

            for (const shot of allShots || []) {
                if (!shot.scene_number || !shot.shot_number) continue;

                const status = await fetchShotStatus(
                    shot.scene_number,
                    shot.shot_number,
                    window.feedbackStepId
                );

                shot.current_status = status;
            }

            console.log("🎯 Updated allShots with current statuses:", allShots);

            // 🧩 After statuses are loaded, build the filtered playlist
            setTimeout(() => {
                if (!Array.isArray(allShots) || !allShots.length) return;

                const validShots = allShots.filter(
                    (s) => s && s.shot_number && s.shot_number !== "" && s.shot_number !== null
                );

                // 🧹 Exclude CUT shots
                const filteredShots = validShots.filter(
                    (s) => !String(s.current_status || s.status || "").toLowerCase().includes("cut")
                );
                console.log(`🪓 Excluding CUT shots → ${validShots.length - filteredShots.length} removed`);

                // Build playlist from the filtered list
                scenePlaylist = filteredShots.map((shot, i) => {
                    const sceneNum = String(shot.scene_number).padStart(3, "0");
                    const shotNum = String(shot.shot_number).padStart(3, "0");
                    const step = (currentStepPrefix || "LAY").toUpperCase();
                    const filmName = window.selectedFilmName || "UnknownFilm";
                    const baseDir = `\\\\GAAAP1PRD01W\\Films\\${filmName}\\${sceneNum}\\${shotNum}`;
                    const pattern = `${filmName}_${sceneNum}_${shotNum}_${step}_*.webm`;

                    const resolvedPath =
                        (shot.file_path && String(shot.file_path).replace(/\//g, "\\")) ||
                        `${baseDir}\\${pattern}`;

                    window.selectedResolvedFile = resolvedPath;

                    const resolvedName = shot.file_name || `${filmName}_${sceneNum}_${shotNum}_${step}`;

                    return {
                        id: shot.id || i + 1,
                        file_path: resolvedPath,
                        name: resolvedName,
                        shot_number: shot.shot_number,
                    };
                });

                console.log(`🎞️ SceneReviewSession built ${scenePlaylist.length} filtered shots`);

                // Update Scene Review Bar header
                const filmName = window.selectedFilmName || "Unknown Film";
                const sceneNum = window.selectedSceneNum || "???";
                const totalShots = scenePlaylist.length;
                const headerEl = document.querySelector("#sceneReviewBar span.text-lg");
                const countEl = document.querySelector("#sceneReviewBar span.text-sm");
                if (headerEl) headerEl.textContent = `${filmName} – Scene ${sceneNum} – Review Session`;
                if (countEl) countEl.textContent = `(${totalShots} Shots)`;

                // Auto-start first shot (now that list is filtered)
                if (scenePlaylist.length > 0) loadShot(0);
            }, 800);


            // Set initial status for first shot
            if ((allShots || []).length > 0) {
                window.currentShotStatus = allShots[0].current_status || "Pending Review";
                if (typeof window.setCurrentStatus === "function") {
                    window.setCurrentStatus(window.currentShotStatus);
                }
            }
        })();

        // Dynamically load FB step + statuses from backend
        const sceneId = window.scene_id;                 // ✅ numeric id used by backend
        const stepCode = window.selectedStepCode;

        if (sceneId && stepCode) {
            fetch(`${API_BASE_URL}/review/get_feedback_status/${sceneId}/${stepCode}`)
                .then((res) => res.json())
                .then((data) => {
                    console.log("✅ FB status data received:", data);

                    if (data.error) {
                        console.warn("⚠️ No feedback status found:", data.error);
                        return;
                    }

                    // Set global feedback step info (used by fetchShotStatus)
                    window.feedbackStepName = data.feedback_step;
                    window.feedbackStepId = data.feedback_step_id;
                    window.feedbackStatuses = data.statuses;

                    // Prefer full node list for the FB step (ordered, with colors)
                    let dropdownOptions = [];
                    if (Array.isArray(data.options) && data.options.length) {
                        dropdownOptions = data.options.map(o => o.status).filter(Boolean);
                        // store color map for React UI
                        window.statusMeta = data.options;
                        window.statusColorByName = Object.fromEntries(
                            data.options.map(o => [o.status, o.color || "#222"])
                        );
                        window.statusOptionsSource = "fb-nodes";
                    } else {
                        dropdownOptions = [
                            ...new Set((data.statuses || []).map((s) => s.status).filter(Boolean)),
                        ];
                        window.statusOptionsSource = "fb-unique";
                    }

                    pushStatusOptions(dropdownOptions);



                })
                .catch((err) => {
                    console.error("❌ Failed to fetch feedback statuses:", err);
                });
        } else {
            console.warn("⚠️ Skipping FB status fetch. Invalid scene/step:", { sceneId, stepCode });
        }

        // Normalize step key lookup (case-insensitive and partial)
        let stepKey = window.selectedStepCode;
        const availableKeys = Object.keys(window.gradeOptionsByStep || {});
        const matchedKey =
            availableKeys.find(
                (k) =>
                    k.toLowerCase() === stepKey?.toLowerCase() ||
                    k.toLowerCase().includes(stepKey?.toLowerCase())
            ) || stepKey;

        // seed from static map if present
        {
            const seed = window.gradeOptionsByStep?.[matchedKey] || [];
            if (Array.isArray(seed) && seed.length) {
                window.statusOptionsSource = "static";
                pushStatusOptions(seed);
            } else {
                console.log("ℹ️ No static seed options for step:", matchedKey);
            }
        }


        console.log("🎯 Matched step key:", matchedKey);
        console.log("🎯 SceneReviewSession received status options:", window.statusOptionsForStep);

        // Retry if options aren’t ready yet
        if (!window.statusOptionsForStep || window.statusOptionsForStep.length === 0) {
            console.warn("⚠️ No status options yet — retrying in 1s...");
            setTimeout(() => {
                // ✅ Don’t overwrite good options that already arrived
                if (Array.isArray(window.statusOptionsForStep) && window.statusOptionsForStep.length) {
                    console.log("⏭️ Options already loaded; skipping retry.");
                    return;
                }
                if (window.statusOptionsSource === "fb") {
                    console.log("⏭️ FB options already set; skipping retry.");
                    return;
                }

                console.log("🔁 Retrying SceneReviewSession status load...");

                const availableKeys2 = Object.keys(window.gradeOptionsByStep || {});
                const matchedKey2 =
                    availableKeys2.find(
                        (k) =>
                            k.toLowerCase() === stepKey?.toLowerCase() ||
                            k.toLowerCase().includes(stepKey?.toLowerCase())
                    ) || stepKey;

                const retryOpts = window.gradeOptionsByStep?.[matchedKey2] || [];
                if (retryOpts.length) {
                    window.statusOptionsSource = "static-retry";
                    pushStatusOptions(retryOpts);
                } else {
                    console.log("ℹ️ Retry found no static options for:", matchedKey2);
                }

                console.log("🎯 Retried matched step key:", matchedKey2);
                console.log("🎯 Reloaded SceneReviewSession status options:", window.statusOptionsForStep);
            }, 1000);

        }

        console.log("🧩 SceneReviewSession initialized: current step options →", window.statusOptionsForStep);

        // if (Array.isArray(allShots) && allShots.length > 0) {
        //     const validShots = allShots.filter(
        //         (s) => s && s.shot_number && s.shot_number !== "" && s.shot_number !== null
        //     );

        //     // 🧹 Exclude shots marked as CUT
        //     const filteredShots = validShots.filter(
        //         (s) =>
        //             !String(s.current_status || s.status || "").toLowerCase().includes("cut")
        //     );
        //     console.log(`🪓 Excluding CUT shots → ${validShots.length - filteredShots.length} removed`);

        //     scenePlaylist = validShots.map((shot, i) => {
        //         const sceneNum = String(shot.scene_number).padStart(3, "0");
        //         const shotNum = String(shot.shot_number).padStart(3, "0");
        //         const step = (currentStepPrefix || "LAY").toUpperCase();

        //         const filmName = window.selectedFilmName || "UnknownFilm";
        //         const baseDir = `\\\\GAAAP1PRD01W\\Films\\${filmName}\\${sceneNum}\\${shotNum}`;
        //         const pattern = `${filmName}_${sceneNum}_${shotNum}_${step}_*.webm`;

        //         // ✅ Prefer resolved file from backend (has artist + version)
        //         const resolvedPath = (shot.file_path && String(shot.file_path).replace(/\//g, "\\")) ||
        //             `${baseDir}\\${pattern}`;

        //         window.selectedResolvedFile = resolvedPath;
        //         console.log("🟢 selectedResolvedFile set →", window.selectedResolvedFile);

        //         const resolvedName = shot.file_name || `${filmName}_${sceneNum}_${shotNum}_${step}`;

        //         return {
        //             id: shot.id || i + 1,
        //             file_path: resolvedPath,
        //             name: resolvedName,              // display name (artist + version if available)
        //             shot_number: shot.shot_number,
        //         };
        //     });

        //     console.log(`🎞️ SceneReviewSession built ${scenePlaylist.length} valid shots from DB`);

        //     // Update Scene Review Bar header dynamically
        //     const filmName = window.selectedFilmName || "Unknown Film";
        //     const sceneNum = window.selectedSceneNum || "???";
        //     const totalShots = scenePlaylist.length;

        //     const headerEl = document.querySelector("#sceneReviewBar span.text-lg");
        //     const countEl = document.querySelector("#sceneReviewBar span.text-sm");

        //     if (headerEl) headerEl.textContent = `${filmName} – Scene ${sceneNum} – Review Session`;
        //     if (countEl) countEl.textContent = `(${totalShots} Shots)`;
        // } else if (window.sidebarFiles?.films_reviewed?.length) {
        //     // fallback: sidebar files
        //     const reviewed = window.sidebarFiles.films_reviewed;
        //     scenePlaylist = reviewed
        //         .filter((f) => f.file_name && f.file_name.includes(currentStepPrefix || "LAY"))
        //         .map((f, i) => ({
        //             id: i + 1,
        //             file_path: f.file_path,
        //             name: f.file_name.replace(".webm", ""),
        //         }));
        //     console.log(`🎞️ SceneReviewSession fallback → ${scenePlaylist.length} reviewed shots`);
        // }

        // Fallback demo data if none exist
        if (!scenePlaylist.length) {
            scenePlaylist = [
                { id: 1, file_path: "/path/to/fallback_shot1.webm", name: "Shot 1" },
                { id: 2, file_path: "/path/to/fallback_shot2.webm", name: "Shot 2" },
            ];
        }

        console.log("🧩 SceneReviewSession: allShots sample →", (allShots || []).slice(0, 3));

        let currentIndex = 0;

        // sceneReviewSession.js — drop-in replacement for the function

        function loadShot(index) {
            if (!scenePlaylist[index]) return;

            const shot = scenePlaylist[index];
            console.log("🎥 Loading shot:", shot);

            // 1) Resolve current status from enrichment
            const currentFromAllShots = (allShots || []).find(
                (s) => String(s.shot_number) === String(shot.shot_number)
            );
            const statusForThisShot =
                currentFromAllShots?.current_status ??
                currentFromAllShots?.status ??
                shot.status ??
                "Unknown";

            // 2) Set globals + notify React dropdown
            window.currentShotId = shot.id;
            window.currentShotStatus = statusForThisShot;
            window.currentShotNumber = shot.shot_number;            // ✅ expose for other features
            window.currentVideoPath = shot.file_path || null;

            if (typeof window.setCurrentStatus === "function") {
                window.setCurrentStatus(statusForThisShot);
            }

            // 3) Tint the dropdown to match node color (if any)
            const colorMap = window.statusColorByName || {};
            const colorForThisStatus = colorMap[statusForThisShot] || "";
            const selectEl = document.getElementById("reviewStatus");
            if (selectEl) {
                selectEl.style.borderColor = colorForThisStatus || "";
                selectEl.style.boxShadow = colorForThisStatus
                    ? `0 0 0 2px ${colorForThisStatus}55 inset`
                    : "";
            }

            // 4) Update the Review Bar label with FULL filename + tooltip path
            const label = ensureCurrentFileLabel(); // creates #currentFileLabel if missing

            // 🟢 Always prefer the resolved filename (artist + version)
            let fullPath = (shot.file_path || "").toString();

            // 🩵 Prefer resolved file if available
            if (window.selectedResolvedFile && !window.selectedResolvedFile.includes("*")) {
                fullPath = window.selectedResolvedFile;
            }
            let baseName = "";

            // If backend resolved a versioned file, use it
            if (fullPath && !fullPath.includes("*")) {
                baseName = fullPath.split("\\").pop(); // full filename with version
            } else if (shot.file_name) {
                baseName = shot.file_name;
            } else if (shot.name) {
                baseName = shot.name;
            } else {
                baseName = "(unknown file)";
            }

            // ✅ Do NOT strip .webm — we want full filename shown
            if (label) {
                label.textContent = baseName; // show entire file name including .webm
                label.title = fullPath || baseName; // full UNC path on hover
                label.setAttribute("aria-label", fullPath || baseName);
                label.className =
                    "ml-4 text-sm text-blue-300 font-mono break-all font-semibold";
                console.log("🧩 Displaying full filename in header:", baseName);
            }




            // 5) If we already have a concrete path, load it directly and stop
            if (shot.file_path) {
                const url = `${API_BASE_URL}/review/get_video?path=${encodeURIComponent(
                    shot.file_path
                )}`;
                console.log("🎬 Final video URL →", url);
                setSelectedFile(url);
                currentIndex = index;
                return;
            }

            // ---------- Fallbacks below (unchanged behavior, but tightened) ----------

            let filePath = null;

            // Fallback A: search sidebar payload
            if (window.sidebarFiles) {
                const reviewed = window.sidebarFiles.films_reviewed || [];
                const unreviewed = window.sidebarFiles.films || [];
                const films = [...reviewed, ...unreviewed];

                const match = films.find(
                    (f) =>
                        f.file_name &&
                        f.file_name.includes(`_${String(shot.shot_number).padStart(3, "0")}_`)
                );

                if (match?.file_path) {
                    filePath = match.file_path;
                    console.log("🎬 Found reviewed file path:", filePath);
                } else if (match?.file_name) {
                    const current = window.lastSelectedFilePath || "";
                    const folder = current.substring(0, current.lastIndexOf("\\"));
                    filePath = `${folder}\\${match.file_name}`;
                    console.log("🧩 Built path from sidebar filename:", filePath);
                }
            }

            // Fallback B: build a simplified path from last known selection; let server resolve version
            if (!filePath) {
                let basePath = selectedFile || window.lastSelectedFilePath || "";
                if (basePath.includes("/review/get_video?path=")) {
                    basePath = decodeURIComponent(basePath.split("/review/get_video?path=")[1]);
                }

                const parts = basePath.split("\\");
                const fileName = parts.pop() || "";
                const m =
                    /^(.+?)_(\d{3})_(\d{3})_([A-Za-z]+)_(.+?)_/i.exec(fileName) ||
                    /^(.+?)_(\d{3})_(\d{3})_([A-Za-z]+)/i.exec(fileName);

                if (m) {
                    const [, prefix, sceneNum, shotNum, stepCodeLocal, who = "*"] = m;
                    const filmsIdx = parts.findIndex((p) => p.toLowerCase() === "films");
                    const filmName = parts[filmsIdx + 1];
                    const baseDir = `\\\\${parts[2]}\\${parts[3]}\\${parts[4]}\\${filmName}\\${sceneNum}\\${shotNum}`;
                    filePath = `${baseDir}\\${prefix}_${sceneNum}_${shotNum}_${stepCodeLocal}_${who}.webm`;
                    console.log("🎬 Built simplified path (server will resolve version):", filePath);
                }
            }

            if (!filePath) {
                console.warn("⚠️ No valid file path for shot:", shot);
                return;
            }

            // Remember for future fallbacks + try HEAD probe before setting src
            window.lastSelectedFilePath = filePath;
            const finalUrl = `${API_BASE_URL}/review/get_video?path=${encodeURIComponent(
                filePath
            )}`;
            console.log("🎬 Final video URL →", finalUrl);

            fetch(finalUrl, { method: "HEAD" })
                .then((res) => {
                    if (res.ok) {
                        console.log(`✅ File found: ${filePath}`);
                        setSelectedFile(finalUrl);
                        window.currentVideoPath = filePath;               // keep in sync for Save Reviewed
                        currentIndex = index;

                        // Update label now that we have a concrete path
                        const lbl = ensureCurrentFileLabel();
                        if (lbl) {
                            const bn = filePath.split("\\").pop();
                            lbl.textContent = bn || lbl.textContent;
                            lbl.title = filePath;
                            lbl.setAttribute("aria-label", filePath);
                        }
                    } else {
                        console.warn(`❌ File missing (${res.status}) → skipping to next shot`);
                        if (currentIndex < scenePlaylist.length - 1) loadShot(currentIndex + 1);
                    }
                })
                .catch((err) => {
                    console.error(`❌ Error checking file ${filePath}:`, err);
                    if (currentIndex < scenePlaylist.length - 1) loadShot(currentIndex + 1);
                });
        }

        window.saveReviewed = async function saveReviewed(annotations = {}) {
            try {
                // Prefer exact UNC path if available
                const current = window.currentVideoPath || "";
                let folder = "";
                let pattern = "";

                if (current) {
                    // current may be a full file path or a get_video URL
                    const rawPath = current.includes("/review/get_video?path=")
                        ? decodeURIComponent(current.split("/review/get_video?path=")[1])
                        : current;

                    folder = rawPath.substring(0, rawPath.lastIndexOf("\\"));
                    const file = rawPath.substring(rawPath.lastIndexOf("\\") + 1);

                    // normalize to "film_scene_shot_step_*.webm" so backend can append _v*.webm
                    pattern = file
                        .replace(/_v\d+.*\.webm$/i, "_*.webm") // if already versioned, generalize
                        .replace(/_R\.webm$/i, "_*.webm");     // if it's an _R, generalize too
                } else {
                    // build from the playlist name template the session uses
                    const film = window.selectedFilmName || "Unknown";
                    const scene = String(window.selectedSceneNum || "").padStart(3, "0");
                    const shot = String(window.currentShotNumber || "").padStart(3, "0");
                    const step = (window.selectedStepCode || "LAY").toUpperCase();
                    folder = `\\\\GAAAP1PRD01W\\Films\\${film}\\${scene}\\${shot}`;
                    pattern = `${film}_${scene}_${shot}_${step}_*.webm`;
                }

                // 🩵 Prefer resolved filename if we have one
                if (window.selectedResolvedFile && !window.selectedResolvedFile.includes("*")) {
                    const resolvedPath = window.selectedResolvedFile;
                    folder = resolvedPath.substring(0, resolvedPath.lastIndexOf("\\"));
                    pattern = resolvedPath.substring(resolvedPath.lastIndexOf("\\") + 1);
                    console.log("🟢 Using resolved file for save:", pattern);
                }


                const body = { folder, pattern, annotations };
                const base =
                    (typeof window !== "undefined" && window.API_BASE_URL)
                        ? window.API_BASE_URL
                        : (process.env.NODE_ENV === "development"
                            ? "http://localhost:5000"
                            : "");

                const res = await fetch(`${base}/review/save_reviewed`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Save failed");
                console.log("✅ Save reviewed:", data);
                return data;
            } catch (err) {
                console.error("❌ Save reviewed error:", err);
                throw err;
            }
        };

        function ensureCurrentFileLabel() {
            const bar = document.getElementById("sceneReviewBar");
            if (!bar) return null;

            let label = bar.querySelector("#currentFileLabel");
            if (label) return label;

            // Minimal, unobtrusive label
            label = document.createElement("span");
            label.id = "currentFileLabel";
            label.className = "ml-4 text-xs opacity-80 truncate max-w-[36rem] align-middle"; // why: avoid layout shift
            bar.appendChild(label);
            return label;
        }

    // 🕐 Wait for React to render the modal and buttons
        function waitForSceneButtons(attempt = 0) {
            const prevBtn = document.querySelector("#scenePrevBtn");
            const nextBtn = document.querySelector("#sceneNextBtn");
            const playBtn = document.querySelector("#scenePlayBtn") || document.querySelector("#sceneConcatBtn");
            const exitBtn = document.querySelector("#sceneExitBtn");
            const bar = document.querySelector("#sceneReviewBar");
            const concatBtn = document.querySelector("#sceneConcatBtn");
            const saveBtn = document.querySelector("#sceneSaveBtn"); // ✅ Correct ID from page.jsx

            // 🔧 Check all required buttons exist
            if (!bar || !prevBtn || !nextBtn || !playBtn || !exitBtn || !saveBtn) {
                if (attempt < 10) {
                    console.warn(`⏳ Waiting for scene review bar buttons... (attempt ${attempt + 1})`);
                    return setTimeout(() => waitForSceneButtons(attempt + 1), 800);
                } else {
                    console.error("❌ Gave up waiting for scene review bar buttons");
                    return;
                }
            }

            console.log("✅ Found Scene Review Bar buttons — attaching listeners");

            // ✅ Show bar
            bar.classList.remove("hidden");

            prevBtn.addEventListener("click", () => {
                if (currentIndex > 0) loadShot(currentIndex - 1);
            });

            nextBtn.addEventListener("click", () => {
                if (currentIndex < scenePlaylist.length - 1) loadShot(currentIndex + 1);
            });

            playBtn.addEventListener("click", async () => {
                console.log("▶ Starting Play All sequence...");
                const videoEl = document.querySelector("video");
                if (!videoEl) {
                    console.warn("⚠️ No video element found — cannot play shots.");
                    return;
                }

                async function playShot(index) {
                    loadShot(index);
                    console.log(`🎞️ Playing shot ${index + 1}/${scenePlaylist.length}`);
                    await new Promise((resolve) => {
                        videoEl.onended = resolve;
                        videoEl.onerror = resolve;
                        videoEl.onpause = () => {
                            videoEl.onended = null;
                            resolve();
                        };
                        videoEl.play().catch((err) => {
                            console.error("❌ Error playing shot:", err);
                            resolve();
                        });
                    });
                }

                for (let i = 0; i < scenePlaylist.length; i++) {
                    await playShot(i);
                    await new Promise((resolve) => setTimeout(resolve, 1200));
                }

                console.log("🏁 Finished playing all shots!");
            });

            concatBtn?.addEventListener("click", async () => {
                console.log("🎬 Building combined review video...");
                const sceneId = window.selectedSceneId || window.selectedSceneNum || "???";
                const step = window.selectedStepCode || "LAY";

                try {
                    const res = await fetch(`${API_BASE_URL}/review/concat_scene/${sceneId}/${step}`, { method: "POST" });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const videoEl = document.querySelector("video");
                    if (videoEl) {
                        videoEl.src = url;
                        await videoEl.play().catch((err) => console.warn("⚠️ Playback issue:", err));
                    }
                    console.log("✅ Combined video loaded:", url);
                } catch (err) {
                    console.error("❌ Failed to build combined clip:", err);
                }
            });

            // ✅ Hook up SAVE button
            saveBtn.addEventListener("click", async () => {
                console.log("💾 Scene Review SAVE clicked →", window.currentVideoPath);
                try {
                    const currentVideoPath = window.currentVideoPath;
                    if (!currentVideoPath) throw new Error("No active video path found.");

                    // 🟢 Make sure we use the resolved (real) video file, not a wildcard pattern
                    let normalizedPath = currentVideoPath.replace(/\//g, "\\");
                    if (normalizedPath.includes("*") && window.selectedResolvedFile) {
                        normalizedPath = window.selectedResolvedFile.replace(/\//g, "\\");
                    }

                    // 🟢 Single call — same as assignments
                    // 🧹 Force-deep-clone and remove undefined / circular refs
                    function safeClone(obj) {
                        try {
                            return JSON.parse(
                                JSON.stringify(obj, (key, value) =>
                                    typeof value === "undefined" ? null : value
                                )
                            );
                        } catch (err) {
                            console.warn("⚠️ Clone failed, sending empty object:", err);
                            return {};
                        }
                    }

                    const cleanedAnnotations = safeClone(window.markupData || {});
                    console.log("📤 Cleaned annotations sample:", cleanedAnnotations);

                    const payload = {
                        file_path: normalizedPath,
                        annotations: cleanedAnnotations,
                        notes: window.markupNotes || "",
                        is_film: true,
                    };

                    console.log("📤 Sending payload to /save_annotations", payload);

                    const res = await fetch(`${API_BASE_URL}/review/save_annotations`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });




                    if (!res.ok) throw new Error(`Save failed: ${res.status}`);
                    console.log("✅ Scene Review saved successfully (_R + JSON beside source)");
                } catch (err) {
                    console.error("❌ Failed to save Scene Review:", err);
                }
            });


            exitBtn.addEventListener("click", () => {
                bar.classList.add("hidden");
            });

            // Auto-start first shot
            setTimeout(() => {
                if (typeof loadShot === "function" && scenePlaylist.length > 0) {
                    console.log("🎬 Auto-starting Scene Review playback (delayed)...");
                    loadShot(0);
                }
            }, 800);
        }


    // 🚀 Defer button hookup until the modal actually closes
    window.initSceneButtons = () => {
        console.log("🎯 Scene modal closed — now attaching buttons...");
        setTimeout(() => waitForSceneButtons(), 300);
    };




}
