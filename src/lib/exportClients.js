import { jsPDF } from "jspdf";
import { format } from "date-fns";

const COLUMNS = [
  { key: "firstName", label: "First Name", w: 80 },
  { key: "lastName", label: "Last Name", w: 85 },
  { key: "company", label: "Company", w: 115 },
  { key: "phone", label: "Phone", w: 75 },
  { key: "email", label: "Email", w: 125 },
  { key: "status", label: "Status", w: 60 },
  { key: "requested", label: "Requested", w: 90 },
  { key: "decided", label: "Decided", w: 90 },
];

const safe = (v) => (v == null ? "" : String(v));

export function exportClientsPDF(rows, meta = {}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 32;
  let y = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Client Requests", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (meta.range) {
    doc.text(`Period: ${meta.range}`, margin, y);
    y += 12;
  }
  doc.text(`Generated ${format(new Date(), "dd MMM yyyy HH:mm")}`, margin, y);
  y += 14;

  doc.setFillColor(222, 224, 227);
  doc.rect(margin, y - 10, pageW - margin * 2, 15, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  let x = margin;
  COLUMNS.forEach((c) => {
    doc.text(c.label, x + 4, y);
    x += c.w;
  });
  y += 16;
  doc.setFont("helvetica", "normal");

  rows.forEach((r) => {
    if (y > pageH - 36) {
      doc.addPage();
      y = 40;
    }
    let x2 = margin;
    COLUMNS.forEach((c) => {
      let val = safe(r[c.key]);
      if (val.length > 26) val = val.slice(0, 26) + "…";
      doc.text(val, x2 + 4, y);
      x2 += c.w;
    });
    y += 13;
  });

  doc.save(`clients-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
}

// Excel-compatible export (CSV with UTF-8 BOM — opens directly in Excel).
export function exportClientsExcel(rows, meta = {}) {
  const esc = (v) => safe(v).replace(/"/g, '""');
  const lines = [COLUMNS.map((c) => `"${esc(c.label)}"`).join(",")];
  rows.forEach((r) => {
    lines.push(COLUMNS.map((c) => `"${esc(r[c.key])}"`).join(","));
  });
  const csv = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clients-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}