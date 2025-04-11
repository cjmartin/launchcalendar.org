import os
import yaml
from slugify import slugify

def generate_launch_sites():
    # Determine the project root directory (parent of _tools)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.abspath(os.path.join(script_dir, "../.."))

    # Define directories
    posts_dir = os.path.join(project_dir, "_posts")
    launch_sites_dir = os.path.join(project_dir, "_launch_sites")

    # Ensure the _launch_sites directory exists
    os.makedirs(launch_sites_dir, exist_ok=True)

    # Scan the _posts directory
    for filename in os.listdir(posts_dir):
        if filename.endswith(".md"):
            filepath = os.path.join(posts_dir, filename)
            with open(filepath, "r") as file:
                # Read the front matter
                content = file.read()
                if content.startswith("---"):
                    front_matter, _ = content.split("---", 2)[1:]
                    data = yaml.safe_load(front_matter)

                    # Check if location, geo-lat, and geo-lon exist
                    location = data.get("location")
                    geo_lat = data.get("geo-lat")
                    geo_lon = data.get("geo-lon")

                    if location and geo_lat and geo_lon:
                        # Generate slug for the location
                        slug = slugify(location)
                        launch_site_filepath = os.path.join(launch_sites_dir, f"{slug}.md")

                        # Check if the file already exists
                        if not os.path.exists(launch_site_filepath):
                            # Write the new launch site file
                            with open(launch_site_filepath, "w") as launch_site_file:
                                launch_site_file.write(f"""---
title: {location}
geo-lat: {geo_lat}
geo-lon: {geo_lon}
---""")
                            print(f"Created: {launch_site_filepath}")
                        else:
                            print(f"Skipped (already exists): {launch_site_filepath}")

if __name__ == "__main__":
    generate_launch_sites()