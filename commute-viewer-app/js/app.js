"use strict"; // determine if a theme 'dark' or 'light' has been
// specified in the URL query string

var _noUiSlider$create, _noUiSlider$create2;

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var THEME = getThemeFromURL();
var THEMES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
}; // the layers the deck will include

var LAYER_LIST = {}; // their visibility - useful for update triggering though...
// not really used now there's no change in layers with zoom

var LAYER_VISIBILITY = {
  "od_sa2": true,
  // the OD links
  "census": true,
  // the census areas
  "names": false // experimental

}; // flags for the mode, purpose and direction filters

var INCLUDE_MODE = {
  "cr": true,
  "pt": true,
  "ac": true
};
var INCLUDE_PURP = {
  "w": true,
  "e": true
};
var INCLUDE_DIR = {
  "in": true,
  "out": true
}; // the resulting list of variable names to include in calculating trip totals

var TRIP_TOTAL_COLUMNS = {}; // variables that filter the trips to show

var MIN_DIST = 0;
var MAX_DIST = 60;
var MIN_VOL = 15;
var MAX_VOL = 2526;
var SEL_AREA = null; // objects to store currently selected tour/help elements

var TOUR_STOP_OPEN = {
  arrow: null,
  panel: null
};
var INFO_PANEL_OPEN = {
  arrow: "unfurl-what-is-this-arrow",
  panel: "what-is-this"
}; // a not very clever attempt to use the viewport dimensions
// to initialise the view orienting the map either NS or EW

var START_VIEW = {
  latitude: -42,
  longitude: 171.5,
  zoom: 5,
  maxZoom: 20,
  pitch: 35,
  bearing: document.documentElement.clientWidth > document.documentElement.clientHeight ? 330 : 0,
  pickingRadius: 3,
  transitionDuration: 3000
}; // initialise the deck

var MY_DECKGL = new deck.DeckGL({
  mapStyle: THEMES[THEME],
  initialViewState: START_VIEW,
  controller: true,
  useDevicePixels: false,
  onViewStateChange: function onViewStateChange(_ref) {
    var viewState = _ref.viewState;
    render();
  }
}); // retrieve the theme 'dark' or 'light' from the URL
// query string - defaults to 'light'

function getThemeFromURL() {
  var thisURL = window.location.href;

  if (thisURL.includes("?")) {
    return thisURL.split("?").slice(-1)[0].split("=").slice(-1)[0];
  }

  return "light";
} // Not very smart... just reload the page with theme in the query string


function switchTheme() {
  THEME = THEME == "dark" ? "light" : "dark";
  window.location = window.location.href.split("?")[0] + "?theme=".concat(THEME);
}

initialiseUI();
TRIP_TOTAL_COLUMNS = getTripTotalColumns(INCLUDE_PURP, INCLUDE_MODE); // fire up the loading spinner

document.getElementById("loaderDiv").style.display = "block"; // get the data

var DATA = {};
var CENTROIDS = [];
var PLACENAMES = [];
$.when( // the OD links with associated volumes
$.get("./data/od.csv", function (data) {
  DATA.od_sa2 = Papa.parse(data, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: "greedy"
  }).data;
  console.log(DATA.od_sa2);
}, "text"), // the origin and destination names and coordinates
$.get("./data/centroids.csv", function (data) {
  CENTROIDS = Papa.parse(data, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: "greedy"
  }).data;
  console.log(CENTROIDS);
}, "text"), // the census areas
$.getJSON("./data/census-flows-sa2.json", function (data) {
  DATA.census = data.features;
  console.log(DATA.census);
})).done(function () {
  appendNameXYtoODEdge(); // add the names and coordinates to the OD

  PLACENAMES = CENTROIDS.map(function (x) {
    return x.n;
  });
  render();
  clearLoader(); // clear the spinner
}); // retrieve the name and xy coords of edges from the centroids
// array and append to the DATA.od_sa2 object
// this has been done to reduce the data load time for the
// edges data (otherwise from and to names, lon, lat are
// repeated many times in the OD dataset)

function appendNameXYtoODEdge() {
  for (var i = 0; i < DATA.od_sa2.length; i++) {
    var obj = DATA.od_sa2[i];
    obj.fnm = CENTROIDS[obj.fid].n;
    obj.tnm = CENTROIDS[obj.tid].n;
    obj.fx = CENTROIDS[obj.fid].x;
    obj.fy = CENTROIDS[obj.fid].y;
    obj.tx = CENTROIDS[obj.tid].x;
    obj.ty = CENTROIDS[obj.tid].y;
  }
}

