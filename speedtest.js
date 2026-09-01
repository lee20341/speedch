/*
	LibreSpeed - Main
	by Federico Dossena
	https://github.com/librespeed/speedtest/
	GNU LGPLv3 License
*/

function Speedtest() {
    this._serverList = []; //when using multiple points of test, this is a list of test points
    this._selectedServer = null; //when using multiple points of test, this is the selected server
    this._settings = {}; //settings for the speed test worker
    this._state = 0; //0=adding settings, 1=adding servers, 2=server selection done, 3=test running, 4=done
}

var testStatus = null; // to store the setInterval() function for the auto refresh

Speedtest.prototype = {
    constructor: Speedtest,
    /**
     * Returns the state of the test: 0=adding settings, 1=adding servers, 2=server selection done, 3=test running, 4=done
     */
    getState: function () {
        return this._state;
    },
    /**
     * Change one of the test settings from their defaults.
     * - parameter: string with the name of the parameter that you want to set
     * - value: new value for the parameter
     */
    setParameter: function (parameter, value) {
        if (this._state == 3) throw "You cannot change the test settings while running the test";
        this._settings[parameter] = value;
        if(parameter === "telemetry_extra"){
            this._originalExtra = this._settings.telemetry_extra;
        }
    },
    /**
     * Used internally to check if a server object contains all the required elements.
     * Also fixes the server URL if needed.
     */
    _checkServerDefinition: function (server) {
        try {
            if (typeof server.name !== "string")
                throw "Name string missing from server definition (name)";
            if (typeof server.server !== "string")
                throw "Server address string missing from server definition (server)";
            if (server.server.charAt(server.server.length - 1) != "/")
                server.server += "/";
            if (server.server.indexOf("//") == 0)
                server.server = location.protocol + server.server;
            if (typeof server.dlURL !== "string")
                throw "Download URL string missing from server definition (dlURL)";
            if (typeof server.ulURL !== "string")
                throw "Upload URL string missing from server definition (ulURL)";
            if (typeof server.pingURL !== "string")
                throw "Ping URL string missing from server definition (pingURL)";
            if (typeof server.getIpURL !== "string")
                throw "GetIP URL string missing from server definition (getIpURL)";
        } catch (e) {
            throw "Invalid server definition";
        }
    },
    /**
     * Add a test point (multiple points of test)
     * server: the server to be added as an object. Must contain the following elements:
     *  {
     *       name: "User friendly name",
     *       server:"http://yourBackend.com/",   URL to your server. You can specify http:// or https://. If your server supports both, just write // without the protocol
     *       dlURL:"garbage.php"   path to garbage.php or its replacement on the server
     *       ulURL:"empty.php"   path to empty.php or its replacement on the server
     *       pingURL:"empty.php"   path to empty.php or its replacement on the server. This is used to ping the server by this selector
     *       getIpURL:"getIP.php"   path to getIP.php or its replacement on the server
     *   }
     */
    addTestPoint: function (server) {
        this._checkServerDefinition(server);
        if (this._state == 0) this._state = 1;
        if (this._state != 1) throw "You can't add a server after server selection";
        this._settings.mpot = true;
        this._serverList.push(server);
    },
    /**
     * Same as addTestPoint, but you can pass an array of servers
     */
    addTestPoints: function (list) {
        for (var i = 0; i < list.length; i++) {
            this.addTestPoint(list[i]);
        }
    },
    /**
     * Returns the selected server (multiple points of test)
     */
    getSelectedServer: function () {
        if (this._state < 2 || this._selectedServer == null)
            throw "No server is selected";
        return this._selectedServer;
    },
    /**
     * Manually selects one of the test points (multiple points of test)
     */
    setSelectedServer: function (server) {
        this._checkServerDefinition(server);
        if (this._state == 3)
            throw "You can't select a server while the test is running";
        // Remote test points need the CORS query parameter in worker requests.
        this._settings.mpot = true;
        this._selectedServer = server;
        this._state = 2;
    },

    /**
     * Automatically selects a server from the list of added test points.
     */
    selectServer: function(result) {
        var self = this;

        if (this._state !== 1) {
            if (this._state === 0) throw "No test points added";
            if (this._state === 2) throw "Server already selected";
            if (this._state >= 3) throw "You can't select a server while the test is running";
        }

        // 서버 리스트가 비어있는 경우 기본 서버 사용
        if (!this._serverList || this._serverList.length === 0) {
            var defaultServer = {
                name: "Default Server",
                server: window.location.origin + "/",
                dlURL: "garbage.php",
                ulURL: "empty.php",
                pingURL: "empty.php",
                getIpURL: "getIP.php",
                pingT: 0
            };
            this._selectedServer = defaultServer;
            this._state = 2;
            if (result) result(defaultServer);
            return;
        }

        function pingTest(server, callback) {
            var xhr = new XMLHttpRequest();
            var url = server.server + server.pingURL +
                (server.pingURL.indexOf("?") === -1 ? "?" : "&") +
                "cors=true&r=" + Math.random();
            var startTime = new Date().getTime();

            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        var duration = new Date().getTime() - startTime;
                        callback(duration);
                    } else {
                        callback(-1);
                    }
                }
            };

            xhr.onerror = function() {
                callback(-1);
            };

            try {
                xhr.open("GET", url, true);
                xhr.timeout = 2000; // 2초 타임아웃
                xhr.send();
            } catch (e) {
                callback(-1);
            }
        }

        var serversTestedCount = 0;
        var selectedServer = null;
        var fastestPing = -1;

        function testServer(server) {
            pingTest(server, function(pingTime) {
                server.pingT = pingTime;
                serversTestedCount++;

                if (pingTime !== -1 && (fastestPing === -1 || pingTime < fastestPing)) {
                    selectedServer = server;
                    fastestPing = pingTime;
                }

                if (serversTestedCount === self._serverList.length) {
                    if (selectedServer === null) {
                        selectedServer = self._serverList[0]; // 모든 서버가 실패하면 첫 번째 서버 선택
                    }
                    self._selectedServer = selectedServer;
                    self._state = 2;
                    if (result) result(selectedServer);
                }
            });
        }

        // 모든 서버 테스트 시작
        for (var i = 0; i < this._serverList.length; i++) {
            testServer(this._serverList[i]);
        }

        // 10초 후에도 서버 선택이 안되면 첫 번째 서버 선택
        setTimeout(function() {
            if (self._state !== 2) {
                self._selectedServer = self._serverList[0];
                self._state = 2;
                if (result) result(self._selectedServer);
            }
        }, 10000);
    },

    /**
     * Starts the test.
     */
    start: function () {
        var self = this;
        if (this._state == 3) throw "Test already running";

        this.worker = new Worker("speedtest_worker.js?r=" + Math.random());
        this.worker.onmessage = function (e) {
            if (e.data === this._prevData) return;
            else this._prevData = e.data;
            
            try {
                var data = JSON.parse(e.data);
                if (self.onupdate) self.onupdate(data);
                if (data.testState >= 4) {
                    if (self.onend) self.onend(data.testState === 5);
                    self._state = 4;
                }
            } catch (e) {
                console.error("Speedtest onupdate/onend event threw exception: " + e);
            }
        };

        this.updater = setInterval(function () {
            if (self.worker) {
                self.worker.postMessage('status');
            }
        }, 200);

        if (this._state == 1) {
            throw "When using multiple points of test, you must call selectServer before starting the test";
        }

        if (this._state == 2) {
            this._settings.url_dl = this._selectedServer.server + this._selectedServer.dlURL;
            this._settings.url_ul = this._selectedServer.server + this._selectedServer.ulURL;
            this._settings.url_ping = this._selectedServer.server + this._selectedServer.pingURL;
            this._settings.url_getIp = this._selectedServer.server + this._selectedServer.getIpURL;
            
            if (typeof this._originalExtra !== 'undefined') {
                this._settings.telemetry_extra = JSON.stringify({
                    server: this._selectedServer.name,
                    extra: this._originalExtra
                });
            } else {
                this._settings.telemetry_extra = JSON.stringify({
                    server: this._selectedServer.name
                });
            }
        }

        this._state = 3;
        //this.worker.postMessage('start ' + JSON.stringify(this._settings));
        if (this.worker) {
            this.worker.postMessage('start ' + JSON.stringify(this._settings));
        }
    },

    /**
     * Aborts the test while it's running.
     */
    abort: function () {
        if (this._state < 3) throw "You cannot abort a test that's not started yet";
        if (this._state < 4) {
            if (this.worker) {
                this.worker.postMessage('abort');
            }
            if (this.updater) clearInterval(this.updater);
        }
    }
};

// Speedtest settings
Speedtest.prototype.getSettings = function() {
    return {
        mpot: false,
        test_order: "___P_D_U",
        time_ul_max: 7,
        time_dl_max: 7,
        time_auto: true,
        time_ulGraceTime: 3,
        time_dlGraceTime: 3,
        count_ping: 10,
        url_dl: "garbage.php",
        url_ul: "empty.php",
        url_ping: "empty.php",
        url_getIp: "getIP.php",
        getIp_ispInfo: true,
        getIp_ispInfo_distance: "km",
        xhr_dlMultistream: 4,
        xhr_ulMultistream: 3,
        xhr_multistreamDelay: 300,
        xhr_ignoreErrors: 1,
        xhr_dlUseBlob: false,
        xhr_ul_blob_megabytes: 20,
        garbagePhp_chunkSize: 100,
        enable_quirks: true,
        ping_allowPerformanceApi: true,
        overheadCompensationFactor: 1.06,
        useMebibits: false,
        telemetry_level: 0,
        url_telemetry: "results/telemetry.php",
        telemetry_extra: ""
    };
};

window.Speedtest = Speedtest;
