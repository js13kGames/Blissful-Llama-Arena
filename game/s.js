'use strict';

var io = require('sandbox-io');

var gCounter = 0;

var games = {};

var images = {
    llama: {
        w: {
            n: 0,
            s: 1,
            w: 2,
            e: 3
        },
        b: {
            n: 4,
            s: 5,
            w: 6,
            e: 7
        }
    },
    grass: {
        l: 8,
        m: 9,
        h: 10,
    },
    grain: {
        w: 11,
        b: 12,
    },
    box: 13,
    wall: 14
};

function Game(){
    this.id = gCounter++;
    games[this.id] = this;
    this.players = {};
    this.wall = {};
    this.map = {};

    this.config = {
        square: 32,
        scaled: 128,
        width: 15,
        height: 7,
        pasture: 3,
        maxPlayers: 6,
        wWheat: 20,
        bWheat: 20,
        end: 0,
        pCounter: 0,
        open: 1,
        change: 0,
        wall: 0
    };

    for(var i=0; i<this.config.pasture; i++) for(var j=0; j<this.config.height; j++) this.map[i+j*this.config.width] = images.grain.w;
    this.map[this.config.pasture-1+Math.floor((Math.random()*this.config.height))*this.config.width] = images.grass.m + Math.floor(Math.random()*2) - 1;
    for(var i=this.config.pasture; i<this.config.width-this.config.pasture; i++) for(var j=0; j<this.config.height; j++) this.map[i+j*this.config.width] = images.grass.m + Math.floor(Math.random()*2) - 1;
    for(var i=this.config.width-this.config.pasture; i<this.config.width; i++) for(var j=0; j<this.config.height; j++) this.map[i+j*this.config.width] = images.grain.b;
    this.map[this.config.width-this.config.pasture+Math.floor((Math.random()*this.config.height))*this.config.width] = images.grass.m + Math.floor(Math.random()*2) - 1;

    for(var i=1; i<=this.config.maxPlayers; i++) this.players[i] = {
        fraction: (i % 2),
        x: (i % 2 ? this.config.pasture : this.config.width-this.config.pasture-1),
        y: i,
        image: (i % 2 ? images.llama.w.e : images.llama.b.w),
        jump: 0,
        p: 0,
        lastmove: 0,
    };

    this.entities = {};
    for(var o in this.players) this.entities[this.players[o].x+this.config.width*this.players[o].y] = {field: this.players[o].image, jump: this.players[o].jump};

    setTimeout(this.tic.bind(this), 10);
}


Game.prototype.tic = function() {
    if(this.config.change) io.to(this.id).emit('game', { map: this.map, entities: this.entities, config: this.config }), log('emited '+ this.id), this.config.change = 0;


    if(!this.surprise && !Math.floor(Math.random()*2)) {
        var x = Math.floor(Math.random()*8+3);
        var y = Math.floor(Math.random()*7);
        if(!this.entities[x+this.config.width*y] && this.map[x+y*this.config.width] != images.wall)
            this.surprise = {
                x: x,
                y: y,
                jump: 7,
                type: Math.floor(Math.random()*7),
                image: images.box
            },
            this.config.change = 1;
    } else if(this.surprise && this.surprise.jump > .1) this.surprise.jump -= .1, this.config.change = 1;

    var date = new Date();
    for(var i=1; i<=this.config.maxPlayers; i++) if( !this.players[i].p && Math.random()>.9 && this.players[i].lastmove+500 < date.getTime()) {

        var data = { dist: 1000 };
        for(var j=1; j<=this.config.maxPlayers; j++) if(this.players[j].p && i%2 != j%2 )
            if(this.players[j].x*this.players[j].x + this.players[j].y*this.players[j].y < data.dist)
                data = {
                    dist: this.players[j].x*this.players[j].x + this.players[j].y*this.players[j].y,
                    direction: Math.abs(this.players[i].x - this.players[j].x) + Math.abs(this.players[i].y - this.players[j].y) > 1 ? (
                        Math.abs(this.players[i].x - this.players[j].x) < Math.abs(this.players[i].y - this.players[j].y) ? (this.players[i].y < this.players[j].y ? 4 : 2) : (this.players[i].x < this.players[j].x ? 3 : 1)
                    ) : 0
                };
        if(!data.direction) {
            data.direction = Math.floor(Math.random()*4)+1;
            if(data.direction==2 && i%2 && Math.random()>.5) direction = 4;
            if(data.direction==4 && !i%2 && Math.random()>.5) direction = 2;
        }

        move(this.players[i], this, data.direction);
        this.players[i].lastmove = date.getTime();
    }


    for(var o in this.players) if(this.players[o].jump > .1) this.players[o].jump-=.1, this.config.change = 1;

    if(this.config.change) {
        this.entities = {};
        for(var o in this.players) this.entities[this.players[o].x+this.config.width*this.players[o].y] = {field: this.players[o].image, jump: this.players[o].jump};
        if(this.surprise) this.entities[this.surprise.x+this.config.width*this.surprise.y] = {field: this.surprise.image, jump: this.surprise.jump};
    }


    if(!this.pCounter && this.config.end) delete games[this.id];
    else setTimeout(this.tic.bind(this), 50);
};

