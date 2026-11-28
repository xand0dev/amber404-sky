import { describe, expect, it } from 'vitest';
import { bannerDue, installWay, isIosSafari, nextVisits, shortcutAction } from './install';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPAD_DESK = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
const IOS_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';

describe('#170 AC1: iOS Safari', () => {
  it('iPhone Safari і iPad у режимі «десктоп» — так', () => {
    expect(isIosSafari(IPHONE, 5)).toBe(true);
    expect(isIosSafari(IPAD_DESK, 5)).toBe(true);
  });
  it('Mac без дотику, Chrome на iOS, Android — ні', () => {
    expect(isIosSafari(IPAD_DESK, 0)).toBe(false);
    expect(isIosSafari(IOS_CHROME, 5)).toBe(false);
    expect(isIosSafari(ANDROID, 5)).toBe(false);
  });
});

describe('#170 AC1–AC2: спосіб встановлення', () => {
  const base = { standalone: false, installed: false, canPrompt: false, ios: false };
  it('є beforeinstallprompt — кнопка системного запиту', () => {
    expect(installWay({ ...base, canPrompt: true })).toBe('prompt');
  });
  it('iOS Safari — підказка «Поділитися»', () => {
    expect(installWay({ ...base, ios: true })).toBe('ios');
  });
  it('браузер без жодного способу — кнопки немає', () => {
    expect(installWay(base)).toBeNull();
  });
  it('уже встановлено (appinstalled або standalone) — кнопки немає', () => {
    expect(installWay({ ...base, canPrompt: true, installed: true })).toBeNull();
    expect(installWay({ ...base, ios: true, standalone: true })).toBeNull();
  });
});

describe('#170 AC1: одноразовий банер після 2-го візиту', () => {
  it('рахує візити з localStorage, сміття — як 0', () => {
    expect(nextVisits(null)).toBe(1);
    expect(nextVisits('1')).toBe(2);
    expect(nextVisits('abc')).toBe(1);
    expect(nextVisits('-4')).toBe(1);
  });
  it('перший візит — без банера, другий — з банером', () => {
    expect(bannerDue('prompt', 1, false)).toBe(false);
    expect(bannerDue('prompt', 2, false)).toBe(true);
    expect(bannerDue('ios', 5, false)).toBe(true);
  });
  it('уже показаний або нема як встановити — без банера', () => {
    expect(bannerDue('prompt', 3, true)).toBe(false);
    expect(bannerDue(null, 3, false)).toBe(false);
  });
});

describe('#170 AC4: ярлики manifest', () => {
  it('?do=locate («Де я») і ?do=go (шар «Можна летіти») — дії, решта — нічого', () => {
    expect(shortcutAction('?do=locate')).toBe('locate');
    expect(shortcutAction('?x=1&do=go')).toBe('go');
    expect(shortcutAction('?do=evil')).toBeNull();
    expect(shortcutAction('')).toBeNull();
  });
});
