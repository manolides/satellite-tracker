/**
 * Satellite Tracker - Pass Prediction
 * Prediction panel UI, geocoding, weather, and results display.
 */

// --- Prediction Panel Setup ---

document.addEventListener('DOMContentLoaded', () => {
    const panel = document.getElementById('prediction-panel');
    if (panel) {
        panel.style.display = 'block';
    }

    // Max Off-Nadir Input Logic
    const maxOffNadirInput = document.getElementById('maxOffNadir');
    if (maxOffNadirInput) {
        maxOffNadirInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            let val = parseInt(e.target.value);
            if (val > 90) e.target.value = 90;
        });

        maxOffNadirInput.addEventListener('blur', (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val) || val < 1) e.target.value = 1;
        });

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
                panelBody.style.display = 'flex';
                minimizeBtn.textContent = '_';
                minimizeBtn.title = "Minimize";
            } else {
                panelBody.style.display = 'none';
                minimizeBtn.textContent = '□';
                minimizeBtn.title = "Maximize";
            }
        });
    }

    const predictBtn = document.getElementById('predictBtn');
    if (predictBtn) {
        predictBtn.addEventListener('click', handlePrediction);
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

// --- Prediction Logic ---

/**
 * Handles the "Predict" button click.
 * Geocodes the user's location and initiates the pass prediction process.
 */
async function handlePrediction() {
    const locationInputEl = document.getElementById('locationInput');
    const locationValue = locationInputEl.value;
    const maxOffNadirInput = document.getElementById('maxOffNadir');
    const maxOffNadir = maxOffNadirInput ? parseInt(maxOffNadirInput.value, 10) : 30;

    if (!locationValue) return;

    // Secret Code Triggers
    const inputUpper = locationValue.trim().toUpperCase();
    if (inputUpper === "JOSHUA" || inputUpper === "WOPR" || inputUpper === "WOPR1" || inputUpper === "WOPR_REALTIME") {
        if (inputUpper === "JOSHUA" && isWarGamesMode) {
            exitWarGamesMode();
            locationInputEl.value = "";
            return;
        }

        let scenario = 0;
        if (inputUpper === "WOPR" || inputUpper === "WOPR1") scenario = 1;
        if (inputUpper === "WOPR_REALTIME") scenario = 4;

        toggleWarGamesMode(scenario);
        locationInputEl.value = "";
        return;
    }

    if (inputUpper.startsWith("WOPR")) {
        let scenarioId = null;
        if (inputUpper.length > 4) {
            const idPart = inputUpper.substring(4);
            if (!isNaN(parseInt(idPart))) {
                scenarioId = parseInt(idPart);
            }
        }
        toggleWarGamesMode(scenarioId || 1);
        locationInputEl.value = "";
        return;
    }

    showLoading(true);
    clearResults();

    try {
        const coords = await geocodeAddress(locationValue);
        if (!coords) {
            showLoading(false);
            return;
        }

        lastObserverCoords = coords;
        lastObserverTimeZone = await fetchTimeZone(coords.lat(), coords.lng());

        // Add a marker for the observer
        if (observerMarker) {
            observerMarker.setMap(null);
        }
        observerMarker = new google.maps.Marker({
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

        // Run prediction in a Web Worker (only enabled satellites)
        const enabledSats = satellites
            .filter(sat => sat.satrec && sat.enabled)
            .map(sat => ({ name: sat.name, catNr: sat.catNr, line1: sat.line1, line2: sat.line2 }));

        const topPasses = await runPredictionWorker(enabledSats, coords.lat(), coords.lng(), maxOffNadir);
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
                if (status === 'ZERO_RESULTS') {
                    alert("Location not found. Please try a different query.");
                } else {
                    alert('Geocode failed: ' + status);
                }
                resolve(null);
            }
        });
    });
}

/**
 * Runs satellite pass prediction in a background Web Worker.
 * Cancels any in-progress prediction when called again.
 */
function runPredictionWorker(enabledSats, observerLat, observerLng, maxOffNadir) {
    return new Promise((resolve, reject) => {
        if (predictionWorker) {
            predictionWorker.terminate();
            predictionWorker = null;
        }

        predictionWorker = new Worker('prediction-worker.js');
        const requestId = ++predictionRequestId;

        predictionWorker.onmessage = (e) => {
            if (e.data.requestId !== requestId) return;

            const passes = e.data.passes.map(p => ({
                ...p,
                startTime: new Date(p.startTime)
            }));

            resolve(passes);
        };

        predictionWorker.onerror = (err) => {
            console.error('Prediction worker error:', err);
            reject(new Error('Pass prediction failed. Please try again.'));
        };

        predictionWorker.postMessage({
            requestId,
            satellites: enabledSats,
            observerLat,
            observerLng,
            maxOffNadir
        });
    });
}

// --- Weather & Timezone ---

async function fetchWeather(lat, lng, date) {
    const now = new Date();
    const diffDays = (date - now) / (1000 * 60 * 60 * 24);

    if (diffDays > 14 || diffDays < 0) return null;

    try {
        const dateStr = date.toISOString().split('T')[0];
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=cloud_cover&start_date=${dateStr}&end_date=${dateStr}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!data.hourly) return null;

        const targetTime = date.getTime();
        let closestIdx = 0;
        let minDiff = Infinity;

        data.hourly.time.forEach((t, i) => {
            const time = new Date(t + 'Z').getTime();
            const diff = Math.abs(time - targetTime);
            if (diff < minDiff) {
                minDiff = diff;
                closestIdx = i;
            }
        });

        return data.hourly.cloud_cover[closestIdx];
    } catch (e) {
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
        return undefined;
    }
}

// --- Results Display ---

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

    // Fetch all weather data in parallel (#16)
    const weatherPromises = passes.map(pass =>
        fetchWeather(lastObserverCoords.lat(), lastObserverCoords.lng(), pass.startTime)
    );
    const weatherResults = await Promise.all(weatherPromises);

    passes.forEach((pass, index) => {
        const row = document.createElement('tr');

        if (pass.startTime.getTime() - now.getTime() > fourteenDays) {
            hasLongTerm = true;
        }

        const cloudCover = weatherResults[index];
        const cloudText = cloudCover !== null ? `${cloudCover}%` : 'N/A';

        const dateOptions = { timeZone: lastObserverTimeZone };
        const timeOptions = { hour: '2-digit', minute: '2-digit', timeZone: lastObserverTimeZone };

        const dateStr = pass.startTime.toLocaleDateString([], dateOptions);
        const timeStr = pass.startTime.toLocaleTimeString([], timeOptions);
        let timeZoneDisplay = 'Local';
        if (lastObserverTimeZone) {
            const parts = lastObserverTimeZone.split('/');
            timeZoneDisplay = parts[parts.length - 1].replace(/_/g, ' ');
        }

        let qualityClass = 'quality-red';
        if (pass.minOffNadir <= 10) qualityClass = 'quality-green';
        else if (pass.minOffNadir <= 20) qualityClass = 'quality-yellow';

        let sunWarning = '';
        if (pass.sunElevationAtMax < 30) {
            sunWarning = '<span class="warning-icon" title="Poor Sun Angle (< 30°)">⚠️</span>';
        }

        row.innerHTML = `
            <td>${dateStr}</td>
            <td>${timeStr}<br><span class="tz-label">${timeZoneDisplay}</span></td>
            <td>${pass.satName}</td>
            <td class="${qualityClass}">${pass.minOffNadir.toFixed(1)}°</td>
            <td>${pass.sunElevationAtMax.toFixed(0)}° ${sunWarning}</td>
            <td>${cloudText}</td>
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
