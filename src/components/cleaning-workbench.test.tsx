import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CleaningWorkbench } from "./cleaning-workbench";

describe("CleaningWorkbench", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.scrollTo = vi.fn();
  });

  it("shows a highlighted Before / After preview and matching Dry Run", async () => {
    const user = userEvent.setup();
    const { container } = render(<CleaningWorkbench />);

    await user.click(screen.getByRole("button", { name: /Before \/ After変更箇所を比較/ }));

    expect(screen.getByRole("heading", { name: "変換前後を比較" })).toBeInTheDocument();
    expect(screen.getByText("Before / 元データ")).toBeInTheDocument();
    expect(screen.getByText("After / 変換後")).toBeInTheDocument();
    expect(container.querySelectorAll(".cell-changed-before").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".cell-changed-after").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Dry Run \/ 実行件数を確認して適用/ }));

    expect(screen.getByText("Dry Run完了")).toBeInTheDocument();
    expect(screen.getByText("変更予定セル")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /一括クレンジングを実行/ })).toBeEnabled();
  });

  it("does not place ad slots inside the file import or result workflow", async () => {
    const user = userEvent.setup();
    render(<CleaningWorkbench />);

    expect(screen.queryByLabelText("広告枠 1")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("広告枠 2")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /ファイル読込CSV \/ XLSX/ }));
    expect(screen.queryByLabelText("広告枠 1")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("広告枠 2")).not.toBeInTheDocument();
  });
});
