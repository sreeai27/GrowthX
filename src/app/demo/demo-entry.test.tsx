import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DemoEntry } from "./demo-entry";

describe("DemoEntry", () => {
  it("offers a no-account start on a first visit", () => {
    render(
      <DemoEntry
        activeRun={null}
        startAction={vi.fn()}
        restartAction={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Start as worker/ }),
    ).toBeVisible();
    expect(screen.queryByText("Continue your demo")).not.toBeInTheDocument();
  });

  it("offers continue and start-over choices for an unfinished run", () => {
    render(
      <DemoEntry
        activeRun={{ publicRunId: "run_public_123", bookingKey: "DEMO-4821" }}
        startAction={vi.fn()}
        restartAction={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("link", { name: /Continue your demo/ }),
    ).toHaveAttribute("href", "/worker/bookings/DEMO-4821");
    expect(
      screen.getByRole("button", { name: /Start a new demo/ }),
    ).toBeVisible();
  });
});
