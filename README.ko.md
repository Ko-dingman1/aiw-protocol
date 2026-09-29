# AIW Protocol Prototype v0.1

**실험용 프로젝트 · AI-Native Knowledge Exchange Network**

AI 에이전트가 정보 제공 노드를 찾고, 출처와 변환 이력이 포함된 구조화 데이터를 HTTP로 가져오는 작은 프로토타입입니다. 새로운 인터넷을 발명했다는 주장이 아니라, 특정 설계 가설을 실행 가능한 코드로 검토하는 프로젝트입니다.

## 어떤 문제를 살펴보나요?

에이전트는 때때로 사람이 읽도록 만든 페이지에서 필요한 정보를 추출합니다. 원본 데이터가 이미 구조화되어 있다면, 화면을 다시 해석하는 대신 공통 형식으로 직접 받을 수 있지 않을까요? 기존 API, RDF, JSON-LD, MCP 등을 대체하려는 목적은 없습니다.

## 실행

Node.js 24 LTS와 pnpm 12을 준비한 뒤 저장소 루트에서 실행합니다.

```sh
pnpm install
pnpm demo
pnpm demo:finance
pnpm demo:conflicts
pnpm demo:derived
pnpm demo:subscribe
pnpm benchmark
```

각 데모는 로컬 HTTP 서버 두 개를 사용 가능한 포트로 띄우고, 실행이 끝나면 종료합니다. 별도 데이터베이스, Docker, API 키, LLM 호출은 필요 없습니다. 서버를 계속 실행하려면 pnpm dev를 사용하세요. Registry는 4000번, Node는 4001번 포트를 사용합니다.

**모든 수치는 가상 데이터입니다.** 서울 기온도 실제 관측값이 아니며, 삼성전자 가격도 투자 판단에 사용할 수 없습니다. 초기 시각은 고정된 예시이고 SSE는 변화를 모의 생성합니다.

## 구조와 읽는 순서

클라이언트 → Resolver → Registry에서 위치 조회 → 발견한 Node에 직접 질의 → Knowledge Object 수신 순서로 동작합니다. 클라이언트에는 날씨 노드 주소를 하드코딩하지 않았습니다. Resolver는 별도 서버가 아닌 라이브러리이며, 실제 Registry HTTP API를 호출합니다.

- packages/core: 데이터 계약, 오류 모델, 구조 검증
- packages/resolver: 네임스페이스·스키마·기능으로 노드 찾기
- packages/client: 응답 검증, 질의, ID 조회, SSE 구독
- packages/adapter-sdk: 기존 데이터를 객체로 변환하는 인터페이스
- apps: Registry, 예시 Node, 명령줄 클라이언트
- examples: 날씨, 금융, 상충하는 제공자, 파생 데이터

발견과 기능 정보는 **제어 평면(control plane)**, 실제 객체와 출처·근거·구독은 **지식 평면(knowledge plane)**에 속합니다. 노드 운영자와 개별 데이터 제공자는 별개입니다.

## 데이터와 신뢰를 분리합니다

Knowledge Object는 관측, 주장, 추론, 기록, 사건, 문서 참조를 구분합니다. provider는 게시 책임자, source는 원래 출처, evidence는 주장을 뒷받침하는 자료, provenance는 가공 과정입니다. AI가 만든 추론은 ai-inference로 표시할 수 있고, 파생 데이터는 입력 객체의 ID와 버전을 남깁니다.

상충 예제는 같은 회사의 직원 수 10,231명과 10,417명을 모두 반환합니다. 임의로 하나를 정답으로 고르지 않습니다. 파생 예제는 두 주장의 최솟값·최댓값을 계산하고 입력을 기록합니다. 실제 AI 호출이 없으므로 derived-data로 정직하게 표시합니다.

“AIW transports evidence; it does not manufacture truth.” 근거를 전달할 뿐, 보편적인 진실을 판정하지 않는다는 뜻입니다. VERIFY 역시 필드와 참조를 검사하며 사실 여부를 판정하지 않습니다.

## 검증과 한계

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

메모리 저장만 사용하므로 재시작하면 데이터가 초기화됩니다. 인증, 실제 제공자 신원 확인, 과거 버전 조회, SSE 재전송, 스키마 레지스트리는 없습니다. 로컬 실험용이며 외부 공개 운영에 적합하지 않습니다. 벤치마크도 합성 HTML과 JSON의 로컬 파싱 비교일 뿐, 웹 전체보다 빠르다는 증명이 아닙니다.

다음 단계는 도메인 스키마 검증, 제공자 식별, 기존 인증 체계 연동입니다. RDF/JSON-LD와 MCP 연동은 이후 실험으로 남겨 두었습니다. 먼저 [영문 README](README.md), [설계 배경](docs/architecture.md), [객체 계약](docs/knowledge-object.md), [통합 테스트](tests/http.test.ts)를 읽으면 전체 흐름을 파악할 수 있습니다.

기여 방법은 [CONTRIBUTING.md](CONTRIBUTING.md), 라이선스는 [MIT](LICENSE)를 참고하세요.
