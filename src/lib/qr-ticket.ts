import sharp from "sharp";

const QR_TICKET_WIDTH = 406;
const QR_TICKET_HEIGHT = 562;

/** Normalize SVG ticket renders before placing a couple side by side. */
export async function composeQrTicketImages(ticketImages: Buffer[]): Promise<Buffer> {
  if (ticketImages.length < 1 || ticketImages.length > 2) {
    throw new Error("One or two ticket images are required.");
  }

  const padding = 24;
  const gap = ticketImages.length === 2 ? 32 : 0;
  const normalizedImages = await Promise.all(
    ticketImages.map((image) =>
      sharp(image)
        .resize(QR_TICKET_WIDTH, QR_TICKET_HEIGHT, { fit: "fill" })
        .png()
        .toBuffer()
    )
  );

  return sharp({
    create: {
      width: padding * 2 + QR_TICKET_WIDTH * ticketImages.length + gap,
      height: padding * 2 + QR_TICKET_HEIGHT,
      channels: 4,
      background: "#ffffff",
    },
  })
    .composite(
      normalizedImages.map((input, index) => ({
        input,
        left: padding + index * (QR_TICKET_WIDTH + gap),
        top: padding,
      }))
    )
    .png()
    .toBuffer();
}

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

  return `<svg xmlns="http://www.w3.org/2000/svg" width="406" height="562" viewBox="0 0 406 562" role="img" aria-labelledby="t d">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffefb"/><stop offset=".48" stop-color="#fff"/><stop offset="1" stop-color="#f5f4ee"/></linearGradient>
    <linearGradient id="sage" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#edf2e8"/><stop offset=".38" stop-color="#b9d0c0"/><stop offset=".75" stop-color="#789b89"/><stop offset="1" stop-color="#557a6b"/></linearGradient>
    <linearGradient id="sage2" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f2f4e9"/><stop offset=".5" stop-color="#c4d8c9"/><stop offset="1" stop-color="#86a795"/></linearGradient>
    <linearGradient id="pink" x1=".1" y1="0" x2=".9" y2="1"><stop stop-color="#fff0eb"/><stop offset=".28" stop-color="#ffb7c3"/><stop offset=".62" stop-color="#ed7896"/><stop offset="1" stop-color="#b94268"/></linearGradient>
    <linearGradient id="burgundy" x1=".1" y1="0" x2=".9" y2="1"><stop stop-color="#f45a79"/><stop offset=".27" stop-color="#d51e4d"/><stop offset=".68" stop-color="#a40e3b"/><stop offset="1" stop-color="#690d2d"/></linearGradient>
    <linearGradient id="cream" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffef6"/><stop offset=".65" stop-color="#eee9d9"/><stop offset="1" stop-color="#d6d5c2"/></linearGradient>
    <linearGradient id="goldBottle" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f5e6a3"/><stop offset=".4" stop-color="#d4af37"/><stop offset=".8" stop-color="#b8942e"/><stop offset="1" stop-color="#8a6d1f"/></linearGradient>
    <linearGradient id="darkBottle" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#3a5a4a"/><stop offset=".4" stop-color="#2a4a3a"/><stop offset=".8" stop-color="#1e3a2a"/><stop offset="1" stop-color="#142a1e"/></linearGradient>
    <linearGradient id="lanternGlass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff8e0" stop-opacity="0.9"/><stop offset="0.5" stop-color="#ffe8a0" stop-opacity="0.7"/><stop offset="1" stop-color="#ffd060" stop-opacity="0.5"/></linearGradient>
    <radialGradient id="flameGlow" cx="0.5" cy="0.6" r="0.5"><stop stop-color="#fff4c0"/><stop offset="0.4" stop-color="#ffcc33" stop-opacity="0.8"/><stop offset="1" stop-color="#ff9900" stop-opacity="0"/></radialGradient>

    <filter id="petalShadow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="lanternGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>

    <!-- Reusable Sparkle/Star -->
    <g id="sparkle">
      <path d="M0 -8 Q0 0 8 0 Q0 0 0 8 Q0 0 -8 0 Q0 0 0 -8Z" fill="#D4AF37"/>
    </g>

    <!-- Reusable Hanging Candle Lantern -->
    <g id="candleLantern">
      <ellipse cx="0" cy="42" rx="28" ry="30" fill="#ffcc33" opacity="0.15" filter="url(#lanternGlow)"/>
      <line x1="0" y1="-60" x2="0" y2="-18" stroke="#8a6d1f" stroke-width="1.2" stroke-dasharray="2,2"/>
      <circle cx="0" cy="-60" r="3" fill="none" stroke="#d4af37" stroke-width="1.5"/>
      <circle cx="0" cy="-16" r="5" fill="none" stroke="#d4af37" stroke-width="2"/>
      <path d="M-14 -10 Q-14 -16 0 -18 Q14 -16 14 -10 Z" fill="url(#goldBottle)" stroke="#8a6d1f" stroke-width="0.8"/>
      <rect x="-12" y="-10" width="24" height="4" rx="1" fill="#b8942e" stroke="#8a6d1f" stroke-width="0.5"/>
      <path d="M-14 -6 L-14 58 Q-14 66 0 68 Q14 66 14 58 L14 -6 Z" fill="url(#lanternGlass)" stroke="#d4af37" stroke-width="1"/>
      <path d="M-9 -2 L-9 54 Q-9 58 -4 59" fill="none" stroke="#fffef6" stroke-width="2" opacity="0.6"/>
      <line x1="-14" y1="-6" x2="-14" y2="66" stroke="#d4af37" stroke-width="1.5"/>
      <line x1="14" y1="-6" x2="14" y2="66" stroke="#d4af37" stroke-width="1.5"/>
      <line x1="-14" y1="14" x2="14" y2="14" stroke="#d4af37" stroke-width="1"/>
      <line x1="-14" y1="44" x2="14" y2="44" stroke="#d4af37" stroke-width="1"/>
      <rect x="-16" y="64" width="32" height="5" rx="2" fill="url(#goldBottle)" stroke="#8a6d1f" stroke-width="0.8"/>
      <path d="M-12 69 Q-12 74 0 76 Q12 74 12 69" fill="#b8942e" stroke="#8a6d1f" stroke-width="0.6"/>
      <rect x="-4" y="30" width="8" height="22" rx="2" fill="#fffef6" stroke="#e0ddcf" stroke-width="0.5"/>
      <rect x="-4" y="30" width="8" height="4" rx="1" fill="#f5e6a3"/>
      <ellipse cx="0" cy="26" rx="4" ry="7" fill="url(#flameGlow)"/>
      <path d="M0 18 Q-3 24 0 28 Q3 24 0 18Z" fill="#ffdd44"/>
      <path d="M0 20 Q-1.5 24 0 26 Q1.5 24 0 20Z" fill="#fff8e0"/>
      <path d="M-4 34 Q-5 36 -4 38" fill="none" stroke="#f5e6a3" stroke-width="1.5"/>
      <path d="M4 36 Q5 38 4 40" fill="none" stroke="#f5e6a3" stroke-width="1.5"/>
      <path d="M-10 40 Q-20 50 -16 70 L16 70 Q20 50 10 40 Z" fill="#ffcc33" opacity="0.08"/>
    </g>

    <!-- Reusable Champagne Bottle (gold theme) -->
    <g id="champagneBottle">
      <ellipse cx="0" cy="38" rx="12" ry="3" fill="#000" opacity="0.12"/>
      <path d="M-10 34 L-10 0 Q-10 -6 -6 -10 L-6 -20 Q-6 -24 -3 -26 L-3 -34 L3 -34 L3 -26 Q6 -24 6 -20 L6 -10 Q10 -6 10 0 L10 34 Q10 38 6 38 L-6 38 Q-10 38 -10 34Z" fill="url(#goldBottle)" stroke="#8a6d1f" stroke-width="0.6"/>
      <rect x="-5" y="-34" width="10" height="10" rx="1" fill="#b8942e" stroke="#8a6d1f" stroke-width="0.5"/>
      <rect x="-4" y="-36" width="8" height="4" rx="1" fill="#d4af37"/>
      <rect x="-7" y="4" width="14" height="18" rx="1.5" fill="#fffef6" stroke="#d4af37" stroke-width="0.5"/>
      <text x="0" y="16" font-family="'Georgia', serif" font-size="4" fill="#b8942e" text-anchor="middle" font-style="italic">Gala</text>
      <path d="M-7 2 Q-8 18 -7 34" fill="none" stroke="#fff8e0" stroke-width="1.5" opacity="0.5"/>
      <ellipse cx="-2" cy="33" rx="5" ry="2" fill="#fff8e0" opacity="0.3"/>
    </g>

    <!-- Reusable Champagne Bottle (dark theme) -->
    <g id="champagneBottleDark">
      <ellipse cx="0" cy="38" rx="12" ry="3" fill="#000" opacity="0.12"/>
      <path d="M-10 34 L-10 0 Q-10 -6 -6 -10 L-6 -20 Q-6 -24 -3 -26 L-3 -34 L3 -34 L3 -26 Q6 -24 6 -20 L6 -10 Q10 -6 10 0 L10 34 Q10 38 6 38 L-6 38 Q-10 38 -10 34Z" fill="url(#darkBottle)" stroke="#142a1e" stroke-width="0.6"/>
      <rect x="-5" y="-34" width="10" height="10" rx="1" fill="#d4af37" stroke="#b8942e" stroke-width="0.5"/>
      <rect x="-4" y="-36" width="8" height="4" rx="1" fill="#e8c84a"/>
      <rect x="-7" y="4" width="14" height="18" rx="1.5" fill="#fffef6" stroke="#d4af37" stroke-width="0.5"/>
      <text x="0" y="16" font-family="'Georgia', serif" font-size="4" fill="#2a4a3a" text-anchor="middle" font-style="italic">Gala</text>
      <path d="M-7 2 Q-8 18 -7 34" fill="none" stroke="#a8d0b8" stroke-width="1.5" opacity="0.3"/>
      <ellipse cx="-2" cy="33" rx="5" ry="2" fill="#a8d0b8" opacity="0.2"/>
    </g>

    <g id="leaf">
      <path d="M0 0 C-13 -11 -25 -30 -14 -47 C5 -43 15 -22 0 0Z" fill="url(#sage)" stroke="#779989" stroke-width=".65"/>
      <path d="M0 -1 Q-7 -22 -13 -44 M-5 -18 L-17 -27 M-2 -10 L8 -23" fill="none" stroke="#719181" stroke-width=".65" opacity=".8"/>
      <path d="M-12 -39 Q-2 -31 -2 -16" fill="none" stroke="#f4f6ec" stroke-width="1" opacity=".45"/>
    </g>
    <g id="roundLeaf">
      <path d="M0 0 C-18 -13 -23 -32 -4 -45 C15 -34 17 -14 0 0Z" fill="url(#sage2)" stroke="#8cae9c" stroke-width=".7"/>
      <path d="M0 -1 Q0 -24 -3 -42" fill="none" stroke="#7d9d8d" stroke-width=".7"/>
    </g>

    <g id="rose">
      <ellipse cy="8" rx="31" ry="25" fill="#641a36" opacity=".18" filter="url(#petalShadow)"/>
      <path d="M-27 5 C-43 -9 -34 -32 -14 -34 C-4 -48 17 -40 22 -25 C43 -17 39 8 24 17 C15 39 -12 38 -21 22 C-39 22 -43 10 -27 5Z" fill="url(#pink)"/>
      <path d="M-25 -4 C-34 -24 -15 -40 1 -29 C14 -44 36 -27 26 -9 C43 5 24 29 7 21 C-9 38 -33 19 -25 -4Z" fill="#f7a0b1"/>
      <path d="M-19 -6 C-24 -23 -7 -32 5 -22 C20 -33 33 -15 20 -3 C32 12 13 27 0 16 C-15 28 -29 9 -19 -6Z" fill="#e96f8c"/>
      <path d="M-12 -4 C-10 -20 8 -25 16 -12 C29 -3 17 16 5 14 C-8 25 -22 8 -12 -4Z" fill="#f9b5bf"/>
      <path d="M-7 -4 C-4 -15 10 -15 14 -5 C18 6 4 15 -5 8 C-12 4 -12 -1 -7 -4Z" fill="#d75b7b"/>
      <path d="M-2 -3 C4 -11 14 -5 11 3 C8 11 -2 8 -4 3Z" fill="#b94768"/>
      <g fill="none" stroke="#fff0ec" stroke-width="1" opacity=".68">
        <path d="M-28 2 Q-22 -10 -12 -14 M-22 18 Q-8 24 3 18 M-10 -28 Q-1 -31 5 -24 M17 -25 Q25 -16 21 -8"/>
      </g>
    </g>
    
    <g id="redRose">
      <ellipse cy="8" rx="33" ry="26" fill="#4b0926" opacity=".2" filter="url(#petalShadow)"/>
      <path d="M-28 4 C-43 -12 -31 -34 -13 -33 C-3 -48 19 -39 23 -24 C43 -14 38 11 22 18 C12 39 -15 36 -22 20 C-41 22 -43 9 -28 4Z" fill="url(#burgundy)"/>
      <path d="M-25 -5 C-32 -23 -13 -38 2 -27 C17 -42 36 -24 25 -7 C41 8 21 29 5 19 C-12 35 -32 15 -25 -5Z" fill="#e32b56"/>
      <path d="M-19 -6 C-19 -25 0 -31 10 -18 C28 -23 34 -3 18 6 C24 22 2 29 -7 15 C-24 18 -29 1 -19 -6Z" fill="#c81748"/>
      <path d="M-13 -5 C-7 -21 11 -22 17 -8 C29 3 12 20 0 13 C-13 21 -24 5 -13 -5Z" fill="#a9103d"/>
      <path d="M-7 -4 C-3 -15 11 -15 15 -5 C19 6 4 14 -5 7Z" fill="#800e34"/>
      <path d="M-1 -3 C5 -11 15 -5 12 3 C8 10 -2 8 -4 3Z" fill="#650d2e"/>
      <g fill="none" stroke="#ff9bab" stroke-width="1" opacity=".55"><path d="M-27 2 Q-17 -9 -9 -13 M-19 18 Q-4 25 6 17 M-8 -29 Q1 -33 7 -24 M18 -25 Q27 -15 22 -8"/></g>
    </g>
    
    <g id="whiteRose">
      <ellipse cy="6" rx="24" ry="20" fill="#8b8875" opacity=".13" filter="url(#petalShadow)"/>
      <path d="M-22 2 C-32 -13 -19 -31 -4 -27 C8 -39 28 -22 19 -6 C32 9 12 27 -3 19 C-19 27 -31 14 -22 2Z" fill="url(#cream)" stroke="#e0ddcf" stroke-width=".65"/>
      <path d="M-17 -5 C-16 -21 1 -27 10 -15 C24 -11 24 8 8 12 C-1 26 -22 12 -17 -5Z" fill="#fffaf0"/>
      <path d="M-10 -4 C-7 -17 8 -17 14 -6 C20 5 5 17 -6 10Z" fill="#eee9d9"/>
      <path d="M-4 -3 C0 -10 10 -7 10 1 C8 8 -2 8 -5 2Z" fill="#d9d4c3"/>
    </g>
  </defs>

  <rect width="406" height="562" fill="url(#paper)"/>
  <path d="M-40 225 L96 -10 H174 L18 278Z M116 580 L442 144 V263 L209 580Z" fill="#fff" opacity=".42"/>

  <rect x="10" y="10" width="386" height="542" fill="none" stroke="#D4AF37" stroke-width="1.5"/>
  <rect x="15" y="15" width="376" height="532" fill="none" stroke="#F3E5AB" stroke-width="0.8"/>

  <!-- Top Left Lantern -->
  <g transform="translate(55, 48) scale(0.55)">
    <use href="#candleLantern" />
  </g>
  
  <!-- Top Right Lantern -->
  <g transform="translate(351, 48) scale(0.55)">
    <use href="#candleLantern" />
  </g>

  <!-- Decorative roses near top lanterns -->
  <g>
    <use href="#rose" transform="translate(22, 105) scale(0.45)" />
    <use href="#redRose" transform="translate(38, 120) scale(0.35)" />
    <use href="#whiteRose" transform="translate(15, 125) scale(0.3)" />
    <use href="#leaf" transform="translate(30, 112) rotate(-30) scale(0.4)" />
    <use href="#roundLeaf" transform="translate(12, 112) rotate(25) scale(0.35)" />
    
    <use href="#rose" transform="translate(384, 105) scale(0.45)" />
    <use href="#redRose" transform="translate(368, 120) scale(0.35)" />
    <use href="#whiteRose" transform="translate(391, 125) scale(0.3)" />
    <use href="#leaf" transform="translate(376, 112) rotate(30) scale(0.4)" />
    <use href="#roundLeaf" transform="translate(394, 112) rotate(-25) scale(0.35)" />
  </g>

  <!-- Sparkles near top lanterns -->
  <g>
    <use href="#sparkle" transform="translate(20, 70) scale(0.7)" />
    <use href="#sparkle" transform="translate(90, 65) scale(0.5)" />
    <use href="#sparkle" transform="translate(35, 140) scale(0.6)" />
    <use href="#sparkle" transform="translate(386, 70) scale(0.7)" />
    <use href="#sparkle" transform="translate(316, 65) scale(0.5)" />
    <use href="#sparkle" transform="translate(371, 140) scale(0.6)" />
  </g>

  <g transform="translate(0, 281) scale(0.5) translate(0, -281)">
    <path d="M 0 50 Q 40 150 20 280 Q 40 400 0 500" fill="none" stroke="#b6c7b8" stroke-width="1.5" opacity="0.6"/>
    <use href="#leaf" transform="translate(15 80) rotate(45) scale(0.8)"/>
    <use href="#roundLeaf" transform="translate(25 160) rotate(-30) scale(0.9)"/>
    <use href="#leaf" transform="translate(15 250) rotate(20) scale(0.85)"/>
    <use href="#roundLeaf" transform="translate(30 340) rotate(-45) scale(0.8)"/>
    <use href="#leaf" transform="translate(10 430) rotate(-15) scale(0.9)"/>
    <use href="#whiteRose" transform="translate(20 120) scale(0.6)"/>
    <use href="#rose" transform="translate(25 280) scale(0.7)"/>
    <use href="#redRose" transform="translate(20 380) scale(0.65)"/>
  </g>

  <g transform="translate(406, 281) scale(-0.5, 0.5) translate(0, -281)">
    <path d="M 0 50 Q 40 150 20 280 Q 40 400 0 500" fill="none" stroke="#b6c7b8" stroke-width="1.5" opacity="0.6"/>
    <use href="#leaf" transform="translate(15 80) rotate(45) scale(0.8)"/>
    <use href="#roundLeaf" transform="translate(25 160) rotate(-30) scale(0.9)"/>
    <use href="#leaf" transform="translate(15 250) rotate(20) scale(0.85)"/>
    <use href="#roundLeaf" transform="translate(30 340) rotate(-45) scale(0.8)"/>
    <use href="#leaf" transform="translate(10 430) rotate(-15) scale(0.9)"/>
    <use href="#whiteRose" transform="translate(20 120) scale(0.6)"/>
    <use href="#rose" transform="translate(25 280) scale(0.7)"/>
    <use href="#redRose" transform="translate(20 380) scale(0.65)"/>
  </g>

  <g transform="translate(101.5, 0) scale(0.5)">
    <path d="M20 40 Q60 90 100 70 Q130 50 160 30 M386 40 Q346 90 306 70 Q276 50 246 30" fill="none" stroke="#c8d0c2" stroke-width="1.1"/>
    <path d="M50 70 Q80 120 120 100 M356 70 Q326 120 286 100" fill="none" stroke="#b6c7b8" stroke-width=".9"/>
    <use href="#leaf" transform="translate(25 65) rotate(-25) scale(0.85)"/>
    <use href="#roundLeaf" transform="translate(55 85) rotate(40) scale(0.9)"/>
    <use href="#leaf" transform="translate(85 100) rotate(-15) scale(0.75)"/>
    <use href="#roundLeaf" transform="translate(120 90) rotate(55) scale(0.7)"/>
    <use href="#leaf" transform="translate(145 65) rotate(-35) scale(0.8)"/>
    <use href="#leaf" transform="translate(381 65) rotate(25) scale(0.85)"/>
    <use href="#roundLeaf" transform="translate(351 85) rotate(-40) scale(0.9)"/>
    <use href="#leaf" transform="translate(321 100) rotate(15) scale(0.75)"/>
    <use href="#roundLeaf" transform="translate(286 90) rotate(-55) scale(0.7)"/>
    <use href="#leaf" transform="translate(261 65) rotate(35) scale(0.8)"/>
    <use href="#roundLeaf" transform="translate(180 80) rotate(-10) scale(0.75)"/>
    <use href="#leaf" transform="translate(226 80) rotate(10) scale(0.75)"/>
    <use href="#rose" transform="translate(43 8) rotate(-17) scale(1.34)"/>
    <use href="#rose" transform="translate(103 0) rotate(13) scale(1.42)"/>
    <use href="#redRose" transform="translate(184 0) rotate(-5) scale(1.42)"/>
    <use href="#redRose" transform="translate(232 12) rotate(11) scale(1.3)"/>
    <use href="#rose" transform="translate(297 3) rotate(-11) scale(1.4)"/>
    <use href="#rose" transform="translate(365 2) rotate(16) scale(1.36)"/>
    <use href="#rose" transform="translate(159 43) rotate(7) scale(.92)"/>
    <use href="#whiteRose" transform="translate(257 61) rotate(-12) scale(.92)"/>
    <use href="#rose" transform="translate(324 53) rotate(12) scale(.78)"/>
  </g>

  <g text-anchor="middle">
    <text x="203" y="115" font-family="'Georgia', serif" font-style="italic" font-size="38" fill="#171717">Seasia Gala</text>
    <text x="203" y="135" font-family="'Arial', sans-serif" font-size="14" font-weight="600" letter-spacing="1" fill="#6b7280">THE SHAADI EDIT</text>
    
    <!-- QR Code Frame with Sparkles -->
    <g transform="translate(203, 235)">
      <use href="#sparkle" transform="translate(-85, -85) scale(1.2)" />
      <use href="#sparkle" transform="translate(85, -85) scale(0.8)" />
      <use href="#sparkle" transform="translate(-85, 85) scale(0.9)" />
      <use href="#sparkle" transform="translate(85, 85) scale(1.3)" />
      <use href="#sparkle" transform="translate(-95, 0) scale(0.6)" />
      <use href="#sparkle" transform="translate(95, 0) scale(0.7)" />
      <use href="#sparkle" transform="translate(0, -95) scale(1)" />
      <use href="#sparkle" transform="translate(0, 95) scale(0.8)" />
      <rect x="-75" y="-75" width="150" height="150" rx="15" fill="none" stroke="#D4AF37" stroke-width="2"/>
      <rect x="-70" y="-70" width="140" height="140" rx="10" fill="none" stroke="#F3E5AB" stroke-width="1"/>
      <image href="${qrImageDataUrl}" x="-60" y="-60" width="120" height="120" preserveAspectRatio="xMidYMid meet"/>
    </g>
    
       <text x="203" y="345" font-family="'Arial', sans-serif" font-size="12" font-weight="600" letter-spacing="1.5" fill="#6b7280">ATTENDEE NAME</text>
    <text x="203" y="375" font-family="'Georgia', serif" font-style="italic" font-size="24" fill="#171717">${escapeXml(employeeName)}</text>
   <!-- <text x="203" y="400" font-family="'Arial', sans-serif" font-size="14" font-weight="600" fill="#171717">ID : ${escapeXml(employeeId)}</text> -->

    <!-- ============================================ -->
    <!-- Decorative Golden Corner Frame for Footer -->
    <!-- ============================================ -->
    <g>
      <!-- Outer Layer (Matching Main Border Gold) -->
      <!-- Top Left -->
      <path d="M65 442 L65 457 M65 442 L80 442" fill="none" stroke="#D4AF37" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Top Right -->
      <path d="M341 442 L341 457 M341 442 L326 442" fill="none" stroke="#D4AF37" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Bottom Left -->
      <path d="M65 497 L65 482 M65 497 L80 497" fill="none" stroke="#D4AF37" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Bottom Right -->
      <path d="M341 497 L341 482 M341 497 L326 497" fill="none" stroke="#D4AF37" stroke-width="2.5" stroke-linecap="round"/>
      
      <!-- Inner Layer (Lighter Gold, slight offset) -->
      <!-- Top Left -->
      <path d="M69 446 L69 459 M69 446 L82 446" fill="none" stroke="#F3E5AB" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Top Right -->
      <path d="M337 446 L337 459 M337 446 L324 446" fill="none" stroke="#F3E5AB" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Bottom Left -->
      <path d="M69 493 L69 480 M69 493 L82 493" fill="none" stroke="#F3E5AB" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Bottom Right -->
      <path d="M337 493 L337 480 M337 493 L324 493" fill="none" stroke="#F3E5AB" stroke-width="1.5" stroke-linecap="round"/>

      <!-- Matching Gold Sparkles around the frame -->
      <use href="#sparkle" transform="translate(60, 437) scale(0.4)" />
      <use href="#sparkle" transform="translate(346, 437) scale(0.4)" />
      <use href="#sparkle" transform="translate(60, 502) scale(0.4)" />
      <use href="#sparkle" transform="translate(346, 502) scale(0.4)" />
      
      <!-- Subtle background to help text stand out -->
      <rect x="67" y="444" width="272" height="51" rx="6" fill="#fffef6" opacity="0.6"/>
      
      <!-- Footer Text inside the frame -->
      <text x="203" y="465" font-family="'Arial', sans-serif" font-size="12" font-weight="600" fill="#374151">Your Entry &amp; Food QR Pass</text>
      <text x="203" y="482" font-family="'Arial', sans-serif" font-size="10" font-weight="600" fill="#6b7280">Keep this pass safe for event entry and food collection.</text>
    </g>
  </g>

  <g transform="translate(101.5, 562) scale(0.5) translate(0, -562)">
    <path d="M20 522 Q60 472 100 492 Q130 512 160 532 M386 522 Q346 472 306 492 Q276 512 246 532" fill="none" stroke="#c8d0c2" stroke-width="1.1"/>
    <path d="M50 492 Q80 442 120 462 M356 492 Q326 442 286 462" fill="none" stroke="#b6c7b8" stroke-width=".9"/>
    <use href="#leaf" transform="translate(25 497) rotate(155) scale(0.85)"/>
    <use href="#roundLeaf" transform="translate(55 477) rotate(-140) scale(0.9)"/>
    <use href="#leaf" transform="translate(85 462) rotate(165) scale(0.75)"/>
    <use href="#roundLeaf" transform="translate(120 472) rotate(-125) scale(0.7)"/>
    <use href="#leaf" transform="translate(145 497) rotate(145) scale(0.8)"/>
    <use href="#leaf" transform="translate(381 497) rotate(-155) scale(0.85)"/>
    <use href="#roundLeaf" transform="translate(351 477) rotate(140) scale(0.9)"/>
    <use href="#leaf" transform="translate(321 462) rotate(-165) scale(0.75)"/>
    <use href="#roundLeaf" transform="translate(286 472) rotate(125) scale(0.7)"/>
    <use href="#leaf" transform="translate(261 497) rotate(-145) scale(0.8)"/>
    <use href="#roundLeaf" transform="translate(180 482) rotate(10) scale(0.75)"/>
    <use href="#leaf" transform="translate(226 482) rotate(-10) scale(0.75)"/>
    <use href="#whiteRose" transform="translate(34 536) rotate(-10) scale(1.08)"/>
    <use href="#rose" transform="translate(87 535) rotate(11) scale(1.27)"/>
    <use href="#rose" transform="translate(146 539) rotate(-9) scale(1.12)"/>
    <use href="#redRose" transform="translate(207 533) rotate(4) scale(1.52)"/>
    <use href="#rose" transform="translate(276 538) rotate(-12) scale(1.34)"/>
    <use href="#rose" transform="translate(342 537) rotate(14) scale(1.28)"/>
    <use href="#whiteRose" transform="translate(389 537) rotate(-9) scale(.95)"/>
    <use href="#redRose" transform="translate(160 562) rotate(10) scale(.72)"/>
    <use href="#rose" transform="translate(242 562) rotate(-12) scale(.78)"/>
  </g>

  <!-- Bottom Left Corner - Champagne bottles & roses -->
  <g>
    <use href="#sparkle" transform="translate(40, 500) scale(0.9)" />
    <use href="#sparkle" transform="translate(60, 515) scale(0.6)" />
    <use href="#sparkle" transform="translate(25, 525) scale(0.7)" />
    <use href="#sparkle" transform="translate(52, 488) scale(0.5)" />
    <use href="#sparkle" transform="translate(72, 502) scale(0.4)" />
    <use href="#sparkle" transform="translate(18, 512) scale(0.55)" />

    <use href="#champagneBottle" transform="translate(50, 530) scale(0.95)" />
    <use href="#champagneBottleDark" transform="translate(28, 540) scale(0.85)" />

    <use href="#rose" transform="translate(70, 545) scale(0.4)" />
    <use href="#redRose" transform="translate(15, 548) scale(0.38)" />
    <use href="#whiteRose" transform="translate(38, 558) scale(0.35)" />
    <use href="#rose" transform="translate(58, 558) scale(0.3)" />

    <use href="#leaf" transform="translate(12, 520) rotate(-20) scale(0.45)" />
    <use href="#roundLeaf" transform="translate(75, 525) rotate(30) scale(0.4)" />
    <use href="#leaf" transform="translate(30, 555) rotate(10) scale(0.35)" />
  </g>

  <!-- Bottom Right Corner - Champagne bottles & roses -->
  <g>
    <use href="#sparkle" transform="translate(366, 500) scale(0.9)" />
    <use href="#sparkle" transform="translate(346, 515) scale(0.6)" />
    <use href="#sparkle" transform="translate(381, 525) scale(0.7)" />
    <use href="#sparkle" transform="translate(354, 488) scale(0.5)" />
    <use href="#sparkle" transform="translate(334, 502) scale(0.4)" />
    <use href="#sparkle" transform="translate(388, 512) scale(0.55)" />

    <use href="#champagneBottle" transform="translate(356, 530) scale(0.95)" />
    <use href="#champagneBottleDark" transform="translate(378, 540) scale(0.85)" />

    <use href="#rose" transform="translate(336, 545) scale(0.4)" />
    <use href="#redRose" transform="translate(391, 548) scale(0.38)" />
    <use href="#whiteRose" transform="translate(368, 558) scale(0.35)" />
    <use href="#rose" transform="translate(348, 558) scale(0.3)" />

    <use href="#leaf" transform="translate(394, 520) rotate(20) scale(0.45)" />
    <use href="#roundLeaf" transform="translate(331, 525) rotate(-30) scale(0.4)" />
    <use href="#leaf" transform="translate(376, 555) rotate(-10) scale(0.35)" />
  </g>

</svg>`;
}

