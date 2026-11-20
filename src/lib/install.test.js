import { describe, it, expect } from 'vitest';
import { browserInfo } from './install.js';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  iphoneInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0 (iPhone15,2; iOS 18_6; it_IT)',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  androidWebview: 'Mozilla/5.0 (Linux; Android 14; SM-S911B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36',
  androidSamsung: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  ipadSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

describe('da dove è aperto il link', () => {
  it('iPhone: Safari, Chrome, browser di Instagram', () => {
    expect(browserInfo(UA.iphoneSafari)).toEqual({ platform: 'ios', browser: 'safari', inApp: false, tablet: false });
    expect(browserInfo(UA.iphoneChrome)).toEqual({ platform: 'ios', browser: 'chrome', inApp: false, tablet: false });
    expect(browserInfo(UA.iphoneInstagram)).toMatchObject({ platform: 'ios', inApp: true });
  });
  it('Android: Chrome, Samsung Internet, browser interno di un’app', () => {
    expect(browserInfo(UA.androidChrome)).toEqual({ platform: 'android', browser: 'chrome', inApp: false, tablet: false });
    expect(browserInfo(UA.androidSamsung)).toEqual({ platform: 'android', browser: 'samsung', inApp: false, tablet: false });
    expect(browserInfo(UA.androidWebview)).toMatchObject({ platform: 'android', inApp: true });
  });
  it('computer', () => {
    expect(browserInfo(UA.desktop).platform).toBe('desktop');
  });
  it('iPad: Safari si presenta come un Mac, ma ha lo schermo touch', () => {
    expect(browserInfo(UA.ipadSafari, { maxTouchPoints: 5 })).toEqual({ platform: 'ios', browser: 'safari', inApp: false, tablet: true });
    // un Mac vero non ha il touch: resta un computer
    expect(browserInfo(UA.ipadSafari, { maxTouchPoints: 0 }).platform).toBe('desktop');
  });
});
