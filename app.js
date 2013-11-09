
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
	
}

function Room(number){
	this.state = STATE_READY;
	this.num = number;
	this.cur_users = [];
	this.active = false;
	this.timer = 0;
	this.start_time = 0;
	this.winner = false;
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
				this.winner = false;
				this.start_time = new Date().getTime();
				io.sockets.in('room'+this.num).emit('start',[usr1.username,usr2.username]);
				this.state = STATE_ON;
				console.log(usr1.username +"vs"+usr2.username);
			}
			break;
		case STATE_ON:
			if(!this.winner){
				if(!usr1.ready&&!usr2.ready){
					this.winner = true;
					sock1.emit('tie');
					sock2.emit('tie');
					this.winner = true;
				}
				else if(!usr1.ready){
					sock1.emit('lose');
					usr1.disc = true;
					this.winner = true;
				}else if(!usr2.ready){
					sock2.emit('lose');
					usr2.disc = true;
					this.winner = true;
				}
				else if((new Date().getTime()- this.start_time)/1000>=10){
					usr1.disc = true;
					usr2.disc = true;
					sock1.emit('lose');
					sock2.emit('lose');
					this.state = STATE_OVER;
				}
			}
			else {
				if(!usr1.ready&&!usr2.ready){
					this.state = STATE_OVER;
				}
				if((new Date().getTime()- this.start_time)/1000>=10){
					if(usr1.ready){
						usr1.disc = true;
						sock1.emit('lose');
					}
					if(usr2.ready){
						usr2.disc = true;
						sock2.emit('lose');
					}
					this.state = STATE_OVER;
				}
			}
			break;
		case STATE_OVER: 
			if(usr1.disc == false && usr2.disc == false){
				sock1.emit('queue');
				sock2.emit('queue');
				queue.push(sock1);
				queue.push(sock2);
			}
			else if(usr1.disc == false ){
				sock1.emit('win');
				usr1.wins++;
				queue.push(sock1);
				sock1.emit('queue');
			}
			else if(usr2.disc == false){
				sock2.emit('win');
				usr2.wins++;
				queue.push(sock2);
				sock2.emit('queue');
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
		console.log("HOLDING " +users[socket.id].room);
		if(users[socket.id].room>=0){
			users[socket.id].ready = true;
		}
	});
	socket.on('release',function(){
		users[socket.id].ready = false;
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