export function buildCoupleQrTicketSvg(firstTicket: string, secondTicket: string): string {
  const cardWidth = QR_TICKET_WIDTH;
  const cardHeight = QR_TICKET_HEIGHT;
  const gap = 32;
  const padding = 24;
  const width = cardWidth * 2 + gap + padding * 2;
  const height = cardHeight + padding * 2;
  const ticketBody = (svg: string, suffix: string) => {
    const start = svg.indexOf(">") + 1;
    const end = svg.lastIndexOf("</svg>");
    if (start <= 0 || end <= start) throw new Error("Invalid ticket SVG.");
    return svg.slice(start, end)
      .replace(/id="([^"]+)"/g, (_match, id: string) => `id="${id}-${suffix}"`)
      .replace(/url\(#([^\)]+)\)/g, (_match, id: string) => `url(#${id}-${suffix})`)
      .replace(/href="#([^"]+)"/g, (_match, id: string) => `href="#${id}-${suffix}"`)
      .replace(/aria-labelledby="([^"]+)"/g, (_match, ids: string) => `aria-labelledby="${ids.split(" ").map((id) => `${id}-${suffix}`).join(" ")}"`);
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${height * 2}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Seasia Gala couple QR tickets">
    <rect width="${width}" height="${height}" fill="#fff"/>
    <svg x="${padding}" y="${padding}" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}">${ticketBody(firstTicket, "employee")}</svg>
    <svg x="${padding + cardWidth + gap}" y="${padding}" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}">${ticketBody(secondTicket, "partner")}</svg>
  </svg>`;
}

export function buildSharedCoupleQrTicketSvg(
  employeeName: string,
  partnerName: string,
  employeeId: string,
  qrImageDataUrl: string
): string {
  const escapeXml = (value: string) => value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
    return entities[character];
  });
  const base = buildQrTicketSvg(employeeName, employeeId, qrImageDataUrl);
  const names = `<text x="203" y="409" text-anchor="middle" font-family="'Georgia', serif" font-style="italic" font-size="22" fill="#171717">${escapeXml(partnerName)}</text>`;
  return base
    .replace(">ATTENDEE NAME</text>", ">EMPLOYEE</text>")
    .replace("</svg>", `${names}</svg>`)
    .replace('aria-labelledby="t d"', 'aria-label="Seasia Gala couple event pass"');
}

export function qrTicketDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
