"use client";
// 🩵 Restore last scene_id if present before anything else runs
const storedSceneId = sessionStorage.getItem("lastSceneId");
if (storedSceneId) {
  console.log("🔁 Restored scene_id for markup.js:", storedSceneId);
  window.scene_id = Number(storedSceneId);  // make globally available for initMarkup etc.
  sessionStorage.removeItem("lastSceneId"); // clean up after use
}


window.addEventListener("error", e => console.error("❌ Runtime error:", e.error || e.message));
window.addEventListener("unhandledrejection", e => console.error("❌ Unhandled promise:", e.reason));
console.log("🟢 page.jsx: top-level code executing");

// --- Truncated some imports for brevity ---
import { useEffect, useState, useRef, useCallback } from "react";
import VideoPlayer from "../../components/VideoPlayer";
import DrawingTools from "../../components/DrawingTools";
import SideBar from "../../components/SideBar";
import OnionSkinSettings from "../../components/OnionSkinSettings";
import Swal from "sweetalert2";
import ReactDOM from "react-dom/client";
import "../globals.css";
// import "./index.css";

const API_BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000"   // when running npm run dev
    : "";                          // when built and served by Flask
console.log("🌐 API_BASE_URL =", API_BASE_URL, "mode =", import.meta.env.MODE);





