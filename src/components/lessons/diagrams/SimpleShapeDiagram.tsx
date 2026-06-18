import { getDiagramDataString } from "@/lib/lessons/diagrams";

type Props = {
  data?: Record<string, unknown>;
  className?: string;
};

export function SimpleShapeDiagram({ data, className }: Props) {
  const shape = getDiagramDataString(data, "shape", "rectangle").toLowerCase();

  if (shape === "circle") {
    return (
      <svg viewBox="0 0 160 120" className={className} role="img" aria-hidden="true">
        <circle cx={80} cy={60} r={42} fill="rgba(45,212,191,0.2)" stroke="rgba(45,212,191,0.85)" strokeWidth={2.5} />
      </svg>
    );
  }

  if (shape === "triangle") {
    return (
      <svg viewBox="0 0 160 120" className={className} role="img" aria-hidden="true">
        <polygon
          points="80,18 140,98 20,98"
          fill="rgba(45,212,191,0.2)"
          stroke="rgba(45,212,191,0.85)"
          strokeWidth={2.5}
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 160 120" className={className} role="img" aria-hidden="true">
      <rect
        x={28}
        y={24}
        width={104}
        height={72}
        rx={8}
        fill="rgba(45,212,191,0.2)"
        stroke="rgba(45,212,191,0.85)"
        strokeWidth={2.5}
      />
    </svg>
  );
}
