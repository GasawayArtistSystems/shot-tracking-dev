"use client";

import { useEffect } from "react";
import { FaUndo, FaRedo, FaSave, FaPencilAlt, FaTrash } from "react-icons/fa";

export default function DrawingTools({
    isDrawing, setIsDrawing,
    brushColor, setBrushColor,
    brushSize, setBrushSize,
    clearCanvas, clearAll,
    undoLastChange, redoLastChange
}) {

    // ✅ Keyboard Shortcuts: B = toggle draw, [ = smaller, ] = bigger
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key.toLowerCase() === "b") {
                setIsDrawing((prev) => !prev);
            } else if (e.key === "[") {
                setBrushSize((prev) => Math.max(1, prev - 1));   // shrink but not below 1
            } else if (e.key === "]") {
                setBrushSize((prev) => Math.min(50, prev + 1)); // grow but not above 50
            }
        };

        window.addEventListener("keydown", handleKeyPress);
        return () => window.removeEventListener("keydown", handleKeyPress);
    }, [setIsDrawing, setBrushSize]);

    return (
        <div className="w-[250px] flex-shrink-0 bg-gray-900 p-2 text-xs space-y-3 overflow-hidden">

            {/* Toggle Drawing Mode */}
            <button
                onClick={() => setIsDrawing(!isDrawing)}
                className={`w-full max-w-[250px] px-2 py-1 text-xs flex items-center gap-1 whitespace-nowrap text-white rounded-md ${isDrawing ? "bg-red-500" : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  
            >
                <FaPencilAlt /> {isDrawing ? "Stop Drawing" : "Start Drawing (B)"}
            </button>

            {/* Brush Color Selection */}
            <div className="bg-gray-800 p-2 rounded-md space-y-2">
                <h3 className="text-xs font-medium">🎨 Brush Color:</h3>
                <div className="flex flex-wrap gap-1 justify-start items-center">
                    {["#ff0000", "#ffffff", "#00ff00", "#ffff00"].map((color) => (
                        <button
                            key={color}
                            onClick={() => setBrushColor(color)}
                            className={`w-6 h-6 rounded-full border-2 ${brushColor === color ? "border-white" : "border-transparent"
                                }`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                    <input
                        type="color"
                        value={brushColor}
                        onChange={(e) => setBrushColor(e.target.value)}
                        className="w-6 h-6 p-0 border border-white"
                    />
                </div>
            </div>

            {/* Brush Size Slider */}
            <div className="w-full max-w-[250px] bg-gray-800 p-2 rounded-md">
                <div className="flex justify-between items-center mb-1">
                    <h3 className="text-xs font-medium">🖌 Size:</h3>
                    <span className="text-xs text-gray-300">{brushSize}</span> {/* 🔢 current size */}
                </div>
                <input
                    type="range"
                    min="1"
                    max="50"   // 🔼 increase if you want bigger brushes
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full h-4"
                />
            </div>


            {/* Clear Buttons */}
            <div className="flex gap-1">
                <button
                    onClick={() => {
                        console.log("🧹 Clear button REALLY FIRED in DrawingTools.jsx");
                        console.log("typeof clearCanvas prop =", typeof clearCanvas);
                        if (typeof clearCanvas === "function") {
                            clearCanvas();
                        } else {
                            console.error("❌ clearCanvas prop is not a function");
                        }
                    }}
                    className="flex-1 px-1 py-1 text-xs bg-red-600 text-white rounded-sm whitespace-nowrap"
                >
                    <FaTrash className="inline-block mr-1" />
                    Clear
                </button>


                <button
                    onClick={clearAll}
                    className="flex-1 px-1 py-1 text-xs bg-yellow-600 text-white rounded-sm whitespace-nowrap"
                >
                    🧨 Clear All
                </button>
            </div>

            {/* Undo / Redo Buttons (still hidden) */}
            <button className="hidden" onClick={undoLastChange}>
                <FaUndo /> Undo
            </button>
            <button className="hidden" onClick={redoLastChange}>
                <FaRedo /> Redo
            </button>

        </div>
    );
      
}