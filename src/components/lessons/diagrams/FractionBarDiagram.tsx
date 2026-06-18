import { getDiagramDataNumber } from "@/lib/lessons/diagrams";

type Props = {
  data?: Record<string, unknown>;
  className?: string;
};

export function FractionBarDiagram({ data, className }: Props) {
  const numerator = Math.max(0, getDiagramDataNumber(data, "numerator", 1));
  const denominator = Math.max(1, getDiagramDataNumber(data, "denominator", 4));
  const shaded = Math.min(numerator, denominator);
  const segments = Array.from({ length: denominator }, (_, index) => index < shaded);

  return (
    <svg
      viewBox={`0 0 ${denominator * 40} 48`}
      className={className}
      role="img"
      aria-hidden="true"
    >
      {segments.map((isShaded, index) => (
        <rect
          key={index}
          x={index * 40 + 2}
          y={8}
          width={36}
          height={32}
          rx={4}
          fill={isShaded ? "rgba(45,212,191,0.75)" : "rgba(255,255,255,0.08)"}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={1.5}
        />
      ))}
      <text
        x={(denominator * 40) / 2}
        y={44}
        textAnchor="middle"
        fill="rgba(255,255,255,0.7)"
        fontSize={12}
      >
        {shaded}/{denominator}
      </text>
    </svg>
  );
}
