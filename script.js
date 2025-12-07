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
    attributionDiv.id = 'nasa-attribution';
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
    const inputUpper = locationInput.trim().toUpperCase();
    if (inputUpper === "JOSHUA" || inputUpper === "WOPR" || inputUpper === "WOPR1") {
        let scenario = null;
        if (inputUpper === "WOPR" || inputUpper === "WOPR1") scenario = 1;

        toggleWarGamesMode(scenario);
        document.getElementById('locationInput').value = ""; // Clear input
        return;
    }

    // WOPR Mode Trigger (WOPR, WOPR1, WOPR2, etc.)
    if (inputUpper.startsWith("WOPR")) {
        // Extract scenario ID if present
        let scenarioId = null;
        if (inputUpper.length > 4) {
            const idPart = inputUpper.substring(4);
            if (!isNaN(parseInt(idPart))) {
                scenarioId = parseInt(idPart);
            }
        }

        initWoprMode(scenarioId);
        document.getElementById('locationInput').value = "";
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

/**
 * WOPR Mode Initialization
 * 
 * Simulates a Global Thermonuclear War scenario.
 * - Reuses WarGames styling (Crt overlay, map style)
 * - Hides all satellite tracking UI and data
 * - Starts a specific or random scenario
 */


function toggleWarGamesMode(scenarioIdOverride) {
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

        // Force specific city style for WOPR
        citiesDataLayer.setStyle(function (feature) {
            return {
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 2,
                    fillColor: '#00ffff',
                    fillOpacity: 1,
                    strokeWeight: 0
                },
                visible: true, // Always show in WOPR? Or depend on zoom? Let's stick to zoom for perf
                clickable: false,
                zIndex: 300
            };
        });

        // Load Targets
        if (!targetsDataLayer) {
            targetsDataLayer = new google.maps.Data({ map: map });
            const features = STRATEGIC_TARGETS.map(target => ({
                type: "Feature",
                geometry: { type: "Point", coordinates: [target.lng, target.lat] },
                properties: target
            }));
            targetsDataLayer.addGeoJson({ type: "FeatureCollection", features: features });
        } else {
            targetsDataLayer.setMap(map);
        }

        // Target Style
        targetsDataLayer.setStyle(function (feature) {
            const type = feature.getProperty('type');
            const team = feature.getProperty('team');
            let iconPath = google.maps.SymbolPath.CIRCLE;
            if (type === 'command' || type === 'intel') iconPath = ICONS.SQUARE;
            else if (type === 'sub') iconPath = ICONS.DIAMOND;
            else if (type === 'bomber' || type === 'air') iconPath = ICONS.TRIANGLE;

            let color = '#0088FF';
            if (['rus', 'chn', 'dprk'].includes(team)) color = '#FF0000';

            return {
                icon: {
                    path: iconPath,
                    scale: 4,
                    fillColor: '#000000',
                    fillOpacity: 1,
                    strokeColor: color,
                    strokeWeight: 2,
                    labelOrigin: new google.maps.Point(0, 4)
                },
                visible: true,
                clickable: false,
                zIndex: 200
            };
        });

        // 3. UI Cleanup (Hide Satellite Stuff)
        const uiToHide = [
            'prediction-panel',
            'controls',        // The bottom-left toggle controls
            'legends-container'
        ];

        uiToHide.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // Update Branding
        const branding = document.getElementById('branding');
        if (branding) {
            branding.style.display = 'block';
            branding.innerHTML = '<b>W</b>ar <b>O</b>peration <b>P</b>lan <b>R</b>esponse';
        }

        // Hide Real Satellites
        satellites.forEach(sat => {
            if (sat.marker) sat.marker.setMap(null);
            if (sat.pastPath) sat.pastPath.setMap(null);
            if (sat.futurePath) sat.futurePath.setMap(null);
            sat.cones.forEach(cone => cone.setMap(null));
        });

        // Hide Layers
        if (snowCoverLayer && map.overlayMapTypes) {
            map.overlayMapTypes.forEach((layer, index) => {
                if (layer === snowCoverLayer || layer === cloudCoverLayer) {
                    map.overlayMapTypes.removeAt(index);
                }
            });
        }
        if (solarAngleLayer) solarAngleLayer.setMap(null);
        if (window.marginalSolarLayer) window.marginalSolarLayer.setMap(null);

        // Ensure Night Layer covers WOPR needs (maybe adjustable later)
        if (nightLayer) {
            // User requested NO terminator in WOPR mode
            nightLayer.setMap(null);
        }

        // 4. Start Scenario
        // If no ID provided, pick random
        const totalScenarios = 3; // Placeholder count
        let scenarioId = scenarioIdOverride;
        if (!scenarioId) {
            scenarioId = Math.floor(Math.random() * totalScenarios) + 1;
        }

        // Start Zulu Clock
        startZuluClock();

        // Init Scenario Manager
        if (!window.scenarioManager) {
            window.scenarioManager = new ScenarioManager(map);
        }
        window.scenarioManager.start(scenarioId);
    }
}

// --- WOPR Scenario Engine ---

class ScenarioManager {
    constructor(map) {
        this.map = map;
        this.activeMissiles = [];
        this.activeDetonations = [];
        this.timeouts = [];
        this.isRunning = false;
        this.userLocation = null;
    }

