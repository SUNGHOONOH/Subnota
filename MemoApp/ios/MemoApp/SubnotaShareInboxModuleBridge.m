#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SubnotaShareInboxModule, NSObject)

RCT_EXTERN_METHOD(consumePendingShares:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
