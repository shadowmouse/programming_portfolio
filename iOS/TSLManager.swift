//
//  TSLManager.swift
//  Bridging Module for interfacing a Swift Based iOS Application with
//  the TSL 1128 Barcode Scanner.
//
//  Created by Elliot Francis on 4/18/16.
//  Copyright © 2016 University of Utah. All rights reserved.
//

protocol TSLScannerResponderDelegate {
    func didRecieveBarcode(_ barcode:String);
    func didRecieveTransponder(_ epc:String, moreAvailable:Bool);
}

protocol TSLScannerSelectionDelegate {
    func accessoryListDidUpdate(_ accessoryList: NSArray);
    func didSelectScanner(_ name: String);
}

protocol TSLScannerStatusDelegate {
    func scannerDidDisconnect()
}

import Foundation
class TSLManager: NSObject, TSLInventoryCommandTransponderReceivedDelegate, TSLBarcodeCommandBarcodeReceivedDelegate {

    static var sharedInstance = TSLManager();

    // Manager Variables
    var _commander:TSLAsciiCommander?
    var _currentAccessory:EAAccessory?
    var _accessoryList = [EAAccessory]();
    var _inventoryResponder: TSLInventoryCommand?;
    var _barcodeResponder: TSLBarcodeCommand?;

    // Action Delegates
    var scannerDelegate: TSLScannerResponderDelegate?;
    var selectionDelegate: TSLScannerSelectionDelegate?;
    var statusDelegate: TSLScannerStatusDelegate?;

    // MARK: - Initialization Function
    func initialize() {
        self.initCommander();
        self.attachResponders();
    }

    // MARK: - Scanner Management Support Functions
    func initCommander() -> Void {
        _commander = TSLAsciiCommander();
        //_commander?.addResponder(TSLLoggerResponder());
        _commander?.addSynchronousResponder();
    }

    func attachResponders() {
        _inventoryResponder = TSLInventoryCommand()
        _inventoryResponder!.transponderReceivedDelegate = self;
        _inventoryResponder!.captureNonLibraryResponses = true;
        _commander!.add(_inventoryResponder);

        _barcodeResponder = TSLBarcodeCommand()
        _barcodeResponder!.barcodeReceivedDelegate = self;
        _barcodeResponder!.captureNonLibraryResponses = true;
        _commander!.add(_barcodeResponder);
    }

    func haltResponders() {
        _commander!.remove(_inventoryResponder);
        _commander!.remove(_barcodeResponder);
    }

    func haltCommander() {
        _commander!.halt();
    }

    func connectCommander() {
        _commander?.connect(nil);
    }

    func disconnectCommander() {
        _commander?.disconnect()
    }

    func disconnectScanner() {
        if((_commander?.isConnected)!) {
            _commander?.send(".sl");
            self.disconnectCommander();
        }
    }

    func terminateCommander() {
        self.haltResponders();
        self.haltCommander();
        _commander = nil;

    }

    func setScannerPower(_ powerLevel: Int32) {
        if( self._commander!.isConnected )
        {
            let command:TSLInventoryCommand = TSLInventoryCommand.synchronousCommand();
            command.takeNoAction = TSL_TriState_YES;
            command.outputPower = powerLevel;
            self._commander!.execute(command);
        }
    }

    // MARK: - Device Selection Support Functions
    func beginScannerSelect() {
        EAAccessoryManager.shared().registerForLocalNotifications();
        _accessoryList = EAAccessoryManager.shared().connectedAccessories;
        print("List Accessories")
        print(_accessoryList)

        NotificationCenter.default.addObserver(self, selector: #selector(self.accessoryDidConnect), name: NSNotification.Name.EAAccessoryDidConnect, object: nil);
        NotificationCenter.default.addObserver(self, selector: #selector(self.accessoryDidDisconnect), name: NSNotification.Name.EAAccessoryDidDisconnect, object: nil);
    }

    func accessoryDidConnect(_ notification: Notification) {
        let userInfo: NSDictionary? = (notification as NSNotification).userInfo as NSDictionary?
        let connectedAccessory = userInfo!.object(forKey: EAAccessoryKey)
        if ( (connectedAccessory as AnyObject).protocolStrings.count != 0) {
            _accessoryList = EAAccessoryManager.shared().connectedAccessories
            self.selectionDelegate?.accessoryListDidUpdate(_accessoryList as NSArray);
        }
    }

    func selectScannerForRow(_ index: Int) {
        self.disconnectCommander();
        _currentAccessory = _accessoryList[_accessoryList.startIndex.advanced(by: index)];
        let didConnect = (_commander?.connect(_currentAccessory))! as Bool;
        if(didConnect) {
            self.selectionDelegate!.didSelectScanner((_currentAccessory?.serialNumber)!);
        }
    }

    func refreshList() {
        _accessoryList = EAAccessoryManager.shared().connectedAccessories
        self.selectionDelegate?.accessoryListDidUpdate(_accessoryList as NSArray);
    }


    func accessoryDidDisconnect(_ notification: Notification) {
        _accessoryList = EAAccessoryManager.shared().connectedAccessories;
    }

    // MARK: - TSL Responder Delegates
    func transponderReceived(_ epc: String!, crc: NSNumber!, pc: NSNumber!, rssi: NSNumber!, fastId: Data!, moreAvailable: Bool) {
        //print("Debug 1");
        //print("epc : \(epc)");
        //print("rssi : \(rssi)");
        //print("moreAvailable : \(moreAvailable)");

        self.scannerDelegate?.didRecieveTransponder(epc, moreAvailable: moreAvailable);
    }

    func barcodeReceived(_ data: String!) {
        self.scannerDelegate?.didRecieveBarcode(data);
    }


}
