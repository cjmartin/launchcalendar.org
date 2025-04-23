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
  manned?: boolean; // is this a manned mission? (true/false)
  vehicle?: string; // e.g. "Falcon 9, Atlas V, etc."
  vehicle_type?: string; // most likely 'rocket'
  payload?: string; // what is being sent to orbit? (e.g. "Cargo Dragon")
  payload_type?: string; // what type of object is being sent to orbit (e.g. "satellite, cargo module, crew capsule")
  description?: string; // a very short description of the launch
  tags?: string[]; // a list of tags for this launch
  article_summary?: string; // a short summary of the launch details, updates, etc. from this article
  links?: LaunchLink[]; // a list of links to the article, the launch page, and any other relevant pages
  videos?: { title: string; type: string; url: string }[]; // a list of links to videos related to the launch
}

export interface LaunchLink {
  title: string;
  type: string[];
  url: string;
}

export interface LaunchFrontmatter {
  layout: string;
  title: string;
  description: string;
  tags: string[];
  date: string;
  created: string;
  updated: string;
  location: string;
  manned: boolean;
  vehicle: string;
  "vehicle-type": string;
  payload: string;
  "payload-type": string;
  links: LaunchLink[];
  videos: { title: string; type: string; url: string }[];
}

