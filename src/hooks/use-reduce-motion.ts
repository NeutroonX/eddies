import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then((isEnabled) => {
      setReduceMotion(isEnabled);
    }).catch(() => {
      setReduceMotion(false);
    });
  }, []);

  return reduceMotion;
}
