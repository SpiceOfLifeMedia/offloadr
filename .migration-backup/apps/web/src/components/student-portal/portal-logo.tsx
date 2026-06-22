/**
 * PortalLogo — dark-canvas Offloadr lockup.
 *
 * Colored bars icon (logo-icon.png) + white typeset "Offloadr" wordmark.
 * Honors "colored icon + white wordmark, do NOT use the flat all-white logo"
 * by treating the icon as the brand asset and the wordmark as supporting type.
 */
const ICON_URL = `${import.meta.env.BASE_URL}logo-icon.png`;

interface Props {
  size?: "sm" | "md";
}

export default function PortalLogo({ size = "md" }: Props) {
  const iconH = size === "sm" ? 22 : 26;
  const textCls =
    size === "sm" ? "text-base font-semibold" : "text-lg font-semibold";
  return (
    <div className="inline-flex items-center gap-2.5" aria-label="Offloadr">
      <img
        src={ICON_URL}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{ height: iconH, width: "auto", display: "block" }}
      />
      <span
        className={`${textCls} tracking-tight text-white`}
        style={{ letterSpacing: "-0.01em" }}
      >
        Offloadr
      </span>
    </div>
  );
}
