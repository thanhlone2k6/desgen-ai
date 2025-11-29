import React, { useEffect, useRef } from 'react';

interface IntroAnimationProps {
  onComplete: () => void;
}

export const IntroAnimation: React.FC<IntroAnimationProps> = ({ onComplete }) => {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const timer = setTimeout(() => {
      onCompleteRef.current();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <h1 style={{
        color: 'white',
        fontSize: '48px',
        fontWeight: 'bold',
        marginBottom: '16px',
      }}>
        DesignGen Pro
      </h1>
      <p style={{
        color: '#94a3b8',
        fontSize: '16px',
      }}>
        Loading...
      </p>
    </div>
  );
};
