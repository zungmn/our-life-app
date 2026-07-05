# 아이폰 위젯 (Scriptable)

우리 집 앱의 **Todo**와 **캘린더**를 아이폰 홈 화면 위젯으로 띄웁니다.
웹앱은 iOS 네이티브 위젯(WidgetKit)을 직접 만들 수 없어, 무료 앱 **Scriptable**로 우회합니다.

## 1. 준비 (한 번만)

1. Vercel → 프로젝트 → **Settings → Environment Variables** 에 추가:
   - `WIDGET_KEY` = 아무 긴 랜덤 문자열 (예: `wg_9fK2s...`) — 위젯 인증용 비밀키
2. **Redeploy** (환경변수 반영).
3. 앱스토어에서 **Scriptable** 앱 설치.

## 2. 스크립트 등록

Scriptable 앱에서 `+` 로 새 스크립트 2개를 만들고 각각 붙여넣기:

- `todo-widget.js` → Todo 위젯 (애플 미리알림 스타일)
- `calendar-widget.js` → 캘린더 위젯 (구글 캘린더 스타일)

각 스크립트 맨 위 값을 수정:

```js
const BASE_URL = "https://our-life-app.vercel.app"
const KEY      = "위에서_정한_WIDGET_KEY"
const VIEWER   = "eddy"   // Todo 위젯만: eddy 또는 judy
```

## 3. 홈 화면에 추가

홈 화면 → 길게 누르기 → `+` → **Scriptable** → 위젯 크기 선택(중간/큰) 추가
→ 위젯 길게 눌러 **Edit Widget** → Script 에서 해당 스크립트 선택.

- 위젯을 탭하면 앱의 해당 페이지(/todos, /calendar)가 열립니다.
- 큰 위젯은 더 많은 항목을 보여줍니다.

## API (참고)

- `GET /api/widget/todos?key=<WIDGET_KEY>&viewer=eddy`
- `GET /api/widget/calendar?key=<WIDGET_KEY>&days=14`

`WIDGET_KEY` 가 없거나 틀리면 401. 읽기 전용입니다.
