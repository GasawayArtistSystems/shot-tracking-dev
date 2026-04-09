// ===============================================================================================================
// INITIALIZATION AND GLOBALS
// ===============================================================================================================

let diagram = null;
let overviewDiagram = null;
let currentParentId = null;
let selectedStepId = null;
let currentChildId = null;

window.currentStepId = null;
window.isCurrentFlowLocked = false;

let initialized = false;
let isLoadingChildFlows = false;
let activeTab = "new-flow";

let isCreatingFlow = false;

const FLOW_TEMPLATES = {
    assignment: [
        { name: 'Standby', position: '100.75185140455793 20.80033976477897', completion_percentage: 0, color: '#bcb88b' },
        { name: 'Ready to Start', position: '100.75185140455793 162.4010192943369', completion_percentage: 0, color: '#ffffff' },
        { name: 'In Progress', position: '100.75185140455793 304.00169882389486', completion_percentage: 10, color: '#d0fa00' },
        { name: 'Retake', position: '50 520', completion_percentage: 50, color: '#ff0000' },
        { name: 'Needs Help', position: '47.72455851477898 445.60237835345276', completion_percentage: 50, color: '#b271d6' },
        { name: 'Submitted', position: '158.5 454.3', completion_percentage: 85, color: '#f08228' },
        { name: 'Graded', position: '158.4764099193369 613.1929016330107', completion_percentage: 100, color: '#52b83d' }
    ],
    fb: [
        { name: 'Waiting for Student', position: '0.0 0.0', completion_percentage: 0, color: '#c5c8c9' },
        { name: 'Grading', position: '0 100', completion_percentage: 50, color: '#e9fa00' },
        { name: 'Grade Done', position: '0 200', completion_percentage: 100, color: '#6bd600' }
    ],
    grade: [
        { name: '0 - Not completed', position: '0 0', completion_percentage: 0, color: '#ff0000' },
        { name: '1 - D', position: '0.0 60.0', completion_percentage: 60, color: '#ff8800' },
        { name: '2 - C', position: '0 140', completion_percentage: 70, color: '#dfe208' },
        { name: '3 - B', position: '0 200', completion_percentage: 80, color: '#87ceeb' },
        { name: '4 - A', position: '0 260', completion_percentage: 90, color: '#8eec94' },
        { name: '5 - Excellent', position: '0 320', completion_percentage: 100, color: '#3adb00' }
    ],
    movie: [
        { name: 'Standby', position: '100.75185140455793 20.80033976477897', completion_percentage: 0, color: '#bcb88b' },
        { name: 'Assigned', position: '100.75185140455793 162.4010192943369', completion_percentage: 0, color: '#ffffff' },
        { name: 'In Progress', position: '100.75185140455793 304.00169882389486', completion_percentage: 10, color: '#d0fa00' },
        { name: 'Retake', position: '50 520', completion_percentage: 50, color: '#ff0000' },
        { name: 'Needs Help', position: '47.72455851477898 445.60237835345276', completion_percentage: 50, color: '#b271d6' },
        { name: 'Submitted', position: '158.5 454.3', completion_percentage: 85, color: '#f08228' },
        { name: 'Approved', position: '158.4764099193369 613.1929016330107', completion_percentage: 100, color: '#52b83d' }
    ],
    movie_approval: [
        { name: 'Standby', position: '0.0 0.0', completion_percentage: 0, color: '#c5c8c9' },
        { name: 'Pending', position: '0 100', completion_percentage: 50, color: '#e9fa00' },
        { name: 'Retake', position: '0 150', completion_percentage: 75, color: '#ff0000' },
        { name: 'Approved', position: '0 200', completion_percentage: 100, color: '#6bd600' }
    ]
};

document.addEventListener("DOMContentLoaded", function () {
    if (initialized) {
        console.warn("⚠️ DOMContentLoaded already executed. Skipping duplicate initialization.");
        return;
    }
    initialized = true;

    const workflowDiagram = document.getElementById("workflow-diagram");
    const overviewDiagram = document.getElementById("overview-diagram");
    const childFlowsContainer = document.getElementById("child-flows");
    const parentFlowsContainer = document.getElementById("parent-flows");
    const createFlowButton = document.getElementById("createIndividualFlowButton");
    const openCreateFlowButton = document.getElementById("openCreateFlowButton");
    const createOverallFlowButton = document.getElementById("submitOverallFlow");

    if (createOverallFlowButton) {
        replaceAndBind("submitOverallFlow", async () => {
            await createOverallFlow();
        });
    } else {
        console.error("❌ ERROR: 'submitOverallFlow' button not found in the DOM.");
    }

    if (!createFlowButton) {
        console.error("❌ ERROR: 'createIndividualFlowButton' not found in the DOM.");
        return;
    }

    // ✅ Estimate existing event listeners safely
    const listeners = getEventListenersPolyfill(createFlowButton);
    createFlowButton.removeEventListener("click", createIndividualFlow);

    // ✅ Add event listener once
    createFlowButton.addEventListener("click", async function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();

        createFlowButton.disabled = true;
        await createIndividualFlow();
        createFlowButton.disabled = false;
    }, { once: true });

    function getEventListenersPolyfill(element) {
        const listeners = [];
        const clone = element.cloneNode();
        element.replaceWith(clone);
        return listeners;
    }


    if (!workflowDiagram) {
        console.error("❌ ERROR: #workflow-diagram container not found.");
        return;
    }
    if (!overviewDiagram) {
        console.error("❌ ERROR: #overview-diagram container not found.");
        return;
    }
    if (!childFlowsContainer) {
        console.error("❌ ERROR: #child-flows not found in the DOM.");
        return;
    }
    if (!parentFlowsContainer) {
        console.error("❌ ERROR: #parent-flows not found in the DOM.");
        return;
    }
    if (!createFlowButton) {
        console.error("❌ ERROR: 'createIndividualFlowButton' not found in the DOM.");
    }

    // ✅ Restore Parent Flow if user switched parents
    const savedParentId = sessionStorage.getItem("selectedParentId");
    if (savedParentId) {
        console.log("✅ Restoring selectedParentId:", savedParentId);
        window.currentParentId = parseInt(savedParentId);
        sessionStorage.removeItem("selectedParentId");
        loadChildFlows(window.currentParentId);
    } else {
        console.log("⚠️ No saved parent found. Waiting for user selection.");
    }

    initializeDiagram();
    initializeOverviewDiagram();
    loadParentFlows();

    parentFlowsContainer.addEventListener("click", function (event) {
        const clickedFlow = event.target.closest(".list-group-item");
        if (!clickedFlow) return;

        const parentId = clickedFlow.getAttribute("data-step-id");
        console.log("🛠️ DEBUG: New Selected Overall Flow ID:", parentId);

        if (!parentId) {
            console.warn("⚠️ No step ID found on clicked flow.");
            return;
        }

        // ✅ Set the current parent and step ID correctly
        window.currentParentId = parentId;
        window.currentStepId = null; // Clear any previous step ID
        window.currentChildId = null;
        document.getElementById("currentStepId").value = parentId;

        // ✅ Clear active child flow highlights
        document.querySelectorAll("#child-flows div").forEach(el => el.classList.remove("bg-gray-500"));

        // ✅ Clear existing diagram safely
        if (window.diagram) {
            window.diagram.clear();
            window.diagram.div = null;
            window.diagram = null;
            go.Diagram.fromDiv("workflow-diagram")?.div?.remove();
        }

        // ✅ Reset the UI
        const workflowContainer = document.getElementById("workflow-diagram");
        workflowContainer.innerHTML = `
            <div id="workflow-message" class="text-white text-lg text-center py-4">
                Loading Individual Flows...
            </div>
        `;

        // ✅ Ensure the child flows list is cleared
        const childFlows = document.getElementById("child-flows");
        childFlows.innerHTML = `<div class="text-white p-2 text-center">No Individual Flows Available</div>`;

        // ✅ Load the child flows for this parent
        loadChildFlows(parentId);


        // ✅ Add a short delay for smoother UI transition
        setTimeout(() => {
            workflowContainer.innerHTML = `
                <div class="d-flex justify-content-center align-items-center" style="height: 100%;">
                    <h3 class="text-muted">Select an Individual Flow to Begin</h3>
                </div>
            `;
        }, 150);
    });

});

document.addEventListener("DOMContentLoaded", setupOverviewButtonListener);

// ===============================================================================================================
// FLOWCHART AND OVERVIEW LOADING
// ===============================================================================================================

async function initializeDiagram() {

    const diagramContainer = document.getElementById("workflow-diagram");
    if (!diagramContainer) return console.error("❌ No #workflow-diagram found.");

    if (!window.currentStepId) {
        document.getElementById("workflow-diagram").innerHTML = `<div class="text-center text-muted">Please click on Individual Workflow.</div>`;
        return;
    }

    try {
        const stepId = window.currentStepId;
        const childId = window.currentChildId;
        const response = await fetch(`/workflow/api/flowchart?step_id=${stepId}&child_id=${childId}`);
        const data = await response.json();

        diagram = initializeDiagramConfig("workflow-diagram", data.nodes, data.links);

        // ✅ NEW: Lock the diagram if needed
        if (window.isCurrentFlowLocked) {
            console.log("\uD83D\uDD10 Locking diagram...");
            diagram.isReadOnly = true;
            disableWorkflowActions();
        } else {
            enableWorkflowActions();
        }

    } catch (error) {
        console.error("Error loading diagram:", error);
    }
}

function initializeOverviewDiagram() {
    const $ = go.GraphObject.make;

    try {
        const overviewContainer = document.getElementById("overview-diagram");
        if (!overviewContainer) {
            throw new Error("❌ ERROR: Overview diagram container not found.");
        }
        overviewContainer.style.display = "block";
        overviewContainer.style.visibility = "visible";

        if (window.overviewDiagram) {
            console.log("🔄 Clearing existing overviewDiagram...");
            window.overviewDiagram.clear();
            window.overviewDiagram.div = null;
        }

        // ✅ Initialize GoJS Diagram
        overviewDiagram = $(go.Diagram, "overview-diagram", {
            initialContentAlignment: go.Spot.Center,
            "undoManager.isEnabled": true,
            "draggingTool.isGridSnapEnabled": true,
            "resizingTool.isGridSnapEnabled": true,
            "grid.visible": false,
            "grid.gridCellSize": new go.Size(20, 20),
        });

        overviewDiagram.groupTemplate = $(go.Group, "Vertical",
            {
                layout: $(go.TreeLayout, { angle: 90, layerSpacing: 50, nodeSpacing: 25 }),
                selectable: true,
                margin: 20
            },
            $(go.Panel, "Auto",
                $(go.Shape, "Rectangle", { fill: "lightgray", stroke: "black" }),
                $(go.TextBlock, { margin: 5, font: "bold 12px sans-serif" }, new go.Binding("text", "workflowName"))
            ),
            $(go.Placeholder)
        );

        // ✅ Define Node Template
        overviewDiagram.nodeTemplate = $(go.Node, "Auto",
            { locationSpot: go.Spot.Center },
            new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
            $(go.Shape, "RoundedRectangle", { fill: "white", stroke: "black" },
                new go.Binding("fill", "color")
            ),
            $(go.TextBlock, { margin: 5, font: "bold 14px sans-serif", stroke: "#333" },
                new go.Binding("text", "text")
            )
        );

        overviewDiagram.linkTemplate = $(go.Link,
            {
                routing: go.Link.AvoidsNodes,
                curve: go.Link.JumpOver,
                corner: 5,
                selectable: true,

                toolTip: $(
                    go.Adornment,
                    "Auto",
                    $(go.Shape, { fill: "#333" }),
                    $(
                        go.TextBlock,
                        { margin: 4, stroke: "white" },
                        new go.Binding("text", "", d => {
                            // d is the link data
                            const diagram = overviewDiagram;   // use your global diagram reference
                            const fromNode = diagram.findNodeForKey(d.from);
                            const toNode = diagram.findNodeForKey(d.to);
                            const fromName = fromNode?.data?.text || "?";
                            const toName = toNode?.data?.text || "?";
                            return `${fromName} → ${toName}`;
                        })
                    )
                )

            },

            $(go.Shape, { strokeWidth: 2 },
                new go.Binding("strokeDashArray", "isCrossflow", (isCrossflow) =>
                    isCrossflow ? [4, 2] : null
                ),
                new go.Binding("stroke", "isCrossflow", (isCrossflow) =>
                    isCrossflow ? "red" : "black"
                )
            ),

            $(go.Shape, { toArrow: "Standard" })
        );



        // ✅ Ensure Main Diagram is Linked
        const mainDiagram = go.Diagram.fromDiv("workflow-diagram");
        if (mainDiagram) {
            console.log("✅ Linking Overview to Main Diagram...");
            // ✅ Manually clone + sort model from mainDiagram
            const sortedNodes = mainDiagram.model.nodeDataArray.slice()
                .map(n => {
                    const [x, y] = (n.loc || "0 0").split(" ").map(Number);
                    return {
                        ...n,
                        loc: `${isNaN(x) ? 0 : x} ${isNaN(y) ? 0 : y}`
                    };
                })
                .sort((a, b) => {
                    const ay = parseFloat(a.loc.split(" ")[1]);
                    const by = parseFloat(b.loc.split(" ")[1]);
                    return ay - by;
                });

            overviewDiagram.model = new go.GraphLinksModel(
                sortedNodes,
                mainDiagram.model.linkDataArray
            );

        } else {
            console.warn("⚠️ Main Diagram Not Found! Overview might not display correctly.");
        }

    } catch (error) {
        console.error("❌ ERROR during overview diagram initialization:", error);
        Swal.fire({
            icon: "error",
            title: "Initialization Failed",
            text: "Failed to initialize the overview diagram. Check the console for details.",
        });
    }
}


// ===============================================================================================================
// DIAGRAM SETUP
// ===============================================================================================================

