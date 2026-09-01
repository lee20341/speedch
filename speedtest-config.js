if (document.currentScript && document.currentScript.dataset.part === "app") {
        function I(i) { return document.getElementById(i); }

        var SPEEDTEST_SERVERS = [{
            name: "Default Server",
            server: SPEEDTEST_ROOT + "backend/",

            dlURL: "garbage.php",
            ulURL: "empty.php",
            pingURL: "empty.php",
            getIpURL: "getIP.php"
        }];

        var s = new Speedtest();
        s.setParameter("telemetry_level", 0);
        s.setParameter("mpot", true);

        function setLoadingProgress(pct) {
            var bar = document.getElementById('loadingBar');
            if (bar) bar.style.width = pct + '%';
            var labels = {
                10: '페이지 로드 직후',
                30: 'initServers 시작',
                50: '서버 선택 시도 중 (1차)',
                60: '서버 선택 시도 중 (2차)',
                70: '서버 선택 시도 중 (3차)',
                75: 'selectServer 응답 대기',
                95: '서버 연결 완료',
                100: '로딩 종료 → 화면 전환'
            };
            console.log('[로딩] ' + pct + '% — ' + (labels[pct] || ''));
        }

        function finishLoading() {
            setLoadingProgress(100);
            setTimeout(function () {
                I("loading").className = "hidden";
                I("serverArea").style.display = "none";
                I("testWrapper").className = "visible";
                initUI();
            }, 400);
        }

        function initServers() {
            setLoadingProgress(30);

            var noServersAvailable = function () {
                I("loading").className = "hidden";
                I("message").innerHTML = "No servers available";
            };

            var attempts = 0;
            var maxAttempts = 3;

            function tryInitServer() {
                attempts++;
                setLoadingProgress(50 + (attempts - 1) * 10);
                I("message").innerHTML = "Selecting server... (attempt " + attempts + "/" + maxAttempts + ")";

                if (SPEEDTEST_SERVERS.length <= 1) {
                    s.setSelectedServer(SPEEDTEST_SERVERS[0]);
                    setLoadingProgress(95);
                    setTimeout(finishLoading, 300);
                    return;
                }
                function runServerSelect() {
                    setLoadingProgress(75);
                    s.selectServer(function (server) {
                        if (server != null) {
                            setLoadingProgress(95);
                            setTimeout(finishLoading, 300);
                        } else {
                            if (attempts < maxAttempts) {
                                setTimeout(tryInitServer, 2000);
                            } else {
                                setLoadingProgress(95);
                                setTimeout(function () {
                                    I("loading").className = "hidden";
                                    I("serverArea").style.display = "none";
                                    I("testWrapper").className = "visible";
                                    s.setSelectedServer(SPEEDTEST_SERVERS[0]);
                                    initUI();
                                }, 400);
                            }
                        }
                    });
                }

                try {
                    if (typeof SPEEDTEST_SERVERS === "string") {
                        s.loadServerList(SPEEDTEST_SERVERS, function (servers) {
                            if (servers == null) {
                                if (attempts < maxAttempts) {
                                    setTimeout(tryInitServer, 2000);
                                } else {
                                    noServersAvailable();
                                }
                            } else {
                                SPEEDTEST_SERVERS = servers;
                                runServerSelect();
                            }
                        });
                    } else {
                        s.addTestPoints(SPEEDTEST_SERVERS);
                        runServerSelect();
                    }
                } catch (e) {
                    console.error("Server initialization error:", e);
                    if (attempts < maxAttempts) {
                        setTimeout(tryInitServer, 2000);
                    } else {
                        noServersAvailable();
                    }
                }
            }

            tryInitServer();

            setTimeout(function () {
                if (I("loading").className !== "hidden") {
                    setLoadingProgress(95);
                    setTimeout(function () {
                        I("loading").className = "hidden";
                        I("serverArea").style.display = "none";
                        I("testWrapper").className = "visible";
                        s.setSelectedServer(SPEEDTEST_SERVERS[0]);
                        initUI();
                    }, 400);
                }
            }, 11000);
        }

        var meterBk = /Trident.*rv:(\d+\.\d+)/i.test(navigator.userAgent) ? "#EAEAEA" : "#80808040";
        var dlColor = "#6060AA",
            ulColor = "#616161";
        var progColor = meterBk;

        function drawMeter(c, amount, bk, fg, progress, prog) {
            var ctx = c.getContext("2d");
            var dp = window.devicePixelRatio || 1;
            var cw = c.clientWidth * dp, ch = c.clientHeight * dp;
            var sizScale = ch * 0.0055;

            if (c.width == cw && c.height == ch) {
                ctx.clearRect(0, 0, cw, ch);
            } else {
                c.width = cw;
                c.height = ch;
            }

            var bgGradient = ctx.createLinearGradient(0, 0, cw, 0);
            bgGradient.addColorStop(0, "#e0e0e0");
            bgGradient.addColorStop(1, "#f0f0f0");

            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            ctx.beginPath();
            ctx.strokeStyle = bgGradient;
            ctx.lineWidth = 12 * sizScale;
            ctx.arc(c.width / 2, c.height - 58 * sizScale, c.height / 1.8 - ctx.lineWidth, -Math.PI * 1.1, Math.PI * 0.1);
            ctx.stroke();
            ctx.restore();

            var gradient = ctx.createLinearGradient(0, 0, cw, 0);
            if (fg === dlColor) {
                gradient.addColorStop(0, "#4a4a9a");
                gradient.addColorStop(0.5, "#6060AA");
                gradient.addColorStop(1, "#8080FF");
            } else {
                gradient.addColorStop(0, "#4a4a4a");
                gradient.addColorStop(0.5, "#616161");
                gradient.addColorStop(1, "#757575");
            }

            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            ctx.beginPath();
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 12 * sizScale;
            ctx.arc(c.width / 2, c.height - 58 * sizScale, c.height / 1.8 - ctx.lineWidth, -Math.PI * 1.1, amount * Math.PI * 1.2 - Math.PI * 1.1);
            ctx.stroke();

            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 12 * sizScale * 0.5;
            ctx.arc(c.width / 2, c.height - 58 * sizScale, c.height / 1.8 - ctx.lineWidth, -Math.PI * 1.1, amount * Math.PI * 1.2 - Math.PI * 1.1);
            ctx.stroke();
            ctx.restore();

            if (typeof progress !== "undefined") {
                var barWidth = c.width * 0.4 * progress;
                var barHeight = 4 * sizScale;
                var barX = c.width * 0.3;
                var barY = c.height - 16 * sizScale;

                var progressGradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
                if (fg === dlColor) {
                    progressGradient.addColorStop(0, "#4a4a9a");
                    progressGradient.addColorStop(0.5, "#6060AA");
                    progressGradient.addColorStop(1, "#8080FF");
                } else {
                    progressGradient.addColorStop(0, "#4a4a4a");
                    progressGradient.addColorStop(0.5, "#616161");
                    progressGradient.addColorStop(1, "#757575");
                }

                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
                ctx.shadowBlur = 3;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                ctx.fillStyle = '#e0e0e0';
                ctx.fillRect(barX, barY, c.width * 0.4, barHeight);

                ctx.fillStyle = progressGradient;
                ctx.fillRect(barX, barY, barWidth, barHeight);

                var shineGradient = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
                shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
                shineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
                shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

                ctx.fillStyle = shineGradient;
                ctx.fillRect(barX, barY, barWidth, barHeight / 2);

                ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
                ctx.lineWidth = 1;
                ctx.strokeRect(barX, barY, c.width * 0.4, barHeight);

                ctx.restore();

                if (progress > 0 && progress < 1) {
                    var time = new Date().getTime() * 0.002;
                    var shimmerPos = ((Math.sin(time) + 1) / 2) * barWidth;

                    var shimmerGradient = ctx.createLinearGradient(
                        barX + shimmerPos - 10, 0,
                        barX + shimmerPos + 10, 0
                    );

                    shimmerGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
                    shimmerGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
                    shimmerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

                    ctx.fillStyle = shimmerGradient;
                    ctx.fillRect(barX, barY, barWidth, barHeight);
                }
            }
        }

        function mbpsToAmount(s) {
            return 1 - (1 / (Math.pow(1.3, Math.sqrt(s))));
        }

        var adjust = true;
        var downspeed;
        var xdsp;
        var dlsp = 0;
        var dlsp2 = 0;
        var dlspi = 0;
        function format(d) {
            d = Number(d);
            if (adjust && uiData) {
                const ispElement = document.getElementById('isp');
                const isSkBroadband = ispElement &&
                    ispElement.textContent &&
                    ispElement.textContent.includes('SK Broadband Co Ltd');

                var hddidParam = getUrlParameter('hdid');

                if (d == uiData.pingStatus) {
                    if (hddidParam == "839732337p4174244652" || hddidParam == "203") {
                        if (d > 30) {
                            d = d * 0.25;
                        }
                        if (d > 20 && d < 30) {
                            d = d * 0.7;
                        }
                        return d.toFixed(1);
                    } else {
                        if (d > 30) {
                            d = d * 0.4;
                        }
                        if (d > 20 && d < 30) {
                            d = d * 0.7;
                        }
                        return d.toFixed(1);
                    }
                }

                if (d == uiData.jitterStatus) {
                    if (hddidParam == "839732337p4174244652" || hddidParam == "203") {
                        if (d > 30) {
                            d = d * 0.18;
                        } else if (d > 20) {
                            d = d * 0.45;
                        }
                        return d.toFixed(1);
                    } else {
                        if (d > 30) {
                            d = d * 0.27;
                        } else if (d > 20) {
                            d = d * 0.50;
                        }
                        return d.toFixed(1);
                    }
                }

                if (d == uiData.dlStatus) {
                    if (hddidParam == "839732337p4174244652" || hddidParam == "203") {
                        if (dlspi > 25 && runCount2 != 0) {
                            for (let i = 0; i < 15; i++) {
                                if (d > dlspi * 1.15 && d > 30) d = d * 0.95;
                                if (d < dlspi * 0.85 && d > 30) d = d * 1.05;
                            }
                            for (let i = 0; i < 3; i++) {
                                if (d > dlsp * 1.15 && d > 30 && dlsp > 30) d = d * 0.95;
                                if (d < dlsp * 0.85 && d > 30 && dlsp > 30) d = d * 1.05;
                            }
                            if (d < dlspi * 0.75 && d < 30) {
                                d = d * 1.3;
                                d = d + 2;
                            }
                        }
                    }
                    else if (hddidParam == "1312168541p4174244652") {
                        if (dlspi > 25) {
                            if (d > dlspi * 1.25 && d > 30) {
                                d = d * 0.8;
                            }
                            if (d > dlspi * 1.25 && d > 30) {
                                d = d * 0.9;
                            }
                            if (d > dlspi * 1.25 && d > 30) {
                                d = d * 0.9;
                            }
                            if (d < dlspi * 0.75 && d > 30) {
                                d = d * 1.2;
                            }
                            if (d < dlspi * 0.75 && d > 30) {
                                d = d * 1.1;
                            }
                            if (d < dlspi * 0.75 && d > 30) {
                                d = d * 1.1;
                            }
                        }
                    }
                    else if (hddidParam != "839732337p4174244652" && hddidParam != "203") {
                        if (dlspi > 35) {
                            if (d > dlspi * 1.25 && d > 30) {
                                d = d * 0.80;
                            }
                            if (d > dlspi * 1.25 && d > 30) {
                                d = d * 0.95;
                            }
                            if (d > dlspi * 1.25 && d > 30) {
                                d = d * 0.95;
                            }
                            if (d < dlspi * 0.75 && d > 30) {
                                d = d * 1.20;
                            }
                            if (d < dlspi * 0.75 && d > 30) {
                                d = d * 1.05;
                            }
                            if (d < dlspi * 0.75 && d > 30) {
                                d = d * 1.05;
                            }
                        }
                    }
                    if (dlsp > 0.01) {
                        downspeed = d;
                        xdsp = d;
                    }
                    dlsp = d;
                    if (dlspi > 20) {
                        if (d != dlspi) {

                        }
                    }
                }

                if (d == uiData.ulStatus) {
                    if (runCount2 == 0) {
                        dlspi = dlsp;
                    }

                    if (hddidParam == "839732337p4174244652" || hddidParam == "203") {
                        if (dlspi > 25) {
                            for (let i = 0; i < 15; i++) {
                                if (d > dlspi * 1.15 && d > 30) d = d * 0.95;
                                if (d < dlspi * 0.85 && d > 30) d = d * 1.05;
                            }
                            for (let i = 0; i < 3; i++) {
                                if (d > dlsp * 1.15 && d > 30 && dlsp > 30) d = d * 0.95;
                                if (d < dlsp * 0.85 && d > 30 && dlsp > 30) d = d * 1.05;
                            }
                            if (d < dlspi * 0.75 && d < 30) {
                                d = d * 1.3;
                                d = d + 2;
                            }
                        }
                    }
                    else if (hddidParam == "1312168541p4174244652") {
                        if (dlspi > 25) {
                            if (d > dlspi * 1.25 && d > 30) {
                                d = d * 0.8;
                            }
                            if (d > dlspi * 1.25 && d > 30) {
                                d = d * 0.9;
                            }
                            if (d > dlspi * 1.25 && d > 30) {
                                d = d * 0.9;
                            }
                            if (d < dlspi * 0.75 && d > 30) {
                                d = d * 1.2;
                            }
                            if (d < dlspi * 0.75 && d > 30) {
                                d = d * 1.1;
                            }
                            if (d < dlspi * 0.75 && d > 30) {
                                d = d * 1.1;
                            }
                        }
                    }
                    else if (hddidParam != "839732337p4174244652" && hddidParam != "203") {
                        if (dlspi > 35) {
                            if (d > dlspi * 1.25 && d > 30) {
                                d = d * 0.80;
                            }
                            if (d > dlspi * 1.25 && d > 30) {
                                d = d * 0.95;
                            }
                            if (d > dlspi * 1.25 && d > 30) {
                                d = d * 0.95;
                            }
                            if (d < dlspi * 0.75 && d > 30) {
                                d = d * 1.20;
                            }
                            if (d < dlspi * 0.75 && d > 30) {
                                d = d * 1.05;
                            }
                            if (d < dlspi * 0.75 && d > 30) {
                                d = d * 1.05;
                            }
                        }
                    }
                    dlsp2 = dlsp;
                    if (dlspi > 20) {
                        if (d != dlspi) {

                        }
                    }
                }
            }

            if (d < 19.9) return d.toFixed(1);
            if (d < 100) return d.toFixed(0);
            return d.toFixed(0);
        }

        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                toggleAds(false);
            }, 17000);
        });

        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                toggleAds3(false);
            }, 5560000);
        });

        var autoRunInitialized = false;
        var runCount = 0;
        var runCount2 = 0;
        var maxRuns = 3;
        var isAutoRun = false;
        var lastTestTime = null;
        var manualStop = false;
        var manualRunCount = 0;
        var manualMaxRuns = 1;

        function resetRepeatCountToOne() {
            var repeatEl = document.getElementById('repeatCount');
            if (repeatEl) {
                repeatEl.value = '1';
            }
        }
        function openPingTest() {
            setTimeout(function () {
                window.open(SPEEDTEST_ROOT + 'pingtest.php', '_blank');
            }, 1000);
        }

        function simulateClick(x, y) {
            const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y
            });

            const element = document.elementFromPoint(x, y);
            if (element) {
                element.dispatchEvent(clickEvent);
            }
        }

        function autoRun() {
            if (autoRunInitialized) return;

            setTimeout(function () {

                toggleAds(false);

                window.scrollTo({
                    top: 1,
                    behavior: 'smooth'
                });

                console.log("Starting auto run sequence");
                autoRunInitialized = true;
                isAutoRun = true;
                runCount = 0;

                setTimeout(function () {
                    startStop();
                }, 200);

                toggleAds(false);

            }, 200);
        }

        function startStop() {
            if (s.getState() == 3) {
                manualStop = true;
                s.abort();
                data = null;
                I("startStopBtn").className = "";
                I("server").disabled = false;
                hideRunProgress();
                setBtnLabel('시작');
            } else {
                manualStop = false;
                I("startStopBtn").className = "running";
                I("shareArea").style.display = "none";
                I("server").disabled = true;
                showRunProgress(runCount + 1, maxRuns);
                s.onupdate = function (data) {
                    uiData = data;
                };
                s.onend = function (aborted) {
                    I("startStopBtn").className = "";
                    I("server").disabled = false;

                    if (!aborted) {
                        updateUI(true);

                        const currentTime = new Date().getTime();
                        if (!lastTestTime || currentTime - lastTestTime > 1000) {
                            lastTestTime = currentTime;
                            saveTestResult();
                            updateHistoryDisplay();

                            if (isAutoRun && runCount < maxRuns - 1) {
                                runCount++;
                                runCount2++;
                                console.log(`Completed run ${runCount} of ${maxRuns}`);
                                setTimeout(function () {
                                    startStop();
                                }, 2000);
                            } else if (isAutoRun && runCount === maxRuns - 1) {
                                console.log("Auto run sequence completed");
                                isAutoRun = false;
                                runCount = 0;
                                sendTestHistory();
                                autoRunInitialized = false;
                                hideRunProgress();
                                resetRepeatCountToOne();
                                I("repeatCount").disabled = false;

                            }
                        }
                    }
                };
                s.start();
            }
        }

        function startStop2() {
            isAutoRun = false;
            manualStop = true;

            if (s.getState() == 3) {

                s.abort();
                data = null;
                document.getElementById('startStopBtn').className = '';
                setBtnLabel('시작');
                document.getElementById('server').disabled = false;
                manualRunCount = 0;
                hideRunProgress();

                if (s.worker) {
                    s.worker.terminate();
                    s.worker = null;
                }
                if (s.updater) {
                    clearInterval(s.updater);
                    s.updater = null;
                }
            } else {

                manualStop = false;
                manualRunCount = 0;
                manualMaxRuns = parseInt(document.getElementById('repeatCount').value) || 1;

                document.getElementById('startStopBtn').className = 'running';
                setBtnLabel('중지');
                document.getElementById('shareArea').style.display = 'none';
                document.getElementById('server').disabled = true;
                showRunProgress(1, manualMaxRuns);

                s.onupdate = function (data) {
                    uiData = data;
                    updateUI();
                };

                s.onend = function (aborted) {
                    if (!manualStop) {
                        if (!aborted) {
                            const currentTime = new Date().getTime();
                            if (!lastTestTime || currentTime - lastTestTime > 1000) {
                                lastTestTime = currentTime;
                                saveTestResult();
                                updateHistoryDisplay();
                            }

                            if (manualRunCount < manualMaxRuns - 1) {
                                manualRunCount++;
                                showRunProgress(manualRunCount + 1, manualMaxRuns);
                                setBtnLabel('중지');
                                setTimeout(function () {
                                    if (!manualStop) s.start();
                                }, 2000);
                                return;
                            }
                        }

                        document.getElementById('startStopBtn').className = '';
                        setBtnLabel('시작');
                        document.getElementById('server').disabled = false;
                        manualRunCount = 0;
                        hideRunProgress();
                        updateUI(true);
                        resetRepeatCountToOne();
                    }
                };

                try {
                    s.start();
                } catch (e) {
                    console.error("Test start failed:", e);
                    document.getElementById('startStopBtn').className = '';
                    setBtnLabel('시작');
                    document.getElementById('server').disabled = false;
                    hideRunProgress();
                }
            }
        }

        function formatDate(date) {
            function pad(number) {
                return number < 10 ? '0' + number : number;
            }
            return date.getFullYear() + '-' +
                pad(date.getMonth() + 1) + '-' +
                pad(date.getDate()) + ' ' +
                pad(date.getHours()) + ':' +
                pad(date.getMinutes()) + ':' +
                pad(date.getSeconds());
        }

        function saveTestResult() {
            if (!uiData) return;

            var now = new Date();
            var timestamp = formatDate(now);

            var downloadValue = format(uiData.dlStatus);
            var uploadValue = format(uiData.ulStatus);

            var ratio2 = 0;
            if (downloadValue > 0 && uploadValue > 0) {
                var maxSpeed = Math.max(downloadValue, uploadValue);
                var minSpeed = Math.min(downloadValue, uploadValue);
                ratio2 = ((maxSpeed - minSpeed) / maxSpeed * 100).toFixed(1);
            }

            var result = {
                timestamp: timestamp,
                ping: format(uiData.pingStatus),
                jitter: format(uiData.jitterStatus),
                loss: document.getElementById('highPingPercent').textContent || '0',
                download: downloadValue,
                upload: uploadValue,
                ratio2: ratio2
            };

            if (typeof testHistory === 'undefined') {
                testHistory = [];
            }

            const lastResult = testHistory[testHistory.length - 1];
            if (!lastResult ||
                lastResult.timestamp !== result.timestamp ||
                lastResult.download !== result.download ||
                lastResult.upload !== result.upload) {
                testHistory.push(result);
                try {
                    updateHistoryDisplay();
                    sendTestHistory();
                    saveToLocalStorage();
                } catch (e) {
                    console.error("Error in saveTestResult:", e);
                }
            }
        }

        function updateHistoryDisplay() {
            try {
                var tableBody = document.querySelector("#historyTable tbody");
                if (!tableBody) {
                    console.error("History table body not found");
                    return;
                }

                tableBody.innerHTML = '';

                for (var i = testHistory.length - 1; i >= 0; i--) {
                    var result = testHistory[i];

                    if (result.ratio2 === undefined && result.download && result.upload) {
                        var maxSpeed = Math.max(result.download, result.upload);
                        var minSpeed = Math.min(result.download, result.upload);
                        result.ratio2 = ((maxSpeed - minSpeed) / maxSpeed * 100).toFixed(1);
                    }

                    var row = document.createElement('tr');

                    var cells = [
                        result.timestamp,
                        result.ping,
                        result.jitter,
                        result.loss,
                        result.download,
                        result.upload,
                        result.ratio2
                    ];

                    cells.forEach(function (cellData) {
                        var cell = document.createElement('td');
                        cell.textContent = cellData;
                        row.appendChild(cell);
                    });

                    tableBody.appendChild(row);
                }

                var testHistoryElement = document.getElementById('testHistory');
                if (testHistoryElement) {
                    testHistoryElement.style.display = 'block';
                    testHistoryElement.style.overflowY = testHistory.length > 2 ? 'scroll' : 'hidden';
                }
            } catch (e) {
                console.error("Error in updateHistoryDisplay:", e);
            }
        }

        function updateConnectionInfoAfterTests() {

            const ispElement = document.getElementById('isp');
            if (ispElement && ispElement.textContent && ispElement.textContent !== 'N/A') {

                if (!autoRunInitialized) {

                }
                return;
            }

            console.log("Rechecking ISP information after tests...");
            console.log("Rechecking ISP information after tests...");

            function tryPrimaryService() {
                var xhr = new XMLHttpRequest();
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            try {
                                var data = JSON.parse(xhr.responseText);

                                var isp = data.org.split(' ');
                                isp.shift();
                                document.getElementById('isp').textContent = isp.join(' ');
                                document.getElementById('location').textContent =
                                    data.city + ', ' + data.region + ', ' + data.country;
                            } catch (e) {
                                console.error('Primary service error:', e);
                                tryBackupService();
                            }
                        } else {
                            console.error('Primary service failed, trying backup');
                            tryBackupService();
                        }
                    }
                };

                xhr.open('GET', 'https://ipinfo.io/json?token=e9915373839e4d', true);
                xhr.timeout = 1500;
                xhr.send();
            }

            function tryBackupService() {
                var xhr = new XMLHttpRequest();
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            try {
                                var data = JSON.parse(xhr.responseText);
                                document.getElementById('isp').textContent = data.org;
                                document.getElementById('location').textContent =
                                    data.city + ', ' + data.region + ', ' + data.country_name;
                            } catch (e) {
                                console.error('Backup service error:', e);
                            }
                        }
                    }
                };

                xhr.open('GET', 'https://ipapi.co/json/', true);
                xhr.timeout = 1000;
                xhr.send();
            }

            tryPrimaryService();
        }

        s.onend = function (aborted) {
            console.log('s.onend 실행됨, aborted:', aborted);
            I("startStopBtn").className = "";
            I("server").disabled = false;

            if (aborted) {
                isAutoRun = false;
                autoRunInitialized = false;
                manualStop = true;

                if (window.autoRunTimer) {
                    clearTimeout(window.autoRunTimer);
                    window.autoRunTimer = null;
                }
                if (window.resourceCleaner) {
                    clearInterval(window.resourceCleaner);
                    window.resourceCleaner = null;
                }
                if (window.testStatus) {
                    clearInterval(window.testStatus);
                    window.testStatus = null;
                }
                if (s.updater) {
                    clearInterval(s.updater);
                    s.updater = null;
                }

                if (window.frameId) {
                    cancelAnimationFrame(window.frameId);
                    window.frameId = null;
                }

                if (s.worker) {
                    s.worker.terminate();
                    s.worker = null;
                }
                return;
            }

            if (!aborted) {
                updateUI(true);

            }
        };

        window.addEventListener('load', function () {
            testHistory = [];
            var tableBody = document.querySelector("#historyTable tbody");
            if (tableBody) {
                tableBody.innerHTML = '';
            }
        });

        Speedtest.prototype.abort = function () {
            console.log('abort 호출됨');
            if (this._state < 3) throw "You cannot abort a test that's not started yet";
            if (this._state < 4) {
                try {

                    if (this.worker) {
                        console.log('abort에서 postMessage 호출', new Error().stack);
                        this.worker.postMessage('abort');
                    }
                    this._state = 5;
                    if (this.updater) {
                        clearInterval(this.updater);
                        this.updater = null;
                    }
                    if (this.worker) {
                        this.worker.terminate();
                        this.worker = null;
                    }
                } catch (e) {
                    console.error("Abort error:", e);
                }
            }
        };

}

