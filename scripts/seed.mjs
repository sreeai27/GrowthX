const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.log(
    "Seed skipped: set NEXT_PUBLIC_CONVEX_URL after running `npx convex dev`.",
  );
  process.exit(0);
}

new URL(convexUrl);
console.log(
  "Convex is configured. Run `npx convex run seed:seed` after adding the Phase 1 fixtures.",
);
