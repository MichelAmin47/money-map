export interface OpslagStatus {
  /** Aantal wijzigingen dat nog niet is opgeslagen. */
  wachtend: number;
  /** Foutmelding van de laatste mislukte poging, of null. */
  fout: string | null;
}

/**
 * Slaat wijzigingen één voor één en in volgorde op. Mislukt er één, dan stopt
 * de rij: latere wijzigingen wachten tot de mislukte opnieuw gelukt is, zodat
 * er nooit een oudere versie over een nieuwere heen geschreven wordt.
 */
export class Wachtrij {
  private rij: (() => Promise<void>)[] = [];
  private bezig = false;
  private fout: string | null = null;

  constructor(private meld: (status: OpslagStatus) => void) {}

  get status(): OpslagStatus {
    return { wachtend: this.rij.length, fout: this.fout };
  }

  voegToe(taak: () => Promise<void>): void {
    this.rij.push(taak);
    this.meld(this.status);
    if (!this.fout) void this.draai();
  }

  /** Probeert de mislukte wijziging (en alles wat erachter wacht) opnieuw. */
  opnieuw(): void {
    this.fout = null;
    this.meld(this.status);
    void this.draai();
  }

  private async draai(): Promise<void> {
    if (this.bezig) return;
    this.bezig = true;
    while (this.rij.length > 0 && !this.fout) {
      try {
        await this.rij[0]!();
        this.rij.shift();
      } catch (e) {
        this.fout = e instanceof Error ? e.message : String(e);
      }
      this.meld(this.status);
    }
    this.bezig = false;
  }
}
