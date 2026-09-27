// Builds a CSV string from reservation records and triggers a browser download.
// Columns: Date, Start, End, Holding (site code), Holding name, Client name,
// Requester company, Source, Status.

const escapeCsv = (val) => {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const STATUS_LABEL = {
  pending: "Pending",
  confirmed: "Confirmed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const SOURCE_LABEL = {
  portal: "Portal",
  public_link: "Public link",
};

const HEADERS = [
  "Date",
  "Start",
  "End",
  "Holding (Site Code)",
  "Holding Name",
  "Client Name",
  "Requester Company",
  "Source",
  "Status",
];

export function reservationsToCsv(reservations, holdings = []) {
  const nameById = {};
  holdings.forEach((h) => {
    nameById[h.id] = h;
  });

  const rows = [...reservations]
    .filter((r) => r && r.reservation_date)
    .sort(
      (a, b) =>
        (a.reservation_date || "").localeCompare(b.reservation_date || "") ||
        (a.start_time || "").localeCompare(b.start_time || "")
    )
    .map((r) => {
      const h = nameById[r.holding_id] || {};
      return [
        r.reservation_date,
        r.start_time || "",
        r.end_time || "",
        h.site_code || "",
        h.name || r.billboard_name || "",
        r.user_name || "",
        r.requester_company || "",
        SOURCE_LABEL[r.source] || r.source || "",
        STATUS_LABEL[r.status] || r.status || "",
      ]
        .map(escapeCsv)
        .join(",");
    });

  return [HEADERS.join(","), ...rows].join("\n");
}

export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportReservations(filename, reservations, holdings = []) {
  downloadCsv(filename, reservationsToCsv(reservations, holdings));
}