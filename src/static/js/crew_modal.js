// static/js/crew_modal.js

function submitCrewForm(event) {
    event.preventDefault();
    const form = event.target;
    const filmId = form.getAttribute("data-film-id");

    console.log("📝 Film ID from data-film-id:", filmId);

    if (!filmId) {
        console.error("❌ Missing film ID, cannot submit form");
        return;
    }

    const formData = new FormData(form);

    fetch(`/films/${filmId}/crew`, {
        method: "POST",
        body: formData,
        headers: {
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json"
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                closeCrewModal();
                Swal.fire({
                    icon: 'success',
                    title: 'Crew Updated!',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => location.reload());
            } else {
                console.error('🚫 Error from server:', data);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: data.message || 'An unexpected error occurred.'
                });
            }
        })
        .catch(error => {
            console.error('🚨 Fetch error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to update crew. Please try again.'
            });
        });
}

// ARTIST SEARCH FILTER
document.addEventListener("input", function (e) {
    if (e.target.id === "artistSearchInput") {
        const term = e.target.value.toLowerCase();
        const items = document.querySelectorAll("#artist-list .artist-item");

        items.forEach(item => {
            const name = item.dataset.name.toLowerCase();
            item.style.display = name.includes(term) ? "" : "none";
        });
    }
});

// Prevent Enter from submitting the modal when searching
document.addEventListener("keydown", function (e) {
    if (e.target.id === "artistSearchInput" && e.key === "Enter") {
        e.preventDefault();
    }
});
