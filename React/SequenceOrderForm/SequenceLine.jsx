(function () {
  'use strict';

  var React = require('react');
  var Radium = require('radium');
  var SequenceData = require('data-modules/SequenceData');

  var SequenceLine = React.createClass({
    getInitialState : function () {
      return {
        showingDetails : false
      }
    },
    onSequenceUpdate : function (event) {
      var newValue = event.target.value;
      this.props.onChange(this.props.sequenceIndex, "sequence", newValue);
    },
    onDescriptionUpdate : function (event) {
      var newValue = event.target.value;
      this.props.onChange(this.props.sequenceIndex, "description", newValue);
    },
    onRemoveSequence : function () {
      this.props.onRemove(this.props.sequenceIndex);
    },
    toggleDetails : function () {
      var showingDetails = this.state.showingDetails;
      this.setState({ 'showingDetails' : !showingDetails });
    },
    onOptionSelect: function (event) {
      var optionValue = event.target.value;
      var option = SequenceData.modifingOptions[optionValue];
      if(/^PEPTIDE/.test(this.props.rate.label)) { option = SequenceData.peptideOptions[optionValue]; }
      this.props.onChange(this.props.sequenceIndex, "sequence", this.props.data.sequence+"/"+option.insert+"/");
    },
    onHLPCUpdate: function (event) {
      var newValue = event.target.value;
      this.props.onChange(this.props.sequenceIndex, "hlpc", newValue);
    },
    render : function () {
      var style = {
        container : {
          width : "100%",
          marginTop : 5
        },
        button : {
          display : "inline-block",
          border : "1px solid black",
          borderRadius : "5px",
          fontSize : "0.6rem",
          fontWeight : "bold",
          backgroundColor : "white",
          padding : 5,
          margin : 5,
          ":hover" : { backgroundColor : "gray" },
          ":active" : { color : "white" },
          cursor : "default"
        },
        siTitle : {
          fontWeight : "bold",
          fontSize : "0.8rem",
          color : "gray",
          marginTop : 0
        },
        countElement : {
          fontWeight : "bold",
          fontSize : "0.8rem",
          marginRight : 5,
          display : "inline-block"
        },
        seqCost : {
          fontWeight : "bold",
          fontSize : "0.8rem",
          marginRight : 5,
          display : "inline-block"
        },
        validField : {
          border : "1px solid gray",
          marginRight : 3,
          width: 200
        },
        warnField : {
          border : "1px solid rgb(255, 147, 0)",
          marginRight : 3
        },
        invalidField : {
          border : "1px solid rgb(255, 38, 0)",
          marginRight : 3
        },
        index : {
          display : "inline-block",
          marginRight : 10,
        }
      };

      var data = this.props.data;
      var description = data.description;
      var sequence = data.sequence;
      var hlpc = data.hlpc;
      var rate = this.props.rate;
      var sequence_type = (""+rate.label).toLowerCase();
      var sequenceStatistics = SequenceData.calculateStatistics(sequence, sequence_type);
      var sequenceOptions = SequenceData.parseOptions(sequence);
      var sequenceCost = SequenceData.calculateLineCost(sequence, rate);
      var countElements = Object.keys(sequenceStatistics).map(function (key, index) {
        var element = sequenceStatistics[key];
        if(element > 0 && key != "sequence_length") {
          var title = key.split("C")[0];
          return <span key={index} style={style.countElement}>[ {title} : {element} ]</span>;
        }
      });

      var descriptionStyle = "pt-input";
      var sequenceStyle = "pt-input";
      if(description == "" || description == "<New Sequence>") { descriptionStyle += " pt-intent-warning"; }
      if(sequence == "") { sequenceStyle += " pt-intent-danger"; }

      var detailElement = (<div></div>);
      if(this.state.showingDetails) {
        detailElement = (<div>
          <div style={style.siTitle}>Sequence Information</div>
          <div style={style.seqCost}>
            Sequence Cost : ${sequenceCost.toFixed(2)}
          </div>
          <div>
            {countElements}
            <span style={style.countElement}>[ Sequence Length : {sequenceStatistics.sequence_length} ]</span>
          </div>
        </div>);
      }

      var modificationOptions = Object.keys(SequenceData.modifingOptions).map(function (key, index) {
        var option = SequenceData.modifingOptions[key];
        return <option key={index} value={option.insert}>{option.label}</option>
      });

      var hlpcElement = (<div className={"pt-select"} style={{ marginRight : 5 }}>
        <select value={hlpc} onChange={this.onHLPCUpdate}>
          <option value={0}> No HLPC </option>
          <option value={1}> HLPC </option>
        </select>
      </div>);

      if(/^PEPTIDE/.test(this.props.rate.label)) {
        hlpcElement = <span></span>;
        modificationOptions = Object.keys(SequenceData.peptideOptions).map(function (key, index) {
          var option = SequenceData.peptideOptions[key];
          return <option key={index} value={option.insert}>{option.label}</option>
        });
      }

      return (<div style={ style.container }>
        <div>
          <div style={{ width: 50, display: "inline-block" }}>{this.props.sequenceIndex + 1}</div>
          <input className={descriptionStyle} style={{ width: 200, marginRight : 5 }} value={description} placeholder="Description" onChange={this.onDescriptionUpdate}/>
          <div className={"pt-select"} style={{ marginRight : 5 }}>
            <select value={""} onChange={this.onOptionSelect}>
              <option value=""> -- Select Option -- </option>
              {modificationOptions}
            </select>
          </div>
          {hlpcElement}
          <input className={sequenceStyle} style={{ width: 500, marginRight : 5 }} value={sequence} placeholder="Sequence" onChange={this.onSequenceUpdate}/>
          <span className={"pt-button pt-intent-primary"} style={{ marginRight : 5 }} key={"button_details"} onClick={this.toggleDetails}> Toggle Details </span>
          <span className={"pt-button pt-intent-danger"} style={{ marginRight : 5 }} key={"button_remove"} onClick={this.onRemoveSequence}> Remove Sequence </span>
        </div>
        {detailElement}
      </div>);
    }
  });

  module.exports = Radium(SequenceLine);
})()
