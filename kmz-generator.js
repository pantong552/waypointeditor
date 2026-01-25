/**
 * KMZ Generator - DJI Pilot 2 (WPML) Standard Implementation
 * Generates proper DJI WPML 1.0.2 compatible KMZ files with correct structure:
 * - wpmz/ folder containing:
 * - template.kml (for map preview)
 * - waylines.wpml (for drone execution)
 * * Reference: DJI WPML (Waypoint Mission Markup Language) 1.0.2
 * Requires: JSZip and FileSaver libraries
 */

class KMZGenerator {
  constructor() {
    this.namespaces = {
      kml: 'http://www.opengis.net/kml/2.2',
      xsi: 'http://www.w3.org/2001/XMLSchema-instance',
      wpml: 'http://www.dji.com/wpmz/1.0.2'
    };

    this.droneModels = {
      'MAVIC3': 68,
      'AIR3': 102,
      'MINI4PRO': 58,
      'M300RTK': 20,
      'M210RTK': 17,
      'DEFAULT': 68
    };

    // Global counters for unique IDs across the mission
    this.globalActionId = 0;
    this.globalGroupId = 0;
  }

  async generateDJIKMZ(missionName, waypoints, settings = {}) {
    try {
      if (!missionName || missionName.trim() === '') throw new Error('Mission name is required');
      if (!waypoints || waypoints.length === 0) throw new Error('At least one waypoint is required');

      // [Modified] Use Vercel API
      const API_URL = 'https://waypoint-api-rho.vercel.app/api/generate-kmz';

      const payload = {
        missionName,
        waypoints,
        settings
      };

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `API Error: ${response.statusText}`);
      }

      const blob = await response.blob();
      saveAs(blob, `${missionName}.kmz`);

      console.log(`✓ Downloaded KMZ from API: ${missionName}.kmz`);
      return true;
    } catch (error) {
      console.error('❌ Error generating KMZ via API:', error);
      alert('Error generating KMZ file: ' + error.message);
      return false;
    }
  }

  /**
   * [Legacy/Removed] XML generation logic moved to API
   */



  generateJSON(missionName, waypoints, settings = {}) {
    return { mission: { name: missionName, waypoints: waypoints } }; // Simplified for brevity
  }

  calculateTotalDistance(waypoints) {
    if (waypoints.length < 2) return 0;
    let distance = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      distance += this.haversineDistance(waypoints[i].lat, waypoints[i].lng, waypoints[i + 1].lat, waypoints[i + 1].lng);
    }
    return distance;
  }

  calculateEstimatedTime(waypoints, speed) {
    if (!speed || speed <= 0) speed = 12;
    const distance = this.calculateTotalDistance(waypoints);
    const flightTime = Math.round(distance / speed);
    // [Modified] Removed hover time for consistency with Photogrammetry (continuous flight)
    return flightTime;
  }

  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  downloadJSON(missionName, waypoints, settings = {}) {
    const jsonData = this.generateJSON(missionName, waypoints, settings);
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${missionName}_debug.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0s';
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
    return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  formatDistance(meters) {
    return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
  }

  escapeXml(str) {
    return String(str).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char] || char);
  }
}

const kmzGenerator = new KMZGenerator();