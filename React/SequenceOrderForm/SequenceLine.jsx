
'use strict';

import React from 'react';
import { Intent, InputGroup, HTMLSelect, Button, ControlGroup, Callout } from "@blueprintjs/core"
import SequenceData from 'data-modules/SequenceData';

class SequenceLine extends React.Component {
  constructor(props) {
    super(props)
    this.state =  {
      showingDetails : false
    }

    this.onSequenceUpdate = this.onSequenceUpdate.bind(this);
    this.onDescriptionUpdate = this.onDescriptionUpdate.bind(this);
    this.onRemoveSequence = this.onRemoveSequence.bind(this);
    this.toggleDetails = this.toggleDetails.bind(this);
    this.onOptionSelect = this.onOptionSelect.bind(this);
    this.onHLPCUpdate = this.onHLPCUpdate.bind(this);
  }
  onSequenceUpdate(event) {
    let newValue = event.target.value;
    this.props.onChange(this.props.sequenceIndex, "sequence", newValue);
  }
  onDescriptionUpdate(event) {
    let newValue = event.target.value;
    this.props.onChange(this.props.sequenceIndex, "description", newValue);
  }
  onRemoveSequence() {
    this.props.onRemove(this.props.sequenceIndex);
  }
  toggleDetails() {
    let showingDetails = this.state.showingDetails;
    this.setState({ 'showingDetails' : !showingDetails });
  }
  onOptionSelect(event) {
    let optionValue = event.target.value;
    let option = SequenceData.modifingOptions[optionValue];
    if(/^PEPTIDE/.test(this.props.rate.label)) { option = SequenceData.peptideOptions[optionValue]; }
    this.props.onChange(this.props.sequenceIndex, "sequence", this.props.data.sequence+"/"+option.insert+"/");
  }
  onHLPCUpdate(event) {
    let newValue = event.target.value;
    this.props.onChange(this.props.sequenceIndex, "hlpc", newValue);
  }
  render() {
    let style = {
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

    let data = this.props.data;
    let description = data.description;
    let sequence = data.sequence;
    let hlpc = data.hlpc;
    let rate = this.props.rate;
    let sequence_type = (""+rate.label).toLowerCase();
    let sequenceStatistics = SequenceData.calculateStatistics(sequence, sequence_type);
    let sequenceOptions = SequenceData.parseOptions(sequence);
    let sequenceCost = SequenceData.calculateLineCost(sequence, rate);
    let countElements = Object.keys(sequenceStatistics).map(function (key, index) {
      let element = sequenceStatistics[key];
      if(element > 0 && key != "sequence_length") {
        let title = key.split("C")[0];
        return <span key={index} style={style.countElement}>[ {title} : {element} ]</span>;
      }
    });

    let descriptionIntent = Intent.NONE;
    let sequenceIntent = Intent.NONE;
    if(description == "" || description == "<New Sequence>") { descriptionIntent = Intent.WARNING; }
    if(sequence == "") { sequenceIntent = Intent.DANGER; }

    let detailElement = (<div></div>);
    if(this.state.showingDetails) {
      detailElement = (<Callout style={{ marginTop : 5 }}>
        <div style={style.siTitle}>Sequence Information</div>
        <div style={style.seqCost}>
          Sequence Cost : ${sequenceCost.toFixed(2)}
        </div>
        <div>
          {countElements}
          <span style={style.countElement}>[ Sequence Length : {sequenceStatistics.sequence_length} ]</span>
        </div>
      </Callout>);
    }

    let modificationOptions = Object.keys(SequenceData.modifingOptions).map(function (key, index) {
      let option = SequenceData.modifingOptions[key];
      return <option key={index} value={option.insert}>{option.label}</option>
    });

    let hlpcElement = (<HTMLSelect style={{ marginRight : 5 }} value={hlpc} onChange={this.onHLPCUpdate}>
        <option value={0}> No HLPC </option>
        <option value={1}> HLPC </option>
      </HTMLSelect>);

    if(/^PEPTIDE/.test(this.props.rate.label)) {
      hlpcElement = <span></span>;
      modificationOptions = Object.keys(SequenceData.peptideOptions).map(function (key, index) {
        let option = SequenceData.peptideOptions[key];
        return <option key={index} value={option.insert}>{option.label}</option>
      });
    }

    return (<div style={ style.container }>
      <ControlGroup>
        <Button minimal={true}>{this.props.sequenceIndex + 1}</Button>
        <InputGroup type="text" intent={descriptionIntent} style={{ width: 200}} value={description} placeholder="Description" onChange={this.onDescriptionUpdate}/>
        <HTMLSelect value={""} onChange={this.onOptionSelect}>
          <option value=""> -- Select Option -- </option>
          {modificationOptions}
        </HTMLSelect>
        {hlpcElement}
        <InputGroup type="text" intent={sequenceIntent} style={{ width: 500}} value={sequence} placeholder="Sequence" onChange={this.onSequenceUpdate}/>
        <Button intent={Intent.PRIMARY} key={"button_details"} onClick={this.toggleDetails}> Toggle Details </Button>
        <Button intent={Intent.DANGER} key={"button_remove"} onClick={this.onRemoveSequence}> Remove Sequence </Button>
      </ControlGroup>
      {detailElement}
    </div>);
  }
}

export default SequenceLine;
