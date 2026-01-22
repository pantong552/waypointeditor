const WaypointCalculator = require('./lib/calculator');

// Mock Data: Simple Square Polygon
const mockCoordinates = [
    { lat: 23.0, lng: 120.0 },
    { lat: 23.0, lng: 120.001 },
    { lat: 23.001, lng: 120.001 },
    { lat: 23.001, lng: 120.0 }
];

const mockSettings = {
    lineDirection: 'auto',
    spacing: 10,
    speed: 5,
    interval: 2
};

console.log('--- Starting Waypoint Calculation Test ---');
console.log('Settings:', mockSettings);
console.log('Coordinates:', mockCoordinates);

try {
    const calculator = new WaypointCalculator();
    const waypoints = calculator.generateWaypoints(mockCoordinates, mockSettings);

    console.log(`\nCalculation Complete! Generated ${waypoints.length} waypoints.`);

    if (waypoints.length > 0) {
        console.log('First Waypoint:', waypoints[0]);
        console.log('Last Waypoint:', waypoints[waypoints.length - 1]);
    } else {
        console.warn('WARNING: No waypoints generated. Check bounds or spacing settings.');
    }

} catch (e) {
    console.error('Test Failed:', e);
}
