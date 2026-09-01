import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.log(
    "Seed skipped: set NEXT_PUBLIC_CONVEX_URL after running `npx convex dev`.",
  );
  process.exit(0);
}

const client = new ConvexHttpClient(new URL(convexUrl).toString());
const seedDemo = makeFunctionReference("seed:seedDemo");
const result = await client.mutation(seedDemo, {});
console.log(
  result.inserted
    ? "Seeded Sahaay demonstration data."
    : "Sahaay demonstration data already exists.",
);
