import React from "react";
import { createRoot } from "react-dom/client";
import BugFeatureForm from "../../components/BugFeatureForm.jsx";


export function mountBugForm() {
    const el = document.getElementById("bug-form");
    if (!el) {
        console.error("No #bug-form element to mount.");
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
