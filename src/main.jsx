import React from "react";
import ReactDOM from "react-dom/client";
import BugFeatureForm from "./BugFeatureForm";


console.log("Loaded BugFeatureForm Version B");

// Mount when your modal opens
window.renderBugForm = () => {
    const el = document.getElementById("bug-form");
    if (!el) { console.error("No #bug-form element"); return; }
    if (!window.__bugFormRoot) window.__bugFormRoot = ReactDOM.createRoot(el);
    window.__bugFormRoot.render(<BugFeatureForm />);
};

window.unmountBugForm = () => {
    if (window.__bugFormRoot) {
        window.__bugFormRoot.unmount?.();
        window.__bugFormRoot = null;
    }
};
