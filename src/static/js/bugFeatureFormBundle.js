// static/js/bugFeatureFormBundle.js

window.addEventListener("error", function (e) {
    console.error("Global error:", e.message, e.error);
});

window.addEventListener("unhandledrejection", function (e) {
    console.error("Unhandled promise rejection:", e.reason);
});

const { useState } = React;

function BugFeatureForm() {
    const [form, setForm] = useState({
        type: 'bug',
        title: '',
        description: '',
        email: '',
        department: 'Admin',
        area: '',
        priority: 'Medium'
    });

    const departments = {
        Admin: ["Users", "Settings", "Login"],
        Classes: [
            "Add Class", "Edit Class", "Delete Class", "Class issues",
            "Assignment issues", "Add Assignment", "Edit Assignment", "Delete Assignment",
            "Entering Grades", "Changing Grades", "Saving Grades", "Other Grades"
        ],
        Films: [
            "Add Film", "Edit Film", "Delete Film", "Film Issues", "Add Scenes",
            "Delete Scenes", "Edit Scenes", "Scenes issues",
            "Add Shots", "Edit Shots", "Delete Shots", "Shot issues"
        ],
        Workflow: [
            "Add Overall Flow", "Add Individual Flow", "Edit flows", "Moving nodes in window",
            "Editing nodes in window", "Clicking on nodes in window", "Clicking on links in window",
            "Editing links in window", "Moving Individual Flows on list", "Over view issues",
            "Flow issues", "Node issues"
        ]
    };

    const handleChange = (field) => (e) => {
        setForm({ ...form, [field]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.title || !form.description) {
            alert("Title and description are required.");
            return;
        }

        const payload = { ...form, timestamp: new Date().toISOString() };

        fetch("/bugreport/bugs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
            .then(res => res.json())
            .then(data => {
                alert("Thanks for your feedback!");
                console.log("Server response:", data);
                setForm({
                    type: 'bug',
                    title: '',
                    description: '',
                    email: '',
                    department: 'Admin',
                    area: '',
                    priority: 'Medium'
                });
            })
            .catch(err => {
                console.error("Submission error:", err);
                alert("There was a problem submitting the form.");
            });
    };

    return React.createElement('div', { className: "container mx-auto mt-10 px-4" },
        React.createElement('div', { className: "bg-white shadow-sm rounded-xl border border-gray-200" },
            React.createElement('div', { className: "bg-blue-600 text-white px-6 py-4 rounded-t-xl" },
                React.createElement('h2', { className: "text-lg font-semibold" }, "\ud83d\udccb Submit Bug or Feature Request")
            ),
            React.createElement('form', { onSubmit: handleSubmit, className: "space-y-6 px-6 py-6" },
                // [Insert form elements here similar to your JSX structure]
            )
        )
    );
}

// Mount component

// Expose a function we can call when the modal opens
window.renderBugForm = function () {
    const el = document.getElementById("bug-form");
    if (el) {
        const root = ReactDOM.createRoot(el);
        root.render(React.createElement(BugFeatureForm));
    } else {
        console.error("bug-form container not found");
    }
};
