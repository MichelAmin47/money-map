import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Inloggen met e-mailadres en wachtwoord. Registreren en wachtwoord vergeten
 * zitten bewust niet in de app: het account bestaat al in Supabase.
 */
export function Inloggen({ supabase }: { supabase: SupabaseClient }) {
  const [email, setEmail] = useState(() => localStorage.getItem("hb-email") ?? "");
  const [wachtwoord, setWachtwoord] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const logIn = async () => {
    const adres = email.trim();
    if (!adres) return setFout("Vul je e-mailadres in.");
    if (!wachtwoord) return setFout("Vul je wachtwoord in.");
    setBezig(true);
    setFout(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: adres,
        password: wachtwoord,
      });
      if (error) {
        setFout(
          error.status === 400 || /invalid login credentials/i.test(error.message)
            ? "E-mailadres of wachtwoord klopt niet."
            : `Inloggen lukte niet: ${error.message}`,
        );
        return;
      }
      // Bij succes meldt onAuthStateChange de sessie en verdwijnt dit scherm.
      localStorage.setItem("hb-email", adres);
    } catch {
      setFout("Inloggen lukte niet. Heb je verbinding?");
    } finally {
      setBezig(false);
    }
  };

  return (
    <main className="hb-root hb-inlog">
      <div className="hb-inlog-stempel" aria-hidden="true">
        V
      </div>
      <h1>Huishoudboek</h1>
      <form
        className="hb-formulier"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void logIn();
        }}
      >
        <label className="hb-veldlabel">
          <span>E-mailadres</span>
          <input
            className="hb-veld"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="hb-veldlabel">
          <span>Wachtwoord</span>
          <input
            className="hb-veld"
            type="password"
            name="password"
            autoComplete="current-password"
            enterKeyHint="go"
            value={wachtwoord}
            onChange={(e) => setWachtwoord(e.target.value)}
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
      </form>
    </main>
  );
}
