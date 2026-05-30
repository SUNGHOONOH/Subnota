#import "AppDelegate.h"

#import <Carbon/Carbon.h>
#import <QuartzCore/QuartzCore.h>
#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>

@interface AppDelegate (SubnotaPrivate)
- (void)captureCurrentBrowserPage;
@end

static OSStatus SubnotaHotKeyHandler(EventHandlerCallRef nextHandler, EventRef event, void *userData)
{
  AppDelegate *delegate = (__bridge AppDelegate *)userData;
  [delegate captureCurrentBrowserPage];
  return noErr;
}

@interface AppDelegate ()
@property (nonatomic, strong) NSStatusItem *statusItem;
@property (nonatomic, strong) NSPanel *miniPanel;
@property (nonatomic, strong) NSTextField *statusTextField;
@property (nonatomic, strong) NSTextField *recentTextField;
@property (nonatomic, copy) NSArray<NSDictionary<NSString *, NSString *> *> *recentInboxItems;
@property (nonatomic, assign) BOOL hasUnreadInboxItems;
@property (nonatomic, assign) EventHotKeyRef captureHotKeyRef;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification
{
  self.moduleName = @"MemoApp";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};
  self.dependencyProvider = [RCTAppDependencyProvider new];

  [super applicationDidFinishLaunching:notification];
  [self setupURLHandling];
  [self setupMenuBarItem];
  [self registerGlobalHotKey];
}

- (void)setupURLHandling
{
  [[NSAppleEventManager sharedAppleEventManager] setEventHandler:[RCTLinkingManager class]
                                                    andSelector:@selector(getUrlEventHandler:withReplyEvent:)
                                                  forEventClass:kInternetEventClass
                                                     andEventID:kAEGetURL];
}

- (void)setupMenuBarItem
{
  self.statusItem = [[NSStatusBar systemStatusBar] statusItemWithLength:NSVariableStatusItemLength];
  self.statusItem.button.title = @"S";
  self.statusItem.button.toolTip = @"Subnota";
  self.statusItem.button.wantsLayer = YES;
  self.statusItem.button.target = self;
  self.statusItem.button.action = @selector(statusItemClicked:);
  [self.statusItem.button sendActionOn:NSEventMaskLeftMouseUp | NSEventMaskRightMouseUp];
}

- (void)registerGlobalHotKey
{
  EventHotKeyID hotKeyID;
  hotKeyID.signature = 'SBN1';
  hotKeyID.id = 1;

  EventTypeSpec eventType;
  eventType.eventClass = kEventClassKeyboard;
  eventType.eventKind = kEventHotKeyPressed;

  InstallApplicationEventHandler(&SubnotaHotKeyHandler, 1, &eventType, (__bridge void *)self, NULL);
  RegisterEventHotKey(kVK_ANSI_S, cmdKey | shiftKey, hotKeyID, GetApplicationEventTarget(), 0, &_captureHotKeyRef);
}

- (void)statusItemClicked:(id)sender
{
  NSEvent *event = [NSApp currentEvent];
  if (event.type == NSEventTypeRightMouseUp) {
    [self showQuickMenu];
    return;
  }

  [self toggleMiniPanel];
}

