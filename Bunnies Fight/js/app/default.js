/// <reference path="../libs/jquery-2.0.3.js" />
/// <reference path="../libs/easeljs-0.7.1.min.js" />
/// <reference path="../libs/preloadjs-0.4.1.min.js" />
/// <reference path="../libs/class.js" />

var BunniesFight = BunniesFight || {};

BunniesFight.GameEngine = (function () {
    var MARGIN_X = 120;
    var MARGIN_Y = 25;
    var GROUND_Y = 390;
    var PLAYERSLIVES = 3;
    var player1Lives = PLAYERSLIVES;
    var player2Lives = PLAYERSLIVES;
    var stage, preload;
    var bgImage, p1Image, p2Image, ammoImage, arrowImage;
    var bgBitmap, p1Bitmap, p2Bitmap, ammoBitmap, arrowBitmap;
    var p1Lives, p2Lives;

    var isShotFlying = false;
    var playerTurn = 1;
    var playerFire = false;
    var shotVelocity;
    var MAX_SHOT_POWER = 10;
    var GRAVITY = 0.07;

    var aimVector;
    
    var init = function () {
        stage = new createjs.Stage("game-canvas");
        preload = new createjs.LoadQueue(false);
        var manifest = [
                { src: "img/Backgrounds/gameplay_screen.png", id: "screenImage" },
                { src: "img/Catapults/Red/redIdle/redIdle.png", id: "redImage" },
                { src: "img/Catapults/Blue/blueIdle/blueIdle.png", id: "blueImage" },
                { src: "img/Ammo/rock_ammo.png", id: "ammoImage" },
                { src: "img/Ammo/arrow.png", id: "arrowImage" },
        ];

        preload.loadManifest(manifest);
        preload.on("complete", loadGame);
    };

    var loadGame = function () {
        //Draw background
        bgImage = preload.getResult("screenImage");
        bgBitmap = new createjs.Bitmap(bgImage);
        stage.addChild(bgBitmap);

        //Draw player1
        p1Image = preload.getResult("redImage");
        p1Bitmap = new createjs.Bitmap(p1Image);
        p1Bitmap.x = MARGIN_X;
        p1Bitmap.y = GROUND_Y - p1Image.height;
        stage.addChild(p1Bitmap);

        //Draw player2
        p2Image = preload.getResult("blueImage");
        p2Bitmap = new createjs.Bitmap(p2Image);
        p2Bitmap.scaleX = -1; //Flip image
        p2Bitmap.x = $("#game-canvas").width() - MARGIN_X;
        p2Bitmap.y = GROUND_Y - p2Image.height;
        stage.addChild(p2Bitmap);

        //Draw ammo
        ammoImage = preload.getResult("ammoImage");
        ammoBitmap = new createjs.Bitmap(ammoImage);
        ammoBitmap.visible = false;
        stage.addChild(ammoBitmap);

        //Draw arrow
        arrowImage = preload.getResult("arrowImage");
        arrowBitmap = new createjs.Bitmap(arrowImage);
        arrowBitmap.visible = false;
        arrowBitmap.regY = arrowImage.height / 2;
        stage.addChild(arrowBitmap);

        //Draw text
        p1Lives = new createjs.Text("Lives left: " + player1Lives, "20px sans-serif", "red");
        p1Lives.x = MARGIN_X;
        p1Lives.y = MARGIN_Y;
        stage.addChild(p1Lives);

        p2Lives = new createjs.Text("Lives left: " + player2Lives, "20px sans-serif", "blue");
        p2Lives.x = $("#game-canvas").width() - MARGIN_X - p2Lives.getMeasuredWidth();
        p2Lives.y = MARGIN_Y;
        stage.addChild(p2Lives);

        stage.update();

        startGame();
    };

    var startGame = function () {
        createjs.Ticker.setInterval(window.requestAnimationFrame);
        createjs.Ticker.on("tick", gameLoop);

        $("#game-canvas").on("click", function () { $("#game-canvas").off("mousemove", adjustAim); });
        $("#game-canvas").on("mousedown", function () {
            $("#game-canvas").off("mouseup", endAim);
            $("#game-canvas").on("mousemove", adjustAim);
        });

        //canvas.on("MSPointerUp", endAim, false);
        //canvas.on("MSPointerMove", adjustAim, false);
        //canvas.on("MSPointerDown", beginAim, false);
        
    };    

    var adjustAim = function (evt) {
        var aimDirection = new createjs.Point(evt.clientX, evt.clientY);

        //Put arrow image
        arrowBitmap.x = p1Bitmap.x + 50;
        arrowBitmap.y = p1Bitmap.y + arrowImage.height / 2;

        //Get angle in radians
        var angleRad = Math.atan2((p1Bitmap.y - aimDirection.y), (aimDirection.x - p1Bitmap.x));
        var angleDeg = angleRad * 180 / Math.PI;
        arrowBitmap.rotation = -angleDeg;
        arrowBitmap.visible = true;
        arrowBitmap.scaleX = (aimDirection.x - p1Bitmap.x) / 100;
        $("#game-canvas").on("mouseup", endAim);
    };

    var endAim = function (evt) {
        $("#game-canvas").off("mousemove", adjustAim);
        var aimCurrent = new createjs.Point(evt.clientX, evt.clientY);
        var aimStart = new createjs.Point(arrowBitmap.x, arrowBitmap.y);
        aimVector = calculateAim(aimStart, aimCurrent);
        playerFire = true;
        arrowBitmap.visible = false;
    };

    var calculateAim = function (start, end) {
        var aim = new createjs.Point((end.x - start.x) / 50, (end.y - start.y) / 50);
        aim.x = Math.min(MAX_SHOT_POWER, aim.x);
        aim.x = Math.max(0, aim.x);
        aim.y = Math.max(-MAX_SHOT_POWER, aim.y);
        aim.y = Math.min(0, aim.y);
        return aim;
    };
    
    var gameLoop = function (evt) {
        if (!evt.paused) {
            if (isShotFlying) {
                ammoBitmap.x += shotVelocity.x;
                ammoBitmap.y += shotVelocity.y;
                shotVelocity.y += GRAVITY;
                
                if (ammoBitmap.y + ammoImage.height >= GROUND_Y || ammoBitmap.x <= 0 || ammoBitmap.x + ammoImage.width >= $("#game-canvas").width()) {
                    //Missed
                    isShotFlying = false;
                    ammoBitmap.visible = false;
                    playerTurn = playerTurn % 2 + 1;
                }
                else if (playerTurn == 1) {
                    var isItHit = checkHit(p2Bitmap);
                    if (isItHit) {
                        p2Lives.text = "Lives left: " + --player2Lives;
                        processHit();
                    }
                }
                else if (playerTurn == 2) {
                    var isItHit = checkHit(p1Bitmap);
                    if (isItHit) {
                        p1Lives.text = "Lives left: " + --player1Lives;
                        processHit();
                    }
                }
            }
            else if (playerTurn == 1) {
                if (playerFire) {
                    playerFire = false;
                    ammoBitmap.x = p1Bitmap.x + p1Image.width / 2;
                    ammoBitmap.y = p1Bitmap.y;
                    shotVelocity = aimVector;
                    ammoBitmap.visible = true;
                    isShotFlying = true;
                }
            }
            else if (playerTurn == 2) {
                ammoBitmap.x = p2Bitmap.x + p2Image.width / 2;
                ammoBitmap.y = p2Bitmap.y;
                shotVelocity = new createjs.Point(Math.random() * (-4) - 3, Math.random() * (-3) - 1);
                ammoBitmap.visible = true;
                isShotFlying = true;
            }

            stage.update();
        }
    };

    var checkHit = function (target) {
        //Get center of rock
        var shotX = ammoBitmap.x + ammoImage.width / 2;
        var shotY = ammoBitmap.y + ammoImage.height / 2;

        var isItHit = (((shotX >= target.x) && (shotX <= target.x + target.image.width)) && ((shotY >= target.y) && (shotY <= target.y + target.image.height)));

        return isItHit;
    };

    var processHit = function () {
        isShotFlying = false;
        ammoBitmap.visible = false;
        playerTurn = playerTurn % 2 + 1;

        if ((player1Lives <= 0) || (player2Lives <= 0)) {
            endGame();
        }
    };          

    var endGame = function () {
        createjs.Ticker.setPaused(true);
    };

    return {
        init: init
    };
}());

    

    




