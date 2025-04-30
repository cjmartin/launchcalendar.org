import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { LaunchSite } from "../types";
import { callOpenAI } from "../utils/openai";

/**
 * Creates a new launch site markdown file in _launch_sites/ using the provided slug and LaunchSite data.
 * @param newSiteSlug The slug for the new site (used as filename, without extension)
 * @param newSite The LaunchSite data object
 */
export async function createLaunchSiteFile(newSiteSlug: string, newSite: LaunchSite): Promise<void> {
  const launchSitesDir = path.resolve(__dirname, "../../../../_launch_sites");
  const filePath = path.join(launchSitesDir, `${newSiteSlug}.md`);

  // Compose frontmatter object
  const frontmatter: Record<string, any> = {
    layout: "launch_site",
    title: `${newSite.site_name}, ${newSite.location}`,
    slug: newSiteSlug,
    "site-name": newSite.site_name,
    "location": newSite.location,
    "geo-lat": newSite.geo.latitude,
    "geo-lon": newSite.geo.longitude,
    "operator": newSite.operator || "",
    "launch-vehicles": newSite.launch_vehicles || [],
  };

  // Compose body, which will be replaced by a GPT-generated body if successful.
  let body = `${newSite.site_name} is a launch site located at ${newSite.location}`;
  if (newSite.operator) {
    body += ` and operated by ${newSite.operator}`;
  }
  body += ".";
  if (newSite.launch_vehicles && newSite.launch_vehicles.length > 0) {
    body += ` Launch vehicles: ${newSite.launch_vehicles.join(", ")}.`;
  }
  body += "\n";

  const prompt = `Here is a new launch site that needs to be documented.

The site is located in ${newSite.location} and has the following details:
- Site Name: ${newSite.site_name}
- Latitude: ${newSite.geo.latitude}
- Longitude: ${newSite.geo.longitude}
- Operator: ${newSite.operator || "N/A"}
- Launch Vehicles: ${newSite.launch_vehicles ? newSite.launch_vehicles.join(", ") : "N/A"}

Your job is to:
1. Find the real Wikipedia page for this launch site (if it exists).
2. Read the Wikipedia page and use its information to:
   - Write a short, accurate description of the launch site (1-2 sentences).
   - Generate a collection of relevant tags (e.g. country, agency, vehicle types, etc).
   - Write a markdown body text block (1-2 paragraphs) summarizing the site's history, usage, and notable facts.
   - Provide the real Wikipedia URL for the site.

Respond with a JSON object matching this schema:
{
  "description": string, // 1-2 sentence summary of the site
  "tags": string[],      // relevant tags (country, agency, vehicle, etc)
  "body": string,        // markdown body text (1-2 paragraphs)
  "wikipedia_url": string // real Wikipedia URL for the site, or empty string if not found
}

Here is the newSite data:
${JSON.stringify(newSite, null, 2)}
`;

  const gptResponse = await callOpenAI(
    [
      { role: "system", content: "You are a launch-site resolver.  Reply ONLY with valid JSON matching the schema shown at the end.  No other text." },
      { role: "user", content: prompt }
    ]
  );
  let gptResult: {
    description: string;
    tags: string[];
    body: string;
    wikipedia_url: string;
  };
  try {
    gptResult = JSON.parse(gptResponse);
    console.log(`🤖 Launch site GPT response: ${JSON.stringify(gptResult, null, 2)}`);
    
    frontmatter.description = gptResult.description;
    frontmatter.tags = gptResult.tags;
    frontmatter.wikipedia_url = gptResult.wikipedia_url;

    body = gptResult.body;
  } catch (e) {
    console.error("Failed to parse launch site GPT response as JSON: " + gptResponse);
  }

  const fileContent = matter.stringify(body, frontmatter);
  await fs.writeFile(filePath, fileContent, "utf8");
}