- (void)showQuickMenu
{
  NSMenu *menu = [[NSMenu alloc] initWithTitle:@"Subnota"];
  NSMenuItem *captureItem = [menu addItemWithTitle:@"현재 페이지 저장        ⇧⌘S" action:@selector(captureCurrentBrowserPage) keyEquivalent:@""];
  captureItem.target = self;
  NSMenuItem *memoItem = [menu addItemWithTitle:@"빠른 메모 작성        ⇧⌘M" action:@selector(openMiniPanelForMemo) keyEquivalent:@""];
  memoItem.target = self;
  [menu addItem:[NSMenuItem separatorItem]];
  if (self.recentInboxItems.count > 0) {
    NSMenuItem *recentHeader = [[NSMenuItem alloc] initWithTitle:@"최근 수집함" action:nil keyEquivalent:@""];
    recentHeader.enabled = NO;
    [menu addItem:recentHeader];
    for (NSDictionary<NSString *, NSString *> *item in self.recentInboxItems) {
      NSString *title = item[@"title"].length ? item[@"title"] : item[@"url"];
      NSString *sourceLabel = item[@"sourceLabel"].length ? item[@"sourceLabel"] : @"링크";
      NSString *menuTitle = [NSString stringWithFormat:@"%@  %@", sourceLabel, [self truncate:title maxLength:42]];
      NSMenuItem *recentItem = [menu addItemWithTitle:menuTitle action:@selector(openRecentInboxItem:) keyEquivalent:@""];
      recentItem.target = self;
      recentItem.representedObject = item[@"url"];
    }
  } else {
    NSMenuItem *recent = [[NSMenuItem alloc] initWithTitle:@"최근 수집함 없음" action:nil keyEquivalent:@""];
    recent.enabled = NO;
    [menu addItem:recent];
  }
  [menu addItem:[NSMenuItem separatorItem]];
  NSMenuItem *inboxItem = [menu addItemWithTitle:@"수집함 열기" action:@selector(openInboxTab) keyEquivalent:@""];
  inboxItem.target = self;
  NSMenuItem *settingsItem = [menu addItemWithTitle:@"설정" action:@selector(showPreferences) keyEquivalent:@""];
  settingsItem.target = self;
  NSMenuItem *quitItem = [menu addItemWithTitle:@"종료" action:@selector(terminate:) keyEquivalent:@""];
  quitItem.target = NSApp;

  [self.statusItem popUpStatusItemMenu:menu];
}

- (void)toggleMiniPanel
{
  if (self.miniPanel.visible) {
    [self.miniPanel orderOut:nil];
    return;
  }

  [self showMiniPanel];
}

- (void)openMiniPanelForMemo
{
  [self showMiniPanel];
}

- (void)showMiniPanel
{
  [self clearUnreadInboxBadge];

  if (!self.miniPanel) {
    [self buildMiniPanel];
  }

  NSRect buttonFrame = self.statusItem.button.window.frame;
  CGFloat width = 700;
  CGFloat height = 650;
  CGFloat x = NSMidX(buttonFrame) - width + 52;
  CGFloat y = NSMinY(buttonFrame) - height - 8;

  NSScreen *screen = self.statusItem.button.window.screen ?: NSScreen.mainScreen;
  NSRect visible = screen.visibleFrame;
  x = MAX(NSMinX(visible) + 12, MIN(x, NSMaxX(visible) - width - 12));
  y = MAX(NSMinY(visible) + 12, y);

  [self.miniPanel setFrame:NSMakeRect(x, y, width, height) display:YES];
  [self.miniPanel makeKeyAndOrderFront:nil];
  [NSApp activateIgnoringOtherApps:YES];
}

