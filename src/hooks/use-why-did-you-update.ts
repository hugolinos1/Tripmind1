
'use client';

import React, { useEffect, useRef } from 'react';

// A custom hook that logs to the console of the browser whenever a component re-renders
export function useWhyDidYouUpdate(name: string, props: any) {
  // Get a mutable ref object where we can store props for comparison next time this hook runs.
  const previousProps = useRef<any>();

  useEffect(() => {
    if (previousProps.current) {
      // Get all keys from both previous and current props
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      // Use this object to keep track of changed props
      const changesObj: { [key: string]: { from: any, to: any } } = {};
      // Iterate over keys
      allKeys.forEach(key => {
        // If previous is different from current
        if (!Object.is(previousProps.current[key], props[key])) {
          // Add to changesObj
          changesObj[key] = { from: previousProps.current[key], to: props[key] };
        }
      });

      // If changesObj is not empty, log to console
      if (Object.keys(changesObj).length) {
        console.log('[why-did-you-update]', name, changesObj);
      }
    }

    // Finally update previousProps with current props for next hook call
    previousProps.current = props;
  });
}
