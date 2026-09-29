import { performance } from 'node:perf_hooks';
import { load } from 'cheerio';
import { weather } from '../examples/weather/index.js';
const object = weather();
const json = JSON.stringify(object);
const html =
  '<!doctype html><html><head><title>Mock Seoul Weather</title></head><body><nav>Home | Cities | News</nav><h1>Seoul weather</h1>' +
  Array.from(
    { length: 20 },
    (_, i) =>
      '<article><h2>City story ' +
      i +
      '</h2><p>Fictional background material and unrelated local travel information.</p></article>',
  ).join('') +
  '<section id="weather" data-subject="geo:kr:seoul"><h2>Current temperature</h2><span class="temperature">18.2</span><span class="unit">C</span><time>2026-09-29T00:00:00.000Z</time></section><footer>Mock weather source | Demo Weather Provider</footer></body></html>';
function parseHtml() {
  const $ = load(html);
  return {
    subject: $('#weather').attr('data-subject'),
    value: Number($('.temperature').text()),
    unit: $('.unit').text(),
    observedAt: $('time').text(),
  };
}
function parseJson() {
  const parsed = JSON.parse(json) as typeof object;
  return {
    subject: parsed.subject,
    value: parsed.value,
    unit: parsed.unit,
    observedAt: parsed.observedAt,
  };
}
if (JSON.stringify(parseHtml()) !== JSON.stringify(parseJson()))
  throw new Error('Sources must expose equivalent target data');
const iterations = 2000;
for (let i = 0; i < 100; i++) {
  parseHtml();
  parseJson();
}
function measure(fn: () => unknown) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return Number((performance.now() - start).toFixed(3));
}
console.log(
  'SYNTHETIC LOCAL BENCHMARK — no network, LLM or universal speed claim',
);
console.log(
  JSON.stringify(
    {
      iterations,
      environment: process.version,
      html: {
        bytes: Buffer.byteLength(html),
        parsePasses: 1,
        selectorOperations: 4,
        elapsedMs: measure(parseHtml),
      },
      aiw: {
        bytes: Buffer.byteLength(json),
        parsePasses: 1,
        fieldReads: 4,
        elapsedMs: measure(parseJson),
      },
    },
    null,
    2,
  ),
);