function initializeDiagramConfig(containerId, nodes = [], links = []) {
    const $ = go.GraphObject.make;

    const diagramContainer = document.getElementById(containerId);
    if (!diagramContainer) {
        console.error(`Diagram container with ID '${containerId}' not found.`);
        return null;
    }

    // Dispose of any existing Diagram associated with this div
    const existingDiagram = go.Diagram.fromDiv(diagramContainer);
    if (existingDiagram) {
        console.log(`Disposing existing Diagram for container: ${containerId}`);
        existingDiagram.div = null;
    }

    const diagram = $(go.Diagram, containerId, {
        initialContentAlignment: go.Spot.Center,
        "undoManager.isEnabled": true,
        "draggingTool.isGridSnapEnabled": true,
        "grid.visible": false,
    });

    diagram.linkTemplate = $(go.Link,
        {
            selectable: true,  // ✅ Ensures links can be selected
            selectionAdornmentTemplate: $(go.Adornment, "Link",
                $(go.Shape, { isPanelMain: true, stroke: "dodgerblue", strokeWidth: 3 }) // Blue highlight on selection
            )
        },
        $(go.Shape),  // Link line
        $(go.Shape, { toArrow: "Standard" }) // Arrowhead
    );

    diagram.commandHandler.deleteSelection = function () {
        const selected = diagram.selection.first();

        if (!selected) {
            console.warn("⚠️ No valid selection.");
            return;
        }

        if (selected instanceof go.Node) {
            const nodeKey = selected.data.key;

            console.log("🔍 Deleting Link - Link Data:", linkData);


            if (nodeKey < 0) {
                console.warn("❌ Temporary node detected. Not in database yet.");
                Swal.fire("Warning", "This node hasn't been saved yet. Please save before deleting.", "warning");
                return;
            }

            console.log("🗑️ Delete Key Pressed - Deleting Node:", nodeKey);

            // ✅ Remove related links from the GoJS model
            const linksToRemove = [];
            diagram.links.each(link => {
                if (link.data.from === nodeKey || link.data.to === nodeKey) {
                    linksToRemove.push(link.data);
                }
            });

            linksToRemove.forEach(linkData => {
                diagram.model.removeLinkData(linkData);
            });

            // ✅ Call backend to delete the node
            deleteNode(nodeKey);
        } else if (selected instanceof go.Link) {
            const linkData = selected.data;
            console.log("🗑️ Delete Key Pressed - Deleting Link:", linkData);

            // ✅ Call backend to delete the link
            deleteLink(linkData);

            // ✅ Remove link visually from the GoJS diagram
            diagram.model.removeLinkData(linkData);
        }
    };

    // Enable user link creation and relinking
    diagram.toolManager.linkingTool.isEnabled = true;
    diagram.toolManager.relinkingTool.isEnabled = true;

    // Add invisible grid
    diagram.grid = $(go.Panel, "Grid",
        { gridCellSize: new go.Size(10, 10) },
        $(go.Shape, "LineH", { stroke: "lightgray", strokeWidth: 0.05 }),
        $(go.Shape, "LineV", { stroke: "lightgray", strokeWidth: 0.05 })
    );

    // Define node template
    diagram.nodeTemplate = $(go.Node, "Spot", // Spot layout allows precise positioning
        {
            locationSpot: go.Spot.Center,
            movable: true, // Allow node movement
            selectionObjectName: "MAIN_SHAPE", // Select the node by clicking the main shape
            location: new go.Binding("loc", "loc", loc => {
                if (!loc) return new go.Point(0, 0);
                const [x, y] = loc.split(" ").map(Number);
                return isNaN(x) || isNaN(y) ? new go.Point(0, 0) : new go.Point(x, y);
            }).makeTwoWay(loc => `${Math.round(loc.x)} ${Math.round(loc.y)}`),
            doubleClick: (e, node) => {
                const nodeData = node.data;
                console.log("✅ Double-click event fired!");
                console.log("Double-clicked on node:", nodeData);
                if (window.isCurrentFlowLocked) {
                    Swal.fire("🔒 Locked", "You cannot edit nodes in a locked flow.", "warning");
                    return;
                }
                openEditNodeModal(nodeData);  // ✅ correctly passes nodeData
            },

            contextMenu: $(
                "ContextMenu",
                $(
                    "ContextMenuButton",
                    $(go.TextBlock, "Create Crossflow Link"),
                    {
                        click: (e, obj) => {
                            const nodeData = obj.part.data;
                            console.log("Right-clicked on node:", nodeData);
                            if (window.isCurrentFlowLocked) {
                                Swal.fire("🔒 Locked", "You cannot create crossflow links in a locked flow.", "warning");
                                return;
                            }
                            openCreateCrossFlowModal(nodeData);
                        },
                    }
                )
            ),
        },
        // Main shape for node selection
        $(go.Panel, "Auto",
            { name: "MAIN_SHAPE" }, // Define the main shape for selection
            $(go.Shape, "RoundedRectangle", { fill: "white", strokeWidth: 1 },
                new go.Binding("fill", "color")
            ),
            $(go.Panel, "Vertical",  // Panel to stack text and icon
                $(go.TextBlock, { margin: 5 }, new go.Binding("text", "text")), // Node name
                $(go.TextBlock, "🔗", // Icon for crossflow link
                    {
                        visible: false, // Default hidden
                        stroke: "#007bff", // Icon color
                        font: "bold 16px sans-serif",
                        alignment: go.Spot.Bottom, // Position the icon below the text
                        toolTip: // ⬅ Tooltip Here
                            $(go.Adornment, "Auto",
                                $(go.Shape, { fill: "lightgray" }),
                                $(go.TextBlock, { margin: 4, text: "Crossflow Link Present" })
                            )
                    },
                    new go.Binding("visible", "hasCrossFlow", (value) => !!value) // Show only if `hasCrossFlow` is true
                )
            )
        ),
        $(go.Shape, "Circle",
            {
                alignment: go.Spot.Top,
                alignmentFocus: go.Spot.Center,
                desiredSize: new go.Size(7, 7),
                fill: "blue",
                stroke: null,
                fromLinkable: true,
                toLinkable: true,
                cursor: "pointer",
                portId: "T",
            }
        ),
        $(go.Shape, "Circle",
            {
                alignment: go.Spot.Right,
                alignmentFocus: go.Spot.Center,
                desiredSize: new go.Size(7, 7),
                fill: "blue",
                stroke: null,
                fromLinkable: true,
                toLinkable: true,
                cursor: "pointer",
                portId: "R",
            }
        ),
        $(go.Shape, "Circle",
            {
                alignment: go.Spot.Bottom,
                alignmentFocus: go.Spot.Center,
                desiredSize: new go.Size(7, 7),
                fill: "blue",
                stroke: null,
                fromLinkable: true,
                toLinkable: true,
                cursor: "pointer",
                portId: "B",
            }
        ),
        $(go.Shape, "Circle",
            {
                alignment: go.Spot.Left,
                alignmentFocus: go.Spot.Center,
                desiredSize: new go.Size(7, 7),
                fill: "blue",
                stroke: null,
                fromLinkable: true,
                toLinkable: true,
                cursor: "pointer",
                portId: "L",
            }
        )
    );
    // Remove crossflow nodes from the workflow diagram
    const crossflowNodeKeys = new Set(
        links.filter(link => link.isCrossflow).map(link => link.to)
    );

    const filteredNodes = nodes.filter(node => !crossflowNodeKeys.has(node.key));
    console.log("Filtered Nodes (should NOT contain crossflows):", filteredNodes);

    // Set the model
    diagram.model = new go.GraphLinksModel(
        nodes.map((node) => {
            const [x, y] = (node.loc || "0 0").split(" ").map(Number);
            return {
                ...node,
                loc: `${Math.round(x)} ${Math.round(y)}`,
                completion_percentage: node.completion_percentage || 0,
            };
        }),
        links
    );

    // Explicitly set part.location after model is set
    diagram.addDiagramListener("InitialLayoutCompleted", () => {
        diagram.nodes.each((node) => {
            const [x, y] = (node.data.loc || "0 0").split(" ").map(Number);
            node.location = new go.Point(x, y); // Explicitly set part.location
        });
    });

    return diagram;
}

// ===============================================================================================================
// WORKFLOW ACTIONS
// ===============================================================================================================

async function createOverallFlow() {
    const flowName = document.getElementById('overallFlowName').value.trim();
    const description = document.getElementById('overallFlowDescription').value.trim();
    const permissionLevel = document.getElementById('overallFlowPermission').value;

    if (!flowName) {
        Swal.fire("Missing Name", "Please enter a flow name.", "warning");
        return;
    }

    try {
        const response = await fetch('/workflow/api/parent_flows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: flowName,
                description: description,
                min_permission_level: permissionLevel,
                workflow_id: null
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to create flow');
        }

        // Close the modal
        closeOverallFlowModal();

        // Reset the modal fields
        resetModalFields([
            { id: 'overallFlowName', value: '' },
            { id: 'overallFlowDescription', value: '' },
            { id: 'overallFlowPermission', value: '1' }
        ]);

        // Refresh the overall flows
        loadParentFlows();

        Swal.fire({
            icon: "success",
            title: "Flow Created!",
            text: "Overall Flow created successfully.",
            timer: 2000,
            showConfirmButton: false
        });

    } catch (error) {
        console.error('Error creating flow:', error);
        Swal.fire("Error", error.message, "error");
    }
}


async function editOverallFlow(flowId) {
    try {
        // Fetch current flow details
        const response = await fetch(`/workflow/api/parent_flows/${flowId}`);
        const flowData = await response.json();

        if (!response.ok || !flowData) throw new Error(flowData.error || "Failed to fetch flow details");

        // Get modal elements
        const flowNameInput = document.getElementById('overallFlowName');
        const flowDescriptionInput = document.getElementById('overallFlowDescription');
        const flowPermissionInput = document.getElementById('overallFlowPermission');
        const modalElement = document.getElementById('addOverallFlowModal');
        const modalLabel = document.getElementById('addOverallFlowModalLabel');
        const submitButton = document.getElementById('submitOverallFlow');

        if (!flowNameInput || !flowDescriptionInput || !flowPermissionInput || !modalElement || !modalLabel || !submitButton) {
            console.error("❌ ERROR: One or more modal elements not found!");
            return;
        }

        // Populate modal fields
        flowNameInput.value = flowData.name || "";
        flowDescriptionInput.value = flowData.description || "";
        flowPermissionInput.value = flowData.min_permission_level || "1";

        const lockCheckbox = document.getElementById('lockFlowCheckbox');
        if (lockCheckbox) {
            lockCheckbox.checked = flowData.is_locked === 1;
        }

        // Update modal title and button text
        modalLabel.textContent = 'Edit Overall Flow';
        submitButton.textContent = 'Save Changes';

        // Remove old event listeners to prevent duplicates
        replaceAndBind('submitOverallFlow', async () => {
            const newName = flowNameInput.value.trim();
            const description = flowDescriptionInput.value.trim();
            const permissionLevel = flowPermissionInput.value;

            if (!newName) {
                Swal.fire("Missing Name", "Please enter a flow name.", "warning");
                return;
            }

            try {
                const updateResponse = await fetch(`/workflow/api/parent_flows/${flowId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: newName,
                        description: description,
                        min_permission_level: permissionLevel,
                        is_locked: lockCheckbox?.checked ? 1 : 0
                    })
                });

                const data = await updateResponse.json();
                if (!updateResponse.ok) throw new Error(data.error || 'Failed to update flow');

                modalElement.classList.add("hidden");

                // ✅ Use helper to reset fields
                resetModalFields([
                    { id: 'overallFlowName', value: '' },
                    { id: 'overallFlowDescription', value: '' },
                    { id: 'overallFlowPermission', value: '1' }
                ]);

                submitButton.textContent = 'Create Flow';
                modalLabel.textContent = 'Create Overall Flow';

                // ✅ Rebind create handler
                replaceAndBind('submitOverallFlow', createOverallFlow);

                loadParentFlows();

                Swal.fire({
                    icon: "success",
                    title: "Flow Updated",
                    text: "Flow updated successfully!",
                    timer: 2000,
                    showConfirmButton: false
                });

            } catch (error) {
                console.error('Error updating flow:', error);
                Swal.fire("Update Failed", error.message, "error");
            }
        });

        // Show modal
        modalElement.classList.remove("hidden");
    } catch (error) {
        console.error("Error fetching flow details:", error);
        showToast(error.message, "error");
    }
}

async function deleteOverallFlow(flowId, event) {
    if (event) event.stopPropagation();

    try {
        const result = await Swal.fire({
            title: 'Delete Flow?',
            text: "This will delete this flow and all its individual flows. This cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel'
        });

        if (!result.isConfirmed) return;

        const response = await fetch(`/workflow/api/parent_flows/${flowId}`, {
            method: 'DELETE',
            cache: 'no-cache'
        });

        if (!response.ok) throw new Error('Failed to delete flow');

        Swal.fire({
            icon: "success",
            title: "Deleted!",
            text: "The flow has been deleted.",
            timer: 2000,
            showConfirmButton: false
        });

        loadParentFlows();

        if (currentParentId === flowId) {
            currentParentId = null;
            const childFlows = document.getElementById('child-flows');
            if (childFlows) {
                childFlows.innerHTML = '<li class="list-group-item">No Individual Flows Available</li>';
            }
        }

    } catch (error) {
        console.error('Delete error:', error);
        Swal.fire('Error!', 'Failed to delete flow', 'error');
    }
}

async function createIndividualFlow() {
    if (isCreatingFlow) {
        console.warn("⚠️ Already creating a flow. Ignoring duplicate request.");
        return;
    }

    isCreatingFlow = true;

    const flowName = document.getElementById("newFlowName").value.trim();
    const permissionLevel = document.getElementById("individualFlowPermissionNew").value;
    const parentId = window.currentParentId;
    const templateSelection = document.getElementById("templateSelection");

    if (!flowName) {
        Swal.fire("Missing Name", "Please enter a flow name.", "warning");
        isCreatingFlow = false;
        return;
    }

    if (!parentId) {
        Swal.fire("Missing Parent", "Please select an overall flow before adding an individual flow.", "warning");
        isCreatingFlow = false;
        return;
    }

    let requestBody = {
        name: flowName,
        parent_id: parentId,
        permission_level: permissionLevel
    };

    if (templateSelection?.value) {
        const selectedTemplateId = parseInt(templateSelection.value, 10);
        if (!isNaN(selectedTemplateId) && selectedTemplateId > 0) {
            requestBody["template_id"] = selectedTemplateId;
        } else {
            Swal.fire("Invalid Template", "Please choose a valid template.", "error");
            isCreatingFlow = false;
            return;
        }
    }

    try {
        const response = await fetch('/workflow/api/individual_flows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to create flow");

        closeAddIndividualFlowModal();
        loadChildFlows();

        if (requestBody.template_id) {
            console.log("📌 Template selected. Loading nodes into GoJS...");
            loadFlowchart(data.child_id, data.workflow_id);
        }

        Swal.fire({
            icon: "success",
            title: "Flow Created",
            text: "Individual flow created successfully.",
            timer: 2000,
            showConfirmButton: false
        });

    } catch (error) {
        console.error("❌ Error creating flow:", error);
        Swal.fire("Creation Failed", error.message, "error");
    } finally {
        isCreatingFlow = false;
    }
}

function editIndividualFlow(flowId) {
    const individualFlow = window.individualFlows?.find(flow => flow.id === flowId);
    if (!individualFlow) {
        Swal.fire("Missing Flow", "Individual flow not found", "error");
        return;
    }

    const modal = document.getElementById("addIndividualFlowModal");
    const label = document.getElementById("addIndividualFlowModalLabel");
    const createBtn = document.getElementById("createIndividualFlowButton");
    const submitBtn = document.getElementById("submitIndividualFlow");

    // Configure modal for editing
    label.textContent = "Edit Individual Flow";
    createBtn.classList.add("hidden");
    submitBtn.classList.remove("hidden");
    submitBtn.textContent = "Save";

    // Fill form
    document.getElementById("newFlowName").value = individualFlow.name;
    document.getElementById("individualFlowPermissionNew").value = String(individualFlow.min_permission_level || "1");
    document.getElementById("templateFlowName").value = individualFlow.workflow_name || "";
    document.getElementById("templateSelection").value = "";

    // ✅ Bind save handler using helper
    replaceAndBind("submitIndividualFlow", async () => {
        const newName = document.getElementById("newFlowName").value.trim();
        const permissionLevel = document.getElementById("individualFlowPermissionNew").value;

        if (!newName || !flowId) {
            Swal.fire("Missing Data", "Invalid flow ID or missing name", "error");
            return;
        }

        try {
            const isLocked = document.getElementById("lockIndividualFlowCheckbox")?.checked;

            const updateResponse = await fetch(`/workflow/api/individual_flows/${flowId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newName,
                    is_locked: isLocked ? 1 : 0,
                    min_permission_level: permissionLevel  // ✅ now correctly read at submit time
                })
            });

            const data = await updateResponse.json();
            if (!updateResponse.ok) throw new Error(data.error || "Failed to update flow");

            closeAddIndividualFlowModal();
            loadChildFlows();

            Swal.fire({
                icon: "success",
                title: "Flow Updated",
                text: "Individual flow updated successfully.",
                timer: 2000,
                showConfirmButton: false
            });

        } catch (error) {
            console.error("❌ Error updating flow:", error);
            Swal.fire("Update Failed", error.message, "error");
        }
    });

    // Show modal
    modal.classList.remove("opacity-0", "pointer-events-none", "hidden");
}

