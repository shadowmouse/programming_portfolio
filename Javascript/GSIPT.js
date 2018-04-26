/*

    Created By : Elliot Francis
    Description : An example API Endpoint using the APIModule base class.
    This particular example is used to drive a Genome Sample Processing System.

*/

(function () {
  'use strict'

  let fs = require("fs");
  var ColorHash = require("color-hash");
  var colorHash = new ColorHash();
  let Sequelize = require("sequelize");
  let PDFDocument = require("pdfkit");
  let config = require("./config");
  let GSIPT = require("./APIModule")();
  let database = require("./database");
  let Auth = require("./auth");
  let logger = require("./logger");
  let moment = require("moment");
  let ABISupport = require("./ABISupport.js");
  let OrderModel = database.models.orders;
  let AccountModel = database.models.accounts;
  let UserAccountPermissionModel = database.models.user_account_permissions;
  let UserModel = database.models.users;
  let ServiceModel = database.models.services;
  let GroupModel = database.models.groups;
  let EventModel = database.models.events;
  let LineItemModel = database.models.line_items;
  let PresetModel = database.models.line_preset;
  let RateModel = database.models.event_rate;
  let PlateModel = database.models.processing_plate;



  GSIPT.getOrdersByProcessingStatus = function (req, res, group_id, status, range) {

    let whereCriteria = {processing_status : status, order_billing_status : { $between : [0,2] }};
    if(range) {
      let startDate = range[0];
      let endDate = range[1];
      whereCriteria = {processing_status : status, order_billing_status : { $between : [0,3] }, order_date : {$between : [startDate.format("YYYY-MM-DD"),endDate.format("YYYY-MM-DD")]}}
    }
    Auth.authorizeToken(req, 10).then(function (payload) {
      if(payload.allow) {
        let user_id = payload.user.id;
        OrderModel.findAll({
          where : whereCriteria,
          include : [{
            model : ServiceModel,
            where : { 'group_id' : group_id, type : 5 }
          },
          { model : UserModel },
          { model : LineItemModel },
          {
            model : AccountModel,
            include : [{ model : UserModel }]
          }],
          order : [['order_date', 'DESC']]
        }).then(function (rows) {
          Auth.isManagerForGroup(group_id, req).then(function (isManager) {
            if(isManager) {
              res.send({status : true, orders : rows});
            } else {
              // Get User Account Permissions
              UserAccountPermissionModel.findAll({
                where : { user_id : user_id }
              }).then(function (accountPermissions) {

                // Map Account Permissions into Access Table
                let accountAllowed = accountPermissions.reduce((acc, permission, index, sourceArray) => {
                  if(typeof acc[permission.account_id] == "undefined") { acc[permission.account_id] = { allowed : false } }
                  let perm = acc[permission.account_id];
                  if(permission.type == 1) { perm.allowed = true; }
                  acc[permission.account_id] = perm;
                  return acc;
                }, {});

                // Filter the rows of allowed user orders
                let filteredRows = rows.filter(function (row) {
                  if(row.account.pi_id == user_id) { return true; }
                  if(row.user.id == user_id) { return true; }
                  if(typeof accountAllowed[row.account.id] !== "undefined") {
                    let perm = accountAllowed[row.account.id];
                    if(perm.allowed) { return true; }
                  }
                  return false;
                });
                res.send({status : true, orders : filteredRows});
              });
            }

          })

        }, function (err) {
          logger.log("error", "server/order.js - ", err);
          res.send({status : false, debug : err});
        });
      } else {
        res.send({status : false, debug : "User Not Authorized for this Resource"});
      }
    }, function (err) {
      logger.log("error", "server/order.js - ", err);
      res.send({status : false, debug : err});
    });
  }

  GSIPT.submitted = function (req, res) {
    let parameters = req.params;
    let data = req.body;
    let group_id = parameters.groupID;
    GSIPT.getOrdersByProcessingStatus(req, res, group_id, 0);
  };

  GSIPT.inprocess = function (req, res) {
    let parameters = req.params;
    let data = req.body;
    let group_id = parameters.groupID;
    GSIPT.getOrdersByProcessingStatus(req, res, group_id, 1);
  };

  GSIPT.completed = function (req, res) {
    let parameters = req.params;
    let data = req.body;
    let group_id = parameters.groupID;
    let dateRangeString = parameters.range;
    let rangeComponents = dateRangeString.split(":");
    if(rangeComponents.length !== 2) {
      res.send({status : false, debug : "Date Range Incomplete : Needed <Start>YYYY-MM-DD:<End>YYYY-MM-DD"});
      return;
    }
    let startDate = moment(rangeComponents[0], "YYYY-MM-DD");
    let endDate = moment(rangeComponents[1], "YYYY-MM-DD");
    if(!startDate.isValid() || !endDate.isValid()) {
      res.send({status : false, debug : "Submitted Date Invalid : Needed <Start>YYYY-MM-DD:<End>YYYY-MM-DD"});
      return;
    }
    endDate.add(1, "days");
    GSIPT.getOrdersByProcessingStatus(req, res, group_id, 2, [startDate, endDate]);
  };



  GSIPT.byID = function (req, res) {
    let parameters = req.params;
    let data = req.body;
    Auth.authorizeToken(req, 10).then(function (payload) {
      if(payload.allow) {
        OrderModel.findAll({
          where : { id : parameters.id },
          include : [{
            model : ServiceModel
          },
          { model : UserModel },
          { model : LineItemModel },
          {
            model : AccountModel,
            include : [{ model : UserModel }]
          }],
          order : [['order_date', 'DESC']]
        }).then(function (rows) {
          let order = rows[0];
          return order.reload();
        }).then(function (order) {
          res.send({status : true, order : order});
        }, function (err) {
          logger.log("error", "server/order.js - ", err);
          res.send({status : false, debug : err});
        });
      } else {
        res.send({status : false, debug : "User Not Authorized for this Resource"});
      }
    }, function (err) {
      logger.log("error", "server/order.js - ", err);
      res.send({status : false, debug : err});
    });
  };

  GSIPT.getPlate = function (req, res) {
    let parameters = req.params;
    let data = req.body;
    Auth.authorizeToken(req, 0).then(function (payload) {
      if(payload.allow) {
          PlateModel.findAll({  where : { id : parameters.id } }).then(function (plates) {
            let plate = plates[0].get({ plain : true });
            plate.samples = JSON.parse(plate.plate_configuration_json);
            let promises = plate.samples.map(function (sample, index) {
              return new Promise(function (resolve, reject) {
                if(sample == "Empty") { resolve({ index : index }); return; }
                if(sample.id == "CTL") { sample.order_id = "CTL"+sample.index }
                let orderDir = "./order_files/"+sample.order_id;
                fs.readdir(orderDir, function (err, files) {
                  if(err) {
                    if(sample.id == "CTL") {
                      resolve({ index : index, sampleType : "CTL" });
                    } else {
                      LineItemModel.findAll({ where : { id : sample.id }}).then((samplesData) => {
                        let sampleData = samplesData[0];
                        resolve({ index : index, sampleType : sampleData.data_3 });
                      });
                    }
                    return;
                  }
                  let resultsFilename = files.reduce((acc, filename, index) => {
                    let testString = '._'+sample.id+'_'+plate.id+'_'+sample.order_id+'\\$.*\\.ab1';
                    if(new RegExp(testString, 'g').test(filename)) { return filename; }
                    return acc;
                  }, null);
                  if(resultsFilename !== null) {
                    let filePath = "./order_files/"+sample.order_id+"/"+resultsFilename;

                    ABISupport.getAnalysis(filePath).then(function (analysisResults) {
                      if(sample.id == "CTL") {
                        resolve({ index : index, sampleType: "CTL", pendingRedo : false, filename: resultsFilename, analysis : analysisResults });
                      } else {
                        LineItemModel.findAll({ where : { id : sample.id }}).then((samplesData) => {
                          let sampleData = samplesData[0];
                          let isPendingRedo = (sampleData.data_1 == "REDO");
                          resolve({ index : index, sampleType : sampleData.data_3, pendingRedo : isPendingRedo, filename: resultsFilename, analysis : analysisResults });
                        });
                      }
                    }); // End Get Analysis
                  } else {
                    if(sample.id == "CTL") {
                      resolve({ index : index, sampleType : "CTL" });
                    } else {
                      LineItemModel.findAll({ where : { id : sample.id }}).then((samplesData) => {
                        let sampleData = samplesData[0];
                        resolve({ index : index, sampleType : sampleData.data_3 });
                      });
                    } // End Control Else
                  } // End Else
                }); // End Directory Read
              }); // End Promise
            });
            Promise.all(promises).then((results) => {
              results.map((result) => {
                let index = result.index;
                let sample = plate.samples[index];
                if(sample !== "Empty") {
                  sample.type = result.sampleType;
                }
                if(sample !== "Empty" && typeof result.analysis !== "undefined") {
                    sample.analysis = result.analysis;
                    sample.pendingRedo = result.pendingRedo;
                    sample.filename = result.filename;
                }
                plate.samples[index] = sample;
              });// End Results Map
              res.send({ status : true, plate : plate });
            }); // End Promise Resolver

          })
          res.send({status : false, debug : err});
      } else {
        res.send({status : false, debug : "User Not Authorized for this Resource"});
      }
    }, function (err) {
      logger.log("error", "server/order.js - ", err);
      res.send({status : false, debug : err});
    });
  };


  GSIPT.getUnassignedSamples = function (req, res) {
    let parameters = req.params;
    let data = req.body;
    Auth.authorizeToken(req, 10).then(function (payload) {
      if(payload.allow) {
        LineItemModel.findAll({
          where : { $or : [{ data_1 : "USP" }, { data_1 : "REDO"}] },
          include : [{ model : PresetModel },
            { model : OrderModel,
              include : { model : ServiceModel,
                where : { group_id : parameters.group_id, type : 5 }
              }
            }
          ],
          order : [['order_date', 'DESC']]
        }).then(function (rows) {
          res.send({status : true, samples : rows});
        }, function (err) {
          logger.log("error", "server/order.js - ", err);
          res.send({status : false, debug : err});
        });
      } else {
        res.send({status : false, debug : "User Not Authorized for this Resource"});
      }
    }, function (err) {
      logger.log("error", "server/order.js - ", err);
      res.send({status : false, debug : err});
    });
  };

  GSIPT.getPlateList = function (req, res) {
    let parameters = req.params;
    let data = req.body;

    Auth.authorizeToken(req, 0).then(function (payload) {
      if(payload.allow) {
        let dateRangeString = parameters.range;
        let rangeComponents = dateRangeString.split(":");
        if(rangeComponents.length !== 2) {
          res.send({status : false, debug : "Date Range Incomplete : Needed <Start>YYYY-MM-DD:<End>YYYY-MM-DD"});
          return;
        }
        let startDate = moment(rangeComponents[0], "YYYY-MM-DD");
        let endDate = moment(rangeComponents[1], "YYYY-MM-DD");
        if(!startDate.isValid() || !endDate.isValid()) {
          res.send({status : false, debug : "Submitted Date Invalid : Needed <Start>YYYY-MM-DD:<End>YYYY-MM-DD"});
          return;
        }
        endDate.add(1, "days");

        let whereMode = {
          0 : { processing_status : 0, group_id : parameters.group_id },
          10 : { processing_status : 10, group_id : parameters.group_id },
          20 : { processing_status : 20, group_id : parameters.group_id, updatedAt : { $between : [startDate.format("YYYY-MM-DD"),endDate.format("YYYY-MM-DD")] } }
        }

        PlateModel.findAll({
          where : whereMode[parameters.status],
          include : [ UserModel ]
        }).then(function (plates) {
          let assembledPlates = plates.map(function (plate, index) {
            let plainPlate = plate.get({ plain : true });
            plainPlate.samples = JSON.parse(plate.plate_configuration_json);
            plainPlate.samples = plainPlate.samples.map(function(sample) {
              if(sample == "Empty") { return sample; }
              sample.description = sample.sample;
              return sample;
            });
            delete plainPlate.plate_configuration_json;
            return plainPlate;
          });
          res.send({status : true, plates : assembledPlates });
        }, function (err) {
          logger.log("error", "server/order.js - ", err);
          res.send({status : false, debug : err});
        });
      } else {
        res.send({status : false, debug : "User Not Authorized for this Resource"});
      }
    }, function (err) {
      logger.log("error", "server/order.js - ", err);
      res.send({status : false, debug : err});
    });
  };

  GSIPT.createPlate = function (req, res) {
    let parameters = req.params;
    let data = req.body;
    Auth.authorizeToken(req, 10).then(function (payload) {
      if(payload.allow) {
        let submittedPlate = data.plate;
        let plateData = {
          processing_status : 0,
          seal_type : submittedPlate.seal_type,
          plate_label : submittedPlate.plate_label,
          user_id : submittedPlate.user_id,
          group_id : submittedPlate.group_id,
          plate_configuration_json : JSON.stringify(submittedPlate.well_configuration)
        };
        PlateModel.create(plateData).then(function (plate) {
          submittedPlate.well_configuration.map(function (sample) {
            if(sample == "Empty") { return "Empty"; }
            if(sample.id == "CTL") { return sample; }
            LineItemModel.findAll({
              where : {
                id : sample.id
              }
            }).then(function (items) {
                let item = items[0];
                item.data_1 = plate.id;
                item.data_2 = sample.index;
                item.save();
            });
          });
          res.send({ status : true, plate_id : plate.id })
        })
      } else {
        res.send({status : false, debug : "User Not Authorized for this Resource"});
      }
    }, function (err) {
      logger.log("error", "server/order.js - ", err);
      res.send({status : false, debug : err});
    });
  };

  GSIPT.setPlateStatus = function (req, res) {
    let parameters = req.params;
    let data = req.body;
    Auth.authorizeToken(req, 20).then(function (payload) {
      if(payload.allow) {
        PlateModel.findAll({ where : { id : data.plate_id }}).then(function (plates) {
          let plate = plates[0];
          plate.update({ processing_status : data.new_status }).then(function () {
            plate.processing_status = data.new_status;
            GSIPT.updatePlateOrders(plate).then((result) => {
              res.send({ status : true, plate : plate.get({ plain : true }) });
            });
          });
        })
      } else {
        res.send({status : false, debug : "User Not Authorized for this Resource"});
      }
    }, function (err) {
      logger.log("error", "server/order.js - ", err);
      res.send({status : false, debug : err});
    });
  };

  GSIPT.setPlateTitle = function (req, res) {
    let parameters = req.params;
    let data = req.body;
    Auth.authorizeToken(req, 20).then(function (payload) {
      if(payload.allow) {
        PlateModel.findAll({ where : { id : data.plate_id }}).then(function (plates) {
          let plate = plates[0];
          plate.update({ plate_label : data.new_title }).then(function () {
            plate.plate_label = data.new_title;
            GSIPT.updatePlateOrders(plate).then((result) => {
              res.send({ status : true, plate : plate.get({ plain : true }) });
            });
          });
        })
      } else {
        res.send({status : false, debug : "User Not Authorized for this Resource"});
      }
    }, function (err) {
      logger.log("error", "server/order.js - ", err);
      res.send({status : false, debug : err});
    });
  };

  GSIPT.checkPlateTitle = function (req, res) {
    let parameters = req.params;
    let data = req.body;
    Auth.authorizeToken(req, 20).then(function (payload) {
      if(payload.allow) {
        PlateModel.findAll({ where : { plate_label : data.plate_label }}).then(function (plates) {
          res.send({ status : true, isUnique : (plates.length > 0 ? false : true) });
        })
      } else {
        res.send({status : false, debug : "User Not Authorized for this Resource"});
      }
    }, function (err) {
      logger.log("error", "server/order.js - ", err);
      res.send({status : false, debug : err});
    });
  };

  GSIPT.updatePlateOrders = function (plate) {
    let samplesIDs = JSON.parse(plate.plate_configuration_json).reduce((acc, sample, index, sourceArray) => {
      if(sample == "EMPTY") { return acc; }
      if(sample.id == "CTL") { return acc; }
      if(!acc.includes(sample.id)) { acc.push(sample.id); }
      return acc;
    }, []);
    return new Promise((uporesolve, uporeject) => {
      LineItemModel.findAll({ where : { id : {$in : samplesIDs } } }).then((samples) => {
         return new Promise((limresolve, limreject) => {
           limresolve(samples.reduce((acc, sample) => {
            if(!acc.includes(sample.order_id)) { acc.push(sample.order_id); }
            return acc;
          }, []));
         });
      }).then((orders) => {
        let statusMap = {
          0 : 0,
          10 : 1,
          20 : 2
        }
        database.query('UPDATE orders SET processing_status=? WHERE id IN (?)', {
          replacements : [statusMap[plate.processing_status], orders],
          type: database.QueryTypes.UPDATE
        }).then(() => {
          uporesolve(true);
        })
      });
    });
  }

  // Simple Range Generator

	GSIPT.generateRange = function (start, end, increment_by) {
		if(typeof increment_by == "undefined" ) { increment_by = 1 };
		let array = [];
		for(let index = start; index <= end; index+=increment_by) { array.push(index); }
		return array;
	}

	// Map a 96 Element Array Index to a 96 Well Position

	GSIPT.mapArrayIndexTo96WellPosition = function (index) {
		if(index >= 96 || index < 0) { return false; }
		let rows = GSIPT.generateRange(1,12)
		let cols = ["A","B","C","D","E","F","G","H"];
		let wellCol = index % cols.length;
		let wellRow = Math.floor(index/cols.length);
		return cols[wellCol] + "" + rows[wellRow];
	}

	// Map a 384 Element Array Index to a 384 Well Position (includes quadrant data)

	GSIPT.mapArrayIndexTo384WellPosition = function (index) {
		if(index >= 384 || index < 0) { return false; }
		let rows = GSIPT.generateRange(1,24)
		let cols = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P"];
		let wellCol = index % cols.length;
		let wellRow = Math.floor(index/cols.length);
		let quadlr = wellCol % 2;
		let quadud =  wellRow % 2;
		let quad = 0;
		let quadrant_index = 0;
		switch(quadlr+":"+quadud) {
			case "0:0" : {
				quad = 1;
				quadrant_index = index / 2 - (8 * (wellRow/2) );
			} break;
			case "1:0" : {
				quad = 2;
				quadrant_index = (index - 1) / 2 - (8 * (wellRow/2) );
			} break;
			case "1:1" : {
				quad = 4;
				quadrant_index = (index - 17) / 2 - (8 * Math.floor(wellRow/2) ) ;
			} break;
			case "0:1" : {
				quad = 3;
				quadrant_index = (index - 16) / 2 - (8 * Math.floor(wellRow/2) );
			} break;
		}
		return {
			index : GSIPT.getQuadrant384WellIndex(quad, quadrant_index),
			well : cols[wellCol] + "" + rows[wellRow],
			quadrant : quad,
			quadrant_index : quadrant_index,
			quadrant_well : GSIPT.mapArrayIndexTo96WellPosition(quadrant_index)
		};
	}

	// Get the samples of a quadrant in a 384 well array

	GSIPT.get384QuadrantArray = function(quadrant, sourcePlate) {
		let start_row = 0;
		let start_col = 0;
		switch(quadrant) {
			case 2 : { start_row = 1;  } break;
			case 4 : { start_row = 1; start_col = 1; } break;
			case 3 : { start_col = 1; } break;
		}
		let quadrantData = [];
		for(let column = start_col; column < 24; column+=2) {
			for(let row = start_row; row < 16; row+=2) {
				let wellIndex = column * 16 + row;
				quadrantData.push(sourcePlate[wellIndex]);
			}
		}
		return quadrantData;
	}


	// Get the 384 Well Array Storage Index for a Given Quadrant and Quadrant Index

	GSIPT.getQuadrant384WellIndex = function(quadrant, quadrant_index) {
		if(quadrant_index >= 96) { return false; }
		let wellCol = quadrant_index % 8;
		let wellRow = Math.floor(quadrant_index/8);
		switch(quadrant) {
			case 1 : {
				return (wellRow * 32) + (wellCol * 2);
			} break;
			case 2 : {
				return (wellRow * 32) + (wellCol * 2) + 1;
			} break;
			case 4 : {
				return (wellRow * 32) + 16 + (wellCol * 2) + 1;
			} break;
			case 3 : {
				return (wellRow * 32) + 16 + (wellCol * 2);
			} break;
		}
	}

  // Check if a quadrant is empty (Exclude Control Wells)
	GSIPT.quadrantIsEmpty = function (quadrant, sourcePlate) {
		let quadrantArray = GSIPT.get384QuadrantArray(quadrant, sourcePlate);
		return quadrantArray.reduce(function (acc, sample) {
			if(sample == "Empty") { return acc; }
			if(sample.id == "CTL") { return acc; }
			return false;
		}, true);
	};

  // Generate PLT File Contents
  GSIPT.generatePLT = function (plate) {

    let quadrantIsEmpty = {
      1 : GSIPT.quadrantIsEmpty(1, plate.samples),
      2 : GSIPT.quadrantIsEmpty(2, plate.samples),
      3 : GSIPT.quadrantIsEmpty(3, plate.samples),
      4 : GSIPT.quadrantIsEmpty(4, plate.samples)
    }

		let sealTypeText = (plate.seal_type == 1 ? "Septa" : "Heat Sealing");
		let plateHeaders = "Container Name\tPlate ID\tDescription\tApplication\tContainerType\tOwner\tOperator\tPlateSealing\tSchedulingPref\t\r\n";
		let plateData = plate.plate_label + "\t" + plate.plate_label + "\t\tSequencingAnalysis\t384-Well\t"+plate.user.username+"\t3730-1\t"+sealTypeText+"\t1234\t\r\n"
		let wellHeaders = "Well\tSample Name\tComment\tResults Group\tInstrument Protocol 1\tAnalysis Protocol 1\tInstrument Protocol 2\tAnalysis Protocol 2\tInstrument Protocol 3\tAnalysis Protocol 3\tInstrument Protocol 4\tAnalysis Protocol 4\tInstrument Protocol 5\tAnalysis Protocol 5\t\r\n"
		let wellData = plate.samples.reduce(function (acc, sample, index) {
			if(sample == "Empty") { return acc; }
      if(sample.description == "#") { return acc; }
			let wellPosition = GSIPT.mapArrayIndexTo384WellPosition(sample.index);
      if(quadrantIsEmpty[wellPosition.quadrant]) { return acc; }
			let wellString = wellPosition.well;
			// Insert Leading Zero If Needed
			if(wellString.length == 2) { wellString = wellString.charAt(0) + "0" + wellString.charAt(1); }
			let rowString = wellString+"\t"; // 384-Well ID (A01, Etc) [Note Leading 0]
      if(sample.id == "CTL") {
        rowString += sample.description+"_"+sample.id+"_"+plate.id+"_CTL"+wellPosition.index+"\t"; // Sample Name
      } else {
        rowString += sample.description+"_"+sample.id+"_"+plate.id+"_"+sample.order_id+"\t"; // Sample Name
      }
			let idString = plate.id+":"+sample.id+":"+sample.index+":"+wellPosition.quadrant+":"+wellPosition.quadrant_well;
			rowString += idString+"\t"; // Comment (ID Link)
			rowString += "Sequencing_Internal\t"; // Results Group [Sanger_Internal]
			rowString += "LongSeq50\t"; // Instrument Protocol 1 [LongSeq50]
			rowString += "Seq_A\t"; // Analysis Protocol 1 [Seq_A]
			rowString += "\r\n"; // NewLine
			acc.push({ well : wellString, rowString : rowString})
      return acc;
		}, []).sort(function (a,b) {
      return a.well.localeCompare(b.well);
    }).reduce(function (acc, rowData, index) {
      return acc + rowData.rowString;
    }, "");
		return plateHeaders + plateData + wellHeaders + wellData;
	}

  GSIPT.markSampleRedo = function (req, res) {
    let parameters = req.params;
    let data = req.body;
    Auth.authorizeToken(req, 0).then(function (payload) {
      if(payload.allow) {
        LineItemModel.findAll({ where : { id : parameters.id }}).then(function (samples) {
          if(samples.length == 0) {res.send({status : false, debug : "Sample Does Not Exist"}); return; }
          let sample = samples[0];
          if(sample.data_1 == "REDO" || sample.data_1 == "USP") { res.send({status : false, debug : "Sample Already Unassigned"}); return; }
          sample.update({ data_1 : "REDO" }).then(function () {
            sample.data_1 == "REDO"
            res.send({status : true, sample : sample.get({ plain : true }) });
          });
        });
      } else {
        res.send({status : false, debug : "User Not Authorized for this Resource"});
      }
    }, function (err) {
      logger.log("error", "server/order.js - ", err);
      res.send({status : false, debug : err});
    });
  };

  GSIPT.unmarkSampleRedo = function (req, res) {
    let parameters = req.params;
    let data = req.body;
    Auth.authorizeToken(req, 0).then(function (payload) {
      if(payload.allow) {
        LineItemModel.findAll({ where : { id : parameters.id }}).then(function (samples) {
          if(samples.length == 0) {res.send({status : false, debug : "Sample Does Not Exist"}); return; }
          let sample = samples[0];
          sample.update({ data_1 : data.plate_id }).then(function () {
            sample.data_1 == data.plate_id;
            res.send({status : true, sample : sample.get({ plain : true }) });
          });
        });
      } else {
        res.send({status : false, debug : "User Not Authorized for this Resource"});
      }
    }, function (err) {
      logger.log("error", "server/order.js - ", err);
      res.send({status : false, debug : err});
    });
  };

  GSIPT.downloadPLT = function (req, res) {
    let parameters = req.params;
    let data = req.body;
    Auth.authorizeToken(req, 0).then(function (payload) {
      if(payload.allow) {
        PlateModel.findAll({
          where : { id : parameters.id },
          include : [ UserModel ]
        }).then(function (plates) {
          let assembledPlates = plates.map(function (plate, index) {
            let plainPlate = plate.get({ plain : true });
            plainPlate.samples = JSON.parse(plate.plate_configuration_json);
            plainPlate.samples = plainPlate.samples.map(function(sample) {
              if(sample == "Empty") { return sample; }
              sample.description = sample.sample;
              return sample;
            });
            delete plainPlate.plate_configuration_json;
            return plainPlate;
          });
          let sendPlate = assembledPlates[0];
          let pltFileContent = GSIPT.generatePLT(sendPlate);
          res.setHeader('Content-disposition', 'attachment; filename='+sendPlate.id+'-'+sendPlate.plate_label+'.plt');
          res.setHeader('Content-type', 'text/plain');
          res.send(Buffer.from(pltFileContent, 'utf8'));
          // res.setHeader('Content-disposition', 'attachment; filename='+sendPlate.id+'-'+sendPlate.plate_label+'.plt');
          // res.setHeader('Content-type', 'text/plain');
          // res.charset = 'UTF-8';
          // res.write(pltFileContent);
          // res.end();
        }, function (err) {
          logger.log("error", "server/order.js - ", err);
          res.send({status : false, debug : err});
        });
      } else {
        res.send({status : false, debug : "User Not Authorized for this Resource"});
      }
    }, function (err) {
      logger.log("error", "server/order.js - ", err);
      res.send({status : false, debug : err});
    });
  };

  let generatePlatePage = function (doc, samples, orderRef, quadrant, plate_id) {
    let cellSize = 45
    let borderSize = 5
    let start_x = 15
    let start_y = 50
    var index = 0;
    doc.fontSize(26).fillColor("black").text("Run "+plate_id+" -- Plate "+quadrant+" Configuration", 10, 10);
    for(let col = 0; col < 12; col++) {
      let posX = Math.floor(start_x + (cellSize * col) + (borderSize))
      let posY = 35
      doc.fontSize(12).fillColor("black").text(""+(col+1),posX+15,posY+5)
    }
    for(let row = 0; row < 8; row++) {
      let posX = 8
      let posY = Math.floor(start_y + (cellSize * row) + (borderSize))
      doc.fontSize(12).fillColor("black").text(String.fromCharCode(65+row),posX,posY+15)
    }

    for(let col = 0; col < 12; col++) {
      for(let row = 0; row < 8; row++) {
        var sample = samples[index];
        let cellX = Math.floor(start_x + (cellSize * col) + (borderSize))
        let cellY = Math.floor(start_y + (cellSize * row) + (borderSize))

        var locationContents = "";
        if(sample !== "Empty") {
          if(sample.sample.length > 12) {
            locationContents = sample.sample.slice(0,7)+"...";
          } else {
            locationContents = sample.sample
          }
          var colorRGB = colorHash.hex(sample.order_id);
          doc.rect(cellX, cellY, cellSize, cellSize).fillColor(colorRGB).fillAndStroke()
          doc.rect(cellX+4, cellY+4, cellSize-8, cellSize-8).fillColor("white").fill()
          doc.fontSize(7).fillColor("black").text(locationContents,cellX+5,cellY+5)
          doc.fontSize(7).fillColor("black").text(sample.id,cellX+5,cellY+15)
          doc.fontSize(7).fillColor("black").text(sample.order_id,cellX+5,cellY+25)
        } else {
          doc.rect(cellX, cellY, cellSize, cellSize).fillColor("gray").fillAndStroke()
          doc.rect(cellX+4, cellY+4, cellSize-8, cellSize-8).fillColor("white").fill()
        }
        index++;
      }
    }
    let orderListStartY = start_y + (cellSize * 8) + (borderSize * 8) - 25;

    doc.fontSize(16).fillColor("black").text("Order ID", 10, orderListStartY);
    doc.fontSize(16).fillColor("black").text("Submitter Name (Email)", 100, orderListStartY);
    doc.fontSize(16).fillColor("black").text("Count", 375, orderListStartY);
    doc.fontSize(16).fillColor("black").text("Order Date", 450, orderListStartY);

    doc.rect(10, orderListStartY + 15, 550, 1 ).fillColor("black").fillAndStroke()

    let plateOrders = samples.reduce((acc, sample, index) => {
      if(sample == "Empty") { return acc; }
      if(typeof sample.order_id == "undefined") { return acc; }
      if(typeof acc[sample.order_id] == "undefined") { acc[sample.order_id] = { id : sample.order_id, sample_count : 0 } }
      let order = acc[sample.order_id];
      order.sample_count += 1;
      acc[sample.order_id] = order;
      return acc;
    }, {});
    Object.keys(plateOrders).map((order, index) => {
      let orderData = orderRef[order];
      let sampleCount = plateOrders[order]['sample_count'];
      let orderLineText = "Order ID : " + orderData.id;
      doc.fontSize(8).fillColor("black").text("Order ID : " + orderData.id, 10, orderListStartY + ((index + 1) * 10) + 10);
      doc.fontSize(8).fillColor("black").text(orderData.user.full_name + " ("+orderData.user.email+")", 100, orderListStartY + ((index + 1) * 10) + 10);
      doc.fontSize(8).fillColor("black").text(sampleCount, 375, orderListStartY + ((index + 1) * 10) + 10);
      doc.fontSize(8).fillColor("black").text(moment(order.order_date).format("YYYY-MM-DD"), 450, orderListStartY + ((index + 1) * 10) + 10);
    });
  }

  let generatePlateContactList = function (doc, orderRef) {

    let start_x = 15
    let start_y = 50
    var index = 0;
    doc.fontSize(26).fillColor("black").text("Run Contact List", 10, 10);
    let orderListStartY = start_y;
    doc.rect(10, orderListStartY - 15, 550, 1 ).fillColor("black").fillAndStroke()
    let emailList = Object.keys(orderRef).reduce((acc, order, index) => {
      let orderData = orderRef[order];
      acc.push(orderData.user.email);
      return acc;
    }, []);
    doc.moveDown();
    doc.fontSize(12).fillColor("black").text("Mail - Comma", { align: "left", width: 550 });
    doc.moveDown();
    doc.fontSize(8).fillColor("black").text(emailList.join(", "), { align: "left", width: 550 });
    doc.moveDown();
    doc.moveDown();
    doc.fontSize(12).fillColor("black").text("Outlook - Semi-Colon", { align: "left", width: 550 });
    doc.moveDown();
    doc.fontSize(8).fillColor("black").text(emailList.join("; "), { align: "left", width: 550 });

  }

  // Get the count of samples in a quadrant
	GSIPT.quadrantSampleCount = function (plate, quadrant) {
		var currentLayout = GSIPT.get384QuadrantArray(quadrant, plate.samples);
		var sampleCount = currentLayout.reduce(function (acc, sample, index) {
			if(sample == "Empty") { acc.empty++; return acc; }
			if(sample.id == "CTL") { acc.control++; return acc; }
			acc.sample++;
			return acc;
		}, { sample : 0, control : 0, empty : 0, samples : currentLayout });
		return sampleCount;
	};

  let generatePDF = function (pipeTarget, plate) {
    let doc = new PDFDocument();
    doc.pipe(pipeTarget);
    let plateOrders = plate.samples.reduce((acc, sample, index) => {
      if(sample == "Empty") { return acc; }
      if(typeof sample.order_id == "undefined") { return acc; }
      if(typeof acc[sample.order_id] == "undefined") { acc[sample.order_id] = { id : sample.order_id, sample_count : 0 } }
      let order = acc[sample.order_id];
      order.sample_count += 1;
      acc[sample.order_id] = order;
      return acc;
    }, {});
    OrderModel.findAll ({  where : { id : Object.keys(plateOrders) }, include : [UserModel] }).then((orders) => {

      let orderRef = orders.reduce((acc, order, index) => {
        acc[order.id] = order;
        return acc;
      }, {})

      let quadrantOneSampleData = GSIPT.quadrantSampleCount(plate, 1)
      if(quadrantOneSampleData.sample > 0) {
        generatePlatePage(doc, quadrantOneSampleData.samples, orderRef, 1, plate.plate_label)
      }
      let quadrantTwoSampleData = GSIPT.quadrantSampleCount(plate, 2)
      if(quadrantTwoSampleData.sample > 0) {
        doc.addPage()
        generatePlatePage(doc, quadrantTwoSampleData.samples, orderRef, 2, plate.plate_label)
      }
      let quadrantThreeSampleData = GSIPT.quadrantSampleCount(plate, 3)
      if(quadrantThreeSampleData.sample > 0) {
        doc.addPage()
        generatePlatePage(doc, quadrantThreeSampleData.samples, orderRef, 3, plate.plate_label)

      }
      let quadrantFourSampleData = GSIPT.quadrantSampleCount(plate, 4)
      if(quadrantFourSampleData.sample > 0) {
        doc.addPage()
        generatePlatePage(doc, quadrantFourSampleData.samples, orderRef, 4, plate.plate_label)
      }
      doc.addPage();
      generatePlateContactList(doc, orderRef)
      doc.end();
    });
  }

  GSIPT.printPlate = function (req, res) {
    let parameters = req.params;
    let data = req.body;
    Auth.authorizeToken(req, 0).then(function (payload) {
      if(payload.allow) {
        PlateModel.findAll({
          where : { id : parameters.id },
          include : [ UserModel ]
        }).then(function (plates) {
          let assembledPlates = plates.map(function (plate, index) {
            let plainPlate = plate.get({ plain : true });
            plainPlate.samples = JSON.parse(plate.plate_configuration_json);
            plainPlate.samples = plainPlate.samples.map(function(sample) {
              if(sample == "Empty") { return sample; }
              sample.description = sample.sample;
              return sample;
            });
            delete plainPlate.plate_configuration_json;
            return plainPlate;
          });
          generatePDF(res, assembledPlates[0]);
        }, function (err) {
          logger.log("error", "server/order.js - ", err);
          res.send({status : false, debug : err});
        });
      } else {
        res.send({status : false, debug : "User Not Authorized for this Resource"});
      }
    }, function (err) {
      logger.log("error", "server/order.js - ", err);
      res.send({status : false, debug : err});
    });
  };

  GSIPT.getTrace = function (req, res, next) {
    let parameters = req.params;
    let data = req.body;
    Auth.authorizeToken(req, 0).then(function (payload) {;
      if(payload.allow) {
        let order_id = parameters.order_id;
        let filename = parameters.filename;
        if(/.*\.ab1/.test(filename)) {
          let filePath = process.cwd() + "/order_files/"+order_id+"/"+filename;
          ABISupport.getTrace(filePath).then(function (analysisResults) {
            res.send({ status : true, analysis : analysisResults });
          }, (err) => { console.log("Error Getting Trace", err) });
        } else {
          res.send({ status : false, debug : "Source File is not an AB1 file."})
        }
      } else {
        res.send({status : false, debug : "User Not Authorized for this Resource"});
      }
    }, function (err) {
      res.send({status : false, debug : err});
    });
  };

  GSIPT.samplePlateHistory = function (req, res) {
    let parameters = req.params;
    let data = req.body;
    Auth.authorizeToken(req, 0).then(function (payload) {
      if(payload.allow) {
        PlateModel.findAll({ where : { plate_configuration_json : { $like : '%"id":'+parameters.id+'%'}}}).then(function (plates) {
          res.send({status : true, plates });
        });
      } else {
        res.send({status : false, debug : "User Not Authorized for this Resource"});
      }
    }, function (err) {
      logger.log("error", "server/order.js - ", err);
      res.send({status : false, debug : err});
    });
  };

  GSIPT.getTransferMap = function (req, res) {
    let parameters = req.params;
    let data = req.body;

    let rightPad = function (string, targetLength, fillString) {
      if(typeof fillString == "undefined") { fillString = " "; }
      if(string.length > targetLength) { return string; }
      for(let i = string.length; i < targetLength; i++) {
        string += fillString;
      }
      return string;
    };

    Auth.authorizeToken(req, 0).then(function (payload) {
      if(payload.allow) {
        PlateModel.findAll({ where : { id : parameters.id }}).then(function (plates) {
          let plate = plates[0];
          let samples = JSON.parse(plate.plate_configuration_json);
          let sampleHistories = samples.map((sample, index, sourceArray) => {
            return new Promise((resolve, reject) => {
              PlateModel.findAll({ where : { plate_configuration_json : { $like : '%"id":'+sample.id+'%'}}, order : [['createdAt', 'DESC']]}).then(function (plates) {
                plates = plates.map((plate, index, sourceArray) => {
                  plate.samples = JSON.parse(plate.plate_configuration_json);
                  return plate;
                });
                resolve({ sample : sample, history : plates });
              });
            });
          });

          Promise.all(sampleHistories).then((results) => {
            let plateHistory = results.map((result, index, sourceArray) => {
              let historicalLocations = result.history.map((plate, index) => {
                let locationIndex = plate.samples.reduce((acc, sample, index, sourceArray) => {
                  if(sample.id == result.sample.id) { return sample.index; }
                  return acc;
                }, -1);
                let sourceLocation = GSIPT.mapArrayIndexTo384WellPosition(locationIndex)
                let targetLocation = GSIPT.mapArrayIndexTo384WellPosition(result.sample.index);
                return {
                  plate_label : plate.plate_label,
                  sourcePlate : sourceLocation.quadrant,
                  sourceWell : sourceLocation.quadrant_well,
                  targetPlate : targetLocation.quadrant,
                  targetWell : targetLocation.quadrant_well
                };
              });
              return {
                sample : result.sample,
                historyCount : result.history.length,
                locations : historicalLocations
              }
            });
            let mapText = " --- Plate "+plate.plate_label+" Redo Map --- \n"+rightPad("Sample", 45)+""+rightPad("Plate", 30)+""+rightPad("Well", 30)+"\n";
            mapText += rightPad("", 75, "_")+"\n";
            plateHistory.map((sample, index, sourceArray) => {
              if(sample !== "Empty" && sample.locations.length > 1) {
                let sampleName = sample.sample.sample;
                let location = sample.locations[1];
                let plate = location.sourcePlate + " -> " + location.targetPlate;
                let label = location.plate_label;
                let sourceWell = location.sourceWell+" -> "+location.targetWell;
                mapText += ""+rightPad(label+" - "+sampleName+"", 45)+""+rightPad(plate+"", 30)+""+rightPad(sourceWell+"", 30)+"\n";;
              }
            });
            res.setHeader('Content-Type', 'text/plain')
            res.send(mapText);
          });
        });
      } else {
        res.send({status : false, debug : "User Not Authorized for this Resource"});
      }
    }, function (err) {
      logger.log("error", "server/order.js - ", err);
      res.send({status : false, debug : err});
    });
  };



  GSIPT.addRoute('/GSIPT/:groupID/submitted', "get", GSIPT.submitted);
  GSIPT.addRoute('/GSIPT/:groupID/processing', "get", GSIPT.inprocess);
  GSIPT.addRoute('/GSIPT/:groupID/completed/:range', "get", GSIPT.completed);
  GSIPT.addRoute('/GSIPT/:group_id/samples/unassigned', "get", GSIPT.getUnassignedSamples);
  GSIPT.addRoute('/GSIPT/plate/status', "post", GSIPT.setPlateStatus);
  GSIPT.addRoute('/GSIPT/plate/title', "post", GSIPT.setPlateTitle);
  GSIPT.addRoute('/GSIPT/plate/checkTitle', "post", GSIPT.checkPlateTitle);
  GSIPT.addRoute('/GSIPT/plate/:id.plt', "get", GSIPT.downloadPLT);
  GSIPT.addRoute('/GSIPT/plate/:id.pdf', "get", GSIPT.printPlate);
  GSIPT.addRoute('/GSIPT/plate/:id', "get", GSIPT.getPlate);
  GSIPT.addRoute('/GSIPT/plate', "post", GSIPT.createPlate);
  GSIPT.addRoute('/GSIPT/sample/:id/redo', "post", GSIPT.markSampleRedo);
  GSIPT.addRoute('/GSIPT/sample/:id/plateHistory', "get", GSIPT.samplePlateHistory);
  GSIPT.addRoute('/GSIPT/plate/:id/redoTransferMap', "get", GSIPT.getTransferMap);
  GSIPT.addRoute('/GSIPT/sample/:id/unredo', "post", GSIPT.unmarkSampleRedo);
  GSIPT.addRoute('/GSIPT/plates/:group_id/:status/:range', "get", GSIPT.getPlateList);
  GSIPT.addRoute('/GSIPT/order/:id', "get", GSIPT.byID);
  GSIPT.addRoute('/GSIPT/trace/:order_id/:filename', "get", GSIPT.getTrace);


  module.exports = GSIPT;
})();
