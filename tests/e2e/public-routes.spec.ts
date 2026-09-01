import { expect, test } from "@playwright/test";

test("root redirects to the operator shell", async ({ request }) => {
  const response = await request.get("/", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/hunar-os");
});

test("public audience shells render", async ({ request }) => {
  const [operator, worker] = await Promise.all([
    request.get("/hunar-os"),
    request.get("/kaam-saathi"),
  ]);
  expect(await operator.text()).toContain(
    "Frontline exceptions become governed actions.",
  );
  expect(await worker.text()).toContain("जब काम बदलता है");
});

test("guided demo resumes for 24 hours and revokes the abandoned browser token", async ({
  page,
  context,
}) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Start as worker" }).click();
  await expect(page).toHaveURL(/\/worker\/bookings\/DEMO-4821$/, {
    timeout: 20_000,
  });
  await expect(
    page.getByRole("heading", { name: "Essential Home Cleaning" }),
  ).toBeVisible();

  const [firstCookie] = await context.cookies();
  expect(firstCookie).toMatchObject({
    name: "hunar_demo_session",
    httpOnly: true,
    sameSite: "Lax",
  });
  expect(firstCookie?.expires ?? 0).toBeGreaterThan(
    Date.now() / 1_000 + 23 * 60 * 60,
  );

  await page.reload();
  await expect(page.getByText("DEMO-4821")).toBeVisible();
  await page.goto("/demo");
  await expect(
    page.getByRole("link", { name: "Continue your demo" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Start a new demo" }).click();
  await expect(page).toHaveURL(/\/worker\/bookings\/DEMO-4821$/, {
    timeout: 20_000,
  });
  const [replacementCookie] = await context.cookies();
  expect(replacementCookie?.value).not.toBe(firstCookie?.value);

  if (!firstCookie) throw new Error("Expected the first private demo cookie.");
  await context.addCookies([firstCookie]);
  await page.goto("/demo");
  await expect(
    page.getByRole("button", { name: "Start as worker" }),
  ).toBeVisible();
  await expect(page.getByText("Continue your demo")).not.toBeVisible();
});

const viewports = [
  { name: "mobile", width: 360, height: 800 },
  { name: "desktop", width: 1280, height: 800 },
] as const;
const shells = [
  {
    name: "operator",
    path: "/hunar-os",
    heading: "Frontline exceptions become governed actions.",
    wordmark: "Hunar OS",
  },
  {
    name: "worker",
    path: "/kaam-saathi",
    heading: "Agree on the next step, without guessing.",
    wordmark: "KaamSaathi कामसाथी",
  },
] as const;

for (const viewport of viewports) {
  for (const shell of shells) {
    test(`${viewport.name} ${shell.name} shell fits and keeps keyboard focus visible`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(shell.path);

      await expect(
        page.getByRole("heading", { name: shell.heading }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);

      await page.keyboard.press("Tab");
      const wordmark = page.getByRole("link", { name: shell.wordmark });
      await expect(wordmark).toBeFocused();
      const outlineWidth = await wordmark.evaluate(
        (element) => getComputedStyle(element).outlineWidth,
      );
      expect(outlineWidth).not.toBe("0px");
    });
  }
}
