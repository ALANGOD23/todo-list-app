/** Minúsculas, sin acentos ni eñes, con los límites de oración marcados como " | " para acotar negaciones. */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,;:!?¿¡()\[\]\n\r]+/g, " | ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Igual que `normalize` pero conservando la puntuación (para tokenizar búsquedas). */
export function fold(input: string): string {
  return input.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
