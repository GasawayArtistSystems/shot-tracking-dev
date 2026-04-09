import { useState } from 'react';
import Swal from 'sweetalert2';

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
        "Add Shots", "Edit Shots", "Delete Shots", "Shot issues",
        "Assets issues", "Add Assets"
    ],
    Workflow: [
        "Add Overall Flow", "Add Individual Flow", "Edit flows", "Moving nodes in window",
        "Editing nodes in window", "Clicking on nodes in window", "Clicking on links in window",
        "Editing links in window", "Moving Individual Flows on list", "Over view issues",
        "Flow issues", "Node issues"
    ],
    Dashboard:[
        "Class Assignments", "Film Assignments"
    ],
    Markup_Tool: [
        "Overall", "Sidebar", "Drawing Canvas", "Drawing Tools", "Video Player", "Video Tools"
    ]
};

console.log("Departments available:", Object.keys(departments));


export default function BugFeatureForm() {
    const [form, setForm] = useState({
        type: 'bug',
        title: '',
        description: '',
        email: '',
        department: 'Admin',
        area: '',
        priority: 'Medium'
    });

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
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })
            .then(res => res.json())
            .then(data => {
                Swal.fire({
                    icon: 'success',
                    title: 'Submitted!',
                    text: 'Thanks for your feedback.',
                    confirmButtonColor: '#3085d6',
                    confirmButtonText: 'OK'
                }).then(() => {
                    document.getElementById('bugFormModal')?.classList.add('hidden');
                  });
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
                Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: 'There was a problem submitting the form.',
                  });
            });
    };

    return (
        <div className="container mx-auto mt-10 px-4">
            <div className="bg-white text-black shadow-sm rounded-xl border border-gray-200">
                <div className="bg-blue-600 text-white px-6 py-4 rounded-t-xl">
                    <h2 className="text-lg font-semibold">📋 Submit Bug or Feature Request</h2>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
                    <div>
                        <label className="block mb-1 text-sm font-medium text-gray-700">Type</label>
                        <div className="flex gap-6 text-sm text-black">
                            <label className="inline-flex items-center">
                                <input type="radio" name="type" value="bug" checked={form.type === 'bug'} onChange={handleChange('type')} className="mr-2" />
                                Bug
                            </label>
                            <label className="inline-flex items-center">
                                <input type="radio" name="type" value="feature" checked={form.type === 'feature'} onChange={handleChange('type')} className="mr-2" />
                                Feature
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block mb-1 text-sm font-medium text-gray-700">Department</label>
                        <select value={form.department} onChange={handleChange('department')} className="form-select w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black">
                            {Object.keys(departments).map(dep => (
                                <option key={dep} value={dep}>{dep}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block mb-1 text-sm font-medium text-gray-700">Area</label>
                        <select value={form.area} onChange={handleChange('area')} className="form-select w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black">
                            {departments[form.department].map(area => (
                                <option key={area} value={area}>{area}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block mb-1 text-sm font-medium text-gray-700">Priority</label>
                        <select value={form.priority} onChange={handleChange('priority')} className="form-select w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black">
                            {['Low', 'Medium', 'High'].map(level => (
                                <option key={level} value={level}>{level}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="title" className="block mb-1 text-sm font-medium text-gray-700">Title</label>
                        <input id="title" type="text" value={form.title} onChange={handleChange('title')} className="form-input w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black" required />
                    </div>

                    <div>
                        <label htmlFor="description" className="block mb-1 text-sm font-medium text-gray-700">Description</label>
                        <textarea id="description" value={form.description} onChange={handleChange('description')} rows="4" className="form-textarea w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black" required />
                    </div>

                    <div>
                        <label htmlFor="email" className="block mb-1 text-sm font-medium text-gray-700">Email (optional)</label>
                        <input id="email" type="email" value={form.email} onChange={handleChange('email')} className="form-input w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black" />
                    </div>

                    <div className="pt-2">
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md text-sm transition">Submit</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
