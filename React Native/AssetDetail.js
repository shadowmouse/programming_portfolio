/*

    Created By : Elliot Francis
    Date : Nov 11, 2017
    Description : React Native Scene for Editing Details of a Stored Asset

*/

import React, { Component, PropTypes } from 'react';
import moment from 'moment';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { StackNavigator } from "react-navigation";
import AppData from "./Data/AppData";
import AssetData from "./Data/AssetData";
import LocationData from "./Data/LocationData";
import BM from "./Data/BusManager";
let BusManager = BM();
import Swipeable from 'react-native-swipeable';
import IconEntypo from 'react-native-vector-icons/Entypo';
import ImagePicker from 'react-native-image-picker';
import Prompt from 'rn-prompt';

import {
  AppRegistry,
  StyleSheet,
  Text,
  View,
  FlatList,
  SectionList,
  Alert,
  Vibration,
  TouchableHighlight,
  TouchableOpacity,
  Button
} from 'react-native';

import ButtonRow from "./Components/ButtonRow"
import InputRow from "./Components/InputRow"
import TextRow from "./Components/TextRow"
import NumberRow from "./Components/NumberRow"
import PickerRow from "./Components/PickerRow"
import SegmentRow from "./Components/SegmentRow"
import DatetimeRow from "./Components/DatetimeRow"

class AssetDetailScene extends Component {

  static navigationOptions = ({navigation}) => ({
    title : "Asset Details",
    headerLeft: (<IconEntypo style={{ marginLeft : 10 }} name={"chevron-left"} size={24} color={"white"} onPress={() => { navigation.goBack() }}/>)
  })

  constructor () {
    super();
    this.state = {
      actionInProgress : false,
      files : [],
      filenamePromptVisible: false,
      fileToUploadURI: null
    };
    this.rowRenderConfig = this.rowRenderConfig.bind(this);
    this.rowRenderOther = this.rowRenderOther.bind(this);
    this.rowRenderFiles = this.rowRenderFiles.bind(this);
    this.updateAsset = this.updateAsset.bind(this);
    this.reloadAsset = this.reloadAsset.bind(this);
    this.componentDidMount = this.componentDidMount.bind(this);
    this.componentWillUpdate = this.componentWillUpdate.bind(this);
    this.componentWillUnmount = this.componentWillUnmount.bind(this);
    this.buttonPressHandler = this.buttonPressHandler.bind(this);
    this.syncAsset = this.syncAsset.bind(this);
  }

  componentWillUpdate (nextProps, nextState) {
    return (this.props !== nextProps || this.state !== nextState);
  }

  componentDidMount () {
    let props = this.props.navigation.state.params;
    let asset = AssetData.getAsset(props.asset.asset_tag_number);
    if( typeof asset.organization == "undefined" ) {
      AssetData.fetchRemoteConfigAsync().then(() => { this.setState({}); }).catch((err) => { console.log("Error Fetching Remote Config (Default) -- Using Internal Config", err) })
    } else {
      AssetData.fetchRemoteConfigAsync(asset.organization.code).then(() => { this.setState({}); }).catch((err) => { console.log("Error Fetching Remote Config (Org) -- Using Internal Config", err) })
    }
    BusManager.add(AssetData.getEventBus().registerListener("ASSET_CHANGED", ()=>{ this.setState({}); }), AssetData.getEventBus());
    BusManager.add(AssetData.getEventBus().registerListener("ASSET_SYNC_ERROR", (error)=>{
      Alert.alert("Asset Save Error", "Asset Save Error : "+JSON.stringify(error), [{ text : "Ok", onPress : () => { } },
      { text : "Sync Scan Only", onPress : () => {
        AssetData.scanAssetToServer({ asset_tag_number: asset.asset_tag_number }, asset.location);
      } }])
      this.setState({ isLoading: false });
    }), AssetData.getEventBus());

    BusManager.add(AssetData.getEventBus().registerListener("ASSET_SCAN_ERROR", (error)=>{
      Alert.alert("Asset Sync Error", "Error Syncing Asset Scan to Server : "+JSON.stringify(error), [ {text : "OK", onPress : ()=>{}} ]);
      this.setState({ isLoading: false });
    }), AssetData.getEventBus());

    AssetData.fetchAssetReferenceImage(asset.asset_tag_number).then(() => {}).catch(() =>{});
    AssetData.fetchAssetFilesAsync(asset.asset_tag_number).then((files) => {
      this.setState({ files : files });
    }).catch(() =>{});

  }