var myAutoComplete = new autoComplete({
  selector: "input[name='placename']",
  minChars: 2,
  source: function source(term, suggest) {
    term = term.toLowerCase();
    var matches = [];

    for (var i = 0; i < PLACENAMES.length; i++) {
      if (PLACENAMES[i].toLowerCase().indexOf(term) != -1) {
        matches.push(PLACENAMES[i]);
      }
    }

    suggest(matches);
  }
}); // shut down the loading spinner

function clearLoader() {
  document.getElementById("loaderDiv").style.display = "none";
} // this is the core deck functionality


function render() {
  var _deck$ArcLayer, _deck$TextLayer;

  LAYER_LIST.census = new deck.GeoJsonLayer({
    id: "polygon-layer",
    data: DATA.census,
    getPolygon: function getPolygon(x) {
      return x.geometry;
    },
    stroked: true,
    getLineColor: [102, 102, 102, 102],
    getLineWidth: 1,
    lineWidthUnits: "pixels",
    getFillColor: function getFillColor(d) {
      return d.properties.nm == SEL_AREA ? mixColours([0, 102, 255, getLocalShares(d).work * 64], [0, 204, 102, getLocalShares(d).study * 128]) : [0, 0, 0, 0];
    },
    // opacity: 0.5,
    autoHighlight: true,
    pickable: true,
    highlightColor: function highlightColor(d) {
      return [102, 102, 153, 192];
    },
    onHover: function onHover(info) {
      return setAreaTooltip(info.object, info.x, info.y);
    },
    onClick: function onClick(info) {
      return selectArea(info.object);
    },
    visible: LAYER_VISIBILITY.census,
    updateTriggers: {
      getFillColor: SEL_AREA
    }
  });
  LAYER_LIST.od_sa2 = new deck.ArcLayer((_deck$ArcLayer = {
    id: "od-arc-layer",
    data: DATA.od_sa2,
    pickable: true,
    getSourcePosition: function getSourcePosition(d) {
      return [d.fx, d.fy];
    },
    getTargetPosition: function getTargetPosition(d) {
      return [d.tx, d.ty];
    },
    getSourceColor: function getSourceColor(d) {
      return mixColours([0, 102, 255, getTripTotals(d, TRIP_TOTAL_COLUMNS).work], [0, 204, 102, getTripTotals(d, TRIP_TOTAL_COLUMNS).education]);
    },
    getTargetColor: function getTargetColor(d) {
      return mixColours([204, 0, 102, getTripTotals(d, TRIP_TOTAL_COLUMNS).work], [255, 102, 0, getTripTotals(d, TRIP_TOTAL_COLUMNS).education]);
    },
    getTilt: 10,
    getWidth: function getWidth(d) {
      return getRibbonWidth(d);
    },
    widthScale: 20,
    widthMaxPixels: 100,
    widthUnits: "meters",
    autoHighlight: true
  }, _defineProperty(_deck$ArcLayer, "pickable", true), _defineProperty(_deck$ArcLayer, "highlightColor", function highlightColor(d) {
    return [102, 102, 153, 192];
  }), _defineProperty(_deck$ArcLayer, "onHover", function onHover(info) {
    return setODTooltip(info.object, info.x, info.y);
  }), _defineProperty(_deck$ArcLayer, "visible", LAYER_VISIBILITY.od_sa2), _defineProperty(_deck$ArcLayer, "updateTriggers", {
    getSourceColor: [TRIP_TOTAL_COLUMNS, SEL_AREA],
    getTargetColor: [TRIP_TOTAL_COLUMNS, SEL_AREA],
    getWidth: [TRIP_TOTAL_COLUMNS, SEL_AREA, MIN_DIST, MAX_DIST, MIN_VOL, MAX_VOL]
  }), _deck$ArcLayer));
  LAYER_LIST.names = new deck.TextLayer((_deck$TextLayer = {
    id: "od-text-layer",
    data: CENTROIDS,
    pickable: false,
    fontFamily: "serif",
    characterSet: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZāēīōūĀĒŌĪŪ-(), ",
    backgroundColor: [0, 51, 0],
    getPosition: function getPosition(d) {
      return [d.x, d.y];
    },
    getText: function getText(d) {
      return d.n;
    },
    lineHeight: 3,
    getSize: 250,
    getColor: function getColor(d) {
      return THEME == "dark" ? [255, 255, 255] : [0, 0, 0];
    },
    sizeUnits: "meters",
    autoHighlight: false
  }, _defineProperty(_deck$TextLayer, "pickable", false), _defineProperty(_deck$TextLayer, "visible", LAYER_VISIBILITY.names), _defineProperty(_deck$TextLayer, "opacity", 0.6), _defineProperty(_deck$TextLayer, "updateTriggers", {}), _deck$TextLayer));
  MY_DECKGL.setProps({
    layers: Object.values(LAYER_LIST),
    mapStyle: THEMES[THEME]
  });
}

