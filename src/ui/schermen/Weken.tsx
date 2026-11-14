import { useState } from "react";
import { vandaagISO } from "../../logica/datum";
import { weekIndexVoorDatum } from "../../logica/weken";
import { useBeeld } from "../context";
import { UitgaveInvoer } from "../UitgaveInvoer";
import { WeekBlok } from "../WeekBlok";

export function Weken() {
  const { periode, overzicht, isLopende, bewerkbaar } = useBeeld();
  const vandaag = vandaagISO();
  const blokken = overzicht?.weken.map((w) => w.blok) ?? [];
  const nu = isLopende ? weekIndexVoorDatum(blokken, vandaag) : -1;
  const [open, setOpen] = useState<number | null>(nu >= 0 ? nu : null);

  if (!periode || !overzicht) {
    return <p className="hb-hint">Nog geen periode gestart.</p>;
  }

  return (
    <div className="hb-weken">
      <div className="hb-kolomkop">
        <span>over van de week</span>
        <span>vaste lasten</span>
        <span>persoonlijk</span>
      </div>
      {overzicht.weken.map((week, i) => {
        // Nieuwe uitgave in dit blok: vandaag als die erin valt, anders de eerste dag.
        const datum = i === nu ? vandaag : week.blok.start;
        return (
          <WeekBlok
            key={week.blok.start}
            week={week}
            open={open === i}
            onToggle={() => setOpen(open === i ? null : i)}
            isNu={i === nu}
            bewerkbaar={bewerkbaar}
          >
            {bewerkbaar && (
              <UitgaveInvoer
                key={datum}
                periodeId={periode.id}
                standaardDatum={datum}
                termijnenMogelijk={isLopende}
              />
            )}
          </WeekBlok>
        );
      })}
    </div>
  );
}
