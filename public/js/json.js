 var reg = /^(?:\s*"([^"]*)"[^\n]*|.*)$/gm;


function isSpecificValue(val) {
  return (
    val instanceof Buffer
    || val instanceof Date
    || val instanceof RegExp
  ) ? true : false;
}

function cloneSpecificValue(val) {
  if (val instanceof Buffer) {
    var x = new Buffer(val.length);
    val.copy(x);
    return x;
  } else if (val instanceof Date) {
    return new Date(val.getTime());
  } else if (val instanceof RegExp) {
    return new RegExp(val);
  } else {
    throw new Error('Unexpected situation');
  }
}

/**
 * Recursive cloning array.
 */
function deepCloneArray(arr) {
  var clone = [];
  arr.forEach(function (item, index) {
    if (typeof item === 'object' && item !== null) {
      if (Array.isArray(item)) {
        clone[index] = deepCloneArray(item);
      } else if (isSpecificValue(item)) {
        clone[index] = cloneSpecificValue(item);
      } else {
        clone[index] = deepExtend({}, item);
      }
    } else {
      clone[index] = item;
    }
  });
  return clone;
}

/**
 * Extening object that entered in first argument.
 *
 * Returns extended object or false if have no target object or incorrect type.
 *
 * If you wish to clone source object (without modify it), just use empty new
 * object as first argument, like this:
 *   deepExtend({}, yourObj_1, [yourObj_N]);
 */