- (void)buildMiniPanel
{
  self.miniPanel = [[NSPanel alloc] initWithContentRect:NSMakeRect(0, 0, 700, 650)
                                              styleMask:NSWindowStyleMaskNonactivatingPanel | NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskFullSizeContentView
                                                backing:NSBackingStoreBuffered
                                                  defer:NO];
  self.miniPanel.title = @"Mini Subnota";
  self.miniPanel.level = NSFloatingWindowLevel;
  self.miniPanel.hidesOnDeactivate = YES;
  self.miniPanel.releasedWhenClosed = NO;
  self.miniPanel.titlebarAppearsTransparent = YES;

  NSView *content = [[NSView alloc] initWithFrame:NSMakeRect(0, 0, 700, 650)];
  content.wantsLayer = YES;
  content.layer.backgroundColor = [NSColor colorWithRed:0.98 green:0.96 blue:0.92 alpha:1].CGColor;
  self.miniPanel.contentView = content;

  NSTextField *title = [self labelWithString:@"Subnota" frame:NSMakeRect(32, 570, 280, 42) fontSize:30 weight:NSFontWeightHeavy color:[NSColor colorWithWhite:0.12 alpha:1]];
  [content addSubview:title];
  NSTextField *subtitle = [self labelWithString:@"보고 있던 페이지를 수집하고, 바로 메모로 이어갑니다." frame:NSMakeRect(34, 540, 520, 24) fontSize:15 weight:NSFontWeightRegular color:[NSColor colorWithWhite:0.38 alpha:1]];
  [content addSubview:subtitle];

  NSButton *captureButton = [self buttonWithTitle:@"현재 페이지 수집함에 저장" frame:NSMakeRect(32, 480, 260, 44) action:@selector(captureCurrentBrowserPage)];
  [content addSubview:captureButton];
  NSButton *openButton = [self buttonWithTitle:@"수집함 열기" frame:NSMakeRect(304, 480, 160, 44) action:@selector(openInboxTab)];
  [content addSubview:openButton];

  NSTextField *memoLabel = [self labelWithString:@"빠른 메모" frame:NSMakeRect(34, 424, 120, 24) fontSize:14 weight:NSFontWeightBold color:[NSColor colorWithWhite:0.18 alpha:1]];
  [content addSubview:memoLabel];
  NSTextView *memoView = [[NSTextView alloc] initWithFrame:NSMakeRect(32, 250, 636, 166)];
  memoView.font = [NSFont systemFontOfSize:18 weight:NSFontWeightRegular];
  memoView.string = @"";
  memoView.drawsBackground = YES;
  memoView.backgroundColor = NSColor.whiteColor;
  memoView.textColor = [NSColor colorWithWhite:0.14 alpha:1];
  memoView.insertionPointColor = [NSColor colorWithWhite:0.14 alpha:1];
  memoView.textContainerInset = NSMakeSize(14, 14);
  [content addSubview:memoView];

  self.statusTextField = [self labelWithString:@"⌘⇧S 단축키로도 현재 페이지를 저장할 수 있습니다." frame:NSMakeRect(34, 204, 620, 24) fontSize:14 weight:NSFontWeightRegular color:[NSColor colorWithWhite:0.42 alpha:1]];
  [content addSubview:self.statusTextField];

  NSTextField *recentTitle = [self labelWithString:@"최근 수집함" frame:NSMakeRect(34, 154, 120, 24) fontSize:14 weight:NSFontWeightBold color:[NSColor colorWithWhite:0.18 alpha:1]];
  [content addSubview:recentTitle];
  self.recentTextField = [self labelWithString:@"앱의 수집함 탭에서 YouTube, Instagram, URL 저장 내역을 확인하세요." frame:NSMakeRect(34, 86, 620, 58) fontSize:16 weight:NSFontWeightRegular color:[NSColor colorWithWhite:0.35 alpha:1]];
  [content addSubview:self.recentTextField];
}

- (NSTextField *)labelWithString:(NSString *)string frame:(NSRect)frame fontSize:(CGFloat)fontSize weight:(NSFontWeight)weight color:(NSColor *)color
{
  NSTextField *label = [[NSTextField alloc] initWithFrame:frame];
  label.stringValue = string;
  label.font = [NSFont systemFontOfSize:fontSize weight:weight];
  label.textColor = color;
  label.bezeled = NO;
  label.drawsBackground = NO;
  label.editable = NO;
  label.selectable = NO;
  return label;
}

- (NSButton *)buttonWithTitle:(NSString *)title frame:(NSRect)frame action:(SEL)action
{
  NSButton *button = [[NSButton alloc] initWithFrame:frame];
  button.title = title;
  button.bezelStyle = NSBezelStyleRounded;
  button.target = self;
  button.action = action;
  return button;
}

- (void)captureCurrentBrowserPage
{
  NSDictionary<NSString *, NSString *> *page = [self currentBrowserPage];
  NSString *url = page[@"url"];
  if (!url.length) {
    [self updatePanelStatus:@"지원하는 브라우저의 현재 페이지를 찾지 못했습니다."];
    return;
  }

  NSString *title = page[@"title"] ?: @"";
  NSString *captureURLString = [NSString stringWithFormat:@"subnota://capture?url=%@&title=%@",
                                [self urlEncode:url],
                                [self urlEncode:title]];
  NSURL *captureURL = [NSURL URLWithString:captureURLString];
  if (captureURL) {
    [[NSWorkspace sharedWorkspace] openURL:captureURL];
    [self updatePanelStatus:@"수집함에 저장 요청을 보냈습니다."];
  }
}

