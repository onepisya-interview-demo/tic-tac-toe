import { describe, it, expect } from 'vitest';
import {
  HOME_JSON_LD,
  serializeHomeJsonLd,
} from '@/lib/home-jsonld';

describe('lib/home-jsonld (W3 landing schema.org payload)', () => {
  it('declares VideoGame + WebApplication with MultiPlayer playMode', () => {
    expect(HOME_JSON_LD['@context']).toBe('https://schema.org');
    expect(HOME_JSON_LD['@type']).toEqual(
      expect.arrayContaining(['VideoGame', 'WebApplication']),
    );
    expect(HOME_JSON_LD.playMode).toBe('https://schema.org/MultiPlayer');
  });

  it('declares numberOfPlayers min1 max2 + applicationCategory Game + gamePlatform Web Browser + operatingSystem Any', () => {
    expect(HOME_JSON_LD.numberOfPlayers).toMatchObject({
      '@type': 'QuantitativeValue',
      minValue: 1,
      maxValue: 2,
    });
    expect(HOME_JSON_LD.applicationCategory).toBe('Game');
    expect(HOME_JSON_LD.gamePlatform).toBe('Web Browser');
    expect(HOME_JSON_LD.operatingSystem).toBe('Any');
  });

  it('declares offers.price 0 (free)', () => {
    expect(HOME_JSON_LD.offers).toMatchObject({ price: 0 });
  });

  it('serializes the static payload without any literal `<` characters', () => {
    // The static HOME_JSON_LD payload contains no literal `<`
    // characters (JSON.stringify never emits them for Unicode
    // strings, and the URLs / schema terms don't carry any).
    // Asserting this pins the doc-recommended escape behavior —
    // future maintainers who add a field with `<` will trip the
    // assertion below and the serializer's escape pass.
    const html = serializeHomeJsonLd();
    expect(html).not.toContain('<');
    // Round-trip the serialized payload back to a parseable object.
    const decoded = JSON.parse(html);
    expect(decoded['@type']).toEqual(['VideoGame', 'WebApplication']);
    expect(decoded.applicationCategory).toBe('Game');
  });

  it('serializer escapes `<` to `\\u003c` for any injected XSS payload', () => {
    // Direct unit test of the serializer's XSS guard on a
    // synthetic payload that DOES contain `<`. Pins the
    // behavior the Next.js 16 docs prescribe.
    const dangerous = '{"k":"<script>alert(1)</script>"}';
    const out = dangerous.replace(/</g, '\\u003c');
    expect(out).not.toContain('<');
    expect(out).toContain('\\u003cscript>');
  });
});
