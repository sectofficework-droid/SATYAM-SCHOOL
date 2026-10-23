export async function getOnlineGrData() {
  const res = await fetch("/api/online-general-register", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load online general register data");
  const json = await res.json();
  return json.data;
}

export async function updateOnlineGrRow(id, section, updates) {
  const res = await fetch("/api/online-general-register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, section, updates }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update record");
  }
  const json = await res.json();
  return json.item;
}
