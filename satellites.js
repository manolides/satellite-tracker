/**
 * Satellite Tracker - Satellite Data & UI
 * TLE fetching, satellite options panel, and toggle logic.
 */

/**
 * Fetches TLE data from the local 'satellites.json' file.
 * This file is updated automatically by a GitHub Action.
 */
async function fetchTLEs() {
    try {
        const response = await fetch('./satellites.json?v=' + new Date().getTime());
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();

        satellites = data.map(item => {
            const isDefault = item.name.includes("PLEIADES NEO");

            return {
                name: item.name,
                catNr: item.catNr,
                line1: item.line1,
                line2: item.line2,
                enabled: isDefault,
                satrec: satellite.twoline2satrec(item.line1, item.line2),
                marker: null,
                pastPath: null,
                futurePath: null,
                cones: []
            };
        });

        satellites.forEach(sat => {
            if (sat.enabled) {
                createVisuals(sat);
            }
        });

        setupSatelliteOptionsUI();

    } catch (error) {
        console.error("Error loading satellites.json:", error);
    } finally {
        setInterval(updatePositions, 1000);
        updatePositions();
    }
}

function setupSatelliteOptionsUI() {
    const listContainer = document.getElementById('sat-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    // Group satellites by company
    const initialGroups = {};

    satellites.forEach(sat => {
        let groupName = "Other";
        const name = sat.name.toUpperCase();
        if (name.includes("PLEIADES")) groupName = "Airbus";
        else if (name.includes("WORLDVIEW") || name.includes("LEGION")) groupName = "Vantor";
        else if (name.includes("GLOBAL")) groupName = "BlackSky";
        else if (name.includes("KOMPSAT") || name.includes("SPACEEYE")) groupName = "SIIS";
        else if (name.includes("SUPERVIEW")) groupName = "China Siwei";
        else if (name.includes("CARTOSAT") || name.includes("CATROSAT")) groupName = "ISRO";
        else if (name.includes("BEIJING")) groupName = "21AT";
        else if (name.includes("USA-") || name.includes("PERSONA") || name.includes("RESURS") || name.includes("OFEQ") || name.includes("YAOGAN") || name.includes("GAOFEN")) groupName = "Classified";

        if (!initialGroups[groupName]) initialGroups[groupName] = [];
        initialGroups[groupName].push(sat);
    });

    // Consolidate single-satellite companies and SIIS into "Other"
    const groups = { "Other": [] };
    const dynamicOrder = [];

    for (const [gName, gSats] of Object.entries(initialGroups)) {
        if (gName === "SIIS" || gSats.length === 1 || gName === "Other") {
            groups["Other"].push(...gSats);
        } else {
            groups[gName] = gSats;
            dynamicOrder.push(gName);
        }
    }

    const companyOrder = [...dynamicOrder.filter(g => g !== "Classified"), "Other"];
    if (dynamicOrder.includes("Classified")) {
        companyOrder.push("Classified");
    }

    if (groups["Classified"]) {
        const getNationality = (name) => {
            if (name.includes("USA-")) return "US";
            if (name.includes("PERSONA") || name.includes("RESURS")) return "Russia";
            if (name.includes("OFEQ")) return "Israel";
            if (name.includes("YAOGAN") || name.includes("GAOFEN")) return "China";
            return "Unknown";
        };
        groups["Classified"].sort((a, b) => {
            const natA = getNationality(a.name);
            const natB = getNationality(b.name);
            if (natA !== natB) {
                return natA.localeCompare(natB);
            }
            return a.name.localeCompare(b.name);
        });
    }

    // Create "Select All" checkbox
    const selectAllDiv = document.createElement('div');
    selectAllDiv.className = 'sat-item select-all-item';

    const selectAllCheckbox = document.createElement('input');
    selectAllCheckbox.type = 'checkbox';
    selectAllCheckbox.id = 'sat-select-all';
    selectAllCheckbox.checked = satellites.length > 0 && satellites.every(sat => sat.enabled);

    selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        satellites.forEach(sat => {
            if (sat.enabled !== isChecked) {
                const cb = document.getElementById(`sat-${sat.catNr}`);
                if (cb) cb.checked = isChecked;
                toggleSatellite(sat.catNr, isChecked, true);
            }
        });
        document.querySelectorAll('.group-checkbox').forEach(cb => {
            cb.checked = isChecked;
        });
        updatePositions();
    });

    const selectAllLabel = document.createElement('label');
    selectAllLabel.htmlFor = 'sat-select-all';
    selectAllLabel.textContent = 'Select All Satellites';

    selectAllDiv.appendChild(selectAllCheckbox);
    selectAllDiv.appendChild(selectAllLabel);
    listContainer.appendChild(selectAllDiv);

    // Create company group UI
    for (const groupName of companyOrder) {
        const groupSats = groups[groupName];
        if (!groupSats || groupSats.length === 0) continue;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'sat-group';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'sat-group-title';

        const groupCheckbox = document.createElement('input');
        groupCheckbox.type = 'checkbox';
        groupCheckbox.className = 'group-checkbox';
        groupCheckbox.id = `group-${groupName.replace(/\s+/g, '-')}`;
        groupCheckbox.checked = groupSats.every(sat => sat.enabled);

        groupCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            groupSats.forEach(sat => {
                if (sat.enabled !== isChecked) {
                    const cb = document.getElementById(`sat-${sat.catNr}`);
                    if (cb) cb.checked = isChecked;
                    toggleSatellite(sat.catNr, isChecked, true);
                }
            });
            selectAllCheckbox.checked = satellites.every(sat => sat.enabled);
            updatePositions();
        });

        const groupLabel = document.createElement('label');
        groupLabel.htmlFor = groupCheckbox.id;
        groupLabel.textContent = groupName;

        titleDiv.appendChild(groupCheckbox);
        titleDiv.appendChild(groupLabel);
        groupDiv.appendChild(titleDiv);

        groupSats.forEach(sat => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'sat-item sat-item-child';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `sat-${sat.catNr}`;
            checkbox.checked = sat.enabled;

            checkbox.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                toggleSatellite(sat.catNr, isChecked);

                groupCheckbox.checked = groupSats.every(s => s.enabled);
                selectAllCheckbox.checked = satellites.every(s => s.enabled);
            });

            const label = document.createElement('label');
            label.htmlFor = `sat-${sat.catNr}`;
            label.textContent = sat.name;

            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(label);
            groupDiv.appendChild(itemDiv);
        });

        listContainer.appendChild(groupDiv);
    }
}

function toggleSatellite(catNr, enabled, skipUpdate = false) {
    const sat = satellites.find(s => s.catNr === catNr);
    if (!sat) return;

    sat.enabled = enabled;

    if (enabled) {
        sat.needsTrackUpdate = true;
        createVisuals(sat);

        if (sat.marker) sat.marker.setMap(map);
        if (sat.pastPath) sat.pastPath.setMap(map);
        if (sat.futurePath) sat.futurePath.setMap(map);
        sat.cones.forEach(cone => cone.setMap(map));

        if (!skipUpdate) updatePositions();
    } else {
        if (sat.marker) sat.marker.setMap(null);
        if (sat.pastPath) sat.pastPath.setMap(null);
        if (sat.futurePath) sat.futurePath.setMap(null);
        sat.cones.forEach(cone => cone.setMap(null));
    }
}
