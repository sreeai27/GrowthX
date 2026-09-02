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
  const request = store.requests.find(
    (candidate) => candidate.tokenHash === tokenHash,
  );
  if (!request) throw new Error("Expected the fixture confirmation request.");
  update(request);
  await writeFile(confirmationStorePath, JSON.stringify(store), "utf8");
}

async function seedRetryableFixtureAction(rawToken: string) {
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const confirmationStore = JSON.parse(
    await readFile(confirmationStorePath, "utf8"),
  ) as {
    requests: Array<Record<string, unknown>>;
    executions: Array<Record<string, unknown>>;
  };
  const request = confirmationStore.requests.find(
    (candidate) => candidate.tokenHash === tokenHash,
  );
  const execution = confirmationStore.executions.find(
    (candidate) => candidate.tokenHash === tokenHash,
  );
  if (!request || !execution)
    throw new Error("Expected a completed fixture action.");
  execution.status = "RETRYABLE_FAILED";
  execution.receipt = null;
  execution.error = {
    code: "TIMEOUT_AFTER_COMMIT",
    message: "The stored result needs reconciliation.",
  };

  const incidentStorePath = ".demo-fixture/e2e-runs.json.incidents";
  const incidentStore = JSON.parse(
    await readFile(incidentStorePath, "utf8"),
  ) as {
    incidents: Array<Record<string, unknown>>;
  };
  const incident = incidentStore.incidents.find(
    (candidate) =>
      candidate.publicRunId === request.publicRunId &&
      candidate.incidentKey === request.incidentKey,
  );
  const decision = incident?.policyDecision as
    Record<string, unknown> | undefined;
  const booking = decision?.booking as Record<string, unknown> | undefined;
  const snapshot = request.snapshot as Record<string, unknown>;
  const executionRequest = execution.request as Record<string, unknown>;
  if (!incident || !booking)
    throw new Error("Expected the fixture booking relation.");
  incident.status = "ACTION_AUTHORISED";
  booking.bookingVersion = executionRequest.bookingVersion;
  booking.scheduledDurationMinutes =
    Number(booking.scheduledDurationMinutes) -
    Number(snapshot.durationDeltaMinutes);
  booking.includedTasks = (
    booking.includedTasks as Array<Record<string, unknown>>
  ).filter((task) => task.taskId !== snapshot.taskId);
  await Promise.all([
    writeFile(confirmationStorePath, JSON.stringify(confirmationStore), "utf8"),
    writeFile(incidentStorePath, JSON.stringify(incidentStore), "utf8"),
  ]);
}

async function createBalconyConfirmationLink(page: Page) {
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
  await page.getByRole("button", { name: /Select this/i }).click();
  await expect(page).toHaveURL(/\/decision$/, { timeout: 20_000 });
  await page
    .getByRole("button", { name: /Send for customer approval/i })
    .click();
  await expect(page).toHaveURL(/\/status$/, { timeout: 20_000 });
  const href = await page
    .getByRole("link", { name: /Open customer link/i })
    .getAttribute("href");
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
  test.setTimeout(180_000);
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
    await page.getByRole("button", { name: /Select this/i }).click();

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
    await copyLink.evaluate(
      (element) => element.getBoundingClientRect().height,
    ),
  ).toBeGreaterThanOrEqual(48);
  await copyLink.click();
  await expect(
    workerPage.getByText(/Link copied|Could not copy/i),
  ).toBeVisible();

  const customer = await browser.newContext();
  const customerPage = await customer.newPage();
  await customerPage.setViewportSize({ width: 360, height: 800 });
  await customerPage.goto(customerUrl!);
  await expect(customerPage.getByText("Essential Home Cleaning")).toBeVisible();
  await expect(
    customerPage.getByRole("heading", { name: "Balcony deep cleaning" }),
  ).toBeVisible();
  await expect(customerPage.getByText("₹299", { exact: true })).toBeVisible();
  await expect(
    customerPage.getByText("25 minutes", { exact: true }),
  ).toBeVisible();
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
    await confirmRequest.evaluate(
      (element) => element.getBoundingClientRect().height,
    ),
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
    customerPage.getByRole("heading", { name: /Booking updated/i }),
  ).toBeVisible();
  await customerPage.reload();
  await expect(
    customerPage.getByRole("heading", { name: /Booking updated/i }),
  ).toBeVisible();
  await expect(customerPage.getByRole("button")).toHaveCount(0);

  const statusUrl = workerPage.url();
  const outsiderPage = await customer.newPage();
  await outsiderPage.goto(statusUrl);
  await expect(outsiderPage).toHaveURL(/\/demo$/);

  await workerPage.reload();
  await expect(
    workerPage.getByRole("heading", { name: /Booking updated/i }),
  ).toBeVisible();
  expect(
    await customerPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const openLink = workerPage.getByRole("link", {
    name: /Open customer link/i,
  });
  if (await openLink.count()) {
    await openLink.focus();
    await expect(openLink).toBeFocused();
    expect(
      await openLink.evaluate(
        (element) => element.getBoundingClientRect().height,
      ),
    ).toBeGreaterThanOrEqual(48);
  }
  await customer.close();
  await worker.close();
});