async function deleteIndividualFlow(flowId, event) {
    if (event) event.stopPropagation();

    try {
        const result = await Swal.fire({
            title: 'Delete Individual Flow?',
            text: "This will permanently delete this flow and its data.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel'
        });

        if (!result.isConfirmed) return;

        const response = await fetch(`/workflow/api/individual_flows/${flowId}`, {
            method: 'DELETE',
            cache: 'no-cache'
        });

        if (!response.ok) throw new Error("Failed to delete flow");

        Swal.fire({
            icon: "success",
            title: "Deleted",
            text: "The flow has been deleted.",
            timer: 2000,
            showConfirmButton: false
        });

        // Clear if deleted flow was active
        if (window.currentChildId === flowId) {
            window.currentChildId = null;
            window.currentStepId = null;
            destroyDiagram();
            document.getElementById("workflow-diagram").innerHTML = `
                <div id="workflow-message" class="text-white text-lg text-center py-4">
                    Please click on Individual Workflow.
                </div>
            `;
        }

        loadChildFlows();

    } catch (error) {
        console.error("❌ Error deleting flow:", error);
        Swal.fire("Error", "Failed to delete individual flow", "error");
    }
}

// ===============================================================================================================
// CROSSFLOW LOGIC
// ===============================================================================================================

document.getElementById("delete-crossflow").addEventListener("click", () => {
    Swal.fire({
        icon: "warning",
        title: "Delete Crossflow?",
        text: "This will permanently remove the crossflow connection.",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        confirmButtonText: "Yes, remove it!",
        cancelButtonText: "Cancel"
    }).then((result) => {
        if (result.isConfirmed) {
            console.log("🧹 User confirmed crossflow deletion");

            // ✅ Clear dropdowns
            document.getElementById("crossFlowTargetDropdown").value = "";
            document.getElementById("crossFlowFlowId").value = "";

            // ✅ Prevent dropdown resetting the UI
            document.getElementById("crossFlowTargetDropdown").dispatchEvent(new Event("change"));

            // ✅ Set the removal flag
            window.removeCrossflow = true;

            // ✅ Hide crossflow UI
            document.getElementById("editCrossFlowSection").classList.add("hidden");
            document.getElementById("delete-crossflow").classList.add("hidden");

            // ✅ Immediately submit the form
            console.log("📤 Submitting edit form after crossflow delete");
            document.getElementById("editNodeForm").requestSubmit();
        }
    });
});

function createCrossFlowLink() {
    const sourceNodeIdElement = document.getElementById('createSourceNodeId');
    const targetFlowDropdown = document.getElementById('createTargetFlowDropdown');
    const targetNodeDropdown = document.getElementById('createTargetNodeDropdown');

    if (!sourceNodeIdElement || !targetFlowDropdown || !targetNodeDropdown) {
        console.error("❌ ERROR: One or more modal elements are missing.");
        Swal.fire({
            icon: "error",
            title: "Error",
            text: "Cross-flow modal elements are missing! Please reload the page.",
        });
        return;
    }

    const fromNodeId = parseInt(sourceNodeIdElement.value, 10);
    const targetFlowId = parseInt(targetFlowDropdown.value, 10);
    const targetNodeId = parseInt(targetNodeDropdown.value, 10);
    const stepId = window.currentStepId || selectedStepId;

    if (!fromNodeId || !targetFlowId || !targetNodeId || !stepId) {
        Swal.fire({
            icon: "warning",
            title: "Incomplete Selection",
            text: "Please select all fields to create a crossflow link.",
        });
        return;
    }

    console.log("✅ Sending request to save crossflow...");

    fetch('/workflow/api/crossflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            step_id: stepId,
            source_node_id: fromNodeId,
            target_flow_id: targetFlowId,
            target_node_id: targetNodeId
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                Swal.fire({
                    icon: "success",
                    title: "Crossflow Created",
                    text: "Crossflow link created successfully!",
                });

                console.log("🔗 Updating GoJS node to show crossflow link...");

                // ✅ Update the GoJS diagram to show crossflow link
                let updatedNode = diagram.model.findNodeDataForKey(fromNodeId);
                if (updatedNode) {
                    updatedNode.hasCrossFlow = true; // Flag for crossflow
                    diagram.model.updateTargetBindings(updatedNode);
                }

                // ✅ Force diagram refresh
                diagram.redraw();

            } else {
                Swal.fire({
                    icon: "error",
                    title: "Error Saving Link",
                    text: data.error || "An unknown error occurred.",
                });
            }
        })
        .catch(error => {
            console.error("❌ ERROR saving crossflow link:", error);
            Swal.fire({
                icon: "error",
                title: "Network Error",
                text: "Failed to save crossflow link. Please try again.",
            });
        });

    // ✅ Close the new modal
    document.getElementById('createCrossFlowModal').classList.add('hidden');
}


function deleteCrossFlow(sourceNodeId, targetNodeId, targetFlowId) {
    Swal.fire({
        title: "Are you sure?",
        text: "This will permanently delete the crossflow.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, delete it!",
        cancelButtonText: "Cancel",
    }).then((result) => {
        if (result.isConfirmed) {
            fetch("/workflow/api/delete_crossflow", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    parent_node_id: sourceNodeId,
                    child_node_id: targetNodeId,
                    to_flow_id: targetFlowId,
                }),
            })
                .then((res) => {
                    if (!res.ok) {
                        return res.text().then((text) => {
                            throw new Error(`Failed to delete crossflow: ${res.status} ${res.statusText} - ${text}`);
                        });
                    }
                    return res.json();
                })
                .then((data) => {
                    Swal.fire("Deleted!", "Your crossflow has been deleted.", "success");
                    // Remove the element from the UI
                    loadDiagram();
                })
                .catch((err) => {
                    console.error("❌ Error deleting crossflow:", err);
                    Swal.fire("Error", `Failed to delete the crossflow: ${err.message}`, "error");
                });
        }
    });
}


function loadDiagram() {
    console.log("🔄 Reloading diagram...");
    // Assuming you have a global diagram variable
    if (window.diagram) {
        window.diagram.clear();
        renderWorkflow();
    }
}


function handleCrossflowChange(parentNodeId, oldFlowId, oldNodeId, newFlowId, newNodeId, stepId) {
    console.log("🔄 Crossflow Update Attempt:", {
        parentNodeId,
        oldFlowId,
        oldNodeId,
        newFlowId,
        newNodeId,
        stepId
    });

    // Ensure we are using the correct step ID for the child node
    if (isNaN(newNodeId) || isNaN(newFlowId)) {
        console.error("❌ Invalid node or flow ID detected. Aborting update.");
        return;
    }

    fetch('/workflow/api/crossflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            source_node_id: parentNodeId,
            target_flow_id: newFlowId,
            target_node_id: newNodeId,  // This should be the correct step_id
            step_id: stepId
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                console.log("✅ Crossflow updated successfully");

                // Remove the old link from the diagram
                const oldLinkIndex = diagram.model.linkDataArray.findIndex(l =>
                    l.from == parentNodeId &&
                    l.to == oldNodeId &&
                    l.flowId == oldFlowId
                );

                if (oldLinkIndex !== -1) {
                    const oldLink = diagram.model.linkDataArray[oldLinkIndex];
                    diagram.model.removeLinkData(oldLink);
                    console.log("🗑️ Removed old link from diagram:", oldLink);
                } else {
                    console.warn("⚠️ Old link not found in diagram, adding new link directly.");
                }

                // Add the updated link
                const newLinkData = {
                    from: parentNodeId,
                    to: newNodeId,  // Use the correct step_id
                    flowId: newFlowId
                };
                diagram.model.addLinkData(newLinkData);
                console.log("🔗 Added updated link to diagram:", newLinkData);

                // Force the diagram to refresh
                diagram.requestUpdate();
            } else {
                console.error("❌ Error updating crossflow:", data.error);
            }
        })
        .catch(err => {
            console.error("❌ Error updating crossflow:", err);
        });
}

function mergeCrossflowData(validNodes, processedLinks, crossflowData) {
    if (!crossflowData || !Array.isArray(crossflowData.nodes) || !Array.isArray(crossflowData.links)) {
        console.warn("⚠️ Invalid crossflow data structure:", crossflowData);
        return;
    }

    if (crossflowData.nodes.length === 0 && crossflowData.links.length === 0) {
        console.warn("⚠️ Empty crossflow data received. No nodes or links to merge.");
        return;
    }

    // ✅ Use a Set for faster lookup
    const existingNodeKeys = new Set(validNodes.map(node => node.key));
    const existingLinks = new Set(processedLinks.map(link => `${link.from}-${link.to}`));

    // ✅ Process nodes
    crossflowData.nodes.forEach(node => {
        if (!existingNodeKeys.has(node.key)) {
            validNodes.push({
                key: node.key,
                text: node.text || "Untitled",
                loc: node.loc || "0 0",
                color: node.color || "lightcoral",
                step_id: node.step_id || null
            });
            existingNodeKeys.add(node.key);
        }
    });

    // ✅ Process links
    crossflowData.links.forEach(link => {
        const linkKey = `${link.from}-${link.to}`;
        if (!existingLinks.has(linkKey)) {
            processedLinks.push({
                from: link.from,
                to: link.to,
                isCrossflow: true
            });
            existingLinks.add(linkKey);
        }
    });
}

function openCreateCrossFlowModal(node) {
    const modal = document.getElementById("createCrossFlowModal");
    document.getElementById("createSourceNodeName").value = node.text;
    document.getElementById("createSourceNodeId").value = node.key;

    const targetFlowDropdown = document.getElementById("createTargetFlowDropdown");
    const targetNodeDropdown = document.getElementById("createTargetNodeDropdown");

    // Reset dropdowns
    targetFlowDropdown.innerHTML = '<option value="">Select Target Flow</option>';
    targetNodeDropdown.innerHTML = '<option value="">Select Target Node</option>';

    // Fetch child flows
    fetch(`/workflow/api/child_flows?parent_id=${window.currentParentId}&order_by=order_num`)
        .then(res => res.json())
        .then(flows => {
            flows.forEach(flow => {
                const opt = document.createElement("option");
                opt.value = flow.id;
                opt.textContent = flow.name;
                targetFlowDropdown.appendChild(opt);
            });
        });

    // ✅ When a flow is selected, fetch its nodes
    targetFlowDropdown.onchange = () => {
        const selectedFlowId = targetFlowDropdown.value;
        targetNodeDropdown.innerHTML = '<option value="">Select Target Node</option>';

        if (!selectedFlowId) return;

        fetch(`/workflow/api/child_nodes?step_id=${selectedFlowId}`)
            .then(res => res.json())
            .then(nodes => {
                nodes.forEach(n => {
                    const opt = document.createElement("option");
                    opt.value = n.id;
                    opt.textContent = n.name;
                    targetNodeDropdown.appendChild(opt);
                });
            });
    };

    modal.classList.remove("hidden");
}


function closeCreateCrossFlowModal() {
    document.getElementById("createCrossFlowModal").classList.add("hidden");
}

function openEditCrossFlowModal(parentNodeId, childNodeId, flowId, sourceNodeName) {
    const modal = document.getElementById("editCrossFlowModal");
    document.getElementById("editSourceNodeName").value = sourceNodeName;
    document.getElementById("editSourceNodeId").value = parentNodeId;

    const targetFlowDropdown = document.getElementById("editTargetFlowDropdown");
    const targetNodeDropdown = document.getElementById("editTargetNodeDropdown");

    // Reset dropdowns
    targetFlowDropdown.innerHTML = '<option value="">Select Target Flow</option>';
    targetNodeDropdown.innerHTML = '<option value="">Select Target Node</option>';

    // Fetch flows and pre-select
    fetch(`/workflow/api/child_flows?parent_id=${window.currentParentId}&order_by=order_num`)
        .then(res => res.json())
        .then(flows => {
            flows.forEach(flow => {
                const opt = document.createElement("option");
                opt.value = flow.id;
                opt.textContent = flow.name;
                if (flow.id === flowId) opt.selected = true;
                targetFlowDropdown.appendChild(opt);
            });

            if (flowId) {
                fetch(`/workflow/api/child_nodes?step_id=${flowId}`)
                    .then(res => res.json())
                    .then(nodes => {
                        nodes.forEach(n => {
                            const opt = document.createElement("option");
                            opt.value = n.id;
                            opt.textContent = n.name;
                            if (n.id === childNodeId) opt.selected = true;
                            targetNodeDropdown.appendChild(opt);
                        });
                    });
            }
        });

    // Wire up Update button
    const updateBtn = document.getElementById("editActionBtn");
    updateBtn.setAttribute(
        "onclick",
        `updateCrossFlowLink(${parentNodeId}, ${childNodeId}, ${flowId})`
    );

    modal.classList.remove("hidden");
}

function closeEditCrossFlowModal() {
    document.getElementById("editCrossFlowModal").classList.add("hidden");
}


// function editCrossflow(parentNodeId, childNodeId, flowId, sourceNodeName) {
//     console.log("✏️ Editing Crossflow:", { parentNodeId, childNodeId, flowId });

//     const modal = document.getElementById("crossFlowModal");
//     modal.classList.remove("hidden");

//     // Pre-fill source node
//     document.getElementById("sourceNodeId").value = parentNodeId;
//     document.getElementById("sourceNodeName").innerText = sourceNodeName;

//     const targetFlowDropdown = document.getElementById("targetFlowDropdown");
//     const targetNodeDropdown = document.getElementById("targetNodeDropdown");

//     // Reset both dropdowns
//     targetFlowDropdown.innerHTML = '<option value="">Select Target Flow</option>';
//     targetNodeDropdown.innerHTML = '<option value="">Select Target Node</option>';

//     // Fetch available flows (same as createCrossFlow)
//     fetch(`/workflow/api/child_flows?parent_id=${window.currentParentId}&order_by=order_num`)
//         .then(res => res.json())
//         .then(flows => {
//             flows.forEach(flow => {
//                 const opt = document.createElement("option");
//                 opt.value = flow.id;
//                 opt.textContent = flow.name;
//                 if (flow.id === flowId) opt.selected = true; // ✅ pre-select
//                 targetFlowDropdown.appendChild(opt);
//             });

//             // After flows are loaded, fetch nodes for the selected flow
//             if (flowId) {
//                 fetch(`/workflow/api/child_nodes?step_id=${flowId}`)
//                     .then(res => res.json())
//                     .then(nodes => {
//                         nodes.forEach(n => {
//                             const opt = document.createElement("option");
//                             opt.value = n.id;
//                             opt.textContent = n.name;
//                             if (n.id === childNodeId) opt.selected = true; // ✅ pre-select
//                             targetNodeDropdown.appendChild(opt);
//                         });
//                     });
//             }
//         });

//     // Change action button (green) from "Create" → "Update"
//     const actionBtn = modal.querySelector(".action-btn");
//     if (actionBtn) {
//         actionBtn.textContent = "Update";
//         actionBtn.setAttribute(
//             "onclick",
//             `updateCrossFlowLink(${parentNodeId}, ${childNodeId}, ${flowId})`
//         );
//     }


// }

