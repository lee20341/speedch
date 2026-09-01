/*
    LibreSpeed - Worker
    by Federico Dossena
    https://github.com/librespeed/speedtest/
    GNU LGPLv3 License
*/

var testState = -1;
var dlStatus = "";
var ulStatus = "";
var pingStatus = "";
var jitterStatus = "";
var clientIp = "";
var dlProgress = 0;
var ulProgress = 0;
var pingProgress = 0;
var testId = null;
var sonStatus = "";
var dlJitterStatus = "";
var ulJitterStatus = "";

var log = "";
function tlog(s) {
    if (settings.telemetry_level >= 2) {
        log += Date.now() + ": " + s + "\n";
    }
}
function tverb(s) {
    if (settings.telemetry_level >= 3) {
        log += Date.now() + ": " + s + "\n";
    }
}
function twarn(s) {
    if (settings.telemetry_level >= 2) {
        log += Date.now() + " WARN: " + s + "\n";
    }
    console.warn(s);
}

var settings = {
    mpot: false,
    test_order: "__P_D_U",
    time_ul_max: 9,
    time_dl_max: 9,
    time_auto: true,
    time_ulGraceTime: 2,
    time_dlGraceTime: 2,
    count_ping: 12,
    url_dl: "backend/garbage.php",
    url_ul: "backend/empty.php",
    url_ping: "backend/empty.php",
    url_getIp: "backend/getIP.php",
    getIp_ispInfo: true,
    getIp_ispInfo_distance: "km",
    xhr_dlMultistream: 4,
    xhr_ulMultistream: 3,
    xhr_multistreamDelay: 300,
    xhr_ignoreErrors: 1,
    xhr_dlUseBlob: false,
    xhr_ul_blob_megabytes: 20,
    garbagePhp_chunkSize: 150,
    enable_quirks: true,
    ping_allowPerformanceApi: true,
    overheadCompensationFactor: 1.06,
    useMebibits: false,
    telemetry_level: 0,
    url_telemetry: "results/telemetry.php",
    telemetry_extra: ""
};

var xhr = null;
var interval = null;
var test_pointer = 0;

function url_sep(url) {
    return url.match(/\?/) ? "&" : "?";
}

