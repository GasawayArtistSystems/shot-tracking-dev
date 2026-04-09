"use client";

import React, { useState } from "react";

export default function OnionSkinSettings({ config, setConfig }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleChange = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-gray-900 text-white p-3 rounded shadow mb-4">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex justify-between items-center bg-gray-800 px-3 py-2 rounded-md text-sm font-semibold"
      >
        <span>Ghosting (Onion Skin)</span>
        <span>{isExpanded ? "▾" : "▸"}</span>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="flex flex-col space-y-3 mt-3">
          {/* Frames Before / After (Side by Side) */}
          <div className="flex space-x-4">
            <div className="flex-1">
              <label className="text-sm">Frames Before:</label>
              <input
                type="number"
                value={config.beforeCount}
                onChange={(e) => handleChange("beforeCount", Number(e.target.value))}
                min="0"
                className="w-full bg-gray-800 p-2 rounded text-sm"
              />
            </div>

            <div className="flex-1">
              <label className="text-sm">Frames After:</label>
              <input
                type="number"
                value={config.afterCount}
                onChange={(e) => handleChange("afterCount", Number(e.target.value))}
                min="0"
                className="w-full bg-gray-800 p-2 rounded text-sm"
              />
            </div>
          </div>

          {/* Before / After Color (Side by Side) */}
          <div className="flex space-x-4">
            <div className="flex-1">
              <label className="text-sm">Before Color:</label>
              <input
                type="color"
                value={config.beforeColor}
                onChange={(e) => handleChange("beforeColor", e.target.value)}
                className="w-full h-10 bg-gray-800 rounded"
              />
            </div>

            <div className="flex-1">
              <label className="text-sm">After Color:</label>
              <input
                type="color"
                value={config.afterColor}
                onChange={(e) => handleChange("afterColor", e.target.value)}
                className="w-full h-10 bg-gray-800 rounded"
              />
            </div>
          </div>

          {/* Enable Onion Skin Checkbox */}
          <label className="flex items-center space-x-2 mt-2 text-sm">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => handleChange("enabled", e.target.checked)}
              className="cursor-pointer"
            />
            <span>Enable Onion Skin</span>
          </label>
        </div>
      )}
    </div>
  );
}