function updateCrossFlowLink(sourceNodeId, oldChildId, oldFlowId) {
    const targetFlowId = document.getElementById("editTargetFlowDropdown").value;
    const targetNodeId = document.getElementById("editTargetNodeDropdown").value;
    const stepId = document.getElementById("editNodeStepId").value; // keep this if it's still in your edit modal

    const payload = {
        source_node_id: sourceNodeId,
        target_flow_id: parseInt(targetFlowId, 10),
        target_node_id: parseInt(targetNodeId, 10),
        step_id: parseInt(stepId, 10),
        old_child_id: oldChildId,
        old_flow_id: oldFlowId
    };

    console.log("📦 Updating Crossflow:", payload);

    fetch("/workflow/api/crossflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                Swal.fire("Success", "Crossflow updated!", "success");
                closeEditCrossFlowModal();  // 🔄 use the new close function

                // ✅ Refresh the Edit Node modal with the updated crossflows
                const nodeId = document.getElementById("editNodeId").value;
                const stepId = document.getElementById("editNodeStepId").value;

                const nodeData = diagram.model.findNodeDataForKey(parseInt(nodeId));
                if (nodeData) {
                    openEditNodeModal(nodeData);
                }
            } else {
                Swal.fire("Error", "Failed to update crossflow.", "error");
            }
        })
        .catch(err => {
            console.error("❌ Error updating crossflow:", err);
            Swal.fire("Error", "Failed to update crossflow.", "error");
        });
}



function openCrossFlowModal(node) {

    // Select modal elements
    const sourceNodeNameElement = document.getElementById("sourceNodeName");
    const sourceNodeIdElement = document.getElementById("sourceNodeId"); // Hidden input
    const targetFlowDropdown = document.getElementById("targetFlowDropdown");
    const targetNodeDropdown = document.getElementById("targetNodeDropdown");
    const modal = document.getElementById("crossFlowModal");

    // Reset green button
    const actionBtn = modal.querySelector(".action-btn");
    if (actionBtn) {
        actionBtn.textContent = "Create";
        actionBtn.setAttribute("onclick", "createCrossFlowLink()");
    }

    // Reset grey button
    const cancelBtn = modal.querySelector(".cancel-btn");
    if (cancelBtn) {
        cancelBtn.textContent = "Cancel";
        cancelBtn.setAttribute("onclick", "closeCrossFlowModal()");
    }

    if (!sourceNodeNameElement || !sourceNodeIdElement || !targetFlowDropdown || !targetNodeDropdown || !modal) {
        console.error("❌ ERROR: One or more modal elements are missing.");
        Swal.fire({
            icon: "error",
            title: "Error",
            text: "Unable to open the cross-flow modal. Please reload the page.",
        });
        return;
    }

    // Populate source node details
    sourceNodeNameElement.textContent = node.text;
    sourceNodeIdElement.value = node.key;

    // Store the selected node's ID for later use
    currentSourceNodeId = node.key;
    currentStepId = node.step_id || window.currentParentId;



    // Clear dropdowns before fetching data
    targetFlowDropdown.innerHTML = '<option value="">Select Target Flow</option>';
    targetNodeDropdown.innerHTML = '<option value="">Select Target Node</option>';

    // Fetch child flows (target flows for cross-flow)
    fetch(`/workflow/api/child_flows?parent_id=${window.currentParentId}&order_by=order_num`)
        .then(response => response.json())
        .then(data => {

            if (!Array.isArray(data) || data.length === 0) {
                console.warn("⚠️ No child flows found.");
                Swal.fire({
                    icon: "warning",
                    title: "No Available Flows",
                    text: "No target flows are available for cross-flow.",
                });
                return;
            }

            // Populate the Target Flow dropdown
            data.forEach(flow => {
                if (!flow.id || !flow.name) {
                    console.warn("⚠️ Skipping invalid flow:", flow);
                    return;
                }

                const option = document.createElement("option");
                option.value = flow.id;
                option.textContent = flow.name;
                targetFlowDropdown.appendChild(option);
            });

        })
        .catch(err => {
            console.error("❌ ERROR fetching child flows:", err);
            Swal.fire({
                icon: "error",
                title: "Network Error",
                text: "Failed to fetch child flows. Please check your internet connection and try again.",
            });
        });

    // Attach event listener to fetch target nodes when a flow is selected
    targetFlowDropdown.addEventListener("change", function () {
        const selectedFlowId = this.value;
        targetNodeDropdown.innerHTML = '<option value="">Select Target Node</option>'; // Clear old nodes

        if (!selectedFlowId) {
            console.warn("⚠️ No flow selected. Skipping node fetch.");
            return;
        }

        console.log(`🔍 Fetching nodes for flow ID: ${selectedFlowId}`);

        fetch(`/workflow/api/flowchart?step_id=${currentStepId}&child_id=${selectedFlowId}`)
            .then(response => response.json())
            .then(nodeData => {
                console.log("🔍 API Response for Target Nodes:", nodeData);

                if (!nodeData.nodes || !Array.isArray(nodeData.nodes)) {
                    console.error("❌ ERROR: Expected an array but got:", nodeData);
                    Swal.fire({
                        icon: "error",
                        title: "Data Error",
                        text: "Invalid response for nodes. Please try again.",
                    });
                    return;
                }

                populateNodeDropdown(nodeData.nodes);
            })
            .catch(error => {
                console.error("❌ ERROR fetching nodes for target flow:", error);
                Swal.fire({
                    icon: "error",
                    title: "Network Error",
                    text: "Failed to fetch nodes for the selected flow.",
                });
            });
    });

    // Show the modal using Tailwind CSS
    modal.classList.remove("hidden");
}

function populateNodeDropdown(nodes) {
    const targetNodeDropdown = document.getElementById("targetNodeDropdown");
    if (!targetNodeDropdown) {
        console.error("❌ ERROR: Target node dropdown not found.");
        return;
    }

    nodes.forEach(node => {
        const option = document.createElement("option");
        option.value = node.key;
        option.textContent = node.text || `Node ${node.key}`;
        targetNodeDropdown.appendChild(option);
    });

    console.log("✅ Successfully populated node dropdown.");
}

async function addSubmittedNode() {
    try {
        console.log("🚀 Sending request to API to add 'Submitted' node...");

        const stepId = window.currentStepId;
        if (!stepId) {
            Swal.fire("Error", "❌ Please select a task before adding a node.", "error");
            return;
        }

        // Check if a "Submitted" node already exists
        const existingNode = diagram.model.nodeDataArray.find(node =>
            node.text === "Submitted" && node.step_id === stepId
        );

        if (existingNode) {
            Swal.fire({
                title: "Duplicate Node",
                text: "⚠️ A 'Submitted' node already exists for this step!",
                icon: "warning",
                confirmButtonText: "OK"
            });
            return;
        }

        // Define position
        const x = 100;
        const y = 100;
        const newNode = {
            name: "Submitted",
            step_id: stepId,
            loc: `${x} ${y}`,
            color: "#f08228",
            status: "Submitted"
        };

        // Send request to API
        const response = await fetch("/workflow/api/node", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newNode)
        });

        if (!response.ok) {
            console.error("❌ Error: API request failed with status", response.status);
            throw new Error(`Failed to add node (HTTP ${response.status})`);
        }

        const data = await response.json();
        console.log("✅ Successfully added 'Submitted' node:", data);

        // Ensure the new node has a real database ID
        // ✅ Use the real database ID if available, or fallback to a temporary ID
        const realNodeId = data.node_id;
        const tempId = realNodeId || Math.floor(Math.random() * -1000);

        // ✅ Add node to GoJS diagram
        diagram.model.startTransaction("Add Submitted Node");
        const addedNode = {
            key: realNodeId || tempId,
            text: "Submitted",
            loc: `${x} ${y}`,
            color: "#4CAF50",
            status: "Submitted",
            step_id: stepId,
            category: "Submitted"
        };
        diagram.model.addNodeData(addedNode);
        diagram.model.commitTransaction("Add Submitted Node");

        // ✅ Replace the temporary ID if a real one was provided
        if (realNodeId && realNodeId !== tempId) {
            console.log("🔄 Replacing temporary node ID:", tempId, "with real ID:", realNodeId);
            const nodeData = diagram.model.findNodeDataForKey(tempId);
            if (nodeData) {
                nodeData.key = realNodeId;
                diagram.model.updateTargetBindings(nodeData);
            }
        }


        // ✅ Add node to GoJS diagram
        diagram.model.startTransaction("Add Submitted Node");
        diagram.model.addNodeData(addedNode);
        diagram.model.commitTransaction("Add Submitted Node");

        // ✅ Update the node ID if the real one is available
        if (data.id) {
            diagram.model.startTransaction("Replace Temporary Node ID");
            const nodeData = diagram.model.findNodeDataForKey(tempId);
            if (nodeData) {
                nodeData.key = data.id;
                diagram.model.updateTargetBindings(nodeData);
            }
            diagram.model.commitTransaction("Replace Temporary Node ID");
        }


        // Force GoJS to Refresh the View
        setTimeout(() => {
            console.log("🔄 Manually refreshing GoJS Diagram...");
            diagram.requestUpdate();
            diagram.layoutDiagram(true);
        }, 100);

        // ✅ Success alert
        Swal.fire({
            title: "Success!",
            text: "✅ 'Submitted' node added successfully!",
            icon: "success",
            timer: 2000,
            showConfirmButton: false
        });

    } catch (error) {
        console.error("❌ Error adding node:", error);

        const errorMessage = error.message.includes("UNIQUE constraint failed")
            ? "⚠️ A 'Submitted' node already exists for this step!"
            : `❌ ${error.message}`;

        Swal.fire({
            title: "Error",
            text: errorMessage,
            icon: "error",
            confirmButtonText: "OK"
        });
    }
}

function openLinkEditModal(linkData) {

    const modal = document.getElementById("editLinkModal");
    if (!modal) {
        console.error("❌ ERROR: Edit link modal not found.");
        return;
    }

    // Pre-fill the form fields safely
    document.getElementById("parentNodeId").value = linkData?.from || "";
    document.getElementById("childNodeId").value = linkData?.to || "";
    document.getElementById("toFlowId").value = linkData?.to_flow_id || "";

    // Show the modal (Tailwind)
    modal.classList.remove("hidden");
}

function openLinkContextMenu(event, node) {
    event.preventDefault(); // Prevent default right-click menu

    const contextMenu = document.getElementById("linkContextMenu");
    if (!contextMenu) {
        console.error("❌ ERROR: Link context menu not found.");
        return;
    }

    contextMenu.style.left = `${event.pageX}px`;
    contextMenu.style.top = `${event.pageY}px`;
    contextMenu.style.display = "block";

    // Store current node globally for use in modal
    window.currentNode = node;

    // ✅ Ensure event listener is not duplicated
    document.removeEventListener("click", closeLinkContextMenu);
    document.addEventListener("click", closeLinkContextMenu, { once: true });
}

function closeLinkContextMenu() {
    const contextMenu = document.getElementById("linkContextMenu");
    if (contextMenu) contextMenu.style.display = "none";
}

function editLink() {
    if (!window.currentLinkData) {
        console.error("❌ ERROR: No link data available for editing.");
        Swal.fire({
            icon: "error",
            title: "Error",
            text: "No link selected for editing.",
        });
        return;
    }

    console.log("Editing link:", window.currentLinkData);
    openLinkEditModal(window.currentLinkData);
    closeLinkContextMenu();
}

function deleteLink(linkData) {
    if (!linkData || !linkData.from || !linkData.to) {
        console.error("❌ Invalid link data. Missing 'from' or 'to':", linkData);
        Swal.fire("Error", "Failed to delete link: Missing 'from' or 'to' node ID", "error");
        return;
    }

    Swal.fire({
        title: "Are you sure?",
        text: "This will permanently delete the link.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, delete it!"
    }).then((result) => {
        if (!result.isConfirmed) return;

        console.log(`🔗 Deleting link from ${linkData.from} to ${linkData.to}`);

        fetch("/workflow/api/delete_link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from: linkData.from, to: linkData.to })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log("✅ Link deleted successfully!");

                    // ✅ Remove from GoJS immediately
                    const linkToRemove = diagram.findLinkForData(linkData);
                    if (linkToRemove) {
                        diagram.model.removeLinkData(linkToRemove.data);
                    }

                    Swal.fire({
                        title: "Deleted!",
                        text: "Link has been removed.",
                        icon: "success",
                        timer: 2000,
                        showConfirmButton: false
                    });

                } else {
                    console.error("❌ Error deleting link:", data.error);
                    Swal.fire({
                        title: "Error",
                        text: `Failed to delete link: ${data.error}`,
                        icon: "error"
                    });
                }
            })
            .catch(err => {
                console.error("❌ Error communicating with the server:", err);
                Swal.fire({
                    title: "Error",
                    text: "An error occurred while deleting the link. Please try again.",
                    icon: "error"
                });
            });
    });
}

