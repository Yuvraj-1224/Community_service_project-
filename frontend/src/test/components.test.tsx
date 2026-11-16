import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider, type Lang } from "../i18n";
import { LanguageSwitcher, StatusBadge } from "../components/ui";
import ImageUploader from "../components/ImageUploader";
import { RegisterPage, LoginPage } from "../pages/AuthPages";
import { AuthProvider } from "../context/AuthContext";
import Landing from "../pages/Landing";

const wrap = (ui: React.ReactNode, lang: Lang = "en") =>
  render(
    <MemoryRouter>
      <I18nProvider defaultLang={lang}>
        <AuthProvider>{ui}</AuthProvider>
      </I18nProvider>
    </MemoryRouter>,
  );

describe("LanguageSwitcher", () => {
  it("switches the landing page between English and Hindi", async () => {
    wrap(<><LanguageSwitcher /><Landing /></>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Smart Farming Starts with Healthy Plants");
    await userEvent.click(screen.getByRole("button", { name: "हिं" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("स्वस्थ पौधों से शुरू होती है स्मार्ट खेती");
    expect(document.documentElement.lang).toBe("hi");
  });
});

describe("StatusBadge", () => {
  it("renders translated status", () => {
    wrap(<StatusBadge status="diseased" />, "hi");
    expect(screen.getByText("रोगग्रस्त")).toBeInTheDocument();
  });
});

describe("ImageUploader", () => {
  it("rejects unsupported files and accepts a valid image", async () => {
    const onChange = vi.fn();
    const onError = vi.fn();
    wrap(<ImageUploader file={null} onChange={onChange} onError={onError} />);
    const input = screen.getByTestId("file-input") as HTMLInputElement;

    await userEvent.upload(input, new File(["x"], "doc.pdf", { type: "application/pdf" }), { applyAccept: false });
    expect(onError).toHaveBeenLastCalledWith("Only JPG, JPEG, PNG and WEBP images are allowed");
    expect(onChange).not.toHaveBeenCalled();

    const leaf = new File([new Uint8Array(100)], "leaf.jpg", { type: "image/jpeg" });
    await userEvent.upload(input, leaf);
    expect(onError).toHaveBeenLastCalledWith(null);
    expect(onChange).toHaveBeenCalledWith(leaf);
  });

  it("offers a camera capture input for mobile", () => {
    wrap(<ImageUploader file={null} onChange={() => {}} onError={() => {}} />);
    expect(screen.getByTestId("camera-input")).toHaveAttribute("capture", "environment");
    expect(screen.getByRole("button", { name: /Use Camera/i })).toBeInTheDocument();
  });
});

describe("Register form validation", () => {
  it("shows field errors and blocks submit when invalid", async () => {
    wrap(<RegisterPage />);
    await userEvent.type(screen.getByLabelText("Email"), "bad-email");
    await userEvent.type(screen.getByLabelText("Password"), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("At least 8 characters, with a letter and a number")).toBeInTheDocument();
    expect(screen.getAllByText("This field is required").length).toBeGreaterThanOrEqual(2);
  });

  it("does not allow choosing the Admin role publicly", () => {
    wrap(<RegisterPage />);
    expect(screen.getByRole("option", { name: "Admin" })).toBeDisabled();
  });
});

describe("Login form validation", () => {
  it("requires email and password", async () => {
    wrap(<LoginPage />, "hi");
    await userEvent.click(screen.getByRole("button", { name: "लॉगिन करें" }));
    expect(screen.getAllByText("यह जानकारी ज़रूरी है")).toHaveLength(2);
  });
});
