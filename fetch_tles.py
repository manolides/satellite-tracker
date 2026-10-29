from datetime import datetime
import json
import math
import os
import ssl
import urllib.request

# Configuration
SATELLITE_IDS = [
    "48268", "49070",  # Pleiades Neo 3, 4
    "100902",          # Suncatcher (Google Project Suncatcher-M1)
    "40115",           # WorldView-3
    "59625", "59626", "60452", "60453", "62900", "62901", # WorldView Legion 1-6
    "52320", "52322", "63125", "63126", # SuperView Neo-1 01-04
    "66820",           # Kompsat-7
    "63229",           # SpaceEye-T
    "53587",           # Beijing-3N
    "44804",           # CatroSat-3
    "54880",           # EROS-C3
    "63027", "64231", "66554", "68098"  # Global 31-34
]
NAME_OVERRIDES = {
    "100902": "Suncatcher"
}
BASE_URL = "https://celestrak.org/NORAD/elements/gp.php"
OUTPUT_FILE = "satellites.json"


def to_alpha5(cat_nr):
    """Converts a 6-digit NORAD catalog number to Alpha-5 format."""
    if cat_nr < 100000:
        return f"{cat_nr:05d}"
    alphabet = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    prefix = alphabet[cat_nr // 10000]
    return f"{prefix}{cat_nr % 10000:04d}"


def format_exp(val):
    """Formats a floating-point value into TLE assumed-decimal exponential notation."""
    if val == 0:
        return " 00000-0"
    sign = "-" if val < 0 else " "
    val = abs(val)
    exp = int(math.floor(math.log10(val))) + 1
    mantissa = int(round(val / (10 ** exp) * 100000))
    if mantissa == 100000:
        mantissa = 10000
        exp += 1
    exp_sign = "-" if exp < 0 else "+"
    return f"{sign}{mantissa:05d}{exp_sign}{abs(exp):1d}"


def tle_checksum(line_without_checksum):
    """Calculates the modulo-10 checksum for a TLE line."""
    total = 0
    for ch in line_without_checksum:
        if ch.isdigit():
            total += int(ch)
        elif ch == "-":
            total += 1
    return str(total % 10)


def omm_to_tle(omm):
    """Converts a CelesTrak OMM JSON record into a (name, line1, line2) TLE tuple."""
    cat_nr = int(omm["NORAD_CAT_ID"])
    sat_str = to_alpha5(cat_nr)
    classification = omm.get("CLASSIFICATION_TYPE", "U")
    obj_id = omm["OBJECT_ID"]
    parts = obj_id.split("-")
    int_desig = f"{parts[0][-2:]}{parts[1]:<6s}"[:8]

    dt = datetime.fromisoformat(omm["EPOCH"])
    year_short = dt.year % 100
    doy = dt.timetuple().tm_yday
    frac_day = (dt.hour * 3600 + dt.minute * 60 + dt.second + dt.microsecond / 1e6) / 86400.0
    epoch_str = f"{year_short:02d}{doy + frac_day:012.8f}"

    ndot = float(omm["MEAN_MOTION_DOT"])
    ndot_sign = "-" if ndot < 0 else " "
    ndot_str = f"{ndot_sign}{f'{abs(ndot):.8f}'[1:]}"

    nddot_str = format_exp(float(omm["MEAN_MOTION_DDOT"]))
    bstar_str = format_exp(float(omm["BSTAR"]))
    ephem_type = int(omm.get("EPHEMERIS_TYPE", 0))
    elset_no = int(omm.get("ELEMENT_SET_NO", 999))

    l1_body = f"1 {sat_str}{classification} {int_desig} {epoch_str} {ndot_str} {nddot_str} {bstar_str} {ephem_type} {elset_no:4d}"
    line1 = l1_body + tle_checksum(l1_body)

    inc = float(omm["INCLINATION"])
    raan = float(omm["RA_OF_ASC_NODE"])
    ecc = int(round(float(omm["ECCENTRICITY"]) * 1e7))
    argp = float(omm["ARG_OF_PERICENTER"])
    ma = float(omm["MEAN_ANOMALY"])
    mm = float(omm["MEAN_MOTION"])
    rev = int(omm.get("REV_AT_EPOCH", 0))

    l2_body = f"2 {sat_str} {inc:8.4f} {raan:8.4f} {ecc:07d} {argp:8.4f} {ma:8.4f} {mm:11.8f}{rev:5d}"
    line2 = l2_body + tle_checksum(l2_body)

    return omm.get("OBJECT_NAME", sat_str).strip(), line1, line2

"""
Satellite Data Fetcher

This script is responsible for keeping the satellite orbital data (TLEs) up to date.
It runs as part of a GitHub Action workflow (or manually) to:
1. Connect to CelesTrak's API.
2. Download the latest Two-Line Elements (TLE) for specific satellites.
3. Parse the raw text format into a structured JSON object.
4. Save the result to 'satellites.json' for the frontend to consume.

This "Backend-for-Frontend" approach avoids CORS issues and API rate limits
by serving static JSON files to the client.
"""

def fetch_tles():
    """
    Fetches TLE data for configured satellites and saves to JSON.
    Includes SSL context bypass to handle potential certificate issues in some environments.
    """
    all_satellites = []
    
    # Create an unverified SSL context
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    for sat_id in SATELLITE_IDS:
        # Fetch TLE format (text)
        url = f"{BASE_URL}?CATNR={sat_id}&FORMAT=TLE"
        print(f"Fetching TLE for {sat_id} from {url}...")
        
        try:
            with urllib.request.urlopen(url, context=ctx) as response:
                if response.status != 200:
                    print(f"Error fetching {sat_id}: Status {response.status}")
                    continue

                data = response.read().decode('utf-8')
                lines = [line.strip() for line in data.split('\n') if line.strip()]
                
                if len(lines) >= 3:
                    # Standard TLE has 3 lines: Name, Line 1, Line 2
                    sat_data = {
                        "name": NAME_OVERRIDES.get(sat_id, lines[0]),
                        "line1": lines[1],
                        "line2": lines[2],
                        "catNr": int(sat_id)
                    }
                    all_satellites.append(sat_data)
                else:
                    # Fallback to JSON format (required by CelesTrak for 6-digit NORAD IDs >= 100000)
                    json_url = f"{BASE_URL}?CATNR={sat_id}&FORMAT=json"
                    print(f"Fetching JSON GP for {sat_id} from {json_url}...")
                    with urllib.request.urlopen(json_url, context=ctx) as json_resp:
                        omm_list = json.loads(json_resp.read().decode('utf-8'))
                        if isinstance(omm_list, list) and len(omm_list) > 0:
                            name, line1, line2 = omm_to_tle(omm_list[0])
                            all_satellites.append({
                                "name": NAME_OVERRIDES.get(sat_id, name),
                                "line1": line1,
                                "line2": line2,
                                "catNr": int(sat_id)
                            })
                        else:
                            print(f"Error: Invalid TLE/GP data for {sat_id}")
                
        except Exception as e:
            print(f"Error fetching {sat_id}: {e}")

    # Load classified satellites
    try:
        if os.path.exists('classified_tles.json'):
            with open('classified_tles.json', 'r') as f:
                classified = json.load(f)
                all_satellites.extend(classified)
                print(f"Added {len(classified)} classified satellites from local file.")
    except Exception as e:
        print(f"Error loading classified TLEs: {e}")

    # Save to file
    try:
        with open(OUTPUT_FILE, "w") as f:
            json.dump(all_satellites, f, indent=2)
        print(f"Successfully saved {len(all_satellites)} satellites to {OUTPUT_FILE}")
    except Exception as e:
        print(f"Error saving file: {e}")


if __name__ == "__main__":
    fetch_tles()
