import { type ComponentProps, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useStaat } from "./context";
import { UitgaveFormulier } from "./UitgaveFormulier";

type Props = Omit<ComponentProps<typeof UitgaveFormulier>, "bestaande" | "autoFocus" | "onKlaar">;

/**
 * Schuif zo dat het hele formulier boven het toetsenbord staat. Past het niet,
 * dan komt de bovenkant (het bedragveld) bovenaan in beeld.
 */
function brengInBeeld(el: HTMLElement) {
  const hoogte = window.visualViewport?.height ?? window.innerHeight;
  const { top, bottom } = el.getBoundingClientRect();
  const marge = 8;
  if (bottom + marge <= hoogte && top >= marge) return;
  const omlaag = Math.min(top - marge, bottom + marge - hoogte);
  if (omlaag !== 0) window.scrollBy(0, omlaag);
}

/**
 * Invoer voor een nieuwe uitgave, ingeklapt achter de knop "+ Uitgave". Zo
 * krijgt bij het openen van een scherm geen veld focus en blijft het
 * toetsenbord weg tot de gebruiker zelf wil invoeren. Open blijft het
 * formulier staan tot "Klaar"; het klapt vanzelf in zodra het scherm, de week
 * of de periode wisselt, omdat dit onderdeel dan opnieuw wordt opgebouwd.
 */
export function UitgaveInvoer(props: Props) {
  const { alleenLezen } = useStaat();
  const [open, setOpen] = useState(false);
  const vakRef = useRef<HTMLDivElement>(null);
  const knopRef = useRef<HTMLButtonElement>(null);

  // Het toetsenbord komt pas na de tik omhoog: schuif nog eens zodra het
  // zichtbare deel van het scherm kleiner wordt.
  useEffect(() => {
    if (!open) return;
    const schuif = () => vakRef.current && brengInBeeld(vakRef.current);
    schuif();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", schuif);
    return () => vv?.removeEventListener("resize", schuif);
  }, [open]);

  if (alleenLezen) {
    // Storing: de knop blijft staan, zichtbaar uit, met de reden erbij.
    return (
      <div className="hb-invoer-uit">
        <button type="button" className="hb-knop hb-knop-hoofd hb-invoer-open" disabled>
          + Uitgave
        </button>
        <p className="hb-hint">Geen verbinding: invoeren kan weer zodra Supabase reageert.</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        ref={knopRef}
        type="button"
        className="hb-knop hb-knop-hoofd hb-invoer-open"
        aria-expanded={false}
        // flushSync: het formulier staat er nog binnen deze tik, zodat iOS de
        // focus op het bedragveld toestaat en het toetsenbord toont.
        onClick={() => flushSync(() => setOpen(true))}
      >
        + Uitgave
      </button>
    );
  }

  return (
    <div className="hb-invoer-vak" ref={vakRef}>
      <div className="hb-invoer-kop">
        <h3>Nieuwe uitgave</h3>
        <button
          type="button"
          className="hb-knop hb-knop-rustig"
          onClick={() => {
            flushSync(() => setOpen(false));
            knopRef.current?.focus({ preventScroll: true });
          }}
        >
          Klaar
        </button>
      </div>
      <UitgaveFormulier {...props} autoFocus />
    </div>
  );
}
