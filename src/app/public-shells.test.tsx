import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HunarOsPage from "./hunar-os/page";
import KaamSaathiPage from "./kaam-saathi/page";

describe("public landing shells", () => {
  it("presents the operator shell and a worker audience switch", () => {
    render(<HunarOsPage />);
    expect(
      screen.getByRole("heading", {
        name: /resolve frontline exceptions before they become support calls/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /for workers/i })).toHaveAttribute(
      "href",
      "/kaam-saathi",
    );
    expect(screen.getAllByRole("link", { name: /see taskconfirm in action/i })[0]).toHaveAttribute("href", "/kaam-saathi");
    expect(screen.getAllByRole("link", { name: /inspect a decision/i })[0]).toHaveAttribute("href", "/trace");
    expect(screen.getByText("Available · protected")).toBeInTheDocument();
    expect(screen.getByText("Platform preview")).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /studio/i })).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /frontline workers and an operator walking together/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(5);
  });

  it("presents a bilingual worker shell and an operator audience switch", () => {
    render(<KaamSaathiPage />);
    expect(screen.getByText("जब काम बदलता है")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /when the job changes, kaamsaathi helps everyone agree on the next step/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /try a work-change demo/i })).toHaveAttribute("href", "#demos");
    expect(screen.getByRole("link", { name: /try taskconfirm/i })).toHaveAttribute("href", "/demo");
    expect(screen.getByText("Live demo")).toBeInTheDocument();
    expect(screen.getByText("Demo preview")).toBeInTheDocument();
    expect(screen.getAllByText("Coming soon")).toHaveLength(5);
    expect(screen.getAllByRole("group")).toHaveLength(4);
    expect(
      screen.getByRole("link", { name: /for operators/i }),
    ).toHaveAttribute("href", "/hunar-os");
    expect(
      screen.getByRole("img", {
        name: /home-service worker deliberately describing a work change/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(5);
  });
});
