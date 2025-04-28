#!/usr/bin/env ts-node
// CLI tool to update a launch file using another launch file as source
import fs from "fs/promises";
import matter from "gray-matter";
import { fileDataToLaunchData, updateLaunchFile } from "../updater/launchFileUpdater";

async function main() {
  const [,, targetPath, sourcePath] = process.argv;
  if (!targetPath || !sourcePath) {
    console.error("Usage: manual-update-launch-file <target-launch-file> <source-launch-file>");
    process.exit(1);
  }
  try {
    // Read and parse the source file
    const sourceContent = await fs.readFile(sourcePath, "utf8");
    const parsedSource = matter(sourceContent);
    const launchData = fileDataToLaunchData(parsedSource);

    // Update the target file
    const updatedContent = await updateLaunchFile(targetPath, launchData);
    await fs.writeFile(targetPath, updatedContent, "utf8");
    console.log(`Successfully updated ${targetPath} using data from ${sourcePath}`);
  } catch (err) {
    console.error("Error updating launch file:", err);
    process.exit(1);
  }
}

main();