test("authorised booking change updates once and both parties see the same receipt", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const worker = await browser.newContext();
  const workerPage = await worker.newPage();
  const customerUrl = await createBalconyConfirmationLink(workerPage);
  const customer = await browser.newContext();
  const customerPage = await customer.newPage();
  await customerPage.setViewportSize({ width: 360, height: 800 });
  await customerPage.goto(customerUrl);
  await customerPage
    .getByRole("button", { name: /Yes, this is my request/i })
    .click();
  await customerPage.getByRole("button", { name: /Approve ₹299/i }).click();

  await expect(
    customerPage.getByRole("heading", { name: /Booking updated/i }),
  ).toBeVisible();
  await expect(customerPage.getByText("Balcony deep cleaning")).toBeVisible();
  await expect(customerPage.getByText(/[+]25 minutes.*₹299/i)).toBeVisible();
  const receipt = await customerPage.getByText(/^ACT-DEMO-/).textContent();
  expect(receipt).toBeTruthy();

  await customerPage.reload();
  await expect(customerPage.getByText(receipt!)).toBeVisible();
  await workerPage.reload();
  await expect(
    workerPage.getByRole("heading", { name: /Booking updated/i }),
  ).toBeVisible();
  await expect(workerPage.getByText(receipt!)).toBeVisible();
  await expect(workerPage.getByText(/[+]25 minutes.*₹299/i)).toBeVisible();

  expect(
    await customerPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await customerPage.setViewportSize({ width: 1280, height: 800 });
  expect(
    await customerPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await customer.close();
  await worker.close();
});

test("customer can refresh a retryable action and recover the same stored connector result", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const worker = await browser.newContext();
  const workerPage = await worker.newPage();
  const customerUrl = await createBalconyConfirmationLink(workerPage);
  const customer = await browser.newContext();
  const customerPage = await customer.newPage();
  await customerPage.goto(customerUrl);
  await customerPage
    .getByRole("button", { name: /Yes, this is my request/i })
    .click();
  await customerPage.getByRole("button", { name: /Approve ₹299/i }).click();
  const originalReceipt = await customerPage
    .getByText(/^ACT-DEMO-/)
    .textContent();
  const rawToken = customerUrl.split("/").at(-1);
  if (!rawToken || !originalReceipt)
    throw new Error("Expected the customer token and receipt.");

  await seedRetryableFixtureAction(rawToken);
  await customerPage.reload();
  await expect(
    customerPage.getByRole("heading", { name: /needs another try/i }),
  ).toBeVisible();
  await customerPage.reload();
  await customerPage
    .getByRole("button", { name: /Retry booking update/i })
    .click();
  await expect(
    customerPage.getByRole("heading", { name: /Booking updated/i }),
  ).toBeVisible();
  await expect(customerPage.getByText(originalReceipt)).toBeVisible();
  await workerPage.reload();
  await expect(workerPage.getByText(originalReceipt)).toBeVisible();
  await customer.close();
  await worker.close();
});

