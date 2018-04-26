/*

    Created By : Elliot Francis
    Description : A daemon script to monitor a directory for output from a scientific instrument
    and re-associate it to the originating order in a workflow management system. Also sends
    and email to the customer with a download link to their data.

*/

'use strict'
let fs = require("fs")
let path = require("path");
let walk = require("walk");
var nodemailer = require("nodemailer");
var database = require("../server/database");
var UserModel = database.models.users;
var OrderModel = database.models.orders;

let transport = nodemailer.createTransport({
  host : "<mail_host>",
  port : 25,
  secure : false,
  tls : { rejectUnauthorized : false }
});

let fileDisplayName = (filename) => {
  let nameComponents = filename.split("$");
  if(nameComponents.length !== 2) { return filename; }
  let nameDashComponents = nameComponents[0].split("_");
  if(nameDashComponents.length == 4) { return nameDashComponents[0]+"$"+nameComponents[1]}
  if(nameDashComponents.length > 4) { return nameDashComponents.slice(0, nameDashComponents.length-3).join("_")+"$"+nameComponents[1] }
  if(nameDashComponents.length < 4) { return filename; }
}

let generateEmailContents = function (order) {
  let contentsString = '<h2>GSIPT System -- Data Availability Notification</h2>';
  contentsString += '<div style="font-weight: normal; font-size: 16pt;"> The following data files are now available for order '+order.order+'</div><hr/><ul>';
  order.files.map((filename, index, sourceArray) => {
    contentsString += '<li style="font-weight: normal; font-size: 16pt;">'+fileDisplayName(filename)+' <a href='+"https://api.example.com/filer/"+order.order+"/"+filename+'>Download</a></li>';
  });
  contentsString += '</ul><hr/>';
  contentsString += '<h2>Thank you for using the Cores Resource System</h2>';
  return contentsString;
};

class OrderBuffer {
  constructor() {
    this.ordersList = {};

    this.addOrder = this.addOrder.bind(this);
    this.clearOrders = this.clearOrders.bind(this);
    this.getOrders = this.getOrders.bind(this);
  }

  addOrder(orderID, filename) {
    if(typeof this.ordersList[orderID] == "undefined") { this.ordersList[orderID] = { order : orderID, files : [] } };
    let order = this.ordersList[orderID];
    order.files.push(filename);
    this.ordersList[orderID] = order;
  }

  clearOrders() {
    console.log("Order List Cleared");
    this.ordersList = {};
  }

  getOrders() {
    return this.ordersList;
  }

}

let checkBufferDir = () => {
  return new Promise( (resolve, reject) => {
    fs.stat("./gsipt_buffer", (err, stat) => {
    	if(err) {
    		fs.mkdir("./gsipt_buffer", (err) => {
    			if(err) { console.log("Error Creating gsipt_buffer Folder : ", err); reject(); }
    			resolve();
    		});
    	} else {
        resolve();
      }
    })
  })
}

let checkOrderDir = (path) => {
  return new Promise( (resolve, reject) => {
    fs.stat(path, (err, stat) => {
    	if(err) {
    		fs.mkdir(path, (err) => {
    			if(err) { console.log("Error Creating Order Folder : ", err); reject(); }
    			resolve();
    		});
    	} else {
        resolve();
      }
    })
  })
}

let getResultsFromFolder = (basepath) => {
  return new Promise((resolve, reject) => {
    fs.readdir(basepath, (err, files) => {
      files.map((filename, index) => {
        if(/^\./.test(filename)) { resolve(); return; } // Ignore Dot Files

        let filepath = basepath+"/"+filename;

        let parsedPath = path.parse(filepath);
        let fileNameComponents = parsedPath.name.split("$");
        let fileNameSubComponents = fileNameComponents[0].split("_")
        let file_order = fileNameSubComponents[(fileNameSubComponents.length - 1)];
        checkOrderDir("./order_files/"+file_order).then(() => {
          fs.stat("./order_files/"+file_order+"/"+parsedPath.name+parsedPath.ext, () => {
            if(err) {
              fs.rename(filepath, "./order_files/"+file_order+"/"+parsedPath.name+parsedPath.ext, (err) => {
                if(err) {
                  reject(err);
                  console.log("GSIPT Move Error", err);
                }
                resolve();
              });
            } else {
              fs.unlink("./order_files/"+file_order+"/"+parsedPath.name+parsedPath.ext, (err) => {
                fs.rename(filepath, "./order_files/"+file_order+"/"+parsedPath.name+parsedPath.ext, (err) => {
                  if(err) {
                    reject(err);
                    console.log("GSIPT Move Error", err);
                  }
                  resolve();
                });
              })
            }
          });

        }, function folderExistanceError(err) {
          reject(err);
        })
      });
    });
  })

}