function saveLinkEdits() {
    if (!window.currentLinkData) {
        console.error("❌ ERROR: No link data to edit.");
        Swal.fire({
            icon: "error",
            title: "Error",
            text: "No link data available for saving.",
        });
        return;
    }

    const parentNodeId = document.getElementById("parentNodeId").value;
    const childNodeId = document.getElementById("childNodeId").value;
    const toFlowId = document.getElementById("toFlowId").value || null;

    fetch("/workflow/api/update_link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            linkId: window.currentLinkData.id,
            parentNodeId,
            childNodeId,
            toFlowId
        })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} - Failed to update link`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                console.log("✅ Link updated successfully.");

                Swal.fire({
                    title: "Success!",
                    text: "Link updated successfully.",
                    icon: "success",
                    timer: 2000,
                    showConfirmButton: false
                });

                // ✅ Reload the diagram
                loadFlowchart(selectedStepId);
            } else {
                Swal.fire({
                    title: "Error",
                    text: `Failed to update link: ${data.error}`,
                    icon: "error"
                });
            }
        })
        .catch(err => {
            console.error("❌ Error updating link:", err);
            Swal.fire({
                icon: "error",
                title: "Update Failed",
                text: "An error occurred while updating the link.",
            });
        });
}

function updateLinkedWorkflows(crossflowData, newStatus) {
    if (!crossflowData || !Array.isArray(crossflowData.links) || !Array.isArray(crossflowData.nodes)) {
        console.warn("❌ ERROR: Invalid crossflow data structure.", crossflowData);
        return;
    }

    crossflowData.links.forEach(link => {
        const targetNode = crossflowData.nodes.find(node => node.key === link.to);
        if (!targetNode) {
            console.warn(`⚠️ Target node for link ${link.to} not found.`);
            return;
        }

        const dropdown = document.querySelector(`select[data-workflow-id="${targetNode.key}"]`);
        if (dropdown) {
            dropdown.value = newStatus;
            console.log(`✅ Updated linked workflow ${targetNode.key} to ${newStatus}`);
        } else {
            console.warn(`⚠️ Dropdown for workflow ID ${targetNode.key} not found.`);
        }
    });

    // ✅ Show feedback when statuses are updated
    Swal.fire({
        icon: "success",
        title: "Crossflow Updated",
        text: "Linked workflows have been updated successfully!",
        timer: 2000,
        showConfirmButton: false
    });
}

function populateCrossflowEditor(crossflows) {
    const container = document.getElementById("editCrossFlowsContainer");
    container.innerHTML = "";

    crossflows.forEach((cf, index) => {
        const wrapper = document.createElement("div");
        wrapper.className = "border p-3 rounded bg-gray-800";
        wrapper.dataset.cfIndex = index;

        wrapper.innerHTML = `
        <label class="block text-white text-sm mb-1">Target Flow</label>
        <select class="cf-flow w-full border rounded p-2 text-black" data-cf-index="${index}"></select>
  
        <label class="block text-white text-sm mt-3 mb-1">Target Node</label>
        <select class="cf-node w-full border rounded p-2 text-black" data-cf-index="${index}"></select>
  
        <button type="button" class="remove-crossflow mt-2 text-red-400 text-sm underline">🗑 Remove</button>
      `;

        container.appendChild(wrapper);

        // You'd populate options dynamically here in real use:
        // ⬇ Populate Flow + Node dropdowns
        const flowSelect = wrapper.querySelector(".cf-flow");
        const nodeSelect = wrapper.querySelector(".cf-node");

        // Load sibling flows
        fetch(`/workflow/api/child_flows?parent_id=${window.currentParentId}`)
            .then(res => res.json())
            .then(flows => {
                flowSelect.innerHTML = "";
                flows.forEach(flow => {
                    const opt = document.createElement("option");
                    opt.value = flow.id;
                    opt.textContent = flow.name;
                    if (flow.id == cf.target_flow_id) opt.selected = true;
                    flowSelect.appendChild(opt);
                });

                // If editing, preload target node options
                if (cf.target_flow_id) {
                    loadNodeOptions(cf.target_flow_id, nodeSelect, cf.target_node_id);
                }
            });

        // On change, reload corresponding nodes
        flowSelect.addEventListener("change", () => {
            loadNodeOptions(flowSelect.value, nodeSelect);
        });

    });

    document.querySelectorAll(".remove-crossflow").forEach(btn => {
        btn.addEventListener("click", e => {
            const idx = e.target.closest("div[data-cf-index]").dataset.cfIndex;
            const newCrossflows = crossflows.filter((_, i) => i !== parseInt(idx));
            populateCrossflowEditor(newCrossflows);
        });
    });
}

// ===============================================================================================================
// MODAL LOGIC AND UI EVENTS
// ===============================================================================================================

function openAddOverallFlowModal() {
    console.log("✅ Opening 'Create Overall Flow' modal.");

    // Reset modal inputs
    document.getElementById("overallFlowName").value = "";
    document.getElementById("overallFlowDescription").value = "";
    document.getElementById("overallFlowPermission").value = "1";

    // Reset modal title and button text
    document.getElementById("addOverallFlowModalLabel").textContent = "Add Overall Flow";
    const submitButton = document.getElementById("submitOverallFlow");
    submitButton.textContent = "Create";

    // ✅ Use helper for event binding
    replaceAndBind("submitOverallFlow", createOverallFlow);

    // Show modal
    document.getElementById("addOverallFlowModal").classList.remove("hidden");
}

function openAddIndividualFlowModal() {

    document.getElementById("newFlowName").value = "";
    document.getElementById("templateFlowName").value = "";
    document.getElementById("templateSelection").value = "";
    document.getElementById("individualFlowPermissionNew").value = "1";
    document.getElementById("individualFlowPermissionTemplate").value = "1";

    document.getElementById("addIndividualFlowModalLabel").textContent = "Create Individual Flow";

    const createButton = document.getElementById("createIndividualFlowButton");
    const saveButton = document.getElementById("submitIndividualFlow");

    createButton.classList.remove("hidden");
    saveButton.classList.add("hidden");

    createButton.textContent = "Create";

    // ✅ Use helper to bind click event
    replaceAndBind("createIndividualFlowButton", createIndividualFlow);

    const modal = document.getElementById("addIndividualFlowModal");
    modal.classList.remove("opacity-0", "pointer-events-none", "hidden");

    syncFlowName();
}

function closeOverallFlowModal() {
    document.getElementById("addOverallFlowModal").classList.add("hidden");

    // Clear modal fields to prevent leftover data from previous edits
    document.getElementById("overallFlowName").value = "";
    document.getElementById("overallFlowDescription").value = "";
    document.getElementById("overallFlowPermission").value = "1";
}

function syncFlowName() {
    const newFlowInput = document.getElementById("newFlowName");
    const templateFlowInput = document.getElementById("templateFlowName");

    if (!newFlowInput || !templateFlowInput) {
        console.error("❌ ERROR: Flow name input fields are missing!");
        return;
    }

    // ✅ Sync input values between tabs
    newFlowInput.addEventListener("input", () => {
        templateFlowInput.value = newFlowInput.value;
    });

    templateFlowInput.addEventListener("input", () => {
        newFlowInput.value = templateFlowInput.value;
    });
}

function switchToNewFlowTab() {
    activeTab = "new-flow";

    document.getElementById("newFlowTab").classList.add("text-white", "font-semibold", "border-b-2", "border-white");
    document.getElementById("templateFlowTab").classList.remove("border-b-2", "border-blue-500", "text-gray-700", "font-semibold");

    document.getElementById("newFlowContent").classList.remove("hidden");
    document.getElementById("templateFlowContent").classList.add("hidden");
}

function switchToTemplateFlowTab() {
    activeTab = "template-flow";

    document.getElementById("templateFlowTab").classList.add("text-white", "font-semibold", "border-b-2", "border-white");
    document.getElementById("newFlowTab").classList.remove("border-b-2", "border-blue-500", "text-gray-700", "font-semibold");

    document.getElementById("templateFlowContent").classList.remove("hidden");
    document.getElementById("newFlowContent").classList.add("hidden");
}

function setupWorkflowModal() {
    const showWorkflowModalButton = document.getElementById('showWorkflowModal');
    if (showWorkflowModalButton) {
        showWorkflowModalButton.addEventListener('click', () => {
            document.getElementById('workflowModal').classList.remove("hidden");
            renderWorkflowTesting();
        });

        // ✅ Replace Bootstrap event with Tailwind-compatible solution
        document.getElementById('workflowModal').addEventListener('transitionend', (event) => {
            if (event.target.classList.contains('hidden')) {
                console.log("Workflow modal closed. Refreshing the page...");
                location.reload();
            }
        });
    } else {
        console.error("Workflow modal button not found in the DOM.");
    }
}

function openUnlockModal(onSuccess) {
    const modal = document.getElementById("unlockModal");
    const passwordInput = document.getElementById("adminPasswordInput");
    const errorMessage = document.getElementById("unlockError");

    modal.classList.remove("hidden");
    passwordInput.value = "";
    errorMessage.classList.add("hidden");
    passwordInput.focus();

    const confirm = document.getElementById("confirmUnlock");
    const cancel = document.getElementById("cancelUnlock");

    const close = () => modal.classList.add("hidden");

    cancel.onclick = () => close();

    confirm.onclick = () => {
        const password = passwordInput.value;

        // 🔒 Verify password with backend
        fetch("/workflow/api/verify-admin-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password })
        })
            .then(res => {
                if (!res.ok) throw new Error("Server error");
                return res.json();
            })
            .then(data => {
                if (data.success) {
                    close();
                    onSuccess();
                } else {
                    errorMessage.classList.remove("hidden");
                }
            })
            .catch(err => {
                console.error("❌ Error verifying password:", err);
                errorMessage.textContent = "Server error. Try again later.";
                errorMessage.classList.remove("hidden");
            });

    };
}

function closeAddIndividualFlowModal() {
    const modal = document.getElementById("addIndividualFlowModal");
    modal.classList.add("opacity-0", "pointer-events-none");
    modal.classList.add("hidden");
}

function closeCrossFlowModal() {
    const modal = document.getElementById("crossFlowModal");
    modal.classList.add("hidden");

    // Reset button back to "Create"
    const btn = modal.querySelector("button");
    if (btn) {
        btn.textContent = "Create";
        btn.setAttribute("onclick", "createCrossFlowLink()");
    }
}


function closeLinkEditModal() {
    document.getElementById("editLinkModal").classList.add("hidden");
}

document.getElementById("openCreateFlowButton").addEventListener("click", function () {
    const modal = document.getElementById("addOverallFlowModal");
    if (modal) {
        modal.classList.remove("hidden", "opacity-0", "pointer-events-none");
        modal.classList.add("opacity-100", "pointer-events-auto");
    }
});


// ===============================================================================================================
// NODE MANAGEMENT
// ===============================================================================================================

document.getElementById("editNodeForm").addEventListener("submit", async (event) => {
    event.preventDefault();  // Prevents page refresh

    const nodeId = document.getElementById("editNodeId").value;
    const nodeName = document.getElementById("editNodeName").value.trim();
    const nodeColor = document.getElementById("editNodeColor").value;
    const nodeCompletion = document.getElementById("editNodeCompletion").value;

    if (!nodeId || !nodeName) {
        Swal.fire("Missing Data", "Please provide a valid node ID and name.", "error");
        return;
    }

    try {
        const response = await fetch(`/workflow/api/node/${nodeId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                text: nodeName,
                color: nodeColor,
                completion_percentage: parseInt(nodeCompletion, 10)
            })
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(data.error || "Failed to update node.");
        }

        Swal.fire("Success", "Node updated successfully!", "success");

        // Close the modal after successful update
        closeEditNodeModal();

        // Refresh the diagram to reflect the changes
        loadDiagram();

    } catch (error) {
        console.error("❌ Error updating node:", error);
        Swal.fire("Update Failed", error.message, "error");
    }
});


function openAddNodeModal() {
    if (window.isCurrentFlowLocked) {
        Swal.fire("🔒 Locked", "You cannot add a node to a locked flow.", "warning");
        return;
    }

    // Get modal elements
    const modal = document.getElementById('addNodeModal');
    const nameField = document.getElementById('nodeName');
    const colorField = document.getElementById('nodeColor');
    const completionField = document.getElementById('nodeCompletion');

    if (!modal || !nameField || !colorField || !completionField) {
        console.error("❌ ERROR: Missing modal or input fields.");
        return;
    }

    // ✅ Reset fields to default values
    nameField.value = '';
    colorField.value = '#ffffff';
    completionField.value = 0;

    // Show modal
    modal.classList.remove("hidden");
}

function closeAddNodeModal() {
    const modal = document.getElementById('addNodeModal');
    if (modal) {
        modal.classList.add("hidden"); // Hide modal using Tailwind
    } else {
        console.error("❌ ERROR: #addNodeModal not found.");
    }
}

async function submitAddNodeForm() {
    if (window.isCurrentFlowLocked) {
        Swal.fire("🔒 Locked", "You cannot add a submitted node to a locked flow.", "warning");
        return;
    }
    const name = document.getElementById('nodeName').value;
    const color = document.getElementById('nodeColor').value;
    const completion_percentage = parseInt(document.getElementById('nodeCompletion').value, 10) || 0;

    if (!window.currentStepId) {
        Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Please select a task before adding a node!',
        });
        return;
    }

    if (!name) {
        Swal.fire({
            icon: 'warning',
            title: 'Missing Node Name',
            text: 'Please enter a node name before proceeding!',
        });
        return;
    }

    const tempId = Date.now() * -1;
    const newNode = {
        name,
        step_id: window.currentStepId,
        position: "0 0",
        color,
        completion_percentage,
    };

    try {
        const response = await fetch('/workflow/api/node', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newNode),
        });

        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || "Failed to create node");

        const nodeId = data.node_id || data.id;
        if (!nodeId) {
            console.error("❌ ERROR: Invalid node ID:", data);
            return;
        }

        diagram.model.addNodeData({
            key: nodeId,
            text: name,
            loc: "0 0",
            color,
            completion_percentage
        });

        Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: 'Node added successfully!',
            timer: 2000,
            showConfirmButton: false
        });

        document.getElementById('addNodeModal').classList.add("hidden");

        // ✅ Optionally reposition only the new node manually, or defer until next full layout

    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'An error occurred while adding the node.',
        });
        console.error("❌ Error adding node:", err);
    }
}


function setCurrentStepId(stepId) {
    const stepInput = document.getElementById("currentStepId");
    if (stepInput) {
        stepInput.value = stepId;
        console.log("✅ Current Step ID set to:", stepId);
        window.currentStepId = stepId;  // ✅ Also set the global variable for safety
    } else {
        console.error("❌ Could not find currentStepId input");
    }
}

async function submitEditNodeForm() {
    const nodeId = parseInt(document.getElementById("editNodeId").value);
    const name = document.getElementById("editNodeName").value.trim();
    const color = document.getElementById("editNodeColor").value;
    const completion = parseInt(document.getElementById("editNodeCompletion").value, 10) || 0;
    // ✅ Make absolutely sure this is the correct step ID
    const stepId = parseInt(document.getElementById("currentStepId")?.value) || window.currentStepId || 0;

    if (!stepId || isNaN(stepId)) {
        console.error("❌ Missing or invalid step_id, cannot update node");
        Swal.fire("Error", "Missing or invalid step ID. Please try again.", "error");
        return;
    }


    // ✅ Collect all crossflows
    const crossflows = [];
    const seenCrossflows = new Set();

    document.querySelectorAll(".cf-flow").forEach((flowSelect, index) => {
        const nodeSelect = document.querySelector(`.cf-node[data-cf-index='${index}']`);
        const target_flow_id = parseInt(flowSelect.value);
        const target_node_id = parseInt(nodeSelect?.value);

        if (!target_flow_id || !target_node_id) return;

        const key = `${target_flow_id}-${target_node_id}`;
        if (!seenCrossflows.has(key)) {
            crossflows.push({
                target_flow_id,
                target_node_id,
                step_id: stepId
            });
            seenCrossflows.add(key);
        }
    });

    // ✅ Build payload
    const payload = {
        name,
        color,
        completion_percentage: completion,
        position: "0 0",  // or use node position if available
        step_id: stepId,
        crossflows: crossflows.length > 0 ? crossflows : undefined
    };

    // ✅ Handle crossflow removal
    if (window.removeCrossflow === true) {
        payload.crossflow = { remove: true };
        delete window.removeCrossflow;
    }

    console.log("🚀 Sending node update:", JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(`/workflow/api/node/${nodeId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            console.log("✅ Node updated successfully:", data);
            // ✅ Close modal
            document.getElementById("editNodeModal").classList.add("hidden");
            // ✅ Reload flowchart
            await initializeDiagram();
        } else {
            console.error("❌ Error updating node:", data.error);
            Swal.fire("Error", data.error || "Failed to update node. Try again.", "error");
        }

    } catch (err) {
        console.error("❌ Failed to update node:", err);
        Swal.fire({
            icon: "error",
            title: "Server Error",
            text: "Unable to update node. Try again later."
        });
    }
}


function confirmDeletion(nodeKey, callback) {
    Swal.fire({
        title: "Are you sure?",
        text: "This action cannot be undone.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, delete it!"
    }).then((result) => {
        if (result.isConfirmed) {
            callback(nodeKey);
        }
    });
}

function deleteNode(nodeKey) {
    confirmDeletion(nodeKey, (nodeKey) => {

        fetch(`/workflow/api/node/${nodeKey}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    console.error("❌ Error deleting node:", data.error);
                    Swal.fire("Error", `Failed to delete node: ${data.error}`, "error");
                    return;
                }

                console.log("✅ Node deleted successfully!");

                // ✅ Ensure transaction safety when modifying the diagram
                if (diagram) {
                    diagram.startTransaction("delete node & links");

                    // ✅ Remove any links connected to this node
                    diagram.links.each(link => {
                        if (link.data.from === nodeKey || link.data.to === nodeKey) {
                            diagram.model.removeLinkData(link.data);
                        }
                    });

                    // ✅ Remove the node from the GoJS model
                    const nodeToRemove = diagram.findNodeForKey(nodeKey);
                    if (nodeToRemove) {
                        diagram.model.removeNodeData(nodeToRemove.data);
                    }

                    diagram.commitTransaction("delete node & links");
                }

                Swal.fire("Deleted!", "Node and its links have been deleted.", "success");
            })
            .catch(err => {
                console.error("❌ Error communicating with the server:", err);
                Swal.fire("Error", "An error occurred while deleting the node. Please try again.", "error");
            });
    });
}

