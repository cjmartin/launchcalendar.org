# launch-bot

A TypeScript CLI agent for managing and updating launch data for [launchcalendar.org](https://launchcalendar.org).

## Overview

launch-bot automates the process of fetching, extracting, normalizing, and updating launch event data.

## Features

- Fetches and processes launch data from articles and RSS feeds
- Extracts and normalizes launch details: vehicle, payload, date, location, etc.
- Matches new data to existing launch files in the `_posts` directory
- Generates clean, simplified slugs for vehicles and payloads (removes descriptive parts after parenthesis or quotes)
- Updates or creates Markdown files with structured frontmatter and launch summaries
- Modular architecture: fetcher, extractor, matcher, updater, and utilities

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### Installation
```sh
npm install
```

### Build
```sh
npx tsc
```

### Run
```sh
node build/agent.js
```

Or for development without building:

```sh
npx ts-node src/agent.ts
```

### Environment Variables
Before running, create a `.env` file in this directory with your OpenAI API key:

```
OPENAI_API_KEY="your-openai-api-key"
```

### RSS Feeds
The list of RSS feeds to fetch launch data from is defined in `data/feeds.json`. You can add or remove feed URLs as needed.

### Output
Markdown files for launches are created or updated in the `_posts` directory (for published launches) or `_drafts` (for new/unpublished launches) at the root of the project (not inside this tool directory).

## Example Workflow
1. Fetch launch data from sources
2. Extract and normalize launch details
3. Generate simplified slugs for vehicle and payload
4. Match to existing files or create new ones
5. Write or update Markdown files with structured frontmatter

## File Structure
- `src/fetcher/` – Fetches and processes article and RSS data
- `src/extractor/` – Extracts structured launch data from sources
- `src/analyzer/` – Detects launches in text
- `src/matcher/` – Matches launch data to existing files
- `src/updater/` – Updates or creates Markdown files for launches
- `src/utils/` – Shared utility functions

### Testing
There is currently no automated test suite. The `npm test` script is a placeholder.

## Contributing
Pull requests and issues are welcome! Please open an issue to discuss your ideas or report bugs.

## License
MIT