;

function getRibbonWidth(obj) {
  var t = getTripTotals(obj, TRIP_TOTAL_COLUMNS).total;
  return obj.d >= MIN_DIST && obj.d <= MAX_DIST && t >= MIN_VOL && t <= MAX_VOL && (SEL_AREA == null || SEL_AREA == obj.fnm && INCLUDE_DIR.out || SEL_AREA == obj.tnm && INCLUDE_DIR.in) ? t : 0;
} // Area layer tooltip


function setAreaTooltip(object, x, y) {
  var el = document.getElementById("tooltip");

  if (object) {
    el.innerHTML = object.properties.nm;
    el.style.display = "block";
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.visibility = "visible";
  } else {
    el.style.display = "none";
  }
} // OD trip layer tooltip


function setODTooltip(object, x, y) {
  var el = document.getElementById("tooltip");

  if (object) {
    var od = getTripTotals(object, TRIP_TOTAL_COLUMNS);
    var heading = "".concat(object.fnm, " to ").concat(object.tnm);
    el.innerHTML = SEL_AREA == null ? "".concat(heading, ": ").concat(od.total) : "".concat(heading, "<br>").concat(getODlinkDetailsTable(object));
    el.style.display = "block";
    el.style.left = "".concat(x, "px");
    el.style.top = "".concat(y, "px");
    el.style.visibility = "visible";
  } else {
    el.style.display = "none";
  }
}

function getODlinkDetailsTable(o) {
  return "<table>\n  <tr>\n  <td>&nbsp;</td>\n  <td>Car</td>\n  <td>Transit</td>\n  <td>Active</td>\n  <td>Total</td>\n  </tr>\n  <tr>\n  <td>Work</td>\n  <td>".concat(o.wcr, "</td>\n  <td>").concat(o.wpt, "</td>\n  <td>").concat(o.wac, "</td>\n  <td>").concat(o.wtot, "</td>\n  </tr>\n  <tr>\n  <td>Study</td>\n  <td>").concat(o.ecr, "</td>\n  <td>").concat(o.ept, "</td>\n  <td>").concat(o.eac, "</td>\n  <td>").concat(o.etot, "</td>\n  </tr>\n  </table>");
}

function getLocalShares(obj) {
  var w = obj.properties.lwhome;
  var e = obj.properties.lehome;
  var t = e + w;
  return {
    work: w / t,
    study: e / t
  };
} // Put all the column designations in the total columns
// purposes are 'w', 'e'
// modes are 'cr', 'pt', 'ac'


function getTripTotalColumns(includePurp, includeMode) {
  var ttc = {}; // if a purpose or mode should be included then the
  // purpose/mode keyed entry in the corresponding object
  // will be true

  for (var _i = 0, _Object$entries = Object.entries(includePurp); _i < _Object$entries.length; _i++) {
    var _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
        p = _Object$entries$_i[0],
        incP = _Object$entries$_i[1];

    for (var _i2 = 0, _Object$entries2 = Object.entries(includeMode); _i2 < _Object$entries2.length; _i2++) {
      var _Object$entries2$_i = _slicedToArray(_Object$entries2[_i2], 2),
          m = _Object$entries2$_i[0],
          incM = _Object$entries2$_i[1];

      ttc[p + m] = incP && incM;
    }
  }

  return ttc;
} // Calculate trip totals based on the true items in the
// supplied columns Object
// Each item key is a variable name from the trips
// datasets, and will add that into the total.
// It's messy. Variable names have initial character 'w' or 'e'
// for work or education, and the remaining characters 'cr', 'pt'
// or 'ac' for cars / transit / active mode, BUT if all modes are
// selected then summing the subtotals is replaced by
// using the wtot or etot column in the data because
// data suppression means the subtotals don't sum correctly...


