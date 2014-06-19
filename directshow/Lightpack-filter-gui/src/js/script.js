var lightpack = require("lightpack/lightpack-api"),
    gui = require('nw.gui'),
    lightApi = null,
    win = gui.Window.get(),
    tray = new gui.Tray({ icon: "/src/images/icon.png" }),

    // Window states
    isFilterConnected = false,
    isShowing = false;

function showWindow() {
    isShowing = true;
    win.show();
    win.focus();
}

//  ============================================
//  Command Line
//  ============================================
var shouldShowWindow = true;
for (var i = 0; i < gui.App.argv.length; i++) {
    var cmd = gui.App.argv[0];
    if (cmd == "--hide") {
        shouldShowWindow = false;
    }
}
// Show window by default
if (shouldShowWindow) {
    showWindow();
}

function log(/*...*/) {
    var div = document.createElement("div");
    div.style.textAlign = "right";
    var text = "[empty string]";
    if (arguments.length) {
        text = typeof(arguments[0]) == "undefined" ? "undefined" : arguments[0].toString();
        for (var i = 1; i < arguments.length; i++) {
            text += " " + (typeof(arguments[i]) == "undefined" ? "undefined" : arguments[i]);
        }
    }
    div.appendChild(document.createTextNode(text));
    document.getElementById("output").appendChild(div);
}

//  ============================================
//  Handle Tray and window properties
//  ============================================
function close() {
    win.hide();
    lightpack.close(function(){
        if (tray) {
            tray.remove();
            tray = null;
        }
        win.close(true);
    });
}
tray.tooltip = "Lightpack Filter";
var trayMenu = new gui.Menu();
trayMenu.append(new gui.MenuItem({ label: "Edit Settings", click: showWindow }));
trayMenu.append(new gui.MenuItem({ type: "separator" }));
trayMenu.append(new gui.MenuItem({ label: "Close", click: close }));
tray.menu = trayMenu;
tray.on("click", showWindow);
win.on("minimize", function() {
    if (isFilterConnected) {
        this.hide();
    }
    isShowing = false;
});
win.on("restore", function() {
    isShowing = true;
});
win.on("close", function(){
    if (isFilterConnected) {
        win.hide();
        isShowing = false;
    } else {
        close();
    }
});

//  ============================================
//  Handle Lightpack
//  ============================================
var numLeds = 0,
    normalSmooth = lightpack.getSmooth(),
    isConnected = false,
    isPlaying = false;
lightpack.a(document);

lightpack.init(function(api){
    lightApi = api;

    // Apply the data from API to the GUI
    setBrightnessSlider(lightpack.getBrightness());
    setSmoothSlider(lightpack.getSmooth());
    setGammaSlider(lightpack.getGamma());
    setPortInput(lightpack.getPort());
    setHorizontalDepthSlider(lightpack.getHorizontalDepth());
    setVerticalDepthSlider(lightpack.getVerticalDepth());

    // Update ledmap positions
    var pos = lightpack.getSavedPositions();
    if (pos.length) {
        Ledmap.setPositions(pos);
    } else {
        lightpack.sendPositions(Ledmap.getPositions());
    }

    lightApi.on("connect", function(){
        log("Lights have connected");
        numLeds = lightApi.getCountLeds();
        log("Got", numLeds, "Leds");
        Ledmap.setGroups(numLeds / 10);
        isConnected = true;

        // Set the colors if on the adjustment page
        if ($("#page-adjust-position.open").length) {
            displayLedMapColors();
        }
        $(document.body).addClass("connected");
    }).on("disconnect", function(){
        isConnected = false;
        log("Lights have disconnected");
        $(document.body).removeClass("connected");
    }).on("play", function(){
        log("Filter is playing");
        isPlaying = true;
    }).on("pause", function(){
        log("Filter was paused");
        isPlaying = false;

        // Paused and showing
        if ($("#page-adjust-position.open").length) {
            displayLedMapColors();
        }
    }).on("filterConnect", function() {
        isFilterConnected = true;
    }).on("filterDisconnect", function() {
        isFilterConnected = false;

        // If not shown and video is disconnected, we will close this
        if (!isShowing) {
            close();
        }
    }).connect();
});

function canDisplayColors() {
    return lightApi && isConnected && !isPlaying;
}

function displayLedMapColors() {
    if (canDisplayColors()) {   // Also detect if window is shown
        var c = [];
        var colors = Ledmap.getColorGroup();
        for (var i = 0; i < numLeds; i += 10) {
            c = c.concat(colors);
        }
        lightApi.setColors(c);
    }
}

function setLPEnableLights(flag) {
    if (flag) {
        lightApi.turnOn();
    } else {
        lightApi.turnOff();
    }
}

function setLPBrightness(value) {
    if (value != lightpack.getBrightness()) {
        lightpack.setBrightness(value);
    }
}

function setLPGamma(value) {
    if (value != lightpack.getGamma()) {
        lightpack.setGamma(value);
    }
}

function setLPSmooth(value) {
    if (value != lightpack.getSmooth()) {
        lightpack.setSmooth(value);
        normalSmooth = value;
    }
}

function setLPPort(port) {
    if (!isNaN(port)) {
        lightpack.setPort(port);
    }
}

function setLPHorizontalDepth(percent) {
    if (!isNaN(percent)) {
        lightpack.setHorizontalDepth(percent);
    }
}

function setLPVerticalDepth(percent) {
    if (!isNaN(percent)) {
        lightpack.setVerticalDepth(percent);
    }
}

//  ============================================
//  Handle Ledmap
//  ============================================
Ledmap.on("end", function() {
    lightpack.sendPositions(Ledmap.getPositions());
}).on("startSelection", function() {
    if (canDisplayColors()) {
        normalSmooth = lightpack.getSmooth();
        var n = parseInt($(this).parent().attr("data-led"), 10);
        lightpack.setSmooth(10);
        lightApi.setColorToAll(180, 180, 180);
        lightApi.setColor(n, 255, 0, 0);
    }
}).on("endSelection", function() {
    displayLedMapColors();
    if (canDisplayColors()) {
        lightpack.setSmooth(normalSmooth);
    }
});

$("#nav-adjust-position").click(function(){
    var id = $(this).attr("id");
    if (id == "nav-adjust-position") {
        displayLedMapColors();
    }
});

// Drag end of slider
$("#page-adjust-position").on("slidestop", ".slider", function() {
    lightpack.sendPositions(Ledmap.getPositions());
});

// Reset button to send the lights again
$("#page-adjust-position .restore-button").click(function(){
    Ledmap.arrangeDefault();
    setHorizontalDepthSlider(20);
    setVerticalDepthSlider(15);
    displayLedMapColors();
    lightpack.sendPositions(Ledmap.getPositions());
    lightpack.setHorizontalDepth(20);
    lightpack.setVerticalDepth(15);
});

// Fullscreen button
$("#fullscreen").click(function(){
    $(document.body).toggleClass("fullscreen");
    win.toggleFullscreen();
});
win.on("enter-fullscreen", function() {
    Ledmap.updateMetrics();
});
win.on("leave-fullscreen", function() {
    Ledmap.updateMetrics();
});
