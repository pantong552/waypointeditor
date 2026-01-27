
import {
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Other imports are handled dynamically or passed in

// We need to import from specific packages as per the main file usage
// Re-importing here to ensure this module is standalone-ish or expects dependencies?
// Better pattern: Pass dependencies (auth, db, functions) to the init function to share the initialized instances.

export class ProfileManager {
    constructor(auth, db, functions) {
        this.auth = auth;
        this.db = db;
        this.functions = functions;
        this.modalId = 'profileModal';
    }

    init() {
        this.injectModalHTML();
        this.attachGlobalExposure();
        console.log('[ProfileManager] Initialized');
    }

    injectModalHTML() {
        if (document.getElementById(this.modalId)) return; // Already exists

        const modalHTML = `
        <div class="modal fade" id="${this.modalId}" tabindex="-1" aria-labelledby="profileModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content bg-dark text-light border-secondary shadow-lg">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title" id="profileModalLabel"><i class="bi bi-person-circle me-2"></i>My Profile</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Account Info -->
                        <div class="mb-4">
                            <h6 class="text-uppercase text-secondary small fw-bold mb-3">Account Info</h6>
                            <div class="mb-3">
                                <label class="form-label-xs">Email Address</label>
                                <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" id="profileEmail" readonly>
                            </div>
                            <div class="d-grid">
                                <button class="btn btn-outline-secondary btn-sm" id="btnResetPassword">
                                    <i class="bi bi-key me-2"></i>Reset Password
                                </button>
                            </div>
                        </div>

                        <hr class="border-secondary my-4">

                        <!-- Subscription Info -->
                        <div>
                            <h6 class="text-uppercase text-secondary small fw-bold mb-3">Subscription Plan</h6>
                            
                            <div class="d-flex align-items-center mb-3">
                                <span class="badge bg-secondary rounded-pill me-2" id="profilePlanBadge" style="font-size: 0.9rem;">Free</span>
                                <span class="text-muted small" id="profileExpiryDate">No active subscription</span>
                            </div>

                            <div class="d-grid">
                                <button class="btn btn-outline-primary" id="btnManageSubscription">
                                    <i class="bi bi-credit-card-2-front me-2"></i> Manage Subscription
                                </button>
                            </div>
                            <small class="text-muted d-block text-center mt-2" style="font-size: 0.75rem;">
                                Opens Stripe Customer Portal in a new tab
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Attach Event Listeners after injection
        document.getElementById('btnResetPassword').addEventListener('click', () => this.handleResetPassword());
        document.getElementById('btnManageSubscription').addEventListener('click', () => this.handleManageSubscription());
    }

    attachGlobalExposure() {
        // Expose to window for the onclick handler in the dropdown
        window.openProfileModal = () => this.openProfileModal();
    }

    async openProfileModal() {
        if (!this.auth.currentUser) return;

        // 1. Fill basic info
        document.getElementById('profileEmail').value = this.auth.currentUser.email;

        // 2. Refresh subscription info in UI
        const btnManage = document.getElementById('btnManageSubscription');
        const expiryText = document.getElementById('profileExpiryDate');
        const planBadge = document.getElementById('profilePlanBadge');

        btnManage.disabled = true;
        btnManage.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...';

        try {
            const subRef = collection(this.db, "users", this.auth.currentUser.uid, "subscriptions");
            const q = query(subRef, where("status", "in", ["active", "trialing"]));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                // Is Pro
                const subDoc = snapshot.docs[0].data();
                planBadge.textContent = "PRO";
                planBadge.className = "badge bg-warning text-dark rounded-pill me-2";

                if (subDoc.current_period_end) {
                    const date = subDoc.current_period_end.toDate(); // Firestore Timestamp to Date
                    expiryText.textContent = `Renews on ${date.toLocaleDateString()}`;
                } else {
                    expiryText.textContent = "Active";
                }
            } else {
                // Is Free
                planBadge.textContent = "Free";
                planBadge.className = "badge bg-secondary rounded-pill me-2";
                expiryText.textContent = "No active subscription";
            }
        } catch (error) {
            console.error("Error fetching sub details:", error);
            expiryText.textContent = "Error loading info";
        } finally {
            btnManage.disabled = false;
            btnManage.innerHTML = '<i class="bi bi-credit-card-2-front me-2"></i> Manage Subscription';
        }

        const profileModal = new bootstrap.Modal(document.getElementById('profileModal'));
        profileModal.show();
    }

    async handleResetPassword() {
        const btn = document.getElementById('btnResetPassword');
        const originalText = btn.innerHTML;
        const email = this.auth.currentUser.email;

        if (!confirm(`Send password reset email to ${email}?`)) return;

        btn.disabled = true;
        btn.textContent = "Sending...";

        try {
            // Need to import sendPasswordResetEmail dynamically or pass it? 
            // It's a top level function in v9. 
            // We should import it in this module.
            const { sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
            await sendPasswordResetEmail(this.auth, email);

            alert(`Password reset email sent to ${email}. Please check your inbox.`);
            btn.textContent = "Sent!";
        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }

        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 5000);
    }

    async handleManageSubscription() {
        const btn = document.getElementById('btnManageSubscription');
        const originalText = btn.innerHTML;

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Redirecting...';

        try {
            // Import callable
            const { httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js");

            const createPortalLink = httpsCallable(this.functions, 'ext-firestore-stripe-payments-createPortalLink');

            const { data } = await createPortalLink({
                returnUrl: window.location.href,
                locale: "auto",
                configuration: "bpc_1SuBgIHRcesBkcooaDR1kvNP"
            });

            console.log("[Portal] Callable response:", data);

            if (data.url) {
                // [NEW] Open in new window
                window.open(data.url, '_blank');

                // Reset button since we are opening in new tab
                btn.innerHTML = originalText;
                btn.disabled = false;
            } else {
                throw new Error("No URL returned from portal function.");
            }

        } catch (error) {
            console.error("Portal Error:", error);
            alert("Failed to redirect to portal: " + error.message);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}
