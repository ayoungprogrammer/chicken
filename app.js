
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var async = require('async');
var uuid = require('node-uuid');

var app = express();
var cur_port;

console.log('Current env: '+app.get('env'));
switch (app.get('env')){
case 'production': 
	cur_port = 80; 
	break;
case 'development': 
	app.use(express.errorHandler()); 
	cur_port = 3000;
	break;
default: cur_port = 3000;
}

app.use(express.static(path.join(__dirname, 'public')));


app.get('/', function(req,res){
	res.sendfile('index.html');
});

var io = require('socket.io').listen(app.listen(process.env.PORT ||cur_port));

var queue = [];
var users = {};
var rooms=[];
var num_rooms = 10;
var active_rooms = {};

var cur_room = 0;


const NO_ROOM = -1;
const STATE_READY = 0;
const STATE_ON  = 1;
const STATE_OVER = 2;
function User(username){
	this.username = username;
	this.wins = 0;
	this.disc = false;
	this.room = NO_ROOM;
	this.ready = false;
	this.released = false;
	
}

function Room(number){
	this.state = STATE_READY;
	this.num = number;
	this.cur_users = [];
	this.active = false;
	this.timer = 0;
	this.start_time = 0;
	this.winner = 0;
	this.add_players = function add_players(players){
		this.cur_users = players;
		this.timer = 3000;
	}
	this.remove_players = function remove_players(){
		this.cur_users = [];
		
	}
}
Room.prototype.run = function(){
		var sock1 = this.cur_users[0];
		var sock2 = this.cur_users[1];
		var usr1 = users[sock1.id];
		var usr2 = users[sock2.id];
		switch (this.state){
		
		case STATE_READY: 
			if(usr1.ready==true && usr2.ready==true){
				this.winner = 0;
				this.start_time = new Date().getTime();
				io.sockets.in('room'+this.num).emit('start',[usr1.username,usr2.username]);
				this.state = STATE_ON;
				console.log(usr1.username +"vs"+usr2.username);
				usr1.released = false;
				usr2.released = false;
			}
			break;
		case STATE_ON:
			if(this.winner==0){
				if(usr1.released&&usr2.released){
					this.winner = 3;
				}
				else if(usr1.released){
					this.winner = 2;
				}else if(usr2.released){
					this.winner = 1;
				}
				else if((new Date().getTime()- this.start_time)/1000>=10){
					this.winner = 0;
					this.state = STATE_OVER;
				}
			}
			else {
				if(usr1.released&&usr2.released){
					this.state = STATE_OVER;
				}
				else if((new Date().getTime()- this.start_time)/1000>=10){
					if(!usr1.released&& winner == 1){
						this.winner = 2;
					}
					if(usr2.ready && winner == 2){
						this.winner = 1;
					}
					this.state = STATE_OVER;
				}
			}
			break;
		case STATE_OVER: 
			if(this.winner == 3){
				sock1.emit('tie');
				sock2.emit('tie');
			}
			
			else if(this.winner == 1){
					sock1.emit('win');
					sock2.emit('lose');
					usr2.disc = true;
			}
			else if (this.winner == 2){
				sock2.emit('win');
				sock1.emit('lose');
				usr1.disc = true;
			}else if(this.winner == 3){
				sock1.emit('lose');
				sock2.emit('lose');
			}
			if(!usr1.disc){
				sock1.emit('queue');
				queue.push(sock1);
			}
			if(!usr2.disc){
				sock2.emit('queue');
				queue.push(sock2);
			}
			
			active_rooms[this.room] = false;
			return;
		}
		
			
		setImmediate(this.run.bind(this));
}

for(var i=0;i<num_rooms;i++){
	rooms[i] = new Room(i);
}




io.sockets.on('connection',function (socket){
	//console.log(socket);
	socket.emit('queue');
	console.log(socket.id);
	//socket.id = uuid.v4();
	users[socket.id] = new User('undefined');
	queue.push(socket);
	
	
	socket.on('set_name',function(username){
		users[socket.id].username = username;
		console.log(users[socket.id].username+" has connected");
	});
	socket.on('disconnect',function(){
		users[socket.id].disc = true;	
		console.log(users[socket.id].username+' has disconnected');
		
	});
	socket.on('hold',function (){
		if(users[socket.id].room>=0){
			users[socket.id].ready = true;
		}
	});
	socket.on('release',function(){
		users[socket.id].ready = false;
		users[socket.id].released = true;
	});
});

async.forever(
	function(next){
		if(queue.length>=2){
			var usr1 = users[queue[0].id];
			var usr2 = users[queue[1].id];
			
			
			
			if(usr1.disc == false && usr2.disc == false){
			
				if(!(active_rooms[cur_room]==true)){
					active_rooms[cur_room] = true;
					var sock1 = queue.shift();
					var sock2 = queue.shift();
					sock1.join('room'+cur_room);
					sock2.join('room'+cur_room);
					sock1.emit('join room',cur_room);
					sock2.emit('join room',cur_room);
					usr1.room = usr2.room = cur_room;
					console.log('Room '+cur_room);
					rooms[cur_room].add_players([sock1,sock2]);
					rooms[cur_room].run();
					cur_room++;
					cur_room %= 10;
				}
			}
			else if (usr1.disc == true){
				queue.shift();
			}
			else if (usr2.disc == true){
				queue.shift();
				queue.shift();
				queue.unshift(usr1);
			}
		}
		
		
		setImmediate(next);
	},
	function(){
		console.error('erorr');
	});