    async start(id) {
        this.stop(); // Clear any existing
        this.isRunning = true;
        console.log(`Starting Scenario ${id}`);
        updateDefcon(1); // Reset

        // Get user location for the finale
        if (window.lastObserverCoords) {
            this.userLocation = { lat: window.lastObserverCoords.lat(), lng: window.lastObserverCoords.lng() };
        } else {
            this.userLocation = await this.fetchUserLocation();
        }

        if (id === 1) this.runScenario1();
        else if (id === 2) console.log("Scenario 2 not implemented");
        else if (id === 3) console.log("Scenario 3 not implemented");
    }

    stop() {
        this.isRunning = false;
        this.timeouts.forEach(t => clearTimeout(t));
        this.timeouts = [];
        this.activeMissiles.forEach(m => m.remove());
        this.activeMissiles = [];
        this.activeDetonations.forEach(d => d.remove());
        this.activeDetonations = [];

        // Clear Game Over
        const go = document.getElementById('game-over-overlay');
        if (go) go.style.display = 'none';
        document.body.classList.remove('shutter-effect');
    }

    schedule(ms, callback) {
        const t = setTimeout(() => {
            if (this.isRunning) callback();
        }, ms);
        this.timeouts.push(t);
    }

    updateDefcon(level) {
        const display = document.getElementById('defcon-display');
        if (display) {
            display.innerText = `DEFCON ${level}`;
            if (level === 1) { // 1 is CRITICAL
                display.classList.add('defcon-1');
            } else {
                display.classList.remove('defcon-1');
            }
        }
    }

    async fetchUserLocation() {
        try {
            const resp = await fetch('https://ipapi.co/json/');
            const data = await resp.json();
            return { lat: data.latitude, lng: data.longitude };
        } catch (e) {
            console.warn("IP Geo failed, defaulting to NYC", e);
            return { lat: 40.7128, lng: -74.0060 }; // Default NYC
        }
    }

    // New: GBI Intercept Logic
    attemptIntercept(incomingMissile, defender) {
        // Check Limits
        if (!this.gbiCounts) this.gbiCounts = { 'US': 10, 'RU': 10, 'EU': 5, 'JP': 5 };
        if (this.gbiCounts[defender] <= 0) return; // Out of ammo

        // Decrement
        this.gbiCounts[defender]--;

        // 35% chance of success
        const isSuccess = Math.random() < 0.35;

        // Intercept at 70-85% of flight path (Slows down GBI by giving it more time)
        const interceptRatio = 0.7 + (Math.random() * 0.15);

        // Calculate coordinate
        const interceptPos = google.maps.geometry.spherical.interpolate(
            new google.maps.LatLng(incomingMissile.origin),
            new google.maps.LatLng(incomingMissile.target),
            interceptRatio
        );

        // Timing
        // Simulate detection gap: 15 mins to detect/setup, 15 mins to fly (~50%)
        const flightTimeTotal = incomingMissile.duration;
        const detectionTime = flightTimeTotal * 0.5;

        setTimeout(() => {
            if (!this.isRunning || incomingMissile.destroyed) return;

            const timeToIntercept = flightTimeTotal * interceptRatio;
            const remainingTime = timeToIntercept - detectionTime;

            // Travel time for interceptor
            const interceptorDuration = remainingTime; // It has to get there exactly when the nuke does

            if (interceptorDuration < 2000) return; // Too late / too fast

            // Pick Launch Site
            let sites = [];
            if (defender === 'US') {
                sites = [{ lat: 63.9, lng: -145.7 }, { lat: 34.7, lng: -120.6 }, { lat: 43.9, lng: -75.6 }]; // Ft Greely, Vandenberg, Ft Drum
            } else if (defender === 'RU') {
                sites = [{ lat: 55.7, lng: 37.6 }, { lat: 46.0, lng: 73.0 }, { lat: 53.0, lng: 158.0 }]; // Moscow, Sary Shagan, Kamchatka
            } else if (defender === 'EU') {
                sites = [{ lat: 54.3, lng: -0.6 }, { lat: 44.0, lng: 24.3 }]; // Fylingdales (UK), Deveselu (RO)
            } else if (defender === 'JP') {
                sites = [{ lat: 40.9, lng: 140.3 }, { lat: 35.7, lng: 135.2 }]; // Shariki, Kyogamisaki
            }

            // Find nearest
            let bestSite = sites[0];
            // Simple logic: pick random or nearest. Nearest is better visual.
            let minDist = Infinity;
            const iPosLat = interceptPos.lat();
            const iPosLng = interceptPos.lng();

            sites.forEach(site => {
                const d = Math.abs(site.lat - iPosLat) + Math.abs(site.lng - iPosLng); // Rough dist
                if (d < minDist) {
                    minDist = d;
                    bestSite = site;
                }
            });

            // Launch Interceptor (White)
            const interceptor = this.launchMissile(bestSite, interceptPos, '#FFFFFF', interceptorDuration, false);

            // Schedule Result
            setTimeout(() => {
                if (!this.isRunning) return;

                // Interceptor Explodes (White flash)
                interceptor.destroy();
                this.detonate(interceptPos, 150000, '#FFFFFF');

                if (isSuccess) {
                    incomingMissile.destroy();
                }
            }, interceptorDuration);

        }, detectionTime);
    }

