/**
 * API integration tests: the real axios client + services are used; only the HTTP transport
 * (axios adapter) is replaced by a fake server so no backend is needed.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { AxiosError } from "axios";
import { authApi, detectionApi, http, parseApiError, tokenStore } from "../services/api";
import { I18nProvider } from "../i18n";
import { AuthProvider } from "../context/AuthContext";
import { LoginPage } from "../pages/AuthPages";

type Handler = (cfg: InternalAxiosRequestConfig) => { status: number; data: unknown };
let calls: InternalAxiosRequestConfig[] = [];
const original = http.defaults.adapter;

function fakeServer(handler: Handler) {
  const adapter: AxiosAdapter = async (cfg) => {
    calls.push(cfg);
    const { status, data } = handler(cfg);
    const response = { data, status, statusText: String(status), headers: {}, config: cfg };
    if (status >= 400) throw new AxiosError("Request failed", String(status), cfg, null, response);
    return response;
  };
  http.defaults.adapter = adapter;
}

const user = { id: 1, full_name: "Ram Kumar", email: "ram@example.com", mobile: "9876543210", role: "farmer", preferred_language: "en", is_active: true, created_at: "2026-01-01T00:00:00Z" };

beforeEach(() => {
  calls = [];
  localStorage.clear();
});
afterEach(() => {
  http.defaults.adapter = original;
});

describe("services", () => {
  it("login posts credentials and unwraps the envelope", async () => {
    fakeServer(() => ({ status: 200, data: { success: true, message: "OK", data: { access_token: "abc", token_type: "bearer", user } } }));
    const r = await authApi.login("ram@example.com", "Kisan1234");
    expect(r.access_token).toBe("abc");
    expect(calls[0].url).toBe("/auth/login");
    expect(JSON.parse(calls[0].data)).toEqual({ email: "ram@example.com", password: "Kisan1234" });
  });

  it("attaches the JWT as a Bearer header", async () => {
    tokenStore.set("my-jwt");
    fakeServer(() => ({ status: 200, data: { success: true, message: "OK", data: user } }));
    await authApi.me();
    expect(calls[0].headers.Authorization).toBe("Bearer my-jwt");
  });

  it("uploads the image as multipart form data", async () => {
    fakeServer(() => ({ status: 201, data: { success: true, message: "OK", data: { id: 7 } } }));
    const file = new File([new Uint8Array(10)], "leaf.jpg", { type: "image/jpeg" });
    const r = await detectionApi.predict(file);
    expect(r.id).toBe(7);
    expect(calls[0].url).toBe("/detection/predict");
    expect(calls[0].data).toBeInstanceOf(FormData);
    expect((calls[0].data as FormData).get("file")).toBeInstanceOf(File);
  });

  it("parseApiError extracts backend error codes", async () => {
    fakeServer(() => ({ status: 503, data: { success: false, message: "Model missing", error: { code: "model_unavailable", status: 503 } } }));
    const err = await detectionApi.modelInfo().catch((e) => e);
    expect(await parseApiError(err)).toMatchObject({ code: "model_unavailable", status: 503 });
  });
});

describe("Login page ↔ API", () => {
  const renderLogin = () =>
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <I18nProvider defaultLang="en">
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard" element={<p>DASHBOARD</p>} />
            </Routes>
          </AuthProvider>
        </I18nProvider>
      </MemoryRouter>,
    );

  it("shows the translated backend error on wrong credentials", async () => {
    fakeServer(() => ({ status: 401, data: { success: false, message: "Invalid email or password", error: { code: "invalid_credentials" } } }));
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email"), "ram@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong123");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(tokenStore.get()).toBeNull();
  });

  it("stores the token and redirects to the dashboard on success", async () => {
    fakeServer(() => ({ status: 200, data: { success: true, message: "OK", data: { access_token: "tok123", token_type: "bearer", user } } }));
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email"), "ram@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Kisan1234");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));
    await waitFor(() => expect(screen.getByText("DASHBOARD")).toBeInTheDocument());
    expect(tokenStore.get()).toBe("tok123");
  });

  it("shows a network error message when the backend is down", async () => {
    http.defaults.adapter = async (cfg) => { throw new AxiosError("Network Error", "ERR_NETWORK", cfg); };
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email"), "ram@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Kisan1234");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Cannot reach the server/);
  });
});