  componentWillUnmount() {
    BusManager.clear();
  }

  updateAsset (key, newValue) {
    let components = key.split(".");
    if(components.length == 1) {
      let props = this.props.navigation.state.params
      let location = props.location;
      let asset = AssetData.getAsset(props.asset.asset_tag_number)
      asset[key] = newValue;
      AssetData.updateAsset(asset, true);

    } else {
      let props = this.props.navigation.state.params
      let location = props.location;
      let asset = AssetData.getAsset(props.asset.asset_tag_number)
      let object = asset[components[0]];
      let objectValue = object[components[1]];
      object[components[1]] = newValue;
      asset[components[0]] = object;
      AssetData.updateAsset(asset, true);
    }
    this.setState({});

  }

  syncAsset() {
    let props = this.props.navigation.state.params
    let location = props.location;
    let asset = AssetData.getAsset(props.asset.asset_tag_number);
    if(asset._local_status.failedCreate) {
      AssetData.createAssetOnServer(asset, asset.location, asset.organization).then(() => {}).catch((err) => {
        Alert.alert("Asset Save Error", "Asset Save Error : "+JSON.stringify(err), [{ text : "Ok", onPress : () => { } }])
      });
    } else {
      AssetData.syncAssetToServer(asset, asset.location, asset.organization).then(() => {}).catch((err) => {});
    }
  }

  reloadAsset () {
    let props = this.props.navigation.state.params
    let location = props.location;
    let asset = AssetData.getAsset(props.asset.asset_tag_number)
    AssetData.loadAssetData(asset.asset_tag_number).then((assetData) => {
      Vibration.vibrate();
      Alert.alert("Asset Reloaded", "Asset Successfully Reloaded", [{ text : "Ok", onPress : () => { this.setState({ actionInProgress : false }); } }])
      LocationData.reloadAsset(location.building, location.room, assetData);
    }).catch((err) => {
      Vibration.vibrate();
      Alert.alert("Error", "Asset Load Error : "+JSON.stringify(err), [{ text : "Ok", onPress : () => { this.setState({ actionInProgress : false }); } }])

    });
    this.setState({ actionInProgress : true });
  }

  buttonPressHandler(key) {
    let self = this;
    let props = this.props.navigation.state.params
    let asset = props.asset;
    let updatedAsset = AssetData.buttonAction(asset, key);
    if (updatedAsset) {
      AssetData.updateAsset(updatedAsset, true)
      this.setState({});
    } else {
      Vibration.vibrate();
      Alert.alert('Button Action Error', 'This button action with key \''+key+'\' has no corresponding action.', [
        { text : "Ok", onPress : () => { } }
      ])
    }
  }

  rowRenderConfig ({item}) {
    let props = this.props.navigation.state.params
    let location = props.location;
    let asset = AssetData.getAsset(props.asset.asset_tag_number)
    let editable = true;
    if(item.editable === false) { editable = false; }
    if(item.key == "asset_tag_number") { editable = false;}
    let itemComponents = {
      "object" : () => {
        let components = item.key.split(".");
        let object = asset[components[0]];
        let objectValue = object[components[1]];
        return <TextRow label={item.label} value={ objectValue } editable={editable} numLines={item.numLines} onChange={this.updateAsset.bind(null, item.key)}/>
      },
      "string" : (<TextRow label={item.label} value={asset[item.key]} editable={editable} numLines={item.numLines} onChange={this.updateAsset.bind(null, item.key)}/>),
      "float" : (<NumberRow label={item.label} value={asset[item.key]} editable={editable} onChange={this.updateAsset.bind(null, item.key)}/>),
      "datetime" : () => {
        return (<DatetimeRow label={item.label} value={asset[item.key]} editable={editable} onChange={this.updateAsset.bind(null, item.key)}/>);
      },
      "picker" : (<PickerRow label={item.label} value={asset[item.key]+""} editable={editable} onChange={this.updateAsset.bind(null, item.key)} items={item.items}/>),
      "segment" : (<SegmentRow label={item.label} value={asset[item.key]+""} onChange={this.updateAsset.bind(null, item.key)} items={item.items}/>),
      "button" : (<ButtonRow title={item.label} onPress={this.buttonPressHandler.bind(null, item.key)}/>)
    }
    if(typeof itemComponents[item.type] == "undefined") { return (<View style={{flex : 1, height: 35, justifyContent: "center"}}><Text>Unknown Row Type</Text></View>)}
    if(typeof itemComponents[item.type] == "function") { return itemComponents[item.type](); }
    return itemComponents[item.type];
  }