function getTripTotals(object, columns) {
  var total = 0;
  var edTotal = 0;
  var wkTotal = 0; // this checks if all three subtotals have been selected
  // and then bases total on the stats reported totals
  // not the sums of the subtotals (which do not reliably add up!)

  if (sumArray(Object.values(columns)) % 3 == 0) {
    if (columns.wcr) {
      if (columns.ecr) {
        // all 6 are present
        wkTotal = object.wtot;
        edTotal = object.etot;
        total = wkTotal + edTotal;
      } else {
        // only work trips
        total = object.wtot;
        wkTotal = object.wtot;
      }
    } else if (columns.ecr) {
      // only education trips
      total = object.etot;
      edTotal = object.etot;
    }
  } else {
    // just add up the included columns
    for (var _i3 = 0, _Object$entries3 = Object.entries(columns); _i3 < _Object$entries3.length; _i3++) {
      var _Object$entries3$_i = _slicedToArray(_Object$entries3[_i3], 2),
          key = _Object$entries3$_i[0],
          val = _Object$entries3$_i[1];

      if (val) {
        var trips = object[key];
        total += trips;

        if (key[0] == "w") {
          wkTotal += trips;
        } else {
          edTotal += trips;
        }
      }
    }
  } // these are 0-255 alpha values based on proportion
  // education are in brighter colours (GnY) so higher alpha


  var wkAlpha = wkTotal == 0 ? wkTotal : wkTotal / total * 96;
  var edAlpha = edTotal == 0 ? edTotal : edTotal / total * 128;
  return {
    "total": total,
    "work": wkAlpha,
    "education": edAlpha
  };
}

function sumArray(x) {
  return x.reduce(function (i, j) {
    return i + j;
  });
} // Trip counts slider control


var TRIPS_SLIDER = document.getElementById("trips-range");
noUiSlider.create(TRIPS_SLIDER, (_noUiSlider$create = {
  start: [MIN_VOL, MAX_VOL],
  connect: true,
  range: {
    "min": [0],
    "30%": [99],
    "60%": [300],
    "90%": [900],
    "max": [2526]
  },
  step: 3,
  margin: 3,
  limit: 2526
}, _defineProperty(_noUiSlider$create, "connect", true), _defineProperty(_noUiSlider$create, "direction", "rtl"), _defineProperty(_noUiSlider$create, "orientation", "vertical"), _defineProperty(_noUiSlider$create, "behaviour", "tap-drag"), _defineProperty(_noUiSlider$create, "tooltips", true), _defineProperty(_noUiSlider$create, "format", {
  // "to" the formatted value. Receives a number.
  to: function to(value) {
    return Math.round(value) + "";
  },
  // 'from' the formatted value.
  // Receives a string, should return a number.
  from: function from(value) {
    return Math.round(Number(value));
  }
}), _noUiSlider$create));

function setVolumeRange(values, handle, unencoded, tap, positions, noUiSlider) {
  MIN_VOL = Math.round(Number(values[0]));
  MAX_VOL = Math.round(Number(values[1]));
  render();
} // Binding signature


TRIPS_SLIDER.noUiSlider.on("slide", setVolumeRange); // Trip counts slider control

var DIST_SLIDER = document.getElementById("distance-range");
noUiSlider.create(DIST_SLIDER, (_noUiSlider$create2 = {
  start: [MIN_DIST, MAX_DIST],
  connect: true,
  range: {
    "min": [0],
    "30%": [50],
    "60%": [150],
    "90%": [450],
    "max": [1312]
  },
  step: 1,
  margin: 1,
  limit: 1312
}, _defineProperty(_noUiSlider$create2, "connect", true), _defineProperty(_noUiSlider$create2, "direction", "rtl"), _defineProperty(_noUiSlider$create2, "orientation", "vertical"), _defineProperty(_noUiSlider$create2, "behaviour", "tap-drag"), _defineProperty(_noUiSlider$create2, "tooltips", true), _defineProperty(_noUiSlider$create2, "format", {
  // "to" the formatted value. Receives a number.
  to: function to(value) {
    return Math.round(value) + "";
  },
  // "from" the formatted value.
  // Receives a string, should return a number.
  from: function from(value) {
    return Math.round(Number(value));
  }
}), _noUiSlider$create2));

