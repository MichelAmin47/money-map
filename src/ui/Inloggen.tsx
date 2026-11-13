import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Inloggen met een code per e-mail (geen magic link, zie BRIEF.md). */
export function Inloggen({ supabase }: { supabase: SupabaseClient }) {
  const [email, setEmail] = useState(() => localStorage.getItem("hb-email") ?? "");
  const [stap, setStap] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const stuurCode = async () => {
    const adres = email.trim();
    if (!adres) return setFout("Vul je e-mailadres in.");
    setBezig(true);
    setFout(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: adres,
      options: { shouldCreateUser: false },
    });
    setBezig(false);
    if (error) {
      setFout(
        /signups not allowed|not found|not allowed/i.test(error.message)
          ? "Dit e-mailadres heeft geen account."
          : `Code versturen lukte niet: ${error.message}`,
      );
      return;
    }
    localStorage.setItem("hb-email", adres);
    setCode("");
    setStap("code");
  };

  const controleer = async () => {
    if (code.length < 6) return setFout("Vul de code uit de e-mail in.");
    setBezig(true);
    setFout(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: "email",
    });
    setBezig(false);
    // Bij succes meldt onAuthStateChange de sessie en verdwijnt dit scherm.
    if (error) setFout("Die code klopt niet of is verlopen. Probeer het opnieuw.");
  };

  return (
    <main className="hb-root hb-inlog">
      <div className="hb-inlog-stempel" aria-hidden="true">
        V
      </div>
      <h1>Huishoudboek</h1>
      {stap === "email" ? (
        <form
          className="hb-formulier"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void stuurCode();
          }}
        >
          <label className="hb-veldlabel">
            <span>E-mailadres</span>
            <input
              className="hb-veld"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {fout && (
            <p className="hb-veldfout" role="alert">
              {fout}
            </p>
          )}
          <button className="hb-knop hb-knop-hoofd" disabled={bezig}>
            {bezig ? "Bezig…" : "Stuur me een code"}
          </button>
        </form>
      ) : (
        <form
          className="hb-formulier"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void controleer();
          }}
        >
          <p className="hb-hint">
            Er is een code gestuurd naar <strong>{email.trim()}</strong>. Vul hem hier in; je hoeft
            niet op de link in de mail te tikken.
          </p>
          <label className="hb-veldlabel">
            <span>Code uit de e-mail</span>
            <input
              className="hb-veld hb-veld-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          {fout && (
            <p className="hb-veldfout" role="alert">
              {fout}
            </p>
          )}
          <button className="hb-knop hb-knop-hoofd" disabled={bezig}>
            {bezig ? "Bezig…" : "Inloggen"}
          </button>
          <button
            type="button"
            className="hb-knop hb-knop-rustig"
            disabled={bezig}
            onClick={() => {
              setStap("email");
              setFout(null);
            }}
          >
            Ander e-mailadres of nieuwe code
          </button>
        </form>
      )}
    </main>
  );
}
