import QRCode from "qrcode";

// Shared by the dashboard and the tests, so what is verified is what ships.
export const CHECKIN_QR_OPTIONS = { errorCorrectionLevel: "M", margin: 4 } as const;

// Renders a check-in token as an SVG data URL for an <img>. Rendered on the
// server so the page ships an image, not a QR library.
export async function checkinQrDataUrl(token: string) {
  const svg = await QRCode.toString(token, { ...CHECKIN_QR_OPTIONS, type: "svg" });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
