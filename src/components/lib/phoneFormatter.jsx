/**
 * Formata um número de telefone para o padrão mundial: +xx (xx) xxxx-xxxx
 * @param {string} phone - Número de telefone sem formatação (apenas números e +)
 * @returns {string} Número formatado ou string vazia se inválido
 */
export function formatPhoneNumber(phone) {
  if (!phone) return "";
  
  // Remove espaços, hífens, parênteses, mas mantém o + e números
  const cleaned = phone.replace(/[^\d+]/g, "");
  
  // Se não tem +, assume que é Brasil
  if (!cleaned.startsWith("+")) {
    // Se tem 11 dígitos, adiciona +55
    if (cleaned.length === 11) {
      return formatPhoneNumber("+" + "55" + cleaned);
    }
    // Se tem 10 dígitos, assume que é número sem 9º dígito
    if (cleaned.length === 10) {
      return formatPhoneNumber("+" + "55" + cleaned);
    }
    // Se tem menos de 10, retorna como está
    if (cleaned.length < 10) {
      return cleaned;
    }
  }
  
  // Extrai código do país (tudo após o + até ter 2-3 dígitos seguidos de espaço)
  const match = cleaned.match(/^\+(\d{1,3})(.*)$/);
  if (!match) return cleaned;
  
  const countryCode = match[1];
  const number = match[2];
  
  // Formata conforme o comprimento: +xx (xx) xxxx-xxxx
  // Se o número tem menos de 9 dígitos, retorna com formatação básica
  if (number.length <= 9) {
    // Formato genérico: +xx seguido dos dígitos
    return "+" + countryCode + " " + number;
  }
  
  // Formato padrão: +xx (xx) xxxx-xxxx
  // Toma os 2 primeiros dígitos (área), depois 4, depois o resto
  const areaCode = number.slice(0, 2);
  const part1 = number.slice(2, 6);
  const part2 = number.slice(6, 10);
  
  return `+${countryCode} (${areaCode}) ${part1}-${part2}`;
}

/**
 * Remove toda a formatação de um número de telefone
 * @param {string} phone - Número formatado ou não
 * @returns {string} Apenas dígitos e +
 */
export function cleanPhoneNumber(phone) {
  if (!phone) return "";
  return phone.replace(/[^\d+]/g, "");
}