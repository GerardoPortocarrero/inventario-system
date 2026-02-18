import { useState, useEffect } from 'react';

/**
 * Hook personalizado para detectar si una media query de CSS coincide.
 * @param query La media query a evaluar (ej. '(max-width: 768px)').
 * @returns `true` si la media query coincide, `false` en caso contrario.
 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Obtenemos el objeto MediaQueryList
    const media = window.matchMedia(query);
    
    // Si el estado actual es diferente al de la media query, lo actualizamos
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    // Creamos un listener para observar los cambios
    const listener = () => setMatches(media.matches);
    
    // Añadimos el listener. Usamos el método moderno addEventListener si está disponible.
    try {
      media.addEventListener('change', listener);
    } catch (e) {
      // Fallback para navegadores más antiguos
      media.addListener(listener);
    }
    
    // Función de limpieza para remover el listener cuando el componente se desmonte
    return () => {
      try {
        media.removeEventListener('change', listener);
      } catch (e) {
        // Fallback para navegadores más antiguos
        media.removeListener(listener);
      }
    };
  }, [matches, query]);

  return matches;
}

export default useMediaQuery;
