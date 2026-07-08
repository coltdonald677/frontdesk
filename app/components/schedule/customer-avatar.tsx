type CustomerAvatarProps = {
  name?: string | null;
  company?: string | null;
  size?: "sm" | "md";
};

function getInitials(name?: string | null, company?: string | null) {
  const label = company?.trim() || name?.trim();
  if (!label) {
    return null;
  }

  if (company?.trim()) {
    return company
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("");
  }

  return label[0]?.toUpperCase() ?? "?";
}

export function CustomerAvatar({
  name,
  company,
  size = "sm",
}: CustomerAvatarProps) {
  const initials = getInitials(name, company);
  if (!initials) {
    return null;
  }

  const sizeClasses =
    size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";

  return (
    <div
      className={`${sizeClasses} flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-800/80 font-semibold text-zinc-300`}
      title={company?.trim() || name?.trim() || undefined}
      aria-hidden
    >
      {initials.slice(0, 2)}
    </div>
  );
}