test("complete and verify agreement survives refresh on worker and customer views", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const worker = await browser.newContext();
  const workerPage = await worker.newPage();
  await workerPage.setViewportSize({ width: 360, height: 800 });
  const customerUrl = await createBalconyConfirmationLink(workerPage);
  const customer = await browser.newContext();
  const customerPage = await customer.newPage();
  await customerPage.goto(customerUrl);
  await customerPage
    .getByRole("button", { name: /Yes, this is my request/i })
    .click();
  await customerPage.getByRole("button", { name: /Approve ₹299/i }).click();
  await expect(
    customerPage.getByRole("heading", { name: /Booking updated/i }),
  ).toBeVisible();
  await workerPage.reload();
  await workerPage
    .getByRole("link", { name: /Record completed work/i })
    .click();
  await expect(
    workerPage.getByRole("heading", { name: /Record completed work/i }),
  ).toBeVisible();
  const tasks = workerPage.locator(".completion-task");
  for (let index = 0; index < (await tasks.count()); index += 1) {
    await tasks
      .nth(index)
      .getByLabel(/Complete/i)
      .check();
  }
  const submit = workerPage.getByRole("button", { name: /Submit completion/i });
  expect(
    await submit.evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(48);
  await submit.click();
  await expect(
    workerPage.getByRole("heading", { name: /Cannot verify yet/i }),
  ).toBeVisible();
  await customerPage.reload();
  await expect(
    customerPage.getByRole("heading", { name: /Review completed work/i }),
  ).toBeVisible();
  await customerPage.screenshot({
    path: "test-results/completion-mobile.png",
    fullPage: true,
  });
  const acknowledge = customerPage.getByRole("button", {
    name: /Acknowledge/i,
  });
  await acknowledge.focus();
  await expect(acknowledge).toBeFocused();
  await acknowledge.click();
  await expect(
    customerPage.getByRole("heading", { name: "Verified" }),
  ).toBeVisible();
  await customerPage.reload();
  await expect(
    customerPage.getByRole("heading", { name: "Verified" }),
  ).toBeVisible();
  await workerPage.reload();
  await expect(
    workerPage.getByRole("heading", { name: "Verified" }),
  ).toBeVisible();
  await customerPage.setViewportSize({ width: 1280, height: 800 });
  await customerPage.screenshot({
    path: "test-results/completion-desktop.png",
    fullPage: true,
  });
  expect(
    await customerPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await customer.close();
  await worker.close();
});

test("complete and verify routes customer issues and worker blockers to human review", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  for (const outcome of ["issue", "blocker"] as const) {
    const worker = await browser.newContext();
    const workerPage = await worker.newPage();
    const customerUrl = await createBalconyConfirmationLink(workerPage);
    const customer = await browser.newContext();
    const customerPage = await customer.newPage();
    await customerPage.goto(customerUrl);
    await customerPage
      .getByRole("button", { name: /Yes, this is my request/i })
      .click();
    await customerPage.getByRole("button", { name: /Approve ₹299/i }).click();
    await expect(
      customerPage.getByRole("heading", { name: /Booking updated/i }),
    ).toBeVisible();
    await workerPage.reload();
    await workerPage
      .getByRole("link", { name: /Record completed work/i })
      .click();
    const tasks = workerPage.locator(".completion-task");
    for (let index = 0; index < (await tasks.count()); index += 1) {
      await tasks
        .nth(index)
        .getByLabel(
          index === 0 && outcome === "blocker" ? /Blocked/i : /Complete/i,
        )
        .check();
    }
    await workerPage
      .getByRole("button", { name: /Submit completion/i })
      .click();
    await customerPage.reload();
    if (outcome === "issue") {
      await customerPage
        .getByLabel(/Optional note/i)
        .fill("The balcony corner still needs review.");
      await customerPage
        .getByRole("button", { name: /Raise an issue/i })
        .click();
      await expect(
        customerPage.getByRole("heading", { name: /Disputed/i }),
      ).toBeVisible();
      await workerPage.reload();
      await expect(
        workerPage.getByRole("heading", { name: /Disputed/i }),
      ).toBeVisible();
    } else {
      await expect(
        customerPage.getByRole("heading", { name: /Review required/i }),
      ).toBeVisible();
      await expect(
        customerPage.getByRole("button", {
          name: /Acknowledge|Raise an issue/i,
        }),
      ).toHaveCount(0);
      await expect(
        workerPage.getByRole("heading", { name: /Review required/i }),
      ).toBeVisible();
    }
    await customer.close();
    await worker.close();
  }
});

