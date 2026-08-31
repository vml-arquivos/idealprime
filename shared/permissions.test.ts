import { describe, expect, it } from "vitest";
import { BUYER_DEFAULT_PERMISSIONS, PERMISSIONS, STAFF_DEFAULT_PERMISSIONS, hasPermission } from "./permissions";

describe("permissions", () => {
  it("gives administrators full access regardless of stored list", () => {
    expect(hasPermission([], PERMISSIONS.USERS, "admin")).toBe(true);
  });

  it("keeps staff access manual when the user is not an administrator", () => {
    expect(hasPermission([PERMISSIONS.B2B_CATALOG], PERMISSIONS.B2B_CATALOG, "user")).toBe(true);
    expect(hasPermission([PERMISSIONS.B2B_CATALOG], PERMISSIONS.USERS, "user")).toBe(false);
  });

  it("defines safe defaults for staff and business buyers", () => {
    expect(STAFF_DEFAULT_PERMISSIONS).toContain(PERMISSIONS.B2B_OPERATIONS);
    expect(BUYER_DEFAULT_PERMISSIONS).toContain(PERMISSIONS.B2B_QUOTES);
    expect(BUYER_DEFAULT_PERMISSIONS).not.toContain(PERMISSIONS.USERS);
  });
});
