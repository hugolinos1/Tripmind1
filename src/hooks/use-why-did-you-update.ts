
'use client';

import { useEffect, useRef } from 'react';

/**
 * Un hook React personnalisé qui aide à déboguer les re-rendus des composants.
 * Il affiche dans la console les props qui ont changé entre les rendus.
 *
 * @param name Le nom du composant à afficher dans les logs de la console.
 * @param props Les props du composant.
 */
export function useWhyDidYouUpdate(name: string, props: Record<string, any>) {
  const previousProps = useRef<Record<string, any>>();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && previousProps.current) {
      // Obtenir toutes les clés des props précédentes et actuelles
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      // Utiliser cet objet pour suivre les props qui ont changé
      const changesObj: Record<string, { from: any; to: any }> = {};

      allKeys.forEach((key) => {
        // Si la prop n'est pas égale
        if (previousProps.current && previousProps.current[key] !== props[key]) {
          // L'ajouter à changesObj
          changesObj[key] = {
            from: previousProps.current[key],
            to: props[key],
          };
        }
      });

      // Si changesObj n'est pas vide, l'afficher dans la console
      if (Object.keys(changesObj).length) {
        console.log('[why-did-you-update]', name, changesObj);
      }
    }

    // Finalement, mettre à jour previousProps avec les props actuelles pour le prochain rendu
    previousProps.current = props;
  });
}
