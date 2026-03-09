/**
 * Utilería para búsqueda multi-término consistente en todo el sistema.
 * 
 * @param item El objeto donde se buscará.
 * @param searchTerm La cadena de búsqueda ingresada por el usuario.
 * @param fields Los campos (keys) del objeto en los que se debe buscar.
 * @returns true si todas las palabras de la búsqueda están presentes en al menos uno de los campos.
 */
export const matchSearchTerms = (item: any, searchTerm: string, fields: string[]): boolean => {
  const term = searchTerm.toLowerCase().trim();
  if (!term) return true;

  const searchWords = term.split(/\s+/).filter(word => word.length > 0);
  if (searchWords.length === 0) return true;

  return searchWords.every(word => {
    return fields.some(field => {
      const value = item[field];
      if (value === undefined || value === null) return false;
      return String(value).toLowerCase().includes(word);
    });
  });
};
