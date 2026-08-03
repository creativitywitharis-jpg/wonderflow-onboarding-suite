import aurora from "@/assets/aurora.jpg";

export function Backdrop({ intensity = 1 }: { intensity?: number }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <img
        src={aurora}
        alt=""
        width={1920}
        height={1088}
        className="float-slow absolute inset-0 h-full w-full scale-110 object-cover"
        style={{ opacity: 0.55 * intensity }}
      />
      <div className="veil absolute inset-0" />
      <div className="absolute inset-0 bg-background/55" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}