function deleteSelectedNode() {
    if (window.isCurrentFlowLocked) {
        Swal.fire("🔒 Locked", "You cannot delete nodes from a locked flow.", "warning");
        return;
    }
    if (!diagram) {
        console.error("❌ Diagram is not initialized.");
        Swal.fire("Error", "Diagram is not available. Cannot delete node.", "error");
        return;
    }

    const selectedNode = diagram.selection.first();
    if (!selectedNode || !(selectedNode instanceof go.Node)) {
        Swal.fire("Warning", "Please select a node to delete.", "warning");
        return;
    }

    const nodeId = selectedNode.data.key;

    confirmDeletion(nodeId, (nodeId) => {
        fetch(`/workflow/api/node/${nodeId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    console.error("❌ Error deleting node:", data.error);
                    Swal.fire("Error", `Failed to delete node: ${data.error}`, "error");
                    return;
                }

                // ✅ Reload the flowchart after deletion only if `currentStepId` is available
                if (window.currentStepId) {
                    loadFlowchart(window.currentStepId, window.currentChildId);
                }

                Swal.fire("Deleted!", "Node has been deleted.", "success");
            })
            .catch(error => {
                console.error("❌ Error communicating with server:", error);
                Swal.fire("Error", "An error occurred while deleting the node. Please try again.", "error");
            });
    });
}

// ===============================================================================================================
// NODE DOUBLE CLICK HANDLER (PRESERVING CROSSFLOW LOGIC)
// ===============================================================================================================

function openEditNodeModal(nodeData) {
    if (!nodeData) {
        console.error("❌ nodeData not provided!");
        return;
    }

    console.log("🛠️ Opening Edit Node Modal for node:", nodeData);

    const modal = document.getElementById("editNodeModal");
    const nodeNameInput = document.getElementById("editNodeName");
    const nodeColorInput = document.getElementById("editNodeColor");
    const nodeCompletionInput = document.getElementById("editNodeCompletion");
    const nodeIdHiddenInput = document.getElementById("editNodeId");
    const stepIdHiddenInput = document.getElementById("editNodeStepId");

    if (!modal || !nodeNameInput || !nodeColorInput || !nodeCompletionInput || !nodeIdHiddenInput || !stepIdHiddenInput) {
        console.error("❌ ERROR: Edit node modal elements not found.");
        return;
    }

    // Preserve the correct node key
    const nodeKey = nodeData.key;
    nodeIdHiddenInput.value = nodeKey;

    // Populate the form fields with the current node data
    nodeNameInput.value = nodeData.text || nodeData.name || "";
    nodeColorInput.value = nodeData.color || "#ffffff";
    nodeCompletionInput.value = nodeData.completion_percentage || 0;
    stepIdHiddenInput.value = nodeData.step_id || "";

    console.log("🔑 Editing Node Key:", nodeKey);

    // Verify the node exists in the diagram model before editing
    const nodeToUpdate = diagram.model.findNodeDataForKey(nodeKey);
    if (!nodeToUpdate) {
        console.error("❌ Node not found in the model. Key:", nodeKey);
        Swal.fire("Error", "Node not found in the model.", "error");
        return;
    }

    console.log("✅ Node found in model:", nodeToUpdate);

    // Attach event listeners for save button
    const saveButton = document.getElementById("editNodeSaveButton");
    if (saveButton) {
        saveButton.onclick = function (event) {
            event.preventDefault();

            // Prepare the payload for backend update
            const updatedNode = {
                id: nodeKey,  // Use the GoJS key as the database ID
                key: nodeKey,
                name: nodeNameInput.value.trim(),  // Use 'name' for backend update
                color: nodeColorInput.value,
                completion_percentage: parseInt(nodeCompletionInput.value, 10) || 0,
                step_id: stepIdHiddenInput.value.trim()
            };

            // Ensure all required fields are present
            if (!updatedNode.name || !updatedNode.color || updatedNode.completion_percentage === null || !updatedNode.step_id) {
                console.error("❌ Missing required fields for node update:", updatedNode);
                Swal.fire("Error", "Missing required fields for node update.", "error");
                return;
            }

            console.log("📦 Payload for Node Update:", updatedNode);

            // Send the update to the backend
            fetch(`/workflow/api/node/${nodeKey}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(updatedNode)
            }).then(response => response.json())
                .then(data => {
                    if (data.success) {
                        console.log("✅ Node updated successfully:", updatedNode);

                        // Update the node in the GoJS model without removing it
                        diagram.model.startTransaction("Update Node");
                        Object.assign(nodeToUpdate, {
                            text: updatedNode.name,  // Correct the name mapping for GoJS
                            color: updatedNode.color,
                            completion_percentage: updatedNode.completion_percentage
                        });
                        diagram.model.updateTargetBindings(nodeToUpdate);
                        diagram.model.commitTransaction("Update Node");

                    } else {
                        console.error("❌ Node update failed:", data);
                        Swal.fire("Error", "Failed to update node.", "error");
                    }
                }).catch(err => {
                    console.error("❌ Error updating node:", err);
                    Swal.fire("Error", "Failed to update node.", "error");
                });

            // Clean up modal state before closing
            modal.classList.add("hidden");
            nodeIdHiddenInput.value = "";
            nodeNameInput.value = "";
            nodeColorInput.value = "#ffffff";
            nodeCompletionInput.value = 0;
            stepIdHiddenInput.value = "";
        };
    }

    // Attach close event for the modal to fully reset its state
    const cancelButton = modal.querySelector("button[onclick='closeEditNodeModal()']");
    if (cancelButton) {
        cancelButton.onclick = () => {
            modal.classList.add("hidden");
            nodeIdHiddenInput.value = "";
            nodeNameInput.value = "";
            nodeColorInput.value = "#ffffff";
            nodeCompletionInput.value = 0;
            stepIdHiddenInput.value = "";
            console.log("❌ Node editing canceled.");
        };
    }


    // --- Handle Crossflows ---
    const crossflowSection = document.getElementById("editCrossFlowsSection");
    const crossflowContainer = document.getElementById("editCrossFlowsContainer");

    // Clear out old rows
    crossflowContainer.innerHTML = "";

    // Fetch crossflows for this node
    fetch(`/workflow/api/crossflows?node_id=${nodeData.key}`)
        .then(res => res.json())
        .then(data => {
            console.log("🌉 Raw crossflow API response:", data);

            const crossflows = data.crossflows || [];

            // Skip filtering for now — just show what comes back
            if (crossflows.length > 0) {
                crossflowSection.classList.remove("hidden");
                crossflowContainer.innerHTML = ""; // clear old content

                crossflows.forEach(cf => {
                    const row = document.createElement("div");
                    row.className = "flex items-center justify-between bg-red-900 p-2 rounded";

                    row.innerHTML = `
                        <span class="text-sm flex-1">
                            ${cf.source_node_name} → <strong>${cf.target_flow_name}</strong> / ${cf.target_node_name}
                        </span>
                        <div class="space-x-2">
                            <button type="button"
                            class="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-xs"
                            onclick="openEditCrossFlowModal(${cf.parent_node_id}, ${cf.child_node_id}, ${cf.to_flow_id}, '${cf.source_node_name}')">
                            Edit
                            </button>
                            <button type="button"
                            class="bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded text-xs"
                            onclick="deleteCrossFlow(${cf.parent_node_id}, ${cf.child_node_id}, ${cf.to_flow_id})">
                            Delete
                            </button>
                        </div>
                        `;


                crossflowContainer.appendChild(row);
            });

            } else {
                crossflowSection.classList.add("hidden");
            }
        })
        .catch(err => {
            console.error("❌ Error fetching crossflows:", err);
            crossflowSection.classList.add("hidden");
        });



    // Show the modal
    modal.classList.remove("hidden");

    const addBtn = document.getElementById("addCrossflowBtn");
    if (addBtn) {
        addBtn.onclick = () => {
            console.log("➕ Add Crossflow button clicked!");

            const node = {
                text: document.getElementById("editNodeName")?.value || "",
                key: parseInt(document.getElementById("editNodeId")?.value || "0", 10),
                step_id: parseInt(document.getElementById("editNodeStepId")?.value || "0", 10)
            };

            console.log("📦 Node for new crossflow:", node);

            openCreateCrossFlowModal(node);
        };
    }
}






function updateTargetNodeDropdown(targetFlowId, targetNodeDropdown, selectedNodeId) {
    if (!targetFlowId) {
        console.warn("⚠️ No Target Flow ID provided.");
        return;
    }

    fetch(`/workflow/api/child_nodes?step_id=${encodeURIComponent(targetFlowId)}`)
        .then(response => response.json())
        .then(nodeData => {
            console.log("📢 API Response for Target Nodes:", nodeData);

            targetNodeDropdown.innerHTML = ""; // ✅ Clear dropdown before appending new items

            if (!nodeData.length) {
                console.warn("⚠️ No target nodes returned! Check backend.");
                return;
            }

            // ✅ Populate the dropdown
            nodeData.forEach(targetNode => {
                const option = document.createElement("option");
                option.value = targetNode.id;
                option.textContent = targetNode.name;

                // ✅ Auto-select the correct Target Node
                if (targetNode.id == selectedNodeId) {
                    console.log(`✅ Pre-selecting target node: ${targetNode.name}`);
                    option.selected = true;
                }

                targetNodeDropdown.appendChild(option);
            });

            // ✅ Ensure dropdown is visible & enabled
            targetNodeDropdown.classList.remove("hidden");
            targetNodeDropdown.disabled = false;
        })
        .catch(error => console.error("❌ Error fetching target nodes:", error));
}

function closeEditNodeModal() {
    const modal = document.getElementById("editNodeModal");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.add("opacity-0");
        modal.classList.add("pointer-events-none");

        // ✅ Clear the form fields to avoid leftover data
        document.getElementById("editNodeId").value = "";
        document.getElementById("editNodeName").value = "";
        document.getElementById("editNodeColor").value = "#ffffff";
        document.getElementById("editNodeCompletion").value = "";
    }
}


function loadNodeOptions(flowId, selectEl, selectedId = null) {
    console.log("Loading nodes for flowId:", flowId, "Selected ID:", selectedId);

    fetch(`/workflow/api/flowchart?step_id=${window.currentParentId}&child_id=${flowId}`)
        .then(res => res.json())
        .then(data => {
            console.log("Returned nodes:", data.nodes);

            selectEl.innerHTML = "";
            data.nodes.forEach(node => {
                const opt = document.createElement("option");
                opt.value = node.key;
                opt.textContent = node.text || `Node ${node.key}`;
                if (selectedId && node.key == selectedId) opt.selected = true;
                selectEl.appendChild(opt);
            });
        });
}



// ===============================================================================================================
// WORKFLOW TESTING
// ===============================================================================================================

function loadEntireWorkflow() {
    const currentFlowId = selectedStepId;
    if (!currentFlowId) {
        Swal.fire({
            icon: "warning",
            title: "Select a Flow",
            text: "Please select a flow to test.",
        });
        return;
    }

    // Fetch the parent ID for the current flow
    fetch(`/workflow/api/get_parent_id?current_id=${currentFlowId}`)
        .then(response => response.json())
        .then(parentData => {
            if (!parentData || !parentData.parent_id) {
                Swal.fire({
                    icon: "error",
                    title: "Parent Not Found",
                    text: "Could not find the parent workflow for the selected task.",
                });
                return;
            }

            const parentId = parentData.parent_id;

            return fetch(`/workflow/api/entire_workflow?parent_id=${parentId}`);
        })
        .then(response => response.json())
        .then(workflows => {

            const workflowTestingContainer = document.getElementById('workflowTestingContainer');
            if (!workflowTestingContainer) {
                console.error("Workflow Testing container not found in the DOM.");
                return;
            }

            // Clear the container
            workflowTestingContainer.innerHTML = '';

            if (!workflows || workflows.length === 0) {
                workflowTestingContainer.innerHTML = '<p>No workflows found for testing.</p>';
                return;
            }

            // Create a flexbox container for workflows
            const flexContainer = document.createElement('div');
            flexContainer.classList.add('flex', 'flex-wrap', 'gap-2');

            workflows.forEach(workflow => {

                const flowName =
                    workflow?.child?.name ||
                    workflow?.name ||
                    "Unnamed Flow";

                const flowCard = document.createElement('div');
                flowCard.classList.add(
                    'border', 'border-gray-300', 'rounded-lg', 'p-3', 'text-center', 'bg-gray-100', 'mb-6'
                );

                // ✅ 1. Add the flow name above the diagram
                const flowTitle = document.createElement('h5');
                flowTitle.textContent = flowName;
                flowTitle.classList.add('text-lg', 'font-semibold', 'text-black', 'mb-2');
                flowCard.appendChild(flowTitle);

                // ✅ 2. Add GoJS diagram container
                const diagramDiv = document.createElement('div');
                diagramDiv.style.width = "100%";
                diagramDiv.style.height = "400px";
                diagramDiv.style.background = "#2d3748";
                flowCard.appendChild(diagramDiv);

                // ✅ 3. Render diagram
                initOverviewDiagram(diagramDiv, workflow.child);

                // ✅ 4. Add dropdown if available
                if (workflow.nodes && workflow.nodes.length > 0) {
                    const dropdown = document.createElement('select');
                    dropdown.classList.add('w-full', 'border', 'rounded-lg', 'p-2', 'bg-white', 'text-black', 'mt-2');

                    workflow.nodes.forEach(node => {
                        const option = document.createElement('option');
                        option.value = node.key;
                        option.textContent = node.text;
                        option.style.backgroundColor = node.color || '#ffffff';
                        option.style.color = '#000';
                        dropdown.appendChild(option);
                    });

                    flowCard.appendChild(dropdown);
                } else {
                    const noNodesMsg = document.createElement('p');
                    noNodesMsg.textContent = "No nodes available.";
                    flowCard.appendChild(noNodesMsg);
                }

                flexContainer.appendChild(flowCard);
            });


            workflowTestingContainer.appendChild(flexContainer);

            // ✅ Use Tailwind to show the modal
            document.getElementById('workflowModal').classList.remove('hidden');
        })
        .catch(error => {
            console.error("Error loading workflows:", error);
            Swal.fire({
                icon: "error",
                title: "Load Failed",
                text: "An error occurred while loading workflows. Please try again.",
            });
        });
}

