import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const confirmationStorePath = ".demo-fixture/e2e-runs.json.confirmations";

async function changeFixtureConfirmation(
  rawToken: string,
  update: (request: Record<string, unknown>) => void,
) {
  const store = JSON.parse(await readFile(confirmationStorePath, "utf8")) as {
    requests: Record<string, unknown>[];
  };
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const request = store.requests.find((candidate) => candidate.tokenHash === tokenHash);
  if (!request) throw new Error("Expected the fixture confirmation request.");
  update(request);
  await writeFile(confirmationStorePath, JSON.stringify(store), "utf8");
}

async function createBalconyConfirmationLink(page: Page) {
  await page.goto("/demo");
  await page.getByRole("button", { name: /Start as worker/i }).click();
  await page.getByRole("button", { name: /Report a customer-requested change/i }).click();
  await page.getByRole("textbox", { name: /Customer request/i }).fill("Balcony ko deep clean karna hai");
  await page.getByRole("button", { name: /Review request/i }).click();
  await page.getByRole("button", { name: /Yes, continue/i }).click();
  await page.getByRole("button", { name: /Select this/i }).click();
  await expect(page).toHaveURL(/\/decision$/, { timeout: 20_000 });
  await page.getByRole("button", { name: /Send for customer approval/i }).click();
  await expect(page).toHaveURL(/\/status$/, { timeout: 20_000 });
  const href = await page.getByRole("link", { name: /Open customer link/i }).getAttribute("href");
  if (!href) throw new Error("Expected one customer confirmation link.");
  return href;
}

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
  test.setTimeout(90_000);
  await page.goto("/demo");
  await page.getByRole("button", { name: "Start as worker" }).click();
  await expect(page).toHaveURL(/\/worker\/bookings\/DEMO-4821$/, {
    timeout: 20_000,
  });
  await expect(
    page.getByRole("heading", { name: "Essential Home Cleaning" }),
  ).toBeVisible();

  const firstCookie = (await context.cookies()).find(
    (cookie) => cookie.name === "hunar_demo_session",
  );
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
  const replacementCookie = (await context.cookies()).find(
    (cookie) => cookie.name === "hunar_demo_session",
  );
  expect(replacementCookie?.value).not.toBe(firstCookie?.value);

  if (!firstCookie) throw new Error("Expected the first private demo cookie.");
  await context.addCookies([firstCookie]);
  await page.goto("/demo");
  await expect(
    page.getByRole("button", { name: "Start as worker" }),
  ).toBeVisible();
  await expect(page.getByText("Continue your demo")).not.toBeVisible();
});

test("worker captures, confirms and selects a bounded typed request across refresh", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const worker = await browser.newContext();
  const page = await worker.newPage();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/demo");
  await page.getByRole("button", { name: /Start as worker/i }).click();
  await page
    .getByRole("button", { name: /Report a customer-requested change/i })
    .click();

  await page
    .getByRole("textbox", { name: /Customer request/i })
    .fill("Balcony ko deep clean karna hai");
  await page.getByRole("button", { name: /Review request/i }).click();
  await expect(page).toHaveURL(/\/transcript$/, { timeout: 20_000 });
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: /Confirmed wording/i }),
  ).toHaveValue("Balcony ko deep clean karna hai");
  const incidentKey = new URL(page.url()).pathname.split("/")[3];
  await page.getByRole("button", { name: /Try again/i }).click();
  await expect(page).toHaveURL(
    new RegExp(`/worker/incidents/${incidentKey}/capture$`),
  );
  await page
    .getByRole("textbox", { name: /Customer request/i })
    .fill("Balcony ko deep clean karna hai");
  await page.getByRole("button", { name: /Review request/i }).click();
  await expect(page).toHaveURL(/\/transcript$/, { timeout: 20_000 });
  await page
    .getByRole("textbox", { name: /Confirmed wording/i })
    .fill("Balcony ko achchhe se deep clean karna hai");
  await page.getByRole("button", { name: /Yes, continue/i }).click();
  await expect(page).toHaveURL(/\/interpretation$/, { timeout: 20_000 });
  await expect(page.getByText("Balcony deep cleaning")).toBeVisible();

  const incidentUrl = page.url();
  const outsider = await browser.newContext();
  const outsiderPage = await outsider.newPage();
  await outsiderPage.goto(incidentUrl);
  await expect(outsiderPage).toHaveURL(/\/demo$/);
  await outsider.close();

  await page.getByRole("button", { name: /Select this/i }).click();
  await expect(page).toHaveURL(/\/decision$/, { timeout: 20_000 });
  await expect(page.getByText(/Task confirmed/i)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Task confirmed/i)).toBeVisible();

  const [oldCookie] = await worker.cookies();
  if (!oldCookie) throw new Error("Expected the private demo cookie.");
  await page.goto("/demo");
  await page.getByRole("button", { name: "Start a new demo" }).click();
  await worker.addCookies([oldCookie]);
  await page.goto(incidentUrl);
  await expect(page).toHaveURL(/\/demo$/);
  await worker.close();
});