    // Magical User Defense (100% Accuracy)
    attemptUserIntercept(incomingMissile) {
        if (!this.userLocation) return;

        // Check if heading for user (approx < 100 miles / 160km)
        const d = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(incomingMissile.target),
            new google.maps.LatLng(this.userLocation)
        );

        if (d > 160000) return; // Not a threat to user (outside 100mi)

        // Launch from User
        const interceptPos = incomingMissile.target;
        const interceptRatio = 0.8;
        const iPos = google.maps.geometry.spherical.interpolate(
            new google.maps.LatLng(incomingMissile.origin),
            new google.maps.LatLng(incomingMissile.target),
            interceptRatio
        );

        const flightTime = incomingMissile.duration * interceptRatio;
        const reactionDelay = 500; // Fast reaction
        const interceptorDur = flightTime - reactionDelay;

        if (interceptorDur < 500) return; // Too close

        setTimeout(() => {
            if (incomingMissile.destroyed) return;
            // Magical Interceptor (Now White)
            const m = this.launchMissile(this.userLocation, iPos, '#FFFFFF', interceptorDur, false);

            setTimeout(() => {
                m.destroy();
                this.detonate(iPos, 100000, '#FFFFFF'); // White flash
                incomingMissile.destroy();
            }, interceptorDur);
        }, reactionDelay);
    }

    launchMissile(origin, target, color, speedMs, detonateOnImpact = true) {
        const missile = new Missile(this.map, origin, target, color, speedMs);
        this.activeMissiles.push(missile);
        missile.onImpact = () => {
            if (detonateOnImpact && !missile.destroyed) {
                // Red blooms, slightly smaller
                this.detonate(target, 350000, '#FF0000');
            }
        };
        missile.launch();
        return missile;
    }

    detonate(coords, size = 350000, color = '#FF0000') {
        // Force Red for nuke hits
        let finalColor = color;
        const isNuke = ['#FF0000', '#0088FF', '#FF9900', '#00FF00', '#CC00FF'].includes(color);
        if (isNuke) {
            finalColor = '#FF0000';

            // Screen Flutter visual if close to user (< 500 miles / 800km)
            if (this.userLocation) {
                const d = google.maps.geometry.spherical.computeDistanceBetween(
                    new google.maps.LatLng(coords),
                    new google.maps.LatLng(this.userLocation)
                );
                if (d < 800000) {
                    document.body.classList.remove('screen-flutter');
                    void document.body.offsetWidth; // trigger reflow
                    document.body.classList.add('screen-flutter');
                }
            }
        }

        const detonation = new Detonation(this.map, coords, size, finalColor);
        this.activeDetonations.push(detonation);
        detonation.explode();
    }

    triggerGameOver() {
        console.log("GAME OVER SEQUENCE INITIATED");
        document.body.classList.remove('screen-flutter'); // Ensure flutter doesn't block shutter
        void document.body.offsetWidth; // Force reflow
        document.body.classList.add('shutter-effect');
        setTimeout(() => {
            const overlay = document.getElementById('game-over-overlay');
            if (overlay) overlay.style.display = 'flex';
        }, 2500); // 2.5s delay (User requested "couple seconds")
    }

    // --- SCENARIO 1: HOUSE OF DYNAMITE (GLOBAL WAR) ---
    runScenario1() {
        // Reset GBIs (Increased counts)
        this.gbiCounts = { 'US': 15, 'RU': 15, 'EU': 7, 'JP': 5 };

        // --- COORDINATES (DETAILED) ---
        const ARCTIC = { lat: 80, lng: -90 };
        const CHICAGO = { lat: 41.8781, lng: -87.6298 };
        const FT_GREELY = { lat: 63.9, lng: -145.7 };

        // LAUNCH SITES
        const SILO_BELT = [{ lat: 47.5, lng: -111.0 }, { lat: 48.0, lng: -101.0 }, { lat: 41.0, lng: -104.0 }];
        // Updated User Coordinates
        const US_ATLANTIC_SUBS = [{ lat: 46.57, lng: -32.84 }];
        const US_PACIFIC_SUBS = [{ lat: 12.30, lng: 135.48 }, { lat: 29.48, lng: 139.65 }];

        const RU_LAUNCH = [{ lat: 45.9, lng: 63.3 }, { lat: 62.9, lng: 40.5 }, { lat: 54.0, lng: 35.8 }];
        const RU_SUBS = [{ lat: 70, lng: 40 }, { lat: 55, lng: 160 }];
        // Updated User Coordinates
        const RU_ATLANTIC_FLEET = [{ lat: 25.85, lng: -64.45 }, { lat: 36.91, lng: -49.86 }];
        const RU_PACIFIC_FLEET = [{ lat: 50.45, lng: -144.01 }, { lat: 19.93, lng: -129.00 }];

        const CN_LAUNCH = [{ lat: 30.5, lng: 104.0 }, { lat: 36.6, lng: 101.7 }];
        const EU_LAUNCH = [{ lat: 56.0, lng: -4.8 }, { lat: 48.3, lng: -4.5 }];

        // TARGET LISTS (Flattened for usage)

        // Phase 3: US First Strike Targets (Russian Mil/C2)
        const US_FIRST_STRIKE_TARGETS = [
            { lat: 54.02, lng: 35.46 }, { lat: 51.40, lng: 45.34 }, { lat: 55.20, lng: 89.48 }, // Silos
            { lat: 50.45, lng: 59.30 }, { lat: 53.02, lng: 60.36 }, { lat: 56.34, lng: 48.02 },
            { lat: 51.48, lng: 46.21 }, { lat: 51.10, lng: 128.26 }, { lat: 54.38, lng: 39.34 }, // Bombers
            { lat: 69.25, lng: 33.29 }, { lat: 52.92, lng: 158.42 }, { lat: 69.06, lng: 33.25 }, // Naval
            { lat: 55.75, lng: 37.62 }, { lat: 59.31, lng: 59.18 }, { lat: 56.10, lng: 37.59 }, // C2
            { lat: 39.80, lng: 125.75 }, { lat: 41.28, lng: 129.08 }, { lat: 39.66, lng: 124.70 } // NK
        ];

        // Phase 4: Russia Launch Targets (US/NATO Civil/Mil)
        const RUSSIA_LAUNCH_TARGETS = [
            // US Strategic
            { lat: 47.50, lng: -111.18 }, { lat: 48.41, lng: -101.35 }, { lat: 41.13, lng: -104.87 },
            { lat: 38.72, lng: -93.54 }, { lat: 32.50, lng: -93.66 }, { lat: 32.42, lng: -99.85 },
            { lat: 47.74, lng: -122.73 }, { lat: 30.79, lng: -81.53 }, { lat: 56.06, lng: -4.82 },
            { lat: 48.30, lng: -4.50 }, { lat: 48.20, lng: -121.92 },
            // US Hubs
            { lat: 40.71, lng: -74.00 }, { lat: 38.90, lng: -77.03 }, { lat: 41.87, lng: -87.62 },
            { lat: 34.05, lng: -118.24 }, { lat: 37.77, lng: -122.41 }, { lat: 29.76, lng: -95.36 },
            { lat: 47.60, lng: -122.33 },
            // NATO C2
            { lat: 50.88, lng: 4.43 }, { lat: 50.50, lng: 3.98 }, { lat: 51.62, lng: -0.41 },
            { lat: 49.44, lng: 7.60 }, { lat: 51.50, lng: -0.12 }, { lat: 48.85, lng: 2.35 }, { lat: 52.52, lng: 13.40 },
            // Infra
            { lat: 35.31, lng: -101.56 }, { lat: 35.99, lng: -84.26 }, { lat: 35.84, lng: -106.28 },
            // US Northeast
            { lat: 40.73, lng: -74.17 }, { lat: 40.71, lng: -74.04 }, { lat: 41.82, lng: -71.41 },
            { lat: 41.76, lng: -72.67 }, { lat: 42.88, lng: -78.87 }, { lat: 40.44, lng: -79.99 },
            { lat: 36.85, lng: -75.97 }, { lat: 35.77, lng: -78.63 }, { lat: 35.22, lng: -80.84 },
            // US Heartland
            { lat: 44.97, lng: -93.26 }, { lat: 38.62, lng: -90.19 }, { lat: 39.09, lng: -94.57 },
            { lat: 39.76, lng: -86.15 }, { lat: 39.96, lng: -82.99 }, { lat: 39.10, lng: -84.51 },
            { lat: 36.16, lng: -86.78 }, { lat: 35.14, lng: -90.04 }, { lat: 29.42, lng: -98.49 },
            { lat: 30.26, lng: -97.74 }, { lat: 28.53, lng: -81.37 }, { lat: 27.95, lng: -82.45 },
            // US West
            { lat: 36.16, lng: -115.13 }, { lat: 45.51, lng: -122.67 }, { lat: 38.58, lng: -121.49 },
            { lat: 40.76, lng: -111.89 }, { lat: 32.22, lng: -110.97 }, { lat: 35.08, lng: -106.60 },
            // Canada
            { lat: 45.42, lng: -75.69 }, { lat: 51.04, lng: -114.07 }, { lat: 53.54, lng: -113.49 },
            { lat: 49.28, lng: -123.12 }, { lat: 49.89, lng: -97.13 }, { lat: 46.81, lng: -71.20 }, { lat: 44.64, lng: -63.57 },
            // NATO Europe (Aggregated + New additions)
            { lat: 48.13, lng: 11.58 }, { lat: 53.55, lng: 9.99 }, { lat: 50.93, lng: 6.96 }, // DE
            { lat: 45.46, lng: 9.19 }, { lat: 40.85, lng: 14.26 }, // IT
            { lat: 45.76, lng: 4.83 }, { lat: 43.29, lng: 5.36 }, // FR
            { lat: 41.38, lng: 2.16 }, // ES
            { lat: 53.48, lng: -2.24 }, { lat: 52.48, lng: -1.89 }, { lat: 55.86, lng: -4.25 }, // UK
            { lat: 50.85, lng: 4.35 }, { lat: 51.92, lng: 4.47 }, // BE/NL
            { lat: 55.67, lng: 12.56 }, { lat: 59.91, lng: 10.75 }, { lat: 59.32, lng: 18.06 }, { lat: 60.16, lng: 24.93 }, // Scandi
            // New Eastern/Southern additions
            { lat: 40.41, lng: -3.70 }, // Madrid
            { lat: 37.98, lng: 23.72 }, // Athens
            { lat: 41.00, lng: 28.97 }, // Istanbul
            { lat: 44.42, lng: 26.10 }, // Bucharest
            { lat: 43.21, lng: 27.91 }, // Varna
            { lat: 46.48, lng: 30.72 }, // Odesa
            { lat: 50.45, lng: 30.52 },  // Kyiv
            // User requested additions
            { lat: 25.76, lng: -80.19 }, // Miami
            { lat: 52.22, lng: 21.01 }   // Warsaw
        ];

        // Phase 5: US/NATO Retaliation (Targets in Russia)
        const US_NATO_RETALIATION_TARGETS = [
            // Capitals
            { lat: 55.75, lng: 37.61 }, { lat: 55.99, lng: 37.21 }, { lat: 55.67, lng: 37.89 }, // Moscow
            { lat: 59.93, lng: 30.33 }, { lat: 59.86, lng: 30.23 }, // St Pete
            // Volga
            { lat: 56.32, lng: 44.00 }, { lat: 55.79, lng: 49.10 }, { lat: 53.24, lng: 50.22 },
            { lat: 48.70, lng: 44.51 }, { lat: 51.54, lng: 46.00 }, { lat: 53.50, lng: 49.41 }, { lat: 54.31, lng: 48.39 },
            // Urals
            { lat: 56.83, lng: 60.60 }, { lat: 55.16, lng: 61.43 }, { lat: 54.73, lng: 55.95 },
            { lat: 58.00, lng: 56.22 }, { lat: 56.84, lng: 53.20 },
            // Siberia
            { lat: 55.00, lng: 82.93 }, { lat: 54.98, lng: 73.36 }, { lat: 56.01, lng: 92.86 },
            { lat: 52.28, lng: 104.30 }, { lat: 53.35, lng: 83.76 },
            // South/Far East
            { lat: 47.23, lng: 39.70 }, { lat: 45.03, lng: 38.97 }, { lat: 43.11, lng: 131.88 }, { lat: 48.48, lng: 135.07 }
        ];

        // Phase 6: China "Dragon Wakes" (T+32s) - SPECIFIC TARGETS
        const CN_PACIFIC_TARGETS = [
            { lat: 61.2, lng: -149.9 }, { lat: 49.3, lng: -123.1 }, // Anchorage, Vancouver
            { lat: 47.6, lng: -122.3 }, { lat: 45.5, lng: -122.7 }, // Seattle, Portland
            { lat: 38.6, lng: -121.5 }, { lat: 37.8, lng: -122.4 }, // Sacramento, SF
            { lat: 34.0, lng: -118.2 }, { lat: 32.7, lng: -117.2 }, // LA, San Diego
            { lat: 21.3, lng: -157.8 }, // Honolulu
            { lat: -33.9, lng: 151.2 }, { lat: -23.8, lng: 133.7 }, // Sydney, Pine Gap
            { lat: -31.9, lng: 115.8 }, { lat: -37.8, lng: 144.9 }, // Perth, Melbourne
            { lat: -34.9, lng: 138.6 }, { lat: -35.2, lng: 149.1 }, // Adelaide, Canberra
            { lat: -27.4, lng: 153.0 }, // Brisbane
            { lat: -7.3, lng: 72.4 },  // Diego Garcia
            { lat: 35.7, lng: 139.7 }, { lat: 34.7, lng: 135.5 }, // Tokyo, Osaka
            { lat: 33.6, lng: 130.4 }, { lat: 35.2, lng: 136.9 }, // Fukuoka, Nagoya
            { lat: 37.9, lng: 139.0 }, { lat: 38.3, lng: 140.9 }, // Niigata, Sendai
            { lat: 43.1, lng: 141.3 }, // Sapporo
            { lat: 1.35, lng: 103.8 }, { lat: 37.6, lng: 127.0 }  // Singapore, Seoul
        ];

        // Phase 7: US Pacific Retaliation (T+37s)
        const CN_TARGETS = [
            // Coastal
            { lat: 39.90, lng: 116.40 }, { lat: 31.23, lng: 121.47 }, { lat: 39.34, lng: 117.36 },
            { lat: 23.12, lng: 113.26 }, { lat: 22.54, lng: 114.05 }, { lat: 22.31, lng: 114.16 },
            { lat: 32.06, lng: 118.79 }, { lat: 30.27, lng: 120.15 },
            // Inland
            { lat: 29.56, lng: 106.55 }, { lat: 30.57, lng: 104.06 }, { lat: 30.59, lng: 114.30 },
            { lat: 34.34, lng: 108.93 }, { lat: 45.80, lng: 126.53 },
            // Strategic
            { lat: 34.38, lng: 111.65 }, { lat: 37.37, lng: 97.36 }, { lat: 42.81, lng: 93.51 },
            { lat: 40.26, lng: 96.72 }, { lat: 28.24, lng: 102.02 },
            // Naval
            { lat: 18.22, lng: 109.48 }, { lat: 36.10, lng: 120.50 },
            // Strait
            { lat: 26.07, lng: 119.29 }, { lat: 24.47, lng: 118.08 }, { lat: 29.86, lng: 121.54 }
        ];

        // REGIONAL
        const REGIONAL_TARGETS = {
            INDIA: [{ lat: 31.52, lng: 74.35 }, { lat: 24.86, lng: 67.00 }, { lat: 30.15, lng: 71.52 }, { lat: 33.68, lng: 73.04 }], // Lahore, Karachi, Multan, Islamabad
            PAKISTAN: [
                { lat: 28.61, lng: 77.20 }, { lat: 19.07, lng: 72.87 }, { lat: 23.02, lng: 72.57 },
                { lat: 26.84, lng: 80.94 }, { lat: 18.52, lng: 73.85 }, { lat: 12.97, lng: 77.59 },
                { lat: 17.38, lng: 78.48 }, { lat: 15.29, lng: 74.12 }, { lat: 13.08, lng: 80.27 },
                { lat: 22.57, lng: 88.36 }
            ], // Delhi, Mumbai, Ahmedabad, Lucknow, Pune, Bangalore, Hyderabad, Goa, Chennai, Kolkata
            IRAN: [{ lat: 32.79, lng: 34.99 }, { lat: 31.76, lng: 35.21 }, { lat: 32.08, lng: 34.78 }], // Haifa, Jerusalem, Tel Aviv
            ISRAEL: [{ lat: 35.68, lng: 51.38 }, { lat: 38.09, lng: 46.29 }, { lat: 29.59, lng: 52.58 }, { lat: 34.64, lng: 50.87 }] // Tehran, Tabriz, Shiraz, Qom
        };

        // India Launch Sites (approx)
        const INDIA_LAUNCH = [{ lat: 21.1, lng: 79.0 }];
        const PAKISTAN_LAUNCH = [{ lat: 30.2, lng: 67.0 }];
        const IRAN_LAUNCH = [{ lat: 34.0, lng: 51.0 }];
        const ISRAEL_LAUNCH = [{ lat: 31.5, lng: 34.5 }];


        // T+0: Start
        console.log("Scenario 1 Started");
        this.updateDefcon(5);

        // Phase 1: Mystery Inbound (T+5s) -> Impacts at T+20s
        this.schedule(5000, () => {
            this.updateDefcon(3);
            this.launchMissile(ARCTIC, CHICAGO, '#FF0000', 15000, true);
        });

        // Phase 2: Intercept (T+8s)
        this.schedule(8000, () => {
            this.updateDefcon(2);
            // Scripted Failure
            const m1 = this.launchMissile(FT_GREELY, { lat: 62, lng: -92 }, '#00FFFF', 4000, false);
            const m2 = this.launchMissile(FT_GREELY, { lat: 62, lng: -88 }, '#00FFFF', 4000, false);
            m1.onImpact = () => this.detonate(m1.target, 150000, '#FFFFFF'); // White Intercept
            m2.onImpact = () => this.detonate(m2.target, 150000, '#FFFFFF');
        });

        // Phase 3: US Panic Fire (T+18s) - COUNTER FORCE
        this.schedule(18000, () => {
            this.updateDefcon(1); // FLASHING RED
            const targets = US_FIRST_STRIKE_TARGETS;
            // One warhead per target
            for (let i = 0; i < targets.length; i++) {
                const origin = SILO_BELT[i % SILO_BELT.length];
                const target = targets[i];

                const jitOrg = { lat: origin.lat + Math.random(), lng: origin.lng + Math.random() };
                const m = this.launchMissile(jitOrg, target, '#0088FF', 10000 + Math.random() * 2000, true);
                this.attemptIntercept(m, 'RU');
            }
        });

        // Phase 4: Russia Launch on Warning (T+25s) - MASSIVE SATURATION
        this.schedule(25000, () => {
            // Filter Targets
            const westTargets = [];
            const eastTargets = [];
            const mainlandTargets = [];

            RUSSIA_LAUNCH_TARGETS.forEach(t => {
                if (t.lng < -100) {
                    westTargets.push(t);
                } else if (t.lng > -90 && t.lng < -60 && t.lat < 50) { // East Coast approx
                    eastTargets.push(t);
                } else {
                    mainlandTargets.push(t);
                }
            });

            // Launch Helper
            const launchVolley = (targets, origins, isFleet) => {
                for (let i = 0; i < targets.length; i++) {
                    // If fleet, +4s delay. If mainland, staggering 0-5s
                    const delay = isFleet ? 4000 + (Math.random() * 1000) : (Math.random() * 5000);

                    setTimeout(() => {
                        const target = targets[i];
                        // Round-robin origins
                        const origin = origins[i % origins.length];

                        const jitOrg = { lat: origin.lat + Math.random(), lng: origin.lng + Math.random() };
                        const jitTgt = { lat: target.lat + Math.random(), lng: target.lng + Math.random() };

                        const m = this.launchMissile(jitOrg, jitTgt, '#FF0000', 15000 + Math.random() * 5000, true);
                        this.attemptUserIntercept(m); // PROTECT PLAYER

                        // Intercepts
                        if (target.lng > -30 && target.lng < 40) {
                            this.attemptIntercept(m, 'EU');
                        } else {
                            this.attemptIntercept(m, 'US');
                        }
                    }, delay);
                }
            };

            // Execute
            console.log(`Phase 4: Launching. West Total: ${westTargets.length}, East Total: ${eastTargets.length}, Main: ${mainlandTargets.length}`);

            // User request: Fleets shoot 3 each (per sub). 2 subs = 6 targets total.
            const fleetWest = westTargets.slice(0, 6);
            const remainderWest = westTargets.slice(6);

            const fleetEast = eastTargets.slice(0, 6);
            const remainderEast = eastTargets.slice(6);

            // Add remainders back to mainland
            mainlandTargets.push(...remainderWest, ...remainderEast);

            launchVolley(fleetWest, RU_PACIFIC_FLEET, true);
            launchVolley(fleetEast, RU_ATLANTIC_FLEET, true);

            // Mainland sources: Launch sites + Subs
            const mainlandOrigins = [...RU_LAUNCH, ...RU_SUBS];
            launchVolley(mainlandTargets, mainlandOrigins, false);
        });

        // Phase 5: US/NATO Atlantic Retaliation (T+30s) - MASSIVE SATURATION
        this.schedule(30000, () => {
            // Atlantic Subs & EU Launch -> RU Cities/Mil
            const targets = US_NATO_RETALIATION_TARGETS;

            for (let i = 0; i < targets.length; i++) {
                const origin = (i < 30) ? US_ATLANTIC_SUBS[i % 3] : EU_LAUNCH[i % 2];
                const target = targets[i];

                const m = this.launchMissile(origin, target, '#0088FF', 12000 + Math.random() * 3000, true);
                this.attemptIntercept(m, 'RU');
            }
        });

        // Phase 6: China "Dragon Wakes" (T+32s) - SPECIFIC TARGETS
        this.schedule(32000, () => {
            // Specific Pacific Targets
            const targets = CN_PACIFIC_TARGETS;
            for (let i = 0; i < targets.length; i++) {
                const origin = CN_LAUNCH[i % 2];
                const target = targets[i];
                const m = this.launchMissile(origin, target, '#FF9900', 12000 + Math.random() * 3000, true);

                this.attemptUserIntercept(m); // PROTECT PLAYER

                // Regional Defense
                if (target.lat > 30 && target.lng > 130 && target.lng < 145) {
                    this.attemptIntercept(m, 'JP'); // Defend Japan
                } else {
                    this.attemptIntercept(m, 'US'); // US defends others (Aus/US)
                }
            }
        });

        // Phase 7: US Pacific Retaliation (T+37s)
        this.schedule(37000, () => {
            // Pacific Subs -> CN
            const targets = CN_TARGETS;
            for (let i = 0; i < targets.length; i++) {
                const origin = US_PACIFIC_SUBS[i % 3];
                const target = targets[i];
                this.launchMissile(origin, target, '#0088FF', 10000 + Math.random() * 2000, true);
            }
        });

        // Phase 8: Regional Conflicts (T+40s)
        this.schedule(40000, () => {
            // INDIA (4 Missiles) -> PAKISTAN Cities
            for (let i = 0; i < 4; i++) {
                const origin = INDIA_LAUNCH[0];
                const target = REGIONAL_TARGETS.INDIA[i % REGIONAL_TARGETS.INDIA.length];
                this.launchMissile(origin, target, '#FF8800', 4000 + Math.random() * 2000, true);
            }
            // PAKISTAN (7 Missiles) -> INDIA Cities
            for (let i = 0; i < 7; i++) {
                const origin = PAKISTAN_LAUNCH[0];
                const target = REGIONAL_TARGETS.PAKISTAN[i % REGIONAL_TARGETS.PAKISTAN.length];
                this.launchMissile(origin, target, '#00FF88', 4000 + Math.random() * 2000, true);
            }
            // ISRAEL (10) -> IRAN
            for (let i = 0; i < 10; i++) {
                const origin = ISRAEL_LAUNCH[0];
                const target = REGIONAL_TARGETS.ISRAEL[i % REGIONAL_TARGETS.ISRAEL.length]; // Targeting Iran
                this.launchMissile(origin, target, '#0088FF', 5000, true);
            }
            // IRAN (10) -> Israel
            for (let i = 0; i < 10; i++) {
                const origin = IRAN_LAUNCH[0];
                const target = REGIONAL_TARGETS.IRAN[i % REGIONAL_TARGETS.IRAN.length]; // Targeting Israel
                this.launchMissile(origin, target, '#CC00FF', 5000, true);
            }
        });

        // Finale: Last Shot (T+48s)
        this.schedule(48000, () => {
            this.activeMissiles.forEach(m => m.remove());
            // Keep detonations (scars) on screen

            const origin = { lat: 88, lng: 0 };
            const ms = this.launchMissile(origin, this.userLocation, '#FFFFFF', 6000, false);
            // BOOST VISIBILITY
            ms.dashedLine.setOptions({
                zIndex: 999999,
                strokeWeight: 4,
                icons: [{
                    icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 4, strokeColor: '#FFFFFF' },
                    offset: '0',
                    repeat: '20px'
                }]
            });
            ms.solidLine.setOptions({ zIndex: 999999, strokeWeight: 5 });

            // NO PROTECTION FOR THIS ONE - User dies here.

            setTimeout(() => {
                this.detonate(this.userLocation, 2000000, '#FFFFFF');
                setTimeout(() => this.triggerGameOver(), 500);
            }, 6000);
        });
    }
}

