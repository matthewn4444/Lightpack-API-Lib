var gui = require('nw.gui'),
    win = gui.Window.get(),
    path = require('path'),
    automationEvents = require("./../node_modules/lightpack/automation-events");

var lightpack = require("./../node_modules/lightpack/lightpack-api"),
    mutex = require("./../node_modules/lightpack/app-mutex"),
    pkg = require("./../../package.json"),
    lightApi = null,
    tray = null,
    wasInstalled = lightpack.getSettingsFolder().indexOf("\\Program Files") != -1,

    // Window states
    isFilterConnected = false,
    isShowing = false,
    hasEverRanVideo = false;

function showWindow() {
    isShowing = true;
    win.show();
    win.focus();
}
automationEvents.debug(console);
lightpack.debug(console);

//  ============================================
//  Command Line
//  ============================================
var shouldShowWindow = true;
for (var i = 0; i < gui.App.argv.length; i++) {
    var cmd = gui.App.argv[i];
    if (cmd == "--hide") {
        shouldShowWindow = false;
    }
}
// Show window by default
if (shouldShowWindow) {
    showWindow();
}

//  ============================================
//  Set a Windows mutex for Inno setup files
//  ============================================
mutex.create("LightpackFilterGUIMutex");

$("#version").text(pkg.version);

//  ============================================
//  Set the settings path
//  ============================================
if (wasInstalled) {
    // If this project is in program files, then use the window's app data
    lightpack.setSettingsFolder(gui.App.dataPath);
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
        if (hasEverRanVideo) {
            automationEvents.fireEvent("close", function() {
                win.close(true);
            });
        } else {
            win.close(true);
        }
    });
}
function initTray() {
    tray = new gui.Tray({ icon: "/app/src/images/icon.png" });
    tray.tooltip = "Lightpack Filter";

    var trayMenu = new gui.Menu();
    trayMenu.append(new gui.MenuItem({ label: "Edit Settings", click: showWindow }));
    trayMenu.append(new gui.MenuItem({ type: "separator" }));
    trayMenu.append(new gui.MenuItem({ label: "Close", click: close }));
    tray.menu = trayMenu;
    tray.on("click", showWindow);
}
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

// Delay showing tray until we know that the filter is connected if is not showing
// If gui is not hidden on startup, show tray and once filter is disconnected and
// not showing, gui will close
if (isShowing) {
    setTimeout(initTray, 200);
}
(function() {
    var intervalCount = 0;
    var counter = setInterval(function() {
        if (!isShowing && !isFilterConnected) {
            if (intervalCount >= 3 || tray) {
                clearInterval(counter);
                close();
            }
            intervalCount++;
        } else if (tray == null) {
            initTray();
        }
    }, 1000);
})();

//  ============================================
//  Check for new versions
//  ============================================

// Delay version check so that the ui can load
setTimeout(function() {
    var Updater = require("./../node_modules/updater");
    var updater = new Updater(pkg);
    updater.checkNewVersion(function(err, manifest){
        if (err) {
            return console.error(err);
        }
        var newVersion = manifest.version;
        if (confirm("Version " + newVersion + " is available, would you like to update?")) {
            showWindow();
            // Start file download
            var downloadFn = (wasInstalled ? updater.downloadInstaller : updater.download).bind(updater);
            var totalSize = 1, receivedSize = 0;

            function updateProgress(percent) {
                var percent = Math.floor(receivedSize * 100 / totalSize);
                $("#download-done").text(Math.round(receivedSize / 1024));
                $("#download-percent").text(percent + "%");
                $("#download-total").text(Math.round(totalSize / 1024));
                $("#download-progress").progressbar("option", "value", percent);
            }

            // Update the progress bar in intervals to avoid CPU hogging
            var timer = setInterval(function(){
                updateProgress();
            }, 100);

            downloadFn(function(err, _path) {
                clearInterval(timer);
                updateProgress();
                if (err) {
                    alert("There was an error retrieving the download.");
                    $(document.body).removeClass("overlay");
                    return console.error(err);
                }
                if (wasInstalled) {
                    // Run installer and close this application
                    // setTimeout is needed or else error
                    setTimeout(function(){
                        updater.run(_path);
                        // Close window after timeout since sometimes nodejs is killed before launching setup
                        lightpack.closeFilterWindow(setTimeout.bind(null, close, 100));
                    }, 100);
                } else {
                    // Unpack zip file
                    $("#overlay .group").fadeOut();
                    $("#download-percent").text("Unpacking...");

                    var exePath = process.execPath.substring(0, process.execPath.lastIndexOf("\\"));
                    updater.unpack(_path, function(err, newPath) {
                        lightpack.closeFilterWindow(function() {
                            // Exit app and spawn the bat for final clean up
                            require('child_process').spawn(path.join(newPath, "post-unpack.bat"),
                                [2, newPath, exePath], {detached: true});
                            close();
                        });
                    });
                }
            }).on("response", function(res){
                totalSize = parseInt(res.headers['content-length'], 10);
               updateProgress();
                $(document.body).addClass("download");
            }).on("data", function(chunk) {
                receivedSize += chunk.length;
            });
        }
    });
}, 200);

