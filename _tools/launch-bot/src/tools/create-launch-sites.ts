import fs from "fs/promises";
import path from "path";
import { createLaunchSiteFile } from "../updater/launchSiteFileUpdater";
import { LaunchSite } from "../types";

async function main() {
  // Parse optional limit param from command line
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  const dataPath = path.resolve(__dirname, "../../data/launch-sites.json");
  const sitesRaw = await fs.readFile(dataPath, "utf8");
  const sites: Record<string, LaunchSite> = JSON.parse(sitesRaw);

  const launchSitesDir = path.resolve(__dirname, "../../../../_launch_sites");
  const existingFiles = new Set(
    (await fs.readdir(launchSitesDir))
      .filter(f => f.endsWith(".md"))
      .map(f => f.replace(/\.md$/, ""))
  );

  let created = 0;
  for (const [slug, site] of Object.entries(sites)) {
    if (!existingFiles.has(slug)) {
      console.log(`Creating launch site file for: ${slug}`);
      await createLaunchSiteFile(slug, site);
      created++;
      if (limit && created >= limit) {
        console.log(`Limit of ${limit} reached. Stopping.`);
        break;
      }
    } else {
      console.log(`File already exists for: ${slug}`);
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