this.addEventListener("message", function(e) {
    var params = e.data.split(" ");
    if (params[0] === "status") {
        postMessage(
            JSON.stringify({
                testState: testState,
                dlStatus: dlStatus,
                ulStatus: ulStatus,
                pingStatus: pingStatus,
                clientIp: clientIp,
                jitterStatus: jitterStatus,
                dlProgress: dlProgress,
                ulProgress: ulProgress,
                pingProgress: pingProgress,
                testId: testId,
                sonStatus: sonStatus,
                dlJitterStatus: dlJitterStatus,
                ulJitterStatus: ulJitterStatus
            })
        );
    }
    if (params[0] === "start" && testState === -1) {
        testState = 0;
        try {
            var s = {};
            try {
                var ss = e.data.substring(5);
                if (ss) s = JSON.parse(ss);
            } catch (e) {
                twarn("Error parsing custom settings JSON");
            }
            for (var key in s) {
                if (settings.hasOwnProperty(key)) settings[key] = s[key];
                else twarn("Unknown setting ignored: " + key);
            }
            var ua = navigator.userAgent;
            if (settings.enable_quirks || (typeof s.enable_quirks !== "undefined" && s.enable_quirks)) {
                if (/Firefox.(\d+\.\d+)/i.test(ua)) {
                    if (typeof s.ping_allowPerformanceApi === "undefined") {
                        settings.ping_allowPerformanceApi = false;
                    }
                }
                if (/Edge.(\d+\.\d+)/i.test(ua)) {
                    if (typeof s.xhr_dlMultistream === "undefined") {
                        settings.xhr_dlMultistream = 3;
                    }
                }
                if (/Chrome.(\d+)/i.test(ua) && !!self.fetch) {
                    if (typeof s.xhr_dlMultistream === "undefined") {
                        settings.xhr_dlMultistream = 4;
                    }
                }
            }

            if (typeof s.telemetry_level !== "undefined") {
                settings.telemetry_level = s.telemetry_level === "basic" ? 1 : s.telemetry_level === "full" ? 2 : s.telemetry_level === "debug" ? 3 : 0;
            }
            settings.test_order = settings.test_order.toUpperCase();
        } catch (e) {
            twarn("Possible error in custom test settings. Some settings might not have been applied: " + e);
        }

        tverb(JSON.stringify(settings));
        test_pointer = 0;
        var iRun = false,
            dRun = false,
            uRun = false,
            pRun = false;
        
        var runNextTest = function() {
            if (testState == 5) return;
            if (test_pointer >= settings.test_order.length) {
                if (settings.telemetry_level > 0)
                    sendTelemetry(function(id) {
                        testState = 4;
                        if (id != null) testId = id;
                    });
                else testState = 4;
                return;
            }
            
            var ch = settings.test_order.charAt(test_pointer);
            test_pointer++;
            switch (ch) {
                case "I":
                    if (iRun) {
                        runNextTest();
                        return;
                    } else iRun = true;
                    getIp(runNextTest);
                    break;
                case "D":
                    if (dRun) {
                        runNextTest();
                        return;
                    } else dRun = true;
                    testState = 1;
                    dlTest(runNextTest);
                    break;
                case "U":
                    if (uRun) {
                        runNextTest();
                        return;
                    } else uRun = true;
                    testState = 3;
                    ulTest(runNextTest);
                    break;
                case "P":
                    if (pRun) {
                        runNextTest();
                        return;
                    } else pRun = true;
                    testState = 2;
                    pingTest(runNextTest);
                    break;
                case "_":
                    setTimeout(runNextTest, 1000);
                    break;
                default:
                    runNextTest();
            }
        };
        runNextTest();
    }
    if (params[0] === "abort") {
        if (testState >= 4) return;
        tlog("manually aborted");
        clearRequests();
        runNextTest = null;
        if (interval) clearInterval(interval);
        if (settings.telemetry_level > 1) sendTelemetry(function() {});
        testState = 5;
        dlStatus = "";
        ulStatus = "";
        pingStatus = "";
        jitterStatus = "";
        clientIp = "";
        dlProgress = 0;
        ulProgress = 0;
        pingProgress = 0;
    }
});

function clearRequests() {
    tverb("stopping pending XHRs");
    if (xhr) {
        for (var i = 0; i < xhr.length; i++) {
            try {
                xhr[i].onprogress = null;
                xhr[i].onload = null;
                xhr[i].onerror = null;
            } catch (e) {}
            try {
                xhr[i].upload.onprogress = null;
                xhr[i].upload.onload = null;
                xhr[i].upload.onerror = null;
            } catch (e) {}
            try {
                xhr[i].abort();
            } catch (e) {}
            try {
                delete xhr[i];
            } catch (e) {}
        }
        xhr = null;
    }
}

var ipCalled = false;
var ispInfo = "";
function getIp(done) {
    tverb("getIp");
    if (ipCalled) return;
    else ipCalled = true;
    var startT = new Date().getTime();
    xhr = new XMLHttpRequest();
    xhr.onload = function() {
        tlog("IP: " + xhr.responseText + ", took " + (new Date().getTime() - startT) + "ms");
        try {
            var data = JSON.parse(xhr.responseText);
            clientIp = data.processedString;
            ispInfo = data.rawIspInfo;
        } catch (e) {
            clientIp = xhr.responseText;
            ispInfo = "";
        }
        done();
    };
    xhr.onerror = function() {
        tlog("getIp failed, took " + (new Date().getTime() - startT) + "ms");
        done();
    };
    xhr.open("GET", settings.url_getIp + url_sep(settings.url_getIp) + 
        (settings.mpot ? "cors=true&" : "") + 
        (settings.getIp_ispInfo ? "isp=true" + (settings.getIp_ispInfo_distance ? "&distance=" + settings.getIp_ispInfo_distance + "&" : "&") : "&") + 
        "r=" + Math.random(), true);
    xhr.send();
}