for (const viewport of [
  { name: "mobile", width: 360, height: 800 },
  { name: "desktop", width: 1280, height: 800 },
] as const) {
  test(`policy decision shows inline evidence on ${viewport.name}`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await page.goto("/demo");
    await page.getByRole("button", { name: /Start as worker/i }).click();
    await page
      .getByRole("button", { name: /Report a customer-requested change/i })
      .click();
    await page
      .getByRole("textbox", { name: /Customer request/i })
      .fill("Balcony ko deep clean karna hai");
    await page.getByRole("button", { name: /Review request/i }).click();
    await page.getByRole("button", { name: /Yes, continue/i }).click();
    await page
      .getByRole("button", { name: /Select this/i })
      .click();

    await expect(page).toHaveURL(/\/decision$/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: /Customer approval needed/i }),
    ).toBeVisible();
    await expect(page.getByText("Essential Home Cleaning")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Balcony deep cleaning" }),
    ).toBeVisible();
    await expect(page.getByText("25 minutes", { exact: true })).toBeVisible();
    await expect(page.getByText("₹299", { exact: true })).toBeVisible();
    await expect(page.getByText("SUPPORTED", { exact: true })).toBeVisible();
    await expect(page.getByText("Customer", { exact: true })).toBeVisible();
    await expect(page.getByText(/Fictional Sahaay/i)).toBeVisible();
    await expect(page.getByText(/Version/i)).toBeVisible();
    await expect(page.getByText(/Effective/i)).toBeVisible();

    const source = page.getByRole("group", { name: /policy source/i });
    const disclosure = source.locator("summary");
    await disclosure.focus();
    await expect(disclosure).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(source.getByText(/optional add-on/i)).toBeVisible();

    const approval = page.getByRole("button", {
      name: /Send for customer approval/i,
    });
    await expect(approval).toBeEnabled();
    await expect(page.getByText(/Available next/i).first()).toBeVisible();
    await expect(page.getByText(/fictional demo data/i)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      await approval.evaluate(
        (element) => element.getBoundingClientRect().height,
      ),
    ).toBeGreaterThanOrEqual(48);
  });
}

