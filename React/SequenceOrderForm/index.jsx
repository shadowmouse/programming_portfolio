
'use strict';

import React from 'react'
import moment from 'moment'
import style from './style'

import SequenceLine from './SequenceLine'
import UserAccountPicker from "generic-components/UserAccountPicker"
import { Dialog, Button, Classes, Intent, TextArea } from "@blueprintjs/core"

import DataManager from 'data-modules/DataManager'
let DM = new DataManager();
import SequenceData from 'data-modules/SequenceData'
import ServiceData from 'data-modules/ServiceData'
import ServicePresetData from 'data-modules/ServicePresetData'
import UserData from "data-modules/UserData"
import LineItemData from "data-modules/LineItemData"
import AppData from "data-modules/AppData"
import SiteDialogData from "data-modules/SiteDialogData"


class SequenceOrderForm extends React.Component{
  constructor(props) {
    super(props);
    this.state = {
      user : null,
      account : null,
      address : "None",
      instructions : "None",
      date : moment(),
      batchText : "",
      batchPreview : "",
      batchImportActive : false,
      lines : [{ description : "", sequence : "" }],
      service : null,
      rate : []
    };

    this.componentDidMount = this.componentDidMount.bind(this);
    this.componentWillUnmount = this.componentWillUnmount.bind(this);
    this.serviceLoaded = this.serviceLoaded.bind(this);
    this.presetsLoaded = this.presetsLoaded.bind(this);
    this.userLoaded = this.userLoaded.bind(this);
    this.orderCreated = this.orderCreated.bind(this);
    this.processRaw = this.processRaw.bind(this);
    this.updateBatchText = this.updateBatchText.bind(this);
    this.batchImportOpen = this.batchImportOpen.bind(this);
    this.batchImportClose = this.batchImportClose.bind(this);
    this.onLineChange = this.onLineChange.bind(this);
    this.onLineRemove = this.onLineRemove.bind(this);
    this.onLineAdd = this.onLineAdd.bind(this);
    this.cancelForm = this.cancelForm.bind(this);
    this.resetForm = this.resetForm.bind(this);
    this.submitForm = this.submitForm.bind(this);
    this.updateField = this.updateField.bind(this);
    this.updateAccount = this.updateAccount.bind(this);

  }
  componentDidMount() {
    let params = this.props.match.params;
    DM.add(ServiceData.registerListener("RECORD_LOADED", this.serviceLoaded), ServiceData);
    DM.add(ServicePresetData.registerListener("LIST_LOADED", this.presetsLoaded), ServicePresetData);
    DM.add(UserData.registerListener("RECORD_LOADED", this.userLoaded), UserData);
    DM.add(LineItemData.registerListener("ORDER_CREATED", this.orderCreated), LineItemData);
    ServiceData.getRecord(params.id);
    ServicePresetData.getRecordList(params.id);
    UserData.getRecord(AppData.get("userID"));
  }
  componentWillUnmount() {
    DM.clear();
  }
  serviceLoaded(service, action) {
    this.setState({ 'service' : service})
  }
  presetsLoaded(presets, action) {
    this.setState({ 'rate' : presets[0] });
  }
  userLoaded(user, action) {
    this.setState({'user' : user});
  }
  orderCreated(order_id, action) {
    let self = this;
    SiteDialogData.open("Order Created", "Your Order ("+order_id+") has been created. Resetting Form", function () {
      self.setState({
        'order_date' : moment(),
        'lines' : [{ description : "", sequence : "" }]
      });
    });
    ;

  }
  processRaw() {
		let lines = this.state.batchText.split("\n");
		let lineCount = lines.length;
    let sequences = this.state.lines;
		for(let l = 0; l < lineCount; l++) {
			let data = lines[l].split(";");
			let seqString = data[1];
			let descr  = data[0];
      sequences.push({description : descr, sequence : seqString, hlpc : 0 });
		}
    this.setState({lines : sequences, batchText : "", batchImportActive : false});
	}
  updateBatchText(event) {
    this.setState({ batchText : event.target.value });
  }
  batchImportOpen() {
    this.setState({batchImportActive : true});
  }
  batchImportClose() {
    this.setState({batchText : "", batchImportActive : false})
  }
  onLineChange(index, key, value) {
    let sequences = this.state.lines;
    sequences[index][key] = value;
    this.setState({lines : sequences});
  }
  onLineRemove(index) {
    let sequences = this.state.lines;
    sequences.splice(index, 1);
    this.setState({lines : sequences});
  }
  onLineAdd(event) {
    let sequences = this.state.lines;
    sequences.push({description : "", sequence : "", hlpc : 0 });
    this.setState({lines : sequences});
  }
  cancelForm() {
    window.location.hash = "#/group/4";
  }
  resetForm() {
    if(confirm("Are you sure you want to reset this order?")) {
      this.setState({
        'order_date' : moment(),
        'lines' : [{ description : "", sequence : "", hlpc : 0 }]
      });
    }
  }
  submitForm() {
    let self = this;
    let order_total = 0;
    let isComplete = (() => {
      if(self.state.address == "None" || self.state.address.length < 1) { return false; }
      return true;
    })()
    if(!isComplete) { alert("Unable to submit order. Delivery Address Missing."); return; }
    let lines = this.state.lines.map(function (item, index, source_array) {
      let line_cost = SequenceData.calculateLineCost(item.sequence, self.state.rate, item.hlpc);
      order_total += line_cost;
      return {
          'quantity' : 1,
          'rate' : line_cost,
          'commercial_rate' : "group",
          'description' : item.description,
          'type' : self.state.rate.type,
          'data_1' : item.sequence,
          'data_3' : item.hlpc
      };
    });
    let orderData = {
      user : this.state.user,
      account : this.state.account,
      service : this.state.service,
      date : this.state.date,
      order_misc_json : JSON.stringify({
        address : this.state.address,
        special_instructions : this.state.instructions
      }),
      lines : lines,
      total : order_total
    };
    LineItemData.createOrder(orderData);
  }
  updateField(key, event) {
    let newState = {};
    newState[key] = event.target.value;
    this.setState(newState);
  }
  updateAccount(newAccount) {
    this.setState({ account : newAccount });
  }
  render() {

    if(this.state.user == null || this.state.service == null) {
      return <div> Loading... </div>;
    }

    let self = this;
    let orderCost = 0;
    let isValid = true;

    let sequenceLines = this.state.lines.map(function (line, index) {
      let sequence_type = (""+self.state.rate.type).toLowerCase();
      if(line.sequence == "") { isValid = false; }
      orderCost += SequenceData.calculateLineCost(line.sequence, self.state.rate, line.hlpc);
      return (<SequenceLine key={index} sequenceIndex={index} data={line} onChange={self.onLineChange} onRemove={self.onLineRemove} rate={self.state.rate}/>);
    });
    let service = this.state.service;
    let service_title = service.name;

    let controlElements = [
      <Button key={"form_cancel"} intent={Intent.DANGER} style={{marginRight : 5}} onClick={this.cancelForm}> Cancel </Button>,
      <Button key={"form_reset"} intent={Intent.WARNING} style={{marginRight : 5}} onClick={this.resetForm}> Reset </Button>
    ];

    if(orderCost == 0) { isValid = false; }
    if(this.state.account == null || typeof this.state.account == "undefined") { isValid = false; }

    if(isValid) {
      controlElements.unshift(<Button key={"form_submit"} style={{marginRight : 5}} intent={Intent.SUCCESS} onClick={this.submitForm}> Submit </Button>);
    }

    let date_stamp = this.state.date.format("YYYY-MM-DD");

    let isManager = AppData.authorize(20, 4);

    let userAccountConfig = {
      allow_user_select : isManager,
      allow_account_select : true
    }

    let userAccountHandlers = {
      onUserSelected : (user, isValid) => {
        self.setState({
          user : user,
          account : null
        });

      },
      onAccountSelected : (account, isValid) => {
        self.setState({
          account : account
        });
      }
    }

    let addressStyle = (() => {
      if (self.state.address == "None" || self.state.address.length < 1) { return { border: "1px solid red" }; }
      return {};
    })()

    return (<div style={style.container}>
      <div style={style.section}><span style={style.title}>{service_title} Order Form</span></div>
      <div style={style.section}><span style={style.title}>Order Data</span>
        <UserAccountPicker user={self.state.user} account={self.state.account} handlers={userAccountHandlers} config={userAccountConfig}/>
        <div style={{ marginBottom : 5 }}> <span style={style.title}> Order Date : </span> <span style={style.dataField}>{date_stamp}</span> </div>
        <div style={{ marginBottom : 5 }}> <div style={style.title}> Delivery Address </div> <TextArea style={addressStyle} value={this.state.address} onChange={this.updateField.bind(null, "address")}/> </div>
        <div style={{ marginBottom : 5 }}> <div style={style.title}> Instructions </div> <TextArea value={this.state.instructions} onChange={this.updateField.bind(null, "instructions")}/> </div>
      </div>
      <div style={style.section}>
        <span style={style.title}>Order Lines</span>
        {sequenceLines}
      </div>
      <div style={style.section}>
        <span style={style.title}> Total Order Cost : ${orderCost.toFixed(2)} </span>
      </div>
      <div style={style.section}>
        <Button intent={Intent.SUCCESS} onClick={this.onLineAdd}> Add Empty Sequence </Button>
        <Button intent={Intent.PRIMARY} style={{marginLeft : 5}} onClick={this.batchImportOpen}> Batch Add </Button>
      </div>
      <div style={style.section}>
        {controlElements}
      </div>
      <Dialog isOpen={this.state.batchImportActive} onClose={this.batchImportClose} title={"Import Batch"}>
        <div className={Classes.DIALOG_BODY}>
          <div>
            <div style={{fontWeight : "bold", fontSize: "1.3rem"}}>Formatting Example</div>
            <div>Description1;SequenceString1</div>
            <div>Description2;SequenceString2</div>
            <div>Description3;SequenceString3</div>
          </div>
          <TextArea style={{marginTop : 5, marginBottom : 5}} rows={10} cols={50} dir="auto" value={this.state.batchText} onChange={this.updateBatchText}></TextArea>
          <div>
            <Button intent={Intent.SUCCESS} onClick={this.processRaw}> Add Batch Sequences </Button>
            <Button intent={Intent.WARNING} onClick={this.batchImportClose} style={{marginLeft : 5}}> Close </Button>
          </div>
        </div>
      </Dialog>
    </div>);
  }
}

let Route = {
  path : "order/:id",
  onEnter : AppData.RouteSwitchHandler.bind(null, 10),
  component : SequenceOrderForm,
};

export default SequenceOrderForm;
