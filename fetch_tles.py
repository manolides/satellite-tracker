import urllib.request
import json
import os

# Configuration
SATELLITE_IDS = ["48268", "49070"]
BASE_URL = "https://celestrak.org/NORAD/elements/gp.php"
OUTPUT_FILE = "satellites.json"

import ssl

def fetch_tles():
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
                        "name": lines[0],
                        "line1": lines[1],
                        "line2": lines[2],
                        "catNr": int(sat_id)
                    }
                    all_satellites.append(sat_data)
                else:
                    print(f"Error: Invalid TLE data for {sat_id}")
                
        except Exception as e:
            print(f"Error fetching {sat_id}: {e}")

    # Save to file
    try:
        with open(OUTPUT_FILE, "w") as f:
            json.dump(all_satellites, f, indent=2)
        print(f"Successfully saved {len(all_satellites)} satellites to {OUTPUT_FILE}")
    except Exception as e:
        print(f"Error saving file: {e}")


if __name__ == "__main__":
    fetch_tles()
