/**
 * Waypoint Popup Manager
 * Handles the creation, lifecycle, and events of floating waypoint edit windows.
 */
class WaypointPopupManager {
    constructor(appInstance) {
        this.app = appInstance; // Reference to main WaypointMapApp
        this.openPopups = new Map(); // Key: Waypoint Index, Value: DOM Element
        this.highestZIndex = 2000;
        this.maxPopups = 5;
    }

    /**
     * Entry point to open or focus a popup
     */
    open(index) {
        // 1. 檢查是否已經開啟
        if (this.openPopups.has(index)) {
            const existingPopup = this.openPopups.get(index);
            this.bringToFront(existingPopup);
            this.highlight(existingPopup);
            return;
        }

        // 2. 檢查數量限制
        if (this.openPopups.size >= this.maxPopups) {
            alert(`Maximum ${this.maxPopups} popups allowed at the same time.`);
            return;
        }

        // 3. 創建視窗
        this.createPopup(index);
    }

    /**
     * Create the DOM element for the popup
     */
    createPopup(index) {
        const wp = this.app.waypoints[index];
        if (!wp) return;

        const popupId = `wp-popup-${index}`;
        const popupEl = document.createElement('div');

        // 使用與主程式一致的 CSS class
        popupEl.className = 'waypoint-popup modal-content bg-dark text-light border-secondary';
        popupEl.id = popupId;

        // 1. 設定每個視窗的偏移間距 (例如 30px)
        const offsetStep = 30;
        const count = this.openPopups.size;
        const totalOffset = count * offsetStep;

        // 2. 預估 Popup 的寬高 (根據 CSS 設定，寬度約 320-350px，高度視內容而定約 450px)
        const estimatedW = 340;
        const estimatedH = 480;

        // 3. 計算螢幕中央位置
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        const leftPos = (window.innerWidth - estimatedW) / 2 + scrollX + totalOffset;
        const topPos = (window.innerHeight - estimatedH) / 2 + scrollY + totalOffset;

        popupEl.style.left = `${leftPos}px`;
        popupEl.style.top = `${topPos}px`;

        // --- [修改結束] ---

        // HTML 模板
        popupEl.innerHTML = this.getPopupTemplate(index, wp);

        document.body.appendChild(popupEl);
        this.openPopups.set(index, popupEl);

        // --- 綁定事件 ---
        this.setupEvents(popupEl, index);
        this.bringToFront(popupEl);
    }

    /**
     * HTML Template Generator
     */
    getPopupTemplate(index, wp) {
        const actionGimbal = wp.actionGimbalPitch !== undefined ? wp.actionGimbalPitch : -75;

        return `
        <div class="modal-header border-secondary py-2">
            <h6 class="modal-title"><i class="bi bi-geo-alt-fill me-2"></i>Edit WP #${index}</h6>
            <button type="button" class="btn-close btn-close-white ms-auto" data-action="close"></button>
        </div>
        
        <div class="modal-body p-3">
            <div class="row g-2 mb-3">
                <div class="col-6">
                    <label class="form-label-xs text-secondary">Latitude</label>
                    <input type="number" name="lat" class="form-control form-control-sm bg-dark text-light border-secondary" step="0.000001" value="${wp.lat.toFixed(8)}">
                </div>
                <div class="col-6">
                    <label class="form-label-xs text-secondary">Longitude</label>
                    <input type="number" name="lng" class="form-control form-control-sm bg-dark text-light border-secondary" step="0.000001" value="${wp.lng.toFixed(8)}">
                </div>
            </div>
            <div class="border-top border-secondary my-2"></div>
            <div class="row g-2">
                <div class="col-4">
                    <label class="form-label-xs text-light">Alt (m)</label>
                    <input type="number" name="altitude" class="form-control form-control-sm bg-dark text-light border-secondary" value="${wp.altitude}">
                </div>
                <div class="col-4">
                    <label class="form-label-xs text-light">Speed</label>
                    <input type="number" name="speed" class="form-control form-control-sm bg-dark text-light border-secondary" value="${wp.speed}">
                </div>
                <div class="col-4">
                    <label class="form-label-xs text-light">Heading</label>
                    <input type="number" name="heading" class="form-control form-control-sm bg-dark text-light border-secondary" value="${wp.heading || 0}">
                </div>
                <div class="col-6 mt-2">
                    <label class="form-label-xs text-info">Cruising Gimbal</label>
                    <input type="number" name="gimbal" class="form-control form-control-sm bg-dark text-light border-secondary" value="${wp.gimbalAngle}">
                </div>
                <div class="col-6 mt-2">
                    <label class="form-label-xs text-warning">Shooting Gimbal</label>
                    <input type="number" name="actionGimbal" class="form-control form-control-sm bg-dark text-light border-secondary" value="${actionGimbal}">
                </div>
                <div class="col-12 mt-2">
                    <label class="form-label-xs text-light">Action</label>
                    <select name="action" class="form-select form-select-sm bg-dark text-light border-secondary">
                        <option value="noAction" ${wp.action === 'noAction' ? 'selected' : ''}>None</option>
                        <option value="takePhoto" ${wp.action === 'takePhoto' ? 'selected' : ''}>Take Photo</option>
                        <option value="startRecord" ${wp.action === 'startRecord' ? 'selected' : ''}>Start Recording</option>
                        <option value="stopRecord" ${wp.action === 'stopRecord' ? 'selected' : ''}>Stop Recording</option>
                        <option value="gimbalRotate" ${wp.action === 'gimbalRotate' ? 'selected' : ''}>Rotate Gimbal Only</option>
                    </select>
                </div>
                <div class="col-12 mt-2">
                    <label class="form-label-xs text-light">Turn Mode</label>
                    <select name="turnMode" class="form-select form-select-sm bg-dark text-light border-secondary">
                        ${(() => {
                const activeMode = wp.turnMode || this.app.settings.turnMode;
                return `
                                <option value="coordinateTurn" ${activeMode === 'coordinateTurn' ? 'selected' : ''}>Coordinate Turn</option>
                                <option value="toPointAndStopWithContinuityCurvature" ${activeMode === 'toPointAndStopWithContinuityCurvature' ? 'selected' : ''}>Stop & Turn (Curve)</option>
                                <option value="toPointAndStopWithDiscontinuityCurvature" ${activeMode === 'toPointAndStopWithDiscontinuityCurvature' ? 'selected' : ''}>Stop & Turn (Sharp)</option>
                                <option value="toPointAndPassWithContinuityCurvature" ${activeMode === 'toPointAndPassWithContinuityCurvature' ? 'selected' : ''}>Straight & Turn</option>
                            `;
            })()}
                    </select>
                </div>
            </div>
        </div>

        <div class="modal-footer border-secondary py-1">
            <button type="button" class="btn btn-danger btn-xs" data-action="delete">Delete</button>
            <button type="button" class="btn btn-primary btn-xs ms-auto" data-action="save">Save</button>
        </div>`;
    }