function renderWorkflowTesting() {
    console.log("Selected Task ID:", selectedStepId);
    console.log("Rendering Workflow Testing...");

    const currentFlowId = selectedStepId;
    if (!currentFlowId) {
        console.error("No flow selected for testing.");
        alert("Please select a flow to test.");
        return;
    }

    // Fetch the parent ID for the current flow
    fetch(`/workflow/api/get_parent_id?current_id=${currentFlowId}`)
        .then(response => response.json())
        .then(parentData => {
            if (!parentData || !parentData.parent_id) {
                console.error("Parent ID not found for the selected task.");
                alert("Could not find the parent workflow for the selected task.");
                return;
            }

            const parentId = parentData.parent_id;
            console.log("Parent ID:", parentId);

            // Fetch children workflows (flows under the parent)
            return fetch(`/workflow/api/child_flows?parent_id=${parentId}`);
        })
        .then(response => response.json())
        .then(children => {
            console.log("Individual Flows (Children) returned:", children);

            const workflowTestingContainer = document.getElementById('workflowTestingContainer');
            if (!workflowTestingContainer) {
                console.error("Workflow Testing container not found in the DOM.");
                return;
            }

            // Clear the container
            workflowTestingContainer.innerHTML = '';

            if (!children || children.length === 0) {
                console.warn("No individual flows found for the selected parent.");
                workflowTestingContainer.innerHTML = '<p>No Individual Flows Available</p>';
                return;
            }

            // Fetch nodes for each child workflow
            const nodeFetches = children.map(child =>
                fetch(`/workflow/api/nodes?workflow_id=${child.id}`)
                    .then(response => response.json())
                    .then(nodes => {
                        console.log(`Nodes fetched for workflow "${child.name}" (ID: ${child.id}):`, nodes);
                        child.nodes = nodes || []; // Attach nodes to the child
                        return child;
                    })
                    .catch(error => {
                        console.error(`Error fetching nodes for workflow "${child.name}" (ID: ${child.id}):`, error);
                        child.nodes = []; // Gracefully handle missing nodes
                        return child;
                    })
            );

            // Wait for all node fetches to complete
            return Promise.all(nodeFetches);
        })
        .then(workflowsWithNodes => {
            console.log("Workflows with nodes after fetching:", workflowsWithNodes);

            const workflowTestingContainer = document.getElementById('workflowTestingContainer');

            // Create a flexbox container for side-by-side layout
            const flexContainer = document.createElement('div');
            flexContainer.style.display = 'flex';
            flexContainer.style.flexWrap = 'wrap';
            flexContainer.style.gap = '10px'; // Space between workflows

            workflowsWithNodes.forEach(flow => {
                console.log("Rendering workflow:", flow);

                const flowCard = document.createElement('div');
                flowCard.className = 'workflow-testing-flow';
                flowCard.style.border = '1px solid #ccc';
                flowCard.style.borderRadius = '5px';
                flowCard.style.padding = '10px';
                flowCard.style.minWidth = '150px';
                flowCard.style.textAlign = 'center';
                flowCard.style.backgroundColor = '#f9f9f9'; // Default background color

                // Title
                const flowTitle = document.createElement('h5');
                flowTitle.textContent = flow.name || 'Unnamed Workflow';
                flowTitle.style.marginBottom = '10px';
                flowTitle.style.color = '#000'; // Ensure text is visible
                flowCard.appendChild(flowTitle);

                if (flow.nodes && flow.nodes.length > 0) {
                    console.log(`Rendering nodes for flow "${flow.name}":`, flow.nodes);

                    // Dropdown for the flow
                    const flowDropdown = document.createElement('select');
                    flowDropdown.className = 'form-control';
                    flowDropdown.style.width = '100%';
                    flowDropdown.style.padding = '5px';
                    flowDropdown.setAttribute('data-flow-id', flow.id); // For crossflow reference

                    // Add an event listener to dynamically change the dropdown's background color
                    flowDropdown.addEventListener('change', function () {
                        const selectedOption = flowDropdown.options[flowDropdown.selectedIndex];
                        flowDropdown.style.backgroundColor = selectedOption.style.backgroundColor;

                        // Call the crossflow handler function
                        handleCrossflows(workflowsWithNodes, flow, selectedOption.value);
                    });

                    // Populate dropdown options from nodes
                    flow.nodes.forEach(node => {
                        console.log("Node being added to dropdown:", node); // Debugging log for each node
                        const option = document.createElement('option');
                        option.value = node.key; // Use the key for crossflow matching
                        option.textContent = node.name || `Node ${node.key}`;
                        option.style.backgroundColor = node.color || '#ffffff'; // Apply node color
                        option.style.color = '#000'; // Ensure text visibility
                        flowDropdown.appendChild(option);
                    });

                    // Set initial dropdown background to match the first option
                    if (flowDropdown.options.length > 0) {
                        flowDropdown.style.backgroundColor = flowDropdown.options[0].style.backgroundColor;
                    }

                    flowCard.appendChild(flowDropdown);
                } else {
                    const noNodesMessage = document.createElement('p');
                    noNodesMessage.textContent = 'No nodes available for this workflow.';
                    noNodesMessage.style.color = '#888';
                    flowCard.appendChild(noNodesMessage);
                }

                // Append the workflow card to the flex container
                flexContainer.appendChild(flowCard);
            });

            // Append the flex container to the modal content
            workflowTestingContainer.appendChild(flexContainer);

            // Open the modal
            const modal = new bootstrap.Modal(document.getElementById('workflowModal'));
            modal.show();
        })
        .catch(error => {
            console.error("Error rendering workflows for testing:", error);
            alert("Failed to render individual flows. Please try again.");
        });
}


// ===============================================================================================================
// UTILITY FUNCTIONS
// ===============================================================================================================

function loadParentFlows() {

    const parentFlows = document.getElementById('parent-flows');
    if (!parentFlows) {
        console.error("❌ ERROR: Element with ID 'parent-flows' not found.");
        return;
    }

    // ✅ Clear existing elements to prevent duplicates
    parentFlows.innerHTML = '';

    fetch('/workflow/api/parent_flows')
        .then(response => response.json())
        .then(data => {

            if (!data || data.length === 0) {
                parentFlows.innerHTML = `<div class="text-white p-2 text-center">No Overall Flows Available</div>`;
                return;
            }

            data.forEach(flow => {
                // ✅ Create flow card container
                const flowCard = document.createElement("div");
                flowCard.className = "flex justify-between items-center bg-red-950 border border-black px-3 py-1 text-sm rounded-lg shadow-sm cursor-pointer hover:bg-gray-700";
                flowCard.setAttribute("data-step-id", flow.id);

                // ✅ Handle Click Event
                flowCard.onclick = () => {
                    document.querySelectorAll("#parent-flows div").forEach(el => el.classList.remove("bg-gray-500", "bg-gray-700"));
                    flowCard.classList.add("bg-gray-500");

                    window.currentParentId = flow.id;
                    loadChildFlows(flow.id);
                };

                // 🔹 Add the flow name
                const nameSpan = document.createElement("span");
                nameSpan.className = "font-semibold text-white truncate";
                nameSpan.textContent = flow.name;

                // 🔹 Add buttons container (Edit & Delete)
                const buttonContainer = document.createElement("div");
                buttonContainer.className = "flex space-x-2";

                if (flow.is_locked == 1) {
                    const lockIcon = document.createElement("div");
                    lockIcon.innerHTML = "🔒";
                    lockIcon.title = "This flow is locked.";
                    lockIcon.className = "text-white text-lg px-2 py-1 cursor-pointer";

                    lockIcon.onclick = () => {
                        openUnlockModal(() => {
                            editOverallFlow(flow.id); // Or whatever action you want
                        });
                    };

                    buttonContainer.appendChild(lockIcon);
                }
                else {
                    const editButton = document.createElement("button");
                    editButton.className = "bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-md text-xs";
                    editButton.innerHTML = "✎";
                    editButton.onclick = (event) => {
                        event.stopPropagation();
                        editOverallFlow(flow.id);
                    };

                    const deleteButton = document.createElement("button");
                    deleteButton.className = "bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-md text-xs";
                    deleteButton.innerHTML = "🗑";
                    deleteButton.onclick = (event) => {
                        event.stopPropagation();
                        deleteOverallFlow(flow.id);
                    };

                    buttonContainer.appendChild(editButton);
                    buttonContainer.appendChild(deleteButton);
                }

                // ✅ Append name and buttons to flowCard
                flowCard.appendChild(nameSpan);
                flowCard.appendChild(buttonContainer);

                // ✅ Append flowCard to parentFlows container
                parentFlows.appendChild(flowCard);

            });
        })
        .catch(err => {
            console.error("❌ ERROR: Fetching parent flows failed:", err);
        });
}

function loadChildFlows() {

    window.currentStepId = null;
    window.currentChildId = null;

    if (window.diagram) {
        console.log("🔄 Disposing existing GoJS Diagram...");
        window.diagram.div = null;
        window.diagram = null;
        go.Diagram.fromDiv("workflow-diagram")?.div?.remove();
    }

    const workflowDiagram = document.getElementById("workflow-diagram");
    workflowDiagram.innerHTML = `
        <div id="workflow-message" class="text-white text-lg text-center py-4">
            Please click on Individual Workflow.
        </div>
    `;

    const childFlows = document.getElementById('child-flows');
    childFlows.innerHTML = "";

    fetch(`/workflow/api/child_flows?parent_id=${window.currentParentId}`)
        .then(response => response.json())
        .then(data => {
            window.individualFlows = data;

            if (!data || data.length === 0) {
                childFlows.innerHTML = `<div class="text-white p-2 text-center bg-red-800 rounded-lg">No Individual Flows Available</div>`;
                return;
            }

            data.forEach(flow => {
                const flowCard = document.createElement("div");
                flowCard.className = "flex justify-between items-center bg-red-700 hover:bg-red-600 text-white px-3 py-2 text-sm rounded-lg shadow-sm cursor-pointer";
                flowCard.setAttribute("data-step-id", flow.id);

                // Handle Click Event for Flow Selection
                flowCard.onclick = () => {
                    document.querySelectorAll("#child-flows div").forEach(el => el.classList.remove("bg-gray-500"));
                    flowCard.classList.add("bg-gray-500");

                    window.currentStepId = flow.id;
                    window.currentChildId = flow.id;

                    // ✨ Capture Lock Status
                    window.isCurrentFlowLocked = flow.is_locked === 1;
                    console.log("\uD83D\uDD10 Current Flow Locked:", window.isCurrentFlowLocked);

                    loadFlowchart(flow.id, flow.id);
                };

                // Flow name
                const nameSpan = document.createElement("span");
                nameSpan.className = "truncate text-white";
                nameSpan.textContent = flow.name;

                // Buttons container
                const buttonContainer = document.createElement("div");
                buttonContainer.className = "flex space-x-2";

                if (flow.is_locked == 1) {
                    const lockButton = document.createElement("button");
                    lockButton.className = "text-white text-lg px-2 py-1 cursor-pointer";
                    lockButton.innerHTML = "🔒";
                    lockButton.title = "This flow is locked.";
                    lockButton.onclick = (e) => {
                        e.stopPropagation();
                        openUnlockModal(() => {
                            editIndividualFlow(flow.id);
                        });
                    };
                    buttonContainer.appendChild(lockButton);
                } else {
                    const editButton = document.createElement("button");
                    editButton.className = "bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-md text-xs";
                    editButton.innerHTML = "✎";
                    editButton.onclick = (e) => {
                        e.stopPropagation();
                        editIndividualFlow(flow.id);
                    };

                    const deleteButton = document.createElement("button");
                    deleteButton.className = "bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-md text-xs";
                    deleteButton.innerHTML = "🗑";
                    deleteButton.onclick = (e) => {
                        e.stopPropagation();
                        deleteIndividualFlow(flow.id, e);
                    };

                    buttonContainer.appendChild(editButton);
                    buttonContainer.appendChild(deleteButton);
                }

                // Append name and buttons to flowCard
                flowCard.appendChild(nameSpan);
                flowCard.appendChild(buttonContainer);

                childFlows.appendChild(flowCard);
            });

            new Sortable(childFlows, {
                animation: 150,
                ghostClass: 'bg-gray-600',
                onEnd: function (evt) {
                    const items = [...document.querySelectorAll("#child-flows div[data-step-id]")];
                    const newOrder = items.map((el, index) => ({
                        id: el.getAttribute("data-step-id"),
                        order_num: index + 1
                    }));

                    console.log("📌 New Order:", newOrder);

                    fetch('/workflow/api/update_child_order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ order: newOrder })
                    })
                        .then(response => response.json())
                        .then(data => {
                            console.log("✅ Order saved successfully:", data);
                        })
                        .catch(error => console.error("❌ Error saving order:", error));
                }
            });
        })
        .catch(err => console.error("❌ ERROR fetching child flows:", err));
}

function loadFlowchart(stepId, childId = null) {
    if (!stepId) {
        console.warn("⚠️ No workflow selected. Displaying placeholder message.");
        document.getElementById("workflow-diagram").innerHTML = `
            <div class="flex justify-center items-center h-full">
                <h3 class="text-gray-500">Please click on Individual Workflow.</h3>
            </div>`;
        return;
    }

    if (!childId && window.currentChildId) {
        console.warn("⚠️ No child ID passed, using `currentChildId`.");
        childId = window.currentChildId;
    }

    // ✅ Build API request URL for better readability
    let apiUrl = `/workflow/api/flowchart?step_id=${stepId}`;
    if (childId) apiUrl += `&child_id=${childId}`;

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            if (!data || !data.nodes || !data.links) {
                console.error("❌ ERROR: No flowchart data received.");
                document.getElementById("workflow-diagram").innerHTML = `
                    <div class="flex justify-center items-center h-full">
                        <h3 class="text-gray-500">No flowchart data available.</h3>
                    </div>`;
                return;
            }

            // 🔹 New: Filter nodes so students only see what they can edit
            const filteredNodes = data.nodes.map(node => ({
                ...node,
                disabled: !node.student_can_edit  // Disable nodes the student can't edit
            }));

            initializeDiagram("workflow-diagram", filteredNodes, data.links);
        })
        .catch(error => {
            console.error("❌ ERROR fetching flowchart:", error);

            if (typeof showToast === "function") {
                showToast("Failed to load flowchart.", "error");
            } else {
                Swal.fire({
                    icon: "error",
                    title: "Flowchart Load Failed",
                    text: "An error occurred while loading the flowchart. Please try again.",
                });
            }
        });
}

function saveFlowchart() {
    console.log("🚀 saveFlowchart() function called!");

    if (!diagram) {
        Swal.fire({
            icon: "error",
            title: "Diagram Not Initialized",
            text: "The diagram instance is missing. Please try again.",
        });
        console.error("Diagram instance is missing.");
        return;
    }

    const step_id = window.currentStepId;
    console.log("✅ Current Step ID:", step_id);

    if (!step_id) {
        Swal.fire({
            icon: "warning",
            title: "No Task Selected",
            text: "Please select a workflow before saving.",
        });
        console.warn("⚠️ No Step ID. Stopping save.");
        return;
    }

    const nodes = [];
    const invalidNodes = [];
    diagram.nodes.each((node) => {
        if (node instanceof go.Node) {
            nodes.push({
                key: node.data.key,
                text: node.data.text,
                loc: go.Point.stringify(node.location),
                color: node.data.color,
                stepId: node.data.step_id || step_id,
                completion_percentage: node.data.completion_percentage ?? 0,
            });

            // ✅ Detect negative node IDs
            if (node.data.key < 0) {
                invalidNodes.push(node.data.key);
            }
        }
    });

    const links = [];
    const invalidLinks = [];
    diagram.links.each((link) => {
        if (link instanceof go.Link && link.data.from && link.data.to) {
            // ✅ Prevent saving negative node IDs
            if (link.data.from < 0 || link.data.to < 0) {
                console.error("❌ Invalid link detected:", link.data);
                invalidLinks.push(link.data);
            } else {
                const fromNode = nodes.find(n => n.id === link.data.from);
                if (fromNode && fromNode.to_flow_id) {
                    link.data.to_flow_id = fromNode.to_flow_id;
                }

                const isCrossflow = !!link.data.to_flow_id;

                links.push({
                    from: link.data.from,
                    to: link.data.to,
                    ...(isCrossflow ? { to_flow_id: link.data.to_flow_id } : {}),  // ONLY include if exists
                });

            }
        }
    });

    // 🚨 If any invalid nodes exist, warn user
    if (invalidNodes.length > 0) {
        Swal.fire({
            icon: "error",
            title: "Unsaved Nodes Detected",
            text: "One or more nodes are not saved yet. Please save the diagram before linking nodes.",
        });
        console.error("❌ Unsaved Nodes:", invalidNodes);
        return;
    }

    // 🚨 If any invalid links exist, warn user
    if (invalidLinks.length > 0) {
        Swal.fire({
            icon: "error",
            title: "Invalid Links Detected",
            text: "Some links reference unsaved nodes. Please reconnect the nodes and try again.",
        });
        console.error("❌ Invalid Links:", invalidLinks);
        return;
    }

    console.log("📌 Final Data Before Save:", { step_id, nodes, links });

    fetch("/workflow/api/save_flowchart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step_id, nodes, links }),
    })
        .then((response) => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then((data) => {
            if (data.error) {
                console.error("❌ Error saving flowchart:", data.error);
                Swal.fire({
                    icon: "error",
                    title: "Save Failed",
                    text: data.error,
                });
            } else {
                Swal.fire({
                    icon: "success",
                    title: "Flowchart Saved!",
                    text: "Your flowchart was saved successfully.",
                    timer: 2000,
                    showConfirmButton: false,
                });
            }
        })
        .catch((error) => {
            console.error("❌ Error while saving flowchart:", error);
            Swal.fire({
                icon: "error",
                title: "Save Error",
                text: "An error occurred while saving the flowchart.",
            });
        });
}