var dlCalled = false;

function dlTest(done) {
    tverb("dlTest");
    if (dlCalled) return;
    else dlCalled = true;

    var totLoaded = 0.0,
        startT = new Date().getTime(),
        bonusT = 0,
        graceTimeDone = false,
        failed = false;

    var speedRecords = [];
    var lastSpeedCheck = startT;
    var SPEED_CHECK_INTERVAL = 200;

    xhr = [];
    
    var testStream = function(i, delay) {
        setTimeout(function() {
            if (testState !== 1) return;
            tverb("dl test stream started " + i + " " + delay);
            var prevLoaded = 0;
            var x = new XMLHttpRequest();
            xhr[i] = x;
            xhr[i].onprogress = function(event) {
                tverb("dl stream progress event " + i + " " + event.loaded);
                if (testState !== 1) {
                    try {
                        x.abort();
                    } catch (e) {}
                }

                var loadDiff = event.loaded <= 0 ? 0 : event.loaded - prevLoaded;
                if (isNaN(loadDiff) || !isFinite(loadDiff) || loadDiff < 0) return;

                totLoaded += loadDiff;
                prevLoaded = event.loaded;

                var now = new Date().getTime();
                if (now - lastSpeedCheck >= SPEED_CHECK_INTERVAL && graceTimeDone) {
                    var currentSpeed = (loadDiff * 8 * 1000) / (now - lastSpeedCheck);
                    speedRecords.push(currentSpeed);
                    
                    if (speedRecords.length >= 2) {
                        var diffs = [];
                        for (var j = 1; j < speedRecords.length; j++) {
                            diffs.push(Math.abs(speedRecords[j] - speedRecords[j-1]));
                        }
                        
                        var sum = 0;
                        for (var k = 0; k < diffs.length; k++) {
                            sum += diffs[k];
                        }
                        var avgJitter = sum / diffs.length;
                        dlJitterStatus = (avgJitter / (settings.useMebibits ? 1048576 : 1000000)).toFixed(2);
                    }
                    lastSpeedCheck = now;
                }
            }.bind(this);

            xhr[i].onload = function() {
                tverb("dl stream finished " + i);
                try {
                    xhr[i].abort();
                } catch (e) {}
                testStream(i, 0);
            }.bind(this);

            xhr[i].onerror = function() {
                tverb("dl stream failed " + i);
                if (settings.xhr_ignoreErrors === 0) failed = true;
                try {
                    xhr[i].abort();
                } catch (e) {}
                delete xhr[i];
                if (settings.xhr_ignoreErrors === 1) testStream(i, 0);
            }.bind(this);

            try {
                if (settings.xhr_dlUseBlob) xhr[i].responseType = "blob";
                else xhr[i].responseType = "arraybuffer";
            } catch (e) {}

            xhr[i].open("GET", settings.url_dl + url_sep(settings.url_dl) + 
                (settings.mpot ? "cors=true&" : "") + "r=" + Math.random() +
                "&ckSize=" + settings.garbagePhp_chunkSize, true);
            xhr[i].send();
        }.bind(this), 1 + delay);
    }.bind(this);

    for (var i = 0; i < settings.xhr_dlMultistream; i++) {
        testStream(i, settings.xhr_multistreamDelay * i);
    }

    interval = setInterval(function() {
        tverb("DL: " + dlStatus + (graceTimeDone ? "" : " (in grace time)"));
        var t = new Date().getTime() - startT;
        
        if (graceTimeDone) dlProgress = (t + bonusT) / (settings.time_dl_max * 1000);
        if (t < 200) return;

        if (!graceTimeDone) {
            if (t > 1000 * settings.time_dlGraceTime) {
                if (totLoaded > 0) {
                    startT = new Date().getTime();
                    bonusT = 0;
                    totLoaded = 0.0;
                    speedRecords = [];
                }
                graceTimeDone = true;
            }
        } else {
            var speed = totLoaded / (t / 1000.0);
            if (settings.time_auto) {
                var bonus = (5.0 * speed) / 100000;
                bonusT += bonus > 400 ? 400 : bonus;
            }

            dlStatus = ((speed * 8 * settings.overheadCompensationFactor) / 
                (settings.useMebibits ? 1048576 : 1000000)).toFixed(2);

            if ((t + bonusT) / 1000.0 > settings.time_dl_max || failed) {
                if (failed || isNaN(dlStatus)) dlStatus = "Fail";
                clearRequests();
                clearInterval(interval);
                dlProgress = 1;
                tlog("dlTest: " + dlStatus + ", jitter: " + dlJitterStatus + ", took " + (new Date().getTime() - startT) + "ms");
                done();
            }
        }
    }.bind(this), 200);
}