var deepExtend = function (/*obj_1, [obj_2], [obj_N]*/) {
  if (arguments.length < 1 || typeof arguments[0] !== 'object') {
    return false;
  }

  if (arguments.length < 2) {
    return arguments[0];
  }

  var target = arguments[0];

  // convert arguments to array and cut off target object
  var args = Array.prototype.slice.call(arguments, 1);

  var val, src, clone;

  args.forEach(function (obj) {
    // skip argument if isn't an object, is null, or is an array
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return;
    }

    Object.keys(obj).forEach(function (key) {
      src = target[key]; // source value
      val = obj[key]; // new value

      // recursion prevention
      if (val === target) {
        return;

      /**
       * if new value isn't object then just overwrite by new value
       * instead of extending.
       */
      } else if (typeof val !== 'object' || val === null) {
        target[key] = val;
        return;

      // just clone arrays (and recursive clone objects inside)
      } else if (Array.isArray(val)) {
        target[key] = deepCloneArray(val);
        return;

      // custom cloning and overwrite for specific objects
      } else if (isSpecificValue(val)) {
        target[key] = cloneSpecificValue(val);
        return;

      // overwrite by new value if source isn't object or array
      } else if (typeof src !== 'object' || src === null || Array.isArray(src)) {
        target[key] = deepExtend({}, val);
        return;

      // source value and new value is objects both, extending...
      } else {
        target[key] = deepExtend(src, val);
        return;
      }
    });
  });

  return target;
}


  function extend(obj, src) {
      Object.keys(src).forEach(function(key) { obj[key] = src[key]; });
      return obj;
      //return deepExtend(obj, src);
  }

  function sort(src) {
      var obj = {};
      Object.keys(src).sort().forEach(function(key) { obj[key] = src[key]; });
      return obj;
  }

  function extendPreferObject(obj, src) {
      Object.keys(src).forEach(function(key) { 
        if (!isObject(src[key]) && isObject(obj[key])) {
          //If we're about to replace an object with a string, don't do it
        } else {
          obj[key] = src[key];
        }
      });
      return obj;
  }

  function isArray(a) {
      return (!!a) && (a.constructor === Array);
  };
  function isObject(a) {
      return (!!a) && (a.constructor === Object);
  };

  function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }

    return array;
  }

  function getNodeCount(jsonObj, stack) {
    if (!stack) stack = [];
    var propertyList = {};
    var path = stack.join(".");

    //console.log(path);

    if (isArray(jsonObj)) {
      //console.log(jsonObj + ' = ARRAY');
      for (var i = 0; i < jsonObj.length && i < 10; ++i) { //only analyse the first 50 records
        console.log("Array investigation: " + i + " of " + jsonObj.length);
        var pathStack = [].concat(stack); //Note schema.org allows any array to be a singular object
        propertyList = extend(propertyList,getNodeCount(jsonObj[i], pathStack));
      }

    } else if (isObject(jsonObj)) {
      //console.log(jsonObj + ' = OBJS');

      Object.keys(jsonObj).forEach(function(property) { 
          var pathStack = [].concat(stack,[property]);
          propertyList = extend(propertyList,getNodeCount(jsonObj[property], pathStack));
      });
      
    } else {
      //If value, assign
      propertyList[path] = jsonObj;
    }
    return propertyList;
  }

  function jsonFromPropertyList(propertyList) {
    var jsonObj = {};
    Object.keys(propertyList).forEach(function(key) { 
      var path = key;
      var exampleValue = propertyList[key];

      //console.log('PATH: ' + path);
      var stack = path.split(".");

      buildObject(jsonObj, stack, exampleValue);
    });
    return jsonObj;
  }

  function buildObject(obj, stack, exampleValue, remove) {
    // Follow stack and set exampleValue within nested objects,
    // creating objects if they don't exist on the way

    if (stack.length == 0) {
      return exampleValue;
    } else {
      var property = stack.shift();

      //If this is the last property in the path, remove it
      if (remove && stack.length == 0) {
         delete obj[property];
         return obj;

      } else {

        //Special case for items in RPDE, so as not to confuse readers (as it must be an array)
        if (property == "items") {
          if (!obj) obj = {};
          if (!obj[property]) obj[property] = [ {} ];
          var val = buildObject(obj[property][0], stack, exampleValue);
          if (val != null) obj[property][0] = val;
          return obj;
        } else {
          if (!obj || !isObject(obj)) obj = {};
          var val = buildObject(obj[property], stack, exampleValue);
          if (val == null) {
            delete obj[property];
          } else {
            obj[property] = val;
          }
          return obj;
        }

      }
    }
  }

  function addToPropertyCount(propertyList, propertyListCount) {
    Object.keys(propertyList).forEach(function(property) { 
      propertyListCount[property] = !(property in propertyListCount) ? 1 : propertyListCount[property] + 1;
    });
  }

  function removePropertyFromJson(path, obj) {
    //console.log('PATH: ' + path);
    var stack = path.split(".");

    return buildObject(obj, stack, null, true);
  }

  function insertValueIntoJson(path, obj, value) {
    //console.log('PATH: ' + path);
    var stack = path.split(".");

    return buildObject(obj, stack, value);
  }

  function annotate(jsonExample, propertyListCount, aggregate) {
    var myJSON = JSON.stringify(jsonExample, null, 2);

    //Annotate JSON
    //myJSON = myJSON.replace(',\n',', // count\n');

    var result;
    var newString = "";

    var stack = [];

    while((result = reg.exec(myJSON)) && result != 0) {
      var line = result[0];
      var property = result[1];
      var path = [].concat(stack,[property]).join('.'); //Calculate path before push/pop

      var whatWeKnow = "";

      if (line.match(/(?:$\s*[\{\[]|[\{\[]$)/)) {
        whatWeKnow += " contains '{'; ";
        if (property) stack.push(property);
      }
      if (line.match(/^\s*\}/)) {
        whatWeKnow += " contains '}'; ";
        stack.pop();
      }
      if (property) {
        whatWeKnow += " contains 'prop'; ";
      }

      //console.log("Regex match for: " + result[1]);
      if (result[1] && propertyListCount[path]) {
        newString += result[0] + " // " + (aggregate ? "endpoint" : "item") + " count: " + propertyListCount[path] + "\n"; //+ " // " + whatWeKnow + " at " + path + "\n";
      } else {
        newString += result[0] + "\n"; //+" // not special; " + whatWeKnow + "\n";
      }

    }
    return newString;
  }