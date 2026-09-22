import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ImobileAd } from "./ImobileAd";

describe("ImobileAd", () => {
  it("shows the house promotion when no official i-mobile tag is configured", () => {
    render(<ImobileAd placement="top" slot="tool-top" />);

    const slot = screen.getByLabelText("広告枠 1");
    expect(slot).toHaveAttribute("data-ad-provider", "house");
    expect(screen.getByText("自社サービス案内")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /関連ツールを見る/ })).toHaveAttribute(
      "href",
      "https://tsukutta.app/portfolio/9b7d1d1e-1ad0-46b0-a83f-cacc36a2840f",
    );
  });
});