var ulCalled = false;

function ulTest(done) {
    tverb("ulTest");
    if (ulCalled) return;
    else ulCalled = true;

    var r = new ArrayBuffer(1048576);
    var maxInt = Math.pow(2, 32) - 1;
    try {
        r = new Uint32Array(r);
        for (var i = 0; i < r.length; i++) r[i] = Math.random() * maxInt;
    } catch (e) {}

    var req = [];
    var reqsmall = [];

    for (var i = 0; i < settings.xhr_ul_blob_megabytes; i++) req.push(r);
    req = new Blob(req);
    r = new ArrayBuffer(262144);
    try {
        r = new Uint32Array(r);
        for (var i = 0; i < r.length; i++) r[i] = Math.random() * maxInt;
    } catch (e) {}
    reqsmall.push(r);
    reqsmall = new Blob(reqsmall);

    var totLoaded = 0.0,
        startT = new Date().getTime(),
        bonusT = 0,
        graceTimeDone = false,
        failed = false;

    var speedRecords = [];
    var lastSpeedCheck = startT;
    var SPEED_CHECK_INTERVAL = 200;

    xhr = [];

    var testFunction = function() {
        var testStream = function(i, delay) {
            setTimeout(function() {
                if (testState !== 3) return;
                tverb("ul test stream started " + i + " " + delay);
                var prevLoaded = 0;
                var x = new XMLHttpRequest();
                xhr[i] = x;
                var ie11workaround;
                if (settings.forceIE11Workaround) ie11workaround = true;
                else {
                    try {
                        xhr[i].upload.onprogress;
                        ie11workaround = false;
                    } catch (e) {
                        ie11workaround = true;
                    }
                }

                if (ie11workaround) {
                    xhr[i].onload = xhr[i].onerror = function() {
                        tverb("ul stream progress event (ie11wa)");
                        totLoaded += reqsmall.size;
                        testStream(i, 0);

                        var now = new Date().getTime();
                        if (now - lastSpeedCheck >= SPEED_CHECK_INTERVAL && graceTimeDone) {
                            var currentSpeed = (reqsmall.size * 8 * 1000) / (now - lastSpeedCheck);
                            speedRecords.push(currentSpeed);
                            
                            if (speedRecords.length >= 2) {
                                var diffs = [];
                                for (var j = 1; j < speedRecords.length; j++) {
                                    diffs.push(Math.abs(speedRecords[j] - speedRecords[j-1]));
                                }
                                var sum = 0;
                                for (var k = 0; k < diffs.length; k++) {
                                    sum += diffs[k];
                                }
                                var avgJitter = sum / diffs.length;
                                ulJitterStatus = (avgJitter / (settings.useMebibits ? 1048576 : 1000000)).toFixed(2);
                            }
                            lastSpeedCheck = now;
                        }
                    };
                    xhr[i].open("POST", settings.url_ul + url_sep(settings.url_ul) + (settings.mpot ? "cors=true&" : "") + "r=" + Math.random(), true);
                    xhr[i].send(reqsmall);
                } else {
                    xhr[i].upload.onprogress = function(event) {
                        if (testState !== 3) {
                            try {
                                x.abort();
                            } catch (e) {}
                        }

                        var loadDiff = event.loaded <= 0 ? 0 : event.loaded - prevLoaded;
                        if (isNaN(loadDiff) || !isFinite(loadDiff) || loadDiff < 0) return;

                        totLoaded += loadDiff;
                        prevLoaded = event.loaded;

                        var now = new Date().getTime();
                        if (now - lastSpeedCheck >= SPEED_CHECK_INTERVAL && graceTimeDone) {
                            var currentSpeed = (loadDiff * 8 * 1000) / (now - lastSpeedCheck);
                            speedRecords.push(currentSpeed);
                            
                            if (speedRecords.length >= 2) {
                                var diffs = [];
                                for (var j = 1; j < speedRecords.length; j++) {
                                    diffs.push(Math.abs(speedRecords[j] - speedRecords[j-1]));
                                }
                                var sum = 0;
                                for (var k = 0; k < diffs.length; k++) {
                                    sum += diffs[k];
                                }
                                var avgJitter = sum / diffs.length;
                                ulJitterStatus = (avgJitter / (settings.useMebibits ? 1048576 : 1000000)).toFixed(2);
                            }
                            lastSpeedCheck = now;
                        }
                    }.bind(this);

                    xhr[i].upload.onload = function() {
                        testStream(i, 0);
                    }.bind(this);

                    xhr[i].upload.onerror = function() {
                        tverb("ul stream failed " + i);
                        if (settings.xhr_ignoreErrors === 0) failed = true;
                        try {
                            xhr[i].abort();
                        } catch (e) {}
                        delete xhr[i];
                        if (settings.xhr_ignoreErrors === 1) testStream(i, 0);
                    }.bind(this);

                    xhr[i].open("POST", settings.url_ul + url_sep(settings.url_ul) + (settings.mpot ? "cors=true&" : "") + "r=" + Math.random(), true);
                    try {
                        xhr[i].setRequestHeader("Content-Encoding", "identity");
                    } catch (e) {}
                    xhr[i].send(req);
                }
            }.bind(this), delay);
        }.bind(this);

        for (var i = 0; i < settings.xhr_ulMultistream; i++) {
            testStream(i, settings.xhr_multistreamDelay * i);
        }

        interval = setInterval(function() {
            tverb("UL: " + ulStatus + (graceTimeDone ? "" : " (in grace time)"));
            var t = new Date().getTime() - startT;
            if (graceTimeDone) ulProgress = (t + bonusT) / (settings.time_ul_max * 1000);
            if (t < 200) return;

            if (!graceTimeDone) {
                if (t > 1000 * settings.time_ulGraceTime) {
                    if (totLoaded > 0) {
                        startT = new Date().getTime();
                        bonusT = 0;
                        totLoaded = 0.0;
                        speedRecords = [];
                    }
                    graceTimeDone = true;
                }
            } else {
                var speed = totLoaded / (t / 1000.0);
                if (settings.time_auto) {
                    var bonus = (5.0 * speed) / 100000;
                    bonusT += bonus > 400 ? 400 : bonus;
                }

                ulStatus = ((speed * 8 * settings.overheadCompensationFactor) / (settings.useMebibits ? 1048576 : 1000000)).toFixed(2);

                if ((t + bonusT) / 1000.0 > settings.time_ul_max || failed) {
                    if (failed || isNaN(ulStatus)) ulStatus = "Fail";
                    clearRequests();
                    clearInterval(interval);
                    ulProgress = 1;
                    tlog("ulTest: " + ulStatus + ", jitter: " + ulJitterStatus + ", took " + (new Date().getTime() - startT) + "ms");
                    done();
                }
            }
        }.bind(this), 200);
    }.bind(this);
    
    if (settings.mpot) {
        xhr = [];
        xhr[0] = new XMLHttpRequest();
        xhr[0].onload = xhr[0].onerror = function() {
            testFunction();
        }.bind(this);
        xhr[0].open("POST", settings.url_ul + url_sep(settings.url_ul) + "cors=true&r=" + Math.random());
        xhr[0].send();
    } else testFunction();
}