function setDistanceRange(values, handle, unencoded, tap, positions, noUiSlider) {
  MIN_DIST = Math.round(Number(values[0]));
  MAX_DIST = Math.round(Number(values[1]));
  render();
} // Binding signature


DIST_SLIDER.noUiSlider.on("slide", setDistanceRange);

function zoomTo() {
  var lonlat = getAreaCentroid(SEL_AREA);

  if (lonlat != null) {
    MY_DECKGL.viewState = {
      longitude: lonlat.lon,
      latitude: lonlat.lat,
      zoom: 10,
      pitch: 55,
      bearing: Math.random(320) * 360,
      transitionDuration: 3000
    };
    render();
  }
}

function getAreaCentroid(name) {
  for (var i = 0; i < CENTROIDS.length; i++) {
    var obj = CENTROIDS[i];

    if (obj.n == name) {
      return {
        lon: obj.x,
        lat: obj.y
      };
    }
  }

  return null;
} // mostly UI stuff
// Initialise some HTML UI checkbox elements to match code state


function initialiseUI() {
  initialisePurposeCheckboxes();
  initialiseModeCheckboxes();
  initialiseDirectionCheckboxes();
} // set the work / study checkboxes


function initialisePurposeCheckboxes() {
  for (var key in INCLUDE_PURP) {
    document.getElementById("check-".concat(key)).checked = INCLUDE_PURP[key];
  }
} // set the car/transit/active checkboxes


function initialiseModeCheckboxes() {
  for (var key in INCLUDE_MODE) {
    document.getElementById("check-".concat(key)).checked = INCLUDE_MODE[key];
  }
} // set the inbound/outbound checkboxes


function initialiseDirectionCheckboxes() {
  for (var key in INCLUDE_DIR) {
    document.getElementById("check-".concat(key)).checked = INCLUDE_DIR[key];
  }
} // Manage the state of the help, tour and filters panels
// only one can be open at a time so each on opening makes sure the other
// two are closed


var PANEL_DESIGNATIONS = ["help", "tour", "filters"];

function openPanel(name) {
  for (var i = 0; i < PANEL_DESIGNATIONS.length; i++) {
    var nm = PANEL_DESIGNATIONS[i]; // if it is this panel, open it

    if (nm == name) {
      document.getElementById("".concat(nm, "-panel")).style.display = "block"; // viusally attach the tab to the panel to give tabbed window
      // effect - note that the  colour and 2px have to change if the CSS
      // changes

      document.getElementById("".concat(nm, "-tab")).style["box-shadow"] = "0px 3px rgba(102, 102, 153, 0.75)";
    } else {
      // close it
      closePanel(nm);
    }
  }
}

function switchMenus() {
  var mc = document.getElementById("main-controls");
  mc.style.display = mc.style.display == "block" ? "none" : "block";
  var cs = document.getElementById("chart-container");
  cs.style.display = cs.style.display == "block" ? "none" : "block";
}

function closePanel(name) {
  // close the panel
  document.getElementById("".concat(name, "-panel")).style.display = "none"; // visually detach it from the tab

  var el = document.getElementById("".concat(name, "-tab"));
  el.style["box-shadow"] = "0px 0px rgba(0, 0, 0, 0)";
} // controls state of two connected UI items a panel
// and an up/down arrow head character, indexed by the
// provided arrow and id strings
// the state of these is stored in the infoPanelOpen object


function unfurlElement(arrow, id) {
  // get the clicked elements
  var clickedArrow = document.getElementById(arrow);
  var clickedPanel = document.getElementById(id); // if there is no currently open panel, then open the clicked one

  if (INFO_PANEL_OPEN.panel == null) {
    clickedArrow.innerHTML = "&#9651";
    clickedPanel.style.display = "block"; // store the fact of this one being open in the infoPanelOpen object

    INFO_PANEL_OPEN.panel = id;
    INFO_PANEL_OPEN.arrow = arrow;
  } else {
    // if the clicked panel is open close it
    if (id == INFO_PANEL_OPEN.panel) {
      clickedArrow.innerHTML = "&#9661";
      clickedPanel.style.display = "none"; // and remove it from the object

      INFO_PANEL_OPEN.panel = null;
      INFO_PANEL_OPEN.arrow = null;
    } else {
      // close the open panel and open the new one
      var _openPanel = document.getElementById(INFO_PANEL_OPEN.panel);

      var openArrow = document.getElementById(INFO_PANEL_OPEN.arrow);
      openArrow.innerHTML = "&#9661";
      _openPanel.style.display = "none";
      clickedArrow.innerHTML = "&#9651";
      clickedPanel.style.display = "block";
      INFO_PANEL_OPEN.panel = id;
      INFO_PANEL_OPEN.arrow = arrow;
    }
  }
} // Change the inclusion of specified trip purpose
// in the trip total calculations, recalc and render


