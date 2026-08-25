/**
 * Types mirroring the Fasteignir-Xroad OpenAPI specification
 * (Fasteignir-Xroad.json, components.schemas) so the mock and the real
 * client return identical shapes.
 */

export interface Stadfang {
  stadfanganumer?: number | null;
  landeignarnumer: number;
  postnumer?: number | null;
  sveitarfelagBirting?: string | null;
  birting?: string | null;
  birtingStutt?: string | null;
}

export interface FasteignSimple {
  fasteignanumer?: string | null;
  sjalfgefidStadfang?: Stadfang | null;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  offset: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

/** Response of GET /api/v1/fasteignir?kennitala=... */
export interface FasteignSimpleWrapper {
  fasteignir?: FasteignSimple[] | null;
  paging?: Pagination | null;
}

/**
 * The unique list of landeignarnumer (property/land ids) found in the
 * Fasteignir-Xroad response. One land can appear behind several fasteignir
 * entries (e.g. a house and an outbuilding), so the list is deduplicated.
 */
export function uniqueLandeignarnumer(
  wrapper: FasteignSimpleWrapper,
): number[] {
  const numbers: number[] = [];
  for (const fasteign of wrapper.fasteignir ?? []) {
    const num = fasteign.sjalfgefidStadfang?.landeignarnumer;
    if (num !== undefined && num !== null && !numbers.includes(num)) {
      numbers.push(num);
    }
  }
  return numbers;
}
