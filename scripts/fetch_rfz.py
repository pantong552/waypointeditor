import requests
import json
import os

# Configuration
RFZ_PROXY_URL = "https://map.dronemap.dev/rfz-proxy.php"
OUTPUT_FILE = "rfz.geojson"

def fetch_and_convert_rfz():
    print(f"Fetching data from {RFZ_PROXY_URL}...")
    try:
        response = requests.get(RFZ_PROXY_URL, headers={
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                          'AppleWebKit/537.36 (KHTML, like Gecko) '
                          'Chrome/120.0.0.0 Safari/537.36'
        })
        response.raise_for_status()
        data = response.json()
        
        if data.get("resultCode") != 0:
            print(f"Error: API returned result code {data.get('resultCode')}")
            return

        rfz_features_raw = data.get("data", {}).get("rfzFeatures", [])
        
        all_features = []
        
        print("Processing features...")
        for feature_str in rfz_features_raw:
            try:
                # Each item in the array is a JSON string representing a FeatureCollection 
                # or Feature, but looking at the example, it seems to be FeatureCollections.
                # Example data showed: "{\"type\":\"FeatureCollection\",\"features\":[...]}"
                feature_collection = json.loads(feature_str)
                
                if feature_collection.get("type") == "FeatureCollection":
                    features = feature_collection.get("features", [])
                    all_features.extend(features)
                elif feature_collection.get("type") == "Feature":
                    all_features.append(feature_collection)
                else:
                    print(f"Warning: Unknown type {feature_collection.get('type')}")
                    
            except json.JSONDecodeError as e:
                print(f"Error decoding JSON string: {e}")
                continue

        # Create final GeoJSON FeatureCollection
        final_geojson = {
            "type": "FeatureCollection",
            "features": all_features
        }
        
        # Determine output path relative to script execution or fixed location
        # Assuming script is run from project root, check if 'scripts' dir exists or we are in it
        # We want to output to the project root or a specific data dir. 
        # Let's output to project root for simplicity as per plan.
        output_path = os.path.join(os.getcwd(), OUTPUT_FILE)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(final_geojson, f, ensure_ascii=False)
            
        print(f"Successfully created {output_path} with {len(all_features)} features.")

    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    fetch_and_convert_rfz()