    /**
     * Setup Event Listeners
     */
    setupEvents(popupEl, index) {
        // 1. Dragging
        const header = popupEl.querySelector('.modal-header');
        this.makeDraggable(popupEl, header);

        // 2. Bring to front on click
        popupEl.addEventListener('mousedown', () => this.bringToFront(popupEl));

        // 3. Button Actions (Delegation)
        popupEl.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            const action = target.getAttribute('data-action');
            if (action === 'close') this.close(index);
            if (action === 'save') this.save(index, popupEl);
            if (action === 'delete') this.delete(index);
        });
    }

    /**
     * Make element draggable
     */
    makeDraggable(element, handle) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = element.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            handle.style.cursor = 'grabbing';
            document.body.style.cursor = 'grabbing';
            e.preventDefault();
        });

        const onMouseMove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            element.style.left = `${initialLeft + dx}px`;
            element.style.top = `${initialTop + dy}px`;
        };

        const onMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                handle.style.cursor = 'move';
                document.body.style.cursor = 'default';
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    /**
     * Bring popup to front
     */
    bringToFront(popupEl) {
        this.highestZIndex++;
        popupEl.style.zIndex = this.highestZIndex;
    }

    /**
     * Visual highlight effect
     */
    highlight(popupEl) {
        popupEl.style.borderColor = '#0d6efd';
        setTimeout(() => popupEl.style.borderColor = '', 300);
    }

    /**
     * Close a specific popup
     */
    close(index) {
        if (this.openPopups.has(index)) {
            const popupEl = this.openPopups.get(index);
            popupEl.remove();
            this.openPopups.delete(index);
        }
    }

    /**
     * Close all popups
     */
    closeAll() {
        this.openPopups.forEach((el) => el.remove());
        this.openPopups.clear();
    }

    /**
     * Update coordinates in the popup (used when dragging map marker)
     */
    updateCoordinates(index, lat, lng) {
        if (this.openPopups.has(index)) {
            const popupEl = this.openPopups.get(index);
            const latInput = popupEl.querySelector('[name="lat"]');
            const lngInput = popupEl.querySelector('[name="lng"]');
            if (latInput) latInput.value = lat.toFixed(8);
            if (lngInput) lngInput.value = lng.toFixed(8);
        }
    }

    /**
     * Save data from popup to app
     */
    save(index, popupEl) {
        const wp = this.app.waypoints[index];
        if (!wp) return;

        // Extract values
        wp.lat = parseFloat(popupEl.querySelector('[name="lat"]').value);
        wp.lng = parseFloat(popupEl.querySelector('[name="lng"]').value);
        wp.altitude = parseFloat(popupEl.querySelector('[name="altitude"]').value);
        wp.speed = parseFloat(popupEl.querySelector('[name="speed"]').value);
        wp.heading = parseFloat(popupEl.querySelector('[name="heading"]').value);
        wp.action = popupEl.querySelector('[name="action"]').value;
        wp.gimbalAngle = parseFloat(popupEl.querySelector('[name="gimbal"]').value);
        wp.actionGimbalPitch = parseFloat(popupEl.querySelector('[name="actionGimbal"]').value);
        wp.turnMode = popupEl.querySelector('[name="turnMode"]').value;

        // Call App Methods to refresh
        this.app.renderWaypoints();
        this.app.updateExportTab();
        this.app.saveState();

        // Visual Feedback
        const btn = popupEl.querySelector('[data-action="save"]');
        const originalText = btn.textContent;
        btn.textContent = 'Saved!';
        btn.classList.replace('btn-primary', 'btn-success');
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.replace('btn-success', 'btn-primary');
        }, 1000);
    }

    /**
     * Delete waypoint via popup
     */
    delete(index) {
        if (!confirm(`Delete Waypoint #${index}?`)) return;

        this.close(index);

        // Call App Method to delete data
        this.app.waypoints.splice(index, 1);

        // Since indices shift, we must close all others to avoid ID mismatch
        this.closeAll();

        // Re-index and refresh app
        this.app.waypoints.forEach((wp, i) => { wp.index = i; });
        this.app.renderWaypoints();
        this.app.updateExportTab();
        this.app.saveState();
    }
}