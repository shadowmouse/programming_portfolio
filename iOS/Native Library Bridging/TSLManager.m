//
//  TSLManager.m
//  chemistry_rfid_mobile_app
//
//  Created by Elliot Francis on 5/30/17.
//  Copyright © 2017 Facebook. All rights reserved.
//

#import "TSLManager.h"
#import <React/RCTLog.h>

@interface TSLManager () {
  NSArray * accessoryList;
  EAAccessory * currentAccessory;
  TSLInventoryCommand * inventoryResponder;
  TSLBarcodeCommand * barcodeResponder;
}

@end

@implementation TSLManager

RCT_EXPORT_MODULE();

// React Function Exports

RCT_REMAP_METHOD(startScannerSearchAsync,
                 startScannerSearchResolver:(RCTPromiseResolveBlock)resolve
                 startScannerSearchRejecter:(RCTPromiseRejectBlock)reject)
{
  [self beginScannerSelect];
  NSMutableArray *results = [NSMutableArray arrayWithCapacity:0];
  for( EAAccessory *accessory in [[EAAccessoryManager sharedAccessoryManager] connectedAccessories]) {
    [results addObject:[NSString stringWithFormat:@"%@", accessory.serialNumber]];
  }
  resolve(results);
}

RCT_EXPORT_METHOD(connectToScannerAtIndex:(NSInteger *)selectedRow)
{
  [self connectToSelectedScanner: (int) selectedRow];
}

RCT_REMAP_METHOD(disconnectScannerAsync,
                 disconnectScannerResolver:(RCTPromiseResolveBlock)resolve
                 disconnectScannerRejecter:(RCTPromiseRejectBlock)reject)
{
  [self haltResponders];
  [self disconnectCommander];
  resolve(@"Scanner Disconnected -- Commander Halted");
}

// Library Support Commands

- (void) initialize {
  [self initCommander];
  [self attachResponders];
}

- (void) initCommander {
  // Initialize Scanner Interface
  self.commander = [[TSLAsciiCommander alloc] init];
  [self.commander addSynchronousResponder];
}

- (void) attachResponders {
  // Attach Responders
  inventoryResponder = [[TSLInventoryCommand alloc] init];
  inventoryResponder.transponderReceivedDelegate = self;
  inventoryResponder.captureNonLibraryResponses = true;
  [self.commander addResponder:inventoryResponder];
  
  barcodeResponder = [[TSLBarcodeCommand alloc] init];
  barcodeResponder.barcodeReceivedDelegate = self;
  barcodeResponder.captureNonLibraryResponses = true;
  [self.commander addResponder:barcodeResponder];
}

- (void) haltResponders {
  [self.commander removeResponder:inventoryResponder];
  [self.commander removeResponder:barcodeResponder];
}

- (void) connectCommander { [self.commander connect:nil]; }

- (void) disconnectCommander { [self.commander halt]; }

- (void) disconnectScanner {
  if(self.commander.isConnected) {
    [self.commander send:@".sl"];
    [self disconnectCommander];
  }
}

- (void) beginScannerSelect {
  
  [[EAAccessoryManager sharedAccessoryManager] registerForLocalNotifications];
  accessoryList = [[EAAccessoryManager sharedAccessoryManager] connectedAccessories];
  [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(_accessoryDidConnect:) name:EAAccessoryDidConnectNotification object:nil];
  [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(_accessoryDidDisconnect:) name:EAAccessoryDidDisconnectNotification object:nil];
}

- (void) connectToSelectedScanner: (int) row {
  
  [self haltResponders];
  [self disconnectCommander];
  [self initCommander];
  [self attachResponders];
  
  currentAccessory = [accessoryList objectAtIndex:row];
  [self.commander connect:currentAccessory];
  if([self.commander isConnected]) {
    [self sendEventWithName:@"tsl-scanner-connected" body:currentAccessory.serialNumber];
  } else {
    [self sendEventWithName:@"tsl-scanner-connect-error" body:@"Unable to Connect to Scanner"];
  }
}


// Library Action Responder Commands

-(void) _accessoryDidConnect:(NSNotification *)notification
{
  EAAccessory *connectedAccessory = [[notification userInfo] objectForKey:EAAccessoryKey];
  if( connectedAccessory.protocolStrings.count != 0 )
  {
    accessoryList = [[EAAccessoryManager sharedAccessoryManager] connectedAccessories];
    NSMutableArray *results = [NSMutableArray arrayWithCapacity:0];
    for( EAAccessory *accessory in [[EAAccessoryManager sharedAccessoryManager] connectedAccessories]) {
      [results addObject:[NSString stringWithFormat:@"%@", accessory.serialNumber]];
    }
    [self sendEventWithName:@"tsl-accessory-list-updated" body:results];
  }
}

- (void)_accessoryDidDisconnect:(NSNotification *)notification
{
  accessoryList = [[EAAccessoryManager sharedAccessoryManager] connectedAccessories];
  NSMutableArray *results = [NSMutableArray arrayWithCapacity:0];
  for( EAAccessory *accessory in [[EAAccessoryManager sharedAccessoryManager] connectedAccessories]) {
    [results addObject:[NSString stringWithFormat:@"%@", accessory.serialNumber]];
  }
  [self sendEventWithName:@"tsl-accessory-list-updated" body:results];
}

- (void) transponderReceived:(NSString *)epc crc:(NSNumber *)crc pc:(NSNumber *)pc rssi:(NSNumber *)rssi fastId:(NSData *)fastId moreAvailable:(BOOL)moreAvailable {
    [self sendEventWithName:@"tsl-transponder-received" body:epc];
}

- (void) barcodeReceived:(NSString *)data {
    [self sendEventWithName:@"tsl-barcode-received" body:data];
}


- (NSArray *) supportedEvents {
  return @[
           @"tsl-transponder-received",
           @"tsl-barcode-received",
           @"tsl-accessory-list-updated",
           @"tsl-scanner-connected",
           @"tsl-scanner-disconnected",
           @"tsl-scanner-connect-error"];
}
@end