test("complete and verify rejects a stale submission and reloads the current agreement", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const worker = await browser.newContext();
  const workerPage = await worker.newPage();
  const customerUrl = await createBalconyConfirmationLink(workerPage);
  const customer = await browser.newContext();
  const customerPage = await customer.newPage();
  await customerPage.goto(customerUrl);
  await customerPage
    .getByRole("button", { name: /Yes, this is my request/i })
    .click();
  await customerPage.getByRole("button", { name: /Approve ₹299/i }).click();
  await expect(
    customerPage.getByRole("heading", { name: /Booking updated/i }),
  ).toBeVisible();
  await workerPage.reload();
  await workerPage
    .getByRole("link", { name: /Record completed work/i })
    .click();
  const tasks = workerPage.locator(".completion-task");
  for (let index = 0; index < (await tasks.count()); index += 1)
    await tasks
      .nth(index)
      .getByLabel(/Complete/i)
      .check();
  await workerPage
    .locator('input[name="bookingVersion"]')
    .evaluate((element) => {
      (element as HTMLInputElement).value = "999";
    });
  await workerPage.getByRole("button", { name: /Submit completion/i }).click();
  await expect(workerPage.getByRole("alert")).toContainText(
    /agreement changed|submission was invalid/i,
  );
  await expect(
    workerPage.getByRole("heading", { name: /Record completed work/i }),
  ).toBeVisible();
  await expect(workerPage.getByText(/Booking version 2/i)).toBeVisible();
  const currentTasks = workerPage.locator(".completion-task");
  for (let index = 0; index < (await currentTasks.count()); index += 1)
    await currentTasks
      .nth(index)
      .getByLabel(/Complete/i)
      .check();
  await currentTasks.first().evaluate((task) => {
    const taskId = task.querySelector<HTMLInputElement>('input[name="taskId"]');
    const state = task.querySelector<HTMLInputElement>(
      'input[type="radio"]:checked',
    );
    if (!taskId || !state)
      throw new Error("Expected the structured task controls.");
    taskId.value = "not_in_the_agreement";
    state.name = "state.not_in_the_agreement";
  });
  await workerPage.getByRole("button", { name: /Submit completion/i }).click();
  await expect(workerPage.getByRole("alert")).toContainText(
    /submission was invalid/i,
  );
  await customer.close();
  await worker.close();
});

test("customer confirmation renders invalid, mismatch and decline as distinct terminal outcomes", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const invalid = await browser.newPage();
  await invalid.goto("/confirm/not-a-real-token");
  await expect(
    invalid.getByRole("heading", { name: /link is not valid/i }),
  ).toBeVisible();
  await invalid.close();

  for (const outcome of ["mismatch", "decline"] as const) {
    const worker = await browser.newContext();
    const workerPage = await worker.newPage();
    const customerUrl = await createBalconyConfirmationLink(workerPage);
    const customer = await browser.newContext();
    const customerPage = await customer.newPage();
    await customerPage.goto(customerUrl);
    if (outcome === "mismatch") {
      await customerPage
        .getByRole("button", { name: /does not match/i })
        .click();
      await expect(
        customerPage.getByRole("heading", { name: /Request does not match/i }),
      ).toBeVisible();
      await workerPage.reload();
      await expect(
        workerPage.getByRole("heading", { name: /Request does not match/i }),
      ).toBeVisible();
    } else {
      await customerPage
        .getByRole("button", { name: /Yes, this is my request/i })
        .click();
      await customerPage
        .getByRole("button", { name: /Decline change/i })
        .click();
      await expect(
        customerPage.getByRole("heading", { name: /Change declined/i }),
      ).toBeVisible();
      await expect(
        customerPage.getByText(/original booking remains/i),
      ).toBeVisible();
      await expect(
        customerPage.getByRole("heading", { name: /Booking updated/i }),
      ).toHaveCount(0);
      await workerPage.reload();
      await expect(
        workerPage.getByRole("heading", { name: /Customer declined/i }),
      ).toBeVisible();
      await expect(
        workerPage.getByRole("link", { name: /Continue original booking/i }),
      ).toBeVisible();
    }
    await customer.close();
    await worker.close();
  }
});

test("customer confirmation safely shows expired and stale links", async ({
  browser,
}) => {
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
        name:
          state === "expired" ? /link has expired/i : /work details changed/i,
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
