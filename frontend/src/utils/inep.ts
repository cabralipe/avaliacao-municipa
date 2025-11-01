/**
 * Remove todos os caracteres não numéricos de uma string
 */
export function removeNonNumeric(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Aplica máscara ao código INEP (8 dígitos numéricos)
 * Não aplica formatação especial, apenas limita a 8 dígitos
 */
export function formatINEP(value: string): string {
  const numericOnly = removeNonNumeric(value);
  return numericOnly.slice(0, 8);
}

/**
 * Remove a formatação do código INEP (retorna apenas números)
 * Como não há formatação especial, apenas remove caracteres não numéricos
 */
export function unformatINEP(value: string): string {
  return removeNonNumeric(value);
}

/**
 * Valida se o código INEP tem exatamente 8 dígitos numéricos
 */
export function validateINEP(value: string): boolean {
  const numericOnly = removeNonNumeric(value);
  return numericOnly.length === 8;
}