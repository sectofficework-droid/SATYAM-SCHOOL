"use client";

// Single-handle 0-100% threshold slider - the same idea as a budget filter
// slider, but instead of picking a min/max range, dragging the one handle
// picks a split point: everything below goes one way, everything at/above
// goes the other. Used by the Syllabus module's Growth Analytics to divide
// teachers/classes into "behind" and "on track" at whatever bar the admin
// chooses.
export default function ThresholdSlider({ value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-medium text-gray-400 w-6">0%</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-2 rounded-full appearance-none bg-gray-200 accent-school-navy cursor-pointer"
      />
      <span className="text-[11px] font-medium text-gray-400 w-9">100%</span>
      <span className="text-sm font-bold text-school-navy w-14 text-right flex-shrink-0">{value}%</span>
    </div>
  );
}
