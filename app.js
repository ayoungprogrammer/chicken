
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

io.enable('browser client minification');  // send minified client
io.enable('browser client etag');          // apply etag caching logic based on version number
io.enable('browser client gzip');          // gzip the file

io.set('transports', ['websocket', 'flashsocket']);

var queue = [];
var users = {};
var rooms=[];
var num_rooms = 10;
var active_rooms = {};
var sites = [];

var cur_room = 0;

const THRESH = 0.2;
const NO_ROOM = -1;
const STATE_WAITING = 0;
const STATE_READY = 1;
const STATE_ON  = 2;
const STATE_OVER = 3;
const STATE_CLEAN = 4;
const WAIT_TIME = 10;

function getSite(){
	
	if(sites.length > 0)return sites.shift();
	else return 'http://www.google.ca';
}

function User(username){
	this.username = username;
	this.wins = 0;
	this.disc = false;
	this.room = NO_ROOM;
	this.ready = false;
	this.released = false;
	this.submit = false;
	this.connected = false;
	
}

function Room(number){
	this.state = STATE_READY;
	this.num = number;
	this.cur_users = [];
	this.active = false;
	this.timer = 0;
	this.start_time = 0;
	this.winner = 0;
	this.wait_time = 0;
	this.setup = function(players){
		this.wait_time = new Date().getTime();
		this.cur_users = players;
		this.state = STATE_READY;
	}
}
Room.prototype.run = function(){
		var sock1 = this.cur_users[0];
		var sock2 = this.cur_users[1];
		var usr1 = users[sock1.id];
		var usr2 = users[sock2.id];
		
		var cur_time = new Date().getTime();
		
		switch (this.state){
		
		case STATE_READY: 
			if(usr1.ready==true && usr2.ready==true){
				this.winner = 0;
				this.timer = 5;
				this.start_time = cur_time;
				io.sockets.in('room'+this.num).emit('start',[usr1.username,usr2.username]);
				this.state = STATE_ON;
				//console.log(usr1.username +"vs"+usr2.username);
				usr1.released = false;
				usr2.released = false;
			}else {
				if((cur_time-this.wait_time)/1000.0>=WAIT_TIME){
					if(usr1.ready == false){
						usr1.disc = true;
						sock1.emit('lose',getSite());
					}else {
						sock1.emit('queue');
						queue.push(sock1);
					}
					if(usr2.ready == false){
						usr2.disc = true;
						sock2.emit('lose',getSite());
					}else {
						sock2.emit('queue');
						queue.push(sock2);
					}
					this.state = STATE_CLEAN;
				}
			}
			break;
		case STATE_ON:
			if(usr1.disc == true && usr2.disc == true){
				this.winner = 0;
				this.state = STATE_OVER;
			}else if(usr1.disc==true){
				this.winner = 2;
				this.state = STATE_OVER;
			}else if(usr2.disc == true){
				this.winner = 1;
				this.state = STATE_OVER;
			}
			else {
				if(this.winner==0){
					if(usr1.released && usr2.released){
						this.winner = 3;
					}
					else if(usr1.released){
						this.winner = 2;
					}else if(usr2.released){
						this.winner = 1;
					}
					else if((cur_time-this.start_time)/1000.0>=this.timer+THRESH){
						this.winner = 0;
						this.state = STATE_OVER;
					}
				}
				else {
					if(usr1.released&&usr2.released){
						this.state = STATE_OVER;
					}
					else if((cur_time-this.start_time)/1000.0>=this.timer+THRESH){
						if(!usr1.released && this.winner == 1){
							this.winner = 2;
						}
						if(!usr2.released && this.winner == 2){
							this.winner = 1;
						}
						this.state = STATE_OVER;
					}
				}
			}
			break;
		case STATE_OVER: 
			if(this.winner == 3){
				sock1.emit('tie');
				sock2.emit('tie');
			}
			
			else if(this.winner == 1){
					usr1.wins++;
					sock1.emit('win');
					usr1.submit = true;
					sock2.emit('lose',getSite());
					usr2.disc = true;
			}
			else if(this.winner == 2){
				usr2.wins++;
				sock2.emit('win');
				usr2.submit = true;
				sock1.emit('lose',getSite());
				usr1.disc = true;
			}else if(this.winner == 0){
				sock1.emit('lose',getSite());
				sock2.emit('lose',getSite());
				usr1.disc = true;
				usr2.disc = true;
			}
			
			
			this.state = STATE_CLEAN;
			
		case STATE_CLEAN:
			usr1.room = NO_ROOM;
			usr2.room = NO_ROOM;
			sock1.leave('room'+this.num);
			sock2.leave('room'+this.num);
			usr1.ready = usr2.ready = false;
			
			active_rooms[this.num] = false;
			return;
			
		}
		
			
		setImmediate(this.run.bind(this));
}

for(var i=0;i<num_rooms;i++){
	rooms[i] = new Room(i);
}




io.sockets.on('connection',function (socket){
	//console.log(socket);
	
	//console.log(socket.id);
	//socket.id = uuid.v4();
	users[socket.id] = new User(username);
	
	socket.on('set_name',function(username){
		if(!users[socket.id].connected){
			users[socket.id].connected = true;
			users[socket.id].username = username;
			socket.emit('queue');
			queue.push(socket);
			console.log(users[socket.id].username+" has connected");
		}
	});
	socket.on('disconnect',function(){
		users[socket.id].disc = true;	
		console.log(users[socket.id].username+' has disconnected');
		
	});
	
	socket.on('submit',function(site){
		if(users[socket.id].submit){
			users[socket.id].submit = false;
			
			if(site==undefined||site == ''){
				
				
				site = 'http://www.google.ca';
			}
			
			else if(site.substring(0,7)!='http://'){
				site = 'http://'+site;
			}
			
			sites.push(site);
			
			
			socket.emit('queue');
			queue.push(socket);
			
		}
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
					usr1.ready = usr2.ready = false;
					rooms[cur_room].setup([sock1,sock2]);
					rooms[cur_room].run();
					cur_room++;
					cur_room %= num_rooms;
				}
			}
			else if(usr1.disc==true && usr2.disc == true){
				queue.shift();
				queue.shift();
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
		console.error('error');
	});




