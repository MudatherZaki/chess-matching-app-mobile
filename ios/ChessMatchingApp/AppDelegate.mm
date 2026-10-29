#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTI18nUtil.h>
#import <React/RCTLinkingManager.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"ChessMatchingApp";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};
  // The UI is English-only, so keep it left-to-right on RTL devices too
  [[RCTI18nUtil sharedInstance] allowRTL:NO];
  [[RCTI18nUtil sharedInstance] forceRTL:NO];

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

// Forwards deep links (the Lichess OAuth redirect) to React Native's Linking module
- (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options
{
  return [RCTLinkingManager application:application openURL:url options:options];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self getBundleURL];
}

- (NSURL *)getBundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