class Missile {
    constructor(map, origin, target, color, duration) {
        this.map = map;
        this.origin = origin;
        this.target = target;
        this.color = color;
        this.duration = duration;
        this.startTime = null;
        this.dashedLine = null;
        this.solidLine = null;
        this.animationFrame = null;
        this.onImpact = null;
        this.destroyed = false; // Destroyed mid-flight?
    }

    launch() {
        // 1. Dashed "Tail" Trail
        const dashSymbol = {
            path: 'M 0,-1 0,1',
            strokeOpacity: 1,
            scale: 2
        };

        this.dashedLine = new google.maps.Polyline({
            map: this.map,
            geodesic: true,
            strokeColor: this.color,
            strokeOpacity: 0,
            strokeWeight: 2,
            zIndex: 200, // Higher than detonations
            icons: [{
                icon: dashSymbol,
                offset: '0',
                repeat: '10px'
            }],
            path: [this.origin, this.origin]
        });

        // 2. Solid "Head" Trail + Warhead
        const warheadSymbol = {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 5,
            fillColor: this.color, // Filled circle
            fillOpacity: 1,
            strokeWeight: 0,
            strokeColor: '#FFF' // White outline?
        };

        this.solidLine = new google.maps.Polyline({
            map: this.map,
            geodesic: true,
            strokeColor: this.color,
            strokeOpacity: 1.0,
            strokeWeight: 3,
            zIndex: 201, // Top of missiles
            path: [this.origin, this.origin],
            icons: [{
                icon: warheadSymbol,
                offset: '100%' // At the very front
            }]
        });

        this.startTime = performance.now();
        this.animate();
    }