var ptCalled = false;

function pingTest(done) {
    tverb("pingTest");
    if (ptCalled) return;
    else ptCalled = true;
    
    var startT = new Date().getTime();
    var prevT = null;
    var ping = 0.0;
    var pingSum = 0.0;
    var validPingCount = 0;
    var jitter = 0.0;
    var i = 0;
    var prevInstspd = 0;
    var highPingCount = 0;
    var highPingCount2 = 0;
    xhr = [];

    sonStatus = null;
    pingStatus = "0.00";
    jitterStatus = "0.00";

    var doPing = function() {
        tverb("ping");
        pingProgress = i / settings.count_ping;
        prevT = new Date().getTime();
        xhr[0] = new XMLHttpRequest();
        xhr[0].onload = function() {
            tverb("pong");
            if (i === 0) {
                prevT = new Date().getTime();
                sonStatus = "0.00";
            } else {
                var instspd = new Date().getTime() - prevT;
                if (settings.ping_allowPerformanceApi) {
                    try {
                        var p = performance.getEntriesByType("resource");
                        if (p && p.length) {
                            var lastEntry = p[p.length - 1];
                            var d = lastEntry.responseStart - lastEntry.requestStart;
                            if (d <= 0) d = lastEntry.duration;
                            if (d > 0 && d < instspd) instspd = d;
                        }
                    } catch (e) {
                        tverb("Performance API error: " + e);
                    }
                }

                if (instspd < 1) instspd = prevInstspd;
                if (instspd < 1) instspd = 1;

                if (instspd <= 350) {
                    var instjitter = Math.abs(instspd - prevInstspd);
                    pingSum += instspd;
                    validPingCount++;

                    ping = pingSum / validPingCount;
                    
                    if (validPingCount === 1) {
                        ping = instspd;
                    } else {
                        if (instspd < ping) ping = instspd;
                        if (validPingCount === 2) jitter = instjitter;
                        else jitter = instjitter > jitter ? jitter * 0.3 + instjitter * 0.7 : jitter * 0.8 + instjitter * 0.2;
                    }
                    prevInstspd = instspd;
                }

                if (instspd > 1690) {
                    highPingCount++;
                }
            }

            if (i > 0) {
                highPingCount2 = Math.round((highPingCount / i) * 100);
                
                if (validPingCount > 0) {
                    pingStatus = ping.toFixed(2);
                    jitterStatus = jitter.toFixed(2);
                    sonStatus = highPingCount2.toFixed(2);
                } else {
                    pingStatus = "0.00";
                    jitterStatus = "0.00";
                    sonStatus = i > 1 ? "100.00" : "0.00";
                }
            }

            i++;
            tverb("ping: " + pingStatus + " jitter: " + jitterStatus + " high pings: " + highPingCount2);

            if (i < settings.count_ping) {
                setTimeout(doPing, 300);
            } else {
                pingProgress = 1;
                tlog("ping: " + pingStatus + " jitter: " + jitterStatus + " high pings: " + highPingCount2 + ", took " + (new Date().getTime() - startT) + "ms");
                done();
            }
        }.bind(this);

        xhr[0].onerror = function() {
            tverb("ping failed");
            if (settings.xhr_ignoreErrors === 0) {
                pingStatus = "Fail";
                jitterStatus = "Fail";
                sonStatus = i > 1 ? "100.00" : "0.00";
                clearRequests();
                tlog("ping test failed, took " + (new Date().getTime() - startT) + "ms");
                pingProgress = 1;
                done();
            }
            if (settings.xhr_ignoreErrors === 1) {
                doPing();
            }
            if (settings.xhr_ignoreErrors === 2) {
                i++;
                if (i < settings.count_ping) doPing();
                else {
                    pingProgress = 1;
                    tlog("ping: " + pingStatus + " jitter: " + jitterStatus + ", took " + (new Date().getTime() - startT) + "ms");
                    done();
                }
            }
        }.bind(this);

        xhr[0].open("GET", settings.url_ping + url_sep(settings.url_ping) + (settings.mpot ? "cors=true&" : "") + "r=" + Math.random(), true);
        xhr[0].send();
    }.bind(this);

    doPing();
}

