'use strict';

var socket = {};
var connected = false;
var game = {};
var direction = 0;
var touch = null;
var lastmove = 0;

var context = document.getElementById('c').getContext('2d');

context.imageSmoothingEnabled = false;
context.webkitImageSmoothingEnabled = false;
context.mozImageSmoothingEnabled = false;

var imageObj = new Image();
imageObj.src = 'i.png';

function connect() {
    connected = true;
    if (!socket.connected) socket = io(document.location.href);
    socket.on('game', function(data) { game = data; });
    socket.on('disconnect',  function(data) { setTimeout(function(){connected = false; socket = {}; game = {}; setTimeout(function(){window.location.href = window.location.href;},3000);},5000); });
    setTimeout(tic, 10);
}

function tic() {
    var d = new Date();
    context.clearRect(0, 0, 1920, 960);
    var x=0, y=0;
    if(game.map) for(var i=0; i<15; i++) for(var j=0; j<7; j++) {
        drawOne(game.map[i+j*game.config.width],i,j);
        if(game.entities[i+j*game.config.width]) drawOne(game.entities[i+j*game.config.width].field,i,j-game.entities[i+j*game.config.width].jump);
    } else context.drawImage(imageObj, 96, 0, 32, 32, 768, 224, 384, 384);
    if(connected && direction && lastmove+500 < d.getTime() ) socket.emit('move', direction ), direction = 0, lastmove = d.getTime();
    window.requestAnimationFrame(tic);
};

function drawOne(id, x, y) {
    context.drawImage(imageObj, game.config.square*id, 0, game.config.square, game.config.square, game.config.scaled*x, 64+game.config.scaled*y, game.config.scaled, game.config.scaled);
}

document.ontouchstart = function(ev) {
    touch = ev.changedTouches[0];
    ev.preventDefault();
};

document.ontouchmove = function(ev) {
    var newTouch = ev.changedTouches[0], x = (newTouch.screenX-touch.screenX)*.1, y = (newTouch.screenY-touch.screenY)*.1;
    if(Math.abs(x)>Math.abs(y)) if(x < -1) direction = 1; else if(x > 1) direction = 3;
    if(Math.abs(x)<Math.abs(y)) if(y < -1) direction = 2; else if(y > 1) direction = 4;
    touch = newTouch;
    ev.preventDefault();
};

document.onkeydown = function(ev) {
    if(ev.keyCode > 36 && ev.keyCode < 41) direction = ev.keyCode-36, ev.preventDefault();
};

window.onload = connect();
