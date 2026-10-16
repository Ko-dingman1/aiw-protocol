import { addInspection } from './inspection.js';
const $ = (id) => document.getElementById(id);
let config;
let objects = [];
let view = 'all';
let selectedId;
let inspectedVersion;
let detailsKey;
let selectionRequest = 0;
let stream;
let busy = false;
let weatherStatus;

async function json(url, init) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error?.message ?? '요청에 실패했습니다.');
  return body;
}
function text(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}
function time(value) {
  return value
    ? new Date(value).toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour12: false,
      }) + ' KST'
    : '—';
}
function valueOf(object) {
  return typeof object.value === 'object'
    ? JSON.stringify(object.value)
    : String(object.value) + (object.unit ? ' ' + object.unit : '');
}
function notice(message) {
  $('notice').textContent = message;
  $('notice').hidden = !message;
}
function filtered() {
  const search = $('search').value.toLowerCase();
  const namespace = $('namespace').value;
  return objects.filter(
    (object) =>
      (!namespace || object.namespace === namespace) &&
      [object.subject, object.property, object.provider.name, object.id].some(
        (part) => part.toLowerCase().includes(search),
      ) &&
      (view !== 'derived' || object.derivedFrom?.length) &&
      (view !== 'conflicts' ||
        objects.some(
          (other) =>
            other.id !== object.id &&
            other.subject === object.subject &&
            other.property === object.property &&
            other.provider.id !== object.provider.id &&
            JSON.stringify(other.value) !== JSON.stringify(object.value),
        )),
  );
}
function renderObjects() {
  const visible = filtered();
  $('objects').replaceChildren();
  $('result-summary').textContent =
    visible.length + '개 객체 · 제공자별 정보를 그대로 표시합니다';
  if (!visible.length)
    $('objects').append(
      text(
        'p',
        '일치하는 객체가 없습니다. 검색어나 필터를 바꿔보세요.',
        'empty',
      ),
    );
  for (const object of visible) {
    const button = text(
      'button',
      '',
      'object' + (selectedId === object.id ? ' selected' : ''),
    );
    button.type = 'button';
    button.setAttribute('aria-pressed', String(selectedId === object.id));
    const top = text('div', '', 'object-top');
    top.append(
      text('span', object.property, 'property'),
      text(
        'span',
        object.source?.mock
          ? 'MOCK'
          : object.originType === 'imported-data'
            ? 'LIVE API'
            : object.type,
        'badge' + (object.source?.mock ? ' mock' : ''),
      ),
    );
    const bottom = text('div', '', 'object-bottom');
    bottom.append(
      text('span', valueOf(object), 'object-value'),
      text('span', object.provider.name, 'object-provider'),
    );
    button.append(top, text('p', object.subject, 'subject'), bottom);
    button.addEventListener('click', () => {
      selectionRequest++;
      selectedId = object.id;
      inspectedVersion = undefined;
      renderObjects();
      renderDetails();
    });
    $('objects').append(button);
  }
}
function row(label, value) {
  const node = text('div', '', 'detail-row');
  node.append(text('span', label), text('span', value));
  return node;
}
function renderDetails() {
  const object =
    inspectedVersion ?? objects.find((item) => item.id === selectedId);
  if (!object) return;
  const key =
    object.id +
    '@' +
    object.version +
    (inspectedVersion ? ':pinned' : ':latest');
  if (key === detailsKey) return;
  detailsKey = key;
  const panel = $('details');
  panel.replaceChildren();
  panel.append(
    text('h3', object.id, 'details-title'),
    row('제공자', object.provider.name),
    row('원본 출처', object.source?.description ?? '미제공'),
    row('유형 / 기원', object.type + ' / ' + object.originType),
    row('기준 시각', time(object.observedAt)),
    row('가져온 시각', time(object.updatedAt ?? object.createdAt)),
    row('버전', 'v' + object.version),
    row('스키마', object.schema),
  );
  if (inspectedVersion)
    panel.append(
      text(
        'p',
        '선택한 버전을 고정해서 보고 있습니다. 새 데이터가 와도 이 화면의 값은 바뀌지 않습니다.',
        'verify',
      ),
    );
  addInspection(object, panel, json, selectVersion);
  panel.append(text('h4', '변환 이력 · PROVENANCE', 'detail-subheading'));
  for (const entry of object.provenance ?? [])
    panel.append(
      text(
        'p',
        entry.activity + ' · ' + entry.agent + ' · ' + time(entry.at),
        'provenance',
      ),
    );
  if (object.evidence?.length) {
    panel.append(text('h4', '근거 · EVIDENCE', 'detail-subheading'));
    for (const evidence of object.evidence)
      panel.append(text('p', evidence.description, 'provenance'));
  }
  const refs = object.derivedFrom ?? [];
  if (refs.length) {
    panel.append(text('h4', '입력 객체 · DERIVED FROM', 'detail-subheading'));
    for (const ref of refs) {
      const button = text(
        'button',
        '↳ ' + ref.id + ' @ v' + ref.version,
        'reference',
      );
      button.addEventListener('click', () =>
        selectVersion(ref.id, ref.version),
      );
      panel.append(button);
    }
  }
  const raw = document.createElement('details');
  raw.append(
    text('summary', '원본 JSON 보기'),
    text('pre', JSON.stringify(object, null, 2)),
  );
  panel.append(raw);
}
async function selectVersion(id, version) {
  const request = ++selectionRequest;
  try {
    const object = await json(
      '/objects/' +
        encodeURIComponent(id) +
        (version === undefined ? '' : '?version=' + version),
    );
    if (request !== selectionRequest) return;
    selectedId = id;
    inspectedVersion = version === undefined ? undefined : object;
    if (version === undefined) {
      const index = objects.findIndex((item) => item.id === id);
      if (index >= 0) objects[index] = object;
      else objects.push(object);
    }
    view = 'all';
    $('search').value = '';
    $('namespace').value = '';
    for (const tab of document.querySelectorAll('[data-view]'))
      tab.classList.toggle('selected', tab.dataset.view === 'all');
    detailsKey = undefined;
    renderObjects();
    renderDetails();
  } catch (error) {
    if (request === selectionRequest)
      notice('버전을 조회하지 못했습니다: ' + error.message);
  }
}
async function queryAll(endpoint) {
  const result = [];
  let cursor;
  const seen = new Set();
  do {
    const page = await json(new URL('/query', endpoint), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 100, cursor }),
    });
    result.push(...page.objects);
    cursor = page.nextCursor;
    if (cursor && (seen.has(cursor) || seen.size >= 100))
      throw new Error('페이지 조회가 끝나지 않습니다.');
    if (cursor) seen.add(cursor);
  } while (cursor);
  return result;
}
function renderSummary() {
  $('object-count').textContent = objects.length;
  const weather = objects.find((object) => object.namespace === 'weather.kr');
  $('temperature').textContent = weather ? weather.value : '—';
  $('weather-label').textContent =
    config.mode === 'live' ? 'LIVE · 모델 데이터' : 'MOCK · 가상 데이터';
  $('weather-label').className =
    'badge' + (config.mode === 'mock' ? ' mock' : '');
  $('weather-time').textContent = weather
    ? '기준 ' + time(weather.observedAt)
    : '실제 날씨 데이터가 없습니다. 연결 상태를 확인하세요.';
  $('attribution').hidden = config.mode !== 'live';
}
async function sourceStatus() {
  weatherStatus = await json('/source-status');
  if (weatherStatus.state === 'error')
    notice(
      '외부 날씨 연결 실패: ' +
        weatherStatus.error +
        (weatherStatus.lastSuccessAt
          ? ' · 마지막 성공 ' +
            time(weatherStatus.lastSuccessAt) +
            '. 이전 값을 표시합니다.'
          : ' · 가상 데이터로 대체하지 않았습니다.'),
    );
}
async function load() {
  if (busy) return;
  busy = true;
  $('reload').disabled = true;
  try {
    notice('');
    const discovery = await json(
      new URL('/discover?capability=query', config.registryUrl),
    );
    // This local dashboard only contacts its configured node, never arbitrary registry destinations.
    const nodes = discovery.nodes.filter(
      (node) => node.endpoint === config.nodeUrl,
    );
    if (!nodes.length)
      throw new Error('Registry에서 연결 가능한 로컬 노드를 찾지 못했습니다.');
    const results = await Promise.all(
      nodes.map((node) => queryAll(node.endpoint)),
    );
    objects = results.flat();
    $('node-count').textContent = nodes.length;
    $('node-name').textContent = nodes.map((node) => node.nodeId).join(', ');
    const old = $('namespace').value;
    $('namespace').replaceChildren(new Option('모든 네임스페이스', ''));
    for (const name of [...new Set(objects.map((object) => object.namespace))])
      $('namespace').append(new Option(name, name));
    $('namespace').value = old;
    if (!selectedId || !objects.some((object) => object.id === selectedId))
      selectedId =
        objects.find((object) => object.namespace === 'weather.kr')?.id ??
        objects[0]?.id;
    await sourceStatus();
    renderSummary();
    renderObjects();
    renderDetails();
    if (!stream) subscribe(nodes[0].endpoint);
  } catch (error) {
    notice(error.message);
    $('connection').textContent = '조회 실패';
  } finally {
    busy = false;
    $('reload').disabled = false;
  }
}
function subscribe(endpoint) {
  stream = new EventSource(new URL('/subscribe', endpoint));
  stream.onopen = () => {
    $('connection').textContent = '● STREAM 연결됨';
  };
  stream.onerror = () => {
    $('connection').textContent = '연결 재시도 중';
  };
  stream.addEventListener('object', (event) => {
    try {
      const object = JSON.parse(event.data);
      const index = objects.findIndex((item) => item.id === object.id);
      if (index >= 0) objects[index] = object;
      else objects.push(object);
      renderSummary();
      renderObjects();
      renderDetails();
    } catch {
      notice('구독 데이터 형식이 올바르지 않습니다.');
    }
  });
}
$('search').addEventListener('input', renderObjects);
$('namespace').addEventListener('change', renderObjects);
$('reload').addEventListener('click', load);
for (const button of document.querySelectorAll('[data-view]'))
  button.addEventListener('click', () => {
    view = button.dataset.view;
    for (const tab of document.querySelectorAll('[data-view]'))
      tab.classList.toggle('selected', tab === button);
    renderObjects();
  });
$('refresh').addEventListener('click', async () => {
  $('refresh').disabled = true;
  try {
    await json('/refresh', {
      method: 'POST',
      headers: { 'x-aiw-request': 'dashboard' },
    });
    await load();
  } catch (error) {
    notice(error.message);
    await sourceStatus().catch(() => {});
  } finally {
    $('refresh').disabled = config.mode !== 'live';
  }
});
window.addEventListener('pagehide', () => stream?.close());
async function start() {
  try {
    config = await json('/dashboard-config');
    $('mode').textContent =
      config.mode === 'live'
        ? '● LIVE WEATHER + MOCK EXAMPLES'
        : '● OFFLINE MOCK MODE';
    $('mode').className = 'badge' + (config.mode === 'mock' ? ' mock' : '');
    $('refresh').disabled = config.mode !== 'live';
    await load();
  } catch (error) {
    notice('시작하지 못했습니다: ' + error.message);
  }
}
void start();