    animate() {
        this.animationFrame = requestAnimationFrame((now) => {
            if (this.destroyed) return; // Stop if destroyed

            const elapsed = now - this.startTime;
            const progress = Math.min(elapsed / this.duration, 1.0);

            // Calculate current positions
            const headPos = google.maps.geometry.spherical.interpolate(
                new google.maps.LatLng(this.origin),
                new google.maps.LatLng(this.target),
                progress
            );

            // Solid Tail: 12% behind head (increased from 5%)
            const solidTailProgress = Math.max(0, progress - 0.12);
            /* const solidTailPos = ... */ // Optimization: calculate only if needed? JS is fast enough.
            const solidTailPos = google.maps.geometry.spherical.interpolate(
                new google.maps.LatLng(this.origin),
                new google.maps.LatLng(this.target),
                solidTailProgress
            );

            // Dashed Tail: 30% behind head
            const dashedTailProgress = Math.max(0, progress - 0.3);
            const dashedTailPos = google.maps.geometry.spherical.interpolate(
                new google.maps.LatLng(this.origin),
                new google.maps.LatLng(this.target),
                dashedTailProgress
            );

            // Update Paths
            this.solidLine.setPath([solidTailPos, headPos]);
            this.dashedLine.setPath([dashedTailPos, solidTailPos]);

            if (progress < 1.0) {
                this.animate();
            } else {
                if (this.onImpact) this.onImpact();
                this.remove();
            }
        });
    }

