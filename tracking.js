/**
 * Satellite Tracker - Tracking & Visuals
 * Position calculation, footprint geometry, visual creation, and the main update loop.
 */

/**
 * Calculates the satellite's position (Lat/Lng) at a specific time.
 */
function getLatLngAtTime(satrec, date) {
    const positionAndVelocity = satellite.propagate(satrec, date);
    const positionEci = positionAndVelocity.position;

    if (!positionEci) return null;

    const gmst = satellite.gstime(date);
    const positionGd = satellite.eciToGeodetic(positionEci, gmst);

    return {
        lat: satellite.degreesLat(positionGd.latitude),
        lng: satellite.degreesLong(positionGd.longitude)
    };
}

/**
 * Combined position + altitude in a single propagation call.
 * Used by the main update loop to avoid redundant satellite.propagate() calls.
 */
function getPositionAtTime(satrec, date) {
    const positionAndVelocity = satellite.propagate(satrec, date);
    const positionEci = positionAndVelocity.position;

    if (!positionEci) return null;

    const gmst = satellite.gstime(date);
    const positionGd = satellite.eciToGeodetic(positionEci, gmst);

    return {
        lat: satellite.degreesLat(positionGd.latitude),
        lng: satellite.degreesLong(positionGd.longitude),
        altitudeKm: positionGd.height
    };
}

/**
 * Calculates the radius of the satellite's footprint on the ground based on the
 * maximum off-nadir angle.
 */
function calculateFootprintRadius(altitudeKm, offNadirDeg) {
    const R_EARTH = 6371;
    const alpha = offNadirDeg * (Math.PI / 180);

    const sinAlpha = Math.sin(alpha);
    let term = ((R_EARTH + altitudeKm) / R_EARTH) * sinAlpha;

    if (term > 1) term = 1;

    const eta = Math.asin(term);
    const beta = eta - alpha;

    const distanceKm = R_EARTH * beta;
    return distanceKm * 1000;
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
                className: "satellite-label"
            },
            icon: SATELLITE_SVG
        });
    }

    if (sat.cones.length === 0) {
        const colors = ['#00FF00', '#FFFF00', '#FF0000'];
        const opacities = [0.2, 0.15, 0.1];

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
            strokeColor: '#FFFF00',
            strokeOpacity: 0,
            icons: [{
                icon: {
                    path: 'M 0,-1 0,1',
                    strokeOpacity: 1,
                    scale: 3,
                    strokeWeight: 1,
                    strokeColor: '#FFFF00'
                },
                offset: '0',
                repeat: '15px'
            }]
        });
    }

    if (!sat.futurePath) {
        sat.futurePath = new google.maps.Polyline({
            map: map,
            geodesic: true,
            strokeColor: '#00FF00',
            strokeOpacity: 1.0,
            strokeWeight: 1
        });
    }
}

/**
 * Main animation loop. Updates the position of all satellites, markers, cones,
 * and the day/night terminator.
 * Called every second.
 *
 * Performance notes:
 * - Marker + cones update every tick (1s) for real-time feel
 * - Tracks (past/future paths) update every 10s (62 propagations/sat saved per skip)
 * - Solar angle layer updates every 60s (declination barely changes)
 */
function updatePositions() {
    const now = new Date();
    const nowMs = now.getTime();

    // Night terminator: update every tick (visible movement)
    updateNightLayer(now);

    // Solar angle: update every 60 seconds (declination changes ~0.004°/min)
    if (nowMs - _lastSolarUpdate >= 60000) {
        if (isSolarDateCustom && customSolarDate) {
            updateSolarAngleLayer(customSolarDate);
        } else {
            updateSolarAngleLayer(now);
        }
        _lastSolarUpdate = nowMs;
    }

    // Track update counter: recalculate paths every 10 ticks (10s)
    _trackUpdateCounter++;
    const shouldUpdateTracks = (_trackUpdateCounter % 10 === 0);

    satellites.forEach(sat => {
        if (!sat.satrec || !sat.enabled) return;

        // Single propagation for position + altitude
        const pos = getPositionAtTime(sat.satrec, now);
        if (!pos) return;

        // Update Marker
        if (sat.marker) {
            sat.marker.setPosition({ lat: pos.lat, lng: pos.lng });
        }

        // Update Cones (uses altitude from same propagation)
        const offNadirAngles = [10, 20, 30];
        sat.cones.forEach((cone, index) => {
            const radius = calculateFootprintRadius(pos.altitudeKm, offNadirAngles[index]);
            cone.setCenter({ lat: pos.lat, lng: pos.lng });
            cone.setRadius(radius);
        });

        // Update Tracks (throttled to every 10 seconds)
        if (shouldUpdateTracks) {
            // Past track (last 30 mins)
            const pastPathCoords = [];
            for (let i = -30; i <= 0; i += 2) {
                const t = new Date(nowMs + i * 60000);
                const p = getLatLngAtTime(sat.satrec, t);
                if (p) pastPathCoords.push(p);
            }
            if (sat.pastPath) sat.pastPath.setPath(pastPathCoords);

            // Future track (next 90 mins)
            const futurePathCoords = [];
            for (let i = 0; i <= 90; i += 2) {
                const t = new Date(nowMs + i * 60000);
                const p = getLatLngAtTime(sat.satrec, t);
                if (p) futurePathCoords.push(p);
            }
            if (sat.futurePath) sat.futurePath.setPath(futurePathCoords);
        }
    });
}
