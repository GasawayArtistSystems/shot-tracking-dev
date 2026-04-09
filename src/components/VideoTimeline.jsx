// ✅ CLEAN PATCHED VERSION

import React from "react";
import { useRef, useEffect, useState } from "react";

export default function VideoTimeline({
  currentFrame,
  setCurrentFrame,
  totalFrames,
  videoRef,
  frameAnnotations = {},
  fps
}) {
  const timelineRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const getFrameFromX = (x) => {
    const rect = timelineRef.current.getBoundingClientRect();
    const clamped = Math.min(Math.max(x - rect.left, 0), rect.width);
    const percentage = clamped / rect.width;
    const frameWidth = rect.width / totalFrames;

    // bucket system → each "slice" of width = one frame
    const frame = Math.floor(clamped / frameWidth);

    return Math.max(0, Math.min(frame, totalFrames - 1));
  };


  const handlePointerDown = (e) => {
    if (!timelineRef.current.contains(e.target)) return;
    if (e.pointerType === 'pen' && e.buttons === 0 && e.pressure === 0) return;

    timelineRef.current.setPointerCapture(e.pointerId);
    setIsDragging(true);

    const frame = getFrameFromX(e.clientX);
    setCurrentFrame(frame);
    if (videoRef.current) {
      videoRef.current.currentTime = frame / (fps || 24);
    }

    e.preventDefault();
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const frame = getFrameFromX(e.clientX);
    setCurrentFrame(frame);
    if (videoRef.current) {
      videoRef.current.currentTime = frame / (fps || 24);
    }
  };

  const handlePointerUp = (e) => {
    if (timelineRef.current.hasPointerCapture(e.pointerId)) {
      timelineRef.current.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    } else {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging]);

  const percent = (currentFrame / totalFrames) * 100;

  return (
    <div
      className="relative w-full h-6 touch-none bg-gray-600 rounded cursor-pointer select-none z-10 mt-4"
      ref={timelineRef}
      onPointerDown={handlePointerDown}
    >
      <div
        className="absolute top-0 left-0 h-full bg-blue-500 rounded"
        style={{ width: `${percent}%` }}
      />
      <div
        className="absolute top-0 w-2 h-full bg-blue-300 border border-white rounded"
        style={{ left: `calc(${percent}% - 4px)` }}
      />

      {Object.entries(frameAnnotations || {}).map(([frameStr, data]) => {
        const frame = Number(frameStr);
        const left = (frame / totalFrames) * 100;
        const hasNote = !!data?.note;
        const hasDrawing = Array.isArray(data?.strokes) && data.strokes.length > 0;

        let bgColor = "gray"; // fallback
        if (hasNote && hasDrawing) bgColor = "purple";
        else if (hasNote) bgColor = "green";
        else if (hasDrawing) bgColor = "yellow";

        return (
          <div
            key={`marker-${frame}`}
            className="pointer-events-none absolute top-0 h-full rounded z-30"
            style={{
              left: `${left}%`,
              width: "3px",
              backgroundColor:
                bgColor === "green"
                  ? "rgb(74 222 128)"
                  : bgColor === "yellow"
                    ? "rgb(253 224 71)"
                    : bgColor === "purple"
                      ? "rgb(192 132 252)"
                      : "gray",
            }}
            title={`Frame ${frame + 1}${hasNote ? " (Note)" : hasDrawing ? " (Drawing)" : ""}`}
          />
        );
      })}

      {/* Frame ticks inside timeline */}
      {Array.from({ length: totalFrames }, (_, i) => {
        const left = (i / totalFrames) * 100;
        const isMajor = i % fps === 0; // one per second
        const isMedium = i % (fps / 2) === 0; // half-second ticks

        return (
          <div
            key={`tick-${i}`}
            className="absolute bg-white/50"
            style={{
              left: `${left}%`,
              top: 0,
              width: "1px",
              height: isMajor ? "100%" : isMedium ? "60%" : "30%", // major taller
            }}
            title={`Frame ${i + 1}`}
          />
        );
      })}

    </div>
  );

}
