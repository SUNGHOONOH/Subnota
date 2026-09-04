# Subnota Mac App Store 심사 자료

이 문서는 MAS 빌드에서 사용하는 App Sandbox 임시 예외, 심사 재현 절차와
거절 시 fallback을 한곳에서 관리한다. GitHub Release용 DMG에는 적용하지 않는다.

공식 기준:

- [App Sandbox information](https://developer.apple.com/help/app-store-connect/reference/app-uploads/app-sandbox-information/)
- [App Sandbox Temporary Exception Entitlements](https://developer.apple.com/library/archive/documentation/Miscellaneous/Reference/EntitlementKeyReference/Chapters/AppSandboxTemporaryExceptionEntitlements.html)
- [NSAppleEventsUsageDescription](https://developer.apple.com/documentation/bundleresources/information-property-list/nsappleeventsusagedescription)
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)

## 1. 빌드 정책

| 정책 | 명령 | 현재 페이지 저장 | Apple Events 임시 예외 |
|---|---|---|---|
| 심사 시도 | `pnpm release:mas` | 기존 UX 유지 | Safari·Chrome·Arc·Edge·Brave |
| 심사 fallback | `pnpm release:mas:fallback` | MAS에서만 미노출 | 없음 |

fallback은 UI만 숨기는 빌드가 아니다. 네이티브 캡처 메뉴·버튼·단축키와
`NSAppleEventsUsageDescription`, automation 및 temporary-exception entitlement를
함께 제거한다. 메모, 캘린더, Quick Subnota, 수동 URL 저장과 동기화는 유지한다.

## 2. Feedback Assistant — 출시 담당자 입력

- [ ] Safari가 현재 탭 URL·제목에 사용할 수 있는 App Sandbox scripting access
  group을 제공하지 않는 문제/기능 요청을 Feedback Assistant에 제출한다.
- [ ] Feedback ID를 기록한다: `FB________________`
- [ ] Chrome·Arc·Edge·Brave 개발사에는 필요한 scripting access group 지원 요청을
  남기고 요청 URL 또는 티켓 번호를 내부 출시 기록에 보관한다.
- [ ] 임시 예외 빌드를 업로드할 때 workflow의 `apple_events_feedback_id`에 실제
  `FB` 번호를 입력한다. placeholder나 빈 값으로는 업로드하지 않는다.

## 3. App Sandbox Entitlement Usage Information

App Store Connect의 App Sandbox Entitlement Usage Information에 아래 내용을
영문으로 입력한다. `FBXXXXXXXX`는 실제 번호로 바꾼다.

### Entitlement Key

`com.apple.security.temporary-exception.apple-events`

### Usage Information

> Subnota includes an explicitly user-initiated “Save Current Page” action. When
> the user invokes that action, Subnota sends an Apple Event to the selected
> supported browser and reads only the URL and title of its current tab. Subnota
> does not read page content, browsing history lists, cookies, credentials, form
> data, or background tabs, and it performs no continuous or background browser
> monitoring. The saved URL and title are placed in the user's Subnota Inbox and
> may sync to the user's signed-in Subnota account for app functionality.
>
> The target values are: `com.apple.Safari` for Safari,
> `com.google.Chrome` for Google Chrome, `company.thebrowser.Browser` for Arc,
> `com.microsoft.edgemac` for Microsoft Edge, and `com.brave.Browser` for Brave.
> These browsers do not expose a scripting access group that covers reading the
> current tab URL and title. Feedback Assistant: `FBXXXXXXXX`.

## 4. 심사 재현 절차

1. 심사용 계정으로 Subnota에 로그인한다.
2. Safari 또는 선언된 브라우저에서 일반 `https://` 페이지를 연다.
3. Subnota 메뉴바의 **Save Current Page**를 선택하거나 지정된 캡처 단축키를 누른다.
4. macOS Automation 권한 대화상자에서 허용한다.
5. Subnota Inbox에 해당 페이지 제목과 URL이 저장되는지 확인한다.
6. 권한을 거부한 경우에도 앱이 멈추지 않고 저장 실패 상태만 표시하는지 확인한다.

심사 노트에는 위 절차, 심사용 로그인 정보와 30초 안팎의 시연 영상을 함께 제공한다.
권한 대화상자는 앱 실행 시 선제적으로 띄우지 않고 사용자가 현재 페이지 저장을
실행했을 때만 나타난다.

## 5. App Privacy 확인

현재 페이지 저장 결과는 로그인 계정의 Inbox에 동기화될 수 있으므로 App Store
Connect의 App Privacy 답변은 최소한 다음 판단을 반영한다.

- Data Type: **Browsing History** — 사용자가 명시적으로 저장한 웹페이지 URL·제목
- Purpose: **App Functionality**
- Linked to User: 로그인 계정에 동기화되므로 **Yes**
- Used for Tracking: 광고 추적에 사용하지 않으므로 **No**

메모·일정·AI 처리 등 다른 데이터 유형은 전체 앱 데이터 흐름을 기준으로 별도
확인한다. App Privacy 답변은 macOS와 iOS를 포함한 앱의 실제 수집 범위와
개인정보처리방침이 서로 일치해야 한다.

## 6. 업로드 전 게이트

- [ ] `SUBNOTA_MAS_BROWSER_CAPTURE=1`이면 실제 Feedback ID를 확보했다.
- [ ] 배열의 다섯 bundle ID를 Usage Information에서 각각 설명했다.
- [ ] App Store Connect에 Usage Information을 저장했다.
- [ ] 한국어·영어 `NSAppleEventsUsageDescription`이 빌드에 포함됐다.
- [ ] App Privacy의 Browsing History 답변과 개인정보처리방침이 실제 동기화
  동작과 일치한다.
- [ ] `scripts/verify-mas-release.sh`가 main/helper entitlement, provisioning
  profile, 권한 현지화와 PKG 서명을 통과했다.
- [ ] Apple Development MAS 빌드 또는 TestFlight에서 허용·거부 양쪽을 시험했다.
- [ ] GitHub Actions가 지원 중인 Apple silicon `macos-15` runner에서 빌드됐고
  main 및 native module이 모두 arm64인지 검증했다.

## 7. 거절 대응

1. 첫 거절에는 위 Usage Information과 Feedback ID를 App Review 대화에 다시
   제공하고 기능이 사용자 시작·URL/제목 읽기 전용임을 설명한다.
2. Apple이 임시 예외를 허용하지 않으면 `browser_capture_mode=fallback`으로 새
   PKG를 만든다.
3. fallback 산출물에 Apple Events entitlement와 목적 문자열이 없고 현재 페이지
   저장 표면이 노출되지 않는지 검증한 뒤 재제출한다.
4. Safari Web Extension 등 정식 확장 경로가 준비되면 임시 예외 방식은 제거한다.
