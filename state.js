/**
 * Satellite Tracker - Shared State
 * All shared variables used across modules.
 */

var map;
var nightLayer;
var solarAngleLayer;
var snowCoverLayer;
var cloudCoverLayer;
var satellites = [];

// Solar Angle State
var isSolarDateCustom = false;
var customSolarDate = null;

// Update throttle state
var _trackUpdateCounter = -1;
var _lastSolarUpdate = 0;

// Prediction worker state
var predictionWorker = null;
var predictionRequestId = 0;

// Observer state
var observerMarker = null;
var lastObserverCoords = null;
var lastObserverTimeZone = null;

// WarGames state
var isWarGamesMode = false;
var citiesDataLayer = null;
var targetsDataLayer = null;
var zuluInterval = null;
var scenarioManager = null;
var marginalSolarLayer = null;

// Satellite icon
const SATELLITE_SVG = {
    path: "M -1,-1 h 2 v 2 h -2 z M -5,-1 h 4 v 2 h -4 z M 1,-1 h 4 v 2 h -4 z",
    fillColor: "#00F",
    fillOpacity: 1,
    strokeWeight: 1,
    strokeColor: "#FFF",
    scale: 2,
    anchor: { x: 0, y: 0 },
    labelOrigin: { x: 0, y: -20 }
};

// Non-observation satellite icon (Suncatcher)
const SUNCATCHER_SVG = {
    path: "M 0,-2.5 L 2.5,0 L 0,2.5 L -2.5,0 Z M -6.5,-1.2 h 3.5 v 2.4 h -3.5 z M 3,-1.2 h 3.5 v 2.4 h -3.5 z",
    fillColor: "#FFA500",
    fillOpacity: 1,
    strokeWeight: 1.5,
    strokeColor: "#FFD700",
    scale: 2,
    anchor: { x: 0, y: 0 },
    labelOrigin: { x: 0, y: -20 }
};
