"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";

// Native <input type="date"> renders its text using the browser/OS locale,
// which is mm/dd/yyyy in Chrome regardless of the page's lang attribute.
// This wraps a masked dd-mm-yyyy text field (always correct, everywhere)
// with a hidden native date input that powers the calendar picker.
// value/onChange keep the usual ISO "yyyy-mm-dd" contract used across the app.

function isoToDmy(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

function dmyDigitsToIso(digits) {
  if (digits.length !== 8) return "";
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  const iso = `${yyyy}-${mm}-${dd}`;
  const d = new Date(iso);
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return "";
  return iso;
}

export default function DateInputDMY({
  value = "",
  onChange,
  min,
  max,
  disabled,
  required,
  name,
  id,
  className = "",
  placeholder = "DD-MM-YYYY",
}) {
  const [text, setText] = useState(isoToDmy(value));
  const hiddenRef = useRef(null);

  useEffect(() => {
    setText(isoToDmy(value));
  }, [value]);

  const fireChange = (iso) => {
    onChange?.({ target: { value: iso, name } });
  };

  const handleTextChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}-${digits.slice(2)}`;
    setText(out);

    if (digits.length === 8) fireChange(dmyDigitsToIso(digits));
    else if (digits.length === 0) fireChange("");
  };

  const openPicker = () => {
    if (disabled) return;
    const el = hiddenRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {}
    }
    el.focus();
    el.click();
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        onChange={handleTextChange}
        disabled={disabled}
        required={required}
        name={name}
        id={id}
        className={className}
        style={{ paddingRight: "1.75rem" }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Open calendar"
        onClick={openPicker}
        disabled={disabled}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-school-navy disabled:opacity-40"
      >
        <Calendar className="w-4 h-4" />
      </button>
      <input
        ref={hiddenRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value || ""}
        min={min}
        max={max}
        onChange={(e) => fireChange(e.target.value)}
        className="absolute inset-0 h-0 w-0 opacity-0"
      />
    </div>
  );
}