let waitUntilStable = (path, lastSize, stableAction) => {
  let scanDuration = 1000;
  fs.stat(path, (err, stats) => {
    if(err) { return; }
    if(stats.size !== lastSize) {
      // console.log("File Size Not Stable... Waiting");
      setTimeout(() => { waitUntilStable(path, stats.size, stableAction) }, scanDuration);
    } else {
      // console.log("File Size Stable... Executing Action");
      stableAction(path);
    }
  });


};

//Check for gsipt_buffer folder
checkBufferDir().then(() => {
  let buffer = new OrderBuffer();
  let emailSendTimeout = null;
  let scanActionTimeout = null;

  let emailAction = () => {
    let touchedOrders = buffer.getOrders();
    let clearBufferTimeout = null;
    Object.keys(touchedOrders).map((orderKey, index, sourceArray) => {
      let order = touchedOrders[orderKey];
      OrderModel.findAll({ where : { id : parseInt(order.order, 10) }, include : [UserModel] }).then((orders) => {
        if(orders.length < 1) { console.log("No Orders Found", order); return; }
        let orderData = orders[0];
        if(orderData.user == null) { console.log("Invalid Contact User -- Null"); return; }
        if(typeof orderData.user == "undefined") { console.log("Invalid Contact User -- Undefined"); return; }
        if(orderData.user.email.trim() == "") { console.log("Invalid Contact Email -- Empty"); return; }
        if(orderData.user.email == null) { console.log("Invalid Contact Email -- Null"); return; }
        if(typeof orderData.user.email == "undefined") { console.log("Invalid Contact Email -- Undefined"); return; }
        let toAddress = orderData.user.email;

        let messageConfig = {
          from : "GSIPT Ordering System <email@example.com>",
          to : toAddress,
          subject : "GSIPT System -- Data Availability Notification -- Order : "+orderData.id,
          html : generateEmailContents(order)
        }
        transport.sendMail(messageConfig, (err, info) => {
          clearTimeout(clearBufferTimeout);
          let waitminutes = 90;
          let waitseconds = 60 * waitminutes
          let waittime = 1000 * waitseconds;
          clearBufferTimeout = setTimeout(() => {
            buffer.clearOrders();
          }, waittime)
          if(err) { console.log("Mail Send Error :", err); return; }
        })
      })
    });
  }

  let scanAction = () => {
    let walker = walk.walk("./gsipt_buffer", {followLinks : false});
    walker.on("file", (root, stats, next) => {
      if(/^\./.test(stats.name)) {
          next();
      } else {
        let filepath = root + "/" + stats.name;
        let parsedPath = path.parse(filepath);
        let fileNameComponents = parsedPath.name.split("$");
        let fileNameSubComponents = fileNameComponents[0].split("_")
        let file_order = fileNameSubComponents[(fileNameSubComponents.length - 1)];
        checkOrderDir("./order_files/"+file_order).then(function moveFile() {
          waitUntilStable(filepath, -1, () => {
            buffer.addOrder(file_order, parsedPath.name+parsedPath.ext);
            clearTimeout(emailSendTimeout);
            let waitminutes = 90;
            let waitseconds = 60 * waitminutes
            let waittime = 1000 * waitseconds;
            emailSendTimeout = setTimeout(emailAction, waittime);
            fs.rename("./"+filepath, "./order_files/"+file_order+"/"+parsedPath.name+parsedPath.ext, function (err) {
              if(err) { console.log(err); }
              console.log("Moved "+"./"+filepath+" to "+"./order_files/"+file_order+"/"+parsedPath.name+parsedPath.ext);
            });
          })
          next()
        }, function folderExistanceError(err) {
          next()
        })
      }
    });

    walker.on("end", () => {
      let waitminutes = 5;
      let waitseconds = 60 * waitminutes
      let waittime = 1000 * waitseconds;
      clearTimeout(scanActionTimeout);
      scanActionTimeout = setTimeout(scanAction, waittime);
    })
  }

  scanAction();
  //*/

})
