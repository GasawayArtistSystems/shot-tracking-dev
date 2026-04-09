import React, { useEffect, useRef, useState } from "react";
import Gantt from "frappe-gantt";
import API_BASE_URL from "../app/utils/api";  // uses your existing API config

export default function PreproductionTimeline({ filmId }) {
    const ganttRef = useRef(null);
    const [tasks, setTasks] = useState([]);

    // Fetch preproduction steps
    useEffect(() => {
        fetch(`${API_BASE_URL}/films/api/films/${filmId}/preproduction`)
            .then((res) => res.json())
            .then((data) => {
                const formatted = data.map((step) => ({
                    id: step.id,
                    name: step.step_name,
                    start: step.start_date || new Date().toISOString().split("T")[0],
                    end: step.end_date || new Date().toISOString().split("T")[0],
                    progress: step.status === "Complete" ? 100 : 0,
                    custom_class: "bg-blue-500", // Tailwind color class
                }));
                setTasks(formatted);
            });
    }, [filmId]);

    // Render chart
    useEffect(() => {
        if (tasks.length > 0 && ganttRef.current) {
            new Gantt(ganttRef.current, tasks, {
                view_mode: "Day",
                custom_popup_html: (task) => `
                <div class="p-2 bg-gray-800 text-white rounded shadow">
                    <h3 class="font-bold">${task.name}</h3>
                    <p>${task.start} → ${task.end}</p>
                    <p>Assigned User ID: ${task.assigned_user_id || "—"}</p>
                </div>
            `,
                on_date_change: (task, start, end) => {
                    // 🔒 Ensure minimum duration = 1 day
                    if (end <= start) {
                        end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
                    }

                    // Update the task locally so Gantt reflects the change
                    task.start = start;
                    task.end = end;

                    // Send to backend
                    fetch(`${API_BASE_URL}/films/api/preproduction/${task.id}/update`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            start_date: start.toISOString().split("T")[0],
                            end_date: end.toISOString().split("T")[0],
                        }),
                    });
                },
            });
        }
    }, [tasks]);


    return (
        <div className="p-4 bg-gray-900 rounded-lg shadow">
            <h2 className="text-xl font-bold text-white mb-4">Pre-production Timeline</h2>
            <div ref={ganttRef}></div>
        </div>
    );
}
