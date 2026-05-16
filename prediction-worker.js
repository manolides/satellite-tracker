/**
 * Prediction Worker
 * 
 * Runs satellite pass prediction in a background thread to avoid
 * blocking the main UI. All functions here are pure math with no
 * DOM or Google Maps API dependencies.
 */

importScripts('https://cdnjs.cloudflare.com/ajax/libs/satellite.js/4.0.0/satellite.min.js');

/**
 * Calculates the Sun's position (Declination and Sub-solar Longitude) for a given date.
 * Copy of the main-thread version — kept in sync manually.
 */
function getSunPosition(date) {
    const rad = Math.PI / 180;
    const deg = 180 / Math.PI;

    const jd = (date.getTime() / 86400000) + 2440587.5;
    const n = jd - 2451545.0;

    let L = 280.460 + 0.9856474 * n;
    L %= 360;
    if (L < 0) L += 360;

    let g = 357.528 + 0.9856003 * n;
    g %= 360;
    if (g < 0) g += 360;

    const lambda = L + 1.915 * Math.sin(g * rad) + 0.020 * Math.sin(2 * g * rad);
    const epsilon = 23.439 - 0.0000004 * n;

    const alpha = Math.atan2(Math.cos(epsilon * rad) * Math.sin(lambda * rad), Math.cos(lambda * rad)) * deg;
    const delta = Math.asin(Math.sin(epsilon * rad) * Math.sin(lambda * rad)) * deg;

    const gmstRad = satellite.gstime(date);
    const gmstDeg = gmstRad * deg;

    let subSolarLng = alpha - gmstDeg;
    subSolarLng %= 360;
    if (subSolarLng > 180) subSolarLng -= 360;
    if (subSolarLng < -180) subSolarLng += 360;

    return { lat: delta, lng: subSolarLng };
}

/**
 * Core Pass Prediction Algorithm (Worker version).
 * 
 * Uses plain lat/lng numbers instead of Google Maps LatLng objects.
 *
 * @param {Object} sat - { name, catNr, satrec }
 * @param {number} observerLat - Observer latitude in degrees
 * @param {number} observerLng - Observer longitude in degrees
 * @param {number} maxOffNadir - Maximum allowed off-nadir angle
 * @param {number} limit - Max number of passes to return
 * @param {number} maxDays - How many days into the future to search
 * @returns {Array} List of pass objects
 */
function predictPasses(sat, observerLat, observerLng, maxOffNadir, limit, maxDays) {
    const passes = [];
    const stepSeconds = 60;
    const maxTime = maxDays * 24 * 60 * 60 * 1000;
    const now = new Date();
    const startTime = now.getTime();

    const observerGd = {
        longitude: observerLng * (Math.PI / 180),
        latitude: observerLat * (Math.PI / 180),
        height: 0
    };

    let inPass = false;
    let passStartTime = 0;

    for (let t = 0; t < maxTime; t += stepSeconds * 1000) {
        if (passes.length >= limit) break;

        const time = new Date(startTime + t);
        const positionAndVelocity = satellite.propagate(sat.satrec, time);
        if (!positionAndVelocity.position) continue;

        const gmst = satellite.gstime(time);
        const positionEcf = satellite.eciToEcf(positionAndVelocity.position, gmst);
        const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);

        if (lookAngles.elevation > 0) {
            if (!inPass) {
                inPass = true;
                passStartTime = t;
            }
        } else {
            if (inPass) {
                const passEndTime = t;
                const bestPass = findBestPassDetails(sat, observerLat, observerLng, startTime + passStartTime, startTime + passEndTime, maxOffNadir);
                if (bestPass) passes.push(bestPass);
                inPass = false;
            }
        }
    }

    // Check if we ended inside a pass
    if (inPass) {
        const bestPass = findBestPassDetails(sat, observerLat, observerLng, startTime + passStartTime, startTime + maxTime, maxOffNadir);
        if (bestPass) passes.push(bestPass);
    }

    return passes;
}

/**
 * Fine-grained search within a pass window to find the best approach details.
 * Worker version using plain lat/lng numbers.
 */
function findBestPassDetails(sat, observerLat, observerLng, startMs, endMs, maxOffNadir) {
    let bestDetails = null;
    const fineStepMs = 5000; // 5 seconds fine step

    const observerGd = {
        longitude: observerLng * (Math.PI / 180),
        latitude: observerLat * (Math.PI / 180),
        height: 0
    };

    for (let t = startMs; t <= endMs; t += fineStepMs) {
        const time = new Date(t);
        const positionAndVelocity = satellite.propagate(sat.satrec, time);
        if (!positionAndVelocity.position) continue;

        const gmst = satellite.gstime(time);
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
                    startTime: time,
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

// --- Worker Message Handler ---

onmessage = function (e) {
    const { requestId, satellites, observerLat, observerLng, maxOffNadir } = e.data;

    const allPasses = [];

    for (const satData of satellites) {
        try {
            const satrec = satellite.twoline2satrec(satData.line1, satData.line2);
            const sat = { name: satData.name, catNr: satData.catNr, satrec };
            const passes = predictPasses(sat, observerLat, observerLng, maxOffNadir, 5, 365);
            allPasses.push(...passes);
        } catch (err) {
            console.error(`Worker: Error processing ${satData.name}:`, err);
        }
    }

    allPasses.sort((a, b) => a.startTime - b.startTime);
    const topPasses = allPasses.slice(0, 5);

    // Serialize Date objects as timestamps for postMessage
    const serialized = topPasses.map(p => ({
        ...p,
        startTime: p.startTime.getTime()
    }));

    postMessage({ requestId, passes: serialized });
};
