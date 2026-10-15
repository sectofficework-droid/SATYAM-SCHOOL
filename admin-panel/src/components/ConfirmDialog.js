"use client";

import { useState, useCallback, useRef } from "react";

// Promise-based replacement for window.confirm(). A native confirm() blocks
// the page outside React's control - any automated tool driving the page
// (browser automation, future E2E tests) hangs on it with no way to click
// through, and it's an unstyled browser-chrome popup inconsistent with the
// rest of the app's modals. This renders the same "are you sure" prompt as
// an ordinary in-page modal instead - Cancel/Confirm are just buttons,
// clickable by a user or a script exactly like any other element on the
// page.
//
// Usage inside a component:
//   const { confirm, ConfirmDialog } = useConfirm();
//   ...
//   if (!(await confirm("Delete this row?"))) return;
//   ...
//   return <div>...{ConfirmDialog}</div>;
export default function useConfirm() {
  const [state, setState] = useState(null); // { message, title, confirmLabel } | null
  const resolveRef = useRef(null);

  const confirm = useCallback((message, { title = "Please Confirm", confirmLabel = "Delete" } = {}) => {
    return new Promise(resolve => {
      resolveRef.current = resolve;
      setState({ message, title, confirmLabel });
    });
  }, []);

  function respond(result) {
    setState(null);
    const resolve = resolveRef.current;
    resolveRef.current = null;
    if (resolve) resolve(result);
  }

  const ConfirmDialog = state ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => respond(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-gray-800">{state.title}</h3>
        <p className="text-sm text-gray-600 whitespace-pre-line">{state.message}</p>
        <div className="flex justify-end gap-2 mt-1">
          <button onClick={() => respond(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => respond(true)} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700">
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmDialog };
}
