var express = require('express');
var request = require('request');
var apicache = require('apicache');
var deepExtend = require('deep-extend');

var app = express();
var cache = apicache.middleware;


//Note much of this code is unused and duplicated from the client side - needs cleaning up


app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));

app.get('/api', cache('30 minutes'), function(request, response, cb) {

  loadJSON(request.query.url, function (example) {
    console.log("COUNT: " + !!request.query.count);
    response.send(calculatePropertyUsage(example, !!request.query.count));
    cb();
  }, function(err) {
    response.status(500).send({ error: err })
    cb();
  });
});

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
});






function loadJSON(url, resolve, reject) {
  request.get({
    url: url,
    json: true,
    headers: {'User-Agent': 'request'}
  }, (err, res, data) => {
    if (err) {
      console.log('Error (' + url + '):', err);
      reject(err.message);
    } else if (res.statusCode !== 200) {
      console.log('Status (' + url + '):', res.statusCode);
      reject('Status (' + url + '):' + res.statusCode);
    } else {
      // data is already parsed as JSON:
      resolve(data)
    }
  });
}

function gitHubGetForks(resolve, reject) {
  var url = 'https://api.github.com/repos/openactive/dataset-site-generator/forks?sort=stargazers';
  loadJSON(url, function (jsonBody) {
      resolve(jsonBody);
  }, reject);
}

var reg = /^(?:\s*"([^"]*)"[^\n]*|.*)$/gm;



function extend(obj, src, countMode) {
  if (countMode) {
    Object.keys(src).forEach(function(key) { obj[key] = obj[key] ? obj[key] + src[key] : src[key]; });
  } else {
    //obj = deepExtend(obj, src);
    Object.keys(src).forEach(function(key) { obj[key] = src[key]; });
  }
  return obj;
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

function getNodeCount(jsonObj, stack, countMode) {
  if (!stack) stack = [];
  var propertyList = {};
  var path = stack.join(".");

  //console.log(path);

  if (isArray(jsonObj)) {
    //console.log(jsonObj + ' = ARRAY');
    for (var i = 0; i < jsonObj.length ; ++i) { //only analyse the first 50 records
      //console.log("Array investigation: " + i + " of " + jsonObj.length);
      var pathStack = [].concat(stack); //Note schema.org allows any array to be a singular object
      propertyList = extend(propertyList,getNodeCount(jsonObj[i], pathStack, countMode), countMode);
    }

  } else if (isObject(jsonObj)) {
    //console.log(jsonObj + ' = OBJS');

    Object.keys(jsonObj).forEach(function(property) { 
        var pathStack = [].concat(stack,[property]);
        propertyList = extend(propertyList,getNodeCount(jsonObj[property], pathStack, countMode), countMode);
    });
    
  } else {
    //If value, assign
    if (countMode) {
      propertyList[path] = !propertyList[path] ? 1 : propertyList[path] + 1;
    } else {
      propertyList[path] = jsonObj;
    }
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

function buildObject(obj, stack, exampleValue) {
// Follow stack and set exampleValue within nested objects,
// creating objects if they don't exist on the way

if (stack.length == 0) {
  return exampleValue;
} else {
  var property = stack.shift();

  //Special case for items in RPDE, so as not to confuse readers (as it must be an array)
  if (property == "items") {
    if (!obj) obj = {};
    if (!obj[property]) obj[property] = [ {} ];
    obj[property][0] = buildObject(obj[property][0], stack, exampleValue);
    return obj;
  } else {
    if (!obj || !isObject(obj)) obj = {};
    obj[property] = buildObject(obj[property], stack, exampleValue);
    return obj;
  }
}
}

function addToPropertyCount(propertyList, propertyListCount) {
Object.keys(propertyList).forEach(function(property) { 
  propertyListCount[property] = !propertyListCount[property] ? 1 : propertyListCount[property] + 1;
});
}

function calculatePropertyUsage(example, countMode) {

  console.log("Got example: " + example.next);

  var propertyList = getNodeCount(example, null, countMode);

  //console.log("Analysing: " + example.next);

  return propertyList;

/*
  if (!propertyList["items.data.@context"] && !propertyList["items.@context"]) {
    //Temporarily only analyse implementors of modelling spec
    console.log("Ignoring: " + example.next);
    return null;
  } else {
    return propertyList;
  }
*/
  //console.log("Analysis complete: " + example.next);
}

function sumPropertyUsage(propertyLists, cb) {
  //var jsonExample = jsonFromPropertyList(propertyList);

  var propertyListCount = {};
  var propertyExample = {};

  for (var i = 0; i < propertyLists.length; ++i) { 
    // Add these values to the count
    addToPropertyCount(propertyLists[i], propertyListCount);

    // Add values to example
    propertyExample = sort(extend(propertyExample, propertyLists[i]));

    console.log("sumPropertyUsage: Analysis added to total: " + propertyLists[i].next);
  }

  jsonExample = jsonFromPropertyList(propertyExample);
  //merge nodeCount with current count
  //report[text] = {"test": 1, "text2":"test3"};

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
        newString += result[0] + " // count: " + propertyListCount[path] + "\n"; //+ " // " + whatWeKnow + " at " + path + "\n";
      } else {
        newString += result[0] + "\n"; //+" // not special; " + whatWeKnow + "\n";
      }
  }

  cb(newString);

}

/*
function loadExamples(resolve, reject) {
  //Reset state to allow for multiple runs

  gitHubGetForks(function (body) {
    //Randomise order of results
    body = shuffle(body);

    var endpointPromises = [];

    for(var i = 0; i < body.length; i++) {
      console.log("Found: " + body[i].full_name );
      if (body[i].stargazers_count >= 1) {

        endpointPromises.push(new Promise((resolve, reject) => {
          Promise.all()

          loadJSON("https://raw.githubusercontent.com/" + body[i].full_name + "/master/metadata.json", function (metadata) {
          //Only continue if load successful, ignore failure
          console.log("Metadata for: " + metadata["dataset-site-url"] + " (Publish: " + metadata["publish"] + ")");
          if (metadata["publish"]) {
              var examples = metadata["data-url"];
              if (examples) {
                //for (i = 0; i < examples.length; ++i) {
                  loadJSON(examples, function (example) {
                    calculatePropertyUsage(example, resolve, reject);
                  }, reject);
                //}
              }
            }
          }, reject);

        }).catch(reason => { 
          console.log("Error retrieving endpoint: " +  body[i].full_name);
        }));
      }
    }
    Promise.all(endpointPromises).then(values => { 

      sumPropertyUsage(values, resolve);
    }).catch(reason => { 
      console.log("Promise did not resolve: " +  reason);
    });
  }); 
}  
*/