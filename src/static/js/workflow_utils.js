function replaceAndBind(buttonId, handler) {
    const oldButton = document.getElementById(buttonId);
    if (!oldButton) return;
    const newButton = oldButton.cloneNode(true);
    oldButton.parentNode.replaceChild(newButton, oldButton);
    newButton.addEventListener("click", handler);
}

function resetModalFields(fieldConfigs = []) {
    fieldConfigs.forEach(({ id, value }) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    });
}

function destroyDiagram() {
    if (window.diagram) {
        window.diagram.clear();
        window.diagram.div = null;
        window.diagram = null;
    }
    const div = go.Diagram.fromDiv("workflow-diagram")?.div;
    if (div) div.remove();
}