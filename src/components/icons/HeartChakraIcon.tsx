import React from 'react';

interface HeartChakraIconProps {
  className?: string;
  size?: number;
}

const HeartChakraIcon: React.FC<HeartChakraIconProps> = ({ className = "", size = 40 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer circle with glow */}
      <circle
        cx="50"
        cy="50"
        r="45"
        stroke="currentColor"
        strokeWidth="2"
        className="opacity-30"
      />
      
      {/* 12 petals of the Heart Chakra */}
      {[...Array(12)].map((_, i) => (
        <ellipse
          key={i}
          cx="50"
          cy="25"
          rx="8"
          ry="18"
          fill="currentColor"
          className="opacity-80"
          transform={`rotate(${i * 30} 50 50)`}
        />
      ))}
      
      {/* Inner circle */}
      <circle
        cx="50"
        cy="50"
        r="20"
        fill="currentColor"
        className="opacity-40"
      />
      
      {/* Two intersecting triangles (Star of David - Heart Chakra symbol) */}
      <polygon
        points="50,30 65,55 35,55"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <polygon
        points="50,70 35,45 65,45"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      
      {/* Center dot */}
      <circle
        cx="50"
        cy="50"
        r="5"
        fill="currentColor"
      />
    </svg>
  );
};

export default HeartChakraIcon;