    destroy() {
        this.destroyed = true;
        this.remove();
        // Do not call onImpact
    }

    remove() {
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        if (this.dashedLine) this.dashedLine.setMap(null);
        if (this.solidLine) this.solidLine.setMap(null);
    }
}

class Detonation {
    constructor(map, center, maxSize, color) {
        this.map = map;
        this.center = center;
        this.maxSize = maxSize;
        this.color = color;
        this.circle = null;
        this.animationFrame = null;
    }

    explode() {
        this.circle = new google.maps.Circle({
            map: this.map,
            strokeWeight: 0,
            fillColor: this.color,
            fillOpacity: 0.9,
            center: this.center,
            radius: 0,
            zIndex: 10 // Ground level
        });

        // Animation
        let size = 0;
        const expandTime = 500;
        const holdTime = 2000;
        const fadeTime = 2000;
        const startTime = Date.now();

        // Permanent if RED (Nuclear), Fade if WHITE/GOLD/Cyan (Interceptor)
        const isPermanent = (this.color === '#FF0000');

        const animate = () => {
            const now = Date.now();
            const elapsed = now - startTime;

            if (elapsed < expandTime) {
                // Expanding
                const progress = elapsed / expandTime;
                size = this.maxSize * Math.pow(progress, 0.5);
                this.circle.setRadius(size);
                requestAnimationFrame(animate);
            } else if (isPermanent) {
                // Permanent Hold
                this.circle.setRadius(this.maxSize);
                // No fade for nukes
            } else {
                // Interceptor Fade Logic
                if (elapsed < expandTime + holdTime) {
                    // Holding
                    this.circle.setRadius(this.maxSize);
                } else if (elapsed < expandTime + holdTime + fadeTime) {
                    // Fading
                    const fadeElapsed = elapsed - (expandTime + holdTime);
                    const p = 1 - (fadeElapsed / fadeTime);
                    this.circle.setOptions({ fillOpacity: 0.9 * p });
                } else {
                    // Done
                    this.remove();
                    return;
                }
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    remove() {
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        if (this.circle) this.circle.setMap(null);
    }
}

function updateDefcon(level) {
    const el = document.getElementById('defcon-display');
    if (!el) return;

    el.textContent = `DEFCON ${level}`;
    el.className = ''; // Reset classes

    if (level === 5) {
        el.classList.add('defcon-5');
    }
}
