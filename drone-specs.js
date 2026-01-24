/**
 * DJI Drone & Camera Database for WPML
 * Reference: DJI WPML 1.0.2 / DJI Developer Cloud API
 * Note: Real Focal Length is calculated based on Sensor Size and 35mm Equivalent for accurate GSD.
 */

const DJI_DRONES = {
    // ==========================================
    // Enterprise Series (DJI Pilot 2 Native)
    // ==========================================
    'M3E': {
        name: 'Mavic 3 Enterprise (M3E)',
        enumValue: 77,
        cameras: {
            'M3E_WIDE': { name: 'Wide (4/3" CMOS)', sensorW: 17.3, sensorH: 13.0, focal: 12.29, resW: 5280, resH: 3956 },
            'M3E_TELE': { name: 'Tele (162mm Eq)', sensorW: 6.4, sensorH: 4.8, focal: 28.8, resW: 4000, resH: 3000 }
        }
    },
    'M3T': {
        name: 'Mavic 3 Thermal (M3T)',
        enumValue: 77,
        cameras: {
            'M3T_WIDE': { name: 'Wide (24mm Eq)', sensorW: 6.4, sensorH: 4.8, focal: 4.4, resW: 8000, resH: 6000 },
        }
    },
    'M3M': {
        name: 'Mavic 3 Multispectral (M3M)',
        enumValue: 77,
        cameras: {
            'M3M_RGB': { name: 'RGB (4/3" CMOS)', sensorW: 17.3, sensorH: 13.0, focal: 12.29, resW: 5280, resH: 3956 }
        }
    },
    'M30': {
        name: 'Matrice 30 / 30T',
        enumValue: 67,
        cameras: {
            'M30_WIDE': { name: 'Wide Camera', sensorW: 6.4, sensorH: 4.8, focal: 4.4, resW: 4000, resH: 3000 },
            'M30_ZOOM': { name: 'Zoom Camera', sensorW: 6.4, sensorH: 4.8, focal: 22.0, resW: 8000, resH: 6000 }
        }
    },
    'M350_RTK': {
        name: 'Matrice 350 RTK',
        enumValue: 89,
        cameras: {
            'P1_35mm': { name: 'Zenmuse P1 (35mm)', sensorW: 35.9, sensorH: 24.0, focal: 35.0, resW: 8192, resH: 5460 },
            'P1_24mm': { name: 'Zenmuse P1 (24mm)', sensorW: 35.9, sensorH: 24.0, focal: 24.0, resW: 8192, resH: 5460 },
            'P1_50mm': { name: 'Zenmuse P1 (50mm)', sensorW: 35.9, sensorH: 24.0, focal: 50.0, resW: 8192, resH: 5460 },
            'H20_WIDE': { name: 'Zenmuse H20/H20T Wide', sensorW: 6.4, sensorH: 4.8, focal: 4.5, resW: 4056, resH: 3040 },
            'L1_RGB': { name: 'Zenmuse L1 (RGB)', sensorW: 13.2, sensorH: 8.8, focal: 8.8, resW: 5472, resH: 3648 },
            'L2_RGB': { name: 'Zenmuse L2 (RGB)', sensorW: 17.3, sensorH: 13.0, focal: 12.29, resW: 5280, resH: 3956 }
        }
    },
    'M300_RTK': {
        name: 'Matrice 300 RTK',
        enumValue: 60,
        cameras: {
            'P1_35mm': { name: 'Zenmuse P1 (35mm)', sensorW: 35.9, sensorH: 24.0, focal: 35.0, resW: 8192, resH: 5460 },
            'H20_WIDE': { name: 'Zenmuse H20/H20T Wide', sensorW: 6.4, sensorH: 4.8, focal: 4.5, resW: 4056, resH: 3040 },
            'L1_RGB': { name: 'Zenmuse L1 (RGB)', sensorW: 13.2, sensorH: 8.8, focal: 8.8, resW: 5472, resH: 3648 }
        }
    },

    // ==========================================
    // Mavic 3 Consumer Series
    // ==========================================

    // 1. Mavic 3 Classic (Single Camera)
    'M3_CLASSIC': {
        name: 'Mavic 3 Classic',
        enumValue: 68,
        cameras: {
            'HASS_WIDE': { name: 'Hasselblad Wide (24mm)', sensorW: 17.3, sensorH: 13.0, focal: 12.29, resW: 5280, resH: 3956 }
        }
    },

    // 2. Mavic 3 Standard (Dual Camera)
    'M3_STD': {
        name: 'Mavic 3',
        enumValue: 68,
        cameras: {
            'HASS_WIDE': { name: 'Hasselblad Wide (24mm)', sensorW: 17.3, sensorH: 13.0, focal: 12.29, resW: 5280, resH: 3956 },
            'TELE_162': { name: 'Tele (162mm Eq)', sensorW: 6.4, sensorH: 4.8, focal: 28.8, resW: 4000, resH: 3000 }
        }
    },

    // 3. Mavic 3 Cine (Dual Camera + ProRes) - Optical specs same as Standard
    'M3_CINE': {
        name: 'Mavic 3 Cine',
        enumValue: 68,
        cameras: {
            'HASS_WIDE': { name: 'Hasselblad Wide (24mm)', sensorW: 17.3, sensorH: 13.0, focal: 12.29, resW: 5280, resH: 3956 },
            'TELE_162': { name: 'Tele (162mm Eq)', sensorW: 6.4, sensorH: 4.8, focal: 28.8, resW: 4000, resH: 3000 }
        }
    },

    // 4. Mavic 3 Pro (Triple Camera)
    'M3_PRO': {
        name: 'Mavic 3 Pro',
        enumValue: 68,
        cameras: {
            'HASS_WIDE': { name: 'Hasselblad Wide (24mm)', sensorW: 17.3, sensorH: 13.0, focal: 12.29, resW: 5280, resH: 3956 },
            'MED_TELE': { name: 'Medium Tele (70mm)', sensorW: 9.6, sensorH: 7.2, focal: 18.6, resW: 8064, resH: 6048 }, // 48MP mode
            'TELE_166': { name: 'Tele (166mm Eq)', sensorW: 6.4, sensorH: 4.8, focal: 29.5, resW: 4000, resH: 3000 }
        }
    },

    // 5. Mavic 3 Pro Cine (Triple Camera + ProRes)
    'M3_PRO_CINE': {
        name: 'Mavic 3 Pro Cine',
        enumValue: 68,
        cameras: {
            'HASS_WIDE': { name: 'Hasselblad Wide (24mm)', sensorW: 17.3, sensorH: 13.0, focal: 12.29, resW: 5280, resH: 3956 },
            'MED_TELE': { name: 'Medium Tele (70mm)', sensorW: 9.6, sensorH: 7.2, focal: 18.6, resW: 8064, resH: 6048 },
            'TELE_166': { name: 'Tele (166mm Eq)', sensorW: 6.4, sensorH: 4.8, focal: 29.5, resW: 4000, resH: 3000 }
        }
    },

    // --- Other Consumer Drones ---
    'AIR3': {
        name: 'DJI Air 3',
        enumValue: 102,
        cameras: {
            'AIR3_W': { name: 'Wide (24mm)', sensorW: 9.6, sensorH: 7.2, focal: 6.72, resW: 8064, resH: 6048 },
            'AIR3_M': { name: 'Med Tele (70mm)', sensorW: 9.6, sensorH: 7.2, focal: 18.6, resW: 8064, resH: 6048 }
        }
    },
    'MINI4PRO': {
        name: 'Mini 4 Pro',
        enumValue: 59,
        cameras: {
            'MINI4_W': { name: 'Wide (24mm)', sensorW: 9.6, sensorH: 7.2, focal: 6.72, resW: 8064, resH: 6048 }
        }
    }
};

