#import <Cocoa/Cocoa.h>
#import <React/RCTBridgeModule.h>

#import "AppDelegate.h"

@interface SubnotaMenuBarModule : NSObject <RCTBridgeModule>
@end

@implementation SubnotaMenuBarModule

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

RCT_EXPORT_METHOD(recordInboxSave:(NSDictionary *)item)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    AppDelegate *delegate = (AppDelegate *)NSApp.delegate;
    if ([delegate respondsToSelector:@selector(recordInboxSaveFromJavaScript:)]) {
      [delegate recordInboxSaveFromJavaScript:item];
    }
  });
}

@end
