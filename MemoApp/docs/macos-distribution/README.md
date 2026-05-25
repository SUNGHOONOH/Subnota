# Subnota macOS DMG Distribution

Subnota를 `.dmg`로 공개 배포하기 전에 필요한 작업입니다. 로컬 테스트용 DMG와 공개 배포용 DMG를 구분해서 진행합니다.

## 현재 빌드 명령

```sh
corepack pnpm macos:dmg
```

산출물:

```text
dist/macos/Subnota-<version>-<timestamp>/Subnota-<version>.dmg
```

로컬 테스트만 할 때:

```sh
ALLOW_LOCALHOST_BACKEND=1 SKIP_VERIFY=1 corepack pnpm macos:dmg
```

이 방식은 unsigned DMG라 공개 배포용이 아닙니다.

## 공개 배포 전 필수 항목

1. `.env`의 백엔드 URL을 공개 HTTPS 주소로 변경합니다.

```text
MEMO_BACKEND_URL=https://api.example.com
```

`localhost`, `127.0.0.1`, `0.0.0.0` 값은 실제 사용자 Mac에서 동작하지 않으므로 배포 스크립트가 기본적으로 막습니다.

2. Apple Developer ID Application 인증서를 준비합니다.

3. notarytool keychain profile을 준비합니다.

```sh
xcrun notarytool store-credentials subnota-notary \
  --apple-id "apple@example.com" \
  --team-id "TEAMID1234" \
  --password "app-specific-password"
```

4. signed/notarized DMG를 생성합니다.

```sh
DEVELOPER_ID_APPLICATION="Developer ID Application: Your Name (TEAMID1234)" \
NOTARYTOOL_PROFILE="subnota-notary" \
corepack pnpm macos:dmg
```

## 배포 전 검증

```sh
hdiutil verify dist/macos/.../Subnota-0.0.1.dmg
codesign --verify --deep --strict --verbose=2 /path/to/Subnota.app
spctl --assess --type execute --verbose /path/to/Subnota.app
```

수동 확인:

- 새 Mac 또는 깨끗한 사용자 계정에서 DMG 열기
- `Subnota.app`을 `/Applications`로 드래그
- Gatekeeper 경고 없이 실행되는지 확인
- 로그인, 동기화, 캘린더, 메모 저장, 네트워크 요청이 실제 백엔드로 가는지 확인
- Finder, Dock, Launchpad에서 앱 이름과 아이콘이 정상 표시되는지 확인

## 랜딩 페이지 다운로드

권장 URL 구조:

```text
https://download.example.com/subnota/Subnota-latest.dmg
https://download.example.com/subnota/Subnota-0.0.1.dmg
https://download.example.com/subnota/latest.json
```

`latest.json` 예시:

```json
{
  "version": "0.0.1",
  "platform": "macos",
  "arch": "universal",
  "url": "https://download.example.com/subnota/Subnota-0.0.1.dmg",
  "sha256": "<sha256 checksum>",
  "releasedAt": "2026-05-23"
}
```

랜딩 페이지 버튼:

```html
<a href="https://download.example.com/subnota/Subnota-latest.dmg">
  Download for Mac
</a>
```

호스팅 체크리스트:

- S3, Cloudflare R2, Vercel Blob, Supabase Storage 중 하나를 사용합니다.
- DMG 응답 헤더는 `Content-Type: application/x-apple-diskimage`로 설정합니다.
- `Content-Disposition`으로 다운로드 파일명을 `Subnota-<version>.dmg` 형태로 고정합니다.
- 버전별 DMG는 긴 캐시, `latest` 별칭은 짧은 캐시를 사용합니다.
- 랜딩 페이지에는 최소 지원 macOS 버전, Apple Silicon/Intel 지원 여부, 최신 버전, 배포일을 표시합니다.

## 릴리즈 순서

1. `package.json` 버전을 올립니다.
2. 공개 HTTPS 백엔드를 먼저 배포합니다.
3. `.env`의 `MEMO_BACKEND_URL`을 배포 백엔드로 변경합니다.
4. signed/notarized DMG를 생성합니다.
5. `hdiutil`, `codesign`, `spctl`, 새 Mac 수동 설치 테스트를 통과시킵니다.
6. DMG와 `latest.json`을 스토리지/CDN에 업로드합니다.
7. 랜딩 페이지 다운로드 URL, 버전, 날짜를 업데이트합니다.
8. 실제 랜딩 페이지에서 다운로드부터 실행까지 다시 확인합니다.

## 나중에 결정할 것

- 실제 공개 백엔드 도메인
- DMG 파일을 올릴 스토리지/CDN
- Apple Developer Team ID와 notarization profile
- 자동 업데이트 도입 여부
- 최소 지원 macOS 버전

자동 업데이트가 필요하면 Sparkle 같은 macOS 업데이트 프레임워크를 별도 검토합니다. 첫 배포는 랜딩 페이지에서 최신 DMG를 다시 다운로드하게 하는 방식이 가장 단순합니다.
