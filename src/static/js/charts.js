// /static/js/charts.js  (full file — drop-in replacement)
// Legacy shim: some pages still call this; keep it harmless.
if (!window.renderAllAssignmentCharts) {
    window.renderAllAssignmentCharts = function () { /* no-op */ };
}


// Global chart cache
window.chartInstances = {};

/**
 * Clear all charts and cache. 
 * Why: call this before rebuilding the table to avoid stale instances.
 */
window.resetCharts = function () {
    try {
        Object.values(window.chartInstances).forEach((ch) => {
            if (ch && typeof ch.destroy === "function") ch.destroy();
        });
    } catch (_) { /* ignore */ }
    window.chartInstances = {};
};

window.renderPieChart = function (canvasId, labels, counts, colors) {
    try {
        // Ensure Chart.js is available
        if (typeof Chart === "undefined") {
            console.error("❌ Chart.js not loaded; cannot render charts.");
            return;
        }

        // Find canvas; if not yet in DOM, retry shortly
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            // why: table may still be rendering; short retry avoids race
            setTimeout(() => window.renderPieChart(canvasId, labels, counts, colors), 250);
            return;
        }

        // Fixed footprint to avoid layout thrash/flicker
        canvas.width = 100;
        canvas.height = 100;

        // Destroy previous instance if canvas was rebuilt
        if (window.chartInstances[canvasId]) {
            try { window.chartInstances[canvasId].destroy(); } catch (_) { /* ignore */ }
        }

        window.chartInstances[canvasId] = new Chart(canvas, {
            type: "pie",
            data: {
                labels,
                datasets: [
                    {
                        data: counts,
                        backgroundColor: colors
                    }
                ]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        bodyFont: { size: 14 },
                        titleFont: { size: 16 },
                        padding: 10,
                        boxPadding: 6
                    }
                }
            }
        });
    } catch (error) {
        console.error(`❌ Failed to render pie chart (${canvasId}):`, error);
    }
};

window.fetchChartData = function (assignmentId, progressStepId, parentStepId, canvasId) {
    // Note: no global de-dupe set; safe to call multiple times because render destroys old instance.
    const url = `/assignments/api/status_summary/${window.classId}?assignment_id=${assignmentId}&progress_step_id=${progressStepId}`;

    fetch(url)
        .then((r) => r.json())
        .then((data) => {
            if (!Array.isArray(data)) {
                console.error("❌ Invalid chart data received:", data);
                return;
            }

            const labels = data.map((d) => d.status);
            const counts = data.map((d) => d.count);
            const colors = data.map((d) => d.color);

            window.renderPieChart(canvasId, labels, counts, colors);
        })
        .catch((err) => {
            console.error("❌ Error fetching pie chart data:", err);
        });
};
