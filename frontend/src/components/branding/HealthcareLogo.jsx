export default function HealthcareLogo({
  iconClassName = "h-8 w-8",
  strokeClassName = "text-[#2f77b8]",
  showWordmark = false,
  wordmarkClassName = "mt-1 text-[9px] font-semibold tracking-[0.08em] text-[#2f77b8]",
}) {
  return (
    <div className="inline-flex flex-col items-center justify-center">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={`${iconClassName} ${strokeClassName}`}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 2h6v4h4v6h-4v4H9v-4H5V6h4z" />
        <path d="M12 8c-1.6-2-4-1.7-5.1-.2-1.3 1.8-.7 4.1.8 5.6L12 17l4.3-3.6c1.5-1.5 2.1-3.8.8-5.6-1.1-1.5-3.5-1.8-5.1.2Z" />
      </svg>
      {showWordmark ? <span className={wordmarkClassName}>HEALTHCARE</span> : null}
    </div>
  );
}

