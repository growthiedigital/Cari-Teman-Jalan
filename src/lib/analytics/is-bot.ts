// Penyaring bot untuk analytics. Tanpa `server-only` supaya mudah diuji.

const BOT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|facebot|WhatsApp\/|embedly|curl\/|wget\/|python-requests|HeadlessChrome/i;

/**
 * Anggap bot bila user agent kosong atau cocok pola crawler/alat unduh umum
 * (termasuk TelegramBot, Slackbot, Discordbot, Twitterbot, LinkedInBot,
 * Pinterestbot lewat "bot"). Browser dalam aplikasi Instagram/TikTok/Facebook
 * (UA memuat "Instagram", "TikTok", "FBAN"/"FBAV") dan browser biasa BUKAN bot.
 */
export function isBot(userAgent: string | null | undefined): boolean {
  const ua = userAgent?.trim();
  if (!ua) return true;
  return BOT_PATTERN.test(ua);
}
