// This is your Vite entry for the bug form ("bugForm" entry -> /markup/bugForm.js)
import React from "react";
import { createRoot } from "react-dom/client";
import BugFeatureForm from "../../components/BugFeatureForm.jsx";

console.log("✅ BugFeatureForm entry loaded");

export function mountBugForm() {
    const el = document.getElementById("bug-form");
    console.log("mountBugForm called. Found element:", el);
    if (!el) {
        console.error("❌ No #bug-form element found to mount into!");
        return;
    }
    if (!window.__bugFormRoot) {
        window.__bugFormRoot = createRoot(el);
    }
    window.__bugFormRoot.render(<BugFeatureForm />);
}

export function unmountBugForm() {
    if (window.__bugFormRoot) {
        window.__bugFormRoot.unmount?.();
        window.__bugFormRoot = null;
    }
}

// ✅ Attach to window for base.html to access
window.mountBugForm = mountBugForm;
window.unmountBugForm = unmountBugForm;
