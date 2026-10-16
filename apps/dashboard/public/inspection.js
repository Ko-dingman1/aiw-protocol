function element(tag, label, className) {
  const node = document.createElement(tag);
  node.textContent = label;
  if (className) node.className = className;
  return node;
}

/** Each render owns a detached-safe slot, so slow requests cannot overwrite another selection. */
export function addInspection(object, panel, json, selectVersion) {
  const slot = element('section', '', 'version-tools');
  slot.append(element('h4', '버전 이력 · HISTORY', 'detail-subheading'));
  const status = element(
    'p',
    '보관된 버전과 참조를 확인하고 있습니다.',
    'provenance',
  );
  slot.append(status);
  panel.append(slot);
  const path = '/objects/' + encodeURIComponent(object.id);
  Promise.all([
    json(path + '/history'),
    json(path + '/verify?version=' + object.version),
  ])
    .then(([history, result]) => {
      if (!slot.isConnected) return;
      status.textContent =
        history.retained +
        '개 보관 / 최대 ' +
        history.retentionLimit +
        '개 · 메모리 보관이므로 재시작하면 초기화됩니다.';
      const label = element('label', '조회할 버전 ', 'history-label');
      const select = document.createElement('select');
      select.setAttribute('aria-label', '조회할 객체 버전');
      for (const version of history.versions)
        select.append(
          new Option(
            'v' + version + (version === history.versions[0] ? ' · 최신' : ''),
            String(version),
          ),
        );
      select.value = String(object.version);
      select.addEventListener('change', () =>
        selectVersion(object.id, Number(select.value)),
      );
      label.append(select);
      slot.append(label);
      const latest = element('button', '최신 버전 따라가기', 'reference');
      latest.addEventListener('click', () => selectVersion(object.id));
      slot.append(latest);
      slot.append(
        element(
          'p',
          result.valid
            ? '✓ 스키마·메타데이터·정확한 참조 버전 확인 완료. 사실 여부를 보증하지 않습니다.'
            : '검증 미완료: ' + result.issues.join(' / '),
          'verify' + (result.valid ? '' : ' warning'),
        ),
      );
    })
    .catch((error) => {
      if (slot.isConnected) {
        status.textContent = error.message;
        status.className = 'verify warning';
      }
    });
  const schema = document.createElement('details');
  schema.append(element('summary', '도메인 스키마 규칙 보기'));
  const content = element('pre', '불러오는 중…');
  schema.append(content);
  panel.append(schema);
  schema.addEventListener('toggle', async () => {
    if (!schema.open || schema.dataset.loaded) return;
    try {
      const document = await json(
        '/schemas/' + encodeURIComponent(object.schema),
      );
      content.textContent = JSON.stringify(document, null, 2);
      schema.dataset.loaded = 'true';
    } catch (error) {
      content.textContent = error.message;
    }
  });
}