- (void)openInboxTab
{
  [self clearUnreadInboxBadge];

  NSURL *url = [NSURL URLWithString:@"subnota://capture"];
  if (url) {
    [[NSWorkspace sharedWorkspace] openURL:url];
  }
  [NSApp activateIgnoringOtherApps:YES];
}

- (void)openRecentInboxItem:(NSMenuItem *)sender
{
  NSString *urlString = [sender.representedObject isKindOfClass:NSString.class] ? sender.representedObject : nil;
  NSURL *url = urlString.length ? [NSURL URLWithString:urlString] : nil;
  if (url) {
    [[NSWorkspace sharedWorkspace] openURL:url];
  }
}

- (void)showPreferences
{
  [self showMiniPanel];
  [self updatePanelStatus:@"설정은 곧 Mini Subnota 안에서 제공됩니다."];
}

- (void)recordInboxSaveFromJavaScript:(NSDictionary *)item
{
  NSString *url = [self stringValueFromDictionary:item key:@"url"];
  NSString *title = [self stringValueFromDictionary:item key:@"title"];
  NSString *sourceLabel = [self stringValueFromDictionary:item key:@"sourceLabel"];
  if (!sourceLabel.length) {
    sourceLabel = @"링크";
  }
  if (!title.length) {
    title = url.length ? url : @"새 수집 항목";
  }

  NSMutableArray<NSDictionary<NSString *, NSString *> *> *nextItems = [NSMutableArray array];
  if (url.length) {
    for (NSDictionary<NSString *, NSString *> *recentItem in self.recentInboxItems) {
      if (![recentItem[@"url"] isEqualToString:url]) {
        [nextItems addObject:recentItem];
      }
    }
  } else {
    [nextItems addObjectsFromArray:self.recentInboxItems ?: @[]];
  }

  NSMutableDictionary<NSString *, NSString *> *recentItem = [@{
    @"title": title,
    @"sourceLabel": sourceLabel
  } mutableCopy];
  if (url.length) {
    recentItem[@"url"] = url;
  }
  [nextItems insertObject:recentItem atIndex:0];
  if (nextItems.count > 3) {
    [nextItems removeObjectsInRange:NSMakeRange(3, nextItems.count - 3)];
  }
  self.recentInboxItems = [nextItems copy];

  self.hasUnreadInboxItems = YES;
  [self updateStatusItemTitle];
  [self pulseStatusItem];
  [self updateRecentTextField];
  [self updatePanelStatusIfVisible:[NSString stringWithFormat:@"%@ 수집함에 저장됨", sourceLabel]];
}

- (NSDictionary<NSString *, NSString *> *)currentBrowserPage
{
  NSString *bundleId = NSWorkspace.sharedWorkspace.frontmostApplication.bundleIdentifier ?: @"";
  NSDictionary<NSString *, NSString *> *scripts = @{
    @"com.apple.Safari": @"tell application \"Safari\" to if exists front document then return URL of front document & \"\\n\" & name of front document",
    @"com.google.Chrome": @"tell application \"Google Chrome\" to if exists active tab of front window then return URL of active tab of front window & \"\\n\" & title of active tab of front window",
    @"company.thebrowser.Browser": @"tell application \"Arc\" to if exists active tab of front window then return URL of active tab of front window & \"\\n\" & title of active tab of front window",
    @"com.microsoft.edgemac": @"tell application \"Microsoft Edge\" to if exists active tab of front window then return URL of active tab of front window & \"\\n\" & title of active tab of front window",
    @"com.brave.Browser": @"tell application \"Brave Browser\" to if exists active tab of front window then return URL of active tab of front window & \"\\n\" & title of active tab of front window"
  };

  NSString *script = scripts[bundleId];
  if (!script) {
    return @{};
  }

  NSAppleScript *appleScript = [[NSAppleScript alloc] initWithSource:script];
  NSDictionary *error = nil;
  NSAppleEventDescriptor *result = [appleScript executeAndReturnError:&error];
  if (!result || error) {
    return @{};
  }

  NSArray<NSString *> *parts = [[result stringValue] componentsSeparatedByString:@"\n"];
  NSString *url = parts.count > 0 ? parts[0] : @"";
  NSString *title = parts.count > 1 ? parts[1] : @"";
  return @{@"url": url ?: @"", @"title": title ?: @""};
}

