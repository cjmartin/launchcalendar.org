// normalizeLaunchData.ts
// Normalizes the vehicle and location fields in LaunchData using matchers.

import { LaunchData, LaunchVideo } from '../types';
import { loadVehicleTable, matchVehicle } from '../matcher/launchVehicleMatcher';
import { loadSiteTable, matchSite } from '../matcher/launchSiteMatcher';
import path from 'path';
import { normalizeLaunchVideo } from './normalizeLaunchVideo';

/**
 * Normalizes the vehicle and location fields in LaunchData to canonical values if a confident match is found.
 * Adds vehicle_slug and location_slug if matched.
 */
export async function normalizeLaunchData(launch: LaunchData): Promise<LaunchData> {
  // Copy the launch data to avoid mutating the original object
  const normalized = { ...launch };

  // Load alias tables
  const vehicleTable = await loadVehicleTable();
  const siteTable = await loadSiteTable();

  // Normalize vehicle
  if (launch.vehicle && !launch.vehicle_slug) {
    const vehicleMatch = matchVehicle(launch.vehicle, vehicleTable);
    if (vehicleMatch.verdict === 'match' && vehicleMatch.id) {
      normalized['vehicle_slug'] = vehicleMatch.id;
    }
  }

  // Normalize location
  if (launch.location && !launch.location_slug) {
    const siteMatch = await matchSite(launch, siteTable);
    if (siteMatch.verdict === 'match' && siteMatch.id) {
      normalized['location_slug'] = siteMatch.id;
    }
  }

  // Normalize youtube link data
  if (launch.videos) {
    normalized.videos = launch.videos.map(video => normalizeLaunchVideo(video));
  }

  return normalized;
}