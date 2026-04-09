document.addEventListener("DOMContentLoaded", function () {
    const form = document.querySelector("#user-form"); // ✅ FIXED ID

    if (!form) return;

    const emailLocal = document.getElementById("email_local");
    const emailDomain = document.getElementById("email_domain");
    const constructedEmailField = document.getElementById("constructed_email");
    const passwordField = document.getElementById("password");
    const confirmPasswordField = document.getElementById("confirm_password");
    const passwordMatchMessage = document.getElementById("password-match-message");

    function updateEmailPreview() {
        if (!emailLocal || !emailDomain || !constructedEmailField) return;
        const local = emailLocal.value;
        const domain = emailDomain.value;
        constructedEmailField.value =
            domain === "other" ? `${local}@custom-domain.com` : `${local}@${domain}`;
    }

    function validatePasswordMatch() {
        if (!passwordField || !confirmPasswordField || !passwordMatchMessage) return;
        passwordMatchMessage.textContent =
            passwordField.value !== confirmPasswordField.value
                ? "Passwords do not match"
                : "";
    }

    if (emailLocal && emailDomain) {
        updateEmailPreview();
        emailLocal.addEventListener("input", updateEmailPreview);
        emailDomain.addEventListener("change", updateEmailPreview);
        emailLocal.addEventListener("focus", updateEmailPreview);
    }

    if (confirmPasswordField) {
        confirmPasswordField.addEventListener("input", validatePasswordMatch);
    }

    const studentCheckbox = document.querySelector("input[data-role='student']");
    const artistCheckbox = document.getElementById("group_artist");

    if (studentCheckbox && artistCheckbox) {
        studentCheckbox.addEventListener("change", () => {
            if (studentCheckbox.checked) {
                artistCheckbox.checked = true;
            }
        });
    }

    updateEmailPreview();
});


function confirmDeleteUser(userId) {
    if (!window.Swal) {
        return alert("SweetAlert2 not loaded. Cannot delete.");
    }

    Swal.fire({
        icon: "warning",
        title: "Are you sure?",
        text: "This action cannot be undone. Do you want to delete this user?",
        showCancelButton: true,
        confirmButtonText: "Yes, delete",
        cancelButtonText: "Cancel",
        reverseButtons: true,
    }).then((result) => {
        if (result.isConfirmed) {
            document.getElementById(`delete-user-${userId}`).submit();
        }
    });
}