function togglePurposesToInclude(id) {
  INCLUDE_PURP[id] = !INCLUDE_PURP[id];
  TRIP_TOTAL_COLUMNS = getTripTotalColumns(INCLUDE_PURP, INCLUDE_MODE);
  render();
} // Change the inclusion of specified trip mode
// in the trip total calculations, recalc and render


function toggleModesToInclude(id) {
  INCLUDE_MODE[id] = !INCLUDE_MODE[id];
  TRIP_TOTAL_COLUMNS = getTripTotalColumns(INCLUDE_PURP, INCLUDE_MODE);
  render();
}

function toggleDirectionToInclude(id) {
  INCLUDE_DIR[id] = !INCLUDE_DIR[id];
  TRIP_TOTAL_COLUMNS = getTripTotalColumns(INCLUDE_PURP, INCLUDE_MODE);
  render();
} // Area selection and chart plot


function getTripCounts(o, type) {
  return [o.properties["".concat(type, "cr")], o.properties["".concat(type, "pt")], o.properties["".concat(type, "ac")], 0];
}

function deselectArea(area) {
  if (area == SEL_AREA) {
    deselectAreaUIUpdates();
    SEL_AREA = null;
    render();
  }
}

function selectArea(object) {
  if (object && object.properties.nm != SEL_AREA) {
    var allData = {
      work: {
        out: multArray(getTripCounts(object, "ow"), -1),
        in: getTripCounts(object, "iw"),
        local: getTripCounts(object, "lw"),
        home: [0, 0, 0, object.properties.lwhome]
      },
      school: {
        out: multArray(getTripCounts(object, "oe"), -1),
        in: getTripCounts(object, "ie"),
        local: getTripCounts(object, "le"),
        home: [0, 0, 0, object.properties.lehome]
      }
    };
    var labels = ["Car", "Transit", "Active", "Home"];
    var data1 = [{
      x: labels,
      y: allData.work.out,
      name: "Outbound",
      type: "bar",
      marker: {
        color: "rgba(0, 102, 204, 0.38)"
      },
      hoverinfo: "y"
    }, {
      x: labels,
      y: allData.work.in,
      name: "Inbound",
      type: "bar",
      marker: {
        color: "rgba(204, 0, 153, 0.38)"
      },
      hoverinfo: "y"
    }, {
      x: labels,
      y: allData.work.local,
      name: "Local",
      type: "bar",
      marker: {
        color: "rgba(140, 70, 255, 0.62)"
      },
      hoverinfo: "y"
    }, {
      x: labels,
      y: allData.work.home,
      name: "At home",
      type: "bar",
      marker: {
        color: "rgba(0, 53, 255, 0.8)"
      },
      hoverinfo: "y"
    }];
    var data2 = [{
      x: labels,
      y: allData.school.out,
      name: "Outbound",
      type: "bar",
      marker: {
        color: "rgba(0, 204, 51, 0.5)"
      },
      hoverinfo: "y"
    }, {
      x: labels,
      y: allData.school.in,
      name: "Inbound",
      type: "bar",
      marker: {
        color: "rgba(255, 102, 0, 0.5)"
      },
      hoverinfo: "y"
    }, {
      x: labels,
      y: allData.school.local,
      name: "Local",
      type: "bar",
      marker: {
        color: "rgba(210, 210, 84, 0.75)"
      },
      hoverinfo: "y"
    }, {
      x: labels,
      y: allData.school.home,
      name: "At home",
      type: "bar",
      marker: {
        color: "rgba(0, 255, 53, 0.8)"
      },
      hoverinfo: "y"
    }];
    var layout = {
      width: 312,
      height: 220,
      margin: {
        l: 30,
        r: 30,
        t: 40,
        b: 15
      },
      title: {
        text: object.properties.nm,
        font: {
          size: 20
        },
        y: 0.95
      },
      font: {
        color: THEME == "dark" ? "#aaa" : "#333"
      },
      barmode: "relative",
      showlegend: true,
      legend: {
        title: {
          text: "Work",
          font: {
            size: 15
          }
        },
        itemclick: false,
        font: {
          size: 12
        },
        traceorder: "reversed"
      },
      xaxis: {
        standoff: 10,
        showdividers: true
      },
      yaxis: {
        showline: false,
        showgrid: true,
        zerolinewidth: 2,
        zerolinecolor: THEME == "dark" ? "#aaa" : "#333",
        gridcolor: THEME == "dark" ? "#888" : "#444" // layer: "above traces",

      },
      hovermode: "closest",
      bgcolor: "rgba(0, 0, 0, 0)",
      paper_bgcolor: "rgba(0, 0, 0, 0)",
      plot_bgcolor: "rgba(0, 0, 0, 0)"
    };
    var el1 = document.getElementById("subplot1");
    Plotly.newPlot(el1, data1, layout, {
      displayModeBar: false
    } // staticPlot: true}
    ); // Change some minor things for the second plot
    // BE CAREFUL! change too many and they end up misaligned!

    layout.title = null;
    layout.legend.title.text = "Study";
    layout.xaxis.visible = false;
    var el2 = document.getElementById("subplot2");
    Plotly.newPlot(el2, data2, layout, {
      displayModeBar: false
    } // staticPlot: true}
    );
    SEL_AREA = object.properties.nm;
    selectAreaUIUpdates(SEL_AREA);
  } else {
    deselectAreaUIUpdates();
    SEL_AREA = null;
  }

  render();
}

