/**
 * WaypointMap Leaflet - Main Application
 * Complete DJI mission planning tool using Leaflet
 */

class WaypointMapApp {
    constructor() {
        // Map and UI elements
        this.map = null;
        this.drawnItems = new L.FeatureGroup();
        this.waypointsLayer = new L.FeatureGroup();
        this.footprintLayer = L.polygon([], { className: 'photo-footprint-preview' });

        // Heading Mode Change
        const headingMode = document.getElementById('headingMode');
        const headingInputDiv = document.getElementById('headingInputDiv');
        const headingAngleLabel = document.getElementById('headingAngleLabel');

        if (headingMode && headingInputDiv) {
            headingMode.addEventListener('change', () => {
                const isFixed = headingMode.value === 'fixed';
                headingInputDiv.style.display = isFixed ? 'block' : 'none';
                if (headingAngleLabel) {
                    headingAngleLabel.style.display = isFixed ? 'block' : 'none';
                }
            });
            // Init check
            headingMode.dispatchEvent(new Event('change'));
        }

        // Data storage
        this.waypoints = [];
        this.shapes = [];
        this.popupManager = null;
        this.selectedWaypoints = new Set();

        // State
        this.drawControl = null;
        this.currentDrawMode = null;
        this.isDrawing = false;
        this.unitMode = 'metric'; // 'metric' or 'imperial'

        this.calculator = new PhotogrammetryCalculator();

        // Settings
        this.settings = {
            units: 'metric',
            altitude: 60,
            speed: 5.5,
            spacing: 50,
            lineDirection: 'auto',
            overlap: 80,
            interval: 3,
            interval: 3,
            actionGimbalPitch: -75,  // Action Pitch (Command) - Shooting [UPDATED]
            action: 'noAction',
            turnMode: 'toPointAndStopWithContinuityCurvature',
            finalAction: 'hover',
            maintainAltitude: false,
            reversePath: false,
            droneEnumValue: 68
        };

        // Conversion factor
        this.M2FT = 3.28084;

    }

    /**
     * Initialize the application
     */
    async init() {
        this.popupManager = new WaypointPopupManager(this);
        this.initializeMap();
        this.drawingManager = new DrawingManager(this.map, this);
        this.setupControls();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();

        // [新增] 建立全域自製 Tooltip 元素
        this.createGlobalTooltip();

        this.updateUI();
        console.log('WaypointMap Leaflet initialized');

        if (window.historyManager) {
            console.log('[App] historyManager linked successfully');
            this.saveState();
        } else {
            console.error('[App] Critical Error: historyManager is missing!');
        }

        // 當地圖移動或縮放時，隱藏 Tooltip (避免浮在空中)
        this.map.on('move', () => this.hideCustomTooltip());
        this.map.on('zoom', () => this.hideCustomTooltip());
    }

