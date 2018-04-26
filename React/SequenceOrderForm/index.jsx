(function () {
  'use strict';

  var React = require('react');
  var Radium = require('radium');
  var moment = require('moment');
  var style = require('./style');

  var SequenceLine = require('./SequenceLine');
  var UserAccountPicker = require("generic-components/UserAccountPicker");
  var { Dialog } = require("@blueprintjs/core")

  var DataManager = require('data-modules/DataManager')();
  var SequenceData = require('data-modules/SequenceData');
  var ServiceData = require('data-modules/ServiceData');
  var ServicePresetData = require('data-modules/ServicePresetData');
  var UserData = require("data-modules/UserData");
  var LineItemData = require("data-modules/LineItemData");
  var AppData = require("data-modules/AppData");
  var SiteDialogData = require("data-modules/SiteDialogData");


  var SequenceOrderForm = React.createClass({
    getInitialState : function () { return {
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
    };},
    componentDidMount : function () {
      DataManager.add(ServiceData.registerListener("RECORD_LOADED", this.serviceLoaded), ServiceData);
      DataManager.add(ServicePresetData.registerListener("LIST_LOADED", this.presetsLoaded), ServicePresetData);
      DataManager.add(UserData.registerListener("RECORD_LOADED", this.userLoaded), UserData);
      DataManager.add(LineItemData.registerListener("ORDER_CREATED", this.orderCreated), LineItemData);
      ServiceData.getRecord(this.props.params.id);
      ServicePresetData.getRecordList(this.props.params.id);
      UserData.getRecord(AppData.get("userID"));
    },
    componentWillUnmount : function () {
      DataManager.clear();
    },
    componentWillReceiveProps : function () {},
    serviceLoaded : function (service, action) {
      console.log("Service Loaded", service);
      this.setState({ 'service' : service})
    },
    presetsLoaded : function (presets, action) {
      console.log("Rates Loaded", presets);
      this.setState({ 'rate' : presets[0] });
    },
    userLoaded : function (user, action) {
      console.log("User Loaded", user);
      this.setState({'user' : user});
    },
    orderCreated : function (order_id, action) {
      var self = this;
      SiteDialogData.open("Order Created", "Your Order ("+order_id+") has been created. Resetting Form", function () {
        self.setState({
          'order_date' : moment(),
          'lines' : [{ description : "<New Sequence>", sequence : "" }]
        });
      });
      ;

    },
    processRaw : function () {
			var lines = this.state.batchText.split("\n");
			var lineCount = lines.length;
      var sequences = this.state.lines;
			for(var l = 0; l < lineCount; l++) {
				var data = lines[l].split(";");
				var seqString = data[1];
				var descr  = data[0];
        sequences.push({description : descr, sequence : seqString, hlpc : 0 });
			}
      this.setState({lines : sequences, batchText : "", batchImportActive : false});
		},
    updateBatchText : function (event) {
      this.setState({ batchText : event.target.value });
    },
    batchImportOpen : function () {
      this.setState({batchImportActive : true});
    },
    batchImportClose : function () {
      this.setState({batchText : "", batchImportActive : false})
    },
    onLineChange : function (index, key, value) {
      var sequences = this.state.lines;
      sequences[index][key] = value;
      this.setState({lines : sequences});
    },
    onLineRemove : function(index) {
      var sequences = this.state.lines;
      sequences.splice(index, 1);
      this.setState({lines : sequences});
    },
    onLineAdd : function (event) {
      var sequences = this.state.lines;
      sequences.push({description : "<New Sequence>", sequence : "", hlpc : 0 });
      this.setState({lines : sequences});
    },
    cancelForm : function () {
      window.location.hash = "#/group/4";
    },
    resetForm : function () {
      if(confirm("Are you sure you want to reset this order?")) {
        this.setState({
          'order_date' : moment(),
          'lines' : [{ description : "<New Sequence>", sequence : "", hlpc : 0 }]
        });
      }
    },
    submitForm : function () {
      var self = this;
      var order_total = 0;
      var lines = this.state.lines.map(function (item, index, source_array) {
        var line_cost = SequenceData.calculateLineCost(item.sequence, self.state.rate, item.hlpc);
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
      var orderData = {
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
    },
    updateField : function (key, event) {
      var newState = {};
      newState[key] = event.target.value;
      this.setState(newState);
    },
    updateAccount : function (newAccount) {
      this.setState({ account : newAccount });
    },
    render : function () {

      if(this.state.user == null || this.state.service == null) {
        return <div> Loading... </div>;
      }

      var self = this;
      var orderCost = 0;
      var isValid = true;
      var sequenceLines = this.state.lines.map(function (line, index) {
        var sequence_type = (""+self.state.rate.type).toLowerCase();
        if(line.sequence == "") { isValid = false; }
        orderCost += SequenceData.calculateLineCost(line.sequence, self.state.rate, line.hlpc);
        return (<SequenceLine key={index} sequenceIndex={index} data={line} onChange={self.onLineChange} onRemove={self.onLineRemove} rate={self.state.rate}/>);
      });
      var service = this.state.service;
      var service_title = service.name;

      var controlElements = [
        <span key={"form_cancel"} className={"pt-button pt-intent-danger"} style={{marginRight : 5}} onClick={this.cancelForm}> Cancel </span>,
        <span key={"form_reset"} className={"pt-button pt-intent-warning"} style={{marginRight : 5}} onClick={this.resetForm}> Reset </span>
      ];

      if(orderCost == 0) { isValid = false; }
      if(this.state.account == null || typeof this.state.account == "undefined") { isValid = false; }

      if(isValid) {
        controlElements.unshift(<span key={"form_submit"} style={{marginRight : 5}} className={"pt-button pt-intent-success"} onClick={this.submitForm}> Submit </span>);
      }

      var date_stamp = this.state.date.format("YYYY-MM-DD");

      var isManager = AppData.authorize(20, 4);

      var userAccountConfig = {
        allow_user_select : isManager,
        allow_account_select : true
      }

      var userAccountHandlers = {
        onUserSelected : function (user, isValid) {
          self.setState({
            user : user,
            account : null
          });

        },
        onAccountSelected : function (account, isValid) {
          self.setState({
            account : account
          });
        }
      }

      return (<div style={style.container}>
        <div style={style.section}><span style={style.title}>{service_title} Order Form</span></div>
        <div style={style.section}><span style={style.title}>Order Data</span>
          <UserAccountPicker user={self.state.user} account={self.state.account} handlers={userAccountHandlers} config={userAccountConfig}/>
          <div style={{ marginBottom : 5 }}> <span style={style.title}> Order Date : </span> <span style={style.dataField}>{date_stamp}</span> </div>
          <div style={{ marginBottom : 5 }}> <span style={style.title}> Delivery Address : </span> <textarea className={"pt-input"} value={this.state.address} onChange={this.updateField.bind(null, "address")}/> </div>
          <div style={{ marginBottom : 5 }}> <span style={style.title}> Instructions : </span> <textarea className={"pt-input"} value={this.state.instructions} onChange={this.updateField.bind(null, "instructions")}/> </div>
        </div>
        <div style={style.section}>
          <span style={style.title}>Order Lines</span>
          {sequenceLines}
        </div>
        <div style={style.section}>
          <span style={style.title}> Total Order Cost : ${orderCost.toFixed(2)} </span>
        </div>
        <div style={style.section}>
          <span className={"pt-button pt-intent-success"} onClick={this.onLineAdd}> Add Empty Sequence </span>
          <span className={"pt-button pt-intent-primary"} style={{marginLeft : 5}} onClick={this.batchImportOpen}> Batch Add </span>
        </div>
        <div style={style.section}>
          {controlElements}
        </div>
        <Dialog isOpen={this.state.batchImportActive} onClose={this.batchImportClose} title={"Import Batch"}>
          <div className={"pt-dialog-body"}>
            <div>
              <div style={{fontWeight : "bold", fontSize: "1.3rem"}}>Formatting Example</div>
              <div>Description1;SequenceString1</div>
              <div>Description2;SequenceString2</div>
              <div>Description3;SequenceString3</div>
            </div>
            <textarea style={{marginTop : 5, marginBottom : 5}} rows={10} cols={50} className={"pt-input"} dir="auto" value={this.state.batchText} onChange={this.updateBatchText}></textarea>
            <div>
              <span className={"pt-button pt-intent-success"} onClick={this.processRaw}> Add Batch Sequences </span>
              <span className={"pt-button pt-intent-warning"} onClick={this.batchImportClose} style={{marginLeft : 5}}> Close </span>
            </div>
          </div>
        </Dialog>
      </div>);
    }
  });
  var Route = {
    path : "order/:id",
    onEnter : AppData.RouteSwitchHandler.bind(null, 10),
    component : Radium(SequenceOrderForm),
  };
  module.exports = Route;
})()