class PhotogrammetryCalculator {
    constructor() {
        this.drones = DJI_DRONES;
        this.M2FT = 3.28084; // Meters to Feet conversion
    }

    /**
     * Get available cameras for a specific drone model
     */
    getCameras(droneKey) {
        if (!this.drones[droneKey]) return {};
        return this.drones[droneKey].cameras;
    }

    /**
     * Get drone enum value for WPML
     */
    getDroneEnum(droneKey) {
        return this.drones[droneKey] ? this.drones[droneKey].enumValue : 0;
    }

    /**
     * Calculate footprint and required spacing/interval
     * [Modified] Added gimbalPitch support for Oblique Photogrammetry
     */
    calculate(droneKey, cameraKey, altitude, sideOverlap, frontOverlap, speed, unitMode = 'metric', gimbalPitch = -90) {
        const drone = this.drones[droneKey];
        if (!drone) return null;

        const cam = drone.cameras[cameraKey];
        if (!cam) return null;

        // 1. Normalize inputs to Metric
        let altM = altitude;
        let speedM = speed;

        if (unitMode === 'imperial') {
            altM = altitude / this.M2FT;
            speedM = speed / this.M2FT;
        }

        // 2. [新增] Calculate Slant Range (斜距) for GSD correction
        // 如果 gimbalPitch 是 -90，sin(90) = 1，距離 = 高度
        // 如果 gimbalPitch 是 -45，sin(45) = 0.707，距離 = 高度 / 0.707 (距離變遠)

        let pitch = parseFloat(gimbalPitch);
        if (isNaN(pitch)) pitch = -90;

        // 限制 Pitch 不要太接近水平，否則距離無限大 (e.g. max -10度)
        if (pitch > -10) pitch = -10;
        if (pitch < -90) pitch = -90;

        const thetaRad = Math.abs(pitch) * (Math.PI / 180); // Depression angle

        // 核心修正：使用斜距 (Slant Distance) 替代垂直高度 (Altitude)
        const distanceM = altM / Math.sin(thetaRad);

        // 3. GSD Calculation (Uses Slant Distance)
        const gsdMetric = (cam.sensorW / cam.resW) * (distanceM / cam.focal) * 100;

        // 4. Footprint Calculation (Uses Slant Distance)
        // 注意：這計算的是畫面中心的 Footprint 寬高，斜拍時 Footprint 是梯形
        // 這裡提供的是 "Center GSD" 的對應範圍，用於估算重疊率
        const footprintW_M = (cam.sensorW * distanceM) / cam.focal;
        const footprintH_M = (cam.sensorH * distanceM) / cam.focal;

        // 5. Calculate Spacing & Trigger Dist
        const spacingM = footprintW_M * (1 - (sideOverlap / 100));
        const triggerDistM = footprintH_M * (1 - (frontOverlap / 100));

        // 6. Time Interval
        const triggerTime = triggerDistM / speedM;

        // 7. Convert Outputs
        let result = {
            triggerTime: parseFloat(triggerTime.toFixed(2))
        };

        if (unitMode === 'imperial') {
            result.gsd = (gsdMetric * 0.393701).toFixed(2);
            result.footprintW = (footprintW_M * this.M2FT).toFixed(2);
            result.footprintH = (footprintH_M * this.M2FT).toFixed(2);
            result.spacing = parseFloat((spacingM * this.M2FT).toFixed(2));
            result.triggerDist = parseFloat((triggerDistM * this.M2FT).toFixed(2));
        } else {
            result.gsd = gsdMetric.toFixed(2);
            result.footprintW = footprintW_M.toFixed(2);
            result.footprintH = footprintH_M.toFixed(2);
            result.spacing = parseFloat(spacingM.toFixed(2));
            result.triggerDist = parseFloat(triggerDistM.toFixed(2));
        }

        return result;
    }

