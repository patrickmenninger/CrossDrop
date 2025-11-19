import React from 'react';

interface NetworkNodeProps {
  x: number;
  y: number;
  r?: number;
  name: string;
  color: string;
  stroke?: string;
  strokeWidth?: number;
  onClick?: () => void;
  fontSize?: number;
  isYou?: boolean;
}

const NetworkNode: React.FC<NetworkNodeProps> = ({
  x,
  y,
  r = 60,
  name,
  color,
  stroke = '#fff',
  strokeWidth = 4,
  onClick,
  fontSize = 10,
  isYou = false,
}) => (
  <g onClick={onClick} className={onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''}>
    <circle
      cx={x}
      cy={y}
      r={r}
      fill={color}
      stroke={stroke}
      strokeWidth={strokeWidth}
      filter={isYou ? 'url(#glow)' : undefined}
      style={isYou ? {} : { filter: 'drop-shadow(0 2px 8px #0002)' }}
    />
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={fontSize}
      fill="#fff"
      fontWeight="bold"
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      {name}
    </text>
  </g>
);

export default NetworkNode;
