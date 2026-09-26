# Subnota iOS (개발 중)

`ios/`는 React Native가 아닌 네이티브 Swift 앱입니다. 현재 개발 중이며 아직
완성되거나 배포된 앱이 아닙니다. 기능·동기화·디자인이 데스크톱과 동일하다고
가정하지 마세요.

## 구성

- `Subnota/`: SwiftUI 앱 화면, 인증, 동기화 및 앱 진입점
- `SubnotaKit/`: 로컬 저장소, 메모·일정·검색 모델과 단위 테스트를 담는 Swift 패키지
- `SubnotaShareExtension/`, `SubnotaWidgets/`: 공유 확장과 홈 화면 위젯
- `project.yml`: XcodeGen 프로젝트 정의

이전 React Native 앱 코드는 저장소에서 제거했습니다. 새로운 iOS 작업은 이
디렉터리에서 진행합니다.

## 로컬 설정과 프로젝트 생성

macOS와 Xcode가 필요합니다. 저장소 루트에서 다음을 실행합니다.

```sh
cd ios
cp Config.xcconfig.example Config.xcconfig
# Config.xcconfig에 SUPABASE_URL과 SUPABASE_ANON_KEY를 입력한다.
xcodegen generate
open Subnota.xcodeproj
```

`Config.xcconfig`는 로컬 전용이며 커밋하지 않습니다. Supabase `service_role` 키를
넣지 마세요. `MEMO_BACKEND_URL`은 계정 삭제 기능에만 사용되며 비워 두면 해당
기능이 비활성화됩니다.

## 검증 범위

공유 로직 테스트는 다음 명령으로 실행할 수 있습니다.

```sh
swift test --package-path ios/SubnotaKit
```

이 테스트 통과나 Xcode 컴파일 성공은 iOS 앱의 기능 완성·릴리스 준비를 뜻하지
않습니다. 실제 기기 동작, 인증·동기화, 공유 확장과 위젯의 출시 전 검증은 별도로
필요합니다.