function selectAreaUIUpdates(name) {
  var container = document.getElementById("chart-container");
  var chart = document.getElementById("chart");
  container.style.display = "block";
  container.style.visibility = "visible";
  chart.style["background-color"] = THEME == "dark" ? "rgba(14,14,0,0.5)" : "rgba(241,241,255,0.5)"; // document.getElementById("selected-area").innerHTML = SEL_AREA;

  document.getElementById("selection-bar").style.display = "block";
  document.getElementById("main-controls").style.display = "none";
  document.getElementById("switch-to-chart").style.display = "block";
}

function deselectAreaUIUpdates() {
  var container = document.getElementById("chart-container");
  container.style.display = "none";
  container.style.visibility = "hidden"; // document.getElementById("selected-area").innerHTML = "";

  document.getElementById("enter-name").value = "";
  document.getElementById("selection-bar").style.display = "none";
  document.getElementById("main-controls").style.display = "block";
  document.getElementById("switch-to-chart").style.display = "none";
} // The tour stuff


function getArea(name) {
  for (var i = 0; i < DATA.census.length; i++) {
    var obj = DATA.census[i];

    if (obj.properties.nm == name) {
      return obj;
    }
  }

  return null;
}

var TOUR_STOPS = {
  "Kaikoura": {
    longitude: 173.6840,
    latitude: -42.4,
    zoom: 9,
    pitch: 0,
    bearing: 315,
    transitionDuration: 3000
  },
  "Auckland Airport": {
    longitude: 174.95,
    latitude: -36.85,
    zoom: 10,
    pitch: 55,
    bearing: 40,
    transitionDuration: 3000
  },
  "Campus South": {
    longitude: 170.5,
    latitude: -45.8,
    zoom: 10.5,
    pitch: 55,
    bearing: 320,
    transitionDuration: 3000
  },
  "Paekakariki": {
    longitude: 174.85,
    latitude: -41.1139,
    zoom: 10,
    pitch: 55,
    bearing: 320,
    transitionDuration: 3000
  },
  "Canterbury": {
    longitude: 172.52,
    latitude: -43.53,
    zoom: 9,
    pitch: 10,
    bearing: 320,
    transitionDuration: 3000
  },
  "Auckland Region": {
    longitude: 174.75,
    latitude: -36.75,
    zoom: 8.5,
    pitch: 10,
    bearing: 270,
    transitionDuration: 3000
  },
  "Wanaka-Queenstown-Cromwell": {
    longitude: 169.2,
    latitude: -45,
    zoom: 9.0,
    pitch: 55,
    bearing: 165,
    transitionDuration: 3000
  },
  "Gisborne Central": {
    longitude: 178.0,
    latitude: -38.65,
    zoom: 9.5,
    pitch: 55,
    bearing: 320,
    transitionDuration: 3000
  }
};

