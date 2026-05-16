/**
 * Satellite Tracker - Main Entry Point
 * Map initialization, layer setup, and event wiring.
 *
 * Dependencies:
 * - Google Maps JavaScript API
 * - satellite.js (for orbit propagation)
 */

/**
 * Initializes the Google Map and sets up all overlay layers.
 * Called by the Google Maps API callback.
 */
function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 0, lng: 0 },
        zoom: 2,
        mapTypeId: 'hybrid',
        disableDefaultUI: false,
        streetViewControl: false,
        mapTypeControl: false,
        zoomControl: true,
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
        fillColor: '#FF0000',
        fillOpacity: 0.25,
        strokeWeight: 0,
        clickable: false,
        geodesic: false
    });

    // Initialize Snow Cover Layer (NASA GIBS)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    snowCoverLayer = new google.maps.ImageMapType({
        getTileUrl: function (coord, zoom) {
            const range = 1 << zoom;
            if (coord.y < 0 || coord.y >= range) return null;
            const x = (coord.x % range + range) % range;
            return `https://gibs-a.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDSI_Snow_Cover/default/${dateStr}/GoogleMapsCompatible_Level8/${zoom}/${coord.y}/${x}.png`;
        },
        tileSize: new google.maps.Size(256, 256),
        maxZoom: 9,
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
    attributionDiv.id = 'nasa-attribution';
    attributionDiv.className = 'nasa-attribution';
    attributionDiv.innerHTML = 'Data: <a href="https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs" target="_blank">NASA GIBS</a>';
    attributionDiv.style.display = 'none';
    map.controls[google.maps.ControlPosition.BOTTOM_RIGHT].push(attributionDiv);

    function updateAttribution() {
        const snowChecked = document.getElementById('toggleSnow').checked;
        const cloudChecked = document.getElementById('toggleCloud').checked;
        attributionDiv.style.display = (snowChecked || cloudChecked) ? 'block' : 'none';
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

    // Solar Angle Controls
    const toggleSolar = document.getElementById('toggleSolar');
    const solarDateControls = document.getElementById('solar-date-controls');
    const solarDateInput = document.getElementById('solarDateInput');
    const solarDateReset = document.getElementById('solarDateReset');

    if (toggleSolar) {
        const todayStr = new Date().toISOString().split('T')[0];
        if (solarDateInput) solarDateInput.value = todayStr;

        toggleSolar.addEventListener('change', function () {
            if (this.checked) {
                if (isSolarDateCustom && customSolarDate) {
                    updateSolarAngleLayer(customSolarDate);
                } else {
                    solarAngleLayer.setMap(map);
                }
            } else {
                solarAngleLayer.setMap(null);
            }

            const sunLegend = document.getElementById('sun-legend');
            if (sunLegend) {
                sunLegend.style.display = this.checked ? 'block' : 'none';
            }
            if (solarDateControls) {
                solarDateControls.style.display = this.checked ? 'flex' : 'none';
            }

            if (marginalSolarLayer) {
                marginalSolarLayer.setVisible(this.checked);
            }
        });
    }

    if (solarDateInput) {
        solarDateInput.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val) {
                isSolarDateCustom = true;
                customSolarDate = new Date(val + 'T12:00:00Z');
                _lastSolarUpdate = 0; // Force immediate recalculation
                updateSolarAngleLayer(customSolarDate);

                if (solarDateReset) solarDateReset.style.fontWeight = "bold";
            }
        });
    }

    if (solarDateReset) {
        solarDateReset.addEventListener('click', () => {
            isSolarDateCustom = false;
            customSolarDate = null;

            const todayStr = new Date().toISOString().split('T')[0];
            solarDateInput.value = todayStr;

            _lastSolarUpdate = 0; // Force immediate recalculation
            updateSolarAngleLayer(new Date());

            if (solarDateReset) solarDateReset.style.fontWeight = "normal";
        });
    }

    // Satellite Options Panel
    const satOptionsBtn = document.getElementById('satOptionsBtn');
    const satOptionsPanel = document.getElementById('sat-options-panel');
    const closeSatOptions = document.getElementById('closeSatOptions');

    if (satOptionsBtn && satOptionsPanel) {
        satOptionsBtn.addEventListener('click', () => {
            satOptionsPanel.style.display = (satOptionsPanel.style.display === 'block') ? 'none' : 'block';
        });
    }

    if (closeSatOptions && satOptionsPanel) {
        closeSatOptions.addEventListener('click', () => {
            satOptionsPanel.style.display = 'none';
        });
    }

    fetchTLEs();
}
