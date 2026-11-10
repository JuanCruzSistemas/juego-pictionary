import { esServicioDePush } from './suscripcion.js';

describe('esServicioDePush', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc:123',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/QAbc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ])('acepta %s', (url) => expect(esServicioDePush(url)).toBe(true));

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc', // sin https
    'https://evil.com/fcm.googleapis.com',
    'https://fcm.googleapis.com.evil.com/x',
    'https://localhost:3000/api/estado',
    'https://169.254.169.254/latest/meta-data',
    'no es una url',
  ])('rechaza %s', (url) => expect(esServicioDePush(url)).toBe(false));
});
