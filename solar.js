/**
 * Satellite Tracker - Solar Calculations
 * Sun position, terminator, and solar angle layer logic.
 */

/**
 * Calculates the Sun's position (Declination and Sub-solar Longitude) for a given date.
 * Uses low-precision formulas suitable for this visualization (accuracy ~0.01 deg).
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

function getTerminatorPath(sunLat, sunLng) {
    const path = [];
    const rad = Math.PI / 180;
    const deg = 180 / Math.PI;

    let latRad = sunLat * rad;
    if (Math.abs(latRad) < 1e-6) {
        latRad = latRad >= 0 ? 1e-6 : -1e-6;
    }

    if (sunLat > 0) {
        for (let lng = -180; lng <= 180; lng += 2) {
            const lngRad = lng * rad;
            const sunLngRad = sunLng * rad;
            const termLatRad = Math.atan(-Math.cos(lngRad - sunLngRad) / Math.tan(latRad));
            path.push({ lat: termLatRad * deg, lng: lng });
        }
        path.push({ lat: -90, lng: 180 });
        path.push({ lat: -90, lng: 0 });
        path.push({ lat: -90, lng: -180 });
    } else {
        for (let lng = 180; lng >= -180; lng -= 2) {
            const lngRad = lng * rad;
            const sunLngRad = sunLng * rad;
            const termLatRad = Math.atan(-Math.cos(lngRad - sunLngRad) / Math.tan(latRad));
            path.push({ lat: termLatRad * deg, lng: lng });
        }
        path.push({ lat: 90, lng: -180 });
        path.push({ lat: 90, lng: 0 });
        path.push({ lat: 90, lng: 180 });
    }

    return path;
}

function updateNightLayer(date) {
    const sunPos = getSunPosition(date);
    const path = getTerminatorPath(sunPos.lat, sunPos.lng);
    nightLayer.setPath(path);
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
 * Updates the "Poor Sun Angle" overlay layer.
 * Calculates latitude bands where the sun elevation never exceeds 30 degrees.
 */
function updateSolarAngleLayer(date) {
    const sunPos = getSunPosition(date);
    const declination = sunPos.lat;

    const maxElevation = 90 - Math.abs(declination);
    const threshold = 30;

    if (maxElevation < threshold) {
        solarAngleLayer.setPaths([createBoxPath(-90, 90)]);
        solarAngleLayer.setMap(map);
        return;
    }

    const noonGoodStart = declination - (90 - threshold);
    const noonGoodEnd = declination + (90 - threshold);

    const clampedStart = Math.max(-90, noonGoodStart);
    const clampedEnd = Math.min(90, noonGoodEnd);

    const redPaths = [];

    if (clampedStart > -90) {
        redPaths.push(createBoxPath(-90, clampedStart));
    }
    if (clampedEnd < 90) {
        redPaths.push(createBoxPath(clampedEnd, 90));
    }

    solarAngleLayer.setPaths(redPaths);

    const toggleSolar = document.getElementById('toggleSolar');
    const isVisible = toggleSolar ? toggleSolar.checked : false;
    solarAngleLayer.setMap(isVisible ? map : null);

    // Marginal solar layer (yellow)
    const morningAngleOffset = 15 * (10.5 / 12);
    const ten30GoodStart = declination - (90 - threshold) + morningAngleOffset;
    const ten30GoodEnd = declination + (90 - threshold) - morningAngleOffset;

    const clTen30Start = Math.max(-90, ten30GoodStart);
    const clTen30End = Math.min(90, ten30GoodEnd);

    const yellowPaths = [];

    const yellowNorthStart = Math.max(clampedEnd, -90);
    const yellowNorthEnd = Math.min(90, clTen30End > clampedEnd ? 90 : clampedEnd);

    if (clTen30End < clampedEnd && clTen30End > clampedStart) {
        yellowPaths.push(createBoxPath(clTen30End, clampedEnd));
    }
    if (clTen30Start > clampedStart && clTen30Start < clampedEnd) {
        yellowPaths.push(createBoxPath(clampedStart, clTen30Start));
    }

    if (!marginalSolarLayer) {
        marginalSolarLayer = new google.maps.Polygon({
            map: map,
            strokeWeight: 0,
            fillColor: '#FFC107',
            fillOpacity: 0.35,
            clickable: false,
            paths: []
        });
    }
    marginalSolarLayer.setPaths(yellowPaths);

    marginalSolarLayer.setVisible(isVisible);
}
