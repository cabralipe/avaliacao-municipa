/**
 * Remove todos os caracteres não numéricos de uma string
 */
export function removeNonNumeric(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formata um CPF no padrão XXX.XXX.XXX-XX
 */
export function formatCPF(value: string): string {
  // Remove caracteres não numéricos
  const numericValue = removeNonNumeric(value);
  
  // Limita a 11 dígitos
  const limitedValue = numericValue.slice(0, 11);
  
  // Aplica a formatação
  if (limitedValue.length <= 3) {
    return limitedValue;
  } else if (limitedValue.length <= 6) {
    return `${limitedValue.slice(0, 3)}.${limitedValue.slice(3)}`;
  } else if (limitedValue.length <= 9) {
    return `${limitedValue.slice(0, 3)}.${limitedValue.slice(3, 6)}.${limitedValue.slice(6)}`;
  } else {
    return `${limitedValue.slice(0, 3)}.${limitedValue.slice(3, 6)}.${limitedValue.slice(6, 9)}-${limitedValue.slice(9)}`;
  }
}

/**
 * Remove a formatação do CPF, mantendo apenas os números
 */
export function unformatCPF(value: string): string {
  return removeNonNumeric(value);
}

/**
 * Valida se um CPF é válido (apenas formato, não verifica dígitos verificadores)
 */
export function isValidCPFFormat(cpf: string): boolean {
  const numericCPF = removeNonNumeric(cpf);
  return numericCPF.length === 11;
}