function toggleTourStop(arrow, id, nm, select) {
  var clickedArrow = document.getElementById(arrow);
  var clickedPanel = document.getElementById(id);

  if (SEL_AREA != null) {
    deselectArea();
  }

  if (TOUR_STOP_OPEN.panel == null) {
    // then open the panel and record it
    clickedArrow.innerHTML = "&#9651";
    clickedPanel.style.display = "block"; // clickedPanel.style.visibility = "visible";

    TOUR_STOP_OPEN.panel = id;
    TOUR_STOP_OPEN.arrow = arrow; // select the location and go there

    if (select) {
      selectArea(getArea(nm));
    }

    ;
    MY_DECKGL.viewState = TOUR_STOPS[nm];
  } else {
    if (id == TOUR_STOP_OPEN.panel) {
      // close the panel and remove from the record
      clickedArrow.innerHTML = "&#9661";
      clickedPanel.style.display = "none"; // reopen the intro
      // document.selectItemById("tour-intro").style.display = "block";

      TOUR_STOP_OPEN.panel = null;
      TOUR_STOP_OPEN.arrow = null;
      selectArea(null);
      MY_DECKGL.viewState = START_VIEW;
    } else {
      // close the open panel and open the new one
      var _openPanel2 = document.getElementById(TOUR_STOP_OPEN.panel);

      var openArrow = document.getElementById(TOUR_STOP_OPEN.arrow);
      openArrow.innerHTML = "&#9661";
      _openPanel2.style.display = "none";
      clickedArrow.innerHTML = "&#9651";
      clickedPanel.style.display = "block";
      TOUR_STOP_OPEN.panel = id;
      TOUR_STOP_OPEN.arrow = arrow;

      if (select && SEL_AREA != nm) {
        selectArea(getArea(nm));
      } else {
        selectArea(null);
      }

      ;
      MY_DECKGL.viewState = TOUR_STOPS[nm];
    }
  }

  if (TOUR_STOP_OPEN.panel == null) {
    document.getElementById("tour-intro").style.display = "block";
  } else {
    document.getElementById("tour-intro").style.display = "none";
  }

  render();
} // Colour mixing


function multArray(a, s) {
  var result = [];

  for (var i = 0; i < a.length; i++) {
    result.push(a[i] * s);
  }

  return result;
}

function divArray(a, s) {
  var result = [];

  for (var i = 0; i < a.length; i++) {
    result.push(a[i] / s);
  }

  return result;
}
/*
Manage RGB 'natural' RYB colour mixing - there is probably
a library for doing this out there somewhere but this works
OK for present purposes
*/
// colours supplied as Arrays [0-255, 0-255, 0-255, [0-255]] mode
// if alpha is not supplied it will be set to 255 (in effect)


function mixColours(c1, c2) {
  var a1 = c1.length == 3 ? 1 : c1[3] / 255;
  var a2 = c2.length == 3 ? 1 : c2[3] / 255;
  var aTotal = a1 + a2;
  var cmyk1 = getCMYK(c1.slice(0, 3));
  var cmyk2 = getCMYK(c2.slice(0, 3));
  var cmykMix = [(cmyk1[0] * a1 + cmyk2[0] * a2) / aTotal, (cmyk1[1] * a1 + cmyk2[1] * a2) / aTotal, (cmyk1[2] * a1 + cmyk2[2] * a2) / aTotal, (cmyk1[3] * a1 + cmyk2[3] * a2) / aTotal];
  var rgba = multArray(getRGB(cmykMix), 255);
  rgba.push(255 * (1 - (1 - a1) * (1 - a2)));
  return rgba;
} // CMYK returned as Array [0-1, 0-1, 0-1, 0-1]


function getCMYK(col) {
  var cDash = divArray(col, 255);
  var kDash = Math.max.apply(null, cDash);
  var mk = 1 / kDash;
  var c = (kDash - cDash[0]) * mk;
  var m = (kDash - cDash[1]) * mk;
  var y = (kDash - cDash[2]) * mk;
  return [c, m, y, 1 - kDash];
} // RGB returned as Array [0-255, 0-255, 0-255]


function getRGB(c) {
  var kDash = 1 - c[3];
  return [(1 - c[0]) * kDash, (1 - c[1]) * kDash, (1 - c[2]) * kDash];
}

function gotoSearchArea() {
  var el = document.getElementById("enter-name");
  var area = el.value;

  if (area == SEL_AREA) {
    return;
  }

  var objArea = getArea(area);

  if (objArea == undefined) {
    return;
  } else {
    selectArea(objArea);
    zoomTo();
  }
}