test("customer confirmation keeps one frozen decision from worker link to approval", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const worker = await browser.newContext();
  const workerPage = await worker.newPage();
  await workerPage.setViewportSize({ width: 360, height: 800 });
  await workerPage.goto("/demo");
  await workerPage.getByRole("button", { name: /Start as worker/i }).click();
  await workerPage
    .getByRole("button", { name: /Report a customer-requested change/i })
    .click();
  await workerPage
    .getByRole("textbox", { name: /Customer request/i })
    .fill("Balcony ko deep clean karna hai");
  await workerPage.getByRole("button", { name: /Review request/i }).click();
  await workerPage.getByRole("button", { name: /Yes, continue/i }).click();
  await workerPage.getByRole("button", { name: /Select this/i }).click();
  await expect(workerPage).toHaveURL(/\/decision$/, { timeout: 20_000 });

  const send = workerPage.getByRole("button", {
    name: /Send for customer approval/i,
  });
  await expect(send).toBeEnabled();
  await send.click();
  await expect(workerPage).toHaveURL(/\/status$/, { timeout: 20_000 });
  const customerUrl = await workerPage
    .getByRole("link", { name: /Open customer link/i })
    .getAttribute("href");
  expect(customerUrl).toMatch(/^\/confirm\/[A-Za-z0-9_-]{43}$/);
  const copyLink = workerPage.getByRole("button", {
    name: /Copy customer link/i,
  });
  await copyLink.focus();
  await expect(copyLink).toBeFocused();
  expect(
    await copyLink.evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(48);
  await copyLink.click();
  await expect(workerPage.getByText(/Link copied|Could not copy/i)).toBeVisible();

  const customer = await browser.newContext();
  const customerPage = await customer.newPage();
  await customerPage.setViewportSize({ width: 360, height: 800 });
  await customerPage.goto(customerUrl!);
  await expect(customerPage.getByText("Essential Home Cleaning")).toBeVisible();
  await expect(
    customerPage.getByRole("heading", { name: "Balcony deep cleaning" }),
  ).toBeVisible();
  await expect(customerPage.getByText("₹299", { exact: true })).toBeVisible();
  await expect(customerPage.getByText("25 minutes", { exact: true })).toBeVisible();
  await expect(
    customerPage.getByRole("heading", {
      name: /Sahaay Home Services Demonstration Task and Add-on Policy/i,
    }),
  ).toBeVisible();
  const confirmRequest = customerPage.getByRole("button", {
    name: /Yes, this is my request/i,
  });
  await confirmRequest.focus();
  await expect(confirmRequest).toBeFocused();
  expect(
    await confirmRequest.evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(48);
  expect(
    await customerPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await customerPage.screenshot({
    path: "test-results/customer-confirm-mobile.png",
    fullPage: true,
  });
  await customerPage.setViewportSize({ width: 1280, height: 800 });
  expect(
    await customerPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await customerPage.screenshot({
    path: "test-results/customer-confirm-desktop.png",
    fullPage: true,
  });
  await confirmRequest.click();
  await expect(
    customerPage.getByRole("button", { name: /Approve ₹299/i }),
  ).toBeVisible();
  await workerPage.reload();
  await expect(
    workerPage.getByRole("heading", { name: /Request confirmed/i }),
  ).toBeVisible();
  await customerPage.getByRole("button", { name: /Approve ₹299/i }).click();
  await expect(
    customerPage.getByRole("heading", { name: /Change approved/i }),
  ).toBeVisible();
  await customerPage.reload();
  await expect(
    customerPage.getByRole("heading", { name: /Change approved/i }),
  ).toBeVisible();
  await expect(customerPage.getByRole("button")).toHaveCount(0);

  const statusUrl = workerPage.url();
  const outsiderPage = await customer.newPage();
  await outsiderPage.goto(statusUrl);
  await expect(outsiderPage).toHaveURL(/\/demo$/);

  await workerPage.reload();
  await expect(
    workerPage.getByRole("heading", { name: /Customer approved/i }),
  ).toBeVisible();
  expect(
    await customerPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const openLink = workerPage.getByRole("link", { name: /Open customer link/i });
  if (await openLink.count()) {
    await openLink.focus();
    await expect(openLink).toBeFocused();
    expect(await openLink.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48);
  }
  await customer.close();
  await worker.close();
});

test("customer confirmation renders invalid, mismatch and decline as distinct terminal outcomes", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const invalid = await browser.newPage();
  await invalid.goto("/confirm/not-a-real-token");
  await expect(invalid.getByRole("heading", { name: /link is not valid/i })).toBeVisible();
  await invalid.close();

  for (const outcome of ["mismatch", "decline"] as const) {
    const worker = await browser.newContext();
    const workerPage = await worker.newPage();
    const customerUrl = await createBalconyConfirmationLink(workerPage);
    const customer = await browser.newContext();
    const customerPage = await customer.newPage();
    await customerPage.goto(customerUrl);
    if (outcome === "mismatch") {
      await customerPage.getByRole("button", { name: /does not match/i }).click();
      await expect(customerPage.getByRole("heading", { name: /Request does not match/i })).toBeVisible();
      await workerPage.reload();
      await expect(workerPage.getByRole("heading", { name: /Request does not match/i })).toBeVisible();
    } else {
      await customerPage.getByRole("button", { name: /Yes, this is my request/i }).click();
      await customerPage.getByRole("button", { name: /Decline change/i }).click();
      await expect(customerPage.getByRole("heading", { name: /Change declined/i })).toBeVisible();
      await workerPage.reload();
      await expect(workerPage.getByRole("heading", { name: /Customer declined/i })).toBeVisible();
      await expect(
        workerPage.getByRole("link", { name: /Continue original booking/i }),
      ).toBeVisible();
    }
    await customer.close();
    await worker.close();
  }
});

test("customer confirmation safely shows expired and stale links", async ({ browser }) => {
  test.setTimeout(120_000);
  for (const state of ["expired", "stale"] as const) {
    const worker = await browser.newContext();
    const workerPage = await worker.newPage();
    const customerUrl = await createBalconyConfirmationLink(workerPage);
    const rawToken = customerUrl.split("/").at(-1);
    if (!rawToken) throw new Error("Expected a route token.");
    await changeFixtureConfirmation(rawToken, (request) => {
      if (state === "expired") request.expiresAt = "2026-01-01T00:00:00.000Z";
      else request.decisionHash = "changed-after-link-created";
    });

    const customer = await browser.newContext();
    const customerPage = await customer.newPage();
    await customerPage.goto(customerUrl);
    await expect(
      customerPage.getByRole("heading", {
        name: state === "expired" ? /link has expired/i : /work details changed/i,
      }),
    ).toBeVisible();
    await expect(customerPage.getByRole("button")).toHaveCount(0);
    await customer.close();
    await worker.close();
  }
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
