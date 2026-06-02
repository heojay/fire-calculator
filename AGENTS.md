# AGENTS.md

- 작업이 끝나면 즉시 `git commit`과 `git push`까지 진행한다.
- 커밋 메시지는 한국어로 작성한다.
- 커밋 설명과 작업 요약도 한국어로 작성한다.
- 주요 계산식, 입력 항목, 계산 모드, 금액 표시 기준이 바뀌면 앱 도움말과 README도 함께 업데이트한다.
- Test 시에는 Playwright Skills를 활용한다.
- 프론트엔드 UI/UX 작업 시 `frontend-design`, `vercel-react-best-practices`, `web-design-guidelines` Skills를 먼저 참고한다.
- React 변경 시 불필요한 재렌더링, 무거운 파생 계산, 큰 번들로 이어지는 import를 함께 점검한다.
- UI 변경 후에는 Playwright Skills로 데스크톱과 모바일 뷰포트에서 레이아웃, 포커스 이동, 주요 상호작용을 확인한다.
- 계산기 화면의 금액, 비율, 연도 입력은 모바일 키보드, 스크린리더 설명, 키보드 조작 가능성을 함께 고려한다.
- 공유 가능한 화면 상태를 추가하거나 바꿀 때는 URL 쿼리 파라미터와 새로고침 복원 동작을 함께 점검한다.
