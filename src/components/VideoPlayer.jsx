"use client";
import React from "react";
import { useRef, useState, useEffect } from "react";
import DrawingCanvas from "./DrawingCanvas";
import VideoTimeline from "./VideoTimeline";

export default function VideoPlayer({
    isDrawing,
    brushColor,
    brushSize,
    frameAnnotations,
    setFrameAnnotations,
    frameNotes,
    currentFrame,
    setCurrentFrame,
    setClearCanvas,
    canvasKey,
    setRedrawCanvas,
    undoStack,
    setUndoStack,
    redoStack,
    setRedoStack,
    selectedFile,
    undoLastChange,
    redoLastChange,
    onionSkinConfig,
    compareAnnotations,
    compareEnabled,
    compareColor,
    compareVideoUrl,
    compareOpacity,
    selectedAssignment,
    onSeek,
    onDraw
}) {
    const [videoSrc, setVideoSrc] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const isPlayingRef = useRef(isPlaying);
    const [volume, setVolume] = useState(1);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isLooping, setIsLooping] = useState(false);
    const [totalFrames, setTotalFrames] = useState(1);
    const [onionSkinEnabled, setOnionSkinEnabled] = useState(false);

    const videoRef = useRef(null);
    const compareVideoRef = useRef(null);
    const isDraggingRef = useRef(false);
    const fps = 24;

    // --- Zoom / pan -------------------------------------------------------
    // The video, compare ghost and drawing canvas all live inside one
    // "stage" div that gets a CSS translate+scale. DrawingCanvas maps the
    // pointer through the video's getBoundingClientRect(), which already
    // reflects the transform, so strokes land in the right media pixel at
    // any zoom level without touching the stored annotation coordinates.
    const MIN_ZOOM = 1;
    const MAX_ZOOM = 8;
    const viewportRef = useRef(null);
    const stageRef = useRef(null);
    const [view, setView] = useState({ z: 1, x: 0, y: 0 });
    const viewRef = useRef(view);
    const panDragRef = useRef(null);
    const [isPanning, setIsPanning] = useState(false);

    const applyView = (z, x, y) => {
        const stage = stageRef.current;
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
        const w = stage?.offsetWidth || 0;
        const h = stage?.offsetHeight || 0;
        // Keep the zoomed stage covering the viewport -- no panning off into black.
        const clampedX = Math.min(0, Math.max(w - w * zoom, x));
        const clampedY = Math.min(0, Math.max(h - h * zoom, y));
        const next = { z: zoom, x: clampedX, y: clampedY };
        viewRef.current = next;
        setView(next);
    };

    // Zoom so the stage point under (cx, cy) -- viewport-relative px -- stays put.
    const zoomAt = (newZ, cx, cy) => {
        const { z, x, y } = viewRef.current;
        const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZ));
        const px = (cx - x) / z;
        const py = (cy - y) / z;
        applyView(clamped, cx - px * clamped, cy - py * clamped);
    };

    const zoomAtCenter = (factor) => {
        const stage = stageRef.current;
        if (!stage) return;
        zoomAt(viewRef.current.z * factor, stage.offsetWidth / 2, stage.offsetHeight / 2);
    };

    const resetZoom = () => applyView(1, 0, 0);

    // New file → back to fit.
    useEffect(() => {
        resetZoom();
    }, [selectedFile]);

    // Mouse wheel over the viewer zooms toward the cursor. Registered by hand
    // because React's onWheel is passive and can't preventDefault the page scroll.
    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;
        const onWheel = (e) => {
            if (!stageRef.current) return;
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
            const factor = Math.exp(-delta * 0.0015);
            zoomAt(viewRef.current.z * factor, e.clientX - rect.left, e.clientY - rect.top);
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, []);

    // + / - / 0 hotkeys (ignored while typing in a field).
    useEffect(() => {
        const onKey = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const t = e.target;
            if (t?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t?.tagName)) return;
            if (e.key === "=" || e.key === "+") { e.preventDefault(); zoomAtCenter(1.25); }
            else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomAtCenter(1 / 1.25); }
            else if (e.key === "0") { e.preventDefault(); resetZoom(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Pan: middle-mouse drag always; left drag too when not in draw mode.
    const onViewportPointerDown = (e) => {
        if (viewRef.current.z <= 1) return;
        const isMiddle = e.button === 1;
        const isLeftPan = e.button === 0 && !isDrawing;
        if (!isMiddle && !isLeftPan) return;
        e.preventDefault(); // stop middle-click autoscroll
        panDragRef.current = {
            id: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            origX: viewRef.current.x,
            origY: viewRef.current.y,
        };
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setIsPanning(true);
    };

    const onViewportPointerMove = (e) => {
        const drag = panDragRef.current;
        if (!drag || drag.id !== e.pointerId) return;
        applyView(
            viewRef.current.z,
            drag.origX + (e.clientX - drag.startX),
            drag.origY + (e.clientY - drag.startY)
        );
    };

    const endPan = (e) => {
        const drag = panDragRef.current;
        if (!drag || drag.id !== e.pointerId) return;
        panDragRef.current = null;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        setIsPanning(false);
    };

    const stageTransform =
        view.z === 1 && view.x === 0 && view.y === 0
            ? "none"
            : `translate(${view.x}px, ${view.y}px) scale(${view.z})`;

    const viewportCursor = isPanning
        ? "grabbing"
        : view.z > 1 && !isDrawing
            ? "grab"
            : undefined;

    // Cross-version compare: the ghost is a real <video> element rendered
    // on top of the main one (see JSX below), styled with the same
    // object-contain sizing so the browser scales/letterboxes it exactly
    // the way it already does for the main video -- no manual scale/offset
    // math needed. This effect just keeps its currentTime following
    // whatever frame the artist is scrubbing to; the browser repaints it
    // on its own once the seek lands.
    useEffect(() => {
        const v = compareVideoRef.current;
        if (!v || !compareVideoUrl) return;

        const target = currentFrame / fps;
        const seekToTarget = () => {
            if (Math.abs(v.currentTime - target) > 1 / fps / 2) {
                v.currentTime = target;
            }
        };

        if (v.readyState >= 1) {
            seekToTarget();
        } else {
            v.addEventListener("loadedmetadata", seekToTarget, { once: true });
            return () => v.removeEventListener("loadedmetadata", seekToTarget);
        }
    }, [currentFrame, compareVideoUrl, fps]);

    useEffect(() => {
        if (!selectedFile) {
            setVideoSrc(null);   // ✅ clear the video when deselected
            return;
        }
        console.log("VideoPlayer received new file:", selectedFile);
        setVideoSrc(selectedFile);
    }, [selectedFile]);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = volume;
            videoRef.current.muted = volume === 0;
        }
    }, [volume, videoSrc]);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    // Toggle Play/Pause
    const togglePlay = () => {
        if (!videoRef.current) return;

        if (isPlayingRef.current) {
            // currently playing → pause
            videoRef.current.pause();
            setIsPlaying(false);
        } else {
            // currently paused → reset if at end
            if (videoRef.current.currentTime >= videoRef.current.duration) {
                videoRef.current.currentTime = 1;
                setCurrentFrame(0);
            }
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => console.warn("Playback error:", err));
            }
            setIsPlaying(true);
        }
    };



    // Navigate to nearest mark
    const jumpToNearestMark = (direction) => {
        if (!videoRef.current || Object.keys(frameAnnotations).length === 0) return;
        const frameNumbers = Object.keys(frameAnnotations).map(Number).sort((a, b) => a - b);
        if (frameNumbers.length === 0) return;

        let newFrame = currentFrame;
        if (direction === "prev") {
            for (let i = frameNumbers.length - 1; i >= 0; i--) {
                if (frameNumbers[i] < currentFrame) {
                    newFrame = frameNumbers[i];
                    break;
                }
            }
        } else if (direction === "next") {
            for (let i = 0; i < frameNumbers.length; i++) {
                if (frameNumbers[i] > currentFrame) {
                    newFrame = frameNumbers[i];
                    break;
                }
            }
        }
        if (newFrame !== currentFrame) {
            videoRef.current.currentTime = newFrame / fps;
            setCurrentFrame(newFrame);
        }
    };

    // useEffect(() => {
    //     if (!isPlaying) return;

    //     const step = () => {
    //         if (!videoRef.current) return;
    //         const current = videoRef.current.currentTime;
    //         const next = current + 1 / fps;

    //         videoRef.current.currentTime = next;
    //         setCurrentFrame(Math.floor(next * fps));
    //     };

    //     const interval = setInterval(step, 1000 / fps);
    //     return () => clearInterval(interval);
    // }, [isPlaying, fps, isLooping]);

    

    // Handle Volume Change
    const changeVolume = (event) => {
        const newVolume = parseFloat(event.target.value);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
        }
        setVolume(newVolume);
    };

    // Toggle Looping
    const toggleLoop = () => {
        setIsLooping((prev) => !prev);
        if (videoRef.current) {
            videoRef.current.loop = !isLooping;
        }
    };

      

    // Update Total Frames When Video Loads
    useEffect(() => {
        const updateTotalFrames = () => {
            if (videoRef.current) {
                const duration = videoRef.current.duration;
                setTotalFrames(Math.floor(duration * fps) || 1);

                // ✅ force start at frame 1
                videoRef.current.currentTime = 1 / fps;
                setCurrentFrame(0);
            }
        };


        const video = videoRef.current;
        if (video) {
            video.addEventListener("loadedmetadata", updateTotalFrames);
        }

        return () => {
            if (video) {
                video.removeEventListener("loadedmetadata", updateTotalFrames);
            }
        };
    }, [videoSrc]);


    // ✅ Reset when video ends
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleEnded = () => {
            video.pause();
            setIsPlaying(false);
            video.currentTime = 0;   // reset video
            setCurrentFrame(0);      // reset scrubber
        };

        video.addEventListener("ended", handleEnded);
        return () => video.removeEventListener("ended", handleEnded);
    }, [videoSrc]);


    // Update Current Frame on Video Play
    useEffect(() => {
        const updateFrame = () => {
            const video = videoRef.current;
            if (!video || isDraggingRef.current || video.paused) return;

            const duration = video.duration;
            const current = video.currentTime;
            const frame = Math.floor(current * fps);

            console.log("🎞 Frame check:", frame, current.toFixed(3)); 
            setCurrentFrame(frame);

            if (current >= duration || frame >= Math.floor(duration * fps)) {
                video.pause();
                setIsPlaying(false);
                video.currentTime = 0;       // ✅ reset to beginning
                setCurrentFrame(0);
            }

        };

        const video = videoRef.current;
        if (video) {
            video.addEventListener("timeupdate", updateFrame);
        }

        return () => {
            if (video) {
                video.removeEventListener("timeupdate", updateFrame);
            }
        };
    }, [videoSrc]);




    // Handle Keyboard Shortcuts, Exclude Left Panel
    useEffect(() => {
        const handleKeyDown = (event) => {
            const leftPanel = document.getElementById("left-panel");
            if (leftPanel?.contains(event.target)) return;

            switch (event.code) {
                case "Space":
                case " ":
                    if (
                        event.target.tagName === "TEXTAREA" ||
                        event.target.tagName === "INPUT" ||
                        event.target.tagName === "SELECT"
                    ) {
                        return; // ✅ ignore typing in fields & dropdowns
                    }
                    event.preventDefault();
                    console.log("⏯️ Spacebar pressed, isPlaying =", isPlayingRef.current);
                    togglePlay();
                    break;



                case "Comma": // ⏪ ALT + , = Previous Frame
                    if (event.altKey) {
                        event.preventDefault();
                        if (videoRef.current) {
                            const newFrame = Math.max(0, currentFrame - 1);
                            videoRef.current.currentTime = newFrame / fps;
                            setCurrentFrame(newFrame);
                        }
                    } else {
                        event.preventDefault();
                        jumpToNearestMark("prev");
                    }
                    break;

                case "Period": // ⏩ ALT + . = Next Frame
                    if (event.altKey) {
                        event.preventDefault();
                        if (videoRef.current) {
                            const lastFrame = Math.floor(videoRef.current.duration * fps);
                            const newFrame = Math.min(lastFrame, currentFrame + 1);
                            videoRef.current.currentTime = newFrame / fps;
                            setCurrentFrame(newFrame);
                            console.log("⏩ Manual step forward → Frame:", newFrame);
                        }
                    }
                 else {
                        event.preventDefault();
                        jumpToNearestMark("next");
                    }
                    break;

                default:
                    break;
            }

        };

        window.addEventListener("keydown", handleKeyDown, { capture: true });
        return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
    }, [currentFrame, frameAnnotations]);


    return (
        <div className="flex flex-col items-center w-full">
            {/* Main Video Area */}
            <div className="flex justify-center items-center w-full max-w-[1600px]"
                style={{ maxHeight: "calc(100vh - 220px)" }}>
                <div
                    ref={viewportRef}
                    className="relative w-full h-full mx-auto border-2 border-gray-500 bg-black overflow-hidden"
                    style={{ cursor: viewportCursor }}
                    onPointerDown={onViewportPointerDown}
                    onPointerMove={onViewportPointerMove}
                    onPointerUp={endPan}
                    onPointerCancel={endPan}
                    onAuxClick={(e) => e.button === 1 && e.preventDefault()}
                >
                  <div
                    ref={stageRef}
                    className="relative w-full h-full"
                    style={{ transform: stageTransform, transformOrigin: "0 0" }}
                  >
                    {compareVideoUrl && (
                        <video
                            ref={compareVideoRef}
                            src={compareVideoUrl}
                            muted
                            preload="auto"
                            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                            style={{ opacity: compareEnabled ? compareOpacity : 0 }}
                        />
                    )}
                    {selectedFile ? (
                        /\.(png|jpe?g)$/i.test(selectedFile) ? (
                            <>
                                <img
                                    ref={videoRef} // ✅ same ref as video for drawing
                                    src={selectedFile}
                                    className="w-full h-auto max-h-[calc(100vh-260px)] object-contain"
                                    alt="Uploaded image"
                                    // Video's canvas-resize listener fires off "resize"/"layoutchange"
                                    // (see SideBar.jsx's collapse toggle for the same pattern) --
                                    // images have no equivalent to <video>'s loadedmetadata, so without
                                    // this the drawing canvas stays at its default 300x150 size until
                                    // something else happens to trigger a resize.
                                    onLoad={() => window.dispatchEvent(new Event("resize"))}
                                />
                                {videoRef.current && (
                                    <DrawingCanvas
                                        key={canvasKey}     
                                        videoElement={videoRef.current}
                                        currentFrame={currentFrame}
                                        frameAnnotations={frameAnnotations}
                                        setFrameAnnotations={setFrameAnnotations}
                                        isDrawingMode={isDrawing}
                                        brushColor={brushColor}
                                        brushSize={brushSize}
                                        setClearCanvas={setClearCanvas}
                                        setRedrawCanvas={setRedrawCanvas} 
                                        undoStack={undoStack}
                                        setUndoStack={setUndoStack}
                                        redoStack={redoStack}
                                        setRedoStack={setRedoStack}
                                        undoLastChange={undoLastChange}
                                        redoLastChange={redoLastChange}
                                        onionSkinEnabled={onionSkinEnabled}
                                        onionSkinConfig={onionSkinConfig}
                                        compareAnnotations={compareAnnotations}
                                        compareEnabled={compareEnabled}
                                        compareColor={compareColor}
                                    />
                                )}
                            </>
                        ) : (
                            <>
                                    {selectedFile.match(/\.(webm|mp4|mov)$/i) ? (
                                        <video
                                            ref={videoRef}
                                            src={selectedFile}
                                            className="w-full h-auto max-h-[calc(100vh-260px)] object-contain"
                                            controls={false}
                                        />
                                    ) : (
                                        <div className="text-red-500">Unsupported file format</div>
                                    )}

                                    {videoRef.current && (
                                        <DrawingCanvas
                                            key={canvasKey}     
                                            videoElement={videoRef.current}
                                            currentFrame={currentFrame}
                                            frameAnnotations={frameAnnotations}
                                            setFrameAnnotations={setFrameAnnotations}
                                            isDrawingMode={isDrawing}
                                            brushColor={brushColor}
                                            brushSize={brushSize}
                                            setClearCanvas={setClearCanvas}
                                            setRedrawCanvas={setRedrawCanvas} 
                                            undoStack={undoStack}
                                            setUndoStack={setUndoStack}
                                            redoStack={redoStack}
                                            setRedoStack={setRedoStack}
                                            undoLastChange={undoLastChange}
                                            redoLastChange={redoLastChange}
                                            onionSkinEnabled={onionSkinEnabled}
                                            onionSkinConfig={onionSkinConfig}
                                            compareAnnotations={compareAnnotations}
                                            compareEnabled={compareEnabled}
                                            compareColor={compareColor}
                                        />
                                    )}
                            </>
                        )
                    ) : (
                        <p className="text-gray-400 text-center">🎬 Select a video or image</p>
                    )}
                  </div>

                    {/* Zoom controls */}
                    {selectedFile && (
                        <div
                            className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-gray-900/80 text-white text-sm rounded-md px-1 py-1 select-none"
                            onPointerDown={(e) => e.stopPropagation()}
                            title="Scroll to zoom · middle-drag (or drag with drawing off) to pan · + / - / 0 keys"
                        >
                            <button
                                className="w-7 h-7 rounded hover:bg-gray-700 disabled:opacity-40"
                                onClick={() => zoomAtCenter(1 / 1.25)}
                                disabled={view.z <= MIN_ZOOM}
                                aria-label="Zoom out"
                            >
                                −
                            </button>
                            <button
                                className="min-w-[4.5ch] h-7 px-1 rounded hover:bg-gray-700 tabular-nums"
                                onClick={resetZoom}
                                title="Reset to fit (0)"
                            >
                                {Math.round(view.z * 100)}%
                            </button>
                            <button
                                className="w-7 h-7 rounded hover:bg-gray-700 disabled:opacity-40"
                                onClick={() => zoomAtCenter(1.25)}
                                disabled={view.z >= MAX_ZOOM}
                                aria-label="Zoom in"
                            >
                                +
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {/* Timeline Below Video */}
            {(selectedAssignment || selectedFile) && (
                <div className="w-full max-w-[1600px] mt-2 px-4">
                    <VideoTimeline
                        key={Object.keys(frameAnnotations).filter(k => k !== "__refresh").join(",")}
                        videoRef={videoRef}
                        currentFrame={currentFrame}
                        setCurrentFrame={setCurrentFrame}
                        totalFrames={totalFrames}
                        frameAnnotations={frameAnnotations}
                        fps={fps}
                    />
                </div>
            )}
            {/* Video Controls */}
            {selectedFile && !/\.(png|jpe?g)$/i.test(selectedFile) && (
                <div className="mt-1 flex items-center justify-center space-x-4 bg-gray-800 text-white p-2 rounded-lg">
                    {/* Play Button (Fixed Width) */}
                    <button
                        onClick={togglePlay}
                        className="px-4 py-2 bg-blue-500 text-white w-[9ch] rounded-lg hover:bg-blue-600 transition"
                    >
                        {isPlaying ? "Pause" : "Play"}
                    </button>

                    {/* Loop Button */}
                    <button
                        onClick={toggleLoop}
                        className={`px-3 py-1 rounded ${isLooping ? "bg-green-500" : "bg-gray-700 hover:bg-gray-600"}`}
                    >
                        🔁
                    </button>

                    {/* Volume Button & Slider */}
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => {
                                const newVolume = volume > 0 ? 0 : 1;
                                setVolume(newVolume);
                                if (videoRef.current) {
                                    videoRef.current.volume = newVolume;
                                    videoRef.current.muted = newVolume === 0;
                                }
                            }}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                        >
                            {volume > 0 ? "🔊" : "🔇"}
                        </button>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={volume}
                            onChange={changeVolume}
                            className="cursor-pointer"
                        />
                    </div>

                    {/* Current Frame Display (Fixed Width) */}
                    <div className="px-3 py-1 bg-gray-700 rounded w-[5ch] text-center">
                        {String(currentFrame + 1).padStart(3, "0")}
                    </div>
                </div>

            )}
            </div>
    );

}