// packages/ui/src/shared/TypewriterText.tsx
import React, { useState, useEffect } from 'react';

export function TypewriterText({
  text,
  speed = 30,
  onDone,
}: {
  text: string;
  speed?: number;
  onDone?: () => void;
}) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        onDone?.();
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, onDone]);

  return React.createElement('span', null, displayed);
}