function loadOverview(parentId = null) {

    setTimeout(() => {
        if (parentId) {
            window.currentParentId = parentId;
        }


        if (!window.currentParentId) {
            console.error("❌ Error: Parent flow ID is not defined. Cannot load overview.");
            Swal.fire({
                icon: "warning",
                title: "No Parent Flow Selected",
                text: "Please select a flow before proceeding.",
            });
            return;
        }

        document.getElementById("workflowContainer").classList.add("hidden");
        document.getElementById("overviewContainer").classList.remove("hidden");

        document.getElementById("overview-diagram").style.display = "block";
        document.getElementById("overview-diagram").style.visibility = "visible";

        fetch(`/workflow/api/overview?parent_id=${window.currentParentId}`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP error: ${response.status} - ${response.statusText}`);
                }
                return response.json();
            })
            .then((data) => {
                const { nodes, links } = data;

                if (!nodes || nodes.length === 0) {
                    console.warn("⚠️ Warning: No nodes found for the selected parent flow.");
                    Swal.fire({
                        icon: "info",
                        title: "No Nodes Available",
                        text: "No nodes found for this parent flow.",
                    });
                    return;
                }

                console.log(`✅ Overview: Fetched ${nodes.length} nodes and ${links.length} links.`);

                // 🔹 Group nodes by step_id
                const groupedNodes = {};
                nodes.forEach((node) => {
                    const groupId = node.step_id;
                    if (!groupedNodes[groupId]) {
                        groupedNodes[groupId] = [];
                    }
                    groupedNodes[groupId].push(node);
                });

                console.log("📌 Overview: Grouped nodes by step_id:", groupedNodes);

                let columnIndex = 0;
                const columnSpacing = 200;
                const rowSpacing = 100;
                const positionedNodes = [];

                const groupedArray = Object.entries(groupedNodes);

                groupedArray.sort((a, b) => {
                    const orderA = a[1][0]?.order_num || 0;
                    const orderB = b[1][0]?.order_num || 0;
                    return orderA - orderB;
                });

                groupedArray.forEach(([groupId, nodes]) => {
                    const columnX = columnIndex * columnSpacing;
                    let rowY = 0;

                    // ✅ Add label node for the group
                    positionedNodes.push({
                        key: `label-${groupId}`,
                        category: "label",
                        text: nodes[0]?.step_name || "Unnamed Flow",
                        loc: `${columnX} ${rowY - 40}`
                    });

                    nodes.sort((a, b) => {
                        const ay = parseFloat((a.loc || a.position || "0 0").split(" ")[1]) || 0;
                        const by = parseFloat((b.loc || b.position || "0 0").split(" ")[1]) || 0;
                        return ay - by;
                    });
                    nodes.forEach((node) => {
                        positionedNodes.push({
                            ...node,
                            loc: `${columnX} ${rowY}`
                        });
                        rowY += rowSpacing;
                    });

                    columnIndex++;
                });

                console.log("📌 Overview: Positioned nodes:", positionedNodes);

                const styledLinks = links.map((link) => ({
                    ...link,
                    strokeDashArray: link.isCrossflow ? [4, 2] : null,
                    stroke: link.isCrossflow ? "red" : "black",
                }));

                console.log("📌 Overview: Styled links:", styledLinks);

                // ✅ Add GoJS label node template (make sure $ is defined)
                const $ = go.GraphObject.make;
                // ✅ Define Label Node Template (for step titles above columns)
                overviewDiagram.nodeTemplateMap.add("label",
                    $(go.Node, "Auto",
                        {
                            selectable: false,
                            layerName: "Background",
                            locationSpot: go.Spot.Center
                        },
                        new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
                        $(go.TextBlock,
                            {
                                font: "bold 14px sans-serif",
                                stroke: "white",
                                alignment: go.Spot.Center,
                                background: null
                            },
                            new go.Binding("text", "text")
                        )
                    )
                );





                overviewDiagram.div = document.getElementById("overview-diagram");
                overviewDiagram.model = new go.GraphLinksModel({
                    nodeDataArray: positionedNodes,
                    linkDataArray: styledLinks,
                });

                overviewDiagram.layoutDiagram(true);
                console.log("✅ Overview: Rendered successfully.");
            })
            .catch((error) => {
                console.error("❌ Error: Failed to load overview.", error.message);
                Swal.fire({
                    icon: "error",
                    title: "Load Failed",
                    text: "Failed to load nodes for the overview. Please try again.",
                });
            });
    }, 100);
}

function setupOverviewButtonListener() {
    const overviewButton = document.getElementById("overviewButton");

    if (!overviewButton) {
        console.error("❌ ERROR: Overview button not found.");
        return;
    }

    // Monitor clicks on individual flows
    document.addEventListener("click", () => {
        if (window.currentStepId) {
            overviewButton.disabled = false;
            overviewButton.classList.remove("opacity-50", "cursor-not-allowed");
        } else {
            overviewButton.disabled = true;
            overviewButton.classList.add("opacity-50", "cursor-not-allowed");
        }
    });

    overviewButton.addEventListener("click", () => {

        if (!window.currentStepId) {
            Swal.fire({
                icon: "warning",
                title: "No Individual Flow Selected",
                text: "Please select an individual flow before accessing the overview.",
            });
            return;
        }

        loadOverview(window.currentParentId);
    });
}

function showWorkflow() {

    const workflowContainer = document.getElementById('workflowContainer');
    const workflowDiagram = document.getElementById('workflow-diagram');
    const workflowButtons = document.getElementById('workflow-buttons');

    // ✅ Use Tailwind classes instead of inline styles
    document.getElementById('overviewContainer').classList.add('hidden');
    workflowContainer.classList.remove('hidden');

    workflowContainer.classList.add('flex', 'flex-col', 'h-[77vh]');
    workflowDiagram.classList.add('flex-grow');
    workflowButtons.classList.add('mt-auto');

    // ✅ Use Tailwind for button styling
    document.getElementById('workflowButton').classList.add('bg-blue-600', 'text-white');
    document.getElementById('workflowButton').classList.remove('bg-gray-500');
    document.getElementById('overviewButton').classList.add('bg-gray-500', 'text-white');
    document.getElementById('overviewButton').classList.remove('bg-blue-600');

    // ✅ Ensure GoJS refreshes properly
    setTimeout(() => {
        if (window.myDiagram) {
            window.myDiagram.requestUpdate();
        }
    }, 100);
}

// ===============================================================================================================
// STATE PROPAGATION
// ===============================================================================================================

function disableWorkflowActions() {
    document.querySelectorAll('.workflow-action-button').forEach(btn => {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    });
}

function enableWorkflowActions() {
    document.querySelectorAll('.workflow-action-button').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    });
}

// ===============================================================================================================
// GENERAL FLOW / ACCESS HELPERS
// ===============================================================================================================

function fetchSiblingFlows() {
    if (!window.currentParentId) {
        console.error("❌ ERROR: `currentParentId` is undefined when fetching sibling flows.");

        // ✅ Ensure `showToast()` is replaced if it's Bootstrap-dependent
        if (typeof showToast === "function") {
            showToast("Error: No parent workflow selected!", "error");
        } else {
            Swal.fire({
                icon: "error",
                title: "No Parent Workflow",
                text: "Please select a parent workflow before proceeding.",
            });
        }
        return;
    }

    const apiUrl = `/workflow/api/sibling_flows?parent_id=${window.currentParentId}`;
    console.log(`Fetching sibling flows from: ${apiUrl}`);

    fetch(apiUrl)
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch sibling flows");
            return response.json();
        })
        .then(data => {
            if (data.length === 0) {
                console.warn("⚠ No sibling flows found.");
            } else {
                console.log("✅ Fetched sibling flows:", data);
            }
        })
        .catch(error => {
            console.error("❌ Error fetching sibling flows:", error);

            if (typeof showToast === "function") {
                showToast("Failed to fetch sibling flows.", "error");
            } else {
                Swal.fire({
                    icon: "error",
                    title: "Fetch Error",
                    text: "An error occurred while fetching sibling flows.",
                });
            }
        });
}

function determineStepId(flowId) {
    console.log("🔍 Trying to determine step_id for flowId:", flowId);

    // ✅ First, check if `currentStepId` is already set
    if (window.currentStepId && window.currentStepId !== 1) {
        console.log("✅ Using existing step_id:", window.currentStepId);
        return window.currentStepId;
    }

    // ✅ Second, try to get step_id from the selected workflow step
    const selectedStep = document.querySelector(".workflow-step.selected");
    if (selectedStep) {
        const stepId = parseInt(selectedStep.getAttribute("data-step-id"), 10);
        if (!isNaN(stepId)) {
            console.log("✅ Found step_id from selected step:", stepId);
            return stepId;
        }
    }

    // ✅ Third, try to get step_id from a dropdown (if applicable)
    const stepDropdown = document.getElementById("stepDropdown");
    if (stepDropdown?.value) {
        const stepId = parseInt(stepDropdown.value, 10);
        if (!isNaN(stepId)) {
            console.log("✅ Found step_id from dropdown:", stepId);
            return stepId;
        }
    }

    console.warn("⚠️ Unable to determine step_id dynamically. Using default: 1");
    return 1;  // If all else fails, return default
}

function getCurrentstepId() {
    if (typeof currentStepId !== "undefined" && currentStepId !== null) {
        return currentStepId;
    }
    console.error("❌ Task ID is not set!");
    return null;
}

// -------------------------------------------------------------------------------------------------------------------
// WORKFLOW TESTING FOR DROPDOWNS
// -------------------------------------------------------------------------------------------------------------------

function populateNodeDropdown(nodes) {
    console.log("🔍 Populating Node Dropdown with:", nodes);

    const nodeDropdown = document.getElementById("targetNodeDropdown");

    if (!nodeDropdown) {
        console.error("❌ ERROR: Node dropdown element not found in the DOM.");
        return;
    }

    nodeDropdown.innerHTML = '<option value="">Select a target node</option>'; // ✅ Clear previous options

    nodes.forEach(node => {
        if (!node.key || !node.text) {
            console.warn("⚠️ Skipping invalid node:", node);
            return;
        }

        const option = document.createElement("option");
        option.value = node.key;
        option.textContent = node.text;
        nodeDropdown.appendChild(option);
    });

    console.log("✅ Successfully populated node dropdown.");
}

function updateState(flowId, newState) {
    console.log(`Updating state for flow ${flowId} to ${newState}`);

    fetch('/workflow/api/update_state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flow_id: flowId, new_state: newState })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to update state.");
            }
            return response.json();
        })
        .then(data => {
            console.log("State updated successfully:", data);

            // Fetch and propagate changes to linked workflows
            propagateStateChange(flowId, newState);
        })
        .catch(err => {
            console.error("Error updating state:", err);
            alert("Failed to update the workflow state.");
        });
}

function generateDropdownForWorkflow(workflowId) {
    // Fetch nodes and links for the selected workflow
    fetch(`/workflow/api/flowchart?child_id=${workflowId}`)
        .then(response => response.json())
        .then(data => {
            if (!data || !data.nodes || !data.links) {
                console.error("Invalid data received for Workflow State Testing.");
                return;
            }

            const workflowStateContainer = document.getElementById('workflowTestingContainer');
            if (!workflowStateContainer) {
                console.error("Workflow State Testing container not found in the DOM.");
                return;
            }

            // Clear the container
            workflowStateContainer.innerHTML = '';

            // Build the sequence of statuses based on connections
            const nodesById = {};
            const incomingLinksCount = {};
            const adjacencyList = {};

            // Initialize nodes and adjacency list
            console.log("Raw data received from API:", data);

            data.nodes.forEach(node => {
                const nodeKey = parseInt(node.key, 10);
                if (!node.key) {
                    console.warn("Node with missing or invalid key:", node);
                    return; // Skip this node if the key is missing
                }
                nodesById[node.key] = node.text || "Unnamed Node";
                incomingLinksCount[node.key] = 0;
                adjacencyList[node.key] = [];
            });


            // Process links
            data.links.forEach(link => {
                if (!adjacencyList[link.from]) {
                    adjacencyList[link.from] = []; // Ensure `from` node has an array
                }
                adjacencyList[link.from].push(link.to);

                // Count incoming links for each node
                if (incomingLinksCount[link.to] !== undefined) {
                    incomingLinksCount[link.to]++;
                } else {
                    incomingLinksCount[link.to] = 1;
                }
            });

            // Start with nodes with no incoming links
            const orderedNodes = [];
            const stack = Object.keys(incomingLinksCount).filter(key => incomingLinksCount[key] === 0);

            while (stack.length > 0) {
                const current = stack.pop();
                orderedNodes.push(current);

                if (adjacencyList[current]) {
                    adjacencyList[current].forEach(nextNode => {
                        incomingLinksCount[nextNode] -= 1;
                        if (incomingLinksCount[nextNode] === 0) {
                            stack.push(nextNode);
                        }
                    });
                }
            }

            // Build the dropdown
            const dropdown = document.createElement('select');
            dropdown.className = 'form-control';
            dropdown.id = 'workflowStateDropdown';

            orderedNodes.forEach(nodeKey => {
                if (nodesById[nodeKey]) {
                    const option = document.createElement('option');
                    option.value = nodeKey;
                    option.textContent = nodesById[nodeKey];
                    dropdown.appendChild(option);
                }
            });

            workflowStateContainer.appendChild(dropdown);
        })
        .catch(error => {
            console.error("Error generating dropdown for workflow:", error);
            alert("Failed to generate the workflow state dropdown. Please try again.");
        });
}

function propagateStateChange(nodeId, newState) {
    console.log(`Propagating change from Node ID ${nodeId} to state: ${newState}`);
    fetch(`/workflow/api/links?node_id=${nodeId}`)
        .then(response => response.json())
        .then(data => {
            if (data.links && data.links.length > 0) {
                data.links.forEach(link => {
                    const targetDropdown = document.getElementById(`dropdown-${link.child_node_id}`);
                    if (targetDropdown) {
                        targetDropdown.value = newState;
                        console.log(`Updated Node ID ${link.child_node_id} to state: ${newState}`);
                    }
                });
            }
        })
        .catch(err => console.error('Error propagating state changes:', err));
}

function showToast(message, type = "success") {
    Swal.fire({
        icon: type,  // "success", "error", "warning", "info"
        title: message,
        toast: true,
        position: "top-end",  // Shows in the top right like Bootstrap Toasts
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });
}