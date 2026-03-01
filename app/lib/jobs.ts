import { readFileSync } from "node:fs";
import path from "node:path";

import {
  type JobDetail,
  type JobListing,
  type RawInternDataset,
  type RawTagDataset,
  buildJobListings,
  transformRawItems,
} from "./intern-transform";

export type {
  JobDetail,
  JobListing,
  WorkingConditionCategory,
} from "./intern-transform";

function readJsonFile<T>(relativePath: string): T {
  const filePath = path.join(process.cwd(), relativePath);
  const fileContents = readFileSync(filePath, "utf-8");
  return JSON.parse(fileContents) as T;
}

const internData = readJsonFile<RawInternDataset>("data/intern.json");
const tagData = readJsonFile<RawTagDataset>("data/tag.json");

const transformedJobs: JobDetail[] = transformRawItems(internData.items ?? []);

export function getJobListings(): JobListing[] {
  return buildJobListings(transformedJobs);
}

export function getJobDetail(id: number): JobDetail | null {
  const job = transformedJobs.find((item) => item.id === id);
  return job ?? null;
}

export function getAllTags(): string[] {
  return Array.from(
    new Set(
      tagData
        .map((tag) => tag.tagName?.trim())
        .filter((tagName): tagName is string => Boolean(tagName)),
    ),
  ).sort((a, b) => a.localeCompare(b, "th-TH"));
}

export function getAllJobIds(): number[] {
  return transformedJobs.map((job) => job.id);
}
