import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HunarOsPage from "./hunar-os/page";
import KaamSaathiPage from "./kaam-saathi/page";

describe("public landing shells", () => {
  it("presents the operator shell and a worker audience switch", () => {
    render(<HunarOsPage />);
    expect(
      screen.getByRole("heading", {
        name: /exceptions become governed actions/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /for workers/i })).toHaveAttribute(
      "href",
      "/kaam-saathi",
    );
  });

  it("presents a bilingual worker shell and an operator audience switch", () => {
    render(<KaamSaathiPage />);
    expect(screen.getByText("जब काम बदलता है")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /for operators/i }),
    ).toHaveAttribute("href", "/hunar-os");
  });
});
