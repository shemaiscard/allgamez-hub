interface CalibrationEmblemProps {
  className?: string;
}

export function CalibrationEmblem({ className = 'w-9 h-9' }: CalibrationEmblemProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="10"
        fill="#111827"
      />
      <circle
        cx="20"
        cy="20"
        r="11"
        stroke="#FAFAFA"
        strokeWidth="1.75"
        strokeOpacity="0.32"
      />
      <path
        d="M20 9 A11 11 0 0 1 31 20"
        stroke="#818CF8"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <line
        x1="20"
        y1="20"
        x2="28.5"
        y2="12.5"
        stroke="#34D399"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="20"
        y1="20"
        x2="31"
        y2="20"
        stroke="#FAFAFA"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="20" cy="20" r="2.6" fill="#FAFAFA" />
    </svg>
  );
}
