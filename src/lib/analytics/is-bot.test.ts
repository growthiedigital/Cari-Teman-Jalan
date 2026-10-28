import { describe, expect, it } from "vitest";

import { isBot } from "./is-bot";
import { isPrefetchRequest } from "./is-prefetch";

const HUMAN = {
  "Chrome Android":
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  "Safari iOS":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  "Instagram dalam aplikasi (iOS)":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.34.108 (iPhone14,5; iOS 17_5; en_US; en; scale=3.00; 1170x2532; 570349789)",
  "Instagram dalam aplikasi (Android)":
    "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 330.0.0.40.97 Android (34/14; 480dpi; 1080x2340; samsung; SM-S918B; dm3q; qcom; en_US; 570349789)",
  "TikTok dalam aplikasi":
    "Mozilla/5.0 (Linux; Android 13; SM-A546E Build/TP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36 trill_2023500030 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/35.0.3 BytedanceWebview/d8a21c6 TikTok/35.0.3",
  "Facebook dalam aplikasi (FBAN/FBAV)":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/460.0.0.0.0;FBBV/1;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/id_ID]",
  "Firefox desktop":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
};

const BOTS = {
  "crawler WhatsApp": "WhatsApp/2.23.20.0 A",
  "crawler WhatsApp (Android)": "WhatsApp/2.24.10.85 A",
  facebookexternalhit: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  Facebot: "Mozilla/5.0 (compatible; Facebot 1.0)",
  Slackbot: "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
  TelegramBot: "TelegramBot (like TwitterBot)",
  Discordbot: "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
  Twitterbot: "Twitterbot/1.0",
  LinkedInBot: "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
  Pinterestbot: "Mozilla/5.0 (compatible; Pinterestbot/1.0; +http://www.pinterest.com/bot.html)",
  embedly: "Mozilla/5.0 (compatible; Embedly/0.2; +http://support.embed.ly/)",
  Googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  Yahoo: "Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)",
  "crawler/spider generik": "SomeCrawler/1.0 spider",
  curl: "curl/8.4.0",
  wget: "Wget/1.21.4",
  "python-requests": "python-requests/2.31.0",
  HeadlessChrome:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36",
};

describe("isBot", () => {
  for (const [name, ua] of Object.entries(HUMAN)) {
    it(`bukan bot: ${name}`, () => expect(isBot(ua)).toBe(false));
  }
  for (const [name, ua] of Object.entries(BOTS)) {
    it(`bot: ${name}`, () => expect(isBot(ua)).toBe(true));
  }
  it("UA kosong, spasi, null, undefined -> bot", () => {
    for (const ua of ["", "   ", null, undefined]) expect(isBot(ua)).toBe(true);
  });
});

describe("isPrefetchRequest", () => {
  const h = (init: Record<string, string>) => new Headers(init);
  it("mengenali Purpose: prefetch dan Sec-Purpose berisi prefetch", () => {
    expect(isPrefetchRequest(h({ purpose: "prefetch" }))).toBe(true);
    expect(isPrefetchRequest(h({ purpose: "Prefetch" }))).toBe(true);
    expect(isPrefetchRequest(h({ "sec-purpose": "prefetch" }))).toBe(true);
    expect(isPrefetchRequest(h({ "sec-purpose": "prefetch;anonymous-client-ip" }))).toBe(true);
  });
  it("permintaan biasa bukan prefetch", () => {
    expect(isPrefetchRequest(h({}))).toBe(false);
    expect(isPrefetchRequest(h({ purpose: "navigate" }))).toBe(false);
    expect(isPrefetchRequest(h({ "sec-purpose": "prerender" }))).toBe(false);
  });
});
