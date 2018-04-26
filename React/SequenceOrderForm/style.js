(function () {
  'use strict';

  module.exports = {
    container : {
      width : "100%",
      margin : 5
    },
    title : { fontSize : "1.0rem", fontWeight : "bold" },
    section : {
      padding: 5
    },
    button : {
      border : "1px solid black",
      borderRadius : "5px",
      fontSize : "0.8rem",
      fontWeight : "bold",
      backgroundColor : "white",
      padding : 5,
      margin : 2,
      ":hover" : { backgroundColor : "gray" },
      ":active" : { color : "white" },
      cursor : "default",
      position : "relative",
      top : -5
    },
    dataField : {
      fontSize : "1rem"
    }
  };

})()
