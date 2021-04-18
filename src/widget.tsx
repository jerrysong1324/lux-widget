//  Copyright 2019-2020 The Lux Authors.
// 
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.

import {
  DOMWidgetModel, DOMWidgetView, ISerializers
} from '@jupyter-widgets/base';

import {
  MODULE_NAME, MODULE_VERSION
} from './version';

import '../css/widget.css'

import * as React from "react";
import * as ReactDOM from "react-dom";
import _ from 'lodash';
import {Tabs,Tab,Modal,Button} from 'react-bootstrap';

import { VegaLite } from 'react-vega';
import Grid from '@material-ui/core/Grid';

import ChartGalleryComponent from './chartGallery';
import CurrentVisComponent from './currentVis';
import {dispatchLogEvent} from './utils';
import ButtonsBroker from './buttonsBroker';
import WarningBtn from './warningBtn';
import InfoBtn from './infoBtn';

import 'codemirror/keymap/sublime';
import 'codemirror/theme/eclipse.css';
import 'codemirror/mode/python/python.js'

import {UnControlled as CodeMirror} from 'react-codemirror2';


export class LuxModel extends DOMWidgetModel {
  defaults() {
    return {...super.defaults(),
      _model_name: LuxModel.model_name,
      _model_module: LuxModel.model_module,
      _model_module_version: LuxModel.model_module_version,
      _view_name: LuxModel.view_name,
      _view_module: LuxModel.view_module,
      _view_module_version : LuxModel.model_module_version
    };
  }

  static serializers: ISerializers = {
      ...DOMWidgetModel.serializers,
      // Add any extra serializers here
    }

  static model_name = 'LuxModel';
  static model_module = MODULE_NAME;
  static model_module_version = MODULE_VERSION;
  static view_name = 'LuxWidgetView';   // Set to null if no view
  static view_module = MODULE_NAME;   // Set to null if no view
  static view_module_version = MODULE_VERSION;
}