//  ============================================
//  Handle Lightpack
//  ============================================
var numLeds = 0,
    normalSmooth = lightpack.getSmooth(),
    isConnected = false,
    isPlaying = false;

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
    }

    // Update the states for the toggle buttons
    setPowerButton(lightpack.isOn());
    setCloseStateButton(lightpack.isOnWhenClose());

    // Update the automation data
    var eventData = lightpack.getVideoEventData("play");
    if (eventData) {
        setWhenVideoPlaysData(eventData.enabled, eventData.url, eventData.start, eventData.end);
    }
    eventData = lightpack.getVideoEventData("pause");
    if (eventData) {
        setWhenVideoPausesData(eventData.enabled, eventData.url, eventData.start, eventData.end);
    }
    eventData = lightpack.getVideoEventData("close");
    if (eventData) {
        setWhenVideoClosesData(eventData.enabled, eventData.url, eventData.start, eventData.end);
    }
    setDelayedTimeBetweenEvents(lightpack.getDelayedTimeBetweenEvents());

    lightApi.on("connect", function(n){
        console.log("Lights have connected with " + n + " leds");

        // When connecting lights back to computer, show white
        if (!isPlaying && isShowing && numLeds == 0 && n > 0) {
            lightpack.setSmooth(lightpack.getSmooth());
            lightpack.setBrightness(lightpack.getBrightness());
            lightApi.setColorToAll(255, 255, 255);
        }
        numLeds = n;
        isConnected = true;

        // If you connect the same number of leds as saved, then load those positions
        var savedPos = lightpack.getSavedPositions();
        if (savedPos.length == n) {
            Ledmap.setPositions(savedPos);
            setNumberOfLightpackModules(savedPos.length / 10);
        } else {
            var numModules = numLeds / 10;
            Ledmap.setGroups(numModules);
            setNumberOfLightpackModules(numModules);
        }

        // First run after setting default positions with correct number of leds
        if (lightpack.getSavedPositions().length == 0) {
            lightpack.sendPositions(Ledmap.getPositions());
        }

        // Set the colors if on the adjustment page
        if ($("#page-adjust-position.open").length) {
            displayLedMapColors();
            maybeShowLedChangeWarning();
        }
        $(document.body).addClass("connected");
    }).on("disconnect", function(n){
        console.log("Lights have disconnected with " + n + " leds left");
        numLeds = n;
        setNumberOfLightpackModules(numLeds / 10);
        if (numLeds == 0) {
            isConnected = false;
            $(document.body).removeClass("connected");
        }
    }).on("play", function(){
        console.log("Filter is playing");
        hasEverRanVideo = true;
        isPlaying = true;
        automationEvents.fireEvent("play");
    }).on("pause", function(){
        console.log("Filter was paused");
        hasEverRanVideo = true;
        isPlaying = false;
        automationEvents.fireEvent("pause");
    }).on("filterConnect", function() {
        isFilterConnected = true;
    }).on("filterDisconnect", function() {
        isFilterConnected = false;

        // If not shown and video is disconnected, we will close this
        if (!isShowing) {
            close();
        }
    }).connect();

    $(window).focus(function() {
        // Paused and showing
        if ($("#page-adjust-position.open").length && !isPlaying) {
            displayLedMapColors();
        }
    });
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

function setCloseState(flag) {
    lightpack.setCloseState(flag);
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

function saveVideoEventData(name, enabled, url, startTime, endTime) {
    automationEvents.saveVideoEventData(name, enabled, url, startTime, endTime);
}

function saveTimeBetweenEvents(timeMs) {
    automationEvents.saveTimeBetweenEvents(timeMs);
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
        lightpack.setSmooth(DEFAULTS.smooth);
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
$("#page-adjust-position .restore-button").click(function() {
    lightpack.sendPositions(Ledmap.getPositions());
    lightpack.setHorizontalDepth(Ledmap.getHorizontalDepth());
    lightpack.setVerticalDepth(Ledmap.getVerticalDepth());
});

// Fullscreen button
$("#fullscreen").click(function(){
    $(document.body).toggleClass("fullscreen");
    win.toggleFullscreen();
});
win.on("enter-fullscreen", function() {
    Ledmap.updateMetrics();
});
win.on("restore", function() {
    Ledmap.updateMetrics();
});

function maybeShowLedChangeWarning() {
    if (isShowing) {
        var numSavedPos = lightpack.getSavedPositions().length;
        if (!maybeShowLedChangeWarning.shown) {
            if (numLeds > 0 && numSavedPos > 0 && numSavedPos != numLeds) {
                showPopup("Warning!", "Your last saved position had " + numSavedPos + " leds and now only " + numLeds + " leds are connected. If you modify the positions now, it will modified your saved positions.");
                maybeShowLedChangeWarning.shown = true;
            }
        } else if (numSavedPos == numLeds && $("#common-overlay").is(":visible")) {
            // If showing message, but later user plugs back the leds, so that it
            // matches led count with saved positions, hide message
            // Message can show again since user did not explicitly click the warning
            hidePopup();
            maybeShowLedChangeWarning.shown = false;
        }
    }
}

$("nav ul").on("click", "#nav-adjust-position:not(.selected)", function() {
    maybeShowLedChangeWarning();
});

//  ============================================
//  Handle Sorting Lightpack Modules
//  ============================================
$("#modules-list").on("sortupdate", function(e, ui) {
    var numModules = numLeds / 10;
    if (numModules > 1 && numModules == $(this).children().length) {
        var newPositions = [];
        var positions = Ledmap.getPositions();
        $(this).children().each(function(j) {
            // Copy sets of 10 positions to the new positions
            var n = parseInt($(this).attr("value"), 10);
            for (var i = 0; i < 10; i++) {
                newPositions.push(positions[n * 10 + i]);
            }
            $(this).attr("value", j);
        });
        Ledmap.setPositions(newPositions);
        lightpack.sendPositions(newPositions);
    }
});
