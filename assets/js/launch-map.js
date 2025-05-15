const cesiumToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1ZjZmMDcwMC01YjdmLTQwYmUtOGE4NC1iMDU2ZWRkNTMxYWYiLCJpZCI6MzAyODQxLCJpYXQiOjE3NDczMjk1MjZ9.r1pgLb3diqmBbvtT_zOLzyqN19w91SRG5W02DKjIBZU';

/**
 * Get approximate location based on timezone
 */
function getLocationFromTimezone() {
  const date = new Date();
  const timeZoneOffset = date.getTimezoneOffset();
  
  // Calculate approximate longitude based on timezone offset
  const hourOffset = -timeZoneOffset / 60;
  const approximateLongitude = hourOffset * 15;
  
  // Try to guess northern/southern hemisphere
  const month = date.getMonth();
  const isNorthernWinter = month >= 10 || month <= 2;
  const isDST = isDaylightSavingTime(date);
  const likelySouthernHemisphere = (isNorthernWinter && isDST) || (!isNorthernWinter && !isDST);
  
  // Default latitude based on hemisphere
  let approximateLatitude = likelySouthernHemisphere ? -30 : 40;
  
  // Regional adjustments
  if (approximateLongitude > -10 && approximateLongitude < 40) {
    approximateLatitude -= 5; // Europe/Africa
  } else if (approximateLongitude > 60 && approximateLongitude < 150) {
    approximateLatitude = likelySouthernHemisphere ? -25 : 35; // Asia
  } else if (approximateLongitude <= -60 && approximateLongitude >= -130) {
    approximateLatitude = likelySouthernHemisphere ? -30 : 40; // Americas
  } else if (approximateLongitude > 110 && approximateLongitude < 180) {
    approximateLatitude = likelySouthernHemisphere ? -30 : 20; // Australia/Pacific
  }
  
  return {
    longitude: approximateLongitude,
    latitude: approximateLatitude,
    accuracy: "timezone-based estimation"
  };
}

/**
 * Detect if the user's system is currently using Daylight Saving Time
 */
function isDaylightSavingTime(date) {
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  
  const dstObserved = jan.getTimezoneOffset() !== jul.getTimezoneOffset();
  
  if (!dstObserved) {
    return false;
  }
  
  return date.getTimezoneOffset() === Math.min(jan.getTimezoneOffset(), jul.getTimezoneOffset());
}

// Main Cesium initialization and animation sequence
window.onload = async function() {
  // Get approximate user location from timezone
  const userLocation = getLocationFromTimezone();
  console.log("Estimated user location:", userLocation);

  // Initialize Cesium with your token
  Cesium.Ion.defaultAccessToken = cesiumToken;
  
  // Create the Cesium viewer with world terrain
  const viewer = new Cesium.Viewer('map', {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    baseLayerPicker: false, // Hide the default layer picker
    geocoder: false,        // Hide the search tool
    homeButton: false,      // Hide the home button
    timeline: false,        // Hide the timeline
    animation: false,       // Hide animation controls
    navigationHelpButton: false, // Hide help button
    sceneModePicker: false, // Hide scene mode picker
    shouldAnimate: true     // Keep animation running
  });

  // Enable atmosphere and sky features
  viewer.scene.skyAtmosphere.show = true;
  viewer.scene.globe.enableLighting = true;
  viewer.scene.globe.showGroundAtmosphere = true;

  // Add stars and space background
  viewer.scene.skyBox.show = true;
  viewer.scene.sun.show = true;
  viewer.scene.moon.show = true;

  // Add fog similar to your MapLibre implementation
  viewer.scene.fog.enabled = true;
  viewer.scene.fog.density = 0.0002;
  viewer.scene.fog.screenSpaceErrorFactor = 2.0;

  // Start with a view centered on the user's estimated location
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
      userLocation.longitude, 
      userLocation.latitude, 
      50000000
    )
  });
  
  setTimeout(rotateToLaunchSite, 3000);

  // Function to handle globe rotation, then zoom in to the launch site
  function rotateToLaunchSite() {
    // Keep the same high altitude during rotation
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        lon, 
        lat, 
        10000000 // Maintain high altitude during rotation
      ),
      duration: 2, // Shorter duration for each rotation step
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
      complete: () => {
        zoomInToLaunchSite();
      }
    });
  }

  // Zoom in to the launch site from its position in space
  function zoomInToLaunchSite() {
    // Start a bit higher than final position
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, 1000),
      duration: 8,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
    });
  }

  // Optional: Add 3D buildings if the location is in an urban area
  // You can comment this out if you don't need buildings
  // try {
  //   const buildingTileset = await Cesium.createOsmBuildingsAsync();
  //   viewer.scene.primitives.add(buildingTileset);
  // } catch (error) {
  //   console.log("OSM Buildings not available for this location");
  // }
};