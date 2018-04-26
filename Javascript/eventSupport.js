/*

    Created By : Elliot Francis
    Description : A support class for calculating the on/off hours duration of an event
    from a provided service configuration and event start/end time. Blocked
    times are provided as a sequence of paired minute-of-day definitions. (0-1440)

*/
(function () {
  'use strict'

  var q = require("q");
  var EventSupport = require("./APIModule")();
  var moment = require("moment");
  var logger = require("./logger");


  EventSupport.isDuringOnHours = function (time, service) {
    var weekDay = moment(time).day();
    var blockedTimes = [];
    switch(weekDay) {
      case 0 : { blockedTimes = (service.sunday_blocked !== null ? service.sunday_blocked : "").split(',');} break; // Sunday
      case 1 : { blockedTimes = (service.monday_blocked !== null ? service.monday_blocked : "").split(',');} break;
      case 2 : { blockedTimes = (service.tuesday_blocked !== null ? service.tuesday_blocked : "").split(',');} break;
      case 3 : { blockedTimes = (service.wednesday_blocked !== null ? service.wednesday_blocked : "").split(',');} break;
      case 4 : { blockedTimes = (service.thursday_blocked !== null ? service.thursday_blocked : "").split(',');} break;
      case 5 : { blockedTimes = (service.friday_blocked !== null ? service.friday_blocked : "").split(',');} break;
      case 6 : { blockedTimes = (service.saturday_blocked !== null ? service.saturday_blocked : "").split(',');} break; // Saturday
    }
    if(blockedTimes.length < 2) { return true; }
    var evaluationTime = moment(time).add(1,"minute");
    var dayStart = moment(evaluationTime).hour(0).minute(0).second(0).millisecond(0);
    var dayMinutePosition = evaluationTime.diff(dayStart, "minutes");
    var topIndex = blockedTimes.reduce(function (prevIndex, blockTransition, index, sourceArray) {
      var transition = parseInt(blockTransition, 10);
      if(dayMinutePosition > transition) { return index; }
      return prevIndex;
    }, null);
    if(topIndex % 2 == 1) { return true; }
    return false;
  };

  EventSupport.getServiceDayTransitions = function (date, service) {
    var start = moment(date).hour(0).minute(0).second(0).millisecond(0);
    var weekDay = start.day();
    var blockedTimes = [];
    switch(weekDay) {
      case 0 : { blockedTimes = (service.sunday_blocked !== null ? service.sunday_blocked : "").split(',');} break; // Sunday
      case 1 : { blockedTimes = (service.monday_blocked !== null ? service.monday_blocked : "").split(',');} break;
      case 2 : { blockedTimes = (service.tuesday_blocked !== null ? service.tuesday_blocked : "").split(',');} break;
      case 3 : { blockedTimes = (service.wednesday_blocked !== null ? service.wednesday_blocked : "").split(',');} break;
      case 4 : { blockedTimes = (service.thursday_blocked !== null ? service.thursday_blocked : "").split(',');} break;
      case 5 : { blockedTimes = (service.friday_blocked !== null ? service.friday_blocked : "").split(',');} break;
      case 6 : { blockedTimes = (service.saturday_blocked !== null ? service.saturday_blocked : "").split(',');} break; // Saturday
    }
    return blockedTimes.map(function (block) {
      var blockPoint = parseInt(block, 10);
      return moment(start).add(blockPoint, 'minutes');
    });
  };

  EventSupport.getEventDates = function (event) {
    var eventDates = [moment(event.start_date)];
    var currentDate = moment(event.start_date).add(1, 'days');
    while(currentDate.isBefore(moment(event.end_date))) {
      eventDates.push(moment(currentDate));
      currentDate.add(1, "days");
    }
    if(!moment(event.start_date).isSame(moment(event.end_date),"day")) {
      eventDates.push(moment(event.end_date));
    }
    return eventDates;

  }

  EventSupport.getPossibleTransitions = function (event, service) {
    var eventDates = EventSupport.getEventDates(event);
    var eventTransitions = eventDates.reduce(function (prevArray, date, index) {
      var dayTransitions = EventSupport.getServiceDayTransitions(date,service);
      return prevArray.concat(dayTransitions);
    }, []);
    eventTransitions.push(moment(event.end_date).hour(24).minute(0).second(0).millisecond(0));
    //Stitch Abutting transitions (Dedup)
    eventTransitions = eventTransitions.reduce(function (prevArray, event, index, sourceArray) {
      if(index <= 0) { prevArray.push(event); return prevArray; }
      if(index >= sourceArray.length - 1) { prevArray.push(event); return prevArray; }
      var prev = moment(sourceArray[index-1]);
      var next = moment(sourceArray[index+1]);
      var current = moment(event);
      var include = true;
      if(prev.isSame(current)) { include = false; }
      if(next.isSame(current)) { include = false; }
      if(include) { prevArray.push(event); }
      return prevArray;
    }, []).sort(function (a, b) {
      return a.diff(b, "minutes");
    });
    return eventTransitions;
  };

  EventSupport.getDurations = function (event, service) {
    var transitions = EventSupport.getPossibleTransitions(event, service);
    var startDate = moment(event.start_date);
    var endDate = moment(event.end_date);
    var mode = null;
    var startIndex = transitions.reduce(function (prevIndex, transition, index, sourceArray) {
      if(moment(startDate).add(1, "minute").isBetween(moment(transition), sourceArray[index+1])) { return index+1;}
      return prevIndex;
    }, 0);
    var endIndex = transitions.reduce(function (prevIndex, transition, index, sourceArray) {
      if(moment(endDate).add(1, "minute").isBetween(moment(transition), sourceArray[index+1])) { return index+1;}
      return prevIndex;
    }, transitions.length-1);
    var durationTimes = [startDate];
    durationTimes = durationTimes.concat(transitions.slice(startIndex, endIndex));
    durationTimes.push(endDate);
    durationTimes.sort(function (a, b) {
      return a.diff(b, "minutes");
    });
    var durations = durationTimes.reduce(function (array, time, index, sourceArray) {
      if(index >= sourceArray.length-1) { return array; }
      var start = time;
      var end = sourceArray[index + 1];
      array.push({ duration : end.diff(start, "minutes"), start : start.format('YYYY-MM-DD HH:mm:ss'), end : end.format('YYYY-MM-DD HH:mm:ss'), isOnHours : EventSupport.isDuringOnHours(start, service)});
      return array;
    }, []);
    var duration = durations.reduce(function (prevValue, item) {
      if(item.duration < 0) { console.log("Negative Duration", item); }
      prevValue.total += (item.duration/60);
      if(item.isOnHours) {
        prevValue.on += (item.duration/60);
      } else {
        prevValue.off += (item.duration/60);
      }
      return prevValue;
    }, {
      total : 0,
      on : 0,
      off : 0
    });

    return duration;
  };


  module.exports = EventSupport;
})();