- (NSString *)urlEncode:(NSString *)value
{
  NSMutableCharacterSet *allowed = [[NSCharacterSet URLQueryAllowedCharacterSet] mutableCopy];
  [allowed removeCharactersInString:@"&=+?"];
  return [value stringByAddingPercentEncodingWithAllowedCharacters:allowed] ?: @"";
}

- (NSString *)stringValueFromDictionary:(NSDictionary *)dictionary key:(NSString *)key
{
  id value = dictionary[key];
  return [value isKindOfClass:NSString.class] ? value : @"";
}

- (NSString *)truncate:(NSString *)value maxLength:(NSUInteger)maxLength
{
  if (value.length <= maxLength) {
    return value;
  }
  return [[value substringToIndex:maxLength - 1] stringByAppendingString:@"…"];
}

- (void)clearUnreadInboxBadge
{
  self.hasUnreadInboxItems = NO;
  [self updateStatusItemTitle];
}

- (void)updateStatusItemTitle
{
  self.statusItem.button.title = self.hasUnreadInboxItems ? @"S•" : @"S";
}

- (void)pulseStatusItem
{
  NSButton *button = self.statusItem.button;
  button.wantsLayer = YES;
  CABasicAnimation *animation = [CABasicAnimation animationWithKeyPath:@"opacity"];
  animation.fromValue = @0.35;
  animation.toValue = @1.0;
  animation.duration = 0.18;
  animation.autoreverses = YES;
  animation.repeatCount = 2;
  [button.layer addAnimation:animation forKey:@"subnotaStatusPulse"];
}

- (void)updateRecentTextField
{
  if (!self.recentTextField) {
    return;
  }
  if (self.recentInboxItems.count == 0) {
    self.recentTextField.stringValue = @"앱의 수집함 탭에서 YouTube, Instagram, URL 저장 내역을 확인하세요.";
    return;
  }

  NSMutableArray<NSString *> *lines = [NSMutableArray array];
  for (NSDictionary<NSString *, NSString *> *item in self.recentInboxItems) {
    NSString *sourceLabel = item[@"sourceLabel"].length ? item[@"sourceLabel"] : @"링크";
    NSString *title = item[@"title"].length ? item[@"title"] : item[@"url"];
    [lines addObject:[NSString stringWithFormat:@"%@  %@", sourceLabel, [self truncate:title maxLength:46]]];
  }
  self.recentTextField.stringValue = [lines componentsJoinedByString:@"\n"];
}

- (void)updatePanelStatusIfVisible:(NSString *)message
{
  if (!self.miniPanel.visible) {
    return;
  }
  self.statusTextField.stringValue = message;
}

- (void)updatePanelStatus:(NSString *)message
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (!self.miniPanel.visible) {
      [self showMiniPanel];
    }
    self.statusTextField.stringValue = message;
  });
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

/// This method controls whether the `concurrentRoot`feature of React18 is turned on or off.
///
/// @see: https://reactjs.org/blog/2022/03/29/react-v18.html
/// @note: This requires to be rendering on Fabric (i.e. on the New Architecture).
/// @return: `true` if the `concurrentRoot` feature is enabled. Otherwise, it returns `false`.
- (BOOL)concurrentRootEnabled
{
#ifdef RN_FABRIC_ENABLED
  return true;
#else
  return false;
#endif
}

@end