function Player(socket) {
    this.socket = socket;

    for(var i=0; i<gCounter; i++) if(games[i] && !games[i].config.end && games[i].config.open) this.game = games[i];
    if(!this.game) this.game = new Game();

    for(var i=1; !this.id; i++) if(!this.game.players[i].p) this.id = i, this.game.players[i].p++, this.game.config.pCounter++;


    if(this.game.config.pCounter==this.game.config.maxPlayers) this.game.config.open = 0;

    for(var o in this.game.players[this.id]) this[o] = this.game.players[this.id][o];

    this.socket.on('move', this.onMove.bind(this));
    this.socket.on('disconnect', this.deletePlayer.bind(this));

    this.socket.join(this.game.id);
}

Player.prototype.onMove = function(data) {
    log("move");
    move(this, this.game, data);
};

Player.prototype.deletePlayer = function(data) {
    this.game.players[this.id].p = 0;
    this.game.config.pCounter--;
    this.game.config.open = 1;
};

function move(player, game, direction) {
    if(game.map[player.x+player.y*game.config.width]==images.grain.w && !player.fraction) game.map[player.x+player.y*game.config.width] = images.grass.m, game.config.wWheat--;
    if(game.map[player.x+player.y*game.config.width]==images.grain.b && player.fraction) game.map[player.x+player.y*game.config.width] = images.grass.m, game.config.bWheat--;

    if(!game.config.wWheat || !game.config.bWheat) {
        if(games[game.id]) games[game.id].config.end = 1;
        if(player.socket) player.socket.disconnect();
    }
    var x = player.x;
    var y = player.y;
    switch (direction) {
        case 1:
            if(x>0) x--, player.image = player.fraction ? images.llama.w.w : images.llama.b.w;
            break;
        case 2:
            if(y>0) y--, player.image = player.fraction ? images.llama.w.n : images.llama.b.n;
            break;
        case 3:
            if(x<game.config.width-1) x++, player.image = player.fraction ? images.llama.w.e : images.llama.b.e;
            break;
        case 4:
            if(y<game.config.height-1) y++, player.image = player.fraction ? images.llama.w.s : images.llama.b.s;
            break;
    }
    player.jump = .7
    if(game.surprise && game.surprise.jump<=.1 && x == game.surprise.x && y == game.surprise.y) {
        if(game.surprise.type == 0) {
            var temp = game.config.wWheat;
            game.config.wWheat = game.config.bWheat, game.config.bWheat = temp;
            for(var i=0; i<game.config.width; i++) for(var j=0; j<game.config.height; j++)
                if(game.map[i+j*game.config.width] == images.grain.w) game.map[i+j*game.config.width] = images.grain.b;
                else if(game.map[i+j*game.config.width] == images.grain.b) game.map[i+j*game.config.width] = images.grain.w;
        } else if (game.surprise.type == 1) {
            game.map[game.surprise.x+game.surprise.y*game.config.width] = images.grain.w;
            game.config.wWheat++;
        } else if (game.surprise.type == 2) {
            game.map[game.surprise.x+game.surprise.y*game.config.width] = images.grain.b;
            game.config.bWheat++;
        } else if (game.surprise.type == 3) {
            game.map[game.surprise.x+game.surprise.y*game.config.width] = images.wall;
        } else if (game.surprise.type == 4) {
            for(var o=1; o<=6; o++) if(game.players[o].fraction==0) game.players[o].fraction=1; else game.players[o].fraction=0;
        } else if (game.surprise.type == 5) {
            if(player.fraction==0) player.fraction=1; else player.fraction=0;
        }

        delete game.entities[game.surprise.x+game.config.width*game.surprise.y];
        delete game.surprise;
    }
    if(game.entities[x+game.config.width*y] || game.map[x+y*game.config.width] == images.wall) x -= (x-player.x)*2, y -= (y-player.y)*2;
    if(game.entities[x+game.config.width*y] || game.map[x+y*game.config.width] == images.wall) x = player.x, y = player.y;

    if(x < 0 || x > 14 || y < 0 || y > 6 ) x = player.x, y = player.y;
    player.x = x, player.y = y;
    game.players[player.id] = player, game.config.change = 1;
}

io.on('connection', function(socket) {
    new Player(socket);
});
