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

    solarAngleLayer = new google.maps.Polygon({
        map: document.getElementById('toggleSolar').checked ? map : null,
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
    document.getElementById('toggleSnow').addEventListener('change', (e) => {
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

    // Toggle Cloud Cover
    document.getElementById('toggleCloud').addEventListener('change', (e) => {
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

    document.getElementById('toggleSolar').addEventListener('change', function () {
        console.log('Toggle clicked. Checked:', this.checked);
        if (this.checked) {
            solarAngleLayer.setMap(map);
            console.log('Layer set to map');
        } else {
            solarAngleLayer.setMap(null);
            console.log('Layer removed from map');
        }
    });

    fetchTLEs();
}

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
    const term = ((R_EARTH + altitudeKm) / R_EARTH) * sinAlpha;

    if (term > 1) {
        // Horizon case or invalid
        return 0;
    }

    // Angle at the surface (incidence angle + 90?)
    // Let's use the property: alpha + beta + (180 - eta) = 180 => beta = eta - alpha
    // sin(eta) = term
    const eta = Math.asin(term);
    const beta = eta - alpha;

    // Surface distance (arc length)
    const distanceKm = R_EARTH * beta;
    return distanceKm * 1000; // Convert to meters
}

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
    const isVisible = document.getElementById('toggleSolar').checked;
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

    // Max Off-Nadir Input is now static HTML
    const maxOffNadirInput = document.getElementById('maxOffNadir');
    if (maxOffNadirInput) {
        // Optional: Add validation listener
        maxOffNadirInput.addEventListener('change', (e) => {
            let val = parseInt(e.target.value);
            if (val < 1) e.target.value = 1;
            if (val > 90) e.target.value = 90; // Allow up to 90 technically, though 50 is reasonable limit
        });
        // Add Enter key support
        maxOffNadirInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handlePrediction();
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

async function handlePrediction() {
    const locationInput = document.getElementById('locationInput').value;
    const maxOffNadirInput = document.getElementById('maxOffNadir');
    const maxOffNadir = maxOffNadirInput ? parseInt(maxOffNadirInput.value, 10) : 30;

    if (!locationInput) return;

    showLoading(true);
    clearResults();

    try {
        const coords = await geocodeAddress(locationInput);
        if (!coords) {
            // Alert is handled in geocodeAddress or specific error there
            showLoading(false);
            return;
        }

        // Add a marker for the observer
        new google.maps.Marker({
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
        const isGoodAngle = bestDetails.minOffNadir <= maxOffNadir;
        if (isDaylight && isGoodAngle) return bestDetails;
    }
    return null;
}

function displayResults(passes) {
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

    passes.forEach(pass => {
        const row = document.createElement('tr');

        // Check if > 14 days
        if (pass.startTime.getTime() - now.getTime() > fourteenDays) {
            hasLongTerm = true;
        }

        // Date/Time
        const dateStr = pass.startTime.toLocaleDateString();
        const timeStr = pass.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Quality Class
        let qualityClass = 'quality-red';
        if (pass.minOffNadir <= 10) qualityClass = 'quality-green';
        else if (pass.minOffNadir <= 20) qualityClass = 'quality-yellow';

        // Sun Warning
        let sunWarning = '';
        if (pass.sunElevationAtMax < 30) {
            sunWarning = '<span class="warning-icon" title="Poor Sun Angle (< 30°)">⚠️</span>';
        }

        row.innerHTML = `
            <td>${dateStr}</td>
            <td>${timeStr}</td>
            <td>${pass.satName}</td>
            <td class="${qualityClass}">${pass.minOffNadir.toFixed(1)}°</td>
            <td>${pass.sunElevationAtMax.toFixed(0)}° ${sunWarning}</td>
        `;

        tbody.appendChild(row);
    });

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
