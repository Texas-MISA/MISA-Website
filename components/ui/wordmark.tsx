// Text recreation of the txmisa.org wordmark: lowercase "misa" with a
// robot-antenna dot over the i, letterspaced "TEXAS" beneath. The original is
// an image asset; this keeps the repo free of copied files and stays crisp at
// any size.
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`flex flex-col items-center leading-none text-white ${className}`}
      aria-label="Texas MISA"
    >
      <span className="relative font-sans text-3xl font-semibold tracking-tight">
        {/* The antenna: a short stem with a ball, sitting where the i's dot
            would be. aria-hidden since the label above carries the name. */}
        <span
          aria-hidden="true"
          className="absolute left-[1.72em] -top-[0.30em] flex flex-col items-center"
        >
          <span className="h-[0.16em] w-[0.16em] rounded-full bg-white" />
          <span className="h-[0.14em] w-[0.05em] bg-white" />
        </span>
        misa
      </span>
      <span className="mt-0.5 font-sans text-[0.6rem] font-medium tracking-[0.42em] indent-[0.42em]">
        TEXAS
      </span>
    </span>
  );
}
