import { useEffect, useRef, type ReactNode } from "react";

/** Een venster dat van onderen in beeld komt (native <dialog>, dus met focus-val en Escape). */
export function Blad({
  titel,
  onSluit,
  children,
}: {
  titel: string;
  onSluit: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialoog = ref.current;
    if (dialoog && !dialoog.open) dialoog.showModal();
    return () => dialoog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="hb-blad"
      onCancel={(e) => {
        e.preventDefault();
        onSluit();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onSluit();
      }}
    >
      <div className="hb-blad-inhoud">
        <header className="hb-blad-kop">
          <h2>{titel}</h2>
          <button className="hb-icoonknop" onClick={onSluit} aria-label="Sluiten">
            ×
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
