/**
 * Satellite Tracker - WarGames Mode
 * All WOPR/WarGames code: styles, targets, scenarios, missiles, and detonations.
 */

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
 * WOPR Mode Initialization
 * 
 * Simulates a Global Thermonuclear War scenario.
 * - Reuses WarGames styling (Crt overlay, map style)
 * - Hides all satellite tracking UI and data
 * - Starts a specific or random scenario
 */


function toggleWarGamesMode(scenarioIdOverride) {
    // isWarGamesMode = !isWarGamesMode; // Removed: We manage state explicitly now.
    isWarGamesMode = true; // Force True when entering via this function.
    const body = document.body;

    if (isWarGamesMode) { // Always true here
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

        // 3. UI Cleanup (Hide Satellite Stuff ONLY if War Scenario)
        if (scenarioIdOverride !== 0) {
            const uiToHide = [
                'prediction-panel',
                'controls',        // The bottom-left toggle controls
                'legends-container'
            ];

            uiToHide.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        }

        // Update Branding
        const branding = document.getElementById('branding');
        if (branding) {
            branding.style.display = 'block';
            branding.innerHTML = '<b>W</b>ar <b>O</b>peration <b>P</b>lan <b>R</b>esponse';
        }

        // Hide Real Satellites (ONLY if War Scenario)
        if (scenarioIdOverride !== 0) {
            satellites.forEach(sat => {
                if (sat.marker) sat.marker.setMap(null);
                if (sat.pastPath) sat.pastPath.setMap(null);
                if (sat.futurePath) sat.futurePath.setMap(null);
                if (sat.cones) sat.cones.forEach(cone => cone.setMap(null));
            });
        }

        // Hide Layers
        if (snowCoverLayer && map.overlayMapTypes) {
            map.overlayMapTypes.forEach((layer, index) => {
                if (layer === snowCoverLayer || layer === cloudCoverLayer) {
                    map.overlayMapTypes.removeAt(index);
                }
            });
        }
        if (solarAngleLayer) solarAngleLayer.setMap(null);
        if (marginalSolarLayer) marginalSolarLayer.setMap(null);

        // Ensure Night Layer covers WOPR needs (maybe adjustable later)
        if (nightLayer) {
            // User requested NO terminator in WOPR mode
            nightLayer.setMap(null);
        }

        // 4. Start Scenario
        // If 0, it means STYLE ONLY (JOSHUA mode).
        if (scenarioIdOverride === 0) {
            // Ensure no scenario is running if we switch modes? 
            // Currently toggleWarGamesMode resets everything implicitly by UI state, 
            // but if ScenarioManager exists we should stop it.
            if (scenarioManager) scenarioManager.stop();
            return;
        }

        // If no ID provided (and not 0), pick random (Legacy behavior or default)
        const totalScenarios = 3;
        let scenarioId = scenarioIdOverride;
        if (!scenarioId) {
            scenarioId = Math.floor(Math.random() * totalScenarios) + 1;
        }

        // Start Zulu Clock
        startZuluClock();

        // Init Scenario Manager
        if (!scenarioManager) {
            scenarioManager = new ScenarioManager(map);
        }
        scenarioManager.start(scenarioId);
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
        updateDefcon(1); // Reset

        // Get user location for the finale
        if (lastObserverCoords) {
            this.userLocation = { lat: lastObserverCoords.lat(), lng: lastObserverCoords.lng() };
        } else {
            this.userLocation = await this.fetchUserLocation();
        }

        if (id === 1) this.runScenario1(false);
        else if (id === 4) this.runScenario1(true); // Realistic
        // Scenarios 2 and 3 not yet implemented
    }

    // Helper: Calculate realistic duration in ms
    calculateFlightDuration(origin, target, speedMph) {
        const R = 6371e3; // Earth radius (m)
        const d = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(origin),
            new google.maps.LatLng(target)
        );
        // Speed: mph -> m/ms
        // 1 mph = 0.44704 m/s = 0.00044704 m/ms
        const speedM_ms = speedMph * 0.44704 / 1000;
        return d / speedM_ms;
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
    attemptIntercept(incomingMissile, defender, gbiSpeedMph = 17000, leadTimeMs = 2000) {
        // Check Limits
        if (!this.gbiCounts) this.gbiCounts = { 'US': 10, 'RU': 10, 'EU': 5, 'JP': 5 };
        if (this.gbiCounts[defender] <= 0) return; // Out of ammo

        // Decrement
        this.gbiCounts[defender]--;

        // 35% chance of success (Simulation)
        const isSuccess = Math.random() < 0.35;

        // Standard "Fast Mode" Intercept Logic
        const interceptRatio = 0.5; // Intercept at 50% of flight path

        // Calculate coordinate
        const interceptPos = google.maps.geometry.spherical.interpolate(
            new google.maps.LatLng(incomingMissile.origin),
            new google.maps.LatLng(incomingMissile.target),
            interceptRatio
        );

        // Detection Logic (Delay launch)
        const detectionTime = leadTimeMs; // Use parameter if passed, else 2000

        setTimeout(() => {
            if (!this.isRunning || incomingMissile.destroyed) return;
            // Travel time for interceptor logic...
            // (Old logic retained for fast mode, simplified for brevity here as it wasn't the request focus but need to keep it working)
            // Pick Launch Site
            let sites = [];
            if (defender === 'US') sites = [{ lat: 63.9, lng: -145.7 }, { lat: 34.7, lng: -120.6 }, { lat: 43.9, lng: -75.6 }];
            else if (defender === 'RU') sites = [{ lat: 55.7, lng: 37.6 }, { lat: 46.0, lng: 73.0 }, { lat: 53.0, lng: 158.0 }];
            else if (defender === 'EU') sites = [{ lat: 54.3, lng: -0.6 }, { lat: 44.0, lng: 24.3 }];
            else if (defender === 'JP') sites = [{ lat: 40.9, lng: 140.3 }, { lat: 35.7, lng: 135.2 }];

            let bestSite = sites[0];
            let minDist = Infinity;
            const iPosLat = interceptPos.lat();
            const iPosLng = interceptPos.lng();
            sites.forEach(site => {
                const d = Math.abs(site.lat - iPosLat) + Math.abs(site.lng - iPosLng);
                if (d < minDist) { minDist = d; bestSite = site; }
            });

            const impactTime = incomingMissile.startTime + (incomingMissile.duration * interceptRatio);
            const timeToImpact = impactTime - performance.now();
            const interceptorDuration = timeToImpact;

            if (interceptorDuration < 1000) return;

            const interceptor = this.launchMissile(bestSite, interceptPos, '#FFFFFF', interceptorDuration, false);
            setTimeout(() => {
                if (!this.isRunning) return;
                interceptor.destroy();
                this.detonate(interceptPos, 150000, '#FFFFFF');
                if (isSuccess) incomingMissile.destroy();
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

    launchMissile(origin, target, color, duration, detonateOnImpact = true) {
        const missile = new Missile(this.map, origin, target, color, duration);
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
        document.body.classList.remove('screen-flutter'); // Ensure flutter doesn't block shutter
        void document.body.offsetWidth; // Force reflow
        document.body.classList.add('shutter-effect');
        setTimeout(() => {
            const overlay = document.getElementById('game-over-overlay');
            if (overlay) overlay.style.display = 'flex';
        }, 2500); // 2.5s delay (User requested "couple seconds")
    }

    // --- SCENARIO 1: HOUSE OF DYNAMITE (GLOBAL WAR) ---
    runScenario1(isRealtime = false) {
        // Configuration
        const ICBM_SPEED = 15000; // mph
        const GBI_SPEED = ICBM_SPEED * 1.2; // 120% of ICBM Speed

        const timeScale = isRealtime ? 60 : 1; // 1 second fast = 1 minute real

        // Helper to get consistent physics duration or fallback
        const getDuration = (origin, target, defaultDur) => {
            if (isRealtime) return this.calculateFlightDuration(origin, target, ICBM_SPEED);
            return defaultDur;
        };

        // Reset GBIs (Increased counts)
        this.gbiCounts = { 'US': 15, 'RU': 15, 'EU': 7, 'JP': 5 };

        // Helper wrapper for launch
        const launch = (org, tgt, col, defDur, impact) => {
            const dur = getDuration(org, tgt, defDur);
            return this.launchMissile(org, tgt, col, dur, impact);
        };

        // --- COORDINATES ---
        const ARCTIC = { lat: 80, lng: -90 };
        const CHICAGO = { lat: 41.8781, lng: -87.6298 };
        const FT_GREELY = { lat: 63.9, lng: -145.7 };
        const PACIFIC_UNKNOWN = { lat: 50, lng: 170 }; // Unknown Pacific Origin (arcs over Alaska)

        // LAUNCH SITES
        const SILO_BELT = [{ lat: 47.5, lng: -111.0 }, { lat: 48.0, lng: -101.0 }, { lat: 41.0, lng: -104.0 }];
        const US_ATLANTIC_SUBS = [{ lat: 46.57, lng: -32.84 }];
        const US_PACIFIC_SUBS = [{ lat: 12.30, lng: 135.48 }, { lat: 29.48, lng: 139.65 }];
        const RU_LAUNCH = [{ lat: 51.09, lng: 59.83 }, { lat: 62.92, lng: 40.57 }]; // Dombarovsky, Plesetsk
        const RU_SUBS = [{ lat: 69.25, lng: 33.32 }, { lat: 52.92, lng: 158.42 }]; // Gadzhiyevo, Rybachiy (Generic)
        const RU_ATLANTIC_FLEET = [{ lat: 25.85, lng: -64.45 }, { lat: 36.91, lng: -49.86 }];
        const RU_PACIFIC_FLEET = [{ lat: 50.45, lng: -144.01 }, { lat: 19.93, lng: -129.00 }];
        const CN_LAUNCH = [{ lat: 34.7, lng: 112.0 }, { lat: 26.5, lng: 104.0 }]; // DF-41 Fields (Rough)
        const EU_LAUNCH = [{ lat: 48.30, lng: -4.50 }, { lat: 56.06, lng: -4.82 }]; // Ile Longue, Faslane

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


        // --- TIMING LOGIC ---
        // Fast Mode: Fixed sequence (T+5s, T+8s, etc).

        this.updateDefcon(5);

        // --- PHASE 1: THE TRIGGER (Arctic -> Chicago) ---
        const t1_delay = 5000 * timeScale; // T+5s
        let p1_flightDur = 0;

        // Define Lead Times
        const LEAD_US = 2000;
        const LEAD_RU = 2000;
        const LEAD_ALLIES = 2000;

        this.schedule(t1_delay, () => {
            try {
                this.updateDefcon(3);
                // Launch Nuke (Pacific -> Chicago)
                p1_flightDur = getDuration(PACIFIC_UNKNOWN, CHICAGO, 15000);
                const m = this.launchMissile(PACIFIC_UNKNOWN, CHICAGO, '#FF0000', p1_flightDur, true);

                // SCRIPTED DEFENSE: 2 GBIs from Alaska (Ft Greely) that FAIL.
                const interceptPoint = google.maps.geometry.spherical.interpolate(
                    new google.maps.LatLng(PACIFIC_UNKNOWN),
                    new google.maps.LatLng(CHICAGO),
                    0.5 // Mid-course intercept
                );

                const targetPos = google.maps.geometry.spherical.interpolate(
                    new google.maps.LatLng(PACIFIC_UNKNOWN),
                    new google.maps.LatLng(CHICAGO),
                    0.8 // Intercept late
                );

                // FIX: Calculate generic fast duration
                let gbiDur = getDuration(FT_GREELY, targetPos, 4000);

                const launchDelay = (p1_flightDur * 0.5);
                // We fire exactly when missile is at 50% (7.5s in Fast Mode).
                // GBI takes 4s.
                // It arrives at T+11.5s. Missile impact at T+15s.
                // It will chase and "miss" (fail script).

                const fireFailedGBI = (delayMs) => {
                    setTimeout(() => {
                        // Fire GBI
                        const gbi = this.launchMissile(FT_GREELY, targetPos, '#FFFFFF', gbiDur, false);

                        // Detonate harmlessly
                        setTimeout(() => {
                            gbi.destroy();
                            this.detonate(targetPos, 150000, '#FFFFFF'); // Whiff
                        }, gbiDur);

                    }, delayMs);
                };

                // Fire 2 GBIs
                // Timing: When nuke is 50% there.
                const triggerTime = p1_flightDur * 0.5;
                fireFailedGBI(triggerTime);
                fireFailedGBI(triggerTime + 500); // 2nd one shortly after

            } catch (e) { console.error("Phase 1 Crash:", e); }
        });

        // Determine P1 impact time for scheduling subsequent events
        const dummyP1Dur = 15000;
        const t1_impact = t1_delay + dummyP1Dur;

        // --- PHASE 3: US RETALIATION ---
        // "US launches 1 minute before impact" (of Phase 1)
        const t3_launch = 18000 * timeScale;

        this.schedule(t3_launch, () => {
            try {
                this.updateDefcon(1);
                const targets = US_FIRST_STRIKE_TARGETS;
                const lead = 2000;

                targets.forEach((target, i) => {
                    const origin = SILO_BELT[i % SILO_BELT.length];
                    setTimeout(() => {
                        const m = launch(origin, target, '#0088FF', 10000 + Math.random() * 2000, true);
                        this.attemptIntercept(m, 'RU', GBI_SPEED, lead);
                    }, Math.random() * 5000 * timeScale);
                });
            } catch (e) { console.error("Phase 3 Crash:", e); }
        });

        // --- PHASE 4: RUSSIA LAUNCH ---
        // Mainland: 10 mins later (than US Launch)
        // Subs: 5 mins later (than US Launch)
        const t4a_subs = 25000 * timeScale;
        const t4b_main = 30000 * timeScale; // Staggered in fast mode

        const ru_lead = 2000;
        const eu_lead = 2000;

        // Subs Launch
        this.schedule(t4a_subs, () => {
            try {
                const targets = [...RUSSIA_LAUNCH_TARGETS];
                // Simplified: Just assigning subs to handle East/West mix
                // In Fast mode, we filtered West/East.
                // Here, let's just launch fleet lists.
                const fleetTargetsW = targets.slice(0, 6);
                const fleetTargetsE = targets.slice(6, 12);

                // Helper to launch list
                const fire = (tgts, origins) => {
                    tgts.forEach((t, i) => {
                        setTimeout(() => {
                            const m = launch(origins[i % origins.length], t, '#FF0000', 15000, true);
                            this.attemptIntercept(m, 'US', GBI_SPEED, ru_lead);
                        }, Math.random() * 8000 * timeScale);
                    });
                };

                fire(fleetTargetsW, RU_PACIFIC_FLEET);
                fire(fleetTargetsE, RU_ATLANTIC_FLEET);
            } catch (e) { console.error("Phase 4a Crash:", e); }
        });

        // Mainland Launch
        this.schedule(t4b_main, () => {
            try {
                const targets = RUSSIA_LAUNCH_TARGETS.slice(12); // Rest
                targets.forEach((t, i) => {
                    setTimeout(() => {
                        const m = launch(RU_LAUNCH[i % RU_LAUNCH.length], t, '#FF0000', 15000, true);

                        let def = 'US';
                        let lead = ru_lead;
                        if (t.lng > -30 && t.lng < 40) { def = 'EU'; lead = eu_lead; }

                        this.attemptIntercept(m, def, GBI_SPEED, lead);
                    }, Math.random() * 10000 * timeScale);
                });
            } catch (e) { console.error("Phase 4b Crash:", e); }
        });

        // --- PHASE 6: CHINA ---
        // "China launches 10 minutes later" (Assuming after RU Mainland)
        const t6_cn = 32000 * timeScale;

        this.schedule(t6_cn, () => {
            const targets = CN_PACIFIC_TARGETS;
            targets.forEach((t, i) => {
                setTimeout(() => {
                    const m = launch(CN_LAUNCH[i % 2], t, '#FF9900', 12000, true);
                    let def = 'US';
                    let lead = ru_lead;
                    if (t.lat > 30 && t.lng > 120 && t.lng < 150) { def = 'JP'; lead = 2000; }
                    this.attemptIntercept(m, def, GBI_SPEED, lead);
                }, Math.random() * 8000 * timeScale);
            });
        });

        // Phase 8: Regional Conflicts
        const t8_pk = 40000 * timeScale;
        this.schedule(t8_pk, () => {
            REGIONAL_TARGETS.INDIA.forEach((t) => {
                setTimeout(() => launch(PAKISTAN_LAUNCH[0], t, '#00FF00', 5000, true), Math.random() * 5000 * timeScale);
            });

            // Israel/Iran
            REGIONAL_TARGETS.IRAN.forEach((t) => {
                setTimeout(() => launch(ISRAEL_LAUNCH[0], t, '#0088FF', 5000, true), Math.random() * 5000 * timeScale);
            });
            REGIONAL_TARGETS.ISRAEL.forEach((t) => {
                for (let i = 0; i < 3; i++) { // Reduce spam
                    setTimeout(() => {
                        const origin = IRAN_LAUNCH[0];
                        const target = t; // Targeting Israel!
                        launch(origin, target, '#CC00FF', 5000, true);
                    }, Math.random() * 5000 * timeScale);
                }
            });
        });

        // Finale: Last Shot (T+48s)
        this.schedule(48000 * timeScale, () => { // +5 mins after China's launch
            // this.activeMissiles.forEach(m => m.remove()); // Don't clear missiles, keep chaos visible
            // Keep detonations (scars) on screen

            const origin = { lat: 88, lng: 0 };
            const dur = getDuration(origin, this.userLocation, 6000);
            const ms = this.launchMissile(origin, this.userLocation, '#FFFFFF', dur, false);
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

            const delay = dur;

            setTimeout(() => {
                this.detonate(this.userLocation, 2000000, '#FFFFFF');
                setTimeout(() => this.triggerGameOver(), 500);
            }, delay);
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

function exitWarGamesMode() {
    if (!isWarGamesMode) return;
    isWarGamesMode = false;

    // Stop Scenario
    if (scenarioManager) scenarioManager.stop();

    // Reset Map Style
    if (map) {
        map.setOptions({
            styles: null // Revert to default
        });
        map.setMapTypeId('hybrid'); // Return to Hybrid (Sat+Labels)
    }

    // Show UI
    const uiToShow = [
        'prediction-panel',
        'controls',
        'legends-container'
    ];
    uiToShow.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'block';
    });

    // Clear Branding
    const branding = document.getElementById('branding');
    if (branding) branding.style.display = 'none';

    // Show Satellites (Restore Map)
    if (satellites) {
        satellites.forEach(sat => {
            if (sat.marker) sat.marker.setMap(map);
            if (sat.pastPath) sat.pastPath.setMap(map);
            if (sat.futurePath) sat.futurePath.setMap(map);
            if (sat.cones) sat.cones.forEach(cone => cone.setMap(map));
        });
    }

    // Restore Layers
    if (nightLayer) nightLayer.setMap(map);

    // CLEANUP WOPR LAYERS
    try {
        if (typeof citiesDataLayer !== 'undefined' && citiesDataLayer) {
            citiesDataLayer.setMap(null);
        }
        if (typeof targetsDataLayer !== 'undefined' && targetsDataLayer) {
            targetsDataLayer.setMap(null);
        }
    } catch (e) { console.warn("Cleanup WOPR layers warning", e); }

    // Cleanup Coastlines (map.data)
    if (map && map.data) {
        // Safe Removal
        const featuresToRemove = [];
        map.data.forEach(function (feature) {
            featuresToRemove.push(feature);
        });
        featuresToRemove.forEach(function (feature) {
            map.data.remove(feature);
        });

        // Reset Style to Default
        map.data.setStyle(null);
    }

    // Restore Layers (Snow, Cloud, Solar)
    if (map.overlayMapTypes) {
        if (snowCoverLayer) map.overlayMapTypes.push(snowCoverLayer);
        if (cloudCoverLayer) map.overlayMapTypes.push(cloudCoverLayer);
    }
    if (solarAngleLayer) solarAngleLayer.setMap(map);
    if (marginalSolarLayer) marginalSolarLayer.setMap(map);
    if (nightLayer) nightLayer.setMap(map);

    const body = document.body;
    body.classList.remove('wopr-mode');

}