    /**
     * Initialize Leaflet map with multiple basemaps
     */
    initializeMap() {
        // 定義香港的大致邊界範圍 (South-West, North-East)
        const hkBounds = [
            [22.15, 113.83],
            [22.57, 114.41]
        ];

        // 初始化地圖並自動縮放至香港
        this.map = L.map('map').fitBounds(hkBounds);

        // --- 1. 定義版權資訊 (Attributions) ---
        const osmAttr = { attribution: '&copy; OpenStreetMap contributors' };
        const esriAttr = { attribution: '&copy; Esri' };
        const cartoAttr = { attribution: '&copy; CARTO' };
        const googleAttr = { attribution: '&copy; Google' };
        const imageryAttr = { attribution: '&copy; HKSAR Government' };
        const landsdAttr = { attribution: '&copy; HKSAR Government' };

        // --- 2. 定義各個圖層 (Tile Layers) ---

        // OpenStreetMap
        const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            ...osmAttr, maxZoom: 19, minZoom: 2, crossOrigin: 'anonymous'
        });

        // Esri Satellite (World Imagery)
        const esriSatellite = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { ...esriAttr, crossOrigin: 'anonymous' }
        );

        // Carto Light & Dark (簡潔風格)
        const cartoLight = L.tileLayer(
            'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            { ...cartoAttr, crossOrigin: 'anonymous' }
        );
        const cartoDark = L.tileLayer(
            'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            { ...cartoAttr, crossOrigin: 'anonymous' }
        );

        // Google Maps 系列
        const googleStreets = L.tileLayer(
            'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
            { ...googleAttr, crossOrigin: 'anonymous' }
        );
        const googleSatellite = L.tileLayer(
            'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            { ...googleAttr, crossOrigin: 'anonymous' }
        );
        const googleHybrid = L.tileLayer(
            'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
            { ...googleAttr, crossOrigin: 'anonymous' }
        );
        const googleTerrain = L.tileLayer(
            'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
            { attribution: 'Map data ©2025 Google', crossOrigin: 'anonymous' }
        );

        // 香港政府地圖 (HK Geodata)
        const hkImageryLayer = L.tileLayer(
            'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/imagery/wgs84/{z}/{x}/{y}.png',
            { ...imageryAttr, minZoom: 0, maxZoom: 19, crossOrigin: 'anonymous' }
        );
        const hkVectorBase = L.tileLayer(
            'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/wgs84/{z}/{x}/{y}.png',
            { ...landsdAttr, maxZoom: 20, minZoom: 10, crossOrigin: 'anonymous' }
        );
        const hkVectorLabel = L.tileLayer(
            'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/label/hk/en/wgs84/{z}/{x}/{y}.png',
            { attribution: false, maxZoom: 20, minZoom: 0, crossOrigin: 'anonymous' }
        );
        const hkImageryLabel = L.tileLayer(
            'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/label/hk/en/wgs84/{z}/{x}/{y}.png',
            { attribution: false, maxZoom: 20, minZoom: 0, crossOrigin: 'anonymous' }
        );

        const hkVectorGroup = L.layerGroup([hkVectorBase, hkVectorLabel]);
        const hkImageryGroup = L.layerGroup([hkImageryLayer, hkImageryLabel]);

        this.map.on('zoomend', () => {
            const currentZoom = this.map.getZoom();
            if (currentZoom > 19 && this.map.hasLayer(hkImageryGroup)) {
                this.map.setZoom(19);
            }
        });

        // --- 3. 加入預設圖層 ---
        googleHybrid.addTo(this.map);

        // [新增] 建立 RFZ 圖層 (預設不顯示，但在列表中)
        const rfzLayer = L.geoJSON(null, {
            style: {
                color: '#ff0000', // Red border
                weight: 1,
                fillColor: '#ff0000',
                fillOpacity: 0.2
            },
            onEachFeature: (feature, layer) => {
                if (feature.properties) {
                    const name = feature.properties.name || 'Restricted Zone';
                    const desc = feature.properties.description || '';
                    const time = feature.properties.effectiveDateTime || '';
                    layer.bindPopup(`<b>${name}</b><br>${desc}<br><i>${time}</i>`);
                }
            }
        });

        /**
         * 載入 RFZ 資料的混合策略：
         * 1. 嘗試從網上 Proxy (dronemap.dev) 抓取最新資料。
         * 2. 若成功，在前端進行解析 (Client-side Parsing)。
         * 3. 若失敗 (CORS/Network Error)，降級讀取本地 rfz.geojson / esua_rfz.geojson。
         */
        const loadRFZData = async () => {
            const PROXY_URL = 'https://map.dronemap.dev/rfz-proxy.php';

            try {
                console.log('[App] Trying to fetch remote RFZ data...');
                const response = await fetch(PROXY_URL, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                });

                if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);

                const data = await response.json();
                if (data.resultCode !== 0) throw new Error('API returned error code');

                // === Client-side Parsing Logic ===
                const rfzFeaturesRaw = data.data?.rfzFeatures || [];
                const allFeatures = [];

                rfzFeaturesRaw.forEach(featureStr => {
                    try {
                        const featureCollection = JSON.parse(featureStr);
                        if (featureCollection.type === 'FeatureCollection') {
                            allFeatures.push(...featureCollection.features);
                        } else if (featureCollection.type === 'Feature') {
                            allFeatures.push(featureCollection);
                        }
                    } catch (e) {
                        console.warn('[App] Failed to parse RFZ feature string:', e);
                    }
                });

                rfzLayer.addData({ type: 'FeatureCollection', features: allFeatures });
                console.log('[App] Loaded RFZ data from REMOTE PROXY:', allFeatures.length, 'features');

            } catch (err) {
                console.warn('[App] Remote fetch failed, falling back to local file:', err);

                // Fallback to local files
                // 優先嘗試 esua_rfz.geojson (較新)，否則 rfz.geojson
                const localFiles = ['esua_rfz.geojson', 'rfz.geojson'];

                for (const file of localFiles) {
                    try {
                        const res = await fetch(file);
                        if (res.ok) {
                            const data = await res.json();
                            rfzLayer.addData(data);
                            console.log(`[App] Loaded RFZ data from LOCAL FILE (${file}):`, data.features?.length);
                            break; // 成功讀取一個就停止
                        }
                    } catch (e) {
                        console.log(`[App] Local file ${file} not found or invalid.`);
                    }
                }
            }
        };

        // 啟動載入
        loadRFZData();


        // --- 4. 建立圖層切換控制項 (Layer Control) ---
        const baseLayers = {
            'OpenStreetMap': streets,
            'Esri Satellite': esriSatellite,
            'Carto Light': cartoLight,
            'Carto Dark': cartoDark,
            'Google Streets': googleStreets,
            'Google Satellite': googleSatellite,
            'Google Hybrid': googleHybrid,
            'Google Terrain': googleTerrain,
            'HK Vector': hkVectorGroup,
            'HK Imagery': hkImageryGroup,
        };

        const overlays = {
            "Waypoints": this.waypointsLayer,
            "Drawings": this.drawnItems,
            "Drone Map RFZ": rfzLayer
        };

        this.layersControl = L.control.layers(baseLayers, overlays, { position: 'topright' }).addTo(this.map);

        // --- 5. 加入應用程式功能圖層 ---
        this.map.addLayer(this.drawnItems);
        this.map.addLayer(this.waypointsLayer);

    }

    /**
     * Setup UI controls
     */
    setupControls() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        const resetBtn = document.getElementById('resetBtn');
        const helpBtn = document.getElementById('helpBtn');
        const generateAdvancedBtn = document.getElementById('generateFromAdvanced');
        const downloadKmzBtn = document.getElementById('downloadKmz');
        const downloadJsonBtn = document.getElementById('downloadJson');
        const saveWaypointBtn = document.getElementById('saveWaypointBtn');
        const deleteWaypointBtn = document.getElementById('deleteWaypointBtn');

        undoBtn?.addEventListener('click', () => this.undo());
        redoBtn?.addEventListener('click', () => this.redo());
        resetBtn?.addEventListener('click', () => this.reset());
        helpBtn?.addEventListener('click', () => this.showHelp());
        generateAdvancedBtn?.addEventListener('click', () => this.generateFromAdvanced());
        downloadKmzBtn?.addEventListener('click', async () => await this.downloadKMZ());
        downloadJsonBtn?.addEventListener('click', () => this.downloadJSON());
        saveWaypointBtn?.addEventListener('click', () => this.saveWaypoint());
        deleteWaypointBtn?.addEventListener('click', () => this.deleteWaypoint());

        // 1. 初始化 Drone Dropdown
        const droneSelect = document.getElementById('droneModel');
        const cameraSelect = document.getElementById('cameraModel');
        const calcBtn = document.getElementById('btnAutoCalc');

        if (droneSelect) {
            // 清空並加入選項
            droneSelect.innerHTML = '<option value="" disabled selected>Select Drone</option>';
            for (const [key, drone] of Object.entries(DJI_DRONES)) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = drone.name;
                droneSelect.appendChild(option);
            }

            // 2. 監聽 Drone 改變
            droneSelect.addEventListener('change', (e) => {
                const droneKey = e.target.value;
                const cameras = this.calculator.getCameras(droneKey);

                // 更新 Settings 裡的 EnumValue
                this.settings.droneEnumValue = this.calculator.getDroneEnum(droneKey);

                // 重置 Camera Select
                cameraSelect.innerHTML = '<option value="" disabled selected>Select Camera</option>';
                cameraSelect.disabled = false;
                calcBtn.disabled = true; // 先 disable 按鈕，直到選了相機

                // 填入 Camera 選項
                for (const [camKey, cam] of Object.entries(cameras)) {
                    const option = document.createElement('option');
                    option.value = camKey;
                    option.textContent = cam.name;
                    cameraSelect.appendChild(option);
                }

                // 如果只有一個鏡頭，自動選取
                const camKeys = Object.keys(cameras);
                if (camKeys.length === 1) {
                    cameraSelect.value = camKeys[0];
                    cameraSelect.dispatchEvent(new Event('change'));
                }
            });

            // 3. 監聽 Camera 改變 -> 啟用按鈕
            cameraSelect.addEventListener('change', () => {
                calcBtn.disabled = false;
            });
        }

        // [新增] 綁定 Photogrammetry 計算按鈕
        document.getElementById('btnAutoCalc')?.addEventListener('click', () => this.applyPhotogrammetrySettings());

        this.updateSettingsFromForm();
        document.getElementById('units')?.addEventListener('change', () => this.changeUnits());
        document.getElementById('advancedForm')?.addEventListener('input', () => this.updateSettingsFromForm());

    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        document.getElementById('units')?.addEventListener('change', (e) => {
            this.unitMode = e.target.value;
            this.updateUnitsDisplay();
        });

        document.querySelectorAll('[data-bs-toggle="tab"]').forEach(btn => {
            btn.addEventListener('shown.bs.tab', () => this.onTabChange());
        });

        document.getElementById('turnMode')?.addEventListener('change', (e) => {
            const mode = e.target.value;
            const helpText = document.getElementById('turnModeHelp');
            const descriptions = {
                'toPointAndStopWithContinuityCurvature': '以曲線路徑入彎並在點上停下 (適合一般航拍)。',
                'coordinateTurn': '平滑飛過航點，提前切角不停頓 (適合省電/快速飛行)。',
                'toPointAndStopWithDiscontinuityCurvature': '直線飛到點，急停，調整方向 (適合精確測繪)。',
                'toPointAndPassWithContinuityCurvature': '精確經過航點，不停頓 (適合連續錄影)。'
            };
            if (helpText) helpText.textContent = descriptions[mode] || '';
            this.updateSettingsFromForm();
            this.drawWaypointPath();
            this.saveState();
        });

        this.waypointsLayer.on('click', (e) => {
            if (e.layer instanceof L.Marker) {
                this.editWaypoint(e.layer);
            }
        });

        this.setupHeadingUI();
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

            const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
            const modKey = isMac ? e.metaKey : e.ctrlKey;

            // Undo: Ctrl + Z
            if (modKey && !e.shiftKey && e.key === 'z') {
                e.preventDefault();
                this.undo();
            }
            // Redo: Ctrl + Alt + Z (Windows) OR Cmd + Shift + Z (Mac Standard)
            // [修改] 加入 e.altKey 檢查
            else if ((modKey && e.altKey && e.key === 'Z') || (modKey && e.shiftKey && e.key === 'z')) {
                e.preventDefault();
                this.redo();
            }
            // Select All: Ctrl + A
            else if (modKey && e.key === 'a') {
                e.preventDefault();
                this.selectAllWaypoints();
            }
            // Delete
            else if (e.key === 'Delete' || e.key === 'Backspace') {
                this.deleteSelectedWaypoints();
            }
            // Tools: Ctrl + 1, 2, 3
            else if (modKey && e.key === '1') {
                e.preventDefault();
                this.drawingManager.btns.polygon.click();
            } else if (modKey && e.key === '2') {
                e.preventDefault();
                this.drawingManager.btns.polyline.click();
            } else if (modKey && e.key === '3') {
                e.preventDefault();
                this.drawingManager.btns.marker.click();
            }
        });
    }

    /**
     * Generate waypoints from advanced settings
     */
    async generateFromAdvanced() {
        this.updateSettingsFromForm();

        // [Free Version Restriction]
        if (window.isFreeVersion) {
            console.log('[App] Free Version: Enforcing restrictions');
            // Force interval to be huge so no intermediate points are generated
            this.settings.interval = 100000;
            // Force Turn Mode to default
            this.settings.turnMode = 'toPointAndStopWithContinuityCurvature';
        }

        await this.generateWaypoints();
    }

    /**
     * Calculate bearing between two points
     */
    calculateBearing(lat1, lng1, lat2, lng2) {
        const toRad = (deg) => deg * Math.PI / 180;
        const toDeg = (rad) => rad * 180 / Math.PI;

        const φ1 = toRad(lat1);
        const φ2 = toRad(lat2);
        const Δλ = toRad(lng2 - lng1);

        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

        const θ = Math.atan2(y, x);
        return (toDeg(θ) + 360) % 360;
    }

    setupHeadingUI() {
        const modeSelect = document.getElementById('headingMode');
        const inputDiv = document.getElementById('headingInputDiv');
        const label = document.getElementById('headingAngleLabel');

        const updateVisibility = () => {
            const isFixed = modeSelect.value === 'fixed';
            inputDiv.style.display = isFixed ? 'block' : 'none';
            if (label) label.style.display = isFixed ? 'block' : 'none';
        };

        if (modeSelect && inputDiv) {
            modeSelect.addEventListener('change', updateVisibility);
            updateVisibility();
        }
    }

    /**
     * Main waypoint generation algorithm
     */
    async generateWaypoints() {
        if (this.shapes.length === 0) {
            await MessageBox.alert('Please draw a shape first!', 'Missing Shape');
            return;
        }

        this.clearWaypoints();

        for (let i = 0; i < this.shapes.length; i++) {
            const shape = this.shapes[i];
            const newPoints = await this.generateWaypointsForShape(shape.layer, shape.type);

            // Calculate Stats for this shape (Flight Distance & Time)
            let shapeDist = 0;
            if (newPoints.length > 1) {
                for (let j = 0; j < newPoints.length - 1; j++) {
                    const p1 = L.latLng(newPoints[j].lat, newPoints[j].lng);
                    const p2 = L.latLng(newPoints[j + 1].lat, newPoints[j + 1].lng);
                    shapeDist += p1.distanceTo(p2);
                }
            }
            const shapeTime = this.settings.speed > 0 ? shapeDist / this.settings.speed : 0; // Simple flight time

            // Update Mission Label
            if (shape.layer.missionLabelAnchor) {
                // [New] Update using DrawingManager helper
                this.drawingManager.updateLabelStats(shape.layer, shapeDist, shapeTime);
            }

            // [New] Assign mission index to points for tracking
            newPoints.forEach(p => p.missionIndex = i);

            this.waypoints.push(...newPoints);
        }

        if (this.settings.reversePath) {
            this.waypoints.reverse();
        }

        const headingMode = document.getElementById('headingMode')?.value || 'auto';
        const fixedHeading = parseFloat(document.getElementById('headingAngle')?.value || 0);

        this.waypoints.forEach((wp, index) => {
            wp.altitude = this.settings.altitude;
            wp.speed = this.settings.speed;

            // [UPDATED] Assign new Gimbal Params
            wp.actionGimbalPitch = this.settings.actionGimbalPitch; // Shooting Pitch

            wp.action = this.settings.action;
            wp.index = index;

            if (headingMode === 'fixed') {
                wp.heading = fixedHeading;
            } else {
                if (index < this.waypoints.length - 1) {
                    const nextWp = this.waypoints[index + 1];
                    wp.heading = this.calculateBearing(wp.lat, wp.lng, nextWp.lat, nextWp.lng);
                } else {
                    if (index > 0) {
                        wp.heading = this.waypoints[index - 1].heading;
                    } else {
                        wp.heading = 0;
                    }
                }
            }
        });

        this.renderWaypoints();
        this.updateExportTab();
        this.saveState();

        console.log(`Generated ${this.waypoints.length} waypoints`);
    }

    /**
     * Get bounds of a shape
     */
    getShapeBounds(layer) {
        if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
            let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
            let found = false;

            const traverse = (obj) => {
                if (Array.isArray(obj)) {
                    obj.forEach(traverse);
                } else if (obj && typeof obj.lat === 'number' && typeof obj.lng === 'number') {
                    minLat = Math.min(minLat, obj.lat);
                    maxLat = Math.max(maxLat, obj.lat);
                    minLng = Math.min(minLng, obj.lng);
                    maxLng = Math.max(maxLng, obj.lng);
                    found = true;
                }
            };

            traverse(layer.getLatLngs());

            if (!found) {
                return { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 };
            }
            return { minLat, maxLat, minLng, maxLng };

        } else if (layer instanceof L.Circle) {
            const center = layer.getLatLng();
            const radius = layer.getRadius();
            const latDelta = radius / 111000;
            const lngDelta = radius / (111000 * Math.cos(center.lat * Math.PI / 180));
            return {
                minLat: center.lat - latDelta,
                maxLat: center.lat + latDelta,
                minLng: center.lng - lngDelta,
                maxLng: center.lng + lngDelta
            };
        } else if (layer instanceof L.Marker) {
            const latlng = layer.getLatLng();
            return { minLat: latlng.lat, maxLat: latlng.lat, minLng: latlng.lng, maxLng: latlng.lng };
        }
        return { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 };
    }

    /**
     * Check if a point is inside a specific layer
     */
    isPointInsideShape(lat, lng, layer, shapeType) {
        if (shapeType === 'circle') {
            const center = layer.getLatLng();
            const radius = layer.getRadius();
            const distance = this.map.distance([lat, lng], center);
            return distance <= radius;
        } else if (shapeType === 'polygon' || shapeType === 'rectangle') {
            let polyPoints = layer.getLatLngs();
            while (Array.isArray(polyPoints) && polyPoints.length > 0) {
                const firstItem = polyPoints[0];
                if (firstItem && typeof firstItem.lat !== 'undefined') {
                    break;
                }
                if (Array.isArray(firstItem)) {
                    polyPoints = firstItem;
                } else {
                    return false;
                }
            }

            if (polyPoints.length < 3) return false;

            let x = lat, y = lng;
            let inside = false;
            for (let i = 0, j = polyPoints.length - 1; i < polyPoints.length; j = i++) {
                let xi = polyPoints[i].lat, yi = polyPoints[i].lng;
                let xj = polyPoints[j].lat, yj = polyPoints[j].lng;

                let intersect = ((yi > y) !== (yj > y)) &&
                    (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        }
        return true;
    }

    /**
     * Generate waypoints for a shape using lawn mowing pattern
     * [Modified] Distinguish between Line Spacing (Side Overlap) and Point Spacing (Front Overlap)
     */
    /**
     * Helper to calculate total distance of a waypoint path
     */
    calculateTotalPathDistance(waypoints) {
        if (waypoints.length < 2) return 0;
        let totalDist = 0;
        for (let i = 0; i < waypoints.length - 1; i++) {
            totalDist += this.map.distance(
                [waypoints[i].lat, waypoints[i].lng],
                [waypoints[i + 1].lat, waypoints[i + 1].lng]
            );
        }
        return totalDist;
    }

    async generateFromAdvanced() {
        this.updateSettingsFromForm();

        // [Free Version Restriction]
        if (window.isFreeVersion) {
            console.log('[App] Free Version: Enforcing restrictions');
            // Force settings for Free Version
            this.settings.turnMode = 'toPointAndStopWithContinuityCurvature';
            // Note: We do NOT force large interval here anymore. 
            // We generate full points and filter them later.
        }

        await this.generateWaypoints();
    }

    /**
     * Helper to approximate a circle as a polygon
     */
    getCirclePolygonCoordinates(circle, sides = 64) {
        const center = circle.getLatLng();
        const radius = circle.getRadius();
        const points = [];
        const R = 6378137; // Earth radius in meters

        for (let i = 0; i < sides; i++) {
            const angle = (i * 360 / sides) * (Math.PI / 180);
            const dx = radius * Math.cos(angle);
            const dy = radius * Math.sin(angle);

            const dLat = (dy / R) * (180 / Math.PI);
            const dLng = (dx / (R * Math.cos(center.lat * Math.PI / 180))) * (180 / Math.PI);

            points.push({
                lat: center.lat + dLat,
                lng: center.lng + dLng
            });
        }
        return points;
    }

    /**
     * Generate waypoints for a shape using external API or Local Calculator
     */
    async generateWaypointsForShape(layer, shapeType) {
        const bounds = this.getShapeBounds(layer);
        if (bounds.minLat > bounds.maxLat || bounds.minLng > bounds.maxLng) return [];

        // Prepare Coordinates
        let coordinates = [];
        if (typeof layer.getLatLngs === 'function') {
            const latlngs = layer.getLatLngs();
            const ring = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
            coordinates = ring.map(ll => ({ lat: ll.lat, lng: ll.lng }));
        } else if (typeof layer.getLatLng === 'function' && typeof layer.getRadius === 'function') {
            coordinates = this.getCirclePolygonCoordinates(layer);
        }

        // Prepare Settings
        const settings = {
            lineDirection: this.settings.lineDirection,
            spacing: this.settings.spacing,
            speed: this.settings.speed,
            interval: this.settings.interval,
            angle: this.settings.angle
        };

        let generatedPoints = [];

        try {
            // Check if we should use Local Calculator (localhost or file protocol)
            const isLocal = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.protocol === 'file:';

            if (isLocal && window.WaypointCalculator) {
                console.log('[App] Using Local Calculator (Offline Mode)');
                const calculator = new window.WaypointCalculator();
                generatedPoints = calculator.generateWaypoints(coordinates, settings);
            } else {
                // Use Remote API
                const API_URL = 'https://waypoint-api-rho.vercel.app/'; // Or your deployed API
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ coordinates, settings })
                });

                if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
                const data = await response.json();
                generatedPoints = data.waypoints || [];
            }

            // [Free Version Filter]
            // Keep only turning points (Start of line, End of line)
            // The calculator generates lines. We can detect turning points by checking heading changes,
            // or simply by assuming the calculator output structure (it usually outputs lines).
            // A robust way extracting turning points: index 0 and significant heading changes.
            if (window.isFreeVersion && generatedPoints.length > 0) {
                console.log(`[App] Free Version: Filtering ${generatedPoints.length} points to turning points only.`);
                const filtered = [];

                // Always keep first point
                filtered.push(generatedPoints[0]);

                for (let i = 1; i < generatedPoints.length - 1; i++) {
                    const prev = generatedPoints[i - 1];
                    const curr = generatedPoints[i];
                    const next = generatedPoints[i + 1];

                    // Calculate headings
                    const h1 = this.calculateBearing(prev.lat, prev.lng, curr.lat, curr.lng);
                    const h2 = this.calculateBearing(curr.lat, curr.lng, next.lat, next.lng);

                    // If heading changes significantly (> 1 degree), it's a turn
                    const diff = Math.abs(h1 - h2);
                    if (diff > 1.0) {
                        filtered.push(curr);
                    }
                }

                // Always keep last point
                if (generatedPoints.length > 1) {
                    filtered.push(generatedPoints[generatedPoints.length - 1]);
                }

                generatedPoints = filtered;
            }

            return generatedPoints;

        } catch (error) {
            console.error('Failed to generate waypoints:', error);
            await MessageBox.alert('Failed to generate waypoints. ' + error.message, 'Generation Error');
            return [];
        }
    }

    /**
     * [Legacy/Removed] Local calculation methods were moved to API.
     * _generatePathForAngle, _projectToLocal, etc. are no longer used here.
     */


    /**
     * Convert distance to meters based on unit setting
     */
    convertToMeters(value) {
        if (this.settings.units === 'imperial') {
            return value / this.M2FT;
        }
        return value;
    }

    /**
     * Convert meters to display units
     */
    convertFromMeters(meters) {
        if (this.settings.units === 'imperial') {
            return meters * this.M2FT;
        }
        return meters;
    }

    /**
     * [新增] 建立全域唯一的 Tooltip DOM
     */
    createGlobalTooltip() {
        if (!document.getElementById('custom-map-tooltip')) {
            const tooltip = document.createElement('div');
            tooltip.id = 'custom-map-tooltip';
            document.body.appendChild(tooltip);
            this.customTooltip = tooltip;
        } else {
            this.customTooltip = document.getElementById('custom-map-tooltip');
        }
    }

    /**
     * [新增] 隱藏 Tooltip
     */
    hideCustomTooltip() {
        if (this.customTooltip) {
            this.customTooltip.style.display = 'none';
        }
    }

    /**
     * [新增] 顯示並定位 Tooltip (核心邏輯移植到這裡)
     */
    updateCustomTooltip(marker, wp, index) {
        if (!this.customTooltip) return;

        // 1. 生成內容 HTML
        const formatAction = (act) => {
            const map = {
                'noAction': 'None', 'takePhoto': 'Take Photo',
                'startRecord': 'Start Rec', 'stopRecord': 'Stop Rec',
                'gimbalRotate': 'Gimbal Only'
            };
            return map[act] || act;
        };

        const heading = wp.heading !== undefined ? wp.heading : 0;

        this.customTooltip.innerHTML = `
            <div class="tooltip-header">
                <i class="bi bi-geo-alt-fill me-2"></i> Waypoint ${index + 1}
            </div>
            <div class="tooltip-body">
                <div class="tooltip-row">
                    <span class="tooltip-label">Lat</span>
                    <span class="tooltip-value">${wp.lat.toFixed(7)}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Lng</span>
                    <span class="tooltip-value">${wp.lng.toFixed(7)}</span>
                </div>
                <div class="border-bottom border-secondary my-1 opacity-25"></div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Alt</span>
                    <span class="tooltip-value">${wp.altitude} m</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Speed</span>
                    <span class="tooltip-value">${wp.speed} m/s</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Heading</span>
                    <span class="tooltip-value">${Math.round(heading)}°</span>
                </div>
                <div class="border-bottom border-secondary my-1 opacity-25"></div>

                <div class="tooltip-row">
                    <span class="tooltip-label"><i class="bi bi-camera-video me-1"></i>Action</span>
                    <span class="tooltip-value text-warning">${wp.actionGimbalPitch !== undefined ? wp.actionGimbalPitch : -75}°</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Turn Mode</span>
                    <span class="tooltip-value small">${(() => {
                const mode = wp.turnMode || this.settings.turnMode;
                const map = {
                    'coordinateTurn': 'Coordinate Turn',
                    'toPointAndStopWithContinuityCurvature': 'Stop & Turn (Curve)',
                    'toPointAndStopWithDiscontinuityCurvature': 'Stop & Turn (Sharp)',
                    'toPointAndPassWithContinuityCurvature': 'Straight & Turn'
                };
                return map[mode] || mode;
            })()}</span>
                </div>
                <div class="tooltip-row mt-1">
                    <span class="tooltip-label">Task</span>
                    <span class="tooltip-value action-highlight">${formatAction(wp.action)}</span>
                </div>
            </div>
        `;

        // 2. 準備定位計算
        const mapSize = this.map.getSize();
        const markerP = this.map.latLngToContainerPoint([wp.lat, wp.lng]);
        // 加上地圖容器的 offset (因為 tooltip 是 append 到 body 的)
        const mapRect = this.map.getContainer().getBoundingClientRect();

        // 修正 markerP 為相對於 viewport 的絕對座標
        const absMarkerX = markerP.x + mapRect.left;
        const absMarkerY = markerP.y + mapRect.top;

        const tw = 220; // 寬度
        const th = 300; // 預估高度
        const pad = 20;
        const iconR = 25;

        // 檢查是否有 Footprint
        let footprintPoints = null;
        if (this.footprintLayer && this.footprintLayer.getLatLngs().length > 0) {
            // 將 Footprint 經緯度轉為 螢幕絕對座標
            footprintPoints = this.footprintLayer.getLatLngs()[0].map(latlng => {
                const p = this.map.latLngToContainerPoint(latlng);
                return { x: p.x + mapRect.left, y: p.y + mapRect.top };
            });
        }

        // 定義四個方向候選
        const candidates = [
            { dir: 'top', dx: 0, dy: -1 },
            { dir: 'bottom', dx: 0, dy: 1 },
            { dir: 'left', dx: -1, dy: 0 },
            { dir: 'right', dx: 1, dy: 0 }
        ];

        candidates.forEach(c => {
            let requiredDist = iconR;

            if (footprintPoints) {
                const minX = Math.min(...footprintPoints.map(p => p.x));
                const maxX = Math.max(...footprintPoints.map(p => p.x));
                const minY = Math.min(...footprintPoints.map(p => p.y));
                const maxY = Math.max(...footprintPoints.map(p => p.y));

                // 計算相對於 Marker 中心的距離需求
                if (c.dir === 'top') requiredDist = Math.max(requiredDist, absMarkerY - minY);
                if (c.dir === 'bottom') requiredDist = Math.max(requiredDist, maxY - absMarkerY);
                if (c.dir === 'left') requiredDist = Math.max(requiredDist, absMarkerX - minX);
                if (c.dir === 'right') requiredDist = Math.max(requiredDist, maxX - absMarkerX);
            }

            c.offsetDist = requiredDist + pad;

            // 計算 Tooltip 的 left/top (相對於 window/body)
            // 這裡不使用 Leaflet offset，而是直接算 CSS left/top
            if (c.dir === 'top') {
                c.cssLeft = absMarkerX - tw / 2;
                c.cssTop = absMarkerY - c.offsetDist - th;
            } else if (c.dir === 'bottom') {
                c.cssLeft = absMarkerX - tw / 2;
                c.cssTop = absMarkerY + c.offsetDist;
            } else if (c.dir === 'left') {
                c.cssLeft = absMarkerX - c.offsetDist - tw;
                c.cssTop = absMarkerY - th / 2;
            } else if (c.dir === 'right') {
                c.cssLeft = absMarkerX + c.offsetDist;
                c.cssTop = absMarkerY - th / 2;
            }

            // 檢查是否在視窗範圍內 (Viewport)
            const winW = window.innerWidth;
            const winH = window.innerHeight;

            c.inBounds = (
                c.cssLeft >= 0 &&
                c.cssTop >= 0 &&
                (c.cssLeft + tw) <= winW &&
                (c.cssTop + th) <= winH
            );
        });

        // 選擇最佳位置
        let validCandidates = candidates.filter(c => c.inBounds);
        if (validCandidates.length === 0) validCandidates = candidates;
        validCandidates.sort((a, b) => a.offsetDist - b.offsetDist);
        const best = validCandidates[0];

        // 3. 套用樣式與顯示
        this.customTooltip.style.left = `${best.cssLeft}px`;
        this.customTooltip.style.top = `${best.cssTop}px`;
        this.customTooltip.setAttribute('data-direction', best.dir); // 讓 CSS 畫箭頭
        this.customTooltip.style.display = 'block';
    }

    /**
     * [新增] 輔助方法：計算並更新 Footprint
     */
    updateFootprint(wp) {
        // 如果不是拍照動作，或沒有選擇無人機/相機，則清空 Footprint
        if (wp.action !== 'takePhoto') {
            this.footprintLayer.setLatLngs([]);
            return;
        }

        const droneKey = document.getElementById('droneModel')?.value;
        const cameraKey = document.getElementById('cameraModel')?.value;

        if (droneKey && cameraKey) {
            // 使用 calculator 計算投影範圍
            const footprint = this.calculator.calculateProjectedFootprint(droneKey, cameraKey, wp);
            if (footprint) {
                this.footprintLayer.setLatLngs(footprint);
            } else {
                this.footprintLayer.setLatLngs([]);
            }
        } else {
            this.footprintLayer.setLatLngs([]);
        }
    }

    /**
     * Render waypoints on map
     * [Modified] Uses Global Custom Tooltip DOM (No L.Tooltip)
     */
    renderWaypoints() {
        this.waypointsLayer.clearLayers();

        // Ensure Preview Layer exists
        if (!this.map.hasLayer(this.footprintLayer)) {
            this.footprintLayer.addTo(this.map);
        }
        this.footprintLayer.setLatLngs([]);

        this.waypoints.forEach((wp, index) => {
            const heading = wp.heading !== undefined ? wp.heading : 0;
            const marker = L.marker([wp.lat, wp.lng], {
                icon: this.getWaypointIcon(index, heading),
                draggable: true // [已確認] 允許拖曳
            });

            // [新增] 拖曳開始：隱藏 Tooltip 並設定旗標
            marker.on('dragstart', () => {
                this.isDraggingWaypoint = true; // Set Flag
                this.hideCustomTooltip();
            });

            // [修改] 拖曳中：更新座標 + 即時更新 Footprint + 確保 Tooltip 隱藏
            marker.on('drag', (e) => {
                const newLatLng = e.target.getLatLng();
                wp.lat = newLatLng.lat;
                wp.lng = newLatLng.lng;

                this.drawWaypointPath();
                this.popupManager.updateCoordinates(index, newLatLng.lat, newLatLng.lng);

                // 即時更新 Footprint
                this.updateFootprint(wp);

                // 確保 Tooltip 隱藏
                this.hideCustomTooltip();

                // [New] Recalculate Mission Stats in real-time
                // Accessing the modified waypoint via closure `wp` (which was updated above)
                if (wp.missionIndex !== undefined) {
                    this.recalculateMissionStats(wp.missionIndex);
                }
            });

            // [修改] 拖曳結束：儲存狀態 + 重新顯示 Tooltip
            marker.on('dragend', (e) => {
                this.isDraggingWaypoint = false; // Clear Flag

                const newLatLng = e.target.getLatLng();
                wp.lat = newLatLng.lat;
                wp.lng = newLatLng.lng;

                this.drawWaypointPath();
                this.updateExportTab();
                this.saveState();

                // 拖曳完成後，顯示最新的 Tooltip 資訊
                this.updateCustomTooltip(marker, wp, index);
            });

            // --- [Custom Tooltip Events] ---
            marker.on('mouseover', () => {
                // 如果正在拖曳中，絕對不要顯示 Tooltip
                if (this.isDraggingWaypoint) return;

                // 1. Calculate & Show Footprint (使用新的輔助方法)
                this.updateFootprint(wp);

                // 2. Update & Show Global Tooltip
                this.updateCustomTooltip(marker, wp, index);
            });

            marker.on('mouseout', () => {
                this.footprintLayer.setLatLngs([]);
                this.hideCustomTooltip();
            });

            // Click & Index
            marker.addEventListener('click', () => this.editWaypoint(marker, index));
            marker._wpIndex = index;

            this.waypointsLayer.addLayer(marker);
        });

        this.drawWaypointPath();
    }

    /**
     * Get waypoint icon based on index and heading
     */
    getWaypointIcon(index, heading) {
        const html = `
            <div class="dji-icon-wrapper">
                <div class="dji-icon-arrow" style="transform: rotate(${heading}deg);"></div>
                <div class="dji-icon-circle">${index + 1}</div>
            </div>
        `;

        return L.divIcon({
            html: html,
            // [關鍵修改] 加入自定義 class 以便 CSS 控制
            className: 'dji-waypoint-icon',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -20]
        });
    }

    /**
     * Draw path between waypoints matching DJI Pilot 2 logic
     * Reference: DJI WPML 1.0.2 / Mobile SDK V5
     */
    drawWaypointPath() {
        if (this.waypoints.length < 2) {
            this.waypointsLayer.eachLayer(l => {
                if (l instanceof L.Polyline) this.waypointsLayer.removeLayer(l);
            });
            return;
        }

        const oldLayers = this.waypointsLayer.getLayers().filter(l => l instanceof L.Polyline);
        oldLayers.forEach(l => this.waypointsLayer.removeLayer(l));

        const turnMode = this.settings.turnMode;
        let pathCoords = [];
        let lineColor = '#ffcd45'; // Default Yellow
        let dashArray = null;

        // --- 模式 1: Coordinate Turn (協調轉彎 - 切角) ---
        // DJI Logic: 不經過航點，根據 Damping Distance 提前轉彎
        if (turnMode === 'coordinateTurn' && this.waypoints.length > 2) {
            lineColor = '#00d68f'; // Green (DJI Safe Color)
            // DJI coordinateTurn 使用 damping distance 定義切角大小
            // 在此模擬中，我們假設一個合理的默認半徑，或者基於速度的估算 (若無明確 damping 設定)
            // 實務上: Damping = Speed * Time，例如 5m/s * 1s = 5m
            pathCoords = this.getCoordinateTurnPath(this.waypoints);
        }
        // --- 模式 2: Continuity Curvature (連續曲線 - Pass) ---
        // DJI Logic: 穿過航點 (Pass Through)，使用 Cubic Bezier / Catmull-Rom
        else if (turnMode === 'toPointAndPassWithContinuityCurvature' && this.waypoints.length > 2) {
            lineColor = '#ffcd45';
            // 使用 Centripetal Catmull-Rom Spline 模擬 DJI 的平滑過點算法
            pathCoords = this.getCatmullRomSplinePath(this.waypoints, 0.5); // alpha=0.5 (Centripetal)
        }
        // --- 模式 3: Continuity Curvature (連續曲線 - Stop) ---
        // DJI Logic: 曲線入站，但會在點上停下。路徑在點附近會修正為直線或極小弧度
        else if (turnMode === 'toPointAndStopWithContinuityCurvature' && this.waypoints.length > 2) {
            lineColor = '#ffcd45';
            // 雖然是 Curve，但因為要 Stop，視覺上接近直線連接，但在轉角處有極小圓弧
            // 為了簡化且符合 Pilot 2 視覺，這通常顯示為直線，或者非常緊的 Spline
            pathCoords = this.getCatmullRomSplinePath(this.waypoints, 1.0); // alpha=1.0 (Chordal/Tighter)
        }
        // --- 模式 4: Straight Line / Sharp Turn ---
        else {
            pathCoords = this.waypoints.map(wp => [wp.lat, wp.lng]);
            if (turnMode === 'toPointAndStopWithDiscontinuityCurvature') {
                lineColor = '#dc3545'; // Red
                dashArray = '10, 10';
            }
        }

        const polyline = L.polyline(pathCoords, {
            color: lineColor,
            weight: 5,
            opacity: 0.8,
            lineJoin: 'round',
            lineCap: 'round',
            dashArray: dashArray,
            interactive: false
        });

        this.waypointsLayer.addLayer(polyline);
        polyline.bringToBack();
    }

    /**
     * DJI Coordinate Turn Algorithm (Simulation)
     * 使用 "Damping Distance" 切角原理
     */
    getCoordinateTurnPath(waypoints) {
        let coords = [];
        coords.push([waypoints[0].lat, waypoints[0].lng]);

        for (let i = 1; i < waypoints.length - 1; i++) {
            const prev = waypoints[i - 1];
            const curr = waypoints[i];
            const next = waypoints[i + 1];

            // 計算兩段向量長度
            const distPrev = this.map.distance([prev.lat, prev.lng], [curr.lat, curr.lng]);
            const distNext = this.map.distance([curr.lat, curr.lng], [next.lat, next.lng]);

            // DJI Damping Distance (切角距離)
            // 邏輯: 如果沒有設定，我們用速度估算一個 "安全轉彎半徑"
            // 一般無人機轉彎半徑約為 1/3 到 1/2 的段長，或基於速度
            const speed = curr.speed || this.settings.speed;

            // 模擬 DJI 邏輯: 限制切角不能超過航段的一半
            let dampingDist = Math.max(0.2, speed * 0.8); // 粗略估算: 0.8秒的飛行距離作為切角
            dampingDist = Math.min(dampingDist, distPrev / 2, distNext / 2);

            // 計算切點 (Start & End of the curve)
            const pStart = this.getPointOnLine(curr, prev, dampingDist, distPrev);
            const pEnd = this.getPointOnLine(curr, next, dampingDist, distNext);

            // 使用 Quadratic Bezier 連接切點 (P_Start -> P_Corner -> P_End)
            // 這是最接近 DJI "Coordinate Turn" 幾何的畫法
            const curvePoints = this.getQuadraticBezierPoints(
                { lat: pStart[0], lng: pStart[1] },
                curr, // 控制點是航點本身
                { lat: pEnd[0], lng: pEnd[1] },
                15
            );

            // 加入直線段 (從上一點到切角起點)
            coords.push(pStart);
            // 加入曲線段
            coords.push(...curvePoints);
        }

        coords.push([waypoints[waypoints.length - 1].lat, waypoints[waypoints.length - 1].lng]);
        return coords;
    }

    /**
     * 輔助: 在線上找一點 (從 origin 往 target 方向 distance 距離)
     */
    getPointOnLine(origin, target, distance, totalDist) {
        const ratio = distance / totalDist;
        const lat = origin.lat + (target.lat - origin.lat) * ratio;
        const lng = origin.lng + (target.lng - origin.lng) * ratio;
        return [lat, lng];
    }

    /**
     * Catmull-Rom Spline (模擬 DJI "Pass" 平滑過點)
     * 這種算法保證曲線穿過所有控制點
     */
    getCatmullRomSplinePath(waypoints, alpha) {
        if (waypoints.length < 2) return [];

        // 轉換格式
        const points = waypoints.map(wp => ({ x: wp.lat, y: wp.lng }));
        const splinePoints = [];

        // 為了讓曲線包含起點和終點，我們需要虛擬的 "前一點" 和 "後一點"
        // 簡單做法: 重複起點和終點
        const p0 = points[0];
        const pn = points[points.length - 1];
        const extendedPoints = [p0, ...points, pn];

        for (let i = 0; i < extendedPoints.length - 3; i++) {
            const p0 = extendedPoints[i];
            const p1 = extendedPoints[i + 1];
            const p2 = extendedPoints[i + 2];
            const p3 = extendedPoints[i + 3];

            // 每個區段細分 20 個點
            for (let t = 0; t <= 1; t += 0.05) {
                const pt = this.catmullRom(p0, p1, p2, p3, t, alpha);
                splinePoints.push([pt.x, pt.y]);
            }
        }
        return splinePoints;
    }

    /**
     * Catmull-Rom 數學公式
     */
    catmullRom(p0, p1, p2, p3, t, alpha) {
        // 標準 Catmull-Rom (簡化版，假設均勻分佈，若要 Centripetal 需要更複雜計算距離)
        // 這裡使用簡化版公式，視覺效果對地圖路徑已足夠平滑
        const t2 = t * t;
        const t3 = t2 * t;

        // 影響張力的係數 (0.5 是標準 Catmull-Rom)
        // 較大的值會讓曲線更緊，較小的值更鬆
        const tension = 0.5;

        const m1 = {
            x: (p2.x - p0.x) * tension,
            y: (p2.y - p0.y) * tension
        };
        const m2 = {
            x: (p3.x - p1.x) * tension,
            y: (p3.y - p1.y) * tension
        };

        const h1 = 2 * t3 - 3 * t2 + 1;
        const h2 = -2 * t3 + 3 * t2;
        const h3 = t3 - 2 * t2 + t;
        const h4 = t3 - t2;

        return {
            x: h1 * p1.x + h2 * p2.x + h3 * m1.x + h4 * m2.x,
            y: h1 * p1.y + h2 * p2.y + h3 * m1.y + h4 * m2.y
        };
    }

    getQuadraticBezierPoints(p0, p1, p2, segments) {
        const pts = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const lat = (1 - t) * (1 - t) * p0.lat + 2 * (1 - t) * t * p1.lat + t * t * p2.lat;
            const lng = (1 - t) * (1 - t) * p0.lng + 2 * (1 - t) * t * p1.lng + t * t * p2.lng;
            pts.push([lat, lng]);
        }
        return pts;
    }

    /**
     * Edit waypoint
     */
    editWaypoint(markerOrEvent, index) {
        let waypointIndex;

        if (markerOrEvent instanceof L.Marker) {
            waypointIndex = markerOrEvent._wpIndex;
        } else if (typeof markerOrEvent === 'number') {
            waypointIndex = markerOrEvent;
        } else {
            waypointIndex = markerOrEvent;
        }

        if (typeof waypointIndex === 'number') {
            this.popupManager.open(waypointIndex);
        }
    }

    /**
     * [修改] Update settings from form
     * 使用 ...this.settings 來保留 droneEnumValue (因為它不在這個表單的 input 裡)
     */
    updateSettingsFromForm() {
        // 先備份舊的設定 (主要是為了保留 droneEnumValue)
        const currentSettings = this.settings || {};

        this.settings = {
            // 1. 保留所有舊屬性 (包含 droneEnumValue)
            ...currentSettings,

            // 2. 覆蓋來自表單的新數值
            units: document.getElementById('units')?.value || 'metric',
            altitude: parseFloat(document.getElementById('altitude')?.value || 60),
            speed: parseFloat(document.getElementById('speed')?.value || 2.5),
            spacing: parseFloat(document.getElementById('spacing')?.value || 20),
            lineDirection: document.getElementById('lineDirection')?.value || 'ew',
            interval: parseFloat(document.getElementById('interval')?.value || 3),

            // Gimbal
            gimbalAngle: parseFloat(document.getElementById('gimbalAngle')?.value || -90),
            actionGimbalPitch: parseFloat(document.getElementById('actionGimbalPitch')?.value || -75),

            action: document.getElementById('action')?.value || 'noAction',
            headingMode: document.getElementById('headingMode')?.value || 'auto',
            headingAngle: parseFloat(document.getElementById('headingAngle')?.value || 0),
            turnMode: document.getElementById('turnMode')?.value || 'toPointAndStopWithContinuityCurvature',
            finalAction: document.getElementById('finalAction')?.value || 'hover',
            maintainAltitude: document.getElementById('maintainAltitude')?.checked || false,
            reversePath: document.getElementById('reversePath')?.checked || false
        };
    }

    /**
     * [New] Recalculate Stats for a specific Mission (Shape)
     * Triggered when a waypoint in that mission is dragged
     */
    recalculateMissionStats(missionIndex) {
        if (missionIndex < 0 || missionIndex >= this.shapes.length) return;

        const shapeLayer = this.shapes[missionIndex].layer;
        const missionPoints = this.waypoints.filter(wp => wp.missionIndex === missionIndex);

        if (missionPoints.length < 2) return;

        let dist = 0;
        for (let i = 0; i < missionPoints.length - 1; i++) {
            const p1 = L.latLng(missionPoints[i].lat, missionPoints[i].lng);
            const p2 = L.latLng(missionPoints[i + 1].lat, missionPoints[i + 1].lng);
            dist += p1.distanceTo(p2);
        }

        const speed = this.settings.speed || 5.5;
        const time = speed > 0 ? dist / speed : 0;

        this.drawingManager.updateLabelStats(shapeLayer, dist, time);
    }

    /**
     * Change units
     */
    changeUnits() {
        const newUnits = document.getElementById('units').value;
        const isImperial = newUnits === 'imperial';

        // Distance Factor (m <-> ft)
        const factor = isImperial ? this.M2FT : (1 / this.M2FT);

        // GSD Factor (cm <-> in)
        const gsdFactor = isImperial ? 0.393701 : (1 / 0.393701);

        // 1. Convert Input Fields
        ['altitude', 'speed', 'spacing'].forEach(field => {
            const input = document.getElementById(field);
            if (input) {
                const val = parseFloat(input.value);
                if (!isNaN(val)) {
                    input.value = (val * factor).toFixed(2);
                }
            }
        });

        // 2. Convert GSD Display Value
        const gsdDisplay = document.getElementById('gsdDisplay');
        if (gsdDisplay && gsdDisplay.textContent !== '-') {
            const currentGsd = parseFloat(gsdDisplay.textContent);
            if (!isNaN(currentGsd)) {
                gsdDisplay.textContent = (currentGsd * gsdFactor).toFixed(2);
            }
        }

        // 3. Convert Footprint Display Value
        const footprintDisplay = document.getElementById('footprintDisplay');
        if (footprintDisplay && footprintDisplay.textContent !== '-') {
            const parts = footprintDisplay.textContent.split('×');
            if (parts.length === 2) {
                const w = parseFloat(parts[0]);
                const h = parseFloat(parts[1]);
                if (!isNaN(w) && !isNaN(h)) {
                    const newW = (w * factor).toFixed(2);
                    const newH = (h * factor).toFixed(2);
                    footprintDisplay.textContent = `${newW}×${newH}`;
                }
            }
        }

        // 4. Update Labels & Settings
        this.updateUnitsDisplay();
        this.updateSettingsFromForm();

        // [新增] 更新 Mission Info 裡的 Total Distance
        this.updateExportTab();
    }

    /**
     * Update units display labels
     */
    updateUnitsDisplay() {
        const isImperial = this.settings.units === 'imperial';
        const label = isImperial ? 'ft' : 'm';
        const speedLabel = isImperial ? 'ft' : 'm'; // Input group text shows "m/s" or "ft/s" structure

        // 更新一般的單位標籤
        document.querySelectorAll('.unitsLabel').forEach(el => {
            // Check context to differentiate speed (ft/s) vs distance (ft) if needed, 
            // though M2FT factor is same.
            el.textContent = label;
        });

        // [新增] 更新 Photogrammetry Auto-Calc 的單位標籤
        const gsdUnitEl = document.getElementById('gsdUnit');
        const footprintUnitEl = document.getElementById('footprintUnit');

        if (gsdUnitEl) gsdUnitEl.textContent = isImperial ? 'in/px' : 'cm/px';
        if (footprintUnitEl) footprintUnitEl.textContent = isImperial ? 'ft' : 'm';
    }

    /**
     * Clear all waypoints
     */
    clearWaypoints() {
        this.waypoints = [];
        this.waypointsLayer.clearLayers();
    }

    /**
     * Select all waypoints
     */
    selectAllWaypoints() {
        this.selectedWaypoints.clear();
        this.waypoints.forEach((_, index) => {
            this.selectedWaypoints.add(index);
        });
        this.renderWaypoints();
    }

    /**
     * Delete selected waypoints
     */
    deleteSelectedWaypoints() {
        const indices = Array.from(this.selectedWaypoints).sort((a, b) => b - a);
        indices.forEach(index => {
            this.waypoints.splice(index, 1);
        });
        this.selectedWaypoints.clear();
        this.renderWaypoints();
        this.saveState();
    }

    /**
     * Update export tab with statistics
     */
    updateExportTab() {
        document.getElementById('wpCount').textContent = this.waypoints.length;

        if (this.waypoints.length === 0) {
            document.getElementById('downloadKmz').disabled = true;
            document.getElementById('downloadJson').disabled = true;
            document.getElementById('totalDist').textContent = this.settings.units === 'imperial' ? '0 ft' : '0 m';
            document.getElementById('etaTime').textContent = '0s';
            return;
        }

        document.getElementById('downloadKmz').disabled = false;
        document.getElementById('downloadJson').disabled = false;

        const wpWarning = document.getElementById('waypointWarning');
        if (this.waypoints.length > 100) {
            wpWarning.style.display = 'block';
        } else {
            wpWarning.style.display = 'none';
        }

        // 1. 取得原始距離 (Meters)
        let distanceMeters = kmzGenerator.calculateTotalDistance(this.waypoints);

        // 2. 根據單位顯示
        if (this.settings.units === 'imperial') {
            const distFt = distanceMeters * this.M2FT;
            // 顯示 ft，若數值過大可考慮顯示 mi (但這裡依你需求維持 base unit)
            document.getElementById('totalDist').textContent = `${distFt.toFixed(1)} ft`;
        } else {
            document.getElementById('totalDist').textContent = `${distanceMeters.toFixed(1)} m`;
        }

        // 3. 計算時間 (kmzGenerator 內部通常使用公制計算，這裡不需要改動，除非你想微調時間顯示)
        const time = kmzGenerator.calculateEstimatedTime(this.waypoints, this.settings.speed); // speed is handled in state
        document.getElementById('etaTime').textContent = kmzGenerator.formatTime(time);
    }

    /**
     * [修改] Download KMZ file
     * 確保傳遞最新的 this.settings 給生成器
     */
    async downloadKMZ() {
        if (this.waypoints.length === 0) {
            await MessageBox.alert('No waypoints to download!', 'Export Error');
            return;
        }

        const missionName = document.getElementById('missionName').value || 'DJI_Mission';
        const btn = document.getElementById('downloadKmz');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Generating KMZ...';

        try {
            await kmzGenerator.generateDJIKMZ(missionName, this.waypoints, this.settings);
        } catch (error) {
            console.error('Failed to generate waypoints via API:', error);
            await MessageBox.alert('Failed to connect to calculation API. Please ensure the backend is running.', 'API Error');
            return [];
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    /**
     * Download JSON file
     */
    async downloadJSON() {
        if (this.waypoints.length === 0) {
            await MessageBox.alert('No waypoints to download!', 'Export Error');
            return;
        }

        const missionName = document.getElementById('missionName').value || 'DJI_Mission';
        kmzGenerator.downloadJSON(missionName, this.waypoints, this.settings);
    }

    /**
     * Undo last action
     */
    undo() {
        console.log('[App] Undo requested');
        const previousState = historyManager.undo();
        console.log('[App] Undo result (previous state):', previousState);

        if (previousState) {
            this.restoreState(previousState);
        } else {
            console.warn('[App] Undo failed: No previous state or historyManager.undo() returned null');
        }
    }

    /**
     * Redo last action
     */
    redo() {
        console.log('[App] Redo requested');
        const nextState = historyManager.redo();
        console.log('[App] Redo result (next state):', nextState);

        if (nextState) {
            this.restoreState(nextState);
        } else {
            console.warn('[App] Redo failed: No next state or historyManager.redo() returned null');
        }
    }

    /**
     * Save current state to history
     */
    saveState() {
        // 1. 序列化圖形數據 (因為 Leaflet Layer 物件不能直接存入 JSON)
        const serializedShapes = this.shapes.map(s => {
            const shapeData = { type: s.type };

            if (s.type === 'circle') {
                // Circle: 儲存中心點和半徑
                shapeData.center = s.layer.getLatLng();
                shapeData.radius = s.layer.getRadius();
            } else if (s.type === 'rectangle') {
                // Rectangle: 儲存 bounds
                const bounds = s.layer.getBounds();
                shapeData.bounds = {
                    north: bounds.getNorth(),
                    south: bounds.getSouth(),
                    east: bounds.getEast(),
                    west: bounds.getWest()
                };
            } else {
                // Polygon/Polyline: 使用 getLatLngs()
                shapeData.latlngs = s.layer.getLatLngs();
            }

            return shapeData;
        });

        const state = {
            waypoints: JSON.parse(JSON.stringify(this.waypoints)),
            shapes: JSON.parse(JSON.stringify(serializedShapes)), // [關鍵修改] 儲存數據而非 length
            settings: JSON.parse(JSON.stringify(this.settings))
        };

        console.log('[App] Saving State Snapshot:', state);
        console.log('[App] Shapes count:', state.shapes.length);
        console.log('[App] Waypoints count:', state.waypoints.length);

        historyManager.saveState(state);

        // 強制更新按鈕狀態 (以防 historyManager 內部沒觸發)
        if (historyManager.updateButtons) {
            historyManager.updateButtons();
        }
    }

    /**
     * Restore state from history
     */
    restoreState(state) {
        console.log('[App] Restoring State:', state);

        // [New] Clear existing labels
        if (this.drawingManager && this.drawingManager.clearAllLabels) {
            this.drawingManager.clearAllLabels();
        }

        // 1. 還原 Waypoints
        this.waypoints = state.waypoints;

        // 2. 還原 Settings (如果需要)
        if (state.settings) {
            this.settings = state.settings;
            // 這裡可以選擇是否要刷新 UI 表單的值
            // document.getElementById('speed').value = this.settings.speed; // 視需求而定
        }

        // 3. 還原 Shapes (Polygon/Polyline)

        // (A) 先清除地圖上現有的圖形
        this.drawnItems.clearLayers();
        this.shapes = [];

        // 確保退出編輯模式 (清除 Handles)
        if (this.drawingManager) {
            this.drawingManager.disableEdit();
            this.drawingManager.cancelDrawing();
        }

        // (B) 重建歷史紀錄中的圖形
        if (state.shapes && Array.isArray(state.shapes)) {
            state.shapes.forEach(shapeData => {
                let layer;

                // 根據類型重建 Layer
                if (shapeData.type === 'polygon') {
                    layer = L.polygon(shapeData.latlngs, { color: '#0d6efd' });
                } else if (shapeData.type === 'polyline') {
                    layer = L.polyline(shapeData.latlngs, { color: '#0d6efd' });
                } else if (shapeData.type === 'rectangle') {
                    // Rectangle: 從 bounds 重建
                    const bounds = L.latLngBounds(
                        [shapeData.bounds.south, shapeData.bounds.west],
                        [shapeData.bounds.north, shapeData.bounds.east]
                    );
                    layer = L.rectangle(bounds, { color: '#0d6efd' });
                } else if (shapeData.type === 'circle') {
                    // Circle: 從 center 和 radius 重建
                    layer = L.circle(shapeData.center, {
                        radius: shapeData.radius,
                        color: '#0d6efd'
                    });
                }

                if (layer) {
                    layer.addTo(this.drawnItems);

                    // [關鍵] 使用 DrawingManager 重新註冊事件 (雙擊編輯等)
                    // 傳入 true 以跳過 saveState (因為我們正在還原，不需要產生新紀錄)
                    this.drawingManager.registerShape(layer, shapeData.type, true);
                }
            });
        }

        // 4. 刷新視圖
        this.renderWaypoints();
        this.updateExportTab();
        this.updateUI();
    }

    /**
     * Remove waypoints inside a logical shape
     */
    removeWaypointsInShape(layer) {
        if (!layer) return;

        // Iterate in reverse to safely splice
        for (let i = this.waypoints.length - 1; i >= 0; i--) {
            const wp = this.waypoints[i];
            const latlng = L.latLng(wp.lat, wp.lng);
            let inside = false;

            if (layer instanceof L.Polygon) {
                // Ray casting or using Leaflet's geometry util if available
                // Simple Ray Casting for Polygon
                // Note: Leaflet doesn't have a built-in "contains" for Polygon in standard build without plugins,
                // but we can implement a simple one or use bounds check first.
                // For accurate check:
                inside = this.isPointInPolygon(latlng, layer.getLatLngs()[0]);
            } else if (layer instanceof L.Circle) {
                inside = layer.getLatLng().distanceTo(latlng) <= layer.getRadius();
            } else if (layer instanceof L.Rectangle) {
                inside = layer.getBounds().contains(latlng);
            }

            if (inside) {
                this.waypoints.splice(i, 1);
            }
        }

        this.renderWaypoints();
        this.updateExportTab();
        this.saveState();
    }

    /**
     * Simple Ray Casting algorithm for Point in Polygon
     */
    isPointInPolygon(latlng, polyPoints) {
        const x = latlng.lat, y = latlng.lng;
        let inside = false;
        for (let i = 0, j = polyPoints.length - 1; i < polyPoints.length; j = i++) {
            const xi = polyPoints[i].lat, yi = polyPoints[i].lng;
            const xj = polyPoints[j].lat, yj = polyPoints[j].lng;

            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /**
     * Reset everything
     */
    async reset() {
        const confirmed = await MessageBox.confirm(
            'Are you sure you want to clear everything?\nThis action cannot be undone.',
            'Reset Mission'
        );

        if (confirmed) {
            // [新增] Clear Labels
            if (this.drawingManager && this.drawingManager.clearAllLabels) {
                this.drawingManager.clearAllLabels();
            }

            this.drawingManager.disableEdit();
            this.drawingManager.cancelDrawing();
            this.popupManager.closeAll();
            this.drawnItems.clearLayers();
            this.clearWaypoints();
            this.shapes = [];
            this.selectedWaypoints.clear();
            historyManager.clear();
            this.updateUI();
        }
    }

    /**
     * Show help modal
     */
    showHelp() {
        const modalEl = document.getElementById('helpModal');
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (!modal) {
            modal = new bootstrap.Modal(modalEl);
        }
        modal.show();
    }

    /**
     * Update UI state
     */
    updateUI() {
        if (historyManager && historyManager.updateButtons) {
            historyManager.updateButtons();
        }
        this.updateExportTab();
    }

    /**
     * Handle tab changes
     */
    onTabChange() {
        // Tab change logic
    }

    /**
     * Keyboard shortcuts for drawing tools
     */
    activatePolygonTool() {
        console.log('Polygon tool activated');
    }

    activateRectangleTool() {
        console.log('Rectangle tool activated');
    }

    activateCircleTool() {
        console.log('Circle tool activated');
    }

    activateMarkerTool() {
        console.log('Marker tool activated');
    }

    /**
     * [新增] 顯示地圖上方的提示框
     */
    showMapNotification(message) {
        const toast = document.getElementById('mapToast');
        if (toast) {
            toast.textContent = message;
            toast.classList.add('show');

            // 清除舊的 timer (防止連續點擊時閃爍)
            if (this._toastTimer) clearTimeout(this._toastTimer);

            this._toastTimer = setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
    }

    /**
     * [新增] 高亮輸入框 3秒
     */
    highlightInput(elementId) {
        const el = document.getElementById(elementId);
        if (el) {
            // 1. 先重置：如果已經在高亮中，先恢復原狀，避免連續點擊出錯
            if (el.classList.contains('input-highlight')) {
                el.classList.remove('input-highlight');
                el.classList.add('bg-dark', 'text-light', 'border-secondary');
                // 強制 Reflow
                void el.offsetWidth;
            }

            // 2. 移除會擋住顏色的 Bootstrap class
            el.classList.remove('bg-dark', 'text-light', 'border-secondary');

            // 3. 加入我們的高亮 class
            el.classList.add('input-highlight');

            // 4. 設定 2.5秒後恢復原狀 (配合 CSS 動畫時間)
            setTimeout(() => {
                // 只有當元素還擁有 input-highlight 時才恢復 (避免被新的高亮中斷)
                if (el.classList.contains('input-highlight')) {
                    el.classList.remove('input-highlight');
                    // 加回原本的樣式
                    el.classList.add('bg-dark', 'text-light', 'border-secondary');
                }
            }, 2500);
        }
    }

    /**
     * [Modified] Calculate and apply photogrammetry settings
     * Includes Warning Popup for Oblique Photography (Pitch != -90)
     */
    async applyPhotogrammetrySettings() {
        const droneKey = document.getElementById('droneModel').value;
        const cameraKey = document.getElementById('cameraModel').value;
        const altitude = parseFloat(document.getElementById('altitude').value);
        const speed = parseFloat(document.getElementById('speed').value);
        const sideOverlap = parseFloat(document.getElementById('sideOverlap').value);
        const frontOverlap = parseFloat(document.getElementById('frontOverlap').value);

        // [關鍵修正] 必須在這裡定義 gimbalPitch 變數，否則下面會報錯
        let gimbalPitch = parseFloat(document.getElementById('actionGimbalPitch').value);

        if (!droneKey || !cameraKey) {
            await MessageBox.alert("Please select both Drone and Camera.", "Missing Info");
            return;
        }

        if (!altitude || !speed) {
            await MessageBox.alert("Please set Altitude and Speed first.", "Missing Info");
            return;
        }

        // --- 檢查 Gimbal Pitch 是否為 -90 ---
        // 允許微小誤差 (e.g. -89.9)
        if (Math.abs(gimbalPitch + 90) > 0.1) {

            const message = `
<div class="text-start">
    <div class="d-flex align-items-center mb-3 text-warning">
        <i class="bi bi-exclamation-triangle-fill fs-4 me-2"></i>
        <h6 class="fw-bold mb-0" style="font-size: 1.1em;">Oblique Photography Detected (${gimbalPitch}°)</h6>
    </div>
    <p class="mb-2 text-light">
        You are not shooting Nadir (-90°). Please be aware of the following risks:
    </p>
    <ul class="text-secondary small mb-3 ps-3">
        <li class="mb-2">
            <strong class="text-light">GSD Error:</strong><br>
            Resolution will be lower (higher GSD) because the camera is farther from the ground (Slant Range).
        </li>
        <li class="mb-2">
            <strong class="text-light">Coverage Distortion:</strong><br>
            The footprint will be a trapezoid, not a rectangle. Edges may have insufficient overlap.
        </li>
        <li class="mb-1">
            <strong class="text-light">Overlap Issues:</strong><br>
            Standard overlap calculations may not guarantee full reconstruction for 3D models.
        </li>
    </ul>
    <p class="mb-0 text-light border-top border-secondary pt-2 mt-2">
        How would you like to proceed?
    </p>
</div>`;

            // 使用新的 custom 方法顯示 3 個按鈕
            const choice = await MessageBox.custom(message.trim(), 'Risk Assessment', [
                { text: 'Cancel', value: 'cancel', className: 'btn-secondary' },
                { text: 'Use -90°', value: 'fix_90', className: 'btn-success' },
                { text: 'Confirm', value: 'confirm', className: 'btn-danger' }
            ]);

            if (choice === 'cancel' || choice === null) {
                return; // 終止
            }

            if (choice === 'fix_90') {
                // 修改 Pitch 為 -90
                gimbalPitch = -90;

                // 更新 UI
                const pitchInput = document.getElementById('actionGimbalPitch');
                if (pitchInput) {
                    pitchInput.value = -90;
                    pitchInput.dispatchEvent(new Event('change')); // 確保觸發事件

                    // [關鍵] 高亮提醒
                    this.highlightInput('actionGimbalPitch');
                }

                this.showMapNotification('Pitch reset to -90°');
            }

            // 如果是 'confirm'，則使用原本的 gimbalPitch 繼續往下執行
        }

        // 1. 記錄舊數值
        const oldSpeed = document.getElementById('speed').value;

        // 2. 執行計算 (傳入 gimbalPitch)
        // 這裡就是報錯的地方，如果上面沒有 let gimbalPitch，這裡就會 undefined
        const result = this.calculator.calculate(
            droneKey,
            cameraKey,
            altitude,
            sideOverlap,
            frontOverlap,
            speed,
            this.settings.units,
            gimbalPitch // [新增參數]
        );

        if (result) {
            document.getElementById('gsdDisplay').textContent = result.gsd;
            document.getElementById('footprintDisplay').textContent = `${result.footprintW}×${result.footprintH}`;

            // 更新 Spacing
            const spacingInput = document.getElementById('spacing');
            spacingInput.value = result.spacing;
            spacingInput.dispatchEvent(new Event('input'));

            const intervalInput = document.getElementById('interval');

            // 檢查速度是否過快
            if (result.triggerTime < 2.0) {
                const suggestedSpeed = (result.triggerDist / 2.0).toFixed(1);
                const speedUnit = this.settings.units === 'imperial' ? 'ft/s' : 'm/s';

                const confirmed = await MessageBox.confirm(
                    `Trigger interval is ${result.triggerTime.toFixed(2)}s (too fast).\n\nRecommended Speed: ${suggestedSpeed} ${speedUnit}.\n\nApply recommended speed?`,
                    'Optimization Suggestion'
                );

                if (confirmed) {
                    const speedInput = document.getElementById('speed');
                    speedInput.value = suggestedSpeed;
                    speedInput.dispatchEvent(new Event('input'));
                    intervalInput.value = 2.0;
                } else {
                    intervalInput.value = result.triggerTime;
                }
            } else {
                intervalInput.value = result.triggerTime;
            }
            intervalInput.dispatchEvent(new Event('input'));

            // Set Action to Photo
            const actionSelect = document.getElementById('action');
            actionSelect.value = 'takePhoto';
            actionSelect.dispatchEvent(new Event('change'));

            // Highlight Fields
            this.highlightInput('spacing');
            this.highlightInput('interval');

            const newSpeed = document.getElementById('speed').value;
            if (oldSpeed !== newSpeed) {
                this.highlightInput('speed');
            }

            this.showMapNotification('Calculation successful');

            this.saveState();
        }
    }
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', async () => {
    app = new WaypointMapApp();
    await app.init();
});