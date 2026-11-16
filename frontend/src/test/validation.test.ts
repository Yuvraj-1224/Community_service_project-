import { describe, expect, it } from "vitest";
import { isStrongPassword, validateImageFile, validateLogin, validateRegister } from "../utils";
import { translate } from "../i18n";
import en from "../i18n/en.json";
import hi from "../i18n/hi.json";

const valid = { full_name: "Ram Kumar", email: "ram@example.com", mobile: "9876543210", password: "Kisan1234", confirm_password: "Kisan1234" };

describe("validateRegister", () => {
  it("accepts a valid form", () => expect(validateRegister(valid)).toEqual({}));
  it("flags empty fields as required", () => {
    const e = validateRegister({ full_name: "", email: "", mobile: "", password: "", confirm_password: "" });
    expect(Object.values(e).every((v) => v === "validation.required")).toBe(true);
    expect(Object.keys(e)).toHaveLength(5);
  });
  it("rejects bad email, mobile, weak password and mismatch", () => {
    const e = validateRegister({ ...valid, email: "ram@", mobile: "12345", password: "password", confirm_password: "other" });
    expect(e).toEqual({ email: "validation.email", mobile: "validation.mobile", password: "validation.passwordWeak", confirm_password: "validation.passwordMatch" });
  });
  it("allows spaces/dashes and +91 in mobile", () => {
    expect(validateRegister({ ...valid, mobile: "+91 98765-43210" }).mobile).toBeUndefined();
  });
});

describe("validateLogin", () => {
  it("requires email and password", () => expect(validateLogin("", "")).toEqual({ email: "validation.required", password: "validation.required" }));
  it("validates email format", () => expect(validateLogin("bad", "x").email).toBe("validation.email"));
});

describe("isStrongPassword", () => {
  it.each([["Kisan1234", true], ["short1", false], ["onlyletters", false], ["12345678", false]])("%s -> %s", (pw, ok) =>
    expect(isStrongPassword(pw)).toBe(ok));
});

describe("validateImageFile", () => {
  const f = (name: string, type: string, size = 1000) => new File([new Uint8Array(size)], name, { type });
  it("accepts jpg/png/webp", () => {
    for (const [n, t] of [["a.jpg", "image/jpeg"], ["a.png", "image/png"], ["a.webp", "image/webp"]]) expect(validateImageFile(f(n, t)).ok).toBe(true);
  });
  it("rejects other types", () => {
    expect(validateImageFile(f("a.gif", "image/gif"))).toEqual({ ok: false, reason: "fileType" });
    expect(validateImageFile(f("a.pdf", "application/pdf"))).toEqual({ ok: false, reason: "fileType" });
  });
  it("rejects files over 10 MB", () => {
    expect(validateImageFile(f("a.jpg", "image/jpeg", 10 * 1024 * 1024 + 1))).toEqual({ ok: false, reason: "fileSize" });
  });
});

describe("i18n", () => {
  const keys = (o: object, p = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
  it("Hindi and English dictionaries have the same keys", () => expect(keys(hi).sort()).toEqual(keys(en).sort()));
  it("interpolates variables", () => expect(translate("hi", "dashboard.welcome", { name: "राम" })).toBe("नमस्ते, राम!"));
  it("falls back to the key when missing", () => expect(translate("en", "nope.missing")).toBe("nope.missing"));
});
