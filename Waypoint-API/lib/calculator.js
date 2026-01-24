/**
 * Waypoint Calculator - Pure geometric implementation without Leaflet dependencies
 */
class WaypointCalculator {
    constructor() { }

    /**
     * Main entry point for generating waypoints
     */
    generateWaypoints(coordinates, settings = {}) {
        if (!coordinates || coordinates.length < 3) return [];

        const lineDirection = settings.lineDirection || 'auto';
        let finalWaypoints = [];

        if (lineDirection === 'auto') {
            let bestWaypoints = [];
            let minDistance = Infinity;

            // Scan 0-170 degrees
            for (let angle = 0; angle < 180; angle += 10) {
                const wps = this._generatePathForAngle(coordinates, settings, angle);
                const dist = this.calculateTotalPathDistance(wps);

                if (wps.length > 0 && dist < minDistance) {
                    minDistance = dist;
                    bestWaypoints = wps;
                }
            }
            finalWaypoints = bestWaypoints;
        } else if (lineDirection === 'ns') {
            finalWaypoints = this._generatePathForAngle(coordinates, settings, 90);
        } else {
            finalWaypoints = this._generatePathForAngle(coordinates, settings, 0);
        }

        finalWaypoints.forEach((wp, i) => wp.index = i);
        return finalWaypoints;
    }

    _generatePathForAngle(coordinates, settings, angle) {
        const bounds = this.getBounds(coordinates);
        const center = {
            lat: (bounds.minLat + bounds.maxLat) / 2,
            lng: (bounds.minLng + bounds.maxLng) / 2
        };

        const lineSpacing = parseFloat(settings.spacing) || 10;
        const pointSpacing = (parseFloat(settings.speed) || 5) * (parseFloat(settings.interval) || 2);

        if (lineSpacing <= 0.1 || pointSpacing <= 0.1) return [];

        // Project polygon to local coordinates once for efficiency
        const localPolygon = this._projectPolygonToLocal(coordinates, center);

        // Project and rotate corners to find extent in grid-space
        const corners = [
            { lat: bounds.minLat, lng: bounds.minLng },
            { lat: bounds.minLat, lng: bounds.maxLng },
            { lat: bounds.maxLat, lng: bounds.maxLng },
            { lat: bounds.maxLat, lng: bounds.minLng }
        ];

        let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
        corners.forEach(c => {
            const local = this._projectToLocal(c, center);
            const rotated = this._rotatePoint(local, angle);
            minU = Math.min(minU, rotated.x);
            maxU = Math.max(maxU, rotated.x);
            minV = Math.min(minV, rotated.y);
            maxV = Math.max(maxV, rotated.y);
        });

        // Expand scan area by buffer (equal to lineSpacing)
        const buffer = lineSpacing;

        minU -= buffer; maxU += buffer;
        minV -= buffer; maxV += buffer;

        const waypoints = [];
        let lineNumber = 0;

        for (let v = minV; v <= maxV; v += lineSpacing) {
            let linePoints = [];
            for (let u = minU; u <= maxU; u += pointSpacing) {
                const alignedP = { x: u, y: v };
                const localP = this._unrotatePoint(alignedP, angle);

                // Check purely in local metric space
                // Include if inside OR if within buffer distance from edge
                const isInside = this._isPointInsideLocalPolygon(localP, localPolygon);
                let isValid = isInside;

                if (!isValid) {
                    const dist = this._getDistanceFromPointToPolygon(localP, localPolygon);
                    if (dist <= buffer) {
                        isValid = true;
                    }
                }

                if (isValid) {
                    const latlng = this._unprojectFromLocal(localP, center);
                    linePoints.push(latlng);
                }
            }

            if (linePoints.length > 0) {
                if (lineNumber % 2 !== 0) linePoints.reverse();
                waypoints.push(...linePoints);
                lineNumber++;
            }
        }
        return waypoints;
    }

    _projectPolygonToLocal(latlngs, center) {
        return latlngs.map(p => this._projectToLocal(p, center));
    }

    _isPointInsideLocalPolygon(p, polyPoints) {
        let x = p.x, y = p.y;
        let inside = false;
        for (let i = 0, j = polyPoints.length - 1; i < polyPoints.length; j = i++) {
            let xi = polyPoints[i].x, yi = polyPoints[i].y;
            let xj = polyPoints[j].x, yj = polyPoints[j].y;

            let intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    _getDistanceFromPointToPolygon(p, polyPoints) {
        let minDistSq = Infinity;
        for (let i = 0; i < polyPoints.length; i++) {
            const p1 = polyPoints[i];
            const p2 = polyPoints[(i + 1) % polyPoints.length];
            const dSq = this._distToSegmentSquared(p, p1, p2);
            if (dSq < minDistSq) minDistSq = dSq;
        }
        return Math.sqrt(minDistSq);
    }

    _distToSegmentSquared(p, v, w) {
        const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
        if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const distSq = (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2;
        return distSq;
    }

    /* Old method kept for reference/compatibility if needed, but local check is preferred */
    isPointInsideShape(lat, lng, polyPoints) {
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

    _projectToLocal(latlng, center) {
        const metersPerLat = 111320;
        const metersPerLng = 111320 * Math.cos(center.lat * Math.PI / 180);
        return {
            x: (latlng.lng - center.lng) * metersPerLng,
            y: (latlng.lat - center.lat) * metersPerLat
        };
    }

    _unprojectFromLocal(p, center) {
        const metersPerLat = 111320;
        const metersPerLng = 111320 * Math.cos(center.lat * Math.PI / 180);
        return {
            lat: center.lat + (p.y / metersPerLat),
            lng: center.lng + (p.x / metersPerLng)
        };
    }

    _rotatePoint(p, angleDeg) {
        const rad = angleDeg * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return {
            x: p.x * cos - p.y * sin,
            y: p.x * sin + p.y * cos
        };
    }

    _unrotatePoint(p, angleDeg) {
        const rad = -angleDeg * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return {
            x: p.x * cos - p.y * sin,
            y: p.x * sin + p.y * cos
        };
    }

    calculateTotalPathDistance(wps) {
        let total = 0;
        for (let i = 0; i < wps.length - 1; i++) {
            total += this.getDistance(wps[i], wps[i + 1]);
        }
        return total;
    }

    getDistance(p1, p2) {
        const R = 6371000;
        const dLat = (p2.lat - p1.lat) * Math.PI / 180;
        const dLon = (p2.lng - p1.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    getBounds(coords) {
        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
        coords.forEach(c => {
            minLat = Math.min(minLat, c.lat);
            maxLat = Math.max(maxLat, c.lat);
            minLng = Math.min(minLng, c.lng);
            maxLng = Math.max(maxLng, c.lng);
        });
        return { minLat, maxLat, minLng, maxLng };
    }
}

module.exports = WaypointCalculator;
