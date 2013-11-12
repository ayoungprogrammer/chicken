var username = prompt("Enter your username");

var hostname = window.location.hostname;



var socket = io.connect(hostname,username);

var timerHandle;
var startTime;
var room;
var wins=0;

socket.on('connect',function(){
	socket.emit('set_name',username);
	$('#log').append('Connected to server<br>');
});

socket.on('queue',function(){
	$('#log').append('In game queue<br>');
});
 
socket.on('join room',function(data,players){
	room = 1;
	$('#log').append('Joined room '+data+'<br>Hold (space) to start.<br>');
	startTime = new Date().getTime();
	if(timerHandle)clearInterval(timerHandle);
	timerHandle = setInterval(tick2,1);
});

socket.on('start',function(data){
	room = 2;
	$('#log').append('Game start<br>'+data[0]+' vs '+data[1]+'<br>');
	if(timerHandle){
		clearInterval(timerHandle);
	}
	startTime = new Date().getTime();
	timerHandle = setInterval(tick,1);
});

function tick(){
	var t = Math.max(0,(5-(new Date().getTime()-startTime)/1000.0));
	$('#timer').text('Time: '+t.toFixed(3)+'s');
}
function tick2(){
	var t = Math.max(0,(10-(new Date().getTime()-startTime)/1000.0));
	$('#timer').text('Time to press space: '+t.toFixed(3)+'s');
}


socket.on('tie',function(data){
	if(timerHandle){
		clearInterval(timerHandle);
	}
	$('#log').append('tie<br>');
});

socket.on('win',function(data){
	if(timerHandle){
		clearInterval(timerHandle);
	}
	$('#log').append('you win<br>');
	socket.emit('submit',prompt('Enter site submission'));
	wins++;
	$('#wins').text('Wins: '+wins);
});

socket.on('lose',function(data){
	window.location.replace(data);
});

function checkKey(e){
	if(e.which=='32'){
		socket.emit('hold');
	}
}
function releaseKey(e){
	if(e.which=='13'&&room == 2){
		if(timerHandle){
			clearInterval(timerHandle);
		}
		socket.emit('release');
		room = 0;
		//$('#log').append(' release<br>');
	}
}

if ($.browser.mozilla) {
    $(document).keypress (checkKey);
} else {
    $(document).keydown (checkKey);
}

$(document).keyup(releaseKey);