function sendTelemetry(done) {
    if (settings.telemetry_level < 1) return;
    xhr = new XMLHttpRequest();
    xhr.onload = function() {
        try {
            var parts = xhr.responseText.split(" ");
            if (parts[0] == "id") {
                try {
                    var id = parts[1];
                    done(id);
                } catch (e) {
                    done(null);
                }
            } else done(null);
        } catch (e) {
            done(null);
        }
    };
    xhr.onerror = function() {
        console.log("TELEMETRY ERROR " + xhr.status);
        done(null);
    };
    xhr.open("POST", settings.url_telemetry + url_sep(settings.url_telemetry) + (settings.mpot ? "cors=true&" : "") + "r=" + Math.random(), true);
    var telemetryIspInfo = {
        processedString: clientIp,
        rawIspInfo: typeof ispInfo === "object" ? ispInfo : ""
    };
    try {
        var fd = new FormData();
        fd.append("ispinfo", JSON.stringify(telemetryIspInfo));
        fd.append("dl", dlStatus);
        fd.append("ul", ulStatus);
        fd.append("ping", pingStatus);
        fd.append("jitter", jitterStatus);
        fd.append("log", settings.telemetry_level > 1 ? log : "");
        fd.append("extra", settings.telemetry_extra);
        xhr.send(fd);
    } catch (ex) {
        var postData = 
            "extra=" + encodeURIComponent(settings.telemetry_extra) + 
            "&ispinfo=" + encodeURIComponent(JSON.stringify(telemetryIspInfo)) + 
            "&dl=" + encodeURIComponent(dlStatus) + 
            "&ul=" + encodeURIComponent(ulStatus) + 
            "&ping=" + encodeURIComponent(pingStatus) + 
            "&jitter=" + encodeURIComponent(jitterStatus) + 
            "&log=" + encodeURIComponent(settings.telemetry_level > 1 ? log : "");
            
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.send(postData);
    }
}

