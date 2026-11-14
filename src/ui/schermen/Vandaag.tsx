import { vandaagISO } from "../../logica/datum";
import { weekIndexVoorDatum } from "../../logica/weken";
import { useBeeld } from "../context";
import { Potten } from "../Potten";
import { UitgaveFormulier } from "../UitgaveFormulier";
import { WeekBlok } from "../WeekBlok";

export function Vandaag() {
  const { periode, overzicht, isLopende, bewerkbaar } = useBeeld();

  if (!periode || !overzicht) {
    return (
      <div className="hb-welkom">
        <h2>Welkom</h2>
        <p>Er is nog geen periode. Zo begin je:</p>
        <ol>
          <li>
            Ga naar <a href="#/instellingen">Instellingen</a> en importeer je startdata, of vul je
            salaris in.
          </li>
          <li>
            Controleer je <a href="#/vast">vaste lasten</a>.
          </li>
          <li>
            Start bij <a href="#/instellingen">Instellingen</a> je eerste periode, op de dag dat je
            salaris binnenkwam.
          </li>
        </ol>
      </div>
    );
  }

  const vandaag = vandaagISO();
  const blokken = overzicht.weken.map((w) => w.blok);
  const week = isLopende ? overzicht.weken[weekIndexVoorDatum(blokken, vandaag)] : undefined;
  const voorbij = isLopende && vandaag > periode.einddatum;

  return (
    <div>
      <Potten o={overzicht} />

      {voorbij && (
        <div className="hb-melding">
          <p>
            Deze periode is voorbij. Salaris binnen? Start de nieuwe periode bij{" "}
            <a href="#/instellingen">Instellingen</a>.
          </p>
        </div>
      )}

      {week ? (
        <WeekBlok week={week} open isNu bewerkbaar={bewerkbaar}>
          <UitgaveFormulier
            periodeId={periode.id}
            standaardDatum={vandaag}
            termijnenMogelijk
            autoFocus
          />
        </WeekBlok>
      ) : (
        <p className="hb-hint">
          Dit is een eerdere periode. Bij <a href="#/weken">Weken</a> staan alle uitgaven.
        </p>
      )}
    </div>
  );
}
