/**
 * Satellite Tracker Logic
 * 
 * This script handles the core functionality of the satellite tracker application, including:
 * 1. Initializing the Google Map and its layers (Night, Solar, Snow, Cloud).
 * 2. Fetching and parsing TLE (Two-Line Element) data for satellites.
 * 3. Propagating satellite orbits using satellite.js.
 * 4. Predicting future passes based on user location and constraints.
 * 5. integrating weather forecasts from Open-Meteo.
 * 
 * Dependencies:
 * - Google Maps JavaScript API
 * - satellite.js (for orbit propagation)
 */

let map;
let nightLayer;
let solarAngleLayer;
let snowCoverLayer;
let cloudCoverLayer;
let satellites = [
    { name: "PLEIADES NEO 3", catNr: 48268, marker: null, satrec: null, pastPath: null, futurePath: null, cones: [] },
    { name: "PLEIADES NEO 4", catNr: 49070, marker: null, satrec: null, pastPath: null, futurePath: null, cones: [] }
];

const SATELLITE_ICON_PATH = "M2 9l-2-2 4-4 2 2-4 4zm2-2l6-6 2 2-6 6-2-2zm-2 2l-2 2 4 4 2-2-4-4zm11-11l2-2 4 4-2 2-4-4zm-2 2l6 6-2 2-6-6 2-2z";
// A simple satellite shape: body and solar panels
const SATELLITE_SVG = {
    path: "M -1,-1 h 2 v 2 h -2 z M -5,-1 h 4 v 2 h -4 z M 1,-1 h 4 v 2 h -4 z",
    fillColor: "#00F",
    fillOpacity: 1,
    strokeWeight: 1,
    strokeColor: "#FFF",
    scale: 2,
    anchor: { x: 0, y: 0 },
    labelOrigin: { x: 0, y: -20 } // Move label above the icon
};

/**
 * Initializes the Google Map and sets up all overlay layers.
 * Called by the Google Maps API callback.
 */
