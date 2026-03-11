'use client';

import { useEffect, useRef } from 'react';

/**
 * A custom React hook that logs to the console the properties that have changed
 * between renders of a component. This is useful for debugging unnecessary re-renders.
 *
 * @param {string} name - The name of the component to display in the log.
 * @param {object} props - The component's current props.
 */
export function useWhyDidYouUpdate(name: string, props: any) {
  // Get a mutable ref object where we can store props for comparison next time this hook runs.
  const previousProps = useRef<any>();

  useEffect(() => {
    if (previousProps.current) {
      // Get all keys from both previous and current props
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      // Use this object to keep track of changed props
      const changesObj: any = {};
      // Iterate over keys
      allKeys.forEach(key => {
        // If previous is different from current
        if (previousProps.current[key] !== props[key]) {
          // Add to changesObj
          changesObj[key] = {
            from: previousProps.current[key],
            to: props[key],
          };
        }
      });

      // If changesObj is not empty, log to console
      if (Object.keys(changesObj).length) {
        console.log('[why-did-you-update]', name, changesObj);
      }
    }

    // Finally, update previousProps with current props for next hook run
    previousProps.current = props;
  });
}
