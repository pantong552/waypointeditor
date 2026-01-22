/**
 * Custom Drawing and Editing Manager
 * Replaces Leaflet-Draw. Handles creation, modification, and deletion of shapes/waypoints.
 */
class DrawingManager {
    constructor(map, app) {
        this.map = map;
        this.app = app; // Reference to WaypointMapApp

        // Layers
        this.drawnItems = app.drawnItems;
        this.waypointsLayer = app.waypointsLayer;
        this.editHandlesLayer = new L.FeatureGroup().addTo(this.map);

        // State
        this.currentMode = null; // 'polygon', 'polyline', 'marker'
        this.isDrawing = false;
        this.drawingPoints = [];
        this.tempLine = null;
        this.tempPoly = null;
        this.editingLayer = null;

        // 防止事件衝突的旗標
        this.ignoreNextClick = false;

        this.initToolbar();
        this.initMapEvents();
    }

    /**
     * 1. Initialize Custom Toolbar
     */
    initToolbar() {
        const CustomControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: () => {
                const container = L.DomUtil.create('div', 'custom-draw-toolbar leaflet-bar');

                // Polygon Button
                const polyBtn = L.DomUtil.create('button', 'custom-draw-btn', container);
                polyBtn.innerHTML = '<i class="bi bi-pentagon"></i>';
                polyBtn.title = 'Draw Polygon';
                L.DomEvent.on(polyBtn, 'click', (e) => this.toggleMode('polygon', polyBtn, e));

                // Square Button
                const squareBtn = L.DomUtil.create('button', 'custom-draw-btn', container);
                squareBtn.innerHTML = '<i class="bi bi-square"></i>';
                squareBtn.title = 'Draw Square';
                L.DomEvent.on(squareBtn, 'click', (e) => this.toggleMode('rectangle', squareBtn, e));

                // Circle Button
                const circleBtn = L.DomUtil.create('button', 'custom-draw-btn', container);
                circleBtn.innerHTML = '<i class="bi bi-circle"></i>';
                circleBtn.title = 'Draw Circle';
                L.DomEvent.on(circleBtn, 'click', (e) => this.toggleMode('circle', circleBtn, e));

                // Polyline Button
                const lineBtn = L.DomUtil.create('button', 'custom-draw-btn', container);
                lineBtn.innerHTML = '<i class="bi bi-share"></i>';
                lineBtn.title = 'Draw Polyline';
                L.DomEvent.on(lineBtn, 'click', (e) => this.toggleMode('polyline', lineBtn, e));

                // Waypoint Button
                const markerBtn = L.DomUtil.create('button', 'custom-draw-btn', container);
                markerBtn.innerHTML = '<i class="bi bi-geo-alt"></i>';
                markerBtn.title = 'Drop Waypoint';
                L.DomEvent.on(markerBtn, 'click', (e) => this.toggleMode('marker', markerBtn, e));

                L.DomEvent.disableClickPropagation(container);
                this.btns = {
                    polygon: polyBtn,
                    rectangle: squareBtn,
                    circle: circleBtn,
                    polyline: lineBtn,
                    marker: markerBtn
                };
                return container;
            }
        });
        this.map.addControl(new CustomControl());
    }

    /**
     * [Fix] 優化的切換模式方法，防止 btn undefined 錯誤
     */
    toggleMode(mode, btn, e) {
        if (e) {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
        }

        this.cancelDrawing();
        this.disableEdit();

        // 先移除所有按鈕的 active 樣式 (防止 btn 為 null 時操作 classList 報錯)
        Object.values(this.btns).forEach(b => b.classList.remove('active'));

        if (this.currentMode === mode || mode === null) {
            // 關閉模式 / 重置
            console.log('[Drawing] Mode deactivated');
            this.currentMode = null;
            this.map.getContainer().style.cursor = '';
        } else {
            // 開啟新模式
            console.log(`[Drawing] Mode activated: ${mode}`);
            this.currentMode = mode;
            if (btn) btn.classList.add('active'); // 安全檢查
            this.map.getContainer().style.cursor = 'crosshair';
            this.isDrawing = true;

            this.ignoreNextClick = true;
            setTimeout(() => this.ignoreNextClick = false, 100);
        }
    }

    cancelDrawing() {
        this.isDrawing = false;
        this.drawingPoints = [];
        if (this.tempLine) this.map.removeLayer(this.tempLine);
        if (this.tempPoly) this.map.removeLayer(this.tempPoly);
        if (this.tempRect) this.map.removeLayer(this.tempRect);
        if (this.tempCircle) this.map.removeLayer(this.tempCircle);
        this.tempLine = null;
        this.tempPoly = null;
        this.tempRect = null;
        this.tempCircle = null;
    }

    /**
     * 2. Map Events for Drawing & Exiting Edit
     */
    initMapEvents() {
        this.map.on('click', (e) => this.onMapClick(e));
        this.map.on('mousemove', (e) => this.onMouseMove(e));
        this.map.on('dblclick', (e) => this.onMapDoubleClick(e));
        this.map.on('mousedown', (e) => this.onMouseDown(e));
        this.map.on('mouseup', (e) => this.onMouseUp(e));

        this.map.doubleClickZoom.disable();
    }

    onMapClick(e) {
        if (this.ignoreNextClick) {
            this.ignoreNextClick = false;
            return;
        }

        // [Fix] Don't exit edit mode if we just finished dragging
        if (this.justDragged) {
            return;
        }

        // Exit edit mode if clicking empty space
        // 這裡確保如果正在編輯，絕對不會進入下方的 drawing 邏輯
        if (this.editingLayer) {
            this.disableEdit();
            return;
        }

        if (!this.isDrawing) return;

        // 防止點擊到自己的 UI 元素
        const targetClass = e.originalEvent.target.className;
        if (typeof targetClass === 'string' && (
            targetClass.includes('vertex-handle') ||
            targetClass.includes('ghost-handle') ||
            targetClass.includes('delete-feature-btn')
        )) {
            return;
        }

        // [New] Rectangle & Circle use Drag-to-Draw, so we ignore simple clicks for them
        // unless it is to clear selection or something else
        if (this.currentMode === 'rectangle' || this.currentMode === 'circle') {
            return;
        }

        if (this.currentMode === 'marker') {
            this.createMarker(e.latlng);
            this.toggleMode(null, null); // [Fix] 傳入 null 防止錯誤
            return;
        }

        this.drawingPoints.push(e.latlng);
        this.updateTempShape();
    }

    onMouseMove(e) {
        if (!this.isDrawing) return;

        // 1. Drag-to-Draw Logic (Rectangle & Circle)
        if (this.dragStartPoint) {
            if (this.currentMode === 'rectangle') {
                const bounds = L.latLngBounds(this.dragStartPoint, e.latlng);
                if (!this.tempRect) {
                    this.tempRect = L.rectangle(bounds, { color: '#0d6efd', dashArray: '5, 5', interactive: false }).addTo(this.map);
                } else {
                    this.tempRect.setBounds(bounds);
                }
            } else if (this.currentMode === 'circle') {
                const radius = this.dragStartPoint.distanceTo(e.latlng);
                if (!this.tempCircle) {
                    this.tempCircle = L.circle(this.dragStartPoint, { radius: radius, color: '#0d6efd', dashArray: '5, 5', interactive: false }).addTo(this.map);
                } else {
                    this.tempCircle.setRadius(radius);
                }
            }
            return;
        }

        if (this.drawingPoints.length === 0) return;

        const previewPoints = [...this.drawingPoints, e.latlng];

        if (!this.tempLine) {
            this.tempLine = L.polyline(previewPoints, { color: '#0d6efd', dashArray: '5, 5' }).addTo(this.map);
        } else {
            this.tempLine.setLatLngs(previewPoints);
        }

        if (this.currentMode === 'polygon' && this.drawingPoints.length >= 2) {
            if (!this.tempPoly) {
                this.tempPoly = L.polygon(previewPoints, { color: '#0d6efd', fillOpacity: 0.1, dashArray: '5, 5' }).addTo(this.map);
            } else {
                this.tempPoly.setLatLngs(previewPoints);
            }
        }
    }

    updateTempShape() {
        if (this.drawingPoints.length === 0) return;

        if (!this.tempLine) {
            this.tempLine = L.polyline(this.drawingPoints, { color: '#0d6efd', dashArray: '5, 5' }).addTo(this.map);
        } else {
            this.tempLine.setLatLngs(this.drawingPoints);
        }

        if (this.currentMode === 'polygon' && this.drawingPoints.length >= 3) {
            if (!this.tempPoly) {
                this.tempPoly = L.polygon(this.drawingPoints, { color: '#0d6efd', fillOpacity: 0.1, dashArray: '5, 5' }).addTo(this.map);
            } else {
                this.tempPoly.setLatLngs(this.drawingPoints);
            }
        }
    }

    onMouseDown(e) {
        if (!this.isDrawing) return;
        if (this.currentMode === 'rectangle' || this.currentMode === 'circle') {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            this.dragStartPoint = e.latlng;
            this.map.dragging.disable();
        }
    }

    onMouseUp(e) {
        if (!this.isDrawing || !this.dragStartPoint) return;

        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);

        try {
            if (this.currentMode === 'rectangle') {
                const bounds = L.latLngBounds(this.dragStartPoint, e.latlng);
                this.createRectangle(bounds);
            } else if (this.currentMode === 'circle') {
                const radius = this.dragStartPoint.distanceTo(e.latlng);
                this.createCircle(this.dragStartPoint, radius);
            }
        } catch (error) {
            console.error('[Drawing] Error in onMouseUp:', error);
        } finally {
            this.dragStartPoint = null;
            this.map.dragging.enable();

            // Force removal of temp layers to be sure
            if (this.tempRect) {
                this.map.removeLayer(this.tempRect);
                this.tempRect = null;
            }
            if (this.tempCircle) {
                this.map.removeLayer(this.tempCircle);
                this.tempCircle = null;
            }

            this.toggleMode(null, null); // Finish drawing
        }
    }

    onMapDoubleClick(e) {
        if (!this.isDrawing) return;

        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);

        if (this.currentMode === 'polygon' && this.drawingPoints.length >= 3) {
            this.createPolygon(this.drawingPoints);
        } else if (this.currentMode === 'polyline' && this.drawingPoints.length >= 2) {
            this.createPolyline(this.drawingPoints);
        }

        this.ignoreNextClick = true;
        setTimeout(() => this.ignoreNextClick = false, 300);

        // [Fix] 結束繪製時，傳入 null 作為 btn，避免 undefined 錯誤
        this.toggleMode(null, null);
    }

    /**
     * 3. Creation Logic
     */
    createPolygon(latlngs) {
        // [Fix] Filter duplicate points to prevent ghost handles at vertices
        const uniquePoints = this.cleanPoints(latlngs);
        console.log('[Drawing] Creating Polygon with points:', uniquePoints.length);
        const poly = L.polygon(uniquePoints, { color: '#0d6efd' }).addTo(this.drawnItems);
        this.registerShape(poly, 'polygon');
    }

    createPolyline(latlngs) {
        // [Fix] Filter duplicate points
        const uniquePoints = this.cleanPoints(latlngs);
        console.log('[Drawing] Creating Polyline with points:', uniquePoints.length);
        const line = L.polyline(uniquePoints, { color: '#0d6efd' }).addTo(this.drawnItems);
        this.registerShape(line, 'polyline');
    }

    /**
     * [Fix] Helper to remove adjacent duplicate points (often caused by double-click)
     */
    cleanPoints(latlngs) {
        if (latlngs.length < 2) return latlngs;
        return latlngs.filter((p, i) => {
            if (i === 0) return true;
            // Use Leaflet's equals with default tolerance
            return !p.equals(latlngs[i - 1]);
        });
    }

    createRectangle(bounds) {
        console.log('[Drawing] Creating Rectangle');
        const rect = L.rectangle(bounds, { color: '#0d6efd' }).addTo(this.drawnItems);
        this.registerShape(rect, 'rectangle');
    }

    createCircle(center, radius) {
        console.log('[Drawing] Creating Circle');
        const circle = L.circle(center, { radius: radius, color: '#0d6efd' }).addTo(this.drawnItems);
        this.registerShape(circle, 'circle');
    }

    createMarker(latlng) {
        console.log('[Drawing] Creating Waypoint marker');

        // [關鍵修正] 建立新點時，繼承全域設定 (Global Settings)
        // 否則這些值會是 undefined，導致 Popup 開啟時報錯
        const settings = this.app.settings;

        const wp = {
            lat: latlng.lat,
            lng: latlng.lng,
            index: this.app.waypoints.length,

            // 補上預設值
            altitude: settings.altitude || 60,
            speed: settings.speed || 5.5,
            heading: 0,
            gimbalAngle: settings.gimbalAngle || -90,
            actionGimbalPitch: settings.actionGimbalPitch || -75,
            action: settings.action || 'noAction'
        };

        this.app.waypoints.push(wp);
        this.app.renderWaypoints();
        this.app.saveState();
    }

    registerShape(layer, type, skipSave = false) { // [新增] skipSave 參數
        console.log(`[Drawing] Registering shape: ${type}, skipSave: ${skipSave}`);

        layer.on('dblclick', (e) => {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            this.enableEdit(layer, type);
        });

        layer.on('click', (e) => {
            if (this.isDrawing) {
                L.DomEvent.stopPropagation(e);
            }
        });

        this.app.shapes.push({ layer: layer, type: type });

        // [修改] 只有當不是還原過程時，才儲存狀態
        if (!skipSave) {
            console.log('[Drawing] Triggering app.saveState() from registerShape');
            this.app.saveState();
        } else {
            console.log('[Drawing] Skipped saveState (Restore/Undo action)');
        }
    }

    /**
     * 4. Edit Mode Logic
     */
    enableEdit(layer, type) {
        console.log('[Drawing] Enable Edit');
        // [Fix] 進入編輯模式前，強制取消任何繪圖狀態
        this.cancelDrawing();

        this.disableEdit();
        this.editingLayer = layer;
        this.editingType = type;

        layer.setStyle({ color: '#00d68f', dashArray: '5, 5' });

        this.renderHandles(layer, type);
        this.renderDeleteButton(layer);
    }

    disableEdit() {
        if (!this.editingLayer) return;
        console.log('[Drawing] Disable Edit & Save');

        this.editingLayer.setStyle({ color: '#0d6efd', dashArray: null });
        this.editHandlesLayer.clearLayers();
        this.editingLayer = null;
        this.app.saveState();
    }

    renderHandles(layer, type) {
        this.editHandlesLayer.clearLayers();

        if (type === 'rectangle') {
            this.renderRectangleHandles(layer);
            return;
        }
        if (type === 'circle') {
            this.renderCircleHandles(layer);
            return;
        }

        const latlngs = layer.getLatLngs();
        const points = type === 'polygon' ? latlngs[0] : latlngs;

        const vertexHandles = [];

        points.forEach((latlng, index) => {
            const handle = this.createHandle(latlng, 'vertex-handle');

            handle.on('drag', (e) => {
                L.DomEvent.stopPropagation(e);
                const newPos = e.target.getLatLng();
                points[index] = newPos;
                type === 'polygon' ? layer.setLatLngs([points]) : layer.setLatLngs(points);
                this.updateDeleteButtonPosition(layer);

                // [Fix] Update adjacent ghost handles in real-time
                if (handle.prevGhost) {
                    const prevIdx = (index - 1 + points.length) % points.length;
                    if (!(type === 'polyline' && index === 0)) {
                        const pPrev = points[prevIdx];
                        handle.prevGhost.setLatLng([(pPrev.lat + newPos.lat) / 2, (pPrev.lng + newPos.lng) / 2]);
                    }
                }
                if (handle.nextGhost) {
                    const nextIdx = (index + 1) % points.length;
                    if (!(type === 'polyline' && index === points.length - 1)) {
                        const pNext = points[nextIdx];
                        handle.nextGhost.setLatLng([(newPos.lat + pNext.lat) / 2, (newPos.lng + pNext.lng) / 2]);
                    }
                }
            });

            handle.on('dragend', () => this.renderHandles(layer, type));
            vertexHandles.push(handle);
            this.editHandlesLayer.addLayer(handle);
        });

        for (let i = 0; i < points.length; i++) {
            const nextIdx = (i + 1) % points.length;
            if (type === 'polyline' && i === points.length - 1) break;

            const p1 = points[i];
            const p2 = points[nextIdx];
            const midLat = (p1.lat + p2.lat) / 2;
            const midLng = (p1.lng + p2.lng) / 2;

            const ghost = this.createHandle([midLat, midLng], 'ghost-handle');

            // Link ghost to its flanking vertex handles
            vertexHandles[i].nextGhost = ghost;
            vertexHandles[nextIdx].prevGhost = ghost;

            ghost.on('dragstart', (e) => {
                L.DomEvent.stopPropagation(e);
                ghost.getElement().classList.remove('ghost-handle');
                ghost.getElement().classList.add('vertex-handle');
                points.splice(i + 1, 0, ghost.getLatLng());
            });

            ghost.on('drag', (e) => {
                L.DomEvent.stopPropagation(e);
                points[i + 1] = e.target.getLatLng();
                type === 'polygon' ? layer.setLatLngs([points]) : layer.setLatLngs(points);
                this.updateDeleteButtonPosition(layer);
            });

            ghost.on('dragend', () => this.renderHandles(layer, type));
            this.editHandlesLayer.addLayer(ghost);
        }
    }

    renderRectangleHandles(layer) {
        const latlngs = layer.getLatLngs()[0];
        const handles = [];

        // 1. Vertex Handles (Resize)
        latlngs.forEach((latlng, index) => {
            const handle = this.createHandle(latlng, 'vertex-handle');
            handle.index = index; // Important for syncing
            handles.push(handle);
            this.editHandlesLayer.addLayer(handle);

            handle.on('drag', (e) => {
                L.DomEvent.stopPropagation(e);
                const newPos = e.target.getLatLng();

                // Resize based on opposite corner
                const oppositeIdx = (index + 2) % 4;
                const oppositePoint = latlngs[oppositeIdx];
                const newBounds = L.latLngBounds(oppositePoint, newPos);

                layer.setBounds(newBounds);

                // Update all handles positions to match new bounds
                const newPoints = layer.getLatLngs()[0];
                handles.forEach((h, i) => h.setLatLng(newPoints[i]));

                this.updateDeleteButtonPosition(layer);
            });
        });

        // 2. Enable Body Drag
        this.makeDraggable(layer, handles);

        this.renderDeleteButton(layer);
    }

    renderCircleHandles(layer) {
        const center = layer.getLatLng();
        const bounds = layer.getBounds();
        const radiusPoint = L.latLng(bounds.getNorth(), center.lng);

        // 1. Radius Handle (Resize)
        const radiusHandle = this.createHandle(radiusPoint, 'vertex-handle');
        this.radiusHandle = radiusHandle; // Store ref for makeDraggable
        this.editHandlesLayer.addLayer(radiusHandle);

        radiusHandle.on('drag', (e) => {
            L.DomEvent.stopPropagation(e);
            const newPos = e.target.getLatLng();
            const newRadius = layer.getLatLng().distanceTo(newPos);
            layer.setRadius(newRadius);
            this.updateDeleteButtonPosition(layer);
        });

        // 2. Enable Body Drag
        this.makeDraggable(layer, [radiusHandle]);

        this.renderDeleteButton(layer);
    }

    createHandle(latlng, className) {
        const icon = L.divIcon({
            className: className,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });

        const marker = L.marker(latlng, {
            icon: icon,
            draggable: true
        });

        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
        });
        marker.on('dblclick', (e) => {
            L.DomEvent.stopPropagation(e);
        });
        marker.on('mousedown', (e) => {
            L.DomEvent.stopPropagation(e);
        });

        return marker;
    }

    /**
     * Helper to make a layer draggable by its body
     */
    makeDraggable(layer, handles = []) {
        console.log('[Drawing] makeDraggable init');
        let isDragging = false;
        let startPoint = null;
        let startLatLngs = null;
        let startCenter = null;

        layer.on('mousedown', (e) => {
            if (this.currentMode) return;
            if (!this.editingLayer) return; // Only if editing

            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);

            isDragging = true;
            startPoint = e.latlng;
            this.map.dragging.disable();

            if (layer instanceof L.Polygon) {
                // Deep copy latlngs
                startLatLngs = layer.getLatLngs().map(ring => ring.map(ll => L.latLng(ll.lat, ll.lng)));
            } else if (layer instanceof L.Circle) {
                startCenter = layer.getLatLng();
            }
        });

        this.map.on('mousemove', (e) => {
            if (!isDragging || !startPoint) return;

            const currentPoint = e.latlng;
            const latDiff = currentPoint.lat - startPoint.lat;
            const lngDiff = currentPoint.lng - startPoint.lng;

            if (layer instanceof L.Polygon) {
                // Polygon/Rectangle: Shift all points
                const newLatLngs = startLatLngs.map(ring => {
                    return ring.map(p => L.latLng(p.lat + latDiff, p.lng + lngDiff));
                });
                layer.setLatLngs(newLatLngs);

                // Sync handles
                if (handles.length > 0) {
                    const flatPoints = newLatLngs[0];
                    handles.forEach((h) => {
                        if (h.index !== undefined && flatPoints[h.index]) {
                            h.setLatLng(flatPoints[h.index]);
                        }
                    });
                }

            } else if (layer instanceof L.Circle) {
                const newCenter = L.latLng(startCenter.lat + latDiff, startCenter.lng + lngDiff);
                layer.setLatLng(newCenter);

                // Sync radius handle (it's separate from center)
                if (handles.length > 0) {
                    // For circle handles, we passed radiusHandle in array
                    // We need to re-calculate its position based on new center + radius (which shouldn't change)
                    // Or simpler: shift handle by same diff
                    handles.forEach(h => {
                        if (h._startPos) {
                            h.setLatLng([h._startPos.lat + latDiff, h._startPos.lng + lngDiff]);
                        } else {
                            // If we didn't store start pos, we can't easily shift. 
                            // Let's store start pos on mousedown for handles?
                            // Or just re-calc position from geometry if possible.
                            // For Radius handle: North point
                            if (h === this.radiusHandle) {
                                const bounds = layer.getBounds();
                                h.setLatLng(L.latLng(bounds.getNorth(), newCenter.lng));
                            }
                        }
                    });
                }
            }

            this.updateDeleteButtonPosition(layer);
        });

        this.map.on('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                startPoint = null;
                this.map.dragging.enable();
                this.app.saveState();
            }
        });
    }

    /**
     * 5. Delete Logic (Custom UI)
     */
    renderDeleteButton(layer) {
        // [Fix] Remove old delete button if it exists
        if (this.deleteBtnLayer) {
            this.editHandlesLayer.removeLayer(this.deleteBtnLayer);
            this.deleteBtnLayer = null;
        }

        this.deleteBtnLayer = L.marker([0, 0], {
            icon: L.divIcon({
                html: 'X',
                className: 'delete-feature-btn',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            }),
            interactive: true
        });

        this.deleteBtnLayer.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);

            this.ignoreNextClick = true;
            setTimeout(() => this.ignoreNextClick = false, 100);

            this.deleteCurrentFeature();
        });

        this.deleteBtnLayer.on('dblclick', L.DomEvent.stopPropagation);

        this.updateDeleteButtonPosition(layer);
        this.editHandlesLayer.addLayer(this.deleteBtnLayer);
    }

    updateDeleteButtonPosition(layer) {
        if (!this.deleteBtnLayer) return;
        const bounds = layer.getBounds();
        this.deleteBtnLayer.setLatLng(bounds.getNorthEast());
    }

    deleteCurrentFeature() {
        if (!this.editingLayer) return;
        console.log('[Drawing] Deleting current feature');

        this.map.removeLayer(this.editingLayer);
        this.app.shapes = this.app.shapes.filter(s => s.layer !== this.editingLayer);

        this.disableEdit();
        // saveState is called in disableEdit()
    }
}