  rowRenderOther ({item}) {
    let props = this.props.navigation.state.params
    let location = props.location;
    let asset = AssetData.getAsset(props.asset.asset_tag_number)
    return <InputRow label={item.label} value={asset[item.key]+""} editable={false} onChange={this.updateAsset.bind(null, item.key)}/>;
  }

  rowRenderFiles ({item}) {
    let self = this;
    let props = this.props.navigation.state.params
    let location = props.location;
    let asset = AssetData.getAsset(props.asset.asset_tag_number)
    if(typeof item.action == "function") {
      return <ButtonRow title={ item.title } onPress={item.action}/>
    } else {
      const actionStyle = {
        flex : 1,
        alignItems: "flex-start",
        paddingLeft: 10,
        justifyContent: 'center',
      };
      const actionButtons = [
        <TouchableOpacity style={[actionStyle, { backgroundColor: "#d5d5d5" }]} onPress={() => {
          console.log("Delete File Locally")
        }}>
          <IconEntypo name="circle-with-minus" size={30} color="red"/>
        </TouchableOpacity>,
        <TouchableOpacity style={[actionStyle, { backgroundColor: "#d5d5d5" }]} onPress={() => {
          console.log("Delete File Remotely")
        }}>
          <IconEntypo name="circle-with-cross" size={30} color="blue"/>
        </TouchableOpacity>
      ];
      return <Swipeable rightButtonWidth={50} rightButtons={actionButtons}><ButtonRow title={item.filename} icon={<IconEntypo name="circle-with-minus" size={30} color="red"/>} onPress={() => {
        self.props.navigation.navigate("LocationAssetFileViewerScreen", { asset : asset, filename: item.filename });
      }}/></Swipeable>;

    }

  }

