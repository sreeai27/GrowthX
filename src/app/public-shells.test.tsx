import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HunarOsPage from "./hunar-os/page";
import KaamSaathiPage from "./kaam-saathi/page";

describe("public landing shells", () => {
  it("presents the operator shell and a worker audience switch", () => {
    render(<HunarOsPage />);
    expect(
      screen.getByRole("heading", {
        name: /when frontline work leaves the happy path/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /for workers/i })).toHaveAttribute(
      "href",
      "/kaam-saathi",
    );
    expect(screen.getAllByRole("link", { name: /open kaamsaathi/i })[0]).toHaveAttribute("href", "/kaam-saathi");
    expect(screen.getByRole("link", { name: /see the resolution trace/i })).toHaveAttribute("href", "/trace");
    expect(screen.getByText("Available · protected")).toBeInTheDocument();
    expect(screen.getByText("Platform preview")).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /studio/i })).not.toBeInTheDocument();
  });

  it("presents a bilingual worker shell and an operator audience switch", () => {
    render(<KaamSaathiPage />);
    expect(screen.getByText("जब काम बदलता है")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /for operators/i }),
    ).toHaveAttribute("href", "/hunar-os");
  });
});