    /**
     * [修正] 計算相機投影在地面的 4 個角落 (Projected Footprint)
     * 使用正確的 Compass Heading 旋轉公式 (0=North, 90=East, CW)
     */
    calculateProjectedFootprint(droneKey, cameraKey, wp) {
        const drone = this.drones[droneKey];
        if (!drone) return null;
        const cam = drone.cameras[cameraKey];
        if (!cam) return null;

        // 1. 取得參數
        const alt = wp.altitude;
        if (alt <= 0) return null;

        // Pitch 限制 (避免水平或向上拍攝導致計算無限遠)
        let pitch = wp.actionGimbalPitch !== undefined ? wp.actionGimbalPitch : -90;
        if (pitch > -10) pitch = -10;

        const heading = wp.heading || 0;
        const sensorW = cam.sensorW;
        const sensorH = cam.sensorH;
        const focal = cam.focal;

        // 2. 計算半視角
        const hHFOV = Math.atan(sensorW / (2 * focal));
        const hVFOV = Math.atan(sensorH / (2 * focal));

        // 3. 定義相機視錐體的 4 個角
        const corners = [
            { dx: -1, dy: 1 },  // Top-Left
            { dx: 1, dy: 1 },   // Top-Right
            { dx: 1, dy: -1 },  // Bottom-Right
            { dx: -1, dy: -1 }  // Bottom-Left
        ];

        // 4. 計算 Pitch 帶來的地面投影偏移 (相對於無人機本身)
        const tiltRad = pitch * (Math.PI / 180); // e.g. -90 deg
        const groundOffsets = [];

        for (let corner of corners) {
            // 在相機坐標系中建立向量:
            // X: Right, Y: Forward (Lens Axis), Z: Up (Image Top)
            // 注意: 這裡我們重新定義坐標系以符合直覺運算
            // vRaw.x = 水平視角分量 (左右)
            // vRaw.y = 1.0 (前方光軸)
            // vRaw.z = 垂直視角分量 (上下, Image Top is Up)

            const vRaw = {
                x: corner.dx * Math.tan(hHFOV),
                y: 1.0,
                z: corner.dy * Math.tan(hVFOV)
            };

            // 對向量進行 Pitch 旋轉 (繞 X 軸轉)
            // 當 Pitch = -90 (向下看) 時，Y軸(Forward) 變為 -Z(Down)，Z軸(Up) 變為 Y(Forward)

            const pRad = tiltRad;
            const y_pitch = vRaw.y * Math.cos(pRad) - vRaw.z * Math.sin(pRad); // New Forward
            const z_pitch = vRaw.y * Math.sin(pRad) + vRaw.z * Math.cos(pRad); // New Up/Down

            // 射線追蹤: 找 Z=0 (地面) 的交點
            // Ray: P = O + t * V.  O=(0,0,alt). Target Z=0.
            // 0 = alt + t * z_pitch  =>  t = -alt / z_pitch

            if (z_pitch >= 0) return null; // 射向天空，無交點

            const t = -alt / z_pitch;

            // 取得相對於無人機的地面偏移量 (Meters)
            // forwardDist: 正數代表無人機前方，負數代表後方
            // rightDist: 正數代表無人機右方，負數代表左方
            const rightDist = vRaw.x * t;
            const forwardDist = y_pitch * t;

            groundOffsets.push({ r: rightDist, f: forwardDist });
        }

        // 5. 套用 Heading 旋轉 (Compass Rotation) 並轉為經緯度
        // 公式: 
        // East Offset  = Right * cos(H) + Forward * sin(H)
        // North Offset = -Right * sin(H) + Forward * cos(H)

        const rad = (heading * Math.PI) / 180;
        const latPerMeter = 1 / 111111;
        const lngPerMeter = 1 / (111111 * Math.cos(wp.lat * Math.PI / 180));

        const coords = groundOffsets.map(p => {
            // Compass Rotation (0 deg = North, 90 deg = East)
            const eastOffset = p.r * Math.cos(rad) + p.f * Math.sin(rad);
            const northOffset = -p.r * Math.sin(rad) + p.f * Math.cos(rad);

            return [
                wp.lat + northOffset * latPerMeter,
                wp.lng + eastOffset * lngPerMeter
            ];
        });

        return coords;
    }
}