  render() {
    let self = this;
    let props = this.props.navigation.state.params
    let location = props.location;
    let assetConfig = AssetData.getAssetConfig(props.asset.organization);
    let organizationDataKeys = assetConfig.fields.map((row) => { return row.key; });
    let asset = AssetData.getAsset(props.asset.asset_tag_number);
    let assetOther = Object.keys(asset).reduce((acc, key) => {
      if(key == "_local_status") { return acc; }
      if(organizationDataKeys.includes(key)) { return acc; }
      if(AssetData.isRestrictedKey(key)) { return acc;}
      acc.push({
        label : ""+key,
        key : key,
        type : "string"
      });
      return acc
    }, []);
    let itemSeparator = () => <View style={{ width: "100%", backgroundColor: "black", height: 1}}></View>
    let header = () => {
      if(this.state.actionInProgress) {
        return (<View style={{ width: "100%", flex : 1, justifyContent: "space-around", backgroundColor: "#d5d5d5", flexDirection: "row" }}>
          <Text style={{ margin: 10, fontSize: 20 }}>Action in Progress</Text>
        </View>);
      }
      if(asset._local_status.failedCreate) {
        return (<View style={{ width: "100%", flex : 1, justifyContent: "space-around", backgroundColor: "#d5d5d5", flexDirection: "row" }}>
          <Button color="green" title="Register" onPress={this.syncAsset}/>
        </View>);
      }
      if(asset._local_status.dirty) {
        return (<View style={{ width: "100%", flex : 1, justifyContent: "space-around", backgroundColor: "#d5d5d5", flexDirection: "row" }}>
          <Button color="green" title="Save" onPress={this.syncAsset}/>
        </View>);
      }
      return (<View style={{ width: "100%", flex : 1, justifyContent: "space-around", backgroundColor: "#d5d5d5", flexDirection: "row" }}>
        <Text style={{ margin: 10, fontSize: 20 }}>(No Save Needed)</Text>
      </View>);

    };

    let footer = () => (<View style={{ width: "100%", backgroundColor: "#d5d5d5", height: 20, justifyContent: "center"}}><Text> {assetConfig.organization_code} - Version {assetConfig.version} </Text></View>)
    let files = this.state.files.map(( filename ) => {
      return { filename : filename }
    });
    files.push({ title: "Add Image", action: () => {
      ImagePicker.showImagePicker({
        title: "Select Image",
        noData: true,
        storageOptions: {
          skipBackup: true,
          cameraRoll: false
        }
      }, (response) => {
        if(response.didCancel) { return; }
        if(response.error) {
          Alert.alert("Error Selecting Image", response.error, [
            { text: "Ok", onPress: () => {
              self.setState({ filenamePromptVisible: false, fileToUploadURI: null });
            } }
          ])
          return;
        }
        if(response.customButton) { return;}
        let uri = response.uri;
        self.setState({ filenamePromptVisible: true, fileToUploadURI: uri });
      })
    }})
    // files.push({title: "Add Image", action: () => { console.log("Add Image Action"); } });
    let sections = [
      { title : "System Fields", data : AssetData.getSystemFields(), color:"#72fa78", renderItem: this.rowRenderConfig },
      { title : "Organization Fields", data : assetConfig.fields, color:"#72fa78", renderItem: this.rowRenderConfig },
      { title : "Images", data : [{ title : "Reference", action: () => {
        self.props.navigation.navigate("LocationAssetImageDetailScreen", { asset : asset, mode: "reference", allowEdit: false });
      } }], color:"#eaeaea", renderItem: this.rowRenderFiles },
      { title : "Files", data : files, color : "#fefc78", renderItem: this.rowRenderFiles },
      { title : "Other Data", data : assetOther, color:"#eaeaea", renderItem: this.rowRenderOther }
    ];

    let assetFieldList = <SectionList
      renderSectionHeader={({section}) => (<View style={{ flex : 1, alignItems: 'center', padding: 5, backgroundColor : section.color }}><Text>{section.title}</Text></View>)}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ItemSeparatorComponent={itemSeparator}
      sections={sections}
      keyExtractor={(item, index) => index}
      />
    return (
      <View style={{ flex : 1, backgroundColor: "white" }}>
        {assetFieldList}
        <Prompt
          title="Enter Upload Filename"
          placeholder="Filename.jpg"
          visible={self.state.filenamePromptVisible}
          onCancel={ () => {
            self.setState({ filenamePromptVisible: false, fileToUploadURI: null });
          } }
          onChangeText={ (newValue) => {
            let filename = newValue;
            if(/.*\.jpg/.test(filename) == false) { filename = filename+".jpg" }
            if(filename == "reference.jpg") {
              Alert.alert("Warning", "Cannot overwrite reference image from mobile app. Please use a different name.", [{ text: "Ok", onPress: () => {} }])
            }
          } }
          onSubmit={ (value) => {
            let filename = value;
            if(/.*\.jpg/.test(filename) == false) { filename = filename+".jpg" }
            AssetData.uploadAssetFileFromURI(asset.asset_tag_number, self.state.fileToUploadURI, filename).then(() => {
              return AssetData.fetchAssetFilesAsync(asset.asset_tag_number)
            }).then((files) => {
              this.setState({ files : files, filenamePromptVisible: false, fileToUploadURI: null });
            }).catch((err) =>{
              console.log("Error Uploading Picture", err);
              Alert.alert("Picture Upload Error", JSON.stringify(err), [{ text: "Ok", onPress: () => {} }])
            })
          } }
        />
      </View>
    )
  }
}


export default AssetDetailScene