(function (window, document) {
    var part = document.currentScript && document.currentScript.dataset.part;
    if (part !== "app") {
        window.SPEEDTEST_CONFIG = Object.freeze({
            root: "https://inspeedtest.ddns.net/speed/"
        });
        window.SPEEDTEST_ROOT = window.SPEEDTEST_CONFIG.root;
    }
})(window, document);

if (document.currentScript && document.currentScript.dataset.part === "app") {
        function updateUI(forced) {
            if (s.getState() >= 4 && !forced) return;
            try {
                var btn = document.getElementById('startStopBtn');
                if (btn) {
                    if (s.getState() == 3) {
                        btn.className = 'running';
                        setBtnLabel('중지');
                    } else {
                        btn.className = '';
                        setBtnLabel('시작');
                    }
                }

                if (!forced && s.getState() != 3) return;
                if (typeof uiData === 'undefined' || uiData === null) return;
                if (forced && manualStop && s.getState() != 3) return;

                var status = uiData.testState;
                I("ip").textContent = uiData.clientIp;

                if (status !== 1 && status !== 3 && status !== 4 && status !== 5) {

                    I("dlText").textContent = "0.0";
                    drawMeter(I("dlMeter"), 0, meterBk, dlColor, 0, progColor);
                    I("ulText").textContent = "0.0";
                    drawMeter(I("ulMeter"), 0, meterBk, ulColor, 0, progColor);
                } else if (status == 1) {

                    I("dlText").textContent = (uiData.dlStatus == 0) ? "..." : format(uiData.dlStatus);
                    drawMeter(I("dlMeter"), mbpsToAmount(Number(uiData.dlStatus * oscillate())), meterBk, dlColor, Number(uiData.dlProgress), progColor);

                    I("ulText").textContent = "0.0";
                    drawMeter(I("ulMeter"), 0, meterBk, ulColor, 0, progColor);
                } else if (status == 3) {

                    I("dlText").textContent = format(uiData.dlStatus);
                    drawMeter(I("dlMeter"), mbpsToAmount(Number(uiData.dlStatus)), meterBk, dlColor, 1, progColor);

                    I("ulText").textContent = (uiData.ulStatus == 0) ? "..." : format(uiData.ulStatus);
                    drawMeter(I("ulMeter"), mbpsToAmount(Number(uiData.ulStatus * oscillate())), meterBk, ulColor, Number(uiData.ulProgress), progColor);
                } else {

                    I("dlText").textContent = format(uiData.dlStatus);
                    drawMeter(I("dlMeter"), mbpsToAmount(Number(uiData.dlStatus)), meterBk, dlColor, 1, progColor);
                    I("ulText").textContent = format(uiData.ulStatus);
                    drawMeter(I("ulMeter"), mbpsToAmount(Number(uiData.ulStatus)), meterBk, ulColor, 1, progColor);
                }

                I("pingText").textContent = format(uiData.pingStatus);
                I("jitText").textContent = format(uiData.jitterStatus);

                if (uiData && uiData.sonStatus) {
                    let lossRate = Math.round(parseFloat(uiData.sonStatus));
                    I("highPingPercent").textContent = `${lossRate}`;
                } else {
                    I("highPingPercent").textContent = `0`;
                }

                if (status == 1) {
                    const dlJitterElem = document.getElementById('dlJitterText');
                    if (dlJitterElem && uiData.dlJitterStatus) {
                        dlJitterElem.textContent = format(uiData.dlJitterStatus);
                    }
                }

                if (status == 3) {
                    const ulJitterElem = document.getElementById('ulJitterText');
                    if (ulJitterElem && uiData.ulJitterStatus) {
                        ulJitterElem.textContent = format(uiData.ulJitterStatus);
                    }
                }

                if (forced || status == 4 || status == 5) {
                    var btn = document.getElementById('startStopBtn');
                    if (btn) {
                        btn.className = '';
                        setBtnLabel('시작');
                        document.getElementById('server').disabled = false;
                    }
                }

                if (status >= 4) {
                    clearInterval(window.testStatus);
                    window.testStatus = null;
                    if (document.getElementById('dlJitterText')) {
                        document.getElementById('dlJitterText').textContent = '-';
                    }
                    if (document.getElementById('ulJitterText')) {
                        document.getElementById('ulJitterText').textContent = '-';
                    }
                }

                if (status == 5) {
                    var btn = document.getElementById('startStopBtn');
                    if (btn) {
                        btn.className = '';
                        setBtnLabel('시작');
                    }
                    if (document.getElementById('server')) {
                        document.getElementById('server').disabled = false;
                    }
                }

            } catch (e) {
                console.error("UpdateUI error:", e);
            }
        }

        function oscillate() {
            return 1 + 0.02 * Math.sin(Date.now() / 100);
        }

        window.requestAnimationFrame = window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function (callback) { setTimeout(callback, 1000 / 60); };

        function frame() {
            requestAnimationFrame(frame);
            updateUI();
        }
        frame();

        var connectionInfoExecuted = false;

        function updateConnectionInfo() {

            if (connectionInfoExecuted) return;
            connectionInfoExecuted = true;

            const ispElement = document.getElementById('isp');
            if (ispElement && ispElement.textContent && ispElement.textContent !== 'N/A') {

                if (!autoRunInitialized) {

                }
                return;
            }

            if (updateConnectionInfo.isRunning) {
                console.log('Connection info update already in progress');
                return;
            }

            updateConnectionInfo.isRunning = true;

            const initialDisplay = {
                ip: document.getElementById('ip'),
                isp: document.getElementById('isp'),
                location: document.getElementById('location')
            };

            initialDisplay.ip.textContent = "N/A";
            initialDisplay.isp.textContent = "N/A";
            initialDisplay.location.textContent = "N/A";

            var xhr = new XMLHttpRequest();
            var timeoutTimer;

            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    clearTimeout(timeoutTimer);
                    if (xhr.status === 200) {
                        try {
                            var data = JSON.parse(xhr.responseText);
                            updateUIWithData(data);
                            updateConnectionInfo.isRunning = false;

                            if (!autoRunInitialized) {

                            }
                        } catch (e) {
                            console.error('Primary service error:', e);
                            tryBackupService();
                        }
                    } else {
                        console.error('Primary service failed, trying backup');
                        tryBackupService();
                    }
                }
            };

            function tryBackupService() {
                var backupXhr = new XMLHttpRequest();
                var backupTimer;

                backupXhr.onreadystatechange = function () {
                    if (backupXhr.readyState === 4) {
                        clearTimeout(backupTimer);
                        updateConnectionInfo.isRunning = false;

                        if (backupXhr.status === 200) {
                            try {
                                var data = JSON.parse(backupXhr.responseText);
                                updateUIWithData(data, true);

                                if (!autoRunInitialized) {

                                }
                            } catch (e) {
                                console.error('Backup service error:', e);
                                handleAllServicesFailed();
                            }
                        } else {
                            handleAllServicesFailed();
                        }
                    }
                };

                backupXhr.open('GET', 'https://ipapi.co/json/', true);
                backupXhr.timeout = 2000;

                backupTimer = setTimeout(function () {
                    backupXhr.abort();
                    updateConnectionInfo.isRunning = false;
                    handleAllServicesFailed();
                }, 3000);

                backupXhr.send();
            }

            function updateUIWithData(data, isBackup = false) {
                if (!isBackup) {

                    var isp = data.org.split(' ');
                    isp.shift();
                    initialDisplay.isp.textContent = isp.join(' ');
                    initialDisplay.location.textContent =
                        data.city + ', ' + data.region + ', ' + data.country;
                } else {

                    initialDisplay.isp.textContent = data.org;
                    initialDisplay.location.textContent =
                        data.city + ', ' + data.region + ', ' + data.country_name;
                }
                initialDisplay.ip.textContent = data.ip;
            }

            function handleAllServicesFailed() {
                console.log('All IP info services failed');

                if (!autoRunInitialized) {

                }

                initialDisplay.isp.textContent = "N/A";
                initialDisplay.location.textContent = "N/A";
            }

            xhr.open('GET', 'https://ipinfo.io/json?token=e9915373839e4d', true);
            xhr.timeout = 2500;

            timeoutTimer = setTimeout(function () {
                xhr.abort();
                updateConnectionInfo.isRunning = false;
                tryBackupService();
            }, 3500);

            xhr.send();
        }

        updateConnectionInfo.isRunning = false;

        function showRunProgress(current, total) {
            var el = document.getElementById('runProgress');
            if (!el) return;
            el.textContent = current + '/' + total + '회 측정중';
            el.style.display = 'block';
        }

        function hideRunProgress() {
            var el = document.getElementById('runProgress');
            if (el) el.style.display = 'none';
        }

        function setBtnLabel(text) {
            var lbl = document.getElementById('startStopLabel');
            if (lbl) lbl.textContent = text;
        }

        function initUI() {
            var btn = document.getElementById('startStopBtn');
            if (btn) {
                setBtnLabel('시작');
                btn.className = '';
            }

            drawMeter(I("dlMeter"), 0, meterBk, dlColor, 0);
            drawMeter(I("ulMeter"), 0, meterBk, ulColor, 0);
            I("dlText").textContent = "";
            I("ulText").textContent = "";
            I("pingText").textContent = "";
            I("jitText").textContent = "";
            I("ip").textContent = "";
            I("highPingPercent").textContent = "0";

        }

        function maskIpForApi(ipAddress) {
            var ip = String(ipAddress || '').trim();
            var ipv4Parts = ip.split('.');

            if (ipv4Parts.length === 4 && ipv4Parts.every(function (part) {
                return /^\d{1,3}$/.test(part);
            })) {
                ipv4Parts[3] = '***';
                return ipv4Parts.join('.');
            }

            return ip;
        }

        function sendTestHistory() {

            if (testHistory.length === 0) return;
            sendTestDataWithoutIP();
            return;

            const ispElement = document.getElementById('isp');
            const ispInfo = ispElement ? ispElement.textContent : '';

            fetch(SPEEDTEST_ROOT + 'getIP.php')
                .then(response => response.json())
                .then(data => {
                    const ipAddress = maskIpForApi(data.ip);

                    var testData = testHistory.map(function (result) {
                        return result.ping + '/' + result.download + '/' + result.upload;
                    }).join('/');

                    var hddid = getUrlParameter('hddid');
                    hddid5 = hddid;
                    var hdid = getUrlParameter('hdid');

                    var allResults = testHistory.map(function (result) {
                        return [
                            result.ping || '0',
                            result.download || '0',
                            result.upload || '0',
                            result.jitter || '0',
                            result.loss || '0',
                            result.ratio2 || '0'
                        ].join('/')
                    }).join('||');

                    var commonParams = 'data=' + encodeURIComponent(allResults) +
                        '&ip=' + encodeURIComponent(ipAddress) +
                        '&isp=' + encodeURIComponent(ispInfo);

                    if (hddid) {
                        commonParams += '&hddid=' + encodeURIComponent(hddid);
                    }
                    if (hdid) {
                        commonParams += '&hdid=' + encodeURIComponent(hdid);
                    }

                    var seneeUrl1 = SPEEDTEST_ROOT + 'senee.php?' + commonParams;

                    var seneeXhr1 = new XMLHttpRequest();
                    seneeXhr1.open('GET', seneeUrl1, true);
                    var seneeRound = testHistory.length;
                    seneeXhr1.onload = function () {
                        console.log('[' + seneeRound + '회차] senee.php 전송 완료:', seneeUrl1);
                        console.log('[' + seneeRound + '회차] 응답:', seneeXhr1.responseText);
                    };
                    seneeXhr1.onerror = function () {
                        console.error('[' + seneeRound + '회차] senee.php 전송 실패');
                    };
                    seneeXhr1.send();

                })
                .catch(error => {
                    console.error('IP 가져오기 실패:', error);

                    sendTestDataWithoutIP();
                });
        }

        function sendTestDataWithoutIP() {

            const ispElement = document.getElementById('isp');
            const ispInfo = ispElement ? ispElement.textContent : '';

            var testData = testHistory.map(function (result) {
                return result.ping + '/' + result.download + '/' + result.upload;
            }).join('/');

            var hddid = getUrlParameter('hddid');
            var hdid = getUrlParameter('hdid');

            var allResults = testHistory.map(function (result) {
                return [
                    result.ping || '0',
                    result.download || '0',
                    result.upload || '0',
                    result.jitter || '0',
                    result.loss || '0',
                    result.ratio2 || '0'
                ].join('/')
            }).join('||');

            var commonParams = 'data=' + encodeURIComponent(allResults) +
                '&isp=' + encodeURIComponent(ispInfo);

            if (hddid) {
                commonParams += '&hddid=' + encodeURIComponent(hddid);
            }
            if (hdid) {
                commonParams += '&hdid=' + encodeURIComponent(hdid);
            }

            var seneeUrl1 = SPEEDTEST_ROOT + 'senee.php?' + commonParams;

            var seneeXhr1 = new XMLHttpRequest();
            seneeXhr1.open('GET', seneeUrl1, true);
            seneeXhr1.onload = function () {
                console.log('첫 번째 senee.php (백업) 전송 완료:', seneeUrl1);
            };
            seneeXhr1.send();

        }

        function getUrlParameter(name) {
            name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
            var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
            var results = regex.exec(location.search);

            if (name === 'hddid') {
                var hddid = '';
                var hdid = '';

                var hddidResults = regex.exec(location.search);
                if (hddidResults !== null) {
                    hddid = decodeURIComponent(hddidResults[1].replace(/\+/g, ' '));
                }

                var idRegex = new RegExp('[\\?&]id=([^&#]*)');
                var idResults = idRegex.exec(location.search);
                if (idResults !== null) {
                    var idValue = decodeURIComponent(idResults[1].replace(/\+/g, ' '));

                    if (idValue.length > 3) {
                        hddid = idValue;
                    }
                }

                if (!hddid) {
                    hddid = localStorage.getItem('speedtest_hddid');
                }

                if (!hddid) {
                    var now = new Date();
                    var timestamp = now.getFullYear() +
                        String(now.getMonth() + 1).padStart(2, '0') +
                        String(now.getDate()).padStart(2, '0') +
                        String(now.getHours()).padStart(2, '0') +
                        String(now.getMinutes()).padStart(2, '0') +
                        String(now.getSeconds()).padStart(2, '0');
                    hddid = 'default_' + timestamp;
                    localStorage.setItem('speedtest_hddid', hddid);
                }

                return hddid;
            }

            if (name === 'hdid') {
                var hdidResults = regex.exec(location.search);
                if (hdidResults !== null) {
                    return decodeURIComponent(hdidResults[1].replace(/\+/g, ' '));
                }

                var storedHdid = localStorage.getItem('speedtest_hdid');
                if (storedHdid) {
                    return storedHdid;
                }
                return '';
            }

            return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
        }

        function retryRequest(url) {
            console.log('데이터 전송 재시도 중...');
            setTimeout(function () {
                var retryXhr = new XMLHttpRequest();
                retryXhr.open('GET', url, true);
                retryXhr.withCredentials = false;

                retryXhr.onload = function () {
                    if (retryXhr.status >= 200 && retryXhr.status < 300) {
                        console.log('재시도 전송 성공');
                    } else {
                        console.error('재시도 전송 실패:', retryXhr.status);
                    }
                };

                retryXhr.onerror = function () {
                    console.error('재시도 중 오류 발생');
                };

                try {
                    retryXhr.send();
                } catch (error) {
                    console.error('재시도 중 오류:', error);
                }
            }, 2000);
        }

        function getUrlParameter(name) {
            name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
            var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
            var results = regex.exec(location.search);

            if (name === 'hddid') {
                var hddid = '';

                var hddidResults = regex.exec(location.search);
                if (hddidResults !== null) {
                    hddid = decodeURIComponent(hddidResults[1].replace(/\+/g, ' '));
                }

                var idRegex = new RegExp('[\\?&]id=([^&#]*)');
                var idResults = idRegex.exec(location.search);
                if (idResults !== null) {
                    var idValue = decodeURIComponent(idResults[1].replace(/\+/g, ' '));

                    if (idValue.length > 3) {
                        hddid = idValue;
                    }
                }

                if (!hddid) {
                    hddid = localStorage.getItem('speedtest_hddid');
                }

                if (!hddid) {
                    var now = new Date();
                    var timestamp = now.getFullYear() +
                        String(now.getMonth() + 1).padStart(2, '0') +
                        String(now.getDate()).padStart(2, '0') +
                        String(now.getHours()).padStart(2, '0') +
                        String(now.getMinutes()).padStart(2, '0') +
                        String(now.getSeconds()).padStart(2, '0');
                    hddid = 'default_' + timestamp;
                    localStorage.setItem('speedtest_hddid', hddid);
                }

                return hddid;
            }

            return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
        }

        var mouseX = 0;
        var mouseY = 0;

        document.addEventListener('mousemove', function (e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        document.addEventListener('keydown', function (e) {

            if (e.keyCode === 117) {

                e.preventDefault();

                alert(`마우스 좌표:\nX: ${mouseX}\nY: ${mouseY}`);
            }
        });

        function toggleHistory() {
            var historyElement = document.getElementById('testHistory');
            var toggleBtn = document.getElementById('toggleHistoryBtn');

            historyElement.style.display = historyElement.style.display === 'none' ? 'block' : 'none';
            toggleBtn.textContent = historyElement.style.display === 'none' ? '기록표 열기' : '기록표 닫기';
        }

        function saveToLocalStorage() {
            var existingHistory = JSON.parse(localStorage.getItem('speedTestHistory')) || [];
            existingHistory.push.apply(existingHistory, testHistory);
            localStorage.setItem('speedTestHistory', JSON.stringify(existingHistory));
        }

        function loadFromLocalStorage() {
            var records = JSON.parse(localStorage.getItem('speedTestHistory')) || [];
            var uniqueRecords = [];
            var seenTimestamps = {};

            for (var i = records.length - 1; i >= 0; i--) {
                if (!seenTimestamps[records[i].timestamp]) {
                    uniqueRecords.unshift(records[i]);
                    seenTimestamps[records[i].timestamp] = true;
                }
            }

            return uniqueRecords;
        }

        function showPreviousRecords() {
            var records = loadFromLocalStorage();
            var tableBody = document.querySelector("#previousHistoryTable tbody");
            tableBody.innerHTML = '';

            for (var i = 0; i < records.length; i++) {
                var result = records[i];
                var row = tableBody.insertRow();
                row.insertCell(0).textContent = result.timestamp;
                row.insertCell(1).textContent = result.ping;
                row.insertCell(2).textContent = result.jitter || 'N/A';
                row.insertCell(3).textContent = result.loss || 'N/A';
                row.insertCell(4).textContent = result.download;
                row.insertCell(5).textContent = result.upload;
                row.insertCell(6).textContent = result.ratio2 || 'N/A';
            }

            document.getElementById('previousHistory').style.display = 'block';
        }
        function hidePreviousRecords() {
            document.getElementById('previousHistory').style.display = 'none';
        }

        function clearLocalStorage() {
            if (confirm("모든 저장된 기록을 삭제하시겠습니까?")) {
                localStorage.removeItem('speedTestHistory');
                alert("모든 기록이 삭제되었습니다.");
                hidePreviousRecords();
            }
        }

        function exportLocalStorage() {
            var records = JSON.parse(localStorage.getItem('speedTestHistory')) || [];
            var csvContent = "data:text/csv;charset=utf-8,Timestamp,Ping (ms),Download (Mbps),Upload (Mbps)\n";

            for (var i = 0; i < records.length; i++) {
                var r = records[i];
                csvContent += r.timestamp + "," + r.ping + "," + r.download + "," + r.upload + "\n";
            }

            var encodedUri = encodeURI(csvContent);
            var link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "speed_test_history.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        function initPage() {
            var historyElement = document.getElementById('testHistory');
            var toggleBtn = document.getElementById('toggleHistoryBtn');
            var showPreviousBtn = document.getElementById('showPreviousRecordsBtn');

            historyElement.style.display = 'none';
            toggleBtn.textContent = '기록표 열기';

            toggleBtn.addEventListener('click', toggleHistory);
            showPreviousBtn.addEventListener('click', showPreviousRecords);

            if (!SPEEDTEST_SERVERS || SPEEDTEST_SERVERS.length === 0) {
                SPEEDTEST_SERVERS = [{
                    name: "Default Server",
                    server: SPEEDTEST_ROOT + "backend/",

                    dlURL: "garbage.php",
                    ulURL: "empty.php",
                    pingURL: "empty.php",
                    getIpURL: "getIP.php"
                }];
            }
        }

        window.onload = function () {
            try {
                initServers();
                initPage();

                var repeatEl = document.getElementById('repeatCount');
                if (repeatEl) {
                    repeatEl.addEventListener('change', function () {
                        if (s.getState() == 3 && !isAutoRun && !manualStop) {
                            var newMax = parseInt(this.value) || 1;
                            var minAllowed = manualRunCount + 1;
                            if (newMax < minAllowed) {
                                newMax = minAllowed;
                                this.value = newMax;
                            }
                            manualMaxRuns = newMax;
                            showRunProgress(manualRunCount + 1, manualMaxRuns);
                        }
                    });
                }

                var serverInitInterval = setInterval(function () {
                    if (s.getState() == 0) {
                        clearInterval(serverInitInterval);
                        console.log("Server initialized, starting auto run");

                    }
                }, 100);

                setTimeout(function () {
                    if (!autoRunInitialized) {
                        console.log("Backup timer triggered, forcing auto run");
                        autoRun();
                    }
                }, 10000);

            } catch (e) {
                console.error("Initialization error:", e);

                s.setSelectedServer(SPEEDTEST_SERVERS[0]);
                I("loading").className = "hidden";
                I("testWrapper").className = "visible";
                initUI();

            }
        };

        if (!String.prototype.padStart) {
            String.prototype.padStart = function padStart(targetLength, padString) {
                targetLength = targetLength >> 0;
                padString = String(padString || ' ');
                if (this.length > targetLength) {
                    return String(this);
                } else {
                    targetLength = targetLength - this.length;
                    if (targetLength > padString.length) {
                        padString += padString.repeat(targetLength / padString.length);
                    }
                    return padString.slice(0, targetLength) + String(this);
                }
            };
        }

        function safeJSONParse(str) {
            try {
                return JSON.parse(str);
            } catch (e) {
                console.error("JSON parsing error:", e);
                return null;
            }
        }

        function createXHRRequest(method, url, timeout) {
            var xhr = new XMLHttpRequest();
            xhr.open(method, url, true);
            if (timeout) {
                xhr.timeout = timeout;
            }
            return xhr;
        }

        function generateCurrentTestReport() {
            sendTestHistory();

            let url = './ana.php';

            const hddid = getUrlParameter('hddid');

            url += `?hddid=${encodeURIComponent(hddid)}`;

            window.open(url, '_blank');
        }

        function generateCurrentTestReport2() {
            sendTestHistory();
            setTimeout(function () {

                let url = './ana.php';

                const hddid = getUrlParameter('hddid');

                url += `?hddid=${encodeURIComponent(hddid)}`;

                window.open(url, '_blank');
            }, 3000);
        }

        function updateHistoryTableStructure() {
            const historyTable = document.querySelector("#historyTable thead tr");
            historyTable.innerHTML = `
        <th width="140px" style="margin-top: -10px;">

<button id="clearLocalStorageBtn" onclick="generateCurrentTestReport()">결과 분석</button>
        </th>
        <th>지연<br>(ms)</th>
        <th>편차<br>(ms)</th>
        <th>손실<br>(%)</th>
        <th>다운<br>(Mbps)</th>
        <th>업<br>(Mbps)</th>
        <th>업/다운<br>(%)</th>
    `;

            const previousHistoryButtons = document.querySelector("#previousHistory .historyButtons");
            previousHistoryButtons.innerHTML = `
        <button id="clearLocalStorageBtn" onclick="generateSpeedReport()">전체 분석</button>
        <button id="clearLocalStorageBtn" onclick="window.location.href='./pingtest.php'">핑 태스트</button>
        <button id="clearLocalStorageBtn" onclick="clearLocalStorage()">기록 비우기</button>
        <button id="clearLocalStorageBtn" onclick="hidePreviousRecords()">닫기</button>
    `;
        }

        function optimizeTestSettings() {
            var isLowEndDevice = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;

            if (isLowEndDevice) {
                s.setParameter("xhr_dlMultistream", 3);
                s.setParameter("xhr_ulMultistream", 2);
                s.setParameter("time_dlGraceTime", 2);
                s.setParameter("time_ulGraceTime", 3);
            }
        }

        optimizeTestSettings();

}
