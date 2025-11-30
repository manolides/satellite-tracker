# Satellite Tracker

A real-time satellite tracking application visualizing the Airbus Pleiades Neo constellation on Google Maps.

## Features

### 🌍 Real-Time Tracking
-   **Live Positions**: Visualizes PLEIADES NEO 3 & 4 in real-time.
-   **Orbit Paths**: Shows past (yellow) and future (green) ground tracks.
-   **Footprint Visualization**: Displays the satellite's potential field of view on the ground.
-   **Day/Night Cycle**: Accurate real-time visualization of the day/night terminator.

### 🔭 Pass Prediction
-   **Location-Based**: Predicts upcoming passes for any city or address.
-   **Smart Filtering**:
    -   **Daylight Only**: Filters out passes where the satellite is in darkness.
    -   **Off-Nadir Angle**: Customizable max off-nadir angle (10°-50°).
-   **Cloud Cover Forecast**: Integrates with Open-Meteo to show predicted cloud cover for upcoming passes.
-   **Reliability Warning**: Flags predictions > 14 days out as estimates.

### ☀️ Solar Angle Analysis
-   **Poor Sun Angle Layer**: Visualizes regions where image quality would be degraded due to low sun elevation.
    -   **Red Zone**: Sun is **Always below 30°** (even at noon).
    -   **Yellow Zone**: Sun is **Sometimes above 30°** (e.g., at noon, but not at 10:30 AM).

### ❄️ Environmental Layers
-   **Snow Cover**: Daily updated snow cover layer from NASA GIBS.
-   **Cloud Cover**: Daily updated true-color cloud imagery from NASA GIBS.

## Setup

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/manolides/satellite-tracker.git
    ```
2.  **Run locally**:
    ```bash
    python3 -m http.server 8080
    ```
3.  **Open in Browser**:
    Navigate to `http://localhost:8080`.

## Architecture

-   **Frontend**: HTML5, CSS3, Vanilla JavaScript.
-   **Mapping**: Google Maps JavaScript API.
-   **Math/Physics**: `satellite.js` for SGP4 orbit propagation.
-   **Data**:
    -   **TLEs**: Fetched from CelesTrak (via Python script).
    -   **Weather**: Open-Meteo API.
    -   **Layers**: NASA GIBS (Global Imagery Browse Services).

## Automation

-   **GitHub Actions**: Automatically fetches fresh TLE data every 12 hours to ensure prediction accuracy.