function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 0, lng: 0 },
        zoom: 2,
        mapTypeId: 'hybrid',
        disableDefaultUI: false, // Enable standard controls
        streetViewControl: false, // Disable Street View
        mapTypeControl: false, // Disable Map Type toggle
        zoomControl: true, // Explicitly enable Zoom
        minZoom: 2,
        restriction: {
            latLngBounds: { north: 85, south: -85, west: -180, east: 180 },
            strictBounds: false
        }
    });

    nightLayer = new google.maps.Polygon({
        map: map,
        fillColor: '#000000',
        fillOpacity: 0.7,
        strokeWeight: 0,
        clickable: false
    });

    const toggleSolarEl = document.getElementById('toggleSolar');
    solarAngleLayer = new google.maps.Polygon({
        map: (toggleSolarEl && toggleSolarEl.checked) ? map : null,
        fillColor: '#FF0000', // Red for exclusion zone
        fillOpacity: 0.25,
        strokeWeight: 0,
        clickable: false,
        geodesic: false // Important for straight latitude lines
    });

    // Initialize Snow Cover Layer (NASA GIBS)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

    snowCoverLayer = new google.maps.ImageMapType({
        getTileUrl: function (coord, zoom) {
            const range = 1 << zoom;
            if (coord.y < 0 || coord.y >= range) return null;
            const x = (coord.x % range + range) % range;
            return `https://gibs-a.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDSI_Snow_Cover/default/${dateStr}/GoogleMapsCompatible_Level8/${zoom}/${coord.y}/${x}.png`;
        },
        tileSize: new google.maps.Size(256, 256),
        maxZoom: 9, // MODIS resolution is limited
        name: 'Snow Cover',
        opacity: 0.7
    });

    // Initialize Cloud Cover Layer (NASA GIBS)
    cloudCoverLayer = new google.maps.ImageMapType({
        getTileUrl: function (coord, zoom) {
            const range = 1 << zoom;
            if (coord.y < 0 || coord.y >= range) return null;
            const x = (coord.x % range + range) % range;
            return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${dateStr}/GoogleMapsCompatible_Level9/${zoom}/${coord.y}/${x}.jpg`;
        },
        tileSize: new google.maps.Size(256, 256),
        maxZoom: 9,
        name: 'Cloud Cover',
        opacity: 0.7
    });

    // Attribution for NASA GIBS
    const attributionDiv = document.createElement('div');
    attributionDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
    attributionDiv.style.padding = '2px 5px';
    attributionDiv.style.fontSize = '10px';
    attributionDiv.style.margin = '5px';
    attributionDiv.innerHTML = 'Data: <a href="https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs" target="_blank">NASA GIBS</a>';
    attributionDiv.style.display = 'none'; // Hidden by default
    map.controls[google.maps.ControlPosition.BOTTOM_RIGHT].push(attributionDiv);

    function updateAttribution() {
        const snowChecked = document.getElementById('toggleSnow').checked;
        const cloudChecked = document.getElementById('toggleCloud').checked;
        if (snowChecked || cloudChecked) {
            attributionDiv.style.display = 'block';
        } else {
            attributionDiv.style.display = 'none';
        }
    }





    // Toggle Snow Cover
    const toggleSnow = document.getElementById('toggleSnow');
    if (toggleSnow) {
        toggleSnow.addEventListener('change', (e) => {
            if (e.target.checked) {
                map.overlayMapTypes.push(snowCoverLayer);
            } else {
                map.overlayMapTypes.forEach((layer, index) => {
                    if (layer === snowCoverLayer) {
                        map.overlayMapTypes.removeAt(index);
                    }
                });
            }
            updateAttribution();
        });
    }

    // Toggle Cloud Cover
    const toggleCloud = document.getElementById('toggleCloud');
    if (toggleCloud) {
        toggleCloud.addEventListener('change', (e) => {
            if (e.target.checked) {
                map.overlayMapTypes.push(cloudCoverLayer);
            } else {
                map.overlayMapTypes.forEach((layer, index) => {
                    if (layer === cloudCoverLayer) {
                        map.overlayMapTypes.removeAt(index);
                    }
                });
            }
            updateAttribution();
        });
    }

    const toggleSolar = document.getElementById('toggleSolar');
    if (toggleSolar) {
        toggleSolar.addEventListener('change', function () {
            console.log('Toggle clicked. Checked:', this.checked);
            if (this.checked) {
                solarAngleLayer.setMap(map);
                console.log('Layer set to map');
            } else {
                solarAngleLayer.setMap(null);
                console.log('Layer removed from map');
            }

            // Toggle Legend Visibility
            const sunLegend = document.getElementById('sun-legend');
            if (sunLegend) {
                sunLegend.style.display = this.checked ? 'block' : 'none';
            }

            // Also toggle the marginal layer if it exists
            if (window.marginalSolarLayer) {
                window.marginalSolarLayer.setVisible(this.checked);
            }
        });
    }

    fetchTLEs();
}

/**
 * Fetches TLE data from the local 'satellites.json' file.
 * This file is updated automatically by a GitHub Action.
 * 
 * It parses the TLEs and initializes the satellite objects for propagation.
 */
async function fetchTLEs() {
    console.log("Fetching TLEs from local file...");

    try {
        const response = await fetch('./satellites.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();

        data.forEach(item => {
            // Find the corresponding satellite object in our global array
            const sat = satellites.find(s => s.catNr === item.catNr);
            if (sat) {
                sat.satrec = satellite.twoline2satrec(item.line1, item.line2);
                createVisuals(sat);
            } else {
                console.warn(`Satellite ${item.name} (${item.catNr}) found in JSON but not in global config.`);
            }
        });



    } catch (error) {
        console.error("Error loading satellites.json:", error);
    } finally {
        // Start updating positions regardless of whether satellites loaded
        // This ensures day/night cycle and solar layers still work
        setInterval(updatePositions, 1000);
        updatePositions(); // Initial update
    }
}

function createVisuals(sat) {
    if (!sat.marker) {
        sat.marker = new google.maps.Marker({
            map: map,
            title: sat.name,
            label: {
                text: sat.name,
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: "bold",
                className: "satellite-label" // For optional CSS styling
            },
            icon: SATELLITE_SVG
        });
    }

    // Create Cones (Circles)
    if (sat.cones.length === 0) {
        const colors = ['#00FF00', '#FFFF00', '#FF0000']; // Green, Yellow, Red
        const opacities = [0.2, 0.15, 0.1]; // Inner to Outer

        for (let i = 0; i < 3; i++) {
            const cone = new google.maps.Circle({
                map: map,
                fillColor: colors[i],
                fillOpacity: opacities[i],
                strokeColor: colors[i],
                strokeOpacity: 0.8,
                strokeWeight: 1,
                clickable: false
            });
            sat.cones.push(cone);
        }
    }

    if (!sat.pastPath) {
        sat.pastPath = new google.maps.Polyline({
            map: map,
            geodesic: true,
            strokeColor: '#FFFF00', // Yellow for past
            strokeOpacity: 0.5,
            strokeWeight: 2
        });
    }

    if (!sat.futurePath) {
        sat.futurePath = new google.maps.Polyline({
            map: map,
            geodesic: true,
            strokeColor: '#00FF00', // Green for future
            strokeOpacity: 0.5,
            strokeWeight: 2
        });
    }
}

/**
 * Calculates the satellite's position (Lat/Lng) at a specific time.
 * 
 * @param {Object} satrec - The satellite record object from satellite.js
 * @param {Date} date - The time to calculate position for
 * @returns {Object|null} {lat, lng} or null if calculation fails
 */
function getLatLngAtTime(satrec, date) {
    const positionAndVelocity = satellite.propagate(satrec, date);
    const positionEci = positionAndVelocity.position;

    if (!positionEci) return null;

    const gmst = satellite.gstime(date);
    const positionGd = satellite.eciToGeodetic(positionEci, gmst);

    const longitude = satellite.degreesLong(positionGd.longitude);
    const latitude = satellite.degreesLat(positionGd.latitude);

    return { lat: latitude, lng: longitude };
}

/**
 * Calculates the radius of the satellite's footprint on the ground based on the
 * maximum off-nadir angle.
 * 
 * Uses spherical geometry to determine the surface distance from the sub-satellite point
 * to the edge of the visible cone.
 * 
 * @param {number} altitudeKm - Satellite altitude in kilometers
 * @param {number} offNadirDeg - The off-nadir angle in degrees
 * @returns {number} Radius in meters
 */
function calculateFootprintRadius(altitudeKm, offNadirDeg) {
    const R_EARTH = 6371; // Earth radius in km
    const alpha = offNadirDeg * (Math.PI / 180); // Off-nadir angle in radians

    // Calculate Earth central angle (lambda)
    // sin(alpha + lambda) / R_EARTH = sin(alpha) / R_EARTH  <-- Wait, using law of sines
    // Correct formula:
    // sin(eta) = sin(alpha) * (R_EARTH + altitudeKm) / R_EARTH
    // where eta is the angle at the target on the ground (incidence angle)
    // However, if sin(eta) > 1, the target is not visible (beyond horizon).
    // Then lambda = eta - alpha - 90 (if using standard angles) or similar.

    // Easier approach:
    // Slant range geometry.
    // Let beta be the earth central angle.
    // sin(alpha + beta) = (R_EARTH + altitudeKm)/R_EARTH * sin(alpha)
    // This is valid if alpha + beta < 90 degrees (horizon).

    const sinAlpha = Math.sin(alpha);
    let term = ((R_EARTH + altitudeKm) / R_EARTH) * sinAlpha;

    if (term > 1) term = 1; // Clamp to handle floating point noise at horizon

    // Angle at the surface (incidence angle + 90?)
    // Let's use the property: alpha + beta + (180 - eta) = 180 => beta = eta - alpha
    // sin(eta) = term
    const eta = Math.asin(term);
    const beta = eta - alpha;

    // Surface distance (arc length)
    const distanceKm = R_EARTH * beta;
    return distanceKm * 1000; // Convert to meters
}

/**
 * Main animation loop. Updates the position of all satellites, markers, cones,
 * and the day/night terminator.
 * Called every second.
 */
function updatePositions() {
    const now = new Date();

    updateNightLayer(now);
    updateSolarAngleLayer(now);

    satellites.forEach(sat => {
        if (!sat.satrec) return;

        // Update Marker
        const currentPos = getLatLngAtTime(sat.satrec, now);
        if (currentPos && sat.marker) {
            if (isNaN(currentPos.lat) || isNaN(currentPos.lng)) {
                console.error(`Invalid position for ${sat.name}:`, currentPos);
            }
            sat.marker.setPosition(currentPos);

            // Update Cones
            // We need altitude. satellite.js gives position in km.
            const positionAndVelocity = satellite.propagate(sat.satrec, now);
            const positionEci = positionAndVelocity.position;
            const gmst = satellite.gstime(now);
            const positionGd = satellite.eciToGeodetic(positionEci, gmst);
            const altitudeKm = positionGd.height; // Height in km

            const offNadirAngles = [10, 20, 30];

            sat.cones.forEach((cone, index) => {
                const radius = calculateFootprintRadius(altitudeKm, offNadirAngles[index]);
                cone.setCenter(currentPos);
                cone.setRadius(radius);
            });
        }

        // Update Tracks
        // Calculate past track (last 90 mins)
        const pastPathCoords = [];
        for (let i = -90; i <= 0; i += 2) { // Every 2 minutes
            const t = new Date(now.getTime() + i * 60000);
            const pos = getLatLngAtTime(sat.satrec, t);
            if (pos) pastPathCoords.push(pos);
        }
        if (sat.pastPath) sat.pastPath.setPath(pastPathCoords);

        // Calculate future track (next 90 mins)
        const futurePathCoords = [];
        for (let i = 0; i <= 90; i += 2) { // Every 2 minutes
            const t = new Date(now.getTime() + i * 60000);
            const pos = getLatLngAtTime(sat.satrec, t);
            if (pos) futurePathCoords.push(pos);
        }
        if (sat.futurePath) sat.futurePath.setPath(futurePathCoords);
    });
}

function updateNightLayer(date) {
    const sunPos = getSunPosition(date);
    const path = getTerminatorPath(sunPos.lat, sunPos.lng);
    nightLayer.setPath(path);
}

/**
 * Updates the Solar Angle Layer (Red/Yellow zones).
 * 
 * This visualizes areas where the sun elevation is too low for good imaging.
 * - Red Zone: Sun elevation is < 30° even at solar noon (Always below 30°).
 * - Yellow Zone: Sun elevation is < 30° at 10:30 AM but improves later (Sometimes above 30°).
 * 
 * @param {Date} date - Current date/time
 */
function updateSolarAngleLayer(date) {
    const sunPos = getSunPosition(date);
    const declination = sunPos.lat; // getSunPosition returns lat as declination

    // We want to find latitudes where solar elevation at 10:30 AM is < 30 degrees.
    // We need two thresholds:
    // 1. Red Zone: Max Elevation (at Noon) < 30 degrees.
    // 2. Yellow Zone: 10:30 AM Elevation < 30 degrees (but Noon >= 30).

    const minEl_deg = 30;
    const rad = Math.PI / 180;
    const sinDec = Math.sin(declination * rad);
    const cosDec = Math.cos(declination * rad);
    const sinMinEl = Math.sin(minEl_deg * rad);

    // Hour Angles
    const H_noon = 0; // Noon
    const H_1030 = -22.5; // 10:30 AM

    const cosH_noon = Math.cos(H_noon * rad);
    const cosH_1030 = Math.cos(H_1030 * rad);

    // Scan latitudes
    let redStart = null, redEnd = null;
    let yellowStart = null, yellowEnd = null;

    // We will build "Good" ranges for Noon and 10:30
    // Noon Good: El >= 30 at Noon.
    // 10:30 Good: El >= 30 at 10:30.

    // The Red Zone is where Noon is BAD.
    // The Yellow Zone is where Noon is GOOD but 10:30 is BAD.

    // Let's find the "Good" range for Noon first.
    let noonGoodStart = null, noonGoodEnd = null;
    for (let lat = -90; lat <= 90; lat += 0.5) {
        const latRad = lat * rad;
        const sinLat = Math.sin(latRad);
        const cosLat = Math.cos(latRad);
        const sinEl = sinLat * sinDec + cosLat * cosDec * cosH_noon;
        if (sinEl >= sinMinEl) {
            if (noonGoodStart === null) noonGoodStart = lat;
            noonGoodEnd = lat;
        }
    }

    // Now find "Good" range for 10:30
    let ten30GoodStart = null, ten30GoodEnd = null;
    for (let lat = -90; lat <= 90; lat += 0.5) {
        const latRad = lat * rad;
        const sinLat = Math.sin(latRad);
        const cosLat = Math.cos(latRad);
        const sinEl = sinLat * sinDec + cosLat * cosDec * cosH_1030;
        if (sinEl >= sinMinEl) {
            if (ten30GoodStart === null) ten30GoodStart = lat;
            ten30GoodEnd = lat;
        }
    }

    console.log(`Solar Update: Dec=${declination.toFixed(2)}`);
    console.log(`Noon Good: [${noonGoodStart}, ${noonGoodEnd}]`);
    console.log(`10:30 Good: [${ten30GoodStart}, ${ten30GoodEnd}]`);

    // Red Zone = Outside Noon Good Range
    const redPaths = [];
    if (noonGoodStart !== null && noonGoodEnd !== null) {
        if (noonGoodStart > -90) redPaths.push(createBoxPath(-90, noonGoodStart));
        if (noonGoodEnd < 90) redPaths.push(createBoxPath(noonGoodEnd, 90));
    } else {
        redPaths.push(createBoxPath(-90, 90)); // All Red
    }

    // Yellow Zone = Inside Noon Good Range BUT Outside 10:30 Good Range
    // Effectively: (NoonGood - 10:30Good)
    // Since 10:30 Good is always a SUBSET of Noon Good (sun is lower at 10:30),
    // The Yellow zone is [NoonGoodStart, 10:30GoodStart] and [10:30GoodEnd, NoonGoodEnd].

    const yellowPaths = [];
    if (noonGoodStart !== null && ten30GoodStart !== null) {
        // Southern Band
        if (ten30GoodStart > noonGoodStart) {
            yellowPaths.push(createBoxPath(noonGoodStart, ten30GoodStart));
        }
        // Northern Band
        if (noonGoodEnd > ten30GoodEnd) {
            yellowPaths.push(createBoxPath(ten30GoodEnd, noonGoodEnd));
        }
    }

    solarAngleLayer.setPaths(redPaths);

    // We need a second layer for Yellow. 
    // If it doesn't exist, create it.
    if (!window.marginalSolarLayer) {
        window.marginalSolarLayer = new google.maps.Polygon({
            map: map,
            strokeWeight: 0,
            fillColor: '#FFC107', // Amber/Yellow
            fillOpacity: 0.35,
            clickable: false,
            paths: []
        });
    }
    window.marginalSolarLayer.setPaths(yellowPaths);

    // Ensure visibility matches toggle
    const toggleSolar = document.getElementById('toggleSolar');
    const isVisible = toggleSolar ? toggleSolar.checked : false;
    window.marginalSolarLayer.setVisible(isVisible);
}

function createBoxPath(latMin, latMax) {
    return [
        { lat: latMin, lng: -180 },
        { lat: latMax, lng: -180 },
        { lat: latMax, lng: 0 },
        { lat: latMax, lng: 180 },
        { lat: latMin, lng: 180 },
        { lat: latMin, lng: 0 }
    ];
}

/**
 * Calculates the Sun's position (Declination and Right Ascension/Longitude) for a given date.
 * Uses low-precision formulas suitable for this visualization (accuracy ~0.01 deg).
 * 
 * @param {Date} date 
 * @returns {Object} {lat: declination, lng: sub-solar longitude}
 */
function getSunPosition(date) {
    const rad = Math.PI / 180;
    const deg = 180 / Math.PI;

    // Julian Date
    const jd = (date.getTime() / 86400000) + 2440587.5;
    const n = jd - 2451545.0;

    // Mean longitude of Sun
    let L = 280.460 + 0.9856474 * n;
    L %= 360;
    if (L < 0) L += 360;

    // Mean anomaly of Sun
    let g = 357.528 + 0.9856003 * n;
    g %= 360;
    if (g < 0) g += 360;

    // Ecliptic longitude
    const lambda = L + 1.915 * Math.sin(g * rad) + 0.020 * Math.sin(2 * g * rad);

    // Obliquity of ecliptic
    const epsilon = 23.439 - 0.0000004 * n;

    // Right ascension and declination
    const alpha = Math.atan2(Math.cos(epsilon * rad) * Math.sin(lambda * rad), Math.cos(lambda * rad)) * deg;
    const delta = Math.asin(Math.sin(epsilon * rad) * Math.sin(lambda * rad)) * deg;

    // Greenwich Mean Sidereal Time
    // Use satellite.js function for consistency
    const gmstRad = satellite.gstime(date);
    const gmstDeg = gmstRad * deg;

    // Sub-solar longitude
    let subSolarLng = alpha - gmstDeg;
    // Normalize longitude to -180 to 180
    subSolarLng %= 360;
    if (subSolarLng > 180) subSolarLng -= 360;
    if (subSolarLng < -180) subSolarLng += 360;

    return { lat: delta, lng: subSolarLng };
}

function getTerminatorPath(sunLat, sunLng) {
    // We want the night side.
    // The night center is opposite to the sun.
    const nightLat = -sunLat;
    let nightLng = sunLng + 180;
    if (nightLng > 180) nightLng -= 360;

    return getCirclePath(nightLat, nightLng, 90);
}

function getCirclePath(centerLat, centerLng, radiusDeg) {
    const rad = Math.PI / 180;
    const deg = 180 / Math.PI;

    const path = [];
    for (let i = 0; i <= 360; i += 5) {
        const bearing = i;
        const dist = radiusDeg * rad;

        const lat1 = centerLat * rad;
        const lon1 = centerLng * rad;
        const brng = bearing * rad;

        let arg = Math.sin(lat1) * Math.cos(dist) + Math.cos(lat1) * Math.sin(dist) * Math.cos(brng);
        if (arg > 1) arg = 1;
        if (arg < -1) arg = -1;
        const lat2 = Math.asin(arg);
        const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dist) * Math.cos(lat1), Math.cos(dist) - Math.sin(lat1) * Math.sin(lat2));

        path.push({ lat: lat2 * deg, lng: lon2 * deg });
    }

    return path;
}

// --- Pass Prediction Logic ---

document.addEventListener('DOMContentLoaded', () => {
    console.log("Checking for prediction panel...");
    const panel = document.getElementById('prediction-panel');
    if (panel) {
        console.log("Prediction panel FOUND!", panel);
        panel.style.display = 'block'; // Force it via JS too
    } else {
        console.error("Prediction panel NOT FOUND in DOM!");
    }

    // Max Off-Nadir Input Logic
    const maxOffNadirInput = document.getElementById('maxOffNadir');
    if (maxOffNadirInput) {
        // Strict input validation for mobile/desktop
        maxOffNadirInput.addEventListener('input', (e) => {
            // Remove any non-digit characters
            e.target.value = e.target.value.replace(/[^0-9]/g, '');

            // Validate range
            let val = parseInt(e.target.value);
            if (val > 90) e.target.value = 90;
            // Don't enforce min=1 strictly on input to allow typing, but maybe on blur
        });

        maxOffNadirInput.addEventListener('blur', (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val) || val < 1) e.target.value = 1;
        });

        // Add Enter key support
        maxOffNadirInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handlePrediction();
            }
        });
    }

    // Minimize Button Logic
    const minimizeBtn = document.getElementById('minimizeBtn');
    const panelBody = document.getElementById('panel-body');
    if (minimizeBtn && panelBody) {
        minimizeBtn.addEventListener('click', () => {
            if (panelBody.style.display === 'none') {
                panelBody.style.display = 'flex'; // Use flex to maintain layout
                minimizeBtn.textContent = '_';
                minimizeBtn.title = "Minimize";
            } else {
                panelBody.style.display = 'none';
                minimizeBtn.textContent = '□'; // Square or maximize icon
                minimizeBtn.title = "Maximize";
            }
        });
    }

    const predictBtn = document.getElementById('predictBtn');
    if (predictBtn) {
        predictBtn.addEventListener('click', handlePrediction);
    } else {
        console.error("Predict button NOT FOUND!");
    }

    const locationInput = document.getElementById('locationInput');
    if (locationInput) {
        locationInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                handlePrediction();
            }
        });
    }
});

/**
 * Handles the "Predict" button click.
 * Geocodes the user's location and initiates the pass prediction process.
 */
async function handlePrediction() {
    const locationInput = document.getElementById('locationInput').value;
    const maxOffNadirInput = document.getElementById('maxOffNadir');
    const maxOffNadir = maxOffNadirInput ? parseInt(maxOffNadirInput.value, 10) : 30;

    if (!locationInput) return;

    // Secret Code Trigger
    if (locationInput.trim().toUpperCase() === "JOSHUA") {
        toggleWarGamesMode();
        document.getElementById('locationInput').value = ""; // Clear input
        return;
    }

    showLoading(true);
    clearResults();

    try {
        const coords = await geocodeAddress(locationInput);
        if (!coords) {
            // Alert is handled in geocodeAddress or specific error there
            showLoading(false);
            return;
        }

        // Store coords for weather fetching
        window.lastObserverCoords = coords;

        // Fetch Timezone
        window.lastObserverTimeZone = await fetchTimeZone(coords.lat(), coords.lng());
        console.log("Target Timezone:", window.lastObserverTimeZone);

        // Add a marker for the observer
        if (window.observerMarker) {
            window.observerMarker.setMap(null);
        }
        window.observerMarker = new google.maps.Marker({
            map: map,
            position: coords,
            title: "Observer",
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 5,
                fillColor: "#007bff",
                fillOpacity: 1,
                strokeWeight: 1,
                strokeColor: "white"
            }
        });
        map.panTo(coords);

        const passes = [];
        // We want a total of 5 passes combined across all satellites.
        // Since we have 2 satellites, we can't just ask for 5 from each.
        // We should search day by day until we have 5 total.

        // Actually, simpler approach:
        // Ask for 5 passes from EACH satellite over a long period (e.g. 14 days),
        // then combine and take the top 5 soonest.

        const promises = satellites.map(async sat => {
            if (sat.satrec) {
                return predictPasses(sat, coords, maxOffNadir, 5, 365); // Limit 5, Max 365 days
            }
            return [];
        });

        const results = await Promise.all(promises);
        results.forEach(p => passes.push(...p));

        // Sort by time
        passes.sort((a, b) => a.startTime - b.startTime);

        // Take top 5
        const topPasses = passes.slice(0, 5);

        displayResults(topPasses);

    } catch (error) {
        console.error("Prediction error:", error);
        alert("An error occurred during prediction.");
    } finally {
        showLoading(false);
    }
}

function geocodeAddress(address) {
    return new Promise((resolve, reject) => {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ 'address': address }, (results, status) => {
            if (status === 'OK') {
                resolve(results[0].geometry.location);
            } else {
                console.error('Geocode failed: ' + status);
                if (status === 'REQUEST_DENIED') {
                    alert("Geocoding API error: Request Denied. Please check if the Geocoding API is enabled in Google Cloud Console.");
                } else if (status === 'ZERO_RESULTS') {
                    alert("Location not found. Please try a different query.");
                } else {
                    alert('Geocode failed: ' + status);
                }
                resolve(null);
            }
        });
    });
}

// --- WarGames Mode Logic ---

const WARGAMES_MAP_STYLE = [
    {
        "featureType": "all",
        "elementType": "geometry.stroke",
        "stylers": [{ "visibility": "off" }]
    },
    {
        "featureType": "all",
        "elementType": "geometry.fill",
        "stylers": [{ "color": "#000000" }]
    },
    {
        "featureType": "all",
        "elementType": "labels",
        "stylers": [{ "visibility": "off" }] // Hide ALL default labels
    },
    {
        "featureType": "administrative.country",
        "elementType": "geometry.stroke",
        "stylers": [{ "visibility": "on" }, { "color": "#00ffff" }, { "weight": 2 }]
    },
    {
        "featureType": "administrative.province",
        "elementType": "geometry.stroke",
        "stylers": [{ "visibility": "on" }, { "color": "#00ffff" }, { "weight": 1 }]
    },
    {
        "featureType": "landscape",
        "elementType": "geometry.fill",
        "stylers": [{ "color": "#000a0a" }] // Very dark cyan to distinguish land from water
    },
    {
        "featureType": "water",
        "elementType": "geometry.fill",
        "stylers": [{ "color": "#000000" }]
    },
    {
        "featureType": "poi",
        "stylers": [{ "visibility": "off" }]
    },
    {
        "featureType": "road",
        "stylers": [{ "visibility": "off" }]
    },
    {
        "featureType": "transit",
        "stylers": [{ "visibility": "off" }]
    }
];

const COASTLINE_GEOJSON_URL = 'https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/physical/ne_110m_coastline.json';
const CITIES_GEOJSON_URL = 'https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/cultural/ne_110m_populated_places.json';

const STRATEGIC_TARGETS = [
    // --- BLUE TEAM: UNITED STATES (CONUS) ---
    { "name": "NORAD (Cheyenne Mtn)", "lat": 38.744, "lng": -104.845, "team": "usa", "type": "command" },
    { "name": "USSTRATCOM (Offutt)", "lat": 41.118, "lng": -95.912, "team": "usa", "type": "command" },
    { "name": "Raven Rock (Site R)", "lat": 39.734, "lng": -77.418, "team": "usa", "type": "command" },
    { "name": "Malmstrom AFB (ICBM)", "lat": 47.505, "lng": -111.183, "team": "usa", "type": "icbm" },
    { "name": "Minot AFB (ICBM/Bomber)", "lat": 48.415, "lng": -101.358, "team": "usa", "type": "icbm" },
    { "name": "F.E. Warren AFB (ICBM)", "lat": 41.145, "lng": -104.870, "team": "usa", "type": "icbm" },
    { "name": "Whiteman AFB (Stealth)", "lat": 38.730, "lng": -93.547, "team": "usa", "type": "air" },
    { "name": "Naval Base Kitsap", "lat": 47.721, "lng": -122.710, "team": "usa", "type": "sub" },
    { "name": "Kings Bay Naval Base", "lat": 30.790, "lng": -81.520, "team": "usa", "type": "sub" },
    { "name": "Naval Station Norfolk", "lat": 36.945, "lng": -76.302, "team": "usa", "type": "sub" },
    { "name": "Naval Base San Diego", "lat": 32.684, "lng": -117.127, "team": "usa", "type": "sub" },
    { "name": "Vandenberg SFB (Space)", "lat": 34.742, "lng": -120.572, "team": "usa", "type": "icbm" },
    { "name": "Fort Greely (Defense)", "lat": 63.962, "lng": -145.727, "team": "usa", "type": "icbm" },

    // --- BLUE TEAM: PACIFIC (Hawaii, Japan, Korea) ---
    { "name": "Pearl Harbor (Pacific HQ)", "lat": 21.344, "lng": -157.949, "team": "usa", "type": "sub" },
    { "name": "Andersen AFB (Guam)", "lat": 13.584, "lng": 144.924, "team": "usa", "type": "air" },
    { "name": "Yokosuka Naval Base", "lat": 35.293, "lng": 139.662, "team": "jpn", "type": "sub" },
    { "name": "Sasebo Naval Base", "lat": 33.165, "lng": 129.715, "team": "jpn", "type": "sub" },
    { "name": "Kadena Air Base", "lat": 26.355, "lng": 127.767, "team": "jpn", "type": "air" },
    { "name": "Misawa Air Base", "lat": 40.702, "lng": 141.367, "team": "jpn", "type": "intel" },
    { "name": "Osan Air Base", "lat": 37.090, "lng": 127.033, "team": "kor", "type": "air" },
    { "name": "Kunsan Air Base", "lat": 35.904, "lng": 126.613, "team": "kor", "type": "air" },
    { "name": "Camp Humphreys (HQ)", "lat": 36.967, "lng": 127.023, "team": "kor", "type": "command" },

    // --- BLUE TEAM: NATO & EUROPE ---
    { "name": "Northwood HQ", "lat": 51.629, "lng": -0.417, "team": "nato", "type": "command" },
    { "name": "NATO HQ (Brussels)", "lat": 50.879, "lng": 4.426, "team": "nato", "type": "command" },
    { "name": "HMNB Clyde (Faslane)", "lat": 56.069, "lng": -4.814, "team": "nato", "type": "sub" },
    { "name": "Île Longue (French SSBN)", "lat": 48.306, "lng": -4.506, "team": "nato", "type": "sub" },
    { "name": "Ramstein Air Base", "lat": 49.437, "lng": 7.600, "team": "nato", "type": "air" },
    { "name": "Incirlik Air Base", "lat": 37.001, "lng": 35.425, "team": "nato", "type": "air" },
    { "name": "RAF Fylingdales (BMEWS)", "lat": 54.362, "lng": -0.666, "team": "nato", "type": "radar" },
    { "name": "RAF Menwith Hill (Intel)", "lat": 54.009, "lng": -1.689, "team": "nato", "type": "intel" },
    { "name": "Thule Air Base (BMEWS)", "lat": 76.531, "lng": -68.703, "team": "nato", "type": "radar" },

    // --- BLUE TEAM: GLOBAL ---
    { "name": "Pine Gap (Intel)", "lat": -23.799, "lng": 133.737, "team": "nato", "type": "intel" },
    { "name": "Diego Garcia", "lat": -7.313, "lng": 72.411, "team": "nato", "type": "air" },

    // --- RED TEAM: RUSSIA ---
    { "name": "Nat. Defense Control Center", "lat": 55.650, "lng": 37.590, "team": "rus", "type": "command" }, // Adjusted Lat
    { "name": "Kosvinsky Kamen (Bunker)", "lat": 59.516, "lng": 59.061, "team": "rus", "type": "command" },
    { "name": "Mount Yamantau (Bunker)", "lat": 54.255, "lng": 58.102, "team": "rus", "type": "command" },
    { "name": "Dombarovsky (ICBM)", "lat": 51.096, "lng": 59.837, "team": "rus", "type": "icbm" },
    { "name": "Kozelsk (ICBM)", "lat": 53.797, "lng": 35.801, "team": "rus", "type": "icbm" },
    { "name": "Tatishchevo (ICBM)", "lat": 51.666, "lng": 45.583, "team": "rus", "type": "icbm" },
    { "name": "Plesetsk Cosmodrome", "lat": 62.927, "lng": 40.574, "team": "rus", "type": "icbm" },
    { "name": "Engels-2 (Bombers)", "lat": 51.483, "lng": 46.211, "team": "rus", "type": "air" },
    { "name": "Severomorsk (North Fleet)", "lat": 69.073, "lng": 33.430, "team": "rus", "type": "sub" },
    { "name": "Gadzhiyevo (Sub Base)", "lat": 69.257, "lng": 33.321, "team": "rus", "type": "sub" },
    { "name": "Vilyuchinsk (Pacific Sub)", "lat": 52.926, "lng": 158.423, "team": "rus", "type": "sub" },

    // --- RED TEAM: CHINA ---
    { "name": "Central Theater Command", "lat": 39.907, "lng": 116.321, "team": "chn", "type": "command" },
    { "name": "Xiangshan (Bunker)", "lat": 39.954, "lng": 116.175, "team": "chn", "type": "command" },
    { "name": "Lop Nur (Test Site)", "lat": 40.818, "lng": 88.667, "team": "chn", "type": "icbm" },
    { "name": "Korla (Missile Base)", "lat": 41.727, "lng": 86.175, "team": "chn", "type": "icbm" },
    { "name": "Yulin Naval Base", "lat": 18.207, "lng": 109.689, "team": "chn", "type": "sub" },
    { "name": "Golmud Base", "lat": 36.400, "lng": 94.786, "team": "chn", "type": "icbm" },

    // --- RED TEAM: NORTH KOREA ---
    { "name": "Punggye-ri (Nuclear Test)", "lat": 41.280, "lng": 129.088, "team": "dprk", "type": "icbm" },
    { "name": "Sohae (Launch Facility)", "lat": 39.660, "lng": 124.705, "team": "dprk", "type": "icbm" },
    { "name": "Yongbyon (Reactor)", "lat": 39.799, "lng": 125.755, "team": "dprk", "type": "icbm" }
];

// Custom SVG Paths
const ICONS = {
    SQUARE: 'M -1,-1 1,-1 1,1 -1,1 z',
    DIAMOND: 'M 0,-1.3 1.3,0 0,1.3 -1.3,0 z',
    TRIANGLE: 'M 0,-1.5 1.3,1 -1.3,1 z'
};

let isWarGamesMode = false;
let citiesDataLayer = null;
let targetsDataLayer = null;

function toggleWarGamesMode() {
    isWarGamesMode = !isWarGamesMode;
    const body = document.body;

    if (isWarGamesMode) {
        body.classList.add('wopr-mode');
        map.setOptions({
            mapTypeId: 'roadmap',
            styles: WARGAMES_MAP_STYLE,
            backgroundColor: '#000000'
        });

        // Load Coastlines
        map.data.loadGeoJson(COASTLINE_GEOJSON_URL);
        map.data.setStyle({
            strokeColor: '#00ffff',
            strokeWeight: 1,
            fillOpacity: 0,
            clickable: false
        });

        // Load Cities (Custom Layer - 110m for performance)
        if (!citiesDataLayer) {
            citiesDataLayer = new google.maps.Data({ map: map });
            citiesDataLayer.loadGeoJson(CITIES_GEOJSON_URL);
        } else {
            citiesDataLayer.setMap(map);
        }

        // Style Cities
        const updateCityStyle = () => {
            const zoom = map.getZoom();
            citiesDataLayer.setStyle(function (feature) {
                // Show cities when zoomed in
                const isVisible = zoom > 3;

                return {
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 2,
                        fillColor: '#00ffff',
                        fillOpacity: 1,
                        strokeWeight: 0
                    },
                    label: {
                        text: feature.getProperty('NAME'), // Uppercase NAME for 110m
                        color: '#00ffff',
                        fontFamily: 'VT323',
                        fontSize: '14px',
                        className: 'wopr-label'
                    },
                    visible: isVisible,
                    clickable: false,
                    zIndex: 300 // Ensure cities are on top of targets
                };
            });
        };

        // Initial Style
        updateCityStyle();

        // Load Strategic Targets
        if (!targetsDataLayer) {
            targetsDataLayer = new google.maps.Data({ map: map });

            const features = STRATEGIC_TARGETS.map(target => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [target.lng, target.lat]
                },
                properties: target
            }));

            targetsDataLayer.addGeoJson({
                type: "FeatureCollection",
                features: features
            });
        } else {
            targetsDataLayer.setMap(map);
        }

        // Style Strategic Targets
        const updateTargetStyle = () => {
            const zoom = map.getZoom();

            targetsDataLayer.setStyle(function (feature) {
                const type = feature.getProperty('type');
                const team = feature.getProperty('team');
                const name = feature.getProperty('name');

                let iconPath = google.maps.SymbolPath.CIRCLE; // Default (ICBM/Radar)
                if (type === 'command' || type === 'intel') iconPath = ICONS.SQUARE;
                else if (type === 'sub') iconPath = ICONS.DIAMOND;
                else if (type === 'bomber' || type === 'air') iconPath = ICONS.TRIANGLE;

                // Color Logic
                let color = '#0088FF'; // Blue (Blue Team)
                if (['rus', 'chn', 'dprk'].includes(team)) {
                    color = '#FF0000'; // Red (Red Team)
                }

                // Show labels only when zoomed in
                const showLabel = zoom > 5;

                return {
                    icon: {
                        path: iconPath,
                        scale: 4,
                        fillColor: '#000000', // Black fill for wireframe look
                        fillOpacity: 1,
                        strokeColor: color,
                        strokeWeight: 2,
                        labelOrigin: new google.maps.Point(0, 4) // Position label below icon
                    },
                    label: showLabel ? {
                        text: name,
                        color: color,
                        fontFamily: 'VT323',
                        fontSize: '14px',
                        className: 'wopr-label',
                        fontWeight: 'bold'
                    } : null,
                    visible: true,
                    clickable: false,
                    zIndex: 200 // Below cities
                };
            });
        };

        updateTargetStyle();

        // Add Zoom Listener for Cities & Targets
        map.addListener('zoom_changed', function () {
            if (isWarGamesMode) {
                if (citiesDataLayer) updateCityStyle();
                if (targetsDataLayer) updateTargetStyle();
            }
        });

        // Update Night Layer for WOPR Mode
        if (nightLayer) {
            nightLayer.setOptions({
                strokeColor: '#FF9900', // Truer Orange terminator
                strokeWeight: 2,
                fillColor: '#002244', // Deeper/More visible blue
                fillOpacity: 0.6
            });
        }

        // Update Branding
        const branding = document.getElementById('branding');
        if (branding) branding.innerText = 'SATELLITE TRACKER';

        // Start Zulu Clock
        startZuluClock();

        console.log("GREETINGS PROFESSOR FALKEN.");
    } else {
        body.classList.remove('wopr-mode');
        map.setOptions({
            mapTypeId: 'hybrid',
            styles: null
        });

        // Unload Coastlines (Clear Data Layer)
        map.data.forEach(function (feature) {
            map.data.remove(feature);
        });

        // Hide Cities
        if (citiesDataLayer) {
            citiesDataLayer.setMap(null);
        }

        // Hide Targets
        if (targetsDataLayer) {
            targetsDataLayer.setMap(null);
        }

        // Reset Night Layer
        if (nightLayer) {
            nightLayer.setOptions({
                strokeWeight: 0,
                fillColor: '#000000',
                fillOpacity: 0.7
            });
        }

        // Reset Branding
        const branding = document.getElementById('branding');
        if (branding) branding.innerText = 'AIRBUS PLEIADES NEO';

        // Stop Zulu Clock
        stopZuluClock();
    }
}

let zuluInterval;

function startZuluClock() {
    updateZuluClock(); // Run immediately
    zuluInterval = setInterval(updateZuluClock, 1000);
}

function stopZuluClock() {
    clearInterval(zuluInterval);
}

function updateZuluClock() {
    const now = new Date();
    const hours = now.getUTCHours().toString().padStart(2, '0');
    const minutes = now.getUTCMinutes().toString().padStart(2, '0');
    const seconds = now.getUTCSeconds().toString().padStart(2, '0');

    const clockElement = document.getElementById('zulu-clock');
    if (clockElement) {
        clockElement.innerText = `${hours}:${minutes}:${seconds} ZULU`;
    }
}

/**
 * Core Pass Prediction Algorithm.
 * 
 * Finds future passes where the satellite is visible, illuminated by the sun,
 * and within the specified off-nadir angle.
 * 
 * Strategy:
 * 1. Coarse Scan: Step through time in 1-minute intervals to find "windows" of visibility.
 * 2. Fine Search: Once a window is found, search within it (5-second steps) to find the moment of closest approach (min off-nadir).
 * 
 * @param {Object} sat - Satellite object
 * @param {Object} observerCoords - Google Maps LatLng object for observer
 * @param {number} maxOffNadir - Maximum allowed off-nadir angle
 * @param {number} limit - Max number of passes to return
 * @param {number} maxDays - How many days into the future to search
 * @returns {Array} List of pass objects
 */
function predictPasses(sat, observerCoords, maxOffNadir = 30, limit = 5, maxDays = 365) {
    const passes = [];
    const stepSeconds = 60; // Coarse step
    const maxTime = maxDays * 24 * 60 * 60 * 1000;
    const now = new Date();
    const startTime = now.getTime();

    let inPass = false;
    let passStartTime = 0;

    // Coarse Scan
    for (let t = 0; t < maxTime; t += stepSeconds * 1000) {
        // Optimization: If we have enough passes, stop.
        if (passes.length >= limit) break;

        const time = new Date(startTime + t);
        const positionAndVelocity = satellite.propagate(sat.satrec, time);
        if (!positionAndVelocity.position) continue;

        const gmst = satellite.gstime(time);
        const observerGd = {
            longitude: observerCoords.lng() * (Math.PI / 180),
            latitude: observerCoords.lat() * (Math.PI / 180),
            height: 0
        };
        const positionEcf = satellite.eciToEcf(positionAndVelocity.position, gmst);
        const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);

        if (lookAngles.elevation > 0) {
            if (!inPass) {
                inPass = true;
                passStartTime = t;
            }
        } else {
            if (inPass) {
                // Pass ended, process it
                const passEndTime = t;
                const bestPass = findBestPassDetails(sat, observerCoords, startTime + passStartTime, startTime + passEndTime, maxOffNadir);
                if (bestPass) passes.push(bestPass);
                inPass = false;
            }
        }
    }

    // Check if we ended inside a pass
    if (inPass) {
        const bestPass = findBestPassDetails(sat, observerCoords, startTime + passStartTime, startTime + maxTime, maxOffNadir);
        if (bestPass) passes.push(bestPass);
    }

    return passes;
}

function findBestPassDetails(sat, observerCoords, startMs, endMs, maxOffNadir) {
    let bestDetails = null;
    const fineStepMs = 5000; // 5 seconds fine step

    for (let t = startMs; t <= endMs; t += fineStepMs) {
        const time = new Date(t);
        const positionAndVelocity = satellite.propagate(sat.satrec, time);
        if (!positionAndVelocity.position) continue;

        const gmst = satellite.gstime(time);
        const observerGd = {
            longitude: observerCoords.lng() * (Math.PI / 180),
            latitude: observerCoords.lat() * (Math.PI / 180),
            height: 0
        };

        const observerEcf = satellite.geodeticToEcf(observerGd);
        const positionEcf = satellite.eciToEcf(positionAndVelocity.position, gmst);
        const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);

        // Calculate Off-Nadir
        const S = { x: positionEcf.x, y: positionEcf.y, z: positionEcf.z };
        const O = { x: observerEcf.x, y: observerEcf.y, z: observerEcf.z };
        const V = { x: O.x - S.x, y: O.y - S.y, z: O.z - S.z };
        const N = { x: -S.x, y: -S.y, z: -S.z };
        const dot = V.x * N.x + V.y * N.y + V.z * N.z;
        const magV = Math.sqrt(V.x * V.x + V.y * V.y + V.z * V.z);
        const magN = Math.sqrt(N.x * N.x + N.y * N.y + N.z * N.z);
        const offNadirDeg = Math.acos(dot / (magV * magN)) * (180 / Math.PI);

        // Sun Elevation
        const sunPos = getSunPosition(time);
        const obsLatRad = observerGd.latitude;
        const sunDecRad = sunPos.lat * (Math.PI / 180);
        const sunLngRad = sunPos.lng * (Math.PI / 180);
        const obsLngRad = observerGd.longitude;
        const cosZenith = Math.sin(obsLatRad) * Math.sin(sunDecRad) +
            Math.cos(obsLatRad) * Math.cos(sunDecRad) * Math.cos(obsLngRad - sunLngRad);
        const sunElevationDeg = Math.asin(cosZenith) * (180 / Math.PI);

        if (lookAngles.elevation > 0) {
            if (!bestDetails || offNadirDeg < bestDetails.minOffNadir) {
                bestDetails = {
                    satName: sat.name,
                    startTime: time, // Time of best approach
                    maxElevation: lookAngles.elevation * (180 / Math.PI),
                    minOffNadir: offNadirDeg,
                    sunElevationAtMax: sunElevationDeg
                };
            }
        }
    }

    // Filter
    if (bestDetails) {
        const isDaylight = bestDetails.sunElevationAtMax > 0;
        if (isDaylight && bestDetails.minOffNadir <= maxOffNadir) return bestDetails;
    }
    return null;
}

/**
 * Fetches cloud cover forecast from Open-Meteo API.
 * 
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Date} date - Date/Time of the pass
 * @returns {number|null} Cloud cover percentage (0-100) or null if unavailable
 */
async function fetchWeather(lat, lng, date) {
    // OpenMeteo goes out ~16 days.
    const now = new Date();
    const diffDays = (date - now) / (1000 * 60 * 60 * 24);

    if (diffDays > 14 || diffDays < 0) return null;

    try {
        const dateStr = date.toISOString().split('T')[0];
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=cloud_cover&start_date=${dateStr}&end_date=${dateStr}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!data.hourly) return null;

        // Find closest hour
        const targetTime = date.getTime();
        let closestIdx = 0;
        let minDiff = Infinity;

        data.hourly.time.forEach((t, i) => {
            const time = new Date(t + 'Z').getTime(); // OpenMeteo returns ISO strings, treat as UTC
            const diff = Math.abs(time - targetTime);
            if (diff < minDiff) {
                minDiff = diff;
                closestIdx = i;
            }
        });

        return data.hourly.cloud_cover[closestIdx];
    } catch (e) {
        console.error("Weather fetch failed:", e);
        return null;
    }
}

async function fetchTimeZone(lat, lng) {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&timezone=auto`;
        const response = await fetch(url);
        const data = await response.json();
        return data.timezone;
    } catch (e) {
        console.error("Timezone fetch failed:", e);
        return undefined; // Fallback to browser local
    }
}

async function displayResults(passes) {
    const tbody = document.querySelector('#resultsTable tbody');
    const noResults = document.getElementById('no-results');
    const reliabilityWarning = document.getElementById('reliability-warning');

    tbody.innerHTML = '';

    if (passes.length === 0) {
        noResults.style.display = 'block';
        if (reliabilityWarning) reliabilityWarning.style.display = 'none';
        return;
    }

    noResults.style.display = 'none';

    let hasLongTerm = false;
    const now = new Date();
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;

    // Process passes sequentially to fetch weather (could be parallelized but rate limits)
    for (const pass of passes) {
        const row = document.createElement('tr');

        // Check if > 14 days
        if (pass.startTime.getTime() - now.getTime() > fourteenDays) {
            hasLongTerm = true;
        }

        // Fetch Weather
        let cloudCover = await fetchWeather(window.lastObserverCoords.lat(), window.lastObserverCoords.lng(), pass.startTime);
        let cloudText = 'N/A';
        if (cloudCover !== null) {
            cloudText = `${cloudCover}%`;
        }

        // Date/Time
        const dateOptions = { timeZone: window.lastObserverTimeZone };
        const timeOptions = { hour: '2-digit', minute: '2-digit', timeZone: window.lastObserverTimeZone };

        const dateStr = pass.startTime.toLocaleDateString([], dateOptions);
        const timeStr = pass.startTime.toLocaleTimeString([], timeOptions);
        let timeZoneDisplay = 'Local';
        if (window.lastObserverTimeZone) {
            // Extract city: "America/Los_Angeles" -> "Los Angeles"
            const parts = window.lastObserverTimeZone.split('/');
            timeZoneDisplay = parts[parts.length - 1].replace(/_/g, ' ');
        }

        // Quality Class
        let qualityClass = 'quality-red';
        if (pass.minOffNadir <= 10) qualityClass = 'quality-green';
        else if (pass.minOffNadir <= 20) qualityClass = 'quality-yellow';

        // Sun Warning
        let sunWarning = '';
        if (pass.sunElevationAtMax < 30) {
            sunWarning = '<span class="warning-icon" title="Poor Sun Angle (< 30°)" onclick="alert(\'Shadows will be too long\')">⚠️</span>';
        }

        row.innerHTML = `
            <td>${dateStr}</td>
            <td>${timeStr}<br><span style="font-size: 10px; color: #aaa;">${timeZoneDisplay}</span></td>
            <td>${pass.satName}</td>
            <td class="${qualityClass}">${pass.minOffNadir.toFixed(1)}°</td>
            <td>${pass.sunElevationAtMax.toFixed(0)}° ${sunWarning}</td>
            <td>${cloudText}</td>
        `;

        tbody.appendChild(row);
    }

    if (reliabilityWarning) {
        reliabilityWarning.style.display = hasLongTerm ? 'block' : 'none';
    }
}

function showLoading(isLoading) {
    document.getElementById('loading-spinner').style.display = isLoading ? 'block' : 'none';
}

function clearResults() {
    document.querySelector('#resultsTable tbody').innerHTML = '';
    document.getElementById('no-results').style.display = 'none';
}
