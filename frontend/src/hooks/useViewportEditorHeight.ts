import { useEffect, useState } from "react";

/**
 * Altura del editor Monaco en px según el viewport (se actualiza al redimensionar).
 */
export function useViewportEditorHeight(options?: {
  min?: number;
  max?: number;
  /** Fracción de la altura de ventana (p. ej. 0.62). */
  ratio?: number;
}) {
  const min = options?.min ?? 520;
  const max = options?.max ?? 960;
  const ratio = options?.ratio ?? 0.62;
  const [height, setHeight] = useState(min);

  useEffect(() => {
    function compute() {
      const v = Math.round(window.innerHeight * ratio);
      setHeight(Math.min(Math.max(v, min), max));
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [min, max, ratio]);

  return height;
}
