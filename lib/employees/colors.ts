export const EMPLOYEE_COLORS = [
  { id: "indigo", label: "Indigo", gradient: "from-indigo-500 to-violet-600" },
  { id: "blue", label: "Blue", gradient: "from-blue-500 to-cyan-600" },
  { id: "emerald", label: "Emerald", gradient: "from-emerald-500 to-teal-600" },
  { id: "amber", label: "Amber", gradient: "from-amber-500 to-orange-600" },
  { id: "rose", label: "Rose", gradient: "from-rose-500 to-pink-600" },
  { id: "violet", label: "Violet", gradient: "from-violet-500 to-purple-600" },
  { id: "sky", label: "Sky", gradient: "from-sky-500 to-blue-600" },
  { id: "lime", label: "Lime", gradient: "from-lime-500 to-green-600" },
] as const;

export type EmployeeColorId = (typeof EMPLOYEE_COLORS)[number]["id"];

export const DEFAULT_EMPLOYEE_COLOR: EmployeeColorId = "indigo";

export function isEmployeeColorId(value: string): value is EmployeeColorId {
  return EMPLOYEE_COLORS.some((color) => color.id === value);
}

export function getEmployeeColorGradient(colorId: string) {
  return (
    EMPLOYEE_COLORS.find((color) => color.id === colorId)?.gradient ??
    EMPLOYEE_COLORS[0].gradient
  );
}

export function getEmployeeInitials(fullName: string) {
  return fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
