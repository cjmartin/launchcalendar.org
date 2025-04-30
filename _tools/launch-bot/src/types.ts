// Types for LaunchCalendar Agent

export interface RSSEntry {
  title: string;
  link: string;
  pubDate: string;
  content: string;
  contentSnippet: string;
  description: string;
}

export interface LaunchData {
  launch_datetime?: string; // the date and time of the scheduled launch in ISO8601 UTC format
  location?: string; // e.g. "SLC-40, Cape Canaveral Air Force Station, Florida"
  location_slug?: string; // slug for the location, e.g. "cape-canaveral-air-force-station-florida"
  manned?: boolean; // is this a manned mission? (true/false)
  vehicle?: string; // e.g. "Falcon 9, Atlas V, etc."
  vehicle_type?: string; // most likely 'rocket'
  vehicle_slug?: string; // slug for the vehicle, e.g. "falcon-9"
  payload?: string; // what is being sent to orbit? (e.g. "Cargo Dragon")
  payload_type?: string; // what type of object is being sent to orbit (e.g. "satellite, cargo module, crew capsule")
  payload_description?: string; // a short description of the payload
  description?: string; // a very short description of the launch
  tags?: string[]; // a list of tags for this launch
  article_summary?: string; // a short summary of the launch details, updates, etc. from this article
  links?: LaunchLink[]; // a list of links to the article, the launch page, and any other relevant pages
  videos?: LaunchVideo[]; // a list of videos related to the launch
  images?: LaunchImage[]; // a list of images related to the launch
}

export interface LaunchLink {
  title: string;
  type: string[];
  url: string;
}

export interface LaunchVideo {
  title: string;
  type: string | string[];
  url: string;
}

export interface LaunchImage {
  title: string;
  alt: string;
  type: string[];
  src: string;
  source_url: string; // url to link back to the image source
  credit?: string; // e.g. "NASA"
  cretit_url?: string; // url to link the credit to
}

export interface LaunchSite {
  site_name: string;
  location: string;
  geo: {
    latitude: number;
    longitude: number;
  };
  operator?: string;
  launch_vehicles?: string[];
}

export interface LaunchVehicle {
  vehicle_name: string;
  operator?: string;
  aliases?: string[];
}

export interface LaunchFrontmatter {
  layout: string;
  title: string;
  description: string;
  tags: string[];
  date: string;
  created: string;
  updated: string;
  redirect_from: string[];
  location: string;
  "location-slug": string;
  manned: boolean;
  vehicle: string;
  "vehicle-type": string;
  "vehicle-slug": string;
  payload: string;
  "payload-type": string;
  "payload-description": string;
  links: LaunchLink[];
  videos: LaunchVideo[];
  images: LaunchImage[];
}

export const frontMatterKeys = [
  "layout",
  "title",
  "description",
  "tags",
  "date",
  "created",
  "updated",
  "redirect_from",
  "location",
  "location-slug",
  "manned",
  "vehicle",
  "vehicle-type",
  "vehicle-slug",
  "payload",
  "payload-type",
  "payload-description",
  "links",
  "videos",
  "images"
] as const;

export interface MatchResult {
  id: string; // usually the slug
  score: number; // the score of the match
  verdict: "accept" | "gpt_check" | "no_match"; // the verdict of the match
}

export interface LaunchMatchResult {
  matched: boolean;
  reason: "update" | "reschedule" | "no_match";
  existingPath?: string;
  confidence: number;
}

// GPT response result types

export interface LaunchSiteGPTMatch {
  decision: "match" | "new_site" | "no_match";
  site_id?: string, // required if decision == match
  proposed?: {
      slug: string; // format: slugified site_name + location
      site_name: string;
      location: string;
      geo: {
        latitude: number;
        longitude: number;
      };
      operator?: string;
      launch_vehicles?: string[];
  },
  reasoning: string;
}
