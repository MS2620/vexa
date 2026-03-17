"use client";

export const Badge = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    className={`px-2.5 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-md border ${className}`}
  >
    {children}
  </span>
);

export const AvailabilityBadge = ({ status }: { status: string }) => {
  if (status === "available")
    return (
      <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
        Available
      </Badge>
    );
  if (status === "partial")
    return (
      <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
        Partially Available
      </Badge>
    );
  return (
    <Badge className="bg-gray-800/50 text-gray-400 border-gray-700/50">
      Not Available
    </Badge>
  );
};