// UI 업데이트 함수
function updateUI(forced) {
    var s = {
        getState: function() {
            return testState;
        }
    };
    
    I("startStopBtn").textContent = s.getState() == 3 ? "중지" : "시작";
    if(!forced && s.getState() != 3) return;
    if(uiData == null) return;
    
    var status = uiData.testState;
    I("ip").textContent = uiData.clientIp;
    I("dlText").textContent = (status == 1 && uiData.dlStatus == 0) ? "..." : format(uiData.dlStatus);
    drawMeter(
        I("dlMeter"),
        mbpsToAmount(Number(uiData.dlStatus*(status==1?oscillate():1))),
        meterBk,
        dlColor,
        Number(uiData.dlProgress),
        progColor
    );
    
    I("ulText").textContent = (status == 3 && uiData.ulStatus == 0) ? "..." : format(uiData.ulStatus);
    drawMeter(
        I("ulMeter"),
        mbpsToAmount(Number(uiData.ulStatus*(status==3?oscillate():1))),
        meterBk,
        ulColor,
        Number(uiData.ulProgress),
        progColor
    );
    
    I("pingText").textContent = format(uiData.pingStatus);
    I("jitText").textContent = format(uiData.jitterStatus);
    
    if(status == 1 || status == 3) {
        if(status == 1 && uiData.dlJitterStatus) {
            I("dlJitterText").textContent = format(uiData.dlJitterStatus);
        }
        if(status == 3 && uiData.ulJitterStatus) {
            I("ulJitterText").textContent = format(uiData.ulJitterStatus);
        }
    }
    
    I("highPingPercent").textContent = uiData.sonStatus;
}