export default function MarkupTool() {
  const [lastChangedGrade, setLastChangedGrade] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("assignments");
  const [fileList, setFileList] = useState({ assignments: [], films: [] });
  const [selectedFile, setSelectedFile] = useState(null);
  const clearCanvasRef = useRef(() => {});
  const redrawCanvasRef = useRef(() => {});
  const [canvasKey, setCanvasKey] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#ff0000");
  const [brushSize, setBrushSize] = useState(17);
  const [frameAnnotations, setFrameAnnotations] = useState({});
  const [currentFrame, setCurrentFrame] = useState(0);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [thumbnailStatus, setThumbnailStatus] = useState(null);
  const [gradeStepNames, setGradeStepNames] = useState([]);
  const [gradeOptionsByStep, setGradeOptionsByStep] = useState({});
  const [annotations, setAnnotations] = useState({});
  const [noteInput, setNoteInput] = useState("");
  const [allShots, setAllShots] = useState([]);
  const [onionSkinConfig, setOnionSkinConfig] = useState({
    enabled: false,
    beforeCount: 4,
    afterCount: 4,
    beforeColor: "#0000ff",
    afterColor: "#34ec90ff"
  });

  // 🩵 Restore last scene_id after page reload
  useEffect(() => {
    const savedSceneId = sessionStorage.getItem("lastSceneId");
    if (savedSceneId) {
      console.log("🔁 Restored lastSceneId from storage:", savedSceneId);
      // if you already have a variable like setCurrentSceneId, use that:
      if (typeof setCurrentSceneId === "function") {
        setCurrentSceneId(Number(savedSceneId));
      }
      // or, if you only track selectedItem:
      setSelectedItem(prev => prev ? { ...prev, scene_id: Number(savedSceneId) } : { scene_id: Number(savedSceneId) });
    }
  }, []);


  useEffect(() => {
    fetch(`${API_BASE_URL}/review/get_all_step_names?prefix=Grade`)
      .then((res) => res.json())
      .then((data) => {
        console.log("✅ All Grade Step Names:", data.step_names);
        setGradeStepNames(data.step_names);
      })
      .catch((err) => console.error("❌ Failed to load step names", err));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/review/api/assignment-review-files`)
      .then(async (res) => {
        if (!res.ok) {
          // Grab raw text in case it's an HTML error page
          const text = await res.text();
          console.error("❌ Server returned error:", text);
          throw new Error("Failed to fetch assignment files.");
        }
        return res.json();
      })
      .then((data) => {
        console.log("✅ Sidebar Files:", data);
        setFileList({
          assignments: data.assignments || [],
          all_assignments: data.all_assignments || {},
          films: data.films || [],
          films_reviewed: data.films_reviewed || [],
        });
      })
      .catch((error) => {
        console.error("❌ Failed to load sidebar files:", error.message);
      });
  }, []);
  
  useEffect(() => {
    setNoteInput(frameAnnotations[currentFrame]?.note || "");
  }, [currentFrame, frameAnnotations]);

  useEffect(() => {
    if (!selectedItem) return;

    if (selectedItem.type === "assignment" && selectedItem.individual_assignment_id) {
      fetchAssignmentStatus(selectedItem.individual_assignment_id);
    }

    if (
      selectedItem.type === "film" &&
      /_R\.(webm|png|mov|mp4)$/i.test(selectedItem.file_path)
    ) {
      setFrameAnnotations({}); 
      const jsonPath = selectedItem.file_path.replace(/_R\.(webm|png|mov|mp4)$/i, "_R.json");
      fetch(`${API_BASE_URL}/review/get_annotation_file?path=${encodeURIComponent(jsonPath)}`)
        .then((res) => {
          if (!res.ok) {
            if (res.status === 404) {
              console.info("ℹ️ No fallback annotations for this film.");
              return null;
            }
            throw new Error(`HTTP ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          if (data && typeof data === "object") {
            setFrameAnnotations(data);
            clearCanvasRef.current?.();
            redrawCanvasRef.current?.();
          }
        })
        .catch((err) => console.warn("❌ Fallback annotation load failed:", err));
    }
  }, [selectedItem]);
  
  const saveNote = () => {
    setFrameAnnotations((prev) => {
      const current = typeof prev[currentFrame] === "object" && !Array.isArray(prev[currentFrame])
        ? prev[currentFrame]
        : {};
      return {
        ...prev,
        [currentFrame]: {
          ...current,
          note: noteInput,
          strokes: current.strokes || [],
        },
      };
    });
    

    Swal.fire({
      toast: true,
      icon: "success",
      title: "Note saved!",
      position: "bottom-end",
      showConfirmButton: false,
      timer: 1200,
      timerProgressBar: true,
    });
  };
  
  const removeFileFromList = (filePath) => {
    setFileList(prev => {
      const remove = (arr) => arr?.filter(f => f.file_path !== filePath);
      return {
        ...prev,
        assignments: remove(prev.assignments),
        films: remove(prev.films),
        films_reviewed: remove(prev.films_reviewed),
        all_assignments: Object.fromEntries(
          Object.entries(prev.all_assignments || {}).map(([k, v]) => [k, remove(v)])
        )
      };
    });
  };
  

  function getUpdateMode(item, status) {
    if (!item) return "scene";
    if (item.shot_id && ["FB Layout", "FB Animation", "FB Lighting"].includes(status.step_name)) {
      return "shot";
    }
    if (item.isSB) return "sb";
    return "scene";
  }
  
  const handleGradeChange = async (step_id, new_status, statusMeta) => {
    console.log("🟦 handleGradeChange INPUT:", { step_id, new_status, statusMeta });

    const mode = getUpdateMode(selectedItem, statusMeta);

    const payload = {
      scene_id: selectedItem.scene_id,
      step_id: statusMeta?.update_step_id ?? step_id, // <-- ensures "Layout" (248) is updated
      new_status,
      mode,
    };

    if (mode === "shot") {
      payload.shot_id = selectedItem.shot_id;
    }

    console.log("📤 Sending status update:", payload);

    try {
      const res = await fetch(`${API_BASE_URL}/review/update_scene_status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unknown error");
      }

      console.log("✅ Status update success:", data);

      // Update UI
      setSelectedItem((prev) => ({
        ...prev,
        statuses: prev.statuses.map((s) =>
          s.step_id === step_id ? { ...s, status: new_status } : s
        ),
      }));
    } catch (err) {
      console.error("❌ Failed to update scene status:", err);
    }
  };
  
  const handleClearAll = useCallback(() => {
    Swal.fire({
      title: "Clear ALL Markups?",
      text: "This will remove all annotations from every frame. This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#555",
      confirmButtonText: "Yes, clear all"
    }).then((result) => {
      if (result.isConfirmed) {
        console.log("🧨 Clearing all markups...");
        setFrameAnnotations({});
        setUndoStack([]);
        setRedoStack([]);
        setCurrentFrame(1);
        clearCanvasRef.current?.();
      } else {
        console.log("✅ Clear All cancelled");
      }
    });
  }, []);
  
  
  const fetchAssignmentStatus = (assignmentId) => {
    if (!assignmentId) {
      console.error("❌ Missing individual_assignment_id in fetchAssignmentStatus");
      return;
    }

    fetch(`${API_BASE_URL}/review/get_assignment_status?id=${assignmentId}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log("✅ Fetched Assignment Status:", data);
        if (!Array.isArray(data.statuses)) {
          console.warn("❌ Expected array of statuses but got:", data);
          return;
        }

        // ✅ Update selectedItem with the new statuses
        setSelectedAssignment((prev) => {
          if (!prev) {
            console.warn("⚠️ No selectedItem to update.");
            return null;
          }

          const updated = {
            ...prev,
            statuses: Array.isArray(data.statuses) ? data.statuses : []
          };

          setSelectedItem(updated); // 🔧 Sync both states
          return updated;
        });
        
      })
      .catch((error) => {
        console.error("❌ Error fetching assignment status:", error);
      });
  };
  

  useEffect(() => {
    if (!selectedItem?.statuses) return;
    const fetchAllGradeOptions = async () => {
      const map = {};
      for (const status of selectedItem.statuses) {
        try {
          // Prefer display_step_id if provided by backend
          const stepId = status.display_step_id || status.step_id;
          const res = await fetch(`${API_BASE_URL}/review/get_grade_options?step_id=${stepId}`);


          const data = await res.json();

          if (Array.isArray(data)) {
            // use the correct key (the one we requested)
            map[stepId] = data;
          }

        } catch (err) {
          console.error(`❌ Failed to fetch grades for step_id=${status.step_id}`, err);
        }
      }


      setGradeOptionsByStep(map);
    };
    fetchAllGradeOptions();
  }, [selectedItem?.statuses]);


  useEffect(() => {
    // 🩵 use stored or global scene_id as fallback
    const sceneId = selectedItem?.scene_id || window.scene_id;

    if (!sceneId || isNaN(sceneId)) {
      console.warn("🚫 Skipping shot fetch. Invalid scene_id:", sceneId);
      return;
    }

    const url = `${API_BASE_URL}/review/films/scenes/${sceneId}/shots`;

    fetch(url, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`❌ Shot fetch failed: ${res.status} - ${text}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          console.warn("⚠️ Expected array of shots, got:", data);
          return;
        }

        setAllShots(data);
        console.log("🎯 Loaded shots:", data);

        const shotMatch = selectedItem?.file_name?.match(/_\d{3}_(\d{3})_/);
        const shotCode = shotMatch ? shotMatch[1] : null;

        if (shotCode) {
          const found = data.find(
            (s) => s.scene_id === sceneId && s.shot_number === shotCode
          );
          const shot_id = found?.id || null;
          console.log("🎯 Resolved shot_id from file_name:", shot_id);

          setSelectedItem((prev) => ({
            ...prev,
            shot_id,
          }));
        }
      })
      .catch((err) => {
        console.error("❌ Failed to load shots:", err.message);
      });
  }, [selectedItem?.scene_id]);
  
  
  // 🔄 Re-fetch the review lists and reset the UI
  // Put this in the same component as handleSave
  const refreshMarkup = async () => {
    try {
      // ✅ Prefer your existing loader if you have one (use whatever you call on page mount)
      if (typeof loadReviewFiles === "function") {
        await loadReviewFiles();
      } else if (typeof initMarkup === "function") {
        await initMarkup();
      } else {
        // 🔁 Fallback: try a backend list endpoint ONLY IF you know it works
        // Change the URL below to YOUR real route (examples: /review/get_all_assignment_files, /review/list, etc.)
        const res = await fetch(`${import.meta.env.VITE_API_URL}/review/get_files_for_review`, {
          method: "GET",
          headers: { "Content-Type": "application/json" }
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.files_to_review && typeof setReviewFiles === "function") {
            setReviewFiles([...data.files_to_review]); // ✅ new array reference
          }
          if (data?.all_files && typeof setAllFiles === "function") {
            // ✅ new object reference to trigger re-render
            setAllFiles({ ...data.all_files });
          }

        } else {
          console.warn("refreshMarkup: list endpoint returned", res.status);
        }
      }
    } catch (e) {
      console.warn("refreshMarkup: skipped list reload:", e?.message || e);
    } finally {
      // ✅ Always clear current selection / canvas / video
      if (typeof setSelectedItem === "function") setSelectedItem(null);
      if (typeof setSelectedAssignment === "function") setSelectedAssignment(null);
      if (typeof setAnnotations === "function") setAnnotations({});
      if (typeof setCurrentFrame === "function") setCurrentFrame(0);

      // ✅ Safe video cleanup guard
      if (typeof videoRef !== "undefined" && videoRef?.current) {
        try {
          videoRef.current.pause();
          videoRef.current.removeAttribute("src");
          videoRef.current.load?.();
        } catch (e) {
          console.warn("Video cleanup skipped:", e);
        }
      }

      // ✅ Safe clearCanvas guards
      if (typeof clearAll === "function") {
        try { clearAll(); } catch (e) { console.warn("clearAll skipped:", e); }
      }
      if (typeof clearCanvas === "function") {
        try { clearCanvas(); } catch (e) { console.warn("clearCanvas skipped:", e); }
      }

      // ✅ Only reset videoUrl if hook exists
      if (typeof setVideoUrl === "function") {
        try { setVideoUrl(null); } catch (e) { console.warn("setVideoUrl skipped:", e); }
      }
    }

  };



  const handleSave = async () => {
    const freshAnnotations = frameAnnotations;
    setAnnotations(freshAnnotations);

    if (!selectedItem || (!selectedItem.statuses && !selectedItem.isSB)) {
      Swal.fire({
        icon: "info",
        title: "Missing Info",
        text: "No assignment or statuses selected.",
      });
      return;
    }

    // Warn if no markups found, but still allow save
    if (Object.keys(freshAnnotations).length === 0) {
      const result = await Swal.fire({
        icon: "warning",
        title: "No Markups Found",
        text: "There are no markups. Do you still want to save the grades?",
        showCancelButton: true,
        confirmButtonText: "Yes, save it",
        cancelButtonText: "Cancel",
      });

      if (!result.isConfirmed) {
        console.log("🛑 User cancelled saving without markups.");
        return;
      }
    }

    setSaving(true);

    try {
      // ✅ Always send a force flag so backend updates grade even if nothing changed
      const payload = {
        file_path: selectedItem.file_path,
        annotations: freshAnnotations,
        is_film: selectedCategory === "films",
        individual_assignment_id: selectedItem.individual_assignment_id || null,
        grades: selectedItem.statuses || [], // existing grade data
        force_grade_update: true, // ✅ ensures backend re-grades
      };

      console.log("🚀 Save Payload:", payload);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/review/save_annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      const result = await res.json();
      console.log("✅ Save successful:", result);

      // ✅ Update scene progress if this is a film
      const fileName = selectedItem.file_name || "";
      const isThumb = fileName.includes("_THUMB_");
      const isShotBased = !isThumb;

      if (selectedCategory === "films" && selectedItem?.scene_id && selectedItem?.statuses?.length) {
        for (const gradingStatus of selectedItem.statuses) {
          await fetch(`${API_BASE_URL}/review/update_scene_status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scene_id: selectedItem.scene_id,
              step_id: gradingStatus.step_id,
              new_status: gradingStatus.status,
              shot_id: selectedItem.shot_id || null,
              mode: selectedItem.isSB
                ? (selectedItem.shot_id ? "shot" : "sb")
                : "shot",
            }),
          })
            .then(res => res.json())
            .then(async res => {
              console.log("✅ Updated scene status", res);
              console.log("🔎 reload check → currentSceneId:", selectedItem?.scene_id);

              const safeSceneId = selectedItem?.scene_id || currentSceneId;
              console.log("🧩 using safeSceneId:", safeSceneId);

              if (typeof initMarkup === "function" && safeSceneId) {
                console.log("🔄 Reloading via initMarkup...");
                await initMarkup();
                console.log("✅ initMarkup reload done");
              } else if (typeof loadReviewFiles === "function" && safeSceneId) {
                console.log("🔄 Reloading via loadReviewFiles...");
                await loadReviewFiles();
                console.log("✅ loadReviewFiles reload done");
              } else {
                console.warn("⚠️ Skipped reload – no valid reload function found");
              }
            })
            .catch(err => console.error("❌ Failed to update scene status", err));
        }
      }

      Swal.fire({
        icon: "success",
        title: "Saved!",
        timer: 1000,
        showConfirmButton: false,
        timerProgressBar: true,
      }).then(() => {
        console.log("🔄 Hard reloading page after save...");

        if (selectedItem?.scene_id) {
          sessionStorage.setItem("lastSceneId", selectedItem.scene_id);
          console.log("💾 Stored lastSceneId:", selectedItem.scene_id);
        }

        window.location.reload();
      });
    } catch (err) {
      console.error("❌ Save failed:", err);
      Swal.fire({
        icon: "error",
        title: "Save failed",
        text: err.message || "Something went wrong",
      });
    } finally {
      setSaving(false);
    }
  };




  const clearCurrentFrame = useCallback(() => {
    console.groupCollapsed("🧹 clearCurrentFrame");
    console.log("🧹 clearCurrentFrame function is INCLUDED in build");

    try {
      console.log("• currentFrame =", currentFrame);
      console.log("• keys before =", Object.keys(frameAnnotations));

      setFrameAnnotations((prev) => {
        const updated = structuredClone(prev || {});
        let entry = updated[currentFrame];
        console.log("• entry before =", entry);

        if (!entry) {
          console.warn("• nothing to clear (no entry for this frame)");
          return updated;
        }

        // Case 1: entry is array of strokes
        if (Array.isArray(entry)) {
          delete updated[currentFrame];
          console.log("• removed array entry (strokes only)");
        }
        // Case 2: entry is object with strokes and notes
        else if (typeof entry === "object") {
          delete updated[currentFrame];
          console.log("• removed object entry (cleared strokes + note)");
        }

        console.log("• keys after =", Object.keys(updated));
        return updated;
      });

      setUndoStack((prev) => {
        const out = prev.filter((i) => i.frame !== currentFrame);
        console.log("• undo pruned ->", out.length);
        return out;
      });
      setRedoStack((prev) => {
        const out = prev.filter((i) => i.frame !== currentFrame);
        console.log("• redo pruned ->", out.length);
        return out;
      });

      // clear visible canvas
      console.log("• calling clearCanvasRef.current()", typeof clearCanvasRef.current);
      clearCanvasRef.current?.();
      console.log("• calling redrawCanvasRef.current()", typeof redrawCanvasRef.current);
      redrawCanvasRef.current?.();

      // force remount
      setCanvasKey((k) => {
        const next = k + 1;
        console.log("• bumping canvasKey ->", next);
        return next;
      });

      console.log("✅ clearCurrentFrame finished");
    } catch (err) {
      console.error("❌ clearCurrentFrame error:", err);
    } finally {
      console.groupEnd();
    }
  }, [currentFrame, frameAnnotations]);

  useEffect(() => {
    window.__markupDebug = {
      clearCurrentFrame,
      get frame() { return currentFrame; },
      clearCanvasRef,
      redrawCanvasRef,
    };
  }, [clearCurrentFrame, currentFrame]);

  const handleSetClearCanvas = useCallback((fn) => {
    clearCanvasRef.current = fn;
  }, []);

  const handleSetRedrawCanvas = useCallback((fn) => {
    redrawCanvasRef.current = fn;
  }, []);

  const undoLastChange = () => {
    if (!frameAnnotations[currentFrame] || frameAnnotations[currentFrame].length === 0) return;
    setFrameAnnotations((prev) => {
      const updatedAnnotations = structuredClone(prev);
      const lastStroke = updatedAnnotations[currentFrame]?.pop();
      if (!lastStroke) return prev;
      if (updatedAnnotations[currentFrame]?.length === 0) {
        delete updatedAnnotations[currentFrame];
      }
      setRedoStack((prevRedo) => [...prevRedo, { frame: currentFrame, stroke: lastStroke }]);
      return updatedAnnotations;
    });
    setUndoStack((prevUndo) => prevUndo.slice(0, -1));
    setTimeout(() => {
      clearCanvasRef.current?.();
      redrawCanvasRef.current?.();
    }, 0);
  };

  const redoLastChange = () => {
    if (redoStack.length === 0) return;
    const lastRedo = redoStack.pop();
    if (!lastRedo || !lastRedo.stroke) return;
    setFrameAnnotations((prev) => {
      const updatedAnnotations = { ...prev };
      if (!updatedAnnotations[lastRedo.frame]) updatedAnnotations[lastRedo.frame] = [];
      updatedAnnotations[lastRedo.frame].push(lastRedo.stroke);
      return updatedAnnotations;
    });
    setUndoStack((prevUndo) => [...prevUndo, lastRedo]);
    setTimeout(() => {
      clearCanvasRef.current?.();
      redrawCanvasRef.current?.();
    }, 10);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-800 text-white">
      <SideBar
        apiBaseUrl={API_BASE_URL}
        fileList={fileList}
        onFileDeleted={removeFileFromList}
        setSelectedAssignment={setSelectedAssignment}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        handleFileClick={(file, category = selectedCategory) => {
          console.log("📦 handleFileClick file object:", file);

          const videoUrl = `${API_BASE_URL}/review/get_video?path=${encodeURIComponent(file.file_path)}`;
          setSelectedFile(videoUrl);

          const isAssignment = !!file.individual_assignment_id;

          let assignmentName = "UnknownAssignment";
          let studentName = "UnknownStudent";

          if (file.file_name) {
            const base = file.file_name.replace(/\.[^/.]+$/, ""); // strip extension
            const parts = base.split("_");
            if (parts.length >= 2) {
              assignmentName = parts[0].trim();
              studentName = parts[1].trim();
            }
          }

          // Always set both selectedItem and selectedAssignment right away
          setSelectedItem({
            ...file,
            type: isAssignment ? "assignment" : "film",
            isSB: file.file_name.includes("_SB_"),
            statuses: [],
          });

          setSelectedAssignment({
            ...file,
            assignment_name: assignmentName,
            student_name: studentName,
            isSB: file.file_name.includes("_SB_"),
            statuses: [],
          });

          console.log("✅ After setSelectedAssignment:", {
            assignment_name: assignmentName,
            student_name: studentName
          });

          const isReviewed = file.file_path.includes("_R");

          if (file?.file_name?.endsWith(".mov")) {
            setThumbnailStatus(file.status || "Waiting for Student");
          }

          if (file.individual_assignment_id) {
            console.log("🔍 file object:", file);
            console.log("🧪 individual_assignment_id:", file?.individual_assignment_id);
            fetchAssignmentStatus(file.individual_assignment_id);

            setFrameAnnotations({});
            fetch(`${API_BASE_URL}/review/get_annotations?id=${file.individual_assignment_id}`)
              .then((res) => res.json())
              .then((data) => {
                const fromDb = data.annotations && Object.keys(data.annotations).length > 0;
                setFrameAnnotations(fromDb ? data.annotations : {});
                setCurrentFrame(1);
                clearCanvasRef.current?.();
                redrawCanvasRef.current?.();

                if (!fromDb && isReviewed) {
                  setFrameAnnotations({});
                  const jsonPath = file.file_path.replace(/_R\.(webm|png|mov|mp4)$/i, "_R.json");
                  fetch(`${API_BASE_URL}/review/get_annotation_file?path=${encodeURIComponent(jsonPath)}`)
                    .then((res) => {
                      if (!res.ok) {
                        if (res.status === 404 && file.file_path.includes("_R.")) {
                          console.info("ℹ️ No annotation file found — likely no notes/strokes.");
                          return null;
                        } else {
                          throw new Error(`HTTP ${res.status}`);
                        }
                      }
                      return res.json();
                    })
                    .then((data) => {
                      if (data && typeof data === "object") {
                        setFrameAnnotations(data);
                        setCurrentFrame(1);
                        clearCanvasRef.current?.();
                        redrawCanvasRef.current?.();
                      }
                    })
                    .catch((err) => console.warn("❌ Could not load fallback annotation:", err));
                }
              });
          } else if (isReviewed) {
            setFrameAnnotations({});
            const jsonPath = file.file_path.replace(/_R\.(webm|png|mov|mp4)$/i, "_R.json");
            fetch(`${API_BASE_URL}/review/get_annotation_file?path=${encodeURIComponent(jsonPath)}`)
              .then((res) => {
                if (!res.ok) {
                  if (res.status === 404 && file.file_path.includes("_R.")) {
                    console.info("ℹ️ No annotation file found — likely no notes/strokes.");
                    return null;
                  } else {
                    throw new Error(`HTTP ${res.status}`);
                  }
                }
                return res.json();
              })
              .then((data) => {
                if (data && typeof data === "object" && Object.keys(data).length > 0) {
                  setFrameAnnotations(data);
                  setTimeout(() => {
                    clearCanvasRef.current?.();
                    redrawCanvasRef.current?.();
                  }, 10);
                }
              })
              .catch((err) => console.warn("❌ Could not load fallback annotation:", err));

            // 🔧 Also load grade/status if it has an assignment ID
            if (file.individual_assignment_id) {
              console.log("🔍 file object:", file);
              console.log("🧪 individual_assignment_id:", file?.individual_assignment_id);
              fetchAssignmentStatus(file.individual_assignment_id);

              fetch(`${API_BASE_URL}/review/get_grade_options?assignment_id=${file.individual_assignment_id}`)
                .then((res) => res.json())
                .then((data) => {
                  const optionsByStep = {};
                  data.forEach((step) => {
                    optionsByStep[step.step_id] = step.options;
                  });
                  setGradeOptionsByStep(optionsByStep);
                });

              setSelectedAssignment({
                ...file,
                assignment_name: file.assignment_name || "UnknownAssignment",
                student_name: file.student_name || "UnknownStudent",
                isSB: file.file_name.includes("_SB_"),
                statuses: [],
              });
            } else {
              // ✅ For reviewed files with no assignment ID
              setSelectedAssignment({
                ...file,
                assignment_name: file.assignment_name || "UnknownAssignment",
                student_name: file.student_name || "UnknownStudent",
                isSB: file.file_name.includes("_SB_"),
                statuses: file.statuses || [],
              });
            }
          }

          if (category === "films") {
            const isSB = file.file_name.includes("_SB_");

            fetch(
              `${API_BASE_URL}/review/get_scene_status?scene_id=${file.scene_id}&file_name=${encodeURIComponent(file.file_name)}`
            )
              .then(async (res) => {
                if (!res.ok) {
                  const errorText = await res.text();
                  throw new Error(`Scene status fetch failed: ${res.status} - ${errorText}`);
                }
                return res.json();
              })
              .then((data) => {
                if (!data.display_step_id || !Array.isArray(data.options)) {
                  console.warn("❌ No grading step info returned for scene", data);
                  const fallback = {
                    ...file,
                    scene_id: file.scene_id || null,
                    shot_id: null,
                    statuses: [],
                    isSB,
                  };
                  setSelectedAssignment(fallback);
                  setSelectedItem(fallback);
                  return;
                }

                const shotMatch = file.file_name.match(/_\d{3}_(\d{3})_/);
                const shotCode = shotMatch ? shotMatch[1] : null;

                const updated = {
                  ...file,
                  scene_id: data.scene_id || file.scene_id || null,
                  shot_id: allShots.find(
                    (s) =>
                      s.scene_id === (data.scene_id || file.scene_id) &&
                      s.shot_number === shotCode
                  )?.id || null,
                  statuses: [
                    {
                      // use BOTH ids:
                      // - display_step_id → which dropdown to show options for (FB step)
                      // - step_id (update_step_id) → which row to UPDATE in DB (non-FB paired step)
                      step_id: data.update_step_id,
                      display_step_id: data.display_step_id,
                      step_name: data.step_name,
                      status: data.status,
                      options: data.options,
                    },
                  ],
                  isSB,
                };

                console.log("✅ [setSelectedItem] Updated with shot_id:", updated.shot_id);

                setSelectedAssignment(updated);
                setSelectedItem(updated);
                setGradeOptionsByStep({ [data.step_id]: data.options });
              })
              .catch((err) => {
                console.error("❌ Failed to fetch scene status", err);

                const fallback = {
                  ...file,
                  scene_id: file.scene_id || null,
                  shot_id: null,
                  statuses: [
                    {
                      step_id: null,
                      step_name: "Unknown Step",
                      status: "Waiting",
                      options: [],
                    },
                  ],
                  isSB,
                };

                setSelectedAssignment(fallback);
                setSelectedItem(fallback);
              });
          }
        }}

      />

      {/* Main content layout */}
      <div
        className="flex-1 flex flex-col min-h-0 items-center justify-start bg-gray-700 p-2 overflow-y-auto"
        style={{ maxHeight: '100vh' }}
      >
      {selectedItem && (
          <div className="w-full p-4 bg-gray-900 text-white rounded-md mb-2 flex items-center justify-between">
            <div className="flex items-center space-x-6 overflow-x-auto">
              <h2 className="text-lg font-bold whitespace-nowrap">
                Reviewing: {selectedItem.file_name}
              </h2>
              {false ? (
                <div className="text-sm italic text-yellow-300 bg-gray-800 px-4 py-1 rounded-md">
                  📢 Please remember to update the status of each shot during approvals!
                </div>
              ) : (
                <>
                  {(() => {
                    return null;
                  })()}
                    {(() => {
                      const seen = new Set();
                      const uniqueStatuses = (selectedAssignment?.statuses || []).filter(s => {
                        if (seen.has(s.step_id)) return false;
                        seen.add(s.step_id);
                        return true;
                      });

                      return uniqueStatuses
                        .sort((a, b) => (a.order_num || 0) - (b.order_num || 0))
                        .map((status, idx) => (
                          <div key={`${status.step_id || "unknown"}-${idx}`} className="flex flex-col space-y-0">
                            <label className="text-sm font-semibold">{status.step_name}</label>
                            <select
                              value={status.status || ""}
                              onChange={async (e) => {
                                const newStatus = e.target.value;

                                // ✅ clone array and object so React sees a new reference
                                setSelectedAssignment((prev) => {
                                  const updated = prev.statuses.map((s, i) =>
                                    i === idx ? { ...s, status: newStatus } : s
                                  );
                                  return { ...prev, statuses: updated };
                                });

                                setLastChangedGrade({
                                  step_id: status.step_id,
                                  new_grade: newStatus,
                                });

                                // 📘 Assignments: update via /assignments/api/update-status (includes crossflow logic)
                                if (
                                  selectedCategory === "assignments" &&
                                  selectedAssignment?.individual_assignment_id &&
                                  status.step_id
                                ) {
                                  const payload = {
                                    individual_assignment_id: selectedAssignment.individual_assignment_id,
                                    step_id: status.step_id,
                                    current_status: newStatus,
                                  };

                                  console.log("📤 Sending assignment status update:", payload);

                                  try {
                                    const res = await fetch(`${API_BASE_URL}/assignments/api/update-status`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify(payload),
                                    });

                                    const json = await res.json();
                                    console.log("✅ Assignment status update result:", json);

                                    // 🔄 Immediately refresh all dropdowns after update
                                    if (selectedAssignment?.individual_assignment_id) {
                                      const refreshRes = await fetch(
                                        `${API_BASE_URL}/review/get_assignment_status?id=${selectedAssignment.individual_assignment_id}`
                                      );
                                      const refreshData = await refreshRes.json();

                                      if (Array.isArray(refreshData.statuses)) {
                                        setSelectedAssignment((prev) => ({
                                          ...prev,
                                          statuses: refreshData.statuses,
                                        }));
                                        setSelectedItem((prev) => ({
                                          ...prev,
                                          statuses: refreshData.statuses,
                                        }));
                                        console.log("🔁 Refreshed statuses after crossflow:", refreshData.statuses);
                                      }
                                    }
                                  } catch (err) {
                                    console.error("❌ Failed to update assignment status:", err);
                                  }
                                }

                                // 🎬 Films: keep existing scene update logic
                                if (
                                  selectedCategory === "films" &&
                                  selectedAssignment?.scene_id &&
                                  status.step_id
                                ) {
                                  // 🧩 Safely resolve shot_id no matter where it's stored
                                  const resolvedShotId =
                                    selectedAssignment.shot_id ||
                                    selectedAssignment.id ||
                                    selectedAssignment.shot?.id ||
                                    selectedItem?.shot_id ||
                                    selectedItem?.shot?.id ||
                                    null;

                                  if (!resolvedShotId) {
                                    console.warn(
                                      "⚠️ No valid shot_id found — forcing mode=scene fallback. selectedAssignment:",
                                      selectedAssignment
                                    );
                                  }

                                  const payload = {
                                    scene_id: selectedAssignment.scene_id,
                                    step_id: status.update_step_id ?? status.step_id, // e.g. FB Layout → Layout
                                    new_status: newStatus,
                                    shot_id: resolvedShotId,
                                    mode: resolvedShotId ? "shot" : "scene", // ✅ only 'shot' if we have a shot_id
                                  };

                                  console.log("📤 Sending scene status update:", payload);

                                  try {
                                    const res = await fetch(`${API_BASE_URL}/review/update_scene_status`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify(payload),
                                    });

                                    const json = await res.json();
                                    console.log("✅ Scene status update result:", json);

                                    // 🔁 Optional auto-refresh after status change
                                    if (selectedAssignment?.individual_assignment_id) {
                                      const refreshRes = await fetch(
                                        `${API_BASE_URL}/review/get_scene_status?id=${selectedAssignment.scene_id}`
                                      );
                                      const refreshData = await refreshRes.json();

                                      if (Array.isArray(refreshData.statuses)) {
                                        setSelectedAssignment((prev) => ({
                                          ...prev,
                                          statuses: refreshData.statuses,
                                        }));
                                        setSelectedItem((prev) => ({
                                          ...prev,
                                          statuses: refreshData.statuses,
                                        }));
                                        console.log("🔁 Refreshed statuses after update:", refreshData.statuses);
                                      }
                                    }
                                  } catch (err) {
                                    console.error("❌ Failed to update scene status:", err);
                                  }
                                }


                              }}
                              className="p-1 bg-gray-900 border border-gray-600 text-white rounded-md"
                              // ✅ Use FB step_id (display_step_id) for dropdown options
                              disabled={!gradeOptionsByStep?.[status.display_step_id ?? status.step_id]}
                            >
                              {(gradeOptionsByStep?.[status.display_step_id ?? status.step_id] || []).map((option) => {
                                // 🧠 Handle both string and object formats
                                const isObj = typeof option === "object" && option !== null;
                                const label = isObj ? option.name ?? option.value ?? "Unknown" : option;
                                const value = isObj ? option.value ?? option.name ?? label : option;
                                const color = isObj ? option.color ?? "#222" : "#222"; // fallback dark gray

                                return (
                                  <option
                                    key={value}
                                    value={value}
                                    style={{
                                      backgroundColor: color,
                                      color: "black",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    {label}
                                  </option>
                                );
                              })}


                            </select>

                          </div>
                        ));
                    })()}


                </>
              )}

            </div>
            <button
              onClick={handleSave}
              disabled={saving || (!selectedItem.isSB && !selectedItem?.statuses?.every(s => s.status && s.status.trim() !== ""))}
              className={`px-4 py-1 rounded-md ${saving ? "bg-gray-500" : "bg-blue-500 hover:bg-blue-600"}`}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}

        {selectedFile ? (
          <VideoPlayer
            isDrawing={isDrawing}
            brushColor={brushColor}
            brushSize={brushSize}
            frameAnnotations={frameAnnotations}
            setFrameAnnotations={setFrameAnnotations}
            currentFrame={currentFrame}
            setCurrentFrame={setCurrentFrame}
            clearCanvas={clearCurrentFrame}
            undoStack={undoStack}
            setUndoStack={setUndoStack}
            redoStack={redoStack}
            setRedoStack={setRedoStack}
            selectedFile={selectedFile}
            undoLastChange={undoLastChange}
            redoLastChange={redoLastChange}
            setRedrawCanvas={handleSetRedrawCanvas}
            setClearCanvas={handleSetClearCanvas}
            canvasKey={canvasKey}
            onionSkinConfig={onionSkinConfig}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            🎬 Select a video or image
          </div>
        )}

      </div>

      <div
        className="w-[270px] flex-shrink-0 overflow-hidden bg-gray-900 p-2 border-l border-gray-700"
        style={{
          maxWidth: "270px",     // hard clamp
          minWidth: "270px",     // prevent stretch
          boxSizing: "border-box",
        }}
      >

      <DrawingTools
          brushColor={brushColor}
          setBrushColor={setBrushColor}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          isDrawing={isDrawing}
          setIsDrawing={setIsDrawing}
          clearCanvas={clearCurrentFrame}
          undoLastChange={undoLastChange}
          redoLastChange={redoLastChange}
          clearAll={handleClearAll}
        />

        <OnionSkinSettings
          config={onionSkinConfig}
          setConfig={setOnionSkinConfig}
        />

        <div className="bg-gray-800 p-3 rounded-lg mt-4">
          <h3 className="text-sm font-medium mb-2">📝 Frame Note:</h3>
          <textarea
            className="w-full h-16 p-2 rounded-md bg-gray-700 text-white"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.code === "Space") {
                e.stopPropagation();
                e.preventDefault();   // ✅ stops page scroll + lets global handler fire
              }

              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                setFrameAnnotations((prev) => ({
                  ...prev,
                  [currentFrame]: {
                    ...(prev[currentFrame] || {}),
                    note: noteInput,
                    strokes: prev[currentFrame]?.strokes || [],
                  },
                }));
                Swal.fire({
                  toast: true,
                  icon: "success",
                  title: "Note saved!",
                  position: "bottom-end",
                  showConfirmButton: false,
                  timer: 1200,
                  timerProgressBar: true,
                });
              }
            }}
            placeholder="Type a note for this frame..."
          />

          <button
            onClick={() => {
              setFrameAnnotations((prev) => ({
                ...prev,
                [currentFrame]: {
                  ...(prev[currentFrame] || {}),
                  note: noteInput,
                  strokes: prev[currentFrame]?.strokes || [],
                },
              }));
              Swal.fire({
                toast: true,
                icon: "success",
                title: "Note saved!",
                position: "bottom-end",
                showConfirmButton: false,
                timer: 1200,
                timerProgressBar: true,
              });
            }}
            className="mt-2 bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1 rounded"
          >
            💾 Save Note
          </button>
        </div>
        <div className="bg-gray-800 p-3 rounded-lg mt-4">

          {/* Start Recording Button */}
          <button
            onClick={() => {
              if (!selectedAssignment) {
                alert("No assignment selected!");
                return;
              }

              // --- STEP (PL/BL/BP/P) RESOLVE ---
              const STEP_MAP = {
                "Planning": "PL",
                "Blocking": "BL",
                "Blocking Plus": "BP",
                "Polish": "P",
              };

              const rawLabel = (
                selectedAssignment?.step_name ??
                selectedAssignment?.step ??
                selectedAssignment?.phase ??
                ""
              ).toString().trim();

              // 1) map from human label
              let step = STEP_MAP[rawLabel] || "";

              // 2) fallback: assignment name suffix like "Jump_BP" or "Jump BP"
              if (!step) {
                const an = ((selectedAssignment?.assignment_name ?? "") + "").replaceAll(" ", "_");
                const m1 = an.match(/_(PL|BL|BP|P)\b/i);
                if (m1) step = m1[1].toUpperCase();
              }

              // 3) fallback: filename contains _PL/_BL/_BP/_P_
              if (!step) {
                const fname = ((selectedAssignment?.file_name ?? selectedAssignment?.file ?? "") + "")
                  .split(/[\\/]/).pop();
                const m2 = fname.match(/_(PL|BL|BP|P)_/i);
                if (m2) step = m2[1].toUpperCase();
              }

              console.log("🔎 resolved step:", step);

              // ---- payload (now includes step) ----
              const payload = {
                assignment: selectedAssignment?.assignment_name || "UnknownAssignment",
                student: selectedAssignment?.student_name || "UnknownStudent",
                step, // <— IMPORTANT
              };

              console.log("📤 Sending OBS Start payload:", payload);

              fetch(`http://172.20.1.66:5001/obs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              })
                .then((res) => res.json())
                .then((data) => {
                  console.log("✅ OBS Start Response:", data);
                  // optional: setRecording(true)
                })
                .catch((err) => {
                  console.error("❌ OBS Start Error:", err);
                });
            }}
            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md"
          >
            🎬 Start OBS Recording
          </button>



          {/* Stop Recording Button */}
          <button
            onClick={() => {
              fetch(`http://172.20.1.66:5001/obs/stop`, {
                method: "POST",
              })
                .then((res) => res.json())
                .then((data) => {
                  console.log("🛑 OBS Stop Response:", data);
                  // TODO: optionally show a message in the UI (toast/snackbar)
                })
                .catch((err) => {
                  console.error("❌ OBS Stop Error:", err);
                });
            }}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md"
          >
            🛑 Stop OBS Recording
          </button>
          <button
            onClick={async () => {
              // Ask which class to download
              const { value: className } = await Swal.fire({
                title: "Export Grades",
                input: "select",
                inputOptions: {
                  "Intro to Animation": "Intro to Animation",
                  "Intro to 3D Animation": "Intro to 3D Animation",
                  "Intro to 2D Animation": "Intro to 2D Animation",
                  "Body Mechanics": "Body Mechanics",
                  "Character Animation": "Character Animation"
                },
                inputPlaceholder: "Select a class",
                showCancelButton: true,
              });

              if (!className) return; // user cancelled

              // Fetch CSV from Flask
              fetch(`${API_BASE_URL}/review/export_canvas_csv?class=${encodeURIComponent(className)}`)
                .then((res) => res.blob())
                .then((blob) => {
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${className}.csv`;
                  a.click();
                })
                .catch((err) => {
                  console.error("❌ Failed to download grades CSV:", err);
                  Swal.fire("Error", "Could not download grades.", "error");
                });
            }}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded"
          >
            📥 Export Grades
          </button>

        </div>
      </div>
    </div>
  );
  
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<MarkupTool />);