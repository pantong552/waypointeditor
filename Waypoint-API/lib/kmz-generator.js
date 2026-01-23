const JSZip = require('jszip');

/**
 * KMZ Generator - DJI Pilot 2 (WPML) Standard Implementation
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

    this.globalActionId = 0;
    this.globalGroupId = 0;
  }

  async generateDJIKMZ(missionName, waypoints, settings = {}) {
    if (!missionName) missionName = 'Waypoints';

    // Reset counters
    this.globalActionId = 0;
    this.globalGroupId = 0;

    const zip = new JSZip();
    const wpmzFolder = zip.folder("wpmz");

    wpmzFolder.file("template.kml", this.createTemplateKml(waypoints, missionName, settings));
    wpmzFolder.file("waylines.wpml", this.createWaylinesWpml(waypoints, missionName, settings));

    // Generate Node Buffer
    const content = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: {
        level: 9
      }
    });

    return content;
  }

  createTemplateKml(waypoints, missionName, settings = {}) {
    const { droneName = 'MAVIC3', speed = 12, finalAction = 'goHome', droneEnumValue: explicitEnum } = settings;
    const droneEnumValue = explicitEnum || (this.droneModels[droneName] || this.droneModels.DEFAULT);
    const now = Date.now();

    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:wpml="http://www.dji.com/wpmz/1.0.2" xsi:schemaLocation="http://www.opengis.net/kml/2.2 http://schemas.opengis.net/kml/2.2.0/kml22.xsd">
  <Document>
    <name>${this.escapeXml(missionName)}</name>
    <wpml:author>WaypointMap</wpml:author>
    <wpml:createTime>${now}</wpml:createTime>
    <wpml:updateTime>${now}</wpml:updateTime>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>${this.mapFinishAction(finalAction)}</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>hover</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>${Math.max(1, Math.min(15, speed))}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>${droneEnumValue}</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
    <Folder>
      <name>Waypoints</name>
      <wpml:templateId>0</wpml:templateId>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:autoFlightSpeed>${speed}</wpml:autoFlightSpeed>
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
`;
    waypoints.forEach((wp, index) => {
      kml += `      <Placemark>
        <name>Waypoint ${index}</name>
        <Point><coordinates>${wp.lng.toFixed(8)},${wp.lat.toFixed(8)},${wp.altitude || 60}</coordinates></Point>
        <wpml:index>${index}</wpml:index>
      </Placemark>\n`;
    });
    kml += `    </Folder>
  </Document>
</kml>`;
    return kml;
  }

  createWaylinesWpml(waypoints, missionName, settings = {}) {
    const { altitude = 60, speed = 12, droneName = 'MAVIC3', finalAction = 'goHome', executeHeightMode = 'relativeToStartPoint', turnMode = 'toPointAndStopWithContinuityCurvature', droneEnumValue: explicitEnum } = settings;
    const droneEnumValue = explicitEnum || (this.droneModels[droneName] || this.droneModels.DEFAULT);
    const now = Date.now();
    const totalDistance = this.calculateTotalDistance(waypoints);
    const estimatedTime = this.calculateEstimatedTime(waypoints, speed);
    const isStraightLine = turnMode === 'toPointAndStopWithDiscontinuityCurvature' ? 1 : 0;

    let wpml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:wpml="http://www.dji.com/wpmz/1.0.2" xsi:schemaLocation="http://www.opengis.net/kml/2.2 http://schemas.opengis.net/kml/2.2.0/kml22.xsd">
  <Document>
    <wpml:author>WaypointMap</wpml:author>
    <wpml:createTime>${now}</wpml:createTime>
    <wpml:updateTime>${now}</wpml:updateTime>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>${this.mapFinishAction(finalAction)}</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>hover</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>${Math.max(1, Math.min(15, speed))}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>${droneEnumValue}</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
    <Folder>
      <wpml:templateId>0</wpml:templateId>
      <wpml:executeHeightMode>${executeHeightMode}</wpml:executeHeightMode>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:distance>${Math.round(totalDistance)}</wpml:distance>
      <wpml:duration>${Math.round(estimatedTime)}</wpml:duration>
      <wpml:autoFlightSpeed>${speed}</wpml:autoFlightSpeed>
`;

    waypoints.forEach((wp, index) => {
      const nextWp = index < waypoints.length - 1 ? waypoints[index + 1] : null;

      const wpAltitude = wp.altitude || altitude;
      const wpSpeed = wp.speed || speed;
      const wpHeading = wp.heading || settings.heading || 0;
      const wpActionPitch = wp.actionGimbalPitch ?? settings.actionGimbalPitch ?? -75;

      const nextActionPitch = nextWp ? (nextWp.actionGimbalPitch ?? settings.actionGimbalPitch ?? -75) : null;

      const validAltitude = Math.max(5, Math.min(500, wpAltitude));
      const validSpeed = Math.max(0.5, Math.min(19, wpSpeed));
      let validHeading = ((wpHeading % 360) + 360) % 360;
      if (validHeading > 180) validHeading -= 360;

      // 檢查是否為 Auto (DJI default) 模式
      const isAutoDJI = (settings.headingMode === 'autoDJI');

      if (isAutoDJI) {
        wpml += `      <Placemark>
        <Point><coordinates>${wp.lng.toFixed(8)},${wp.lat.toFixed(8)},${validAltitude}</coordinates></Point>
        <wpml:index>${index}</wpml:index>
        <wpml:executeHeight>${validAltitude}</wpml:executeHeight>
        <wpml:waypointSpeed>${validSpeed}</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
          <wpml:waypointHeadingAngle>0</wpml:waypointHeadingAngle>
          <wpml:waypointHeadingAngleEnable>0</wpml:waypointHeadingAngleEnable>
          <wpml:waypointHeadingPathMode>followBadArc</wpml:waypointHeadingPathMode>
          <wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>
          <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>
        <wpml:useStraightLine>${isStraightLine}</wpml:useStraightLine>
${this.generateActionGroups(index, wp, wpActionPitch, nextActionPitch)}
        <wpml:waypointGimbalHeadingParam>
          <wpml:waypointGimbalPitchAngle>0</wpml:waypointGimbalPitchAngle>
          <wpml:waypointGimbalYawAngle>0</wpml:waypointGimbalYawAngle>
        </wpml:waypointGimbalHeadingParam>
      </Placemark>\n`;
      } else {
        // 原有的 Auto (Course) 或 Fixed 邏輯
        wpml += `      <Placemark>
        <Point><coordinates>${wp.lng.toFixed(8)},${wp.lat.toFixed(8)},${validAltitude}</coordinates></Point>
        <wpml:index>${index}</wpml:index>
        <wpml:executeHeight>${validAltitude}</wpml:executeHeight>
        <wpml:waypointSpeed>${validSpeed}</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>smoothTransition</wpml:waypointHeadingMode>
          <wpml:waypointHeadingAngle>${validHeading}</wpml:waypointHeadingAngle>
          <wpml:waypointHeadingAngleEnable>1</wpml:waypointHeadingAngleEnable>
          <wpml:waypointHeadingPathMode>followBadArc</wpml:waypointHeadingPathMode>
          <wpml:waypointPoiPoint>0.0,0.0,0.0</wpml:waypointPoiPoint>
          <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>
        <wpml:useStraightLine>${isStraightLine}</wpml:useStraightLine>
${this.generateActionGroups(index, wp, wpActionPitch, nextActionPitch)}
        <wpml:waypointGimbalHeadingParam>
          <wpml:waypointGimbalPitchAngle>0</wpml:waypointGimbalPitchAngle>
          <wpml:waypointGimbalYawAngle>0</wpml:waypointGimbalYawAngle>
        </wpml:waypointGimbalHeadingParam>
      </Placemark>\n`;
      }
    });

    wpml += `    </Folder>
  </Document>
</kml>`;
    return wpml;
  }

  generateActionGroups(index, wp, currentPitch, nextPitch) {
    let xml = '';
    const actionType = wp.action || 'noAction';

    if (actionType !== 'noAction') {
      this.globalGroupId++;
      const groupId = this.globalGroupId;

      this.globalActionId++;
      const mainActionId = this.globalActionId;
      const mainActionXml = this.createMainActionXml(mainActionId, actionType);

      this.globalActionId++;
      const gimbalActionId = this.globalActionId;
      const gimbalActionXml = this.createGimbalRotateXml(gimbalActionId, currentPitch);

      xml += `        <wpml:actionGroup>
          <wpml:actionGroupId>${groupId}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>${index}</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>${index}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>parallel</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
          </wpml:actionTrigger>
${mainActionXml}
${gimbalActionXml}
        </wpml:actionGroup>\n`;
    }

    if (nextPitch !== null) {
      this.globalGroupId++;
      const transGroupId = this.globalGroupId;

      this.globalActionId++;
      const transActionId = this.globalActionId;

      const evenlyRotateXml = this.createGimbalEvenlyRotateXml(transActionId, nextPitch);

      xml += `        <wpml:actionGroup>
          <wpml:actionGroupId>${transGroupId}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>${index}</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>${index + 1}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>parallel</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
          </wpml:actionTrigger>
${evenlyRotateXml}
        </wpml:actionGroup>\n`;
    }

    return xml;
  }

  createMainActionXml(id, type) {
    const funcName = this.mapActionType(type);
    if (type === 'gimbalRotate') return '';

    return `          <wpml:action>
            <wpml:actionId>${id}</wpml:actionId>
            <wpml:actionActuatorFunc>${funcName}</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
              <wpml:useGlobalPayloadLensIndex>0</wpml:useGlobalPayloadLensIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>`;
  }

  createGimbalRotateXml(id, pitch) {
    return `          <wpml:action>
            <wpml:actionId>${id}</wpml:actionId>
            <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase>
              <wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>
              <wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable>
              <wpml:gimbalPitchRotateAngle>${pitch}</wpml:gimbalPitchRotateAngle>
              <wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable>
              <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
              <wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable>
              <wpml:gimbalYawRotateAngle>0</wpml:gimbalYawRotateAngle>
              <wpml:gimbalRotateTimeEnable>0</wpml:gimbalRotateTimeEnable>
              <wpml:gimbalRotateTime>0</wpml:gimbalRotateTime>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>`;
  }

  createGimbalEvenlyRotateXml(id, pitch) {
    return `          <wpml:action>
            <wpml:actionId>${id}</wpml:actionId>
            <wpml:actionActuatorFunc>gimbalEvenlyRotate</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:gimbalPitchRotateAngle>${pitch}</wpml:gimbalPitchRotateAngle>
              <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>`;
  }

  mapActionType(action) {
    const actionMap = {
      'takePhoto': 'takePhoto',
      'startRecord': 'startRecord',
      'stopRecord': 'stopRecord',
      'hover': 'hover',
      'gimbalRotate': 'gimbalRotate',
      'noAction': null
    };
    return actionMap[action] || 'takePhoto';
  }

  mapFinishAction(action) {
    const actionMap = { 'goHome': 'goHome', 'autoLanding': 'autoLanding', 'return': 'goHome', 'land': 'autoLanding', 'hover': 'noAction', 'noAction': 'noAction' };
    return actionMap[action] || 'goHome';
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
    const hoverTime = waypoints.length * 2;
    return flightTime + hoverTime;
  }

  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  escapeXml(str) {
    return String(str).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char] || char);
  }
}

module.exports = KMZGenerator;
