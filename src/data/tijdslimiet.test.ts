import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isAuthVerzoek,
  isStoring,
  maakFetchMetTijdslimiet,
  metTijdslimiet,
  TijdslimietFout,
} from "./tijdslimiet";

afterEach(() => {
  vi.useRealTimers();
});

describe("metTijdslimiet", () => {
  it("geeft de uitkomst door als die op tijd komt", async () => {
    await expect(metTijdslimiet(Promise.resolve(7), 100)).resolves.toBe(7);
  });

  it("geeft een fout van de belofte door", async () => {
    await expect(metTijdslimiet(Promise.reject(new Error("stuk")), 100)).rejects.toThrow("stuk");
  });

  it("geeft een TijdslimietFout als het te lang duurt", async () => {
    vi.useFakeTimers();
    const uitkomst = metTijdslimiet(new Promise(() => {}), 10_000);
    const verwacht = expect(uitkomst).rejects.toBeInstanceOf(TijdslimietFout);
    await vi.advanceTimersByTimeAsync(10_000);
    await verwacht;
  });
});

describe("isStoring", () => {
  it("herkent time-outs en netwerkfouten", () => {
    expect(isStoring(new TijdslimietFout(10_000))).toBe(true);
    expect(isStoring(new TypeError("Failed to fetch"))).toBe(true);
    expect(isStoring(new TypeError("Load failed"))).toBe(true);
    expect(isStoring(new Error("TypeError: Failed to fetch"))).toBe(true);
    expect(isStoring({ name: "AuthRetryableFetchError", message: "x", status: 0 })).toBe(true);
    expect(isStoring({ name: "AbortError", message: "aborted" })).toBe(true);
  });

  it("ziet een fout wachtwoord of een databasefout niet als storing", () => {
    expect(isStoring({ name: "AuthApiError", message: "Invalid login credentials", status: 400 })).toBe(
      false,
    );
    expect(isStoring(new Error("permission denied for table hb_uitgaven"))).toBe(false);
    expect(isStoring(null)).toBe(false);
    expect(isStoring("kapot")).toBe(false);
  });
});

describe("maakFetchMetTijdslimiet", () => {
  /** Een fetch die nooit antwoordt, maar wel stopt als het signaal afbreekt. */
  const hangendeFetch = vi.fn<typeof fetch>(
    (_invoer, init) =>
      new Promise((_klaar, mis) => {
        init?.signal?.addEventListener("abort", () => mis(init.signal!.reason));
      }),
  );

  it("breekt een Auth-verzoek na de tijdslimiet af", async () => {
    vi.useFakeTimers();
    const f = maakFetchMetTijdslimiet(10_000, isAuthVerzoek, hangendeFetch);
    const uitkomst = f("https://x.supabase.co/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
    });
    const verwacht = expect(uitkomst).rejects.toBeInstanceOf(TijdslimietFout);
    await vi.advanceTimersByTimeAsync(10_000);
    await verwacht;
  });

  it("laat andere verzoeken (zoals de import) ongemoeid", async () => {
    const basis = vi.fn<typeof fetch>(async () => new Response("[]"));
    const f = maakFetchMetTijdslimiet(10, isAuthVerzoek, basis);
    const init = { method: "POST" };
    await f("https://x.supabase.co/rest/v1/hb_vaste_lasten", init);
    expect(basis).toHaveBeenCalledWith("https://x.supabase.co/rest/v1/hb_vaste_lasten", init);
  });

  it("geeft een op tijd gekomen antwoord gewoon door", async () => {
    const basis = vi.fn<typeof fetch>(async () => new Response("ok"));
    const f = maakFetchMetTijdslimiet(10_000, isAuthVerzoek, basis);
    const antwoord = await f("https://x.supabase.co/auth/v1/token", {});
    expect(await antwoord.text()).toBe("ok");
  });

  it("houdt een afbreeksignaal van de aanroeper in stand", async () => {
    const f = maakFetchMetTijdslimiet(10_000, isAuthVerzoek, hangendeFetch);
    const eigen = new AbortController();
    const uitkomst = f("https://x.supabase.co/auth/v1/user", { signal: eigen.signal });
    eigen.abort(new Error("zelf afgebroken"));
    await expect(uitkomst).rejects.toThrow("zelf afgebroken");
  });
});
