//
//  TSLManager.h
//  chemistry_rfid_mobile_app
//
//  Created by Elliot Francis on 5/30/17.
//

#ifndef TSLManager_h
#define TSLManager_h

#import <ExternalAccessory/ExternalAccessory.h>
#import <ExternalAccessory/EAAccessoryManager.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTBridgeModule.h>
#import "TSLAsciiCommands.framework/Headers/TSLAsciiCommander.h"
#import "TSLAsciiCommands.framework/Headers/TSLAsciiCommands.h"

@interface TSLManager : RCTEventEmitter <RCTBridgeModule, TSLInventoryCommandTransponderReceivedDelegate, TSLBarcodeCommandBarcodeReceivedDelegate>

@property (nonatomic, readwrite) TSLAsciiCommander *commander;

@end


#endif /* TSLManager_h */