export class LuxWidgetView extends DOMWidgetView {
  initialize(){    
    let view = this;
    interface WidgetProps{
      currentVis: object,
      recommendations: any[],
      intent: string,
      selectedIntentIndex: object,
      message: string,
      longDescription: string,
      tabItems: any,
      activeTab: any,
      showAlert: boolean,
      selectedRec: object,
      _selectedVisIdxs: object,
      deletedIndices: object,
      currentVisSelected: number,
      openWarning: boolean,
      openInfo: boolean,
      openFullScreen: boolean,
      graphSpec: object
      graphCodeHTML: string,
      styleCodeHTML: string,
      fullScreenLoading: boolean,
      codeError: boolean,
    }

    class ReactWidget extends React.Component<LuxWidgetView,WidgetProps> {
      private chartComponents = Array<any>();

      constructor(props:any){
        super(props);

        for (var i = 0; i < this.props.model.get("recommendations").length; i++) {
          this.chartComponents.push(React.createRef<ChartGalleryComponent>());
        }

        this.state = {
          currentVis: props.model.get("current_vis"),
          recommendations: props.model.get("recommendations"),
          intent: props.model.get("intent"),
          selectedIntentIndex: {},
          message: props.model.get("message"),
          longDescription: this.generateDescription(null),
          tabItems: this.generateTabItems(),
          activeTab: props.activeTab,
          showAlert: false,
          selectedRec: {},
          _selectedVisIdxs: {},
          deletedIndices: {},
          currentVisSelected: -2,
          openWarning: false,
          openInfo: false,
          openFullScreen: false,
          graphSpec: {},
          graphCodeHTML: "",
          styleCodeHTML: "",
          fullScreenLoading: false,
          codeError: false,
        }

        // This binding is necessary to make `this` work in the callback
        this.handleCurrentVisSelect = this.handleCurrentVisSelect.bind(this);
        this.handleSelect = this.handleSelect.bind(this);
        this.exportSelection = this.exportSelection.bind(this);
        this.toggleWarningPanel = this.toggleWarningPanel.bind(this);
        this.deleteSelection = this.deleteSelection.bind(this);
        this.setIntent = this.setIntent.bind(this);
        this.closeExportInfo = this.closeExportInfo.bind(this);
        this.toggleInfoPanel = this.toggleInfoPanel.bind(this);
        this.toggleFullScreen = this.toggleFullScreen.bind(this);
        this.rerunFullScreen = this.rerunFullScreen.bind(this);
        this.applyStyleFullScreen = this.applyStyleFullScreen.bind(this);
      }

      toggleWarningPanel(e) {
        if (this.state.openWarning){
          dispatchLogEvent("closeWarning",this.state.message);
          this.setState({openWarning:false});
        } else {
          dispatchLogEvent("openWarning",this.state.message);
        this.setState({openWarning:true});
        }
      }

      // called to toggle the long description panel
      toggleInfoPanel(e) {
        if (this.state.openInfo) {
          dispatchLogEvent("closeInfo",this.state.longDescription);
          this.setState({openInfo:false});
        } else {
          dispatchLogEvent("openInfo",this.state.longDescription);
          this.setState({openInfo:true});
        }
      }

      // called to close alert pop up upon export button hit by user
      closeExportInfo() {
        dispatchLogEvent("closeExportInfo", null);
        this.setState({
          showAlert:false});
      }
  
      // called when the variable is changed in the view.model
      onChange(model:any){
        this.setState(model.changed);
      }

      // triggered when component is mounted (i.e., when widget first rendered)
      componentDidMount() { 
        view.listenTo(view.model,"change",this.onChange.bind(this));
      }

      // triggered after component is updated
      // instead of touch (which leads to callback issues), we have to use save_changes
      componentDidUpdate() { 
        view.model.save_changes();
      }

      // populates the long description
      generateDescription(selectedTab) {
        // selectedTab starts out as null and is populated on switches of tabs
        if (!selectedTab) {
          // takes care of init, sets to first longDescription in recommendations list
          if (this.props.model.get("recommendations").length > 0) {
            selectedTab = this.props.model.get("recommendations")[0].action;
          } else {
            return "";
          }
        }
        var description = "";
        for (var recommendation of this.props.model.get("recommendations")) {
          if (recommendation.action === selectedTab) {
            description = recommendation.long_description
          }
        }
        return description;
      }
  
      handleSelect(selectedTab) {
        // The active tab must be set into the state so that
        // the Tabs component knows about the change and re-renders.
        if (selectedTab){
          dispatchLogEvent("switchTab",selectedTab)
        }
        var description = this.generateDescription(selectedTab);
        this.setState({
          activeTab: selectedTab,
          longDescription: description
        });
      }

      handleCurrentVisSelect = (selectedValue) => {
        this.setState({ currentVisSelected: selectedValue }, () => {
          if (selectedValue == -1) {
            this.onListChanged(-1, null);
          } else {
            this.onListChanged(-2, null);
          }
        }); 
      }   

      onListChanged(tabIdx,selectedLst) {
        // Example _selectedVisIdxs : {'Correlation': [0, 2], 'Occurrence': [1]}
        var _selectedVisIdxs = {}
        this.state.selectedRec[tabIdx] = selectedLst // set selected elements as th selectedRec of this tab

          for (var tabID of Object.keys(this.state.selectedRec)){
            if (tabID in this.state.recommendations) {
              var actionName =  this.state.recommendations[tabID]["action"]
              if (this.state.selectedRec[tabID].length > 0) {
                _selectedVisIdxs[actionName] = this.state.selectedRec[tabID]
              }
            } else if (this.state.currentVisSelected == -1) {
              _selectedVisIdxs["currentVis"] = this.state.currentVis
            }
        }
        this.setState({
          _selectedVisIdxs: _selectedVisIdxs
        });
      }

      exportSelection() {
        dispatchLogEvent("exportBtnClick",this.state._selectedVisIdxs);
        this.setState(
          state => ({
            showAlert:true
        }));
        // Expire alert box in 1 minute
        setTimeout(()=>{
          this.setState(
                state => ({
                  showAlert:false
           }));
        },60000);

        view.model.set('_selectedVisIdxs', this.state._selectedVisIdxs);
        view.model.save();

      }

      /* 
       * Goes through all selections and removes and clears any selections across recommendation tabs.
       * Changing deletedIndices triggers an observer in the backend to update backend data structure.
       * Re-renders each tab's chart component, with the updated recommendations.
       */
      deleteSelection() {
        dispatchLogEvent("deleteBtnClick", this.state._selectedVisIdxs);
        var currDeletions = this.state._selectedVisIdxs;

        // Deleting from the frontend's visualization data structure
        for (var recommendation of this.state.recommendations) {
          if (this.state._selectedVisIdxs[recommendation.action]) {
            let delCount = 0;
            for (var index of this.state._selectedVisIdxs[recommendation.action]) {
              recommendation.vspec.splice(index - delCount, 1);
              delCount++;
            }
          }
        }

        this.setState({
            selectedRec: {},
            _selectedVisIdxs: {},
            deletedIndices: currDeletions
        });

        // Re-render each tab's components to update deletions on front end
        for (var i = 0; i < this.props.model.get("recommendations").length; i++) {
          this.chartComponents[i].current.removeDeletedCharts();
        }

        view.model.set('deletedIndices', currDeletions);
        view.model.set('_selectedVisIdxs', {});
        view.model.save();
      }

      /* 
       * Set selected Vis as intent and re-renders widget to update to new view.
       * Shows warning if user tries to select more than one Vis card.
       */
      setIntent() {
        dispatchLogEvent("intentBtnClick", this.state._selectedVisIdxs);
        if (Object.keys(this.state._selectedVisIdxs).length == 1) {
          var action = Object.keys(this.state._selectedVisIdxs)[0];
            if (this.state._selectedVisIdxs[action].length == 1) {
              view.model.set('selectedIntentIndex', this.state._selectedVisIdxs);
              view.model.save();
              return;
          }
        }
      }

      generateTabItems() {
        return (
          this.props.model.get("recommendations").map((actionResult,tabIdx) =>
            <Tab eventKey={actionResult.action} title={actionResult.action} >
              <ChartGalleryComponent 
                  // this exists to prevent chart gallery from refreshing while changing tabs
                  // This is an anti-pattern for React, but is necessary here because our chartgallery is very expensive to initialize
                  key={'no refresh'}
                  ref={this.chartComponents[tabIdx]}
                  title={actionResult.action}
                  description={actionResult.description}
                  multiple={true}
                  maxSelectable={10}
                  onChange={this.onListChanged.bind(this,tabIdx)}
                  graphSpec={actionResult.vspec}
                  currentVisShow={!_.isEmpty(this.props.model.get("current_vis"))}
                  /> 
            </Tab>
          )
        )
      }

      generateNoRecsWarning() {
        if (this.state.message!= "") {
          return <div id="no-recs-footer" style={{display:"flex"}}>
            <div id="no-recs" className = "fa fa-exclamation-triangle"></div>
            <div><p className="warnMsgText"  dangerouslySetInnerHTML={{__html: this.state.message.replace(/<[^>]+>/g, '')}}></p></div> 
          </div>
        }
      }

      // called to toggle the full screen view 
      toggleFullScreen() {
        if (this.state.openFullScreen) {
          dispatchLogEvent("closeFullScreen",this.state._selectedVisIdxs);
          this.setState({
            openFullScreen:false
          });
        } else {
          for (var recommendation of this.state.recommendations) {
            if (this.state._selectedVisIdxs[recommendation.action]) {
              var index = this.state._selectedVisIdxs[recommendation.action][0]
              this.setState({
                graphSpec:recommendation.vspec[index]});
              view.model.set('selectedFullScreenIndex', this.state._selectedVisIdxs);
              view.model.save();
              break;
            }
          }
          dispatchLogEvent("openFullScreen",this.state._selectedVisIdxs);
          // timeout so backend catches up, not best design
          setTimeout(()=>{
            this.setState(
                  state => ({
                    openFullScreen:true,
                    graphCodeHTML:view.model.get("visGraphCode"),
                    styleCodeHTML:view.model.get("visStyleCode")
             }));
             view.model.set('visGraphSpec', this.state.graphSpec);
          },1000);
        }
      }

      // Rerenders just the graph in the full screen view
      rerunFullScreen() {
        this.setState({
          fullScreenLoading: true,
          codeError: false,
        })
        var graphCodeInput = this.state.graphCodeHTML;
        var styleCodeInput = this.state.styleCodeHTML;

        if (view.model.get('visGraphCode') === graphCodeInput && 
            view.model.get('visStyleCode') === styleCodeInput) {
        }
        else {
          var result = this.state.graphSpec;
          view.model.set('visGraphCode', graphCodeInput);
          view.model.set('visStyleCode', styleCodeInput);
          view.model.save();
          // delay so backend finish running, not optimal, onChange of variable, or set timeout in while loop
          setTimeout(()=>{
            try {
              result = JSON.parse(view.model.get("visGraphSpec"));
            }
            catch(err) {
              this.setState({
                codeError: true,
                graphSpec: view.model.get("visGraphSpec")
              }); 
            }
            this.setState(
                  state => ({
                    graphSpec:result,
                    fullScreenLoading:false
            }));
          },1000);
        }
      }

      // Closes overlap and rerenders widget, applies style changes
      applyStyleFullScreen() {
        var codeInput = this.state.styleCodeHTML;
        if (view.model.get('configPlottingStyle') === codeInput) {
        }
        else {
          view.model.set('configPlottingStyle', codeInput);
          view.model.save();
        }
        this.toggleFullScreen();
      }


      render() {
        var buttonsEnabled = Object.keys(this.state._selectedVisIdxs).length > 0;
        var fullScreenEnabled = Object.keys(this.state._selectedVisIdxs).length == 1;
        var intentEnabled = Object.keys(this.state._selectedVisIdxs).length == 1 && Object.values(this.state._selectedVisIdxs)[0].length == 1;
        if (this.state.recommendations.length == 0) {
          return (<div id="oneViewWidgetContainer" style={{ flexDirection: 'column' }}>
                    <div style={{ display: 'flex', flexDirection: 'row' }}>
                      <CurrentVisComponent intent={this.state.intent} currentVisSpec={this.state.currentVis} numRecommendations={this.state.recommendations.length}
                      onChange={this.handleCurrentVisSelect}/>
                    </div>
                    <ButtonsBroker buttonsEnabled={buttonsEnabled}
                                     deleteSelection={this.deleteSelection}
                                     exportSelection={this.exportSelection}
                                     setIntent={this.setIntent}
                                     fullScreen={this.toggleFullScreen}
                                     closeExportInfo={this.closeExportInfo}
                                     tabItems={this.state.tabItems}
                                     showAlert={this.state.showAlert}
                                     intentEnabled={intentEnabled}
                                     fullScreenEnabled={fullScreenEnabled}
                                     />
                  {this.generateNoRecsWarning()}
                  </div>);
        } else if (this.state.recommendations.length > 0) {
          return (<div id="widgetContainer" style={{ flexDirection: 'column' }}>
                    {/* {attributeShelf}
                    {filterShelf} */}
                    <div style={{ display: 'flex', flexDirection: 'row' }}>
                      <CurrentVisComponent intent={this.state.intent} currentVisSpec={this.state.currentVis} numRecommendations={this.state.recommendations.length}
                      onChange={this.handleCurrentVisSelect}/>
                      <div id="tabBanner">
                        <p className="title-description" style={{visibility: !_.isEmpty(this.state.currentVis) ? 'visible' : 'hidden' }}>You might be interested in...</p>
                        <Tabs activeKey={this.state.activeTab} id="tabBannerList" onSelect={this.handleSelect} className={!_.isEmpty(this.state.currentVis) ? "tabBannerPadding" : ""}>
                          {this.state.tabItems}
                        </Tabs>
                      </div>
                    </div>
                    <ButtonsBroker buttonsEnabled={buttonsEnabled}
                                     deleteSelection={this.deleteSelection}
                                     exportSelection={this.exportSelection}
                                     setIntent={this.setIntent}
                                     fullScreen={this.toggleFullScreen}
                                     closeExportInfo={this.closeExportInfo}
                                     tabItems={this.state.tabItems}
                                     showAlert={this.state.showAlert}
                                     intentEnabled={intentEnabled}
                                     fullScreenEnabled={fullScreenEnabled}
                                     />
                    <InfoBtn message={this.state.longDescription} toggleInfoPanel={this.toggleInfoPanel} openInfo={this.state.openInfo} /> 
                    <WarningBtn message={this.state.message} toggleWarningPanel={this.toggleWarningPanel} openWarning={this.state.openWarning} />
                    <Modal
                      show={this.state.openFullScreen}
                      onHide={() => this.toggleFullScreen()}
                      dialogClassName="modal-content-custom"
                      aria-labelledby="contained-modal-title-vcenter"
                    >
                      <Modal.Header closeButton>
                        <Modal.Title id="contained-modal-title-vcenter">
                          Chart Full Screen View
                        </Modal.Title>
                      </Modal.Header>
                      <Modal.Body>
                        <Grid container spacing={3}>
                          <Grid item xs={6}>
                            <div> <h4>Visualization Editor</h4> </div>
                              <CodeMirror
                                value={this.state.graphCodeHTML}
                                onChange={(editor, data, value) => {
                                  this.setState({graphCodeHTML: value})
                                }}
                                editorDidMount={(editor, [next]) => {
                                  this.setState({graphCodeHTML: this.state.graphCodeHTML + " "})
                                }}
                                autoCursor={false}
                                options={{
                                  theme: 'eclipse',
                                  keyMap: 'sublime',
                                  mode: 'python',
                                }} 
                              />
                            <div> <h4>Style Editor</h4> </div>
                              <CodeMirror
                                value={this.state.styleCodeHTML}
                                onChange={(editor, data, value) => {
                                  this.setState({styleCodeHTML: value})
                                }}
                                editorDidMount={(editor, [next]) => {
                                  this.setState({styleCodeHTML: this.state.styleCodeHTML + " "})
                                }}
                                autoCursor={false}
                                options={{
                                  theme: 'eclipse',
                                  keyMap: 'sublime',
                                  mode: 'python',
                                }}
                              />
                          </Grid>
                          <Grid item xs={6} 
                            justify="flex-start"
                            alignItems="flex-end"
                          >
                            <div> {!this.state.codeError ? 
                              <VegaLite
                                  spec={this.state.graphSpec}  
                                  padding={{left: 10, top: 5, right: 5, bottom: 5}}
                                  height={300}
                                  width={320}
                                  actions={false}/> 
                                  :
                                  <div>problems</div>
                                } 
                            </div>
                            <div>
                              <span className={"button-container-1"}>
                                <Button variant="primary" 
                                  onClick={!this.state.fullScreenLoading ? this.rerunFullScreen : null}
                                  disabled={this.state.fullScreenLoading}
                                >
                                  Update Graph
                                </Button>
                              </span>
                              <span className={"button-container-2"}>
                                <Button variant="secondary" onClick={this.applyStyleFullScreen}>
                                  Update Widget Plotting Style
                                </Button>    
                              </span>
                            </div>
                          </Grid>
                        </Grid>                        
                      </Modal.Body>
                    </Modal>
                  </div>);
        }
      }
    }
    const $app = document.createElement("div");
    const App = React.createElement(ReactWidget,view);
    ReactDOM.render(App,$app); // Renders the app
    view.el.append($app); //attaches the rendered app to the DOM (both are required for the widget to show)
    dispatchLogEvent("initWidget","")
  }
}
