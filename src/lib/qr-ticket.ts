export function buildQrTicketSvg(
  employeeName: string,
  employeeId: string,
  qrImageDataUrl: string
): string {
  const escapeXml = (value: string) =>
    value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      };
      return entities[character];
    });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="1120" viewBox="0 0 420 560">
    <rect width="420" height="560" rx="18" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>
    <path d="M18 0h384a18 18 0 0 1 18 18v74H0V18A18 18 0 0 1 18 0Z" fill="#171717"/>
    <text x="210" y="44" text-anchor="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="21" font-weight="700">SEASIA GALA</text>
    <text x="210" y="68" text-anchor="middle" fill="#d1d5db" font-family="Arial,sans-serif" font-size="12">OFFICIAL EVENT QR PASS</text>
    <text x="210" y="130" text-anchor="middle" fill="#6b7280" font-family="Arial,sans-serif" font-size="12">EMPLOYEE NAME</text>
    <text x="210" y="160" text-anchor="middle" fill="#171717" font-family="Arial,sans-serif" font-size="22" font-weight="700">${escapeXml(employeeName)}</text>
    <rect x="24" y="182" width="372" height="60" rx="9" fill="#f9fafb" stroke="#e5e7eb"/>
    <text x="210" y="205" text-anchor="middle" fill="#6b7280" font-family="Arial,sans-serif" font-size="11">EMPLOYEE ID</text>
    <text x="210" y="228" text-anchor="middle" fill="#171717" font-family="Arial,sans-serif" font-size="16" font-weight="700">${escapeXml(employeeId)}</text>
    <image href="${qrImageDataUrl}" x="90" y="258" width="240" height="240" preserveAspectRatio="xMidYMid meet"/>
    <text x="210" y="520" text-anchor="middle" fill="#374151" font-family="Arial,sans-serif" font-size="13">Your Entry &amp; Food QR Pass</text>
    <text x="210" y="540" text-anchor="middle" fill="#6b7280" font-family="Arial,sans-serif" font-size="11">Keep this pass safe for event entry and food collection.</text>
  </svg>`;
}

export function qrTicketDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
