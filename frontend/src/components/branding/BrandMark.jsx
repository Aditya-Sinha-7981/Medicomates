/**
 * App logo — single asset used on splash, session intro, shell, and auth.
 * File lives at `frontend/public/medicomates-logo.png`.
 */
export default function BrandMark({
  className = "h-10 w-10",
  alt = "MedicoMates",
  ...rest
}) {
  return (
    <img
      src="/medicomates-logo.png"
      alt={alt}
      className={`object-contain select-none ${className}`}
      draggable={false}
      {...rest}
    />
  );
}
