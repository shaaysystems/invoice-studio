import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultBusinessProfile } from "@/lib/invoice/defaults";
import { localStore } from "@/lib/storage/local";
import type { BusinessProfile } from "@/types/business";

const KEY = "invoice-studio:business:v2";

/** Minimal localStorage so the store's `typeof window` guard is satisfied. */
function stubWindow() {
  const data = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    },
  };
  return data;
}

function profile(name: string): BusinessProfile {
  const entry = createDefaultBusinessProfile();
  entry.id = `id-${name.toLowerCase().replace(/\s+/g, "-")}`;
  entry.party.name = name;
  return entry;
}

let store: Map<string, string>;

beforeEach(() => {
  store = stubWindow();
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("localStore business profiles", () => {
  it("starts empty", () => {
    expect(localStore.listBusinessProfiles()).toEqual([]);
    expect(localStore.getBusinessProfile()).toBeNull();
  });

  it("keeps several profiles side by side", () => {
    localStore.saveBusinessProfile(profile("Northstar Studio"));
    localStore.saveBusinessProfile(profile("Acme Consulting"));
    localStore.saveBusinessProfile(profile("Kite Media"));

    expect(localStore.listBusinessProfiles().map((p) => p.party.name)).toEqual([
      "Northstar Studio",
      "Acme Consulting",
      "Kite Media",
    ]);
  });

  it("replaces in place instead of duplicating on re-save", () => {
    const first = profile("Northstar Studio");
    localStore.saveBusinessProfile(first);
    localStore.saveBusinessProfile({
      ...first,
      party: { ...first.party, address: { ...first.party.address, city: "Kochi" } },
    });

    const all = localStore.listBusinessProfiles();
    expect(all).toHaveLength(1);
    expect(all[0]!.party.address.city).toBe("Kochi");
  });

  it("prefills from the active profile, not the newest entry", () => {
    localStore.saveBusinessProfile(profile("Northstar Studio"));
    localStore.saveBusinessProfile(profile("Acme Consulting"));
    localStore.setActiveBusinessProfile("id-northstar-studio");

    expect(localStore.getBusinessProfile()!.party.name).toBe("Northstar Studio");
  });

  it("rejects activating an unknown id", () => {
    localStore.saveBusinessProfile(profile("Northstar Studio"));

    expect(localStore.setActiveBusinessProfile("nope")).toBe(false);
    expect(localStore.getBusinessProfile()!.party.name).toBe("Northstar Studio");
  });

  it("promotes another profile when the active one is deleted", () => {
    localStore.saveBusinessProfile(profile("Northstar Studio"));
    localStore.saveBusinessProfile(profile("Acme Consulting"));
    localStore.setActiveBusinessProfile("id-northstar-studio");

    localStore.deleteBusinessProfile("id-northstar-studio");

    expect(localStore.listBusinessProfiles()).toHaveLength(1);
    expect(localStore.getBusinessProfile()!.party.name).toBe("Acme Consulting");
  });

  it("ends up empty when the last profile is deleted", () => {
    localStore.saveBusinessProfile(profile("Northstar Studio"));
    localStore.deleteBusinessProfile("id-northstar-studio");

    expect(localStore.listBusinessProfiles()).toEqual([]);
    expect(localStore.getBusinessProfile()).toBeNull();
  });

  it("looks a profile up by id for the editor route", () => {
    localStore.saveBusinessProfile(profile("Northstar Studio"));
    localStore.saveBusinessProfile(profile("Acme Consulting"));

    expect(localStore.getBusinessProfileById("id-acme-consulting")!.party.name).toBe("Acme Consulting");
    expect(localStore.getBusinessProfileById("id-missing")).toBeNull();
  });

  it("replaces the whole list, used after a cloud read", () => {
    localStore.saveBusinessProfile(profile("Guest Draft"));
    localStore.replaceBusinessProfiles([profile("Northstar Studio"), profile("Acme Consulting")], "id-acme-consulting");

    expect(localStore.listBusinessProfiles().map((p) => p.party.name)).toEqual([
      "Northstar Studio",
      "Acme Consulting",
    ]);
    expect(localStore.getBusinessProfile()!.party.name).toBe("Acme Consulting");
  });

  it("drops the active id when the replaced list no longer contains it", () => {
    localStore.saveBusinessProfile(profile("Guest Draft"));
    localStore.replaceBusinessProfiles([profile("Northstar Studio")], "id-guest-draft");

    expect(localStore.getBusinessProfile()!.party.name).toBe("Northstar Studio");
  });
});

describe("localStore legacy profile shape", () => {
  it("lifts a single bare profile into a one-item list", () => {
    store.set(KEY, JSON.stringify(profile("Northstar Studio")));

    const all = localStore.listBusinessProfiles();
    expect(all).toHaveLength(1);
    expect(all[0]!.party.name).toBe("Northstar Studio");
    expect(localStore.getBusinessProfile()!.id).toBe(all[0]!.id);
  });

  it("ignores a corrupt entry rather than throwing", () => {
    store.set(KEY, JSON.stringify({ profiles: "not-a-list", activeId: 7 }));

    expect(localStore.listBusinessProfiles()).toEqual([]);
    expect(localStore.getBusinessProfile()).toBeNull();
  });

  it("skips corrupt entries inside a list", () => {
    const good = profile("Northstar Studio");
    store.set(KEY, JSON.stringify({ profiles: [good, null, 42], activeId: good.id }));

    expect(localStore.listBusinessProfiles()).toHaveLength(1);
  });
});
